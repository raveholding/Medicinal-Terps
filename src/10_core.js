/* ===== Sistema VB · Medicinal Terps · núcleo ===== */
const ASSETS=__ASSETS__;
const RAVE=__CREDITS__;
const VERSION='__VERSION__';
const CFG=(()=>{try{return JSON.parse(document.getElementById('cfg').textContent)||{}}catch(e){return{}}})();
const CLOUD={url:String(CFG.url||'').replace(/\/+$/,''),key:String(CFG.key||''),get on(){return !!(this.url&&this.key)},get gid(){return String(CFG.gid||'')}};
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"'`]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
const r2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const r3=n=>Math.round((Number(n)+Number.EPSILON)*1000)/1000;
const CLK={off:0};
const now=()=>Date.now()+CLK.off;
const pad=n=>String(n).padStart(2,'0');
const dkey=ts=>{const d=new Date(ts==null?now():ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const today=()=>dkey();
const fdate=k=>{if(!k)return'';const m=String(k).match(/^(\d{4})-(\d\d)-(\d\d)/);return m?m[3]+'/'+m[2]+'/'+m[1]:esc(k)};
const fdt=ts=>{const d=new Date(ts);return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const DOW=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const money=n=>{n=Number(n)||0;return (n<0?'-$ ':'$ ')+Math.abs(n).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2})};
const qty=(n,u)=>u==='g'?(r3(n).toLocaleString('es-AR',{maximumFractionDigits:3})+' g'):String(r3(n));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const norm=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const last10=s=>String(s||'').replace(/\D/g,'').slice(-10);
/* número en formato argentino o inglés */
const parseNum=v=>{if(typeof v==='number')return isFinite(v)?v:NaN;let s=String(v==null?'':v).trim().replace(/[$\s]/g,'');if(!s)return NaN;
 const neg=/^\(.*\)$/.test(s);s=s.replace(/[()]/g,'');
 if(s.includes(',')&&s.includes('.')){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'')}
 else if(s.includes(',')){s=/^-?\d{1,3}(,\d{3})+$/.test(s)?s.replace(/,/g,''):s.replace(',','.')}
 else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)){s=s.replace(/\./g,'')}
 const n=Number(s);return isFinite(n)?(neg?-n:n):NaN};
const P={
 home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
 box:'<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7l8.7 5 8.7-5M12 22V12"/>',
 users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 cash:'<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
 gear:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
 chart:'<path d="M18 20V10M12 20V4M6 20v-6"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 menu:'<path d="M3 12h18M3 6h18M3 18h18"/>',
 search:'<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 trash:'<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
 edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 print:'<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
 share:'<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
 wa:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
 check:'<path d="M20 6L9 17l-5-5"/>',
 x:'<path d="M18 6L6 18M6 6l12 12"/>',
 lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 qr:'<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7M14 20h3"/>',
 clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
 download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
 star:'<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21 7 14.1 2 9.3l6.9-1z"/>',
 alert:'<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
 globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',
 clip:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
 tag:'<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/>',
 pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
 grid:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 chev:'<path d="M15 18l-6-6 6-6"/>',
 nfc:'<path d="M5 12.5a11 11 0 0 1 14 0M8.5 16.4a6 6 0 0 1 7 0M12 20h.01"/>',
 card:'<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
 help:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
 cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
 leaf:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.5-7"/>',
 folder:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
 cloud:'<path d="M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
 inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
 link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
 copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'
};
const ic=(n,c)=>'<svg class="i'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(P[n]||'')+'</svg>';
const img=v=>{if(!v)return'';if(String(v).startsWith('asset:'))return ASSETS[String(v).slice(6)]||'';return /^data:image\//.test(v)?v:''};

/* ---------- SHA-256 síncrono (cadena de auditoría) ---------- */
const SK=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256s(str){
 const m=new TextEncoder().encode(str),l=m.length,nb=((l+9+63)>>6)<<6,b=new Uint8Array(nb);b.set(m);b[l]=0x80;
 const dv=new DataView(b.buffer);dv.setUint32(nb-8,Math.floor(l*8/0x100000000));dv.setUint32(nb-4,(l*8)>>>0);
 let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;const w=new Uint32Array(64);
 for(let o=0;o<nb;o+=64){for(let i=0;i<16;i++)w[i]=dv.getUint32(o+i*4);
  for(let i=16;i<64;i++){const a=w[i-15],c=w[i-2];const s0=((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3),s1=((c>>>17)|(c<<15))^((c>>>19)|(c<<13))^(c>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0}
  let a=h0,b2=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
  for(let i=0;i<64;i++){const e1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)),ch=(e&f)^(~e&g),t1=(h+e1+ch+SK[i]+w[i])|0,e0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)),mj=(a&b2)^(a&c)^(b2&c),t2=(e0+mj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b2;b2=a;a=(t1+t2)|0}
  h0=(h0+a)|0;h1=(h1+b2)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0}
 return [h0,h1,h2,h3,h4,h5,h6,h7].map(x=>(x>>>0).toString(16).padStart(8,'0')).join('')}
/* hash rápido (no criptográfico) para huellas de sincronización */
function fp53(s){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)}

/* ---------- identificadores: legajo, clave interna, documentos ---------- */
const LA='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const rndStr=(n,al)=>{const u=crypto.getRandomValues(new Uint8Array(n));let s='';for(let i=0;i<n;i++)s+=al[u[i]%al.length];return s};
function legajoPrefix(){const d=new Date(now());return 'L-'+pad(d.getFullYear()%100)+pad(d.getMonth()+1)+pad(d.getDate())+'-'}
function tsLegajoTail(){let n=Math.floor(now()%1073741824),s='';for(let i=0;i<6;i++){s=LA[n%32]+s;n=Math.floor(n/32)}return s}
function newLegajo(used){
 const taken=l=>(S&&S.socios.some(x=>x.legajo===l))||(used&&used.has(l));
 const p=legajoPrefix();
 for(let i=0;i<12;i++){const l=p+rndStr(6,LA);if(!taken(l))return l}
 let l=p+tsLegajoTail();return l}
function newKey13(){
 for(let i=0;i<20;i++){const k='88'+rndStr(11,'0123456789');if(!(S&&S.socios.some(x=>x.key===k)))return k}
 return '88'+String(now()).slice(-11).padStart(11,'0')}
const CUIT_PRE=['20','23','24','25','26','27','30','33','34'];
function cuitOk(d){
 if(!/^\d{11}$/.test(d)||!CUIT_PRE.includes(d.slice(0,2)))return false;
 const w=[5,4,3,2,7,6,5,4,3,2];let s=0;for(let i=0;i<10;i++)s+=(+d[i])*w[i];
 let v=11-(s%11);if(v===11)v=0;if(v===10)return false;return v===+d[10]}
const DOCTIPOS=['DNI','CUIT','CUIL'];
/* devuelve {ok, empty, digits, tipo, msg}. Vacío es válido (el documento es opcional). */
function valDoc(tipo,raw){
 const txt=String(raw==null?'':raw).trim();
 if(!txt)return{ok:true,empty:true,digits:'',tipo:tipo||'DNI',msg:''};
 const d=txt.replace(/\D/g,'');
 if(!d)return{ok:false,msg:'El documento no tiene números. Si no lo tenés, dejalo vacío.'};
 tipo=DOCTIPOS.includes(tipo)?tipo:(d.length===11?'CUIT':'DNI');
 if(tipo==='DNI'){if(d.length<6||d.length>9)return{ok:false,msg:'El DNI debe tener entre 6 y 9 números. Si no lo tenés, dejalo vacío.'}}
 else{if(d.length!==11)return{ok:false,msg:'El '+tipo+' debe tener 11 números. Si no lo tenés, dejalo vacío.'};if(!cuitOk(d))return{ok:false,msg:'El '+tipo+' no es válido (prefijo o dígito verificador). Si no lo tenés, dejalo vacío.'}}
 return{ok:true,empty:false,digits:d,tipo,msg:''}}
function fmtDoc(tipo,d){d=String(d||'').replace(/\D/g,'');if(!d)return'';if(d.length===11)return d.slice(0,2)+'-'+d.slice(2,10)+'-'+d.slice(10);if(d.length>=7)return d.replace(/\B(?=(\d{3})+(?!\d))/g,'.');return d}
const docLabel=(tipo,d)=>d?((tipo||'DNI')+' '+fmtDoc(tipo,d)):'sin documento';

/* ---------- idioma (sitio público) ---------- */
let LANG='es';try{LANG=localStorage.getItem('terps_lang')==='en'?'en':'es'}catch(e){}
(function(){try{const q=(location.search||'').match(/[?&]lang=(es|en)/);if(q)LANG=q[1]}catch(e){}})();
const t=k=>(TX[LANG]&&TX[LANG][k])||TX.es[k]||k;

/* ---------- almacenamiento (IndexedDB) ---------- */
let IDB=null,MEMKV={},KVOK=true;
function idbOpen(){return new Promise(res=>{try{const r=indexedDB.open('terps_sys',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{IDB=r.result;res(true)};r.onerror=()=>res(false);r.onblocked=()=>res(false)}catch(e){res(false)}})}
function kvGet(k){return new Promise(res=>{if(!IDB)return res(MEMKV[k]);try{const q=IDB.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(undefined)}catch(e){res(MEMKV[k])}})}
function kvSet(k,v){return new Promise(res=>{if(!IDB){MEMKV[k]=v;return res(true)}try{const tx=IDB.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=()=>res(true);tx.onerror=()=>res(false);tx.onabort=()=>res(false)}catch(e){MEMKV[k]=v;res(false)}})}
function kvDel(k){return new Promise(res=>{if(!IDB){delete MEMKV[k];return res(true)}try{const tx=IDB.transaction('kv','readwrite');tx.objectStore('kv').delete(k);tx.oncomplete=()=>res(true);tx.onerror=()=>res(false)}catch(e){res(false)}})}
function kvClear(){return new Promise(res=>{MEMKV={};if(!IDB)return res();try{const tx=IDB.transaction('kv','readwrite');tx.objectStore('kv').clear();tx.oncomplete=()=>res();tx.onerror=()=>res()}catch(e){res()}})}

/* ---------- criptografía ---------- */
const te=new TextEncoder(),td=new TextDecoder();
const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const b64u=u=>b64(u).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const hex=u=>Array.from(u).map(b=>pad2(b)).join('');const pad2=b=>b.toString(16).padStart(2,'0');
async function kdf(pass,salt){const k=await crypto.subtle.importKey('raw',te.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:200000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function aesE(key,bytes){const iv=rnd(12);return{iv:b64(iv),ct:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes)))}}
async function aesD(key,o){return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},key,unb64(o.ct)))}
const dkFrom=raw=>crypto.subtle.importKey('raw',raw,'AES-GCM',true,['encrypt','decrypt']);
async function wrapDK(pass,raw){const salt=rnd(16);const k=await kdf(pass,salt);const e=await aesE(k,raw);return{salt:b64(salt),iv:e.iv,ct:e.ct}}
async function unwrapDK(pass,w){const k=await kdf(pass,unb64(w.salt));return aesD(k,w)}
async function sha256hex(str){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(str))))}
function stable(o){if(o===null||typeof o!=='object')return JSON.stringify(o);if(Array.isArray(o))return'['+o.map(stable).join(',')+']';return'{'+Object.keys(o).filter(k=>o[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(o[k])).join(',')+'}'}
let HK=null;
async function hmacKey(){if(!HK)HK=await crypto.subtle.importKey('raw',unb64(S.hkey),{name:'HMAC',hash:'SHA-256'},false,['sign']);return HK}
async function hsign(str){return b64u(new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(),te.encode(str))))}
const RCA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function recCode(){const u=rnd(20);let s='';for(let i=0;i<20;i++){s+=RCA[u[i]%32];if(i%5===4&&i<19)s+='-'}return s}
function tempPass(){const u=rnd(10);let s='';for(let i=0;i<10;i++)s+=RCA[u[i]%32];return s+'a7'}

/* ---------- estado ---------- */
let S=null,DK=null,META=null,PUB=null,SES=null;
const A={},IN={},CH={},KD={};
let ROUTE={n:'home'};
const SEC={};
let tmPersist=null,persisting=Promise.resolve();
function persist(){if(!S||!DK)return;PUB=buildPub();clearTimeout(tmPersist);tmPersist=setTimeout(flush,250);if(typeof cloudKick==='function')cloudKick()}
function flush(){clearTimeout(tmPersist);if(!S||!DK)return persisting;const s=S,dk=DK,vk=vaultKey();persisting=persisting.then(async()=>{try{const e=await aesE(dk,te.encode(JSON.stringify(s)));await kvSet(vk,e);PUB=buildPub(s);await kvSet('public',PUB)}catch(err){console.error(err)}});return persisting}
const vaultKey=()=>(CLOUD.on&&SES&&SES.uid)?'vault:'+SES.uid:'vault';
/* auditoría encadenada: cada entrada incluye el hash de la anterior */
const AUD0='0'.repeat(64);
function auditHash(prev,e){return sha256s(prev+'|'+e.t+'|'+e.u+'|'+e.a+'|'+e.d)}
function audit(a,d){if(!S)return;const e={t:now(),u:SES?SES.name:'-',a,d:d==null?'':(typeof d==='string'?d:JSON.stringify(d))};const prev=S.audit.length?S.audit[S.audit.length-1].h:(S.auditBase||AUD0);e.h=auditHash(prev,e);S.audit.push(e);
 if(S.audit.length>6000){const cut=S.audit.splice(0,S.audit.length-6000);S.auditBase=cut[cut.length-1].h}
 persist()}
function auditVerify(){let prev=S.auditBase||AUD0,n=0;for(const e of S.audit){if(e.h==null){prev=e.h||prev;continue}if(auditHash(prev,e)!==e.h)return{ok:false,at:n,total:S.audit.length};prev=e.h;n++}return{ok:true,total:S.audit.length}}
/* equipo (caja) de este dispositivo: fuera de la base cifrada, sin datos personales */
let DEV=null;
async function devLoad(){let d=await kvGet('dev');if(!d||!d.id){d={id:uid()+rndStr(6,LA),n:1,pto:1,seq:{}};await kvSet('dev',d)}DEV=d;return d}
function devSave(){if(DEV)kvSet('dev',DEV)}
const seq=(k)=>{S.seq=S.seq||{};const a=Math.max(S.seq[k]||0,(DEV&&DEV.seq&&DEV.seq[k])||0)+1;S.seq[k]=a;if(DEV){DEV.seq=DEV.seq||{};DEV.seq[k]=a;devSave()}return a};

/* ---------- rubros financieros (O.10) ---------- */
const rubroById=id=>S.rubros.find(r=>r.id===id);
const rubrosFor=tipo=>S.rubros.filter(r=>r.active!==false&&(r.tipo===tipo||r.tipo==='ambos'));
function rubroSel(id,tipo){const r=rubroById(id);if(!r||r.active===false)return null;if(r.tipo!==tipo&&r.tipo!=='ambos')return null;return{id:r.id,name:r.name}}
function rubroSelect(elId,tipo,cur){const l=rubrosFor(tipo);return '<select id="'+elId+'" class="sel" style="width:100%"><option value="">— Elegí el rubro (obligatorio) —</option>'+l.map(r=>'<option value="'+esc(r.id)+'"'+(cur===r.id?' selected':'')+'>'+esc(r.name)+'</option>').join('')+'</select>'}

/* ---------- publicación del menú ---------- */
const MENU_BLOCKS=[{id:'hc',on:true},{id:'srv',on:true},{id:'cat',on:true},{id:'con',on:true}];
const defaultMenuCfg=()=>({blocks:MENU_BLOCKS.map(b=>Object.assign({},b)),texts:{es:{},en:{}}});
function livePub(st){
 st=st||S;const o=st.org;
 return{v:2,ejemplo:!!o.ejemplo,org:{name:o.nameCom,brand:o.brand,legal:o.nameLegal,cuit:o.cuit,addr:o.addr,city:o.city,hours:o.hours,wa:o.wa,email:o.email,ig:o.ig,fb:o.fb,membership:o.membership,tagline:o.tagline,maps:o.maps,slots:o.slots,ageGate:o.ageGate,hcName:o.hcName||'Historia Clínica · Solicitud Reprocann',turnero:o.turnero!==false},
 cats:st.cats.map(c=>({id:c.id,name:c.name})),
 products:st.products.filter(p=>p.pub&&p.status!=='discontinuado').map(p=>({id:p.id,name:p.name,cat:p.cat,desc:p.desc,price:p.price,unit:p.unit,img:p.img,soldout:p.status==='sin_stock'||(!p.service&&p.stock<=0),rp:!!p.rp,mem:!!p.membership})),
 menu:JSON.parse(JSON.stringify(st.menuCfg||defaultMenuCfg())),
 ts:now()}
}
const pubCore=p=>{const c=Object.assign({},p);delete c.ts;delete c.ver;return stable(c)};
function buildPub(st){st=st||S;if(st.pubSnap&&st.pubSnap.data)return st.pubSnap.data;return livePub(st)}
const pubDirty=()=>!!S&&pubCore(livePub())!==pubCore(buildPub());

/* ---------- estado inicial ---------- */
const FASES0=['Germinación','Plántula','Vegetativo','Pre-floración','Floración','Secado','Curado'];
function defaultRubros(){return[
 {id:'r_don',name:'Donaciones voluntarias',tipo:'ingreso',active:true},
 {id:'r_odon',name:'Otras donaciones',tipo:'ingreso',active:true},
 {id:'r_cuo',name:'Cuotas de socios',tipo:'ingreso',active:true},
 {id:'r_oing',name:'Otros ingresos',tipo:'ingreso',active:true},
 {id:'r_ins',name:'Insumos de cultivo',tipo:'egreso',active:true},
 {id:'r_ser',name:'Servicios',tipo:'egreso',active:true},
 {id:'r_hon',name:'Honorarios y sueldos',tipo:'egreso',active:true},
 {id:'r_alq',name:'Alquiler',tipo:'egreso',active:true},
 {id:'r_imp',name:'Impuestos y tasas',tipo:'egreso',active:true},
 {id:'r_man',name:'Mantenimiento',tipo:'egreso',active:true},
 {id:'r_rei',name:'Reintegros de donaciones',tipo:'egreso',active:true},
 {id:'r_oegr',name:'Otros egresos',tipo:'egreso',active:true}]}
function blankState(){return{v:3,cats:[],products:[],socios:[],sales:[],pagos:[],stockMoves:[],cash:{open:null,closed:[]},gastos:[],tramites:[],staff:[],fichajes:[],audit:[],batches:[],scans:{},seq:{},lastBackup:0,hkey:b64(rnd(32)),created:now(),
 rubros:defaultRubros(),ciclos:[],cregs:[],turnos:[],ncs:[],cnotes:[],menuCfg:defaultMenuCfg(),menuVersions:[],pubSnap:null,inbox:{},driveLog:{},sync:{cursor:0,fp:{},rej:[]}}}
function orgDefaults(){return{nameCom:'Organización Cannábica Medicinal de Salta',nameLegal:'TERPENOS MEDICINALES – ASOCIACIÓN CIVIL',brand:'Medicinal Terps',cuit:'30-71932471-8',addr:'Las Palmeras 90, Barrio Tres Cerritos',city:'Salta Capital',hours:'Todos los días de 10:00 a 13:00 y de 15:00 a 22:00',slots:[[600,780],[900,1320]],wa:'5493875140655',email:'medicinalterps@gmail.com',ig:'medicinalterps',fb:'Medicinal terps',membership:50000,tagline:'Cannabis medicinal con acompañamiento profesional',maps:'https://www.google.com/maps/search/?api=1&query=Las+Palmeras+90+Salta+Capital',facturaC:true,condIva:'IVA Exento',ptoVta:1,umbralId:null,lockMin:10,stampGoal:10,stampReward:'Una consulta de asesoramiento sin cargo',ageGate:true,ejemplo:true,cuotaDias:30,hcName:'Historia Clínica · Solicitud Reprocann',turnero:true,fases:FASES0.slice(),gid:'',hcConsent:'',hcConsentVer:1}}
function seedState(){
 const c=[{id:'c_acomp',name:'Aceites y extractos'},{id:'c_top',name:'Tópicos'},{id:'c_com',name:'Comestibles'},{id:'c_flor',name:'Flores (socios)'},{id:'c_mer',name:'Merchandising'},{id:'c_mem',name:'Membresía'}];
 const mk=(id,name,cat,price,cost,stock,unit,image,desc,x)=>Object.assign({id,name,cat,price,cost,stock,unit,img:image,desc,pub:true,status:'activo',min:3,barcode:'',plu:'',rp:false,service:false,membership:false,lote:'',vence:''},x||{});
 const products=[
  mk('p_oil','Aceite CBD Full Spectrum 1500 mg · 20 ml','c_acomp',38000,21000,12,'u','asset:oil','Extracto de espectro completo, concentración 1500 mg en frasco de 20 ml con gotero. Uso bajo indicación profesional.',{barcode:'7790000000011',rp:true,lote:'EJ-A01'}),
  mk('p_cream','Crema medicinal · 60 ml','c_top',18500,9000,15,'u','asset:cream','Crema de uso tópico con extracto de cannabis. Frasco de 60 ml.',{barcode:'7790000000028',lote:'EJ-C01'}),
  mk('p_balm','Bálsamo intensivo · 30 ml','c_top',14000,6500,18,'u','asset:balm','Bálsamo tópico de acción localizada. Pote de 30 ml.',{barcode:'7790000000035',lote:'EJ-B01'}),
  mk('p_gum','Gomitas CBD 25 mg · x30','c_com',22000,11000,20,'u','asset:gummies','Gomitas con 25 mg de CBD cada una. Envase de 30 unidades.',{barcode:'7790000000042',rp:true,lote:'EJ-G01'}),
  mk('p_ext','Flor línea Exterior','c_flor',5000,2600,300,'g','asset:exterior','Línea de cultivo exterior. Se dispensa por gramo, sólo a socios con REPROCANN vigente.',{rp:true,min:30,plu:'101',lote:'EJ-X01'}),
  mk('p_ind','Flor línea Indoor','c_flor',7000,3800,250,'g','asset:indoor','Línea de cultivo indoor. Se dispensa por gramo, sólo a socios con REPROCANN vigente.',{rp:true,min:30,plu:'102',lote:'EJ-I01'}),
  mk('p_inv','Flor línea Invernadero','c_flor',6000,3200,280,'g','asset:invernadero','Línea de cultivo en invernadero. Se dispensa por gramo, sólo a socios con REPROCANN vigente.',{rp:true,min:30,plu:'103',lote:'EJ-V01'}),
  mk('p_tee','Remera Terps','c_mer',15000,7000,10,'u','asset:tshirt','Remera de algodón con el logo de Medicinal Terps.',{barcode:'7790000000059'}),
  mk('p_mem','Cuota de socio (membresía)','c_mem',50000,0,0,'u','asset:logo','Cuota mensual de la organización. Incluye gestión de trámites y asesoramiento.',{service:true,membership:true,barcode:'MEMBRESIA'})
 ];
 const t0=now();const used=new Set();const L=()=>{const l=newLegajo(used);used.add(l);return l};
 const per=(o)=>Object.assign({docTipo:'DNI',consentInf:true,consentInfDate:t0,consentInfVer:1,origen:'panel',verificado:true,posibleDuplicadoDe:'',limit:0,notes:'Dato de ejemplo',created:t0,stamps:[],redeemed:0,ejemplo:true,cp:'',domicilio:'',ocupacion:'',obraSocial:'',motivo:'',estadoDecl:'',tutor:null},o);
 const org=orgDefaults();
 const d0=dkey(t0-9*864e5);
 const reg=(n,off,fase,ph,ec,hum,temp,roec,roph,obs)=>({id:'cr_ej'+n,ciclo:'cy_ej1',n,fecha:dkey(t0-(9-off)*864e5),dia:off+1,semana:Math.ceil((off+1)/7),fase,ph,ec,hum,temp,roEc:roec,roPh:roph,obs,enc:'Empleado de ejemplo (borrar)',anulado:false,hist:[],ejemplo:true});
 return Object.assign(blankState(),{org,cats:c,products,
  socios:[per({id:'s_ej1',key:newKey13(),legajo:L(),name:'Socia de ejemplo (borrar)',nombre:'Socia',apellido:'de ejemplo',doc:'20111222',wa:'5493870000001',email:'',bday:'1990-05-21',consent:true,consentDate:t0,reprocann:{nro:'EJ-0001',venc:dkey(t0+200*864e5)},cuotaHasta:dkey(t0+12*864e5),limit:20000}),
   per({id:'s_ej2',key:newKey13(),legajo:L(),name:'Socio de ejemplo 2 (borrar)',nombre:'Socio',apellido:'de ejemplo 2',doc:'',wa:'5493870000002',email:'',bday:'1985-11-02',consent:false,consentDate:0,reprocann:{nro:'EJ-0002',venc:dkey(t0+20*864e5)},cuotaHasta:dkey(t0-5*864e5)})],
  tramites:[{id:'t_ej1',socioId:'s_ej1',tipo:'Renovación',estado:'docs',notas:'Ejemplo: falta certificado médico',created:t0,ejemplo:true}],
  staff:[{id:'f_ej1',name:'Empleado de ejemplo (borrar)',dni:'00000003',role:'Mostrador',rate:4500,cardNonce:'',ejemplo:true}],
  ciclos:[{id:'cy_ej1',nombre:'Ciclo de ejemplo · Sala 1',lote:'LOTE-EJ-01',start:d0,estado:'activo',notas:'Dato de ejemplo',created:t0,ejemplo:true}],
  cregs:[reg(1,0,'Germinación',6.2,0.8,70,24,'0.9 / 6.4','','Siembra'),reg(2,3,'Plántula',6.1,1.0,68,25,'1.1 / 6.3','','Primer riego'),reg(3,6,'Vegetativo',6.0,1.4,65,26,'1.6 / 6.2','','Poda apical'),reg(4,8,'Vegetativo',6.1,1.6,64,26,'1.8 / 6.3','','Sin novedades')]})}
/* completa lo que falte en datos de versiones anteriores (sin pisar nada) */
function migrate(){
 const b=blankState();for(const k of Object.keys(b))if(S[k]==null)S[k]=b[k];
 const od=orgDefaults();for(const k of Object.keys(od))if(S.org[k]==null)S.org[k]=od[k];
 if(S.org.demo!=null&&S.org.ejemplo==null)S.org.ejemplo=!!S.org.demo;
 if(S.org.arca!=null&&S.org.facturaC==null)S.org.facturaC=false;
 if(!Array.isArray(S.rubros)||!S.rubros.length)S.rubros=defaultRubros();
 S.sync=S.sync||{cursor:0,fp:{},rej:[]};
 const used=new Set();
 for(const s of S.socios){
  if(s.dni!=null&&s.doc==null){s.doc=s.dni}delete s.dni;
  if(s.doc==null)s.doc='';
  if(!s.docTipo)s.docTipo=String(s.doc).length===11?'CUIT':'DNI';
  if(!s.legajo){s.legajo=newLegajo(used)}used.add(s.legajo);
  if(!s.key)s.key=newKey13();
  if(s.origen==null)s.origen='panel';if(s.verificado==null)s.verificado=true;if(s.posibleDuplicadoDe==null)s.posibleDuplicadoDe='';
  if(s.consentInf==null){s.consentInf=!!s.consent;s.consentInfDate=s.consentDate||0;s.consentInfVer=0}
  if(!s.nombre&&s.name){const p=s.name.trim().split(/\s+/);s.nombre=p[0]||'';s.apellido=p.slice(1).join(' ')}
 }
 for(const p of S.products){if(p.lote==null)p.lote='';if(p.vence==null)p.vence=''}
 if(!S.pubSnap)S.pubSnap=null;
 if(S.cashNotes){for(const cid of Object.keys(S.cashNotes))for(const n of S.cashNotes[cid]){if(!S.cnotes.some(x=>x.t===n.t&&x.cid===cid))S.cnotes.push({id:uid(),cid,t:n.t,u:n.u,text:n.text})}delete S.cashNotes}
 if(S.org.arca!=null){delete S.org.arca}
}
