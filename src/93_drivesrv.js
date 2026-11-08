/* ===== Google Drive de la organización por SERVIDOR (función «drive-legajos») · 2026-11-02 =====
   - Un administrador conecta el Drive de la organización UNA sola vez desde Integraciones.
     Desde ese momento cualquier equipo con permiso para cargar legajos crea carpetas, actualiza la hoja
     de legajos y sube documentos sin conectar nada.
   - El permiso de Google lo guarda el servidor (bóveda de Supabase). Este equipo nunca ve tokens de Google.
   - Si la función no está publicada o le faltan las credenciales, queda «Pendiente de configuración» y sigue
     disponible la conexión desde el navegador (ID de cliente). Nunca están las dos activas a la vez.
   - Una falla de esta función nunca marca la nube como caída (no toca el estado de sincronización). */
let DSRV={cargado:false,configurado:false,conectado:false,cuenta:'',raiz:'',hoja:'',ts:0,uid:null,err:'',vuelta:'',busy:false};
const drvSrvOn=()=>!!(CLOUD.on&&DSRV.conectado);
const drvSrvConf=()=>!!(CLOUD.on&&DSRV.configurado);
const DSRV_MAX=10*1024*1024;
async function drvSrv(accion,body,o){
 if(!CLOUD.on)throw new Error('Sin nube');
 for(let i=0;i<2;i++){
  try{return await chttp('/functions/v1/drive-legajos',{body:Object.assign({accion},body||{}),auth:true,timeout:(o&&o.timeout)||30000})}
  catch(e){
   if(e.offline){const x=new Error('Sin conexión con el servidor de Drive: queda pendiente en este equipo.');x.offline=true;throw x}
   if(i===0&&e.status===401){await cRefresh();continue}
   const b=e.body||{};const x=new Error(b.error||e.message||'Error del servidor de Drive');x.codigo=b.codigo||'';x.status=e.status;
   if(x.codigo==='reconectar'||x.codigo==='sin_conectar')DSRV.conectado=false;
   throw x}}}
async function drvSrvEstado(forzar){
 if(!CLOUD.on||!CL.tok||!SES)return DSRV;
 if(DSRV.uid!==CL.uid)forzar=true;
 if(!forzar&&DSRV.cargado&&now()-DSRV.ts<5*60000)return DSRV;
 const antes=JSON.stringify([DSRV.configurado,DSRV.conectado,DSRV.cuenta]);
 try{const r=await drvSrv('estado');
  Object.assign(DSRV,{configurado:!!r.configurado,conectado:!!r.conectado,cuenta:String(r.cuenta||'').slice(0,200),
   raiz:/^https:\/\/drive\.google\.com\//.test(r.raiz||'')?r.raiz:'',hoja:/^https:\/\/docs\.google\.com\//.test(r.hoja||'')?r.hoja:'',err:''})}
 catch(e){DSRV.configurado=false;DSRV.conectado=false;DSRV.err=String(e.message||e)}
 DSRV.cargado=true;DSRV.ts=now();DSRV.uid=CL.uid;
 if(DSRV.vuelta==='ok'&&DSRV.conectado&&S){audit('drive_conectado',{cuenta:DSRV.cuenta,modo:'servidor'});persist();DSRV.vuelta=''}
 if(antes!==JSON.stringify([DSRV.configurado,DSRV.conectado,DSRV.cuenta])&&typeof cRefreshSafe==='function')cRefreshSafe();
 return DSRV}
function blobB64(b){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).replace(/^data:[^,]*,/,''));r.onerror=()=>no(r.error);r.readAsDataURL(b)})}
/* carpeta del legajo por el servidor */
async function srvCarpeta(s){
 const r=await drvSrv('carpeta',{legajo:s.legajo,dni:s.doc||'',persona:legPersona(s)});
 if(!r||!r.ok||!/^[A-Za-z0-9_-]{10,120}$/.test(r.carpeta||''))throw new Error('El servidor no confirmó la carpeta.');
 srvFijarCarpeta(s,r.carpeta,r.url,r.creada);return{id:r.carpeta,webViewLink:carpetaUrl(s)}}
function srvFijarCarpeta(s,id,url,creada){
 if(s.driveId!==id||!s.drive){s.driveId=id;if(!s.drive)s.drive=/^https:\/\/drive\.google\.com\//.test(url||'')?url:'https://drive.google.com/drive/folders/'+encodeURIComponent(id);audit('drive_carpeta_legajo',{legajo:s.legajo,modo:'servidor',creada:!!creada})}}
/* carpeta + fila de la hoja en un solo pedido */
async function srvProvisionar(s){
 const r=await drvSrv('hoja',{legajo:s.legajo,dni:s.doc||'',persona:legPersona(s),fila:filaLegajo(s)});
 if(!r||!r.ok||!/^[A-Za-z0-9_-]{10,120}$/.test(r.carpeta||''))throw new Error('El servidor no confirmó la hoja de legajos.');
 srvFijarCarpeta(s,r.carpeta,r.url,false);if(/^https:\/\/docs\.google\.com\//.test(r.hoja||''))DSRV.hoja=r.hoja}
async function srvSubir(d,s,blob){
 if(blob.size>DSRV_MAX)throw new Error('Por el servidor se suben archivos de hasta 10 MB: este queda guardado en el equipo. Achicalo (por ejemplo, escaneo en menor resolución) y subilo de nuevo.');
 const r=await drvSrv('subir',{legajo:s.legajo,dni:s.doc||'',persona:legPersona(s),nombre:d.nombreDrive,mime:d.mime,tipo:d.tipo,version:d.version,hash:d.hash,b64:await blobB64(blob)},{timeout:180000});
 if(!r||!r.ok||!r.archivo||!r.archivo.id)throw new Error('Google no confirmó la subida.');
 if(/^[A-Za-z0-9_-]{10,120}$/.test(r.carpeta||''))srvFijarCarpeta(s,r.carpeta,r.carpetaUrl,false);
 return{id:r.archivo.id,webViewLink:r.archivo.url,repetido:!!r.repetido}}
/* ---------- conectar / desconectar (sólo administrador) ---------- */
A.drvSrvConectar=async()=>{
 if(!SES||SES.role!=='admin')return toast('Sólo un administrador conecta Google Drive');
 if(DSRV.busy)return;DSRV.busy=true;
 try{const r=await drvSrv('conectar');if(!r||!/^https:\/\/accounts\.google\.com\//.test(r.url||''))throw new Error('Respuesta inesperada del servidor.');
  audit('drive_conexion_iniciada',{modo:'servidor'});await flush();location.href=r.url}
 catch(e){toast(String(e.message||e),6000)}finally{DSRV.busy=false}};
A.drvSrvDesc=()=>confirmBox({title:'Desconectar Google Drive de la organización',msg:'Los equipos dejan de crear carpetas y subir documentos hasta que un administrador vuelva a conectar. Las carpetas y archivos que ya están en Drive no se borran.',ok:'Desconectar',danger:true,onOk:async()=>{
 try{await drvSrv('desconectar');Object.assign(DSRV,{conectado:false,cuenta:'',raiz:'',hoja:''});audit('drive_desconectado',{modo:'servidor'});persist();toast('Google Drive desconectado')}catch(e){toast(String(e.message||e),6000)}refresh()}});
A.drvSrvEstado=async()=>{await drvSrvEstado(true);toast(DSRV.conectado?'Conexión correcta'+(DSRV.cuenta?' ('+DSRV.cuenta+')':''):DSRV.configurado?'Configurado, sin conectar':'Pendiente de configuración');refresh()};
function drvSrvCard(){
 const adm=SES&&SES.role==='admin';
 const st=DSRV.conectado?'<span class="badge ok">Conectado</span>':'<span class="badge warn">Sin conectar</span>';
 let b='<p class="sub" style="margin:8px 0">El Drive de la organización se conecta <b>una sola vez</b>. Desde ahí cada equipo crea la carpeta de cada legajo, actualiza la hoja de legajos y sube los documentos sin conectar nada. El permiso es el mínimo (<code>drive.file</code>: sólo los archivos que crea el sistema) y lo guarda el servidor cifrado; ningún equipo ve claves de Google.</p>';
 if(DSRV.conectado){
  b+='<p class="sub">Cuenta: <b>'+esc(DSRV.cuenta||'—')+'</b></p><div class="row" style="margin-top:10px">'+(DSRV.raiz?'<a class="btn y sm" href="'+esc(DSRV.raiz)+'" target="_blank" rel="noopener noreferrer">'+ic('folder')+'Abrir la carpeta de legajos</a>':'')+(DSRV.hoja?'<a class="btn g sm" href="'+esc(DSRV.hoja)+'" target="_blank" rel="noopener noreferrer">'+ic('link')+'Abrir la hoja de legajos</a>':'')+'<button class="btn g sm" data-a="drvSrvEstado">Probar conexión</button>'+(adm?'<button class="btn g sm" data-a="drvSrvDesc">Desconectar</button>':'')+'</div>';
 }else{
  b+=adm?'<div class="row" style="margin-top:10px"><button class="btn y" data-a="drvSrvConectar"'+(DSRV.busy?' disabled':'')+'>'+ic('folder')+'Conectar Google Drive de la organización</button></div><p class="sub" style="margin-top:6px">Se abre Google: entrá con la cuenta de la organización y aceptá el acceso a Drive. Al terminar volvés solo al sistema.</p>'
   :'<p class="sub">Un administrador tiene que conectarlo una vez. Mientras tanto los documentos quedan guardados en este equipo como «pendientes de subir».</p>';
 }
 return '<div class="c s6"><div class="row"><h2 class="sp">Google Drive de la organización</h2>'+st+'</div>'+b+'</div>'}
/* ---------- vuelta desde Google (?drive=…) ---------- */
(function(){
 let m=null;try{m=/[?&]drive=([a-z_]+)/.exec(location.search||'')}catch(e){}
 if(!m)return;
 const k=m[1];const txt={ok:'Google Drive de la organización conectado. Desde ahora las carpetas y documentos se guardan solos.',cancelado:'Se canceló la conexión con Google.',vencido:'La conexión tardó demasiado: probá de nuevo.',
  sin_permiso_offline:'Google no entregó el permiso permanente. Probá de nuevo y aceptá todos los permisos.',sin_drive:'No se aceptó el permiso de Drive. Probá de nuevo y tildá el acceso a Google Drive.',error:'No se pudo completar la conexión con Google.'}[k]||'Conexión con Google terminada.';
 DSRV.vuelta=k;
 try{history.replaceState(null,'',location.pathname+(location.hash||'#/panel/socios'))}catch(e){}
 setTimeout(()=>{try{toast(txt+(SES?'':' Entrá al sistema para ver el estado.'),7000)}catch(e){}},1200)})();
/* ---------- estado y legajos pendientes, cada minuto ---------- */
let DSRV_LOTE=false;
setInterval(()=>{
 if(!CLOUD.on||!CL.tok||!SES||!S)return;
 drvSrvEstado(false).then(()=>{
  if(!drvSrvOn()||DSRV_LOTE||!mayo('socios','cargar'))return;
  const l=legajoPend().slice(0,10);if(!l.length)return;DSRV_LOTE=true;
  legajoLote(l).then(r=>{DSRV_LOTE=false;if(r.ok&&typeof cRefreshSafe==='function')cRefreshSafe()},()=>{DSRV_LOTE=false})})},60000);
function drvSrvKick(){if(CLOUD.on&&CL.tok&&SES&&!DSRV.cargado&&!DSRV.pidiendo){DSRV.pidiendo=true;drvSrvEstado(true).finally(()=>{DSRV.pidiendo=false})}}
