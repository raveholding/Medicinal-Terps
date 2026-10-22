/* ===== Ficha del legajo: carpeta en Google Drive, hoja de legajos, formularios y «Documentos y escaneos» =====
   (correcciones de Cannabismatica 2026-10-20/22, SISTEMA_VB_ONGF 4.28)
   - UNA carpeta por legajo: «Legajos/{legajo}_{documento|SD}» dentro de la carpeta del sistema en el Drive de la organización.
     Se ubica por una marca propia (appProperties), nunca por el nombre: no se duplica ni se pisa.
   - Hoja «Legajos · {organización}»: una fila por legajo con identificación, estado de formularios y enlace a la carpeta.
     Los datos clínicos NO van a la hoja.
   - Documentos y escaneos: PDF o fotos (cámara del celular). Cada archivo va a la carpeta del legajo con nombre único
     (legajo, tipo, fecha, versión y huella SHA-256); nunca reemplaza uno anterior; queda registrado quién y cuándo.
     Si Google Drive no está conectado, el archivo queda guardado EN ESTE EQUIPO como «pendiente de subir» y se sube
     después. Nunca se informa «subido» sin la respuesta de Google.
   - Google exige que una persona de la organización autorice el acceso desde el navegador (permiso de la sesión).
     Sin identificador OAuth configurado todo queda «Pendiente de configuración» y nada se simula. */
let LGJ={id:null,busy:false,msg:'',bad:false};
const DOC_TIPOS=['Consentimiento informado','REPROCANN','Historia clínica','Receta','Estudio','DNI','Otro'];
const DOC_OK={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif'};
const DOC_MAX=20*1024*1024;
const legDoc=s=>{const d=String(s.doc||'').replace(/\D/g,'');return d.length>=6&&d.length<=11?d:'SD'};
const nombreCarpetaLegajo=s=>(s.legajo||'SIN-LEGAJO')+'_'+legDoc(s);
const carpetaUrl=s=>(s.drive&&/^https:\/\//.test(s.drive))?s.drive:(s.driveId?'https://drive.google.com/drive/folders/'+encodeURIComponent(s.driveId):'');
/* ---------- estado de los formularios del legajo ---------- */
function legajoForms(s){
 const f=[];if(!s.bday)f.push('fecha de nacimiento');if(!s.wa)f.push('WhatsApp');if(!s.email)f.push('correo');if(!s.domicilio)f.push('domicilio');if(!s.consentInf)f.push('consentimiento informado');
 const ing=f.length?{k:'pend',t:'Sin completar',falt:f}:{k:'ok',t:'Completo',falt:[]};
 const r=s.reprocann||{};const rp=!r.nro&&!r.venc?{k:'pend',t:'Sin cargar'}:(r.venc&&r.venc<today()?{k:'bad',t:'Vencido ('+fdate(r.venc)+')'}:(r.venc?{k:'ok',t:'Vigente hasta '+fdate(r.venc)}:{k:'rev',t:'En trámite (sin vencimiento)'}));
 return{ing,rp}}
/* ---------- Google Drive: carpetas y hoja (sobre la conexión de Integraciones) ---------- */
const DRVF='https://www.googleapis.com/drive/v3/files',SHEETS='https://sheets.googleapis.com/v4/spreadsheets';
const MIME_DIR='application/vnd.google-apps.folder',MIME_SHEET='application/vnd.google-apps.spreadsheet';
const qv=v=>String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
function drvConectado(){if(window.__driveMock)return driveOk();return driveOk()&&!!DRV.token&&DRV.exp>now()+30000}
async function drvList(q){const r=await drvFetch(DRVF+'?q='+encodeURIComponent(q)+'&fields='+encodeURIComponent('files(id,name,webViewLink)')+'&pageSize=20&spaces=drive');return (await r.json()).files||[]}
async function drvFolderKey(key,name,parent){
 const l=await drvList("mimeType='"+MIME_DIR+"' and trashed=false and appProperties has { key='vbtKey' and value='"+qv(key)+"' }");if(l.length)return l[0];
 const meta={name,mimeType:MIME_DIR,appProperties:{vbtKey:key,vbt:'1'}};if(parent)meta.parents=[parent];
 const r=await drvFetch(DRVF+'?fields=id,name,webViewLink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(meta)});return r.json()}
let LEGROOT=null,LEGHOJA=null;
async function legajosRoot(){if(LEGROOT)return LEGROOT;const sys=await drvEnsureFolder();LEGROOT=await drvFolderKey('legajos-raiz','Legajos',sys);return LEGROOT}
async function carpetaPaciente(s){
 const root=await legajosRoot();const cf=await drvFolderKey('legajo|'+s.legajo,nombreCarpetaLegajo(s),root.id);
 const url=cf.webViewLink&&/^https:\/\//.test(cf.webViewLink)?cf.webViewLink:'https://drive.google.com/drive/folders/'+encodeURIComponent(cf.id);
 if(s.driveId!==cf.id||!s.drive){s.driveId=cf.id;if(!s.drive)s.drive=url;audit('drive_carpeta_legajo',{legajo:s.legajo})}
 return cf}
const HOJA_COLS=['Legajo','Fecha de alta','Apellido y nombre','Documento','WhatsApp','Nacimiento','Origen','REPROCANN','Formulario de ingreso','Verificado','Carpeta del legajo','Actualizado'];
const celda=v=>{v=String(v==null?'':v);return /^[=+\-@\t\r]/.test(v)?"'"+v:v};
function filaLegajo(s){const f=legajoForms(s);return [s.legajo,s.created?fdate(dkey(s.created)):'',(s.apellido||'')+', '+(s.nombre||s.name||''),s.doc?docLabel(s.docTipo,s.doc):'Sin documento',s.wa||'',s.bday||'',s.origen||'',f.rp.t,f.ing.t+(f.ing.falt.length?' (falta: '+f.ing.falt.join(', ')+')':''),s.verificado===false?'no':'sí',carpetaUrl(s),''].map(celda)}
function huellaLegajo(s){const f=filaLegajo(s);f[11]='';return sha256s(JSON.stringify(f)).slice(0,12)}
async function hojaLegajos(){
 if(LEGHOJA)return LEGHOJA;const root=await legajosRoot();
 const l=await drvList("mimeType='"+MIME_SHEET+"' and trashed=false and appProperties has { key='vbtKey' and value='legajos-hoja' }");
 let h=l[0];
 if(!h){const nom='Legajos · '+String(S.org.brand||S.org.nameCom||'Organización').slice(0,80);
  const r=await drvFetch(DRVF+'?fields=id,name,webViewLink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nom,mimeType:MIME_SHEET,parents:[root.id],appProperties:{vbtKey:'legajos-hoja',vbt:'1'}})});h=await r.json();
  await drvFetch(SHEETS+'/'+encodeURIComponent(h.id)+'/values/A1:L1?valueInputOption=RAW',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:[HOJA_COLS]})})}
 LEGHOJA=h;if(h.webViewLink&&/^https:\/\//.test(h.webViewLink)&&driveCfg().hojaLegajos!==h.webViewLink){driveCfg().hojaLegajos=h.webViewLink}
 return h}
async function hojaUpsert(h,s){
 const f=filaLegajo(s);f[11]=fdt(now());const base=SHEETS+'/'+encodeURIComponent(h.id)+'/values/';
 const r=await drvFetch(base+'A:A');const v=(await r.json()).values||[];let i=-1;for(let k=1;k<v.length;k++)if(v[k][0]===s.legajo){i=k;break}
 if(i<0)await drvFetch(base+'A:L:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:[f]})});
 else await drvFetch(base+'A'+(i+1)+':L'+(i+1)+'?valueInputOption=RAW',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:[f]})})}
const sinCarpeta=s=>!carpetaUrl(s);
const sinHoja=s=>s.hojaH!==huellaLegajo(s);
function legajoPend(){return S.socios.filter(s=>s.legajo&&(sinCarpeta(s)||sinHoja(s)))}
let LGQ=Promise.resolve();
function legajoProvisionar(s){const pr=LGQ.then(async()=>{await carpetaPaciente(s);const h=await hojaLegajos();const hh=huellaLegajo(s);await hojaUpsert(h,s);s.hojaH=hh;s.hojaT=now();persist()});LGQ=pr.catch(()=>{});return pr}
async function legajoLote(lista){let ok=0,mal=0,ult='';for(const s of lista){try{await legajoProvisionar(s);ok++}catch(e){mal++;ult=String(e.message||e)}}return{ok,mal,ult}}
function drivePill(){return !driveReady()?'<span class="badge warn">Drive pendiente de configuración</span>':(drvConectado()?'<span class="badge ok">Drive conectado</span>':'<span class="badge">Drive sin conectar</span>')}
function legajoBanner(){
 const pend=legajoPend(),sc=S.socios.filter(sinCarpeta).length;let ni=0;for(const s of S.socios)if(legajoForms(s).ing.k!=='ok')ni++;
 const oper=mayo('socios','cargar'),hu=driveCfg().hojaLegajos&&/^https:\/\//.test(driveCfg().hojaLegajos)?driveCfg().hojaLegajos:'';
 return '<div class="c" style="margin-bottom:14px"><div class="row"><h2 class="sp">Legajos: carpetas y formularios</h2>'+drivePill()+'</div><div class="chips" style="margin-top:8px"><span class="badge '+(sc?'warn':'ok')+'">'+sc+' sin carpeta</span><span class="badge '+(ni?'warn':'ok')+'">'+ni+' con formulario de ingreso sin completar</span><span class="badge '+(pend.length?'warn':'ok')+'">'+pend.length+' pendiente(s) de Drive y hoja</span></div>'+
 '<p class="sub" style="margin:8px 0">Cada persona tiene un legajo único. Con Google Drive conectado, el sistema crea su carpeta (<b>Legajos/legajo_DNI</b>) y su fila en la hoja de legajos. Los datos clínicos no se copian a la hoja.</p>'+
 (LGJ.msg?'<div class="notice'+(LGJ.bad?' bad':'')+'" role="status"><span class="sp">'+esc(LGJ.msg)+'</span></div>':'')+
 '<div class="row">'+(oper&&pend.length?'<button class="btn y sm" data-a="legLote"'+(LGJ.busy?' disabled':'')+'>'+ic('folder')+(drvConectado()?'Procesar ':'Conectar Drive y procesar ')+pend.length+' legajo(s)</button>':'')+(hu?'<a class="btn g sm" href="'+esc(hu)+'" target="_blank" rel="noopener noreferrer">'+ic('link')+'Abrir la hoja de legajos</a>':'')+'</div>'+
 (driveReady()?'':'<p class="sub" style="margin-top:8px">Pendiente de configuración: falta el identificador OAuth de Google de la organización (Integraciones → Google Drive). Mientras tanto, cada carpeta se puede vincular a mano desde la ficha.</p>')+'</div>'}
async function drvAsegurar(){if(drvConectado())return;if(!driveReady())throw new Error('Pendiente de configuración: falta el identificador OAuth de Google de la organización.');await drvToken(true);const d=driveCfg();if(d.estado!=='conectado'){d.estado='conectado';persist()}}
A.legLote=async()=>{
 if(!mayo('socios','cargar')||LGJ.busy)return;const l=legajoPend();if(!l.length)return;
 LGJ.busy=true;LGJ.msg='Procesando '+l.length+' legajo(s)…';LGJ.bad=false;refresh();
 try{await drvAsegurar();const r=await legajoLote(l);LGJ.msg=r.ok+' legajo(s) con carpeta y fila en la hoja.'+(r.mal?' '+r.mal+' con error: '+r.ult:'');LGJ.bad=r.mal>0}
 catch(e){LGJ.msg=String(e.message||e);LGJ.bad=true}
 LGJ.busy=false;refresh()};
/* ---------- cola local de documentos (IndexedDB propia: el archivo no se pierde si Drive no está) ---------- */
const DOCDB='terps_docs'+String(location.pathname).replace(/\/[^\/]*$/,'').replace(/[^A-Za-z0-9_-]/g,'_');
function docDb(){return new Promise((ok,no)=>{try{const r=indexedDB.open(DOCDB,1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}catch(e){no(e)}})}
function docOp(modo,fn){return docDb().then(d=>new Promise((ok,no)=>{const tx=d.transaction('f',modo),r=fn(tx.objectStore('f'));tx.oncomplete=()=>{ok(r&&r.result);d.close()};tx.onerror=()=>{no(tx.error);d.close()}}))}
const docPut=(id,b)=>docOp('readwrite',st=>st.put(b,id)),docGet=id=>docOp('readonly',st=>st.get(id)),docDel=id=>docOp('readwrite',st=>st.delete(id));
async function blobHash(b){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer())))}
const limpioNom=x=>String(x||'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
let DOCBUSY=false;
async function docSubir(d){
 const s=socioById(d.socioId);if(!s)throw new Error('La persona ya no existe');
 if(!driveReady()&&!window.__driveMock)throw new Error('Drive pendiente de configuración: el archivo queda guardado en este equipo.');
 if(!drvConectado())throw new Error('Google Drive sin conectar: el archivo queda guardado en este equipo.');
 const blob=await docGet(d.id);if(!blob)throw new Error('El archivo pendiente ya no está en este equipo: subilo de nuevo.');
 const cf=await carpetaPaciente(s);
 const ya=await drvList("'"+qv(cf.id)+"' in parents and trashed=false and appProperties has { key='vbtHash' and value='"+qv(d.hash)+"' }");
 let f=ya[0];
 if(!f){const bd='----vbt'+d.hash.slice(0,16);const meta={name:d.nombreDrive,parents:[cf.id],mimeType:d.mime,appProperties:{vbt:'1',vbtHash:d.hash,vbtLegajo:s.legajo,vbtTipo:d.tipo.slice(0,40),vbtVersion:String(d.version)}};
  const body=new Blob(['--'+bd+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+bd+'\r\nContent-Type: '+d.mime+'\r\n\r\n',blob,'\r\n--'+bd+'--']);
  const r=await drvFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+bd},body});f=await r.json()}
 if(!f||!f.id)throw new Error('Google no confirmó la subida.');
 d.estado='subido';d.fileId=f.id;d.url=f.webViewLink&&/^https:\/\//.test(f.webViewLink)?f.webViewLink:'https://drive.google.com/file/d/'+encodeURIComponent(f.id)+'/view';d.subido=now();d.error='';
 audit('documento_legajo_subido',{legajo:s.legajo,tipo:d.tipo,version:d.version,huella:d.hash.slice(0,12)});persist();
 try{await docDel(d.id)}catch(e){}}
async function docsPendientes(sid){let ok=0,mal=0,ult='';for(const d of S.legDocs.filter(x=>x.estado==='pendiente'&&(!sid||x.socioId===sid))){try{await docSubir(d);ok++}catch(e){mal++;ult=String(e.message||e);d.error=ult}}if(mal)persist();return{ok,mal,ult}}
setInterval(()=>{if(DOCBUSY||!S||!SES||!Array.isArray(S.legDocs)||!drvConectado())return;if(!S.legDocs.some(d=>d.estado==='pendiente'))return;DOCBUSY=true;docsPendientes().then(r=>{DOCBUSY=false;if(r.ok&&LGJ.id)legajoOpen(LGJ.id)},()=>{DOCBUSY=false})},30000);
function docsHtml(s){
 const docs=S.legDocs.filter(d=>d.socioId===s.id).sort((a,b)=>b.ts-a.ts),oper=mayo('socios','cargar'),pend=docs.filter(d=>d.estado==='pendiente');
 const pill=d=>d.estado==='subido'?'<span class="badge ok">En Drive</span>':'<span class="badge warn" title="'+esc(d.error||'')+'">Pendiente de subir'+(d.dev===(DEV&&DEV.id)?' · guardado en este equipo':' · guardado en otro equipo')+'</span>';
 return '<div style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px"><div class="row"><h3 class="sp" style="font-size:15px">Documentos y escaneos ('+docs.length+')</h3>'+(oper?'<label class="btn y sm" for="docFile" style="cursor:pointer">'+ic('upload')+'Subir documento</label><input type="file" id="docFile" data-ch="docFile" data-id="'+esc(s.id)+'" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" class="sr"><label class="btn g sm" for="docCam" style="cursor:pointer">'+ic('qr')+'Escanear con la cámara</label><input type="file" id="docCam" data-ch="docFile" data-id="'+esc(s.id)+'" accept="image/*" capture="environment" class="sr">':'')+'</div>'+
 '<p class="sub" style="margin:6px 0">PDF o fotos, hasta 20 MB. Cada archivo va a la carpeta del legajo con nombre único; nunca reemplaza uno anterior. Queda registrado quién lo subió y cuándo.</p>'+
 (pend.length&&oper?'<div class="notice"><span class="sp">'+pend.length+' archivo(s) pendiente(s) de subir a Google Drive.</span><button class="btn g sm" data-a="docRetry" data-id="'+esc(s.id)+'">Subir ahora</button></div>':'')+
 (docs.length?'<div class="tw"><table><thead><tr><th>Fecha</th><th>Documento</th><th>Tipo</th><th>Versión</th><th>Subió</th><th>Estado</th><th></th></tr></thead><tbody>'+docs.map(d=>'<tr><td>'+fdt(d.ts)+'</td><td>'+esc(d.nombre)+'<div class="sub">'+esc(d.nombreDrive)+'</div></td><td>'+esc(d.tipo)+'</td><td>v'+esc(String(d.version))+'</td><td>'+esc(d.user)+'</td><td>'+pill(d)+'</td><td>'+(d.url&&/^https:\/\//.test(d.url)?'<a class="btn g sm" href="'+esc(d.url)+'" target="_blank" rel="noopener noreferrer">Abrir</a>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="sub">Todavía no hay documentos en este legajo.</p>')+'</div>'}
let DOCSEL=null;
CH.docFile=el=>{
 const f=el.files&&el.files[0],sid=el.dataset.id;el.value='';if(!f)return;if(!mayo('socios','cargar'))return toast('No tenés permiso para cargar documentos');
 const mime=f.type==='image/jpg'?'image/jpeg':f.type;if(!DOC_OK[mime])return toast('Sólo PDF o fotos (JPG, PNG, WEBP, HEIC).');if(!f.size)return toast('El archivo está vacío.');if(f.size>DOC_MAX)return toast('El archivo supera los 20 MB.');
 DOCSEL={blob:f,mime,sid,cam:el.id==='docCam'};
 modal('<h2>Guardar en el legajo</h2><p class="sub">'+esc(f.name||'Foto de la cámara')+' · '+Math.round(f.size/1024).toLocaleString('es-AR')+' KB</p><label for="dc_t">Tipo de documento</label><select id="dc_t"><option value="">— Elegí —</option>'+DOC_TIPOS.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select><label for="dc_d">Descripción (opcional)</label><input id="dc_d" maxlength="60" placeholder="Ej.: REPROCANN vigente 2029"><div class="row" style="margin-top:16px"><button class="btn y lg sp" data-a="docOk">Guardar</button><button class="btn g lg" data-a="docCancel">Cancelar</button></div>')};
A.docCancel=()=>{DOCSEL=null;if(LGJ.id)legajoOpen(LGJ.id);else closeModal()};
A.docOk=async()=>{
 const sel=DOCSEL,s=sel&&socioById(sel.sid);if(!s)return closeModal();const tipo=$('#dc_t').value;if(!DOC_TIPOS.includes(tipo))return toast('Elegí el tipo de documento');const desc=limpioNom($('#dc_d').value);
 DOCSEL=null;let h;try{h=await blobHash(sel.blob)}catch(e){return toast('No se pudo leer el archivo.')}
 const ya=S.legDocs.find(d=>d.socioId===s.id&&d.hash===h);if(ya){toast('Ese mismo archivo ya está en el legajo ('+fdate(dkey(ya.ts))+'). No se duplicó.');legajoOpen(s.id);return}
 const ver=S.legDocs.filter(d=>d.socioId===s.id&&d.tipo===tipo).length+1,ext=DOC_OK[sel.mime];
 const d={id:'DOC-'+uid(),socioId:s.id,dni:s.doc||'',legajo:s.legajo,nombre:desc||tipo,tipo,mime:sel.mime,ext,size:sel.blob.size,hash:h,version:ver,nombreDrive:s.legajo+'_'+limpioNom(tipo).replace(/\s+/g,'-')+'_'+today().replace(/-/g,'')+'_v'+ver+'_'+h.slice(0,8)+'.'+ext,ts:now(),user:SES.name,estado:'pendiente',origen:sel.cam?'cámara':'archivo',dev:DEV?DEV.id:''};
 try{await docPut(d.id,sel.blob)}catch(e){return toast('Este navegador no permite guardar el archivo en el equipo y Drive no está disponible: no se guardó nada.')}
 S.legDocs.push(d);audit('documento_legajo',{legajo:s.legajo,tipo,version:ver,huella:h.slice(0,12)});persist();
 try{await docSubir(d);toast('Documento guardado en la carpeta del legajo.')}catch(e){d.error=String(e.message||e);persist();toast(d.error,5000)}
 legajoOpen(s.id)};
A.docRetry=async el=>{if(DOCBUSY)return;DOCBUSY=true;try{await drvAsegurar();const r=await docsPendientes(el.dataset.id);toast(r.ok+' subido(s).'+(r.mal?' '+r.mal+' sin subir: '+r.ult:''),5000)}catch(e){toast(String(e.message||e),5000)}DOCBUSY=false;legajoOpen(el.dataset.id)};
/* ---------- carpeta del legajo ---------- */
function carpetaHtml(s){
 const u=carpetaUrl(s),oper=mayo('socios','cargar');
 let h='<div class="c" style="margin-top:12px;box-shadow:none;border:1px solid var(--line)"><div class="row"><h3 class="sp" style="font-size:16px">'+ic('folder')+' Carpeta del legajo · '+esc(s.legajo)+'</h3>'+drivePill()+'</div><p class="sub" style="margin:4px 0">Una sola carpeta por legajo: <b>'+esc(nombreCarpetaLegajo(s))+'</b> (documentos, imágenes, notas, recetas y estudios).</p>';
 if(u)h+='<div class="row" style="margin-top:8px"><a class="btn y sm" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+ic('link')+'Abrir carpeta del legajo</a><button class="btn g sm" data-a="rcCopy" data-v="'+esc(u)+'">'+ic('copy')+'Copiar enlace</button>'+(oper?'<button class="btn g sm" data-a="legVincular" data-id="'+esc(s.id)+'">Cambiar enlace</button>':'')+'</div>';
 else h+='<div class="notice" style="margin-top:8px"><span class="sp">Todavía no tiene carpeta.</span></div>'+(oper?'<div class="row"><button class="btn y sm" data-a="legCrear" data-id="'+esc(s.id)+'">'+ic('plus')+'Crear carpeta del legajo en Drive</button><button class="btn g sm" data-a="legVincular" data-id="'+esc(s.id)+'">Vincular una carpeta existente</button></div>':'');
 return h+docsHtml(s)+'</div>'}
A.legCrear=async el=>{const s=socioById(el.dataset.id);if(!s||!mayo('socios','cargar'))return;if(LGJ.busy)return;LGJ.busy=true;toast('Creando la carpeta del legajo en Drive…');
 try{await drvAsegurar();await legajoProvisionar(s);toast('Carpeta creada y vinculada al legajo.')}catch(e){toast(String(e.message||e),6000)}LGJ.busy=false;legajoOpen(s.id)};
A.legVincular=el=>{const s=socioById(el.dataset.id);if(!s)return;
 modal('<h2>Vincular carpeta de Google Drive</h2><p class="sub" style="margin:6px 0">Pegá el enlace de la carpeta del legajo <b>'+esc(s.legajo)+'</b> (https://drive.google.com/…). No se abre ni se copia nada: sólo se guarda el enlace.</p><label for="lv_u">Enlace</label><input id="lv_u" maxlength="300" value="'+esc(s.drive||'')+'" placeholder="https://drive.google.com/drive/folders/…"><div class="row" style="margin-top:14px"><button class="btn y lg sp" data-a="legVincOk" data-id="'+esc(s.id)+'">Guardar</button><button class="btn g lg" data-a="legBack" data-id="'+esc(s.id)+'">Cancelar</button></div>')};
A.legVincOk=el=>{const s=socioById(el.dataset.id);const u=($('#lv_u').value||'').trim();if(u&&!/^https:\/\/(drive|docs)\.google\.com\/[^\s"'<>]+$/i.test(u))return toast('El enlace tiene que ser de Google Drive (https://drive.google.com/…)');
 const m=u.match(/\/folders\/([A-Za-z0-9_-]{10,})/);audit('drive_carpeta_vinculada',{legajo:s.legajo,quito:!u});s.drive=u;s.driveId=m?m[1]:(u?'':'');persist();legajoOpen(s.id)};
A.legBack=el=>legajoOpen(el.dataset.id);
/* ---------- ficha completa ---------- */
function legajoOpen(id){
 const s=socioById(id);if(!s)return toast('La persona ya no existe');LGJ.id=id;
 const f=legajoForms(s),cls={ok:'ok',rev:'',pend:'warn',bad:'bad'},ed=ageOf(s.bday);
 const ent=S.sales.filter(x=>x.socioId===s.id).slice(-10).reverse();
 const html='<div class="row"><h2 class="sp">'+esc(s.name)+'</h2><button class="btn g sm" data-a="mclose" aria-label="Cerrar">'+ic('x')+'</button></div>'+
 '<p class="sub" style="margin:4px 0 8px">Legajo <b>'+esc(s.legajo)+'</b> · '+esc(docLabel(s.docTipo,s.doc))+(s.wa?' · WhatsApp '+esc(s.wa):'')+(ed!=null?' · '+ed+' años':'')+(s.verificado===false?' · <span class="badge warn">sin verificar</span>':'')+(s.posibleDuplicadoDe?' <span class="badge bad">posible duplicado</span>':'')+'</p>'+
 '<div class="row">'+(mayo('socios','cargar')?'<button class="btn g sm" data-a="legEdit" data-id="'+esc(s.id)+'">'+ic('edit')+'Editar ficha</button>':'')+(mayo('dispensar','cargar')?'<button class="btn g sm" data-a="legDisp" data-id="'+esc(s.id)+'">'+ic('cart')+'Dispensar</button>':'')+'<button class="btn g sm" data-a="socioCard" data-id="'+esc(s.id)+'">'+ic('qr')+'Carnet</button></div>'+
 '<div class="c" style="margin-top:12px;box-shadow:none;border:1px solid var(--line)"><h3 style="font-size:16px">Formularios del legajo</h3><div class="g2" style="margin-top:8px"><div><b>Formulario de ingreso</b><br><span class="badge '+cls[f.ing.k]+'">'+esc(f.ing.t)+'</span>'+(f.ing.falt.length?'<div class="sub">Falta: '+esc(f.ing.falt.join(', '))+'</div>':'')+'</div><div><b>REPROCANN</b><br><span class="badge '+cls[f.rp.k]+'">'+esc(f.rp.t)+'</span>'+(s.reprocann&&s.reprocann.nro?'<div class="sub">N° '+esc(s.reprocann.nro)+'</div>':'')+'</div></div>'+
 '<p class="sub" style="margin-top:8px">'+(s.hojaT&&s.hojaH===huellaLegajo(s)?'<span class="badge ok">En la hoja de legajos</span> · actualizada '+fdt(s.hojaT):'<span class="badge warn">Hoja de legajos pendiente de actualizar</span>')+'</p></div>'+
 (mayo('dispensar','ver')?ccHtml(s):'')+carpetaHtml(s)+
 (mayo('dispensar','ver')?'<div class="c" style="margin-top:12px;box-shadow:none;border:1px solid var(--line)"><h3 style="font-size:16px">Últimas entregas</h3>'+(ent.length?'<div class="list">'+ent.map(x=>'<div class="li"'+(x.voided?' style="opacity:.5;text-decoration:line-through"':'')+'><div><b>'+esc(x.fc?x.fc.num:x.n)+'</b> · '+fdt(x.t)+'<div class="sub">'+esc(x.items.map(i=>qty(i.qty,i.unit)+' '+i.name+(i.lote?' (lote '+i.lote+')':'')).join(', '))+(x.cu?' · ciclo '+esc(x.cu.codigo||x.cu.nombre):'')+'</div></div><b>'+money(x.total)+(ccOf(x)>0?'<div class="sub">a cuenta '+money(ccOf(x))+'</div>':'')+'</b></div>').join('')+'</div>':'<p class="sub">Sin entregas.</p>')+'</div>':'');
 modal(html,{wide:true,onClose:()=>{LGJ.id=null}})}
A.legajo=el=>legajoOpen(el.dataset.id);
A.legEdit=el=>{LGJ.id=null;socioForm(socioById(el.dataset.id))};
A.legDisp=el=>{const s=socioById(el.dataset.id);if(!s)return;LGJ.id=null;closeModal();POS=newPOS();POS.rec={kind:'paciente',socioId:s.id,nombre:s.name,docTipo:s.docTipo||'DNI',doc:s.doc||''};go('vender')};
/* todo alta nueva de persona (panel, web, importación) queda con legajo; si Drive está conectado se procesa sola en segundo plano */
setInterval(()=>{if(!S||!SES||LGJ.busy||!drvConectado()||!mayo('socios','cargar'))return;const l=legajoPend().slice(0,10);if(!l.length)return;LGJ.busy=true;legajoLote(l).then(r=>{LGJ.busy=false;if(r.mal){LGJ.msg='No se pudieron procesar '+r.mal+' legajo(s). '+r.ult;LGJ.bad=true}if(ROUTE.view==='socios')cRefreshSafe()},()=>{LGJ.busy=false})},20000);
function cRefreshSafe(){const m=$('#modal');if(m&&!m.hidden)return;const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;refresh()}
