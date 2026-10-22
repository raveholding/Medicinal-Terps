-- =====================================================================
-- Sistema VB · Medicinal Terps · migración 02 (2026-10-22) — ADITIVA E IDEMPOTENTE
-- Se ejecuta DESPUÉS de 01-esquema.sql (en una base nueva o en una con datos).
--  1) Cuenta corriente de socios y pacientes: colección «pagos» (cobros y anulaciones, sólo agregar)
--     y validación de la parte «a cuenta corriente» (cc) de cada entrega.
--  2) Documentos y escaneos del legajo: colección «legDocs» (sólo el registro; el archivo va a Google Drive).
--  3) Menú público: mientras la organización no publicó ninguna versión, el sitio muestra el catálogo
--     vivo (sólo productos marcados «Publicar en el menú»; nunca costo, stock exacto ni datos de personas).
-- No borra ni modifica datos existentes.
-- =====================================================================

create or replace function public._col_mod(p_col text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case p_col
    when 'cats' then 'inventario' when 'products' then 'inventario'
    when 'sales' then 'dispensar' when 'ncs' then 'dispensar'
    when 'cashClosed' then 'caja' when 'cnotes' then 'caja'
    when 'gastos' then 'gastos' when 'tramites' then 'tramites' when 'staff' then 'personal'
    when 'ciclos' then 'cultivo' when 'cregs' then 'cultivo' when 'turnos' then 'solic' when 'socios' then 'socios'
    when 'pagos' then 'dispensar' when 'legDocs' then 'socios'
    when 'rubros' then 'admin' when 'org' then 'admin' when 'menuCfg' then 'admin' when 'pubSnap' then 'admin' when 'menuVersions' then 'admin'
    when 'stockMoves' then '*' when 'fichajes' then '*' when 'audit' then '*' when 'tenantmeta' then '*'
    else null end $$;

create or replace function public._push_one(me public.miembros, it jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  c text := it ->> 'col'; i text := it ->> 'id'; d jsonb := it -> 'data';
  del boolean := coalesce((it ->> 'deleted')::boolean, false);
  tid uuid := me.tenant_id; md text; old jsonb; old_del boolean; need int;
  s numeric; dl numeric; v_pid text; leg text; cur text; n int := 0; vk text[] := array['voided','voidReason','voidBy','voidT','ncId'];
begin
  if c is null or i is null or length(i) > 80 or length(c) > 30 then raise exception 'item_invalido'; end if;
  md := public._col_mod(c);
  if md is null then raise exception 'coleccion_invalida'; end if;
  if not del and (d is null or jsonb_typeof(d) <> 'object' or pg_column_size(d) > 1500000) then raise exception 'dato_invalido'; end if;
  -- permisos (se validan acá, no sólo en pantalla)
  if md = '*' then
    if c = 'stockMoves' then
      if greatest(public._nivel(me.rol, me.perms, 'dispensar'), public._nivel(me.rol, me.perms, 'inventario')) < 2 then raise exception 'sin_permiso'; end if;
    elsif c = 'fichajes' then
      if greatest(public._nivel(me.rol, me.perms, 'caja'), public._nivel(me.rol, me.perms, 'personal')) < 2 then raise exception 'sin_permiso'; end if;
    end if;
  else
    need := case when del then 3 else 2 end;
    if c = 'socios' and del and public._nivel(me.rol, me.perms, 'socios') < 3 then raise exception 'sin_permiso'; end if;
    if public._nivel(me.rol, me.perms, md) < need then raise exception 'sin_permiso'; end if;
  end if;
  if c in ('org','menuCfg','pubSnap') and i <> c then raise exception 'item_invalido'; end if;
  if c = 'tenantmeta' and i <> 'hkey' then raise exception 'item_invalido'; end if;

  select r.data, r.deleted into old, old_del from public.registros r where r.tenant_id = tid and r.col = c and r.id = i;

  -- ---- cuenta corriente: cobros y anulaciones de cobros (sólo agregar, importe positivo, persona identificada)
  if c = 'pagos' and not del then
    begin dl := (d ->> 'monto')::numeric; exception when others then raise exception 'dato_invalido'; end;
    if dl is null or dl <= 0 or dl > 1000000000 or coalesce(d ->> 'socioId', '') = '' or coalesce(d ->> 'tipo', '') not in ('cobro', 'anulacion') then raise exception 'cantidad_invalida'; end if;
  end if;
  -- ---- documentos del legajo: sólo datos del registro (nunca el archivo)
  if c = 'legDocs' and not del and (pg_column_size(d) > 20000 or coalesce(d ->> 'dni', d ->> 'socioId', '') = '') then raise exception 'dato_invalido'; end if;

  -- ---- sólo agregar
  if c in ('audit','cnotes','ncs','tenantmeta','pagos') then
    if old is not null then
      if del or (old is distinct from d and c <> 'tenantmeta') then raise exception 'solo_agregar'; end if;
      return;
    end if;
    if del then raise exception 'solo_agregar'; end if;
    insert into public.registros(tenant_id, col, id, data, updated_by) values (tid, c, i, d, me.user_id);
    return;
  end if;

  -- ---- cierres de caja congelados
  if c = 'cashClosed' then
    if old is not null then
      if del then
        if coalesce(old ->> 'imported', '') = 'true' then
          update public.registros set deleted = true, updated_at = clock_timestamp(), updated_by = me.user_id where tenant_id = tid and col = c and id = i;
          return;
        end if;
        raise exception 'cierre_congelado';
      end if;
      if old is distinct from d then raise exception 'cierre_congelado'; end if;
      return;
    end if;
    if del then raise exception 'item_invalido'; end if;
    insert into public.registros(tenant_id, col, id, data, updated_by) values (tid, c, i, d, me.user_id);
    return;
  end if;

  -- ---- movimientos de stock: sumatoria atómica, nunca negativa
  if c = 'stockMoves' then
    if old is not null then
      if del or old is distinct from d then raise exception 'solo_agregar'; end if;
      return;
    end if;
    if del then raise exception 'solo_agregar'; end if;
    v_pid := d ->> 'pid';
    begin dl := (d ->> 'delta')::numeric; exception when others then raise exception 'dato_invalido'; end;
    if v_pid is null or dl is null or abs(dl) > 1000000 then raise exception 'dato_invalido'; end if;
    if not exists (select 1 from public.registros where tenant_id = tid and col = 'products' and id = v_pid and not deleted) then raise exception 'producto_inexistente'; end if;
    insert into public.stock_saldo(tenant_id, pid, saldo) values (tid, v_pid, 0) on conflict do nothing;
    select ss.saldo into s from public.stock_saldo ss where ss.tenant_id = tid and ss.pid = v_pid for update;
    if s + dl < 0 then raise exception 'stock_insuficiente'; end if;
    update public.stock_saldo set saldo = s + dl where tenant_id = tid and stock_saldo.pid = v_pid;
    insert into public.registros(tenant_id, col, id, data, updated_by) values (tid, c, i, d, me.user_id);
    update public.registros set data = jsonb_set(data, '{stock}', to_jsonb(s + dl)), updated_at = clock_timestamp()
      where tenant_id = tid and col = 'products' and id = v_pid;
    return;
  end if;

  -- ---- productos: el stock lo manda el servidor (suma de movimientos)
  if c = 'products' and not del then
    insert into public.stock_saldo(tenant_id, pid, saldo) values (tid, i, 0) on conflict do nothing;
    select ss.saldo into s from public.stock_saldo ss where ss.tenant_id = tid and ss.pid = i;
    d := jsonb_set(d, '{stock}', to_jsonb(coalesce(s, 0)));
  end if;

  -- ---- socios: el legajo es único por organización
  if c = 'socios' and not del then
    leg := nullif(public._clean(d ->> 'legajo', 30), '');
    if leg is null then raise exception 'legajo_requerido'; end if;
    select l.legajo into cur from public.legajos l where l.tenant_id = tid and l.socio_id = i;
    if cur is not null then
      d := jsonb_set(d, '{legajo}', to_jsonb(cur));
    else
      loop
        begin
          insert into public.legajos(tenant_id, legajo, socio_id) values (tid, leg, i);
          exit;
        exception when unique_violation then
          select l.legajo into cur from public.legajos l where l.tenant_id = tid and l.socio_id = i;
          if cur is not null then leg := cur; exit; end if;
          n := n + 1; if n > 25 then raise exception 'legajo_agotado'; end if;
          leg := 'L-' || to_char(now() at time zone 'America/Argentina/Salta', 'YYMMDD') || '-'
                 || upper(translate(substr(encode(gen_random_bytes(6), 'hex'), 1, 6), '01ilo', '23456'));
        end;
      end loop;
      d := jsonb_set(d, '{legajo}', to_jsonb(leg));
    end if;
  end if;

  -- ---- entregas: sólo se puede anular; el resto queda congelado
  if c = 'sales' then
    if not del then
      if jsonb_typeof(d -> 'items') <> 'array' then raise exception 'dato_invalido'; end if;
      if jsonb_path_exists(d, '$.items[*] ? (@.qty <= 0)') or (d ->> 'total')::numeric < 0 then raise exception 'cantidad_invalida'; end if;
      if coalesce((d ->> 'cc')::numeric, 0) < 0 or coalesce((d ->> 'cc')::numeric, 0) > coalesce((d ->> 'total')::numeric, 0)
         or (coalesce((d ->> 'cc')::numeric, 0) > 0 and coalesce(d ->> 'socioId', '') = '') then raise exception 'cantidad_invalida'; end if;
    end if;
    if old is not null then
      if del then
        if coalesce(old ->> 'imported', '') <> 'true' then raise exception 'solo_anular'; end if;
      else
        if (old - vk) is distinct from (d - vk) then raise exception 'entrega_congelada'; end if;
        if coalesce(old ->> 'voided', '') = 'true' and coalesce(d ->> 'voided', '') <> 'true' then raise exception 'entrega_congelada'; end if;
      end if;
    elsif del then raise exception 'item_invalido'; end if;
  end if;

  if c = 'rubros' and del then raise exception 'sin_borrado'; end if;

  if del then
    if old is null then return; end if;
    update public.registros set deleted = true, updated_at = clock_timestamp(), updated_by = me.user_id
      where tenant_id = tid and col = c and id = i and not deleted;
    return;
  end if;
  insert into public.registros(tenant_id, col, id, data, deleted, updated_by) values (tid, c, i, d, false, me.user_id)
    on conflict (tenant_id, col, id) do update
      set data = excluded.data, deleted = false, updated_at = clock_timestamp(), updated_by = excluded.updated_by
      where public.registros.data is distinct from excluded.data or public.registros.deleted;
end $$;

create or replace function public.vaciar_datos() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.miembros; ep int;
begin
  a := public._admin();
  delete from public.registros where tenant_id = a.tenant_id
    and (col in ('socios','sales','ncs','stockMoves','cashClosed','cnotes','gastos','tramites','staff','fichajes','ciclos','cregs','turnos','menuVersions','pubSnap','pagos','legDocs')
         or (col = 'products' and coalesce(data ->> 'membership', 'false') <> 'true'));
  delete from public.stock_saldo where tenant_id = a.tenant_id;
  delete from public.legajos where tenant_id = a.tenant_id;
  delete from public.solicitudes_web where tenant_id = a.tenant_id;
  delete from public.menus where tenant_id = a.tenant_id;
  delete from public.menus_versiones where tenant_id = a.tenant_id;
  update public.tenants set epoch = epoch + 1 where id = a.tenant_id returning epoch into ep;
  return ep;
end $$;

-- ---------------------------------------------------------------- menú público (con catálogo vivo hasta la primera publicación)
create or replace function public.menu_publico(p_slug text default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare t public.tenants; m jsonb; o jsonb; cfg jsonb;
begin
  select * into t from public.tenants where p_slug is null or slug = p_slug order by created_at limit 1;
  if t.id is null then return null; end if;
  select x.data into m from public.menus x where x.tenant_id = t.id;
  if m is not null then return m; end if;
  select r.data into o from public.registros r where r.tenant_id = t.id and r.col = 'org' and r.id = 'org' and not r.deleted;
  if o is null then return null; end if;
  select r.data into cfg from public.registros r where r.tenant_id = t.id and r.col = 'menuCfg' and r.id = 'menuCfg' and not r.deleted;
  return jsonb_build_object(
    'v', 2, 'auto', true, 'ejemplo', coalesce(o ->> 'ejemplo', 'false') = 'true',
    'org', jsonb_build_object('name', o -> 'nameCom', 'brand', o -> 'brand', 'legal', o -> 'nameLegal', 'cuit', o -> 'cuit',
      'addr', o -> 'addr', 'city', o -> 'city', 'hours', o -> 'hours', 'wa', o -> 'wa', 'email', o -> 'email', 'ig', o -> 'ig', 'fb', o -> 'fb',
      'membership', o -> 'membership', 'tagline', o -> 'tagline', 'maps', o -> 'maps', 'slots', o -> 'slots', 'ageGate', coalesce(o -> 'ageGate', 'true'::jsonb),
      'hcName', coalesce(o -> 'hcName', to_jsonb('Historia Clínica · Solicitud Reprocann'::text)), 'turnero', to_jsonb(coalesce(o ->> 'turnero', 'true') <> 'false')),
    'cats', coalesce((select jsonb_agg(jsonb_build_object('id', r.data -> 'id', 'name', r.data -> 'name') order by r.data ->> 'name')
       from public.registros r where r.tenant_id = t.id and r.col = 'cats' and not r.deleted), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', r.data -> 'id', 'name', r.data -> 'name', 'cat', r.data -> 'cat', 'desc', r.data -> 'desc',
         'price', r.data -> 'price', 'unit', r.data -> 'unit', 'img', r.data -> 'img',
         'soldout', (r.data ->> 'status' = 'sin_stock') or (coalesce(r.data ->> 'service', 'false') <> 'true' and coalesce((r.data ->> 'stock')::numeric, 0) <= 0),
         'rp', coalesce(r.data ->> 'rp', 'false') = 'true', 'mem', coalesce(r.data ->> 'membership', 'false') = 'true') order by r.data ->> 'name')
       from public.registros r where r.tenant_id = t.id and r.col = 'products' and not r.deleted
         and coalesce(r.data ->> 'pub', 'false') = 'true' and coalesce(r.data ->> 'status', '') <> 'discontinuado'), '[]'::jsonb),
    'menu', coalesce(cfg, jsonb_build_object('blocks', '[{"id":"cat","on":true},{"id":"hc","on":true},{"id":"srv","on":true},{"id":"con","on":true}]'::jsonb, 'texts', '{"es":{},"en":{}}'::jsonb)),
    'ts', (extract(epoch from now()) * 1000)::bigint);
end $$;

-- ---------------------------------------------------------------- permisos (se reafirman: create or replace conserva los grants, pero por las dudas)
revoke execute on function public._col_mod(text), public._push_one(public.miembros, jsonb) from public, anon, authenticated;
grant execute on function public.vaciar_datos() to authenticated;
grant execute on function public.menu_publico(text) to anon, authenticated;
