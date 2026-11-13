/* ===== Instalar el sistema (v3.6) · sólo para el equipo, no para pacientes =====
   · El manifiesto de la app (app-equipo.webmanifest) y el service worker se cargan ÚNICAMENTE en las pantallas del equipo
     (#/acceso y el panel). En el sitio público, #/cliente y #/mitarjeta se quitan: el navegador no le ofrece instalar a un paciente.
   · Botón «Instalar el sistema» en el ingreso, en el menú lateral, en «Necesito ayuda» y en el buscador (Ctrl + K).
     Chrome, Edge y Android: abre el diálogo de instalación del navegador. iPhone/iPad, Safari en Mac y Firefox: instrucciones paso a paso.
   · Instalada, la app abre directo en el ingreso del equipo y el botón desaparece. */
const INST={evt:null,done:false,on:false};
const instStandalone=()=>{try{return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: window-controls-overlay)').matches||navigator.standalone===true}catch(e){return false}};
const instHttp=()=>location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
function instPlat(){const u=navigator.userAgent||'';const ios=/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1);
 if(ios)return /CriOS|FxiOS|EdgiOS/.test(u)?'ios-otro':'ios';if(/Android/.test(u))return /Firefox/.test(u)?'and-ff':/SamsungBrowser/.test(u)?'and-sam':'and';
 if(/Firefox\//.test(u))return 'ff';if(/Safari\//.test(u)&&!/Chrome|Chromium|Edg\//.test(u))return 'mac-safari';if(/Edg\//.test(u))return 'edge';return 'chrome'}
/* manifiesto, íconos y service worker: sólo en pantallas del equipo */
function instSync(team){if(!instHttp())return;const hd=document.head;
 const tags=[['link','manifest',{rel:'manifest',href:'app-equipo.webmanifest'}],['link','apple-touch-icon',{rel:'apple-touch-icon',href:'assets/apple-touch-180.png'}],['meta','apple-mobile-web-app-capable',{name:'apple-mobile-web-app-capable',content:'yes'}],['meta','mobile-web-app-capable',{name:'mobile-web-app-capable',content:'yes'}],['meta','apple-mobile-web-app-title',{name:'apple-mobile-web-app-title',content:'Terps Gestión'}]];
 for(const [tg,k,at] of tags){const sel=tg==='link'?'link[rel="'+at.rel+'"]':'meta[name="'+at.name+'"]';let el=hd.querySelector(sel);
  if(team&&!el){el=document.createElement(tg);for(const a in at)el.setAttribute(a,at[a]);el.dataset.inst='1';hd.appendChild(el)}
  else if(!team&&el&&el.dataset.inst)el.remove()}
 if(team&&!INST.on&&'serviceWorker' in navigator){INST.on=true;navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(e=>console.warn('sw',e))}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();INST.evt=e;instPaint()});
window.addEventListener('appinstalled',()=>{INST.evt=null;INST.done=true;instPaint();try{if(S&&SES)audit('app_instalada',instPlat())}catch(e){}toast('Sistema instalado. Ya lo podés abrir desde el escritorio o la pantalla de inicio.',6000)});
const instShow=()=>!instStandalone()&&!INST.done;
function instBtn(cls,lbl){if(!instShow())return '';return '<button type="button" class="'+(cls||'btn g')+' instb" data-a="instApp" title="Instalar el sistema en este equipo">'+ic('download')+'<span>'+(lbl||'Instalar el sistema')+'</span></button>'}
function instPaint(){const v=instShow();$$('.instb,.instauth').forEach(b=>{b.hidden=!v})}
A.instApp=async()=>{
 if(instStandalone())return toast('El sistema ya está instalado en este equipo');
 if(INST.evt){const e=INST.evt;INST.evt=null;try{await e.prompt();const r=await e.userChoice;if(r&&r.outcome==='accepted'){INST.done=true;instPaint()}else toast('Instalación cancelada. Podés volver a intentarlo cuando quieras.')}catch(x){instHelp()}return}
 instHelp()};
function instHelp(){const p=instPlat();
 const S_={ios:['Abrí este sistema en <b>Safari</b>.','Tocá <b>Compartir</b> (el cuadrado con la flecha hacia arriba).','Elegí <b>«Agregar a pantalla de inicio»</b> y tocá <b>Agregar</b>.'],
  'ios-otro':['En iPhone y iPad la instalación se hace desde <b>Safari</b>.','Copiá la dirección, abrila en Safari y tocá <b>Compartir → «Agregar a pantalla de inicio»</b>.'],
  and:['Tocá el menú <b>⋮</b> de Chrome (arriba a la derecha).','Elegí <b>«Instalar aplicación»</b> o <b>«Agregar a la pantalla principal»</b>.','Confirmá con <b>Instalar</b>.'],
  'and-sam':['Tocá el menú <b>☰</b> de Samsung Internet.','Elegí <b>«Agregar página a» → «Pantalla de inicio»</b>.'],
  'and-ff':['Tocá el menú <b>⋮</b> de Firefox.','Elegí <b>«Instalar»</b> o <b>«Agregar a la pantalla de inicio»</b>.'],
  chrome:['Hacé clic en el ícono de <b>instalar</b> (una pantalla con una flecha) a la derecha de la barra de direcciones.','O abrí el menú <b>⋮ → «Transmitir, guardar y compartir» → «Instalar página como app»</b>.','Confirmá con <b>Instalar</b>.'],
  edge:['Hacé clic en el ícono de <b>instalar</b> en la barra de direcciones.','O abrí el menú <b>… → «Aplicaciones» → «Instalar este sitio como aplicación»</b>.'],
  'mac-safari':['En la barra de menú elegí <b>Archivo → «Agregar al Dock»</b> (Safari 17 o posterior).','Confirmá con <b>Agregar</b>.'],
  ff:['Firefox en computadora no instala aplicaciones web.','Abrí este sistema en <b>Chrome</b> o <b>Edge</b> y tocá «Instalar el sistema».']}[p]||[];
 modal('<h2>Instalar el sistema</h2><p class="sub" style="margin:4px 0 12px">Queda como una aplicación en el escritorio o en la pantalla de inicio, abre directo en el ingreso del equipo y en pantalla completa. Es sólo para el equipo: los pacientes siguen usando el sitio y su tarjeta del Club.</p>'+
  (instHttp()?'':'<p class="notice" style="margin-bottom:10px">'+ic('alert')+'<span class="sp">La instalación funciona desde el sitio publicado (https), no desde un archivo abierto en el equipo.</span></p>')+
  '<ol class="inststeps">'+S_.map(x=>'<li>'+x+'</li>').join('')+'</ol>'+
  '<p class="sub" style="margin-top:12px">Los datos son los mismos que en el navegador: instalarlo no cambia usuarios, permisos ni la sincronización con la nube.</p><button class="btn g" style="margin-top:14px" data-a="mclose">Cerrar</button>')}
/* al abrir la app instalada: directo al ingreso del equipo */
(function(){try{const q=new URLSearchParams(location.search);if((q.get('app')==='equipo'||instStandalone())&&(!location.hash||location.hash==='#'||location.hash==='#/'))history.replaceState(null,'',location.pathname+location.search+'#/acceso')}catch(e){}})();
