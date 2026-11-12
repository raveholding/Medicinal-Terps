"""Migración 07 · Recursos Humanos: colecciones nuevas y permisos del portal del empleado."""
exec(open('sqltest3.py').read().split('# ---------- migración 06')[0])
root("truncate public.registros, public.stock_saldo, public.legajos, public.equipos, public.menus, public.menus_versiones, public.solicitudes_web, public.rate_limits, public.setup_config, public.setup_intentos, public.miembros, public.tenants, public.cobro_ops cascade")
root("delete from auth.users"); root("delete from auth.identities")
code=root("select public.generar_codigo_alta()")[0][0]
ok(call(None,"setup_primer_admin",code,"Terpenos","Ana","a@x.com","Clave1234",anon=True)[0],"alta")
ADM=root("select user_id from public.miembros where email='a@x.com'")[0][0]
MOS=call(ADM,"admin_crear_usuario","m@x.com","Mara","mostrador","Temporal123")[1]['id']
OPE=call(ADM,"admin_crear_usuario","o@x.com","Omar","operador","Temporal123")[1]['id']
SUP=call(ADM,"admin_crear_usuario","s@x.com","Sole","operador","Temporal123")[1]['id']
ok(call(ADM,"admin_set_perms",SUP,{"personal":"cargar"})[0],"supervisor con Personal: cargar")
rj=lambda r:{(x['col'],x['id']):x['reason'] for x in r.get('rej',[])}
# colecciones de RR. HH. (módulo personal)
r=push(ADM,[{"col":"staff","id":"f1","data":{"id":"f1","name":"Juan"}},{"col":"hrShifts","id":"sh1","data":{"id":"sh1","staffId":"f1","day":"2026-11-12","from":"10:00","to":"18:00"}},
 {"col":"hrDocs","id":"d1","data":{"id":"d1","staffId":"f1","kind":"contrato","exp":"2026-12-01"}},{"col":"hrPays","id":"py1","data":{"id":"py1","staffId":"f1","period":"2026-11","net":1000}},
 {"col":"hrJobs","id":"j1","data":{"id":"j1","title":"Cultivo"}},{"col":"hrCands","id":"c1","data":{"id":"c1","jobId":"j1","name":"Ana"}},{"col":"hrMsgs","id":"m1","data":{"id":"m1","to":"all","text":"Hola"}}])
ok(not r.get('rej') and not r.get('err'),"el administrador sube todas las colecciones de RR. HH.: %s"%r)
r=push(MOS,[{"col":"hrShifts","id":"sh2","data":{"id":"sh2","staffId":"f1","day":"2026-11-13"}},{"col":"hrPays","id":"py2","data":{"id":"py2","staffId":"f1"}},{"col":"hrMsgs","id":"m2","data":{"id":"m2","text":"x"}}])
ok(all(v=='sin_permiso' for v in rj(r).values()) and len(rj(r))==3,"mostrador (sin Personal) no escribe turnos, nómina ni avisos")
ok(not push(SUP,[{"col":"hrShifts","id":"sh3","data":{"id":"sh3","staffId":"f1","day":"2026-11-14"}}]).get('rej'),"supervisor carga turnos")
ok(rj(push(SUP,[{"col":"hrShifts","id":"sh3","deleted":True}])).get(('hrShifts','sh3'))=='sin_permiso',"borrar exige Gestionar")
ok(not push(ADM,[{"col":"hrShifts","id":"sh3","deleted":True}]).get('rej'),"el administrador borra un turno")
# portal del empleado desde el kiosco (sesión de mostrador)
RQ=lambda i,**k:{"col":"hrReqs","id":i,"data":dict({"id":i,"staffId":"f1","type":"licencia","from":"2026-11-20","to":"2026-11-21","state":"pendiente","steps":[]},**k)}
ok(not push(MOS,[RQ("r1")]).get('rej'),"el kiosco (mostrador) crea una solicitud pendiente")
ok(not push(MOS,[RQ("r1")]).get('rej'),"reenvío idéntico: idempotente")
ok(rj(push(MOS,[RQ("r1",state="aprobada",steps=[{"ok":True}])])).get(('hrReqs','r1'))=='sin_permiso',"el kiosco no puede aprobarla")
ok(rj(push(MOS,[RQ("r2",state="aprobada")])).get(('hrReqs','r2'))=='sin_permiso',"el kiosco no crea solicitudes ya aprobadas")
ok(rj(push(MOS,[RQ("r3",steps=[{"ok":True}])])).get(('hrReqs','r3'))=='sin_permiso',"ni con pasos de aprobación")
ok(rj(push(MOS,[{"col":"hrReqs","id":"r1","deleted":True}])).get(('hrReqs','r1'))=='solo_agregar',"no se borran solicitudes")
ok(rj(push(MOS,[{"col":"hrReqs","id":"r4","data":{"id":"r4","state":"pendiente"}}])).get(('hrReqs','r4'))=='dato_invalido',"sin empleado: inválida")
ok(not push(SUP,[RQ("r1",state="pendiente",steps=[{"lvl":"supervisor","ok":True}])]).get('rej'),"el supervisor aprueba su paso")
ok(not push(ADM,[RQ("r1",state="aprobada",steps=[{"lvl":"supervisor","ok":True},{"lvl":"admin","ok":True}])]).get('rej'),"el administrador aprueba el último paso")
ok(rj(push(OPE,[RQ("r5")])).get(('hrReqs','r5'))=='sin_permiso',"operador sin Caja ni Personal: no crea solicitudes")
RD=lambda i,**k:{"col":"hrReads","id":i,"data":dict({"id":i,"msgId":"m1","staffId":"f1","t":1},**k)}
ok(not push(MOS,[RD("m1_f1")]).get('rej'),"el kiosco marca un aviso como leído")
ok(not push(MOS,[RD("m1_f1",t=2)]).get('rej'),"una segunda lectura no pisa la primera")
ok(root("select (data->>'t')::int from public.registros where col='hrReads' and id='m1_f1'")[0][0]==1,"queda la primera lectura")
ok(rj(push(MOS,[{"col":"hrReads","id":"m1_f1","deleted":True}])).get(('hrReads','m1_f1'))=='solo_agregar',"las lecturas no se borran")
ok(rj(push(ADM,[{"col":"hrInventado","id":"x","data":{"id":"x"}}])).get(('hrInventado','x')) is not None,"una colección desconocida se rechaza")
# lo anterior sigue funcionando
ok(not push(MOS,[{"col":"fichajes","id":"fi1","data":{"id":"fi1","staffId":"f1","t":1,"type":"in"}}]).get('rej'),"fichajes desde el mostrador siguen andando")
ok(rj(push(OPE,[{"col":"fichajes","id":"fi2","data":{"id":"fi2","staffId":"f1","t":1,"type":"in"}}])).get(('fichajes','fi2'))=='sin_permiso',"fichajes sin Caja ni Personal: rechazado")
ok(not push(ADM,[{"col":"sales","id":"s1","data":{"id":"s1","n":"1","total":100,"items":[],"pays":[{"m":"efectivo","a":100}]}}]).get('rej'),"entregas con medios de pago siguen validándose")
ok(sel(MOS,"select count(*) from public.registros where col like 'hr%'")[1][0][0]>=8,"los registros de RR. HH. se leen con la sincronización")
print(f"PASS {PASS} FAIL {FAIL}")
import sys;sys.exit(1 if FAIL else 0)
