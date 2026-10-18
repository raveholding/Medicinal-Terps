# Medicinal Terps · Sistema VB (v3.0)

Sistema de gestión de **Terpenos Medicinales – Asociación Civil** (Organización Cannábica Medicinal de Salta): sitio público + panel interno en **un solo `index.html`** (HTML5/PWA), con nube opcional en **Supabase (región São Paulo)**.

- Sitio: https://raveholding.github.io/Medicinal-Terps/
- Panel: botón «Acceso del equipo» (`#/acceso`).
- Vocabulario de ONG en toda la interfaz: *socios/pacientes, entrega, donación voluntaria, donación sugerida*.

## Qué incluye
Socios y pacientes con legajo y duplicados · REPROCANN y topes por persona · entrega con donación voluntaria y rubro obligatorio · Factura C **simulada** (sin CAE, sin validez fiscal) · caja con cierre sellado (SHA-256) · inventario con lotes/vencimientos y trazabilidad · club de sellos · trámites REPROCANN · historia clínica web + turnero (solicitudes) · planilla de cultivo · gastos · reportes · importar/exportar · menú público ES/EN con borrador, publicación y versiones · roles (administrador, mostrador, operador) · Google Drive opcional (planilla y respaldo cifrado) · bloqueo por inactividad · auditoría encadenada.

## Estado de la nube (Supabase, São Paulo)
Proyecto **medicinal-terps** (región sa-east-1) ya creado, con `supabase/01-esquema.sql` aplicado (12 tablas con RLS, 34 funciones), «Confirm email» y el registro libre de usuarios desactivados. `config.json` ya lleva la URL y la **clave publicable** (`sb_publishable_…`; nunca la clave secreta/`service_role`).

Falta un único paso, que se hace al entregar: abrir el sitio → «Acceso del equipo» → ingresar el **código de alta** (un solo uso; se entrega por canal privado y **no está en este repositorio**) y crear la organización y el administrador.

Si hubiera que rehacerlo en otro proyecto: crear el proyecto en São Paulo → SQL Editor → pegar **todo** `supabase/01-esquema.sql` → Run → `select public.generar_codigo_alta();` → Authentication → Providers → desactivar «Confirm email» → cargar URL y clave publicable en `config.json` → `python3 assemble.py`. *(`supabase/90-reiniciar-para-entrega.sql` es destructivo: sólo para borrar datos de prueba y generar un código nuevo.)*

Para Google Drive: crear un *OAuth Client ID* web en Google Cloud (alcance mínimo `drive.file`), agregar el dominio del sitio como origen autorizado y cargar el identificador en `config.json` (`google_client_id`).

## Pruebas (carpeta `test/`)
Playwright + Chromium y un Postgres 16 local con un servidor simulado de Supabase (`test/shim.py`). Ejecutar: `sqltest.py` (esquema/RLS/concurrencia), `c1_cloud.py`, `c2_cloud.py` (dos equipos, offline, rechazos), `t1a…t1d_local.py` (flujos locales), `vocab.py` (vocabulario). Resultado de la entrega: 139 + 38 + 17 + 37 + 31 + 24 + 23 controles en verde.

## Límites declarados (honestidad)
- **Supabase real: sólo verificado en lectura** (el servidor responde, un visitante anónimo no lee tablas ni ejecuta funciones de administración, y las columnas de `auth.users`/`auth.identities` son compatibles con la creación de usuarios por SQL). El flujo completo (activar con el código, crear usuarios, sincronizar dos equipos) se probó con un servidor simulado; **la primera activación real es la prueba final** [VERIFICAR]. Google Drive real: sin probar.
- **Factura C simulada**: el CAE real requiere certificado de ARCA y servicio WSFE [VERIFICAR en arca.gob.ar]; no tiene validez fiscal.
- Importes en pesos (no en centavos enteros); conflictos de edición: gana la última escritura; el stock negativo se rechaza en la nube y se corrige con un ajuste.
- Sin cifrado campo a campo en la nube (la base local sí es AES-256-GCM); la cadena de auditoría es por equipo.
- Sin Mercado Pago, correo ni WhatsApp automático. Hardware (impresoras, lectores) sin probar. Instalador de Windows en pausa.
- Los textos legales y de consentimiento los debe revisar un asesor legal [VERIFICAR Ley 25.326].

Desarrollado por **VINCULAR BUSINESS** · (387) 4484132 · vincularbusiness@gmail.com · «Tu idea, en buenas manos.»
