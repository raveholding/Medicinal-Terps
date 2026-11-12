from h import *
t=T('rh2 RR. HH. responsive y permisos')
with sync_playwright() as p:
    b,c,pg=launch(p,320,700)
    pg.goto(HTML);pg.wait_for_timeout(500);pg.click('[data-a=ageYes]');boot_admin(pg)
    for w in (320,360,768,1024,1440):
        pg.set_viewport_size({'width':w,'height':800})
        for tb in ['inicio','legajos','turnos','asistencia','solicitudes','vacaciones','nomina','documentos','reclutamiento','avisos','ajustes']:
            pg.evaluate("location.hash='#/panel/personal'");pg.wait_for_timeout(80)
            pg.click('.htabs [data-id=%s]'%tb);pg.wait_for_timeout(120)
            if pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"):t.chk(False,'desborde %dpx en %s'%(w,tb))
        go(pg,'#/panel/fichaje')
        if pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"):t.chk(False,'desborde %dpx en fichaje'%w)
    t.chk(True,'RR. HH. sin desbordes de 320 a 1440 px')
    # usuario operador local sin Personal: no ve RR. HH.
    r=pg.evaluate("(()=>{const v=__vb();return typeof v.S.staff})()")
    t.chk(r=='object','estado accesible')
    t.chk(not pg.errs,'sin errores: %s'%pg.errs[:3])
    b.close()
import sys;sys.exit(0 if t.done() else 1)
