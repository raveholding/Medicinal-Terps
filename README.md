# Medicinal Terps · Sistema VB (v3.0)

Sistema de gestión de **Terpenos Medicinales – Asociación Civil** (Organización Cannábica Medicinal de Salta): sitio público + panel interno en **un solo `index.html`** (HTML5/PWA), con nube opcional en **Supabase (región São Paulo)**.

- Sitio: https://raveholding.github.io/Medicinal-Terps/
- Panel: botón «Acceso del equipo» (`#/acceso`).
- Vocabulario de ONG en toda la interfaz: *socios/pacientes, entrega, donación voluntaria, donación sugerida*.

## Qué incluye
Socios y pacientes con legajo y duplicados · REPROCANN y topes por persona · entrega con donación voluntaria y rubro obligatorio · Factura C **simulada** (sin CAE, sin validez fiscal) · caja con cierre sellado (SHA-256) · inventario con lotes/vencimientos y trazabilidad · club de sellos · trámites REPROCANN · historia clínica web + turnero (solicitudes) · planilla de cultivo · gastos · reportes · importar/exportar · menú público ES/EN con borrador, publicación y versiones · roles (administrador, mostrador, operador) · Google Drive opcional (planilla y respaldo cifrado) · bloqueo por inactividad · auditoría encadenada.

## Cómo se conecta la nube (lo hace el dueño, una sola vez)
1. Crear un proyecto en Supabase, región **South America (São Paulo)**.
2. SQL Editor → pegar **todo** `supabase/01-esquema.sql` → Run.
3. Ejecutar `select public.generar_codigo_alta();` y anotar el **código de alta** (un solo uso; no se guarda en ningún archivo). *(`supabase/90-reiniciar-para-entrega.sql` es destructivo: sólo para borrar datos de prueba y generar un código nuevo.)*
4. Authentication → Providers → Email: desactivar «Confirm email».
5. Cargar en `config.json` la **URL del proyecto** y la **clave publicable** (`sb_publishable_…`) y volver a armar con `python3 assemble.py` (o editar el JSON de la etiqueta `<script id="cfg">` de `index.html`). **Nunca** poner la clave secreta/`service_role`.
6. Abrir el sitio → «Acceso del equipo» → ingresar el código de alta y crear la organización y el administrador.

Para Google Drive: crear un *OAuth Client ID* web en Google Cloud (alcance mínimo `drive.file`), agregar el dominio del sitio como origen autorizado y cargar el identificador en `config.json` (`google_client_id`).

## Pruebas (carpeta `test/`)
Playwright + Chromium y un Postgres 16 local con un servidor simulado de Supabase (`test/shim.py`). Ejecutar: `sqltest.py` (esquema/RLS/concurrencia), `c1_cloud.py`, `c2_cloud.py` (dos equipos, offline, rechazos), `t1a…t1d_local.py` (flujos locales), `vocab.py` (vocabulario). Resultado de la entrega: 139 + 38 + 17 + 37 + 31 + 24 + 23 controles en verde.

## Límites declarados (honestidad)
- **No probado contra un Supabase real ni contra Google Drive real**: se probó con servidores simulados. La creación de usuarios por SQL escribe en `auth.users`/`auth.identities` y debe validarse en el proyecto real [VERIFICAR].
- **Factura C simulada**: el CAE real requiere certificado de ARCA y servicio WSFE [VERIFICAR en arca.gob.ar]; no tiene validez fiscal.
- Importes en pesos (no en centavos enteros); conflictos de edición: gana la última escritura; el stock negativo se rechaza en la nube y se corrige con un ajuste.
- Sin cifrado campo a campo en la nube (la base local sí es AES-256-GCM); la cadena de auditoría es por equipo.
- Sin Mercado Pago, correo ni WhatsApp automático. Hardware (impresoras, lectores) sin probar. Instalador de Windows en pausa.
- Los textos legales y de consentimiento los debe revisar un asesor legal [VERIFICAR Ley 25.326].

Desarrollado por **VINCULAR BUSINESS** · (387) 4484132 · vincularbusiness@gmail.com · «Tu idea, en buenas manos.»
