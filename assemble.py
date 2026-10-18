#!/usr/bin/env python3
"""Arma index.html (un solo archivo) a partir de src/*.js, qr.js, pre.html, assets/."""
import json,base64,hashlib,re,sys,glob,os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
cfg=json.load(open('config.json'))
out=sys.argv[1] if len(sys.argv)>1 else 'index.html'
# Sólo para pruebas locales: variables de entorno pisan la configuración (nunca se guardan en el repo)
if os.environ.get('LOCAL_ONLY'): cfg['supabase_url']=cfg['supabase_key']=''
for _k,_e in (('supabase_url','SUPA_URL'),('supabase_key','SUPA_KEY'),('google_client_id','GID')):
    if os.environ.get(_e): cfg[_k]=os.environ[_e]
def datauri(p,mime):
    return 'data:%s;base64,%s'%(mime,base64.b64encode(open(p,'rb').read()).decode())
assets={}
for p in sorted(glob.glob('assets/*.webp')):
    assets[os.path.basename(p)[:-5]]=datauri(p,'image/webp')
fav=datauri('assets/icon.png','image/png')
js=open('qr.js',encoding='utf8').read()+'\n'
for p in sorted(glob.glob('src/[1-9]*.js')):
    js+=open(p,encoding='utf8').read()
if os.environ.get('TEST_HOOKS'):
    assert js.rstrip().endswith('boot();\n\n})();') or 'boot();\n\n})();' in js
    js=js.replace('boot();\n\n})();','window.__vb=()=>({S,SES,DEV,META,PUB,POS,CL,sha256s,stable,auditVerify});boot();\n\n})();')
js=js.replace('__ASSETS__',json.dumps(assets,separators=(',',':')))
js=js.replace('__VERSION__',cfg['version'])
js=js.replace('__CREDITS__',json.dumps(cfg['credits'],ensure_ascii=False))
h=hashlib.sha256(js.encode('utf8')).digest()
csph="'sha256-%s'"%base64.b64encode(h).decode()
pre=open('pre.html',encoding='utf8').read()
post=open('post.html',encoding='utf8').read()
url=cfg['supabase_url'].rstrip('/')
sb=url if url else 'https://*.supabase.co'
gscript=" https://accounts.google.com/gsi/client"
csp=("default-src 'none'; script-src %s%s; style-src 'unsafe-inline' https://accounts.google.com/gsi/style; "
     "img-src 'self' data: blob:; font-src 'self'; "
     "connect-src 'self' %s https://www.googleapis.com https://accounts.google.com/gsi/; "
     "frame-src https://accounts.google.com/gsi/; base-uri 'none'; form-action 'none'")%(csph,gscript,sb)
pre=re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">','<meta http-equiv="Content-Security-Policy" content="%s">'%csp,pre)
pre=pre.replace('__FAVICON__',fav).replace('__AUTHOR__',cfg['credits']['name'])
site=cfg.get('site_url','')
if site:
    pre=re.sub(r'(rel="canonical" href=")[^"]*',r'\g<1>'+site,pre)
    pre=re.sub(r'(property="og:url" content=")[^"]*',r'\g<1>'+site,pre)
cfgjson=json.dumps({'url':url,'key':cfg['supabase_key'],'gid':cfg['google_client_id']})
pre=pre.replace('<script type="application/json" id="pubdata">','<script type="application/json" id="cfg">%s</script>\n<script type="application/json" id="pubdata">'%cfgjson,1)
open(out,'w',encoding='utf8').write(pre+'<script>'+js+post)
print('OK',out,len(pre)+len(js)+len(post),'bytes')
