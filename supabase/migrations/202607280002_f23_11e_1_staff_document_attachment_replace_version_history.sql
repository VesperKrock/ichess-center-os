-- F23.11E.1 - replace private staff document attachments without overwriting objects.
-- Migration-ready only. Do not apply from the public runtime.

alter table public.center_staff_document_attachments
  add column if not exists replaces_attachment_id uuid null,
  add column if not exists archive_reason text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.center_staff_document_attachments'::regclass
      and c.conname = 'center_staff_document_attachments_replaces_fk'
  ) then
    alter table public.center_staff_document_attachments
      add constraint center_staff_document_attachments_replaces_fk
      foreign key (replaces_attachment_id)
      references public.center_staff_document_attachments (id)
      on delete restrict
      not valid;
  end if;
end;
$$;

alter table public.center_staff_document_attachments
  validate constraint center_staff_document_attachments_replaces_fk;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.center_staff_document_attachments'::regclass
      and c.conname = 'center_staff_document_attachments_replaces_not_self_check'
  ) then
    alter table public.center_staff_document_attachments
      add constraint center_staff_document_attachments_replaces_not_self_check
      check (replaces_attachment_id is null or replaces_attachment_id <> id);
  end if;
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.center_staff_document_attachments'::regclass
      and c.conname = 'center_staff_document_attachments_archive_reason_check'
  ) then
    alter table public.center_staff_document_attachments
      add constraint center_staff_document_attachments_archive_reason_check
      check (
        archive_reason is null
        or (state = 'archived' and archive_reason = 'replaced')
      );
  end if;
end;
$$;

comment on column public.center_staff_document_attachments.replaces_attachment_id is
  'Immutable link to the prior successful version; failed attempts are excluded from normal history.';
comment on column public.center_staff_document_attachments.archive_reason is
  'Allowlisted archive reason only. F23.11E.1 writes replaced and never deletes the prior object.';

drop index if exists public.center_staff_document_attachments_document_version_unique;
create unique index center_staff_document_attachments_document_version_unique
  on public.center_staff_document_attachments (center_id, document_id, version)
  where state in ('available', 'archived');

create unique index if not exists center_staff_document_attachments_successful_replacement_unique
  on public.center_staff_document_attachments (replaces_attachment_id)
  where replaces_attachment_id is not null
    and state in ('available', 'archived');

create or replace function public.guard_center_staff_document_attachment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.id,
    new.center_id,
    new.staff_member_id,
    new.administrative_profile_id,
    new.document_id,
    new.bucket_id,
    new.object_path,
    new.original_file_name,
    new.safe_file_name,
    new.mime_type,
    new.size_bytes,
    new.checksum,
    new.uploaded_by_user_id,
    new.created_at,
    new.version,
    new.replaces_attachment_id
  ) is distinct from row(
    old.id,
    old.center_id,
    old.staff_member_id,
    old.administrative_profile_id,
    old.document_id,
    old.bucket_id,
    old.object_path,
    old.original_file_name,
    old.safe_file_name,
    old.mime_type,
    old.size_bytes,
    old.checksum,
    old.uploaded_by_user_id,
    old.created_at,
    old.version,
    old.replaces_attachment_id
  ) then
    raise exception 'staff_document_attachment_identity_immutable';
  end if;

  if old.state = new.state then
    if new.is_primary is distinct from old.is_primary
      or new.upload_failure_reason is distinct from old.upload_failure_reason
      or new.archived_at is distinct from old.archived_at
      or new.archived_by_user_id is distinct from old.archived_by_user_id
      or new.archive_reason is distinct from old.archive_reason then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  if old.state = 'pending' and new.state = 'available' then
    if new.is_primary is not true
      or new.upload_failure_reason is not null
      or new.archived_at is not null
      or new.archived_by_user_id is not null
      or new.archive_reason is not null then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  if old.state = 'pending' and new.state = 'failed' then
    if new.is_primary is distinct from old.is_primary
      or new.upload_failure_reason is null
      or new.archived_at is not null
      or new.archived_by_user_id is not null
      or new.archive_reason is not null then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  if old.state = 'available' and new.state = 'archived' then
    if old.is_primary is not true
      or new.is_primary is not false
      or new.archived_at is null
      or new.archived_by_user_id is distinct from auth.uid()
      or new.archive_reason is distinct from 'replaced'
      or new.upload_failure_reason is distinct from old.upload_failure_reason then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  raise exception 'staff_document_attachment_transition_invalid';
end;
$$;

revoke all on function public.guard_center_staff_document_attachment_update()
  from public, anon, authenticated;

create or replace function public.prepare_staff_document_attachment_replacement(
  p_center_id text,
  p_staff_member_id text,
  p_administrative_profile_id text,
  p_document_id text,
  p_expected_current_attachment_id uuid,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns setof public.center_staff_document_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.center_staff_document_attachments%rowtype;
  v_attachment_id uuid := gen_random_uuid();
  v_extension text;
  v_safe_file_name text;
  v_original_file_name text;
  v_object_path text;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if p_center_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_staff_member_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_administrative_profile_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_document_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_expected_current_attachment_id is null then
    raise exception 'staff_document_attachment_identity_invalid';
  end if;
  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
    raise exception 'staff_document_attachment_mime_invalid';
  end if;
  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 10485760 then
    raise exception 'staff_document_attachment_size_invalid';
  end if;

  v_original_file_name := left(
    regexp_replace(btrim(coalesce(p_original_file_name, '')), '^.*[\\/]', ''),
    240
  );
  if v_original_file_name = ''
    or v_original_file_name in ('.', '..')
    or v_original_file_name ~ '[[:cntrl:]]' then
    raise exception 'staff_document_attachment_filename_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_center_id || ':' || p_document_id, 0)
  );

  select * into v_current
  from public.center_staff_document_attachments a
  where a.id = p_expected_current_attachment_id
    and a.center_id = p_center_id
    and a.staff_member_id = p_staff_member_id
    and a.administrative_profile_id = p_administrative_profile_id
    and a.document_id = p_document_id
    and a.state = 'available'
    and a.is_primary = true
    and a.archived_at is null
  for update;
  if not found then
    raise exception 'staff_document_attachment_replacement_stale';
  end if;

  v_extension := case p_mime_type
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
  end;
  v_safe_file_name := 'attachment.' || v_extension;
  v_object_path := 'centers/' || p_center_id
    || '/staff/' || p_staff_member_id
    || '/documents/' || p_document_id
    || '/' || v_attachment_id::text
    || '/' || v_safe_file_name;

  return query
  insert into public.center_staff_document_attachments (
    id,
    center_id,
    staff_member_id,
    administrative_profile_id,
    document_id,
    bucket_id,
    object_path,
    original_file_name,
    safe_file_name,
    mime_type,
    size_bytes,
    state,
    is_primary,
    version,
    uploaded_by_user_id,
    replaces_attachment_id
  ) values (
    v_attachment_id,
    p_center_id,
    p_staff_member_id,
    p_administrative_profile_id,
    p_document_id,
    'staff-administrative-documents',
    v_object_path,
    v_original_file_name,
    v_safe_file_name,
    p_mime_type,
    p_size_bytes,
    'pending',
    false,
    v_current.version + 1,
    auth.uid(),
    v_current.id
  )
  returning *;
end;
$$;

create or replace function public.finalize_staff_document_attachment_replacement(
  p_center_id text,
  p_replacement_attachment_id uuid,
  p_expected_current_attachment_id uuid
)
returns setof public.center_staff_document_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_id text;
  v_replacement public.center_staff_document_attachments%rowtype;
  v_current public.center_staff_document_attachments%rowtype;
  v_object storage.objects%rowtype;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if p_replacement_attachment_id is null or p_expected_current_attachment_id is null then
    raise exception 'staff_document_attachment_identity_invalid';
  end if;

  select a.document_id into v_document_id
  from public.center_staff_document_attachments a
  where a.id = p_replacement_attachment_id
    and a.center_id = p_center_id
    and a.uploaded_by_user_id = auth.uid();
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_center_id || ':' || v_document_id, 0)
  );

  select * into v_replacement
  from public.center_staff_document_attachments a
  where a.id = p_replacement_attachment_id
    and a.center_id = p_center_id
    and a.uploaded_by_user_id = auth.uid()
  for update;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;
  if v_replacement.replaces_attachment_id is distinct from p_expected_current_attachment_id then
    raise exception 'staff_document_attachment_replacement_stale';
  end if;
  if v_replacement.state = 'available'
    and v_replacement.is_primary = true
    and v_replacement.archived_at is null then
    return next v_replacement;
    return;
  end if;
  if v_replacement.state <> 'pending'
    or v_replacement.is_primary <> false
    or v_replacement.archived_at is not null then
    raise exception 'staff_document_attachment_replacement_state_invalid';
  end if;

  select * into v_current
  from public.center_staff_document_attachments a
  where a.id = p_expected_current_attachment_id
    and a.center_id = p_center_id
    and a.staff_member_id = v_replacement.staff_member_id
    and a.administrative_profile_id = v_replacement.administrative_profile_id
    and a.document_id = v_replacement.document_id
    and a.state = 'available'
    and a.is_primary = true
    and a.archived_at is null
  for update;
  if not found then
    raise exception 'staff_document_attachment_replacement_stale';
  end if;
  if v_replacement.version <> v_current.version + 1 then
    raise exception 'staff_document_attachment_replacement_version_invalid';
  end if;

  select * into v_object
  from storage.objects o
  where o.bucket_id = v_replacement.bucket_id
    and o.name = v_replacement.object_path;
  if not found then
    raise exception 'staff_document_attachment_object_missing';
  end if;
  if coalesce((v_object.metadata ->> 'size')::bigint, -1) <> v_replacement.size_bytes
    or coalesce(v_object.metadata ->> 'mimetype', '') <> v_replacement.mime_type then
    raise exception 'staff_document_attachment_object_metadata_mismatch';
  end if;

  update public.center_staff_document_attachments
  set
    state = 'archived',
    is_primary = false,
    archived_at = now(),
    archived_by_user_id = auth.uid(),
    archive_reason = 'replaced'
  where id = v_current.id;

  update public.center_staff_document_attachments
  set
    state = 'available',
    is_primary = true,
    upload_failure_reason = null
  where id = v_replacement.id
  returning * into v_replacement;

  return next v_replacement;
end;
$$;

revoke all on function public.prepare_staff_document_attachment_replacement(
  text, text, text, text, uuid, text, text, bigint
) from public, anon;
revoke all on function public.finalize_staff_document_attachment_replacement(
  text, uuid, uuid
) from public, anon;
grant execute on function public.prepare_staff_document_attachment_replacement(
  text, text, text, text, uuid, text, text, bigint
) to authenticated;
grant execute on function public.finalize_staff_document_attachment_replacement(
  text, uuid, uuid
) to authenticated;

drop policy if exists "f23_11e select staff document attachments by center role"
  on public.center_staff_document_attachments;
drop policy if exists "f23_11e insert pending staff document attachments by center role"
  on public.center_staff_document_attachments;
drop policy if exists "f23_11e update staff document attachments by center role"
  on public.center_staff_document_attachments;

create policy "f23_11e select staff document attachments by center role"
on public.center_staff_document_attachments
for select
to authenticated
using (
  public.can_manage_staff_document_attachments(center_id)
  and (
    state in ('available', 'archived')
    or (state = 'pending' and uploaded_by_user_id = auth.uid())
  )
);

revoke all on table public.center_staff_document_attachments from public, anon, authenticated;
grant select on table public.center_staff_document_attachments to authenticated;

drop policy if exists "f23_11e read staff document objects by center role"
  on storage.objects;
drop policy if exists "f23_11e insert staff document objects by pending metadata"
  on storage.objects;
drop policy if exists "f23_11e update staff document objects"
  on storage.objects;
drop policy if exists "f23_11e delete staff document objects"
  on storage.objects;

create policy "f23_11e read staff document objects by center role"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'staff-administrative-documents'
  and exists (
    select 1
    from public.center_staff_document_attachments a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and public.can_manage_staff_document_attachments(a.center_id)
      and (
        (
          a.state = 'available'
          and a.is_primary = true
          and a.archived_at is null
        )
        or (
          a.state = 'archived'
          and a.is_primary = false
          and a.archived_at is not null
        )
        or (
          a.state = 'pending'
          and a.archived_at is null
          and a.uploaded_by_user_id = auth.uid()
        )
      )
  )
);

create policy "f23_11e insert staff document objects by pending metadata"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'staff-administrative-documents'
  and exists (
    select 1
    from public.center_staff_document_attachments a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.state = 'pending'
      and a.archived_at is null
      and a.uploaded_by_user_id = auth.uid()
      and public.can_manage_staff_document_attachments(a.center_id)
  )
);

-- F23.11E.1 intentionally creates no Storage UPDATE or DELETE policy.
-- Failed/orphan replacement cleanup remains deferred to F23.11E.2.

create or replace function public.staff_document_attachment_backend_readiness(
  p_center_id text
)
returns table (ready boolean, schema_version integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_manage_staff_document_attachments(p_center_id)
      and to_regclass('public.center_staff_document_attachments') is not null
      and exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'center_staff_document_attachments'
          and c.column_name = 'replaces_attachment_id'
      )
      and exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'center_staff_document_attachments'
          and c.column_name = 'archive_reason'
      )
      and to_regprocedure(
        'public.prepare_staff_document_attachment_replacement(text,text,text,text,uuid,text,text,bigint)'
      ) is not null
      and to_regprocedure(
        'public.finalize_staff_document_attachment_replacement(text,uuid,uuid)'
      ) is not null
      and has_function_privilege(
        'authenticated',
        'public.prepare_staff_document_attachment_replacement(text,text,text,text,uuid,text,text,bigint)',
        'execute'
      )
      and has_function_privilege(
        'authenticated',
        'public.finalize_staff_document_attachment_replacement(text,uuid,uuid)',
        'execute'
      )
      and not has_function_privilege(
        'anon',
        'public.prepare_staff_document_attachment_replacement(text,text,text,text,uuid,text,text,bigint)',
        'execute'
      )
      and not has_function_privilege(
        'anon',
        'public.finalize_staff_document_attachment_replacement(text,uuid,uuid)',
        'execute'
      )
      and exists (
        select 1
        from storage.buckets b
        where b.id = 'staff-administrative-documents'
          and b.public = false
          and b.file_size_limit = 10485760
          and b.allowed_mime_types @> array[
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp'
          ]::text[]
      )
      and exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'center_staff_document_attachments'
          and c.relrowsecurity = true
      )
      and exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'center_staff_document_attachments'
          and p.policyname = 'f23_11e select staff document attachments by center role'
      )
      and exists (
        select 1
        from pg_policies p
        where p.schemaname = 'storage'
          and p.tablename = 'objects'
          and p.policyname = 'f23_11e read staff document objects by center role'
      )
      and exists (
        select 1
        from pg_policies p
        where p.schemaname = 'storage'
          and p.tablename = 'objects'
          and p.policyname = 'f23_11e insert staff document objects by pending metadata'
      )
      and has_table_privilege(
        'authenticated',
        'public.center_staff_document_attachments',
        'select'
      )
      and not has_table_privilege(
        'authenticated',
        'public.center_staff_document_attachments',
        'insert'
      )
      and not has_table_privilege(
        'authenticated',
        'public.center_staff_document_attachments',
        'update'
      )
      and not has_table_privilege(
        'authenticated',
        'public.center_staff_document_attachments',
        'delete'
      ),
    2;
$$;

revoke all on function public.staff_document_attachment_backend_readiness(text)
  from public, anon;
grant execute on function public.staff_document_attachment_backend_readiness(text)
  to authenticated;

notify pgrst, 'reload schema';
