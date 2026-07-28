-- Transaction evidence private bucket prerequisite for SUP-CF.1.
insert into storage.buckets (id, name, public)
values ('transaction-images', 'transaction-images', false)
on conflict (id) do update
set public = false;
