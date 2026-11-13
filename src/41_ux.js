/* ===== Experiencia de uso (v3.5): menú por secciones plegables, buscador universal (Ctrl + K), campana de avisos,
   tema claro/oscuro, ayuda de una línea en cada pantalla, menú del celular que se cierra con ✕, Esc o tocando afuera,
   F1 para Dispensar desde cualquier pantalla y entradas suaves (se desactivan con «reducir movimiento»). ===== */
let NAVC={};try{NAVC=JSON.parse(localStorage.getItem('terps_navc')||'{}')||{}}catch(e){NAVC={}}
const navClosed=k=>!!NAVC[k];
A.navGrp=el=>{const k=el.dataset.g;NAVC[k]=!NAVC[k];try{localStorage.setItem('terps_navc',JSON.stringify(NAVC))}catch(e){}
 const g=el.closest('.ngrp');if(g){g.classList.toggle('shut',!!NAVC[k]);g.classList.remove('peek')}el.setAttribute('aria-expanded',String(!NAVC[k]))};

/* ---------- tema ---------- */
let THEME='light';try{THEME=localStorage.getItem('terps_theme')==='dark'?'dark':'light'}catch(e){}
function themeApply(){const dark=THEME==='dark'&&ROUTE&&ROUTE.n==='panel';document.documentElement.dataset.theme=dark?'dark':'light';
 const b=$('#thbtn');if(b){b.innerHTML=ic(dark?'sun':'moon');b.setAttribute('aria-label',dark?'Pasar a tema claro':'Pasar a tema oscuro');b.title=b.getAttribute('aria-label')}
 const mc=document.querySelector('meta[name=theme-color]');if(mc)mc.setAttribute('content',dark?'#111113':'#F4CE00')}
A.theme=()=>{THEME=THEME==='dark'?'light':'dark';try{localStorage.setItem('terps_theme',THEME)}catch(e){}themeApply()};
A.themeM=()=>{closeModal();A.theme()};

/* ---------- ayuda de una línea ---------- */
const VHELP={
 dashboard:'Resumen del día: donaciones, caja, avisos y accesos rápidos. La campana de arriba junta todos los avisos.',
 vender:'Elegí la persona, agregá los productos y registrá la donación. Las teclas F2 a F12 son atajos del cobro.',
 caja:'Abrí la caja al empezar, registrá ingresos y egresos con su rubro y cerrala con el arqueo al terminar.',
 cerradas:'Historial de cajas cerradas con su arqueo. Se pueden revisar y exportar; no se modifican.',
 inventario:'Productos, precios, lotes y stock. Un ajuste de stock siempre pide motivo y queda en la auditoría.',
 trazabilidad:'Seguí cada lote: de dónde vino, a quién se entregó y cuándo.',
 socios:'Fichas de socios y pacientes: legajo, REPROCANN, cuota, cuenta corriente y documentos.',
 solic:'Formularios que llegan desde el sitio web. Revisalos y creá la ficha con un toque.',
 sellos:'Club y fidelización: sellar visitas, niveles, avisos y la tarjeta del Club en el celular.',
 tramites:'Trámites REPROCANN en tablero: arrastrá cada tarjeta a su estado.',
 cultivo:'Planilla de cultivo por ciclo: fases, pH, EC, humedad y temperatura con historial.',
 personal:'Recursos Humanos: legajos del equipo, turnos, licencias, nómina interna, documentos y portal del empleado.',
 fichaje:'Fichaje de ingreso y egreso: PIN en modo kiosco, tarjeta QR o NFC. Cada fichada queda auditada.',
 gastos:'Egresos de la organización con su rubro y comprobante.',
 reportes:'Reportes por período listos para revisar o exportar.',
 datos:'Importá o exportá datos en CSV. Antes de importar se muestra una vista previa.',
 menupub:'Lo que ve cualquier persona en el sitio. Los cambios quedan en borrador hasta que publicás.',
 integraciones:'Google Drive, nube y otras conexiones del sistema.',
 admin:'Configuración del sistema: buscá el ajuste con «¿Qué querés cambiar?» o elegí la sección a la izquierda.'};
let HELPON=true;try{HELPON=localStorage.getItem('terps_help')!=='0'}catch(e){}
A.helpHide=()=>{HELPON=false;try{localStorage.setItem('terps_help','0')}catch(e){}$$('.vhelp').forEach(x=>x.remove());toast('Ayudas ocultas. Se vuelven a mostrar desde «Necesito ayuda».')};
A.helpShow=()=>{HELPON=true;try{localStorage.setItem('terps_help','1')}catch(e){}closeModal();refresh()};

/* ---------- después de dibujar cada pantalla ---------- */
let UXV='';
function uxAfter(v){
 themeApply();
 const view=$('#view');
 if(HELPON&&VHELP[v]&&view&&!view.querySelector('.vhelp')&&!(typeof HRK!=='undefined'&&HRK.on)){const p=document.createElement('p');p.className='vhelp';p.innerHTML=ic('help')+'<span class="sp">'+esc(VHELP[v])+'</span><button type="button" class="vhx" data-a="helpHide" aria-label="Ocultar las ayudas de una línea" title="Ocultar ayudas">'+ic('x')+'</button>';
  const ph=view.querySelector('.ph');if(ph&&ph.parentElement===view)ph.after(p);else view.prepend(p)}
 $$('.ngrp.peek').forEach(g=>g.classList.remove('peek'));
 const on=$('.nav button.on[data-id]');if(on){const g=on.closest('.ngrp.shut');if(g)g.classList.add('peek')}
 bellPaint();
 if(v!==UXV&&view){view.classList.remove('vin');void view.offsetWidth;view.classList.add('vin');UXV=v}}

/* ---------- campana de avisos ---------- */
function bellPaint(){let n=0;try{n=dashAlerts().length}catch(e){}const b=$('#bellN');if(b){b.hidden=!n;b.textContent=n>9?'9+':String(n)}
 const btn=$('.bell');if(btn){btn.setAttribute('aria-label',n?n+' aviso(s)':'Sin avisos');btn.classList.toggle('has',!!n)}}
A.bell=()=>{let al=[];try{al=dashAlerts()}catch(e){}
 modal('<h2>Avisos</h2><p class="sub" style="margin:4px 0 10px">Lo que necesita atención según tus permisos.</p>'+(al.length?'<div class="list">'+al.map(a=>'<div class="li bl '+(a[0]==='bad'?'bad':'warn')+'"><span class="bli">'+ic('alert')+'</span><span class="sp">'+a[1]+'</span>'+(a[2]?'<button class="btn g sm" data-a="bellGo" data-id="'+esc(a[2])+'">Abrir</button>':'')+'</div>').join('')+'</div>':'<p class="sub">No hay avisos. Todo en orden.</p>')+'<button class="btn g" style="margin-top:14px" data-a="mclose">Cerrar</button>');
 const mb=$('#modal .mb');if(mb)mb.addEventListener('click',e=>{if(e.target.closest('a[href^="#/panel"]'))setTimeout(closeModal,0)})};
A.bellGo=el=>{const v=el.dataset.id;closeModal();const m=v.match(/^personal:(\w+)$/);if(m&&typeof HR!=='undefined'){HR.tab=m[1];go('personal');if(ROUTE.view==='personal')refresh();return}go(v)};
setInterval(()=>{if(S&&ROUTE.n==='panel'&&document.visibilityState==='visible')bellPaint()},30000);

/* ---------- buscador universal (Ctrl + K) ---------- */
function lev1(a,b){/* ¿distancia de edición ≤ 1 (o dos letras vecinas invertidas)? */if(a===b)return true;const la=a.length,lb=b.length;
 if(la===lb){const df=[];for(let k=0;k<la&&df.length<3;k++)if(a[k]!==b[k])df.push(k);if(df.length===2&&df[1]===df[0]+1&&a[df[0]]===b[df[1]]&&a[df[1]]===b[df[0]])return true}if(Math.abs(la-lb)>1)return false;let i=0,j=0,d=0;
 while(i<la&&j<lb){if(a[i]===b[j]){i++;j++;continue}if(++d>1)return false;if(la>lb)i++;else if(lb>la)j++;else{i++;j++}}return d+(la-i)+(lb-j)<=1}
function fzMatch(hay,q){const h=norm(hay),ws=norm(q).split(/\s+/).filter(Boolean);if(!ws.length)return 0;let sc=0;const toks=h.split(/[^a-z0-9ñ]+/).filter(Boolean);
 for(const w of ws){if(h.startsWith(w)){sc+=3;continue}if(toks.some(t=>t.startsWith(w))){sc+=2;continue}if(h.includes(w)){sc+=1.5;continue}
  if(w.length>=4&&toks.some(t=>lev1(t.slice(0,w.length+1),w)||lev1(t,w))){sc+=.8;continue}return 0}return sc}
const PAL={q:'',i:0,res:[]};
const SCR_EXTRA=[['personal','Recursos Humanos · Legajos','briefcase','legajos'],['personal','Recursos Humanos · Turnos y licencias','cal','turnos'],['personal','Recursos Humanos · Solicitudes','inbox','solicitudes'],['personal','Recursos Humanos · Nómina','cash','nomina'],['personal','Recursos Humanos · Documentos','file','documentos'],['personal','Recursos Humanos · Reclutamiento','users','reclutamiento'],['personal','Recursos Humanos · Avisos al personal','bell','avisos'],['fichaje','Portal del empleado (kiosco)','idcard','kiosco']];
function palSearch(q){const out=[];q=String(q||'').trim();
 for(const n of NAV)if(allowed(n[0])){const s=q?fzMatch(n[1]+' '+(VHELP[n[0]]||'').slice(0,60),q):1;if(s)out.push({k:'Pantallas',t:n[1],sub:'Ir a la pantalla',ic:n[2],go:n[0],s:s+(q?1:0)})}
 for(const x of SCR_EXTRA)if(allowed(x[0])&&q){const s=fzMatch(x[1],q);if(s)out.push({k:'Pantallas',t:x[1],sub:'Ir a la pestaña',ic:x[2],go:x[0],tab:x[3],s})}
 if(q.length>=2&&mayo('socios','ver')){let l=findSocios(q,8);if(!l.length)l=S.socios.map(s=>({s,v:fzMatch(s.name+' '+(s.legajo||''),q)})).filter(x=>x.v).sort((a,b)=>b.v-a.v).slice(0,8).map(x=>x.s);
  for(const s of l)out.push({k:'Personas',t:s.name,sub:(s.legajo||'')+' · '+docLabel(s.docTipo,s.doc),ic:'users',socio:s.id,s:5})}
 if(q.length>=2&&(mayo('inventario','ver')||mayo('dispensar','ver'))){const dg=q.replace(/\s/g,'');
  S.products.map(p=>({p,v:(p.barcode&&p.barcode===dg)||(p.plu&&p.plu===dg)?9:fzMatch(p.name+' '+(p.lote||''),q)})).filter(x=>x.v).sort((a,b)=>b.v-a.v).slice(0,6)
   .forEach(x=>out.push({k:'Productos',t:x.p.name,sub:money(x.p.price)+(x.p.service?'':' · stock '+qty(x.p.stock,x.p.unit))+(x.p.lote?' · lote '+x.p.lote:''),ic:'box',prod:x.p.id,s:x.v}))}
 if(q.length>=2&&mayo('personal','ver')){S.staff.map(f=>({f,v:fzMatch(f.name+' '+(f.role||'')+' '+(f.area||''),q)})).filter(x=>x.v).slice(0,5)
   .forEach(x=>out.push({k:'Personal',t:x.f.name,sub:(x.f.role||'')+(x.f.active===false?' · inactivo':''),ic:'briefcase',staff:x.f.id,s:x.v}))}
 if(typeof instShow==='function'&&instShow()&&(!q||fzMatch('instalar sistema aplicacion app escritorio pantalla de inicio',q)))out.push({k:'Pantallas',t:'Instalar el sistema',sub:'Como aplicación en este equipo',ic:'download',act:'instApp',s:q?2.5:0});
 const ord=['Pantallas','Personas','Productos','Personal'];
 return out.sort((a,b)=>ord.indexOf(a.k)-ord.indexOf(b.k)||b.s-a.s).filter((x,i,a)=>x.k!=='Pantallas'||a.filter(y=>y.k==='Pantallas').indexOf(x)<(q?6:8))}
A.gsearch=()=>{PAL.q='';PAL.i=0;modal('<h2 class="sr">Buscar en el sistema</h2><div class="palin">'+ic('search')+'<input id="palq" data-in="palq" data-kd="pal" placeholder="Personas, productos, personal o pantallas…" autocomplete="off" spellcheck="false" aria-label="Buscar en el sistema" aria-controls="palr" aria-autocomplete="list"><kbd>Esc</kbd></div><div id="palr" class="palr" role="listbox" aria-label="Resultados"></div><p class="sub palh">↑ ↓ para moverte · Enter para abrir · tolera errores de tipeo</p>',{pal:true});palPaint()};
function palPaint(){PAL.res=palSearch(PAL.q);if(PAL.i>=PAL.res.length)PAL.i=Math.max(0,PAL.res.length-1);const out=$('#palr');if(!out)return;let k='';
 out.innerHTML=PAL.res.length?PAL.res.map((r,i)=>(r.k!==k?'<div class="palk">'+esc(k=r.k)+'</div>':'')+'<button type="button" class="pali'+(i===PAL.i?' on':'')+'" role="option" aria-selected="'+(i===PAL.i)+'" id="pal_'+i+'" data-a="palGo" data-i="'+i+'">'+ic(r.ic)+'<span class="sp"><b>'+esc(r.t)+'</b><small>'+esc(r.sub)+'</small></span></button>').join(''):'<p class="sub" style="padding:14px 4px">Sin resultados para «'+esc(PAL.q)+'».</p>';
 const q=$('#palq');if(q)q.setAttribute('aria-activedescendant',PAL.res.length?'pal_'+PAL.i:'');const on=out.querySelector('.pali.on');if(on)on.scrollIntoView({block:'nearest'})}
IN.palq=el=>{PAL.q=el.value;PAL.i=0;palPaint()};
KD.pal=(el,e)=>{if(e.key==='ArrowDown'){e.preventDefault();PAL.i=Math.min(PAL.res.length-1,PAL.i+1);palPaint()}else if(e.key==='ArrowUp'){e.preventDefault();PAL.i=Math.max(0,PAL.i-1);palPaint()}else if(e.key==='Enter'){e.preventDefault();palOpen(PAL.res[PAL.i])}};
A.palGo=el=>palOpen(PAL.res[+el.dataset.i]);
function palOpen(r){if(!r)return;closeModal();
 if(r.act){A[r.act]();return}
 if(r.socio){if(!mayo('socios','ver'))return toast('No tenés acceso a Socios y pacientes');legajoOpen(r.socio);return}
 if(r.prod){if(mayo('inventario','ver')){INV.tab='prod';INV.q=r.t;go('inventario');setTimeout(()=>{if(ROUTE.view==='inventario')refresh()},30)}else go('vender');return}
 if(r.staff){if(typeof hrEmpOpen==='function'){HR.tab='legajos';go('personal');setTimeout(()=>hrEmpOpen(r.staff),60)}return}
 if(r.tab&&typeof HR!=='undefined'){if(r.go==='personal'){HR.tab=r.tab}else if(r.tab==='kiosco'){setTimeout(()=>{if(A.kioskHr)A.kioskHr()},80)}}
 go(r.go);if(ROUTE.view===r.go)refresh()}

/* ---------- teclado global ---------- */
function uxKey(e){
 if(!S||ROUTE.n!=='panel'||document.body.classList.contains('kiosk'))return false;
 if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='k'||e.key==='K')){e.preventDefault();A.gsearch();return true}
 if(e.key==='F1'&&ROUTE.view!=='vender'&&allowed('vender')&&!document.body.classList.contains('kiosk')){e.preventDefault();go('vender');return true}
 if(e.key==='Escape'&&document.body.classList.contains('navopen')){const sd=$('.side');if(sd)sd.classList.remove('open');document.body.classList.remove('navopen');const b=$('#burger');if(b)b.focus();return true}
 return false}
