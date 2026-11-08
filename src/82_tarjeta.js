/* ===== Tarjeta del Club en el celular · 2026-11-08 (VB 4.6 / 4.25, versión ONG) =====
   - Cada socio/a puede tener una tarjeta digital: identificador secreto (96 bits) + clave (192 bits).
   - El celular muestra un QR y un código de 4 cifras que CAMBIAN CADA 2 MINUTOS (HMAC con la clave de la tarjeta).
     El mostrador lo valida con la misma clave, un solo uso; un sello por día por persona (como siempre).
   - También se sella con el código manual (6 últimos caracteres del legajo + 4 cifras), por DNI o por NFC (fijo).
   - La tarjeta se genera en el celular al completar el formulario web (si es mayor de edad) o la emite el
     equipo y se envía como enlace personal (#tarjeta=…). El enlace es una llave: quien lo tenga ve la tarjeta.
   - El estado público (club_estado) nunca devuelve nombre, documento, WhatsApp ni la clave.
   - La tarjeta vive en el celular (almacenamiento local + copia en IndexedDB): si se borra el navegador,
     el local reenvía el enlace o emite una nueva (la anterior deja de valer). */
const CARD_WIN=120000;
const cardWin=t=>Math.floor((t==null?now():t)/CARD_WIN);
async function cardHmac(sec,msg){const k=await crypto.subtle.importKey('raw',te.encode(sec),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,te.encode(msg)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function cardCode(card,w){const h=await cardHmac(card.sec,'codigo|'+card.id+'|'+w);return String(parseInt(h.slice(0,8),16)%10000).padStart(4,'0')}
const cardNew=()=>({id:b64u(rnd(12)),sec:b64u(rnd(24)),t:now()});
const cardOk=c=>!!(c&&/^[A-Za-z0-9_-]{14,40}$/.test(c.id||'')&&/^[A-Za-z0-9_-]{24,64}$/.test(c.sec||''));
const legSuf=s=>String(s&&s.legajo||'').slice(-6).toUpperCase();
function cardEnsure(s){if(!cardOk(s.card)){s.card=cardNew();audit('tarjeta_emitida',{legajo:s.legajo})}return s.card}
const cardLink=s=>pubUrl()+'#tarjeta='+s.card.id+'.'+s.card.sec;
/* ---------- validación en el mostrador ---------- */
async function cardMatchCode(s,code){if(!cardOk(s.card))return false;const w=cardWin();for(const x of [w,w-1,w+1]){if(await cardCode(s.card,x)===code){const k=x+':'+code;s.cardUse=Array.isArray(s.cardUse)?s.cardUse.slice(-6):[];if(s.cardUse.includes(k))return 'usado';s.cardUse.push(k);return true}}return false}
/* devuelve {s} o {err} a partir de lo que se escaneó o tipeó */
async function clubResolve(raw){
 const v=String(raw||'').trim();let m;
 if((m=v.match(/^TERPS2\|([A-Za-z0-9_-]{14,40})\|(\d{4})$/))){const s=S.socios.find(x=>x.card&&x.card.id===m[1]);if(!s)return{err:'Tarjeta desconocida o reemplazada: pedile que muestre la más nueva.'};const r=await cardMatchCode(s,m[2]);if(r==='usado')return{err:'Ese código ya se usó: esperá al próximo (cambia cada 2 minutos).'};if(!r)return{err:'El código venció: pedile que actualice la tarjeta en el celular.'};return{s,medio:'qr'}}
 if((m=v.match(/^TERPS2N\|([A-Za-z0-9_-]{14,40})$/))){const s=S.socios.find(x=>x.card&&x.card.id===m[1]);return s?{s,medio:'nfc'}:{err:'Tarjeta NFC desconocida o dada de baja.'}}
 const u=v.toUpperCase().replace(/[\s-]/g,'');
 if((m=u.match(/^([0-9A-Z]{6})(\d{4})$/))&&/[A-Z]/.test(m[1])){const s=S.socios.find(x=>legSuf(x)===m[1]);if(!s)return{err:'No hay ningún socio con ese código.'};const r=await cardMatchCode(s,m[2]);if(r==='usado')return{err:'Ese código ya se usó: esperá al próximo.'};if(!r)return{err:'El código de 4 cifras no coincide o venció.'};return{s,medio:'codigo'}}
 const d=v.replace(/\D/g,'');
 if(/^\d{7,11}$/.test(v.replace(/[.\s]/g,''))&&d.length>=7){const l=S.socios.filter(x=>x.doc===d);if(!l.length)return{err:'No hay ningún socio con ese documento.'};if(l.length>1)return{err:'Hay '+l.length+' personas con ese documento: elegila por nombre.'};return{s:l[0],medio:'dni'}}
 return null}
/* ---------- tarjeta digital desde la ficha ---------- */
A.socioCard=async el=>{const s=socioById(el.dataset.id);if(!s)return;const c=cardEnsure(s);persist();
 const tok=await cardToken('TS',s);persist();const link=cardLink(s);
 modal('<h2>Tarjeta del Club · '+esc(s.name)+'</h2><p class="sub" style="margin:4px 0 10px">Legajo '+esc(s.legajo)+'</p>'+
 '<div class="c" style="box-shadow:none;border:1px solid var(--line)"><h3 style="font-size:16px">En el celular (recomendado)</h3><p class="sub" style="margin:6px 0">La tarjeta muestra un QR y un código que cambian cada 2 minutos. Mandale el enlace personal: al abrirlo queda guardada en su celular.</p><div class="row" style="margin-top:8px">'+(s.wa?'<a class="btn wa" target="_blank" rel="noopener noreferrer" data-a="cardWa" data-id="'+esc(s.id)+'" href="'+esc(waUrl(s.wa,'Hola '+(s.nombre||'')+', esta es tu tarjeta del Club de '+(S.org.brand||'')+'. Abrila desde tu celular y queda guardada: '+link+' (es personal: no la compartas).'))+'">'+ic('wa')+'Enviar por WhatsApp</a>':'')+'<button class="btn g" data-a="cardCopy" data-id="'+esc(s.id)+'">'+ic('copy')+'Copiar enlace</button><button class="btn g" data-a="nfcWrite" data-v="TERPS2N|'+esc(c.id)+'">'+ic('nfc')+'Grabar etiqueta NFC</button>'+(mayo('socios','cargar')?'<button class="btn bad sm" data-a="cardRenew" data-id="'+esc(s.id)+'">Nueva tarjeta (anula la anterior)</button>':'')+'</div><p class="sub" style="margin-top:6px">El enlace es una llave: quien lo tenga ve la tarjeta. Si se pierde o se comparte, emití una nueva.</p></div>'+
 '<div class="c printable" style="box-shadow:none;border:1px solid var(--line);margin-top:12px;text-align:center"><h3 style="font-size:16px">Carnet impreso (firmado)</h3><div class="qrbox" style="width:200px;max-width:60vw;margin:8px auto">'+qrSvg(tok,4)+'</div><p class="tok" style="font-size:10px">'+esc(tok)+'</p><p class="sub"><small>Válido 1 año · '+esc(RAVE.name)+'</small></p></div>'+
 '<div class="row no-p" style="margin-top:12px"><button class="btn y sp" data-a="tkPrint">'+ic('print')+'Imprimir carnet</button><button class="btn g" data-a="mclose">Cerrar</button></div>')};
A.cardWa=el=>{const s=socioById(el.dataset.id);if(s){audit('tarjeta_enlace',{legajo:s.legajo,canal:'whatsapp'});persist()}};
A.cardCopy=async el=>{const s=socioById(el.dataset.id);if(!s)return;try{await navigator.clipboard.writeText(cardLink(s));toast('Enlace copiado (es personal)')}catch(e){toast('No se pudo copiar')}audit('tarjeta_enlace',{legajo:s.legajo,canal:'copiar'});persist()};
A.cardRenew=el=>{const s=socioById(el.dataset.id);if(!s)return;confirmBox({title:'Nueva tarjeta',msg:'La tarjeta y el enlace anteriores de '+s.name+' dejan de valer (también la etiqueta NFC). Los sellos no se pierden.',ok:'Emitir nueva',danger:true,onOk:()=>{s.card=cardNew();s.cardUse=[];audit('tarjeta_reemplazada',{legajo:s.legajo});persist();setTimeout(()=>A.socioCard({dataset:{id:s.id}}),0)}})};

/* =================== lado público: «Mi tarjeta» en el celular =================== */
let MT={card:null,est:null,code:'',w:0,tm:null,last:0,busy:false};
function mtLoad(){try{const c=JSON.parse(localStorage.getItem('terps_card')||'null');if(cardOk(c))return c}catch(e){}return null}
async function mtSave(c){try{localStorage.setItem('terps_card',JSON.stringify(c))}catch(e){}try{await kvSet('club_card',c)}catch(e){}try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}}
async function mtRestore(){let c=mtLoad();if(c)return c;try{c=await kvGet('club_card');if(cardOk(c)){try{localStorage.setItem('terps_card',JSON.stringify(c))}catch(e){}return c}}catch(e){}return null}
/* importa #tarjeta=ID.SEC y limpia la dirección (el fragmento no viaja al servidor) */
async function mtImport(){const m=/^#tarjeta=([A-Za-z0-9_-]{14,40})\.([A-Za-z0-9_-]{24,64})$/.exec(location.hash||'');if(!m)return false;
 const c={id:m[1],sec:m[2],t:now()};await mtSave(c);try{history.replaceState(null,'','#/mitarjeta')}catch(e){location.hash='#/mitarjeta'}return true}
async function mtEstado(force){
 if(!MT.card||!CLOUD.on||MT.busy)return;if(!force&&now()-MT.last<60000)return;MT.busy=true;
 try{const w=cardWin();const proof=await cardHmac(MT.card.sec,'estado|'+MT.card.id+'|'+w);const r=await rpcPublic('club_estado',{p_card:MT.card.id,p_win:w,p_proof:proof});MT.est=r.ok&&r.j?r.j:{estado:'sinred'};MT.last=now();if(MT.est&&MT.est.socio&&!MT.card.leg){MT.card.leg=MT.est.socio;mtSave(MT.card)}}
 catch(e){MT.est={estado:'sinred'}}finally{MT.busy=false}
 if(ROUTE.n==='mt')mtPaint()}
async function mtTick(){if(ROUTE.n!=='mt'){clearInterval(MT.tm);MT.tm=null;return}if(!MT.card)return;const w=cardWin();if(w!==MT.w){MT.w=w;MT.code=await cardCode(MT.card,w);mtPaint()}const e=$('#mtcd');if(e){const s=Math.ceil(((w+1)*CARD_WIN-now())/1000);e.textContent='cambia en '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}mtEstado(false)}
function mtTxt(k){const es=LANG==='es';return({t:es?'Mi tarjeta del Club':'My Club card',sin:es?'Todavía no tenés tu tarjeta en este celular.':'Your card is not on this phone yet.',sinD:es?'Completá el formulario de ingreso (Historia Clínica) o pedile al local tu enlace personal.':'Fill in the intake form or ask us for your personal link.',ped:es?'Pedir mi tarjeta por WhatsApp':'Ask for my card on WhatsApp',tram:es?'En trámite: el equipo todavía no incorporó tu legajo. Ya podés mostrarla.':'Pending: the team has not added your file yet.',mos:es?'Mostrá este QR en el mostrador (o decí el código).':'Show this QR at the counter (or say the code).',guar:es?'Guardar imagen':'Save image',vol:es?'Volver al sitio':'Back to the site',priv:es?'Esta tarjeta es personal: no compartas el enlace ni capturas del QR.':'This card is personal: do not share the link.'})[k]}
function mtPaint(){
 if(ROUTE.n!=='mt')return;const o=PUB.org||{};const c=MT.card,e=MT.est||{};
 if(!c){root.innerHTML='<div class="auth"><div class="c" style="text-align:center;max-width:460px"><img alt="" src="'+ASSETS.logo+'" style="width:90px;border-radius:22px;margin:0 auto 10px;display:block"><h1 style="font-size:22px">'+mtTxt('t')+'</h1><p style="margin:10px 0">'+mtTxt('sin')+'</p><p class="sub">'+mtTxt('sinD')+'</p><div class="row" style="justify-content:center;margin-top:14px">'+(waNum(o.wa)?'<a class="btn wa" target="_blank" rel="noopener noreferrer" href="'+esc(waUrl(waNum(o.wa),LANG==='es'?'Hola, quiero mi tarjeta del Club en el celular.':'Hi, I would like my Club card on my phone.'))+'">'+ic('wa')+mtTxt('ped')+'</a>':'')+'<a class="btn g" href="#/">'+mtTxt('vol')+'</a></div></div></div>';return}
 const goal=+e.meta||+o.stampGoal||10,have=Math.min(goal,+e.sellos||0);
 const st=e.estado==='activa'?'':e.estado==='tramite'?'<div class="notice" style="margin:10px 0">'+mtTxt('tram')+'</div>':e.estado==='desconocida'?'<div class="notice bad" style="margin:10px 0">'+(LANG==='es'?'Esta tarjeta no está vigente (fue reemplazada o dada de baja). Pedile al local una nueva.':'This card is no longer valid.')+'</div>':e.estado==='reloj'?'<div class="notice" style="margin:10px 0">'+(LANG==='es'?'La hora de tu celular no coincide: revisala para ver tus sellos.':'Check your phone clock.')+'</div>':(CLOUD.on?'<p class="sub" style="margin:8px 0">'+(LANG==='es'?'Sin conexión: la tarjeta funciona igual en el mostrador.':'Offline: the card still works at the counter.')+'</p>':'');
 const leg=e.socio||c.leg||'';
 root.className='pub';root.innerHTML='<div class="auth"><div class="c" style="max-width:460px;text-align:center"><div class="row" style="justify-content:center;align-items:center"><img alt="" src="'+ASSETS.logo+'" style="width:54px;border-radius:14px"><div style="text-align:left"><b style="font-size:18px">'+esc(t('clubT')+' '+(e.marca||o.brand||''))+'</b><div class="sub">'+mtTxt('t')+'</div></div></div>'+st+
 '<p class="sub" style="margin-top:12px">'+mtTxt('mos')+'</p><div class="qrbox" style="width:240px;max-width:72vw;margin:10px auto" aria-label="QR de la tarjeta">'+(MT.code?qrSvg('TERPS2|'+c.id+'|'+MT.code,5):'')+'</div><div style="font-size:30px;font-weight:800;letter-spacing:.12em" aria-live="polite">'+(leg?esc(leg)+' ':'')+esc(MT.code||'····')+'</div><div class="sub" id="mtcd"></div>'+
 (e.estado==='activa'?'<div class="cdots" style="justify-content:center;margin-top:14px">'+Array.from({length:goal},(_,i)=>'<span class="cd'+(i<have?' on':'')+'" aria-hidden="true">'+(i<have?ic('leaf'):i+1)+'</span>').join('')+'</div><p style="margin-top:8px"><b>'+have+' / '+goal+'</b>'+(e.premio?' · '+esc(e.premio):'')+'</p>'+(e.hoy?'<p class="sub">'+(LANG==='es'?'Ya sumaste el sello de hoy.':'Today\'s stamp is done.')+'</p>':'')+(e.nivel?'<p><span class="badge">'+(LANG==='es'?'Nivel ':'Level ')+esc(e.nivel)+'</span></p>':'')+(e.saldo!=null&&+e.saldo>0?'<p>'+(LANG==='es'?'Saldo a favor (monedero): ':'Wallet balance: ')+'<b>'+money(+e.saldo)+'</b></p>':''):'')+
 '<div class="row" style="justify-content:center;margin-top:14px"><button class="btn y" data-a="mtPng">'+ic('download')+mtTxt('guar')+'</button><a class="btn g" href="#/">'+mtTxt('vol')+'</a></div><p class="sub" style="margin-top:10px"><small>'+mtTxt('priv')+'</small></p></div></div>'}
async function renderMiTarjeta(){
 root.className='pub';MT.card=await mtRestore();MT.w=0;MT.code='';if(MT.card){MT.w=cardWin();MT.code=await cardCode(MT.card,MT.w)}mtPaint();
 if(MT.card)mtEstado(true);clearInterval(MT.tm);MT.tm=setInterval(mtTick,1000)}
/* imagen PNG para guardar: QR FIJO (como la etiqueta NFC; vale un sello por día) */
A.mtPng=async()=>{const c=MT.card;if(!c)return;const W=640,H=900,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
 g.fillStyle='#fffdf3';g.fillRect(0,0,W,H);g.fillStyle='#222';g.textAlign='center';g.font='bold 34px sans-serif';g.fillText((t('clubT')+' '+((PUB.org&&PUB.org.brand)||'')).slice(0,40),W/2,80);
 g.font='22px sans-serif';g.fillText(LANG==='es'?'Tarjeta personal · mostrala en el mostrador':'Personal card',W/2,120);
 const q=qrcode(0,'M');q.addData('TERPS2N|'+c.id);q.make();const n=q.getModuleCount(),cell=Math.floor(440/n),off=(W-cell*n)/2;g.fillStyle='#000';for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect(off+k*cell,170+r*cell,cell,cell);
 g.font='bold 30px sans-serif';g.fillText(c.leg?'Socio '+c.leg:'',W/2,680);g.font='18px sans-serif';g.fillStyle='#555';g.fillText(LANG==='es'?'Personal: no la compartas. Vale un sello por día.':'Personal: do not share.',W/2,730);g.fillText('Sistema VB · '+RAVE.name,W/2,860);
 const blob=await new Promise(r=>cv.toBlob(r,'image/png'));const f=new File([blob],'tarjeta-club.png',{type:'image/png'});
 try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:t('clubT')});return}}catch(e){}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tarjeta-club.png';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
