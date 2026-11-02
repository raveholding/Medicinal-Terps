-- Simula lo mínimo de Supabase para probar el esquema en un Postgres común (SOLO PRUEBAS)
create schema if not exists extensions;
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create table if not exists auth.users(
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz, banned_until timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text);
create table if not exists auth.identities(id uuid primary key, user_id uuid, identity_data jsonb, provider text, provider_id text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create table if not exists auth.refresh_tokens(id bigserial primary key, user_id text, token text);
create table if not exists auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid);
create or replace function auth.uid() returns uuid language sql stable as
 $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public, extensions to anon, authenticated;
-- ---- rol de servicio y bóveda (stub de supabase_vault, SOLO PRUEBAS) ----
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, extensions to service_role;
create schema if not exists vault;
create table if not exists vault.secrets(id uuid primary key default gen_random_uuid(), name text unique, description text, secret text not null, created_at timestamptz default now());
create or replace view vault.decrypted_secrets as select id, name, description, secret as decrypted_secret, created_at from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '') returns uuid
language sql as $$ insert into vault.secrets(secret,name,description) values (new_secret,new_name,new_description) returning id $$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null) returns void
language sql as $$ update vault.secrets set secret=coalesce(new_secret,secret) where id=secret_id $$;
revoke all on schema vault from public, anon, authenticated;
