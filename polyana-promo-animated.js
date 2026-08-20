(() => {
'use strict';

/*
  PokerSwipe · Polyana animated Heads Up promo
  Adapted from the user's Figma Make animation.
  It ONLY decorates the existing .pspAd image in Polyana.
  No tournament/filter/navigation logic is changed.
*/

const BUILD = 'polyana-headsup-promo-figma-v1';
const IMG_MATCH = 'headsup_promo_frikovaya_dama';

const EMBERS = Array.from({length:38}, (_,i) => ({
  left: 52 + Math.sin(i * 1.9) * 26,
  bottom: 12 + (i % 5) * 6,
  delay: (i * 0.31) % 4.5,
  duration: 2.2 + (i % 6) * 0.4,
  size: 1.5 + (i % 4),
  ex: ((i % 9) - 4) * 12,
  color: i % 4 === 0 ? '#fff7a0' : i % 4 === 1 ? '#ffa020' : i % 4 === 2 ? '#ff6600' : '#b4ff00'
}));

const SPARKS = Array.from({length:12}, (_,i) => ({
  left: 50 + Math.cos(i * 1.5) * 24,
  top: 18 + Math.sin(i * 2.3) * 28,
  delay: (i * 0.55) % 5,
  duration: 1.3 + (i % 4) * 0.35,
  size: 5 + (i % 5) * 2.5
}));

function el(tag, cls){
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  return n;
}

function addEffects(stage){
  stage.appendChild(el('div','psPromoFxShimmer'));
  stage.appendChild(el('div','psPromoFxBorder'));
  stage.appendChild(el('div','psPromoFxScan'));

  const embers=el('div','psPromoFxEmbers');
  EMBERS.forEach(e=>{
    const p=el('i','psPromoFxEmber');
    p.style.left=e.left+'%';
    p.style.bottom=e.bottom+'%';
    p.style.width=e.size+'px';
    p.style.height=e.size+'px';
    p.style.background=e.color;
    p.style.boxShadow=`0 0 ${e.size*2.5}px ${e.color}`;
    p.style.setProperty('--ps-ex',e.ex+'px');
    p.style.animationDuration=e.duration+'s';
    p.style.animationDelay=e.delay+'s';
    embers.appendChild(p);
  });
  stage.appendChild(embers);

  const sparks=el('div','psPromoFxSparks');
  SPARKS.forEach(s=>{
    const p=el('i','psPromoFxSpark');
    p.style.left=s.left+'%';
    p.style.top=s.top+'%';
    p.style.width=s.size+'px';
    p.style.height=s.size+'px';
    p.style.animationDuration=s.duration+'s';
    p.style.animationDelay=s.delay+'s';
    p.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L13.2 10.8 L22 12 L13.2 13.2 L12 22 L10.8 13.2 L2 12 L10.8 10.8 Z" fill="#ffe566"/></svg>';
    sparks.appendChild(p);
  });
  stage.appendChild(sparks);

  [
    ['tl','rgba(180,255,0,.15)'],
    ['tr','rgba(255,130,0,.12)'],
    ['bl','rgba(180,255,0,.08)'],
    ['br','rgba(255,130,0,.08)']
  ].forEach(([pos,bg],i)=>{
    const g=el('div',`psPromoFxGlow ${pos}`);
    g.style.background=bg;
    g.style.animationDuration=(2.5+i*.4)+'s';
    g.style.animationDelay=(i*.5)+'s';
    stage.appendChild(g);
  });
}

function decorate(){
  const candidates=[...document.querySelectorAll('.pspAd img')];
  const img=candidates.find(x =>
    String(x.getAttribute('src')||'').includes(IMG_MATCH) ||
    /HEADS\s*UP|ФРИКОВАЯ\s*ДАМА/i.test(String(x.getAttribute('alt')||''))
  );
  if(!img)return false;

  const ad=img.closest('.pspAd');
  if(!ad)return false;
  if(ad.dataset.psPromoBuild===BUILD)return true;

  let stage=img.closest('.psPromoFxStage');
  if(!stage){
    stage=el('div','psPromoFxStage');
    img.parentNode.insertBefore(stage,img);
    stage.appendChild(img);
  }

  stage.querySelectorAll('.psPromoFxShimmer,.psPromoFxBorder,.psPromoFxScan,.psPromoFxEmbers,.psPromoFxSparks,.psPromoFxGlow').forEach(n=>n.remove());
  addEffects(stage);

  img.classList.add('psPromoFxImage');
  ad.classList.add('pspAdAnimated');
  ad.dataset.psPromoBuild=BUILD;
  stage.dataset.psPromoBuild=BUILD;
  return true;
}

let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    decorate();
  });
}

const observer=new MutationObserver(schedule);

function start(){
  decorate();
  const host=document.querySelector('#polyana')||document.body;
  observer.observe(host,{subtree:true,childList:true});
  window.addEventListener('pageshow',schedule);
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-nav],[data-psp-tab],[data-psp-filters]')) setTimeout(schedule,0);
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

window.PokerSwipePolyanaPromo={refresh:decorate,build:BUILD};
})();

/* ============================================================
   PokerSwipe · POLYANA FILTERS V2
   - removes quick filters from the Today screen
   - replaces the filter sheet with the approved filter set:
     Игра / Freezeout / Bounty / количество re-entry / Add-on /
     Late reg / уровни / орг. взнос / клуб
   - isolated overlay: does not change solver, home, map or club pages
   ============================================================ */
(() => {
'use strict';

/* Deactivated when the canonical Polyana build owns filtering (it sets
   window.__PSP_NATIVE_POLYANA). The promo decor above still runs; only this
   duplicate filter sheet is disabled. */
if(window.__PSP_NATIVE_POLYANA){window.PokerSwipePolyanaFiltersV2={build:'polyana-filters-v2',refresh(){},reset(){}};return}

const BUILD='polyana-filters-v2';
const STORE='pokerswipe.polyana.filters.v2';
const DATA_URLS=['data/moscow_schedule_today.json','data/live_polyana.json'];
const FAR=/(краснодар|воронеж|санкт[- ]?петербург)/i;

const state={
  game:'',
  formats:new Set(),
  reentry:'',
  addon:'',
  late:'',
  level:'',
  fee:'',
  club:''
};

let events=[];
let loaded=false;
let loading=null;
let scheduled=false;

function esc(s){
  return String(s??'').replace(/[&<>"']/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function restore(){
  try{
    const v=JSON.parse(localStorage.getItem(STORE)||'null');
    if(!v)return;
    state.game=v.game||'';
    state.formats=new Set(Array.isArray(v.formats)?v.formats:[]);
    state.reentry=v.reentry||'';
    state.addon=v.addon||'';
    state.late=v.late||'';
    state.level=v.level||'';
    state.fee=v.fee||'';
    state.club=v.club||'';
  }catch(_){}
}
restore();

function persist(){
  try{
    localStorage.setItem(STORE,JSON.stringify({
      game:state.game,
      formats:[...state.formats],
      reentry:state.reentry,
      addon:state.addon,
      late:state.late,
      level:state.level,
      fee:state.fee,
      club:state.club
    }));
  }catch(_){}
}

function resetState(){
  state.game='';
  state.formats.clear();
  state.reentry='';
  state.addon='';
  state.late='';
  state.level='';
  state.fee='';
  state.club='';
  persist();
}

function gameOf(n){
  const t=String(n||'').toLowerCase();
  if(/plo5|5-card|5 card|5-карточ/.test(t))return'PLO5';
  if(/plo|omaha|омаха/.test(t))return'PLO';
  if(/nlh|hold.?em|холдем/.test(t))return'NLH';
  return'';
}

function typeOf(n){
  const t=String(n||'').toLowerCase();
  if(/mystery/.test(t))return'Mystery Bounty';
  if(/bounty|knockout|баунти|нокаут/.test(t))return'Bounty';
  if(/freeze|one[\s-]?shot|фризаут/.test(t))return'Freezeout';
  return'';
}

function normalize(e,i){
  const title=String(e.tournament||'').trim();
  return {
    ...e,
    _id:i,
    _title:title,
    _game:gameOf(title),
    _type:typeOf(title)
  };
}

function allowed(e){
  return !FAR.test(String(e.address||''));
}

function startDate(e){
  if(!e.date||!e.time)return null;
  const d=new Date(`${e.date}T${e.time}:00+03:00`);
  return Number.isNaN(+d)?null:d;
}

function lateClose(e){
  const s=startDate(e);
  return s&&e.late_reg_minutes!=null
    ? new Date(+s+Number(e.late_reg_minutes)*60000)
    : null;
}

function addonValue(e){
  if(e.addon_allowed===true || e.addon_allowed===1 || String(e.addon_allowed).toLowerCase()==='true')return true;
  if(e.addon_allowed===false || e.addon_allowed===0 || String(e.addon_allowed).toLowerCase()==='false')return false;
  return null;
}

async function fetchFirst(){
  for(const url of DATA_URLS){
    try{
      const r=await fetch(url+(url.includes('?')?'&':'?')+'psf2='+Date.now(),{cache:'no-store'});
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
    const rows=await fetchFirst();
    events=rows.map(normalize);
    loaded=true;
    loading=null;
    return events;
  })();
  return loading;
}

function hasAddonData(){
  return events.some(e=>addonValue(e)!==null);
}
function hasLevelData(){
  return events.some(e=>Number.isFinite(Number(e.level_minutes))&&Number(e.level_minutes)>0);
}

function feeBucket(e){
  const n=Number(e.fee_rub);
  if(!Number.isFinite(n))return'';
  if(n===0)return'free';
  if(n<=1000)return'1000';
  if(n<=1500)return'1500';
  return'1500plus';
}

function matches(e){
  if(!allowed(e))return false;

  if(state.game && e._game!==state.game)return false;

  if(state.formats.size){
    let ok=false;
    if(state.formats.has('Freezeout') && e._type==='Freezeout')ok=true;
    if(state.formats.has('Bounty') && (e._type==='Bounty'||e._type==='Mystery Bounty'))ok=true;
    if(!ok)return false;
  }

  if(state.reentry){
    const n=Number(e.reentry_limit);
    if(!Number.isFinite(n))return false;
    if(state.reentry==='any' && n<1)return false;
    if(state.reentry==='1' && n!==1)return false;
    if(state.reentry==='2' && n!==2)return false;
    if(state.reentry==='3' && n!==3)return false;
    if(state.reentry==='4plus' && n<4)return false;
  }

  if(state.addon){
    const a=addonValue(e);
    if(a===null)return false;
    if(state.addon==='yes' && a!==true)return false;
    if(state.addon==='no' && a!==false)return false;
  }

  if(state.late){
    const c=lateClose(e);
    if(state.late==='yes' && e.late_reg_minutes==null)return false;
    if(state.late==='open' && (!c || new Date()>=c))return false;
    if(state.late==='closed' && (!c || new Date()<c))return false;
  }

  if(state.level){
    if(Number(e.level_minutes)!==Number(state.level))return false;
  }

  if(state.fee && feeBucket(e)!==state.fee)return false;

  if(state.club && String(e.club||'')!==state.club)return false;

  return true;
}

function activeCount(){
  return (state.game?1:0)+
    state.formats.size+
    (state.reentry?1:0)+
    (state.addon?1:0)+
    (state.late?1:0)+
    (state.level?1:0)+
    (state.fee?1:0)+
    (state.club?1:0);
}

function chip(label,key,value,on,disabled=false){
  return `<button type="button" class="psf2Chip ${on?'on':''} ${disabled?'disabled':''}"
    data-psf2-key="${esc(key)}" data-psf2-value="${esc(value)}" ${disabled?'disabled':''}>${esc(label)}</button>`;
}

function block(title,body,note=''){
  return `<section class="psf2Block"><div class="psf2BlockHead"><h4>${esc(title)}</h4>${note?`<span>${esc(note)}</span>`:''}</div>${body}</section>`;
}

function levelButtons(){
  const vals=[...new Set(events
    .map(e=>Number(e.level_minutes))
    .filter(n=>Number.isFinite(n)&&n>0))]
    .sort((a,b)=>a-b);

  if(!vals.length){
    return `<div class="psf2Unavailable">Данных по длительности уровней пока нет в источнике. Фильтр уже готов и включится автоматически, когда они появятся.</div>`;
  }
  return `<div class="psf2Choices">${vals.map(v=>chip(`${v} мин`,'level',String(v),String(state.level)===String(v))).join('')}</div>`;
}

function clubSelect(){
  const clubs=[...new Set(events.filter(allowed).map(e=>String(e.club||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'ru'));
  return `<select class="psf2Select" data-psf2-club>
    <option value="">Все клубы</option>
    ${clubs.map(c=>`<option value="${esc(c)}" ${state.club===c?'selected':''}>${esc(c)}</option>`).join('')}
  </select>`;
}

function renderSheet(){
  const sheet=document.querySelector('#polyana #pspFilters .pspSheet');
  if(!sheet)return;
  if(sheet.dataset.psf2Build===BUILD && !sheet.dataset.psf2Dirty)return;

  const addonReady=hasAddonData();
  const count=activeCount();

  sheet.innerHTML=`
    <div class="psf2Head">
      <div><span>ПОЛЯНА · МОСКВА</span><h2>ФИЛЬТРЫ</h2></div>
      <button type="button" class="psf2Close" data-psf2-close>✕</button>
    </div>

    ${block('Игра',
      `<div class="psf2Choices">
        ${chip('NLH','game','NLH',state.game==='NLH')}
        ${chip('PLO','game','PLO',state.game==='PLO')}
        ${chip('PLO5','game','PLO5',state.game==='PLO5')}
      </div>`
    )}

    ${block('Формат',
      `<div class="psf2Choices">
        ${chip('Freezeout','format','Freezeout',state.formats.has('Freezeout'))}
        ${chip('Bounty','format','Bounty',state.formats.has('Bounty'))}
      </div>`,
      'можно выбрать оба'
    )}

    ${block('Количество re-entry',
      `<div class="psf2Choices">
        ${chip('Есть','reentry','any',state.reentry==='any')}
        ${chip('1','reentry','1',state.reentry==='1')}
        ${chip('2','reentry','2',state.reentry==='2')}
        ${chip('3','reentry','3',state.reentry==='3')}
        ${chip('4+','reentry','4plus',state.reentry==='4plus')}
      </div>`
    )}

    ${block('Add-on',
      addonReady
        ? `<div class="psf2Choices">
            ${chip('Есть','addon','yes',state.addon==='yes')}
            ${chip('Нет','addon','no',state.addon==='no')}
          </div>`
        : `<div class="psf2Unavailable">Источник пока не отдаёт Add-on по сегодняшней афише. Сам фильтр уже стоит и активируется автоматически, когда поле появится.</div>`
    )}

    ${block('Late reg',
      `<div class="psf2Choices">
        ${chip('Есть late reg','late','yes',state.late==='yes')}
        ${chip('Открыт сейчас','late','open',state.late==='open')}
        ${chip('Закрыт','late','closed',state.late==='closed')}
      </div>`
    )}

    ${block('Уровни',levelButtons())}

    ${block('Орг. взнос',
      `<div class="psf2Choices">
        ${chip('0 ₽','fee','free',state.fee==='free')}
        ${chip('до 1 000 ₽','fee','1000',state.fee==='1000')}
        ${chip('1 001–1 500 ₽','fee','1500',state.fee==='1500')}
        ${chip('выше 1 500 ₽','fee','1500plus',state.fee==='1500plus')}
      </div>`
    )}

    ${block('Клуб',clubSelect())}

    <div class="psf2Footer">
      <button type="button" class="psf2Reset" data-psf2-reset ${count?'':'disabled'}>СБРОСИТЬ${count?` · ${count}`:''}</button>
      <button type="button" class="psf2Apply" data-psf2-apply>ПОКАЗАТЬ ТУРНИРЫ</button>
    </div>`;

  sheet.dataset.psf2Build=BUILD;
  delete sheet.dataset.psf2Dirty;
  bindSheet(sheet);
}

function setSingle(key,value){
  state[key]=state[key]===value?'':value;
  persist();
}

function bindSheet(sheet){
  sheet.querySelectorAll('[data-psf2-key]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key=btn.dataset.psf2Key;
      const value=btn.dataset.psf2Value;
      if(key==='format'){
        state.formats.has(value)?state.formats.delete(value):state.formats.add(value);
        persist();
      }else{
        setSingle(key,value);
      }
      sheet.dataset.psf2Dirty='1';
      renderSheet();
    });
  });

  sheet.querySelector('[data-psf2-club]')?.addEventListener('change',e=>{
    state.club=e.currentTarget.value||'';
    persist();
    sheet.dataset.psf2Dirty='1';
    renderSheet();
  });

  sheet.querySelector('[data-psf2-close]')?.addEventListener('click',()=>{
    document.querySelector('#polyana #pspFilters')?.classList.remove('on');
  });

  sheet.querySelector('[data-psf2-reset]')?.addEventListener('click',()=>{
    resetState();
    sheet.dataset.psf2Dirty='1';
    renderSheet();
    applyToToday();
  });

  sheet.querySelector('[data-psf2-apply]')?.addEventListener('click',()=>{
    persist();
    document.querySelector('#polyana #pspFilters')?.classList.remove('on');
    applyToToday();
  });
}

function removeQuickFilters(body){
  if(!body)return;
  const sec=body.querySelector(':scope > .pspSecHead');
  if(sec)sec.remove();
  const quick=body.querySelector(':scope > .pspQuick');
  if(quick)quick.remove();
}

function toolbar(){
  const n=document.createElement('div');
  n.className='psf2Toolbar';
  n.dataset.psf2Toolbar=BUILD;
  n.innerHTML=`
    <button type="button" class="psf2ToolbarMain" data-psf2-open>
      <span>ФИЛЬТРЫ</span><b data-psf2-count></b>
    </button>
    <button type="button" class="psf2ToolbarReset" data-psf2-toolbar-reset>СБРОСИТЬ</button>`;
  n.querySelector('[data-psf2-open]').addEventListener('click',()=>{
    renderSheet();
    document.querySelector('#polyana #pspFilters')?.classList.add('on');
  });
  n.querySelector('[data-psf2-toolbar-reset]').addEventListener('click',()=>{
    resetState();
    renderSheet();
    applyToToday();
  });
  return n;
}

function ensureToolbar(body){
  if(!body)return null;
  let bar=body.querySelector('[data-psf2-toolbar]');
  if(!bar){
    const head=body.querySelector('.pspListHead');
    if(!head)return null;
    bar=toolbar();
    head.parentNode.insertBefore(bar,head);
  }
  const n=activeCount();
  const badge=bar.querySelector('[data-psf2-count]');
  const reset=bar.querySelector('[data-psf2-toolbar-reset]');
  if(badge)badge.textContent=n?String(n):'';
  if(reset)reset.hidden=!n;
  bar.classList.toggle('active',n>0);
  return bar;
}

function emptyNode(list){
  let n=document.querySelector('#polyana #pspBody .psf2Empty');
  if(!n){
    n=document.createElement('div');
    n.className='pspEmpty psf2Empty';
    n.textContent='По этим фильтрам турниров сегодня нет. Сними один из фильтров или сбрось всё.';
    list?.parentNode?.insertBefore(n,list.nextSibling);
  }
  return n;
}

function applyToToday(){
  const body=document.querySelector('#polyana #pspBody');
  if(!body || !body.querySelector('.pspListHead'))return;

  removeQuickFilters(body);
  ensureToolbar(body);

  const cards=[...body.querySelectorAll('.pspEvent[data-event]')];
  if(!cards.length)return;

  let visible=0;
  cards.forEach(card=>{
    const id=Number(card.dataset.event);
    const e=events.find(x=>x._id===id);
    const show=e?matches(e):true;
    card.hidden=!show;
    if(show)visible++;
  });

  const count=body.querySelector('.pspListHead small');
  if(count)count.textContent=`${visible} событий`;

  const list=body.querySelector('.pspList');
  const empty=emptyNode(list);
  if(empty)empty.hidden=visible!==0;
  if(list)list.hidden=visible===0;

  const bar=body.querySelector('[data-psf2-toolbar]');
  if(bar){
    const n=activeCount();
    const badge=bar.querySelector('[data-psf2-count]');
    const reset=bar.querySelector('[data-psf2-toolbar-reset]');
    if(badge)badge.textContent=n?String(n):'';
    if(reset)reset.hidden=!n;
    bar.classList.toggle('active',n>0);
  }
}

function ensureStyles(){
  if(document.getElementById('polyana-filters-v2-style'))return;
  const style=document.createElement('style');
  style.id='polyana-filters-v2-style';
  style.textContent=`
#polyana .psf2Toolbar{
  display:flex;align-items:center;gap:8px;margin:18px 0 2px;
}
#polyana .psf2ToolbarMain{
  min-height:44px;flex:1;border:1px solid #34343d;border-radius:14px;
  background:linear-gradient(145deg,#111117,#0d0d12);color:#f5f2f6;
  padding:0 14px;display:flex;align-items:center;justify-content:space-between;
  font-size:10px;font-weight:1000;letter-spacing:.08em;
}
#polyana .psf2ToolbarMain b{
  min-width:22px;height:22px;padding:0 7px;border-radius:999px;display:grid;place-items:center;
  background:#202028;color:#8d8790;font-size:9px;
}
#polyana .psf2Toolbar.active .psf2ToolbarMain{
  border-color:#718b25;box-shadow:0 0 20px #c8ff3d16;
}
#polyana .psf2Toolbar.active .psf2ToolbarMain b{
  background:#c8ff3d;color:#11150b;
}
#polyana .psf2ToolbarReset{
  min-height:44px;border:1px solid #34343d;border-radius:14px;background:#0d0d12;
  color:#8f8992;padding:0 12px;font-size:8px;font-weight:1000;
}
#polyana .psf2Head{
  display:flex;align-items:flex-start;justify-content:space-between;gap:15px;
  padding-bottom:12px;
}
#polyana .psf2Head span{
  display:block;color:#c8ff3d;font-size:8px;font-weight:1000;letter-spacing:.13em;margin-bottom:5px;
}
#polyana .psf2Head h2{
  margin:0;font-size:28px;line-height:1;font-weight:1000;letter-spacing:-.05em;
}
#polyana .psf2Close{
  width:38px;height:38px;border:1px solid #34343d;border-radius:50%;
  background:#17171d;color:#fff;font-size:16px;
}
#polyana .psf2Block{
  padding:14px 0;border-top:1px solid #26262d;
}
#polyana .psf2BlockHead{
  display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:9px;
}
#polyana .psf2BlockHead h4{
  margin:0;color:#f3eff4;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;
}
#polyana .psf2BlockHead span{
  color:#6f6972;font-size:7px;
}
#polyana .psf2Choices{
  display:flex;flex-wrap:wrap;gap:7px;
}
#polyana .psf2Chip{
  min-height:39px;border:1px solid #34343d;border-radius:12px;background:#121217;
  color:#c8c2ca;padding:0 13px;font-size:9px;font-weight:900;
}
#polyana .psf2Chip.on{
  border-color:#718b25;background:#1a220f;color:#dfff82;
  box-shadow:0 0 18px #c8ff3d16;
}
#polyana .psf2Chip.disabled,#polyana .psf2Chip:disabled{
  opacity:.38;filter:saturate(.2);
}
#polyana .psf2Unavailable{
  border:1px dashed #34343d;border-radius:12px;background:#0d0d11;color:#77717a;
  padding:11px;font-size:8px;line-height:1.45;
}
#polyana .psf2Select{
  width:100%;min-height:46px;border:1px solid #34343d;border-radius:12px;
  background:#121217;color:#fff;padding:0 12px;font-size:10px;font-weight:800;
  outline:none;
}
#polyana .psf2Footer{
  position:sticky;bottom:calc(-24px - env(safe-area-inset-bottom));
  display:grid;grid-template-columns:.42fr 1fr;gap:8px;
  padding:12px 0 calc(24px + env(safe-area-inset-bottom));
  margin-top:4px;background:linear-gradient(transparent,#101014 16%,#101014);
}
#polyana .psf2Reset,#polyana .psf2Apply{
  min-height:48px;border-radius:13px;font-size:9px;font-weight:1000;
}
#polyana .psf2Reset{
  border:1px solid #34343d;background:#15151a;color:#aaa3ad;
}
#polyana .psf2Reset:disabled{opacity:.35}
#polyana .psf2Apply{
  border:0;background:#c8ff3d;color:#11150b;
  box-shadow:0 10px 30px #c8ff3d1a;
}
#polyana .pspEvent[hidden]{display:none!important}
#polyana .psf2Empty[hidden]{display:none!important}
@media(max-width:390px){
  #polyana .psf2Chip{padding:0 11px}
  #polyana .psf2Footer{grid-template-columns:.46fr 1fr}
}`;
  document.head.appendChild(style);
}

async function enhance(){
  ensureStyles();
  await load();

  const polyana=document.querySelector('#polyana');
  if(!polyana)return;

  renderSheet();

  const body=polyana.querySelector('#pspBody');
  if(body && body.querySelector('.pspListHead')){
    removeQuickFilters(body);
    ensureToolbar(body);
    applyToToday();
  }
}

function scheduleEnhance(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    enhance();
  });
}

const observer=new MutationObserver(muts=>{
  if(!document.querySelector('#polyana'))return;
  const relevant=muts.some(m=>{
    const t=m.target;
    return t?.id==='pspBody' || t?.id==='pspFilters' ||
      t?.closest?.('#pspBody,#pspFilters,#psPolyanaArea');
  });
  if(relevant)scheduleEnhance();
});

function start(){
  ensureStyles();
  load().then(scheduleEnhance);
  observer.observe(document.documentElement,{subtree:true,childList:true});

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#polyana [data-psp-filters]')){
      setTimeout(()=>{
        renderSheet();
        document.querySelector('#polyana #pspFilters')?.classList.add('on');
      },0);
    }
    if(e.target.closest?.('#polyana [data-psp-tab],.nav [data-nav="polyana"]')){
      setTimeout(scheduleEnhance,0);
    }
  },true);

  window.addEventListener('pageshow',scheduleEnhance);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

window.PokerSwipePolyanaFiltersV2={
  refresh:scheduleEnhance,
  reset:()=>{resetState();renderSheet();applyToToday()},
  build:BUILD
};
})();