(() => {
'use strict';

const BUILD='polyana-filters-v3-20260818';
const STORE='pokerswipe.polyana.filters.v3';
const OLD_STORE='pokerswipe.polyana.filters.v2';
const DATA_URLS=['data/moscow_schedule_today.json','data/live_polyana.json'];
const FAR=/(краснодар|воронеж|санкт[- ]?петербург)/i;

const state={game:'',freezeout:false,bounty:false,reentry:'',addon:'',late:'',level:'',fee:'',club:''};
let events=[],loaded=false,loading=null,observer=null,raf=0,oldResetDone=false;

function esc(s){
  return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function restore(){
  try{
    const v=JSON.parse(localStorage.getItem(STORE)||'null');
    if(!v)return;
    Object.assign(state,{game:v.game||'',freezeout:!!v.freezeout,bounty:!!v.bounty,reentry:v.reentry||'',addon:v.addon||'',late:v.late||'',level:v.level||'',fee:v.fee||'',club:v.club||''});
  }catch(_){}
}
restore();
function persist(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(_){}}
function resetState(){Object.assign(state,{game:'',freezeout:false,bounty:false,reentry:'',addon:'',late:'',level:'',fee:'',club:''});persist()}

function titleOf(e){return String(e?.tournament||'').trim()}
function gameOf(name){
  const t=String(name||'').toLowerCase();
  if(/plo5|5-card|5 card|5-карточ/.test(t))return'PLO5';
  if(/plo|omaha|омаха/.test(t))return'PLO';
  if(/nlh|hold.?em|холдем/.test(t))return'NLH';
  return'';
}
function typeOf(name){
  const t=String(name||'').toLowerCase();
  if(/mystery/.test(t))return'Mystery Bounty';
  if(/bounty|knockout|баунти|нокаут/.test(t))return'Bounty';
  if(/freeze|one[\s-]?shot|фризаут/.test(t))return'Freezeout';
  return'';
}
function normalize(e,i){const t=titleOf(e);return {...e,_id:i,_title:t,_game:gameOf(t),_type:typeOf(t)}}
function allowed(e){return !FAR.test(String(e?.address||''))}
function startDate(e){
  if(!e?.date||!e?.time)return null;
  const d=new Date(`${e.date}T${e.time}:00+03:00`);
  return Number.isNaN(+d)?null:d;
}
function lateClose(e){
  const s=startDate(e);
  return s&&e.late_reg_minutes!=null?new Date(+s+Number(e.late_reg_minutes)*60000):null;
}
function addonValue(e){
  if(e?.addon_allowed===true||e?.addon_allowed===1||String(e?.addon_allowed).toLowerCase()==='true')return true;
  if(e?.addon_allowed===false||e?.addon_allowed===0||String(e?.addon_allowed).toLowerCase()==='false')return false;
  return null;
}
function feeBucket(e){
  const n=Number(e?.fee_rub);
  if(!Number.isFinite(n))return'';
  if(n===0)return'0';
  if(n<=1000)return'1000';
  if(n<=1500)return'1500';
  return'1500plus';
}

async function fetchEvents(){
  for(const url of DATA_URLS){
    try{
      const r=await fetch(url+(url.includes('?')?'&':'?')+'psf3='+Date.now(),{cache:'no-store'});
      if(!r.ok)continue;
      const d=await r.json();
      if(Array.isArray(d.events))return d.events;
    }catch(_){}
  }
  return [];
}
async function load(){
  if(loaded)return events;
  if(loading)return loading;
  loading=(async()=>{
    events=(await fetchEvents()).map(normalize);
    loaded=true;loading=null;
    return events;
  })();
  return loading;
}

function activeCount(){
  return (state.game?1:0)+(state.freezeout?1:0)+(state.bounty?1:0)+(state.reentry?1:0)+(state.addon?1:0)+(state.late?1:0)+(state.level?1:0)+(state.fee?1:0)+(state.club?1:0);
}
function matches(e){
  if(!e||!allowed(e))return false;
  if(state.game&&e._game!==state.game)return false;
  if(state.freezeout||state.bounty){
    const isFreeze=e._type==='Freezeout';
    const isBounty=e._type==='Bounty'||e._type==='Mystery Bounty';
    if(state.freezeout&&state.bounty){if(!isFreeze&&!isBounty)return false}
    else if(state.freezeout&&!isFreeze)return false;
    else if(state.bounty&&!isBounty)return false;
  }
  if(state.reentry){
    const n=Number(e.reentry_limit);
    if(!Number.isFinite(n))return false;
    if(state.reentry==='any'&&n<1)return false;
    if(state.reentry==='1'&&n!==1)return false;
    if(state.reentry==='2'&&n!==2)return false;
    if(state.reentry==='3'&&n!==3)return false;
    if(state.reentry==='4plus'&&n<4)return false;
  }
  if(state.addon){
    const a=addonValue(e);
    if(a===null)return false;
    if(state.addon==='yes'&&a!==true)return false;
    if(state.addon==='no'&&a!==false)return false;
  }
  if(state.late){
    const c=lateClose(e);
    if(state.late==='yes'&&e.late_reg_minutes==null)return false;
    if(state.late==='open'&&(!c||new Date()>=c))return false;
    if(state.late==='closed'&&(!c||new Date()<c))return false;
  }
  if(state.level&&Number(e.level_minutes)!==Number(state.level))return false;
  if(state.fee&&feeBucket(e)!==state.fee)return false;
  if(state.club&&String(e.club||'')!==state.club)return false;
  return true;
}

function hasAddonData(){return events.some(e=>addonValue(e)!==null)}
function levels(){return [...new Set(events.map(e=>Number(e.level_minutes)).filter(n=>Number.isFinite(n)&&n>0))].sort((a,b)=>a-b)}
function clubs(){return [...new Set(events.filter(allowed).map(e=>String(e.club||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'))}

function chip(label,key,value,on){
  return `<button type="button" class="psv3Chip ${on?'on':''}" data-psv3-key="${esc(key)}" data-psv3-value="${esc(value)}">${esc(label)}</button>`;
}
function section(title,body,note=''){
  return `<section class="psv3Section"><div class="psv3SectionHead"><h3>${esc(title)}</h3>${note?`<span>${esc(note)}</span>`:''}</div>${body}</section>`;
}
function overlayHtml(){
  const lv=levels(),addonReady=hasAddonData(),count=activeCount();
  return `<div class="psv3Backdrop" data-psv3-backdrop>
    <div class="psv3Sheet" role="dialog" aria-modal="true">
      <div class="psv3Top"><div><span>ПОЛЯНА · МОСКВА</span><h2>ФИЛЬТРЫ</h2></div><button type="button" class="psv3Close" data-psv3-close>×</button></div>
      ${section('Игра',`<div class="psv3Choices">${chip('NLH','game','NLH',state.game==='NLH')}${chip('PLO','game','PLO',state.game==='PLO')}${chip('PLO5','game','PLO5',state.game==='PLO5')}</div>`)}
      ${section('Формат',`<div class="psv3Choices">${chip('Freezeout','freezeout','1',state.freezeout)}${chip('Bounty','bounty','1',state.bounty)}</div>`,'можно выбрать оба')}
      ${section('Количество re-entry',`<div class="psv3Choices">${chip('Есть','reentry','any',state.reentry==='any')}${chip('1','reentry','1',state.reentry==='1')}${chip('2','reentry','2',state.reentry==='2')}${chip('3','reentry','3',state.reentry==='3')}${chip('4+','reentry','4plus',state.reentry==='4plus')}</div>`)}
      ${section('Add-on',addonReady?`<div class="psv3Choices">${chip('Есть','addon','yes',state.addon==='yes')}${chip('Нет','addon','no',state.addon==='no')}</div>`:`<div class="psv3NoData"><b>Фильтр готов.</b><span>Сегодня источник не отдаёт данные по Add-on.</span></div>`)}
      ${section('Late reg',`<div class="psv3Choices">${chip('Есть','late','yes',state.late==='yes')}${chip('Открыт сейчас','late','open',state.late==='open')}${chip('Закрыт','late','closed',state.late==='closed')}</div>`)}
      ${section('Уровни',lv.length?`<div class="psv3Choices">${lv.map(v=>chip(`${v} мин`,'level',String(v),String(state.level)===String(v))).join('')}</div>`:`<div class="psv3NoData"><b>Фильтр готов.</b><span>В сегодняшней афише пока нет длительности уровней.</span></div>`)}
      ${section('Орг. взнос',`<div class="psv3Choices">${chip('0 ₽','fee','0',state.fee==='0')}${chip('до 1 000 ₽','fee','1000',state.fee==='1000')}${chip('1 001–1 500 ₽','fee','1500',state.fee==='1500')}${chip('выше 1 500 ₽','fee','1500plus',state.fee==='1500plus')}</div>`)}
      ${section('Клуб',`<select class="psv3Select" data-psv3-club><option value="">Все клубы</option>${clubs().map(c=>`<option value="${esc(c)}" ${state.club===c?'selected':''}>${esc(c)}</option>`).join('')}</select>`)}
      <div class="psv3Actions"><button type="button" class="psv3Reset" data-psv3-reset ${count?'':'disabled'}>СБРОСИТЬ${count?` · ${count}`:''}</button><button type="button" class="psv3Apply" data-psv3-apply>ПОКАЗАТЬ ТУРНИРЫ</button></div>
    </div>
  </div>`;
}
function ensureOverlay(){
  let host=document.getElementById('polyanaFiltersV3');
  if(!host){host=document.createElement('div');host.id='polyanaFiltersV3';document.body.appendChild(host)}
  host.innerHTML=overlayHtml();bindOverlay(host);return host;
}
function openOverlay(){const host=ensureOverlay();host.classList.add('on');document.documentElement.classList.add('psv3Locked')}
function closeOverlay(){document.getElementById('polyanaFiltersV3')?.classList.remove('on');document.documentElement.classList.remove('psv3Locked')}
function rerenderOverlay(){const host=document.getElementById('polyanaFiltersV3');if(!host||!host.classList.contains('on'))return;host.innerHTML=overlayHtml();bindOverlay(host)}
function toggleSingle(key,value){state[key]=state[key]===value?'':value;persist();rerenderOverlay()}
function bindOverlay(host){
  host.querySelectorAll('[data-psv3-key]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.psv3Key,v=b.dataset.psv3Value;
    if(k==='freezeout'||k==='bounty'){state[k]=!state[k];persist();rerenderOverlay()}
    else toggleSingle(k,v);
  }));
  host.querySelector('[data-psv3-club]')?.addEventListener('change',e=>{state.club=e.currentTarget.value||'';persist();rerenderOverlay()});
  host.querySelector('[data-psv3-close]')?.addEventListener('click',closeOverlay);
  host.querySelector('[data-psv3-backdrop]')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeOverlay()});
  host.querySelector('[data-psv3-reset]')?.addEventListener('click',()=>{resetState();rerenderOverlay();applyFilters()});
  host.querySelector('[data-psv3-apply]')?.addEventListener('click',()=>{persist();applyFilters();closeOverlay()});
}
function removeOldQuickFilters(){
  const body=document.querySelector('#polyana #pspBody');if(!body)return;
  [...body.querySelectorAll('.pspSecHead')].forEach(head=>{
    if(/БЫСТРЫЕ\s+ФИЛЬТРЫ/i.test(head.textContent||'')){
      const next=head.nextElementSibling;head.remove();if(next?.classList.contains('pspQuick'))next.remove();
    }
  });
  body.querySelectorAll('.psf2Toolbar,.psf2Empty').forEach(n=>n.remove());
}
function ensureToolbar(){
  const body=document.querySelector('#polyana #pspBody');
  if(!body||!body.querySelector('.pspListHead'))return;
  removeOldQuickFilters();
  let bar=body.querySelector('.psv3Toolbar');
  if(!bar){bar=document.createElement('div');bar.className='psv3Toolbar';const head=body.querySelector('.pspListHead');head.parentNode.insertBefore(bar,head)}
  const n=activeCount();
  bar.innerHTML=`<button type="button" class="psv3Open"><span>ФИЛЬТРЫ</span><b>${n||''}</b></button>${n?'<button type="button" class="psv3QuickReset">СБРОСИТЬ</button>':''}`;
  bar.querySelector('.psv3Open').onclick=openOverlay;
  bar.querySelector('.psv3QuickReset')?.addEventListener('click',()=>{resetState();applyFilters()});
}
function applyFilters(){
  const body=document.querySelector('#polyana #pspBody');if(!body||!body.querySelector('.pspListHead'))return;
  ensureToolbar();
  const cards=[...body.querySelectorAll('.pspEvent[data-event]')];
  let shown=0;
  for(const card of cards){
    const e=events.find(x=>x._id===Number(card.dataset.event));
    const ok=e?matches(e):true;
    card.style.display=ok?'':'none';if(ok)shown++;
  }
  const count=body.querySelector('.pspListHead small');if(count)count.textContent=`${shown} событий`;
  let empty=body.querySelector('.psv3Empty');
  if(!empty){empty=document.createElement('div');empty.className='pspEmpty psv3Empty';empty.textContent='По этим фильтрам турниров сегодня нет.';body.appendChild(empty)}
  empty.style.display=shown?'none':'';
  body.querySelector('.pspList')?.style.setProperty('display',shown?'':'none');
}
function neutralizeOldV2(){
  if(oldResetDone)return;oldResetDone=true;
  try{localStorage.removeItem(OLD_STORE)}catch(_){}
  try{window.PokerSwipePolyanaFiltersV2?.reset?.()}catch(_){}
}
async function enhance(){await load();neutralizeOldV2();removeOldQuickFilters();ensureToolbar();applyFilters()}
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>enhance())}
function start(){
  load().then(schedule);
  observer=new MutationObserver(muts=>{
    if(!document.querySelector('#polyana #pspBody'))return;
    if(muts.some(m=>m.target?.closest?.('#psPolyanaArea,#pspBody')||m.target?.id==='pspBody'))schedule();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',e=>{
    const legacy=e.target.closest?.('#polyana [data-psp-filters]');
    if(legacy){e.preventDefault();e.stopImmediatePropagation();openOverlay();return}
    if(e.target.closest?.('#polyana [data-psp-tab],.nav [data-nav="polyana"]'))setTimeout(schedule,0);
  },true);
  window.addEventListener('pageshow',schedule);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.PokerSwipePolyanaFiltersV3={build:BUILD,open:openOverlay,refresh:schedule,reset:()=>{resetState();applyFilters()}};
})();