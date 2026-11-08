"""c5 · nube con la migración 06: el celular manda el formulario con su tarjeta del Club, la ve «en trámite»,
el equipo incorpora la solicitud y el celular pasa a «activa» con sus sellos; el mostrador sella con el QR que rota;
pago dividido y monedero se sincronizan y el servidor no deja gastar saldo de más ni repetir un comprobante."""
import subprocess,os,re,json,time,urllib.request
from h import *
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
URL='http://127.0.0.1:54321'
def psql(sql):
    r=subprocess.run(['su','postgres','-c',f'/usr/lib/postgresql/16/bin/psql -h /tmp -p 5544 -d vb -At -c "{sql}"'],capture_output=True,text=True);return r.stdout.strip()
subprocess.run(['/var/tmp/sqlt/reset.sh'],check=True,capture_output=True)
code=psql("select public.generar_codigo_alta()")
env=dict(os.environ,SUPA_URL=URL,SUPA_KEY='sb_publishable_TESTKEY',TEST_HOOKS='1')
subprocess.run(['python3',os.path.join(ROOT,'assemble.py'),os.path.join(HERE,'cloud.html')],env=env,check=True,capture_output=True)
CH='file://'+os.path.join(HERE,'cloud.html')
t=T('c5 nube: tarjeta del Club en el celular, pago dividido y monedero')
def wait_text(pg,sel,rx,to=25000):
    end=time.time()+to/1000
    while time.time()<end:
        try:
            if re.search(rx,pg.inner_text(sel)):return True
        except Exception:pass
        pg.wait_for_timeout(300)
    return False
def synced(pg,to=30000):return wait_text(pg,'#syncchip',r'Sincronizado( ·)?(?! .* por subir)',to)
def wait_sql(sql,val,to=30):
    end=time.time()+to
    while time.time()<end:
        if psql(sql)==val:return True
        time.sleep(0.5)
    return False
def close(pg):pg.evaluate("(()=>{const b=document.querySelector('#modal [data-a=mclose]');if(b)b.click()})()");pg.wait_for_timeout(200)
def st(pg,e):return pg.evaluate("(()=>{const {S}=__vb();return ("+e+")})()")
with sync_playwright() as p:
    bA,cA,A=launch(p);bP,cP,P=launch(p,w=390,h=844)
    A.goto(CH);A.wait_for_timeout(500);A.evaluate("location.hash='#/acceso'");A.wait_for_selector('#sc_c',timeout=10000)
    A.fill('#sc_c',code);A.fill('#sc_n','Ana Admin');A.fill('#sc_e','ana@terps.test');A.fill('#sc_p','Clave1234');A.fill('#sc_p2','Clave1234');A.click('[data-a=cloudSetup]')
    A.wait_for_selector('#view',timeout=20000);A.evaluate(SEED_PRODUCTS);wait_seed(psql);t.chk(synced(A),'admin sincronizado')
    # ---- el celular completa el formulario: la tarjeta nace en el celular
    P.goto(CH);P.wait_for_timeout(1200)
    if P.query_selector('[data-a=ageYes]'):P.click('[data-a=ageYes]');P.wait_for_timeout(300)
    P.wait_for_selector('#h_nombre',state='attached',timeout=10000)
    P.evaluate("""()=>{const s=(i,v)=>{const e=document.getElementById(i);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))};
      s('h_nombre','Lucía');s('h_apellido','Gómez');s('h_fnac','1990-05-21');s('h_wa','3875147777');s('h_doc','30123999');
      document.getElementById('h_ci').checked=true}""")
    P.evaluate("document.querySelector('[data-a=hcSend]').click()")
    t.chk(wait_text(P,'body',r'Ver mi tarjeta del Club',15000),'tras enviar: «Ver mi tarjeta del Club»')
    card=P.evaluate("JSON.parse(localStorage.getItem('terps_card'))")
    t.chk(card and len(card['id'])>=14 and len(card['sec'])>=24,'la tarjeta quedó guardada en el celular')
    t.chk(psql("select payload->'card'->>'id' from public.solicitudes_web where tipo='hc'")==card['id'],'la solicitud lleva la tarjeta')
    P.evaluate("location.hash='#/mitarjeta'");P.wait_for_timeout(1500)
    t.chk(wait_text(P,'body',r'En trámite',15000),'mientras no se incorpora: «En trámite»')
    t.chk(P.query_selector('.qrbox svg') is not None,'igual muestra el QR')
    # ---- el equipo incorpora la solicitud
    go(A,'#/panel/solic');A.wait_for_selector('[data-a=solRefresh]',timeout=8000);A.click('[data-a=solRefresh]')
    t.chk(wait_text(A,'#view',r'Lucía Gómez',15000),'solicitud en la bandeja')
    A.click('[data-a=solInc]');A.wait_for_timeout(500)
    btn=A.query_selector('#modal [data-a=solIncOk]') or A.query_selector('#modal [data-a=cfOk]')
    if btn:btn.click()
    A.wait_for_timeout(1200);t.chk(synced(A),'sincronizado tras incorporar')
    t.chk(psql("select data->'card'->>'id' from public.registros where col='socios' and data->>'origen'='web'")==card['id'],'el socio nace con la tarjeta del celular')
    # ---- el mostrador sella con el QR que rota
    sid=st(A,"S.socios.find(x=>x.name==='Lucía Gómez').id")
    code4=A.evaluate("(async()=>{const v=__vb();return await v.cardCode(%s,v.cardWin())})()"%json.dumps(card))
    go(A,'#/panel/sellos');A.wait_for_selector('#sl_t');A.fill('#sl_t','TERPS2|%s|%s'%(card['id'],code4));A.click('[data-a=stampTok]');A.wait_for_timeout(500)
    t.chk(st(A,"S.socios.find(x=>x.id==='%s').stamps.length"%sid)==1,'sello con el QR del celular')
    t.chk(synced(A),'sello sincronizado')
    wait_sql("select jsonb_array_length(data->'stamps') from public.registros where col='socios' and id='%s'"%sid,'1')
    P.reload();P.wait_for_timeout(2000)
    t.chk(wait_text(P,'body',r'1 / 10',15000),'el celular ve su tarjeta activa con 1 sello')
    body=P.inner_text('body');t.chk('30123999' not in body and '3875147777' not in body,'el celular no recibe datos personales del servidor')
    # ---- pago dividido sincronizado
    go(A,'#/panel/caja');A.wait_for_selector('#cj_f',timeout=8000);A.fill('#cj_f','1000');A.click('[data-a=cajaOpen]');A.wait_for_timeout(300)
    go(A,'#/panel/vender');A.wait_for_selector('[data-a=posAdd][data-id=p_cream]',timeout=8000);A.click('[data-a=posAdd][data-id=p_cream]');A.click('[data-a=posCobrar]');A.wait_for_selector('#donv')
    A.fill('#donv','30000');A.dispatch_event('#donv','change');A.wait_for_timeout(200);A.select_option('#rubsel','r_don');A.click('[data-a=cobSplit]');A.wait_for_timeout(150)
    r=A.query_selector_all('#modal [data-in=mxa]');r[0].fill('10000');r[0].dispatch_event('input');A.click('#modal [data-a=mxResto][data-i="1"]');A.wait_for_timeout(150)
    A.fill('#pd_transferencia_ent','Banco Nación');A.fill('#pd_transferencia_nro','NAC00012345');A.fill('#pd_transferencia_fh',time.strftime('%Y-%m-%dT%H:%M'))
    for e in ['#pd_transferencia_ent','#pd_transferencia_nro','#pd_transferencia_fh']:A.dispatch_event(e,'input')
    A.click('[data-a=cobOk]');A.wait_for_timeout(500);close(A)
    t.chk(synced(A),'entrega mixta sincronizada')
    wait_sql("select count(*) from public.registros where col='sales' and data->>'pay'='mixto'",'1')
    t.chk(psql("select jsonb_array_length(data->'pays') from public.registros where col='sales' and data->>'pay'='mixto'")=='2','el servidor guarda los dos medios')
    t.chk(psql("select count(*) from public.cobro_ops where clave='T|NAC00012345'")=='1','el comprobante queda registrado como usado')
    # ---- monedero: carga, uso y control del servidor
    A.evaluate("(()=>{const v=__vb();const s=v.S.socios.find(x=>x.id==='%s');v.S.fidmov.push({id:'fm1',n:'1-M1',t:Date.now(),tipo:'carga',socioId:s.id,legajo:s.legajo,monto:5000,medio:'efectivo',rubro:v.S.rubros.find(r=>r.id==='r_mon'),caja:v.S.cash.open.id,user:'Ana',dev:1,obs:''});v.persist()})()"%sid)
    t.chk(synced(A) and wait_sql("select public._mon_saldo((select id from public.tenants limit 1),'%s')"%sid,'5000'),'carga de monedero en el servidor')
    # un equipo desactualizado intenta gastar de más: el servidor lo rechaza
    A.evaluate("""(()=>{const v=__vb();const s=v.S.socios.find(x=>x.id==='%s');v.S.sales.push({id:'x-mon',n:'1-999',t:Date.now(),caja:v.S.cash.open.id,user:'Ana',dev:1,items:[{pid:'p_cream',name:'Crema',unit:'u',qty:1,price:9000,list:9000,cost:0,amount:9000}],sugerido:9000,total:9000,cc:0,mon:9000,pays:[{m:'mon',a:9000}],pay:'mon',recv:null,vuelto:0,rec:{kind:'paciente',socioId:s.id,nombre:s.name},socioId:s.id,rubro:null,doc:'comprobante',fc:null,cae:null,voided:false});v.persist()})()"""%sid)
    A.wait_for_timeout(4000)
    t.chk(psql("select count(*) from public.registros where col='sales' and id='x-mon'")=='0','gastar más saldo del que hay: el servidor no lo acepta')
    t.chk(st(A,"(S.sync.rej||[]).some(r=>r.id==='x-mon'&&/saldo/.test(r.reason||r.r||''))") or 'saldo' in A.evaluate("JSON.stringify(__vb().S.sync.rej||[])"),'el rechazo queda visible con motivo')
    P.reload();P.wait_for_timeout(2000)
    t.chk(wait_text(P,'body',r'monedero\): \$\s?5\.000',15000),'el celular ve su saldo a favor')
    errs=[e for e in A.errs+P.errs if 'Failed to load resource' not in e]
    t.chk(not errs,'sin errores de consola: '+str(errs[:3]))
    for b in (bA,bP):b.close()
sys.exit(0 if t.done() else 1)
