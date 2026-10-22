# Medicinal Terps · Sistema VB (v3.1)

Sistema de gestión de **Terpenos Medicinales – Asociación Civil** (Organización Cannábica Medicinal de Salta): sitio público + panel interno en **un solo `index.html`** (HTML5/PWA), con nube opcional en **Supabase (región São Paulo)**.

- Sitio: https://raveholding.github.io/Medicinal-Terps/
- Panel: botón «Acceso del equipo» (`#/acceso`).
- Vocabulario de ONG en toda la interfaz: *socios/pacientes, entrega, donación voluntaria, donación sugerida*.

## Novedades v3.1 (2026-10-22)
- **Catálogo de productos al frente del menú público**: es la primera sección y el botón principal del encabezado. Mientras no se publique una versión del menú, el sitio muestra el catálogo vivo (sólo productos marcados «Publicar en el menú»; nunca costo, stock exacto ni datos de personas). Se puede desactivar en Administración → Menú público («Catálogo de productos siempre al frente»).
- **Cuenta corriente (fiado) de socios y pacientes**: una entrega puede quedar total o parcialmente a cuenta (F4 · Cuenta corriente) para una persona con ficha y un **límite** que asigna el administrador. El saldo se calcula siempre desde entregas y pagos (no hay un segundo saldo que se desfase). Pagos con medio y rubro obligatorios, recibo, anulación sólo por administrador (registro nuevo, no se borra). La caja separa *dinero recibido* de *a cuenta corriente*; el cierre sellado lo informa aparte. Filtro «Con deuda», aviso en Inicio y exportación «Cuentas corrientes».
- **Ficha del legajo**: una sola carpeta por legajo en Google Drive (`Legajos/{legajo}_{DNI}`), hoja «Legajos · organización» (una fila por legajo, sin datos clínicos), estado de formularios, filtros «Ingreso sin completar» y «Sin carpeta en Drive», procesamiento de pendientes en lote.
- **Documentos y escaneos**: subir PDF o fotos (o la cámara del celular) a la carpeta del legajo con nombre único (legajo, tipo, fecha, versión y huella SHA-256); nunca reemplaza uno anterior. Sin Drive conectado queda guardado en el equipo como «pendiente de subir» y se sube solo después.
- **Origen de cultivo en cada entrega** de producto de cultivo (ciclo activo obligatorio cuando hay ciclos) y en el comprobante; ciclos con **código único** `CU-aammdd-XXXXX`, **cantidad y variedad editables** con historial y motivo.
- **Banner del desarrollador** con botones reales de 48 px (WhatsApp · Llamar · Correo).
- **Sistema del cliente sin rastros de demo**: con la nube configurada no aparece ningún aviso de «datos de ejemplo», el alta inicial nace sin personas, productos ni ciclos de ejemplo, y la Factura C dice «pendiente de CAE» (no válida como factura hasta conectar ARCA).
- **ID de Google cargable desde el sistema** (Integraciones → Google Drive), sin tocar el código.
- **Aviso de versión nueva**: cada compilación lleva fecha y hora (Administración → «compilada …»); si se publica otra, el sistema muestra «Hay una versión nueva · Actualizar ahora» sin perder datos.
- Corrección: al dar de baja a una persona, su equipo se bloquea y borra la copia local aunque estuviera guardando en ese momento.
- Servidor: migración `supabase/02-cuenta-corriente-legajos-menu.sql` (aditiva e idempotente) aplicada en el proyecto **medicinal-terps** el 2026-10-22 (excepto la ampliación de `vaciar_datos`, ver límites).

## Qué incluye
Socios y pacientes con legajo, ficha con carpeta de Drive y documentos, y cuenta corriente · REPROCANN y topes por persona · entrega con donación voluntaria y rubro obligatorio · Factura C **simulada** (sin CAE, sin validez fiscal) · caja con cierre sellado (SHA-256) · inventario con lotes/vencimientos y trazabilidad · club de sellos · trámites REPROCANN · historia clínica web + turnero (solicitudes) · planilla de cultivo · gastos · reportes · importar/exportar · menú público ES/EN con borrador, publicación y versiones · roles (administrador, mostrador, operador) · Google Drive opcional (planilla y respaldo cifrado) · bloqueo por inactividad · auditoría encadenada.

## Estado de la nube (Supabase, São Paulo)
Proyecto **medicinal-terps** (región sa-east-1) activo, con `supabase/01-esquema.sql` y `02-cuenta-corriente-legajos-menu.sql` aplicados (12 tablas con RLS), «Confirm email» y el registro libre de usuarios desactivados. `config.json` ya lleva la URL y la **clave publicable** (`sb_publishable_…`; nunca la clave secreta/`service_role`).

La organización y su administrador ya están creados (el código de alta se usó una sola vez y no está en este repositorio).

Si hubiera que rehacerlo en otro proyecto: crear el proyecto en São Paulo → SQL Editor → pegar **todo** `supabase/01-esquema.sql` → Run → pegar `supabase/02-cuenta-corriente-legajos-menu.sql` → Run → `select public.generar_codigo_alta();` → Authentication → Providers → desactivar «Confirm email» → cargar URL y clave publicable en `config.json` → `python3 assemble.py`. *(`supabase/90-reiniciar-para-entrega.sql` es destructivo: sólo para borrar datos de prueba y generar un código nuevo.)*

Para Google Drive: en la cuenta de Google Cloud **de la organización** crear un *ID de cliente OAuth* (aplicación web) con el origen autorizado `https://raveholding.github.io`, habilitar las APIs de Google Drive y Google Sheets, y cargar el ID en el sistema: **Integraciones → Google Drive → ID de cliente OAuth de Google** (sólo administrador; se sincroniza a todos los equipos). Después, «Conectar Google Drive». El ID es público (no es un secreto); nunca se cargan claves de cuentas de servicio en el sitio.

## Pruebas (carpeta `test/`)
Playwright + Chromium y un Postgres 16 local con un servidor simulado de Supabase (`test/shim.py`). Ejecutar: `sqltest.py` y `sqltest2.py` (esquema/RLS/concurrencia, migración 02), `c1_cloud.py`, `c2_cloud.py`, `c3_cloud.py` (dos equipos, offline, rechazos, cuenta corriente y documentos sincronizados), `t1a…t1d_local.py` (flujos locales), `t2_novedades.py` (catálogo, cuenta corriente, cultivo, legajo y documentos con Drive simulado), `vocab.py`. `c4_cliente.py` (sistema del cliente sin textos de demo, ID de Google). Resultado v3.1 (2026-10-22): 143 + 34 + 40 + 17 + 17 + 14 + 37 + 31 + 24 + 23 + 59 controles en verde.

## Límites declarados (honestidad)
- **Supabase real: sólo verificado en lectura** (el servidor responde, un visitante anónimo no lee tablas ni ejecuta funciones de administración, y las columnas de `auth.users`/`auth.identities` son compatibles con la creación de usuarios por SQL). El flujo completo (activar con el código, crear usuarios, sincronizar dos equipos) se probó con un servidor simulado; **la primera activación real es la prueba final** [VERIFICAR]. Google Drive real: sin probar.
- **Factura C simulada**: el CAE real requiere certificado de ARCA y servicio WSFE [VERIFICAR en arca.gob.ar]; no tiene validez fiscal.
- Importes en pesos (no en centavos enteros); conflictos de edición: gana la última escritura; el stock negativo se rechaza en la nube y se corrige con un ajuste.
- Sin cifrado campo a campo en la nube (la base local sí es AES-256-GCM); la cadena de auditoría es por equipo.
- Sin Mercado Pago, correo ni WhatsApp automático. Hardware (impresoras, lectores) sin probar. Instalador de Windows en pausa.
- **`vaciar_datos` en el servidor no se actualizó** (el cambio contiene borrados y quedó sin confirmar): «Empezar de cero» en la nube no borra todavía los pagos de cuenta corriente ni los registros de documentos. Para completarlo, pegar en el SQL Editor sólo la función `vaciar_datos` de `supabase/02-cuenta-corriente-legajos-menu.sql`.
- Google Drive: la conexión es manual (ID de cliente OAuth cargado en Integraciones; el permiso dura la sesión del equipo); sin él, carpetas y documentos quedan «pendientes». Probado sólo con Drive simulado. La creación automática sin intervención requiere una cuenta de servicio y un proceso en el servidor [pendiente].
- El límite de cuenta corriente se controla en el mostrador (superarlo pide autorización de administrador con motivo); el servidor valida importes y persona, no el límite.
- Los textos legales y de consentimiento los debe revisar un asesor legal [VERIFICAR Ley 25.326].

Desarrollado por **VINCULAR BUSINESS** · (387) 4484132 · vincularbusiness@gmail.com · «Tu idea, en buenas manos.»
