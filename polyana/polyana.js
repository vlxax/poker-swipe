
(function(){
'use strict';
const SCHEDULE='./data/moscow_schedule_today.json';
const CLUBS='./data/moscow_clubs_pokernomoney.json';
const DAY_RE=/^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|следующая игра|ближайшая игра|в избранное)$/i;
const FAR_RE=/(краснодар|воронеж|санкт[- ]?петербург)/i;
const state={tab:'today',quick:new Set(),filters:{game:'',type:'',reentry:'',addon:'',late:'',levels:'',fee:''},events:[],clubs:[]};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
function esc(x=''){return String(x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function name(e){let n=(e.tournament||'').trim();return !n||DAY_RE.test(n)?'Турнир клуба':n}
function game(e){const t=name(e).toLowerCase(); if(/plo|omaha|омаха/.test(t))return'PLO'; if(/nlh|hold.?em|холдем/.test(t))return'NLH'; return''}
function type(e){const t=name(e).toLowerCase(); if(/mystery/.test(t))return'Mystery'; if(/bounty|knockout|нокаут|баунти/.test(t))return'Bounty'; if(/freeze/.test(t))return'Freezeout'; if(/freeroll|бесплат/.test(t))return'Freeroll'; return''}
function fee(e){let n=Number(e.fee_rub)||0;if(n>0)return n.toLocaleString('ru-RU')+' ₽';if(/freeroll|бесплат/i.test(name(e)))return'Freeroll';return'Уточняется'}
function norm(e,i){return {...e,_id:i,_name:name(e),_game:game(e),_type:type(e)}}
function allowed(e){return !FAR_RE.test(e.address||'')}
function passes(e){
 const q=[...state.quick];
 if(q.includes('NLH')&&e._game!=='NLH')return false;
 if(q.includes('PLO')&&e._game!=='PLO')return false;
 if(q.includes('Bounty')&&e._type!=='Bounty'&&e._type!=='Mystery')return false;
 if(q.includes('Freezeout')&&e._type!=='Freezeout')return false;
 if(q.includes('Freeroll')&&e._type!=='Freeroll')return false;
 if(q.includes('Re-entry')&&e.reentry_limit==null)return false;
 if(q.includes('Late reg')&&e.late_reg_minutes==null)return false;
 const f=state.filters;
 if(f.game&&e._game!==f.game)return false;
 if(f.type&&e._type!==f.type)return false;
 if(f.reentry==='none'&&e.reentry_limit!=null)return false;
 if(f.reentry==='yes'&&e.reentry_limit==null)return false;
 if(f.late==='yes'&&e.late_reg_minutes==null)return false;
 if(f.fee==='1000'&&(Number(e.fee_rub)||0)>1000)return false;
 return true;
}
function card(e){
 const tags=[e._game,e._type,e.late_reg_minutes!=null?'Late reg':'',e.reentry_limit!=null?`${e.reentry_limit} re-entry`: ''].filter(Boolean);
 const meta=[];
 if(e.late_reg_minutes!=null)meta.push(`Late reg ${e.late_reg_minutes} мин`);
 if(e.reentry_cost_rub!=null)meta.push(`Re-entry ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`);
 if(e.duration_minutes!=null)meta.push(`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`);
 return `<button class="ps-card" data-event="${e._id}" style="width:100%;color:inherit;text-align:left">
  <div class="ps-time">${esc(e.time||'—')}<small>${esc(e.date||'')}</small></div>
  <div><h3>${esc(e._name)}</h3><div class="ps-club">${esc(e.club||'')}</div>
   <div class="ps-tags">${tags.map((t,i)=>`<span class="ps-tag ${i===0?'hot':''}">${esc(t)}</span>`).join('')}</div>
   ${meta.length?`<div class="ps-meta">${meta.map(esc).join(' · ')}</div>`:''}
  </div><div class="ps-fee">${esc(fee(e))}<small>орг. взнос</small></div></button>`;
}
function renderToday(){
 const list=state.events.filter(passes).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 $('#ps-status').textContent=`Найдено: ${list.length} турниров`;
 $('#ps-content').innerHTML=list.length?`<div class="ps-list">${list.map(card).join('')}</div>`:`<div class="ps-empty">Под выбранные фильтры ничего не найдено.</div>`;
 $$('.ps-card').forEach(x=>x.onclick=()=>openEvent(+x.dataset.event));
}
function renderClubs(){
 let q=($('#ps-club-search')?.value||'').toLowerCase().trim();
 let clubs=state.clubs.filter(c=>!FAR_RE.test(c.address||'')).filter(c=>!q||(c.name||'').toLowerCase().includes(q));
 clubs.sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
 const groups={}; clubs.forEach(c=>{let l=(c.name||'#')[0].toUpperCase();(groups[l]??=[]).push(c)});
 $('#ps-content').innerHTML=`<input id="ps-club-search" class="ps-search" placeholder="Поиск клуба">${Object.entries(groups).map(([l,arr])=>`<div class="ps-alpha-group"><div class="ps-alpha-letter">${esc(l)}</div>${arr.map(c=>`<div class="ps-club-row"><div><b>${esc(c.name)}</b><br><span>${esc(c.address||'Адрес уточняется')}</span></div><span>${c.upcoming?`${c.upcoming} в афише`:''}</span></div>`).join('')}</div>`).join('')||'<div class="ps-empty">Каталог клубов пока неполный. Его нужно расширить отдельным источником.</div>'}`;
 $('#ps-club-search').oninput=renderClubs;
}
function renderMap(){
 $('#ps-content').innerHTML=`<div id="ps-map" class="ps-map"></div><div class="ps-status">Карта показывает клубы, для которых доступны координаты. Адреса без координат остаются в А–Я.</div>`;
 if(!window.L){$('#ps-map').innerHTML='<div class="ps-empty">Leaflet не загрузился.</div>';return}
 const map=L.map('ps-map').setView([55.7558,37.6173],10);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
 let n=0; state.clubs.forEach(c=>{if(Number.isFinite(+c.lat)&&Number.isFinite(+c.lng)){L.marker([+c.lat,+c.lng]).addTo(map).bindPopup(`<b>${esc(c.name)}</b><br>${esc(c.address||'')}`);n++}});
 if(!n)L.popup().setLatLng([55.7558,37.6173]).setContent('В каталоге пока нет lat/lng. Добавим координаты отдельным файлом, не выдумывая их.').openOn(map);
}
function switchTab(tab){
 state.tab=tab; $$('.ps-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 $('#ps-tools').style.display=tab==='today'?'block':'none'; $('#ps-status').textContent='';
 if(tab==='today')renderToday(); else if(tab==='clubs')renderClubs(); else renderMap();
}
function openEvent(id){
 const e=state.events.find(x=>x._id===id); if(!e)return;
 const rows=[
  ['Орг. взнос',fee(e)],
  ['Re-entry',e.reentry_limit==null?'Не указано':`до ${e.reentry_limit}${e.reentry_cost_rub?` × ${Number(e.reentry_cost_rub).toLocaleString('ru-RU')} ₽`:''}`],
  ['Late reg',e.late_reg_minutes==null?'Не указано':`${e.late_reg_minutes} мин`],
  ['Длительность',e.duration_minutes==null?'Не указано':`≈ ${Math.round(e.duration_minutes/60*10)/10} ч`],
  ['Адрес',e.address||'Не указан']
 ];
 $('#ps-detail').innerHTML=`<h2>${esc(e._name)}</h2><div class="ps-club">${esc(e.club||'')} · ${esc(e.time||'')}</div>${rows.map(([a,b])=>`<div class="ps-club-row"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}`;
 $('#ps-detail-wrap').classList.add('open');
}
function renderFilterChips(){
 $$('.ps-filter-choice').forEach(b=>b.onclick=()=>{
  let key=b.dataset.key,val=b.dataset.value;
  state.filters[key]=state.filters[key]===val?'':val;
  $$(`.ps-filter-choice[data-key="${key}"]`).forEach(x=>x.classList.toggle('active',state.filters[key]===x.dataset.value));
 });
}
async function load(){
 try{
  const [s,c]=await Promise.all([
   fetch(SCHEDULE+'?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),
   fetch(CLUBS+'?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>({clubs:[]}))
  ]);
  state.events=(s.events||[]).map(norm).filter(allowed);
  state.clubs=c.clubs||[];
  const upd=s.updated_at?new Date(s.updated_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'';
  $('#ps-updated').textContent=upd?`Обновлено ${upd}`:'';
  renderToday();
 }catch(err){console.error(err);$('#ps-content').innerHTML='<div class="ps-empty">Не удалось загрузить афишу. Проверь data/moscow_schedule_today.json</div>'}
}
document.addEventListener('DOMContentLoaded',()=>{
 $$('.ps-tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
 $$('.ps-chip').forEach(b=>b.onclick=()=>{let v=b.dataset.q;state.quick.has(v)?state.quick.delete(v):state.quick.add(v);b.classList.toggle('active');renderToday()});
 $('#ps-filter-open').onclick=()=>$('#ps-filter-wrap').classList.add('open');
 $('#ps-filter-close').onclick=()=>$('#ps-filter-wrap').classList.remove('open');
 $('#ps-filter-wrap').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open')};
 $('#ps-apply').onclick=()=>{$('#ps-filter-wrap').classList.remove('open');renderToday()};
 $('#ps-detail-close').onclick=()=>$('#ps-detail-wrap').classList.remove('open');
 $('#ps-detail-wrap').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open')};
 renderFilterChips(); load();
});
})();
