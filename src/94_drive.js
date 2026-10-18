/* ===== Integraciones: Google Drive (opcional, por organización) ===== */
let DRV={token:'',exp:0,busy:false};
const driveCfg=()=>{const o=S.org;if(!o.drive)o.drive={estado:'desconectado',email:'',folderId:'',folderName:'',lastSync:0,lastErr:'',scope:''};return o.drive};
const DRV_SCOPE='https://www.googleapis.com/auth/drive.file';
const DRV_ST={desconectado:'Desconectado',conectando:'Esperando autorización',conectado:'Conectado',requiere:'Requiere volver a autorizar',error:'Con error'};
function driveReady(){return !!(CLOUD.gid||window.__driveMock)}
function driveOk(){const d=driveCfg();return d.estado==='conectado'||d.estado==='requiere'}
function driveBtnHtml(kind){return driveOk()?'<button class="btn g sm" data-a="drvUp" data-k="'+kind+'">'+ic('upload')+'Subir a Google Drive</button>':''}
function loadGIS(){return new Promise((res,rej)=>{if(window.google&&google.accounts&&google.accounts.oauth2)return res();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=()=>res();s.onerror=()=>rej(new Error('No se pudo cargar el servicio de Google'));document.head.appendChild(s)})}
async function drvToken(interactive){
 if(window.__driveMock)return window.__driveMock.token(interactive);
 if(DRV.token&&DRV.exp>now()+30000)return DRV.token;
 if(!interactive)throw new Error('reauth');
 await loadGIS();
 return new Promise((res,rej)=>{const tc=google.accounts.oauth2.initTokenClient({client_id:CLOUD.gid,scope:DRV_SCOPE,callback:r=>{if(r.error)return rej(new Error(r.error_description||r.error));DRV.token=r.access_token;DRV.exp=now()+(r.expires_in||3600)*1000;res(r.access_token)},error_callback:e=>rej(new Error((e&&e.type)||'cancelado'))});tc.requestAccessToken({prompt:driveCfg().estado==='conectado'?'':'consent'})})}
async function drvFetch(url,opt){const tok=await drvToken(false);const f=window.__driveMock?window.__driveMock.fetch:fetch;opt=Object.assign({},opt);opt.headers=Object.assign({Authorization:'Bearer '+tok},opt.headers||{});
 const r=await f(url,opt);if(r.status===401||r.status===403){const d=driveCfg();if(r.status===401){d.estado='requiere';DRV.token='';persist()}const e=new Error(r.status===401?'La autorización venció':'Google rechazó el permiso');e.status=r.status;throw e}
 if(!r.ok){const e=new Error('Google respondió '+r.status);e.status=r.status;throw e}return r}
A.drvConnect=async()=>{
 if(!driveReady())return toast('Falta cargar el identificador OAuth de Google (ver README): la conexión queda pendiente de configuración.',6000);
 const d=driveCfg();d.estado='conectando';d.lastErr='';refresh();
 try{await drvToken(true);const r=await drvFetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)');const j=await r.json();
  d.estado='conectado';d.email=(j.user&&j.user.emailAddress)||'';d.scope=DRV_SCOPE;d.lastErr='';audit('drive_conectado',d.email);persist();toast('Google Drive conectado')}
 catch(e){d.estado=d.email?'requiere':'desconectado';d.lastErr=String(e.message||e);audit('drive_error',d.lastErr);persist();toast('No se pudo conectar: '+d.lastErr,6000)}
 refresh()};
A.drvTest=async()=>{const d=driveCfg();try{if(!DRV.token&&!window.__driveMock)await drvToken(true);const r=await drvFetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');const j=await r.json();d.estado='conectado';d.email=(j.user&&j.user.emailAddress)||d.email;d.lastErr='';persist();toast('Conexión correcta ('+esc(d.email)+')')}catch(e){d.lastErr=String(e.message||e);if(d.estado==='conectado')d.estado='error';persist();toast('Falló la prueba: '+d.lastErr,6000)}refresh()};
A.drvOff=()=>confirmBox({title:'Desconectar Google Drive',msg:'Se corta la conexión y se revoca el permiso de esta app. Los archivos que ya están en tu Drive no se borran.',ok:'Desconectar',danger:true,onOk:async()=>{const d=driveCfg();try{if(window.__driveMock&&window.__driveMock.revoke)await window.__driveMock.revoke(DRV.token);else if(DRV.token&&window.google&&google.accounts&&google.accounts.oauth2)google.accounts.oauth2.revoke(DRV.token,()=>{})}catch(e){}
 DRV.token='';DRV.exp=0;Object.assign(d,{estado:'desconectado',email:'',folderId:'',folderName:'',lastErr:''});audit('drive_desconectado','');persist();toast('Google Drive desconectado');refresh()}});
async function drvEnsureFolder(){const d=driveCfg();if(d.folderId)return d.folderId;
 const name='Sistema VB · '+(S.org.brand||'Medicinal Terps');
 const r=await drvFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder'})});
 const j=await r.json();d.folderId=j.id;d.folderName=j.name||name;persist();return d.folderId}
async function drvUploadFile(name,mime,content,key){
 const hash=await sha256hex(typeof content==='string'?content:stable(content));S.driveLog=S.driveLog||{};const lg=S.driveLog[key]||{ver:0,hash:''};
 if(lg.hash===hash)return{same:true,name:lg.name};
 const folder=await drvEnsureFolder();const ver=lg.ver+1;const nm=name.replace('{v}','v'+ver);
 const bd='vb'+rndStr(12,LA);const meta=JSON.stringify({name:nm,parents:[folder]});
 const body='--'+bd+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+bd+'\r\nContent-Type: '+mime+'\r\n\r\n'+content+'\r\n--'+bd+'--';
 const r=await drvFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+bd},body});
 const j=await r.json();S.driveLog[key]={ver,hash,fileId:j.id,name:j.name||nm,t:now()};driveCfg().lastSync=now();driveCfg().lastErr='';
 audit('drive_subida',{archivo:j.name||nm});persist();return{same:false,name:j.name||nm}}
A.drvUp=async el=>{
 if(DRV.busy)return;DRV.busy=true;const b=el;if(b)b.disabled=true;
 try{
  if(el.dataset.k==='cultivo'){const cy=cultCy();if(!cy)return toast('No hay ciclo');
   const nm=(cy.nombre||'ciclo').replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g,'').trim().replace(/\s+/g,'-')+'_'+(cy.lote||'sin-lote')+'_'+today()+'_{v}.csv';
   const r=await drvUploadFile(nm,'text/csv',cultCsvText(),'cultivo:'+cy.id);toast(r.same?'Ya está en Drive y no cambió desde la última subida':'Subido a Drive: '+r.name,5000)}
  else if(el.dataset.k==='backup'){await flush();const bk=JSON.stringify({v:1,app:'sistema-vb-medicinal-terps',t:now(),cloud:!!CLOUD.on,meta:META,vault:await kvGet(vaultKey())});
   const r=await drvUploadFile('respaldo-cifrado_'+today()+'_{v}.terps','application/json',bk,'backup:'+today());S.lastBackup=now();toast(r.same?'Ya está en Drive y no cambió':'Respaldo cifrado subido: '+r.name,5000)}
 }catch(e){const d=driveCfg();d.lastErr=String(e.message||e);persist();toast(e.status===401?'La autorización de Google venció: volvé a conectar.':'No se pudo subir: '+d.lastErr,6000)}
 finally{DRV.busy=false;if(b)b.disabled=false;refresh()}};
A.drvBackup=el=>{el.dataset.k='backup';A.drvUp(el)};
VIEWS.integraciones={t:'Integraciones',r(){
 const d=driveCfg();const cl=CLOUD.on;
 const card=(h,st,body)=>'<div class="c s6"><div class="row"><h2 class="sp">'+h+'</h2>'+st+'</div>'+body+'</div>';
 return '<div class="ph"><div><h1>Integraciones</h1><span class="sub">Conexiones opcionales · ninguna se activa sola</span></div></div><div class="bento">'+
 card('Google Drive','<span class="badge '+(d.estado==='conectado'?'ok':d.estado==='error'||d.estado==='requiere'?'warn':'')+'">'+DRV_ST[d.estado]+'</span>',
  '<p class="sub" style="margin:8px 0">Subí la planilla de cultivo y respaldos cifrados a <b>tu propio</b> Google Drive. Sólo se pide el permiso mínimo (<code>drive.file</code>: la app ve únicamente los archivos que ella crea). Nunca recibimos tu contraseña de Google y el permiso no se guarda en el sistema.</p>'+
  (driveReady()?'':'<div class="notice">'+ic('alert')+'<span class="sp"><b>Pendiente de configuración:</b> falta el identificador OAuth de Google de esta organización (se carga una vez al armar el sistema).</span></div>')+
  (d.email?'<p class="sub">Cuenta: <b>'+esc(d.email)+'</b>'+(d.folderName?' · carpeta «'+esc(d.folderName)+'»':'')+'</p>':'')+(d.lastSync?'<p class="sub">Última subida: '+fdt(d.lastSync)+'</p>':'')+(d.lastErr?'<p class="sub bad-t">Último error: '+esc(d.lastErr)+'</p>':'')+
  '<div class="row" style="margin-top:12px">'+(d.estado==='desconectado'||d.estado==='conectando'?'<button class="btn y sm" data-a="drvConnect"'+(d.estado==='conectando'?' disabled':'')+'>Conectar Google Drive</button>':'<button class="btn g sm" data-a="drvTest">Probar conexión</button>'+(d.estado==='requiere'?'<button class="btn y sm" data-a="drvConnect">Volver a autorizar</button>':'')+'<button class="btn g sm" data-a="drvBackup">Subir respaldo cifrado</button><button class="btn g sm" data-a="drvOff">Desconectar</button>')+'</div>')+
 card('Nube (Supabase)','<span class="badge '+(cl?'ok':'')+'">'+(cl?'Conectada':'No configurada')+'</span>','<p class="sub" style="margin:8px 0">'+(cl?'Los equipos comparten datos casi al instante. '+(typeof cloudStatusText==='function'?esc(cloudStatusText()):''):'Sin nube, los datos viven cifrados sólo en este equipo y el sitio no puede recibir solicitudes. Se configura al armar el sistema (URL del proyecto y clave publicable).')+'</p>'+(cl&&typeof cloudRejHtml==='function'?'<div class="row" style="margin:8px 0"><button class="btn g sm" data-a="cloudNow">Sincronizar ahora</button></div>'+cloudRejHtml():''))+
 card('Factura C · ARCA','<span class="badge '+(S.org.facturaC?'warn':'')+'">'+(S.org.facturaC?'Simulada':'Apagada')+'</span>','<p class="sub" style="margin:8px 0">Los comprobantes dicen «Pendiente de CAE». El CAE real requiere certificado digital, relación de servicio WSFE y un servidor de firma [VERIFICAR en arca.gob.ar]. Hasta entonces <b>no tiene validez fiscal</b>.</p>')+
 card('Mercado Pago, correo y WhatsApp API','<span class="badge">No incluidos</span>','<p class="sub" style="margin:8px 0">Esta versión no cobra con Mercado Pago ni envía correos o mensajes automáticos. WhatsApp se abre con el texto preparado y lo manda una persona.</p>')+'</div>'}};
