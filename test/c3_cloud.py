"""c3 · nube con la migración 02: la cuenta corriente (entrega a cuenta + pago) y los documentos del legajo
se sincronizan entre dos equipos; el servidor guarda la parte a cuenta, el pago y el registro del documento;
el visitante anónimo ve el catálogo vivo antes de la primera publicación."""
import subprocess,os,re,json,time,urllib.request
from h import *
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
PORT=54321;URL=f'http://127.0.0.1:{PORT}'
def psql(sql):
    r=subprocess.run(['su','postgres','-c',f'/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -At -c "{sql}"'],capture_output=True,text=True);return r.stdout.strip()
subprocess.run(['/var/tmp/sqlt/reset.sh'],check=True)
code=psql("select public.generar_codigo_alta()")
env=dict(os.environ,SUPA_URL=URL,SUPA_KEY='sb_publishable_TESTKEY')
subprocess.run(['python3',os.path.join(ROOT,'assemble.py'),os.path.join(HERE,'cloud.html')],env=env,check=True,capture_output=True)
CH='file://'+os.path.join(HERE,'cloud.html')
t=T('c3 nube: cuenta corriente, documentos y catálogo')
def wait_text(pg,sel,rx,to=25000):
    end=time.time()+to/1000
    while time.time()<end:
        try:
            if re.search(rx,pg.inner_text(sel)):return True
        except Exception:pass
        pg.wait_for_timeout(300)
    return False
def synced(pg,to=30000):return wait_text(pg,'#syncchip',r'Sincronizado( ·)?(?! .* por subir)',to)
def wait_sql(sql,val,to=30):
    end=time.time()+to
    while time.time()<end:
        v=psql(sql)
        if v==val:return True
        time.sleep(0.5)
    return False
LEG="(()=>{const r=Array.from(document.querySelectorAll('#view tr')).find(x=>/Paula/.test(x.textContent));r.querySelector('[data-a=legajo]').click()})()"
def close(pg):pg.evaluate("(()=>{const b=document.querySelector('#modal [data-a=mclose]');if(b)b.click()})()");pg.wait_for_timeout(200)
with sync_playwright() as p:
    bA,cA,A=launch(p);bB,cB,B=launch(p);bP,cP,P=launch(p)
    # visitante antes de cualquier publicación: catálogo vivo al frente
    A.goto(CH);A.wait_for_timeout(500);A.evaluate("location.hash='#/acceso'");A.wait_for_selector('#sc_c',timeout=10000)
    A.fill('#sc_c',code);A.fill('#sc_n','Ana Admin');A.fill('#sc_e','ana@terps.test');A.fill('#sc_p','Clave1234');A.fill('#sc_p2','Clave1234');A.click('[data-a=cloudSetup]')
    A.wait_for_selector('#view',timeout=20000);t.chk(synced(A),'admin sincronizado')
    P.goto(CH);P.wait_for_timeout(800)
    if P.query_selector('[data-a=ageYes]'):P.click('[data-a=ageYes]');P.wait_for_timeout(300)
    t.chk(wait_text(P,'#sec_cat',r'Crema medicinal',20000),'visitante: catálogo vivo antes de publicar')
    secs=P.evaluate("Array.from(document.querySelectorAll('section.psec')).map(s=>s.id)")
    t.chk(secs and secs[0]=='sec_cat','visitante: catálogo al frente '+str(secs))
    pub=psql("select public.menu_publico(null)::text")
    t.chk('Crema medicinal' in pub and not re.search(r'"(cost|stock|wa|doc|legajo)":\s*[^,]*,?',pub.split('"products"')[1]),'menu_publico sin costos ni personas')
    # caja y persona con límite
    go(A,'#/panel/caja');A.wait_for_selector('#cj_f',timeout=8000);A.fill('#cj_f','1000');A.click('[data-a=cajaOpen]');A.wait_for_timeout(300)
    go(A,'#/panel/socios');A.wait_for_selector('[data-a=socioNew]');A.click('[data-a=socioNew]');A.wait_for_selector('#sf_n')
    A.fill('#sf_n','Paula');A.fill('#sf_a','Cuenta');A.fill('#sf_d','30222333');A.fill('#sf_w','5493875009999');A.fill('#sf_l','30000');A.set_checked('#sf_ki',True)
    A.click('[data-a=socioSave]');A.wait_for_timeout(400)
    if A.query_selector('#modal [data-a=cfOk]'):A.click('#modal [data-a=cfOk]');A.wait_for_timeout(300)
    # entrega toda a cuenta corriente
    go(A,'#/panel/vender');A.wait_for_selector('[data-a=posAdd][data-id=p_cream]',timeout=8000)
    A.click('[data-a=posRec]');A.click('[data-a=recKind][data-id=paciente]');A.wait_for_selector('#cq');A.fill('#cq','Paula');A.wait_for_timeout(250);A.click('#clist [data-a=custPick]');A.wait_for_timeout(250)
    A.click('[data-a=posAdd][data-id=p_cream]');A.wait_for_timeout(150);A.click('[data-a=posCobrar]');A.wait_for_selector('[data-a=cobOk]')
    A.click('[data-a=cobPay][data-id=cc]');A.wait_for_timeout(150);A.select_option('#rubsel','r_don')
    if A.query_selector('#cusel') and not A.input_value('#cusel'):A.select_option('#cusel',index=1)
    A.click('[data-a=cobOk]');A.wait_for_timeout(600);close(A)
    t.chk(synced(A),'A sincroniza la entrega a cuenta')
    t.chk(wait_sql("select (data->>'cc') from public.registros where col='sales' limit 1",'18500'),'el servidor guarda la parte a cuenta: '+psql("select data->>'cc' from public.registros where col='sales'"))
    # pago parcial desde la ficha
    go(A,'#/panel/socios');A.wait_for_selector('[data-a=legajo]',timeout=8000);A.evaluate(LEG);A.wait_for_selector('[data-a=ccPagar]',timeout=8000)
    A.click('[data-a=ccPagar]');A.wait_for_selector('#cc_m');A.fill('#cc_m','5000');A.select_option('#cc_med','efectivo')
    if A.query_selector('#cc_r') and not A.input_value('#cc_r'):A.select_option('#cc_r','r_cc')
    A.click('[data-a=ccPagarOk]');A.wait_for_timeout(500);close(A)
    t.chk(synced(A),'A sincroniza el pago')
    t.chk(wait_sql("select count(*) from public.registros where col='pagos'",'1'),'el servidor guarda el pago de la cuenta')
    # documento sin Drive: queda pendiente en el equipo, el registro se sincroniza
    go(A,'#/panel/socios');A.wait_for_selector('[data-a=legajo]');A.evaluate(LEG);A.wait_for_selector('#docFile',state='attached',timeout=8000)
    A.set_input_files('#docFile',files=[{'name':'reprocann.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 prueba de documento\n%%EOF'}]);A.wait_for_selector('#dc_t',timeout=5000)
    A.select_option('#dc_t','REPROCANN');A.click('[data-a=docOk]');A.wait_for_timeout(800);close(A)
    t.chk(synced(A),'A sincroniza el documento')
    t.chk(wait_sql("select count(*) from public.registros where col='legDocs'",'1'),'el servidor guarda el registro del documento')
    t.chk(psql("select count(*) from public.registros where col='legDocs' and data::text like '%PDF-1.4%'")=='0','el contenido del archivo no viaja a la nube')
    # segundo equipo: ve la deuda y el documento
    B.goto(CH);B.wait_for_timeout(500);B.evaluate("location.hash='#/acceso'");B.wait_for_selector('#li_u',timeout=10000)
    B.fill('#li_u','ana@terps.test');B.fill('#li_p','Clave1234');B.click('[data-a=cloudLogin]');B.wait_for_selector('#view',timeout=20000)
    t.chk(synced(B),'B sincronizado')
    go(B,'#/panel/socios');t.chk(wait_text(B,'#view',r'debe \$ 13\.500',20000),'B ve la deuda 18.500 − 5.000 = 13.500')
    B.evaluate(LEG);B.wait_for_selector('#modal .mb.wide',timeout=8000)
    tx=B.inner_text('#modal')
    t.chk('Debe $ 13.500' in tx,'B: ficha con la cuenta corriente')
    t.chk('reprocann' in tx.lower() and 'otro equipo' in tx,'B: documento pendiente «guardado en otro equipo»')
    close(B)
    # el cierre de caja separa la deuda del dinero
    go(A,'#/panel/caja');A.wait_for_timeout(500);ct=A.inner_text('#view')
    t.chk('$ 6.000' in ct,'efectivo esperado = 1.000 + 5.000 (la entrega a cuenta no suma)')
    errs=[e for e in A.errs+B.errs+P.errs if 'Failed to load resource' not in e]
    t.chk(not errs,'sin errores de consola: '+str(errs[:3]))
    for b in (bA,bB,bP):b.close()
sys.exit(0 if t.done() else 1)
