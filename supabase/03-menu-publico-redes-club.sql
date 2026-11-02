-- =====================================================================
-- Sistema VB · Medicinal Terps · migración 03 (2026-11-02) — ADITIVA E IDEMPOTENTE
-- Menú público unificado: el catálogo vivo (antes de la primera publicación) también lleva
-- TikTok, X, YouTube, sitio web, enlace de reseñas y la meta/beneficio del Club.
-- Nunca datos de personas, costos ni stock exacto. Se ejecuta después de 02.
-- =====================================================================

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
      'hcName', coalesce(o -> 'hcName', to_jsonb('Historia Clínica · Solicitud Reprocann'::text)), 'turnero', to_jsonb(coalesce(o ->> 'turnero', 'true') <> 'false'))
      || jsonb_build_object('tiktok', coalesce(o -> 'tiktok', '""'::jsonb), 'x', coalesce(o -> 'x', '""'::jsonb), 'youtube', coalesce(o -> 'youtube', '""'::jsonb),
      'web', coalesce(o -> 'web', '""'::jsonb), 'reviewUrl', coalesce(o -> 'reviewUrl', '""'::jsonb),
      'stampGoal', coalesce(o -> 'stampGoal', '10'::jsonb), 'stampReward', coalesce(o -> 'stampReward', '""'::jsonb)),
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

grant execute on function public.menu_publico(text) to anon, authenticated;
