"""Simula Supabase (Auth + PostgREST RPC) sobre el Postgres local. SOLO PARA PRUEBAS."""
import json,sys,time,uuid,re,threading,urllib.parse,jwt,psycopg2
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 54321
SECRET='test-secret-not-real-0123456789abcdef0123456789'
DSN="host=/tmp port=5544 dbname=vb user=postgres"
STATE={'expire_before':0,'log':[]}
def db():
    c=psycopg2.connect(DSN);c.autocommit=True;return c
def tok(uid,email):
    now=int(time.time());return jwt.encode({'sub':uid,'role':'authenticated','email':email,'iat':now,'exp':now+3600,'aud':'authenticated'},SECRET,algorithm='HS256')
class H(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,*a):pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Headers','apikey,authorization,content-type,x-client-info,prefer');self.send_header('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS')
    def out(self,code,obj=None):
        b=b'' if obj is None else json.dumps(obj).encode()
        self.send_response(code);self.cors();self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def body(self):
        n=int(self.headers.get('Content-Length') or 0);r=self.rfile.read(n) if n else b''
        try:return json.loads(r) if r else {}
        except Exception:return {}
    def uid_from(self):
        a=self.headers.get('Authorization','')
        if not a.startswith('Bearer '):return None,None
        try:
            c=jwt.decode(a[7:],SECRET,algorithms=['HS256'],audience='authenticated')
        except jwt.ExpiredSignatureError:return None,'expired'
        except Exception:return None,'bad'
        if c.get('iat',0)<STATE['expire_before']:return None,'expired'
        return c['sub'],None
    def do_OPTIONS(self):
        self.send_response(204);self.cors();self.send_header('Content-Length','0');self.end_headers()
    def do_GET(self):
        u=urllib.parse.urlparse(self.path)
        if u.path.startswith('/__test/'):return self.test(u)
        if u.path.startswith('/rest/v1/'):return self.rest(u)
        self.out(404,{'message':'not found'})
    def do_PUT(self):
        u=urllib.parse.urlparse(self.path)
        if u.path=='/auth/v1/user':
            bd=self.body()
            uid,err=self.uid_from()
            if not uid:return self.out(401,{'code':401,'msg':'invalid JWT' if err!='expired' else 'JWT expired'})
            p=bd.get('password','')
            if len(p)<6:return self.out(422,{'code':'weak_password','msg':'Password should be at least 6 characters'})
            c=db();cur=c.cursor()
            cur.execute("select encrypted_password=extensions.crypt(%s,encrypted_password) from auth.users where id=%s",(p,uid))
            if cur.fetchone()[0]:return self.out(422,{'code':'same_password','msg':'New password should be different from the old password.'})
            cur.execute("update auth.users set encrypted_password=extensions.crypt(%s,extensions.gen_salt('bf')),updated_at=now() where id=%s",(p,uid));c.close()
            return self.out(200,{'id':uid})
        self.out(404,{'message':'not found'})
    def test(self,u):
        q=urllib.parse.parse_qs(u.query)
        if u.path=='/__test/expire':STATE['expire_before']=int(time.time())+1;time.sleep(1.1);return self.out(200,{'ok':1})
        if u.path=='/__test/log':return self.out(200,STATE['log'])
        if u.path=='/__test/clearlog':STATE['log'].clear();return self.out(200,{})
        self.out(404,{})
    def do_POST(self):
        u=urllib.parse.urlparse(self.path)
        if u.path=='/auth/v1/token':return self.token(u)
        if u.path.startswith('/rest/v1/rpc/'):return self.rpc(u.path.split('/')[-1])
        self.out(404,{'message':'not found'})
    def token(self,u):
        gt=urllib.parse.parse_qs(u.query).get('grant_type',[''])[0];b=self.body();c=db();cur=c.cursor()
        try:
            if gt=='password':
                cur.execute("select id,email,banned_until from auth.users where lower(email)=lower(%s) and encrypted_password=extensions.crypt(%s,encrypted_password)",(b.get('email',''),b.get('password','')))
                r=cur.fetchone()
                if not r:return self.out(400,{'code':'invalid_credentials','msg':'Invalid login credentials'})
            elif gt=='refresh_token':
                cur.execute("select u.id,u.email,u.banned_until from auth.refresh_tokens t join auth.users u on u.id::text=t.user_id where t.token=%s",(b.get('refresh_token',''),))
                r=cur.fetchone()
                if not r:return self.out(400,{'code':'refresh_token_not_found','msg':'Invalid Refresh Token: Refresh Token Not Found'})
                cur.execute("delete from auth.refresh_tokens where token=%s",(b['refresh_token'],))
            else:return self.out(400,{'msg':'unsupported'})
            if r[2] is not None:return self.out(400,{'code':'user_banned','msg':'User is banned'})
            uid=str(r[0]);rt=uuid.uuid4().hex
            cur.execute("insert into auth.refresh_tokens(user_id,token) values (%s,%s)",(uid,rt))
            self.out(200,{'access_token':tok(uid,r[1]),'token_type':'bearer','expires_in':3600,'refresh_token':rt,'user':{'id':uid,'email':r[1]}})
        finally:c.close()
    def run(self,uid,anon,sql,args):
        c=psycopg2.connect(DSN);cur=c.cursor()
        try:
            cur.execute("begin");cur.execute("set local role "+('authenticated' if uid else 'anon'))
            if uid:cur.execute("select set_config('request.jwt.claim.sub',%s,true)",(uid,))
            cur.execute("select set_config('request.headers',%s,true)",(json.dumps({'x-forwarded-for':self.headers.get('X-Forwarded-For','127.0.0.1')}),))
            cur.execute(sql,args);r=cur.fetchall();cur.execute("commit");return r
        except psycopg2.Error as e:
            try:cur.execute("rollback")
            except Exception:pass
            raise e
        finally:c.close()
    def rpc(self,fn):
        b=self.body()
        uid,err=self.uid_from()
        if err:return self.out(401,{'code':'PGRST301','message':'JWT expired' if err=='expired' else 'JWT invalid'})
        if not re.match(r'^[a-z_0-9]+$',fn):return self.out(404,{})
        names=list(b.keys());args=[]
        for k in names:
            if not re.match(r'^p_[a-z_]+$',k):return self.out(400,{'message':'bad param'})
            v=b[k];args.append(json.dumps(v) if isinstance(v,(dict,list)) else v)
        sql="select public.%s(%s)"%(fn,",".join("%s := %%s"%k for k in names))
        STATE['log'].append(fn)
        try:
            r=self.run(uid,not uid,sql,args)
        except psycopg2.Error as e:
            msg=(e.pgerror or str(e)).split('\n')[0].replace('ERROR:  ','')
            code=getattr(e,'pgcode','') or ''
            st=400 if code.startswith('P0') else (401 if (code=='42501' and not uid) else (403 if code=='42501' else 400))
            return self.out(st,{'code':code,'message':msg})
        v=r[0][0]
        if v is None:return self.out(200,None) if False else self.out(204,None)
        self.out(200,v)
    def rest(self,u):
        uid,err=self.uid_from()
        if err:return self.out(401,{'code':'PGRST301','message':'JWT expired'})
        t=u.path.split('/')[-1];q=urllib.parse.parse_qs(u.query)
        if t=='menus':sql="select coalesce(json_agg(x),'[]'::json) from (select hash,data from public.menus limit 1) x";a=[]
        elif t=='menus_versiones':
            v=q.get('ver',['eq.0'])[0].replace('eq.','');sql="select coalesce(json_agg(x),'[]'::json) from (select data from public.menus_versiones where ver=%s limit 1) x";a=[int(v)]
        else:return self.out(404,{})
        try:r=self.run(uid,not uid,sql,a)
        except psycopg2.Error as e:return self.out(403,{'message':str(e).split('\n')[0]})
        self.out(200,r[0][0])
ThreadingHTTPServer.daemon_threads=True
ThreadingHTTPServer(('127.0.0.1',PORT),H).serve_forever()
