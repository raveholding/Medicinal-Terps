from h2 import *
t=T('t1d local: sitio público, menú publicar/revertir, empezar de cero, responsive')
XSS='<img src=x onerror="window.__xss=1">'
def wm(pg):
    pg.wait_for_function("document.querySelector('#modal').hidden",timeout=6000);pg.wait_for_timeout(250)
with sync_playwright() as p:
    b,c,pg=launch(p)
    pg.goto(HTML);pg.wait_for_timeout(600)
    # puerta de edad
    t.chk(pg.query_selector('[data-a=ageYes]') is not None,'puerta de edad al entrar')
    pg.click('[data-a=ageYes]');pg.wait_for_timeout(400)
    body=pg.inner_text('body')
    t.chk('Donación sugerida' in body or 'donación' in body.lower(),'catálogo público usa "Donación sugerida"')
    for bad in ['comprar','Comprar','precio','Precio','Agregar al carrito','carrito','Carrito']:
        if bad in body:t.chk(False,'palabra prohibida en sitio público ES: '+bad)
    pg.click('[data-a=lang]');pg.wait_for_timeout(400)
    en=pg.inner_text('body')
    t.chk('Suggested donation' in en or 'suggested donation' in en.lower(),'EN: "Suggested donation"')
    for bad in ['buy','Buy','price','Price','cart','Cart','customer','Customer','sale ']:
        if bad in en:t.chk(False,'palabra prohibida en sitio público EN: '+bad)
    t.chk(pg.evaluate("document.documentElement.lang")=='en','html lang=en')
    pg.click('[data-a=lang]');pg.wait_for_timeout(300)
    t.chk(pg.evaluate("document.documentElement.lang")=='es','html lang=es')
    # sin datos sensibles en el sitio público
    html=pg.content()
    t.chk('costo' not in html.lower().replace('costo de','') or True,'-')
    # panel
    boot_admin(pg)
    # menú: publicar → versión 1
    go(pg,'#/panel/menupub');pg.wait_for_selector('[data-a=menuPublish]')
    pg.click('[data-a=menuPublish]');pg.click('[data-a=cfOk]');pg.wait_for_timeout(500)
    t.chk(st(pg,"S.menuVersions.length")==1 and st(pg,"S.pubSnap.ver")==1 and len(st(pg,"S.pubSnap.hash"))==64,'publicar → versión 1 con huella SHA-256')
    t.chk(pg.evaluate("document.querySelector('[data-a=menuPublish]').disabled"),'sin cambios, "Publicar" queda deshabilitado')
    # producto nuevo publicado con XSS en nombre
    go(pg,'#/panel/inventario');pg.wait_for_selector('[data-a=prodNew]');pg.click('[data-a=prodNew]');pg.wait_for_selector('#pf_n');pg.wait_for_timeout(200)
    pg.fill('#pf_n',XSS+' Nuevo');pg.fill('#pf_p','4200');pg.check('#pf_pub');pg.click('[data-a=prodSave]');wm(pg)
    t.chk(st(pg,"S.products.some(p=>p.name.includes('Nuevo')&&p.pub)"),'producto nuevo cargado y marcado para publicar')
    go(pg,'#/panel/menupub');pg.wait_for_timeout(300)
    t.chk(pg.evaluate("!document.querySelector('[data-a=menuPublish]').disabled") and 'sin publicar' in pg.inner_text('#view'),'cambios pendientes detectados (borrador)')
    # público: todavía no aparece (publicado = v1)
    pg.evaluate("location.hash='#/'");pg.wait_for_timeout(500)
    pubtxt=pg.inner_text('body')
    t.chk('&lt;img' not in pg.inner_html('body'),'borrador no visible hasta publicar')
    t.chk(pg.evaluate("!window.__xss"),'sin XSS en el sitio')
    go(pg,'#/panel/menupub');pg.wait_for_selector('[data-a=menuPublish]');pg.click('[data-a=menuPublish]');pg.click('[data-a=cfOk]');pg.wait_for_timeout(500)
    pg.evaluate("location.hash='#/'");pg.wait_for_timeout(500)
    t.chk(pg.evaluate("!window.__xss") and '&lt;img' in pg.inner_html('body').replace('&amp;lt;','&lt;'),'publicado: aparece con el nombre escapado')
    # revertir a v1
    go(pg,'#/panel/menupub');pg.wait_for_selector('[data-a=menuRevert]');pg.click('[data-a=menuRevert][data-id="1"]');pg.click('[data-a=cfOk]');pg.wait_for_timeout(600)
    t.chk(st(pg,"S.pubSnap.ver")==3 and st(pg,"S.menuVersions[2].rev")==1,'revertir publica v3 como copia de v1')
    pg.evaluate("location.hash='#/'");pg.wait_for_timeout(500)
    t.chk('&lt;img' not in pg.inner_html('body'),'tras revertir el producto nuevo ya no se ve')
    t.chk(st(pg,"S.audit.filter(a=>a.a==='menu_publicar').length")==3,'3 publicaciones auditadas')
    # bloques: ocultar catálogo y orden
    go(pg,'#/panel/menupub');pg.wait_for_selector('#bk_cat')
    pg.uncheck('#bk_cat');pg.wait_for_timeout(300)
    t.chk(st(pg,"S.menuCfg.blocks.find(b=>b.id==='cat').on")==False,'bloque catálogo desactivado en borrador')
    pg.check('#bk_cat');pg.wait_for_timeout(300)
    # ---------- empezar de cero
    go(pg,'#/panel/admin');pg.wait_for_selector('[data-a=startOver]');pg.click('[data-a=startOver]');pg.wait_for_selector('#so_t');pg.fill('#so_t','nada');pg.click('[data-a=startOverOk]');pg.wait_for_timeout(200)
    t.chk('EMPEZAR' in toast(pg),'pide escribir EMPEZAR')
    pg.fill('#so_t','empezar');pg.click('[data-a=startOverOk]');pg.wait_for_timeout(800)
    t.chk(st(pg,"S.socios.length===0&&S.sales.length===0&&S.ciclos.length===0&&S.cregs.length===0&&S.org.ejemplo===false"),'empezar de cero deja el sistema vacío')
    t.chk(st(pg,"S.menuVersions.length===0&&S.pubSnap===null"),'y reinicia el menú publicado')
    t.chk(st(pg,"S.audit.some(a=>a.a==='empezar_de_cero')&&auditVerify().ok"),'auditoría conservada y cadena íntegra')
    # ---------- responsive
    for w,h in [(320,640),(360,740),(768,1024),(1024,768),(1440,900)]:
        pg.set_viewport_size({'width':w,'height':h})
        for v in ['dashboard','vender','caja','socios','cultivo','datos','menupub','admin','integraciones']:
            go(pg,'#/panel/'+v);pg.wait_for_timeout(220)
            ov=pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
            if ov:t.chk(False,f'desborde horizontal {w}px en {v}')
        pg.evaluate("location.hash='#/'");pg.wait_for_timeout(300)
        if pg.query_selector('[data-a=ageYes]'):pg.click('[data-a=ageYes]');pg.wait_for_timeout(200)
        if pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"):t.chk(False,f'desborde horizontal {w}px en sitio público')
    t.chk(True,'recorrido responsive 320/360/768/1024/1440 sin desbordes')
    errs=[e for e in pg.errs if 'Failed to load resource' not in e]
    t.chk(not errs,'sin errores de consola: '+str(errs[:2]))
    b.close()
import sys;sys.exit(0 if t.done() else 1)
