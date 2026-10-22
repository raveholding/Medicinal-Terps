/* ===== Cuenta corriente de socios y pacientes (donaciones a cuenta) =====
   - Una entrega puede quedar total o parcialmente «a cuenta corriente» (sale.cc): exige una persona con ficha
     y un límite asignado por la administración (socio.limit). El límite lo controla el mostrador; superarlo
     necesita autorización de un administrador con motivo (queda en auditoría).
   - El saldo NO se guarda: se calcula siempre desde las entregas (débitos) y los pagos (créditos), así no se desfasa.
   - Los pagos van a la colección «pagos» (sólo agregar). Un pago mal cargado se corrige con una anulación (registro nuevo).
   - El dinero de un pago entra a la caja abierta por su medio y con rubro obligatorio; la parte a cuenta corriente
     de una entrega no suma a la caja ni al efectivo esperado. */
const ccOf=s=>r2(Number(s&&s.cc)||0);
const pagoAnulado=id=>S.pagos.some(x=>x.tipo==='anulacion'&&x.ref===id);
function ccMovs(sid){
 const m=[];
 for(const s of S.sales){if(s.socioId!==sid||s.voided)continue;const c=ccOf(s);if(c>0)m.push({t:s.t,tipo:'deb',monto:c,txt:'Entrega '+(s.fc?s.fc.num:s.n)+' · a cuenta corriente',ref:s.id,kind:'sale'})}
 for(const p of S.pagos){if(p.socioId!==sid)continue;
  if(p.tipo==='cobro')m.push({t:p.t,tipo:'cre',monto:r2(p.monto),txt:'Pago '+(p.n||'')+' · '+(PAYS[p.medio]||p.medio||'')+(pagoAnulado(p.id)?' (anulado)':''),ref:p.id,kind:'pago',anulado:pagoAnulado(p.id)});
  else if(p.tipo==='anulacion')m.push({t:p.t,tipo:'deb',monto:r2(p.monto),txt:'Anulación del pago '+(p.refN||'')+(p.motivo?' · '+p.motivo:''),ref:p.id,kind:'anul'})}
 m.sort((a,b)=>a.t-b.t);let sal=0;for(const x of m){sal=r2(sal+(x.tipo==='deb'?x.monto:-x.monto));x.saldo=sal}
 return m}
function ccSaldo(sid){let s=0;for(const x of S.sales)if(x.socioId===sid&&!x.voided)s+=ccOf(x);for(const p of S.pagos)if(p.socioId===sid)s+=p.tipo==='cobro'?-p.monto:(p.tipo==='anulacion'?p.monto:0);return r2(s)}
function ccTotalDeuda(){const by={};for(const x of S.sales)if(x.socioId&&!x.voided&&ccOf(x)>0)by[x.socioId]=1;for(const p of S.pagos)by[p.socioId]=1;let t=0,n=0;for(const id of Object.keys(by)){const v=ccSaldo(id);if(v>0){t=r2(t+v);n++}}return{total:t,n}}
const ccBadge=s=>{const v=ccSaldo(s.id);return v>0?' <span class="badge warn">debe '+money(v)+'</span>':(v<0?' <span class="badge ok">a favor '+money(-v)+'</span>':'')};
function ccHtml(s){
 const sal=ccSaldo(s.id),lim=Number(s.limit)||0,movs=ccMovs(s.id),can2=mayo('dispensar','cargar');
 return '<div class="c" style="margin-top:12px;box-shadow:none;border:1px solid var(--line)"><div class="row"><h3 class="sp" style="font-size:16px">Cuenta corriente</h3>'+(sal>0?'<span class="badge warn">Debe '+money(sal)+'</span>':sal<0?'<span class="badge ok">Saldo a favor '+money(-sal)+'</span>':'<span class="badge ok">Al día</span>')+'</div>'+
 '<p class="sub" style="margin:6px 0">'+(lim>0?'Límite asignado: <b>'+money(lim)+'</b> · disponible '+money(Math.max(0,r2(lim-sal))):'Sin cuenta corriente habilitada (límite 0). Un administrador la habilita poniendo un límite en la ficha.')+'</p>'+
 (movs.length?'<div class="tw"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th class="r">Debe</th><th class="r">Pagó</th><th class="r">Saldo</th><th></th></tr></thead><tbody>'+movs.slice(-40).map(x=>'<tr'+(x.anulado?' style="opacity:.55"':'')+'><td>'+fdt(x.t)+'</td><td>'+esc(x.txt)+'</td><td class="r">'+(x.tipo==='deb'?money(x.monto):'')+'</td><td class="r">'+(x.tipo==='cre'?money(x.monto):'')+'</td><td class="r"><b>'+money(x.saldo)+'</b></td><td>'+(x.kind==='pago'?'<div class="act"><button class="btn g sm" data-a="ccRecibo" data-id="'+esc(x.ref)+'">Recibo</button>'+(!x.anulado&&SES.role==='admin'?'<button class="btn g sm" data-a="ccAnular" data-id="'+esc(x.ref)+'">Anular</button>':'')+'</div>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="sub">Sin movimientos.</p>')+
 (can2?'<div class="row" style="margin-top:10px">'+(sal>0?'<button class="btn y sm" data-a="ccPagar" data-id="'+esc(s.id)+'">'+ic('cash')+'Registrar pago a la cuenta</button>':'')+'</div>':'')+'</div>'}
/* ---------- registrar un pago a la cuenta ---------- */
const CCMED=['efectivo','transferencia','qr','debito','credito'];
A.ccPagar=el=>{
 const s=socioById(el.dataset.id);if(!s)return;if(!mayo('dispensar','cargar'))return toast('No tenés permiso para registrar pagos');
 const sal=ccSaldo(s.id);if(sal<=0)return toast('La cuenta no tiene saldo pendiente');
 if(!S.cash.open)return toast('Abrí la caja para registrar el pago (el dinero entra a la caja).');
 modal('<h2>Pago a la cuenta corriente</h2><p class="sub" style="margin:4px 0 10px">'+esc(s.name)+' · '+esc(s.legajo)+' · debe <b>'+money(sal)+'</b></p><label for="cc_m">Importe</label><input class="num" type="number" inputmode="decimal" step="any" min="0" id="cc_m" placeholder="Importe" value="'+sal+'"><label for="cc_med">Medio</label><select id="cc_med">'+CCMED.map(k=>'<option value="'+k+'">'+PAYS[k]+'</option>').join('')+'</select><label for="cc_r">Rubro (obligatorio)</label>'+rubroSelect('cc_r','ingreso','r_cc')+'<label for="cc_o">Observación (opcional)</label><input id="cc_o" maxlength="120"><div class="row" style="margin-top:16px"><button class="btn y lg sp" data-a="ccPagarOk" data-id="'+esc(s.id)+'">Registrar pago</button><button class="btn g lg" data-a="mclose">Cancelar</button></div>')};
A.ccPagarOk=el=>{
 const s=socioById(el.dataset.id);if(!s)return;const m=$('#cc_m').valueAsNumber,med=$('#cc_med').value,obs=($('#cc_o').value||'').trim();const rub=rubroSel($('#cc_r').value,'ingreso');
 const sal=ccSaldo(s.id);
 if(!(m>0))return toast('Escribí un importe mayor a cero');
 if(r2(m)>sal)return toast('El pago supera la deuda ('+money(sal)+')');
 if(!CCMED.includes(med))return toast('Elegí el medio');
 if(!rub)return toast('Elegí el rubro (obligatorio)');
 if(!S.cash.open)return toast('Abrí la caja para registrar el pago');
 const p={id:uid(),n:(DEV?DEV.n:1)+'-P'+seq('cc'),t:now(),tipo:'cobro',socioId:s.id,legajo:s.legajo,monto:r2(m),medio:med,rubro:rub,caja:S.cash.open.id,user:SES.name,dev:DEV?DEV.n:1,obs};
 S.pagos.push(p);audit('cuenta_corriente_pago',{legajo:s.legajo,n:p.n,monto:p.monto,medio:med,rubro:rub.name});persist();closeModal();toast('Pago registrado');ccRecibo(p);refresh()};
A.ccAnular=el=>{
 if(SES.role!=='admin')return toast('Sólo un administrador anula pagos');const p=S.pagos.find(x=>x.id===el.dataset.id);if(!p||p.tipo!=='cobro')return;if(pagoAnulado(p.id))return toast('Ese pago ya está anulado');
 askText({title:'Anular el pago '+p.n,label:'Motivo (el pago no se borra: se registra una anulación y la deuda vuelve)',ok:'Anular',onOk:m=>{
  if(pagoAnulado(p.id))return;const a={id:uid(),n:(DEV?DEV.n:1)+'-A'+seq('ccA'),t:now(),tipo:'anulacion',ref:p.id,refN:p.n,socioId:p.socioId,legajo:p.legajo,monto:p.monto,medio:p.medio,rubro:p.rubro,caja:S.cash.open?S.cash.open.id:null,user:SES.name,dev:DEV?DEV.n:1,motivo:m};
  S.pagos.push(a);audit('cuenta_corriente_anulacion',{pago:p.n,monto:p.monto,motivo:m});persist();toast('Pago anulado: la deuda vuelve a la cuenta');if(LGJ.id)legajoOpen(LGJ.id);else refresh()}})};
function ccRecibo(p){
 const o=S.org,s=socioById(p.socioId)||{name:'—',legajo:p.legajo||''};
 modal('<div class="printable"><div class="ticket"><div class="c2"><b>'+esc(o.nameLegal)+'</b><br>'+esc(o.nameCom)+'<br>CUIT '+esc(o.cuit)+'</div><hr><div class="c2"><b>RECIBO DE PAGO · CUENTA CORRIENTE</b><br>N° '+esc(p.n)+'<br>'+fdt(p.t)+'</div><hr><div>'+esc(s.name)+' · '+esc(s.legajo)+'</div><div class="rw" style="font-size:15px"><b>IMPORTE</b><b>'+money(p.monto)+'</b></div><div class="rw"><span>Medio</span><span>'+esc(PAYS[p.medio]||p.medio)+'</span></div>'+(p.rubro?'<div class="rw"><span>Rubro</span><span>'+esc(p.rubro.name)+'</span></div>':'')+'<div class="rw"><span>Saldo de la cuenta</span><span>'+money(ccSaldo(p.socioId))+'</span></div>'+(pagoAnulado(p.id)?'<div class="nv">PAGO ANULADO</div>':'')+'<div>Atendió: '+esc(p.user)+'</div><div class="nv">DOCUMENTO NO VÁLIDO COMO FACTURA</div><hr><div class="c2" style="font-size:10px">Sistema VB · '+esc(RAVE.name)+'<br>WhatsApp '+esc(RAVE.tel)+' · '+esc(RAVE.mail)+'</div></div></div><div class="row no-p" style="margin-top:14px"><button class="btn y sp" data-a="tkPrint">'+ic('print')+'Imprimir</button><button class="btn g" data-a="mclose">Cerrar</button></div>')}
A.ccRecibo=el=>{const p=S.pagos.find(x=>x.id===el.dataset.id);if(p)ccRecibo(p)};
/* pagos de cuenta corriente que entraron en una caja (descontadas las anulaciones hechas en esa misma caja) */
function cajaPagos(c){const l=S.pagos.filter(p=>p.caja===c.id);return{cob:l.filter(p=>p.tipo==='cobro'),anu:l.filter(p=>p.tipo==='anulacion')}}
