-- =====================================================================================
-- 05 · Google Drive de la organización por SERVIDOR · 2026-11-02
-- Una persona administradora autoriza UNA sola vez («Conectar Google Drive de la organización»);
-- el servidor guarda el permiso de Google (refresh token) cifrado en la bóveda de Supabase (supabase_vault).
-- Ningún navegador lo puede leer. Desde ahí cualquier equipo crea las carpetas de los legajos, actualiza la
-- hoja de legajos y sube documentos SIN conectar nada. Lo usa la función de servidor «drive-legajos».
-- Aditivo e idempotente. No toca datos existentes.
-- =====================================================================================
do $$ begin
  create extension if not exists supabase_vault;
exception when others then raise notice 'supabase_vault no disponible en esta base (sólo pruebas locales): %', sqlerrm;
end $$;

create table if not exists public.drive_conexion (
  tenant_id uuid primary key references public.tenants(id),
  secreto_id uuid,                  -- id del secreto en vault.secrets (el token NO está en esta tabla)
  cuenta text,                      -- correo de Google que autorizó
  carpeta_raiz_id text check (carpeta_raiz_id is null or carpeta_raiz_id ~ '^[A-Za-z0-9_-]{10,120}$'),
  hoja_id text check (hoja_id is null or hoja_id ~ '^[A-Za-z0-9_-]{10,120}$'),
  scopes text,
  conectado_por uuid,
  conectado_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.drive_conexion add column if not exists hoja_id text;
alter table public.drive_conexion enable row level security;
revoke all on public.drive_conexion from anon, authenticated;   -- sin políticas: ilegible desde el navegador

-- registro sólo-agregar de conexiones (quién conectó o desconectó, sin tokens)
create table if not exists public.drive_eventos (
  id bigserial primary key,
  tenant_id uuid not null references public.tenants(id),
  user_id uuid,
  evento text not null check (evento in ('conectado','desconectado')),
  cuenta text,
  ts timestamptz not null default now()
);
alter table public.drive_eventos enable row level security;
revoke all on public.drive_eventos from anon, authenticated;

-- nivel del usuario actual en «socios» (0 ninguno · 1 ver · 2 cargar · 3 gestionar). Lo usa la función.
create or replace function public.drive_mi_nivel() returns int
language sql stable security definer set search_path = public, pg_temp as $$ select public._lvl('socios') $$;
revoke all on function public.drive_mi_nivel() from public, anon;
grant execute on function public.drive_mi_nivel() to authenticated;

create or replace function public.drive_guardar_token(p_tenant uuid, p_token text, p_cuenta text, p_uid uuid, p_scopes text)
returns void language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare v_sec uuid;
begin
  if p_token is null or length(p_token) < 20 then raise exception 'token_invalido'; end if;
  if not exists (select 1 from public.miembros where user_id = p_uid and tenant_id = p_tenant and rol = 'admin' and activo) then
    raise exception 'sin_permiso';
  end if;
  select secreto_id into v_sec from public.drive_conexion where tenant_id = p_tenant;
  if v_sec is not null and exists (select 1 from vault.secrets where id = v_sec) then
    perform vault.update_secret(v_sec, p_token);
  else
    v_sec := vault.create_secret(p_token, 'drive_rt_' || p_tenant::text || '_' || extract(epoch from now())::bigint, 'Permiso de Google Drive de la organización (refresh token)');
  end if;
  insert into public.drive_conexion (tenant_id, secreto_id, cuenta, scopes, conectado_por, conectado_at, updated_at)
  values (p_tenant, v_sec, left(p_cuenta, 200), left(p_scopes, 500), p_uid, now(), now())
  on conflict (tenant_id) do update set secreto_id = excluded.secreto_id, cuenta = excluded.cuenta, scopes = excluded.scopes,
    conectado_por = excluded.conectado_por, conectado_at = excluded.conectado_at, updated_at = now();
  insert into public.drive_eventos (tenant_id, user_id, evento, cuenta) values (p_tenant, p_uid, 'conectado', left(p_cuenta, 200));
end $$;

create or replace function public.drive_leer(p_tenant uuid)
returns jsonb language sql stable security definer set search_path = public, vault, pg_temp as $$
  select jsonb_build_object('token', case when c.conectado_at is not null then d.decrypted_secret end, 'cuenta', c.cuenta, 'raiz', c.carpeta_raiz_id, 'hoja', c.hoja_id, 'conectado_at', c.conectado_at)
  from public.drive_conexion c left join vault.decrypted_secrets d on d.id = c.secreto_id
  where c.tenant_id = p_tenant
$$;

create or replace function public.drive_set_raiz(p_tenant uuid, p_raiz text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_raiz !~ '^[A-Za-z0-9_-]{10,120}$' then raise exception 'carpeta_invalida'; end if;
  update public.drive_conexion set carpeta_raiz_id = p_raiz, updated_at = now() where tenant_id = p_tenant;
end $$;

create or replace function public.drive_set_hoja(p_tenant uuid, p_hoja text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_hoja !~ '^[A-Za-z0-9_-]{10,120}$' then raise exception 'hoja_invalida'; end if;
  update public.drive_conexion set hoja_id = p_hoja, updated_at = now() where tenant_id = p_tenant;
end $$;

-- desconectar: el secreto se sobrescribe (queda inutilizable) y la conexión se marca cerrada; no se borra
-- ninguna fila, así queda la historia y una nueva conexión reutiliza el mismo lugar de la bóveda.
create or replace function public.drive_borrar(p_tenant uuid, p_uid uuid)
returns void language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare v_sec uuid;
begin
  if not exists (select 1 from public.miembros where user_id = p_uid and tenant_id = p_tenant and rol = 'admin' and activo) then
    raise exception 'sin_permiso';
  end if;
  select secreto_id into v_sec from public.drive_conexion where tenant_id = p_tenant;
  if v_sec is not null and exists (select 1 from vault.secrets where id = v_sec) then
    perform vault.update_secret(v_sec, 'revocado-' || extract(epoch from now())::bigint);
  end if;
  update public.drive_conexion set cuenta = null, scopes = null, conectado_at = null, updated_at = now() where tenant_id = p_tenant;
  insert into public.drive_eventos (tenant_id, user_id, evento) values (p_tenant, p_uid, 'desconectado');
end $$;

-- sólo la función de servidor (service_role) puede usarlas
do $$
declare f text;
begin
  foreach f in array array['public.drive_guardar_token(uuid,text,text,uuid,text)','public.drive_leer(uuid)','public.drive_set_raiz(uuid,text)',
                           'public.drive_set_hoja(uuid,text)','public.drive_borrar(uuid,uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
