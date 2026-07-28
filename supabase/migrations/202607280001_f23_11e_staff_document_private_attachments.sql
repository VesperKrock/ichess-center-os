-- F23.11E - private staff administrative document attachments.
-- Migration-ready only: review and apply manually after SUP-CF.1 authorization review.
-- This migration never creates memberships and never exposes a public bucket.

create or replace function public.can_manage_staff_document_attachments(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and nullif(btrim(requested_center_id), '') is not null
    and exists (
      select 1
      from public.center_members cm
      where cm.center_id = requested_center_id
        and cm.user_id = auth.uid()
        and lower(btrim(coalesce(cm.status::text, ''))) = 'active'
        and lower(
          replace(
            replace(btrim(coalesce(cm.role::text, '')), '-', '_'),
            ' ',
            '_'
          )
        ) in ('owner', 'center_admin')
    );
$$;

revoke all on function public.can_manage_staff_document_attachments(text)
  from public, anon;
grant execute on function public.can_manage_staff_document_attachments(text) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'staff-administrative-documents',
  'staff-administrative-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.center_staff_document_attachments (
  id uuid primary key default gen_random_uuid(),
  center_id text not null,
  staff_member_id text not null,
  administrative_profile_id text not null,
  document_id text not null,
  bucket_id text not null default 'staff-administrative-documents',
  object_path text not null,
  original_file_name text not null,
  safe_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum text null,
  state text not null default 'pending',
  upload_failure_reason text null,
  is_primary boolean not null default true,
  version integer not null default 1,
  uploaded_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  archived_by_user_id uuid null,
  constraint center_staff_document_attachments_center_id_check
    check (center_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_document_attachments_staff_member_id_check
    check (staff_member_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_document_attachments_profile_id_check
    check (administrative_profile_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_document_attachments_document_id_check
    check (document_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_document_attachments_bucket_check
    check (bucket_id = 'staff-administrative-documents'),
  constraint center_staff_document_attachments_original_name_check
    check (
      length(original_file_name) between 1 and 240
      and original_file_name !~ '[\\/]'
      and original_file_name not in ('.', '..')
    ),
  constraint center_staff_document_attachments_safe_name_check
    check (safe_file_name ~ '^attachment\.(pdf|jpg|png|webp)$'),
  constraint center_staff_document_attachments_mime_check
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint center_staff_document_attachments_size_check
    check (size_bytes between 1 and 10485760),
  constraint center_staff_document_attachments_checksum_check
    check (checksum is null or length(checksum) between 1 and 128),
  constraint center_staff_document_attachments_state_check
    check (state in ('pending', 'available', 'failed', 'archived')),
  constraint center_staff_document_attachments_failure_reason_check
    check (
      upload_failure_reason is null
      or upload_failure_reason ~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    ),
  constraint center_staff_document_attachments_version_check
    check (version >= 1),
  constraint center_staff_document_attachments_archive_check
    check (
      (state = 'archived' and archived_at is not null and archived_by_user_id is not null)
      or (state <> 'archived' and archived_at is null and archived_by_user_id is null)
    ),
  constraint center_staff_document_attachments_object_path_check
    check (
      object_path = 'centers/' || center_id
        || '/staff/' || staff_member_id
        || '/documents/' || document_id
        || '/' || id::text
        || '/' || safe_file_name
    )
);

comment on table public.center_staff_document_attachments is
  'F23.11E cloud source of truth for private staff document attachment metadata.';
comment on column public.center_staff_document_attachments.object_path is
  'Server-controlled private Storage path; never persist this value in browser local storage.';
comment on column public.center_staff_document_attachments.upload_failure_reason is
  'Allowlisted operational reason code only; never a raw backend error.';

create unique index if not exists center_staff_document_attachments_object_path_unique
  on public.center_staff_document_attachments (bucket_id, object_path);
create unique index if not exists center_staff_document_attachments_primary_active_unique
  on public.center_staff_document_attachments (center_id, document_id)
  where is_primary = true
    and archived_at is null
    and state in ('pending', 'available');
create unique index if not exists center_staff_document_attachments_document_version_unique
  on public.center_staff_document_attachments (center_id, document_id, version);
create index if not exists center_staff_document_attachments_staff_lookup_idx
  on public.center_staff_document_attachments (
    center_id,
    staff_member_id,
    administrative_profile_id,
    document_id,
    version desc
  );

create or replace function public.touch_center_staff_document_attachment_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

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
    new.uploaded_by_user_id,
    new.created_at,
    new.is_primary,
    new.version
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
    old.uploaded_by_user_id,
    old.created_at,
    old.is_primary,
    old.version
  ) then
    raise exception 'staff_document_attachment_identity_immutable';
  end if;
  if old.state = 'available' and new.state not in ('available', 'archived') then
    raise exception 'staff_document_attachment_available_state_immutable';
  end if;
  if old.state = 'archived' and new.state <> 'archived' then
    raise exception 'staff_document_attachment_archive_immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.touch_center_staff_document_attachment_updated_at()
  from public, anon, authenticated;
revoke all on function public.guard_center_staff_document_attachment_update()
  from public, anon, authenticated;

drop trigger if exists touch_center_staff_document_attachment_updated_at
  on public.center_staff_document_attachments;
create trigger touch_center_staff_document_attachment_updated_at
before update on public.center_staff_document_attachments
for each row execute function public.touch_center_staff_document_attachment_updated_at();

drop trigger if exists guard_center_staff_document_attachment_update
  on public.center_staff_document_attachments;
create trigger guard_center_staff_document_attachment_update
before update on public.center_staff_document_attachments
for each row execute function public.guard_center_staff_document_attachment_update();

alter table public.center_staff_document_attachments enable row level security;

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
);

create policy "f23_11e insert pending staff document attachments by center role"
on public.center_staff_document_attachments
for insert
to authenticated
with check (
  uploaded_by_user_id = auth.uid()
  and state = 'pending'
  and archived_at is null
  and bucket_id = 'staff-administrative-documents'
  and object_path = 'centers/' || center_id
    || '/staff/' || staff_member_id
    || '/documents/' || document_id
    || '/' || id::text
    || '/' || safe_file_name
  and public.can_manage_staff_document_attachments(center_id)
);

create policy "f23_11e update staff document attachments by center role"
on public.center_staff_document_attachments
for update
to authenticated
using (
  public.can_manage_staff_document_attachments(center_id)
)
with check (
  public.can_manage_staff_document_attachments(center_id)
);

revoke all on table public.center_staff_document_attachments from anon, authenticated;
grant select on table public.center_staff_document_attachments to authenticated;

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
      and has_table_privilege('authenticated', 'public.center_staff_document_attachments', 'select')
      and not has_table_privilege('authenticated', 'public.center_staff_document_attachments', 'insert')
      and not has_table_privilege('authenticated', 'public.center_staff_document_attachments', 'update')
      and not has_table_privilege('authenticated', 'public.center_staff_document_attachments', 'delete'),
    1;
$$;

create or replace function public.prepare_staff_document_attachment_upload(
  p_center_id text,
  p_staff_member_id text,
  p_administrative_profile_id text,
  p_document_id text,
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
  v_attachment_id uuid := gen_random_uuid();
  v_extension text;
  v_safe_file_name text;
  v_original_file_name text;
  v_object_path text;
  v_version integer;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if p_center_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_staff_member_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_administrative_profile_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_document_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$' then
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

  perform pg_advisory_xact_lock(
    hashtextextended(p_center_id || ':' || p_document_id, 0)
  );
  if exists (
    select 1
    from public.center_staff_document_attachments a
    where a.center_id = p_center_id
      and a.document_id = p_document_id
      and a.is_primary = true
      and a.archived_at is null
      and a.state in ('pending', 'available')
  ) then
    raise exception 'staff_document_attachment_primary_exists';
  end if;
  select coalesce(max(a.version), 0) + 1
  into v_version
  from public.center_staff_document_attachments a
  where a.center_id = p_center_id
    and a.document_id = p_document_id;

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
    uploaded_by_user_id
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
    true,
    v_version,
    auth.uid()
  )
  returning *;
end;
$$;

create or replace function public.finalize_staff_document_attachment_upload(
  p_center_id text,
  p_attachment_id uuid
)
returns setof public.center_staff_document_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.center_staff_document_attachments%rowtype;
  v_object storage.objects%rowtype;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id
    and a.uploaded_by_user_id = auth.uid()
  for update;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;
  if v_attachment.state = 'available' then
    return next v_attachment;
    return;
  end if;
  if v_attachment.state <> 'pending' or v_attachment.archived_at is not null then
    raise exception 'staff_document_attachment_state_invalid';
  end if;

  select * into v_object
  from storage.objects o
  where o.bucket_id = v_attachment.bucket_id
    and o.name = v_attachment.object_path;
  if not found then
    raise exception 'staff_document_attachment_object_missing';
  end if;
  if coalesce((v_object.metadata ->> 'size')::bigint, -1) <> v_attachment.size_bytes
    or coalesce(v_object.metadata ->> 'mimetype', '') <> v_attachment.mime_type then
    raise exception 'staff_document_attachment_object_metadata_mismatch';
  end if;

  update public.center_staff_document_attachments
  set state = 'available', upload_failure_reason = null
  where id = p_attachment_id
  returning * into v_attachment;
  return next v_attachment;
end;
$$;

create or replace function public.fail_staff_document_attachment_upload(
  p_center_id text,
  p_attachment_id uuid,
  p_reason_code text
)
returns setof public.center_staff_document_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.center_staff_document_attachments%rowtype;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if p_reason_code !~ '^[a-z0-9][a-z0-9._-]{0,79}$' then
    raise exception 'staff_document_attachment_failure_reason_invalid';
  end if;
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id
    and a.uploaded_by_user_id = auth.uid()
  for update;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;
  if v_attachment.state = 'failed' then
    return next v_attachment;
    return;
  end if;
  if v_attachment.state <> 'pending' then
    raise exception 'staff_document_attachment_state_invalid';
  end if;
  update public.center_staff_document_attachments
  set state = 'failed', upload_failure_reason = p_reason_code
  where id = p_attachment_id
  returning * into v_attachment;
  return next v_attachment;
end;
$$;

revoke all on function public.staff_document_attachment_backend_readiness(text)
  from public, anon;
revoke all on function public.prepare_staff_document_attachment_upload(
  text, text, text, text, text, text, bigint
) from public, anon;
revoke all on function public.finalize_staff_document_attachment_upload(text, uuid)
  from public, anon;
revoke all on function public.fail_staff_document_attachment_upload(text, uuid, text)
  from public, anon;
grant execute on function public.staff_document_attachment_backend_readiness(text)
  to authenticated;
grant execute on function public.prepare_staff_document_attachment_upload(
  text, text, text, text, text, text, bigint
) to authenticated;
grant execute on function public.finalize_staff_document_attachment_upload(text, uuid)
  to authenticated;
grant execute on function public.fail_staff_document_attachment_upload(text, uuid, text)
  to authenticated;

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
      and a.archived_at is null
      and public.can_manage_staff_document_attachments(a.center_id)
      and (
        a.state = 'available'
        or (
          a.state = 'pending'
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
      and a.is_primary = true
      and a.archived_at is null
      and a.uploaded_by_user_id = auth.uid()
      and public.can_manage_staff_document_attachments(a.center_id)
  )
);

-- F23.11E intentionally grants no Storage UPDATE or DELETE policy.
-- Failed/orphan cleanup and approved deletion execution are deferred to F23.11E.2.

notify pgrst, 'reload schema';
