-- =====================================================================
-- Sistema VB · Medicinal Terps · Esquema de la nube (Supabase / Postgres)
-- Archivo 01 de 1. Es idempotente: se puede volver a ejecutar sin romper datos.
-- Pegá TODO el contenido en Supabase → SQL Editor → Run.
-- Un solo proyecto puede alojar varias organizaciones (tenants), aisladas por RLS
-- y porque ninguna tabla se escribe directo desde el navegador: sólo por funciones.
-- [VERIFICAR] La creación de usuarios (admin_crear_usuario) escribe en auth.users
-- y auth.identities; el formato de esas tablas lo define Supabase Auth y puede cambiar.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tablas
create table if not exists public.tenants(
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  epoch int not null default 1,
  created_at timestamptz not null default now());

create table if not exists public.miembros(
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null check (rol in ('admin','mostrador','operador')),
  perms jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  must_change boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists miembros_tenant on public.miembros(tenant_id);

create table if not exists public.registros(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  col text not null,
  id text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid,
  primary key (tenant_id, col, id));
create index if not exists registros_pull on public.registros(tenant_id, updated_at, col, id);

create table if not exists public.stock_saldo(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pid text not null,
  saldo numeric(14,3) not null default 0,
  primary key (tenant_id, pid));

create table if not exists public.legajos(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legajo text not null,
  socio_id text not null,
  primary key (tenant_id, legajo),
  unique (tenant_id, socio_id));

create table if not exists public.equipos(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  dev_id text not null,
  n int not null,
  etiqueta text not null default '',
  created_at timestamptz not null default now(),
  primary key (tenant_id, dev_id),
  unique (tenant_id, n));

create table if not exists public.menus(
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  ver int not null,
  hash text not null,
  data jsonb not null,
  publicado_at timestamptz not null default now(),
  publicado_por uuid);
create table if not exists public.menus_versiones(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ver int not null,
  hash text not null,
  data jsonb not null,
  publicado_at timestamptz not null default now(),
  publicado_por uuid,
  primary key (tenant_id, ver));

create table if not exists public.solicitudes_web(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tipo text not null check (tipo in ('hc','turno')),
  payload jsonb not null,
  nonce text not null,
  estado text not null default 'nuevo',
  nota text not null default '',
  socio_id text,
  created_at timestamptz not null default now(),
  resuelto_por uuid,
  resuelto_at timestamptz,
  unique (tenant_id, nonce));
create index if not exists solicitudes_tenant on public.solicitudes_web(tenant_id, created_at desc);

create table if not exists public.rate_limits(
  clave text not null,
  ventana timestamptz not null,
  n int not null default 0,
  primary key (clave, ventana));

create table if not exists public.setup_config(
  id int primary key default 1 check (id = 1),
  code_hash text,
  creado timestamptz,
  usado timestamptz);
create table if not exists public.setup_intentos(creado timestamptz not null default now());

-- ---------------------------------------------------------------- permisos (espejo del cliente)
create or replace function public._def_perm(p_rol text, p_mod text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_rol = 'mostrador' and p_mod in ('dispensar','caja','socios','tramites') then 'cargar'
    when p_rol = 'mostrador' and p_mod in ('cultivo','solic') then 'ver'
    when p_rol = 'operador' and p_mod in ('tramites','cultivo') then 'cargar'
    when p_rol = 'operador' and p_mod = 'socios' then 'ver'
    else 'none' end $$;

create or replace function public._nivel(p_rol text, p_perms jsonb, p_mod text) returns int
language sql immutable set search_path = public, pg_temp as $$
  select case when p_rol = 'admin' then 3 else
    case coalesce(nullif(p_perms ->> p_mod, ''), public._def_perm(p_rol, p_mod))
      when 'gestionar' then 3 when 'cargar' then 2 when 'ver' then 1 else 0 end end $$;

create or replace function public._me() returns public.miembros
language sql stable security definer set search_path = public, pg_temp as $$
  select m.* from public.miembros m where m.user_id = auth.uid() and m.activo limit 1 $$;

create or replace function public._tid() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.tenant_id from public.miembros m where m.user_id = auth.uid() and m.activo limit 1 $$;

create or replace function public._lvl(p_mod text) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select public._nivel(m.rol, m.perms, p_mod) from public.miembros m where m.user_id = auth.uid() and m.activo limit 1), 0) $$;

-- ---------------------------------------------------------------- RLS
alter table public.tenants enable row level security;
alter table public.miembros enable row level security;
alter table public.registros enable row level security;
alter table public.stock_saldo enable row level security;
alter table public.legajos enable row level security;
alter table public.equipos enable row level security;
alter table public.menus enable row level security;
alter table public.menus_versiones enable row level security;
alter table public.solicitudes_web enable row level security;
alter table public.rate_limits enable row level security;
alter table public.setup_config enable row level security;
alter table public.setup_intentos enable row level security;

drop policy if exists p_sel on public.tenants;
create policy p_sel on public.tenants for select to authenticated using (id = public._tid());
drop policy if exists p_sel on public.miembros;
create policy p_sel on public.miembros for select to authenticated
  using (tenant_id = public._tid() and (user_id = auth.uid() or public._lvl('admin') = 3));
drop policy if exists p_sel on public.registros;
create policy p_sel on public.registros for select to authenticated using (tenant_id = public._tid());
drop policy if exists p_sel on public.stock_saldo;
create policy p_sel on public.stock_saldo for select to authenticated using (tenant_id = public._tid());
drop policy if exists p_sel on public.legajos;
create policy p_sel on public.legajos for select to authenticated using (tenant_id = public._tid());
drop policy if exists p_sel on public.equipos;
create policy p_sel on public.equipos for select to authenticated using (tenant_id = public._tid() and public._lvl('admin') = 3);
drop policy if exists p_sel on public.menus;
create policy p_sel on public.menus for select to authenticated using (tenant_id = public._tid());
drop policy if exists p_sel on public.menus_versiones;
create policy p_sel on public.menus_versiones for select to authenticated using (tenant_id = public._tid() and public._lvl('admin') = 3);
drop policy if exists p_sel on public.solicitudes_web;
create policy p_sel on public.solicitudes_web for select to authenticated using (tenant_id = public._tid() and public._lvl('solic') >= 1);
-- rate_limits, setup_config y setup_intentos: sin políticas = nadie las lee desde la API.

revoke all on all tables in schema public from anon, authenticated;
grant select on public.tenants, public.miembros, public.registros, public.stock_saldo, public.legajos,
  public.equipos, public.menus, public.menus_versiones, public.solicitudes_web to authenticated;

-- ---------------------------------------------------------------- utilidades internas
create or replace function public._rl(p_clave text, p_max int) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v timestamptz := date_trunc('hour', now()); c int;
begin
  insert into public.rate_limits(clave, ventana, n) values (p_clave, v, 1)
    on conflict (clave, ventana) do update set n = public.rate_limits.n + 1 returning n into c;
  if c > p_max then raise exception 'limite'; end if;
  delete from public.rate_limits where ventana < now() - interval '3 hours';
end $$;

create or replace function public._clean(p text, p_max int) returns text
language sql immutable set search_path = public, pg_temp as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', 'g')), p_max) $$;

create or replace function public._crear_auth_user(p_email text, p_pass text) returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u uuid := gen_random_uuid(); e text := lower(btrim(p_email));
begin
  if exists (select 1 from auth.users where lower(email) = e) then raise exception 'email_en_uso'; end if;
  insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', e,
      crypt(p_pass, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', '');
  insert into auth.identities(id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u, jsonb_build_object('sub', u::text, 'email', e), 'email', u::text, now(), now(), now());
  return u;
end $$;

create or replace function public._pass_ok(p text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select p is not null and length(p) between 8 and 72 and p ~ '[A-Za-z]' and p ~ '[0-9]' $$;

-- ---------------------------------------------------------------- alta inicial (una sola vez)
create or replace function public.generar_codigo_alta() returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text := upper(encode(gen_random_bytes(10), 'hex')); c text;
begin
  c := substr(h,1,4)||'-'||substr(h,5,4)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4);
  insert into public.setup_config(id, code_hash, creado, usado) values (1, crypt(replace(c,'-',''), gen_salt('bf', 10)), now(), null)
    on conflict (id) do update set code_hash = excluded.code_hash, creado = now(), usado = null;
  return c;
end $$;

create or replace function public.estado_alta() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('inicializado', exists (select 1 from public.tenants),
                            'alta_disponible', exists (select 1 from public.setup_config where code_hash is not null and usado is null)) $$;

create or replace function public.setup_primer_admin(p_codigo text, p_org text, p_nombre text, p_email text, p_pass text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare cfg public.setup_config; v_t uuid; u uuid; slug text; org text := public._clean(p_org, 100); nom text := public._clean(p_nombre, 60); em text := lower(btrim(coalesce(p_email,'')));
begin
  if (select count(*) from public.setup_intentos where creado > now() - interval '1 hour') >= 6 then raise exception 'demasiados_intentos'; end if;
  if exists (select 1 from public.tenants) then raise exception 'ya_inicializado'; end if;
  select * into cfg from public.setup_config where id = 1;
  if cfg.code_hash is null or cfg.usado is not null
     or crypt(replace(upper(coalesce(p_codigo,'')), '-', ''), cfg.code_hash) <> cfg.code_hash then
    insert into public.setup_intentos default values;
    raise exception 'codigo_invalido';
  end if;
  if org = '' or nom = '' or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'datos_invalidos'; end if;
  if not public._pass_ok(p_pass) then raise exception 'clave_debil'; end if;
  slug := lower(regexp_replace(translate(org, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'), '[^a-zA-Z0-9]+', '-', 'g'));
  slug := trim(both '-' from slug); if slug = '' then slug := 'org'; end if;
  insert into public.tenants(nombre, slug) values (org, slug) returning id into v_t;
  u := public._crear_auth_user(em, p_pass);
  insert into public.miembros(user_id, tenant_id, email, nombre, rol, must_change) values (u, v_t, em, nom, 'admin', false);
  update public.setup_config set usado = now() where id = 1;
  delete from public.setup_intentos;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- perfil, equipos y usuarios
create or replace function public.mi_perfil() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare m public.miembros; t public.tenants;
begin
  select * into m from public._me();
  if m.user_id is null then raise exception 'no_miembro'; end if;
  select * into t from public.tenants where id = m.tenant_id;
  return jsonb_build_object('user_id', m.user_id, 'nombre', m.nombre, 'email', m.email, 'rol', m.rol, 'perms', m.perms,
    'must_change', m.must_change, 'tenant', jsonb_build_object('id', t.id, 'nombre', t.nombre, 'epoch', t.epoch));
end $$;

create or replace function public.clave_cambiada() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.miembros;
begin
  select * into m from public._me(); if m.user_id is null then raise exception 'no_miembro'; end if;
  update public.miembros set must_change = false, updated_at = now() where user_id = m.user_id;
end $$;

create or replace function public.equipo_alta(p_dev text, p_etiqueta text default '') returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.miembros; n int; d text := public._clean(p_dev, 80);
begin
  select * into m from public._me(); if m.user_id is null then raise exception 'no_miembro'; end if;
  if d = '' then raise exception 'datos_invalidos'; end if;
  perform pg_advisory_xact_lock(hashtextextended('equipo:' || m.tenant_id::text, 0));
  select e.n into n from public.equipos e where e.tenant_id = m.tenant_id and e.dev_id = d;
  if n is null then
    select coalesce(max(e.n), 0) + 1 into n from public.equipos e where e.tenant_id = m.tenant_id;
    insert into public.equipos(tenant_id, dev_id, n, etiqueta) values (m.tenant_id, d, n, public._clean(p_etiqueta, 60));
  end if;
  return n;
end $$;

create or replace function public._admin() returns public.miembros
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare m public.miembros;
begin
  select * into m from public._me();
  if m.user_id is null then raise exception 'no_miembro'; end if;
  if m.rol <> 'admin' then raise exception 'sin_permiso'; end if;
  return m;
end $$;

create or replace function public.admin_listar() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare a public.miembros;
begin
  a := public._admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.user_id, 'name', m.nombre, 'email', m.email, 'role', m.rol,
      'perms', m.perms, 'active', m.activo, 'must_change', m.must_change) order by m.created_at)
    from public.miembros m where m.tenant_id = a.tenant_id), '[]'::jsonb);
end $$;

create or replace function public.admin_crear_usuario(p_email text, p_nombre text, p_rol text, p_pass text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare a public.miembros; u uuid; em text := lower(btrim(coalesce(p_email,''))); nom text := public._clean(p_nombre, 60);
begin
  a := public._admin();
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or nom = '' then raise exception 'datos_invalidos'; end if;
  if p_rol not in ('admin','mostrador','operador') then raise exception 'rol_invalido'; end if;
  if not public._pass_ok(p_pass) then raise exception 'clave_debil'; end if;
  u := public._crear_auth_user(em, p_pass);
  insert into public.miembros(user_id, tenant_id, email, nombre, rol, must_change) values (u, a.tenant_id, em, nom, p_rol, true);
  return jsonb_build_object('id', u);
end $$;

create or replace function public._corta_sesiones(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin update auth.users set banned_until = 'infinity' where id = p_user; exception when others then null; end;
  begin delete from auth.refresh_tokens where user_id = p_user::text; exception when others then null; end;
  begin delete from auth.sessions where user_id = p_user; exception when others then null; end;
end $$;

create or replace function public.admin_set_activo(p_user uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.miembros; m public.miembros;
begin
  a := public._admin();
  select * into m from public.miembros where user_id = p_user and tenant_id = a.tenant_id;
  if m.user_id is null then raise exception 'no_existe'; end if;
  if not p_activo and m.rol = 'admin' and m.activo
     and (select count(*) from public.miembros x where x.tenant_id = a.tenant_id and x.rol = 'admin' and x.activo) < 2 then
    raise exception 'ultimo_admin';
  end if;
  update public.miembros set activo = p_activo, updated_at = now() where user_id = p_user;
  if p_activo then
    begin update auth.users set banned_until = null where id = p_user; exception when others then null; end;
  else perform public._corta_sesiones(p_user); end if;
end $$;

create or replace function public.admin_reset_clave(p_user uuid, p_pass text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare a public.miembros;
begin
  a := public._admin();
  if not public._pass_ok(p_pass) then raise exception 'clave_debil'; end if;
  if not exists (select 1 from public.miembros where user_id = p_user and tenant_id = a.tenant_id) then raise exception 'no_existe'; end if;
  update auth.users set encrypted_password = crypt(p_pass, gen_salt('bf')), updated_at = now() where id = p_user;
  update public.miembros set must_change = true, updated_at = now() where user_id = p_user;
end $$;

create or replace function public.admin_set_perms(p_user uuid, p_perms jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.miembros; m public.miembros; k text; v text; clean jsonb := '{}'::jsonb;
begin
  a := public._admin();
  select * into m from public.miembros where user_id = p_user and tenant_id = a.tenant_id;
  if m.user_id is null then raise exception 'no_existe'; end if;
  if m.rol = 'admin' then raise exception 'sin_permiso'; end if;
  if jsonb_typeof(p_perms) <> 'object' then raise exception 'datos_invalidos'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_perms) loop
    if k not in ('dispensar','caja','socios','tramites','cultivo','inventario','gastos','personal','solic','reportes','datos') then raise exception 'datos_invalidos'; end if;
    if v not in ('none','ver','cargar','gestionar') then raise exception 'datos_invalidos'; end if;
    clean := clean || jsonb_build_object(k, v);
  end loop;
  update public.miembros set perms = clean, updated_at = now() where user_id = p_user;
end $$;

-- ---------------------------------------------------------------- sincronización
create or replace function public._col_mod(p_col text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case p_col
    when 'cats' then 'inventario' when 'products' then 'inventario'
    when 'sales' then 'dispensar' when 'ncs' then 'dispensar'
    when 'cashClosed' then 'caja' when 'cnotes' then 'caja'
    when 'gastos' then 'gastos' when 'tramites' then 'tramites' when 'staff' then 'personal'
    when 'ciclos' then 'cultivo' when 'cregs' then 'cultivo' when 'turnos' then 'solic' when 'socios' then 'socios'
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

  -- ---- sólo agregar
  if c in ('audit','cnotes','ncs','tenantmeta') then
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

create or replace function public.sync_push(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare me public.miembros; it jsonb; ok jsonb := '[]'::jsonb; rej jsonb := '[]'::jsonb; ep int;
begin
  select * into me from public._me();
  if me.user_id is null then raise exception 'no_miembro'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then raise exception 'lote_invalido'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    begin
      perform public._push_one(me, it);
      ok := ok || jsonb_build_array(jsonb_build_object('col', it ->> 'col', 'id', it ->> 'id'));
    exception
      when raise_exception then
        rej := rej || jsonb_build_array(jsonb_build_object('col', it ->> 'col', 'id', it ->> 'id', 'reason', sqlerrm));
      when others then
        rej := rej || jsonb_build_array(jsonb_build_object('col', it ->> 'col', 'id', it ->> 'id', 'reason', 'error_interno'));
    end;
  end loop;
  select epoch into ep from public.tenants where id = me.tenant_id;
  return jsonb_build_object('ok', ok, 'rej', rej, 'epoch', ep);
end $$;

create or replace function public.sync_pull(p_since timestamptz default null, p_col text default '', p_id text default '', p_limit int default 500, p_overlap int default 0) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare me public.miembros; ep int; since timestamptz; rows jsonb;
begin
  select * into me from public._me();
  if me.user_id is null then raise exception 'no_miembro'; end if;
  select epoch into ep from public.tenants where id = me.tenant_id;
  since := coalesce(p_since, '-infinity'::timestamptz);
  if p_since is not null and coalesce(p_col, '') = '' and coalesce(p_id, '') = '' and p_overlap > 0 then
    since := since - make_interval(secs => least(p_overlap, 300));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('col', x.col, 'id', x.id, 'data', x.data, 'deleted', x.deleted, 't', x.updated_at) order by x.updated_at, x.col, x.id), '[]'::jsonb)
    into rows
    from (select r.col, r.id, r.data, r.deleted, r.updated_at from public.registros r
          where r.tenant_id = me.tenant_id and (r.updated_at, r.col, r.id) > (since, coalesce(p_col, ''), coalesce(p_id, ''))
          order by r.updated_at, r.col, r.id limit greatest(1, least(coalesce(p_limit, 500), 1000))) x;
  return jsonb_build_object('epoch', ep, 'rows', rows);
end $$;

create or replace function public.vaciar_datos() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.miembros; ep int;
begin
  a := public._admin();
  delete from public.registros where tenant_id = a.tenant_id
    and (col in ('socios','sales','ncs','stockMoves','cashClosed','cnotes','gastos','tramites','staff','fichajes','ciclos','cregs','turnos','menuVersions','pubSnap')
         or (col = 'products' and coalesce(data ->> 'membership', 'false') <> 'true'));
  delete from public.stock_saldo where tenant_id = a.tenant_id;
  delete from public.legajos where tenant_id = a.tenant_id;
  delete from public.solicitudes_web where tenant_id = a.tenant_id;
  delete from public.menus where tenant_id = a.tenant_id;
  delete from public.menus_versiones where tenant_id = a.tenant_id;
  update public.tenants set epoch = epoch + 1 where id = a.tenant_id returning epoch into ep;
  return ep;
end $$;

-- ---------------------------------------------------------------- menú público
create or replace function public.menu_publicar(p_data jsonb, p_ver int, p_hash text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.miembros;
begin
  a := public._admin();
  if jsonb_typeof(p_data) <> 'object' or p_ver is null or p_ver < 1 or length(coalesce(p_hash, '')) <> 64 or pg_column_size(p_data) > 8000000 then raise exception 'datos_invalidos'; end if;
  insert into public.menus(tenant_id, ver, hash, data, publicado_por) values (a.tenant_id, p_ver, p_hash, p_data, a.user_id)
    on conflict (tenant_id) do update set ver = excluded.ver, hash = excluded.hash, data = excluded.data, publicado_at = now(), publicado_por = excluded.publicado_por;
  insert into public.menus_versiones(tenant_id, ver, hash, data, publicado_por) values (a.tenant_id, p_ver, p_hash, p_data, a.user_id)
    on conflict (tenant_id, ver) do nothing;
end $$;

create or replace function public.menu_publico(p_slug text default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select m.data from public.menus m join public.tenants t on t.id = m.tenant_id
   where p_slug is null or t.slug = p_slug order by t.created_at limit 1 $$;

-- ---------------------------------------------------------------- solicitudes web (anónimo)
create or replace function public.submit_solicitud(p_tipo text, p_nonce text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare tid uuid; ip text; wa text; pl jsonb; tut jsonb; f date; hoy date := (now() at time zone 'America/Argentina/Salta')::date;
        dia date; docd text; fr text;
begin
  if p_tipo not in ('hc','turno') then raise exception 'datos_invalidos'; end if;
  if p_nonce is null or p_nonce !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'datos_invalidos'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 12000 then raise exception 'datos_invalidos'; end if;
  select id into tid from public.tenants order by created_at limit 1;
  if tid is null then raise exception 'no_disponible'; end if;
  begin ip := (current_setting('request.headers', true)::json) ->> 'x-forwarded-for'; exception when others then ip := null; end;
  perform public._rl('ip:' || md5(coalesce(ip, 'sin-ip')), 12);
  wa := right(regexp_replace(coalesce(p_payload ->> 'wa', ''), '\D', '', 'g'), 10);
  if length(wa) < 8 then raise exception 'datos_invalidos'; end if;
  perform public._rl('wa:' || p_tipo || ':' || wa, 4);
  if p_tipo = 'hc' then
    begin f := (p_payload ->> 'fnac')::date; exception when others then raise exception 'datos_invalidos'; end;
    if f is null or f > hoy or f < date '1900-01-01' then raise exception 'datos_invalidos'; end if;
    if length(public._clean(p_payload ->> 'nombre', 60)) < 1 or length(public._clean(p_payload ->> 'apellido', 60)) < 1 then raise exception 'datos_invalidos'; end if;
    if coalesce(p_payload ->> 'consentInf', '') <> 'true' then raise exception 'datos_invalidos'; end if;
    docd := regexp_replace(coalesce(p_payload ->> 'doc', ''), '\D', '', 'g');
    if docd <> '' and length(docd) not between 6 and 11 then raise exception 'datos_invalidos'; end if;
    pl := jsonb_build_object(
      'nombre', public._clean(p_payload ->> 'nombre', 60), 'apellido', public._clean(p_payload ->> 'apellido', 60),
      'fnac', to_char(f, 'YYYY-MM-DD'), 'wa', regexp_replace(p_payload ->> 'wa', '\D', '', 'g'),
      'docTipo', case when p_payload ->> 'docTipo' in ('DNI','CUIT','CUIL') then p_payload ->> 'docTipo' else 'DNI' end, 'doc', docd,
      'email', public._clean(p_payload ->> 'email', 80), 'cp', public._clean(p_payload ->> 'cp', 10),
      'domicilio', public._clean(p_payload ->> 'domicilio', 120), 'ocupacion', public._clean(p_payload ->> 'ocupacion', 60),
      'obraSocial', public._clean(p_payload ->> 'obraSocial', 60), 'motivo', public._clean(p_payload ->> 'motivo', 400),
      'estado', case when p_payload ->> 'estado' in ('none','prog','vig','venc','otro') then p_payload ->> 'estado' else 'none' end,
      'dudas', public._clean(p_payload ->> 'dudas', 400),
      'menor', (f > (hoy - interval '18 years')::date),
      'consentInf', true,
      'consentComm', coalesce(p_payload ->> 'consentComm', '') = 'true' and not (f > (hoy - interval '18 years')::date));
    if (pl ->> 'menor')::boolean then
      tut := p_payload -> 'tutor';
      if jsonb_typeof(tut) <> 'object' then raise exception 'datos_invalidos'; end if;
      pl := pl || jsonb_build_object('tutor', jsonb_build_object(
        'nombre', public._clean(tut ->> 'nombre', 80), 'parentesco', public._clean(tut ->> 'parentesco', 40),
        'docTipo', 'DNI', 'doc', regexp_replace(coalesce(tut ->> 'doc', ''), '\D', '', 'g'),
        'wa', regexp_replace(coalesce(tut ->> 'wa', ''), '\D', '', 'g')));
      if length(pl #>> '{tutor,nombre}') < 2 then raise exception 'datos_invalidos'; end if;
    end if;
  else
    begin dia := (p_payload ->> 'dia')::date; exception when others then raise exception 'datos_invalidos'; end;
    if dia is null or dia < hoy or dia > hoy + 365 then raise exception 'datos_invalidos'; end if;
    fr := case when p_payload ->> 'franja' in ('man','tar') then p_payload ->> 'franja' else 'man' end;
    if length(public._clean(p_payload ->> 'ident', 80)) < 2 or length(public._clean(p_payload ->> 'motivo', 300)) < 2 then raise exception 'datos_invalidos'; end if;
    pl := jsonb_build_object('ident', public._clean(p_payload ->> 'ident', 80), 'wa', regexp_replace(p_payload ->> 'wa', '\D', '', 'g'),
      'motivo', public._clean(p_payload ->> 'motivo', 300), 'dia', to_char(dia, 'YYYY-MM-DD'), 'franja', fr, 'nota', public._clean(p_payload ->> 'nota', 300));
  end if;
  insert into public.solicitudes_web(tenant_id, tipo, payload, nonce) values (tid, p_tipo, pl, p_nonce)
    on conflict (tenant_id, nonce) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.inbox_list() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare me public.miembros;
begin
  select * into me from public._me(); if me.user_id is null then raise exception 'no_miembro'; end if;
  if public._nivel(me.rol, me.perms, 'solic') < 1 then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tipo', s.tipo, 't', (extract(epoch from s.created_at) * 1000)::bigint,
      'payload', s.payload, 'estado', s.estado, 'nota', s.nota, 'socioId', s.socio_id,
      'resT', case when s.resuelto_at is null then null else (extract(epoch from s.resuelto_at) * 1000)::bigint end) order by s.created_at desc)
    from (select * from public.solicitudes_web w where w.tenant_id = me.tenant_id order by w.created_at desc limit 500) s), '[]'::jsonb);
end $$;

create or replace function public.inbox_resolve(p_id uuid, p_estado text, p_nota text default '', p_socio text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.miembros; s public.solicitudes_web;
begin
  select * into me from public._me(); if me.user_id is null then raise exception 'no_miembro'; end if;
  if public._nivel(me.rol, me.perms, 'solic') < 2 then raise exception 'sin_permiso'; end if;
  select * into s from public.solicitudes_web where id = p_id and tenant_id = me.tenant_id for update;
  if s.id is null then raise exception 'no_existe'; end if;
  if (s.tipo = 'hc' and p_estado not in ('incorporada','rechazada')) or (s.tipo = 'turno' and p_estado not in ('confirmado','rechazado')) then raise exception 'estado_invalido'; end if;
  if s.estado <> 'nuevo' and s.estado <> p_estado then raise exception 'ya_resuelta'; end if;
  update public.solicitudes_web set estado = p_estado, nota = public._clean(p_nota, 300), socio_id = coalesce(public._clean(p_socio, 80), socio_id),
    resuelto_por = me.user_id, resuelto_at = now() where id = p_id;
end $$;

-- ---------------------------------------------------------------- soporte (sólo desde el SQL Editor)
create or replace function public.soporte_restablecer_clave(p_email text, p_temp text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u uuid;
begin
  select user_id into u from public.miembros where lower(email) = lower(btrim(p_email));
  if u is null then raise exception 'no_existe'; end if;
  if not public._pass_ok(p_temp) then raise exception 'clave_debil'; end if;
  update auth.users set encrypted_password = crypt(p_temp, gen_salt('bf')), updated_at = now(), banned_until = null where id = u;
  update public.miembros set must_change = true, activo = true, updated_at = now() where user_id = u;
end $$;

-- ---------------------------------------------------------------- permisos de ejecución
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public._tid(), public._lvl(text) to authenticated;
grant execute on function public.mi_perfil(), public.clave_cambiada(), public.equipo_alta(text, text),
  public.admin_listar(), public.admin_crear_usuario(text, text, text, text), public.admin_set_activo(uuid, boolean),
  public.admin_reset_clave(uuid, text), public.admin_set_perms(uuid, jsonb),
  public.sync_push(jsonb), public.sync_pull(timestamptz, text, text, int, int), public.vaciar_datos(),
  public.menu_publicar(jsonb, int, text), public.inbox_list(), public.inbox_resolve(uuid, text, text, text) to authenticated;
grant execute on function public.estado_alta(), public.setup_primer_admin(text, text, text, text, text),
  public.menu_publico(text), public.submit_solicitud(text, text, jsonb) to anon, authenticated;
-- generar_codigo_alta() y soporte_restablecer_clave() NO se exponen a la API: sólo se ejecutan desde el SQL Editor.
