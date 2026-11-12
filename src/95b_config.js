/* ===== Configuración dinámica (v3.5) · misma idea que la demo DIPARMA V27.7, sobre la pantalla Administración =====
   No cambia ni duplica ningún ajuste: toma las tarjetas que dibuja Administración (con sus campos y botones de siempre) y las ordena en
   · un buscador «¿Qué querés cambiar?» (tecla /) que filtra por título, etiquetas y ayudas sin importar tildes y resalta el campo;
   · un índice por secciones con la cantidad de ajustes (en el celular, fichas horizontales);
   · tarjetas plegables con un resumen de una línea (la primera de cada sección abierta), «Abrir todo» / «Cerrar todo»;
   · marca «Sin guardar» en la tarjeta y en el índice, aviso del navegador al salir con cambios, y atajos a los otros ajustes. */
const CFG_SECS=[
 {k:'org',t:'Organización',d:'Identidad, dirección, horarios, contacto y redes',ic:'home',m:/identidad|direcci|horario|contacto|redes/i},
 {k:'socios',t:'Socios y Club',d:'Cuota de socio y tarjeta de sellos',ic:'star',m:/cuota|club|sellos/i},
 {k:'cobros',t:'Cobros y comprobantes',d:'Factura C y rubros financieros',ic:'cash',m:/factura|rubro|cobro/i},
 {k:'acceso',t:'Usuarios y seguridad',d:'Usuarios, permisos, contraseñas, PIN y sesión',ic:'lock',m:/usuario|seguridad|sesi|permiso/i},
 {k:'datos',t:'Datos y sistema',d:'Respaldo, auditoría y zona de riesgo',ic:'gear',m:/respaldo|auditor|riesgo|datos/i}];
const CFG_LINKS=[['menupub','Menú público','Bloques, textos, legales y publicación'],['sellos','Club y fidelización','Niveles, avisos y tarjeta en el celular'],['personal','Recursos Humanos','Asistencia, aprobaciones y vacaciones','ajustes'],['integraciones','Integraciones','Google Drive y nube'],['datos','Importar / Exportar','Planillas CSV'],['fichaje','Fichaje y kiosco','PIN del personal y portal']];
const CFGU={sec:'org',q:'',open:{},dirty:{}};
try{const v=sessionStorage.getItem('terps_cfgsec');if(v)CFGU.sec=v}catch(e){}
let cfgItems=[];
function cfgSecOf(t){const x=CFG_SECS.find(s=>s.m.test(t));return x?x.k:'datos'}
function cfgSummary(body){const ins=[...body.querySelectorAll('input,select,textarea')].filter(i=>i.type!=='hidden'&&i.type!=='file');const chk=ins.filter(i=>i.type==='checkbox');const on=chk.filter(i=>i.checked).length;
 const p=body.querySelector('p.sub');const help=p?p.textContent.trim().replace(/\s+/g,' '):'';const bits=[];
 const nf=ins.length-chk.length;if(nf)bits.push(nf+' campo'+(nf>1?'s':''));if(chk.length)bits.push(on+' de '+chk.length+' opci'+(chk.length>1?'ones activas':'ón activa'));
 const li=body.querySelectorAll('.li').length;if(!ins.length&&li)bits.push(li+' elemento'+(li>1?'s':''));
 return (help?help.slice(0,110)+(help.length>110?'…':''):'')+(bits.length?(help?' · ':'')+bits.join(' · '):'')}
function cfgEnhance(){const view=$('#view');if(!view||view.querySelector('.cfg-wrap'))return;CFGU.dirty={};
 const grid=view.querySelector('.bento');if(!grid)return;const cards=[...grid.children].filter(c=>c.classList.contains('c'));if(cards.length<3)return;
 const items=cards.map((c,i)=>{const h=c.querySelector('h2');const t=h?h.textContent.trim():'Ajustes';return{c,t,id:'cfg'+i,sec:cfgSecOf(t)}});
 items.forEach(it=>{const c=it.c;c.classList.add('cfg-card');c.id=it.id;
  /* el título puede estar suelto o dentro de una fila con botones: los botones quedan en el cuerpo */
  const h=c.querySelector('h2');const body=document.createElement('div');body.className='cfg-body';body.id=it.id+'-b';
  if(h&&h.parentElement!==c){const row=h.parentElement;h.remove();if(row.classList.contains('row')){const sp=document.createElement('span');sp.className='sp';row.prepend(sp)}}else if(h)h.remove();
  [...c.childNodes].forEach(n=>body.appendChild(n));
  const sum=cfgSummary(body);
  const head=document.createElement('button');head.type='button';head.className='cfg-head';head.setAttribute('aria-expanded','false');head.setAttribute('aria-controls',body.id);
  head.innerHTML='<span class="cfg-ht"><b>'+esc(it.t)+'</b><small>'+esc(sum)+'</small></span><span class="cfg-dirty" hidden>Sin guardar</span><span class="cfg-chev" aria-hidden="true">'+ic('chev')+'</span>';
  c.appendChild(head);c.appendChild(body);
  head.addEventListener('click',()=>{CFGU.open[it.t]=!c.classList.contains('open');cfgPaint()});
  const mark=e=>{if(e.target.closest('#aq'))return;CFGU.dirty[it.t]=1;cfgPaint()};c.addEventListener('input',mark);c.addEventListener('change',mark)});
 /* al guardar: se limpia la marca en todas las tarjetas que usan el mismo botón (los datos de la organización se guardan juntos) */
 grid.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;if(/save|ok$/i.test(b.dataset.a)||/guardar/i.test(b.textContent)){const a=b.dataset.a;items.forEach(i=>{if(i.c.querySelector('[data-a="'+a+'"]'))delete CFGU.dirty[i.t]})}},true);
 const secs=CFG_SECS.filter(s=>items.some(i=>i.sec===s.k));if(!secs.some(s=>s.k===CFGU.sec))CFGU.sec=secs[0].k;
 const links=CFG_LINKS.filter(l=>allowed(l[0]));
 const wrap=document.createElement('div');wrap.className='cfg-wrap';
 wrap.innerHTML='<div class="cfg-search">'+ic('search')+'<input id="cfg-q" type="search" placeholder="¿Qué querés cambiar? Ej.: cuota, horario, WhatsApp, PIN, respaldo…" aria-label="Buscar un ajuste" autocomplete="off" value="'+esc(CFGU.q)+'"><kbd>/</kbd></div>'+
  '<div class="cfg-grid"><nav class="cfg-nav" aria-label="Secciones de la configuración">'+secs.map(s=>'<button type="button" class="cfg-sec" data-cfgsec="'+s.k+'" aria-current="false"><span class="cfg-sic">'+ic(s.ic)+'</span><span class="cfg-st"><b>'+esc(s.t)+'</b><small>'+esc(s.d)+'</small></span><span class="cfg-n"></span></button>').join('')+
  (links.length?'<div class="cfg-more"><span class="lbl">Otros ajustes del sistema</span>'+links.map(l=>'<button type="button" class="cfg-link" data-cfglink="'+l[0]+'"'+(l[3]?' data-tab="'+l[3]+'"':'')+'><b>'+esc(l[1])+'</b><small>'+esc(l[2])+'</small></button>').join('')+'</div>':'')+'</nav>'+
  '<section class="cfg-main" aria-live="polite"><div class="cfg-mhead"><div class="sp"><h2 id="cfg-tt"></h2><p class="sub" id="cfg-sd"></p></div><button type="button" class="btn g sm" data-cfgall="1">Abrir todo</button><button type="button" class="btn g sm" data-cfgall="0">Cerrar todo</button></div><div class="cfg-list"></div><p class="cfg-empty sub" hidden>No hay ajustes con ese texto. Probá con otra palabra o mirá «Otros ajustes del sistema».</p></section></div>';
 grid.replaceWith(wrap);const list=wrap.querySelector('.cfg-list');items.forEach(it=>list.appendChild(it.c));
 secs.forEach(s=>{const f=items.find(i=>i.sec===s.k&&i.c.querySelector('.cfg-body input:not([type=file]),.cfg-body select,.cfg-body textarea'))||items.find(i=>i.sec===s.k);if(f&&CFGU.open[f.t]===undefined)CFGU.open[f.t]=true});
 wrap.addEventListener('click',e=>{const b=e.target.closest('[data-cfgsec]');if(b){CFGU.sec=b.dataset.cfgsec;CFGU.q='';$('#cfg-q').value='';cfgPaint();try{sessionStorage.setItem('terps_cfgsec',CFGU.sec)}catch(x){}const m=wrap.querySelector('.cfg-main');if(m&&m.getBoundingClientRect().top<0)m.scrollIntoView({block:'start'});return}
  const a=e.target.closest('[data-cfgall]');if(a){const v=a.dataset.cfgall==='1';items.forEach(i=>{if(cfgVisible(i))CFGU.open[i.t]=v});cfgPaint();return}
  const l=e.target.closest('[data-cfglink]');if(l){if(l.dataset.tab&&typeof HR!=='undefined')HR.tab=l.dataset.tab;go(l.dataset.cfglink)}});
 const q=$('#cfg-q');q.addEventListener('input',()=>{CFGU.q=q.value;cfgPaint()});q.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();q.value='';CFGU.q='';cfgPaint()}});
 cfgItems=items;cfgPaint()}
/* sólo para las pruebas automáticas anteriores a v3.5: window.__cfgAll muestra todas las tarjetas abiertas */
function cfgVisible(i){if(window.__cfgAll)return true;const q=norm(CFGU.q);if(!q)return i.sec===CFGU.sec;const hay=norm(i.t+' '+i.c.textContent+' '+[...i.c.querySelectorAll('input,textarea')].map(x=>x.placeholder||'').join(' '));return q.split(/\s+/).every(w=>hay.includes(w))}
function cfgPaint(){const q=norm(CFGU.q);let shown=0;
 cfgItems.forEach(i=>{const v=cfgVisible(i);i.c.hidden=!v;if(v)shown++;const open=q||window.__cfgAll?v:!!CFGU.open[i.t];i.c.classList.toggle('open',open);i.c.querySelector('.cfg-head').setAttribute('aria-expanded',String(open));
  const d=i.c.querySelector('.cfg-dirty');d.hidden=!CFGU.dirty[i.t];i.c.classList.toggle('dirty',!!CFGU.dirty[i.t]);
  i.c.querySelectorAll('.cfg-hit').forEach(x=>x.classList.remove('cfg-hit'));
  if(q&&v)i.c.querySelectorAll('label').forEach(l=>{if(q.split(/\s+/).every(w=>norm(l.textContent).includes(w)))l.classList.add('cfg-hit')});
  const tag=i.c.querySelector('.cfg-tag');if(tag)tag.remove();if(q&&v){const s=CFG_SECS.find(x=>x.k===i.sec);const sp=document.createElement('span');sp.className='badge cfg-tag';sp.textContent=s?s.t:'';i.c.querySelector('.cfg-ht b').after(sp)}});
 $$('.cfg-sec').forEach(b=>{const on=!q&&b.dataset.cfgsec===CFGU.sec;b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false');const k=b.dataset.cfgsec;
  const dn=cfgItems.filter(i=>i.sec===k&&CFGU.dirty[i.t]).length;const n=b.querySelector('.cfg-n');n.textContent=dn?dn+' sin guardar':String(cfgItems.filter(i=>i.sec===k).length);n.classList.toggle('warn',!!dn)});
 const on=$('.cfg-sec.on'),nv=$('.cfg-nav');if(on&&nv&&nv.scrollWidth>nv.clientWidth){const l=on.offsetLeft-nv.offsetLeft;if(l<nv.scrollLeft||l+on.offsetWidth>nv.scrollLeft+nv.clientWidth)nv.scrollLeft=Math.max(0,l-16)}
 const s=CFG_SECS.find(x=>x.k===CFGU.sec)||CFG_SECS[0];const tt=$('#cfg-tt'),sd=$('#cfg-sd');
 if(tt)tt.textContent=q?'Resultados para «'+CFGU.q.trim()+'»':s.t;if(sd)sd.textContent=q?shown+' ajuste'+(shown===1?'':'s')+' encontrado'+(shown===1?'':'s'):s.d;
 const em=$('.cfg-empty');if(em)em.hidden=!!shown;
 if(q&&shown===1){const h=$('.cfg-card:not([hidden]) .cfg-hit');if(h)h.scrollIntoView({block:'nearest'})}}
{const _a=VIEWS.admin.a;VIEWS.admin.a=function(){try{cfgEnhance()}catch(e){console.warn('config',e)}if(_a)return _a.apply(this,arguments)}}
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&ROUTE.n==='panel'&&ROUTE.view==='admin'&&$('#modal').hidden&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'')){const q=$('#cfg-q');if(q){e.preventDefault();q.focus()}}});
window.addEventListener('beforeunload',e=>{if(ROUTE&&ROUTE.n==='panel'&&ROUTE.view==='admin'&&Object.keys(CFGU.dirty).length){e.preventDefault();e.returnValue=''}});
/* salir de Administración con cambios sin guardar desde el menú: se pregunta antes (los cambios no guardados se pierden al salir) */
document.addEventListener('click',e=>{if(!(ROUTE&&ROUTE.n==='panel'&&ROUTE.view==='admin')||!Object.keys(CFGU.dirty).length)return;
 const el=e.target.closest('[data-a=nav],[data-cfglink],a[href^="#/panel/"]');if(!el||el.closest('#modal'))return;
 const dest=el.dataset.id||el.dataset.cfglink||(el.getAttribute('href')||'').replace('#/panel/','');if(!dest||dest==='admin')return;
 e.preventDefault();e.stopPropagation();const n=Object.keys(CFGU.dirty).length;const tab=el.dataset.tab;
 confirmBox({title:'Cambios sin guardar',msg:'Hay '+n+' ajuste(s) sin guardar en Administración. Si salís ahora, se pierden.',ok:'Salir sin guardar',danger:true,onOk:()=>{CFGU.dirty={};if(tab&&typeof HR!=='undefined')HR.tab=tab;go(dest)}})},true);
