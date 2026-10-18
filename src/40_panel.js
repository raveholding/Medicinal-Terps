/* ===== Panel: estructura, ruteo, utilidades, inicio ===== */
const VIEWS={};
/* [vista, título, ícono, módulo de permisos, nivel mínimo] */
const NAV=[
 ['dashboard','Inicio','grid',null],
 ['vender','Dispensar','cart','dispensar'],
 ['caja','Caja','cash','caja'],
 ['cerradas','Cajas cerradas','file','caja','gestionar'],
 ['inventario','Inventario y lotes','box','inventario'],
 ['trazabilidad','Trazabilidad','tag','inventario'],
 ['socios','Socios y pacientes','users','socios'],
 ['solic','Solicitudes web','inbox','solic'],
 ['sellos','Club de sellos','star','socios'],
 ['tramites','Trámites REPROCANN','clip','tramites'],
 ['cultivo','Planilla de cultivo','leaf','cultivo'],
 ['personal','Personal','clock','personal'],
 ['fichaje','Fichaje','nfc','caja'],
 ['gastos','Gastos','tag','gastos'],
 ['reportes','Reportes','chart','reportes'],
 ['datos','Importar / Exportar','upload','datos'],
 ['menupub','Menú público','share','admin'],
 ['integraciones','Integraciones','link','admin'],
 ['admin','Administración','gear','admin']
];
const SEPS={vender:'Mostrador',inventario:'Gestión',socios:'Comunidad',cultivo:'Producción',personal:'Equipo',gastos:'Finanzas',menupub:'Sistema'};
let COLLAPSED=false;try{COLLAPSED=localStorage.getItem('terps_col')==='1'}catch(e){}
function download(name,content,mime){const b=content instanceof Blob?content:new Blob([content],{type:(mime||'text/plain')+';charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(u)},500)}
function csvCell(v){if(v==null)return'';if(typeof v==='number')return String(v).replace('.',',');let s=String(v);if(/^[=+\-@\t\r]/.test(s)&&isNaN(parseNum(s)))s="'"+s;else if(/^[=+@\t\r]/.test(s))s="'"+s;if(/[;"\n\r]/.test(s))s='"'+s.replace(/"/g,'""')+'"';return s}
function toCSV(head,rows){return '﻿'+[head].concat(rows).map(r=>r.map(csvCell).join(';')).join('\r\n')}
const salesOK=()=>S.sales.filter(s=>!s.voided&&s.doc!=='presupuesto');
function chart(id,labels,series,fmt){
 fmt=fmt||money;const W=560,H=220,pl=10,pb=28,pt=10,n=labels.length,max=Math.max(1,...series.flatMap(s=>s.values));
 const gw=(W-pl*2)/n,bw=Math.min(46,gw/(series.length+0.6)),cols=['#111113','#F4CE00','#E6007E'];
 let bars='';series.forEach((s,si)=>s.values.forEach((v,i)=>{const h=(H-pb-pt)*(v/max);const x=pl+gw*i+(gw-bw*series.length)/2+bw*si;bars+='<rect x="'+x.toFixed(1)+'" y="'+(H-pb-h).toFixed(1)+'" width="'+(bw-3).toFixed(1)+'" height="'+Math.max(h,v>0?2:0).toFixed(1)+'" rx="5" fill="'+cols[si%3]+'"'+(si===1?' stroke="#111113" stroke-width="1"':'')+'><title>'+esc(s.name+' · '+labels[i]+': '+fmt(v))+'</title></rect>'}));
 const lab=labels.map((l,i)=>'<text x="'+(pl+gw*i+gw/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="#666670">'+esc(l)+'</text>').join('');
 const leg=series.length>1?'<div class="chips" style="margin-top:8px">'+series.map((s,i)=>'<span class="badge" style="background:'+cols[i%3]+';color:'+(i===1?'#111':'#fff')+'">'+esc(s.name)+'</span>').join('')+'</div>':'';
 const tbl='<div class="tw" style="display:none" id="'+id+'_t"><table><thead><tr><th></th>'+series.map(s=>'<th class="r">'+esc(s.name)+'</th>').join('')+'</tr></thead><tbody>'+labels.map((l,i)=>'<tr><td>'+esc(l)+'</td>'+series.map(s=>'<td class="r">'+esc(fmt(s.values[i]))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 return '<div id="'+id+'"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Gráfico" style="width:100%;height:auto" id="'+id+'_s">'+bars+lab+'</svg>'+leg+'</div>'+tbl+'<button class="btn g sm" style="margin-top:8px" data-a="chartTbl" data-id="'+id+'">Ver como tabla</button>'}
A.chartTbl=el=>{const id=el.dataset.id;const t=$('#'+id+'_t'),s=$('#'+id);const showT=t.style.display==='none';t.style.display=showT?'block':'none';s.style.display=showT?'none':'block';el.textContent=showT?'Ver gráfico':'Ver como tabla'};
function parseRoute(){const h=location.hash||'#/';let m;if((m=h.match(/^#\/p\/(.+)$/)))return{n:'p',id:decodeURIComponent(m[1])};if(h==='#/acceso')return{n:'login'};if(h==='#/cliente')return{n:'cli'};if((m=h.match(/^#\/panel\/?(.*)$/)))return{n:'panel',view:m[1]||'dashboard'};return{n:'home'}}
function route(){
 ROUTE=parseRoute();
 if(ROUTE.n==='cli'){renderCliente();return}
 if(ROUTE.n==='login'||ROUTE.n==='panel'){
  if(!S){if(CLOUD.on)viewLoginCloud();else if(!META)viewSetup();else viewLogin();return}
  if(ROUTE.n==='login'){location.hash='#/panel/'+homeFor();return}
  renderPanel();return}
 renderPublic()}
function allowed(v){const n=NAV.find(x=>x[0]===v);if(!n)return false;if(!n[3])return true;return mayo(n[3],n[4]||'ver')}
function renderPanel(){
 let v=ROUTE.view;if(!VIEWS[v]||!allowed(v)){v=NAV.find(n=>allowed(n[0]))[0];if(ROUTE.view!==v){history.replaceState(null,'','#/panel/'+v);ROUTE.view=v}}
 if(!$('#view')){buildShell()}
 const V=VIEWS[v];
 $('#view').innerHTML=V.r();$('#ttl').textContent=V.t;
 $$('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.id===v));
 $('.side').classList.remove('open');
 const cj=$('#cjchip');if(cj){cj.className='badge '+(S.cash.open?'ok':'warn');cj.textContent=S.cash.open?'Caja abierta':'Caja cerrada'}
 const sy=$('#syncchip');if(sy&&typeof cloudStatusText==='function'){sy.textContent=cloudStatusText()}
 if(V.a)V.a();
 document.body.classList.toggle('kiosk',!!(typeof KIOSK!=='undefined'&&KIOSK))}
function buildShell(){
 root.className='';
 const nav=NAV.filter(n=>allowed(n[0])).map(n=>(SEPS[n[0]]?'<div class="sep">'+SEPS[n[0]]+'</div>':'')+'<button data-a="nav" data-id="'+n[0]+'" title="'+n[1]+'">'+ic(n[2])+'<span>'+n[1]+(n[0]==='solic'&&inboxPending()?' <span class="badge warn" id="solicN">'+inboxPending()+'</span>':'')+'</span></button>').join('');
 root.innerHTML='<div class="app'+(COLLAPSED?' col':'')+'" id="app"><aside class="side" aria-label="Menú"><div class="brand"><span class="logo"><img alt="" src="'+ASSETS.logo+'"></span><div><b>'+esc(S.org.brand||'Medicinal Terps')+'</b><small>Sistema VB</small></div></div><nav class="nav">'+nav+'</nav><div class="credit">Desarrollado por <b>'+esc(RAVE.name)+'</b><br>WhatsApp '+esc(RAVE.tel)+'<br><a href="mailto:'+esc(RAVE.mail)+'">'+esc(RAVE.mail)+'</a><br>v'+VERSION+'<br><button class="btn y sm" style="margin-top:10px" data-a="help">Necesito ayuda</button></div></aside><div class="main"><div class="top"><button class="ib" id="burger" data-a="burger" aria-label="Menú">'+ic('menu')+'</button><button class="ib" data-a="collapse" aria-label="Contraer menú" id="colbtn">'+ic('menu')+'</button><b id="ttl" style="font-size:17px"></b><span class="sp"></span><button class="ib" data-a="gsearch" aria-label="Buscar persona" title="Buscar persona">'+ic('search')+'</button><span class="badge warn" id="cjchip"></span><button type="button" class="badge" id="syncchip" data-a="syncInfo" aria-label="Estado de la nube" style="border:0;cursor:pointer;font:inherit;min-height:32px"></button><span class="sub" id="usr" style="white-space:nowrap">'+esc(SES.name)+' · '+ROLES[SES.role]+'</span><button class="ib" data-a="help" aria-label="Necesito ayuda" title="Necesito ayuda">'+ic('help')+'</button><button class="ib" data-a="lock" aria-label="Bloquear" title="Bloquear">'+ic('lock')+'</button><button class="ib" data-a="logout" aria-label="Salir" title="Salir">'+ic('logout')+'</button></div><main id="view"></main></div></div>';
}
function go(v){location.hash='#/panel/'+v}
A.nav=el=>{go(el.dataset.id)};
A.burger=()=>$('.side').classList.toggle('open');
A.collapse=()=>{COLLAPSED=!COLLAPSED;$('#app').classList.toggle('col',COLLAPSED);try{localStorage.setItem('terps_col',COLLAPSED?'1':'0')}catch(e){}};
A.lock=()=>lockApp('Sesión bloqueada.');
A.logout=()=>logout();
A.help=()=>modal('<h2>Necesito ayuda</h2><p class="sub" style="margin:8px 0 14px">Soporte del sistema: <b>'+esc(RAVE.name)+'</b>. '+esc(RAVE.slogan||'')+'</p><div class="row"><a class="btn wa sp" target="_blank" rel="noopener noreferrer" href="'+waUrl(RAVE.wa,'Hola '+RAVE.name+', necesito ayuda con el sistema de '+(S&&S.org.brand||'Medicinal Terps')+' (v'+VERSION+').')+'">'+ic('wa')+'WhatsApp '+esc(RAVE.tel)+'</a><a class="btn g sp" href="mailto:'+esc(RAVE.mail)+'">'+esc(RAVE.mail)+'</a></div><button class="btn g" style="margin-top:12px" data-a="mclose">Cerrar</button>');
const refresh=()=>{if(S&&ROUTE.n==='panel')renderPanel()};
/* búsqueda de personas desde cualquier pantalla */
A.gsearch=()=>{modal('<h2>Buscar persona</h2><input id="gsq" data-in="gsq" placeholder="Nombre, legajo, DNI/CUIT/CUIL o WhatsApp" autocomplete="off" aria-label="Buscar persona"><div id="gsr" class="list" style="margin-top:10px;max-height:50vh;overflow:auto"></div><button class="btn g" style="margin-top:12px" data-a="mclose">Cerrar</button>')};
IN.gsq=el=>{const q=el.value.trim();const out=$('#gsr');if(!out)return;if(q.length<2){out.innerHTML='';return}const l=findSocios(q,20);
 out.innerHTML=l.length?l.map(s=>'<div class="li"><div style="min-width:0"><b>'+esc(s.name)+'</b><div class="sub">'+esc(s.legajo)+' · '+esc(docLabel(s.docTipo,s.doc))+'</div></div><button class="btn y sm" data-a="gsOpen" data-id="'+esc(s.id)+'">Abrir ficha</button></div>').join(''):'<p class="sub">Sin coincidencias.</p>'};
A.gsOpen=el=>{const s=socioById(el.dataset.id);if(!s)return;closeModal();if(!mayo('socios','ver'))return toast('No tenés acceso a Socios y pacientes');SO.q=s.legajo;SO.f='all';go('socios');if(ROUTE.view==='socios')refresh()};
/* ---------- Inicio ---------- */
let DASHF='all';
VIEWS.dashboard={t:'Inicio',r(){
 const tdy=today();let ss=salesOK();if(DASHF==='fc')ss=ss.filter(s=>s.doc==='factura_c');if(DASHF==='int')ss=ss.filter(s=>s.doc!=='factura_c');
 const hoy=ss.filter(s=>dkey(s.t)===tdy);const tot=r2(hoy.reduce((a,s)=>a+s.total,0)),conDon=hoy.filter(s=>s.total>0).length;
 const days=[],vals=[];for(let i=6;i>=0;i--){const k=dkey(now()-i*864e5);days.push(k.slice(8)+'/'+k.slice(5,7));vals.push(r2(ss.filter(s=>dkey(s.t)===k).reduce((a,s)=>a+s.total,0)))}
 const al=[];const o=S.cash.open,adm=can('admin');
 if(S.org.ejemplo&&adm)al.push(['warn','Hay datos de ejemplo. Cuando termines de probar, usá «Empezar de cero» en Administración.']);
 if(o&&dkey(o.openedAt)<tdy)al.push(['bad','La caja está abierta desde el '+fdate(dkey(o.openedAt))+'. Hay que cerrarla.']);
 if(adm&&!CLOUD.on&&now()-(S.lastBackup||0)>7*864e5)al.push(['warn','No hay respaldo de los últimos 7 días. Hacelo en Administración → Respaldo.']);
 const np=inboxPending();if(np&&mayo('solic','ver'))al.push(['warn',np+' solicitud(es) web esperan revisión. <a href="#/panel/solic">Abrir</a>']);
 if(mayo('inventario','ver')){const low=S.products.filter(p=>!p.service&&p.status==='activo'&&p.stock<=p.min);if(low.length)al.push(['warn','Stock bajo: '+low.slice(0,4).map(p=>esc(p.name.split('·')[0].trim())+' ('+qty(p.stock,p.unit)+')').join(', ')+(low.length>4?'…':'')]);
  const lim=dkey(now()+30*864e5),ven=S.products.filter(p=>!p.service&&p.vence&&p.stock>0&&p.vence<=lim);if(ven.length)al.push(['warn','Lotes por vencer o vencidos: '+ven.slice(0,3).map(p=>esc(p.name.split('·')[0].trim())+' ('+esc(p.lote||'s/lote')+', '+fdate(p.vence)+')').join(', ')+(ven.length>3?'…':'')])}
 if(mayo('socios','ver')){const venc=S.socios.filter(s=>s.cuotaHasta&&s.cuotaHasta<tdy).length;if(venc)al.push(['warn',venc+' persona(s) con cuota vencida.']);
  const rp=S.socios.filter(s=>s.reprocann&&s.reprocann.venc&&s.reprocann.venc>=tdy&&s.reprocann.venc<=dkey(now()+30*864e5)).length;if(rp)al.push(['warn',rp+' REPROCANN por vencer en 30 días.']);
  const du=S.socios.filter(s=>s.posibleDuplicadoDe).length;if(du)al.push(['warn',du+' ficha(s) marcadas como posible duplicado para revisar.'])}
 const mm=tdy.slice(5,7),bd=S.socios.filter(s=>s.bday&&s.bday.slice(5,7)===mm).sort((a,b)=>a.bday.slice(8)-b.bday.slice(8));
 const tr=S.tramites.filter(t=>t.estado!=='vigente').length;
 return '<div class="ph"><div><h1>Hola, '+esc(SES.name.split(' ')[0])+'</h1><span class="sub">'+DOW[new Date(now()).getDay()]+' '+fdate(tdy)+'</span></div>'+(mayo('dispensar','ver')?'<div class="chips"><button class="chip'+(DASHF==='all'?' on':'')+'" data-a="dashf" data-id="all">Todas</button><button class="chip'+(DASHF==='fc'?' on':'')+'" data-a="dashf" data-id="fc">Con Factura C</button><button class="chip'+(DASHF==='int'?' on':'')+'" data-a="dashf" data-id="int">Sólo comprobante interno</button></div>':'')+'</div>'+
 al.map(a=>'<div class="notice'+(a[0]==='bad'?' bad':'')+'">'+ic('alert')+'<span class="sp">'+a[1]+'</span></div>').join('')+
 (mayo('dispensar','ver')?'<div class="bento"><div class="c dark s4"><span class="lbl">Donaciones de hoy</span><div class="kpi">'+money(tot)+'</div><span class="sub" style="color:#bbb">'+hoy.length+' entrega(s)</span></div><div class="c yel s4"><span class="lbl">Entregas sin donación</span><div class="kpi">'+(hoy.length-conDon)+'</div><span>hoy</span></div><div class="c pink s4"><span class="lbl">Donación promedio</span><div class="kpi">'+money(conDon?r2(tot/conDon):0)+'</div><span>sólo entregas con donación</span></div>':'<div class="bento">')+
 (mayo('dispensar','ver')?'<div class="c s8"><h2>Donaciones · últimos 7 días</h2>'+chart('ch7',days,[{name:'Donaciones',values:vals}])+'</div>':'')+
 (mayo('caja','ver')?'<div class="c s4"><h2>Caja</h2>'+(o?'<div class="kpi" style="font-size:26px">'+money(cajaStats().esperado)+'</div><span class="sub">efectivo esperado · abierta '+fdt(o.openedAt)+'</span>':'<p class="sub" style="margin:8px 0">No hay caja abierta.</p>')+'<div class="row" style="margin-top:12px"><button class="btn y sm" data-a="nav" data-id="caja">'+(o?'Ver caja':'Abrir caja')+'</button>'+(mayo('dispensar','ver')?'<button class="btn g sm" data-a="nav" data-id="vender">Dispensar</button>':'')+'</div></div>':'')+
 (mayo('socios','ver')?'<div class="c s6"><h2>Cumpleaños del mes</h2>'+(bd.length?'<div class="list">'+bd.slice(0,6).map(s=>'<div class="li"><span>'+esc(s.name)+'</span><span class="badge m">'+s.bday.slice(8)+'/'+s.bday.slice(5,7)+'</span></div>').join('')+'</div>':'<p class="sub" style="margin-top:8px">Sin cumpleaños este mes.</p>')+'</div>':'')+
 '<div class="c s6"><h2>Accesos rápidos</h2><div class="row" style="margin-top:12px">'+[['vender','cart','Dispensar'],['socios','users','Socios y pacientes'],['sellos','star','Sellos'],['tramites','clip','Trámites'],['cultivo','leaf','Cultivo']].filter(x=>allowed(x[0])).map((x,i)=>'<button class="btn'+(i?' g':'')+' sm" data-a="nav" data-id="'+x[0]+'">'+ic(x[1])+x[2]+'</button>').join('')+'</div><p class="sub" style="margin-top:14px">Trámites en curso: <b>'+tr+'</b>. Factura C: <b>'+(S.org.facturaC?'habilitada (simulada, sin CAE)':'no habilitada')+'</b>.</p></div></div>'}};
A.dashf=el=>{DASHF=el.dataset.id;refresh()};
