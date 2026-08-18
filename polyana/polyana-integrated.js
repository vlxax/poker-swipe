
(() => {
'use strict';
const ROOT_ID='psPolyanaArea';
const DATA_URLS=['data/moscow_schedule_today.json','data/live_polyana.json'];
const CLUB_URLS=['data/moscow_club_locations_source.json','data/moscow_clubs_pokernomoney.json','data/live_polyana.json'];
const BAD=/^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|следующая игра|ближайшая игра|в избранное|запись на месте в один клик)$/i;
const FAR=/(краснодар|воронеж|санкт[- ]?петербург)/i;
const state={tab:'today',events:[],clubs:[],quick:new Set(),filters:{},loaded:false,map:null,mapToken:0,mapMarkers:[]};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const root=()=>document.getElementById(ROOT_ID);
function cleanTitle(e){const n=String(e.tournament||'').trim();return !n||BAD.test(n)?'Турнир клуба':n}
function gameOf(n){const t=n.toLowerCase();if(/plo5|5-card|5 card|5-карточ/.test(t))return'PLO5';if(/plo|omaha|омаха/.test(t))return'PLO';if(/nlh|hold.?em|холдем/.test(t))return'NLH';return''}
function typeOf(n){const t=n.toLowerCase();if(/mystery/.test(t))return'Mystery Bounty';if(/bounty|knockout|баунти|нокаут/.test(t))return'Bounty';if(/freeze/.test(t))return'Freezeout';if(/freeroll|бесплат/.test(t))return'Freeroll';if(/turbo/.test(t))return'Turbo';if(/deep/.test(t))return'Deepstack';return''}
function normalize(e,i){const title=cleanTitle(e);return {...e,_id:i,_title:title,_game:gameOf(title),_type:typeOf(title)}}
function fee(e){const n=Number(e.fee_rub)||0;if(n>0)return n.toLocaleString('ru-RU')+' ₽';if(/freeroll|бесплат/i.test(e._title))return'Freeroll';return'Уточняется'}
function startDate(e){if(!e.date||!e.time)return null;const d=new Date(`${e.date}T${e.time}:00+03:00`);return Number.isNaN(+d)?null:d}
function lateClose(e){const s=startDate(e);return s&&e.late_reg_minutes!=null?new Date(+s+Number(e.late_reg_minutes)*60000):null}
function lateText(e){if(e.late_reg_minutes==null)return'';const s=startDate(e),c=lateClose(e),now=new Date();if(s&&c&&now>=s&&now<c){let m=Math.max(0,Math.floor((c-now)/60000));return`Late reg ещё ${Math.floor(m/60)}ч ${m%60}м`}if(c&&now>=c)return'Late reg закрыта';return`Late reg ${e.late_reg_minutes} мин`}
function allowed(e){return !FAR.test(e.address||'')}
function match(e){
 if(!allowed(e))return false;
 for(const q of state.quick){
  if(q==='NLH'&&e._game!=='NLH')return false;
  if(q==='PLO'&&e._game!=='PLO')return false;
  if(q==='Bounty'&&!['Bounty','Mystery Bounty'].includes(e._type))return false;
  if(q==='Freezeout'&&e._type!=='Freezeout')return false;
  if(q==='Freeroll'&&e._type!=='Freeroll')return false;
  if(q==='Re-entry'&&e.reentry_limit==null)return false;
  if(q==='Add-on'&&e.addon_allowed!==true)return false;
  if(q==='Late reg'&&e.late_reg_minutes==null)return false;
  if(q==='Уровни'&&e.level_minutes==null)return false;
 }
 const f=state.filters;
 if(f.game&&e._game!==f.game)return false;
 if(f.type&&e._type!==f.type)return false;
 if(f.reentry==='yes'&&e.reentry_limit==null)return false;
 if(f.reentry==='none'&&e.reentry_limit!=null)return false;
 if(f.late==='yes'&&e.late_reg_minutes==null)return false;
 if(f.late==='open'){const c=lateClose(e);if(!c||new Date()>=c)return false}
 if(f.fee==='1000'&&(Number(e.fee_rub)||0)>1000)return false;
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
function shell(){
 return `<div class="pspTop"><div class="pspLogo">POKER <i>SWIPE</i></div><div class="pspBy">by ФРИКОВАЯ ДАМА 💋</div></div>
 <div class="pspHero"><div><h1>ПОЛЯНА<span>.</span></h1><p>Навигатор по спортивному покеру Москвы.</p></div>
 <div class="pspTools"><button class="pspTool" data-psp-search>⌕</button><button class="pspTool acid" data-psp-filters>☷</button></div></div>
 <div class="pspTabs"><button class="pspTab ${state.tab==='today'?'on':''}" data-psp-tab="today">СЕГОДНЯ</button><button class="pspTab ${state.tab==='clubs'?'on':''}" data-psp-tab="clubs">КЛУБЫ</button><button class="pspTab ${state.tab==='map'?'on':''}" data-psp-tab="map">КАРТА</button></div>
 <div class="pspAd"><div class="pspAdLabel">Партнёрское предложение</div><img src="assets/headsup_promo_frikovaya_dama.jpeg" alt="HEADS UP — промокод ФРИКОВАЯ ДАМА, бесплатный re-entry"></div>
 <div class="pspFresh"><strong><span class="pspFreshDot"></span>АФИША ОБНОВЛЕНА</strong><div class="pspFreshMeta"><b>${state.clubs.length}</b> клубов · <b>${state.events.filter(allowed).length}</b> событий</div></div>
 <div id="pspBody"></div>
 <div id="pspFilters" class="pspSheetBg"><div class="pspSheet"><button class="pspClose" data-psp-close>Закрыть</button><h2>Фильтры</h2>
 ${filterBlock('Игра','game',[['NLH','NLH'],['PLO','PLO'],['PLO5','PLO5']])}
 ${filterBlock('Формат','type',[['Freezeout','Freezeout'],['Bounty','Bounty'],['Mystery Bounty','Mystery Bounty'],['Freeroll','Freeroll']])}
 ${filterBlock('Re-entry','reentry',[['Есть re-entry','yes'],['Без re-entry','none']])}
 ${filterBlock('Late reg','late',[['Есть late reg','yes'],['Куда ещё можно успеть','open']])}
 ${filterBlock('Орг. взнос','fee',[['До 1 000 ₽','1000']])}
 <button class="pspApply" data-psp-apply>ПОКАЗАТЬ ТУРНИРЫ</button></div></div>
 <div id="pspDetail" class="pspSheetBg"><div class="pspSheet"><button class="pspClose" data-psp-detail-close>Закрыть</button><div id="pspDetailBody"></div></div></div>`;
}
function filterBlock(title,key,vals){return `<div class="pspBlock"><h4>${title}</h4><div class="pspQuick">${vals.map(([l,v])=>`<button class="pspChip pspChoice ${state.filters[key]===v?'on':''}" data-key="${key}" data-value="${v}">${l}</button>`).join('')}</div></div>`}
function today(){
 const arr=state.events.filter(match).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 return `<div class="pspSecHead"><h3>БЫСТРЫЕ ФИЛЬТРЫ</h3><button class="pspFilterLink" data-psp-filters>Все фильтры</button></div>
 <div class="pspQuick">${['NLH','PLO','Bounty','Freezeout','Freeroll','Re-entry','Add-on','Late reg','Уровни'].map(q=>{const unavailable=(q==='Add-on'&&!state.events.some(e=>e.addon_allowed===true))||(q==='Уровни'&&!state.events.some(e=>e.level_minutes!=null));return `<button class="pspChip ${state.quick.has(q)?'on':''} ${unavailable?'disabled':''}" data-q="${q}" ${unavailable?'disabled title="Нет данных в источнике"':''}>${q}</button>`}).join('')}</div>
 <div class="pspListHead"><b>МОСКВА <span>· СЕГОДНЯ</span></b><small>${arr.length} событий</small></div>
 ${arr.length?`<div class="pspList">${arr.map(card).join('')}</div>`:`<div class="pspEmpty">Сегодня таких турниров нет. Попробуй изменить фильтры.</div>`}`;
}
function card(e){
 const tags=[e._game,e._type,e.level_minutes!=null?`${e.level_minutes} мин`:'',e.reentry_limit!=null?`${e.reentry_limit} re-entry`: ''].filter(Boolean);
 const meta=[lateText(e),e.reentry_cost_rub!=null?`Re-entry ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:'',e.duration_minutes!=null?`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`: ''].filter(Boolean);
 return `<button class="pspEvent" data-event="${e._id}"><div class="pspTime">${esc(e.time||'—')}<small>Сегодня</small></div><div><div class="pspName">${esc(e._title)}</div><div class="pspClub">${esc(e.club||'')}</div><div class="pspTags">${tags.map((x,i)=>`<span class="pspTag ${i===0?'acid':''}">${esc(x)}</span>`).join('')}</div>${meta.length?`<div class="pspMeta">${meta.map(esc).join(' · ')}</div>`:''}</div><div class="pspFee">${esc(fee(e))}<small>орг. взнос</small></div></button>`;
}
function clubs(){
 const q=(window.__pspClubQuery||'').toLowerCase();
 const list=state.clubs.filter(c=>allowed(c)).filter(c=>!q||(`${c.name||''} ${c.address||''}`).toLowerCase().includes(q)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
 const groups={};for(const c of list){const l=(c.name||'#')[0].toUpperCase();(groups[l]??=[]).push(c)}
 return `<input id="pspSearch" class="pspSearch" placeholder="Поиск клуба" value="${esc(window.__pspClubQuery||'')}">${Object.entries(groups).map(([l,a])=>`<div class="pspGroup"><div class="pspLetter">${esc(l)}</div>${a.map(c=>`<div class="pspClubRow"><div><b>${esc(c.name||'Клуб')}</b><br><span>${esc(c.address||'Адрес уточняется')}</span></div><span>${typeof c.upcoming==='number'?c.upcoming+' анонсов':''}</span></div>`).join('')}</div>`).join('')||'<div class="pspEmpty">Каталог клубов пока неполный.</div>'}`;
}
function mapView(){
 return `<div class="pspMapPanel">
   <div class="pspMapTop"><div><b>КАРТА КЛУБОВ</b><span id="pspMapProgress">Подготавливаем точки…</span></div><button class="pspMapReset" data-map-reset>Москва</button></div>
   <div id="pspMoscowMap" class="pspMapBox"></div>
   <div class="pspMapNote">Адреса клубов: PokerNoMoney. Карта: OpenStreetMap. Координаты кэшируются на устройстве после первого определения.</div>
 </div>`;
}

const MAP_CACHE_PREFIX='psp-map-v2:';
const MAP_CENTER=[55.7558,37.6173];
const MAP_BOUNDS={minLat:54.95,maxLat:56.20,minLng:36.75,maxLng:38.95};
const MAP_SEED={
 'Minds':[55.682229,37.580647],
 'Joker Poker Club Moscow':[55.582987,37.595142],
 'PRIDE':[55.771753,37.684111],
 'Check-Check Club':[55.761279,37.663018]
};
function validCoord(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=MAP_BOUNDS.minLat&&lat<=MAP_BOUNDS.maxLat&&lng>=MAP_BOUNDS.minLng&&lng<=MAP_BOUNDS.maxLng}
function readCoord(c){
 const direct=[Number(c.lat),Number(c.lng)];if(validCoord(...direct))return direct;
 if(MAP_SEED[c.name])return MAP_SEED[c.name];
 try{const v=JSON.parse(localStorage.getItem(MAP_CACHE_PREFIX+c.name)||'null');if(v&&validCoord(Number(v.lat),Number(v.lng)))return [Number(v.lat),Number(v.lng)]}catch(_){ }
 return null;
}
function saveCoord(c,lat,lng,source){try{localStorage.setItem(MAP_CACHE_PREFIX+c.name,JSON.stringify({lat,lng,source,at:Date.now()}))}catch(_){}}
async function geocodeClub(c,signal){
 const q=`Москва, ${c.address}, Россия`;
 const url='https://photon.komoot.io/api/?q='+encodeURIComponent(q)+'&limit=3&lat=55.7558&lon=37.6173&lang=ru';
 const r=await fetch(url,{signal,headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('geocoder '+r.status);
 const d=await r.json();
 for(const f of (d.features||[])){
   const co=f?.geometry?.coordinates;if(!Array.isArray(co)||co.length<2)continue;
   const lng=Number(co[0]),lat=Number(co[1]);if(!validCoord(lat,lng))continue;
   const props=f.properties||{};const country=String(props.country||'').toLowerCase();
   if(country && !/(россия|russia|russian)/i.test(country))continue;
   saveCoord(c,lat,lng,'Photon/OpenStreetMap');return [lat,lng];
 }
 return null;
}
function mapPin(){return L.divIcon({className:'pspMapPinWrap',html:'<span class="pspMapPin"></span>',iconSize:[20,20],iconAnchor:[10,10],popupAnchor:[0,-11]})}
function mapPopup(c){return `<div class="pspMapPopup"><b>${esc(c.name||'Клуб')}</b><br><span>${esc(c.address||'')}</span>${c.needs_manual_review?'<br><em>Адрес требует проверки</em>':''}</div>`}
function destroyMap(){
 state.mapToken++;
 if(state.map){try{state.map.remove()}catch(_){ }state.map=null}
 state.mapMarkers=[];
}
async function initMap(){
 const el=document.getElementById('pspMoscowMap');if(!el||state.tab!=='map')return;
 destroyMap();const token=state.mapToken;
 if(!window.L){el.innerHTML='<div class="pspEmpty">Не удалось загрузить карту. Проверь интернет и открой вкладку ещё раз.</div>';return}
 const map=L.map(el,{zoomControl:true,preferCanvas:true}).setView(MAP_CENTER,10);state.map=map;
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
 const clubs=state.clubs.filter(c=>allowed(c)&&c.address);
 const progress=document.getElementById('pspMapProgress');
 const bounds=[];let ready=0,failed=0;
 const add=(c,co)=>{if(token!==state.mapToken||!state.map)return;const [lat,lng]=co;const marker=L.marker([lat,lng],{icon:mapPin(),keyboard:true,title:c.name||'Клуб'}).addTo(map).bindPopup(mapPopup(c));state.mapMarkers.push(marker);bounds.push([lat,lng]);ready++;if(progress)progress.textContent=`На карте ${ready} из ${clubs.length}`};
 const pending=[];
 for(const c of clubs){const co=readCoord(c);if(co)add(c,co);else pending.push(c)}
 if(bounds.length>1)map.fitBounds(bounds,{padding:[28,28],maxZoom:12});
 setTimeout(()=>{try{map.invalidateSize()}catch(_){ }},80);
 const controller=new AbortController();
 const workers=Array.from({length:2},async()=>{
   while(pending.length&&token===state.mapToken){
     const c=pending.shift();
     try{const co=await geocodeClub(c,controller.signal);if(co)add(c,co);else failed++}catch(_){failed++}
     if(progress&&token===state.mapToken)progress.textContent=`На карте ${ready} из ${clubs.length}${failed?' · не найдено '+failed:''}`;
     await new Promise(r=>setTimeout(r,450));
   }
 });
 await Promise.all(workers);
 if(token!==state.mapToken)return;
 if(bounds.length>1)map.fitBounds(bounds,{padding:[28,28],maxZoom:12});
 if(progress)progress.textContent=`На карте ${ready} из ${clubs.length}${failed?' · не найдено '+failed:''}`;
}
function detail(id){
 const e=state.events.find(x=>x._id===id);if(!e)return;
 const rows=[
 ['Орг. взнос',fee(e)],
 ['Уровни',e.level_minutes!=null?e.level_minutes+' мин':'Не указано'],
 ['Стартовый стек',e.starting_stack!=null?Number(e.starting_stack).toLocaleString('ru-RU'):'Не указано'],
 ['Re-entry',e.reentry_limit!=null?`до ${e.reentry_limit}${e.reentry_cost_rub!=null?` × ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:''}`:'Не указано'],
 ['Add-on',e.addon_allowed===true?'Есть':e.addon_allowed===false?'Нет':'Не указано'],
 ['Late reg',e.late_reg_minutes!=null?e.late_reg_minutes+' мин':'Не указано'],
 ['Длительность',e.duration_minutes!=null?`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`:'Не указано'],
 ['Адрес',e.address||'Не указан']
 ];
 document.getElementById('pspDetailBody').innerHTML=`<h2>${esc(e._title)}</h2><div class="pspClub">${esc(e.club||'')} · ${esc(e.time||'')}</div>${rows.map(([a,b])=>`<div class="pspDetailRow"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}`;
 document.getElementById('pspDetail').classList.add('on');
}
function renderBody(){
 const b=document.getElementById('pspBody');if(!b)return;
 if(state.tab!=='map')destroyMap();
 b.innerHTML=state.tab==='today'?today():state.tab==='clubs'?clubs():mapView();
 bindBody();
 if(state.tab==='map')setTimeout(initMap,0);
}
function bindBody(){
 document.querySelectorAll('#polyana [data-q]').forEach(b=>b.onclick=()=>{const q=b.dataset.q;state.quick.has(q)?state.quick.delete(q):state.quick.add(q);renderBody()});
 document.querySelectorAll('#polyana [data-event]').forEach(b=>b.onclick=()=>detail(+b.dataset.event));
 const s=document.getElementById('pspSearch');if(s)s.oninput=()=>{window.__pspClubQuery=s.value;renderBody();setTimeout(()=>document.getElementById('pspSearch')?.focus(),0)};
 document.querySelectorAll('#polyana [data-psp-filters]').forEach(b=>b.onclick=()=>document.getElementById('pspFilters')?.classList.add('on'));
 document.querySelector('#polyana [data-map-reset]')?.addEventListener('click',()=>{try{state.map?.setView(MAP_CENTER,10)}catch(_){}});
}

function bindShell(){
 document.querySelectorAll('#polyana [data-psp-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.pspTab;render()});
 document.querySelectorAll('#polyana [data-psp-filters]').forEach(b=>b.onclick=()=>document.getElementById('pspFilters')?.classList.add('on'));
 document.querySelectorAll('#polyana .pspChoice').forEach(b=>b.onclick=()=>{const k=b.dataset.key,v=b.dataset.value;state.filters[k]=state.filters[k]===v?'':v;document.querySelectorAll(`#polyana .pspChoice[data-key="${k}"]`).forEach(x=>x.classList.toggle('on',state.filters[k]===x.dataset.value));});
 document.querySelector('#polyana [data-psp-close]')?.addEventListener('click',()=>document.getElementById('pspFilters')?.classList.remove('on'));
 document.querySelector('#polyana [data-psp-apply]')?.addEventListener('click',()=>{document.getElementById('pspFilters')?.classList.remove('on');state.tab='today';render()});
 document.querySelector('#polyana [data-psp-detail-close]')?.addEventListener('click',()=>document.getElementById('pspDetail')?.classList.remove('on'));
 document.getElementById('pspFilters')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('on')});
 document.getElementById('pspDetail')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('on')});
 document.querySelector('#polyana [data-psp-search]')?.addEventListener('click',()=>{state.tab='clubs';render();setTimeout(()=>document.getElementById('pspSearch')?.focus(),0)});
}
function render(){
 const r=root();if(!r)return;
 r.innerHTML=shell();bindShell();renderBody();
}
async function load(){
 const [ed,cd]=await Promise.all([fetchFirst(DATA_URLS,'events'),fetchFirst(CLUB_URLS,'clubs')]);
 state.events=(ed.events||[]).map(normalize);
 state.clubs=(cd.clubs||[]);
 state.loaded=true;render();
}
function openPolyana(){
 if(typeof window.show==='function')window.show('polyana');
 const nav=document.querySelector('.nav [data-nav="polyana"]');
 document.querySelectorAll('.nav [data-nav]').forEach(x=>x.classList.toggle('on',x===nav));
 if(!state.loaded)load();else render();
}

/* Isolated navigation:
   capture-phase interception means legacy listeners cannot hijack Polyana. */
document.addEventListener('click',e=>{
 const b=e.target.closest?.('.nav [data-nav="polyana"]');
 if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();
 openPolyana();
},true);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{const b=document.querySelector('.nav [data-nav="polyana"]');if(b)b.innerHTML='<i class="tourNav23">♛</i>ПОЛЯНА';});
else {const b=document.querySelector('.nav [data-nav="polyana"]');if(b)b.innerHTML='<i class="tourNav23">♛</i>ПОЛЯНА';}

window.openPokerSwipePolyana=openPolyana;
})();
