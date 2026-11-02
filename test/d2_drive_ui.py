"""d2 · Drive de la organización por servidor, de punta a punta en el navegador (Google falso):
el administrador conecta una vez desde Integraciones; el legajo obtiene carpeta y fila en la hoja; un documento se
sube por el servidor; un mostrador en otro equipo sube sin conectar nada; ningún equipo habla directo con Google."""
import subprocess,os,re,json,time,urllib.request
from h import *
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
URL='http://127.0.0.1:54321';G='http://127.0.0.1:54399/__g/'
def psql(sql):
    r=subprocess.run(['su','postgres','-c',f'/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -At -c "{sql}"'],capture_output=True,text=True);return r.stdout.strip()
def gj(path,body=None):
    r=urllib.request.Request(G+path,data=None if body is None else json.dumps(body).encode(),headers={'content-type':'application/json'},method='POST' if body is not None else 'GET')
    return json.loads(urllib.request.urlopen(r,timeout=20).read())
def api(path,body,tok=None):
    h={'content-type':'application/json','apikey':'sb_publishable_TESTKEY'}
    if tok:h['authorization']='Bearer '+tok
    return json.loads(urllib.request.urlopen(urllib.request.Request(URL+path,data=json.dumps(body).encode(),headers=h),timeout=20).read() or b'null')
subprocess.run(['/var/tmp/sqlt/reset.sh'],check=True,capture_output=True);gj('reset',{})
code=psql("select public.generar_codigo_alta()")
env=dict(os.environ,SUPA_URL=URL,SUPA_KEY='sb_publishable_TESTKEY',TEST_HOOKS='1')
subprocess.run(['python3',os.path.join(ROOT,'assemble.py'),os.path.join(HERE,'cloud.html')],env=env,check=True,capture_output=True)
CH='file://'+os.path.join(HERE,'cloud.html')
t=T('d2 Drive por servidor (navegador)')
def wait_text(pg,sel,rx,to=25000):
    end=time.time()+to/1000
    while time.time()<end:
        try:
            if re.search(rx,pg.inner_text(sel)):return True
        except Exception:pass
        pg.wait_for_timeout(300)
    return False
def close(pg):pg.evaluate("(()=>{const b=document.querySelector('#modal [data-a=mclose]');if(b)b.click()})()");pg.wait_for_timeout(200)
def google_hosts(pg):
    pg.ghosts=[]
    pg.on('request',lambda r:pg.ghosts.append(r.url) if re.match(r'^https://([a-z0-9.-]*googleapis\.com|accounts\.google\.com/gsi)',r.url) else None)
LEG="(()=>{const r=Array.from(document.querySelectorAll('#view tr')).find(x=>/Paula/.test(x.textContent));r.querySelector('[data-a=legajo]').click()})()"
def login(pg,email):
    pg.wait_for_selector('#li_p',timeout=15000)
    if pg.query_selector('#li_u') and not pg.input_value('#li_u'):pg.fill('#li_u',email)
    pg.fill('#li_p','Clave1234');pg.click('[data-a=cloudLogin]');pg.wait_for_selector('#view',timeout=20000)
with sync_playwright() as p:
    bA,cA,A=launch(p);google_hosts(A)
    A.goto(CH);A.wait_for_timeout(500);A.evaluate("location.hash='#/acceso'");A.wait_for_selector('#sc_c',timeout=10000)
    A.fill('#sc_c',code);A.fill('#sc_n','Ana Admin');A.fill('#sc_e','ana@terps.test');A.fill('#sc_p','Clave1234');A.fill('#sc_p2','Clave1234');A.click('[data-a=cloudSetup]')
    A.wait_for_selector('#view',timeout=20000)
    # Integraciones: tarjeta del servidor, sin conectar
    go(A,'#/panel/integraciones')
    t.chk(wait_text(A,'#view',r'Google Drive de la organización[\s\S]*Sin conectar',15000),'Integraciones: Drive de la organización sin conectar')
    t.chk(not A.query_selector('#gid_in'),'con el servidor configurado no se pide el ID de cliente en el navegador')
    t.chk(A.query_selector('[data-a=drvSrvConectar]') is not None,'admin ve «Conectar Google Drive de la organización»')
    # conectar: se va a Google, la persona acepta, vuelve al sistema
    cap={}
    def g_route(route):
        cap['url']=route.request.url;route.fulfill(status=200,content_type='text/html',body='<p>Google (prueba)</p>')
    A.route('https://accounts.google.com/o/oauth2/**',g_route)
    A.click('[data-a=drvSrvConectar]');A.wait_for_timeout(1500)
    t.chk('url' in cap and 'drive.file' in cap['url'],'navega a la autorización de Google con drive.file')
    a=gj('autorizar',{'url':cap['url']})
    cb=urllib.request.urlopen(URL+'/functions/v1/drive-legajos?code='+a['code']+'&state='+urllib.parse.quote(a['state']),timeout=20).read().decode()
    t.chk('(ok)' in cb,'vuelta de Google guardada: '+cb[:40])
    A.goto(CH+'?drive=ok#/panel/socios');A.wait_for_timeout(800)
    login(A,'ana@terps.test')
    t.chk('?drive' not in A.url,'la dirección queda limpia tras volver')
    go(A,'#/panel/integraciones')
    t.chk(wait_text(A,'#view',r'Conectado[\s\S]*medicinalterps@gmail\.com',15000),'Integraciones: conectado con la cuenta de la organización')
    A.wait_for_timeout(500)
    t.chk(A.evaluate("__vb().S.audit.some(a=>a.action==='drive_conectado'||a.a==='drive_conectado'||JSON.stringify(a).includes('drive_conectado'))"),'auditoría: drive_conectado')
    # persona nueva con legajo → procesar → carpeta y fila
    go(A,'#/panel/socios');A.wait_for_selector('[data-a=socioNew]');A.click('[data-a=socioNew]');A.wait_for_selector('#sf_n')
    A.fill('#sf_n','Paula');A.fill('#sf_a','Cuenta');A.fill('#sf_d','30222333');A.fill('#sf_w','5493875009999');A.set_checked('#sf_ki',True)
    A.click('[data-a=socioSave]');A.wait_for_timeout(400)
    if A.query_selector('#modal [data-a=cfOk]'):A.click('#modal [data-a=cfOk]');A.wait_for_timeout(300)
    close(A);go(A,'#/panel/socios')
    t.chk(wait_text(A,'#view',r'Drive de la organización conectado',10000),'legajos: Drive de la organización conectado')
    A.wait_for_selector('[data-a=legLote]',timeout=8000);A.click('[data-a=legLote]')
    t.chk(wait_text(A,'#view',r'1 legajo\(s\) con carpeta y fila',20000),'procesar: carpeta y fila en la hoja')
    st=gj('state')
    fol=[f['name'] for f in st['files'] if f['mimeType'].endswith('folder')]
    t.chk(any(re.match(r'^L-\d{6}-[0-9A-Z]{6}_30222333$',n) for n in fol) and any(n.startswith('Legajos · ') for n in fol),'carpeta Legajos/{legajo}_DNI '+str(fol))
    rows=list(st['sheets'].values())[0] if st['sheets'] else []
    t.chk(len(rows)==2 and 'Cuenta, Paula' in rows[1][2],'hoja: fila del legajo')
    t.chk(A.evaluate("!!__vb().S.socios.find(s=>s.name&&/Paula/.test(s.name)).driveId"),'el legajo guarda la carpeta')
    # documento: se sube por el servidor
    A.evaluate(LEG);A.wait_for_selector('#docFile',state='attached',timeout=8000)
    A.set_input_files('#docFile',files=[{'name':'reprocann.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 documento por servidor\n%%EOF'}]);A.wait_for_selector('#dc_t',timeout=5000)
    A.select_option('#dc_t','REPROCANN');A.click('[data-a=docOk]');A.wait_for_timeout(1500)
    t.chk('carpeta del legajo' in toast(A),'documento guardado en la carpeta: '+toast(A))
    st=gj('state');pdfs=[f for f in st['files'] if f['mimeType']=='application/pdf']
    t.chk(len(pdfs)==1 and pdfs[0]['name'].startswith('L-'),'el PDF está en Drive con nombre del legajo')
    t.chk(A.evaluate("__vb().S.legDocs[0].estado")=='subido','registro del documento «subido»')
    close(A)
    t.chk(not A.ghosts,'el navegador del administrador no habló directo con Google: '+str(A.ghosts[:2]))
    # mostrador en otro equipo: sube sin conectar nada
    tk=api('/auth/v1/token?grant_type=password',{'email':'ana@terps.test','password':'Clave1234'})['access_token']
    api('/rest/v1/rpc/admin_crear_usuario',{'p_email':'mo@terps.test','p_nombre':'Mo','p_rol':'mostrador','p_pass':'Clave1234'},tk)
    psql("update public.miembros set must_change=false")
    bB,cB,B=launch(p);google_hosts(B)
    B.goto(CH);B.wait_for_timeout(500);B.evaluate("location.hash='#/acceso'");login(B,'mo@terps.test')
    go(B,'#/panel/socios');t.chk(wait_text(B,'#view',r'Drive de la organización conectado',20000),'mostrador: Drive conectado sin hacer nada')
    t.chk(wait_text(B,'#view',r'Paula',20000),'mostrador ve el legajo')
    B.evaluate(LEG);B.wait_for_selector('#docFile',state='attached',timeout=8000)
    B.set_input_files('#docFile',files=[{'name':'dni.jpg','mimeType':'image/jpeg','buffer':b'\xff\xd8\xff\xe0 foto de prueba \xff\xd9'}]);B.wait_for_selector('#dc_t',timeout=5000)
    B.select_option('#dc_t','DNI');B.click('[data-a=docOk]');B.wait_for_timeout(1500)
    st=gj('state');t.chk(sum(1 for f in st['files'] if f['mimeType']=='image/jpeg')==1,'mostrador subió la foto por el servidor')
    close(B)
    go(B,'#/panel/integraciones');B.wait_for_timeout(600)
    t.chk(not B.query_selector('[data-a=drvSrvConectar]') and not B.query_selector('[data-a=drvSrvDesc]'),'mostrador no puede conectar ni desconectar')
    t.chk(not B.ghosts,'el mostrador no habló directo con Google')
    # desconectar: los equipos vuelven a «pendiente», nada se borra
    go(A,'#/panel/integraciones');A.wait_for_selector('[data-a=drvSrvDesc]',timeout=8000);A.click('[data-a=drvSrvDesc]')
    A.wait_for_selector('#modal [data-a=cfOk]',timeout=5000);A.click('#modal [data-a=cfOk]');A.wait_for_timeout(1000)
    t.chk(wait_text(A,'#view',r'Sin conectar',8000),'desconectado')
    t.chk(psql("select count(*) from public.drive_conexion where conectado_at is not null")=='0','servidor sin permiso guardado')
    st=gj('state');t.chk(len([f for f in st['files'] if not f['mimeType'].endswith('folder')])>=3,'los archivos siguen en Drive')
    errs=[e for e in A.errs+B.errs if 'Failed to load resource' not in e]
    t.chk(not errs,'sin errores de consola: '+str(errs[:3]))
    for b in (bA,bB):b.close()
sys.exit(0 if t.done() else 1)
