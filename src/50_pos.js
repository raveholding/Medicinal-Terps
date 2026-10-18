/* ===== Dispensar (entregas y donaciones) ===== */
const newRec=()=>({kind:'anon',socioId:'',nombre:'',docTipo:'DNI',doc:''});
const newPOS=()=>({lines:[],sel:-1,rec:newRec(),don:'',donSet:false,pay:'efectivo',rubro:'',fc:false,recv:'',q:'',cat:'all'});
let POS=newPOS();
let KIOSK=false,CP={},BC=null;
const r4=n=>Math.round((Number(n)+Number.EPSILON)*10000)/10000;
function posReset(){POS=newPOS();posCli()}
function posCli(){try{if(!BC)BC=new BroadcastChannel('terps_cli');BC.postMessage({lines:POS.lines.map(l=>({name:l.name,qty:qty(l.qty,l.unit),price:l.price,amount:l.amount})),total:posTotal(),org:S?S.org.brand||S.org.nameCom:'',ts:now()})}catch(e){}}
const posTotal=()=>r2(POS.lines.reduce((a,l)=>a+l.amount,0));
const pById=id=>S.products.find(p=>p.id===id);
function posQtyInCart(pid,except){return POS.lines.reduce((a,l,i)=>a+(l.pid===pid&&i!==except?l.qty:0),0)}
const PAYS={efectivo:'Efectivo',transferencia:'Transferencia',qr:'QR',debito:'Tarjeta débito',credito:'Tarjeta crédito'};
const FKP={efectivo:'F1',debito:'F2',credito:'F3',transferencia:'F4'};
/* ---------- búsqueda unificada de personas (nombre, legajo, DNI, CUIT, CUIL, WhatsApp) ---------- */
function findSocios(q,max){
 q=String(q||'').trim();if(!q)return S.socios.slice(0,max||40);
 const toks=norm(q).split(/\s+/).filter(Boolean),dig=q.replace(/\D/g,''),ql=q.toLowerCase();
 return S.socios.filter(s=>{
  const nm=norm(s.name+' '+(s.nombre||'')+' '+(s.apellido||''));
  if(toks.every(t=>nm.includes(t)))return true;
  if(s.legajo&&s.legajo.toLowerCase().includes(ql))return true;
  if(dig.length>=4){if((s.doc||'').includes(dig))return true;if(dig.length>=6&&last10(s.wa).endsWith(dig.slice(-10)))return true}
  return false}).slice(0,max||40)}
const recLabel=r=>{if(!r)return'Anónima (consumidor final)';if(r.kind==='paciente'){const s=S.socios.find(x=>x.id===r.socioId);return s?s.name+' · '+s.legajo:(r.nombre||'Paciente')}
 if(r.kind==='donante')return (r.nombre||'Donante sin ficha')+(r.doc?' · '+docLabel(r.docTipo,r.doc):'');return 'Anónima (consumidor final)'};
const recDoc=r=>{if(!r)return{tipo:'',doc:''};if(r.kind==='paciente'){const s=S.socios.find(x=>x.id===r.socioId);return s?{tipo:s.docTipo||'DNI',doc:s.doc||''}:{tipo:'',doc:''}}return{tipo:r.docTipo||'DNI',doc:r.doc||''}};
function posFilter(){
 const q=norm(POS.q);
 return S.products.filter(p=>p.status!=='discontinuado'&&(POS.cat==='all'||p.cat===POS.cat)&&(!q||norm(p.name).includes(q)||(p.barcode&&p.barcode.toLowerCase().includes(q))||(p.plu&&p.plu===q)||(p.lote&&norm(p.lote).includes(q)))).slice(0,60)}
function gridHtml(){
 const l=posFilter();if(!l.length)return'<p class="sub">Sin resultados.</p>';
 return l.map(p=>{const out=!p.service&&p.stock<=0;return '<div class="pc'+(out?'" style="opacity:.5':'')+'" data-a="posAdd" data-id="'+esc(p.id)+'" role="button" tabindex="0"><div class="im">'+(img(p.img)?'<img alt="" loading="lazy" src="'+img(p.img)+'">':esc(p.name[0]))+'</div><div class="bd"><b style="font-size:13px;line-height:1.2">'+esc(p.name)+'</b><span class="b">'+money(p.price)+(p.unit==='g'?' / g':'')+'</span><span class="sub" style="font-size:12px">'+(p.service?'Servicio':'Stock: '+qty(p.stock,p.unit))+(p.lote?' · '+esc(p.lote):'')+'</span></div></div>'}).join('')}
function posDrawGrid(){const g=$('#pgrid2');if(g)g.innerHTML=gridHtml()}
function lineEditor(l,i){
 return '<div style="grid-column:1/-1;border-top:1px dashed var(--line);padding-top:8px"><div class="g2" style="grid-template-columns:repeat(3,1fr);gap:8px"><div><label style="margin-top:0">Cantidad'+(l.unit==='g'?' (g)':'')+'</label><input class="num" type="number" inputmode="decimal" step="any" min="0" data-in="lineEdit" data-ch="lineEdit" data-f="q" data-i="'+i+'" value="'+l.qty+'" placeholder="0" id="le_q"></div><div><label style="margin-top:0">Donación sugerida unit.</label><input class="num" type="number" inputmode="decimal" step="any" min="0" data-in="lineEdit" data-ch="lineEdit" data-f="p" data-i="'+i+'" value="'+l.price+'" placeholder="0" id="le_p"></div><div><label style="margin-top:0">Importe</label><input class="num" type="number" inputmode="decimal" step="any" min="0" data-in="lineEdit" data-ch="lineEdit" data-f="a" data-i="'+i+'" value="'+l.amount+'" placeholder="0" id="le_a"></div></div><div class="row" style="margin-top:8px"><button class="btn g sm" data-a="lineStep" data-i="'+i+'" data-d="-1" aria-label="Menos">−</button><button class="btn g sm" data-a="lineStep" data-i="'+i+'" data-d="1" aria-label="Más">+</button><span class="sp"></span><button class="btn g sm" data-a="lineDel" data-i="'+i+'">'+ic('trash')+'Quitar</button></div></div>'}
function linesHtml(){
 if(!POS.lines.length)return'<p class="sub" style="padding:14px 0">Tocá un producto o escaneá un código para empezar.</p>';
 return POS.lines.map((l,i)=>'<div class="line'+(i===POS.sel?' on':'')+'"><div data-a="selLine" data-i="'+i+'" style="grid-column:1/-1;display:flex;justify-content:space-between;gap:10px;cursor:pointer"><div style="min-width:0"><div class="nm">'+esc(l.name)+'</div><div class="sub">'+qty(l.qty,l.unit)+' × '+money(l.price)+(l.lote?' · lote '+esc(l.lote):'')+(l.price!==l.list?' <span class="badge warn">importe modificado</span>':'')+'</div></div><div class="b" style="white-space:nowrap">'+money(l.amount)+'</div></div>'+(i===POS.sel?lineEditor(l,i):'')+'</div>').join('')}
function fcBtn(){if(!S.org.facturaC)return'';const on=POS.fc;return '<button class="sw" style="'+(on?'background:var(--m);color:#fff':'background:#e8e6dc;color:#333')+'" data-a="posFc">'+(on?'Con Factura C (F8)':'Sin Factura C (F8)')+'</button>'}
function rightHtml(){
 const fb=[['Efectivo (F1)','posPay','efectivo','y'],['Tarjeta débito (F2)','posPay','debito',''],['Tarjeta crédito (F3)','posPay','credito',''],['Transferencia (F4)','posPay','transferencia',''],['Anular / nota de crédito (F5)','posNC','','g'],['Reintegro (F6)','posRefund','','g'],['Borrar operación (F7)','posClear','','g'],['Con/Sin Factura C (F8)','posFc','','g'],['Cantidad (F9)','posQty','','g'],['Modificar importe (F10)','posPrice','','g'],['Buscar producto (F11)','posFind','','g'],['Registrar (F12)','posCobrar','','m']];
 return '<div class="row" style="margin-bottom:6px"><b style="font-size:17px">Entrega</b><span class="sp"></span>'+fcBtn()+'</div><div class="row" style="margin-bottom:8px"><button class="btn g sm" data-a="posRec">'+ic('users')+esc(recLabel(POS.rec))+'</button></div><div id="plines" style="max-height:34vh;overflow:auto">'+linesHtml()+'</div><div class="row" style="justify-content:space-between;margin:12px 0 4px;font-size:22px;font-weight:800;letter-spacing:-.8px"><span>Donación sugerida</span><span id="ptot">'+money(posTotal())+'</span></div>'+
 '<div class="fbar">'+fb.map(b=>'<button class="btn '+b[3]+'" style="min-height:48px;font-size:13px;padding:6px 8px" data-a="'+b[1]+'" data-id="'+b[2]+'">'+b[0]+'</button>').join('')+'</div>'+
 '<div class="row" style="margin-top:10px"><button class="btn g sm sp" data-a="cashIn">'+ic('plus')+'Ingreso de efectivo</button><button class="btn g sm sp" data-a="cashOut">'+ic('download')+'Egreso de efectivo</button></div>'}
function posDraw(){const r=$('#posR');if(r)r.innerHTML=rightHtml();const pb=$('#pbtot');if(pb)pb.textContent=money(posTotal());posCli()}
A.posGo=()=>{const r=$('#posR');if(r)r.scrollIntoView({behavior:'smooth'})};
VIEWS.vender={t:'Dispensar',r(){
 const cats=S.cats.filter(c=>S.products.some(p=>p.cat===c.id&&p.status!=='discontinuado'));
 return '<div class="ph"><div><h1>Dispensar</h1><span class="sub">'+(S.cash.open?'Caja abierta':'<b class="bad-t">Caja cerrada</b> · abrila para registrar donaciones')+'</span></div><div class="row"><button class="btn g sm" data-a="posCliWin">Pantalla del paciente</button>'+(KIOSK?'<button class="btn bad sm" data-a="kioskExit">Salir de kiosco (PIN)</button>':'<button class="btn g sm" data-a="posKiosk">Modo kiosco</button>')+'</div></div>'+
 '<div class="pos"><div class="c" id="posL"><input id="pq" data-in="posq" placeholder="Buscar producto, lote o escanear código de barras (F11)" value="'+esc(POS.q)+'" autocomplete="off" aria-label="Buscar producto"><div class="chips" style="margin:12px 0"><button class="chip'+(POS.cat==='all'?' on':'')+'" data-a="posCat" data-id="all">Todos</button>'+cats.map(c=>'<button class="chip'+(POS.cat===c.id?' on':'')+'" data-a="posCat" data-id="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('')+'</div><div class="pgrid" id="pgrid2">'+gridHtml()+'</div></div><div class="c" id="posR">'+rightHtml()+'</div></div><div class="cartbar posbar no-p"><span>Sugerida <b id="pbtot">'+money(posTotal())+'</b></span><button class="btn y sm" data-a="posGo">Ver entrega y registrar</button></div>'},
 a(){posCli()}};
IN.posq=el=>{POS.q=el.value;posDrawGrid()};
A.posCat=el=>{POS.cat=el.dataset.id;$$('#posL .chip').forEach(c=>c.classList.toggle('on',c.dataset.id===POS.cat));posDrawGrid()};
function posAdd(p,q){
 if(p.status==='discontinuado')return toast('Producto discontinuado');
 if(!p.service&&p.stock<=0)return toast('Sin stock: '+p.name);
 const ex=POS.lines.findIndex(l=>l.pid===p.id&&p.unit!=='g');
 if(ex>=0){const nq=POS.lines[ex].qty+(q||1);if(!p.service&&nq>p.stock)return toast('Stock disponible: '+qty(p.stock,p.unit));POS.lines[ex].qty=nq;POS.lines[ex].amount=r2(nq*POS.lines[ex].price);POS.sel=ex}
 else{const n=q||1;if(!p.service&&posQtyInCart(p.id,-1)+n>p.stock)return toast('Stock disponible: '+qty(p.stock,p.unit));POS.lines.push({pid:p.id,name:p.name,unit:p.unit,qty:n,price:p.price,list:p.price,cost:p.cost||0,amount:r2(n*p.price),svc:!!p.service,mem:!!p.membership,rp:!!p.rp,lote:p.lote||'',vence:p.vence||''});POS.sel=POS.lines.length-1}
 posDraw()}
A.posAdd=el=>{const p=pById(el.dataset.id);if(!p)return;if(p.unit==='g'){if(p.stock<=0)return toast('Sin stock: '+p.name);numpad({title:'Gramos de '+p.name,unit:'g',initial:'',ok:n=>{if(n<=0)return toast('La cantidad debe ser mayor a cero');posAdd(p,r3(n))}})}else posAdd(p,1)};
function posScan(code){
 code=String(code).trim();if(!code)return false;
 let p=S.products.find(x=>x.barcode&&x.barcode===code);
 if(p){p.unit==='g'?A.posAdd({dataset:{id:p.id}}):posAdd(p,1);return true}
 const m=code.match(/^2(\d{5})(\d{5})\d$/);
 if(m){const plu=String(parseInt(m[1],10));p=S.products.find(x=>x.plu&&String(parseInt(x.plu,10))===plu);if(p){posAdd(p,r3(parseInt(m[2],10)/1000));return true}}
 p=S.products.find(x=>x.plu&&x.plu===code);if(p){p.unit==='g'?A.posAdd({dataset:{id:p.id}}):posAdd(p,1);return true}
 return false}
let SCANBUF='',SCANT=0;
function scanKey(e){
 if(!(ROUTE.n==='panel'&&ROUTE.view==='vender')||!S)return false;
 const tg=e.target;if(tg&&(tg.tagName==='TEXTAREA'||tg.tagName==='SELECT'||(tg.tagName==='INPUT'&&tg.id!=='pq')))return false;
 if(!$('#modal').hidden)return false;
 const t=performance.now();
 if(e.key==='Enter'){const c=SCANBUF;SCANBUF='';if(tg&&tg.id==='pq'){const code=tg.value.trim();if(!code)return false;if(posScan(code)){tg.value='';POS.q='';posDrawGrid();toast('Agregado');e.preventDefault();return true}const l=posFilter();if(l.length===1){A.posAdd({dataset:{id:l[0].id}});tg.value='';POS.q='';posDrawGrid();e.preventDefault();return true}toast('No se encontró ese código');return true}
  if(c.length>=4){if(posScan(c))toast('Agregado');else toast('Código no encontrado: '+c);e.preventDefault();return true}return false}
 if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){if(t-SCANT>60)SCANBUF='';SCANT=t;SCANBUF+=e.key}
 return false}
A.selLine=el=>{POS.sel=+el.dataset.i===POS.sel?-1:+el.dataset.i;posDraw()};
A.lineDel=el=>{POS.lines.splice(+el.dataset.i,1);POS.sel=-1;posDraw()};
function lineSet(i,f,v){
 const l=POS.lines[i];if(!l||!(v>0)||!isFinite(v))return false;
 const p=pById(l.pid);
 if(f==='q'){if(l.unit!=='g'&&!Number.isInteger(v))return false;if(p&&!p.service&&posQtyInCart(l.pid,i)+v>p.stock)return false;l.qty=r3(v);l.amount=r2(l.qty*l.price)}
 else if(f==='p'){l.price=r4(v);l.amount=r2(l.qty*l.price)}
 else{if(l.unit==='g'){const nq=r3(v/l.price);if(!(nq>0))return false;if(p&&!p.service&&posQtyInCart(l.pid,i)+nq>p.stock)return false;l.qty=nq}else l.price=r4(v/l.qty);l.amount=r2(l.qty*l.price)}
 return true}
IN.lineEdit=el=>{
 const i=+el.dataset.i,f=el.dataset.f,l=POS.lines[i];if(!l)return;
 const v=el.valueAsNumber;if(!lineSet(i,f,v))return;
 const set=(id,val)=>{const x=$('#'+id);if(x&&x!==el)x.value=val};
 set('le_q',l.qty);set('le_p',l.price);set('le_a',l.amount);
 const pt=$('#ptot');if(pt)pt.textContent=money(posTotal());
 const nodes=$$('#plines .line')[i];if(nodes){const sub=nodes.querySelector('.sub');if(sub)sub.innerHTML=qty(l.qty,l.unit)+' × '+money(l.price)+(l.lote?' · lote '+esc(l.lote):'')+(l.price!==l.list?' <span class="badge warn">importe modificado</span>':'');const b=nodes.querySelector('.b');if(b)b.textContent=money(l.amount)}
 posCli()};
CH.lineEdit=el=>{
 const i=+el.dataset.i,f=el.dataset.f,l=POS.lines[i];if(!l)return;const v=el.valueAsNumber;
 if(!(v>0)){toast('Tiene que ser mayor a cero');posDraw();return}
 const old={q:l.qty,p:l.price,a:l.amount};
 if(!lineSet(i,f,v)){l.qty=old.q;l.price=old.p;l.amount=old.a;const p=pById(l.pid);toast(f!=='p'&&l.unit!=='g'&&!Number.isInteger(v)?'La cantidad tiene que ser entera':'Stock disponible: '+(p?qty(p.stock,p.unit):'-'));posDraw();return}
 if((f==='p'||f==='a')&&l.price!==l.list)audit('importe_linea',{producto:l.name,sugerida:l.list,aplicado:l.price});
 posCli()};
A.lineStep=el=>{const i=+el.dataset.i,l=POS.lines[i];const st=l.unit==='g'?5:1;const v=r3(l.qty+st*(+el.dataset.d));if(v<=0)return;if(!lineSet(i,'q',v))return toast('Stock disponible: '+qty(pById(l.pid).stock,l.unit));posDraw()};
A.posQty=()=>{const l=POS.lines[POS.sel];if(!l)return toast('Elegí una línea de la entrega');numpad({title:'Cantidad · '+l.name,unit:l.unit==='g'?'g':'',dec:l.unit==='g',initial:l.qty,ok:n=>{if(!lineSet(POS.sel,'q',n))return toast(n<=0?'Tiene que ser mayor a cero':'Stock disponible: '+qty(pById(l.pid).stock,l.unit));posDraw()}})};
A.posPrice=()=>{const l=POS.lines[POS.sel];if(!l)return toast('Elegí una línea de la entrega');numpad({title:'Donación sugerida unitaria · '+l.name,initial:l.price,ok:n=>{if(!lineSet(POS.sel,'p',n))return toast('Tiene que ser mayor a cero');audit('importe_linea',{producto:l.name,sugerida:l.list,aplicado:l.price});posDraw()}})};
A.posFind=()=>{const q=$('#pq');if(q){q.focus();q.select()}};
A.posClear=()=>{if(!POS.lines.length)return toast('No hay nada para borrar');confirmBox({title:'Borrar la operación',msg:'Se descartan todos los productos de la entrega.',ok:'Sí, borrar',danger:true,onOk:()=>confirmBox({title:'¿Seguro?',msg:'Segunda confirmación: esta acción queda registrada en auditoría.',ok:'Borrar definitivamente',danger:true,onOk:()=>{audit('borrar_operacion',{lineas:POS.lines.length,sugerida:posTotal()});POS.lines=[];POS.sel=-1;POS.rec=newRec();POS.don='';POS.donSet=false;POS.fc=false;posDraw();toast('Operación borrada')}})})};
/* ---------- receptor ---------- */
A.posRec=()=>recModal();
function recModal(){
 const r=POS.rec;
 modal('<h2>¿Quién recibe?</h2><p class="sub" style="margin:6px 0 12px">Elegí paciente o socio/a con ficha, un donante sin ficha o dejá anónimo. El documento es opcional.</p>'+
 '<div class="chips" style="margin-bottom:12px"><button class="chip'+(r.kind==='paciente'?' on':'')+'" data-a="recKind" data-id="paciente">Paciente / socio/a</button><button class="chip'+(r.kind==='donante'?' on':'')+'" data-a="recKind" data-id="donante">Donante sin ficha</button><button class="chip'+(r.kind==='anon'?' on':'')+'" data-a="recKind" data-id="anon">Anónima (consumidor final)</button></div>'+
 (r.kind==='paciente'?'<input id="cq" data-in="custq" placeholder="Nombre, legajo, DNI, CUIT o CUIL" autocomplete="off" aria-label="Buscar persona"><div class="list" id="clist" style="margin:10px 0;max-height:40vh;overflow:auto">'+custList('')+'</div>':'')+
 (r.kind==='donante'?'<label for="rd_n">Nombre del donante (opcional)</label><input id="rd_n" maxlength="80" value="'+esc(r.nombre)+'" autocomplete="off"><div class="g2"><div><label for="rd_t">Tipo de documento</label><select id="rd_t"><option'+(r.docTipo==='DNI'?' selected':'')+'>DNI</option><option'+(r.docTipo==='CUIT'?' selected':'')+'>CUIT</option><option'+(r.docTipo==='CUIL'?' selected':'')+'>CUIL</option></select></div><div><label for="rd_d">Número (opcional)</label><input id="rd_d" maxlength="14" inputmode="numeric" value="'+esc(r.doc)+'" autocomplete="off"></div></div><div class="bad-t" id="rd_e" style="min-height:20px"></div><button class="btn y lg" style="width:100%" data-a="recDonOk">Listo</button>':'')+
 (r.kind==='anon'?'<button class="btn y lg" style="width:100%" data-a="recAnonOk">Listo</button>':'')+
 '<button class="btn g" style="margin-top:10px" data-a="recBack">Cancelar</button>',{recv:true,cobro:!!(MOD&&MOD.cobro)})}
A.recKind=el=>{POS.rec=Object.assign(newRec(),{kind:el.dataset.id});recModal()};
function recDone(){const reopen=POS.__reopen;POS.__reopen=false;closeModal();posDraw();if(reopen)openCobro()}
A.recBack=()=>{const reopen=POS.__reopen;POS.__reopen=false;closeModal();if(reopen)openCobro()};
A.recAnonOk=()=>recDone();
A.recDonOk=()=>{const n=$('#rd_n').value.trim(),t=$('#rd_t').value,d=$('#rd_d').value.trim();const v=valDoc(t,d);if(!v.ok){$('#rd_e').textContent=v.msg;return}POS.rec={kind:'donante',socioId:'',nombre:n,docTipo:v.tipo,doc:v.digits};recDone()};
function custList(q){const l=findSocios(q,40);
 if(!l.length)return '<p class="sub">Sin coincidencias. Probá con otro dato (legajo, documento o apellido).</p>';
 return (l.length>1&&q?'<p class="sub" style="padding:6px 0">'+l.length+' coincidencias: elegí la correcta.</p>':'')+l.map(s=>'<div class="li"><div style="min-width:0"><b>'+esc(s.name)+'</b> '+(s.posibleDuplicadoDe?'<span class="badge warn">posible duplicado</span>':'')+(s.verificado===false?' <span class="badge">sin verificar</span>':'')+'<div class="sub">'+esc(s.legajo)+' · '+esc(docLabel(s.docTipo,s.doc))+(s.cuotaHasta&&s.cuotaHasta<today()?' · cuota vencida':'')+'</div></div><button class="btn y sm" data-a="custPick" data-id="'+esc(s.id)+'">Elegir</button></div>').join('')}
IN.custq=el=>{const l=$('#clist');if(l)l.innerHTML=custList(el.value)};
function custPicker(cb){CP={cb};modal('<h2>Elegir persona</h2><input id="cq" data-in="custq" placeholder="Nombre, legajo, DNI, CUIT o CUIL" autofocus autocomplete="off" aria-label="Buscar persona"><div class="list" id="clist" style="margin:10px 0;max-height:46vh;overflow:auto">'+custList('')+'</div><button class="btn g" data-a="mclose">Cancelar</button>')}
A.custPick=el=>{
 if(CP&&CP.cb){const f=CP.cb;CP=null;closeModal();f(el.dataset.id);return}
 const s=S.socios.find(x=>x.id===el.dataset.id);if(!s)return;
 POS.rec={kind:'paciente',socioId:s.id,nombre:s.name,docTipo:s.docTipo||'DNI',doc:s.doc||''};
 recDone()};
/* ---------- Factura C simulada ---------- */
A.posFc=()=>{
 if(!S.org.facturaC)return toast('La Factura C no está habilitada en Ajustes.');
 askText({title:POS.fc?'Pasar a Sin Factura C':'Pasar a Con Factura C (simulada)',label:'Motivo',ok:'Cambiar',onOk:m=>{POS.fc=!POS.fc;audit('interruptor_factura_c',{modo:POS.fc?'con':'sin',motivo:m});posDraw();if(MOD.cobro)openCobro()}})};
function umbralInfo(don){const u=S.org.umbralId;const rd=recDoc(POS.rec);return{need:!!(u&&u>0&&don>=u&&!rd.doc),umbral:u}}
/* ---------- registrar (donación) ---------- */
A.posPay=el=>{if(!POS.lines.length)return toast('Agregá productos primero');POS.pay=el.dataset.id;openCobro()};
A.posCobrar=()=>{if(!POS.lines.length)return toast('Agregá productos primero');if(MOD.cobro)return posConfirm();openCobro()};
function donNow(){if(POS.don===''||POS.don==null)return POS.donSet?0:posTotal();const n=parseNum(POS.don);return isNaN(n)?NaN:n}
function defaultRubro(){return POS.lines.length&&POS.lines.every(l=>l.mem)?'r_cuo':'r_don'}
function cobDyn(){
 const don=donNow(),rd=recDoc(POS.rec);
 const recv=parseNum(POS.recv),vto=POS.pay==='efectivo'&&recv>=don?r2(recv-don):0;
 const um=umbralInfo(don);
 const fcOn=POS.fc&&S.org.facturaC&&don>0;
 return (don>0?'<div class="chips" style="justify-content:center;margin-top:12px">'+Object.keys(PAYS).map(k=>'<button class="chip'+(POS.pay===k?' on':'')+'" data-a="cobPay" data-id="'+k+'">'+PAYS[k]+(FKP[k]?' ('+FKP[k]+')':'')+'</button>').join('')+'</div>'+
  '<label for="rubsel">Rubro de la donación (obligatorio)</label>'+rubroSelect('rubsel','ingreso',POS.rubro).replace('<select ','<select data-ch="rubsel" ')+
  (POS.pay==='efectivo'?'<label for="rcv">Recibido (opcional)</label><input class="num" type="number" inputmode="decimal" step="any" min="0" id="rcv" data-in="recv" placeholder="Importe recibido" value="'+esc(POS.recv)+'"><div class="row" style="justify-content:space-between;margin-top:8px;font-size:18px"><span>Vuelto</span><b id="vto">'+money(vto)+'</b></div>':''):'<p class="sub" style="margin-top:10px">Se registra la entrega sin donación: no se mueve la caja.</p>')+
 '<div style="margin-top:14px;padding:12px;border-radius:14px;background:#faf9f5"><div class="row"><span class="lbl">Receptor</span><span class="sp"></span><b>'+esc(recLabel(POS.rec))+'</b><button class="btn g sm" data-a="cobRec">Cambiar</button></div>'+
 '<div class="row" style="margin-top:6px"><span class="lbl">Comprobante</span><span class="sp"></span><b>'+(fcOn?'Factura C (simulada · sin CAE)':'Comprobante interno')+'</b></div>'+
 (fcOn?'<p class="sub" style="margin-top:6px">Receptor en la factura: <b>'+(rd.doc?esc(docLabel(rd.tipo,rd.doc))+' · condición frente al IVA a confirmar con el receptor [VERIFICAR]':'Consumidor final')+'</b></p>':'<p style="margin-top:8px;font-weight:700;font-size:13px">DOCUMENTO NO VÁLIDO COMO FACTURA</p>')+
 (fcOn&&um.need?'<div class="notice" style="margin:10px 0 0"><span>Por este importe ARCA puede exigir identificar al receptor [VERIFICAR en arca.gob.ar]. Cargá un documento o registrá la donación <b>sin</b> Factura C.</span><span class="row"><button class="btn g sm" data-a="cobRec">Cargar documento</button><button class="btn y sm" data-a="cobNoFc">Sin Factura C</button></span></div>':'')+'</div>'}
function openCobro(){
 const sug=posTotal();
 const don=donNow();
 if(!POS.rubro||!rubroSel(POS.rubro,'ingreso'))POS.rubro=rubroSel(defaultRubro(),'ingreso')?defaultRubro():'';
 modal('<div class="row"><h2 class="sp">Registrar entrega y donación</h2>'+fcBtn()+'</div><div class="row" style="justify-content:space-between;margin-top:8px"><span class="sub">Donación sugerida</span><b>'+money(sug)+'</b></div>'+
 '<label for="donv">Importe de la donación (voluntaria)</label><input class="num" type="number" inputmode="decimal" step="any" min="0" id="donv" data-in="don" data-ch="don" placeholder="Importe" value="'+(POS.don===''&&!POS.donSet?String(sug):esc(String(POS.don).replace(',','.')))+'"><div class="row" style="margin-top:6px"><button class="btn g sm" data-a="donSug">Usar la sugerida</button><button class="btn g sm" data-a="donNone">Sin donación</button></div>'+
 '<div id="cobDyn">'+(COBH=cobDyn())+'</div>'+
 '<div class="row" style="margin-top:16px"><button class="btn m lg sp" data-a="cobOk">Confirmar (F12)</button><button class="btn g lg" data-a="mclose">Cancelar</button></div>',{cobro:true})}
A.cobPay=el=>{POS.pay=el.dataset.id;openCobro()};
A.cobRec=()=>{POS.__reopen=true;recModal()};
A.cobNoFc=()=>{POS.fc=false;audit('interruptor_factura_c',{modo:'sin',motivo:'Umbral de identificación sin documento'});posDraw();openCobro()};
IN.recv=el=>{POS.recv=el.value;const r=parseNum(el.value),t=donNow();const v=$('#vto');if(v)v.textContent=money(r>=t?r2(r-t):0)};
let COBH='';
function donSync(el){const n=el.valueAsNumber;POS.don=el.value;POS.donSet=el.value!==''&&n===0;if(!POS.rubro||!rubroSel(POS.rubro,'ingreso'))POS.rubro=rubroSel(defaultRubro(),'ingreso')?defaultRubro():'';const dy=$('#cobDyn');if(!dy)return;const h=cobDyn();if(COBH!==h){dy.innerHTML=h;COBH=h}}
IN.don=el=>donSync(el);
CH.don=el=>{const n=el.valueAsNumber;if(el.value!==''&&!(n>=0))toast('El importe tiene que ser cero o mayor');donSync(el)};
CH.rubsel=el=>{POS.rubro=el.value};
A.donSug=()=>{POS.don='';POS.donSet=false;openCobro()};
A.donNone=()=>{POS.don='0';POS.donSet=true;openCobro()};
A.cobOk=()=>posConfirm();
/* controles del receptor: REPROCANN vigente y tope por persona */
function recIssues(items){
 const out=[];const rp=items.some(i=>{const p=pById(i.pid);return p&&p.rp});
 const s=POS.rec.kind==='paciente'?S.socios.find(x=>x.id===POS.rec.socioId):null;
 if(rp){if(!s)out.push('El producto requiere un paciente o socio/a identificado con REPROCANN vigente.');
  else if(!s.reprocann||!s.reprocann.venc||s.reprocann.venc<today())out.push(s.name+' no tiene REPROCANN vigente.');
  else if(s.verificado===false)out.push(s.name+' figura sin verificar: confirmá su REPROCANN antes de dispensar.')}
 if(s&&s.topeG>0){const g=items.filter(i=>i.unit==='g').reduce((a,i)=>a+i.qty,0);if(g>0){const since=now()-30*864e5;let prev=0;for(const x of S.sales)if(!x.voided&&x.socioId===s.id&&x.t>=since)for(const i of x.items)if(i.unit==='g')prev+=i.qty;
   if(prev+g>s.topeG)out.push('Supera el tope de '+qty(s.topeG,'g')+' cada 30 días (ya recibió '+qty(prev,'g')+').')}}
 return out}
async function posConfirm(){
 const lines=POS.lines;if(!lines.length)return;
 const don=donNow();
 if(isNaN(don)||don<0){toast('Escribí el importe de la donación o tocá «Sin donación».');return}
 if(don>0&&!S.cash.open){closeModal();confirmBox({title:'Caja cerrada',msg:'Para registrar una donación hay que abrir la caja. Si no hay donación, tocá «Sin donación».',ok:'Ir a Caja',onOk:()=>go('caja')});return}
 const rub=don>0?rubroSel(POS.rubro,'ingreso'):null;
 if(don>0&&!rub){toast('Elegí el rubro de la donación (obligatorio).');return}
 const rd=recDoc(POS.rec);
 if(POS.rec.kind==='donante'&&rd.doc){const v=valDoc(rd.tipo,rd.doc);if(!v.ok){toast(v.msg);return}}
 const items=[];
 for(const l of lines){
  const p=pById(l.pid);if(!p){toast('Producto inexistente: '+l.name);return}
  if(!(l.qty>0)||!(l.price>0)){toast('Cantidad e importe deben ser mayores a cero');return}
  if(!p.service&&posQtyInCart(l.pid,-1)>p.stock){toast('Stock insuficiente: '+p.name);return}
  items.push({pid:l.pid,name:l.name,unit:l.unit,qty:r3(l.qty),price:l.price,list:l.list,cost:l.cost,amount:r2(l.qty*l.price),lote:p.lote||'',vence:p.vence||''})}
 const sug=r2(items.reduce((a,i)=>a+i.amount,0));
 let recv=null;
 if(don>0&&POS.pay==='efectivo'&&POS.recv!==''){recv=parseNum(POS.recv);if(isNaN(recv)||recv<don){toast('El monto recibido no cubre la donación');return}}
 const iss=recIssues(items);
 if(iss.length){
  if(SES.role!=='admin'){toast(iss[0]+' Sólo un administrador puede autorizarlo.');return}
  const ok=await new Promise(res=>{askText({title:'Autorización del administrador',label:iss.join(' ')+' Motivo de la excepción',ok:'Autorizar',onOk:m=>{audit('excepcion_dispensa',{receptor:recLabel(POS.rec),avisos:iss,motivo:m});res(true)}});MOD.onClose=()=>setTimeout(()=>res(false),0)});
  if(!ok)return}
 let fc=POS.fc&&S.org.facturaC&&don>0;
 if(fc){const um=umbralInfo(don);
  if(um.need){const go2=await new Promise(res=>{confirmBox({title:'Hace falta identificar al receptor',msg:'Por este importe ARCA puede exigir identificar al receptor [VERIFICAR]. ¿Registrás la donación sin Factura C? (no se pierde nada: la donación y la entrega se registran igual).',ok:'Registrar sin Factura C',onOk:()=>res(true)});MOD.onClose=()=>setTimeout(()=>res(false),0)});
   if(!go2){openCobro();return}fc=false;POS.fc=false;audit('interruptor_factura_c',{modo:'sin',motivo:'Umbral de identificación sin documento'})}}
 const dev=DEV?DEV.n:1;
 const n=dev+'-'+seq('s');
 let fcd=null;
 if(fc){const pto=String((DEV&&DEV.pto)||S.org.ptoVta||1).padStart(4,'0');fcd={pto,num:pto+'-'+String(seq('fc'+pto)).padStart(8,'0'),cae:null,sim:true,receptor:{nombre:POS.rec.kind==='anon'?'Consumidor final':recLabel(POS.rec).split(' · ')[0],docTipo:rd.doc?rd.tipo:'',doc:rd.doc||'',cf:!rd.doc},condIvaRec:rd.doc?'a confirmar con el receptor':'Consumidor final',total:don}}
 const sale={id:uid(),n,t:now(),caja:S.cash.open?S.cash.open.id:null,user:SES.name,dev,items,sugerido:sug,total:don,pay:don>0?POS.pay:'-',recv,rec:{kind:POS.rec.kind,socioId:POS.rec.kind==='paciente'?POS.rec.socioId:'',nombre:POS.rec.kind==='paciente'?(S.socios.find(x=>x.id===POS.rec.socioId)||{}).name||'':POS.rec.nombre,docTipo:rd.doc?rd.tipo:'',doc:rd.doc||''},socioId:POS.rec.kind==='paciente'?POS.rec.socioId:'',rubro:rub,doc:fc?'factura_c':'comprobante',fc:fcd,cae:null,voided:false};
 const cust=sale.socioId?S.socios.find(x=>x.id===sale.socioId):null;
 for(const it of items){const p=pById(it.pid);if(!p.service){p.stock=r3(p.stock-it.qty);S.stockMoves.push({id:uid(),t:now(),pid:p.id,delta:-it.qty,reason:'Entrega '+n,user:SES.name,dev})}
  if(it.price!==it.list)audit('importe_entrega',{entrega:n,producto:it.name,sugerida:it.list,aplicado:it.price});
  if(p.membership&&cust){const base=cust.cuotaHasta&&cust.cuotaHasta>today()?new Date(cust.cuotaHasta+'T12:00:00').getTime():now();cust.cuotaHasta=dkey(base+it.qty*(S.org.cuotaDias||30)*864e5)}}
 S.sales.push(sale);audit('entrega',{n,sugerida:sug,donacion:don,pago:sale.pay,rubro:rub?rub.name:'-',comprobante:sale.doc,receptor:recLabel(POS.rec)});
 persist();closeModal();
 POS.lines=[];POS.sel=-1;POS.rec=newRec();POS.recv='';POS.pay='efectivo';POS.don='';POS.donSet=false;POS.fc=false;POS.rubro='';
 showTicket(sale);refresh();posCli()}
/* ---------- comprobante ---------- */
function ticketHtml(s){
 const o=S.org;
 const title=s.doc==='factura_c'?'FACTURA C':(s.total>0?'DONACIÓN VOLUNTARIA REGISTRADA':'COMPROBANTE DE ENTREGA');
 const num=s.fc?s.fc.num:s.n;
 const rec=s.rec||{};
 return '<div class="ticket"><div class="c2"><b>'+esc(o.nameLegal)+'</b><br>'+esc(o.nameCom)+'<br>CUIT '+esc(o.cuit)+' · '+esc(o.condIva)+'<br>'+esc(o.addr)+', '+esc(o.city)+'</div><hr><div class="c2"><b>'+title+'</b>'+(s.doc==='factura_c'?'<br><b>(SIMULADA · SIN CAE)</b>':'')+'<br>N° '+esc(num)+(s.fc?'<br>Interno '+esc(s.n):'')+'<br>'+fdt(s.t)+'</div><hr>'+
 s.items.map(i=>'<div>'+esc(i.name)+(i.lote?' · lote '+esc(i.lote):'')+'</div><div class="rw"><span>'+qty(i.qty,i.unit)+' x '+money(i.price)+'</span><span>'+money(i.amount)+'</span></div>').join('')+'<hr><div class="rw"><span>Donación sugerida</span><span>'+money(s.sugerido!=null?s.sugerido:s.total)+'</span></div><div class="rw" style="font-size:15px"><b>DONACIÓN</b><b>'+money(s.total)+'</b></div>'+
 (s.total>0?'<div class="rw"><span>Medio</span><span>'+esc(PAYS[s.pay]||s.pay)+'</span></div>'+(s.recv?'<div class="rw"><span>Recibido</span><span>'+money(s.recv)+'</span></div><div class="rw"><span>Vuelto</span><span>'+money(r2(s.recv-s.total))+'</span></div>':'')+(s.rubro?'<div class="rw"><span>Rubro</span><span>'+esc(s.rubro.name)+'</span></div>':''):'<div class="c2">Entrega sin donación.</div>')+
 '<div>Receptor: '+esc(s.fc?(s.fc.receptor.cf?'Consumidor final':s.fc.receptor.nombre+(s.fc.receptor.doc?' · '+docLabel(s.fc.receptor.docTipo,s.fc.receptor.doc):'')):(rec.kind==='anon'||!rec.kind?'Anónima':(rec.nombre||'-')+(rec.doc?' · '+docLabel(rec.docTipo,rec.doc):'')))+'</div>'+
 (s.fc?'<div>Condición IVA del receptor: '+esc(s.fc.condIvaRec)+'</div>':'')+
 '<div>Atendió: '+esc(s.user)+'</div>'+(s.doc==='factura_c'?'<div class="nv">COMPROBANTE DE PRUEBA · SIN VALIDEZ FISCAL (sin CAE)</div>':'<div class="nv">DOCUMENTO NO VÁLIDO COMO FACTURA</div>')+
 '<hr><div class="c2" style="font-size:10px">Sistema VB · '+esc(RAVE.name)+'<br>WhatsApp '+esc(RAVE.tel)+' · '+esc(RAVE.mail)+'</div></div>'}
function ticketText(s){return (S.org.brand||S.org.nameCom)+' · '+(s.doc==='factura_c'?'Factura C (simulada)':'Comprobante')+' '+(s.fc?s.fc.num:s.n)+'\n'+fdt(s.t)+'\n'+s.items.map(i=>'• '+qty(i.qty,i.unit)+' '+i.name+' '+money(i.amount)).join('\n')+'\nDonación '+money(s.total)+'\nDOCUMENTO NO VÁLIDO COMO FACTURA'}
function showTicket(s){
 const c=s.socioId?S.socios.find(x=>x.id===s.socioId):null;
 modal('<div class="printable">'+ticketHtml(s)+'</div><div class="row no-p" style="margin-top:14px"><button class="btn y sp" data-a="tkPrint">'+ic('print')+'Imprimir</button>'+(c&&c.consent&&c.wa?'<a class="btn wa" target="_blank" rel="noopener noreferrer" href="'+waUrl(c.wa,ticketText(s))+'">'+ic('wa')+'WhatsApp</a>':'')+(c&&s.total>0?'<button class="btn g" data-a="tkStamp" data-id="'+c.id+'">'+ic('star')+'Sello</button>':'')+'<button class="btn g" data-a="mclose">Nueva entrega</button></div>')}
A.tkPrint=()=>window.print();
A.tkStamp=el=>{stampSocio(el.dataset.id,true)};
/* ---------- anulación / nota de crédito C / reintegro ---------- */
A.posNC=()=>{
 if(SES.role!=='admin')return toast('La anulación y la nota de crédito son sólo para administradores');
 if(!S.cash.open)return toast('Abrí la caja: sólo se anulan entregas de la caja abierta. Para otras usá Reintegro (F6).');
 const l=S.sales.filter(s=>s.caja===S.cash.open.id&&!s.voided).slice(-15).reverse();
 modal('<h2>Anular / nota de crédito</h2><p class="sub" style="margin:6px 0 10px">Con Factura C se emite la nota de crédito C (copia al receptor). Sin factura se anula. El stock vuelve. Entregas de cajas ya cerradas: usá Reintegro (F6).</p><div class="list" style="max-height:44vh;overflow:auto">'+(l.length?l.map(s=>'<div class="li"><div><b>'+esc(s.fc?s.fc.num:s.n)+'</b> · '+money(s.total)+'<div class="sub">'+fdt(s.t)+' · '+esc((s.rec&&s.rec.nombre)||'Anónima')+(s.fc?' · Factura C':'')+'</div></div><button class="btn bad sm" data-a="ncPick" data-id="'+s.id+'">'+(s.fc?'Nota de crédito C':'Anular')+'</button></div>').join(''):'<p class="sub">No hay entregas en la caja actual.</p>')+'</div><button class="btn g" style="margin-top:12px" data-a="mclose">Cerrar</button>')};
A.ncPick=el=>{const s=S.sales.find(x=>x.id===el.dataset.id);if(!s||s.voided)return;
 askText({title:(s.fc?'Nota de crédito C de ':'Anular ')+(s.fc?s.fc.num:s.n),label:'Motivo',ok:s.fc?'Emitir nota de crédito':'Anular',onOk:m=>{
  for(const it of s.items){const p=pById(it.pid);if(p&&!p.service){p.stock=r3(p.stock+it.qty);S.stockMoves.push({id:uid(),t:now(),pid:p.id,delta:it.qty,reason:'Anulación '+s.n,user:SES.name,dev:DEV?DEV.n:1})}}
  s.voided=true;s.voidReason=m;s.voidBy=SES.name;s.voidT=now();
  if(s.fc){const pto=s.fc.pto;const nc={id:uid(),t:now(),saleId:s.id,pto,num:pto+'-'+String(seq('nc'+pto)).padStart(8,'0'),ref:s.fc.num,receptor:JSON.parse(JSON.stringify(s.fc.receptor)),condIvaRec:s.fc.condIvaRec,total:s.fc.total,cae:null,sim:true,motivo:m,user:SES.name};S.ncs.push(nc);s.ncId=nc.id;audit('nota_credito_c',{nc:nc.num,factura:s.fc.num,total:nc.total,motivo:m})}
  else audit('anulacion',{n:s.n,total:s.total,motivo:m});
  persist();toast(s.fc?'Nota de crédito C emitida (simulada)':'Entrega anulada');refresh()}})};
A.posRefund=()=>cashMoveModal('reintegro');
A.cashIn=()=>cashMoveModal('ingreso');
A.cashOut=()=>cashMoveModal('egreso');
/* ---------- kiosco, pantalla del paciente ---------- */
A.posKiosk=()=>{
 if(!S.org.pinHash){numpad({title:'Definí el PIN de supervisor (4 a 6 dígitos)',dec:false,ok:async (n,raw)=>{const s=String(raw).replace(/\D/g,'');if(s.length<4||s.length>6)return toast('El PIN tiene que tener 4 a 6 dígitos');S.org.pinHash=await sha256hex('terps:'+s);audit('pin_supervisor','definido');persist();toast('PIN guardado');A.posKiosk()}});return}
 KIOSK=true;audit('kiosco','activado');renderPanel();toast('Modo kiosco activo')};
A.kioskExit=()=>numpad({title:'PIN de supervisor',dec:false,ok:async (n,raw)=>{const h=await sha256hex('terps:'+String(raw).replace(/\D/g,''));if(h===S.org.pinHash){KIOSK=false;audit('kiosco','desactivado');renderPanel()}else{audit('kiosco','PIN incorrecto');toast('PIN incorrecto')}}});
A.posCliWin=()=>{window.open(pubUrl()+'#/cliente','terps_cli','popup,width=900,height=640')};
function renderCliente(){
 root.className='';root.innerHTML='<div class="auth" style="align-items:start"><div class="c" style="max-width:720px"><div class="row"><span class="logo"><img alt="" src="'+ASSETS.logo+'"></span><h1 id="cn1">Medicinal Terps</h1></div><div id="cl" class="list" style="margin:18px 0"></div><div class="row" style="justify-content:space-between;font-size:34px;font-weight:800"><span>Donación sugerida</span><span id="ct">$ 0</span></div><p class="sub" style="margin-top:16px"><small>Desarrollado por '+esc(RAVE.name)+' · '+esc(RAVE.tel)+'</small></p></div></div>';
 try{const b=new BroadcastChannel('terps_cli');b.onmessage=e=>{const d=e.data;$('#cn1').textContent=d.org||'Medicinal Terps';$('#cl').innerHTML=d.lines.length?d.lines.map(l=>'<div class="li"><span>'+esc(l.name)+' <span class="sub">'+esc(l.qty)+' × '+money(l.price)+'</span></span><b>'+money(l.amount)+'</b></div>').join(''):'<p class="sub">Bienvenido/a</p>';$('#ct').textContent=money(d.total)}}catch(e){}}
/* teclas F1–F12 dentro de Dispensar */
function posFKey(k){
 const open=!$('#modal').hidden;
 if(open&&!MOD.cobro)return;
 const pay={F1:'efectivo',F2:'debito',F3:'credito',F4:'transferencia'};
 if(pay[k]){if(!POS.lines.length)return toast('Agregá productos primero');POS.pay=pay[k];openCobro();return}
 if(open){if(k==='F8')A.posFc();if(k==='F12')posConfirm();return}
 ({F5:A.posNC,F6:A.posRefund,F7:A.posClear,F8:A.posFc,F9:A.posQty,F10:A.posPrice,F11:A.posFind,F12:A.posCobrar})[k]()}
