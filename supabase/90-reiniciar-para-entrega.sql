-- =====================================================================
-- Sistema VB · Reinicio para la ENTREGA al cliente (SQL Editor, una sola vez)
-- BORRA todos los datos de prueba (organizaciones, usuarios, registros, menú, solicitudes)
-- y genera un NUEVO código de alta de un solo uso, que se muestra abajo (pestaña "Results").
-- El código NO se guarda en ningún archivo: anotalo y entregalo al dueño por un canal seguro.
-- Con ese código, el dueño crea su organización y su administrador desde la pantalla de ingreso.
-- NO ejecutar con datos reales: es destructivo.
-- =====================================================================
truncate public.registros, public.stock_saldo, public.legajos, public.equipos, public.menus,
         public.menus_versiones, public.solicitudes_web, public.rate_limits, public.setup_intentos,
         public.miembros, public.tenants cascade;
delete from public.setup_config where true;
-- Usuarios de acceso creados durante las pruebas (sólo los que figuraban como miembros):
delete from auth.identities where user_id in (select id from auth.users where raw_app_meta_data ->> 'provider' = 'email');
delete from auth.users where raw_app_meta_data ->> 'provider' = 'email';
select public.generar_codigo_alta() as codigo_de_alta_un_solo_uso;
