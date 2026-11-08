/* ===== Cobro completo · 2026-11-08 (Sistema VB 4.20 y 4.23.4, versión ONG) =====
   - Una donación se puede registrar con VARIOS medios a la vez (pago dividido). La suma tiene que dar EXACTO.
   - Efectivo: el importe recibido es obligatorio (botón «Justo»); el vuelto se muestra grande y nunca se imputa.
   - Transferencia, tarjeta y QR guardan el detalle del comprobante (para conciliar con el banco): estado
     «declarado por quien registró», nunca «acreditado». Nunca se guarda un número de tarjeta completo.
   - Si el comprobante no está a mano, un administrador autoriza «sin comprobante» con motivo y después
     se completa (registro aparte, sólo agregar: colección «cobdet»). La entrega no se edita.
   - No se pide el titular ordenante (minimización de datos personales).
   - Monedero (saldo a favor) del socio: libro «fidmov» (sólo agregar); el saldo se calcula, no se guarda. */
PAYS.mixto='Pago mixto';PAYS.mon='Monedero';
const COB_MEDIOS=['efectivo','transferencia','qr','debito','credito','cc','mon'];
/* partes de pago de una entrega (las viejas se derivan de pay + cc) */
function payParts(s){
 if(s&&Array.isArray(s.pays)&&s.pays.length)return s.pays;
 const cc=ccOf(s),paid=r2((Number(s&&s.total)||0)-cc),o=[];
 if(paid>0&&s.pay&&s.pay!=='-'&&s.pay!=='cc'&&s.pay!=='mixto')o.push({m:s.pay,a:paid});
 if(cc>0)o.push({m:'cc',a:cc});return o}
const payMoney=s=>payParts(s).filter(p=>MONEY_PAYS.includes(p.m));
const monOf=s=>r2(payParts(s).filter(p=>p.m==='mon').reduce((a,p)=>a+(+p.a||0),0));
function payLabel(s){const p=payParts(s);if(!p.length)return '—';return p.map(x=>(PAYS[x.m]||x.m)+(p.length>1?' '+money(x.a):'')).join(' + ')}
const cents=n=>Math.round((Number(n)||0)*100);

/* ---------- detalle del comprobante por medio ---------- */
const PD_BRANDS=['Visa','Mastercard','Maestro','American Express','Naranja X','Cabal','Otra'];
const PD_PROVS=['Mercado Pago','MODO','Cuenta DNI','BNA+','Ualá','Otro'];
const PD_F={
 transferencia:[{k:'ent',l:'Banco o billetera de origen',t:'text',min:2,max:60},{k:'nro',l:'N.º de operación / comprobante',t:'id',rx:/^[A-Za-z0-9]{6,40}$/,h:'6 a 40 letras o números (sacamos espacios y guiones)'},{k:'fh',l:'Fecha y hora de la transferencia',t:'dt'}],
 debito:[{k:'brand',l:'Marca de la tarjeta',t:'sel',o:PD_BRANDS},{k:'last4',l:'Últimos 4 dígitos',t:'id',rx:/^\d{4}$/,h:'sólo 4 números: nunca el número completo'},{k:'auth',l:'Código de autorización',t:'id',rx:/^[A-Za-z0-9]{4,12}$/,h:'4 a 12 letras o números'},{k:'cupon',l:'N.º de cupón / lote',t:'id',rx:/^[A-Za-z0-9]{1,20}$/,h:'1 a 20 letras o números'}],
 credito:[{k:'brand',l:'Marca de la tarjeta',t:'sel',o:PD_BRANDS},{k:'last4',l:'Últimos 4 dígitos',t:'id',rx:/^\d{4}$/,h:'sólo 4 números: nunca el número completo'},{k:'auth',l:'Código de autorización',t:'id',rx:/^[A-Za-z0-9]{4,12}$/,h:'4 a 12 letras o números'},{k:'cuotas',l:'Cuotas',t:'id',rx:/^([1-9]|[1-4]\d)$/,h:'1 si es en un pago'},{k:'cupon',l:'N.º de cupón / lote',t:'id',rx:/^[A-Za-z0-9]{1,20}$/,h:'1 a 20 letras o números'}],
 qr:[{k:'prov',l:'Proveedor del pago',t:'sel',o:PD_PROVS},{k:'txid',l:'ID de la transacción',t:'id',rx:/^[A-Za-z0-9]{4,60}$/,h:'4 a 60 letras o números'}]};
const pdNorm=(f,v)=>{v=String(v==null?'':v).trim();return f.t==='id'?v.replace(/[\s.\-\/]/g,''):v.replace(/\s+/g,' ')};
/* número de tarjeta completo: 13 a 19 dígitos que pasan Luhn (igual que el servidor) */
function pdLuhn(d){if(d.length<13||d.length>19)return false;let s=0,alt=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];if(alt){n*=2;if(n>9)n-=9}s+=n;alt=!alt}return s%10===0}
function pdPan(txt){const re=/((?:\d[ \-]?){13,19})/g;let m;const s=String(txt==null?'':txt);while((m=re.exec(s))){const d=m[1].replace(/\D/g,'');if(d.length>=13&&d.length<=19&&'23456'.includes(d[0])&&pdLuhn(d))return true}return false}
function pdClean(m,det){const o={};for(const f of PD_F[m]||[]){const v=pdNorm(f,det&&det[f.k]);if(v)o[f.k]=f.k==='fh'?v.slice(0,16):v.slice(0,f.max||60)}return o}
function pdCheck(m,det){
 const fs=PD_F[m];if(!fs)return '';
 for(const f of fs){const v=pdNorm(f,det&&det[f.k]);
  if(f.k!=='nro'&&f.k!=='txid'&&f.k!=='fh'&&pdPan(v))return 'Eso parece un número de tarjeta completo: NO se guarda. Cargá sólo los últimos 4 dígitos.';
  if(!v)return 'Falta: '+f.l+' ('+PAYS[m]+').';
  if(f.t==='id'&&!f.rx.test(v))return f.l+' no es válido ('+f.h+').';
  if(f.t==='text'&&(v.length<(f.min||1)||v.length>(f.max||60)||/[<>]/.test(v)))return f.l+' no es válido.';
  if(f.t==='sel'&&!f.o.includes(v))return 'Elegí '+f.l.toLowerCase()+'.';
  if(f.t==='dt'){const t=new Date(v).getTime();if(isNaN(t))return 'Revisá '+f.l.toLowerCase()+'.';if(t>now()+10*60000)return 'La fecha de la transferencia no puede ser futura.';if(t<now()-30*864e5)return 'La transferencia tiene más de 30 días: revisá la fecha.'}}
 return ''}
/* clave de unicidad (el mismo comprobante no se usa dos veces) */
function pdKey(m,d){if(!d)return '';if(m==='transferencia'&&d.nro)return 'T|'+d.nro.toUpperCase();if(m==='qr'&&d.txid)return 'Q|'+norm(d.prov||'')+'|'+d.txid.toUpperCase();if((m==='debito'||m==='credito')&&d.auth)return 'C|'+d.last4+'|'+d.auth.toUpperCase()+'|'+String(d.cupon||'').toUpperCase();return ''}
function pdDupSale(key,exceptId){if(!key)return null;for(const s of S.sales){if(s.id===exceptId||s.voided)continue;const ps=payParts(s);for(let i=0;i<ps.length;i++){const d=pdDet(s,i);if(d&&pdKey(ps[i].m,d)===key)return s}}for(const c of S.cobdet){const s=S.sales.find(x=>x.id===c.saleId);if(s&&s.id!==exceptId&&!s.voided){const ps=payParts(s);if(ps[c.idx]&&pdKey(ps[c.idx].m,c.det)===key)return s}}return null}
/* detalle vigente de una parte: el último completado (cobdet) o el original de la entrega */
function pdVers(saleId,idx){return S.cobdet.filter(c=>c.saleId===saleId&&c.idx===idx).sort((a,b)=>a.ver-b.ver)}
function pdDet(s,idx){const v=pdVers(s.id,idx);if(v.length)return v[v.length-1].det;const p=payParts(s)[idx];return p&&p.det||null}
const pdPending=s=>payParts(s).some((p,i)=>PD_F[p.m]&&!pdDet(s,i));
function pdShort(m,d){if(!d)return '';if(m==='transferencia')return (d.ent?d.ent+' · ':'')+'op. '+d.nro;if(m==='qr')return (d.prov||'')+' · '+d.txid;return (d.brand||'')+' ****'+d.last4+' · aut. '+d.auth+(m==='credito'&&d.cuotas?' · '+d.cuotas+' cuota(s)':'')}
/* formulario del comprobante dentro del cobro */
function pdBox(m){
 const fs=PD_F[m];if(!fs)return '';const d=POS.det[m]||{};const sc=POS.sc[m];
 if(sc)return '<div class="notice" style="margin:10px 0 0"><span><b>'+PAYS[m]+' sin comprobante</b> (autorizó '+esc(SES.name)+'): '+esc(sc)+'. Queda en «Pagos a conciliar» para completarlo después.</span><button class="btn g sm" data-a="pdScOff" data-m="'+m+'">Cargar el comprobante</button></div>';
 return '<fieldset class="pdbox" style="margin:10px 0 0;border:1px solid var(--line);border-radius:14px;padding:8px 12px"><legend style="font-weight:700;font-size:13px;padding:0 6px">Datos del comprobante · '+PAYS[m]+'</legend><div class="g2" style="gap:8px">'+fs.map(f=>{const id='pd_'+m+'_'+f.k,v=esc(d[f.k]||'');
  const inp=f.t==='sel'?'<select id="'+id+'" data-ch="pdf" data-m="'+m+'" data-k="'+f.k+'"><option value="">— Elegí —</option>'+f.o.map(o=>'<option'+(d[f.k]===o?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>'
   :f.t==='dt'?'<input id="'+id+'" type="datetime-local" data-in="pdf" data-m="'+m+'" data-k="'+f.k+'" value="'+v+'">'
   :'<input id="'+id+'" data-in="pdf" data-m="'+m+'" data-k="'+f.k+'" autocomplete="off" maxlength="'+(f.k==='last4'?4:f.k==='cuotas'?2:60)+'"'+(f.k==='last4'||f.k==='cuotas'?' inputmode="numeric"':'')+' value="'+v+'" placeholder="'+esc(f.h||'')+'">';
  return '<div><label for="'+id+'" style="margin-top:4px">'+esc(f.l)+'</label>'+inp+'</div>'}).join('')+'</div><div class="bad-t sub" id="pde_'+m+'" style="min-height:18px"></div>'+(SES&&SES.role==='admin'?'<button class="btn g sm" data-a="pdSc" data-m="'+m+'">No tengo el comprobante (autorizar)</button>':'<p class="sub">Si no tenés el comprobante, un administrador puede autorizar el pago sin él.</p>')+'</fieldset>'}
IN.pdf=el=>{const m=el.dataset.m,k=el.dataset.k;POS.det[m]=POS.det[m]||{};POS.det[m][k]=el.value;const e=$('#pde_'+m);if(e)e.textContent=k!=='nro'&&k!=='txid'&&pdPan(el.value)?'Eso parece un número de tarjeta completo: no se guarda.':''};
CH.pdf=el=>IN.pdf(el);
A.pdSc=el=>{const m=el.dataset.m;if(SES.role!=='admin')return toast('Sólo un administrador autoriza un pago sin comprobante');
 askText({title:'Registrar '+PAYS[m]+' sin comprobante',label:'Motivo (queda en auditoría y en «Pagos a conciliar»)',ok:'Autorizar',onOk:v=>{POS.sc[m]=v;audit('cobro_sin_comprobante_autorizado',{medio:m,motivo:v});setTimeout(openCobro,0)}});MOD.onClose=()=>setTimeout(()=>{if(!$('#cobDyn'))openCobro()},0)};
A.pdScOff=el=>{delete POS.sc[el.dataset.m];openCobro()};

/* ---------- monedero (saldo a favor del socio) ---------- */
const monOn=()=>S.org.monedero!==false;
function monSaldo(sid){let v=0;for(const f of S.fidmov)if(f.socioId===sid)v+=f.tipo==='carga'?(+f.monto||0):f.tipo==='ajuste'?(+f.monto||0):0;for(const s of S.sales)if(s.socioId===sid&&!s.voided)v-=monOf(s);return r2(v)}
function monMovs(sid){const m=[];
 for(const f of S.fidmov)if(f.socioId===sid)m.push({t:f.t,txt:(f.tipo==='carga'?'Carga '+(f.n||'')+' · '+(PAYS[f.medio]||f.medio):'Ajuste del administrador · '+(f.motivo||'')),monto:+f.monto||0,ref:f.id,kind:f.tipo});
 for(const s of S.sales)if(s.socioId===sid&&!s.voided){const v=monOf(s);if(v>0)m.push({t:s.t,txt:'Entrega '+(s.fc?s.fc.num:s.n)+' pagada con monedero',monto:-v,ref:s.id,kind:'uso'})}
 m.sort((a,b)=>a.t-b.t);let sal=0;for(const x of m){sal=r2(sal+x.monto);x.saldo=sal}return m}
function cajaMon(c){return S.fidmov.filter(f=>f.caja===c.id&&f.tipo==='carga')}
function monHtml(s){
 if(!monOn())return '';const sal=monSaldo(s.id),mv=monMovs(s.id),can=mayo('dispensar','cargar');
 return '<div class="c" style="margin-top:12px;box-shadow:none;border:1px solid var(--line)"><div class="row"><h3 class="sp" style="font-size:16px">Monedero (saldo a favor)</h3><span class="badge '+(sal>0?'ok':'')+'">'+money(sal)+'</span></div><p class="sub" style="margin:6px 0">El socio carga dinero por adelantado y lo usa en sus próximas entregas. El dinero entra a la caja al cargarlo.</p>'+
 (mv.length?'<div class="tw"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th class="r">Importe</th><th class="r">Saldo</th></tr></thead><tbody>'+mv.slice(-30).map(x=>'<tr><td>'+fdt(x.t)+'</td><td>'+esc(x.txt)+'</td><td class="r '+(x.monto<0?'bad-t':'ok-t')+'">'+(x.monto<0?'−':'+')+money(Math.abs(x.monto))+'</td><td class="r"><b>'+money(x.saldo)+'</b></td></tr>').join('')+'</tbody></table></div>':'<p class="sub">Sin movimientos.</p>')+
 '<div class="row" style="margin-top:10px">'+(can?'<button class="btn y sm" data-a="monCargar" data-id="'+esc(s.id)+'">'+ic('cash')+'Cargar saldo</button>':'')+(SES.role==='admin'?'<button class="btn g sm" data-a="monAjuste" data-id="'+esc(s.id)+'">Ajuste</button>':'')+'</div></div>'}
A.monCargar=el=>{const s=socioById(el.dataset.id);if(!s)return;if(!mayo('dispensar','cargar'))return toast('No tenés permiso');
 if(!S.cash.open)return toast('Abrí la caja para cargar saldo (el dinero entra a la caja).');
 modal('<h2>Cargar saldo al monedero</h2><p class="sub" style="margin:4px 0 10px">'+esc(s.name)+' · '+esc(s.legajo)+' · saldo actual <b>'+money(monSaldo(s.id))+'</b></p><label for="mo_m">Importe</label><input class="num" type="number" inputmode="decimal" step="any" min="0" id="mo_m" placeholder="Importe"><label for="mo_med">Medio</label><select id="mo_med">'+MONEY_PAYS.map(k=>'<option value="'+k+'">'+PAYS[k]+'</option>').join('')+'</select><label for="mo_r">Rubro (obligatorio)</label>'+rubroSelect('mo_r','ingreso','r_mon')+'<label for="mo_o">Comprobante u observación (opcional)</label><input id="mo_o" maxlength="80"><div class="row" style="margin-top:16px"><button class="btn y lg sp" data-a="monCargarOk" data-id="'+esc(s.id)+'">Cargar</button><button class="btn g lg" data-a="mclose">Cancelar</button></div>')};
A.monCargarOk=el=>{const s=socioById(el.dataset.id);if(!s)return;const m=$('#mo_m').valueAsNumber,med=$('#mo_med').value,obs=($('#mo_o').value||'').trim(),rub=rubroSel($('#mo_r').value,'ingreso');
 if(!(m>0)||m>100000000)return toast('Escribí un importe mayor a cero');if(!MONEY_PAYS.includes(med))return toast('Elegí el medio');if(!rub)return toast('Elegí el rubro (obligatorio)');
 if(pdPan(obs))return toast('Eso parece un número de tarjeta completo: no se guarda.');
 if(!S.cash.open)return toast('Abrí la caja');
 const f={id:uid(),n:(DEV?DEV.n:1)+'-M'+seq('mon'),t:now(),tipo:'carga',socioId:s.id,legajo:s.legajo,monto:r2(m),medio:med,rubro:rub,caja:S.cash.open.id,user:SES.name,dev:DEV?DEV.n:1,obs};
 S.fidmov.push(f);audit('monedero_carga',{legajo:s.legajo,n:f.n,monto:f.monto,medio:med,rubro:rub.name});persist();closeModal();toast('Saldo cargado: '+money(monSaldo(s.id)));if(LGJ.id)legajoOpen(LGJ.id);else refresh()};
A.monAjuste=el=>{const s=socioById(el.dataset.id);if(!s||SES.role!=='admin')return toast('Sólo un administrador');
 modal('<h2>Ajuste del monedero</h2><p class="sub" style="margin:4px 0 10px">'+esc(s.name)+' · saldo '+money(monSaldo(s.id))+'. Un ajuste no mueve la caja.</p><label for="mj_s">Tipo</label><select id="mj_s"><option value="1">Sumar saldo</option><option value="-1">Restar saldo</option></select><label for="mj_m">Importe</label><input class="num" type="number" inputmode="decimal" step="any" min="0" id="mj_m" placeholder="Importe"><label for="mj_o">Motivo (obligatorio)</label><input id="mj_o" maxlength="120"><div class="row" style="margin-top:16px"><button class="btn y lg sp" data-a="monAjusteOk" data-id="'+esc(s.id)+'">Guardar</button><button class="btn g lg" data-a="mclose">Cancelar</button></div>')};
A.monAjusteOk=el=>{const s=socioById(el.dataset.id);if(!s||SES.role!=='admin')return;const a=$('#mj_m').valueAsNumber,sg=+$('#mj_s').value,mo=($('#mj_o').value||'').trim();
 if(!(a>0))return toast('Escribí un importe mayor a cero');if(mo.length<3)return toast('Escribí el motivo');const n=r2(a*sg);if(r2(monSaldo(s.id)+n)<0)return toast('El saldo no puede quedar negativo');
 S.fidmov.push({id:uid(),n:(DEV?DEV.n:1)+'-J'+seq('monj'),t:now(),tipo:'ajuste',socioId:s.id,legajo:s.legajo,monto:n,caja:null,user:SES.name,dev:DEV?DEV.n:1,motivo:mo});audit('monedero_ajuste',{legajo:s.legajo,monto:n,motivo:mo});persist();closeModal();toast('Ajuste guardado');if(LGJ.id)legajoOpen(LGJ.id);else refresh()};

/* ---------- niveles del Club (por donaciones de los últimos N días) ---------- */
function nivelOf(s){const n=S.org.niveles;if(!s||!n||!n.on)return null;const since=now()-(Math.max(1,+n.dias||90))*864e5;let t=0;for(const x of S.sales)if(x.socioId===s.id&&!x.voided&&x.t>=since)t+=+x.total||0;t=r2(t);
 if(+n.oro>0&&t>=+n.oro)return{k:'oro',name:'Oro',pct:Math.min(50,Math.max(0,+n.pctOro||0)),t};
 if(+n.plata>0&&t>=+n.plata)return{k:'plata',name:'Plata',pct:Math.min(50,Math.max(0,+n.pctPlata||0)),t};
 return{k:'bronce',name:'Bronce',pct:0,t}}
const nivelBadge=s=>{const n=nivelOf(s);return n?' <span class="badge '+(n.k==='oro'?'warn':n.k==='plata'?'':'ok')+'">'+n.name+'</span>':''};

/* ---------- partes del cobro en curso ---------- */
function cobParts(don){
 if(!(don>0))return{parts:[]};
 if(!POS.split){
  if(POS.pay==='cc')return{parts:[{m:'cc',a:r2(don)}]};
  if(POS.pay==='mon')return{parts:[{m:'mon',a:r2(don)}]};
  const cc=ccNow(don);if(isNaN(cc)||cc<0)return{err:'La parte a cuenta corriente no es un importe válido'};if(cc>don)return{err:'La parte a cuenta corriente no puede superar la donación ('+money(don)+')'};
  const o=[];const paid=r2(don-cc);if(paid>0)o.push({m:POS.pay,a:paid});if(cc>0)o.push({m:'cc',a:cc});return{parts:o}}
 const o=[],seen={};
 for(const p of POS.parts){const a=parseNum(p.a);if(p.a===''||p.a==null)continue;if(isNaN(a)||a<=0)return{err:'Cada medio necesita un importe mayor a cero'};if(!COB_MEDIOS.includes(p.m))return{err:'Medio inválido'};if(seen[p.m])return{err:'El medio '+PAYS[p.m]+' está repetido: sumalo en una sola línea'};seen[p.m]=1;o.push({m:p.m,a:r2(a)})}
 if(!o.length)return{err:'Cargá el importe de cada medio'};
 const dif=cents(don)-o.reduce((s,p)=>s+cents(p.a),0);
 if(dif>0)return{err:'Faltan '+money(dif/100)+' para llegar a la donación',parts:o,dif};
 if(dif<0)return{err:'Sobran '+money(-dif/100)+': la suma supera la donación',parts:o,dif};
 return{parts:o,dif:0}}
const efPart=parts=>(parts||[]).find(p=>p.m==='efectivo');
function vueltoHtml(recv,ef){if(!(ef>0))return '';if(isNaN(recv)||recv===null)return '';if(recv>ef)return '<div class="vuelto" role="alert" aria-live="assertive"><span>VUELTO A ENTREGAR</span><b>'+money(r2(recv-ef))+'</b><small>Recibido '+money(recv)+' − efectivo '+money(ef)+'</small></div>';if(recv===ef)return '<div class="okbox sm">Efectivo justo: sin vuelto.</div>';return '<div class="errbox sm"><b>Recibido insuficiente:</b> faltan '+money(r2(ef-recv))+'.</div>'}
function recvBox(ef,req){return '<div class="rcvbox"><label for="rcv"><b>Importe recibido en efectivo</b> '+(req?'<span class="badge warn">obligatorio</span>':'<span class="sub">(opcional)</span>')+'</label><div class="row" style="flex-wrap:nowrap"><input class="num sp" type="number" inputmode="decimal" step="any" min="0" id="rcv" data-in="recv" placeholder="¿Con cuánto paga?" value="'+esc(POS.recv)+'" style="font-size:22px;min-height:56px"><button class="btn g" data-a="rcvJusto" style="min-height:56px">Justo</button></div><div id="vto">'+vueltoHtml(POS.recv===''?NaN:parseNum(POS.recv),ef)+'</div></div>'}
A.rcvJusto=()=>{const c=cobParts(donNow()),e=efPart(c.parts);if(!e)return;POS.recv=String(e.a);const i=$('#rcv');if(i){i.value=POS.recv;i.focus()}const v=$('#vto');if(v)v.innerHTML=vueltoHtml(e.a,e.a)};
IN.recv=el=>{POS.recv=el.value;const c=cobParts(donNow()),e=efPart(c.parts),v=$('#vto');if(v)v.innerHTML=e?vueltoHtml(el.value===''?NaN:parseNum(el.value),e.a):''};
/* pago dividido: filas medio + importe */
function splitHtml(don){
 const so=recSocio();
 const rows=POS.parts.map((p,i)=>'<div class="row mxrow" style="flex-wrap:nowrap;gap:6px;margin-top:6px"><select data-ch="mxm" data-i="'+i+'" aria-label="Medio '+(i+1)+'" style="flex:1 1 40%">'+COB_MEDIOS.filter(k=>k!=='mon'||(monOn()&&so)).map(k=>'<option value="'+k+'"'+(p.m===k?' selected':'')+'>'+PAYS[k]+'</option>').join('')+'</select><input class="num" type="number" inputmode="decimal" step="any" min="0" data-in="mxa" data-i="'+i+'" aria-label="Importe '+(i+1)+'" placeholder="Importe" value="'+esc(p.a)+'" style="flex:1 1 35%"><button class="btn g sm" data-a="mxResto" data-i="'+i+'">Resto</button>'+(POS.parts.length>1?'<button class="ib" data-a="mxDel" data-i="'+i+'" aria-label="Quitar medio">'+ic('x')+'</button>':'')+'</div>').join('');
 const c=cobParts(don);
 return '<h3 style="margin-top:12px;font-size:15px">Pago dividido</h3>'+rows+'<div class="row" style="margin-top:8px"><button class="btn g sm" data-a="mxAdd">'+ic('plus')+'Agregar medio</button><span class="sp"></span><b id="mxst" class="'+(c.err?'bad-t':'ok-t')+'">'+(c.err?esc(c.err):'La suma cierra: '+money(don))+'</b></div>'}
function mxStatus(){const c=cobParts(donNow()),x=$('#mxst');if(x){x.className=c.err?'bad-t':'ok-t';x.textContent=c.err?c.err:'La suma cierra: '+money(donNow())}const e=efPart(c.parts),v=$('#vto');if(v&&POS.recv!=='')v.innerHTML=e?vueltoHtml(parseNum(POS.recv),e.a):''}
A.cobSplit=()=>{POS.split=!POS.split;if(POS.split&&!POS.parts.length){const don=donNow();POS.parts=[{m:POS.pay==='mon'||POS.pay==='cc'?'efectivo':POS.pay,a:''},{m:POS.pay==='transferencia'?'efectivo':'transferencia',a:''}];if(don>0)POS.parts[0].a=''}openCobro()};
A.mxAdd=()=>{const used=POS.parts.map(p=>p.m);const m=COB_MEDIOS.find(k=>!used.includes(k)&&k!=='mon')||'efectivo';POS.parts.push({m,a:''});openCobro()};
A.mxDel=el=>{POS.parts.splice(+el.dataset.i,1);openCobro()};
A.mxResto=el=>{const i=+el.dataset.i,don=donNow();let o=0;POS.parts.forEach((p,j)=>{if(j!==i){const a=parseNum(p.a);if(a>0)o+=cents(a)}});const r=(cents(don)-o)/100;if(r<=0)return toast('No queda resto para este medio');POS.parts[i].a=String(r2(r));openCobro()};
CH.mxm=el=>{POS.parts[+el.dataset.i].m=el.value;openCobro()};
IN.mxa=el=>{POS.parts[+el.dataset.i].a=el.value;mxStatus()};
CH.mxa=el=>{POS.parts[+el.dataset.i].a=el.value;openCobro()};
function monBox(don,amt){const so=recSocio();if(!monOn())return '';if(!so)return '<div class="notice" style="margin:10px 0 0"><span>El monedero necesita una <b>persona con ficha</b>.</span><button class="btn y sm" data-a="cobRec">Elegir persona</button></div>';const sal=monSaldo(so.id);return '<p class="sub" style="margin-top:8px">Monedero de '+esc(so.name)+': saldo <b>'+money(sal)+'</b>'+(amt>sal?' · <b class="bad-t">no alcanza</b>':' · queda '+money(r2(sal-amt)))+'</p>'}
