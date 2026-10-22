"""t2 · novedades 2026-10-22: catálogo al frente, botones del desarrollador, cuenta corriente (fiado),
origen de cultivo, ciclo con código/cantidad/variedad, ficha del legajo con carpeta, hoja y documentos (Drive simulado)."""
from h2 import *
t=T('t2 novedades: catálogo, cuenta corriente, cultivo, legajo y documentos')
DRIVE_MOCK=r"""
window.__driveMock={files:[],sheets:{},calls:[],revoked:0,
 token:async function(){return 'tok'},revoke:async function(){this.revoked++},
 fetch:async function(url,opt){const M=window.__driveMock;opt=opt||{};M.calls.push((opt.method||'GET')+' '+url);
  const R=(st,o)=>({ok:st>=200&&st<300,status:st,json:async()=>o});
  if(url.includes('/about'))return R(200,{user:{emailAddress:'ong@example.org'}});
  if(url.includes('uploadType=multipart')){const tx=typeof opt.body==='string'?opt.body:await opt.body.text();const meta=JSON.parse(tx.split('\r\n\r\n')[1].split('\r\n--')[0]);const f=Object.assign({id:'f'+(M.files.length+1),webViewLink:'https://drive.google.com/file/d/f'+(M.files.length+1)+'/view'},meta,{size:tx.length});M.files.push(f);return R(200,{id:f.id,name:f.name,webViewLink:f.webViewLink})}
  if(url.startsWith('https://www.googleapis.com/drive/v3/files?q=')){const q=decodeURIComponent(url.split('q=')[1].split('&')[0]);
   const kv=/key='(\w+)' and value='([^']*)'/.exec(q),par=/'([^']+)' in parents/.exec(q);
   const l=M.files.filter(f=>f.appProperties&&kv&&f.appProperties[kv[1]]===kv[2]&&(!par||(f.parents||[]).includes(par[1])));return R(200,{files:l})}
  if(url.startsWith('https://www.googleapis.com/drive/v3/files?fields=')&&opt.method==='POST'){const m=JSON.parse(opt.body);const f=Object.assign({id:(m.mimeType.includes('spreadsheet')?'sh':'d')+(M.files.length+1)},m);f.webViewLink='https://drive.google.com/'+(m.mimeType.includes('spreadsheet')?'spreadsheets/d/':'drive/folders/')+f.id;M.files.push(f);if(m.mimeType.includes('spreadsheet'))M.sheets[f.id]=[];return R(200,{id:f.id,name:f.name,webViewLink:f.webViewLink})}
  const sm=/sheets\.googleapis\.com\/v4\/spreadsheets\/([^/]+)\/values\/([^?]+)/.exec(url);
  if(sm){const rows=M.sheets[sm[1]]||(M.sheets[sm[1]]=[]);const rg=decodeURIComponent(sm[2]);
   if((opt.method||'GET')==='GET')return R(200,{values:rows.map(r=>[r[0]])});
   const v=JSON.parse(opt.body).values;
   if(rg.endsWith(':append')){rows.push(v[0]);return R(200,{})}
   const n=+(/^A(\d+)/.exec(rg)||[0,1])[1];rows[n-1]=v[0];return R(200,{})}
  return R(404,{})}};
"""
def open_legajo(pg,sid):
    pg.evaluate("document.querySelector('#modal').hidden||document.querySelector('[data-a=mclose]')&&document.querySelector('[data-a=mclose]').click()")
    go(pg,'#/panel/socios');pg.wait_for_selector(f'[data-a=legajo][data-id="{sid}"]',timeout=5000);pg.click(f'[data-a=legajo][data-id="{sid}"]');pg.wait_for_selector('#modal .mb.wide',timeout=5000)
with sync_playwright() as p:
    b,c,pg=launch(p)
    pg.add_init_script(DRIVE_MOCK)
    pg.goto(HTML);pg.wait_for_timeout(600)
    if pg.query_selector('[data-a=ageYes]'):pg.click('[data-a=ageYes]');pg.wait_for_timeout(300)
    # ---------- 1. sitio público: catálogo al frente y botones del desarrollador
    secs=pg.evaluate("Array.from(document.querySelectorAll('section.psec')).map(s=>s.id)")
    t.chk(secs and secs[0]=='sec_cat','el catálogo es la primera sección del sitio: '+str(secs))
    hb=pg.evaluate("Array.from(document.querySelectorAll('.hero [data-a=goSec]')).map(b=>b.dataset.id)")
    t.chk(hb and hb[0]=='cat','el botón principal del encabezado lleva al catálogo: '+str(hb))
    t.chk(pg.evaluate("document.querySelectorAll('#pgrid .pcard').length")>=6,'el catálogo muestra los productos publicados')
    bt=pg.evaluate("Array.from(document.querySelectorAll('.vbbtns a')).map(a=>[a.textContent,a.getAttribute('href'),Math.round(a.getBoundingClientRect().height)])")
    t.chk([x[0] for x in bt]==['WhatsApp','Llamar','Correo'],'botones WhatsApp · Llamar · Correo: '+str(bt))
    t.chk(all(x[2]>=48 for x in bt),'los botones miden al menos 48 px')
    t.chk(bt and bt[0][1].startswith('https://wa.me/5493874484132') and bt[1][1]=='tel:+5493874484132' and bt[2][1]=='mailto:vincularbusiness@gmail.com','enlaces oficiales del desarrollador')
    boot_admin(pg)
    t.chk(st(pg,"S.menuCfg.blocks[0].id==='cat'&&S.menuCfg.catFirst===true"),'menú: catálogo primero en la configuración')
    go(pg,'#/panel/menupub');pg.wait_for_selector('#bk_catfirst');t.chk(pg.is_checked('#bk_catfirst'),'opción «Catálogo siempre al frente» visible y marcada')
    # ---------- 2. cuenta corriente
    open_caja(pg,1000)
    add_socio(pg,'Carla','Cuenta',doc='30111444',wa='5493875003333',bday='1990-05-21',rp='RP-9',rpv='2030-01-01')
    add_socio(pg,'Sin','Limite',wa='5493875004444')
    cid=st(pg,"S.socios.find(x=>x.apellido==='Cuenta').id");sid2=st(pg,"S.socios.find(x=>x.apellido==='Limite').id")
    go(pg,'#/panel/socios');pg.click(f'[data-a=socioEdit][data-id="{cid}"]');pg.wait_for_selector('#sf_l');pg.fill('#sf_l','20000');pg.click('[data-a=socioSave]');pg.wait_for_timeout(300)
    t.chk(st(pg,f"S.socios.find(x=>x.id==='{cid}').limit")==20000 and st(pg,"S.audit.some(a=>a.a==='limite_cuenta_corriente')"),'límite de cuenta corriente asignado por admin y auditado')
    # sin persona
    go(pg,'#/panel/vender');pg.click('[data-a=posAdd][data-id=p_cream]');pg.click('[data-a=posCobrar]');pg.wait_for_selector('[data-a=cobOk]')
    pg.click('[data-a=cobPay][data-id=cc]');pg.wait_for_timeout(150);pg.select_option('#rubsel','r_don');pg.click('[data-a=cobOk]');pg.wait_for_timeout(250)
    t.chk('ficha' in toast(pg).lower(),'cuenta corriente sin persona: rechazada: '+toast(pg));close_modal(pg)
    n0=st(pg,"S.sales.length")
    # persona sin límite
    pg.click('[data-a=posRec]');pg.click('[data-a=recKind][data-id=paciente]');pg.wait_for_selector('#cq');pg.fill('#cq','Limite');pg.wait_for_timeout(200);pg.click('#clist [data-a=custPick]');pg.wait_for_timeout(200)
    pg.click('[data-a=posCobrar]');pg.wait_for_selector('[data-a=cobOk]');pg.click('[data-a=cobPay][data-id=cc]');pg.wait_for_timeout(150);pg.select_option('#rubsel','r_don');pg.click('[data-a=cobOk]');pg.wait_for_timeout(250)
    t.chk('límite 0' in toast(pg) and st(pg,"S.sales.length")==n0,'persona sin límite: no se puede dejar a cuenta: '+toast(pg));close_modal(pg)
    pg.click('[data-a=posClear]');pg.click('[data-a=cfOk]');pg.click('[data-a=cfOk]');pg.wait_for_timeout(200)
    # todo a cuenta corriente (F4)
    tx=sale_flow(pg,'p_cream',rec='Cuenta',pay='cc',rubro='r_don')
    s=st(pg,"S.sales[S.sales.length-1]")
    t.chk(s['cc']==18500 and s['pay']=='cc' and s['total']==18500 and s['socioId']==cid,'entrega toda a cuenta corriente: '+json.dumps({k:s[k] for k in ('cc','pay','total')}))
    tk=pg.inner_text('.ticket') if pg.query_selector('.ticket') else ''
    t.chk('A CUENTA CORRIENTE' in tk and 'Saldo de la cuenta' in tk,'el comprobante muestra la parte a cuenta y el saldo')
    close_modal(pg)
    sal=pg.evaluate(f"(()=>{{const {{S}}=__vb();let x=0;for(const s of S.sales)if(s.socioId==='{cid}'&&!s.voided)x+=s.cc||0;return x}})()")
    t.chk(sal==18500,'deuda derivada de las entregas: '+str(sal))
    go(pg,'#/panel/caja');pg.wait_for_timeout(200);cj=pg.inner_text('#view')
    t.chk('$ 1.000' in cj.split('Donaciones')[0],'la parte a cuenta corriente no suma al efectivo esperado')
    # parte a cuenta: 14.000 con 1.000 a cuenta → paga 13.000 en efectivo
    go(pg,'#/panel/vender');pick_rec(pg,'Cuenta');pg.click('[data-a=posAdd][data-id=p_balm]');pg.click('[data-a=posCobrar]');pg.wait_for_selector('#ccp')
    pg.fill('#ccp','1000');pg.dispatch_event('#ccp','input');pg.wait_for_timeout(150)
    t.chk('Paga ahora $ 13.000' in pg.inner_text('#ccpi'),'muestra cuánto paga ahora: '+pg.inner_text('#ccpi'))
    pg.select_option('#rubsel','r_don');pg.fill('#rcv','20000');pg.dispatch_event('#rcv','input');pg.wait_for_timeout(100)
    t.chk(pg.inner_text('#vto')=='$ 7.000','vuelto calculado sobre lo que paga ahora: '+pg.inner_text('#vto'))
    pg.click('[data-a=cobOk]');pg.wait_for_timeout(300);close_modal(pg)
    s=st(pg,"S.sales[S.sales.length-1]");t.chk(s['cc']==1000 and s['pay']=='efectivo' and s['total']==14000 and s['recv']==20000,'entrega mixta: 13.000 efectivo + 1.000 a cuenta')
    est=st(pg,"(()=>{let e=S.cash.open.fondo;for(const s of S.sales)if(s.caja===S.cash.open.id&&!s.voided&&s.pay==='efectivo')e+=s.total-(s.cc||0);return e})()")
    t.chk(est==14000,'efectivo esperado = 1.000 + 13.000: '+str(est))
    # supera el límite (19.500 + 14.000 > 20.000): pide autorización del administrador; cancelar no registra
    n1=st(pg,"S.sales.length")
    go(pg,'#/panel/vender');pick_rec(pg,'Cuenta');pg.click('[data-a=posAdd][data-id=p_balm]');pg.click('[data-a=posCobrar]');pg.wait_for_selector('[data-a=cobOk]')
    pg.click('[data-a=cobPay][data-id=cc]');pg.wait_for_timeout(150);pg.select_option('#rubsel','r_don');pg.click('[data-a=cobOk]');pg.wait_for_timeout(300)
    t.chk(pg.query_selector('#askv') is not None and 'supera su límite' in pg.inner_text('#modal'),'superar el límite pide autorización con motivo')
    close_modal(pg);pg.wait_for_timeout(200)
    t.chk(st(pg,"S.sales.length")==n1,'sin autorización no se registra')
    pg.click('[data-a=posClear]');pg.click('[data-a=cfOk]');pg.click('[data-a=cfOk]');pg.wait_for_timeout(200)
    # ficha: libro y pago a la cuenta
    open_legajo(pg,cid)
    fx=pg.inner_text('#modal')
    t.chk('Cuenta corriente' in fx and 'Debe $ 19.500' in fx and 'Límite asignado' in fx,'la ficha muestra la cuenta corriente con su saldo')
    t.chk('Formulario de ingreso' in fx and 'Carpeta del legajo' in fx and 'Documentos y escaneos' in fx,'la ficha muestra formularios, carpeta y documentos')
    pg.click('[data-a=ccPagar]');pg.wait_for_selector('#cc_m');pg.fill('#cc_m','999999');pg.click('[data-a=ccPagarOk]');pg.wait_for_timeout(200)
    t.chk('supera la deuda' in toast(pg),'un pago mayor a la deuda se rechaza')
    pg.fill('#cc_m','5000');pg.select_option('#cc_med','efectivo');pg.click('[data-a=ccPagarOk]');pg.wait_for_timeout(300)
    rc=pg.inner_text('#modal');t.chk('RECIBO DE PAGO' in rc and '$ 14.500' in rc and 'NO VÁLIDO COMO FACTURA' in rc,'recibo del pago con el saldo que queda')
    pid=st(pg,"S.pagos[S.pagos.length-1].id");pp=st(pg,"S.pagos[S.pagos.length-1]")
    t.chk(pp['tipo']=='cobro' and pp['monto']==5000 and pp['rubro']['id']=='r_cc' and pp['caja']==st(pg,"S.cash.open.id"),'pago registrado con rubro de cuentas corrientes y caja')
    close_modal(pg);go(pg,'#/panel/caja');pg.wait_for_timeout(200)
    t.chk('$ 19.000' in pg.inner_text('#view'),'el pago en efectivo suma al esperado (14.000 + 5.000)')
    # anulación (admin)
    open_legajo(pg,cid);pg.click(f'[data-a=ccAnular][data-id="{pid}"]');pg.wait_for_selector('#askv');pg.fill('#askv','Se cargó dos veces');pg.click('[data-a=askOk]');pg.wait_for_timeout(300)
    sal=pg.evaluate(f"(()=>{{const {{S}}=__vb();let x=0;for(const s of S.sales)if(s.socioId==='{cid}'&&!s.voided)x+=s.cc||0;for(const p of S.pagos)if(p.socioId==='{cid}')x+=p.tipo==='cobro'?-p.monto:p.monto;return x}})()")
    t.chk(sal==19500 and st(pg,"S.pagos.length")==2,'anular el pago no borra: registra una anulación y la deuda vuelve ('+str(sal)+')')
    t.chk('Debe $ 19.500' in pg.inner_text('#modal'),'la ficha se actualiza tras la anulación')
    close_modal(pg)
    # cierre de caja
    go(pg,'#/panel/caja');pg.click('[data-a=cajaClose]');pg.wait_for_selector('#cc_d');pg.fill('#cc_d','14000');pg.click('[data-a=cajaCloseOk]');pg.wait_for_timeout(600)
    cs=st(pg,"S.cash.closed[S.cash.closed.length-1]")
    t.chk(cs['esperado']==14000 and cs['dif']==0 and cs['aCuenta']==19500 and cs['pagosCC']==5000 and cs['pagosCCAnulados']==5000 and cs['byPay']['efectivo']==13000,'cierre: esperado 14.000, a cuenta 19.500, pagos 5.000 y anulación 5.000: '+json.dumps({k:cs.get(k) for k in ('esperado','aCuenta','pagosCC','pagosCCAnulados','recibido')}))
    t.chk('cc' not in cs['byPay'],'la cuenta corriente no figura como medio de dinero en el cierre')
    # dashboard: alerta de deuda
    go(pg,'#/panel/dashboard');pg.wait_for_timeout(200);t.chk('deuda en cuenta corriente' in pg.inner_text('#view'),'el inicio avisa la deuda de cuentas corrientes')
    go(pg,'#/panel/socios');pg.click('[data-a=soF][data-id=deuda]');pg.wait_for_timeout(200)
    t.chk('Cuenta' in pg.inner_text('#view') and 'Limite' not in pg.inner_text('#view').split('Persona')[-1],'filtro «Con deuda en cuenta corriente»')
    # ---------- 3. origen de cultivo
    open_caja(pg,0)
    cy=st(pg,"S.ciclos.find(c=>c.estado==='activo')")
    t.chk(re.match(r'^CU-\d{6}-[A-Z0-9]{5}$',cy.get('codigo','')) is not None,'el ciclo tiene código único: '+str(cy.get('codigo')))
    go(pg,'#/panel/vender');pick_rec(pg,'Cuenta');pg.click('[data-a=posAdd][data-id=p_ext]');np_type(pg,'5');pg.click('[data-a=posCobrar]');pg.wait_for_selector('#cusel')
    pg.click('[data-a=donNone]');pg.wait_for_timeout(150);pg.click('[data-a=cobOk]');pg.wait_for_timeout(250)
    t.chk('origen de cultivo' in toast(pg).lower(),'sin ciclo de origen no se registra la entrega de flor: '+toast(pg))
    pg.select_option('#cusel',cy['id']);pg.click('[data-a=cobOk]');pg.wait_for_timeout(300)
    s=st(pg,"S.sales[S.sales.length-1]");t.chk(s.get('cu') and s['cu']['codigo']==cy['codigo'],'la entrega guarda su origen de cultivo')
    t.chk('Origen de cultivo' in (pg.inner_text('.ticket') if pg.query_selector('.ticket') else ''),'el comprobante muestra el origen de cultivo');close_modal(pg)
    # ---------- 4. ciclo: nombre arriba, código abajo, cantidad y variedad con historial
    go(pg,'#/panel/cultivo');pg.wait_for_timeout(200);v=pg.inner_text('#view')
    t.chk(cy['nombre'] in v and cy['codigo'] in v and 'Variedad' in v,'planilla: nombre, código, cantidad y variedad')
    pg.click('[data-a=cyMeta]');pg.wait_for_selector('#cm_c');pg.fill('#cm_c','30');pg.click('[data-a=cyMetaOk]');pg.wait_for_timeout(200)
    t.chk('motivo' in toast(pg).lower(),'cambiar la cantidad pide motivo')
    pg.fill('#cm_m','Recuento de plantas');pg.click('[data-a=cyMetaOk]');pg.wait_for_timeout(300)
    cy2=st(pg,f"S.ciclos.find(c=>c.id==='{cy['id']}')")
    t.chk(cy2['cantidad']==30 and len(cy2['metaHist'])==1 and cy2['metaHist'][0]['antes']['cantidad']==24,'cantidad actualizada con historial (24 → 30)')
    # ---------- 5. legajos en Drive (simulado): carpeta + hoja + documentos
    go(pg,'#/panel/socios');pg.wait_for_timeout(200)
    t.chk('Legajos: carpetas y formularios' in pg.inner_text('#view'),'panel de legajos en Socios y pacientes')
    open_legajo(pg,cid);pg.click('[data-a=legCrear]');pg.wait_for_timeout(1200)
    sc=st(pg,f"S.socios.find(x=>x.id==='{cid}')")
    t.chk(sc.get('driveId','').startswith('d') and sc.get('drive','').startswith('https://drive.google.com/'),'carpeta del legajo creada y vinculada')
    fold=pg.evaluate(f"__driveMock.files.find(f=>f.id==='{sc['driveId']}')")
    t.chk(fold['name']==sc['legajo']+'_30111444' and fold['appProperties']['vbtKey']=='legajo|'+sc['legajo'],'nombre único legajo_DNI y marca propia: '+fold['name'])
    root=pg.evaluate("__driveMock.files.find(f=>f.appProperties&&f.appProperties.vbtKey==='legajos-raiz')")
    t.chk(root and root['name']=='Legajos' and sc['driveId'] and root['id'] in fold['parents'],'dentro de la carpeta «Legajos»')
    sh=pg.evaluate("Object.values(__driveMock.sheets)[0]||[]")
    t.chk(len(sh)==2 and sh[0][0]=='Legajo' and sh[1][0]==sc['legajo'] and 'RP-9' not in json.dumps(sh),'fila en la hoja de legajos (sin datos clínicos)')
    pg.click('[data-a=legCrear]') if pg.query_selector('[data-a=legCrear]') else None
    nd=pg.evaluate("__driveMock.files.filter(f=>f.appProperties&&f.appProperties.vbtKey&&f.appProperties.vbtKey.startsWith('legajo|')).length")
    t.chk(nd==1,'no se duplica la carpeta')
    # procesar el resto en lote
    close_modal(pg);go(pg,'#/panel/socios');pg.wait_for_selector('[data-a=legLote]');pg.click('[data-a=legLote]');pg.wait_for_timeout(2500)
    t.chk(st(pg,"S.socios.every(s=>s.driveId)"),'lote: todos los legajos con carpeta')
    sh=pg.evaluate("Object.values(__driveMock.sheets)[0]||[]")
    t.chk(len(sh)==1+st(pg,"S.socios.length") and len(set(r[0] for r in sh[1:]))==len(sh)-1,'una fila por legajo, sin repetir: '+str(len(sh)))
    # documento
    pdf=b'%PDF-1.4\n% Documento de prueba\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'
    open_legajo(pg,cid);pg.set_input_files('#docFile',files=[{'name':'reprocann.pdf','mimeType':'application/pdf','buffer':pdf}]);pg.wait_for_selector('#dc_t')
    pg.select_option('#dc_t','REPROCANN');pg.fill('#dc_d','REPROCANN 2030');pg.click('[data-a=docOk]');pg.wait_for_timeout(1500)
    d=st(pg,"S.legDocs[S.legDocs.length-1]")
    t.chk(d['estado']=='subido' and d['version']==1 and len(d['hash'])==64 and d['nombreDrive'].startswith(sc['legajo']+'_REPROCANN_'),'documento subido a la carpeta con nombre único: '+d['nombreDrive'])
    up=pg.evaluate("__driveMock.files.filter(f=>f.appProperties&&f.appProperties.vbtHash)")
    t.chk(len(up)==1 and sc['driveId'] in up[0]['parents'],'el archivo quedó dentro de la carpeta del legajo')
    t.chk('En Drive' in pg.inner_text('#modal'),'la ficha lo muestra «En Drive»')
    pg.set_input_files('#docFile',files=[{'name':'otra.pdf','mimeType':'application/pdf','buffer':pdf}]);pg.wait_for_selector('#dc_t');pg.select_option('#dc_t','REPROCANN');pg.click('[data-a=docOk]');pg.wait_for_timeout(800)
    t.chk(st(pg,"S.legDocs.length")==1 and 'No se duplicó' in toast(pg),'el mismo archivo no se duplica')
    # sin Drive conectado: queda pendiente en el equipo y se sube después
    pg.evaluate("(()=>{const {S}=__vb();S.org.drive.estado='desconectado'})()")
    open_legajo(pg,cid);pg.set_input_files('#docCam',files=[{'name':'foto.jpg','mimeType':'image/jpeg','buffer':b'\xff\xd8\xff\xe0'+b'x'*900}]);pg.wait_for_selector('#dc_t')
    pg.select_option('#dc_t','DNI');pg.click('[data-a=docOk]');pg.wait_for_timeout(800)
    d=st(pg,"S.legDocs[S.legDocs.length-1]")
    t.chk(d['estado']=='pendiente' and d['origen']=='cámara','sin Drive: el documento queda pendiente, guardado en el equipo')
    t.chk('Pendiente de subir' in pg.inner_text('#modal'),'la ficha avisa «Pendiente de subir»')
    pg.evaluate("(()=>{const {S}=__vb();S.org.drive.estado='conectado'})()")
    pg.click('[data-a=docRetry]');pg.wait_for_timeout(1500)
    t.chk(st(pg,"S.legDocs.every(d=>d.estado==='subido')") and pg.evaluate("__driveMock.files.filter(f=>f.appProperties&&f.appProperties.vbtHash).length")==2,'al conectar Drive se sube lo pendiente')
    aud=st(pg,"JSON.stringify(S.audit.filter(a=>/documento_legajo/.test(a.a)))")
    t.chk('REPROCANN 2030' not in aud and 'RP-9' not in aud,'la auditoría no guarda el contenido ni la descripción del documento')
    close_modal(pg)
    # ---------- 6. 360 px sin desbordes
    pg.set_viewport_size({'width':360,'height':800});open_legajo(pg,cid);pg.wait_for_timeout(300)
    ow=pg.evaluate("document.documentElement.scrollWidth-window.innerWidth");t.chk(ow<=1,'ficha a 360 px sin desborde horizontal ('+str(ow)+')')
    close_modal(pg);go(pg,'#/');pg.wait_for_timeout(400)
    ow=pg.evaluate("document.documentElement.scrollWidth-window.innerWidth");t.chk(ow<=1,'sitio público a 360 px sin desborde ('+str(ow)+')')
    errs=[e for e in pg.errs if 'Failed to load resource' not in e];t.chk(not errs,'sin errores de consola: '+str(errs[:3]))
    b.close()
import sys;sys.exit(0 if t.done() else 1)
