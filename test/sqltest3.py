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

# ---------- migración 06: cobro completo, monedero, comprobantes, tarjeta del Club
import hmac,hashlib,time
root("truncate public.registros, public.stock_saldo, public.legajos, public.equipos, public.menus, public.menus_versiones, public.solicitudes_web, public.rate_limits, public.setup_config, public.setup_intentos, public.miembros, public.tenants, public.cobro_ops cascade")
root("delete from auth.users"); root("delete from auth.identities")
code=root("select public.generar_codigo_alta()")[0][0]
ok(call(None,"setup_primer_admin",code,"Terpenos","Ana","a@x.com","Clave1234",anon=True)[0],"alta")
ADM=root("select user_id from public.miembros where email='a@x.com'")[0][0]
MOS=call(ADM,"admin_crear_usuario","m@x.com","Mara","mostrador","Temporal123")[1]['id']
OPE=call(ADM,"admin_crear_usuario","o@x.com","Omar","operador","Temporal123")[1]['id']
push(ADM,[{"col":"org","id":"org","data":{"brand":"Terps","stampGoal":8,"stampReward":"Consulta","monedero":True,"niveles":{"on":True,"dias":90,"plata":5000,"oro":20000}}},
 {"col":"products","id":"p1","data":{"id":"p1","name":"Aceite","price":1000,"unit":"u","status":"activo"}}])
T0=int(time.time()*1000)
SL=lambda i,pays,**k:{"col":"sales","id":i,"data":dict({"id":i,"n":"1-"+i,"total":sum(p['a'] for p in pays),"items":[{"pid":"p1","qty":1}],"pays":pays,"t":T0},**k)}
R=lambda r,i:rejs(r).get(('sales',i))
# pago dividido
ok(not push(MOS,[SL("a1",[{"m":"efectivo","a":40000},{"m":"transferencia","a":20000,"det":{"ent":"Banco X","nro":"OP123456","fh":"2026-11-08T10:00"}}])])['rej'],"pago dividido válido (40.000 + 20.000)")
r=push(MOS,[{"col":"sales","id":"a2","data":{"id":"a2","n":"1-a2","total":60000,"items":[{"pid":"p1","qty":1}],"pays":[{"m":"efectivo","a":40000},{"m":"qr","a":10000}]}}])
ok(R(r,'a2')=='pago_no_cierra',"la suma de los medios no cierra: rechazada")
ok(R(push(MOS,[SL("a3",[{"m":"efectivo","a":100},{"m":"efectivo","a":100}])]),'a3')=='pago_invalido',"medio repetido: rechazado")
ok(R(push(MOS,[SL("a4",[{"m":"bitcoin","a":100}])]),'a4')=='pago_invalido',"medio desconocido: rechazado")
ok(R(push(MOS,[SL("a5",[{"m":"efectivo","a":0}])]),'a5')=='pago_invalido',"importe cero: rechazado")
ok(R(push(MOS,[SL("a6",[{"m":"efectivo","a":500},{"m":"cc","a":500}],socioId="s1",cc=100)]),'a6')=='pago_no_cierra',"parte a cuenta que no coincide: rechazada")
ok(not push(MOS,[SL("a7",[{"m":"efectivo","a":500},{"m":"cc","a":500}],socioId="s1",cc=500)])['rej'],"efectivo + cuenta corriente coincide")
# comprobante repetido y tarjeta completa
ok(R(push(MOS,[SL("b1",[{"m":"transferencia","a":100,"det":{"ent":"Y","nro":"op123456","fh":"2026-11-08T10:00"}}])]),'b1')=='comprobante_repetido',"mismo N.º de operación en otra entrega: rechazado")
ok(not push(MOS,[SL("b2",[{"m":"transferencia","a":100,"det":{"ent":"Y","nro":"op123456"},"dupOk":"duplicado autorizado"}])])['rej'],"duplicado autorizado (dupOk) se acepta")
ok(R(push(MOS,[SL("b3",[{"m":"debito","a":100,"det":{"brand":"Visa","last4":"4242","auth":"4111111111111111","cupon":"1"}}])]),'b3')=='dato_tarjeta',"número de tarjeta completo: rechazado")
ok(not push(MOS,[SL("b4",[{"m":"transferencia","a":100,"det":{"ent":"Z","nro":"4111111111111111"}}])])['rej'],"un N.º de operación largo no se confunde con una tarjeta")
ok(not push(MOS,[SL("a1",[{"m":"efectivo","a":40000},{"m":"transferencia","a":20000,"det":{"ent":"Banco X","nro":"OP123456","fh":"2026-11-08T10:00"}}])])["rej"],"reenvío idéntico de la entrega: idempotente")
# monedero
FM=lambda i,**k:{"col":"fidmov","id":i,"data":dict({"id":i,"tipo":"carga","socioId":"s9","monto":1000,"medio":"efectivo"},**k)}
ok(not push(MOS,[FM("f1")])['rej'],"carga de monedero")
ok(rejs(push(MOS,[FM("f1",monto=5)]))[('fidmov','f1')]=='solo_agregar',"una carga no se edita")
ok(rejs(push(ADM,[{"col":"fidmov","id":"f1","deleted":True}]))[('fidmov','f1')]=='solo_agregar',"una carga no se borra")
ok(rejs(push(MOS,[FM("f2",monto=-5)]))[('fidmov','f2')]=='cantidad_invalida',"carga negativa rechazada")
ok(rejs(push(MOS,[FM("f3",medio="cheque")]))[('fidmov','f3')]=='cantidad_invalida',"medio inválido rechazado")
ok(rejs(push(MOS,[FM("f4",tipo="ajuste",monto=-100,motivo="error")]))[('fidmov','f4')]=='sin_permiso',"el mostrador no ajusta el monedero")
ok(rejs(push(OPE,[FM("f5")]))[('fidmov','f5')]=='sin_permiso',"operador sin permiso no carga")
ok(rejs(push(MOS,[FM("f6",obs="tarjeta 4111 1111 1111 1111")]))[('fidmov','f6')]=='dato_tarjeta',"número de tarjeta en la observación: rechazado")
ok(R(push(MOS,[SL("m1",[{"m":"mon","a":1500}],socioId="s9")]),'m1')=='saldo_insuficiente',"gastar más saldo del que hay: rechazado")
ok(not push(MOS,[SL("m2",[{"m":"mon","a":600},{"m":"efectivo","a":400}],socioId="s9")])['rej'],"pagar 600 con monedero + 400 efectivo")
ok(float(root("select public._mon_saldo((select id from public.tenants limit 1),'s9')")[0][0])==400,"saldo restante 400")
ok(R(push(MOS,[SL("m3",[{"m":"mon","a":500}],socioId="s9")]),'m3')=='saldo_insuficiente',"segunda compra sin saldo suficiente: rechazada")
ok(R(push(MOS,[SL("m4",[{"m":"mon","a":100}])]),'m4')=='pago_invalido',"monedero sin persona: rechazado")
ok(rejs(push(ADM,[FM("f7",tipo="ajuste",monto=-500,motivo="corrección")]))[('fidmov','f7')]=='saldo_insuficiente',"ajuste que deja saldo negativo: rechazado")
ok(not push(ADM,[FM("f8",tipo="ajuste",monto=-400,motivo="corrección")])['rej'],"ajuste del administrador")
# anular devuelve el saldo
m2=root("select data from public.registros where col='sales' and id='m2'")[0][0]
m2.update(voided=True,voidReason="x",voidBy="Ana",voidT=1)
ok(not push(ADM,[{"col":"sales","id":"m2","data":m2}])['rej'],"anular la entrega pagada con monedero")
ok(float(root("select public._mon_saldo((select id from public.tenants limit 1),'s9')")[0][0])==600,"al anular vuelve el saldo (1000 − 400 de ajuste)")
# comprobante completado después (cobdet)
ok(not push(MOS,[SL("c1",[{"m":"qr","a":300,"sc":"se cayó el sistema"}])])['rej'],"cobro QR sin comprobante (autorizado)")
CD=lambda i,**k:{"col":"cobdet","id":i,"data":dict({"id":i,"saleId":"c1","idx":0,"ver":1,"det":{"prov":"Mercado Pago","txid":"TX9999"}},**k)}
ok(not push(MOS,[CD("d1")])['rej'],"se completa el comprobante")
ok(rejs(push(MOS,[CD("d1",ver=2)]))[('cobdet','d1')]=='solo_agregar',"el comprobante completado no se edita")
ok(not push(MOS,[SL("c2",[{"m":"qr","a":300,"sc":"x"}])])['rej'],"otro cobro sin comprobante")
ok(rejs(push(MOS,[CD("d2",saleId="c2")]))[('cobdet','d2')]=='comprobante_repetido',"el mismo ID de QR en otra entrega: rechazado")
ok(rejs(push(MOS,[CD("d3",saleId="nada")]))[('cobdet','d3')]=='item_invalido',"comprobante de una entrega inexistente: rechazado")
ok(rejs(push(MOS,[CD("d4",idx=5)]))[('cobdet','d4')]=='dato_invalido',"índice de pago inexistente: rechazado")
# tarjeta del Club
CID="Abc_def-1234567890";SEC="S"*32
def proof(card,sec,w):return hmac.new(sec.encode(),('estado|%s|%d'%(card,w)).encode(),hashlib.sha256).hexdigest()
W=int(time.time()*1000)//120000
ok(call(None,"club_estado",CID,W,proof(CID,SEC,W),anon=True)[1]['estado']=='desconocida',"tarjeta desconocida")
r=call(None,"submit_solicitud","hc","nonce12345",{"nombre":"Paula","apellido":"Paz","fnac":"1990-05-21","wa":"5493875001111","doc":"30111222","consentInf":True,"card":{"id":CID,"sec":SEC}},anon=True)
ok(r[0] and r[1]['ok'],"solicitud web con la tarjeta del celular")
ok(root("select payload->'card'->>'id' from public.solicitudes_web where nonce='nonce12345'")[0][0]==CID,"la tarjeta queda en la solicitud")
ok(call(None,"club_estado",CID,W,proof(CID,SEC,W),anon=True)[1]['estado']=='tramite',"mientras no se incorpora: en trámite")
ok(call(None,"club_estado",CID,W,proof(CID,"otro"*8,W),anon=True)[1]['estado']=='desconocida',"con otra clave: no muestra nada")
r=call(None,"submit_solicitud","hc","nonce99999",{"nombre":"Mini","apellido":"Paz","fnac":"2015-05-21","wa":"5493875002222","consentInf":True,"tutor":{"nombre":"Mamá Paz","wa":"5493875003333"},"card":{"id":"Zzz_def-1234567890","sec":SEC}},anon=True)
ok(r[0] and root("select payload ? 'card' from public.solicitudes_web where nonce='nonce99999'")[0][0] is False,"a un menor de edad no se le guarda tarjeta del Club")
push(ADM,[{"col":"socios","id":"s9","data":{"id":"s9","name":"Paula Paz","legajo":"L-261108-ABC234","doc":"30111222","wa":"5493875001111","stamps":["2026-11-01","2026-11-02","2026-11-03"],"redeemed":0,"card":{"id":CID,"sec":SEC}}}])
e=call(None,"club_estado",CID,W,proof(CID,SEC,W),anon=True)[1]
ok(e['estado']=='activa' and e['sellos']==3 and e['meta']==8 and e['premio']=='Consulta',"activa: sellos, meta y premio "+str(e))
ok(float(e['saldo'])==600 and e['nivel'] in ('Bronce','Plata','Oro'),"saldo del monedero y nivel")
ok('Paula' not in str(e) and '30111222' not in str(e) and '5493875001111' not in str(e) and SEC not in str(e),"sin nombre, documento, WhatsApp ni clave")
ok(call(None,"club_estado",CID,W-10,proof(CID,SEC,W-10),anon=True)[1]['estado']=='reloj',"firma de una ventana vieja: rechazada")
ok(call(None,"club_estado","x';--",W,"a"*64,anon=True)[1]['estado']=='invalida',"identificador inválido")
ok(not call(None,"_mon_saldo","00000000-0000-0000-0000-000000000000","s9",anon=True)[0],"funciones internas no expuestas al público")
print("PASS",PASS,"FAIL",FAIL);sys.exit(1 if FAIL else 0)
