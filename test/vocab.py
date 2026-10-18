from h import *
import re
BAD=re.compile(r'\b(clientes?|ventas?|vendid[oa]s?|vender|compras?|cobros?|cobrar|cobrad[oa]s?|precios?|aportes?|factura[s]?\b(?! C)|pedidos?|stock\b)',re.I)
with sync_playwright() as p:
    b,c,pg=launch(p,1280,900)
    pg.goto(HTML);pg.wait_for_timeout(500)
    texts={}
    # público (es y en)
    if pg.query_selector('[data-a=ageYes]'):pg.click('[data-a=ageYes]');pg.wait_for_timeout(300)
    texts['publico']=pg.inner_text('body')
    boot_admin(pg)
    views=pg.evaluate("Array.from(document.querySelectorAll('.side [data-a=nav],.side a')).map(a=>a.getAttribute('href')||a.dataset.id||'')")
    print('nav',views)
    for v in ['dashboard','vender','caja','cerradas','inventario','trazabilidad','socios','solic','sellos','tramites','cultivo','personal','fichaje','gastos','reportes','datos','menupub','integraciones','admin']:
        go(pg,'#/panel/'+v);pg.wait_for_timeout(350)
        texts[v]=pg.inner_text('#view') if pg.query_selector('#view') else ''
    for k,tx in texts.items():
        hits=sorted(set(m.group(0).lower() for m in BAD.finditer(tx)))
        if hits:print(k,hits)
    print(pg.errs[:3])
    b.close()
