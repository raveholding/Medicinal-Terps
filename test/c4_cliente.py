"""c4 · sistema del cliente (con nube): ninguna pantalla muestra textos de demo, ejemplo, simulado o prueba;
el alta inicial nace sin personas, productos ni ciclos de ejemplo; el sitio público no muestra datos de ejemplo."""
import subprocess,os,re,json,time
from h import *
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
URL='http://127.0.0.1:54321'
def psql(sql):
    r=subprocess.run(['su','postgres','-c',f'/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -At -c "{sql}"'],capture_output=True,text=True);return r.stdout.strip()
subprocess.run(['/var/tmp/sqlt/reset.sh'],check=True)
code=psql("select public.generar_codigo_alta()")
env=dict(os.environ,SUPA_URL=URL,SUPA_KEY='sb_publishable_TESTKEY')
subprocess.run(['python3',os.path.join(ROOT,'assemble.py'),os.path.join(HERE,'cloud.html')],env=env,check=True,capture_output=True)
CH='file://'+os.path.join(HERE,'cloud.html')
BAD=re.compile(r'\b(demo|demostraci\w*|ejemplos?|simulad[oa]s?|de prueba|\(borrar\))\b',re.I)
t=T('c4 cliente sin textos de demo')
def synced(pg,to=30000):
    end=time.time()+to/1000
    while time.time()<end:
        try:
            if re.search(r'Sincronizado',pg.inner_text('#syncchip')):return True
        except Exception:pass
        pg.wait_for_timeout(300)
    return False
with sync_playwright() as p:
    b,c,A=launch(p);bP,cP,P=launch(p)
    A.goto(CH);A.wait_for_timeout(500);A.evaluate("location.hash='#/acceso'");A.wait_for_selector('#sc_c',timeout=10000)
    A.fill('#sc_c',code);A.fill('#sc_n','Ana Admin');A.fill('#sc_e','ana@terps.test');A.fill('#sc_p','Clave1234');A.fill('#sc_p2','Clave1234');A.click('[data-a=cloudSetup]')
    A.wait_for_selector('#view',timeout=20000);t.chk(synced(A),'admin sincronizado')
    t.chk(psql("select count(*) from public.registros where col in ('socios','staff','ciclos','cregs','tramites') and not deleted")=='0','el alta inicial no crea personas, empleados, ciclos ni trámites de ejemplo')
    t.chk(psql("select string_agg(id,',') from public.registros where col='products' and not deleted")=='p_mem','sólo la cuota de socio como producto inicial: '+psql("select string_agg(id,',') from public.registros where col='products'"))
    t.chk(psql("select data->>'ejemplo' from public.registros where col='org'")=='false','la organización no queda marcada como ejemplo')
    views=['dashboard','vender','caja','cerradas','inventario','trazabilidad','socios','solic','sellos','tramites','cultivo','personal','fichaje','gastos','reportes','datos','menupub','integraciones','admin']
    hits={}
    for v in views:
        go(A,'#/panel/'+v);A.wait_for_timeout(450)
        tx=A.inner_text('body')
        h=sorted(set(m.group(0).lower() for m in BAD.finditer(tx)))
        if h:hits[v]=h
    t.chk(not hits,'ninguna pantalla con textos de demo/ejemplo/simulado: '+json.dumps(hits,ensure_ascii=False))
    # ID de cliente OAuth de Google: lo carga el administrador desde Integraciones
    go(A,'#/panel/socios');A.wait_for_timeout(400)
    t.chk(A.query_selector('a[href="#/panel/integraciones"]') is not None,'sin Drive configurado, Socios ofrece «Configurar Google Drive»')
    go(A,'#/panel/integraciones');A.wait_for_selector('#gid_in',timeout=5000)
    A.fill('#gid_in','cualquier-cosa');A.click('[data-a=gidSave]');A.wait_for_timeout(300)
    t.chk('formato' in toast(A),'ID con formato inválido rechazado: '+toast(A))
    GID='123456789012-abcdefghij0123456789klmnopqrst.apps.googleusercontent.com'
    A.fill('#gid_in',GID);A.click('[data-a=gidSave]');A.wait_for_timeout(400)
    t.chk('Pendiente de configuración' not in A.inner_text('#view'),'con el ID cargado deja de decir «Pendiente de configuración»')
    t.chk(synced(A),'sincroniza el ID')
    end=time.time()+20
    while time.time()<end and psql("select data->>'googleClientId' from public.registros where col='org'")!=GID:time.sleep(0.5)
    t.chk(psql("select data->>'googleClientId' from public.registros where col='org'")==GID,'el ID queda guardado en la organización (nube)')
    t.chk(GID not in psql("select public.menu_publico(null)::text"),'el ID no se publica en el menú público')
    A.click('[data-a=drvConnect]') if A.query_selector('[data-a=drvConnect]') else None
    A.wait_for_timeout(300)
    # ficha de una persona nueva y cobro con Factura C
    go(A,'#/panel/caja');A.wait_for_selector('#cj_f');A.fill('#cj_f','0');A.click('[data-a=cajaOpen]');A.wait_for_timeout(300)
    go(A,'#/panel/vender');A.wait_for_selector('[data-a=posAdd][data-id=p_mem]',timeout=8000);A.click('[data-a=posAdd][data-id=p_mem]');A.wait_for_timeout(150)
    A.click('[data-a=posCobrar]');A.wait_for_selector('[data-a=cobOk]');tx=A.inner_text('#modal')
    t.chk(not BAD.search(tx),'el cobro no dice simulado/ejemplo: '+str(BAD.findall(tx)))
    A.evaluate("(()=>{const b=document.querySelector('#modal [data-a=mclose]');if(b)b.click()})()")
    # sitio público
    P.goto(CH);P.wait_for_timeout(1500)
    if P.query_selector('[data-a=ageYes]'):P.click('[data-a=ageYes]');P.wait_for_timeout(500)
    tx=P.inner_text('body');t.chk(not BAD.search(tx),'sitio público sin textos de ejemplo: '+str(BAD.findall(tx)))
    errs=[e for e in A.errs+P.errs if 'Failed to load resource' not in e]
    t.chk(not errs,'sin errores de consola: '+str(errs[:3]))
    b.close();bP.close()
sys.exit(0 if t.done() else 1)
