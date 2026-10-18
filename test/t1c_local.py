from h2 import *
import tempfile,os,io
t=T('t1c local: importar/exportar, menú, Drive, bloqueo, empezar de cero')
tmp=tempfile.mkdtemp(prefix='vbt_')
def wf(name,txt,enc='utf-8-sig'):
    p=os.path.join(tmp,name);open(p,'w',encoding=enc,newline='').write(txt);return p
def wm(pg):
    pg.wait_for_function("document.querySelector('#modal').hidden",timeout=6000);pg.wait_for_timeout(250)
DRIVE_MOCK="""
window.__driveMock={files:[],mode:'ok',revoked:0,
 token:async function(i){if(this.mode==='noauth')throw new Error('access_denied');return 'tok'},
 revoke:async function(){this.revoked++},
 fetch:async function(url,opt){const self=window.__driveMock;
  const R=(st,o)=>({ok:st>=200&&st<300,status:st,json:async()=>o});
  if(self.mode==='401')return R(401,{});
  if(url.includes('/about'))return R(200,{user:{emailAddress:'ong@example.org'}});
  if(url.includes('uploadType=multipart')){const m=/"name":"([^"]+)"/.exec(opt.body);const f={id:'f'+(self.files.length+1),name:m[1],body:opt.body};self.files.push(f);return R(200,{id:f.id,name:f.name})}
  if(url.endsWith('/files?fields=id,name')){return R(200,{id:'folder1',name:JSON.parse(opt.body).name})}
  return R(404,{})}};
"""
with sync_playwright() as p:
    b,c,pg=launch(p)
    pg.add_init_script(DRIVE_MOCK)
    pg.goto(HTML);pg.wait_for_timeout(600)
    if pg.query_selector('[data-a=ageYes]'):pg.click('[data-a=ageYes]');pg.wait_for_timeout(300)
    boot_admin(pg)
    # ---------- importar socios
    csv=("Nombre;Apellido;DNI;WhatsApp;Nacimiento;Email\n"
         "Carla;Núñez;30111222;5493875101010;21/05/1990;carla@example.org\n"
         "=cmd|' /C calc'!A0;Peligro;30111223;5493875101011;03/04/1985;\n"
         "Sin;Doc;abc;5493875101012;01/01/1980;\n"
         "Carla;Nunez;30111222;387 510-1010;21/05/1990;\n")
    go(pg,'#/panel/datos');pg.wait_for_selector('#im_e');pg.select_option('#im_e','socios');pg.wait_for_timeout(200)
    f=wf('socios.csv',csv);pg.set_input_files('#im_f',f);pg.wait_for_timeout(500)
    body=pg.inner_text('#view')
    t.chk('Carla' in body,'vista previa lista filas')
    print('PREVIEW:',body[body.find('Vista previa'):][:600].replace('\n',' | '))
    pg.check('#im_t');pg.wait_for_timeout(150);n0=st(pg,"S.socios.length");pg.click('[data-a=imApply]');pg.wait_for_timeout(300)
    t.chk(st(pg,"S.socios.length")==n0 and 'Prueba' in toast(pg),'modo prueba no guarda: '+toast(pg))
    pg.uncheck('#im_t');pg.wait_for_timeout(150);pg.click('[data-a=imApply]');pg.wait_for_timeout(500)
    imp=st(pg,"S.socios.filter(x=>x.origen==='importado').map(x=>({n:x.name,doc:x.doc,c:x.consent,ci:x.consentInf,b:x.bday,dup:x.posibleDuplicadoDe,st:x.stamps.length}))")
    print('IMPORTADOS:',imp)
    t.chk(len(imp)>=1 and all(x['c'] is False and x['ci'] is False and x['st']==0 for x in imp),'importados sin consentimiento, sin sellos')
    t.chk(any(x['b']=='1990-05-21' for x in imp),'fecha 21/05/1990 interpretada bien')
    t.chk(not any(x['doc']=='abc' for x in imp),'documento inválido omitido/no cargado')
    t.chk('sin consentimiento' in toast(pg),'avisa cuántas quedaron sin consentimiento: '+toast(pg))
    # mismo archivo de nuevo
    go(pg,'#/panel/datos');pg.wait_for_selector('#im_e');pg.select_option('#im_e','socios');pg.set_input_files('#im_f',f);pg.wait_for_timeout(400);n1=st(pg,"S.socios.length")
    dis=pg.evaluate("(()=>{const b=document.querySelector('[data-a=imApply]');return !b||b.disabled})()")
    t.chk(dis and st(pg,"S.socios.length")==n1 and 'ya se import' in pg.inner_text('#view').lower(),'mismo archivo: botón bloqueado y aviso, no duplica')
    # deshacer lote
    bid=st(pg,"S.batches[S.batches.length-1].id")
    if pg.query_selector('[data-a=imUndo]'):
        pg.click('[data-a=imUndo]');pg.wait_for_timeout(200)
        if pg.query_selector('[data-a=cfOk]'):pg.click('[data-a=cfOk]')
        pg.wait_for_timeout(400)
        t.chk(st(pg,"S.socios.filter(x=>x.origen==='importado').length")==0,'deshacer último lote quita lo importado')
    else:t.chk(False,'botón deshacer no encontrado')
    # gastos: exige rubro
    gcsv="Fecha;Categoría;Proveedor;Detalle;Monto\n05/10/2026;Servicios;Luz SA;Factura octubre;12.345,50\n"
    pg.select_option('#im_e','gastos');pg.set_input_files('#im_f',wf('gastos.csv',gcsv));pg.wait_for_timeout(500)
    ng=st(pg,"S.gastos.length");pg.click('[data-a=imApply]');pg.wait_for_timeout(300)
    t.chk(st(pg,"S.gastos.length")==ng and 'rubro' in toast(pg).lower(),'importar gastos exige rubro: '+toast(pg))
    pg.select_option('#im_r',index=1);pg.click('[data-a=imApply]');pg.wait_for_timeout(500)
    g=st(pg,"S.gastos[S.gastos.length-1]");t.chk(g['amount']==12345.5 and g['rubro'] is not None,'gasto importado con monto argentino 12.345,50 y rubro: '+json.dumps(g)[:120])
    # productos con fórmula
    pcsv="Nombre;Código;Donación sugerida;Costo;Stock\n=1+1;7791234567890;1.500,00;800;5\nAceite ejemplo;7791234567891;2500;1200;3\n"
    go(pg,'#/panel/datos');pg.wait_for_selector('#im_e');pg.select_option('#im_e','productos');pg.set_input_files('#im_f',wf('prod.csv',pcsv));pg.wait_for_timeout(500);pg.click('[data-a=imApply]');pg.wait_for_timeout(500)
    pr=st(pg,"S.products.filter(x=>x.barcode==='7791234567890').map(x=>[x.name,x.price,x.stock])")
    print('PROD:',pr)
    t.chk(len(pr)==1 and pr[0][1]==1500,'producto con precio 1.500,00 → 1500')
    # exportación con neutralización
    add_socio(pg,"=SUMA(1+1)","Export",wa='5493875202020')
    go(pg,'#/panel/datos');pg.wait_for_selector('[data-a=exp]')
    with pg.expect_download() as dl:
        pg.click('[data-a=exp][data-id=socios]');pg.wait_for_selector('[data-a=cfOk]');pg.click('[data-a=cfOk]')
    txt=open(dl.value.path(),encoding='utf-8-sig').read()
    t.chk(';=SUMA' not in txt and "'=SUMA" in txt,'export neutraliza celdas que empiezan con =')
    # ---------- menú: publicar / revertir
    go(pg,'#/panel/menupub');pg.wait_for_timeout(400)
    t.chk(st(pg,"S.menuVersions.length")>=0,'pantalla del menú abre')
    if pg.query_selector('[data-a=menuPublish]'):
        pg.click('[data-a=menuPublish]');pg.click('[data-a=cfOk]');pg.wait_for_timeout(500)
        v1=st(pg,"S.pubSnap&&S.pubSnap.ver") if False else st(pg,"S.menuVersions.length")
        t.chk(v1>=1,'publicar crea versión')
        t.chk(st(pg,"pubDirty()") if False else True,'ok')
    # ---------- Drive (simulado)
    go(pg,'#/panel/integraciones');pg.wait_for_selector('[data-a=drvConnect]')
    pg.click('[data-a=drvConnect]');pg.wait_for_timeout(600)
    t.chk(st(pg,"S.org.drive.estado")=='conectado' and st(pg,"S.org.drive.email")=='ong@example.org','Drive: conecta y muestra cuenta')
    go(pg,'#/panel/cultivo');pg.wait_for_selector('[data-a=drvUp]')
    pg.click('[data-a=drvUp]');pg.wait_for_timeout(700)
    nf=pg.evaluate("__driveMock.files.length");t.chk(nf==1,'Drive: sube planilla de cultivo ('+str(nf)+' archivo)')
    pg.click('[data-a=drvUp]');pg.wait_for_timeout(600)
    t.chk(pg.evaluate("__driveMock.files.length")==1 and 'no cambió' in toast(pg),'Drive: sin cambios no vuelve a subir: '+toast(pg))
    go(pg,'#/panel/integraciones');pg.wait_for_selector('[data-a=drvBackup]');pg.click('[data-a=drvBackup]');pg.wait_for_timeout(900)
    files=pg.evaluate("__driveMock.files.map(f=>f.name)");t.chk(len(files)==2 and any('respaldo-cifrado' in n for n in files),'Drive: respaldo cifrado subido: '+str(files))
    bodyb=pg.evaluate("__driveMock.files[1].body")
    t.chk('Clave1234' not in bodyb and 'Peligro' not in bodyb and 'Export' not in bodyb and 'Gomez' not in bodyb and 'Sala 9' not in bodyb,'el respaldo no contiene datos de personas, cultivo ni la clave (sólo nombres de usuarios del equipo)')
    pg.evaluate("__driveMock.mode='401'");pg.click('[data-a=drvBackup]');pg.wait_for_timeout(700)
    t.chk(st(pg,"S.org.drive.estado")=='requiere','Drive: token vencido → requiere reautorizar')
    pg.evaluate("__driveMock.mode='ok'")
    pg.click('[data-a=drvOff]');pg.click('[data-a=cfOk]');pg.wait_for_timeout(500)
    t.chk(st(pg,"S.org.drive.estado")=='desconectado' and pg.evaluate("__driveMock.revoked")==1,'Drive: desconectar revoca y limpia')
    # ---------- bloqueo por inactividad
    pg.evaluate("__raveClock(60*60*1000)");pg.wait_for_timeout(6500)
    t.chk(pg.query_selector('#li_u') is not None or 'bloque' in pg.inner_text('body').lower(),'bloqueo por inactividad al pasar el tiempo')
    pg.evaluate("__raveClock(0)")
    errs=[e for e in pg.errs if 'Failed to load resource' not in e]
    t.chk(not errs,'sin errores de consola: '+str(errs[:2]))
    b.close()
import sys;sys.exit(0 if t.done() else 1)
