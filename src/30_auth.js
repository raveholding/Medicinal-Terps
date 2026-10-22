/* ===== Modal, avisos, teclado numérico, ingreso al sistema ===== */
let MOD={},CF=null,NP=null,AK=null;
function modal(html,o){o=o||{};const m=$('#modal');m.innerHTML='<div class="mb'+(o.wide?' wide':'')+'" role="dialog" aria-modal="true">'+html+'</div>';m.hidden=false;MOD=o;
 if(!o.nofocus&&!document.body.classList.contains('touch')){const f=m.querySelector('[autofocus],input:not([type=hidden]):not([type=checkbox]):not([type=file]),textarea,select');if(f)setTimeout(()=>{try{if(!m.contains(document.activeElement)||document.activeElement===m)f.focus()}catch(e){}},30)}}
function closeModal(){const m=$('#modal');if(!m)return;m.hidden=true;m.innerHTML='';const cb=MOD.onClose;MOD={};NP=null;CF=null;AK=null;if(cb)cb()}
function toast(msg,ms){const b=$('#toastbox');const d=document.createElement('div');d.className='toast';d.textContent=msg;b.appendChild(d);setTimeout(()=>d.remove(),ms||2600)}
A.mclose=()=>closeModal();
function confirmBox(o){modal('<h2>'+esc(o.title||'¿Confirmás?')+'</h2><p style="margin:10px 0 18px">'+(o.html||esc(o.msg||''))+'</p><div class="row"><button class="btn '+(o.danger?'bad':'y')+' lg sp" data-a="cfOk" autofocus>'+esc(o.ok||'Confirmar')+'</button><button class="btn g lg" data-a="mclose">Cancelar</button></div>');CF=o}
A.cfOk=()=>{const f=CF&&CF.onOk;closeModal();if(f)f()};
function askText(o){modal('<h2>'+esc(o.title)+'</h2><label for="askv">'+esc(o.label||'Motivo')+'</label><textarea id="askv" maxlength="300" placeholder="'+esc(o.ph||'')+'" autofocus></textarea><div class="row" style="margin-top:16px"><button class="btn y lg sp" data-a="askOk">'+esc(o.ok||'Aceptar')+'</button><button class="btn g lg" data-a="mclose">Cancelar</button></div>');AK=o}
A.askOk=()=>{const v=($('#askv').value||'').trim();if(AK.required!==false&&!v){toast('Escribí el motivo');return}const f=AK.onOk;closeModal();f(v)};
/* teclado numérico en pantalla */
function numpad(o){NP={v:(o.initial==null||o.initial==='')?'':String(o.initial).replace('.',','),first:true,dec:o.dec!==false,ok:o.ok,title:o.title||'Número',unit:o.unit||'',max:o.max};npRender()}
function npRender(){
 const keys=['1','2','3','4','5','6','7','8','9',NP.dec?',':'','0','⌫'];
 modal('<h2>'+esc(NP.title)+'</h2><div class="npv'+(NP.v?'':' empty')+'" id="npv">'+(NP.v?esc(NP.v)+(NP.unit?' <small style="font-size:18px;margin-left:6px">'+esc(NP.unit)+'</small>':''):'Escribí el número')+'</div><div class="npd">'+keys.map(k=>k?'<button type="button" data-a="np" data-k="'+k+'">'+k+'</button>':'<span></span>').join('')+'</div><div class="row"><button class="btn g sp" data-a="np" data-k="C">Borrar todo</button><button class="btn g sp" data-a="mclose">Cancelar</button><button class="btn y sp" data-a="np" data-k="OK">Listo</button></div>',{nofocus:true})}
function npKey(k){
 if(!NP)return;
 if(k==='OK'){const n=parseNum(NP.v);if(isNaN(n)){toast('Escribí el número');return}const f=NP.ok,rv=NP.v;closeModal();f(n,rv);return}
 if(k==='C'){NP.v='';NP.first=false}
 else if(k==='⌫'){NP.v=NP.v.slice(0,-1);NP.first=false}
 else if(k===','){if(!NP.dec)return;if(NP.first)NP.v='';NP.first=false;if(!NP.v)NP.v='0';if(!NP.v.includes(','))NP.v+=','}
 else{if(NP.first){NP.v='';NP.first=false}if(NP.v.replace(/\D/g,'').length>10)return;NP.v+=k}
 npRender()}
A.np=el=>npKey(el.dataset.k);
/* ---------- sesión y permisos ---------- */
let LASTACT=0,TMLOCK=null;
const ROLES={admin:'Administrador',mostrador:'Mostrador',operador:'Operador'};
const LV={none:0,ver:1,cargar:2,gestionar:3};
const LVN={none:'Sin acceso',ver:'Sólo ver',cargar:'Cargar',gestionar:'Gestionar'};
/* módulos del sistema (clave → nombre); el servidor aplica la misma matriz */
const MODS={dispensar:'Dispensar',caja:'Caja',socios:'Socios y pacientes',tramites:'Trámites REPROCANN',cultivo:'Planilla de cultivo',inventario:'Inventario y lotes',gastos:'Gastos',personal:'Personal',solic:'Solicitudes web',reportes:'Reportes',datos:'Importar / Exportar',admin:'Administración'};
const DEFPERM={mostrador:{dispensar:'cargar',caja:'cargar',socios:'cargar',tramites:'cargar',cultivo:'ver',solic:'ver'},operador:{tramites:'cargar',cultivo:'cargar',socios:'ver'}};
function lvl(m){if(!SES)return'none';if(SES.role==='admin')return'gestionar';const o=(SES.perms||{})[m];if(o&&LV[o]!=null)return o;return(DEFPERM[SES.role]||{})[m]||'none'}
const mayo=(m,l)=>LV[lvl(m)]>=LV[l||'ver'];
const can=(...r)=>!!SES&&(SES.role==='admin'||r.includes(SES.role));
function bumpAct(){LASTACT=now()}
function startLockTimer(){bumpAct();clearInterval(TMLOCK);TMLOCK=setInterval(()=>{if(!S)return;const m=(S.org.lockMin||10)*60000;if(now()-LASTACT>m){lockApp('Sesión bloqueada por inactividad.')}},5000)}
async function lockApp(msg,wipe){
 if(typeof cloudStop==='function')cloudStop();
 try{await flush()}catch(e){}
 S=null;DK=null;HK=null;const old=SES;SES=null;SEC.msg=msg||'';closeModal();
 if(wipe&&old&&old.uid){await kvDel('vault:'+old.uid);if(META&&META.wraps){delete META.wraps[old.uid];await saveMeta()}}
 if(typeof posReset==='function')posReset();location.hash='#/acceso';route()}
function logout(){audit('logout','');lockApp('Sesión cerrada.')}
const normUser=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,'');
const META_KEY=CLOUD.on?'cmeta':'meta';
async function saveMeta(){await kvSet(META_KEY,META)}
function authShell(inner){root.className='';root.innerHTML='<div class="auth"><div class="c"><div class="row" style="margin-bottom:14px"><span class="logo" style="width:56px;height:56px;border-radius:18px"><img alt="" src="'+ASSETS.logo+'"></span><div><h2>Medicinal Terps</h2><span class="sub">Sistema VB · gestión</span></div></div>'+inner+'<div style="margin-top:18px">'+vbBanner('440px')+'</div><p class="sub" style="margin-top:10px;text-align:center"><small>Desarrollado por <b>'+esc(RAVE.name)+'</b> · WhatsApp <a href="https://wa.me/'+esc(RAVE.wa)+'" target="_blank" rel="noopener noreferrer">'+esc(RAVE.tel)+'</a> · '+esc(RAVE.mail)+'</small></p><p style="text-align:center;margin-top:6px"><a href="#/" class="sub">← Volver al sitio</a></p></div></div>'}
function viewSetup(){
 authShell('<h1 style="font-size:22px">Primer ingreso</h1><p class="sub" style="margin:6px 0 4px">Creá el administrador. Los datos se guardan cifrados (AES-256) en este equipo. <b>Si perdés la contraseña y el código de recuperación, los datos no se pueden recuperar.</b></p>'+
 '<label for="su_n">Tu nombre</label><input id="su_n" autocomplete="name" maxlength="60"><label for="su_u">Usuario</label><input id="su_u" autocomplete="username" maxlength="30" placeholder="ej: admin"><label for="su_p">Contraseña (mínimo 8)</label><input id="su_p" type="password" autocomplete="new-password"><label for="su_p2">Repetir contraseña</label><input id="su_p2" type="password" autocomplete="new-password"><div id="su_e" class="bad-t" style="margin-top:8px;min-height:20px"></div><button class="btn y lg" style="width:100%;margin-top:8px" data-a="doSetup">Crear organización y entrar</button><p style="text-align:center;margin-top:10px"><button class="btn g sm" data-a="restoreBk">Ya tengo una copia: restaurar</button></p>')}
function viewLogin(){
 if(CLOUD.on)return viewLoginCloud();
 authShell((SEC.msg?'<div class="notice" style="margin-bottom:12px">'+esc(SEC.msg)+'</div>':'')+'<h1 style="font-size:22px">Acceso del equipo</h1><label for="li_u">Usuario</label><input id="li_u" autocomplete="username" maxlength="30" value="'+esc(SEC.lastUser||'')+'"><label for="li_p">Contraseña</label><input id="li_p" type="password" autocomplete="current-password"><div id="li_e" class="bad-t" style="margin-top:8px;min-height:20px"></div><button class="btn y lg" style="width:100%;margin-top:6px" data-a="doLogin">Entrar</button><p style="margin-top:14px;text-align:center"><button class="btn g sm" data-a="forgot">Olvidé mi contraseña</button> <button class="btn g sm" data-a="restoreBk">Restaurar copia</button></p>');}
function showErr(id,m){const e=$('#'+id);if(e)e.textContent=m}
A.doSetup=async()=>{
 const n=$('#su_n').value.trim(),u=normUser($('#su_u').value),p=$('#su_p').value,p2=$('#su_p2').value;
 if(!n||!u)return showErr('su_e','Completá nombre y usuario.');
 if(p.length<8)return showErr('su_e','La contraseña debe tener al menos 8 caracteres.');
 if(p!==p2)return showErr('su_e','Las contraseñas no coinciden.');
 showErr('su_e','Creando…');
 const raw=rnd(32);DK=await dkFrom(raw);S=seedState();HK=null;
 const user={id:uid(),name:n,user:u,role:'admin',wrap:await wrapDK(p,raw),mustChange:false,active:true,created:now()};
 const rc=recCode();
 META={v:2,users:[user],rec:await wrapDK(rc.replace(/-/g,''),raw),lock:{},created:now()};
 await saveMeta();SES={uid:user.id,name:n,role:'admin',user:u};audit('setup','Organización creada');await flush();startLockTimer();
 showRecovery(rc,true)};
function showRecovery(rc,first){
 modal('<h2>Código de recuperación</h2><p class="sub" style="margin:8px 0 14px">Se muestra <b>una sola vez</b>. Anotalo o descargalo y guardalo en un lugar seguro: es la única forma de abrir los datos si se pierde la contraseña.</p><div class="rc" id="rcv">'+esc(rc)+'</div><div class="row" style="margin:14px 0"><button class="btn g sm" data-a="rcCopy" data-v="'+esc(rc)+'">'+ic('copy')+'Copiar</button><button class="btn g sm" data-a="rcDl" data-v="'+esc(rc)+'">'+ic('download')+'Descargar .txt</button><button class="btn g sm" data-a="rcPrint">'+ic('print')+'Imprimir</button></div><label style="display:flex;gap:10px;align-items:center;font-size:14px;color:var(--ink)"><input type="checkbox" id="rcok"> Ya guardé el código en un lugar seguro</label><button class="btn y lg" style="width:100%;margin-top:14px" data-a="rcDone" data-f="'+(first?1:0)+'">Continuar</button><div class="printable" style="display:none"></div>',{sticky:true})}
A.rcCopy=async el=>{try{await navigator.clipboard.writeText(el.dataset.v);toast('Copiado')}catch(e){toast('No se pudo copiar')}};
A.rcDl=el=>download('codigo-recuperacion-medicinal-terps.txt','Código de recuperación — Medicinal Terps\n\n'+el.dataset.v+'\n\nGuardalo en un lugar seguro. Sin contraseña ni código no se pueden recuperar los datos.\n'+RAVE.name+' · '+RAVE.tel+' · '+RAVE.mail+'\n','text/plain');
A.rcPrint=()=>{const p=$('#prbox');p.style.display='block';p.innerHTML='<h2>Medicinal Terps · Código de recuperación</h2><p style="font:700 22px monospace;margin:20px 0">'+esc($('#rcv').textContent)+'</p><p>Guardalo en un lugar seguro. '+esc(RAVE.name)+' · '+esc(RAVE.tel)+'</p>';window.print();p.style.display='none'};
const homeFor=()=>(mayo('dispensar','ver')?'dashboard':(mayo('tramites','ver')?'tramites':(mayo('cultivo','ver')?'cultivo':'dashboard')));
A.rcDone=el=>{if(!$('#rcok').checked){toast('Marcá que guardaste el código');return}closeModal();location.hash='#/panel/dashboard';route()};
A.doLogin=async()=>{
 SEC.msg='';
 const un=normUser($('#li_u').value),pw=$('#li_p').value;SEC.lastUser=un;
 const u=META.users.find(x=>x.user===un&&x.active!==false);
 const lkId=u?u.id:'_';META.lock=META.lock||{};const L=META.lock[lkId]||{n:0,until:0};
 if(L.until>now())return showErr('li_e','Demasiados intentos. Esperá '+Math.ceil((L.until-now())/1000)+' s.');
 showErr('li_e','Verificando…');
 let raw=null;
 try{if(!u)throw 0;raw=await unwrapDK(pw,u.wrap)}catch(e){
  L.n++;L.until=L.n>=5?now()+Math.min(900000,15000*Math.pow(2,L.n-5)):0;META.lock[lkId]=L;await saveMeta();
  if(!u)await kdf(pw,rnd(16));
  return showErr('li_e','Usuario o contraseña incorrectos.'+(L.until?' Bloqueado '+Math.ceil((L.until-now())/1000)+' s.':''))}
 META.lock[lkId]={n:0,until:0};await saveMeta();
 try{DK=await dkFrom(raw);const v=await kvGet('vault');S=JSON.parse(td.decode(await aesD(DK,v)));HK=null}catch(e){return showErr('li_e','No se pudo abrir la base de datos de este equipo.')}
 migrate();SES={uid:u.id,name:u.name,role:u.role,user:u.user,perms:u.perms||{}};audit('login','');startLockTimer();
 if(u.mustChange){forceChange(u);return}
 location.hash='#/panel/'+homeFor();route()};
function forceChange(u){modal('<h2>Elegí tu contraseña</h2><p class="sub" style="margin:6px 0">Estás usando una clave temporal. Definí la tuya (mínimo 8 caracteres, con letras y números).</p><label for="fc1">Nueva contraseña</label><input id="fc1" type="password" autocomplete="new-password"><label for="fc2">Repetir</label><input id="fc2" type="password" autocomplete="new-password"><div id="fc_e" class="bad-t" style="min-height:20px;margin-top:6px"></div><button class="btn y lg" style="width:100%" data-a="fcOk" data-id="'+(u?u.id:'')+'">Guardar y entrar</button>',{sticky:true})}
const passOk=p=>p.length>=8&&/[A-Za-z]/.test(p)&&/\d/.test(p);
A.fcOk=async el=>{const a=$('#fc1').value,b=$('#fc2').value;if(!passOk(a))return showErr('fc_e','Mínimo 8 caracteres, con letras y números.');if(a!==b)return showErr('fc_e','No coinciden.');
 if(CLOUD.on){const r=await cloudChangeOwnPass(a);if(!r.ok)return showErr('fc_e',r.msg);audit('clave','Cambio de contraseña propia');closeModal();location.hash='#/panel/'+homeFor();route();return}
 await setUserPass(el.dataset.id,a,false);audit('clave','Cambio de contraseña propia');closeModal();location.hash='#/panel/'+homeFor();route()};
async function setUserPass(id,pass,must){const u=META.users.find(x=>x.id===id);const raw=new Uint8Array(await crypto.subtle.exportKey('raw',DK));u.wrap=await wrapDK(pass,raw);u.mustChange=!!must;META.lock&&(META.lock[id]={n:0,until:0});await saveMeta()}
A.forgot=()=>{modal('<h2>Recuperar acceso</h2><p class="sub" style="margin:6px 0">Ingresá el código de recuperación y una nueva contraseña para un administrador.</p><label for="fg_u">Usuario administrador</label><input id="fg_u" maxlength="30"><label for="fg_c">Código de recuperación</label><input id="fg_c" maxlength="30" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" style="text-transform:uppercase"><label for="fg_p">Nueva contraseña (mínimo 8)</label><input id="fg_p" type="password" autocomplete="new-password"><div id="fg_e" class="bad-t" style="min-height:20px;margin-top:6px"></div><div class="row"><button class="btn y lg sp" data-a="fgOk">Recuperar</button><button class="btn g lg" data-a="mclose">Cancelar</button></div>')};
A.fgOk=async()=>{
 const un=normUser($('#fg_u').value),code=$('#fg_c').value.toUpperCase().replace(/[^A-Z0-9]/g,''),p=$('#fg_p').value;
 const u=META.users.find(x=>x.user===un&&x.role==='admin');if(!u)return showErr('fg_e','No existe ese administrador.');
 if(p.length<8)return showErr('fg_e','La contraseña debe tener al menos 8 caracteres.');
 const L=(META.lock||{})['rec']||{n:0,until:0};if(L.until>now())return showErr('fg_e','Esperá '+Math.ceil((L.until-now())/1000)+' s.');
 showErr('fg_e','Verificando…');
 let raw;try{raw=await unwrapDK(code,META.rec)}catch(e){L.n++;L.until=L.n>=3?now()+Math.min(900000,15000*Math.pow(2,L.n-3)):0;META.lock['rec']=L;await saveMeta();return showErr('fg_e','Código incorrecto.')}
 META.lock['rec']={n:0,until:0};
 u.wrap=await wrapDK(p,raw);u.mustChange=false;META.lock[u.id]={n:0,until:0};
 const nrc=recCode();META.rec=await wrapDK(nrc.replace(/-/g,''),raw);await saveMeta();
 DK=await dkFrom(raw);const v=await kvGet('vault');S=JSON.parse(td.decode(await aesD(DK,v)));HK=null;migrate();SES={uid:u.id,name:u.name,role:u.role,user:u.user,perms:u.perms||{}};audit('recuperacion','Acceso recuperado con código; código renovado');startLockTimer();
 showRecovery(nrc,false)};
