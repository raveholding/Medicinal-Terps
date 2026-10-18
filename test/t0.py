from h import *
t=T('t0 arranque')
with sync_playwright() as p:
    b,c,pg=launch(p)
    pg.goto(HTML);pg.wait_for_timeout(600)
    pg.click('[data-a=ageYes]');pg.wait_for_timeout(300)
    t.chk(pg.inner_text('h1').strip()!='','h1 público')
    rc=boot_admin(pg)
    t.chk(len(rc.replace('-',''))==20,'recovery code')
    t.chk(not pg.errs,'sin errores: %s'%pg.errs[:3])
    b.close()
import sys;sys.exit(0 if t.done() else 1)
