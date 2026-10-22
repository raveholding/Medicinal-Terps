/* ===== Sitio público (menú digital) ===== */
const CART={};
let CATSEL='all',HCTAB='new',HCRES=null,TNRES=null,HCN='',TNN='',HCBUSY=false,TNBUSY=false;
const root=$('#root');
const pubUrl=()=>{let u=location.href.split('#')[0];return u};
const waNum=s=>String(s||'').replace(/\D/g,'');
const waUrl=(num,text)=>'https://wa.me/'+waNum(num)+'?text='+encodeURIComponent(text);
/* sólo https:, tel:, mailto: y wa.me (resto se descarta) */
function safeUrl(u){u=String(u||'').trim();if(/^https:\/\/[^\s"'<>]+$/i.test(u)||/^(tel|mailto):[^\s"'<>]+$/i.test(u))return u;return ''}
const stepOf=p=>p.unit==='g'?5:1;
function ageOk(){try{return sessionStorage.getItem('terps_age')==='1'}catch(e){return !!window.__age}}
function ageSet(){try{sessionStorage.setItem('terps_age','1')}catch(e){window.__age=1}}
function openNow(o){const d=new Date(now());const m=d.getHours()*60+d.getMinutes();return (o.slots||[]).some(s=>m>=s[0]&&m<s[1])}
/* textos editables desde Administración → Menú público (por idioma); si no hay, los de fábrica */
const mt=k=>{const x=PUB&&PUB.menu&&PUB.menu.texts&&PUB.menu.texts[LANG];return (x&&x[k])||t(k)};
function cartTotal(){let n=0,c=0;for(const id in CART){if(id.startsWith('__'))continue;const p=PUB.products.find(x=>x.id===id);if(p){n+=r2(p.price*CART[id]);c++}}return{total:r2(n),count:c}}
function ldJson(){
 const o=PUB.org;let ld;
 if(ROUTE.n==='p'){const p=PUB.products.find(x=>x.id===ROUTE.id);if(!p)return;
  ld={'@context':'https://schema.org','@type':'Product',name:p.name,description:p.desc,brand:{'@type':'Organization',name:o.legal}};
  if(img(p.img).startsWith('http'))ld.image=img(p.img)}
 else ld={'@context':'https://schema.org','@type':['NGO','MedicalOrganization'],name:o.name,legalName:o.legal,description:o.tagline,email:o.email,taxID:o.cuit,address:{'@type':'PostalAddress',streetAddress:o.addr,addressLocality:o.city,addressCountry:'AR'},sameAs:o.ig?['https://www.instagram.com/'+o.ig]:[]};
 const el=$('#ld');if(el)el.textContent=JSON.stringify(ld);
}
function setMeta(title){document.title=title;const m=$('meta[property="og:title"]');if(m)m.setAttribute('content',title)}
function pcard(p){
 const tall=p.unit==='g';const price=money(p.price)+(p.unit==='g'?' <small class="mut">/ g</small>':'');
 return '<article class="pcard"><div class="im'+(tall?' tall':'')+'" data-a="zoom" data-id="'+esc(p.id)+'">'+(img(p.img)?'<img loading="lazy" alt="'+esc(p.name)+'" src="'+img(p.img)+'">':'')+'</div><div class="bd">'+
 (p.rp?'<span class="badge m">'+t('rp')+'</span>':'')+'<h3>'+esc(p.name)+'</h3><div class="lbl">'+t('donsug')+'</div><div class="pr">'+price+'</div>'+
 '<div class="row" style="margin-top:auto;padding-top:8px"><a class="btn g sm" href="#/p/'+esc(p.id)+'">'+t('ver')+'</a>'+
 (p.soldout?'<span class="badge bad">'+t('sinstock')+'</span>':'<button class="btn y sm sp" data-a="addCart" data-id="'+esc(p.id)+'">'+ic('plus')+t('agregar')+'</button>')+'</div></div></article>'
}
function pubBar(){
 const o=PUB.org;
 return '<header class="pbar"><a class="nm" href="#/"><span class="logo"><img alt="" src="'+ASSETS.logo+'"></span><b>'+esc(o.brand||o.name)+'</b></a>'+
 '<button class="btn g sm" data-a="lang" aria-label="'+(LANG==='es'?'English':'Español')+'">'+(LANG==='es'?'EN':'ES')+'</button>'+
 '<a class="btn y sm" href="#/acceso" id="goLogin">'+ic('lock')+'<span>'+t('acceso')+'</span></a></header>'
}
function blockOn(id){const b=((PUB.menu||{}).blocks||[]).find(x=>x.id===id);return !b||b.on!==false}
/* el catálogo de productos va al frente (salvo que la administración lo desactive en Menú público) */
function blockOrder(){const m=PUB.menu||{};let l=(m.blocks||[]).filter(b=>b.on!==false).map(b=>b.id);if(!l.length)l=['cat','hc','srv','con'];if(m.catFirst!==false&&l.includes('cat'))l=['cat'].concat(l.filter(x=>x!=='cat'));return l}
function pubNav(){
 const nm={hc:t('hcNav'),srv:t('nvSrv'),cat:t('catalogo'),con:t('contacto')};
 const l=blockOrder().filter(id=>nm[id]&&(id!=='hc'||true));
 return '<nav class="pnav" aria-label="Secciones">'+l.map(id=>'<button type="button" class="nvb" data-a="goSec" data-id="'+id+'">'+esc(nm[id])+'</button>').join('')+'</nav>'
}
function pubFoot(){
 const o=PUB.org;const maps=safeUrl(o.maps);
 return '<footer class="pfoot"><div class="fg"><div><h4>'+esc(o.legal)+'</h4><p>'+esc(o.name)+'</p><p>CUIT '+esc(o.cuit)+'</p><p style="margin-top:10px">'+esc(o.addr)+', '+esc(o.city)+'</p><p style="margin-top:10px"><small>'+t('legal')+'</small></p></div>'+
 '<div><h4>'+t('contacto')+'</h4><p><a href="mailto:'+esc(o.email)+'">'+esc(o.email)+'</a></p>'+(o.ig?'<p><a href="https://www.instagram.com/'+esc(o.ig)+'" target="_blank" rel="noopener noreferrer">@'+esc(o.ig)+'</a></p>':'')+(o.fb?'<p>Facebook: '+esc(o.fb)+'</p>':'')+(maps?'<p><a href="'+esc(maps)+'" target="_blank" rel="noopener noreferrer">'+ic('pin')+' '+t('ubic')+'</a></p>':'')+'</div>'+
 '<div><h4>'+t('acceso')+'</h4><p><a href="#/acceso">'+t('acceso')+'</a></p></div></div></footer>'+creditCard()
}
function creditCard(){
 return '<div class="pcred" id="creditos"><div class="credit" style="text-align:center">'+vbBanner('620px','Hola '+RAVE.name+', te escribo desde el sitio de '+(PUB.org.brand||PUB.org.name)+'.')+'<p style="margin:14px 0 0;font-size:13px">'+t('creditT')+' <b>'+esc(RAVE.name)+'</b> · '+t('creditWa')+' <a href="https://wa.me/'+esc(RAVE.wa)+'?text='+encodeURIComponent(VB_MSG)+'" target="_blank" rel="noopener noreferrer">'+esc(RAVE.tel)+'</a> · <a href="mailto:'+esc(RAVE.mail)+'">'+esc(RAVE.mail)+'</a>'+(RAVE.slogan?'<br><i>“'+esc(RAVE.slogan)+'”</i>':'')+'</p></div></div>'
}
function cartBar(){const c=cartTotal();if(!c.count)return'';return '<div class="cartbar"><span><b>'+c.count+'</b> · '+money(c.total)+'</span><button class="btn y sm" data-a="openCart">'+ic('cart')+t('carrito')+'</button></div>'}
function fabBtn(){return '<button class="fab" data-a="share" aria-label="'+t('compartir')+'">'+ic('share')+'</button>'}

/* ---------- bloque: Historia clínica · solicitud + turnero ---------- */
function fld(id,label,type,extra,help){return '<label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" '+(extra||'')+'><div class="fe" id="e_'+id+'" role="alert"></div>'+(help?'<div class="sub" style="margin-top:-2px">'+help+'</div>':'')}
function pendingBox(){return '<div class="notice"><div><b>'+t('hcPend')+'</b><br>'+t('hcPendP')+'</div><a class="btn wa" target="_blank" rel="noopener noreferrer" href="'+waUrl(PUB.org.wa,'Hola! Quiero consultar por la '+(PUB.org.hcName||'solicitud'))+'">'+ic('wa')+t('hcWa')+'</a></div>'}
function hcForm(){
 if(!CLOUD.on)return pendingBox();
 if(HCRES)return '<div class="c" style="border:2px solid var(--ok)" role="status"><h2>'+t('hcOkT')+'</h2><p style="margin:10px 0">'+t('hcOkP')+' <b class="tok" id="hcLeg" style="font-size:20px">'+esc(HCRES.legajo)+'</b></p><p class="sub">'+t('hcOkN')+'</p><div class="row" style="margin-top:12px"><button class="btn g" data-a="hcAgain">'+t('hcAgain')+'</button></div></div>';
 if(!HCN)HCN=uid()+rndStr(8,LA);
 const est=['none','prog','vig','venc','otro'].map(k=>'<option value="'+k+'">'+t('est_'+k)+'</option>').join('');
 return '<form id="hcf" novalidate autocomplete="on" onsubmit="return false"><div class="g2">'+
 '<div>'+fld('h_nombre',t('fNombre'),'text','maxlength="60" autocomplete="given-name"')+'</div><div>'+fld('h_apellido',t('fApellido'),'text','maxlength="60" autocomplete="family-name"')+'</div>'+
 '<div>'+fld('h_fnac',t('fFnac'),'date','autocomplete="bday" max="'+today()+'" data-in="hcAge"')+'</div><div>'+fld('h_wa',t('fWa'),'tel','maxlength="20" autocomplete="tel" inputmode="tel" placeholder="387 15 123 4567"')+'</div>'+
 '<div><label for="h_dt">'+t('fDocTipo')+'</label><select id="h_dt"><option value="DNI">DNI</option><option value="CUIT">CUIT</option><option value="CUIL">CUIL</option></select></div><div>'+fld('h_doc',t('fDoc'),'text','maxlength="14" inputmode="numeric" autocomplete="off"',t('fDocAyuda'))+'</div>'+
 '<div>'+fld('h_email',t('fEmail'),'email','maxlength="80" autocomplete="email"')+'</div><div>'+fld('h_cp',t('fCp'),'text','maxlength="10" autocomplete="postal-code"')+'</div>'+
 '<div>'+fld('h_dom',t('fDom'),'text','maxlength="120" autocomplete="street-address"')+'</div><div>'+fld('h_ocup',t('fOcup'),'text','maxlength="60"')+'</div>'+
 '<div>'+fld('h_os',t('fOs'),'text','maxlength="60"')+'</div><div><label for="h_est">'+t('fEstado')+'</label><select id="h_est">'+est+'</select></div></div>'+
 '<label for="h_motivo">'+t('fMotivo')+'</label><textarea id="h_motivo" maxlength="400" style="min-height:70px"></textarea><div class="fe" id="e_h_motivo"></div>'+
 '<label for="h_dudas">'+t('fDudas')+'</label><textarea id="h_dudas" maxlength="400" style="min-height:60px"></textarea>'+
 '<div id="h_tutor" hidden class="c" style="background:#faf9f5;margin-top:12px;box-shadow:none"><h3>'+t('tutorT')+'</h3><p class="sub" style="margin:4px 0">'+t('menorAviso')+'</p><div class="g2"><div>'+fld('h_tn',t('tutorN'),'text','maxlength="80"')+'</div><div>'+fld('h_tp',t('tutorP'),'text','maxlength="40"')+'</div><div>'+fld('h_td',t('tutorD'),'text','maxlength="14" inputmode="numeric"')+'</div><div>'+fld('h_tw',t('tutorW'),'tel','maxlength="20" inputmode="tel"')+'</div></div></div>'+
 '<label class="chk" for="h_ci"><input type="checkbox" id="h_ci"><span>'+esc(mt('cInf'))+'</span></label><div class="fe" id="e_h_ci" role="alert"></div>'+
 '<label class="chk" for="h_cc" id="h_ccl"><input type="checkbox" id="h_cc"><span>'+esc(mt('cComm'))+'</span></label>'+
 '<input class="hon" type="text" id="h_web" tabindex="-1" autocomplete="off" aria-hidden="true">'+
 '<div class="fe" id="h_err" role="alert"></div><button type="button" class="btn y lg" style="width:100%;margin-top:8px" data-a="hcSend" id="h_send">'+t('hcSend')+'</button></form>'
}
function tnForm(){
 if(!CLOUD.on)return pendingBox();
 if(TNRES)return '<div class="c" style="border:2px solid var(--ok)" role="status"><h2>'+t('tnOkT')+'</h2><p class="sub" style="margin:8px 0">'+t('tnOkP')+'</p><div class="row"><button class="btn g" data-a="tnAgain">'+t('hcAgain')+'</button></div></div>';
 if(!TNN)TNN=uid()+rndStr(8,LA);
 return '<form id="tnf" novalidate onsubmit="return false">'+fld('t_id',t('tnIdent'),'text','maxlength="80" autocomplete="off"')+fld('t_wa',t('fWa'),'tel','maxlength="20" inputmode="tel" autocomplete="tel"')+fld('t_motivo',t('tnMotivo'),'text','maxlength="120"')+
 '<div class="g2"><div>'+fld('t_dia',t('tnDia'),'date','min="'+today()+'"')+'</div><div><label for="t_fr">'+t('tnFranja')+'</label><select id="t_fr"><option value="man">'+t('tnMan')+'</option><option value="tar">'+t('tnTar')+'</option></select></div></div>'+
 '<label for="t_nota">'+t('tnNota')+'</label><textarea id="t_nota" maxlength="200" style="min-height:56px"></textarea><input class="hon" type="text" id="t_web" tabindex="-1" autocomplete="off" aria-hidden="true"><div class="fe" id="t_err" role="alert"></div>'+
 '<button type="button" class="btn y lg" style="width:100%;margin-top:8px" data-a="tnSend" id="t_send">'+t('tnSend')+'</button></form>'
}
function blockHc(){
 const o=PUB.org;const nm=o.hcName||t('hcTitle');
 return '<section class="psec" id="sec_hc"><h2 style="font-size:26px">'+esc(LANG==='es'?nm:t('hcTitle'))+'</h2><p class="sub" style="margin:8px 0">'+esc(mt('hcIntro'))+'</p>'+
 '<div class="tabs" role="tablist"><button role="tab" id="tab_new" aria-selected="'+(HCTAB==='new')+'" data-a="hcTab" data-id="new">'+t('hcTab1')+'</button><button role="tab" id="tab_old" aria-selected="'+(HCTAB==='old')+'" data-a="hcTab" data-id="old">'+t('hcTab2')+'</button></div>'+
 '<div class="c" role="tabpanel">'+(HCTAB==='new'?hcForm():
   (o.turnero===false?'':'<h3 style="font-size:18px">'+t('tnTitle')+'</h3><p class="sub" style="margin:6px 0 10px">'+esc(mt('tnIntro'))+'</p>'+tnForm()+'<hr style="border:0;border-top:1px solid var(--line);margin:18px 0">')+
   '<a class="btn wa lg" style="width:100%" target="_blank" rel="noopener noreferrer" href="'+waUrl(o.wa,'Hola! Ya soy paciente/socio/a de '+o.name+'. Quiero consultar por un turno.')+'">'+ic('wa')+t('tnWa')+'</a>')+
 '</div></section>'
}
function blockSrv(){
 const o=PUB.org;const sv=[['clip',t('s1'),t('s1d')],['heart',t('s2'),t('s2d')],['users',t('s3'),t('s3d')],['shield',t('s4'),t('s4d')]];
 return '<section class="psec" id="sec_srv"><h2 style="font-size:26px;margin-bottom:16px">'+t('servicios')+'</h2><div class="pgrid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">'+sv.map(s=>'<div class="c">'+ic(s[0])+'<h3 style="margin:10px 0 4px">'+s[1]+'</h3><p class="sub">'+s[2]+'</p></div>').join('')+'</div>'+
 '<div class="c pink" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between"><div><span class="lbl">'+t('membresia')+'</span><div class="kpi">'+money(o.membership)+'</div><span>'+t('donvol')+'</span></div><button class="btn y lg" data-a="goSec" data-id="hc">'+t('unir')+'</button></div></section>'
}
function blockCat(){
 const p=PUB.products,cats=PUB.cats.filter(c=>p.some(x=>x.cat===c.id));
 const list=p.filter(x=>CATSEL==='all'||x.cat===CATSEL);
 return '<section class="psec" id="sec_cat"><div class="row" style="margin-bottom:6px"><h2 style="font-size:26px">'+t('catalogo')+'</h2>'+(PUB.ejemplo?'<span class="badge warn">'+t('ejemplo')+'</span>':'')+'</div>'+(PUB.ejemplo?'<p class="exb" role="note">'+t('ejemploaviso')+'</p>':'')+'<p class="sub" style="margin-top:8px">'+t('donvol')+'</p><div class="chips" style="margin:12px 0 18px"><button class="chip'+(CATSEL==='all'?' on':'')+'" data-a="cat" data-id="all">'+t('todos')+'</button>'+cats.map(c=>'<button class="chip'+(CATSEL===c.id?' on':'')+'" data-a="cat" data-id="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('')+'</div>'+(list.length?'<div class="pgrid" id="pgrid">'+list.map(pcard).join('')+'</div>':'<p class="sub" id="pgrid" style="padding:18px 0">'+(CLOUD.on&&!PUB.ts?t('catCargando'):t('catVacio'))+'</p>')+'</section>'
}
function blockCon(){
 const o=PUB.org,open=openNow(o),maps=safeUrl(o.maps);
 return '<section class="psec" id="sec_con"><div class="g2" style="gap:14px"><div class="c"><h2>'+t('consulta')+'</h2><label for="qn">'+t('nombre')+'</label><input id="qn" autocomplete="name" maxlength="80"><label for="qm">'+t('mensaje')+'</label><textarea id="qm" maxlength="500"></textarea><button class="btn wa lg" style="margin-top:14px;width:100%" data-a="sendCons">'+ic('wa')+t('enviarc')+'</button><p class="sub" style="margin-top:10px">'+(LANG==='es'?'No pedimos documento ni datos de salud por este medio.':'We do not ask for ID or health data through this channel.')+'</p></div>'+
 '<div class="c"><h2>'+t('horarios')+'</h2><p style="margin:8px 0">'+esc(o.hours)+'</p><span class="badge '+(open?'ok':'bad')+'">'+(open?t('abierto'):t('cerrado'))+'</span><p style="margin-top:14px"><b>'+esc(o.addr)+'</b><br>'+esc(o.city)+'</p>'+(maps?'<p style="margin-top:10px"><a class="btn g sm" href="'+esc(maps)+'" target="_blank" rel="noopener noreferrer">'+ic('pin')+t('ubic')+'</a></p>':'')+'</div></div></section>'
}
function viewHome(){
 const o=PUB.org;const B={hc:blockHc,srv:blockSrv,cat:blockCat,con:blockCon};
 const hero='<section class="hero"><div class="in"><div><span class="badge dk">'+esc(o.city)+'</span><h1 style="margin-top:14px">'+(LANG==='es'?'Cannabis medicinal con <em>acompañamiento</em> profesional':'Medical cannabis with professional <em>support</em>')+'</h1><p style="margin:16px 0 22px;font-size:17px;max-width:520px">'+esc(mt('hacemos'))+'</p><div class="row">'+(blockOn('cat')?'<button class="btn lg y" data-a="goSec" data-id="cat">'+ic('grid')+t('catalogo')+'</button>':'')+(blockOn('hc')?'<button class="btn lg'+(blockOn('cat')?' g':'')+'" data-a="goSec" data-id="hc">'+esc(t('hcNav'))+'</button>':'')+'</div></div><div style="display:grid;place-items:center"><img class="lg-img" alt="'+esc(o.name)+'" src="'+ASSETS.logo+'"></div></div></section>';
 return pubBar()+pubNav()+hero+blockOrder().map(id=>B[id]?B[id]():'').join('')+pubFoot()+cartBar()+fabBtn()
}
function viewProduct(){
 const p=PUB.products.find(x=>x.id===ROUTE.id);
 if(!p)return pubBar()+'<section class="psec"><h1>404</h1><p><a class="btn" href="#/">'+t('volver')+'</a></p></section>'+pubFoot();
 const inC=CART[p.id]||0;
 return pubBar()+'<section class="psec"><a class="btn g sm" href="#/">'+ic('chev')+t('volver')+'</a><div class="g2" style="gap:24px;margin-top:16px;align-items:start"><div class="pcard"><div class="im'+(p.unit==='g'?' tall':'')+'" data-a="zoom" data-id="'+esc(p.id)+'">'+(img(p.img)?'<img alt="'+esc(p.name)+'" src="'+img(p.img)+'">':'')+'</div></div><div>'+
 (p.rp?'<span class="badge m">'+t('rp')+'</span>':'')+'<h1 style="margin:10px 0">'+esc(p.name)+'</h1><div class="lbl">'+t('donsug')+'</div><div class="kpi">'+money(p.price)+(p.unit==='g'?' <small class="mut" style="font-size:16px">/ g</small>':'')+'</div><p class="sub">'+t('donvol')+'</p><p style="margin:14px 0 20px;font-size:16px">'+esc(p.desc)+'</p>'+
 (p.soldout?'<span class="badge bad">'+t('sinstock')+'</span>':'<div class="row"><button class="btn y lg" data-a="addCart" data-id="'+esc(p.id)+'">'+ic('plus')+t('agregar')+(inC?' ('+qty(inC,p.unit)+')':'')+'</button><button class="btn g lg" data-a="share">'+ic('share')+t('compartir')+'</button></div>')+
 '<p class="sub" style="margin-top:20px">'+t('legal')+'</p></div></div></section>'+pubFoot()+cartBar()+fabBtn()
}
function renderPublic(){
 if(PUB.org.ageGate&&!ageOk()){root.className='';root.innerHTML='<div class="auth"><div class="c" style="text-align:center"><img alt="" src="'+ASSETS.logo+'" style="width:120px;border-radius:26px;margin:0 auto 14px;display:block"><h1>'+t('edad')+'</h1><p class="sub" style="margin:12px 0 20px">'+t('edadsub')+'</p><div class="row" style="justify-content:center"><button class="btn lg y" data-a="ageYes">'+t('mayor')+'</button><button class="btn lg g" data-a="ageNo">'+t('menor')+'</button></div><p class="sub" style="margin-top:16px"><small>'+t('dev')+' '+esc(RAVE.name)+'</small></p></div></div>';return}
 root.className='pub';
 document.documentElement.lang=LANG;
 root.innerHTML=ROUTE.n==='p'?viewProduct():viewHome();
 ldJson();setMeta(ROUTE.n==='p'?((PUB.products.find(x=>x.id===ROUTE.id)||{}).name||'')+' · '+(PUB.org.brand||PUB.org.name):(PUB.org.brand||'Medicinal Terps')+' · '+PUB.org.name);
}
function refreshCart(){const cb=$('.cartbar');const h=cartBar();if(cb)cb.remove();if(h&&root.className==='pub')root.insertAdjacentHTML('beforeend',h)}
function cartModal(){
 const rows=Object.keys(CART).filter(k=>!k.startsWith('__')).map(id=>{const p=PUB.products.find(x=>x.id===id);if(!p)return'';return '<div class="li"><div style="min-width:0"><b>'+esc(p.name)+'</b><div class="sub">'+t('donsug')+' '+money(p.price)+(p.unit==='g'?' / g':'')+'</div></div><div class="row"><button class="ib" data-a="cartMinus" data-id="'+esc(id)+'" aria-label="-">−</button><b style="min-width:54px;text-align:center">'+qty(CART[id],p.unit)+'</b><button class="ib" data-a="cartPlus" data-id="'+esc(id)+'" aria-label="+">+</button></div></div>'}).join('');
 const c=cartTotal();
 if(!c.count){closeModal();return}
 modal('<h2>'+t('carrito')+'</h2><div class="list" style="margin:10px 0">'+rows+'</div><div class="row" style="justify-content:space-between;font-size:20px"><b>'+t('total')+'</b><b>'+money(c.total)+'</b></div><label for="cn">'+t('nombre')+'</label><input id="cn" maxlength="80" autocomplete="name" value="'+esc(CART.__name||'')+'"><label for="cx">'+(LANG==='es'?'Aclaraciones (opcional)':'Notes (optional)')+'</label><textarea id="cx" maxlength="300" style="min-height:60px">'+esc(CART.__note||'')+'</textarea><p class="sub" style="margin-top:8px">'+(LANG==='es'?'Es una solicitud: se envía por WhatsApp y la confirma el equipo. Las donaciones son voluntarias y la dispensación requiere REPROCANN vigente.':'This is a request: it is sent by WhatsApp and confirmed by the team. Donations are voluntary and dispensing requires a valid REPROCANN registration.')+'</p><div class="row" style="margin-top:14px"><button class="btn wa lg sp" data-a="sendOrder">'+ic('wa')+t('enviar')+'</button><button class="btn g" data-a="cartClear">'+t('vaciar')+'</button><button class="btn g" data-a="mclose" aria-label="Cerrar">'+ic('x')+'</button></div>')
}
A.ageYes=()=>{ageSet();route()};
A.ageNo=()=>{root.innerHTML='<div class="auth"><div class="c" style="text-align:center"><h1>'+(LANG==='es'?'Lo sentimos':'Sorry')+'</h1><p class="sub" style="margin-top:10px">'+(LANG==='es'?'Este sitio es sólo para mayores de 18 años.':'This site is for adults (18+) only.')+'</p></div></div>'};
A.lang=()=>{LANG=LANG==='es'?'en':'es';try{localStorage.setItem('terps_lang',LANG)}catch(e){}HCRES=null;route()};
A.cat=el=>{CATSEL=el.dataset.id;const y=window.scrollY;route();window.scrollTo(0,y)};
A.goSec=el=>{const x=$('#sec_'+el.dataset.id);if(x)x.scrollIntoView({behavior:'smooth',block:'start'})};
A.addCart=el=>{const p=PUB.products.find(x=>x.id===el.dataset.id);if(!p||p.soldout)return;CART[p.id]=r3((CART[p.id]||0)+stepOf(p));toast(p.name.slice(0,40)+' +'+qty(stepOf(p),p.unit));if(ROUTE.n==='p')renderPublic();else refreshCart()};
A.cartPlus=el=>{const p=PUB.products.find(x=>x.id===el.dataset.id);CART[p.id]=r3(CART[p.id]+stepOf(p));cartModal();refreshCart()};
A.cartMinus=el=>{const p=PUB.products.find(x=>x.id===el.dataset.id);CART[p.id]=r3(CART[p.id]-stepOf(p));if(CART[p.id]<=0)delete CART[p.id];cartModal();refreshCart()};
A.cartClear=()=>{for(const k of Object.keys(CART))delete CART[k];closeModal();refreshCart();renderPublic()};
A.openCart=()=>cartModal();
A.sendOrder=()=>{
 const name=($('#cn')||{}).value||'';CART.__name=name;CART.__note=($('#cx')||{}).value||'';
 let txt='Hola '+PUB.org.name+'! Quiero hacer esta solicitud:\n';
 for(const id of Object.keys(CART)){if(id.startsWith('__'))continue;const p=PUB.products.find(x=>x.id===id);if(p)txt+='• '+qty(CART[id],p.unit)+(p.unit==='g'?'':' x')+' '+p.name+' · donación sugerida '+money(r2(p.price*CART[id]))+'\n'}
 txt+='Donación sugerida total: '+money(cartTotal().total)+'\n';if(name.trim())txt+='Nombre: '+name.trim()+'\n';if(CART.__note.trim())txt+='Aclaraciones: '+CART.__note.trim()+'\n';
 window.open(waUrl(PUB.org.wa,txt),'_blank','noopener');
};
A.sendCons=()=>{const n=($('#qn').value||'').trim(),m=($('#qm').value||'').trim();if(!m){toast(LANG==='es'?'Escribí tu consulta':'Write your message');return}window.open(waUrl(PUB.org.wa,'Hola! '+(n?'Soy '+n+'. ':'')+m),'_blank','noopener')};
A.zoom=el=>{const p=PUB.products.find(x=>x.id===el.dataset.id);if(!p||!img(p.img))return;modal('<div style="text-align:center"><img alt="'+esc(p.name)+'" src="'+img(p.img)+'" style="max-width:100%;max-height:72vh;border-radius:16px"><h3 style="margin-top:10px">'+esc(p.name)+'</h3><button class="btn g" style="margin-top:10px" data-a="mclose">'+(LANG==='es'?'Cerrar':'Close')+'</button></div>')};
A.share=async()=>{const url=ROUTE.n==='p'?pubUrl()+'#/p/'+ROUTE.id:pubUrl();const title=PUB.org.brand||PUB.org.name;
 if(navigator.share){try{await navigator.share({title,url});return}catch(e){if(e&&e.name==='AbortError')return}}
 let qr='';try{const q=qrcode(0,'M');q.addData(url);q.make();qr=q.createSvgTag({cellSize:5,margin:0,scalable:true})}catch(e){}
 modal('<h2>'+t('compartir')+'</h2><p class="sub" style="margin:6px 0 12px">'+esc(url)+'</p><div style="text-align:center">'+(qr?'<div class="qrbox" style="width:220px">'+qr+'</div>':'')+'</div><div class="row" style="margin-top:14px"><button class="btn y sp" data-a="copyLink" data-v="'+esc(url)+'">'+ic('copy')+t('copiar')+'</button><button class="btn g" data-a="mclose" aria-label="Cerrar">'+ic('x')+'</button></div>')};
A.copyLink=async el=>{try{await navigator.clipboard.writeText(el.dataset.v);toast(t('copiado'))}catch(e){toast(el.dataset.v)}};

/* ---------- envío de formularios públicos (al servidor; nunca se declara éxito sin su confirmación) ---------- */
let SUBLOG=[];
function subLimit(){
 try{const a=JSON.parse(localStorage.getItem('tv_sub')||'[]');if(Array.isArray(a))SUBLOG=a.filter(x=>typeof x==='number')}catch(e){}
 const c=now()-600000;SUBLOG=SUBLOG.filter(x=>x>c);return SUBLOG.length>=3}
function subMark(){SUBLOG.push(now());try{localStorage.setItem('tv_sub',JSON.stringify(SUBLOG))}catch(e){}}
async function rpcPublic(fn,body){
 const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),15000);
 try{const r=await fetch(CLOUD.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{'apikey':CLOUD.key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});
  const j=await r.json().catch(()=>null);return{ok:r.ok,status:r.status,j}}
 catch(e){return{ok:false,status:0,j:null}}finally{clearTimeout(to)}}
function rpcErrTxt(r){const m=String((r&&r.j&&(r.j.message||r.j.code))||'');
 if(/limite|limit/.test(m))return t('hcLimit');if(/datos_invalidos|invalid/.test(m))return t('hcInvalid');if(/no_disponible/.test(m))return t('hcPendP');return t('hcErr')}
const val=id=>{const e=document.getElementById(id);return e?String(e.value||'').trim():''};
const chk=id=>{const e=document.getElementById(id);return !!(e&&e.checked)};
function setErr(id,msg){const e=document.getElementById('e_'+id),i=document.getElementById(id);if(e)e.textContent=msg||'';if(i){if(msg)i.classList.add('err');else i.classList.remove('err')}}
function ageOf(ymd,ref){const m=String(ymd||'').match(/^(\d{4})-(\d\d)-(\d\d)$/);if(!m)return null;const d=new Date(ref==null?now():ref);let a=d.getFullYear()-(+m[1]);if(d.getMonth()+1<+m[2]||(d.getMonth()+1===+m[2]&&d.getDate()<+m[3]))a--;return a}
function validBday(v){const m=String(v||'').match(/^(\d{4})-(\d\d)-(\d\d)$/);if(!m)return false;const y=+m[1],mo=+m[2],d=+m[3];if(y<1900||mo<1||mo>12||d<1||d>31)return false;const dt=new Date(y,mo-1,d);if(dt.getMonth()!==mo-1)return false;return v<=today()}
const nameOk=s=>s.length>=2&&s.length<=60&&/\p{L}/u.test(s)&&!/[<>{}\[\]\\\/=;]/.test(s);
const waOk=s=>{const d=s.replace(/\D/g,'');return d.length>=10&&d.length<=15&&last10(d).length===10};
IN.hcAge=()=>{const a=ageOf(val('h_fnac'));const tu=$('#h_tutor'),cl=$('#h_ccl');const minor=a!=null&&a<18&&validBday(val('h_fnac'));if(tu)tu.hidden=!minor;if(cl){cl.style.display=minor?'none':'';if(minor){const c=$('#h_cc');if(c)c.checked=false}}};
function collectHc(){
 const E={},D={};
 D.nombre=val('h_nombre');D.apellido=val('h_apellido');D.fnac=val('h_fnac');D.wa=val('h_wa');D.docTipo=val('h_dt')||'DNI';D.email=val('h_email');D.cp=val('h_cp');D.domicilio=val('h_dom');D.ocupacion=val('h_ocup');D.obraSocial=val('h_os');D.motivo=val('h_motivo');D.estado=val('h_est')||'none';D.dudas=val('h_dudas');
 if(!nameOk(D.nombre))E.h_nombre=t('eNombre');if(!nameOk(D.apellido))E.h_apellido=t('eApellido');
 if(!validBday(D.fnac))E.h_fnac=t('eFnac');
 if(!waOk(D.wa))E.h_wa=t('eWa');
 const vd=valDoc(D.docTipo,val('h_doc'));if(!vd.ok)E.h_doc=vd.msg;else{D.docTipo=vd.tipo;D.doc=vd.digits}
 if(D.email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(D.email))E.h_email=(LANG==='es'?'El correo no es válido.':'The email is not valid.');
 const age=ageOf(D.fnac);const minor=!E.h_fnac&&age!=null&&age<18;
 D.menor=minor;
 if(minor){D.tutor={nombre:val('h_tn'),parentesco:val('h_tp'),docTipo:'DNI',doc:val('h_td').replace(/\D/g,''),wa:val('h_tw')};
  const okT=nameOk(D.tutor.nombre)&&((D.tutor.wa&&waOk(D.tutor.wa))||D.tutor.doc.length>=6);
  if(!okT)E.h_tn=t('eTutor');
  if(D.tutor.doc){const v=valDoc('DNI',D.tutor.doc);if(!v.ok)E.h_td=v.msg;else D.tutor.doc=v.digits}}
 D.consentInf=chk('h_ci');if(!D.consentInf)E.h_ci=t('eConsent');
 D.consentComm=minor?false:chk('h_cc');
 return{E,D}}
A.hcTab=el=>{HCTAB=el.dataset.id;const y=window.scrollY;renderPublic();window.scrollTo(0,y)};
A.hcAgain=()=>{HCRES=null;HCN='';renderPublic();A.goSec({dataset:{id:'hc'}})};
A.tnAgain=()=>{TNRES=null;TNN='';renderPublic()};
A.hcSend=async()=>{
 if(HCBUSY)return;
 for(const id of ['h_nombre','h_apellido','h_fnac','h_wa','h_doc','h_email','h_ci','h_tn','h_td'])setErr(id,'');
 const he=$('#h_err');if(he)he.textContent='';
 if(val('h_web')){if(he)he.textContent=t('hcErr');return}
 const{E,D}=collectHc();const keys=Object.keys(E);
 if(keys.length){keys.forEach(k=>setErr(k,E[k]));if(he)he.textContent=t('hcInvalid');const f=document.getElementById(keys[0]);if(f)try{f.focus()}catch(e){}return}
 if(subLimit()){if(he)he.textContent=t('hcLimit');return}
 HCBUSY=true;const b=$('#h_send');if(b){b.disabled=true;b.textContent=t('hcSending')}
 const r=await rpcPublic('submit_solicitud',{p_tipo:'hc',p_nonce:HCN,p_payload:Object.assign({},D,{lang:LANG,consentVer:1,ts:now()})});
 HCBUSY=false;
 if(r.ok&&r.j&&r.j.ok&&r.j.legajo){subMark();HCRES={legajo:String(r.j.legajo)};renderPublic();A.goSec({dataset:{id:'hc'}});return}
 const he2=$('#h_err'),b2=$('#h_send');if(b2){b2.disabled=false;b2.textContent=t('hcSend')}
 if(he2)he2.textContent=rpcErrTxt(r)};
A.tnSend=async()=>{
 if(TNBUSY)return;
 for(const id of ['t_id','t_wa','t_motivo','t_dia'])setErr(id,'');
 const te2=$('#t_err');if(te2)te2.textContent='';
 if(val('t_web')){if(te2)te2.textContent=t('hcErr');return}
 const D={ident:val('t_id'),wa:val('t_wa'),motivo:val('t_motivo'),dia:val('t_dia'),franja:val('t_fr')||'man',nota:val('t_nota')};const E={};
 if(D.ident.length<2||D.ident.length>80)E.t_id=t('eIdent');
 if(!waOk(D.wa))E.t_wa=t('eWa');
 if(D.motivo.length<2)E.t_motivo=t('eMotivo');
 if(!/^\d{4}-\d\d-\d\d$/.test(D.dia)||D.dia<today()||D.dia>dkey(now()+365*864e5))E.t_dia=t('eDia');
 const keys=Object.keys(E);if(keys.length){keys.forEach(k=>setErr(k,E[k]));if(te2)te2.textContent=t('hcInvalid');return}
 if(subLimit()){if(te2)te2.textContent=t('hcLimit');return}
 TNBUSY=true;const b=$('#t_send');if(b){b.disabled=true;b.textContent=t('hcSending')}
 const r=await rpcPublic('submit_solicitud',{p_tipo:'turno',p_nonce:TNN,p_payload:Object.assign({},D,{lang:LANG})});
 TNBUSY=false;
 if(r.ok&&r.j&&r.j.ok){subMark();TNRES={ok:1};renderPublic();return}
 const b2=$('#t_send'),e2=$('#t_err');if(b2){b2.disabled=false;b2.textContent=t('tnSend')}
 if(e2)e2.textContent=rpcErrTxt(r)};
