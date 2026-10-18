import sys
src=open('c1_cloud.py').read()
head=src.split("with sync_playwright() as p:")[0].replace("t=T('c1 nube')","t=T('c2 nube: offline, rechazos, reinicio')")
exec(head)
def setup_admin(A):
    A.goto(CH);A.wait_for_timeout(500);A.evaluate("location.hash='#/acceso'");A.wait_for_selector('#sc_c',timeout=10000)
    A.fill('#sc_c',code);A.fill('#sc_n','Ana Admin');A.fill('#sc_e','ana@terps.test');A.fill('#sc_p','Clave1234');A.fill('#sc_p2','Clave1234');A.click('[data-a=cloudSetup]');A.wait_for_selector('#view',timeout=20000)
def make_user(A,name,email,role):
    go(A,'#/panel/admin');A.wait_for_selector('[data-a=userNew]',timeout=8000);A.click('[data-a=userNew]');A.wait_for_selector('#un_n')
    A.fill('#un_n',name);A.fill('#un_e',email);A.select_option('#un_r',role);A.click('[data-a=userSave]');A.wait_for_selector('#modal .rc',timeout=8000)
    tmp=A.inner_text('#modal .rc').strip();A.click('#modal [data-a=mclose]');return tmp
def first_login(B,email,tmp,newp):
    login(B,email,tmp);B.wait_for_selector('#fc1',timeout=15000);B.fill('#fc1',newp);B.fill('#fc2',newp);B.click('[data-a=fcOk]');B.wait_for_selector('#view',timeout=15000)
def logout(pg):
    pg.click('[data-a=logout]');pg.wait_for_selector('#li_u',timeout=8000)
with sync_playwright() as p:
    bA,cA,A=launch(p);bB,cB,B=launch(p)
    setup_admin(A);t.chk(synced(A),'A sincroniza')
    tmp=make_user(A,'Mara Mostrador','mara@terps.test','mostrador')
    first_login(B,'mara@terps.test',tmp,'Nueva12345');go(B,'#/panel/vender');t.chk(wait_text(B,'#view',r'Crema medicinal',30000),'B recibe catálogo');t.chk(synced(B),'B sincroniza')
    # ---- ingreso sin conexión
    logout(A);cA.set_offline(True)
    A.fill('#li_u','ana@terps.test');A.fill('#li_p','Mala12345');A.click('[data-a=cloudLogin]');A.wait_for_timeout(1500)
    t.chk('incorrectos' in A.inner_text('#li_e'),'sin conexión: clave incorrecta se rechaza: '+A.inner_text('#li_e'))
    A.fill('#li_p','Clave1234');A.click('[data-a=cloudLogin]');A.wait_for_selector('#view',timeout=20000)
    t.chk(wait_text(A,'#syncchip',r'Sin conexión',15000),'ingreso offline con base local: '+chip(A))
    dispense(A,'p_balm');cA.set_offline(False);A.evaluate("window.dispatchEvent(new Event('online'))")
    for _ in range(60):
        if psql("select saldo from public.stock_saldo where pid='p_balm'") in('17.000','17'):break
        time.sleep(0.5)
    t.chk(psql("select saldo from public.stock_saldo where pid='p_balm'") in('17.000','17'),'lo vendido offline sube con la contraseña en memoria')
    # ---- dos equipos venden el último
    psql("update public.stock_saldo set saldo=1 where pid='p_cream'")
    psql("update public.registros set data=jsonb_set(data,'{stock}','1'),updated_at=clock_timestamp() where col='products' and id='p_cream'")
    def stock_of(pg,rx='Crema medicinal'):
        go(pg,'#/panel/inventario');pg.wait_for_timeout(500)
        return pg.evaluate("(Array.from(document.querySelectorAll('#view tr,#view .li')).find(r=>/Crema medicinal/.test(r.textContent))||{}).textContent||''")
    for _ in range(40):
        if re.search(r'9\.000\s*1(?!\d)',stock_of(A)):break
        A.wait_for_timeout(500)
    t.chk(re.search(r'9\.000\s*1(?!\d)',stock_of(A)) is not None,'A ve stock 1')
    for _ in range(40):
        B.wait_for_timeout(500)
        if synced(B,1000):
            go(B,'#/panel/vender')
            if wait_text(B,'#view',r'Crema medicinal',2000):break
    cA.set_offline(True);cB.set_offline(True)
    dispense(A,'p_cream');dispense(B,'p_cream')
    cA.set_offline(False);cB.set_offline(False)
    A.evaluate("window.dispatchEvent(new Event('online'))");B.evaluate("window.dispatchEvent(new Event('online'))")
    for _ in range(60):
        if psql("select count(*) from public.registros where col='sales' and data->'items'->0->>'pid'='p_cream'")=='2':break
        time.sleep(0.5)
    time.sleep(3)
    t.chk(psql("select saldo from public.stock_saldo where pid='p_cream'") in('0.000','0'),'el último stock se vendió una sola vez en la nube, nunca negativo')
    # la entrega perdedora queda con aviso
    ra=A.inner_text('#syncchip');rb=B.inner_text('#syncchip')
    t.chk('rechaz' in (ra+rb),'uno de los equipos avisa el rechazo: %s / %s'%(ra,rb))
    loser=A if 'rechaz' in ra else B
    loser.click('#syncchip');loser.wait_for_selector('#modal [data-a=rejDel]',timeout=8000)
    t.chk(wait_text(loser,'#modal',r'Stock insuficiente',5000),'tocar el indicador de nube explica el motivo (sirve para cualquier rol)')
    loser.click('#modal [data-a=rejDel]');loser.wait_for_timeout(500)
    t.chk(loser.query_selector('#modal [data-a=rejDel]') is None,'descartar el aviso lo quita')
    loser.evaluate("document.querySelector('#modal [data-a=mclose]')&&document.querySelector('#modal [data-a=mclose]').click()");loser.wait_for_timeout(300)
    # ---- empezar de cero desde A y el otro equipo se reinicia
    go(A,'#/panel/admin');A.wait_for_selector('[data-a=startOver]',timeout=8000);A.click('[data-a=startOver]');A.wait_for_selector('#so_t');A.fill('#so_t','EMPEZAR');A.click('[data-a=startOverOk]');A.wait_for_timeout(2500)
    t.chk(psql("select epoch from public.tenants")=='2','epoch 2 en la nube')
    t.chk(psql("select count(*) from public.registros where col in ('sales','socios','stockMoves')")=='0','la nube quedó sin movimientos')
    t.chk(synced(A,30000),'A sincroniza tras empezar de cero')
    B.evaluate("window.dispatchEvent(new Event('online'))")
    go(B,'#/panel/dashboard')
    for _ in range(60):
        if synced(B,500):break
    B.wait_for_timeout(16000)
    go(B,'#/panel/caja');go(B,'#/panel/vender')
    t.chk(not wait_text(B,'#view',r'Crema medicinal',3000),'B se reinició con la época nueva (productos de ejemplo borrados)')
    t.chk(psql("select count(*) from public.registros where col='products' and data->>'membership'='true'")=='1','queda la cuota de socio')
    B.errs=[e for e in B.errs if 'Failed to load resource' not in e];A.errs=[e for e in A.errs if 'Failed to load resource' not in e]
    t.chk(not A.errs and not B.errs,'sin errores de consola: %s %s'%(A.errs[:2],B.errs[:2]))
    bA.close();bB.close()
import sys;sys.exit(0 if t.done() else 1)
