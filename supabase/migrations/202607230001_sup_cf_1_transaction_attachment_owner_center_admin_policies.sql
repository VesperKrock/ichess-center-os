-- SUP-CF.1 - Transaction evidence owner/center_admin access policies.
-- Review before applying to remote project zahcfnpaprbnuqpegdmo / ichess-center-os.
-- Authorization uses auth.uid(), active center_members, canonical center_id, and path scope.

create or replace function public.can_manage_transaction_attachments(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.center_members cm
      where cm.center_id = requested_center_id
        and cm.user_id = auth.uid()
        and coalesce(cm.status, 'active') = 'active'
        and lower(cm.role) in ('owner', 'center_admin')
    );
$$;

revoke all on function public.can_manage_transaction_attachments(text) from public;
grant execute on function public.can_manage_transaction_attachments(text) to authenticated;

update storage.buckets
set public = false
where id = 'transaction-images';

alter table if exists public.transaction_attachments enable row level security;

do $$
begin
  if to_regclass('public.transaction_attachments') is not null then
    execute 'alter table public.transaction_attachments add column if not exists uploaded_by_name text';

    execute 'drop policy if exists "sup_cf_1 select transaction attachments by center role" on public.transaction_attachments';
    execute 'drop policy if exists "sup_cf_1 insert transaction attachments by center role" on public.transaction_attachments';
    execute 'drop policy if exists "sup_cf_1 update transaction attachments by center role" on public.transaction_attachments';
    execute 'drop policy if exists "sup_cf_1 delete transaction attachments by center role" on public.transaction_attachments';

    execute $policy$
      create policy "sup_cf_1 select transaction attachments by center role"
      on public.transaction_attachments
      for select
      to authenticated
      using (
        storage_bucket = 'transaction-images'
        and storage_path like center_id || '/transaction-images/%'
        and public.can_manage_transaction_attachments(center_id)
      )
    $policy$;

    execute $policy$
      create policy "sup_cf_1 insert transaction attachments by center role"
      on public.transaction_attachments
      for insert
      to authenticated
      with check (
        uploaded_by = auth.uid()
        and storage_bucket = 'transaction-images'
        and storage_path like center_id || '/transaction-images/%'
        and public.can_manage_transaction_attachments(center_id)
      )
    $policy$;

    execute $policy$
      create policy "sup_cf_1 update transaction attachments by center role"
      on public.transaction_attachments
      for update
      to authenticated
      using (
        storage_bucket = 'transaction-images'
        and storage_path like center_id || '/transaction-images/%'
        and public.can_manage_transaction_attachments(center_id)
      )
      with check (
        storage_bucket = 'transaction-images'
        and storage_path like center_id || '/transaction-images/%'
        and public.can_manage_transaction_attachments(center_id)
      )
    $policy$;

    execute $policy$
      create policy "sup_cf_1 delete transaction attachments by center role"
      on public.transaction_attachments
      for delete
      to authenticated
      using (
        storage_bucket = 'transaction-images'
        and storage_path like center_id || '/transaction-images/%'
        and public.can_manage_transaction_attachments(center_id)
      )
    $policy$;
  end if;
end $$;

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
  and (storage.foldername(name))[2] = 'transaction-images'
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
);

create policy "sup_cf_1 insert transaction image objects by center role"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'transaction-images'
  and (storage.foldername(name))[2] = 'transaction-images'
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
);

create policy "sup_cf_1 update transaction image objects by center role"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'transaction-images'
  and (storage.foldername(name))[2] = 'transaction-images'
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
)
with check (
  bucket_id = 'transaction-images'
  and (storage.foldername(name))[2] = 'transaction-images'
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
);

create policy "sup_cf_1 delete transaction image objects by center role"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'transaction-images'
  and (storage.foldername(name))[2] = 'transaction-images'
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
);

notify pgrst, 'reload schema';
