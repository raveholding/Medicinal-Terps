# Medicinal Terps · Sistema VB (v3.4)

Sistema de gestión de **Terpenos Medicinales – Asociación Civil** (Organización Cannábica Medicinal de Salta): sitio público + panel interno en **un solo `index.html`** (HTML5/PWA), con nube opcional en **Supabase (región São Paulo)**.

- Sitio: https://raveholding.github.io/Medicinal-Terps/
- Panel: botón «Acceso del equipo» (`#/acceso`).
- Vocabulario de ONG en toda la interfaz: *socios/pacientes, entrega, donación voluntaria, donación sugerida*.

## Novedades v3.4 (2026-11-08) · Caja completa y Club con tarjeta en el celular
- **Cobro completo:** una donación se registra con **varios medios a la vez** (*Dividir el pago*, botón «Resto», la suma tiene que cerrar al centavo). En efectivo el **importe recibido es obligatorio** (botón «Justo») y el **vuelto** se muestra grande en el cobro y en el comprobante.
- **Comprobante de cada cobro digital:** transferencia (banco/billetera, N.º de operación, fecha), débito/crédito (marca, últimos 4, autorización, cupón, cuotas) y QR (proveedor, ID). Un mismo comprobante no se usa dos veces (también lo controla el servidor) y **un número de tarjeta completo nunca se guarda**. Sin comprobante: lo autoriza un administrador con motivo, queda en **«Cobros a conciliar»** y se completa después (versión nueva, la entrega no cambia). No se pide el titular ordenante.
- **Operaciones de esta caja** (todas, con filtros y totales) y **expediente** de cada entrega: ítems con lote y ciclo, pagos con comprobante, movimientos que generó (stock, caja por medio y rubro, cuenta corriente, monedero, anulación) y auditoría. Abrirlo queda auditado.
- **Monedero (saldo a favor):** el socio carga dinero (entra a la caja por su medio, rubro «Cargas de monedero») y lo usa en sus entregas; anular la entrega devuelve el saldo; ajustes sólo del administrador con motivo. El servidor no deja gastar más saldo del que hay.
- **Club y fidelización:** pestañas *Sellar · Socios del Club · Avisos · Configuración*. **Niveles** Bronce/Plata/Oro por las donaciones de los últimos N días, con % sugerido opcional (se aplica con un toque y queda auditado). **Avisos por WhatsApp** (cumpleaños y saldo) sólo a quien aceptó mensajes. **Baja** que anonimiza (con historial) o elimina (sin historial), con confirmación por legajo.
- **Tarjeta del Club en el celular:** se genera en el celular al completar el formulario web (mayores de edad) o desde la ficha con un **enlace personal** para WhatsApp. Muestra un **QR y un código que cambian cada 2 minutos**; el mostrador sella por QR, código de 10 caracteres, DNI o etiqueta NFC (un sello por día, un solo uso por código). El celular ve sus sellos, nivel y saldo con `club_estado()` sin recibir datos personales. «Nueva tarjeta» anula la anterior. Imagen PNG para guardar.
- Migración **`supabase/06-cobro-club-monedero.sql`** (aditiva; se ejecuta después de 05).

## Novedades v3.3 (2026-11-02) · Google Drive de la organización por servidor
- **Se conecta una sola vez**: un administrador toca *Integraciones → Google Drive de la organización → Conectar* y entra con la cuenta de Google de la organización. Desde ahí **cualquier equipo** con permiso para cargar legajos crea la carpeta `Legajos · organización/{legajo}_{DNI|SD}`, actualiza la hoja de legajos y sube documentos (PDF y fotos de hasta 10 MB) sin conectar nada.
- El permiso de Google (*refresh token*) lo guarda el servidor **cifrado en la bóveda de Supabase** (`supabase/05-drive-oauth.sql`); ningún navegador ve tokens de Google. Permiso mínimo `drive.file` (sólo lo que crea el sistema) + correo de la cuenta.
- Función de servidor `supabase/functions/drive-legajos` (Edge Function, «Verify JWT» apagado porque valida la sesión adentro): el comercio y el rol salen de la sesión, nunca del pedido; operador (sólo ver) no sube; sólo el administrador conecta o desconecta; carpeta y archivo idempotentes (marca propia y huella SHA-256); fórmulas neutralizadas en la hoja.
- Si la función no está publicada o le faltan las credenciales, el sistema muestra «Pendiente de configuración» y queda la conexión desde el navegador (ID de cliente) como alternativa. Nunca están las dos activas a la vez.

### Puesta en marcha del Drive por servidor (una sola vez)
1. Google Cloud de la organización → *Pantalla de consentimiento OAuth*: app externa, URL de privacidad `https://raveholding.github.io/Medicinal-Terps/privacidad.html`, permisos `openid`, `email`, `.../auth/drive.file`; habilitar **Google Drive API** y **Google Sheets API**.
2. *Credenciales → ID de cliente OAuth → Aplicación web*: origen `https://raveholding.github.io`; URI de redireccionamiento `https://yhxeznyqkfmczpkjwgep.supabase.co/functions/v1/drive-legajos`.
3. Supabase → *Edge Functions → Secrets*: `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` (los carga la organización; **nunca** por chat ni correo). `ALLOWED_ORIGINS=https://raveholding.github.io` y `SITE_URL=https://raveholding.github.io/Medicinal-Terps` ya están.
4. En el sistema: *Integraciones → Conectar Google Drive de la organización*.

## Novedades v3.2 (2026-11-02) · menú público unificado de Sistema VB
- **Club** con la tarjeta modelo («Así se ve tu tarjeta», meta de sellos y beneficio), después del catálogo.
- **Dónde estamos** (mapa de Google que se carga sólo si se pide, dirección y «Cómo llegar»), **Reseñas** («Dejar mi reseña» con el enlace que cargue la organización y «Ver reseñas»; nunca reseñas inventadas) y **Redes** (Instagram, Facebook, TikTok, X, YouTube, sitio web y WhatsApp, con ícono, nombre y usuario). Se cargan en Administración → Datos de la organización.
- **Información legal** plegable: privacidad y datos personales, donaciones voluntarias, información sanitaria y REPROCANN, mayoría de edad, Club y Botón de arrepentimiento. Textos editables en Administración → Menú público; son plantillas a **confirmar con el asesor legal** [VERIFICAR].
- **Botón de arrepentimiento**: incluido y **apagado por defecto** (asociación civil); al encenderlo abre WhatsApp de la organización con el pedido redactado.
- **Política de privacidad pública** en `privacidad.html` (requisito de Google para habilitar la app de Drive), enlazada desde el pie y desde Información legal.
- Servidor: `supabase/03-menu-publico-redes-club.sql` aplicado el 2026-11-02 (el catálogo vivo también lleva redes, reseñas y la meta del Club).
- **Sin «Empezar de cero» en el sistema de la organización**: no aparece en Administración y el servidor no deja vaciar datos desde la app, ni a un administrador (`supabase/04-sin-vaciar-desde-la-app.sql`, aplicado el 2026-11-02). La función queda sólo para soporte desde el SQL Editor.

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
- Servidor: migración `supabase/02-cuenta-corriente-legajos-menu.sql` (aditiva e idempotente) aplicada en el proyecto **medicinal-terps** el 2026-10-22.

## Qué incluye
Socios y pacientes con legajo, ficha con carpeta de Drive y documentos, y cuenta corriente · REPROCANN y topes por persona · entrega con donación voluntaria y rubro obligatorio · Factura C **simulada** (sin CAE, sin validez fiscal) · caja con cierre sellado (SHA-256) · inventario con lotes/vencimientos y trazabilidad · club de sellos · trámites REPROCANN · historia clínica web + turnero (solicitudes) · planilla de cultivo · gastos · reportes · importar/exportar · menú público ES/EN con borrador, publicación y versiones · roles (administrador, mostrador, operador) · Google Drive opcional (planilla y respaldo cifrado) · bloqueo por inactividad · auditoría encadenada.

## Estado de la nube (Supabase, São Paulo)
Proyecto **medicinal-terps** (región sa-east-1) activo, con `supabase/01-esquema.sql` y `02-cuenta-corriente-legajos-menu.sql` aplicados (12 tablas con RLS), «Confirm email» y el registro libre de usuarios desactivados. `config.json` ya lleva la URL y la **clave publicable** (`sb_publishable_…`; nunca la clave secreta/`service_role`).

La organización y su administrador ya están creados (el código de alta se usó una sola vez y no está en este repositorio).

Si hubiera que rehacerlo en otro proyecto: crear el proyecto en São Paulo → SQL Editor → pegar **todo** `supabase/01-esquema.sql` → Run → pegar `supabase/02-cuenta-corriente-legajos-menu.sql` y `03-menu-publico-redes-club.sql` → Run → `select public.generar_codigo_alta();` → Authentication → Providers → desactivar «Confirm email» → cargar URL y clave publicable en `config.json` → `python3 assemble.py`. *(`supabase/90-reiniciar-para-entrega.sql` es destructivo: sólo para borrar datos de prueba y generar un código nuevo.)*

Para Google Drive: en la cuenta de Google Cloud **de la organización** crear un *ID de cliente OAuth* (aplicación web) con el origen autorizado `https://raveholding.github.io`, habilitar las APIs de Google Drive y Google Sheets, y cargar el ID en el sistema: **Integraciones → Google Drive → ID de cliente OAuth de Google** (sólo administrador; se sincroniza a todos los equipos). Después, «Conectar Google Drive». El ID es público (no es un secreto); nunca se cargan claves de cuentas de servicio en el sitio.

## Pruebas (carpeta `test/`)
Playwright + Chromium y un Postgres 16 local con un servidor simulado de Supabase (`test/shim.py`). Ejecutar: `sqltest.py` y `sqltest2.py` (esquema/RLS/concurrencia, migración 02), `c1_cloud.py`, `c2_cloud.py`, `c3_cloud.py` (dos equipos, offline, rechazos, cuenta corriente y documentos sincronizados), `t1a…t1d_local.py` (flujos locales), `t2_novedades.py` (catálogo, cuenta corriente, cultivo, legajo y documentos con Drive simulado), `vocab.py`. `c4_cliente.py` (sistema del cliente sin textos de demo, ID de Google), `t3_menu.py` (menú público unificado), `d1_drive_fn.py` (función `drive-legajos` contra la base local con Google falso: roles, state firmado, bóveda, carpeta/hoja/subida idempotentes, aislamiento, revocación) y `d2_drive_ui.py` (de punta a punta en el navegador, dos equipos). Para d1/d2 y c4 corre además `node test/drivefn_server.mjs` (puerto 54399). `sqltest3.py` (migración 06), `t4_cobro_club.py` (cobro, caja, monedero, niveles, tarjeta) y `c5_club_nube.py` (tarjeta del celular y monedero contra la nube local). Resultado v3.3 (2026-11-02): 140 + 34 + 40 + 15 + 17 + 14 + 37 + 31 + 24 + 23 + 59 + 23 + 57 + 26 controles en verde.

## Límites declarados (honestidad)
- **Supabase real: sólo verificado en lectura** (el servidor responde, un visitante anónimo no lee tablas ni ejecuta funciones de administración, y las columnas de `auth.users`/`auth.identities` son compatibles con la creación de usuarios por SQL). El flujo completo (activar con el código, crear usuarios, sincronizar dos equipos) se probó con un servidor simulado; **la primera activación real es la prueba final** [VERIFICAR]. Google Drive real: sin probar.
- **Factura C simulada**: el CAE real requiere certificado de ARCA y servicio WSFE [VERIFICAR en arca.gob.ar]; no tiene validez fiscal.
- Importes en pesos (no en centavos enteros); conflictos de edición: gana la última escritura; el stock negativo se rechaza en la nube y se corrige con un ajuste.
- Sin cifrado campo a campo en la nube (la base local sí es AES-256-GCM); la cadena de auditoría es por equipo.
- Sin Mercado Pago, correo ni WhatsApp automático (los avisos abren WhatsApp con el texto listo). Los comprobantes de cobro son «declarados por quien cobró»: nadie los verifica contra el banco. Sin Apple/Google Wallet (la tarjeta vive en el navegador del celular; si se borra, el local reenvía el enlace o emite una nueva). Hardware (impresoras, lectores) sin probar. Instalador de Windows en pausa.
- Google Drive por servidor: probado con una base real local y un **Google falso**; la conexión con la cuenta real de la organización es la prueba final [pendiente de credenciales]. Por el servidor se suben archivos de hasta 10 MB (los más grandes quedan pendientes en el equipo con aviso). La planilla de cultivo y el respaldo cifrado siguen usando la conexión desde el navegador. La app de Google en modo «Prueba» exige agregar la cuenta como usuario de prueba y su permiso puede vencer a los 7 días [VERIFICAR en la consola de Google]: para uso permanente, publicarla.
- El límite de cuenta corriente se controla en el mostrador (superarlo pide autorización de administrador con motivo); el servidor valida importes y persona, no el límite.
- Los textos legales y de consentimiento los debe revisar un asesor legal [VERIFICAR Ley 25.326].

Desarrollado por **VINCULAR BUSINESS** · (387) 4484132 · vincularbusiness@gmail.com · «Tu idea, en buenas manos.»
