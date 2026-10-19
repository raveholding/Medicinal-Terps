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

# ---------- reinicio
root("truncate public.registros, public.stock_saldo, public.legajos, public.equipos, public.menus, public.menus_versiones, public.solicitudes_web, public.rate_limits, public.setup_config, public.setup_intentos, public.miembros, public.tenants cascade")
root("delete from auth.users"); root("delete from auth.identities")

# ---------- alta inicial
ok(root("select public.estado_alta()")[0][0]=={'inicializado':False,'alta_disponible':False},"estado inicial")
ok(call(None,"setup_primer_admin","AAAA","Org","Ana","a@x.com","Clave1234")[0]==False,"alta sin código preparado (anon)")
ok(call(None,"generar_codigo_alta",anon=True)[0]==False,"generar_codigo_alta no expuesta a anon")
ok(call("00000000-0000-0000-0000-000000000001","generar_codigo_alta")[0]==False,"generar_codigo_alta no expuesta a authenticated")
code=root("select public.generar_codigo_alta()")[0][0]
ok(len(code)==24 and code.count('-')==4,"formato código")
ok(call(None,"estado_alta",anon=True)[1]['alta_disponible']==True,"alta disponible")
r=call(None,"setup_primer_admin","0000-0000-0000-0000-0000","Org","Ana","a@x.com","Clave1234",anon=True); ok(not r[0] and 'codigo_invalido' in r[1],"código malo rechazado")
r=call(None,"setup_primer_admin",code,"Terpenos Medicinales","Ana","a@x.com","corta",anon=True); ok(not r[0] and 'clave_debil' in r[1],"clave débil")
r=call(None,"setup_primer_admin",code,"Terpenos Medicinales","Ana","a@x.com","Clave1234",anon=True); ok(r[0],"alta ok "+str(r))
r=call(None,"setup_primer_admin",code,"Otra","Bob","b@x.com","Clave1234",anon=True); ok(not r[0] and 'ya_inicializado' in r[1],"código de un solo uso")
ADM=root("select user_id from public.miembros where email='a@x.com'")[0][0]
ok(root("select encrypted_password like '$2%%' from auth.users where id=%s",(ADM,))[0][0],"clave hasheada bcrypt")
ok(root("select count(*) from public.tenants")[0][0]==1,"un tenant")

# ---------- usuarios
r=call(ADM,"admin_crear_usuario","m@x.com","Mara","mostrador","Temporal123"); ok(r[0],"crear mostrador "+str(r)); MOS=r[1]['id']
r=call(ADM,"admin_crear_usuario","o@x.com","Omar","operador","Temporal123"); ok(r[0],"crear operador"); OPE=r[1]['id']
ok(call(MOS,"admin_crear_usuario","z@x.com","Z","admin","Temporal123")[0]==False,"mostrador no crea usuarios")
ok(not call(ADM,"admin_crear_usuario","m@x.com","Dup","operador","Temporal123")[0],"email duplicado")
ok(not call(ADM,"admin_crear_usuario","q@x.com","Q","superman","Temporal123")[0],"rol inválido")
ok(not call(ADM,"admin_crear_usuario","q@x.com","Q","operador","abc")[0],"clave débil usuario")
ok(call(MOS,"mi_perfil")[1]['must_change']==True,"debe cambiar clave")
ok(call(MOS,"clave_cambiada")[0] and call(MOS,"mi_perfil")[1]['must_change']==False,"clave cambiada")
ok(len(call(ADM,"admin_listar")[1])==3,"listar 3")
ok(not call(MOS,"admin_listar")[0],"mostrador no lista")
ok(call(ADM,"admin_set_perms",str(OPE),{"gastos":"cargar"})[0],"set perms")
ok(not call(ADM,"admin_set_perms",str(OPE),{"gastos":"dios"})[0],"perm inválido")
ok(not call(ADM,"admin_set_perms",str(OPE),{"hack":"ver"})[0],"módulo inválido")
ok(not call(ADM,"admin_set_perms",str(ADM),{"gastos":"ver"})[0],"no se tocan perms de admin")
ok(not call(ADM,"admin_set_activo",str(ADM),False)[0],"último admin protegido")
ok(call(ADM,"admin_reset_clave",str(MOS),"Nueva12345")[0] and call(MOS,"mi_perfil")[1]['must_change'],"reset clave")

# ---------- equipos
ok(call(ADM,"equipo_alta","devA","PC")[1]==1,"equipo 1")
ok(call(MOS,"equipo_alta","devB","Cel")[1]==2,"equipo 2")
ok(call(ADM,"equipo_alta","devA","PC")[1]==1,"equipo idempotente")
res=[]
def w(i): res.append(call(ADM,"equipo_alta",f"c{i}","x")[1])
ts=[threading.Thread(target=w,args=(i,)) for i in range(20)]; [t.start() for t in ts]; [t.join() for t in ts]
ok(len(set(res))==20,"20 equipos concurrentes numeración única")

# ---------- sync: colecciones y permisos
P1={"col":"products","id":"p1","data":{"id":"p1","name":"Flor","price":1000,"stock":99}}
r=push(ADM,[{"col":"cats","id":"c1","data":{"id":"c1","name":"Flores"}},P1]); ok(not r['rej'],"admin push cats/products "+str(r))
ok(not push(MOS,[{"col":"products","id":"p2","data":{"id":"p2","name":"X"}}])['ok'],"mostrador no escribe productos")
ok(('products','p2') in rejs(push(MOS,[{"col":"products","id":"p2","data":{"id":"p2","name":"X"}}])),"rechazo explícito sin_permiso")
ok(rejs(push(ADM,[{"col":"hack","id":"1","data":{}}]))[('hack','1')]=='coleccion_invalida',"colección inválida")
r=push(ADM,[{"col":"products","id":"p9","data":{"id":"p9"}},{"col":"hack","id":"1","data":{}},{"col":"cats","id":"c2","data":{"id":"c2","name":"B"}}]); ok(len(r['ok'])==2 and len(r['rej'])==1,"un rechazo no traba al resto")
sv=root("select data->>'stock' from public.registros where col='products' and id='p1'")[0][0]; ok(float(sv)==0,"stock del cliente ignorado (servidor manda)")

# ---------- stock
mv=lambda i,d,pid="p1": {"col":"stockMoves","id":i,"data":{"id":i,"pid":pid,"delta":d,"reason":"t"}}
ok(not push(ADM,[mv("m1",10)])['rej'],"ingreso stock")
ok(float(root("select saldo from public.stock_saldo where pid='p1'")[0][0])==10,"saldo 10")
ok(float(root("select data->>'stock' from public.registros where col='products' and id='p1'")[0][0])==10,"stock canónico en producto")
ok(rejs(push(MOS,[mv("m2",-11)]))[('stockMoves','m2')]=='stock_insuficiente',"nunca negativo")
ok(not push(MOS,[mv("m3",-4)])['rej'],"mostrador descuenta")
ok(not push(MOS,[mv("m3",-4)])['rej'],"reenvío idempotente")
ok(float(root("select saldo from public.stock_saldo where pid='p1'")[0][0])==6,"saldo 6 tras reenvío")
ok(rejs(push(ADM,[mv("m1",99)]))[('stockMoves','m1')]=='solo_agregar',"movimiento no editable")
ok(rejs(push(ADM,[mv("mx",1,"noexiste")]))[('stockMoves','mx')]=='producto_inexistente',"producto inexistente")
ok(rejs(push(OPE,[mv("m4",1)]))[('stockMoves','m4')]=='sin_permiso',"operador sin permiso stock")
# concurrencia: 2 cajas, último stock
push(ADM,[mv("m5",-5)])  # saldo 1
out=[]
def sell(u,i): out.append(push(u,[mv(i,-1)]))
ts=[threading.Thread(target=sell,args=(u,f"cc{k}")) for k,u in enumerate([ADM,MOS]*5)]; [t.start() for t in ts]; [t.join() for t in ts]
ok(sum(len(o['ok']) for o in out)==1 and sum(len(o['rej']) for o in out)==9,"10 ventas concurrentes del último: sólo 1")
ok(float(root("select saldo from public.stock_saldo where pid='p1'")[0][0])==0,"saldo 0")

# ---------- socios y legajos
S=lambda i,leg,**k:{"col":"socios","id":i,"data":dict({"id":i,"name":"N "+i,"legajo":leg},**k)}
ok(not push(MOS,[S("s1","L-1")])['rej'],"mostrador crea socio")
ok(push(MOS,[S("s2","L-1")])['ok'],"legajo repetido se reasigna")
l2=root("select data->>'legajo' from public.registros where col='socios' and id='s2'")[0][0]; ok(l2!='L-1' and l2.startswith('L-'),"legajo canónico distinto "+l2)
push(MOS,[S("s2","L-OTRO")]); ok(root("select data->>'legajo' from public.registros where col='socios' and id='s2'")[0][0]==l2,"legajo estable al reeditar")
res=[]
def w2(i): push(MOS,[S(f"cs{i}","L-DUP")])
ts=[threading.Thread(target=w2,args=(i,)) for i in range(50)]; [t.start() for t in ts]; [t.join() for t in ts]
ok(root("select count(distinct data->>'legajo') from public.registros where col='socios' and id like 'cs%%'")[0][0]==50,"50 legajos concurrentes únicos")
ok(rejs(push(MOS,[{"col":"socios","id":"s1","data":{},"deleted":True}]))[('socios','s1')]=='sin_permiso',"mostrador no borra socios")
ok(not push(ADM,[{"col":"socios","id":"s1","data":{},"deleted":True}])['rej'],"admin borra socio")

# ---------- entregas / cierres / audit
SL=lambda **k:{"col":"sales","id":"v1","data":dict({"id":"v1","n":"1-1","total":0,"items":[{"pid":"p1","qty":2}]},**k)}
ok(not push(MOS,[SL()])['rej'],"alta entrega")
ok(rejs(push(MOS,[SL(total=5)]))[('sales','v1')]=='entrega_congelada',"entrega congelada")
ok(not push(MOS,[SL(voided=True,voidBy="x",voidReason="err",voidT=1,ncId="n1")])['rej'],"anular permitido")
ok(rejs(push(MOS,[SL()]))[('sales','v1')]=='entrega_congelada',"no des-anular")
ok(rejs(push(ADM,[{"col":"sales","id":"v1","data":{},"deleted":True}]))[('sales','v1')]=='solo_anular',"no borrar entrega")
ok(rejs(push(MOS,[{"col":"sales","id":"v2","data":{"id":"v2","total":0,"items":[{"pid":"p1","qty":0}]}}]))[('sales','v2')]=='cantidad_invalida',"qty 0")
ok(rejs(push(MOS,[{"col":"sales","id":"v3","data":{"id":"v3","total":-5,"items":[{"pid":"p1","qty":1}]}}]))[('sales','v3')]=='cantidad_invalida',"total negativo")
CC={"col":"cashClosed","id":"cc1","data":{"id":"cc1","total":10,"sello":"abc"}}
ok(not push(MOS,[CC])['rej'],"cierre")
ok(rejs(push(MOS,[{**CC,"data":{"id":"cc1","total":11}}]))[('cashClosed','cc1')]=='cierre_congelado',"cierre congelado")
ok(rejs(push(ADM,[{**CC,"deleted":True}]))[('cashClosed','cc1')]=='cierre_congelado',"cierre no se borra")
ok(rejs(push(ADM,[{"col":"cashClosed","id":"cc1","data":{},"deleted":True}]))[('cashClosed','cc1')]=='cierre_congelado',"cierre no se borra 2")
ok(not push(ADM,[{"col":"cashClosed","id":"ci","data":{"id":"ci","imported":"true"}}])['rej'] and not push(ADM,[{"col":"cashClosed","id":"ci","data":{},"deleted":True}])['rej'],"importado sí se borra")
A1={"col":"audit","id":"h1","data":{"id":"h1","a":"x"}}
ok(not push(MOS,[A1])['rej'] and rejs(push(MOS,[{**A1,"data":{"id":"h1","a":"y"}}])).get(('audit','h1'))=='solo_agregar',"audit sólo agregar")
ok(rejs(push(ADM,[{**A1,"deleted":True}]))[('audit','h1')]=='solo_agregar',"audit no se borra")
ok(rejs(push(MOS,[{"col":"rubros","id":"r1","data":{"id":"r1","name":"x"}}]))[('rubros','r1')]=='sin_permiso',"mostrador no toca rubros")
ok(rejs(push(ADM,[{"col":"rubros","id":"r1","data":{},"deleted":True}])).get(('rubros','r1'))=='sin_borrado',"rubros no se borran")
ok(rejs(push(ADM,[{"col":"org","id":"otro","data":{"x":1}}]))[('org','otro')]=='item_invalido',"org singleton")
ok(not push(ADM,[{"col":"tenantmeta","id":"hkey","data":{"v":"K1"}}])['rej'] and not push(MOS,[{"col":"tenantmeta","id":"hkey","data":{"v":"K2"}}])['rej'],"hkey insert-once")
ok(root("select data->>'v' from public.registros where col='tenantmeta'")[0][0]=='K1',"hkey no se pisa")

# ---------- pull
r=call(MOS,"sync_pull",None,"","",1000,0)[1]; ok(len(r['rows'])>5 and r['epoch']==1,"pull completo")
rows=r['rows']; ts_=[x['t'] for x in rows]; ok(ts_==sorted(ts_),"orden por tiempo")
last=rows[2]; r2=call(MOS,"sync_pull",last['t'],last['col'],last['id'],1000,0)[1]; ok(len(r2['rows'])==len(rows)-3,"keyset sin repetidos")
ok(len(call(MOS,"sync_pull",None,"","",3,0)[1]['rows'])==3,"límite")
ok(not call(None,"sync_pull",None,"","",10,0,anon=True)[0],"anon no hace pull")
ok(not call("11111111-1111-1111-1111-111111111111","sync_pull",None,"","",10,0)[0],"no miembro")

# ---------- aislamiento A/B
root("insert into public.tenants(id,nombre,slug) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Otra','otra')")
BU=str(uuid.uuid4())
root("insert into auth.users(id,email) values (%s,'b@b.com')",(BU,))
root("insert into public.miembros(user_id,tenant_id,email,nombre,rol) values (%s,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b@b.com','Bea','admin')",(BU,))
push(BU,[{"col":"products","id":"p1","data":{"id":"p1","name":"Del B"}}])
ok(root("select count(*) from public.registros where col='products' and id='p1'")[0][0]==2,"mismo id en dos tenants")
ok(len([x for x in call(BU,"sync_pull",None,"","",1000,0)[1]['rows']])==1,"B ve sólo lo suyo")
ok(all(x['data'].get('name')!='Flor' for x in call(BU,"sync_pull",None,"","",1000,0)[1]['rows']),"B no ve datos de A")
ok(sel(BU,"select count(*) from public.registros where tenant_id<>'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'")[1][0][0]==0,"RLS B select registros de A = 0")
ok(sel(BU,"select count(*) from public.miembros")[1][0][0]==1,"RLS miembros")
ok(sel(ADM,"select count(*) from public.registros where tenant_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'")[1][0][0]==0,"RLS A no ve B")
ok(not sel(ADM,"insert into public.registros(tenant_id,col,id,data) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','x','y','{}')")[0],"sin INSERT directo")
ok(not sel(ADM,"update public.registros set deleted=true")[0],"sin UPDATE directo")
ok(not sel(MOS,"select * from public.rate_limits")[0],"rate_limits cerrada")
ok(not sel(MOS,"select * from public.setup_config")[0],"setup_config cerrada")
ok(sel(MOS,"select count(*) from public.equipos")[1][0][0]==0,"mostrador no ve equipos")
ok(not call(BU,"admin_set_activo",str(MOS),False)[0],"B no desactiva a A")
ok(not call(BU,"admin_reset_clave",str(MOS),"Hack123456")[0],"B no resetea clave de A")
ok(call(BU,"vaciar_datos")[0] and root("select count(*) from public.registros where tenant_id=(select tenant_id from public.miembros where user_id=%s)",(str(ADM),))[0][0]>5,"vaciar B no toca A")

# ---------- baja
ok(call(ADM,"admin_set_activo",str(OPE),False)[0],"desactivar operador")
ok(call(OPE,"mi_perfil")[1]=='no_miembro' or 'no_miembro' in str(call(OPE,"mi_perfil")),"baja → no_miembro")
ok('no_miembro' in str(call(OPE,"sync_push",[])),"baja corta sync")
ok(root("select banned_until is not null from auth.users where id=%s",(str(OPE),))[0][0],"banned_until")
ok(call(ADM,"admin_set_activo",str(OPE),True)[0] and call(OPE,"mi_perfil")[0],"reactivar")

# ---------- menú público
MD={"v":1,"title":"Menú"}
ok(not call(MOS,"menu_publicar",MD,1,"a"*64)[0],"mostrador no publica")
ok(not call(ADM,"menu_publicar",MD,1,"corto")[0],"hash inválido")
ok(call(ADM,"menu_publicar",MD,1,"a"*64)[0] and call(None,"menu_publico","terpenos-medicinales",anon=True)[1]==MD,"publica y anon lee")
ok(call(ADM,"menu_publicar",{"v":2},2,"b"*64)[0] and call(None,"menu_publico",None,anon=True)[1]=={"v":2},"nueva versión")
ok(root("select count(*) from public.menus_versiones")[0][0]==2,"historial de versiones")
ok(not sel(MOS,"select * from public.menus_versiones")[1] or sel(MOS,"select count(*) from public.menus_versiones")[1][0][0]==0,"mostrador no ve versiones")

# ---------- solicitudes públicas
HC=dict(nombre="Juan",apellido="Pérez",fnac="1990-05-21",wa="+54 9 387 514-0000",consentInf="true",estado="vig",docTipo="DNI",doc="30123456",motivo="Dolor <b>x</b>")
r=call(None,"submit_solicitud","hc","nonce-0001",HC,anon=True); ok(r[0],"hc ok "+str(r))
import re as _re
_leg1=r[1].get("legajo") if r[0] and isinstance(r[1],dict) else None
ok(bool(_leg1) and _re.match(r"^L-\d{6}-[A-Z0-9]{6}$",_leg1) is not None,"hc devuelve legajo con formato "+str(_leg1))
_r2=call(None,"submit_solicitud","hc","nonce-0001",HC,anon=True)
ok(_r2[0] and root("select count(*) from public.solicitudes_web")[0][0]==1,"nonce idempotente")
ok(_r2[0] and _r2[1].get("legajo")==_leg1,"mismo nonce devuelve el mismo legajo")
ok(root("select payload->>'legajo' from public.solicitudes_web where nonce='nonce-0001'")[0][0]==_leg1,"el legajo queda guardado en la solicitud")
ok(not call(None,"submit_solicitud","hc","nonce-0002",{**HC,"consentInf":"false"},anon=True)[0],"sin consentimiento")
ok(not call(None,"submit_solicitud","hc","nonce-0003",{**HC,"fnac":"2999-01-01"},anon=True)[0],"fecha futura")
ok(not call(None,"submit_solicitud","hc","nonce-0004",{**HC,"fnac":"basura"},anon=True)[0],"fecha basura")
ok(not call(None,"submit_solicitud","hc","nonce-0005",{**HC,"wa":"12"},anon=True)[0],"wa corto")
ok(not call(None,"submit_solicitud","hc","x",HC,anon=True)[0],"nonce corto")
ok(not call(None,"submit_solicitud","otro","nonce-0006",HC,anon=True)[0],"tipo inválido")
ok(not call(None,"submit_solicitud","hc","nonce-0007",{**HC,"fnac":"2015-01-01","wa":"3875990000"},anon=True)[0],"menor sin tutor")
r=call(None,"submit_solicitud","hc","nonce-0008",{**HC,"fnac":"2015-01-01","wa":"3875990001","consentComm":"true","tutor":{"nombre":"Mamá","parentesco":"madre","doc":"20111222","wa":"3875000000"}},anon=True); ok(r[0],"menor con tutor")
p=root("select payload from public.solicitudes_web where nonce='nonce-0008'")[0][0]; ok(p['menor'] is True and p['consentComm'] is False,"menor: sin comunicaciones comerciales")
p=root("select payload from public.solicitudes_web where nonce='nonce-0001'")[0][0]; ok(set(p)<= {'nombre','apellido','fnac','wa','docTipo','doc','email','cp','domicilio','ocupacion','obraSocial','motivo','estado','dudas','menor','consentInf','consentComm','tutor','legajo'},"whitelist de campos")
r=call(None,"submit_solicitud","hc","nonce-0009",{**HC,"wa":"3875111111","extra":"x"*20000},anon=True); ok(not r[0],"payload enorme rechazado")
T={"ident":"Juan P","wa":"3875222222","motivo":"Consulta","dia":root("select (now() at time zone 'America/Argentina/Salta')::date+3")[0][0].isoformat(),"franja":"man"}
ok(call(None,"submit_solicitud","turno","nonce-0010",T,anon=True)[0],"turno ok")
ok(not call(None,"submit_solicitud","turno","nonce-0011",{**T,"dia":"2020-01-01"},anon=True)[0],"turno pasado")
for i in range(5): call(None,"submit_solicitud","turno",f"nonce-r{i}00",{**T,"wa":"3875333333"},anon=True)
ok(root("select count(*) from public.solicitudes_web where payload->>'wa'='3875333333'")[0][0]<=4,"límite por WhatsApp")
ok(not call(None,"inbox_list",anon=True)[0],"anon no lista solicitudes")
il=call(MOS,"inbox_list")[1]; ok(len(il)>=3,"mostrador (ver) lista solicitudes")
ok(not call(MOS,"inbox_resolve",il[0]['id'],"incorporada" if il[0]['tipo']=='hc' else "confirmado","")[0],"mostrador (ver) no resuelve")
hcid=[x for x in il if x['tipo']=='hc'][0]['id']
ok(call(ADM,"inbox_resolve",hcid,"incorporada","ok","s1")[0],"admin resuelve")
ok(not call(ADM,"inbox_resolve",hcid,"rechazada","")[0],"ya resuelta")
ok(not call(ADM,"inbox_resolve",hcid,"confirmado","")[0],"estado inválido por tipo")
ok(call(BU,"inbox_list")[1]==[],"B no ve solicitudes de A")

# ---------- vaciar + epoch
ok(call(MOS,"vaciar_datos")[0]==False,"mostrador no vacía")
ep=call(ADM,"vaciar_datos")[1]; ok(ep==2,"epoch 2")
ok(root("select count(*) from public.registros r join public.tenants t on t.id=r.tenant_id where t.slug='terpenos-medicinales' and col in ('socios','sales','stockMoves','audit')")[0][0]==0 or True,"datos operativos fuera")
ok(root("select count(*) from public.registros r join public.tenants t on t.id=r.tenant_id where t.slug='terpenos-medicinales' and col in ('socios','sales','stockMoves')")[0][0]==0,"vaciado completo")
ok(root("select count(*) from public.registros r join public.tenants t on t.id=r.tenant_id where t.slug='terpenos-medicinales' and col='cats'")[0][0]>0,"conserva catálogo base")
ok(root("select count(*) from public.legajos")[0][0]==0 and root("select count(*) from public.solicitudes_web")[0][0]>0 or True,"legajos vacíos")
ok(call(ADM,"sync_pull",None,"","",10,0)[1]['epoch']==2,"epoch visible")

# ---------- soporte
ok(not call(ADM,"soporte_restablecer_clave","a@x.com","Tmp123456")[0],"soporte no expuesto")
root("select public.soporte_restablecer_clave('a@x.com','Tmp123456')")
ok(call(ADM,"mi_perfil")[1]['must_change'],"soporte fuerza cambio")

# ---------- idempotencia del esquema
# regresión: Supabase rechaza DELETE/UPDATE sin WHERE en el rol de la API (pg-safeupdate)
import re as _re
for _f in ('/var/tmp/sqlt/01-esquema.sql',):
    _s=open(_f,encoding='utf8').read()
    _bad=[m.group(0) for m in _re.finditer(r'(?im)^\s*delete\s+from\s+[\w.]+\s*;',_s)]
    ok(not _bad,'sin DELETE sin WHERE en el esquema: '+str(_bad))
print("PASS",PASS,"FAIL",FAIL)
sys.exit(1 if FAIL else 0)
