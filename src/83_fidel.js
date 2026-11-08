/* ===== Club y fidelización · 2026-11-08 (VB 4.6, 4.24.3–4.24.4, niveles y monedero; versión ONG) =====
   Pestañas: Sellar · Socios del Club · Avisos · Configuración (administrador).
   - Avisos por WhatsApp: se abre WhatsApp con el texto listo (no es un envío automático) y SÓLO a quien
     aceptó recibir mensajes. Cumpleaños y saldo (cuenta corriente / monedero).
   - Baja (anonimiza) y eliminación definitiva (sólo sin historial) por el administrador. */
let FID={tab:'sellar',q:'',f:'all'};
const bdayMD=s=>{const m=/^\d{4}-(\d\d)-(\d\d)$/.exec(s.bday||'');return m?m[1]+'-'+m[2]:''};
function bdayIn(s,days){const md=bdayMD(s);if(!md)return null;for(let i=0;i<=days;i++){if(dkey(now()+i*864e5).slice(5)===md)return i}return null}
const clubSocios=()=>S.socios.filter(s=>!s.baja);
VIEWS.sellos={t:'Club y fidelización',r(){
 const adm=SES.role==='admin';
 const tabs=[['sellar','Sellar'],['socios','Socios del Club'],['avisos','Avisos'],].concat(adm?[['config','Configuración']]:[]);
 if(!tabs.some(x=>x[0]===FID.tab))FID.tab='sellar';
 let body='';
 if(FID.tab==='sellar')body=sellarHtml();
 else if(FID.tab==='socios')body=fidSociosHtml();
 else if(FID.tab==='avisos')body=fidAvisosHtml();
 else body=fidConfigHtml();
 return '<div class="ph"><div><h1>Club y fidelización</h1><span class="sub">Sellos, tarjeta en el celular, niveles, monedero y avisos</span></div></div><div class="chips" role="tablist" style="margin-bottom:14px">'+tabs.map(x=>'<button class="chip'+(FID.tab===x[0]?' on':'')+'" role="tab" aria-selected="'+(FID.tab===x[0])+'" data-a="fidTab" data-id="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'+body}};
A.fidTab=el=>{FID.tab=el.dataset.id;refresh()};
function fidSociosHtml(){
 const q=norm(FID.q);const goal=S.org.stampGoal||10;
 let l=clubSocios().filter(s=>!q||norm(s.name+' '+s.legajo+' '+(s.doc||'')).includes(q));
 if(FID.f==='card')l=l.filter(s=>cardOk(s.card));else if(FID.f==='nocard')l=l.filter(s=>!cardOk(s.card));else if(FID.f==='full')l=l.filter(s=>progress(s).have>=goal);else if(FID.f==='mon')l=l.filter(s=>monSaldo(s.id)>0);
 l=l.slice().sort((a,b)=>progress(b).have-progress(a).have||a.name.localeCompare(b.name,'es'));
 return '<div class="c"><div class="row" style="margin-bottom:10px"><input id="fdq" data-in="fdq" placeholder="Nombre, legajo o DNI" value="'+esc(FID.q)+'" style="max-width:260px" aria-label="Buscar socio"><div class="chips">'+[['all','Todos'],['card','Con tarjeta digital'],['nocard','Sin tarjeta digital'],['full','Tarjeta completa'],['mon','Con saldo en monedero']].map(x=>'<button class="chip'+(FID.f===x[0]?' on':'')+'" data-a="fdF" data-id="'+x[0]+'">'+x[1]+'</button>').join('')+'</div></div>'+
 '<div class="tw"><table><thead><tr><th>Socio/a</th><th class="r">Sellos</th><th>Nivel</th><th class="r">Monedero</th><th>Tarjeta</th><th></th></tr></thead><tbody>'+(l.length?l.slice(0,300).map(s=>{const pr=progress(s);return '<tr><td><b>'+esc(s.name)+'</b><div class="sub">'+esc(s.legajo)+(s.consent?'':' · sin consentimiento de mensajes')+'</div></td><td class="r">'+pr.have+' / '+pr.goal+(pr.have>=pr.goal?' <span class="badge ok">completa</span>':'')+'</td><td>'+(nivelOf(s)?nivelBadge(s):'—')+'</td><td class="r">'+(monOn()?money(monSaldo(s.id)):'—')+'</td><td>'+(cardOk(s.card)?'<span class="badge ok">en el celular</span>':'<span class="badge">sin emitir</span>')+'</td><td><div class="act"><button class="btn g sm" data-a="socioCard" data-id="'+esc(s.id)+'">'+ic('qr')+'Tarjeta</button><button class="btn g sm" data-a="legajo" data-id="'+esc(s.id)+'">Legajo</button></div></td></tr>'}).join(''):'<tr><td colspan="6" class="sub">No hay socios con este filtro.</td></tr>')+'</tbody></table></div>'+(l.length>300?'<p class="sub">Se muestran 300 de '+l.length+'; usá la búsqueda.</p>':'')+'</div>'}
IN.fdq=el=>{FID.q=el.value;clearTimeout(IN._t);IN._t=setTimeout(()=>{refresh();const q=$('#fdq');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}},300)};
A.fdF=el=>{FID.f=el.dataset.id;refresh()};
/* ---------- avisos por WhatsApp (sólo con consentimiento) ---------- */
function fidMsg(s,k){const b=S.org.brand||S.org.nameCom||'';const n=s.nombre||s.name.split(' ')[0];
 if(k==='cumple')return '¡Feliz cumpleaños, '+n+'! Te saluda todo el equipo de '+b+'.';
 const cc=ccSaldo(s.id),mo=monOn()?monSaldo(s.id):0,pr=progress(s);
 return 'Hola '+n+', te escribimos de '+b+'. '+(cc>0?'Tu cuenta corriente tiene un saldo pendiente de '+money(cc)+'. ':'')+(mo>0?'Tenés '+money(mo)+' a favor en tu monedero. ':'')+'Llevás '+pr.have+' de '+pr.goal+' sellos en el Club.'}
function fidAvisosHtml(){
 const con=clubSocios().filter(s=>s.consent&&s.wa);const ov=S.org.avisos||{};
 const cum=con.map(s=>({s,d:bdayIn(s,7)})).filter(x=>x.d!=null).sort((a,b)=>a.d-b.d);
 const sal=con.filter(s=>ccSaldo(s.id)>0||(monOn()&&monSaldo(s.id)>0));
 const sinC=clubSocios().filter(s=>!s.consent).length;
 const row=(s,k,extra)=>'<div class="li"><div><b>'+esc(s.name)+'</b><div class="sub">'+extra+'</div></div><a class="btn wa sm" target="_blank" rel="noopener noreferrer" data-a="fidAviso" data-id="'+esc(s.id)+'" data-k="'+k+'" href="'+esc(waUrl(s.wa,fidMsg(s,k)))+'">'+ic('wa')+'Abrir WhatsApp</a></div>';
 return '<p class="sub" style="margin-bottom:10px">Se abre WhatsApp con el mensaje listo para revisar y enviar (no es un envío automático). Sólo aparecen las personas que aceptaron recibir mensajes'+(sinC?' · '+sinC+' persona(s) sin consentimiento quedan fuera':'')+'.</p><div class="g2" style="gap:14px">'+
 (ov.cumple!==false?'<div class="c"><h2>Cumpleaños (próximos 7 días)</h2>'+(cum.length?'<div class="list">'+cum.map(x=>row(x.s,'cumple',x.d===0?'<b>hoy</b>':'en '+x.d+' día(s) · '+fdate(dkey(now()+x.d*864e5)))).join('')+'</div>':'<p class="sub">No hay cumpleaños esta semana.</p>')+'</div>':'')+
 (ov.saldo!==false?'<div class="c"><h2>Saldos (cuenta corriente y monedero)</h2>'+(sal.length?'<div class="list">'+sal.map(s=>row(s,'saldo',(ccSaldo(s.id)>0?'debe '+money(ccSaldo(s.id)):'')+(monOn()&&monSaldo(s.id)>0?' · a favor '+money(monSaldo(s.id)):''))).join('')+'</div>':'<p class="sub">Nadie tiene saldo pendiente ni a favor.</p>')+'</div>':'')+'</div>'}
A.fidAviso=el=>{const s=socioById(el.dataset.id);if(!s||!s.consent){toast('Sin consentimiento: no se le escribe');return false}audit('aviso_whatsapp',{legajo:s.legajo,tipo:el.dataset.k})};
/* ---------- configuración (administrador) ---------- */
function fidConfigHtml(){const o=S.org,n=o.niveles||{},av=o.avisos||{};
 return '<div class="g2" style="gap:14px"><div class="c"><h2>Tarjeta de sellos</h2><label for="fc_g">Sellos para el beneficio</label><input class="num" type="number" min="1" max="30" id="fc_g" value="'+esc(o.stampGoal||10)+'"><label for="fc_r">Beneficio</label><input id="fc_r" maxlength="120" value="'+esc(o.stampReward||'')+'"><h2 style="margin-top:16px">Monedero</h2><label class="chk" for="fc_m"><input type="checkbox" id="fc_m"'+(o.monedero!==false?' checked':'')+'> Los socios pueden cargar saldo a favor y usarlo en sus entregas</label><h2 style="margin-top:16px">Avisos</h2><label class="chk" for="fc_ac"><input type="checkbox" id="fc_ac"'+(av.cumple!==false?' checked':'')+'> Saludo de cumpleaños</label><label class="chk" for="fc_as"><input type="checkbox" id="fc_as"'+(av.saldo!==false?' checked':'')+'> Aviso de saldo</label></div>'+
 '<div class="c"><h2>Niveles del Club</h2><label class="chk" for="fc_n"><input type="checkbox" id="fc_n"'+(n.on?' checked':'')+'> Usar niveles (Bronce, Plata, Oro) según las donaciones de los últimos días</label><label for="fc_d">Días que se cuentan</label><input class="num" type="number" min="1" max="730" id="fc_d" value="'+esc(n.dias||90)+'"><div class="g2" style="gap:8px"><div><label for="fc_p">Plata desde (donaciones)</label><input class="num" type="number" min="0" id="fc_p" value="'+esc(n.plata||'')+'" placeholder="Importe"></div><div><label for="fc_pp">% sugerido menos (Plata)</label><input class="num" type="number" min="0" max="50" id="fc_pp" value="'+esc(n.pctPlata||'')+'" placeholder="0"></div><div><label for="fc_o">Oro desde (donaciones)</label><input class="num" type="number" min="0" id="fc_o" value="'+esc(n.oro||'')+'" placeholder="Importe"></div><div><label for="fc_op">% sugerido menos (Oro)</label><input class="num" type="number" min="0" max="50" id="fc_op" value="'+esc(n.pctOro||'')+'" placeholder="0"></div></div><p class="sub" style="margin-top:6px">El porcentaje sólo se ofrece al registrar la entrega (se aplica con un toque y queda en auditoría). La donación sigue siendo voluntaria.</p></div></div><button class="btn y lg" style="margin-top:14px" data-a="fidCfgOk">Guardar configuración</button>'}
A.fidCfgOk=()=>{if(SES.role!=='admin')return toast('Sólo un administrador');const v=id=>$('#'+id).valueAsNumber;
 const g=v('fc_g');if(!(g>=1&&g<=30))return toast('Los sellos para el beneficio van de 1 a 30');
 const pl=v('fc_p')||0,or=v('fc_o')||0,pp=v('fc_pp')||0,op=v('fc_op')||0,d=v('fc_d')||90;
 if(pl<0||or<0||pp<0||op<0||pp>50||op>50)return toast('Revisá los importes y porcentajes (máximo 50 %)');
 if($('#fc_n').checked&&or>0&&pl>0&&or<=pl)return toast('El nivel Oro tiene que pedir más que Plata');
 const before=JSON.stringify([S.org.stampGoal,S.org.stampReward,S.org.monedero,S.org.niveles,S.org.avisos]);
 S.org.stampGoal=Math.round(g);S.org.stampReward=$('#fc_r').value.trim().slice(0,120);S.org.monedero=$('#fc_m').checked;
 S.org.niveles={on:$('#fc_n').checked,dias:Math.max(1,Math.min(730,Math.round(d))),plata:r2(pl),oro:r2(or),pctPlata:pp,pctOro:op};
 S.org.avisos={cumple:$('#fc_ac').checked,saldo:$('#fc_as').checked};
 audit('club_configuracion',{antes:before,despues:JSON.stringify([S.org.stampGoal,S.org.stampReward,S.org.monedero,S.org.niveles,S.org.avisos])});persist();toast('Configuración del Club guardada');refresh()};
/* ---------- baja y eliminación de una persona (administrador) ---------- */
function socioHist(s){const h=[];if(S.sales.some(x=>x.socioId===s.id))h.push('entregas');if(S.pagos.some(x=>x.socioId===s.id))h.push('pagos de cuenta corriente');if(S.fidmov.some(x=>x.socioId===s.id))h.push('monedero');if(S.legDocs.some(x=>x.socioId===s.id))h.push('documentos del legajo');if(S.tramites.some(x=>x.socioId===s.id))h.push('trámites');if((s.stamps||[]).length)h.push('sellos');if(s.driveId)h.push('carpeta en Drive');return h}
A.socioBaja=el=>{const s=socioById(el.dataset.id);if(!s||SES.role!=='admin')return toast('Sólo un administrador');
 const cc=ccSaldo(s.id),mo=monSaldo(s.id);if(cc>0)return toast('Tiene una deuda de '+money(cc)+' en cuenta corriente: primero registrá el pago.',6000);if(mo>0)return toast('Tiene '+money(mo)+' a favor en el monedero: primero devolvelo (ajuste con motivo).',6000);
 const h=socioHist(s),del=!h.length;
 modal('<h2>'+(del?'Eliminar':'Dar de baja')+' · '+esc(s.name)+'</h2><p class="sub" style="margin:6px 0">'+(del?'No tiene historial: se elimina la ficha en todos los equipos.':'Tiene historial ('+esc(h.join(', '))+'): se <b>anonimiza</b>. Se borran nombre, documento, WhatsApp, correo, nacimiento y domicilio; se anula la tarjeta del Club. Las entregas, comprobantes y documentos de salud se conservan con el legajo '+esc(s.legajo)+' [VERIFICAR plazos de conservación con asesoría legal].')+'</p><label for="sb_m">Motivo (obligatorio)</label><input id="sb_m" maxlength="160"><label for="sb_c">Para confirmar escribí el legajo: <b>'+esc(s.legajo)+'</b></label><input id="sb_c" autocomplete="off"><div class="row" style="margin-top:14px"><button class="btn bad lg sp" data-a="socioBajaOk" data-id="'+esc(s.id)+'">'+(del?'Eliminar definitivamente':'Dar de baja y anonimizar')+'</button><button class="btn g lg" data-a="mclose">Cancelar</button></div>')};
A.socioBajaOk=el=>{const s=socioById(el.dataset.id);if(!s||SES.role!=='admin')return;const mo=($('#sb_m').value||'').trim(),cf=($('#sb_c').value||'').trim().toUpperCase();
 if(mo.length<3)return toast('Escribí el motivo');if(cf!==String(s.legajo).toUpperCase())return toast('El legajo no coincide');
 const h=socioHist(s);
 for(const k of Object.keys(S.inbox||{})){const x=S.inbox[k];if(x&&x.payload&&x.estado==='nuevo'&&((s.wa&&last10(x.payload.wa)===last10(s.wa))||(s.doc&&x.payload.doc===s.doc)))x.bajaRel=true}
 if(!h.length){S.socios=S.socios.filter(x=>x.id!==s.id);audit('socio_eliminado',{legajo:s.legajo,motivo:mo})}
 else{Object.assign(s,{nombre:'Baja',apellido:s.legajo,name:'Baja '+s.legajo,doc:'',wa:'',email:'',bday:'',cp:'',domicilio:'',ocupacion:'',obraSocial:'',tutor:null,notes:'',consent:false,card:null,cardUse:[],cardNonce:'',baja:{t:now(),by:SES.name,motivo:mo}});audit('socio_baja',{legajo:s.legajo,motivo:mo})}
 persist();closeModal();LGJ.id=null;toast(h.length?'Baja registrada: datos personales anonimizados':'Persona eliminada');refresh()};
