"""d1 · función de servidor «drive-legajos» (con Google falso) contra el Postgres local por el shim:
permisos por rol, conexión OAuth con state firmado, token en la bóveda, carpeta idempotente, hoja con alta y
actualización, subida con huella (sin duplicar), aislamiento entre organizaciones, revocación y errores.
Requiere shim.py (54321) y drivefn_server.mjs (54399) corriendo."""
import subprocess,json,urllib.request,urllib.error,base64,hashlib,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from h import T
B='http://127.0.0.1:54321';FN=B+'/functions/v1/drive-legajos';G='http://127.0.0.1:54399/__g/'
def psql(sql):
    r=subprocess.run(['su','postgres','-c',f'/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -At -c "{sql}"'],capture_output=True,text=True);return r.stdout.strip()
def req(url,body=None,tok=None,method='POST',hdr=None):
    h={'content-type':'application/json','apikey':'sb_publishable_TESTKEY'}
    if tok:h['authorization']='Bearer '+tok
    if hdr:h.update(hdr)
    r=urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers=h,method=method)
    class NR(urllib.request.HTTPRedirectHandler):
        def redirect_request(s,*a,**k):return None
    op=urllib.request.build_opener(NR)
    try:
        x=op.open(r,timeout=30);t=x.read().decode();return x.status,(json.loads(t) if t and t[0] in '{[' else t),dict(x.headers)
    except urllib.error.HTTPError as e:
        t=e.read().decode();
        try:return e.code,json.loads(t),dict(e.headers)
        except Exception:return e.code,t,dict(e.headers)
def login(email,pw):
    s,j,_=req(B+'/auth/v1/token?grant_type=password',{'email':email,'password':pw});assert s==200,j;return j['access_token']
def rpc(fn,args,tok=None):return req(B+'/rest/v1/rpc/'+fn,args,tok)
def fn(body,tok,origin='null'):return req(FN,body,tok,hdr={'origin':origin})
t=T('d1 función drive-legajos')
subprocess.run(['/var/tmp/sqlt/reset.sh'],check=True,capture_output=True)
req(G+'reset',{})
code=psql("select public.generar_codigo_alta()")
s,j,_=rpc('setup_primer_admin',{'p_codigo':code,'p_org':'Medicinal Terps','p_nombre':'Ana','p_email':'ana@terps.test','p_pass':'Clave1234'});t.chk(s==200,'alta admin '+str(j))
A=login('ana@terps.test','Clave1234')
s,j,_=rpc('admin_crear_usuario',{'p_email':'mo@terps.test','p_nombre':'Mo','p_rol':'mostrador','p_pass':'Clave1234'},A);t.chk(s==200,'alta mostrador')
s,j,_=rpc('admin_crear_usuario',{'p_email':'op@terps.test','p_nombre':'Op','p_rol':'operador','p_pass':'Clave1234'},A)
psql("update public.miembros set must_change=false")
M=login('mo@terps.test','Clave1234');O=login('op@terps.test','Clave1234')
# sin sesión, CORS y método
s,j,h=fn({'accion':'estado'},None);t.chk(s==401,'sin sesión → 401')
s,j,h=fn({'accion':'estado'},A);t.chk(s==200 and j['configurado'] and not j['conectado'],'estado: configurado y sin conectar '+str(j))
t.chk(h.get('access-control-allow-origin')=='null','CORS para origen permitido')
s,j,h=fn({'accion':'estado'},A,origin='https://malo.example');t.chk('access-control-allow-origin' not in {k.lower() for k in h},'CORS: origen ajeno sin permiso')
s,j,_=req(FN,None,A,method='PUT');t.chk(s==405,'método no permitido')
s,j,_=fn({'accion':'carpeta','legajo':'L-261102-ABC234'},M);t.chk(s==503 and j.get('codigo')=='sin_conectar','sin conectar → 503 sin_conectar')
# conectar: sólo admin
s,j,_=fn({'accion':'conectar'},M);t.chk(s==403,'mostrador no conecta')
s,j,_=fn({'accion':'conectar'},A);t.chk(s==200 and j['url'].startswith('https://accounts.google.com/'),'admin obtiene dirección de Google')
url=j['url']
s,a,_=req(G+'autorizar',{'url':url})
t.chk(a['redirect']==B+'/functions/v1/drive-legajos' and 'drive.file' in a['scope'] and 'drive ' not in a['scope']+' ' ,'redirect y alcance mínimo drive.file: '+a['scope'])
# state alterado
st=a['state'];bad=st[:-2]+('AA' if not st.endswith('AA') else 'BB')
s,j,_=req(FN+'?code='+a['code']+'&state='+bad,None,method='GET');t.chk('error' in str(j),'state alterado rechazado')
t.chk(psql("select count(*) from public.drive_conexion")=='0','sin conexión guardada tras state alterado')
s,j,_=req(FN+'?code='+a['code']+'&state='+st,None,method='GET');t.chk(s==200 and '(ok)' in str(j),'vuelta de Google: ok '+str(j))
t.chk(psql("select count(*) from public.drive_conexion where cuenta='medicinalterps@gmail.com'")=='1','conexión guardada con la cuenta')
t.chk(psql("select count(*) from public.drive_conexion where secreto_id is not null")=='1' and psql("select count(*) from vault.secrets where secret like 'rt-%'")=='1','token en la bóveda, no en la tabla')
t.chk(psql("select count(*) from public.drive_eventos where evento='conectado'")=='1','evento de conexión registrado')
# el navegador no puede leer la conexión ni el token
s,j,_=rpc('drive_leer',{'p_tenant':psql("select id from public.tenants limit 1")},A);t.chk(s in (401,403,400) or j is None,'drive_leer denegado al usuario: '+str(s))
s,j,_=req(B+'/rest/v1/rpc/drive_leer',{'p_tenant':psql("select id from public.tenants limit 1")});t.chk(s!=200,'drive_leer denegado a anónimo')
s,j,_=fn({'accion':'estado'},M);t.chk(s==200 and j['conectado'] and j['cuenta']=='medicinalterps@gmail.com' and 'token' not in json.dumps(j),'estado conectado sin tokens para el mostrador')
# carpeta: niveles
LEG='L-261102-ABC234'
s,j,_=fn({'accion':'carpeta','legajo':LEG,'dni':'30.222.333'},O);t.chk(s==403,'operador (ver) no crea carpetas')
s,j,_=fn({'accion':'carpeta','legajo':'X-1','dni':''},M);t.chk(s==400,'legajo inválido')
s,j,_=fn({'accion':'carpeta','legajo':LEG,'dni':'30.222.333'},M);t.chk(s==200 and j['creada'],'mostrador crea carpeta '+str(j))
c1=j['carpeta']
s,j,_=fn({'accion':'carpeta','legajo':LEG,'dni':'30222333'},A);t.chk(s==200 and not j['creada'] and j['carpeta']==c1,'carpeta idempotente')
_,g,_=req(G+'state',None,method='GET')
names=sorted(f['name'] for f in g['files']);t.chk(names==['L-261102-ABC234_30222333','Legajos · Medicinal Terps'],'nombres de carpetas '+str(names))
t.chk(psql("select carpeta_raiz_id is not null from public.drive_conexion")=='t','raíz guardada')
s,j,_=fn({'accion':'carpeta','legajo':'L-261102-ZZZ999','dni':''},M);t.chk(s==200 and j['creada'],'legajo sin documento')
_,g,_=req(G+'state',None,method='GET');t.chk(any(f['name']=='L-261102-ZZZ999_SD' for f in g['files']),'carpeta _SD')
# hoja
fila=[LEG,'02/11/2026','Cuenta, Paula','DNI 30222333','5493875009999','1990-05-21','web','vigente','completo','sí','','']
s,j,_=fn({'accion':'hoja','legajo':LEG,'fila':fila[:5]},M);t.chk(s==422,'fila incompleta rechazada')
s,j,_=fn({'accion':'hoja','legajo':LEG,'fila':['L-OTRO']+fila[1:]},M);t.chk(s==422,'fila de otro legajo rechazada')
f2=list(fila);f2[2]='=HYPERLINK("http://malo")'
s,j,_=fn({'accion':'hoja','legajo':LEG,'fila':f2},M);t.chk(s==200 and j['nueva'],'fila nueva '+str(j))
s,j,_=fn({'accion':'hoja','legajo':LEG,'fila':fila},M);t.chk(s==200 and not j['nueva'],'fila actualizada (no duplica)')
_,g,_=req(G+'state',None,method='GET');rows=list(g['sheets'].values())[0]
t.chk(len(rows)==2 and rows[0][0]=='Legajo' and rows[1][2]=='Cuenta, Paula' and rows[1][10].startswith('https://drive.google.com/'),'hoja: encabezado + 1 fila con enlace a la carpeta '+str(rows[1][:3]))
s,j,_=fn({'accion':'hoja','legajo':'L-261102-ZZZ999','fila':['L-261102-ZZZ999','','=1+1','','','','','','','','','']},M)
_,g,_=req(G+'state',None,method='GET');rows=list(g['sheets'].values())[0]
t.chk(len(rows)==3 and rows[2][2]=="'=1+1",'fórmula neutralizada en la hoja')
t.chk(sum(1 for f in g['files'] if f['mimeType'].endswith('spreadsheet'))==1,'una sola hoja de legajos')
# subir
pdf=b'%PDF-1.4 documento de prueba\n%%EOF';h=hashlib.sha256(pdf).hexdigest();b64=base64.b64encode(pdf).decode()
nom=LEG+'_REPROCANN_20261102_v1_'+h[:8]+'.pdf'
s,j,_=fn({'accion':'subir','legajo':LEG,'dni':'30222333','nombre':nom,'mime':'text/html','b64':b64,'hash':h},M);t.chk(s==422,'tipo de archivo no permitido')
s,j,_=fn({'accion':'subir','legajo':LEG,'dni':'30222333','nombre':nom,'mime':'application/pdf','b64':b64,'hash':'0'*64},M);t.chk(s==422,'huella distinta rechazada')
s,j,_=fn({'accion':'subir','legajo':LEG,'dni':'30222333','nombre':'otro.pdf','mime':'application/pdf','b64':b64,'hash':h},M);t.chk(s==422,'nombre fuera del legajo rechazado')
s,j,_=fn({'accion':'subir','legajo':LEG,'dni':'30222333','nombre':nom,'mime':'application/pdf','b64':b64,'hash':h,'tipo':'REPROCANN','version':1},M)
t.chk(s==200 and not j['repetido'] and j['carpeta']==c1,'subida a la carpeta del legajo '+str(j))
s,j,_=fn({'accion':'subir','legajo':LEG,'dni':'30222333','nombre':nom,'mime':'application/pdf','b64':b64,'hash':h,'tipo':'REPROCANN','version':1},M)
t.chk(s==200 and j['repetido'],'misma huella: no se duplica')
_,g,_=req(G+'state',None,method='GET');up=[f for f in g['files'] if f['mimeType']=='application/pdf']
t.chk(len(up)==1 and up[0]['size']==len(pdf) and up[0]['parents']==[c1],'archivo íntegro en la carpeta correcta')
s,j,_=fn({'accion':'subir','legajo':LEG,'nombre':nom,'mime':'application/pdf','b64':'A'*(15*1024*1024)},M);t.chk(s==413,'más de 10 MB → 413')
# otra organización no ve la conexión
psql("insert into public.tenants(id,nombre,slug) values ('00000000-0000-0000-0000-0000000000bb','Otra ONG','otra-ong')")
psql("insert into auth.users(id,email,encrypted_password,aud,role) values ('00000000-0000-0000-0000-00000000b0b0','b@otra.test',extensions.crypt('Clave1234',extensions.gen_salt('bf')),'authenticated','authenticated')")
psql("insert into public.miembros(user_id,tenant_id,email,nombre,rol) values ('00000000-0000-0000-0000-00000000b0b0','00000000-0000-0000-0000-0000000000bb','b@otra.test','Beto','admin')")
X=login('b@otra.test','Clave1234')
s,j,_=fn({'accion':'estado'},X);t.chk(s==200 and not j['conectado'] and j['cuenta']=='','otra organización: sin conexión ni cuenta ajena '+str(j))
s,j,_=fn({'accion':'carpeta','legajo':LEG},X);t.chk(s==503,'otra organización no usa el Drive ajeno')
# usuario dado de baja
psql("update public.miembros set activo=false where email='op@terps.test'")
s,j,_=fn({'accion':'estado'},O);t.chk(s==403,'usuario inactivo → 403 ('+str(s)+')')
# permiso revocado en Google
req(G+'mode',{'mode':'invalid_grant'})
s,j,_=fn({'accion':'carpeta','legajo':LEG},M);t.chk(s==409 and j.get('codigo')=='reconectar','permiso revocado en Google → reconectar')
req(G+'mode',{'mode':'ok'})
# desconectar
s,j,_=fn({'accion':'desconectar'},M);t.chk(s==403,'mostrador no desconecta')
s,j,_=fn({'accion':'desconectar'},A);t.chk(s==200,'admin desconecta')
_,g,_=req(G+'state',None,method='GET');t.chk(g['revoked']==1,'permiso revocado en Google')
t.chk(psql("select count(*) from public.drive_conexion where conectado_at is null and cuenta is null")=='1' and psql("select count(*) from vault.secrets where secret like 'rt-%'")=='0','conexión cerrada y secreto sobrescrito')
t.chk(psql("select count(*) from public.drive_eventos where evento='desconectado'")=='1','evento de desconexión')
_,g,_=req(G+'state',None,method='GET');t.chk(len(g['files'])>=4,'los archivos en Drive no se borran')
# vuelta sin permiso permanente
s,j,_=fn({'accion':'conectar'},A);_,a,_=req(G+'autorizar',{'url':j['url'],'offline':False})
s,j,_=req(FN+'?code='+a['code']+'&state='+a['state'],None,method='GET');t.chk('sin_permiso_offline' in str(j),'sin permiso permanente → aviso')
s,j,_=fn({'accion':'conectar'},A);_,a,_=req(G+'autorizar',{'url':j['url'],'scope':'openid email'})
s,j,_=req(FN+'?code='+a['code']+'&state='+a['state'],None,method='GET');t.chk('sin_drive' in str(j),'sin permiso de Drive → aviso')
s,j,_=req(FN+'?error=access_denied',None,method='GET');t.chk('cancelado' in str(j),'cancelado por la persona')
# sin credenciales en el servidor
req(G+'unconfig',{'k':'GOOGLE_OAUTH_CLIENT_SECRET'})
s,j,_=fn({'accion':'estado'},A);t.chk(s==200 and not j['configurado'],'sin credenciales: «pendiente de configuración»')
s,j,_=fn({'accion':'conectar'},A);t.chk(s==503 and j.get('codigo')=='config','conectar sin credenciales → 503 config')
req(G+'reconfig',{'k':'GOOGLE_OAUTH_CLIENT_SECRET'})
sys.exit(0 if t.done() else 1)
