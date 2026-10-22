import psycopg2, json, sys, threading, uuid
DSN="host=/tmp port=5544 dbname=vb user=postgres"
PASS=FAIL=0
def ok(c,msg):
    global PASS,FAIL
    if c: PASS+=1
    else: FAIL+=1; print("FAIL:",msg)
def conn():
    c=psycopg2.connect(DSN); c.autocommit=True; return c
def root(sql,args=None):
    c=conn(); cur=c.cursor(); cur.execute(sql,args)
    try: r=cur.fetchall()
    except Exception: r=None
    c.close(); return r
def call(uid,fn,*args,anon=False):
    """Ejecuta fn como 'authenticated' con auth.uid()=uid. Devuelve (ok,valor|error)"""
    c=conn(); cur=c.cursor()
    try:
        cur.execute("begin")
        cur.execute("set local role "+("anon" if anon or uid is None else "authenticated"))
        if uid: cur.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),))
        ph=",".join(["%s"]*len(args))
        cur.execute(f"select public.{fn}({ph})",[json.dumps(a) if isinstance(a,(dict,list)) else a for a in args])
        r=cur.fetchone()[0]; cur.execute("commit"); return True,r
    except Exception as e:
        try: cur.execute("rollback")
        except Exception: pass
        return False,str(e).split("\n")[0]
    finally: c.close()
def sel(uid,sql):
    c=conn(); cur=c.cursor()
    try:
        cur.execute("begin"); cur.execute("set local role authenticated")
        cur.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(uid),)); cur.execute(sql); r=cur.fetchall(); cur.execute("commit"); return True,r
    except Exception as e:
        return False,str(e).split("\n")[0]
    finally: c.close()
def push(uid,items):
    ok_,r=call(uid,"sync_push",items)
    return r if ok_ else {"err":r}
def rejs(r): return {(x['col'],x['id']):x['reason'] for x in r.get('rej',[])}

# ---------- reinicio y alta (base vacía + 01 + 02)
root("truncate public.registros, public.stock_saldo, public.legajos, public.equipos, public.menus, public.menus_versiones, public.solicitudes_web, public.rate_limits, public.setup_config, public.setup_intentos, public.miembros, public.tenants cascade")
root("delete from auth.users"); root("delete from auth.identities")
ok(call(None,"menu_publico",anon=True)[1] is None,"sin organización: menú público vacío (null)")
code=root("select public.generar_codigo_alta()")[0][0]
ok(call(None,"setup_primer_admin",code,"Terpenos","Ana","a@x.com","Clave1234",anon=True)[0],"alta")
ADM=root("select user_id from public.miembros where email='a@x.com'")[0][0]
MOS=call(ADM,"admin_crear_usuario","m@x.com","Mara","mostrador","Temporal123")[1]['id']
OPE=call(ADM,"admin_crear_usuario","o@x.com","Omar","operador","Temporal123")[1]['id']
# ---------- menú público: catálogo vivo hasta la primera publicación
ok(call(None,"menu_publico",anon=True)[1] is None,"sin datos de la organización todavía: null")
org={"nameCom":"Org Salta","brand":"Terps","nameLegal":"TERPENOS AC","cuit":"30-71932471-8","addr":"Calle 1","city":"Salta","hours":"10 a 13","wa":"549387","email":"x@y.z","slots":[[600,780]],"ejemplo":False,"pinHash":"SECRETO","drive":{"email":"interno@x"}}
push(ADM,[{"col":"org","id":"org","data":org},{"col":"cats","id":"c1","data":{"id":"c1","name":"Aceites"}},
 {"col":"products","id":"p1","data":{"id":"p1","name":"Aceite","cat":"c1","price":38000,"cost":21000,"unit":"u","pub":True,"status":"activo","img":"asset:oil","barcode":"779","rp":True}},
 {"col":"products","id":"p2","data":{"id":"p2","name":"Oculto","cat":"c1","price":1,"cost":1,"unit":"u","pub":False,"status":"activo"}},
 {"col":"products","id":"p3","data":{"id":"p3","name":"Viejo","cat":"c1","price":1,"cost":1,"unit":"u","pub":True,"status":"discontinuado"}},
 {"col":"menuCfg","id":"menuCfg","data":{"blocks":[{"id":"cat","on":True},{"id":"hc","on":True}],"texts":{"es":{},"en":{}},"catFirst":True}}])
push(ADM,[{"col":"stockMoves","id":"m1","data":{"id":"m1","pid":"p1","delta":5}}])
r=call(None,"menu_publico",anon=True); m=r[1]
ok(r[0] and m and m.get('auto') is True,"sin publicar: el sitio recibe el catálogo vivo")
ok([p['id'] for p in m['products']]==['p1'],"sólo productos publicados y no discontinuados: "+str([p['id'] for p in m['products']]))
pr=m['products'][0]
ok(set(pr.keys())=={'id','name','cat','desc','price','unit','img','soldout','rp','mem'} and pr['soldout'] is False,"producto sin costo, stock exacto ni código: "+str(sorted(pr.keys())))
ok('cost' not in str(m) and 'SECRETO' not in str(m) and 'interno@x' not in str(m) and '779' not in str(m),"no se filtran costo, PIN, Drive ni código de barras")
ok(m['org']['name']=='Org Salta' and m['menu']['catFirst'] is True and m['cats'][0]['name']=='Aceites',"datos públicos de la organización y menú")
push(MOS,[{"col":"stockMoves","id":"m2","data":{"id":"m2","pid":"p1","delta":-5}}])
ok(call(None,"menu_publico",anon=True)[1]['products'][0]['soldout'] is True,"sin stock: figura «sin stock»")
ok(call(ADM,"menu_publicar",{"v":2,"products":[],"org":{"name":"Publicado"}},1,"a"*64)[0],"publicar")
ok(call(None,"menu_publico",anon=True)[1]['org']['name']=='Publicado',"publicado: manda la versión publicada")
# ---------- cuenta corriente: pagos sólo agregar
SL=lambda i,**k:{"col":"sales","id":i,"data":dict({"id":i,"n":"1-"+i,"total":1000,"items":[{"pid":"p1","qty":1}]},**k)}
ok(not push(MOS,[SL("v1",cc=400,socioId="s1")])['rej'],"entrega con parte a cuenta corriente")
ok(rejs(push(MOS,[SL("v2",cc=1500,socioId="s1")]))[('sales','v2')]=='cantidad_invalida',"cc mayor que la donación: rechazada")
ok(rejs(push(MOS,[SL("v3",cc=100)]))[('sales','v3')]=='cantidad_invalida',"cc sin persona: rechazada")
ok(rejs(push(MOS,[SL("v4",cc=-1,socioId="s1")]))[('sales','v4')]=='cantidad_invalida',"cc negativa: rechazada")
ok(rejs(push(MOS,[SL("v1",cc=0,socioId="s1")]))[('sales','v1')]=='entrega_congelada',"la parte a cuenta no se edita después")
PG=lambda i,**k:{"col":"pagos","id":i,"data":dict({"id":i,"tipo":"cobro","socioId":"s1","monto":300,"medio":"efectivo"},**k)}
ok(not push(MOS,[PG("g1")])['rej'],"mostrador registra pago a la cuenta")
ok(not push(MOS,[PG("g1")])['rej'],"reenvío idéntico idempotente")
ok(rejs(push(MOS,[PG("g1",monto=999)]))[('pagos','g1')]=='solo_agregar',"un pago no se edita")
ok(rejs(push(ADM,[{"col":"pagos","id":"g1","deleted":True}]))[('pagos','g1')]=='solo_agregar',"un pago no se borra (ni el admin)")
ok(rejs(push(MOS,[PG("g2",monto=0)]))[('pagos','g2')]=='cantidad_invalida',"importe 0 rechazado")
ok(rejs(push(MOS,[PG("g3",socioId="")]))[('pagos','g3')]=='cantidad_invalida',"pago sin persona rechazado")
ok(rejs(push(MOS,[PG("g4",tipo="regalo")]))[('pagos','g4')]=='cantidad_invalida',"tipo inválido rechazado")
ok(rejs(push(OPE,[PG("g5")]))[('pagos','g5')]=='sin_permiso',"operador sin permiso de Dispensar no registra pagos")
ok(not push(ADM,[PG("g6",tipo="anulacion",ref="g1")])['rej'],"anulación como registro nuevo")
# ---------- documentos del legajo
D=lambda i,**k:{"col":"legDocs","id":i,"data":dict({"id":i,"socioId":"s1","legajo":"L-1","tipo":"DNI","hash":"a"*64,"estado":"pendiente"},**k)}
ok(not push(MOS,[D("d1")])['rej'],"mostrador registra documento")
ok(not push(MOS,[D("d1",estado="subido",fileId="f1")])['rej'],"el registro pasa a «subido»")
ok(rejs(push(MOS,[D("d2",b64="x"*30000)]))[('legDocs','d2')]=='dato_invalido',"no se acepta el archivo en la base (sólo el registro)")
ok(rejs(push(OPE,[D("d3")]))[('legDocs','d3')]=='sin_permiso',"operador (socios: ver) no carga documentos")
# ---------- aislamiento entre organizaciones
root("insert into public.tenants(id,nombre,slug) values ('00000000-0000-0000-0000-0000000000bb','B','org-b')")
root("insert into auth.users(id,email,encrypted_password) values ('00000000-0000-0000-0000-0000000000b1','b@x.com','x')")
root("insert into public.miembros(user_id,tenant_id,email,nombre,rol) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000bb','b@x.com','B','admin')")
BU='00000000-0000-0000-0000-0000000000b1'
r=call(BU,"sync_pull",None,"","",500,0); ok(r[0] and not any(x['col'] in ('pagos','legDocs') for x in r[1]['rows']),"otra organización no ve pagos ni documentos")
ok(call(None,"menu_publico","org-b",anon=True)[1] is None,"menú de otra organización (sin datos) vacío")
# ---------- vaciar datos incluye las colecciones nuevas
ok(call(ADM,"vaciar_datos")[0],"vaciar datos")
ok(root("select count(*) from public.registros where col in ('pagos','legDocs') and tenant_id<>'00000000-0000-0000-0000-0000000000bb'")[0][0]==0,"vaciar borra pagos y documentos")
# ---------- idempotencia de la migración
import subprocess
r=subprocess.run(['su','postgres','-c','/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -q -v ON_ERROR_STOP=1 -f /var/tmp/sqlt/02-cuenta-corriente-legajos-menu.sql'],capture_output=True,text=True)
ok(r.returncode==0,"la migración 02 se puede volver a ejecutar: "+r.stderr[-200:])
print("PASS",PASS,"FAIL",FAIL)
sys.exit(1 if FAIL else 0)
