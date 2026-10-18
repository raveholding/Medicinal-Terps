/* ===== Importar / Exportar ===== */
const MAXROWS=20000,MAXBYTES=15*1024*1024;
function parseDate(v){
 if(v==null||v==='')return'';
 if(typeof v==='number'||/^\d{5}(\.\d+)?$/.test(String(v).trim())){const n=Number(v);if(n>20000&&n<80000){return dkey(Date.UTC(1899,11,30)+Math.floor(n)*864e5+12*36e5)}}
 const s=String(v).trim();let m;
 if((m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/)))return m[1]+'-'+pad(+m[2])+'-'+pad(+m[3]);
 if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})(?!\d)/))){let y=m[3];if(y.length===2){const cy=new Date().getFullYear()%100;y=(+y>cy+1?'19':'20')+y}const d=+m[1],mo=+m[2];if(mo<1||mo>12||d<1||d>31)return'';return y+'-'+pad(mo)+'-'+pad(d)}
 return''}
function detectDelim(txt){const lines=txt.split(/\r?\n/).slice(0,8).filter(Boolean);let best=';',bs=-1;for(const d of [';',',','\t','|']){const cs=lines.map(l=>{let n=0,q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===d&&!q)n++}return n});const ok=cs.length&&cs[0]>0&&cs.every(c=>c===cs[0]);const sc=ok?cs[0]+1000:cs[0];if(sc>bs){bs=sc;best=d}}return best}
function parseCSV(txt,d){const rows=[];let row=[],cur='',q=false;for(let i=0;i<txt.length;i++){const c=txt[i];if(q){if(c==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}else if(c==='"')q=true;else if(c===d){row.push(cur);cur=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(cur);cur='';rows.push(row);row=[];if(rows.length>MAXROWS+30)throw new Error('Demasiadas filas')}else cur+=c}
 if(cur!==''||row.length){row.push(cur);rows.push(row)}return rows.filter(r=>r.some(c=>String(c).trim()!==''))}
/* lector mínimo de .xlsx (zip + xml) */
async function inflate(u8){const ds=new DecompressionStream('deflate-raw');const w=ds.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())}
async function unzip(buf){
 const u=new Uint8Array(buf),dv=new DataView(buf);let e=-1;for(let i=u.length-22;i>=Math.max(0,u.length-70000);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}
 if(e<0)throw new Error('No es un .xlsx válido');
 const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const files={};
 for(let k=0;k<n;k++){if(dv.getUint32(p,true)!==0x02014b50)break;const meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);const name=td.decode(u.subarray(p+46,p+46+nl));
  files[name]={meth,csz,off};p+=46+nl+el+cl}
 const get=async name=>{const f=files[name];if(!f)return null;const nl=dv.getUint16(f.off+26,true),el=dv.getUint16(f.off+28,true);const d=u.subarray(f.off+30+nl+el,f.off+30+nl+el+f.csz);return td.decode(f.meth===0?d:await inflate(d))};
 return{get,names:Object.keys(files)}}
const colIdx=ref=>{const m=/^([A-Z]+)/.exec(ref);let n=0;for(const ch of m[1])n=n*26+ch.charCodeAt(0)-64;return n-1};
async function parseXlsx(buf){
 const z=await unzip(buf);const ss=[];const sx=await z.get('xl/sharedStrings.xml');
 if(sx){const d=new DOMParser().parseFromString(sx,'application/xml');for(const si of d.getElementsByTagName('si')){ss.push(Array.from(si.getElementsByTagName('t')).map(t=>t.textContent).join(''))}}
 let sheet=z.names.filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];if(!sheet)throw new Error('El .xlsx no tiene hojas');
 const wb=await z.get('xl/workbook.xml'),rel=await z.get('xl/_rels/workbook.xml.rels');
 if(wb&&rel){try{const w=new DOMParser().parseFromString(wb,'application/xml'),r=new DOMParser().parseFromString(rel,'application/xml');const s0=w.getElementsByTagName('sheet')[0];const rid=s0.getAttribute('r:id')||s0.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');for(const x of r.getElementsByTagName('Relationship'))if(x.getAttribute('Id')===rid){let t=x.getAttribute('Target');t=t.startsWith('/')?t.slice(1):'xl/'+t;if(z.names.includes(t))sheet=t}}catch(e){}}
 const xml=new DOMParser().parseFromString(await z.get(sheet),'application/xml');const rows=[];
 for(const r of xml.getElementsByTagName('row')){const arr=[];for(const c of r.getElementsByTagName('c')){const i=colIdx(c.getAttribute('r')||'A1'),t=c.getAttribute('t');let v='';const ve=c.getElementsByTagName('v')[0];
   if(t==='s'&&ve)v=ss[+ve.textContent]||'';else if(t==='inlineStr')v=Array.from(c.getElementsByTagName('t')).map(x=>x.textContent).join('');else if(ve){v=ve.textContent;if(t!=='str'&&t!=='b'&&t!=='e'&&v!==''&&!isNaN(+v))v=Number(v)}
   while(arr.length<i)arr.push('');arr[i]=v}
  if(arr.some(x=>String(x).trim()!==''))rows.push(arr);if(rows.length>MAXROWS+30)throw new Error('Demasiadas filas')}
 return rows}
async function readRows(file){
 if(file.size>MAXBYTES)throw new Error('El archivo supera 15 MB');
 const buf=await file.arrayBuffer();
 if(/\.xlsx$/i.test(file.name)||(new Uint8Array(buf,0,2)[0]===0x50&&new Uint8Array(buf,0,2)[1]===0x4b))return parseXlsx(buf);
 let txt;try{txt=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){txt=new TextDecoder('windows-1252').decode(buf)}
 txt=txt.replace(/^﻿/,'');return parseCSV(txt,detectDelim(txt))}
const payOf=v=>{const s=norm(v);if(/efect|cash/.test(s))return'efectivo';if(/transf/.test(s))return'transferencia';if(/qr|mercado/.test(s))return'qr';if(/deb/.test(s))return'debito';if(/cred|tarj/.test(s))return'credito';return'efectivo'};
const F=(k,l,syn,req)=>({k,l,syn,req});
const IMPENT={
 productos:{label:'Productos',fields:[F('name','Nombre',['nombre','descripcion','articulo','producto','detalle'],1),F('barcode','Código de barras',['codigo de barras','cod barras','codigo','ean','barras','sku','cod']),F('price','Donación sugerida',['donacion sugerida','donacion','aporte sugerido','aporte','precio venta','precio de venta','precio','pvp'],1),F('cost','Costo',['costo','precio costo','costo unitario','p costo']),F('stock','Stock',['stock','existencia','existencias','cantidad']),F('cat','Categoría',['categoria','rubro','familia','grupo']),F('unit','Unidad',['unidad','um']),F('lote','Lote',['lote','nro lote','n lote']),F('vence','Vencimiento',['vencimiento','vence','fecha de vencimiento'])]},
 socios:{label:'Socios y pacientes',fields:[F('nombre','Nombre',['nombre','nombres'],0),F('apellido','Apellido',['apellido','apellidos']),F('name','Nombre y apellido',['nombre y apellido','apellido y nombre','socio','paciente','razon social']),F('docTipo','Tipo de documento',['tipo de documento','tipo doc','tipo documento']),F('doc','Documento',['documento','dni','cuit','cuil','nro documento','n documento']),F('legajo','Legajo',['legajo','nro legajo','n legajo','socio n']),F('wa','WhatsApp',['whatsapp','celular','telefono','tel','movil']),F('email','Email',['email','mail','correo']),F('bday','Nacimiento',['nacimiento','fecha de nacimiento','cumpleanos','fecha nac']),F('rp','N° REPROCANN',['reprocann','nro reprocann','n reprocann']),F('rpv','Venc. REPROCANN',['vencimiento reprocann','venc reprocann']),F('notes','Notas',['notas','observaciones'])]},
 ventas:{label:'Entregas y donaciones (histórico)',fields:[F('date','Fecha',['fecha','fecha emision','dia'],1),F('n','N° de entrega',['comprobante','numero','nro','n','ticket','entrega']),F('cust','Persona',['persona','socio','paciente','donante','cliente']),F('total','Donación recibida',['donacion recibida','donacion','aporte','total','importe','monto'],1),F('pay','Medio de pago',['medio de pago','pago','forma de pago','medio'])]},
 gastos:{label:'Gastos',fields:[F('date','Fecha',['fecha'],1),F('cat','Categoría',['categoria','tipo']),F('prov','Proveedor',['proveedor','comercio']),F('desc','Detalle',['detalle','descripcion','concepto']),F('amount','Monto',['monto','importe','total'],1)]},
 cajas:{label:'Cajas cerradas (histórico)',fields:[F('date','Fecha de cierre',['fecha','fecha cierre','cierre'],1),F('user','Usuario',['usuario','cajero']),F('total','Total donaciones',['total','donaciones','total donaciones','ventas'],1),F('exp','Efectivo esperado',['esperado','efectivo esperado']),F('decl','Efectivo declarado',['declarado','efectivo declarado','contado']),F('obs','Observaciones',['observaciones','notas'])]}
};
const IMP_RUBRO={ventas:'ingreso',gastos:'egreso'};
let IMP=newImp();
function newImp(ent){return{ent:ent||'productos',raw:null,hdr:0,map:{},opts:{update:false,test:false,dups:true},name:'',hash:'',rubro:''}}
function autoHeader(ent,raw){let best=0,bs=-1;const syn=IMPENT[ent].fields.flatMap(f=>f.syn);for(let i=0;i<Math.min(15,raw.length);i++){const sc=raw[i].filter(c=>{const s=norm(c);return s&&syn.some(x=>s===x||s.includes(x))}).length;if(sc>bs){bs=sc;best=i}}return best}
function autoMap(ent,heads){const map={},used=new Set();const hs=heads.map(norm);
 for(const f of IMPENT[ent].fields){let ci=-1;for(const s of f.syn){const i=hs.findIndex((h,j)=>!used.has(j)&&h===s);if(i>=0){ci=i;break}}
  if(ci<0)for(const s of f.syn){const i=hs.findIndex((h,j)=>!used.has(j)&&h&&h.includes(s));if(i>=0){ci=i;break}}
  if(ci>=0){map[f.k]=ci;used.add(ci)}}return map}
function impPlan(){
 const E=IMPENT[IMP.ent],rows=IMP.raw.slice(IMP.hdr+1);const out=[];const seen=new Set();const usedLeg=new Set();
 const get=(r,k)=>IMP.map[k]>=0&&IMP.map[k]!=null?r[IMP.map[k]]:'';
 rows.forEach((r,i)=>{
  const ln=IMP.hdr+i+2;const res={ln,st:'new',msg:'',o:null};
  try{
   for(const f of E.fields)if(f.req&&(get(r,f.k)===''||get(r,f.k)==null)){throw new Error('Falta '+f.l)}
   if(IMP.ent==='productos'){const name=String(get(r,'name')).trim(),price=parseNum(get(r,'price'));if(isNaN(price)||price<0)throw new Error('Donación sugerida inválida');const cost=parseNum(get(r,'cost')),stock=parseNum(get(r,'stock'));if(stock<0)throw new Error('Stock negativo');
    const bc=String(get(r,'barcode')).trim();const key=bc?'b:'+bc:'n:'+norm(name);if(seen.has(key)){res.st='skip';res.msg='Repetido en el archivo'}else{seen.add(key);const ex=S.products.find(p=>(bc&&p.barcode===bc)||(!bc&&norm(p.name)===norm(name)));
     res.o={name,barcode:bc,price:r2(price),cost:isNaN(cost)?0:r2(cost),stock:isNaN(stock)?0:r3(stock),cat:String(get(r,'cat')).trim(),unit:/^g/.test(norm(get(r,'unit')))?'g':'u',lote:String(get(r,'lote')).trim(),vence:parseDate(get(r,'vence'))};if(ex){res.ex=ex.id;if(IMP.opts.update)res.st='update';else{res.st='skip';res.msg='Ya existe'}}}}
   else if(IMP.ent==='socios'){
    let nombre=String(get(r,'nombre')).trim(),apellido=String(get(r,'apellido')).trim();const full=String(get(r,'name')).trim();
    if(!nombre&&!apellido&&full){if(full.includes(',')){const p=full.split(',');apellido=p[0].trim();nombre=p.slice(1).join(' ').trim()}else{const p=full.split(/\s+/);nombre=p[0]||'';apellido=p.slice(1).join(' ')}}
    if(!nombre||!apellido)throw new Error('Falta nombre y apellido');
    const dv=valDoc(String(get(r,'docTipo')).toUpperCase().trim(),get(r,'doc'));if(!dv.ok)throw new Error(dv.msg);
    const wa=String(get(r,'wa')).replace(/\D/g,'');const bd=parseDate(get(r,'bday'));
    const legIn=String(get(r,'legajo')).trim().toUpperCase();
    const key=dv.digits?'d:'+dv.digits:wa?'w:'+last10(wa):'n:'+norm(nombre+' '+apellido);
    if(seen.has(key)){res.st='skip';res.msg='Repetido en el archivo'}else{seen.add(key);
     const o={nombre,apellido,docTipo:dv.tipo,doc:dv.digits,wa,email:String(get(r,'email')).trim(),bday:bd,rp:String(get(r,'rp')).trim(),rpv:parseDate(get(r,'rpv')),notes:String(get(r,'notes')).trim(),legajoIn:legIn};
     const ex=findDup({doc:o.doc,wa:o.wa,nombre,apellido},'')||(legIn&&S.socios.find(s=>s.legajo===legIn));
     res.o=o;if(ex){res.dup=ex.id;if(IMP.opts.dups){res.st='new';res.msg='Se carga y queda marcada como posible duplicado de '+ex.legajo}else{res.st='skip';res.msg='Posible duplicado de '+ex.legajo+' (omitido)'}}}}
   else if(IMP.ent==='ventas'){const d=parseDate(get(r,'date')),tot=parseNum(get(r,'total'));if(!d)throw new Error('Fecha inválida');if(isNaN(tot)||tot<0)throw new Error('Donación inválida');const n=String(get(r,'n')).trim()||('IMP-'+ln);const key=n+'|'+d+'|'+tot;
    if(seen.has(key)||S.sales.some(s=>s.imported&&s.n===n&&dkey(s.t)===d&&s.total===r2(tot))){res.st='skip';res.msg='Ya cargada'}else{seen.add(key);res.o={d,n,cust:String(get(r,'cust')).trim(),total:r2(tot),pay:payOf(get(r,'pay'))}}}
   else if(IMP.ent==='gastos'){const d=parseDate(get(r,'date')),a=parseNum(get(r,'amount'));if(!d)throw new Error('Fecha inválida');if(isNaN(a)||a<=0)throw new Error('Monto inválido');const o={d,cat:String(get(r,'cat')).trim()||'Otros',prov:String(get(r,'prov')).trim(),desc:String(get(r,'desc')).trim(),amount:r2(a)};const key=[d,o.amount,o.prov,o.desc].join('|');
    if(seen.has(key)||S.gastos.some(g=>g.imported&&[g.date,g.amount,g.prov,g.desc].join('|')===key)){res.st='skip';res.msg='Ya cargado'}else{seen.add(key);res.o=o}}
   else if(IMP.ent==='cajas'){const d=parseDate(get(r,'date')),t=parseNum(get(r,'total'));if(!d)throw new Error('Fecha inválida');if(isNaN(t)||t<0)throw new Error('Total inválido');const ex=parseNum(get(r,'exp')),dc=parseNum(get(r,'decl'));const o={d,user:String(get(r,'user')).trim()||'Importado',total:r2(t),exp:isNaN(ex)?r2(t):r2(ex),decl:isNaN(dc)?(isNaN(ex)?r2(t):r2(ex)):r2(dc),obs:String(get(r,'obs')).trim()};const key=d+'|'+o.total+'|'+o.user;
    if(seen.has(key)||S.cash.closed.some(c=>c.imported&&dkey(c.closedAt)===d&&c.total===o.total&&c.closedBy===o.user)){res.st='skip';res.msg='Ya cargada'}else{seen.add(key);res.o=o}}
  }catch(e){res.st='error';res.msg=e.message}
  out.push(res)});
 return out}
function impSummary(plan){const c={new:0,update:0,skip:0,error:0};plan.forEach(p=>c[p.st]++);return c}
VIEWS.datos={t:'Importar / Exportar',r(){
 const E=IMPENT[IMP.ent];let prev='';
 if(IMP.raw){const heads=IMP.raw[IMP.hdr]||[];const plan=impPlan();const c=impSummary(plan);const rt=IMP_RUBRO[IMP.ent];
  const dupFile=S.batches.find(b=>!b.undone&&b.hash&&b.hash===IMP.hash&&b.ent===IMP.ent);
  prev='<div class="c s12"><h2>2. Columnas del archivo</h2><p class="sub">Archivo: '+esc(IMP.name)+' · '+(IMP.raw.length-IMP.hdr-1)+' filas · fila de títulos: <input type="number" min="1" max="30" id="im_h" data-ch="imh" value="'+(IMP.hdr+1)+'" style="width:80px;display:inline-block;min-height:36px;padding:4px 8px" aria-label="Fila de títulos"></p><div class="g2" style="margin-top:6px">'+E.fields.map(f=>'<div><label>'+f.l+(f.req?' *':'')+'</label><select class="sel" style="width:100%" data-ch="immap" data-k="'+f.k+'"><option value="">— no importar —</option>'+heads.map((h,i)=>'<option value="'+i+'"'+(IMP.map[f.k]===i?' selected':'')+'>'+esc(String(h||('Columna '+(i+1))).slice(0,40))+'</option>').join('')+'</select></div>').join('')+'</div></div>'+
  '<div class="c s12"><h2>3. Vista previa</h2>'+(dupFile?'<div class="notice" style="margin-top:8px">'+ic('alert')+'<span class="sp"><b>Este mismo archivo ya se importó</b> el '+fdt(dupFile.t)+'. No se puede importar dos veces: deshacé esa importación primero.</span></div>':'')+'<div class="chips" style="margin:8px 0 12px"><span class="badge ok">Nuevos: '+c.new+'</span><span class="badge m">A actualizar: '+c.update+'</span><span class="badge">Omitidos: '+c.skip+'</span><span class="badge bad">Con error: '+c.error+'</span></div>'+
  (rt?'<label for="im_r">Rubro financiero de lo importado (obligatorio)</label><div style="max-width:360px;margin-bottom:10px">'+rubroSelect('im_r',rt,IMP.rubro)+'</div>':'')+
  (IMP.ent==='productos'?'<label class="chk" for="im_u"><input type="checkbox" id="im_u" data-ch="imupd"'+(IMP.opts.update?' checked':'')+'> Actualizar donación sugerida y costo de los que ya existen</label>':'')+
  (IMP.ent==='socios'?'<label class="chk" for="im_d"><input type="checkbox" id="im_d" data-ch="imdups"'+(IMP.opts.dups?' checked':'')+'> Cargar los posibles duplicados (quedan marcados para revisar; si no, se omiten)</label>':'')+
  '<label class="chk" for="im_t"><input type="checkbox" id="im_t" data-ch="imtest"'+(IMP.opts.test?' checked':'')+'> Modo prueba (no guarda nada)</label>'+(IMP.ent==='socios'?'<p class="sub" style="margin-top:6px">Las personas importadas quedan <b>sin consentimiento</b> de mensajes ni de datos (la opción más restrictiva) y sin sellos ni canjes. Se avisa cuántas son al terminar (Ley 25.326).</p>':'')+(IMP.ent==='ventas'||IMP.ent==='cajas'||IMP.ent==='gastos'?'<p class="sub" style="margin-top:6px">Lo histórico <b>no mueve stock ni caja viva ni emite Factura C</b>.</p>':'')+'<div class="tw" style="margin-top:10px"><table><thead><tr><th>Fila</th><th>Estado</th><th>Dato</th><th>Detalle</th></tr></thead><tbody>'+plan.slice(0,40).map(p=>'<tr><td>'+p.ln+'</td><td><span class="badge '+({new:'ok',update:'m',skip:'',error:'bad'}[p.st])+'">'+({new:'Nuevo',update:'Actualizar',skip:'Omitido',error:'Error'}[p.st])+'</span></td><td>'+esc(p.o?(p.o.name||(p.o.nombre?p.o.nombre+' '+p.o.apellido:'')||p.o.n||p.o.desc||p.o.d||''):'')+'</td><td>'+esc(p.msg)+'</td></tr>').join('')+'</tbody></table></div><div class="row" style="margin-top:14px"><button class="btn y lg" data-a="imApply"'+(c.new+c.update&&!dupFile?'':' disabled')+'>'+(IMP.opts.test?'Probar importación':'Importar '+(c.new+c.update)+' registros')+'</button><button class="btn g lg" data-a="imReset">Cancelar</button></div></div>'}
 return '<div class="ph"><div><h1>Importar / Exportar</h1><span class="sub">Migrá desde otro sistema o sacá tus datos en CSV (separador ; y UTF-8)</span></div></div><div class="bento"><div class="c s12"><h2>1. Importar de otro sistema</h2><div class="g2" style="margin-top:6px"><div><label for="im_e">Qué querés importar</label><select id="im_e" data-ch="imEnt">'+Object.keys(IMPENT).map(k=>'<option value="'+k+'"'+(IMP.ent===k?' selected':'')+'>'+IMPENT[k].label+'</option>').join('')+'</select></div><div><label for="im_f">Archivo (.csv, .txt o .xlsx · hasta 20.000 filas / 15 MB)</label><input type="file" id="im_f" accept=".csv,.txt,.xlsx" data-ch="imFile"></div></div><p style="margin-top:10px"><button class="btn g sm" data-a="imTpl">'+ic('download')+'Descargar plantilla de '+E.label.toLowerCase()+'</button></p></div>'+prev+
 '<div class="c s6"><h2>Exportar</h2><div class="row" style="margin-top:10px">'+[['productos','Productos'],['socios','Socios y pacientes'],['ventas','Entregas'],['cajas','Cajas cerradas'],['gastos','Gastos']].map(x=>'<button class="btn g sm" data-a="exp" data-id="'+x[0]+'">'+ic('download')+x[1]+'</button>').join('')+'</div><p class="sub" style="margin-top:8px">Las celdas que empiezan con = + - @ se neutralizan para que Excel no las ejecute. Los datos personales se exportan sólo con tu confirmación.</p></div><div class="c s6"><h2>Importaciones hechas</h2>'+(S.batches.length?'<div class="list">'+S.batches.slice().reverse().slice(0,8).map(b=>'<div class="li"><span>'+fdt(b.t)+' · '+esc(IMPENT[b.ent].label)+' · '+b.n+(b.undone?' <span class="badge">deshecha</span>':'')+'</span>'+(b.undone?'':'<button class="btn g sm" data-a="imUndo" data-id="'+b.id+'">'+ic('undo')+'Deshacer</button>')+'</div>').join('')+'</div>':'<p class="sub" style="margin-top:8px">Todavía no importaste nada.</p>')+'</div></div>'}};
CH.imEnt=el=>{IMP=newImp(el.value);refresh()};
CH.imFile=async el=>{const f=el.files[0];if(!f)return;try{const raw=await readRows(f);if(raw.length<2)return toast('El archivo no tiene datos');const buf=await f.arrayBuffer();IMP.hash=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',buf)));IMP.raw=raw;IMP.name=f.name;IMP.hdr=autoHeader(IMP.ent,raw);IMP.map=autoMap(IMP.ent,raw[IMP.hdr]);refresh()}catch(e){toast('No se pudo leer: '+e.message)}};
CH.imh=el=>{IMP.hdr=Math.max(0,Math.min(IMP.raw.length-2,(+el.value||1)-1));IMP.map=autoMap(IMP.ent,IMP.raw[IMP.hdr]);refresh()};
CH.immap=el=>{IMP.map[el.dataset.k]=el.value===''?null:+el.value;refresh()};
CH.imupd=el=>{IMP.opts.update=el.checked;refresh()};CH.imtest=el=>{IMP.opts.test=el.checked;refresh()};CH.imdups=el=>{IMP.opts.dups=el.checked;refresh()};
document.addEventListener('change',e=>{if(e.target&&e.target.id==='im_r')IMP.rubro=e.target.value});
A.imReset=()=>{IMP=newImp(IMP.ent);refresh()};
A.imTpl=()=>{const E=IMPENT[IMP.ent];const ex={productos:['Producto de ejemplo','7790000009999',1500,800,10,'General','u','L-001','31/12/2027'],socios:['Nombre','Apellido','Nombre y apellido (opcional)','DNI','30111222','','5493870000000','mail@ejemplo.com','21/05/1990','','',''],ventas:['05/10/2026','0001-00000001','Persona','12500','efectivo'],gastos:['05/10/2026','Servicios','Proveedor','Detalle','8000'],cajas:['05/10/2026','Cajero','150000','120000','120000','']}[IMP.ent];download('plantilla-'+(IMP.ent==='ventas'?'entregas':IMP.ent)+'.csv',toCSV(E.fields.map(f=>f.l),[ex]),'text/csv')};
A.imApply=async()=>{
 const plan=impPlan();const c=impSummary(plan);
 if(IMP.opts.test){toast('Prueba: se importarían '+c.new+' nuevos y se actualizarían '+c.update+'. No se guardó nada.',5000);return}
 if(S.batches.some(b=>!b.undone&&b.hash&&b.hash===IMP.hash&&b.ent===IMP.ent))return toast('Ese archivo ya se importó');
 const rt=IMP_RUBRO[IMP.ent];let ru=null;
 if(rt){const el=$('#im_r');ru=rubroSel(el?el.value:IMP.rubro,rt);if(!ru)return toast('Elegí el rubro financiero de lo importado')}
 const snap=JSON.stringify([S.products,S.cats,S.socios,S.sales,S.gastos,S.cash.closed,S.stockMoves]);
 const b={id:uid(),t:now(),ent:IMP.ent,user:SES.name,created:[],updated:[],n:0,file:IMP.name,hash:IMP.hash};
 try{
  const todo=plan.filter(p=>p.st==='new'||p.st==='update');const usedLeg=new Set(S.socios.map(s=>s.legajo));let sinCons=0;
  for(const p of todo){const o=p.o;
   if(IMP.ent==='productos'){
    if(p.st==='update'){const ex=pById(p.ex);b.updated.push({id:ex.id,prev:{price:ex.price,cost:ex.cost}});ex.price=o.price;if(o.cost)ex.cost=o.cost}
    else{let cat=S.cats.find(x=>norm(x.name)===norm(o.cat||'Importados'));if(!cat){cat={id:'c_'+uid(),name:o.cat||'Importados'};S.cats.push(cat);b.createdCats=(b.createdCats||[]).concat(cat.id)}
     const pr={id:uid(),name:o.name,cat:cat.id,desc:'',price:o.price,cost:o.cost,stock:o.stock,unit:o.unit,img:'',pub:false,status:'activo',min:0,barcode:o.barcode,plu:'',rp:false,service:false,membership:false,lote:o.lote,vence:o.vence};S.products.push(pr);b.created.push(pr.id);if(o.stock>0){S.stockMoves.push({id:uid(),t:now(),pid:pr.id,delta:o.stock,reason:'Stock inicial (importación)',user:SES.name,batch:b.id,dev:DEV?DEV.n:1})}}}
   else if(IMP.ent==='socios'){
    let leg=o.legajoIn&&!usedLeg.has(o.legajoIn)?o.legajoIn:newLegajo(usedLeg);usedLeg.add(leg);
    const s={id:uid(),key:newKey13(),legajo:leg,name:o.nombre+' '+o.apellido,nombre:o.nombre,apellido:o.apellido,docTipo:o.docTipo,doc:o.doc,wa:o.wa,email:o.email,bday:o.bday,consent:false,consentDate:0,consentInf:false,consentInfDate:0,consentInfVer:0,origen:'importado',verificado:true,posibleDuplicadoDe:p.dup||'',reprocann:{nro:o.rp,venc:o.rpv},cuotaHasta:'',topeG:0,limit:0,notes:o.notes,created:now(),stamps:[],redeemed:0,imported:true,tutor:null,cp:'',domicilio:'',ocupacion:'',obraSocial:'',motivo:'',estadoDecl:''};
    S.socios.push(s);b.created.push(s.id);sinCons++}
   else if(IMP.ent==='ventas'){const nm=norm(o.cust);const cu=o.cust?S.socios.find(s=>norm(s.name)===nm||s.legajo.toLowerCase()===o.cust.toLowerCase()||(s.doc&&s.doc===o.cust.replace(/\D/g,''))):null;
    const s={id:uid(),n:o.n,t:new Date(o.d+'T12:00:00').getTime(),caja:null,user:'Importado',dev:0,items:[{pid:'',name:'Entrega histórica',unit:'u',qty:1,price:o.total,list:o.total,cost:0,amount:o.total,lote:'',vence:''}],sugerido:o.total,total:o.total,pay:o.total>0?o.pay:'-',recv:null,rec:cu?{kind:'paciente',socioId:cu.id,nombre:cu.name,docTipo:cu.docTipo,doc:cu.doc}:{kind:o.cust?'donante':'anon',socioId:'',nombre:o.cust,docTipo:'DNI',doc:''},socioId:cu?cu.id:'',rubro:o.total>0?ru:null,doc:'comprobante',fc:null,cae:null,voided:false,imported:true};S.sales.push(s);b.created.push(s.id)}
   else if(IMP.ent==='gastos'){const g={id:uid(),date:o.d,cat:o.cat,prov:o.prov,desc:o.desc,amount:o.amount,medio:'',rubro:ru,user:'Importado',imported:true};S.gastos.push(g);b.created.push(g.id)}
   else if(IMP.ent==='cajas'){const ts=new Date(o.d+'T22:00:00').getTime();const by={};for(const k of Object.keys(PAYS))by[k]=0;by.efectivo=o.total;const sn={v:2,id:uid(),n:'IMP-'+(b.created.length+1),openedAt:ts,closedAt:ts,openedBy:o.user,closedBy:o.user,fondo:0,ventas:0,total:o.total,byPay:by,con:0,sin:o.total,ingresos:0,egresos:0,reintegros:0,moves:[],byRubro:{},esperado:o.exp,declarado:o.decl,dif:r2(o.decl-o.exp),obs:o.obs,docs:[],imported:true};sn.hash=await sha256hex(stable(sn));S.cash.closed.push(sn);b.created.push(sn.id)}
   b.n++}
  b.sinConsent=sinCons;
  S.batches.push(b);audit('importacion',{entidad:IMP.ent,archivo:IMP.name,registros:b.n,hash:IMP.hash.slice(0,12)});persist();
  toast('Importados '+b.n+' registros'+(IMP.ent==='socios'?' · '+sinCons+' quedaron sin consentimiento de mensajes':''),6000);IMP=newImp(IMP.ent);refresh()
 }catch(e){const sv=JSON.parse(snap);S.products=sv[0];S.cats=sv[1];S.socios=sv[2];S.sales=sv[3];S.gastos=sv[4];S.cash.closed=sv[5];S.stockMoves=sv[6];toast('La importación falló y se revirtió todo: '+e.message,6000)}};
A.imUndo=el=>{const b=S.batches.find(x=>x.id===el.dataset.id);
 confirmBox({title:'Deshacer importación',msg:'Se quitan los '+b.created.length+' registros creados y se restauran los actualizados.',ok:'Deshacer',danger:true,onOk:()=>{
  const ids=new Set(b.created);
  if(b.ent==='productos'){if(S.sales.some(s=>!s.imported&&s.items.some(i=>ids.has(i.pid))))return toast('No se puede: algunos productos ya tienen entregas');S.products=S.products.filter(p=>!ids.has(p.id));S.stockMoves=S.stockMoves.filter(m=>m.batch!==b.id);for(const u of b.updated){const p=pById(u.id);if(p)Object.assign(p,u.prev)}if(b.createdCats)S.cats=S.cats.filter(c=>!b.createdCats.includes(c.id)||S.products.some(p=>p.cat===c.id))}
  else if(b.ent==='socios'){if(S.sales.some(s=>!s.imported&&ids.has(s.socioId)))return toast('No se puede: ya hay entregas a nombre de personas importadas');S.socios=S.socios.filter(s=>!ids.has(s.id))}
  else if(b.ent==='ventas')S.sales=S.sales.filter(s=>!ids.has(s.id));
  else if(b.ent==='gastos')S.gastos=S.gastos.filter(g=>!ids.has(g.id));
  else if(b.ent==='cajas')S.cash.closed=S.cash.closed.filter(c=>!ids.has(c.id));
  b.undone=true;audit('importacion_deshacer',{entidad:b.ent,registros:b.created.length});persist();toast('Importación deshecha');refresh()}})};
A.exp=el=>{const k=el.dataset.id;
 const go2=()=>{let head,rows;
  if(k==='productos'){head=['Nombre','Código de barras','Donación sugerida','Costo','Stock','Categoría','Unidad','Lote','Vencimiento','Estado','Publicado'];rows=S.products.map(p=>[p.name,p.barcode,p.price,p.cost,p.stock,catName(p.cat),p.unit,p.lote||'',p.vence||'',STATES[p.status],p.pub?'si':'no'])}
  else if(k==='socios'){head=['Legajo','Nombre','Apellido','Tipo documento','Documento','WhatsApp','Email','Nacimiento','REPROCANN','Venc. REPROCANN','Cuota hasta','Tope g/30 días','Consentimiento datos','Consentimiento mensajes','Verificado','Origen','Posible duplicado de'];rows=S.socios.map(s=>{const d=s.posibleDuplicadoDe?socioById(s.posibleDuplicadoDe):null;return [s.legajo,s.nombre||'',s.apellido||'',s.docTipo||'',s.doc,s.wa,s.email,s.bday,s.reprocann.nro,s.reprocann.venc,s.cuotaHasta,s.topeG||'',s.consentInf?'si':'no',s.consent?'si':'no',s.verificado===false?'no':'si',s.origen||'',d?d.legajo:'']})}
  else if(k==='ventas'){head=['Fecha','N°','Comprobante','Pago','Legajo','Persona','Producto','Lote','Cantidad','Donación recibida','Rubro','Anulada','Importada'];rows=S.sales.flatMap(s=>{const c=s.socioId?socioById(s.socioId):null;return s.items.map(i=>[fdt(s.t),s.n,s.doc,PAYS[s.pay]||s.pay,c?c.legajo:'',c?c.name:((s.rec&&s.rec.nombre)||''),i.name,i.lote||'',i.qty,s.total,s.rubro?s.rubro.name:'',s.voided?'si':'',s.imported?'si':''])})}
  else if(k==='cajas')return A.cjCsv();
  else{head=['Fecha','Categoría','Rubro','Proveedor','Detalle','Monto','Medio'];rows=S.gastos.map(g=>[fdate(g.date),g.cat,g.rubro?g.rubro.name:'',g.prov,g.desc,g.amount,g.medio||''])}
  download((k==='ventas'?'entregas':k)+'.csv',toCSV(head,rows),'text/csv');audit('export',k==='ventas'?'entregas':k)};
 if(k==='socios')confirmBox({title:'Exportar datos personales',msg:'El archivo incluye documentos, WhatsApp y correos de las personas. Guardalo en un lugar seguro y no lo compartas.',ok:'Exportar',onOk:go2});else go2()};
