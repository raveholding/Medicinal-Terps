-- =====================================================================
-- Sistema VB · Medicinal Terps · migración 06 (2026-11-08) — ADITIVA E IDEMPOTENTE
-- Se ejecuta DESPUÉS de 05 (en orden: 01 → 02 → 03 → 04 → 05 → 06).
--  1) Cobro completo: pago dividido validado en el servidor (la suma de los medios = la donación,
--     la parte a cuenta corriente coincide), nunca un número de tarjeta completo, y un mismo
--     comprobante (N.º de operación, ID de QR, autorización de tarjeta) no se usa dos veces.
--  2) Colecciones nuevas, sólo agregar: «fidmov» (monedero: cargas y ajustes) y «cobdet»
--     (comprobante completado después de un cobro autorizado sin comprobante).
--  3) Monedero: el servidor no deja gastar más saldo del que hay (con bloqueo por persona).
--  4) Tarjeta del Club en el celular: la solicitud web puede traer la tarjeta generada en el celular
--     y la función pública club_estado() le muestra al titular sus sellos, nivel y saldo, sin datos personales.
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
    when 'rubros' then 'admin' when 'org' then 'admin' when 'menuCfg' then 'admin' when 'pubSnap' then 'admin' when 'menuVersions' then 'admin'
    when 'stockMoves' then '*' when 'fichajes' then '*' when 'audit' then '*' when 'tenantmeta' then '*'
    else null end $$;

-- comprobantes ya usados (uno por clave y organización)
create table if not exists public.cobro_ops(
  tenant_id uuid not null references public.tenants(id),
  clave text not null,
  sale_id text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, clave));
alter table public.cobro_ops enable row level security;

-- ¿parece un número de tarjeta completo? (13 a 19 dígitos que pasan Luhn)
create or replace function public._parece_pan(p text) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare m text; d text; s int; alt boolean; n int; k int;
begin
  if p is null then return false; end if;
  for m in select (regexp_matches(p, '((?:\d[ -]?){13,19})', 'g'))[1] loop
    d := regexp_replace(m, '\D', '', 'g');
    if length(d) between 13 and 19 and substr(d, 1, 1) in ('2', '3', '4', '5', '6') then
      s := 0; alt := false;
      for k in reverse length(d)..1 loop
        n := substr(d, k, 1)::int;
        if alt then n := n * 2; if n > 9 then n := n - 9; end if; end if;
        s := s + n; alt := not alt;
      end loop;
      if s % 10 = 0 then return true; end if;
    end if;
  end loop;
  return false;
end $$;

-- clave de unicidad de un comprobante
create or replace function public._pd_clave(p_m text, p_det jsonb) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_det is null or jsonb_typeof(p_det) <> 'object' then ''
    when p_m = 'transferencia' and coalesce(p_det ->> 'nro', '') <> '' then 'T|' || upper(p_det ->> 'nro')
    when p_m = 'qr' and coalesce(p_det ->> 'txid', '') <> '' then 'Q|' || lower(coalesce(p_det ->> 'prov', '')) || '|' || upper(p_det ->> 'txid')
    when p_m in ('debito', 'credito') and coalesce(p_det ->> 'auth', '') <> '' then 'C|' || coalesce(p_det ->> 'last4', '') || '|' || upper(p_det ->> 'auth') || '|' || upper(coalesce(p_det ->> 'cupon', ''))
    else '' end $$;

-- saldo del monedero de una persona = cargas + ajustes − lo pagado con monedero en entregas no anuladas
create or replace function public._mon_saldo(p_tid uuid, p_sid text) returns numeric
language sql stable set search_path = public, pg_temp as $$
  select coalesce((select sum((r.data ->> 'monto')::numeric) from public.registros r
                   where r.tenant_id = p_tid and r.col = 'fidmov' and r.data ->> 'socioId' = p_sid and r.data ->> 'tipo' in ('carga', 'ajuste')), 0)
       - coalesce((select sum((p ->> 'a')::numeric) from public.registros r
                   cross join lateral jsonb_array_elements(case when jsonb_typeof(r.data -> 'pays') = 'array' then r.data -> 'pays' else '[]'::jsonb end) p
                   where r.tenant_id = p_tid and r.col = 'sales' and r.data ->> 'socioId' = p_sid
                     and coalesce(r.data ->> 'voided', '') <> 'true' and p ->> 'm' = 'mon'), 0) $$;

-- la función de escritura original pasa a llamarse _push_one_base; la nueva valida lo agregado y la llama
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '_push_one_base') then
    alter function public._push_one(public.miembros, jsonb) rename to _push_one_base;
  end if;
end $$;

create or replace function public._push_one(me public.miembros, it jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  c text := it ->> 'col'; i text := it ->> 'id'; d jsonb := it -> 'data';
  v_rm boolean := coalesce((it ->> 'deleted')::boolean, false);
  tid uuid := me.tenant_id; old jsonb; p jsonb; tot numeric; sm numeric := 0; ccs numeric := 0; mons numeric := 0;
  a numeric; k text; sid text; sal numeric; ok_ins boolean; sale jsonb; idx int; med text; seen text[] := array[]::text[];
begin
  if c is null or i is null or length(i) > 80 then raise exception 'item_invalido'; end if;

  -- ---- monedero y comprobantes completados: sólo agregar
  if c in ('fidmov', 'cobdet') then
    if public._nivel(me.rol, me.perms, 'dispensar') < 2 then raise exception 'sin_permiso'; end if;
    if v_rm then raise exception 'solo_agregar'; end if;
    if d is null or jsonb_typeof(d) <> 'object' or pg_column_size(d) > 20000 then raise exception 'dato_invalido'; end if;
    select r.data into old from public.registros r where r.tenant_id = tid and r.col = c and r.id = i;
    if old is not null then
      if old is distinct from d then raise exception 'solo_agregar'; end if;
      return;
    end if;
    if public._parece_pan(coalesce(d ->> 'obs', '') || ' ' || coalesce(d ->> 'motivo', '') || ' ' || coalesce(((d -> 'det') - 'nro' - 'txid' - 'fh')::text, '')) then raise exception 'dato_tarjeta'; end if;
    sid := coalesce(d ->> 'socioId', '');
    if c = 'fidmov' then
      begin a := (d ->> 'monto')::numeric; exception when others then raise exception 'dato_invalido'; end;
      if sid = '' or a is null or abs(a) > 1000000000 then raise exception 'cantidad_invalida'; end if;
      if d ->> 'tipo' = 'carga' then
        if a <= 0 or coalesce(d ->> 'medio', '') not in ('efectivo', 'transferencia', 'qr', 'debito', 'credito') then raise exception 'cantidad_invalida'; end if;
      elsif d ->> 'tipo' = 'ajuste' then
        if me.rol <> 'admin' then raise exception 'sin_permiso'; end if;
        if a = 0 or length(coalesce(d ->> 'motivo', '')) < 3 then raise exception 'cantidad_invalida'; end if;
        perform pg_advisory_xact_lock(hashtext('mon:' || tid::text || ':' || sid));
        if a < 0 and public._mon_saldo(tid, sid) + a < 0 then raise exception 'saldo_insuficiente'; end if;
      else
        raise exception 'dato_invalido';
      end if;
    else
      select r.data into sale from public.registros r where r.tenant_id = tid and r.col = 'sales' and r.id = d ->> 'saleId';
      if sale is null then raise exception 'item_invalido'; end if;
      begin idx := (d ->> 'idx')::int; exception when others then raise exception 'dato_invalido'; end;
      if idx is null or idx < 0 or jsonb_typeof(sale -> 'pays') <> 'array' or idx >= jsonb_array_length(sale -> 'pays') then raise exception 'dato_invalido'; end if;
      med := sale -> 'pays' -> idx ->> 'm';
      if med not in ('transferencia', 'qr', 'debito', 'credito') or jsonb_typeof(d -> 'det') <> 'object' then raise exception 'dato_invalido'; end if;
      k := public._pd_clave(med, d -> 'det');
      if k = '' then raise exception 'dato_invalido'; end if;
      insert into public.cobro_ops(tenant_id, clave, sale_id) values (tid, k, d ->> 'saleId') on conflict do nothing;
      if not found and not exists (select 1 from public.cobro_ops o where o.tenant_id = tid and o.clave = k and o.sale_id = d ->> 'saleId') then
        raise exception 'comprobante_repetido';
      end if;
    end if;
    insert into public.registros(tenant_id, col, id, data, updated_by) values (tid, c, i, d, me.user_id);
    return;
  end if;

  -- ---- entregas nuevas con medios de pago
  if c = 'sales' and not v_rm and d is not null and jsonb_typeof(d) = 'object' and jsonb_typeof(d -> 'pays') = 'array' then
    select r.data into old from public.registros r where r.tenant_id = tid and r.col = 'sales' and r.id = i;
    if old is null then
      for p in select * from jsonb_array_elements(d -> 'pays') loop
        if jsonb_typeof(p -> 'det') = 'object' and public._parece_pan(((p -> 'det') - 'nro' - 'txid' - 'fh')::text || ' ' || coalesce(p ->> 'sc', '')) then raise exception 'dato_tarjeta'; end if;
      end loop;
      begin tot := coalesce((d ->> 'total')::numeric, 0); exception when others then raise exception 'dato_invalido'; end;
      if jsonb_array_length(d -> 'pays') > 8 then raise exception 'dato_invalido'; end if;
      for p in select * from jsonb_array_elements(d -> 'pays') loop
        med := p ->> 'm';
        if med is null or med not in ('efectivo', 'transferencia', 'qr', 'debito', 'credito', 'cc', 'mon') or med = any(seen) then raise exception 'pago_invalido'; end if;
        seen := seen || med;
        begin a := (p ->> 'a')::numeric; exception when others then raise exception 'pago_invalido'; end;
        if a is null or a <= 0 or a > 1000000000 then raise exception 'pago_invalido'; end if;
        sm := sm + a;
        if med = 'cc' then ccs := ccs + a; end if;
        if med = 'mon' then mons := mons + a; end if;
      end loop;
      if jsonb_array_length(d -> 'pays') > 0 and round(sm, 2) <> round(tot, 2) then raise exception 'pago_no_cierra'; end if;
      if round(ccs, 2) <> round(coalesce((d ->> 'cc')::numeric, 0), 2) then raise exception 'pago_no_cierra'; end if;
      sid := coalesce(d ->> 'socioId', '');
      if mons > 0 then
        if sid = '' then raise exception 'pago_invalido'; end if;
        perform pg_advisory_xact_lock(hashtext('mon:' || tid::text || ':' || sid));
        sal := public._mon_saldo(tid, sid);
        if mons > sal then raise exception 'saldo_insuficiente'; end if;
      end if;
      for p in select * from jsonb_array_elements(d -> 'pays') loop
        if jsonb_typeof(p -> 'det') = 'object' and coalesce(p ->> 'dupOk', '') = '' then
          k := public._pd_clave(p ->> 'm', p -> 'det');
          if k <> '' then
            insert into public.cobro_ops(tenant_id, clave, sale_id) values (tid, k, i) on conflict do nothing;
            if not found and not exists (select 1 from public.cobro_ops o where o.tenant_id = tid and o.clave = k and o.sale_id = i) then
              raise exception 'comprobante_repetido';
            end if;
          end if;
        end if;
      end loop;
    end if;
  end if;

  perform public._push_one_base(me, it);
end $$;

-- ---------------------------------------------------------------- solicitud web con la tarjeta del Club generada en el celular
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '_submit_solicitud_base') then
    alter function public.submit_solicitud(text, text, jsonb) rename to _submit_solicitud_base;
  end if;
end $$;
revoke execute on function public._submit_solicitud_base(text, text, jsonb) from public, anon, authenticated;

create or replace function public.submit_solicitud(p_tipo text, p_nonce text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r jsonb; cd jsonb; tid uuid;
begin
  r := public._submit_solicitud_base(p_tipo, p_nonce, p_payload);
  cd := p_payload -> 'card';
  if p_tipo = 'hc' and jsonb_typeof(cd) = 'object'
     and coalesce(cd ->> 'id', '') ~ '^[A-Za-z0-9_-]{14,40}$' and coalesce(cd ->> 'sec', '') ~ '^[A-Za-z0-9_-]{24,64}$' then
    select id into tid from public.tenants order by created_at limit 1;
    update public.solicitudes_web s set payload = s.payload || jsonb_build_object('card', jsonb_build_object('id', cd ->> 'id', 'sec', cd ->> 'sec'))
      where s.tenant_id = tid and s.nonce = p_nonce and not (s.payload ? 'card') and coalesce(s.payload ->> 'menor', 'false') <> 'true';
  end if;
  return r;
end $$;
grant execute on function public.submit_solicitud(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- estado de la tarjeta del Club (público, sin datos personales)
-- El celular prueba que tiene la tarjeta con una firma HMAC (clave secreta de la tarjeta) de la ventana de 2 minutos.
create or replace function public.club_estado(p_card text, p_win bigint, p_proof text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare t uuid; s jsonb; o jsonb; w bigint; goal int; have int; sid text; nv jsonb; dias int; tot numeric; niv text := '';
begin
  if p_card is null or p_card !~ '^[A-Za-z0-9_-]{14,40}$' or p_proof is null or p_proof !~ '^[0-9a-f]{64}$' then return jsonb_build_object('estado', 'invalida'); end if;
  w := floor(extract(epoch from now()) * 1000 / 120000);
  if p_win is null or abs(p_win - w) > 2 then return jsonb_build_object('estado', 'reloj'); end if;
  select id into t from public.tenants order by created_at limit 1;
  if t is null then return jsonb_build_object('estado', 'invalida'); end if;
  select r.data into s from public.registros r where r.tenant_id = t and r.col = 'socios' and not r.deleted and r.data -> 'card' ->> 'id' = p_card limit 1;
  if s is null then
    if exists (select 1 from public.solicitudes_web x where x.tenant_id = t and x.payload -> 'card' ->> 'id' = p_card and x.estado = 'nuevo'
               and encode(hmac('estado|' || p_card || '|' || p_win, x.payload -> 'card' ->> 'sec', 'sha256'), 'hex') = p_proof) then
      return jsonb_build_object('estado', 'tramite');
    end if;
    return jsonb_build_object('estado', 'desconocida');
  end if;
  if encode(hmac('estado|' || p_card || '|' || p_win, s -> 'card' ->> 'sec', 'sha256'), 'hex') <> p_proof then return jsonb_build_object('estado', 'desconocida'); end if;
  select r.data into o from public.registros r where r.tenant_id = t and r.col = 'org' and r.id = 'org';
  goal := greatest(1, least(30, coalesce((o ->> 'stampGoal')::int, 10)));
  have := greatest(0, coalesce(jsonb_array_length(case when jsonb_typeof(s -> 'stamps') = 'array' then s -> 'stamps' else '[]'::jsonb end), 0) - coalesce((s ->> 'redeemed')::int, 0) * goal);
  sid := s ->> 'id';
  nv := o -> 'niveles';
  if jsonb_typeof(nv) = 'object' and coalesce(nv ->> 'on', 'false') = 'true' then
    dias := greatest(1, coalesce((nv ->> 'dias')::int, 90));
    select coalesce(sum((r.data ->> 'total')::numeric), 0) into tot from public.registros r
      where r.tenant_id = t and r.col = 'sales' and r.data ->> 'socioId' = sid and coalesce(r.data ->> 'voided', '') <> 'true'
        and (r.data ->> 't')::numeric >= extract(epoch from now() - make_interval(days => dias)) * 1000;
    niv := case when coalesce((nv ->> 'oro')::numeric, 0) > 0 and tot >= (nv ->> 'oro')::numeric then 'Oro'
                when coalesce((nv ->> 'plata')::numeric, 0) > 0 and tot >= (nv ->> 'plata')::numeric then 'Plata' else 'Bronce' end;
  end if;
  return jsonb_build_object('estado', 'activa', 'socio', right(coalesce(s ->> 'legajo', ''), 6), 'sellos', have, 'meta', goal,
    'premio', coalesce(o ->> 'stampReward', ''), 'hoy', coalesce(s -> 'stamps', '[]'::jsonb) ? to_char(now() at time zone 'America/Argentina/Salta', 'YYYY-MM-DD'),
    'nivel', niv, 'saldo', case when coalesce(o ->> 'monedero', 'true') <> 'false' then public._mon_saldo(t, sid) else null end,
    'marca', coalesce(o ->> 'brand', ''));
end $$;

revoke execute on function public._parece_pan(text), public._pd_clave(text, jsonb), public._mon_saldo(uuid, text) from public, anon, authenticated;
revoke execute on function public._push_one(public.miembros, jsonb) from public, anon, authenticated;
grant execute on function public.club_estado(text, bigint, text) to anon, authenticated;
