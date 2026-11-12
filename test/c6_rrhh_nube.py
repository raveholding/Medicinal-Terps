"""c6 · nube con la migración 07: Recursos Humanos entre dos equipos. El administrador carga el legajo (con PIN), un turno y un aviso;
el equipo del mostrador (rol mostrador, sin permiso de Personal) usa el kiosco: ficha, lee el aviso y pide una licencia;
el servidor guarda todo y el administrador aprueba la solicitud. El archivo de un documento no viaja a la nube."""
import subprocess,os,re,json,time
from h import *
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
URL='http://127.0.0.1:54321'
def psql(sql):
    r=subprocess.run(['su','postgres','-c',f'/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -At -c "{sql}"'],capture_output=True,text=True);return r.stdout.strip()
subprocess.run(['/var/tmp/sqlt/reset.sh'],check=True)
code=psql("select public.generar_codigo_alta()")
env=dict(os.environ,SUPA_URL=URL,SUPA_KEY='sb_publishable_TESTKEY',TEST_HOOKS='1')
subprocess.run(['python3',os.path.join(ROOT,'assemble.py'),os.path.join(HERE,'cloud.html')],env=env,check=True,capture_output=True)
CH='file://'+os.path.join(HERE,'cloud.html')
t=T('c6 nube: Recursos Humanos y portal del empleado')
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
        if psql(sql)==val:return True
        time.sleep(0.5)
    return False
def kick(pg):pg.evaluate("(()=>{try{__vb().persist()}catch(e){}})()")
with sync_playwright() as p:
    bA,cA,A=launch(p);bB,cB,B=launch(p)
    A.goto(CH);A.wait_for_timeout(500);A.evaluate("location.hash='#/acceso'");A.wait_for_selector('#sc_c',timeout=10000)
    A.fill('#sc_c',code);A.fill('#sc_n','Ana Admin');A.fill('#sc_e','ana@terps.test');A.fill('#sc_p','Clave1234');A.fill('#sc_p2','Clave1234');A.click('[data-a=cloudSetup]')
    A.wait_for_selector('#view',timeout=20000);t.chk(synced(A),'admin sincronizado')
    # usuario mostrador
    go(A,'#/panel/admin');A.wait_for_selector('[data-a=userNew]',timeout=8000);A.click('[data-a=userNew]');A.wait_for_selector('#un_n')
    A.fill('#un_n','Mara Mostrador');A.fill('#un_e','mara@terps.test');A.select_option('#un_r','mostrador');A.click('[data-a=userSave]');A.wait_for_selector('#modal .rc',timeout=8000)
    tmp=A.inner_text('#modal .rc').strip();A.click('#modal [data-a=mclose]')
    # legajo con PIN, turno de hoy y aviso
    go(A,'#/panel/personal');A.click('[data-a=hrEmpNew]');A.fill('#he_n','Lucía Gómez');A.fill('#he_d','30111222');A.fill('#he_r','Mostrador');A.fill('#he_v','5000');A.fill('#he_pin','3691');A.click('[data-a=hrEmpSave]');A.wait_for_timeout(300)
    A.click('.htabs [data-id=turnos]');A.click('.hrcal .tdy .shb');A.fill('#sh_f','00:00');A.fill('#sh_t','23:00');A.click('[data-a=hrShSave]');A.wait_for_timeout(200)
    A.click('.htabs [data-id=avisos]');A.click('[data-a=hrMsgNew]');A.fill('#ms_t','Reunión el lunes a las 9.');A.click('[data-a=hrMsgSave]');A.wait_for_timeout(200)
    A.click('.htabs [data-id=documentos]');A.click('[data-a=hrDocNew]');A.fill('#dc_n','Contrato')
    A.set_input_files('#dc_f',files=[{'name':'c.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 contrato secreto\n%%EOF'}]);A.click('[data-a=hrDocSave]');A.wait_for_timeout(300)
    t.chk(synced(A),'A sincroniza RR. HH.')
    t.chk(wait_sql("select count(*) from public.registros where col in ('hrShifts','hrMsgs','hrDocs')",'3'),'el servidor guarda turno, aviso y documento')
    t.chk(psql("select count(*) from public.registros where data::text like '%contrato secreto%'")=='0','el archivo del documento no viaja a la nube')
    t.chk(psql("select count(*) from public.registros where col='staff' and data::text like '%3691%'")=='0','el PIN no viaja en claro')
    # equipo B: mostrador en el kiosco
    B.goto(CH);B.wait_for_timeout(500);B.evaluate("location.hash='#/acceso'");B.wait_for_selector('#li_u',timeout=10000)
    B.fill('#li_u','mara@terps.test');B.fill('#li_p',tmp);B.click('[data-a=cloudLogin]');B.wait_for_selector('#fc1',timeout=15000)
    B.fill('#fc1','Nueva12345');B.fill('#fc2','Nueva12345');B.click('[data-a=fcOk]');B.wait_for_selector('#view',timeout=15000);t.chk(synced(B),'B (mostrador) sincronizado')
    nav=B.inner_text('.side');t.chk('Recursos Humanos' not in nav and 'Fichaje' in nav,'el mostrador ve Fichaje y no Recursos Humanos')
    t.chk(wait_text(B,'body',r'.',1000) and B.evaluate("__vb().S.staff.some(f=>f.name==='Lucía Gómez')"),'B recibe el legajo')
    go(B,'#/panel/fichaje');B.click('[data-a=kioskHr]');B.wait_for_timeout(200)
    for k in '4321':B.click('#modal [data-a=np][data-k="%s"]'%k)
    B.click('#modal [data-a=np][data-k=OK]');B.wait_for_selector('#kp',timeout=8000)
    B.fill('#kp','3691');B.keyboard.press('Enter');B.wait_for_timeout(300)
    t.chk('turno de hoy' in B.inner_text('#view'),'portal con el turno que cargó el administrador')
    B.click('[data-a=hrkPunch]');B.wait_for_timeout(300)
    B.fill('#kp','3691');B.keyboard.press('Enter');B.wait_for_timeout(300)
    B.click('[data-a=hrkSec][data-id=avisos]');B.wait_for_timeout(200);t.chk('Reunión el lunes' in B.inner_text('#view'),'lee el aviso')
    B.click('[data-a=hrkSec][data-id=solic]');B.click('[data-a=hrkReq]');B.fill('#rq_f','2026-12-28');B.fill('#rq_h','2026-12-29');B.click('[data-a=hrReqSave]');B.wait_for_timeout(300)
    kick(B);t.chk(synced(B),'B sincroniza el portal')
    t.chk(wait_sql("select count(*) from public.registros where col='fichajes'",'1'),'el servidor guarda la fichada del kiosco')
    t.chk(wait_sql("select count(*) from public.registros where col='hrReads'",'1'),'el servidor guarda el aviso leído')
    t.chk(wait_sql("select data->>'state' from public.registros where col='hrReqs'",'pendiente'),'el servidor guarda la solicitud pendiente')
    t.chk(not B.evaluate("__vb().S.sync.rej.length"),'sin rechazos en el kiosco: %s'%B.evaluate("JSON.stringify(__vb().S.sync.rej)"))
    # A aprueba (dos pasos: supervisor y administración)
    go(A,'#/panel/personal');A.wait_for_timeout(300)
    ok_=False
    for i in range(40):
        A.evaluate("(()=>{try{cloudKick&&cloudKick()}catch(e){}})()");A.wait_for_timeout(500)
        if A.evaluate("__vb().S.hrReqs.length"):ok_=True;break
    t.chk(ok_,'A recibe la solicitud del portal')
    A.click('.htabs [data-id=solicitudes]');A.click('[data-a=hrReqOk]');A.wait_for_timeout(200);A.click('[data-a=hrReqOk]');A.wait_for_timeout(300)
    t.chk(synced(A),'A sincroniza la aprobación')
    t.chk(wait_sql("select data->>'state' from public.registros where col='hrReqs'",'aprobada'),'solicitud aprobada en el servidor')
    t.chk(wait_text(A,'#view',r'.',500) and A.evaluate("__vb().S.fichajes.length")==1,'A recibe la fichada del kiosco')
    t.chk(not A.errs and not B.errs,'sin errores: %s %s'%(A.errs[:2],B.errs[:2]))
    bA.close();bB.close()
import sys;sys.exit(0 if t.done() else 1)
