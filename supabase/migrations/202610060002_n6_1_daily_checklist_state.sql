-- N6.1: static code templates; persist only explicit daily row completion.
create table public.center_daily_checklist_state (
  center_id text not null references public.centers(id),
  business_date date not null,
  template_key text not null check (template_key in ('tvv-parttime-v1','tvv-fulltime-v1')),
  item_key text not null,
  completed boolean not null,
  completed_by uuid references auth.users(id),
  completed_by_name text,
  completed_at timestamptz,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null,
  primary key (center_id,business_date,template_key,item_key),
  constraint n6_1_checklist_item check (
    (template_key='tvv-parttime-v1' and item_key in ('pt-01','pt-02','pt-03','pt-04','pt-05'))
    or (template_key='tvv-fulltime-v1' and item_key in ('ft-01','ft-02','ft-03','ft-04','ft-05','ft-06','ft-07','ft-08','ft-09','ft-10'))
  ),
  constraint n6_1_checklist_completion check (
    (completed and completed_by is not null and completed_at is not null and completed_by_name is not null)
    or (not completed and completed_by is null and completed_at is null and completed_by_name is null)
  )
);
alter table public.center_daily_checklist_state enable row level security;
alter table public.center_daily_checklist_state force row level security;
revoke all on public.center_daily_checklist_state from public,anon,authenticated,service_role;

create function public.n6_1_internal_require_checklist_member(p_center_id text)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=auth.uid() and m.status='active' and c.status='active'
      and pg_catalog.lower(m.role) in ('owner','qtv','center_admin','admin')
  ) then raise exception 'n6_1_checklist_access_denied'; end if;
end $$;
revoke all on function public.n6_1_internal_require_checklist_member(text) from public,anon,authenticated,service_role;

create function public.n6_1_list_daily_checklist(p_center_id text,p_business_date date,p_template_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.n6_1_internal_require_checklist_member(p_center_id);
  if p_business_date is null or p_template_key is null
    or p_template_key not in ('tvv-parttime-v1','tvv-fulltime-v1') then
    raise exception 'n6_1_checklist_invalid_context';
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'center_id',p_center_id,'business_date',p_business_date,
    'template_key',p_template_key,'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) order by item_key)
      from public.center_daily_checklist_state s where s.center_id=p_center_id and s.business_date=p_business_date
        and s.template_key=p_template_key),'[]'::jsonb));
end $$;

create function public.n6_1_set_daily_checklist_item(
  p_center_id text,p_business_date date,p_template_key text,p_item_key text,p_completed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid();
  v_now timestamptz:=pg_catalog.clock_timestamp();
  v_name text;
  v_state public.center_daily_checklist_state;
begin
  perform public.n6_1_internal_require_checklist_member(p_center_id);
  if p_business_date is null or p_template_key is null or p_item_key is null or p_completed is null
    or not ((p_template_key='tvv-parttime-v1' and p_item_key in ('pt-01','pt-02','pt-03','pt-04','pt-05'))
      or (p_template_key='tvv-fulltime-v1' and p_item_key in ('ft-01','ft-02','ft-03','ft-04','ft-05','ft-06','ft-07','ft-08','ft-09','ft-10'))) then
    raise exception 'n6_1_checklist_invalid_item';
  end if;
  if p_business_date>(v_now at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'n6_1_checklist_future_read_only';
  end if;
  select pg_catalog.left(coalesce(nullif(pg_catalog.btrim(u.raw_user_meta_data->>'full_name'),''),
    nullif(pg_catalog.btrim(u.raw_user_meta_data->>'name'),''),'Người dùng'),200)
    into v_name from auth.users u where u.id=v_actor;
  insert into public.center_daily_checklist_state as existing (
    center_id,business_date,template_key,item_key,completed,completed_by,completed_by_name,completed_at,updated_by,updated_at)
  values(p_center_id,p_business_date,p_template_key,p_item_key,p_completed,
    case when p_completed then v_actor end,case when p_completed then v_name end,
    case when p_completed then v_now end,v_actor,v_now)
  on conflict(center_id,business_date,template_key,item_key) do update
    set completed=excluded.completed,completed_by=excluded.completed_by,
      completed_by_name=excluded.completed_by_name,completed_at=excluded.completed_at,
      updated_by=excluded.updated_by,updated_at=excluded.updated_at
    where existing.completed is distinct from excluded.completed;
  select * into v_state from public.center_daily_checklist_state s
    where s.center_id=p_center_id and s.business_date=p_business_date
      and s.template_key=p_template_key and s.item_key=p_item_key;
  return pg_catalog.jsonb_build_object('ok',true,'center_id',p_center_id,'business_date',p_business_date,
    'template_key',p_template_key,'item',pg_catalog.to_jsonb(v_state));
end $$;
revoke all on function public.n6_1_list_daily_checklist(text,date,text) from public,anon,authenticated,service_role;
revoke all on function public.n6_1_set_daily_checklist_item(text,date,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.n6_1_list_daily_checklist(text,date,text) to authenticated;
grant execute on function public.n6_1_set_daily_checklist_item(text,date,text,text,boolean) to authenticated;
