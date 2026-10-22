/* ===== Nube (Supabase): ingreso, sincronización, usuarios, solicitudes y menú ===== */
/* Todo el código de este archivo sólo actúa si CLOUD.on (URL + clave publicable cargadas). */
const CL={on:false,tok:null,ref:null,pw:null,email:'',uid:null,tenant:null,offline:false,busy:false,again:false,dirty:true,pend:0,last:0,t15:null,tk:null,tInbox:0,syncing:false,refP:null,pubTry:0};
const CCOLS=['cats','rubros','products','socios','stockMoves','sales','ncs','pagos','legDocs','cashClosed','cnotes','gastos','tramites','staff','fichajes','ciclos','cregs','turnos','menuVersions','org','menuCfg','pubSnap','audit'];
const CSING={org:1,menuCfg:1,pubSnap:1};
const CMOD={cats:'inventario',products:'inventario',sales:'dispensar',ncs:'dispensar',pagos:'dispensar',legDocs:'socios',cashClosed:'caja',cnotes:'caja',gastos:'gastos',tramites:'tramites',staff:'personal',ciclos:'cultivo',cregs:'cultivo',turnos:'solic',socios:'socios',rubros:'admin',org:'admin',menuCfg:'admin',pubSnap:'admin',menuVersions:'admin'};
const CTOMB=new Set(['cats','products','socios','sales','cashClosed','gastos','tramites','staff','ciclos','cregs','turnos','menuVersions']);
const REJ_TXT={sin_permiso:'No tenés permiso para ese cambio.',stock_insuficiente:'Stock insuficiente en la nube: otro equipo ya lo usó. Corregilo con un ajuste de stock.',cierre_congelado:'Un cierre de caja sellado no se puede modificar.',entrega_congelada:'Una entrega registrada sólo se puede anular, no editar.',solo_anular:'Las entregas no se borran: se anulan.',solo_agregar:'Ese registro sólo admite altas nuevas.',producto_inexistente:'El producto de ese movimiento todavía no existe en la nube.',cantidad_invalida:'Cantidad o importe inválido.',dato_invalido:'Datos inválidos o demasiado grandes.',item_invalido:'Registro inválido.',coleccion_invalida:'Tipo de registro no admitido.',sin_borrado:'Los rubros no se borran: se desactivan.',legajo_requerido:'Falta el legajo.',legajo_agotado:'No se pudo asignar un legajo único.',error_interno:'Error interno del servidor; se reintentará.'};
const cErrTxt=m=>{m=String(m||'');const k=Object.keys({no_miembro:1,sin_permiso:1,ultimo_admin:1,email_en_uso:1,clave_debil:1,datos_invalidos:1,rol_invalido:1,no_existe:1,ya_resuelta:1,estado_invalido:1,codigo_invalido:1,ya_inicializado:1,demasiados_intentos:1,limite:1,no_disponible:1,lote_invalido:1}).find(x=>m.includes(x));
 return({no_miembro:'Tu usuario no está habilitado.',sin_permiso:'No tenés permiso para hacer eso.',ultimo_admin:'Tiene que quedar al menos un administrador activo.',email_en_uso:'Ese correo ya está en uso.',clave_debil:'La clave es débil: mínimo 8 caracteres, con letras y números.',datos_invalidos:'Revisá los datos ingresados.',rol_invalido:'Rol inválido.',no_existe:'No existe.',ya_resuelta:'La solicitud ya fue resuelta.',estado_invalido:'Estado inválido.',codigo_invalido:'El código de alta no es correcto.',ya_inicializado:'El sistema ya fue activado.',demasiados_intentos:'Demasiados intentos. Probá más tarde.',limite:'Demasiados envíos. Probá más tarde.',no_disponible:'El sistema todavía no está disponible.',lote_invalido:'Lote inválido.'})[k]||m||'Error'};

/* ---------- HTTP ---------- */
class CErr extends Error{constructor(m,o){super(m);Object.assign(this,o||{})}}
async function chttp(path,o){
 o=o||{};const h={apikey:CLOUD.key,'Content-Type':'application/json'};
 if(o.auth&&CL.tok)h.Authorization='Bearer '+CL.tok;
 const ac=new AbortController();const to=setTimeout(()=>ac.abort(),o.timeout||20000);let r,txt;
 try{r=await fetch(CLOUD.url+path,{method:o.method||'POST',headers:h,body:o.body==null?undefined:JSON.stringify(o.body),signal:ac.signal});txt=await r.text()}
 catch(e){throw new CErr('offline',{offline:true})}finally{clearTimeout(to)}
 let j=null;try{j=txt?JSON.parse(txt):null}catch(e){j=null}
 if(!r.ok){const m=(j&&(j.message||j.msg||j.error_description||j.error))||('HTTP '+r.status);throw new CErr(String(m),{status:r.status,code:j&&(j.code||j.error_code),body:j})}
 return j}
async function cRefresh(){
 if(CL.refP)return CL.refP;
 CL.refP=(async()=>{try{
  if(CL.ref){try{const j=await chttp('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:CL.ref}});cSetTok(j);return true}catch(e){if(e.offline)throw e;if(/ban/i.test(e.message))throw new CErr('baja',{baja:true})}}
  if(CL.pw&&CL.email){const j=await chttp('/auth/v1/token?grant_type=password',{body:{email:CL.email,password:CL.pw}});cSetTok(j);return true}
  throw new CErr('sesion',{sesion:true})}finally{CL.refP=null}})();
 return CL.refP}
function cSetTok(j){CL.tok=j.access_token;CL.ref=j.refresh_token||CL.ref}
async function rpc(fn,body,o){
 o=o||{};
 for(let intento=0;intento<2;intento++){
  try{return await chttp('/rest/v1/rpc/'+fn,{body:body||{},auth:!o.anon,timeout:o.timeout})}
  catch(e){
   if(e.offline)throw e;
   if(!o.anon&&/no_miembro/.test(e.message)){cloudBaja();throw e}
   if(!o.anon&&intento===0&&(e.status===401||/JWT|expired/i.test(e.message))){try{await cRefresh()}catch(x){if(x.baja){cloudBaja();throw x}throw x}continue}
   throw e}}}
async function crest(path){
 for(let i=0;i<2;i++){try{return await chttp('/rest/v1/'+path,{method:'GET',auth:true})}catch(e){if(e.offline)throw e;if(i===0&&(e.status===401||/JWT/i.test(e.message))){await cRefresh();continue}throw e}}}
function cloudBaja(){if(!S)return;lockApp('Tu acceso fue deshabilitado por un administrador. Los datos de este equipo se borraron.',true)}

/* ---------- huella y serialización ---------- */
const ridOf=(col,r)=>col==='menuVersions'?(r.ver!=null?String(r.ver):''):col==='audit'?(r.h||''):(CSING[col]?col:(r.id||''));
function cser(col,r){
 if(col==='pubSnap'||col==='menuVersions'){const o=Object.assign({},r);delete o.data;return o}
 return r}
function cfp(col,r){
 if(col==='products'){const o=Object.assign({},r);delete o.stock;return fp53(stable(o))}
 return fp53(stable(cser(col,r)))}
function cget(col){switch(col){case'cashClosed':return S.cash.closed;case'org':return S.org;case'menuCfg':return S.menuCfg;case'pubSnap':return S.pubSnap;default:return S[col]}}
function cset(col,v){switch(col){case'cashClosed':S.cash.closed=v;break;case'org':S.org=v;break;case'menuCfg':S.menuCfg=v;break;case'pubSnap':S.pubSnap=v;break;default:S[col]=v}}
const isAdmin=()=>!!SES&&SES.role==='admin';
function canPush(col){
 if(col==='audit')return true;
 if(col==='stockMoves')return mayo('dispensar','cargar')||mayo('inventario','cargar');
 if(col==='fichajes')return mayo('caja','cargar')||mayo('personal','cargar');
 if(col==='socios'||col==='cats'||col==='products'||col==='sales'||col==='ncs'||col==='cashClosed'||col==='cnotes'||col==='gastos'||col==='tramites'||col==='staff'||col==='ciclos'||col==='cregs'||col==='turnos'||col==='pagos'||col==='legDocs')return mayo(CMOD[col],'cargar');
 return isAdmin()}

/* ---------- aplicar lo que llega de la nube ---------- */
function cInit(){S.sync=Object.assign({cursor:null,fp:{},rej:[],epoch:0,init:false,pubVer:0},S.sync||{});if(!S.sync.fp)S.sync.fp={};if(!S.sync.rej)S.sync.rej=[]}
function cUnpushed(){const fp=S.sync.fp,o={};for(const m of S.stockMoves){if(fp['stockMoves:'+m.id]===undefined)o[m.pid]=r3((o[m.pid]||0)+m.delta)}return o}
function cApplyPage(rows){
 let changed=false;const fp=S.sync.fp;
 const maps={},rem={};
 const mapOf=col=>{if(maps[col])return maps[col];const m=new Map();const a=cget(col);for(let i=0;i<a.length;i++){const id=ridOf(col,a[i]);if(id)m.set(id,a[i])}return maps[col]=m};
 const unp=cUnpushed();
 const auditSet=rows.some(r=>r.col==='audit')?new Set(S.audit.map(e=>e.h)):null;
 const auditX=rows.some(r=>r.col==='audit')?new Set((S.auditX||[]).map(e=>e.h)):null;
 for(const row of rows){
  const col=row.col,id=row.id,key=col+':'+id,d=row.data;
  if(col==='tenantmeta'){if(d&&d.v&&S.hkey!==d.v){S.hkey=d.v;HK=null;changed=true}fp[key]='1';continue}
  if(!CCOLS.includes(col))continue;
  if(CSING[col]){
   if(row.deleted){if(col==='pubSnap'&&S.pubSnap){S.pubSnap=null;changed=true}delete fp[key];continue}
   const cur=cget(col);
   if(cur!=null&&fp[key]!==undefined&&fp[key]!==cfp(col,cur))continue;
   if(cur!=null&&fp[key]===undefined&&S.sync.init)continue;
   if(col==='pubSnap'&&cur&&cur.hash===d.hash&&cur.data)d.data=cur.data;
   if(stable(cser(col,cur||{}))!==stable(cser(col,d)))changed=true;
   cset(col,d);fp[key]=cfp(col,d);
   if(col==='pubSnap')S.sync.pubVer=Math.max(S.sync.pubVer||0,d.ver||0);
   continue}
  if(col==='audit'){
   if(!auditSet.has(id)&&!auditX.has(id)){S.auditX=S.auditX||[];S.auditX.push(d);auditX.add(id);changed=true;if(S.auditX.length>6000)S.auditX.splice(0,S.auditX.length-6000)}
   fp[key]='1';continue}
  const map=mapOf(col),loc=map.get(id);
  const dirty=loc?fp[key]!==cfp(col,loc):(fp[key]!==undefined);
  if(row.deleted){
   if(loc&&!dirty){(rem[col]=rem[col]||new Set()).add(id);map.delete(id);changed=true}
   if(!dirty)delete fp[key];continue}
  if(col==='products'){
   const pid=id;
   if(loc&&dirty){const ns=r3((d.stock||0)+(unp[pid]||0));if(loc.stock!==ns){loc.stock=ns;changed=true}continue}
   const rec=Object.assign({},d);rec.stock=r3((d.stock||0)+(unp[pid]||0));
   if(loc){if(stable(loc)!==stable(rec)){Object.assign(loc,rec);for(const k of Object.keys(loc))if(!(k in rec))delete loc[k];changed=true}}
   else{cget(col).push(rec);map.set(id,rec);changed=true}
   fp[key]=cfp(col,rec);continue}
  if(dirty)continue;
  let rec=d;
  if((col==='pubSnap'||col==='menuVersions')&&loc&&loc.data&&loc.hash===d.hash)rec=Object.assign({},d,{data:loc.data});
  if(loc){if(stable(loc)!==stable(rec)){const keep=loc;for(const k of Object.keys(keep))delete keep[k];Object.assign(keep,rec);changed=true}}
  else{cget(col).push(rec);map.set(id,rec);changed=true}
  fp[key]=cfp(col,rec)}
 for(const col of Object.keys(rem)){const ids=rem[col];cset(col,cget(col).filter(r=>!ids.has(ridOf(col,r))))}
 return changed}
async function cResetLocal(epoch){
 const sy={cursor:null,fp:{},rej:[],epoch,init:false,pubVer:0};
 S=blankState();S.org=orgDefaults();migrate();S.sync=sy;S.auditX=[];HK=null;
 if(typeof posReset==='function')posReset();
 await flush()}
async function cloudPull(retry){
 cInit();let since=S.sync.cursor||null,col='',id='',first=true,any=false,last=null;
 for(let page=0;page<600;page++){
  const r=await rpc('sync_pull',{p_since:since,p_col:col,p_id:id,p_limit:60,p_overlap:first?30:0});
  if(S.sync.epoch&&r.epoch!==S.sync.epoch){if(retry)throw new CErr('epoch');await cResetLocal(r.epoch);return cloudPull(true)}
  if(!S.sync.epoch)S.sync.epoch=r.epoch;
  const rows=r.rows||[];first=false;
  if(rows.length){if(cApplyPage(rows))any=true;const l=rows[rows.length-1];since=l.t;col=l.col;id=l.id;last=l.t}
  if(rows.length<60)break}
 if(last)S.sync.cursor=last;
 S.sync.init=true;
 if(any){await flush();cRefreshUI()}
 return any}
function cRefreshUI(){
 if(!S||ROUTE.n!=='panel')return;const m=$('#modal');if(m&&!m.hidden)return;const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;
 try{refresh()}catch(e){}}

/* ---------- subir lo local ---------- */
const CCOLN={stockMoves:'Movimiento de stock',sales:'Entrega',pagos:'Pago de cuenta corriente',legDocs:'Documento del legajo',socios:'Persona',products:'Producto',cats:'Categoría',cashClosed:'Cierre de caja',cnotes:'Nota de cierre',gastos:'Gasto',tramites:'Trámite',staff:'Personal',fichajes:'Fichaje',ciclos:'Ciclo de cultivo',cregs:'Registro de cultivo',turnos:'Turno',rubros:'Rubro',org:'Datos de la organización',menuCfg:'Menú público',pubSnap:'Menú publicado',menuVersions:'Versión del menú',ncs:'Nota de crédito',audit:'Auditoría'};
function cLabel(col,id){try{const a=CSING[col]?null:cget(col);const r=a&&a.find(x=>ridOf(col,x)===id);if(!r)return CCOLN[col]||col;if(col==='stockMoves'){const p=S.products.find(x=>x.id===r.pid);return(p?p.name:'Producto')+' · '+(r.reason||'')}return r.name||r.n||r.legajo||r.ident||r.motivo||r.type||CCOLN[col]||col}catch(e){return col}}
function cInitMoves(){
 const fp=S.sync.fp;const sum={};for(const m of S.stockMoves)sum[m.pid]=r3((sum[m.pid]||0)+m.delta);
 for(const p of S.products){if(p.service||fp['products:'+p.id]!==undefined)continue;const diff=r3((p.stock||0)-(sum[p.id]||0));
  if(Math.abs(diff)>0.0004&&!S.stockMoves.some(m=>m.id==='init_'+p.id)){S.stockMoves.push({id:'init_'+p.id,t:now(),pid:p.id,delta:diff,reason:'Saldo inicial (nube)',user:SES.name,dev:DEV?DEV.n:1})}}}
function cScan(){
 const fp=S.sync.fp,items=[],keys=new Set(),scanned=new Set();
 if(canPush('products')&&canPush('stockMoves'))cInitMoves();
 if(!(fp['tenantmeta:hkey'])&&isAdmin())items.push({col:'tenantmeta',id:'hkey',data:{v:S.hkey},f:'1',key:'tenantmeta:hkey'});
 for(const col of CCOLS){
  if(!canPush(col))continue;scanned.add(col);
  if(CSING[col]){const r=cget(col);if(!r)continue;const key=col+':'+col,f=cfp(col,r);keys.add(key);if(fp[key]!==f)items.push({col,id:col,data:cser(col,r),f,key});continue}
  for(const r of cget(col)){const id=ridOf(col,r);if(!id)continue;const key=col+':'+id;keys.add(key);const f=cfp(col,r);if(fp[key]!==f)items.push({col,id,data:cser(col,r),f,key})}}
 for(const key of Object.keys(fp)){
  const i=key.indexOf(':'),col=key.slice(0,i),id=key.slice(i+1);
  if(!scanned.has(col)||keys.has(key))continue;
  if(CTOMB.has(col))items.push({col,id,deleted:true,f:'-',key});else delete fp[key]}
 return items}
async function cloudPush(){
 cInit();const items=cScan();CL.pend=items.length;cChip();
 if(!items.length)return 0;
 let i=0,bad=0;const nr=[];
 while(i<items.length){
  let batch=[],bytes=0;
  while(i<items.length&&batch.length<150&&bytes<700000){const it=items[i];const b=it.deleted?30:JSON.stringify(it.data).length;if(batch.length&&bytes+b>900000)break;batch.push(it);bytes+=b;i++}
  const r=await rpc('sync_push',{p_items:batch.map(x=>x.deleted?{col:x.col,id:x.id,deleted:true}:{col:x.col,id:x.id,data:x.data})});
  const fp=S.sync.fp,by=new Map(batch.map(x=>[x.col+':'+x.id,x]));
  if(S.sync.epoch&&r.epoch&&r.epoch!==S.sync.epoch){await cResetLocal(r.epoch);return -1}
  for(const o of r.ok||[]){const k=o.col+':'+o.id,it=by.get(k);if(!it)continue;if(it.deleted)delete fp[k];else fp[k]=it.f;S.sync.rej=S.sync.rej.filter(x=>x.key!==k)}
  for(const o of r.rej||[]){const k=o.col+':'+o.id,it=by.get(k);if(!it)continue;
   if(o.reason==='error_interno'){bad++;continue}
   fp[k]=it.deleted?undefined:it.f;if(it.deleted)delete fp[k];
   S.sync.rej=S.sync.rej.filter(x=>x.key!==k);S.sync.rej.push({key:k,col:o.col,id:o.id,reason:o.reason,label:cLabel(o.col,o.id),t:now()});nr.push(o);bad++}
  CL.pend=items.length-i}
 if(S.sync.rej.length>100)S.sync.rej=S.sync.rej.slice(-100);
 await flush();
 if(nr.length){toast(nr.length+' cambio'+(nr.length>1?'s':'')+' no se pudo'+(nr.length>1?'ieron':'')+' guardar en la nube. Revisá Integraciones → Nube.',6000);
  const pids=nr.filter(o=>o.col==='stockMoves').length;if(pids){try{await cloudPull()}catch(e){}}}
 CL.pend=0;return items.length}

/* ---------- ciclo de sincronización ---------- */
async function cloudSync(){
 if(!CL.on||!S||!SES)return;
 if(CL.busy){CL.again=true;return}
 CL.busy=true;CL.syncing=true;cChip();
 try{
  const wasOff=CL.offline;
  if(!CL.tok)await cRefresh();
  await cloudPull();
  if(S.sync.init){const was=CL.dirty;CL.dirty=false;try{const n=await cloudPush();if(n===-1){CL.dirty=true}}catch(e){CL.dirty=true;throw e}}
  if(isAdmin()&&S.pubSnap&&(S.sync.pubVer||0)<S.pubSnap.ver){await cloudMenuPublish(S.pubSnap)}
  if(isAdmin()&&S.pubSnap&&!S.pubSnap.data)await cPubData();
  if(S.inbox&&mayo('solic','ver')&&(now()-CL.tInbox>60000||ROUTE.view==='solic')){CL.tInbox=now();await cloudInboxPull(true)}
  CL.offline=false;CL.last=now();CL.err='';
  if(wasOff)cRefreshUI()
 }catch(e){
  if(e.offline){CL.offline=true;CL.dirty=true}
  else if(e.baja){cloudBaja()}
  else if(e.sesion){CL.offline=true;CL.err='Sesión vencida: volvé a ingresar'}
  else if(e.message==='no_miembro'){}
  else{CL.err=cErrTxt(e.message);CL.dirty=true}
 }finally{CL.busy=false;CL.syncing=false;cChip();if(CL.again){CL.again=false;setTimeout(cloudSync,300)}}}
function cloudKick(){
 if(!CL.on||!S)return;CL.dirty=true;clearTimeout(CL.tk);CL.tk=setTimeout(cloudSync,1500)}
function cloudStart(){
 CL.on=true;CL.dirty=true;clearInterval(CL.t15);CL.t15=setInterval(()=>{if(!document.hidden)cloudSync()},15000);
 document.removeEventListener('visibilitychange',cVis);document.addEventListener('visibilitychange',cVis);
 window.removeEventListener('online',cloudKick);window.addEventListener('online',cloudKick);
 cloudSync()}
function cVis(){if(!document.hidden)cloudSync()}
function cloudStop(){
 CL.on=false;clearInterval(CL.t15);clearTimeout(CL.tk);CL.tok=null;CL.ref=null;CL.pw=null;CL.uid=null;CL.busy=false;CL.again=false;CL.pend=0;
 document.removeEventListener('visibilitychange',cVis);window.removeEventListener('online',cloudKick);cChip()}
function cloudStatusText(){
 if(!CLOUD.on||!CL.on)return'';
 if(CL.syncing)return'☁ Sincronizando…';
 if(CL.offline)return'☁ Sin conexión · '+(CL.pend||cPendCount())+' por subir';
 if(CL.err)return'☁ '+CL.err;
 if(S&&S.sync&&S.sync.rej&&S.sync.rej.length)return'☁ '+S.sync.rej.length+' cambio'+(S.sync.rej.length>1?'s':'')+' rechazado'+(S.sync.rej.length>1?'s':'');
 return'☁ Sincronizado'+(CL.pend?' · '+CL.pend+' por subir':'')}
function cPendCount(){try{return S&&S.sync?cScan().length:0}catch(e){return 0}}
function cChip(){const sy=$('#syncchip');if(sy)sy.textContent=cloudStatusText()}
function cloudRejHtml(){
 const l=(S&&S.sync&&S.sync.rej)||[];if(!l.length)return'';
 return '<div class="notice" style="margin-top:10px">'+ic('alert')+'<span class="sp"><b>Cambios que la nube rechazó</b> (quedaron sólo en este equipo)</span></div><div class="list" style="margin-top:8px">'+l.slice().reverse().map(x=>'<div class="li"><span><b>'+esc(x.label||x.col)+'</b> <span class="sub">'+esc(CCOLN[x.col]||x.col)+' · '+fdt(x.t)+'</span><div class="sub">'+esc(REJ_TXT[x.reason]||x.reason)+'</div></span><button class="btn g sm" data-a="rejDel" data-k="'+esc(x.key)+'">Descartar aviso</button></div>').join('')+'</div>'}
let SYNCM=false;
A.syncInfo=()=>{if(!CLOUD.on)return;SYNCM=true;modal('<h2>Estado de la nube</h2><p class="sub" style="margin:6px 0">'+esc(cloudStatusText())+'</p>'+cloudRejHtml()+'<div class="row" style="margin-top:14px"><button class="btn y sp" data-a="cloudNow">Sincronizar ahora</button><button class="btn g" data-a="mclose">Cerrar</button></div>');MOD.onClose=()=>{SYNCM=false}};
A.rejDel=el=>{S.sync.rej=S.sync.rej.filter(x=>x.key!==el.dataset.k);persist();if(SYNCM)A.syncInfo();refresh()};
A.cloudNow=async()=>{CL.dirty=true;await cloudSync();toast(CL.offline?'Sin conexión':'Sincronizado');refresh()};

/* ---------- ingreso, alta inicial, contraseña ---------- */
async function cMeta(){META=META&&META.v?META:((await kvGet(META_KEY))||{v:1,wraps:{},byEmail:{},prof:{},tenant:''});META.wraps=META.wraps||{};META.byEmail=META.byEmail||{};META.prof=META.prof||{};return META}
const cEmail=s=>String(s||'').trim().toLowerCase();
let CSTATE=null;
async function viewLoginCloud(){
 if(!CLOUD.on)return;
 if(CSTATE===null){CSTATE='?';authShell('<p class="sub">Conectando con la nube…</p>');
  try{const r=await rpc('estado_alta',{},{anon:true,timeout:9000});CSTATE=r&&!r.inicializado?(r.alta_disponible?'alta':'sinalta'):'ok'}catch(e){CSTATE='ok'}}
 const msg=SEC.msg?'<div class="notice" style="margin-bottom:12px">'+esc(SEC.msg)+'</div>':'';
 if(CSTATE==='alta'){
  authShell(msg+'<h1 style="font-size:22px">Activar el sistema</h1><p class="sub" style="margin:6px 0 4px">Es la primera vez. Ingresá el <b>código de alta</b> que te entregó '+esc(RAVE.name)+' y creá el administrador de la organización.</p>'+
   '<label for="sc_c">Código de alta</label><input id="sc_c" autocomplete="off" maxlength="30" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase"><label for="sc_o">Nombre de la organización</label><input id="sc_o" maxlength="100" value="'+esc(orgDefaults().nameLegal)+'"><label for="sc_n">Tu nombre</label><input id="sc_n" autocomplete="name" maxlength="60"><label for="sc_e">Tu correo (es tu usuario)</label><input id="sc_e" type="email" autocomplete="username" maxlength="80"><label for="sc_p">Contraseña (mínimo 8, con letras y números)</label><input id="sc_p" type="password" autocomplete="new-password"><label for="sc_p2">Repetir contraseña</label><input id="sc_p2" type="password" autocomplete="new-password">'+
   '<div id="sc_x" class="bad-t" style="min-height:20px;margin-top:6px"></div><button class="btn y lg" style="width:100%" data-a="cloudSetup">Activar</button><p class="sub" style="margin-top:10px">Los datos viajan cifrados (HTTPS) y quedan en la nube de la organización y cifrados en cada equipo. Si perdés la contraseña, el soporte puede asignarte una temporal.</p>');return}
 if(CSTATE==='sinalta'){authShell(msg+'<h1 style="font-size:22px">Sistema sin activar</h1><p class="sub" style="margin:8px 0">Todavía no está activado. Pedile el código de alta a '+esc(RAVE.name)+' ('+esc(RAVE.tel)+').</p><a class="btn g" href="#/">Volver al sitio</a>');return}
 authShell(msg+'<h1 style="font-size:22px">Acceso del equipo</h1><label for="li_u">Correo</label><input id="li_u" type="email" autocomplete="username" maxlength="80" value="'+esc(SEC.lastUser||'')+'"><label for="li_p">Contraseña</label><input id="li_p" type="password" autocomplete="current-password"><div id="li_e" class="bad-t" style="min-height:20px;margin-top:6px"></div><button class="btn y lg" style="width:100%" data-a="cloudLogin">Ingresar</button><p class="sub" style="margin-top:12px">¿Olvidaste la contraseña? Pedile a un administrador una temporal, o escribinos por <a href="'+esc(waUrl(RAVE.wa,'Hola, necesito ayuda para ingresar al sistema de Medicinal Terps'))+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>.</p><p class="sub" style="margin-top:8px"><a href="#/">Volver al sitio</a></p>')}
A.cloudSetup=async()=>{
 const g=i=>$('#'+i).value;const code=g('sc_c').toUpperCase().replace(/[^A-Z0-9]/g,''),org=g('sc_o').trim(),n=g('sc_n').trim(),em=cEmail(g('sc_e')),p=g('sc_p');
 if(code.length<10||!org||!n)return showErr('sc_x','Completá el código, la organización y tu nombre.');
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return showErr('sc_x','El correo no es válido.');
 if(!passOk(p))return showErr('sc_x','La contraseña necesita 8 caracteres o más, con letras y números.');
 if(p!==g('sc_p2'))return showErr('sc_x','Las contraseñas no coinciden.');
 showErr('sc_x','Activando…');
 try{await rpc('setup_primer_admin',{p_codigo:code,p_org:org,p_nombre:n,p_email:em,p_pass:p},{anon:true})}
 catch(e){return showErr('sc_x',e.offline?'Sin conexión: no se pudo activar.':cErrTxt(e.message))}
 CSTATE='ok';
 const r=await cloudLogin(em,p,true);if(!r.ok)showErr('sc_x',r.msg)};
A.cloudLogin=async()=>{
 SEC.msg='';const em=cEmail($('#li_u').value),pw=$('#li_p').value;SEC.lastUser=em;
 if(!em||!pw)return showErr('li_e','Completá correo y contraseña.');
 META=await cMeta();META.lock=META.lock||{};const lk=META.lock[em]||{n:0,until:0};
 if(lk.until>now())return showErr('li_e','Demasiados intentos. Esperá '+Math.ceil((lk.until-now())/1000)+' s.');
 showErr('li_e','Verificando…');
 const r=await cloudLogin(em,pw,false);
 if(!r.ok){if(r.bad){lk.n++;lk.until=lk.n>=5?now()+Math.min(900000,15000*Math.pow(2,lk.n-5)):0;META.lock[em]=lk;await saveMeta()}return showErr('li_e',r.msg+(r.bad&&lk.until?' Bloqueado '+Math.ceil((lk.until-now())/1000)+' s.':''))}
 META.lock[em]={n:0,until:0};await saveMeta()};
async function cOpenLocal(uid,pw,mk){
 /* abre (o crea) la base cifrada local de este usuario; devuelve true si se abrió la existente */
 const w=META.wraps[uid];let raw=null,reopened=false;
 if(w){try{raw=await unwrapDK(pw,w)}catch(e){raw=null}}
 if(raw){DK=await dkFrom(raw);const v=await kvGet('vault:'+uid);
  if(v){try{S=JSON.parse(td.decode(await aesD(DK,v)));reopened=true}catch(e){S=null}}}
 if(!reopened){raw=rnd(32);DK=await dkFrom(raw);META.wraps[uid]=await wrapDK(pw,raw);S=mk();await kvDel('vault:'+uid)}
 HK=null;return reopened}
async function cloudLogin(email,pw,first){
 META=await cMeta();CL.pw=pw;CL.email=email;
 let j;
 try{j=await chttp('/auth/v1/token?grant_type=password',{body:{email,password:pw}})}
 catch(e){
  if(e.offline){
   const uid=META.byEmail[email];
   if(!uid||!META.wraps[uid]||first)return{ok:false,msg:'Sin conexión: la primera vez en este equipo necesitás internet.'};
   let raw;try{raw=await unwrapDK(pw,META.wraps[uid])}catch(x){return{ok:false,bad:true,msg:'Correo o contraseña incorrectos.'}}
   DK=await dkFrom(raw);const v=await kvGet('vault:'+uid);
   try{S=JSON.parse(td.decode(await aesD(DK,v)))}catch(x){return{ok:false,msg:'No se pudo abrir la base de este equipo.'}}
   const pf=META.prof[uid]||{};HK=null;migrate();cInit();
   SES={uid,name:pf.name||email,role:pf.role||'operador',user:email,perms:pf.perms||{},cloud:true};CL.uid=uid;CL.offline=true;
   audit('login','sin conexión');startLockTimer();cloudStart();location.hash='#/panel/'+homeFor();route();return{ok:true}}
  if(/ban/i.test(e.message))return{ok:false,msg:'Tu acceso está deshabilitado. Consultá con un administrador.'};
  if(e.status===400||e.status===401||e.status===422)return{ok:false,bad:true,msg:'Correo o contraseña incorrectos.'};
  return{ok:false,msg:'No se pudo ingresar ('+esc(e.message)+').'}}
 cSetTok(j);CL.uid=j.user&&j.user.id;
 let pf;
 try{pf=await rpc('mi_perfil',{})}catch(e){CL.tok=null;CL.pw=null;return{ok:false,msg:/no_miembro/.test(e.message)?'Tu usuario no está habilitado en esta organización.':cErrTxt(e.message)}}
 const uid=pf.user_id;CL.uid=uid;CL.tenant=pf.tenant;
 if(META.tenant&&META.tenant!==pf.tenant.id){for(const u of Object.keys(META.wraps))await kvDel('vault:'+u);META.wraps={};META.byEmail={};META.prof={}}
 META.tenant=pf.tenant.id;
 const reopened=await cOpenLocal(uid,pw,()=>{const s=first?seedState():blankState();if(!first)s.org=orgDefaults();return s});
 META.byEmail[email]=uid;META.prof[uid]={name:pf.nombre,role:pf.rol,perms:pf.perms||{}};await saveMeta();
 SES={uid,name:pf.nombre,role:pf.rol,user:email,perms:pf.perms||{},cloud:true};
 migrate();cInit();
 if(first){S.sync.init=true;S.sync.epoch=pf.tenant.epoch}
 try{const n=await rpc('equipo_alta',{p_dev:DEV.id,p_etiqueta:(navigator.platform||'equipo').slice(0,40)});if(n&&DEV.n!==n){DEV.n=n;if(first||!reopened){DEV.seq={}}devSave()}}catch(e){}
 audit('login','');startLockTimer();await flush();
 cloudStart();
 if(pf.must_change){forceChange({id:uid});return{ok:true}}
 location.hash='#/panel/'+homeFor();route();return{ok:true}}
async function cloudChangeOwnPass(p){
 try{await chttp('/auth/v1/user',{method:'PUT',auth:true,body:{password:p}})}
 catch(e){if(e.offline)return{ok:false,msg:'Necesitás conexión para cambiar la contraseña.'};
  if(e.status===401){try{await cRefresh();await chttp('/auth/v1/user',{method:'PUT',auth:true,body:{password:p}})}catch(x){return{ok:false,msg:'La sesión venció. Ingresá de nuevo.'}}}
  else return{ok:false,msg:/same|different|igual/i.test(e.message)?'Elegí una contraseña distinta a la anterior.':/weak|short|characters/i.test(e.message)?'La contraseña es muy débil.':'No se pudo cambiar: '+e.message}}
 try{await rpc('clave_cambiada',{})}catch(e){}
 const raw=new Uint8Array(await crypto.subtle.exportKey('raw',DK));META.wraps[SES.uid]=await wrapDK(p,raw);await saveMeta();CL.pw=p;
 return{ok:true}}

/* ---------- usuarios (sólo administradores) ---------- */
async function cloudUserList(){const l=await rpc('admin_listar',{});return(l||[]).map(u=>Object.assign({user:u.email,mustChange:u.must_change},u))}
const cloudUserCreate=o=>rpc('admin_crear_usuario',{p_email:o.email,p_nombre:o.name,p_rol:o.role,p_pass:o.pass});
const cloudUserReset=(id,p)=>rpc('admin_reset_clave',{p_user:id,p_pass:p});
const cloudUserActive=(id,a)=>rpc('admin_set_activo',{p_user:id,p_activo:!!a});
const cloudUserPerms=(id,p)=>rpc('admin_set_perms',{p_user:id,p_perms:p});
async function cloudWipeData(){
 const ep=await rpc('vaciar_datos',{});
 cInit();S.sync.epoch=ep;S.sync.fp={};S.sync.cursor=null;S.sync.rej=[];S.sync.pubVer=0;S.sync.init=true;return ep}

/* ---------- solicitudes web ---------- */
async function cloudInboxPull(silent){
 const l=await rpc('inbox_list',{});S.inbox=S.inbox||{};const before=inboxPending();
 for(const x of l||[]){const cur=S.inbox[x.id];
  if(cur&&cur.pendRes){continue}
  S.inbox[x.id]={id:x.id,tipo:x.tipo,t:x.t,payload:x.payload,estado:x.estado,nota:x.nota||'',socioId:x.socioId||'',resT:x.resT||0,resBy:cur?cur.resBy:''}}
 for(const x of Object.values(S.inbox)){if(x.pendRes&&CL.on){try{await cloudInboxResolve(x.id,x.estado,x.nota||'');x.pendRes=false}catch(e){}}}
 await flush();
 const after=inboxPending();if(silent&&after>before)toast('Llegó una nueva solicitud web',5000);
 if(silent&&after!==before)cRefreshUI()}
async function cloudInboxResolve(id,estado,nota){
 const x=S.inbox&&S.inbox[id];
 await rpc('inbox_resolve',{p_id:id,p_estado:estado,p_nota:nota||'',p_socio:(x&&x.socioId)||null})}

/* ---------- menú público ---------- */
async function cloudMenuPublish(snap){
 await rpc('menu_publicar',{p_data:snap.data,p_ver:snap.ver,p_hash:snap.hash});
 cInit();S.sync.pubVer=snap.ver}
async function cPubData(){
 try{const l=await crest('menus?select=hash,data&limit=1');const m=l&&l[0];if(m&&S.pubSnap&&m.hash===S.pubSnap.hash){S.pubSnap.data=m.data}}catch(e){}}
async function cloudMenuVerData(ver){
 const l=await crest('menus_versiones?select=data&ver=eq.'+encodeURIComponent(ver)+'&limit=1');return l&&l[0]?l[0].data:null}
async function cloudLoadPublic(){
 if(S)return;
 try{const d=await rpc('menu_publico',{},{anon:true,timeout:12000});
  if(d&&d.products){PUB=Object.assign({},d);if(!PUB.ts)PUB.ts=now()}else{PUB=Object.assign({},PUB,{ts:now()})}
  if(!S&&(ROUTE.n==='home'||ROUTE.n==='p'))route()}
 catch(e){if((CL.pubTry=(CL.pubTry||0)+1)<4)setTimeout(cloudLoadPublic,4000);else{PUB=Object.assign({},PUB,{ts:now()});if(!S&&(ROUTE.n==='home'||ROUTE.n==='p'))route()}}}
