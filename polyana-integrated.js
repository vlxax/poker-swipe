
(() => {
'use strict';
const ROOT_ID='psPolyanaArea';
const DATA_URLS=['data/moscow_schedule_today.json','data/live_polyana.json'];
const CLUB_URLS=['data/moscow_club_locations_source.json','data/moscow_clubs_pokernomoney.json','data/live_polyana.json'];
const BAD=/^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|следующая игра|ближайшая игра|в избранное|запись на месте в один клик)$/i;
const FAR=/(краснодар|воронеж|санкт[- ]?петербург)/i;
const state={tab:'today',events:[],clubs:[],quick:new Set(),filters:{},loaded:false,map:null,mapToken:0,mapMarkers:[],lateTimer:null};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const root=()=>document.getElementById(ROOT_ID);
function cleanTitle(e){const n=String(e.tournament||'').trim();return !n||BAD.test(n)?'Турнир клуба':n}
function gameOf(n){const t=n.toLowerCase();if(/plo5|5-card|5 card|5-карточ/.test(t))return'PLO5';if(/plo|omaha|омаха/.test(t))return'PLO';if(/nlh|hold.?em|холдем/.test(t))return'NLH';return''}
function typeOf(n){const t=n.toLowerCase();if(/mystery/.test(t))return'Mystery Bounty';if(/bounty|knockout|баунти|нокаут/.test(t))return'Bounty';if(/freeze/.test(t))return'Freezeout';if(/freeroll|бесплат/.test(t))return'Freeroll';if(/turbo/.test(t))return'Turbo';if(/deep/.test(t))return'Deepstack';return''}
function normalize(e,i){const title=cleanTitle(e);return {...e,_id:i,_title:title,_game:gameOf(title),_type:typeOf(title)}}
function fee(e){const n=Number(e.fee_rub)||0;if(n>0)return n.toLocaleString('ru-RU')+' ₽';if(/freeroll|бесплат/i.test(e._title))return'Freeroll';return'Уточняется'}
function startDate(e){
 if(!e.date||!e.time)return null;
 const d=new Date(`${e.date}T${e.time}:00+03:00`);
 return Number.isNaN(+d)?null:d;
}
function lateClose(e){
 const s=startDate(e),m=Number(e.late_reg_minutes);
 return s&&Number.isFinite(m)&&m>=0?new Date(+s+m*60000):null;
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
function lateText(e){return lateRegInfo(e)?.text||''}
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
 if(f.late==='open'){const info=lateRegInfo(e);if(!info?.open)return false}
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
 const late=lateRegInfo(e);
 const meta=[e.reentry_cost_rub!=null?`Re-entry ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:'',e.duration_minutes!=null?`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`: ''].filter(Boolean);
 const lateHtml=late?`<span data-late-event="${e._id}" data-late-open="${late.open?'1':'0'}" style="color:${late.open?'#c8ff3d':'#89838b'};font-weight:800">${esc(late.text)}</span>`:'';
 const metaHtml=[lateHtml,...meta.map(esc)].filter(Boolean).join(' · ');
 return `<button class="pspEvent" data-event="${e._id}"><div class="pspTime">${esc(e.time||'—')}<small>Сегодня</small></div><div><div class="pspName">${esc(e._title)}</div><div class="pspClub">${esc(e.club||'')}</div><div class="pspTags">${tags.map((x,i)=>`<span class="pspTag ${i===0?'acid':''}">${esc(x)}</span>`).join('')}</div>${metaHtml?`<div class="pspMeta">${metaHtml}</div>`:''}</div><div class="pspFee">${esc(fee(e))}<small>орг. взнос</small></div></button>`;
}
function clubs(){
 const q=(window.__pspClubQuery||'').toLowerCase();
 const list=state.clubs.filter(c=>allowed(c)).filter(c=>!q||(`${c.name||''} ${c.address||''}`).toLowerCase().includes(q)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
 const groups={};for(const c of list){const l=(c.name||'#')[0].toUpperCase();(groups[l]??=[]).push(c)}
 return `<input id="pspSearch" class="pspSearch" placeholder="Поиск клуба" value="${esc(window.__pspClubQuery||'')}">${Object.entries(groups).map(([l,a])=>`<div class="pspGroup"><div class="pspLetter">${esc(l)}</div>${a.map(c=>`<div class="pspClubRow"><div><b>${esc(c.name||'Клуб')}</b><br><span>${esc(c.address||'Адрес уточняется')}</span></div><span>${typeof c.upcoming==='number'?c.upcoming+' анонсов':''}</span></div>`).join('')}</div>`).join('')||'<div class="pspEmpty">Каталог клубов пока неполный.</div>'}`;
}
function mapView(){
 return `<div class="pspMapPanel">
   <div class="pspMapTop"><div><b>КАРТА КЛУБОВ</b><span id="pspMapProgress">Карта Москвы · точки клубов</span></div><button class="pspMapReset" data-map-reset>Москва</button></div>
   <iframe id="pspMoscowMapFrame" class="pspMapBox" src="polyana/map.html?v=4" title="Карта клубов Москвы" loading="eager" frameborder="0" referrerpolicy="no-referrer-when-downgrade"></iframe>
   <div class="pspMapNote">Адреса клубов: PokerNoMoney. Карта: OpenStreetMap.</div>
 </div>`;
}

const MAP_CACHE_PREFIX='psp-map-v3:';
const MAP_CENTER=[55.7558,37.6173];
const MAP_BOUNDS={minLat:54.95,maxLat:56.20,minLng:36.75,maxLng:38.95};
const MAP_SEED={
 'Minds':[55.682229,37.580647],
 'Joker Poker Club Moscow':[55.582987,37.595142],
 'PRIDE':[55.771803,37.684111],
 'Check-Check Club':[55.761279,37.663018],
 'HEADS UP':[55.777318,37.636410]
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
 const urls=[
  'https://photon.komoot.io/api/?q='+encodeURIComponent(q)+'&limit=3&lat=55.7558&lon=37.6173&lang=ru',
  'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=ru&q='+encodeURIComponent(q)
 ];
 for(const url of urls){
  try{
   const r=await fetch(url,{signal,headers:{'Accept':'application/json'}});if(!r.ok)continue;
   const d=await r.json();
   const rows=Array.isArray(d)?d:(d.features||[]);
   for(const row of rows){
    let lat,lng,country='';
    if(row.geometry?.coordinates){lng=Number(row.geometry.coordinates[0]);lat=Number(row.geometry.coordinates[1]);country=String(row.properties?.country||'')}
    else {lat=Number(row.lat);lng=Number(row.lon);country=String(row.display_name||'')}
    if(!validCoord(lat,lng))continue;
    if(country && !/(россия|russia|russian|moscow|москва)/i.test(country))continue;
    saveCoord(c,lat,lng,url.includes('photon')?'Photon/OpenStreetMap':'Nominatim/OpenStreetMap');return [lat,lng];
   }
  }catch(err){if(signal?.aborted)throw err}
 }
 return null;
}

/* Minimal slippy-map renderer. No Leaflet dependency: the existing Polyana map
   container is filled directly with OpenStreetMap tiles + our own markers. */
function mercatorProject(lat,lng,z){
 const n=256*Math.pow(2,z),s=Math.sin(Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180);
 return {x:(lng+180)/360*n,y:(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n};
}
function mercatorUnproject(x,y,z){
 const n=256*Math.pow(2,z),lng=x/n*360-180,lat=180/Math.PI*Math.atan(Math.sinh(Math.PI*(1-2*y/n)));
 return [lat,lng];
}
function createOsmMap(el){
 let center=[...MAP_CENTER],zoom=10,destroyed=false,raf=0,drag=null;
 const coords=new Map();
 el.innerHTML=`<div class="pspOsmTiles" aria-hidden="true"></div><div class="pspOsmMarkers"></div><div class="pspOsmPopup" hidden></div><div class="pspOsmControls"><button type="button" data-osm-plus aria-label="Приблизить">+</button><button type="button" data-osm-minus aria-label="Отдалить">−</button></div><div class="pspOsmAttribution">© OpenStreetMap contributors</div>`;
 const tiles=el.querySelector('.pspOsmTiles'),markers=el.querySelector('.pspOsmMarkers'),popup=el.querySelector('.pspOsmPopup');
 const cleanup=[];
 function on(target,type,fn,opts){target.addEventListener(type,fn,opts);cleanup.push(()=>target.removeEventListener(type,fn,opts))}
 function topLeft(){const cp=mercatorProject(center[0],center[1],zoom);return {x:cp.x-el.clientWidth/2,y:cp.y-el.clientHeight/2}}
 function position(lat,lng){const p=mercatorProject(lat,lng,zoom),tl=topLeft();return {x:p.x-tl.x,y:p.y-tl.y}}
 function render(){
  if(destroyed)return;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
   if(destroyed)return;
   const w=el.clientWidth||420,h=el.clientHeight||470,tl=topLeft(),ts=256,max=Math.pow(2,zoom);
   const minX=Math.floor(tl.x/ts)-1,maxX=Math.floor((tl.x+w)/ts)+1,minY=Math.floor(tl.y/ts)-1,maxY=Math.floor((tl.y+h)/ts)+1;
   const frag=document.createDocumentFragment();tiles.textContent='';
   for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
    if(ty<0||ty>=max)continue;const wrap=((tx%max)+max)%max;
    const img=document.createElement('img');img.className='pspOsmTile';img.alt='';img.draggable=false;
    img.src=`https://tile.openstreetmap.org/${zoom}/${wrap}/${ty}.png`;
    img.style.left=(tx*ts-tl.x)+'px';img.style.top=(ty*ts-tl.y)+'px';
    frag.appendChild(img);
   }
   tiles.appendChild(frag);
   markers.querySelectorAll('[data-map-club]').forEach(m=>{
    const c=coords.get(m.dataset.mapClub);if(!c)return;const p=position(c.lat,c.lng);m.style.transform=`translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(-50%,-50%)`;m.hidden=p.x<-30||p.y<-30||p.x>w+30||p.y>h+30;
   });
   if(!popup.hidden&&popup.dataset.lat){const p=position(Number(popup.dataset.lat),Number(popup.dataset.lng));popup.style.left=Math.max(8,Math.min(w-218,p.x+12))+'px';popup.style.top=Math.max(8,Math.min(h-100,p.y-30))+'px'}
  })
 }
 function addClub(c,co){
  if(destroyed||!co)return;const [lat,lng]=co;if(!validCoord(lat,lng))return;
  const id=String(c.name||'club');coords.set(id,{lat,lng,c});
  let m=[...markers.querySelectorAll('[data-map-club]')].find(x=>x.dataset.mapClub===id);
  if(!m){m=document.createElement('button');m.type='button';m.className='pspOsmMarker';m.dataset.mapClub=id;m.title=c.name||'Клуб';m.innerHTML='<span></span>';markers.appendChild(m);
   on(m,'click',ev=>{ev.stopPropagation();const rec=coords.get(id);if(!rec)return;popup.dataset.lat=rec.lat;popup.dataset.lng=rec.lng;popup.hidden=false;popup.innerHTML=`<button type="button" class="pspOsmPopupClose" aria-label="Закрыть">×</button><b>${esc(rec.c.name||'Клуб')}</b><span>${esc(rec.c.address||'')}</span>${rec.c.needs_manual_review?'<em>Адрес требует проверки</em>':''}`;popup.querySelector('.pspOsmPopupClose').onclick=()=>{popup.hidden=true;popup.removeAttribute('data-lat');popup.removeAttribute('data-lng')}})}
  render();
 }
 function setView(c,z=zoom){center=[Math.max(MAP_BOUNDS.minLat,Math.min(MAP_BOUNDS.maxLat,Number(c[0]))),Math.max(MAP_BOUNDS.minLng,Math.min(MAP_BOUNDS.maxLng,Number(c[1])))];zoom=Math.max(9,Math.min(16,Math.round(Number(z)||10)));popup.hidden=true;render()}
 function reset(){setView(MAP_CENTER,10)}
 function changeZoom(d){const next=Math.max(9,Math.min(16,zoom+d));if(next!==zoom){zoom=next;popup.hidden=true;render()}}
 on(el.querySelector('[data-osm-plus]'),'click',e=>{e.stopPropagation();changeZoom(1)});
 on(el.querySelector('[data-osm-minus]'),'click',e=>{e.stopPropagation();changeZoom(-1)});
 on(el,'pointerdown',e=>{if(e.target.closest('button'))return;drag={x:e.clientX,y:e.clientY,p:mercatorProject(center[0],center[1],zoom)};el.setPointerCapture?.(e.pointerId);el.classList.add('dragging');popup.hidden=true});
 on(el,'pointermove',e=>{if(!drag)return;const p={x:drag.p.x-(e.clientX-drag.x),y:drag.p.y-(e.clientY-drag.y)};center=mercatorUnproject(p.x,p.y,zoom);render()});
 const end=e=>{if(!drag)return;drag=null;el.classList.remove('dragging');try{el.releasePointerCapture?.(e.pointerId)}catch(_){}};
 on(el,'pointerup',end);on(el,'pointercancel',end);
 on(el,'wheel',e=>{e.preventDefault();changeZoom(e.deltaY<0?1:-1)},{passive:false});
 on(window,'resize',render);
 render();
 return {addClub,setView,reset,invalidateSize:render,remove(){destroyed=true;cancelAnimationFrame(raf);cleanup.forEach(fn=>fn());el.innerHTML=''}};
}
function destroyMap(){
 state.mapToken++;
 if(state.map){try{state.map.remove()}catch(_){ }state.map=null}
 state.mapMarkers=[];
}
async function initMap(){
 const el=document.getElementById('pspMoscowMap');if(!el||state.tab!=='map')return;
 destroyMap();const token=state.mapToken;
 const map=createOsmMap(el);state.map=map;
 const clubs=state.clubs.filter(c=>allowed(c)&&c.address);
 const progress=document.getElementById('pspMapProgress');
 let ready=0,failed=0;
 const add=(c,co)=>{if(token!==state.mapToken||!state.map||!co)return;state.map.addClub(c,co);ready++;if(progress)progress.textContent=`На карте ${ready} из ${clubs.length}`};
 const pending=[];
 for(const c of clubs){const co=readCoord(c);if(co)add(c,co);else pending.push(c)}
 if(progress&&ready)progress.textContent=`На карте ${ready} из ${clubs.length} · остальные точки загружаются`;
 const controller=new AbortController();
 const workers=Array.from({length:2},async()=>{
   while(pending.length&&token===state.mapToken){
     const c=pending.shift();
     try{const co=await geocodeClub(c,controller.signal);if(co)add(c,co);else failed++}catch(_){failed++}
     if(progress&&token===state.mapToken)progress.textContent=`На карте ${ready} из ${clubs.length}${pending.length?' · подготавливаем ещё '+pending.length:''}${failed?' · не найдено '+failed:''}`;
     await new Promise(r=>setTimeout(r,700));
   }
 });
 Promise.all(workers).then(()=>{if(token===state.mapToken&&progress)progress.textContent=`На карте ${ready} из ${clubs.length}${failed?' · не найдено '+failed:''}`});
}

function detail(id){
 const e=state.events.find(x=>x._id===id);if(!e)return;
 const late=lateRegInfo(e);
 const rows=[
 ['Орг. взнос',fee(e)],
 ['Уровни',e.level_minutes!=null?e.level_minutes+' мин':'Не указано'],
 ['Стартовый стек',e.starting_stack!=null?Number(e.starting_stack).toLocaleString('ru-RU'):'Не указано'],
 ['Re-entry',e.reentry_limit!=null?`до ${e.reentry_limit}${e.reentry_cost_rub!=null?` × ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:''}`:'Не указано'],
 ['Add-on',e.addon_allowed===true?'Есть':e.addon_allowed===false?'Нет':'Не указано'],
 ['Длительность',e.duration_minutes!=null?`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`:'Не указано'],
 ['Адрес',e.address||'Не указан']
 ];
 const lateRow=late?`<div class="pspDetailRow"><span>Late reg</span><b data-late-event="${e._id}" data-late-open="${late.open?'1':'0'}" style="color:${late.open?'#c8ff3d':'#89838b'}">${esc(late.text)}</b></div>`:`<div class="pspDetailRow"><span>Late reg</span><b>Не указано</b></div>`;
 document.getElementById('pspDetailBody').innerHTML=`<h2>${esc(e._title)}</h2><div class="pspClub">${esc(e.club||'')} · ${esc(e.time||'')}</div>${rows.slice(0,5).map(([a,b])=>`<div class="pspDetailRow"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}${lateRow}${rows.slice(5).map(([a,b])=>`<div class="pspDetailRow"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}`;
 document.getElementById('pspDetail').classList.add('on');
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
 let minRemaining=Infinity,expiredOpenFilter=false;
 for(const node of nodes){
  const id=Number(node.dataset.lateEvent),e=state.events.find(x=>x._id===id);
  const info=e?lateRegInfo(e,now):null;
  if(!info){node.textContent='';continue}
  const wasOpen=node.dataset.lateOpen==='1';
  node.dataset.lateOpen=info.open?'1':'0';
  node.textContent=info.text;
  node.style.color=info.open?'#c8ff3d':'#89838b';
  if(info.open)minRemaining=Math.min(minRemaining,info.remainingMs);
  if(wasOpen&&!info.open&&state.filters.late==='open')expiredOpenFilter=true;
 }
 if(expiredOpenFilter&&state.tab==='today'){renderBody();return}
 scheduleLateTicker(minRemaining);
}
function renderBody(){
 const b=document.getElementById('pspBody');if(!b)return;
 clearLateTimer();
 if(state.tab!=='map')destroyMap();
 b.innerHTML=state.tab==='today'?today():state.tab==='clubs'?clubs():mapView();
 bindBody();
 updateLateRegCountdowns();

}
function bindBody(){
 document.querySelectorAll('#polyana [data-q]').forEach(b=>b.onclick=()=>{const q=b.dataset.q;state.quick.has(q)?state.quick.delete(q):state.quick.add(q);renderBody()});
 document.querySelectorAll('#polyana [data-event]').forEach(b=>b.onclick=()=>detail(+b.dataset.event));
 const s=document.getElementById('pspSearch');if(s)s.oninput=()=>{window.__pspClubQuery=s.value;renderBody();setTimeout(()=>document.getElementById('pspSearch')?.focus(),0)};
 document.querySelectorAll('#polyana [data-psp-filters]').forEach(b=>b.onclick=()=>document.getElementById('pspFilters')?.classList.add('on'));
 document.querySelector('#polyana [data-map-reset]')?.addEventListener('click',()=>{try{document.getElementById('pspMoscowMapFrame')?.contentWindow?.postMessage({type:'psp-map-reset'},location.origin)}catch(_){}});
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

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.loaded)updateLateRegCountdowns()});
window.addEventListener('focus',()=>{if(state.loaded)updateLateRegCountdowns()});

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
