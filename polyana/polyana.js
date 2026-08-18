
(function(){
'use strict';
const SCHEDULE='./data/moscow_schedule_today.json';
const CLUBS=['./data/moscow_clubs.json','./data/moscow_clubs_pokernomoney.json'];
const BAD_TITLE=/^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|следующая игра|ближайшая игра|в избранное|запись на месте в один клик)$/i;
const FAR=/(краснодар|воронеж|санкт[- ]?петербург)/i;
const state={tab:'today',events:[],clubs:[],quick:new Set(),filters:{}};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function cleanName(e){let n=(e.tournament||'').trim();return !n||BAD_TITLE.test(n)?'Турнир клуба':n}
function inferGame(n){let t=n.toLowerCase();if(/plo5|5-card omaha|5 card omaha|5-карточ/.test(t))return'PLO5';if(/plo|omaha|омаха/.test(t))return'PLO';if(/nlh|hold.?em|холдем/.test(t))return'NLH';return''}
function inferType(n){let t=n.toLowerCase();if(/mystery/.test(t))return'Mystery Bounty';if(/bounty|knockout|баунти|нокаут/.test(t))return'Bounty';if(/freeze/.test(t))return'Freezeout';if(/freeroll|бесплат/.test(t))return'Freeroll';if(/deep/.test(t))return'Deepstack';if(/turbo/.test(t))return'Turbo';return''}
function norm(e,i){let n=cleanName(e);return {...e,_id:i,_name:n,_game:inferGame(n),_type:inferType(n)}}
function feeLabel(e){let n=Number(e.fee_rub)||0;if(n>0)return n.toLocaleString('ru-RU')+' ₽';if(/freeroll|бесплат/i.test(e._name))return'Freeroll';return'Уточняется'}
function lateClose(e){if(!e.date||!e.time||e.late_reg_minutes==null)return null;let [h,m]=e.time.split(':').map(Number);let d=new Date(`${e.date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+03:00`);return new Date(d.getTime()+Number(e.late_reg_minutes)*60000)}
function lateText(e){
 if(e.late_reg_minutes==null)return'';
 const close=lateClose(e), now=new Date();
 if(close && now>=new Date(`${e.date}T${e.time}:00+03:00`) && now<close){let mins=Math.max(0,Math.floor((close-now)/60000));return`Late reg ещё ${Math.floor(mins/60)}ч ${mins%60}м`}
 if(close && now>=close)return'Late reg закрыта';
 return`Late reg ${e.late_reg_minutes} мин`;
}
function passes(e){
 if(FAR.test(e.address||''))return false;
 for(const q of state.quick){
  if(q==='NLH'&&e._game!=='NLH')return false;
  if(q==='PLO'&&e._game!=='PLO')return false;
  if(q==='Bounty'&&!['Bounty','Mystery Bounty'].includes(e._type))return false;
  if(q==='Freezeout'&&e._type!=='Freezeout')return false;
  if(q==='Freeroll'&&e._type!=='Freeroll')return false;
  if(q==='Re-entry'&&e.reentry_limit==null)return false;
  if(q==='Late reg'&&e.late_reg_minutes==null)return false;
  if(q==='Levels'&&e.level_minutes==null)return false;
 }
 const f=state.filters;
 if(f.game&&e._game!==f.game)return false;
 if(f.type&&e._type!==f.type)return false;
 if(f.reentry==='none'&&e.reentry_limit!=null)return false;
 if(f.reentry==='yes'&&e.reentry_limit==null)return false;
 if(f.addon==='yes'&&!e.addon_allowed)return false;
 if(f.late==='yes'&&e.late_reg_minutes==null)return false;
 if(f.late==='open'){
   let c=lateClose(e); if(!c||new Date()>=c)return false;
 }
 if(f.fee==='free'&&(Number(e.fee_rub)||0)!==0)return false;
 if(f.fee==='1000'&&(Number(e.fee_rub)||0)>1000)return false;
 return true;
}
function card(e){
 let tags=[e._game,e._type,e.level_minutes?`${e.level_minutes} мин`:null,e.reentry_limit!=null?`${e.reentry_limit} re-entry`:null].filter(Boolean);
 let meta=[lateText(e),e.reentry_cost_rub!=null?`Re-entry ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:'',e.duration_minutes!=null?`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`:''].filter(Boolean);
 return `<button class="ps-card" data-id="${e._id}">
   <div class="ps-time">${esc(e.time||'—')}<small>Сегодня</small></div>
   <div><h3>${esc(e._name)}</h3><div class="ps-club">${esc(e.club||'')}</div>
   <div class="ps-tags">${tags.map((t,i)=>`<span class="ps-tag ${i===0?'hot':''}">${esc(t)}</span>`).join('')}</div>
   ${meta.length?`<div class="ps-meta">${meta.map(esc).join(' · ')}</div>`:''}</div>
   <div class="ps-fee">${esc(feeLabel(e))}<small>орг. взнос</small></div>
 </button>`;
}
function renderToday(){
 let list=state.events.filter(passes).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 $('#count-today').textContent=`${list.length} событий`;
 $('#content').innerHTML=list.length?`<div class="ps-list">${list.map(card).join('')}</div>`:`<div class="ps-empty">Сегодня таких турниров нет. Попробуй изменить фильтры.</div>`;
 $$('.ps-card').forEach(x=>x.onclick=()=>openDetail(+x.dataset.id));
}
function renderClubs(){
 let q=($('#club-search')?.value||'').toLowerCase().trim();
 let arr=state.clubs.filter(c=>!FAR.test(c.address||'')).filter(c=>!q||(c.name||'').toLowerCase().includes(q)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
 let g={};arr.forEach(c=>{let l=(c.name||'#')[0].toUpperCase();(g[l]??=[]).push(c)});
 $('#content').innerHTML=`<input id="club-search" class="ps-search" placeholder="Поиск клуба">${Object.entries(g).map(([l,a])=>`<div class="ps-alpha-group"><div class="ps-letter">${esc(l)}</div>${a.map(c=>`<div class="ps-club-row"><div><b>${esc(c.name)}</b><br><span>${esc(c.address||'Адрес уточняется')}</span></div><span>${c.upcoming?`${c.upcoming} в афише`:''}</span></div>`).join('')}</div>`).join('')||'<div class="ps-empty">Каталог клубов пока неполный.</div>'}`;
 $('#club-search').oninput=renderClubs;
}
function renderMap(){
 $('#content').innerHTML=`<div id="map" class="ps-map"></div><div class="ps-meta" style="margin-top:8px">Точки показываются только для клубов с проверенными координатами.</div>`;
 if(!window.L){$('#map').innerHTML='<div class="ps-empty">Карта не загрузилась.</div>';return}
 const map=L.map('map').setView([55.7558,37.6173],10);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
 let n=0;state.clubs.forEach(c=>{if(Number.isFinite(+c.lat)&&Number.isFinite(+c.lng)){L.marker([+c.lat,+c.lng]).addTo(map).bindPopup(`<b>${esc(c.name)}</b><br>${esc(c.address||'')}`);n++}});
 if(!n)L.popup().setLatLng([55.7558,37.6173]).setContent('Добавьте проверенные lat/lng в каталог клубов — выдумывать координаты модуль не будет.').openOn(map);
}
function switchTab(t){
 state.tab=t;$$('.ps-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));
 $('#filters-area').style.display=t==='today'?'block':'none';
 $('#list-head').style.display=t==='today'?'flex':'none';
 t==='today'?renderToday():t==='clubs'?renderClubs():renderMap();
}
function openDetail(id){
 const e=state.events.find(x=>x._id===id);if(!e)return;
 const rows=[
 ['Орг. взнос',feeLabel(e)],
 ['Уровни',e.level_minutes!=null?`${e.level_minutes} мин`:'Не указано'],
 ['Стартовый стек',e.starting_stack!=null?Number(e.starting_stack).toLocaleString('ru-RU'):'Не указано'],
 ['Re-entry',e.reentry_limit!=null?`до ${e.reentry_limit}${e.reentry_cost_rub!=null?` × ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:''}`:'Не указано'],
 ['Add-on',e.addon_allowed===true?'Есть':e.addon_allowed===false?'Нет':'Не указано'],
 ['Late reg',e.late_reg_minutes!=null?`${e.late_reg_minutes} мин`:'Не указано'],
 ['Длительность',e.duration_minutes!=null?`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`:'Не указано'],
 ['Адрес',e.address||'Не указан']
 ];
 $('#detail').innerHTML=`<h2>${esc(e._name)}</h2><div class="ps-club">${esc(e.club||'')} · ${esc(e.time||'')}</div>${rows.map(([a,b])=>`<div class="ps-club-row"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}`;
 $('#detail-bg').classList.add('open');
}
async function fetchFirst(urls){for(const u of urls){try{let r=await fetch(u+'?ts='+Date.now(),{cache:'no-store'});if(r.ok)return await r.json()}catch(e){}}return {clubs:[]}}
async function load(){
 try{
  let [s,c]=await Promise.all([fetch(SCHEDULE+'?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),fetchFirst(CLUBS)]);
  state.events=(s.events||[]).map(norm);state.clubs=c.clubs||[];
  $('#club-count').textContent=state.clubs.length||new Set(state.events.map(e=>e.club)).size;
  $('#event-count').textContent=state.events.filter(e=>!FAR.test(e.address||'')).length;
  $('#updated').textContent=s.updated_at?new Date(s.updated_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'—';
  renderToday();
 }catch(e){console.error(e);$('#content').innerHTML='<div class="ps-empty">Не удалось обновить афишу.<br>Проверь data/moscow_schedule_today.json</div>'}
}
document.addEventListener('DOMContentLoaded',()=>{
 $$('.ps-tab').forEach(x=>x.onclick=()=>switchTab(x.dataset.tab));
 $$('.ps-chip[data-q]').forEach(x=>x.onclick=()=>{let q=x.dataset.q;state.quick.has(q)?state.quick.delete(q):state.quick.add(q);x.classList.toggle('active');renderToday()});
 $('#open-filters').onclick=()=>$('#filters-bg').classList.add('open');
 $('#filters-bg').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open')};
 $('#filters-close').onclick=()=>$('#filters-bg').classList.remove('open');
 $$('.choice').forEach(x=>x.onclick=()=>{let k=x.dataset.key,v=x.dataset.value;state.filters[k]=state.filters[k]===v?'':v;$$(`.choice[data-key="${k}"]`).forEach(y=>y.classList.toggle('active',state.filters[k]===y.dataset.value))});
 $('#apply').onclick=()=>{$('#filters-bg').classList.remove('open');renderToday()};
 $('#detail-close').onclick=()=>$('#detail-bg').classList.remove('open');
 $('#detail-bg').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open')};
 load();
});
})();
