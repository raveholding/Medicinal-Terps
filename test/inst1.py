"""inst1 · botón «Instalar el sistema»: sólo en pantallas del equipo; el manifiesto no se ofrece a pacientes."""
from h import *
import json,urllib.request
SP='/tmp/claude-0/-home-claude/8b0ba7b9-3b98-5fe5-8ec2-3527bcd23db4/scratchpad/'
U='http://127.0.0.1:8765/'
t=T('inst1 instalar el sistema')
m=json.loads(urllib.request.urlopen(U+'app-equipo.webmanifest').read())
t.chk(m['display']=='standalone' and '#/acceso' in m['start_url'],'manifiesto válido, abre en el ingreso')
for ic_ in m['icons']+[{'src':'assets/apple-touch-180.png'}]:
    t.chk(urllib.request.urlopen(U+ic_['src']).status==200,'ícono '+ic_['src'])
with sync_playwright() as p:
    b=p.chromium.launch();c=b.new_context(viewport={'width':1280,'height':860});pg=c.new_page()
    errs=[];pg.on('console',lambda x:errs.append(x.text) if x.type=='error' else None);pg.on('pageerror',lambda e:errs.append(str(e)))
    man=lambda:pg.evaluate("!!document.querySelector('link[rel=manifest]')")
    pg.goto(U);pg.wait_for_timeout(800)
    if pg.query_selector('[data-a=ageYes]'):pg.click('[data-a=ageYes]');pg.wait_for_timeout(300)
    t.chk(not man(),'sitio público: sin manifiesto')
    t.chk(pg.query_selector('.instb') is None,'sitio público: sin botón de instalar')
    for h_ in ['#/cliente','#/mitarjeta']:
        pg.evaluate("location.hash='%s'"%h_);pg.wait_for_timeout(400)
        t.chk(not man() and pg.query_selector('.instb') is None,'%s (pacientes): sin manifiesto ni botón'%h_)
    pg.evaluate("location.hash='#/acceso'");pg.wait_for_timeout(600)
    t.chk(man(),'ingreso del equipo: manifiesto cargado')
    t.chk(pg.is_visible('.instauth .instb'),'ingreso del equipo: botón visible')
    pg.screenshot(path=SP+'inst_login.png')
    pg.wait_for_timeout(800)
    t.chk(pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)"),'service worker registrado')
    # sin evento del navegador: instrucciones
    pg.click('.instauth .instb');pg.wait_for_timeout(200)
    t.chk('Instalar el sistema' in pg.inner_text('#modal') and pg.query_selector('#modal .inststeps li') is not None,'sin diálogo del navegador: instrucciones paso a paso')
    pg.screenshot(path=SP+'inst_ayuda.png');pg.keyboard.press('Escape')
    # con el evento del navegador (Chrome/Edge/Android)
    pg.evaluate("""(()=>{window.__pr=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>{window.__pr++;return Promise.resolve()};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);window.__dp=e.defaultPrevented})()""")
    t.chk(pg.evaluate('window.__dp'),'se suprime la sugerencia automática del navegador')
    pg.click('.instauth .instb');pg.wait_for_timeout(300)
    t.chk(pg.evaluate('window.__pr')==1,'el botón abre el diálogo de instalación del navegador')
    t.chk(not pg.is_visible('.instauth .instb'),'aceptada: el botón se oculta')
    # volver al sitio quita el manifiesto
    pg.evaluate("location.hash='#/'");pg.wait_for_timeout(400);t.chk(not man(),'al volver al sitio público se quita el manifiesto')
    # app instalada abre en el ingreso
    pg.goto(U+'?app=equipo');pg.wait_for_timeout(600)
    t.chk(pg.evaluate('location.hash')=='#/acceso','la app instalada abre directo en el ingreso')
    # sin conexión: abre desde la copia
    pg.reload();pg.wait_for_timeout(600);c.set_offline(True);pg.goto(U+'?app=equipo#/acceso');pg.wait_for_timeout(800)
    t.chk('Acceso del equipo' in pg.inner_text('body') or pg.query_selector('#li_u') is not None,'sin conexión: la app abre igual')
    c.set_offline(False)
    csp=[e for e in errs if 'Content Security Policy' in e or 'manifest' in e.lower()]
    t.chk(not csp,'sin bloqueos de seguridad: %s'%csp[:2])
    b.close()
    # panel con datos locales: botón en menú, ayuda y Ctrl+K
    b,c,pg=launch(p,1366,900)
    pg.goto(HTML);pg.wait_for_timeout(500);pg.click('[data-a=ageYes]');boot_admin(pg)
    t.chk(pg.query_selector('.credit .instb') is not None,'panel: botón en el menú lateral')
    pg.click('[data-a=help]');pg.wait_for_timeout(150);t.chk(pg.query_selector('#modal .instb') is not None,'panel: botón en «Necesito ayuda»');pg.keyboard.press('Escape')
    pg.keyboard.press('Control+k');pg.fill('#palq','instalar');pg.wait_for_timeout(150);t.chk('Instalar el sistema' in pg.inner_text('#palr'),'Ctrl + K: «Instalar el sistema»')
    pg.keyboard.press('Enter');pg.wait_for_timeout(200);t.chk('https' in pg.inner_text('#modal'),'desde un archivo local avisa que hace falta el sitio publicado')
    pg.keyboard.press('Escape');pg.screenshot(path=SP+'inst_panel.png')
    t.chk(not pg.errs,'sin errores: %s'%pg.errs[:3])
    b.close()
import sys;sys.exit(0 if t.done() else 1)
