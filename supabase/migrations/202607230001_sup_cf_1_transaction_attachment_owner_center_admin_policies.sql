-- SUP-CF.1 - Transaction evidence owner/center_admin access policies.
-- Prepared-only hardening: do not apply remotely before local migration/security review.
-- Authorization uses auth.uid(), active center_members, canonical center_id, and exact path segments.

do $$
declare
  v_missing_columns text;
begin
  if to_regclass('public.transaction_attachments') is null then
    raise exception
      'SUP-CF.1 prerequisite missing: public.transaction_attachments';
  end if;

  if to_regclass('public.center_members') is null then
    raise exception
      'SUP-CF.1 prerequisite missing: public.center_members';
  end if;

  if to_regclass('storage.buckets') is null then
    raise exception
      'SUP-CF.1 prerequisite missing: storage.buckets';
  end if;

  if to_regclass('storage.objects') is null then
    raise exception
      'SUP-CF.1 prerequisite missing: storage.objects';
  end if;

  select string_agg(required.column_name, ', ' order by required.column_name)
  into v_missing_columns
  from unnest(array[
    'center_id',
    'uploaded_by',
    'storage_bucket',
    'storage_path'
  ]) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'transaction_attachments'
      and c.column_name = required.column_name
  );

  if v_missing_columns is not null then
    raise exception
      'SUP-CF.1 prerequisite missing columns on public.transaction_attachments: %',
      v_missing_columns;
  end if;

  select string_agg(required.column_name, ', ' order by required.column_name)
  into v_missing_columns
  from unnest(array[
    'center_id',
    'user_id',
    'status',
    'role'
  ]) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'center_members'
      and c.column_name = required.column_name
  );

  if v_missing_columns is not null then
    raise exception
      'SUP-CF.1 prerequisite missing columns on public.center_members: %',
      v_missing_columns;
  end if;

  if not exists (
    select 1
    from storage.buckets b
    where b.id = 'transaction-images'
  ) then
    raise exception
      'SUP-CF.1 prerequisite missing: transaction-images bucket';
  end if;
end
$$;

alter table public.transaction_attachments
  add column if not exists uploaded_by_name text;

create or replace function public.can_manage_transaction_attachments(
  requested_center_id text
)
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

revoke all on function public.can_manage_transaction_attachments(text)
  from public, anon;
grant execute on function public.can_manage_transaction_attachments(text)
  to authenticated;

create or replace function public.is_valid_transaction_attachment_path(
  requested_center_id text,
  requested_storage_path text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(requested_center_id), '') is not null
      and split_part(requested_storage_path, '/', 1) = requested_center_id
      and split_part(requested_storage_path, '/', 2) = 'transaction-images'
      and split_part(requested_storage_path, '/', 3) ~ '^[0-9]{4}$'
      and split_part(requested_storage_path, '/', 4) ~ '^(0[1-9]|1[0-2])$'
      and split_part(requested_storage_path, '/', 5) not in ('', '.', '..')
      and array_length(string_to_array(requested_storage_path, '/'), 1) = 5
      and position(chr(92) in requested_storage_path) = 0,
    false
  );
$$;

revoke all on function public.is_valid_transaction_attachment_path(text, text)
  from public, anon;
grant execute on function public.is_valid_transaction_attachment_path(text, text)
  to authenticated;

create or replace function public.guard_transaction_attachment_identity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.center_id,
    new.uploaded_by,
    new.storage_bucket,
    new.storage_path
  ) is distinct from row(
    old.center_id,
    old.uploaded_by,
    old.storage_bucket,
    old.storage_path
  ) then
    raise exception 'transaction_attachment_identity_immutable';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_transaction_attachment_identity_update()
  from public, anon, authenticated;

drop trigger if exists guard_transaction_attachment_identity_update
  on public.transaction_attachments;
create trigger guard_transaction_attachment_identity_update
before update on public.transaction_attachments
for each row
execute function public.guard_transaction_attachment_identity_update();

update storage.buckets
set public = false
where id = 'transaction-images';

alter table public.transaction_attachments enable row level security;

drop policy if exists "sup_cf_1 select transaction attachments by center role"
  on public.transaction_attachments;
drop policy if exists "sup_cf_1 insert transaction attachments by center role"
  on public.transaction_attachments;
drop policy if exists "sup_cf_1 update transaction attachments by center role"
  on public.transaction_attachments;
drop policy if exists "sup_cf_1 delete transaction attachments by center role"
  on public.transaction_attachments;

create policy "sup_cf_1 select transaction attachments by center role"
on public.transaction_attachments
for select
to authenticated
using (
  storage_bucket = 'transaction-images'
  and public.is_valid_transaction_attachment_path(center_id, storage_path)
  and public.can_manage_transaction_attachments(center_id)
);

create policy "sup_cf_1 insert transaction attachments by center role"
on public.transaction_attachments
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and storage_bucket = 'transaction-images'
  and public.is_valid_transaction_attachment_path(center_id, storage_path)
  and public.can_manage_transaction_attachments(center_id)
);

create policy "sup_cf_1 update transaction attachments by center role"
on public.transaction_attachments
for update
to authenticated
using (
  storage_bucket = 'transaction-images'
  and public.is_valid_transaction_attachment_path(center_id, storage_path)
  and public.can_manage_transaction_attachments(center_id)
)
with check (
  storage_bucket = 'transaction-images'
  and public.is_valid_transaction_attachment_path(center_id, storage_path)
  and public.can_manage_transaction_attachments(center_id)
);

create policy "sup_cf_1 delete transaction attachments by center role"
on public.transaction_attachments
for delete
to authenticated
using (
  storage_bucket = 'transaction-images'
  and public.is_valid_transaction_attachment_path(center_id, storage_path)
  and public.can_manage_transaction_attachments(center_id)
);

revoke all on table public.transaction_attachments
  from public, anon, authenticated;
grant select, insert, update, delete on table public.transaction_attachments
  to authenticated;

drop policy if exists "sup_cf_1 read transaction image objects by center role"
  on storage.objects;
drop policy if exists "sup_cf_1 insert transaction image objects by center role"
  on storage.objects;
drop policy if exists "sup_cf_1 update transaction image objects by center role"
  on storage.objects;
drop policy if exists "sup_cf_1 delete transaction image objects by center role"
  on storage.objects;

create policy "sup_cf_1 read transaction image objects by center role"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path(
    (storage.foldername(name))[1],
    name
  )
  and public.can_manage_transaction_attachments(
    (storage.foldername(name))[1]
  )
);

create policy "sup_cf_1 insert transaction image objects by center role"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path(
    (storage.foldername(name))[1],
    name
  )
  and public.can_manage_transaction_attachments(
    (storage.foldername(name))[1]
  )
);

create policy "sup_cf_1 update transaction image objects by center role"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path(
    (storage.foldername(name))[1],
    name
  )
  and public.can_manage_transaction_attachments(
    (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path(
    (storage.foldername(name))[1],
    name
  )
  and public.can_manage_transaction_attachments(
    (storage.foldername(name))[1]
  )
);

create policy "sup_cf_1 delete transaction image objects by center role"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path(
    (storage.foldername(name))[1],
    name
  )
  and public.can_manage_transaction_attachments(
    (storage.foldername(name))[1]
  )
);

notify pgrst, 'reload schema';
