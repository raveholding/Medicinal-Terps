/* ===== Arranque ===== */
function bindGlobal(){
 document.addEventListener('click',e=>{
  const t=e.target;bumpAct();
  if(t.id==='modal'&&!MOD.sticky){closeModal();return}
  const side=$('.side');if(side&&side.classList.contains('open')&&!t.closest('.side')&&!t.closest('#burger'))side.classList.remove('open');
  if(t.classList&&t.classList.contains('num')){try{t.select()}catch(_){}}
  const el=t.closest('[data-a]');if(el&&A[el.dataset.a]&&!el.disabled)A[el.dataset.a](el,e)});
 document.addEventListener('input',e=>{const el=e.target;bumpAct();if(el.dataset&&el.dataset.in&&IN[el.dataset.in])IN[el.dataset.in](el,e)});
 document.addEventListener('change',e=>{const el=e.target;if(el.dataset&&el.dataset.ch&&CH[el.dataset.ch])CH[el.dataset.ch](el,e)});
 document.addEventListener('focusin',e=>{const el=e.target;if(el.classList&&el.classList.contains('num')){try{el.select()}catch(_){}el._sel=1}});
 document.addEventListener('mouseup',e=>{const el=e.target;if(el&&el._sel){e.preventDefault();el._sel=0}},true);
 document.addEventListener('keydown',e=>{
  bumpAct();const mOpen=!$('#modal').hidden;
  if(mOpen&&NP){const k=e.key;if(/^[0-9]$/.test(k)||k===','||k==='.'){e.preventDefault();npKey(k==='.'?',':k)}else if(k==='Backspace'){e.preventDefault();npKey('⌫')}else if(k==='Enter'){e.preventDefault();npKey('OK')}else if(k==='Escape'){closeModal()}
   else if(/^F\d+$/.test(k))e.preventDefault();return}
  if(e.key==='Escape'&&mOpen&&!MOD.sticky){closeModal();return}
  const kd=e.target.dataset&&e.target.dataset.kd;if(kd&&KD[kd]){KD[kd](e.target,e);return}
  if(ROUTE.n==='panel'&&ROUTE.view==='vender'&&S&&/^F([1-9]|1[0-2])$/.test(e.key)){e.preventDefault();posFKey(e.key);return}
  if(e.key==='Enter'&&e.target.tagName==='INPUT'&&!['file','checkbox','radio','button'].includes(e.target.type)){
   const scope=mOpen?$('#modal .mb'):$('.auth .c');
   if(scope&&scope.contains(e.target)){const b=scope.querySelector('.btn.y[data-a],.btn.m[data-a],.btn.bad[data-a]');if(b){e.preventDefault();b.click();return}}}
  scanKey(e)});
 document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('[data-tid]');if(c){e.dataTransfer.setData('text/plain',c.dataset.tid);e.dataTransfer.effectAllowed='move'}});
 document.addEventListener('dragover',e=>{const c=e.target.closest&&e.target.closest('.col[data-st]');if(c){e.preventDefault();c.classList.add('over')}});
 document.addEventListener('dragleave',e=>{const c=e.target.closest&&e.target.closest('.col[data-st]');if(c)c.classList.remove('over')});
 document.addEventListener('drop',e=>{const c=e.target.closest&&e.target.closest('.col[data-st]');if(c){e.preventDefault();c.classList.remove('over');const id=e.dataTransfer.getData('text/plain');if(id)tramDrop(id,c.dataset.st)}});
 ['mousemove','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,()=>{if(now()-LASTACT>2000)bumpAct()},{passive:true}));
 window.addEventListener('hashchange',()=>{route();if(ROUTE.n==='p'||ROUTE.n==='home')window.scrollTo(0,0)});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
 window.addEventListener('pagehide',()=>{flush()});
 window.addEventListener('beforeprint',()=>{});
}
async function boot(){
 if(matchMedia('(pointer:coarse)').matches)document.body.classList.add('touch');
 await idbOpen();
 await devLoad();
 META=(await kvGet(META_KEY))||null;
 const sp=buildPub(seedState());sp.ts=0;
 let emb=null;try{const x=$('#pubdata');const tx=x&&x.textContent.trim();if(tx&&tx!=='{}')emb=JSON.parse(tx)}catch(e){}
 const ip=CLOUD.on?null:await kvGet('public');
 PUB=[ip,emb,sp].filter(x=>x&&x.products).sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
 if(CLOUD.on&&(!emb||!emb.products||PUB===sp))PUB=Object.assign({},sp,{products:[],cats:[],ejemplo:false});
 bindGlobal();
 window.__raveClock=ms=>{CLK.off=ms};
 route();
 document.body.classList.remove('booting');
 if(CLOUD.on&&typeof cloudLoadPublic==='function')cloudLoadPublic();
 if(!IDB)toast('Este navegador bloquea el almacenamiento: los datos no se conservarán al cerrar.',8000)}
boot();

})();
