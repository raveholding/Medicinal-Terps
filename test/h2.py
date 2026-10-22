from h import *
import re,json
def st(pg,expr):
    return pg.evaluate("(()=>{const {S,SES,DEV,META,PUB,POS,CL,sha256s,stable,auditVerify}=__vb();return ("+expr+")})()")
def np_type(pg,txt):
    for ch in txt:
        pg.click(f'#modal [data-a=np][data-k="{ch if ch!=chr(46) else ","}"]')
    pg.click('#modal [data-a=np][data-k=OK]');pg.wait_for_timeout(150)
def open_caja(pg,fondo=1000):
    go(pg,'#/panel/caja');pg.wait_for_selector('#cj_f',timeout=5000);pg.fill('#cj_f',str(fondo));pg.click('[data-a=cajaOpen]');pg.wait_for_timeout(300)
def add_socio(pg,nombre,apellido,doc='',tipo='DNI',wa='',email='',bday='',rp=None,rpv='',tope=None,ki=True,k=False,dup_ok=True):
    pg.wait_for_function("document.querySelector('#modal').hidden",timeout=5000) if pg.query_selector('#modal') else None
    go(pg,'#/panel/socios');pg.wait_for_selector('[data-a=socioNew]',timeout=5000);pg.wait_for_timeout(150);pg.click('[data-a=socioNew]');pg.wait_for_selector('#sf_n')
    pg.wait_for_timeout(100)
    pg.fill('#sf_n',nombre);pg.fill('#sf_a',apellido);pg.select_option('#sf_dt',tipo);pg.fill('#sf_d',doc);pg.fill('#sf_w',wa)
    if email:pg.fill('#sf_e',email)
    if bday:pg.fill('#sf_b',bday)
    if rp is not None:pg.fill('#sf_r',rp)
    if rpv:pg.fill('#sf_rv',rpv)
    if tope is not None:pg.fill('#sf_t',str(tope))
    pg.set_checked('#sf_ki',ki);pg.set_checked('#sf_k',k)
    pg.click('[data-a=socioSave]');pg.wait_for_timeout(300)
    if dup_ok and pg.query_selector('#modal [data-a=cfOk]'):pg.click('#modal [data-a=cfOk]');pg.wait_for_timeout(300)
def pick_rec(pg,query):
    pg.click('[data-a=posRec]');pg.click('[data-a=recKind][data-id=paciente]');pg.wait_for_selector('#cq');pg.fill('#cq',query);pg.wait_for_timeout(200)
    pg.click('#clist [data-a=custPick]');pg.wait_for_timeout(250)
def sale_flow(pg,pid,grams=None,don=None,pay=None,rubro=None,sin=False,rec=None,fc=False,motivo_fc='prueba',auth_motivo='Autorizado en prueba'):
    """Agrega un producto y registra. don=None usa la sugerida. Devuelve el texto de toast."""
    go(pg,'#/panel/vender');pg.wait_for_selector(f'[data-a=posAdd][data-id={pid}]',timeout=5000)
    if rec:pick_rec(pg,rec)
    pg.click(f'[data-a=posAdd][data-id={pid}]');pg.wait_for_timeout(150)
    if grams is not None:np_type(pg,str(grams))
    if fc:
        pg.click('[data-a=posFc]');pg.wait_for_selector('#askv');pg.fill('#askv',motivo_fc);pg.click('[data-a=askOk]');pg.wait_for_timeout(150)
    pg.click('[data-a=posCobrar]');pg.wait_for_selector('[data-a=cobOk]',timeout=4000)
    if sin:pg.click('[data-a=donNone]');pg.wait_for_timeout(150)
    elif don is not None:
        pg.fill('#donv',str(don));pg.dispatch_event('#donv','change');pg.wait_for_timeout(250)
    if pay and pg.query_selector(f'[data-a=cobPay][data-id={pay}]'):pg.click(f'[data-a=cobPay][data-id={pay}]');pg.wait_for_timeout(150)
    if rubro is not None and pg.query_selector('#rubsel'):pg.select_option('#rubsel',rubro);pg.wait_for_timeout(100)
    if pg.query_selector('#cusel') and not pg.input_value('#cusel'):pg.select_option('#cusel',index=1);pg.wait_for_timeout(100)
    pg.click('[data-a=cobOk]');pg.wait_for_timeout(300)
    if pg.query_selector('#askv'):
        pg.fill('#askv',auth_motivo);pg.click('[data-a=askOk]');pg.wait_for_timeout(350)
    return toast(pg)
def close_modal(pg):
    pg.evaluate("(()=>{const b=document.querySelector('#modal [data-a=mclose]');if(b)b.click()})()");pg.wait_for_timeout(200)
