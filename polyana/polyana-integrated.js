(() => {
'use strict';
window.__POLYANA_BUILD='polyana-map-all-points-2026-08-19';

/* Canonical Polyana owns filtering/navigation. Legacy injected filter
   patches (polyana-filters-v3.js and the V2 sheet inside
   polyana-promo-animated.js) deactivate themselves when this flag is set,
   avoiding duplicate filter UI and document-wide MutationObserver loops. */
window.__PSP_NATIVE_POLYANA=true;

const ROOT_ID='psPolyanaArea';
const DATA_URLS=['data/moscow_schedule_today.json','data/live_polyana.json'];
const CLUB_URLS=['data/moscow_club_locations_source.json','data/moscow_clubs_pokernomoney.json','data/live_polyana.json'];
const BAD=/^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|следующая игра|ближайшая игра|в избранное|запись на месте в один клик)$/i;
const FAR=/(краснодар|воронеж|санкт[- ]?петербург)/i;
const FAV_KEY='psp-polyana-favorite-clubs-v1';

const state={
  tab:'today',
  events:[],
  clubs:[],
  filters:{
    game:'',
    freezeout:'',
    bounty:'',
    reentry:'',
    addon:'',
    late:'',
    levels:'',
    fee:'',
    district:'',
    favoriteOnly:false,
    clubs:new Set()
  },
  favorites:loadFavorites(),
  loaded:false,
  lateTimer:null
};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const root=()=>document.getElementById(ROOT_ID);
const normName=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');

function loadFavorites(){
  try{
    const raw=JSON.parse(localStorage.getItem(FAV_KEY)||'[]');
    return new Set(Array.isArray(raw)?raw.map(normName).filter(Boolean):[]);
  }catch(_){return new Set()}
}
function saveFavorites(){
  try{localStorage.setItem(FAV_KEY,JSON.stringify([...state.favorites]))}catch(_){}
}
function isFavorite(name){return state.favorites.has(normName(name))}
function toggleFavorite(name){
  const k=normName(name);if(!k)return;
  state.favorites.has(k)?state.favorites.delete(k):state.favorites.add(k);
  saveFavorites();
}

function cleanTitle(e){
  const n=String(e.tournament||'').trim();
  return !n||BAD.test(n)?'Турнир клуба':n;
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
  if(/freeze|фризаут/.test(t))return'Freezeout';
  if(/freeroll|бесплат/.test(t))return'Freeroll';
  if(/turbo/.test(t))return'Turbo';
  if(/deep/.test(t))return'Deepstack';
  return'';
}
function normalize(e,i){
  const title=cleanTitle(e);
  const type=String(e.type||e.format||typeOf(title)||'').trim();
  const typeKey=type.toLowerCase();
  const game=String(e.game||gameOf(title)||'').toUpperCase();
  const t=title.toLowerCase();

  const isFreezeout=e.freezeout===true||typeKey==='freezeout'||/freeze|фризаут/.test(t);
  const isBounty=e.bounty===true||typeKey==='bounty'||typeKey==='mystery bounty'||/bounty|knockout|баунти|нокаут/.test(t);
  const isFreeroll=typeKey==='freeroll'||/freeroll|бесплат/.test(t);

  const rawRe=e.reentry_limit;
  const reentryUnlimited=e.reentry_unlimited===true||/unlimited|безлимит|∞|infinity/i.test(String(rawRe??''));
  let reentryCount=null;
  if(!reentryUnlimited&&rawRe!==null&&rawRe!==undefined&&rawRe!==''&&Number.isFinite(Number(rawRe))){
    reentryCount=Number(rawRe);
  }else if(isFreezeout){
    reentryCount=0;
  }

  return {
    ...e,
    _id:i,
    _title:title,
    _game:['NLH','PLO','PLO5'].includes(game)?game:gameOf(title),
    _type:type||typeOf(title),
    _isFreezeout:isFreezeout,
    _isBounty:isBounty,
    _isFreeroll:isFreeroll,
    _reentryCount:reentryCount,
    _reentryUnlimited:reentryUnlimited
  };
}

function fee(e){
  const n=Number(e.fee_rub);
  if(Number.isFinite(n)&&n>0)return n.toLocaleString('ru-RU')+' ₽';
  if(e._isFreeroll)return'Freeroll';
  return'Уточняется';
}
function startDate(e){
  if(!e.date||!e.time)return null;
  const time=String(e.time).trim();
  const normalizedTime=/^\d{2}:\d{2}$/.test(time)?`${time}:00`:time;
  const d=new Date(`${e.date}T${normalizedTime}+03:00`);
  return Number.isNaN(+d)?null:d;
}
function lateClose(e){
  const s=startDate(e),raw=e.late_reg_minutes;
  if(!s||raw===null||raw===undefined||raw==='')return null;
  const m=Number(raw);
  return Number.isFinite(m)&&m>=0?new Date(+s+m*60000):null;
}
function moscowClock(d){
  return d.toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'});
}
function remainingText(ms){
  const sec=Math.max(0,Math.ceil(ms/1000));
  if(sec<=600){
    const m=Math.floor(sec/60),s=sec%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  const min=Math.ceil(sec/60);
  if(min>=60)return `${Math.floor(min/60)} ч ${min%60} мин`;
  return `${min} мин`;
}
function lateRegInfo(e,nowMs=Date.now()){
  const c=lateClose(e);if(!c)return null;
  const diff=+c-nowMs,until=moscowClock(c);
  if(diff<=0)return {open:false,urgent:false,remainingMs:0,text:`Late reg закрыт · ${until}`};
  return {
    open:true,
    urgent:diff<=10*60000,
    remainingMs:diff,
    text:`Late reg до ${until} · осталось ${remainingText(diff)}`
  };
}
function allowed(e){return !FAR.test(e.address||'')}

function numKnown(v){
  return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
}
function districtOf(e){
  return String(e.district||e.admin_district||'').trim();
}
function match(e){
  if(!allowed(e))return false;
  const f=state.filters;

  if(f.game&&e._game!==f.game)return false;

  if(f.freezeout==='yes'&&!e._isFreezeout)return false;
  if(f.freezeout==='no'&&e._isFreezeout)return false;

  if(f.bounty==='yes'&&!e._isBounty)return false;
  if(f.bounty==='no'&&e._isBounty)return false;

  if(f.reentry){
    if(f.reentry==='unlimited'){
      if(!e._reentryUnlimited)return false;
    }else if(f.reentry==='4plus'){
      if(e._reentryUnlimited||!Number.isFinite(e._reentryCount)||e._reentryCount<4)return false;
    }else{
      const n=Number(f.reentry);
      if(!Number.isFinite(e._reentryCount)||e._reentryCount!==n)return false;
    }
  }

  if(f.addon==='yes'&&e.addon_allowed!==true)return false;
  if(f.addon==='no'&&e.addon_allowed!==false)return false;

  if(f.late){
    const m=numKnown(e.late_reg_minutes)?Number(e.late_reg_minutes):null;
    if(f.late==='open'){
      if(!lateRegInfo(e)?.open)return false;
    }else if(f.late==='none'){
      if(!(m===0||e.late_reg_allowed===false))return false;
    }else if(f.late==='upto60'){
      if(!(m>0&&m<=60))return false;
    }else if(f.late==='60to120'){
      if(!(m>60&&m<=120))return false;
    }else if(f.late==='120plus'){
      if(!(m>120))return false;
    }
  }

  if(f.levels){
    const m=numKnown(e.level_minutes)?Number(e.level_minutes):null;
    if(m===null)return false;
    if(f.levels==='10to15'&&!(m>=10&&m<=15))return false;
    if(f.levels==='20'&&m!==20)return false;
    if(f.levels==='25to30'&&!(m>=25&&m<=30))return false;
    if(f.levels==='40plus'&&m<40)return false;
  }

  if(f.fee){
    const n=Number(e.fee_rub);
    if(!Number.isFinite(n)||n<=0)return false;
    if(f.fee==='lte500'&&n>500)return false;
    if(f.fee==='lte1000'&&n>1000)return false;
    if(f.fee==='gt1000'&&n<=1000)return false;
  }

  if(f.clubs.size&& !f.clubs.has(normName(e.club)))return false;
  if(f.favoriteOnly&&!isFavorite(e.club))return false;

  if(f.district&&districtOf(e)!==f.district)return false;

  return true;
}

async function fetchFirst(urls,key){
  for(const u of urls){
    try{
      const r=await fetch(u+(u.includes('?')?'&':'?')+'ts='+Date.now(),{cache:'no-store'});
      if(!r.ok)continue;
      const d=await r.json();
      if(Array.isArray(d[key]))return d;
    }catch(_){}
  }
  return {[key]:[]};
}

function filterBlock(title,key,vals){
  return `<div class="pspBlock"><h4>${esc(title)}</h4><div class="pspFilterGrid">${
    vals.map(([l,v])=>`<button type="button" class="pspChip pspChoice ${state.filters[key]===v?'on':''}" data-key="${esc(key)}" data-value="${esc(v)}">${esc(l)}</button>`).join('')
  }</div></div>`;
}
function eventClubNames(){
  return [...new Set(state.events.filter(allowed).map(e=>String(e.club||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'ru'));
}
function districtOptions(){
  return [...new Set(state.events.map(districtOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
}
function filterSheet(){
  const clubs=eventClubNames();
  const districts=districtOptions();
  const filteredCount=state.events.filter(match).length;

  return `<div id="pspFilters" class="pspSheetBg pspFiltersOverlay" aria-hidden="true">
    <div class="pspSheet pspFilterSheet" role="dialog" aria-modal="true" aria-label="Фильтры Поляны" tabindex="-1">
      <div class="pspSheetHead">
        <div><span>ПОЛЯНА</span><h2>Фильтры</h2></div>
        <button type="button" class="pspClose" data-psp-close aria-label="Закрыть">✕</button>
      </div>

      ${filterBlock('Игра','game',[['NLH','NLH'],['PLO','PLO'],['PLO5','PLO5']])}
      ${filterBlock('Freezeout','freezeout',[['Есть','yes'],['Нет','no']])}
      ${filterBlock('Bounty','bounty',[['Есть','yes'],['Нет','no']])}
      ${filterBlock('Количество re-entry','reentry',[['0','0'],['1','1'],['2','2'],['3','3'],['4+','4plus'],['Безлимит','unlimited']])}
      ${filterBlock('Add-on','addon',[['Есть','yes'],['Нет','no']])}
      ${filterBlock('Late reg','late',[['Открыт сейчас','open'],['Нет','none'],['До 1 ч','upto60'],['1–2 ч','60to120'],['2 ч+','120plus']])}
      ${filterBlock('Уровни','levels',[['10–15 мин','10to15'],['20 мин','20'],['25–30 мин','25to30'],['40+ мин','40plus']])}
      ${filterBlock('Орг. взнос','fee',[['До 500 ₽','lte500'],['До 1 000 ₽','lte1000'],['Больше 1 000 ₽','gt1000']])}

      <div class="pspBlock">
        <h4>Любимые клубы</h4>
        <button type="button" class="pspFavoriteOnly ${state.filters.favoriteOnly?'on':''}" data-favorite-only>
          <span>★</span> Только любимые клубы
        </button>
      </div>

      <div class="pspBlock">
        <h4>Клуб</h4>
        <input class="pspFilterSearch" data-club-filter-search placeholder="Найти клуб" autocomplete="off">
        <div class="pspClubFilterList" data-club-filter-list>
          ${clubs.map(name=>{
            const k=normName(name),on=state.filters.clubs.has(k);
            return `<button type="button" class="pspClubChoice ${on?'on':''}" data-filter-club="${esc(name)}">
              <span>${isFavorite(name)?'★ ':''}${esc(name)}</span><i>${on?'✓':''}</i>
            </button>`;
          }).join('')}
        </div>
      </div>

      ${districts.length?`<div class="pspBlock"><h4>Район</h4><div class="pspFilterGrid">${
        districts.map(v=>`<button type="button" class="pspChip pspChoice ${state.filters.district===v?'on':''}" data-key="district" data-value="${esc(v)}">${esc(v)}</button>`).join('')
      }</div></div>`:''}

      <div class="pspSheetFooter">
        <button type="button" class="pspFilterReset" data-filter-reset>Сбросить</button>
        <button type="button" class="pspApply" data-psp-apply>ПОКАЗАТЬ ${filteredCount} ТУРНИРОВ</button>
      </div>
    </div>
  </div>`;
}

function shell(){
  return `<div class="pspTop"><div class="pspLogo">POKER <i>SWIPE</i></div><div class="pspBy">by ФРИКОВАЯ ДАМА 💋</div></div>
  <div class="pspHero"><div><h1>ПОЛЯНА<span>.</span></h1><p>Навигатор по спортивному покеру Москвы.</p></div></div>
  <div class="pspTabs"><button type="button" class="pspTab ${state.tab==='today'?'on':''}" data-psp-tab="today">СЕГОДНЯ</button><button type="button" class="pspTab ${state.tab==='clubs'?'on':''}" data-psp-tab="clubs">КЛУБЫ</button><button type="button" class="pspTab ${state.tab==='map'?'on':''}" data-psp-tab="map">КАРТА</button></div>
  <div class="pspAd"><div class="pspAdLabel">Партнёрское предложение</div><img src="assets/headsup_promo_frikovaya_dama.jpeg" alt="HEADS UP — промокод ФРИКОВАЯ ДАМА, бесплатный re-entry"></div>
  <div class="pspFresh"><strong><span class="pspFreshDot"></span>АФИША ОБНОВЛЕНА</strong><div class="pspFreshMeta"><b>${state.clubs.length}</b> клубов · <b>${state.events.filter(allowed).length}</b> событий</div></div>
  <div id="pspBody"></div>
  ${filterSheet()}
  <div id="pspDetail" class="pspSheetBg pspFiltersOverlay" aria-hidden="true"><div class="pspSheet"><button type="button" class="pspClose" data-psp-detail-close>Закрыть</button><div id="pspDetailBody"></div></div></div>`;
}

function activeFilters(){
  const f=state.filters,a=[];
  if(f.game)a.push(f.game);
  if(f.freezeout)a.push(`Freezeout: ${f.freezeout==='yes'?'есть':'нет'}`);
  if(f.bounty)a.push(`Bounty: ${f.bounty==='yes'?'есть':'нет'}`);
  if(f.reentry)a.push(`Re-entry: ${f.reentry==='4plus'?'4+':f.reentry==='unlimited'?'безлимит':f.reentry}`);
  if(f.addon)a.push(`Add-on: ${f.addon==='yes'?'есть':'нет'}`);
  if(f.late)a.push(`Late reg: ${({'open':'открыт','none':'нет','upto60':'до 1ч','60to120':'1–2ч','120plus':'2ч+'})[f.late]}`);
  if(f.levels)a.push(`Уровни: ${({'10to15':'10–15','20':'20','25to30':'25–30','40plus':'40+'})[f.levels]} мин`);
  if(f.fee)a.push(({'lte500':'до 500 ₽','lte1000':'до 1 000 ₽','gt1000':'> 1 000 ₽'})[f.fee]);
  if(f.favoriteOnly)a.push('★ Любимые');
  if(f.clubs.size)a.push(`Клубы: ${f.clubs.size}`);
  if(f.district)a.push(f.district);
  return a;
}
function today(){
  const arr=state.events.filter(match).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  const active=activeFilters();
  return `<div class="pspListHead pspTodayHead">
    <div><b>МОСКВА <span>· СЕГОДНЯ</span></b><small>${arr.length} событий</small></div>
    <button type="button" class="pspFilterPrimary" data-psp-filters>ФИЛЬТРЫ${active.length?` <i>${active.length}</i>`:''}</button>
  </div>
  ${active.length?`<div class="pspActiveFilters">${active.map(x=>`<span>${esc(x)}</span>`).join('')}<button type="button" data-filter-reset>Сбросить</button></div>`:''}
  ${arr.length?`<div class="pspList">${arr.map(card).join('')}</div>`:`<div class="pspEmpty">Сегодня таких турниров нет. Попробуй изменить фильтры.</div>`}`;
}
function card(e){
  const fav=isFavorite(e.club);
  const tags=[e._game,e._type,e.level_minutes!=null?`${e.level_minutes} мин`:'',e._reentryUnlimited?'re-entry ∞':Number.isFinite(e._reentryCount)?`${e._reentryCount} re-entry`:''].filter(Boolean);
  const late=lateRegInfo(e);
  const meta=[
    e.reentry_cost_rub!=null?`Re-entry ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:'',
    e.addon_allowed===true?'Add-on есть':'',
    e.duration_minutes!=null?`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`:''
  ].filter(Boolean);
  const lateHtml=late?`<span class="pspLateReg ${late.open?'open':'closed'}" data-late-event="${e._id}" data-late-open="${late.open?'1':'0'}">${esc(late.text)}</span>`:'';
  const metaHtml=[lateHtml,...meta.map(esc)].filter(Boolean).join(' · ');

  return `<button type="button" class="pspEvent ${fav?'favorite':''}" data-event="${e._id}">
    <div class="pspTime">${esc(e.time||'—')}<small>Сегодня</small></div>
    <div><div class="pspName">${esc(e._title)}</div><div class="pspClub">${fav?'★ ':''}${esc(e.club||'')}</div>
    <div class="pspTags">${tags.map((x,i)=>`<span class="pspTag ${i===0?'acid':''}">${esc(x)}</span>`).join('')}</div>
    ${metaHtml?`<div class="pspMeta">${metaHtml}</div>`:''}</div>
    <div class="pspFee">${esc(fee(e))}<small>орг. взнос</small></div>
  </button>`;
}
function clubsView(){
  const q=(window.__pspClubQuery||'').toLowerCase();
  const list=state.clubs.filter(c=>allowed(c))
    .filter(c=>!q||(`${c.name||''} ${c.address||''}`).toLowerCase().includes(q))
    .sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));

  const groups={};
  for(const c of list){
    const l=(c.name||'#')[0].toUpperCase();
    (groups[l]??=[]).push(c);
  }

  return `<input id="pspSearch" class="pspSearch" placeholder="Поиск клуба" value="${esc(window.__pspClubQuery||'')}">${
    Object.entries(groups).map(([l,a])=>`<div class="pspGroup"><div class="pspLetter">${esc(l)}</div>${
      a.map(c=>`<div class="pspClubRow ${isFavorite(c.name)?'favorite':''}">
        <div><b>${isFavorite(c.name)?'★ ':''}${esc(c.name||'Клуб')}</b><br><span>${esc(c.address||'Адрес уточняется')}</span></div>
        <button type="button" class="pspClubStar ${isFavorite(c.name)?'on':''}" data-fav-club="${esc(c.name||'')}" aria-label="Любимый клуб">${isFavorite(c.name)?'★':'☆'}</button>
      </div>`).join('')
    }</div>`).join('')||'<div class="pspEmpty">Каталог клубов пока неполный.</div>'
  }`;
}
function mapView(){
  return `<div class="pspMapPanel">
    <div class="pspMapTop"><div><b>КАРТА КЛУБОВ</b><span>Карта Москвы · точки клубов</span></div><button type="button" class="pspMapReset" data-map-reset>Москва</button></div>
    <iframe id="pspMoscowMapFrame" class="pspMapBox" src="polyana/map.html?v=7" title="Карта клубов Москвы" loading="eager" frameborder="0" referrerpolicy="no-referrer-when-downgrade"></iframe>
    <div class="pspMapNote">Карта: OpenStreetMap.</div>
  </div>`;
}

function detail(id){
  const e=state.events.find(x=>x._id===id);if(!e)return;
  const late=lateRegInfo(e);
  const rows=[
    ['Орг. взнос',fee(e)],
    ['Уровни',e.level_minutes!=null?e.level_minutes+' мин':'Не указано'],
    ['Стартовый стек',e.starting_stack!=null?Number(e.starting_stack).toLocaleString('ru-RU'):'Не указано'],
    ['Re-entry',e._reentryUnlimited?'Безлимит':Number.isFinite(e._reentryCount)?`${e._reentryCount}${e.reentry_cost_rub!=null?` × ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:''}`:'Не указано'],
    ['Add-on',e.addon_allowed===true?'Есть':e.addon_allowed===false?'Нет':'Не указано'],
    ['Длительность',e.duration_minutes!=null?`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`:'Не указано'],
    ['Адрес',e.address||'Не указан']
  ];
  const lateRow=late
    ?`<div class="pspDetailRow"><span>Late reg</span><b class="pspLateReg ${late.open?'open':'closed'}" data-late-event="${e._id}" data-late-open="${late.open?'1':'0'}">${esc(late.text)}</b></div>`
    :`<div class="pspDetailRow"><span>Late reg</span><b>Late reg · уточняется</b></div>`;

  const d=document.getElementById('pspDetailBody');
  if(!d)return;
  d.innerHTML=`<h2>${esc(e._title)}</h2><div class="pspClub">${isFavorite(e.club)?'★ ':''}${esc(e.club||'')} · ${esc(e.time||'')}</div>
    ${rows.slice(0,5).map(([a,b])=>`<div class="pspDetailRow"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}
    ${lateRow}
    ${rows.slice(5).map(([a,b])=>`<div class="pspDetailRow"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}`;
  openOverlay(document.getElementById('pspDetail'));
  updateLateRegCountdowns();
}

function clearLateTimer(){
  if(state.lateTimer){clearTimeout(state.lateTimer);state.lateTimer=null}
}
function scheduleLateTicker(minRemaining=Infinity){
  clearLateTimer();
  const nodes=document.querySelectorAll('#polyana [data-late-event]');
  if(!nodes.length)return;
  const delay=minRemaining<=10*60000?1000:30000;
  state.lateTimer=setTimeout(updateLateRegCountdowns,delay);
}
function updateLateRegCountdowns(){
  clearLateTimer();
  const nodes=[...document.querySelectorAll('#polyana [data-late-event]')];
  if(!nodes.length)return;

  const now=Date.now();
  let minRemaining=Infinity;
  let expiredOpenFilter=false;

  for(const node of nodes){
    const id=Number(node.dataset.lateEvent);
    const e=state.events.find(x=>x._id===id);
    const info=e?lateRegInfo(e,now):null;
    if(!info){node.textContent='';continue}

    const wasOpen=node.dataset.lateOpen==='1';
    node.dataset.lateOpen=info.open?'1':'0';
    node.textContent=info.text;
    node.classList.toggle('open',info.open);
    node.classList.toggle('closed',!info.open);

    if(info.open)minRemaining=Math.min(minRemaining,info.remainingMs);
    if(wasOpen&&!info.open&&state.filters.late==='open')expiredOpenFilter=true;
  }

  if(expiredOpenFilter&&state.tab==='today'){renderBody();return}
  scheduleLateTicker(minRemaining);
}

function renderBody(){
  const b=document.getElementById('pspBody');if(!b)return;
  clearLateTimer();
  b.innerHTML=state.tab==='today'?today():state.tab==='clubs'?clubsView():mapView();
  updateLateRegCountdowns();
}

function openOverlay(el){
  if(!el)return;
  el.classList.add('on');
  el.style.display='flex';
  el.style.zIndex='2147483600';
  el.setAttribute('aria-hidden','false');
  document.body.classList.add('pspFilterLock');
  setTimeout(()=>el.querySelector('.pspSheet')?.focus({preventScroll:true}),0);
}
function closeOverlay(el){
  if(!el)return;
  el.classList.remove('on');
  el.style.display='none';
  el.setAttribute('aria-hidden','true');
  if(!document.querySelector('#polyana .pspFiltersOverlay.on'))document.body.classList.remove('pspFilterLock');
}
function openFilters(){
  const f=document.getElementById('pspFilters');
  if(!f)return;
  const sheet=f.querySelector('.pspFilterSheet');
  f.style.alignItems='flex-start';
  f.style.justifyContent='center';
  if(sheet){
    sheet.scrollTop=0;
    sheet.style.height='100dvh';
    sheet.style.maxHeight='100dvh';
    sheet.style.borderRadius='0';
    sheet.style.margin='0';
  }
  openOverlay(f);
  requestAnimationFrame(()=>{ if(sheet)sheet.scrollTop=0; });
  updateApplyCount();
}
function resetFilters(){
  state.filters.game='';
  state.filters.freezeout='';
  state.filters.bounty='';
  state.filters.reentry='';
  state.filters.addon='';
  state.filters.late='';
  state.filters.levels='';
  state.filters.fee='';
  state.filters.district='';
  state.filters.favoriteOnly=false;
  state.filters.clubs.clear();
}
function updateApplyCount(){
  const btn=document.querySelector('#polyana [data-psp-apply]');
  if(btn)btn.textContent=`ПОКАЗАТЬ ${state.events.filter(match).length} ТУРНИРОВ`;
}
function updateClubSearch(value){
  const q=String(value||'').trim().toLowerCase();
  document.querySelectorAll('#polyana [data-filter-club]').forEach(btn=>{
    btn.hidden=q&&!String(btn.dataset.filterClub||'').toLowerCase().includes(q);
  });
}

function handleRootClick(e){
  const t=e.target;

  const tab=t.closest?.('[data-psp-tab]');
  if(tab){
    state.tab=tab.dataset.pspTab;
    render();
    return;
  }

  if(t.closest?.('[data-psp-filters]')){
    openFilters();
    return;
  }

  if(t.closest?.('[data-psp-close]')){
    closeOverlay(document.getElementById('pspFilters'));
    return;
  }

  if(t.closest?.('[data-psp-detail-close]')){
    closeOverlay(document.getElementById('pspDetail'));
    return;
  }

  const choice=t.closest?.('.pspChoice');
  if(choice){
    const k=choice.dataset.key,v=choice.dataset.value;
    state.filters[k]=state.filters[k]===v?'':v;
    document.querySelectorAll('#polyana .pspChoice')
      .forEach(x=>{if(x.dataset.key===k)x.classList.toggle('on',state.filters[k]===x.dataset.value)});
    updateApplyCount();
    return;
  }

  const clubChoice=t.closest?.('[data-filter-club]');
  if(clubChoice){
    const k=normName(clubChoice.dataset.filterClub);
    state.filters.clubs.has(k)?state.filters.clubs.delete(k):state.filters.clubs.add(k);
    clubChoice.classList.toggle('on',state.filters.clubs.has(k));
    const mark=clubChoice.querySelector('i');if(mark)mark.textContent=state.filters.clubs.has(k)?'✓':'';
    updateApplyCount();
    return;
  }

  if(t.closest?.('[data-favorite-only]')){
    state.filters.favoriteOnly=!state.filters.favoriteOnly;
    t.closest('[data-favorite-only]').classList.toggle('on',state.filters.favoriteOnly);
    updateApplyCount();
    return;
  }

  if(t.closest?.('[data-filter-reset]')){
    const reopen=document.getElementById('pspFilters')?.classList.contains('on');
    resetFilters();
    render();
    if(reopen)openFilters();
    return;
  }

  if(t.closest?.('[data-psp-apply]')){
    closeOverlay(document.getElementById('pspFilters'));
    state.tab='today';
    render();
    return;
  }

  const fav=t.closest?.('[data-fav-club]');
  if(fav){
    e.preventDefault();e.stopPropagation();
    toggleFavorite(fav.dataset.favClub);
    render();
    return;
  }

  const event=t.closest?.('[data-event]');
  if(event){
    detail(Number(event.dataset.event));
    return;
  }

  if(t.closest?.('[data-map-reset]')){
    try{
      document.getElementById('pspMoscowMapFrame')?.contentWindow?.postMessage({type:'psp-map-reset'},location.origin);
    }catch(_){}
    return;
  }

  const overlay=t.closest?.('.pspFiltersOverlay');
  if(overlay&&t===overlay)closeOverlay(overlay);
}
function handleRootInput(e){
  if(e.target?.id==='pspSearch'){
    window.__pspClubQuery=e.target.value;
    renderBody();
    setTimeout(()=>{
      const x=document.getElementById('pspSearch');
      if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}
    },0);
    return;
  }
  if(e.target?.matches?.('[data-club-filter-search]')){
    updateClubSearch(e.target.value);
  }
}

function render(){
  const r=root();if(!r)return;
  clearLateTimer();
  r.innerHTML=shell();
  r.onclick=handleRootClick;
  r.oninput=handleRootInput;
  renderBody();
}
async function load(){
  const [ed,cd]=await Promise.all([fetchFirst(DATA_URLS,'events'),fetchFirst(CLUB_URLS,'clubs')]);
  state.events=(ed.events||[]).map(normalize);
  state.clubs=(cd.clubs||[]);
  state.loaded=true;
  render();
}
function warmMapCache(){
  if(window.__pspMapWarmStarted)return;
  window.__pspMapWarmStarted=true;
  const f=document.createElement('iframe');
  f.src='polyana/map.html?v=7&warm=1';
  f.setAttribute('aria-hidden','true');
  f.tabIndex=-1;
  f.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10000px;top:-10000px;border:0';
  document.body.appendChild(f);
}

function openPolyana(){
  if(typeof window.show==='function')window.show('polyana');
  const nav=document.querySelector('.nav [data-nav="polyana"]');
  document.querySelectorAll('.nav [data-nav]').forEach(x=>x.classList.toggle('on',x===nav));
  if(!state.loaded)load();else render();
  warmMapCache();
}

document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  const detail=document.getElementById('pspDetail');
  const filters=document.getElementById('pspFilters');
  if(detail?.classList.contains('on'))closeOverlay(detail);
  else if(filters?.classList.contains('on'))closeOverlay(filters);
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.loaded)updateLateRegCountdowns()});
window.addEventListener('focus',()=>{if(state.loaded)updateLateRegCountdowns()});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||!e.data)return;
  const d=e.data;
  if(d.type==='psp-map-open-club'&&d.club){
    const k=normName(d.club);
    if(k){
      state.filters.clubs=new Set([k]);
      state.filters.game='';state.filters.freezeout='';state.filters.bounty='';state.filters.reentry='';
      state.filters.addon='';state.filters.late='';state.filters.levels='';state.filters.fee='';
      state.filters.district='';state.filters.favoriteOnly=false;
      state.tab='today';
      render();
    }
  }else if(d.type==='psp-map-favorites-changed'){
    state.favorites=loadFavorites();
  }
});

/* Isolated navigation: legacy listeners cannot hijack Polyana. */
document.addEventListener('click',e=>{
  const b=e.target.closest?.('.nav [data-nav="polyana"]');
  if(!b)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  openPolyana();
},true);

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{
    const b=document.querySelector('.nav [data-nav="polyana"]');
    if(b)b.innerHTML='<i class="tourNav23">♛</i>ПОЛЯНА';
  });
}else{
  const b=document.querySelector('.nav [data-nav="polyana"]');
  if(b)b.innerHTML='<i class="tourNav23">♛</i>ПОЛЯНА';
}

window.openPokerSwipePolyana=openPolyana;
})();
