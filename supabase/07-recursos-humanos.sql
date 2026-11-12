-- =====================================================================
-- Sistema VB · Medicinal Terps · migración 07 (2026-11-12) — ADITIVA E IDEMPOTENTE
-- Se ejecuta DESPUÉS de 06 (en orden: 01 → 02 → 03 → 04 → 05 → 06 → 07).
--  Recursos Humanos completo: colecciones nuevas que viajan por la misma sincronización.
--   · hrShifts (turnos), hrDocs (documentos: sólo la descripción, nunca el archivo), hrPays (nómina interna),
--     hrJobs y hrCands (reclutamiento), hrMsgs (avisos al personal): módulo «personal».
--   · hrReqs (solicitudes de licencia) y hrReads (avisos leídos): también las escribe el portal del empleado
--     desde el equipo del kiosco. Con permiso de Caja o Personal se puede CREAR una solicitud pendiente o marcar
--     un aviso como leído; aprobar, rechazar o anular exige permiso «Cargar» en Personal.
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
    when 'pagos' then 'dispensar' when 'legDocs' then 'socios' when 'fidmov' then 'dispensar' when 'cobdet' then 'dispensar'
    when 'hrShifts' then 'personal' when 'hrDocs' then 'personal' when 'hrPays' then 'personal'
    when 'hrJobs' then 'personal' when 'hrCands' then 'personal' when 'hrMsgs' then 'personal'
    when 'rubros' then 'admin' when 'org' then 'admin' when 'menuCfg' then 'admin' when 'pubSnap' then 'admin' when 'menuVersions' then 'admin'
    when 'stockMoves' then '*' when 'fichajes' then '*' when 'audit' then '*' when 'tenantmeta' then '*'
    when 'hrReqs' then '*' when 'hrReads' then '*'
    else null end $$;

-- la función de escritura de la migración 06 pasa a llamarse _push_one_v6; la nueva valida RR. HH. y la llama
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '_push_one_v6') then
    alter function public._push_one(public.miembros, jsonb) rename to _push_one_v6;
  end if;
end $$;
revoke execute on function public._push_one_v6(public.miembros, jsonb) from public, anon, authenticated;

create or replace function public._push_one(me public.miembros, it jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  c text := it ->> 'col'; i text := it ->> 'id'; d jsonb := it -> 'data';
  v_rm boolean := coalesce((it ->> 'deleted')::boolean, false);
  old jsonb; lp int; lc int;
begin
  if c in ('hrReqs', 'hrReads') then
    if i is null or length(i) > 80 then raise exception 'item_invalido'; end if;
    lp := public._nivel(me.rol, me.perms, 'personal');
    lc := public._nivel(me.rol, me.perms, 'caja');
    if greatest(lp, lc) < 2 then raise exception 'sin_permiso'; end if;
    if v_rm then raise exception 'solo_agregar'; end if;
    if d is null or jsonb_typeof(d) <> 'object' or pg_column_size(d) > 20000 or coalesce(d ->> 'staffId', '') = '' then raise exception 'dato_invalido'; end if;
    select r.data into old from public.registros r where r.tenant_id = me.tenant_id and r.col = c and r.id = i;
    if c = 'hrReads' then
      if old is not null then return; end if;
      insert into public.registros(tenant_id, col, id, data, updated_by) values (me.tenant_id, c, i, d, me.user_id);
      return;
    end if;
    -- solicitudes: sin permiso de Personal sólo se crea una nueva, pendiente y sin aprobaciones
    if lp < 2 then
      if old is not null then
        if old is distinct from d then raise exception 'sin_permiso'; end if;
        return;
      end if;
      if coalesce(d ->> 'state', '') <> 'pendiente' or jsonb_array_length(coalesce(case when jsonb_typeof(d -> 'steps') = 'array' then d -> 'steps' end, '[]'::jsonb)) > 0 then
        raise exception 'sin_permiso';
      end if;
    end if;
  end if;
  perform public._push_one_v6(me, it);
end $$;
revoke execute on function public._push_one(public.miembros, jsonb) from public, anon, authenticated;
