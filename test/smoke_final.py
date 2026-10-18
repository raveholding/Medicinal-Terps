import sys
from playwright.sync_api import sync_playwright
import h
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=h.CHROME,args=['--no-sandbox']);pg=b.new_page();errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto('file://'+sys.argv[1]);pg.wait_for_timeout(800)
    if pg.query_selector('[data-a=ageYes]'):pg.click('[data-a=ageYes]');pg.wait_for_timeout(300)
    t=pg.inner_text('body');print('title',pg.title());print('creditos', 'VINCULAR' in t.upper(), '4484132' in t.replace(' ','').replace('-',''))
    print('hook',pg.evaluate('typeof window.__vb'));print('errs',errs)
    pg.evaluate("location.hash='#/acceso'");pg.wait_for_timeout(400);print('acceso:',pg.inner_text('body')[:160].replace('\n',' | '))
