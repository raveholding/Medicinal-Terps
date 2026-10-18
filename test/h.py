import sys,os,json,time,re
from playwright.sync_api import sync_playwright
CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
if not os.path.exists(CHROME):
    import glob
    c=glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'); CHROME=c[0] if c else None
import subprocess
_T=os.path.dirname(os.path.abspath(__file__))
def build(out='t.html',**env):
    e=dict(os.environ,TEST_HOOKS='1');e.update(env)
    r=subprocess.run(['python3',os.path.join(_T,'..','assemble.py'),os.path.join(_T,out)],env=e,capture_output=True,text=True)
    assert r.returncode==0,r.stderr
    return 'file://'+os.path.join(_T,out)
HTML=build()
class T:
    def __init__(s,name):
        s.name=name;s.ok=0;s.bad=[];
    def chk(s,cond,msg):
        if cond: s.ok+=1
        else: s.bad.append(msg);print('  FAIL:',msg)
    def done(s):
        print(f'[{s.name}] {s.ok} ok, {len(s.bad)} fail')
        return len(s.bad)==0
def launch(p,w=1280,h=900,url=None):
    b=p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':w,'height':h},accept_downloads=True)
    pg=ctx.new_page()
    errs=[]
    pg.on('pageerror',lambda e:errs.append('pageerror: '+str(e)))
    pg.on('console',lambda m:errs.append('console: '+m.text) if m.type=='error' else None)
    pg.errs=errs
    return b,ctx,pg
def toast(pg):
    return pg.evaluate("Array.from(document.querySelectorAll('.toast')).map(x=>x.textContent).join('|')")
def go(pg,hsh):
    pg.evaluate("location.hash=%s"%json.dumps(hsh));pg.wait_for_timeout(250)
def boot_admin(pg,url=None,name='Admin Prueba',user='admin',pw='Clave1234'):
    pg.goto(url or HTML);pg.wait_for_timeout(400)
    go(pg,'#/acceso')
    pg.fill('#su_n',name);pg.fill('#su_u',user);pg.fill('#su_p',pw);pg.fill('#su_p2',pw)
    pg.click('[data-a=doSetup]');pg.wait_for_selector('#rcv',timeout=15000)
    rc=pg.inner_text('#rcv');pg.check('#rcok');pg.click('[data-a=rcDone]');pg.wait_for_selector('#view',timeout=8000)
    return rc
