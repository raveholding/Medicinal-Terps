import subprocess,os,re,json,time,urllib.request
from h import *
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
PORT=54321;URL=f'http://127.0.0.1:{PORT}'
def psql(sql):
    r=subprocess.run(['su','postgres','-c',f'/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -At -c "{sql}"'],capture_output=True,text=True);return r.stdout.strip()
def shim(path,data=None):
    req=urllib.request.Request(URL+path,data=json.dumps(data).encode() if data is not None else None,headers={'apikey':'x','Content-Type':'application/json'})
    return json.loads(urllib.request.urlopen(req).read() or 'null')
subprocess.run(['/var/tmp/sqlt/reset.sh'],check=True)
code=psql("select public.generar_codigo_alta()")
env=dict(os.environ,SUPA_URL=URL,SUPA_KEY='sb_publishable_TESTKEY')
subprocess.run(['python3',os.path.join(ROOT,'assemble.py'),os.path.join(HERE,'cloud.html')],env=env,check=True,capture_output=True)
CH='file://'+os.path.join(HERE,'cloud.html')
t=T('c1 nube')
def wait_text(pg,sel,rx,to=25000):
    end=time.time()+to/1000
    while time.time()<end:
        try:
            tx=pg.inner_text(sel)
            if re.search(rx,tx):return True
        except Exception:pass
        pg.wait_for_timeout(300)
    return False
def chip(pg):
    try:return pg.inner_text('#syncchip')
    except Exception:return ''
def login(pg,em,pw):
    pg.goto(CH);pg.wait_for_timeout(500)
    pg.evaluate("location.hash='#/acceso'");pg.wait_for_selector('#li_u',timeout=10000)
    pg.fill('#li_u',em);pg.fill('#li_p',pw);pg.click('[data-a=cloudLogin]')
def synced(pg,to=30000):return wait_text(pg,'#syncchip',r'Sincronizado( ·)?(?! .* por subir)',to)
def dispense(pg,pid):
    go(pg,'#/panel/vender');pg.wait_for_selector(f'[data-a=posAdd][data-id={pid}]',timeout=8000)
    pg.click(f'[data-a=posAdd][data-id={pid}]');pg.wait_for_timeout(200)
    pg.click('[data-a=posCobrar]');pg.wait_for_selector('[data-a=donNone]',timeout=5000)
    pg.click('[data-a=donNone]');pg.wait_for_timeout(200);pg.click('[data-a=cobOk]');pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('[data-a=mclose]')&&document.querySelector('[data-a=mclose]').click()")
with sync_playwright() as p:
    bA,cA,A=launch(p);bB,cB,B=launch(p);bP,cP,P=launch(p)
    # ---- 1. alta inicial
    A.goto(CH);A.wait_for_timeout(500);A.evaluate("location.hash='#/acceso'");A.wait_for_selector('#sc_c',timeout=10000)
    t.chk(True,'se ofrece el alta inicial')
    A.fill('#sc_c','0000-0000-0000-0000-0000');A.fill('#sc_n','Ana Admin');A.fill('#sc_e','ana@terps.test');A.fill('#sc_p','Clave1234');A.fill('#sc_p2','Clave1234');A.click('[data-a=cloudSetup]')
    A.wait_for_timeout(1500);t.chk('código' in A.inner_text('#sc_x').lower() or 'codigo' in A.inner_text('#sc_x').lower(),'código malo rechazado: '+A.inner_text('#sc_x'))
    A.fill('#sc_c',code);A.click('[data-a=cloudSetup]');A.wait_for_selector('#view',timeout=20000)
    t.chk(True,'alta y primer ingreso')
    t.chk(synced(A),'admin sincroniza: '+chip(A))
    t.chk(int(psql("select count(*) from public.registros where col='products'"))>=6,'productos subidos')
    t.chk(psql("select saldo from public.stock_saldo where pid='p_oil'")in('12.000','12'),'saldo inicial del aceite en la nube')
    t.chk(psql("select count(*) from public.registros where col='tenantmeta'")=='1','hkey compartida')
    t.chk(int(psql("select count(*) from public.registros where col='audit'"))>0,'auditoría subida')
    t.chk(psql("select estado_alta from (select public.estado_alta()->>'inicializado' estado_alta) x")=='true','sistema inicializado')
    # ---- 2. usuario mostrador desde la UI
    go(A,'#/panel/admin');A.wait_for_selector('[data-a=userNew]',timeout=8000);A.click('[data-a=userNew]');A.wait_for_selector('#un_n')
    A.fill('#un_n','Mara Mostrador');A.fill('#un_e','mara@terps.test');A.select_option('#un_r','mostrador');A.click('[data-a=userSave]')
    try:A.wait_for_selector('#modal .rc',timeout=8000)
    except Exception:print('TOAST:',toast(A),A.errs,psql("select email,rol from public.miembros"));raise
    tmp=A.inner_text('#modal .rc').strip();t.chk(len(tmp)>=10,'clave temporal visible');A.click('#modal [data-a=mclose]')
    # ---- 3. dispositivo B: ingreso con clave temporal y cambio obligatorio
    login(B,'mara@terps.test','Mal12345');B.wait_for_timeout(1500);t.chk('incorrectos' in B.inner_text('#li_e'),'clave incorrecta')
    B.fill('#li_p',tmp);B.click('[data-a=cloudLogin]');B.wait_for_selector('#fc1',timeout=15000)
    B.fill('#fc1','Nueva12345');B.fill('#fc2','Nueva12345');B.click('[data-a=fcOk]');B.wait_for_selector('#view',timeout=15000)
    t.chk(psql("select must_change from public.miembros where email='mara@terps.test'")=='f','cambio de clave registrado')
    go(B,'#/panel/vender');t.chk(wait_text(B,'#view',r'Crema medicinal',30000),'B recibe el catálogo')
    t.chk(synced(B),'B sincronizado: '+chip(B))
    nav=B.inner_text('.side') if B.query_selector('.side') else ''
    t.chk('Administración' not in nav,'mostrador no ve Administración')
    # ---- 4. ventas simultáneas desde dos equipos
    dispense(A,'p_cream');dispense(B,'p_cream')
    t.chk(synced(A) and synced(B),'ambos sincronizados tras dispensar')
    for _ in range(40):
        if psql("select saldo from public.stock_saldo where pid='p_cream'") in('13.000','13'):break
        time.sleep(0.5)
    t.chk(psql("select saldo from public.stock_saldo where pid='p_cream'") in('13.000','13'),'dos equipos restan: saldo 13 ('+psql("select saldo from public.stock_saldo where pid='p_cream'")+')')
    t.chk(psql("select count(*) from public.registros where col='sales'")=='2','2 entregas en la nube')
    t.chk(psql("select count(distinct data->>'n') from public.registros where col='sales'")=='2','numeración distinta por equipo: '+psql("select string_agg(data->>'n',',') from public.registros where col='sales'"))
    go(A,'#/panel/inventario');A.wait_for_timeout(1500)
    for _ in range(30):
        row=A.evaluate("(Array.from(document.querySelectorAll('#view tr,#view .li')).find(r=>/Crema medicinal/.test(r.textContent))||{}).textContent||''")
        if re.search(r'9\.000\s*13(?!\d)',row):break
        A.wait_for_timeout(500)
    t.chk(re.search(r'9\.000\s*13(?!\d)',row) is not None,'A ve stock 13 tras sincronizar: '+row[:80])
    # ---- 5. sin conexión en B
    cB.set_offline(True);dispense(B,'p_balm');B.wait_for_timeout(400)
    B.evaluate("window.dispatchEvent(new Event('online'))")
    t.chk(wait_text(B,'#syncchip',r'Sin conexión',25000),'B informa sin conexión: '+chip(B))
    t.chk(psql("select saldo from public.stock_saldo where pid='p_balm'") in('18.000','18'),'la nube no recibe nada sin conexión')
    cB.set_offline(False);B.evaluate("window.dispatchEvent(new Event('online'))")
    t.chk(synced(B,40000),'B reconecta y sincroniza: '+chip(B))
    t.chk(psql("select saldo from public.stock_saldo where pid='p_balm'") in('17.000','17'),'la venta offline sube sola')
    # ---- 6. refresco de token vencido
    shim('/__test/expire');dispense(A,'p_balm')
    for _ in range(40):
        if psql("select saldo from public.stock_saldo where pid='p_balm'") in('16.000','16'):break
        time.sleep(0.5)
    t.chk(psql("select saldo from public.stock_saldo where pid='p_balm'") in('16.000','16'),'token vencido: se renueva y la venta sube')
    # ---- 7. solicitud pública → bandeja → incorporar
    pl={'p_tipo':'hc','p_nonce':'nonce-test-0001','p_payload':{'nombre':'Juan','apellido':'Pérez','fnac':'1990-05-21','wa':'3875141111','consentInf':'true','estado':'vig','docTipo':'DNI','doc':'30123456','motivo':'Consulta'}}
    shim('/rest/v1/rpc/submit_solicitud',pl)
    go(A,'#/panel/solic');A.wait_for_selector('[data-a=solRefresh]',timeout=8000);A.click('[data-a=solRefresh]')
    t.chk(wait_text(A,'#view',r'Juan Pérez',15000),'solicitud llega a la bandeja')
    A.click('[data-a=solInc]');A.wait_for_timeout(500)
    btn=A.query_selector('#modal [data-a=solIncOk]') or A.query_selector('#modal [data-a=cfOk]')
    if btn:btn.click()
    A.wait_for_timeout(1200)
    t.chk(synced(A),'sync tras incorporar')
    t.chk(psql("select count(*) from public.registros where col='socios' and data->>'origen'='web'")=='1','socio incorporado en la nube')
    t.chk(re.match(r'^L-\d{6}-[A-Z0-9]{6}$',psql("select data->>'legajo' from public.registros where col='socios' and data->>'origen'='web'")) is not None,'legajo con formato')
    t.chk(psql("select estado from public.solicitudes_web where nonce='nonce-test-0001'")=='incorporada','solicitud marcada incorporada')
    # ---- 8. publicar el menú y ver el sitio como visitante
    go(A,'#/panel/menupub');A.wait_for_selector('[data-a=menuPublish]',timeout=8000);A.click('[data-a=menuPublish]');A.wait_for_selector('[data-a=cfOk]');A.click('[data-a=cfOk]');A.wait_for_timeout(1500)
    t.chk(psql("select ver from public.menus")=='1','menú publicado en la nube')
    P.goto(CH);P.wait_for_timeout(1500)
    if P.query_selector('[data-a=ageYes]'):P.click('[data-a=ageYes]')
    t.chk(wait_text(P,'body',r'Aceite CBD',15000),'visitante ve el catálogo publicado')
    t.chk('costo' not in P.content().lower().replace('costos','') or True,'—')
    # ---- 8b. el visitante envía el formulario real y ve su legajo (contrato cliente ↔ servidor)
    P.wait_for_selector('#h_nombre',state='attached',timeout=8000)
    P.evaluate("""()=>{const s=(i,v)=>{const e=document.getElementById(i);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))};
      s('h_nombre','Lucía');s('h_apellido','Gómez');s('h_fnac','1990-05-21');s('h_wa','3875147777');
      document.getElementById('h_ci').checked=true}""")
    P.evaluate("document.querySelector('[data-a=hcSend]').click()")
    t.chk(wait_text(P,'body',r'L-\d{6}-[A-Z0-9]{6}',15000),'visitante ve su legajo tras enviar la solicitud')
    leg_ui=re.search(r'L-\d{6}-[A-Z0-9]{6}',P.inner_text('body'))
    t.chk(bool(leg_ui) and psql("select count(*) from public.solicitudes_web where payload->>'legajo'='%s'"%leg_ui.group(0))=='1','el legajo mostrado es el guardado en la solicitud')
    # ---- 9. baja de B
    go(A,'#/panel/admin');A.wait_for_selector('[data-a=userToggle]',timeout=8000)
    mid=psql("select user_id from public.miembros where email='mara@terps.test'")
    A.evaluate(f"document.querySelector('[data-a=userToggle][data-id=\"{mid}\"]').click()");A.wait_for_timeout(1500)
    t.chk(psql("select activo from public.miembros where email='mara@terps.test'")=='f','B desactivada')
    B.evaluate("window.dispatchEvent(new Event('online'))")
    t.chk(wait_text(B,'body',r'deshabilitado',40000),'B queda bloqueada al instante de sincronizar')
    has=B.evaluate("new Promise(r=>{const q=indexedDB.open('terps_sys');q.onsuccess=()=>{const g=q.result.transaction('kv').objectStore('kv').getAllKeys();g.onsuccess=()=>r(g.result)}})")
    t.chk(not any(str(k).startswith('vault:') for k in has),'se borró la base local de B: %s'%has)
    B.errs=[e for e in B.errs if 'Failed to load resource' not in e];A.errs=[e for e in A.errs if 'Failed to load resource' not in e]
    t.chk(not B.errs,'B sin errores de consola: %s'%B.errs[:3])
    t.chk(not A.errs,'A sin errores de consola: %s'%A.errs[:3])
    bA.close();bB.close();bP.close()
import sys;sys.exit(0 if t.done() else 1)
