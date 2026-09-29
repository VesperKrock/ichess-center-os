begin;

-- Forward-only guard. Existing archived rows are retained unchanged.
-- The item row is locked by the canonical mutation before these checks run,
-- so a movement and a unit edit cannot cross this boundary concurrently.
create function public.k2_inventory_item_safety_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.status = 'active' and new.status = 'archived' and new.quantity > 0 then
    raise exception using errcode = 'P0001', message = 'INVENTORY_ITEM_HAS_STOCK';
  end if;

  if new.unit is distinct from old.unit and exists (
    select 1 from public.center_inventory_movements m
    where m.center_id = old.center_id and m.item_id = old.id
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_UNIT_HAS_HISTORY';
  end if;

  return new;
end
$function$;

revoke all on function public.k2_inventory_item_safety_guard() from public, anon, authenticated, service_role;

create trigger k2_inventory_item_safety_guard
before update of status, unit on public.center_inventory_items
for each row execute function public.k2_inventory_item_safety_guard();

commit;
