"""c7 · la app v3.5 contra un servidor SIN la migración 07: lo de RR. HH. queda en el equipo y sube solo al aplicar la migración."""
import subprocess,os,re,time
from h import *
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
def psql(sql):
    r=subprocess.run(['su','postgres','-c',f'/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -At -c "{sql}"'],capture_output=True,text=True);return r.stdout.strip()
subprocess.run(['sh','-c',"sed 's/ 07-recursos-humanos.sql//' /var/tmp/sqlt/reset.sh > /var/tmp/sqlt/reset06.sh && sh /var/tmp/sqlt/reset06.sh"],check=True)
t=T('c7 servidor sin migración 07')
t.chk(psql("select public._col_mod('hrShifts')")=='','base sin la migración 07')
code=psql("select public.generar_codigo_alta()")
env=dict(os.environ,SUPA_URL='http://127.0.0.1:54321',SUPA_KEY='sb_publishable_TESTKEY',TEST_HOOKS='1')
subprocess.run(['python3',os.path.join(ROOT,'assemble.py'),os.path.join(HERE,'cloud.html')],env=env,check=True,capture_output=True)
CH='file://'+os.path.join(HERE,'cloud.html')
def wait_sql(sql,val,to=40):
    end=time.time()+to
    while time.time()<end:
        if psql(sql)==val:return True
        time.sleep(0.5)
    return False
with sync_playwright() as p:
    b,c,A=launch(p)
    A.goto(CH);A.wait_for_timeout(500);A.evaluate("location.hash='#/acceso'");A.wait_for_selector('#sc_c',timeout=10000)
    A.fill('#sc_c',code);A.fill('#sc_n','Ana');A.fill('#sc_e','ana@terps.test');A.fill('#sc_p','Clave1234');A.fill('#sc_p2','Clave1234');A.click('[data-a=cloudSetup]');A.wait_for_selector('#view',timeout=20000)
    go(A,'#/panel/personal');A.click('[data-a=hrEmpNew]');A.fill('#he_n','Lucía');A.fill('#he_pin','3691');A.click('[data-a=hrEmpSave]');A.wait_for_timeout(300)
    A.click('.htabs [data-id=avisos]');A.click('[data-a=hrMsgNew]');A.fill('#ms_t','Aviso de prueba');A.click('[data-a=hrMsgSave]')
    t.chk(wait_sql("select count(*) from public.registros where col='staff'",'1'),'el legajo sube igual (colección existente)')
    found=False
    for i in range(40):
        A.wait_for_timeout(500)
        if 'migración 07' in toast(A):found=True;break
    t.chk(found,'aviso claro al administrador')
    t.chk(A.evaluate("__vb().S.sync.rej.length")==0,'no se marca como rechazo definitivo')
    subprocess.run(['su','postgres','-c','/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -q -f /var/tmp/sqlt/07-recursos-humanos.sql'],check=True,capture_output=True)
    A.evaluate("__vb().persist()")
    t.chk(wait_sql("select count(*) from public.registros where col='hrMsgs'",'1'),'al aplicar la migración, el aviso sube solo')
    t.chk(not A.errs,'sin errores: %s'%A.errs[:2])
    b.close()
import sys;sys.exit(0 if t.done() else 1)
