(()=>{
'use strict';
const BUILD='POKERSWIPE V67 CLEAN';
const state={screen:location.hash.replace('#','')||'home', polyTab:'today', query:'', data:null};
const validScreens=new Set(['home','hands','tournaments','polyana','you']);
if(!validScreens.has(state.screen)) state.screen='home';
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;

function navigate(screen,{push=true}={}){
 if(!validScreens.has(screen)) return;
 state.screen=screen;
 $$('[data-screen]').forEach(el=>el.classList.toggle('active',el.dataset.screen===screen));
 $$('.bottomNav [data-nav]').forEach(b=>b.classList.toggle('on',b.dataset.nav===screen));
 if(push && location.hash!==`#${screen}`) history.pushState({screen},'',`#${screen}`);
 window.scrollTo({top:0,behavior:'instant'});
 if(screen==='polyana') ensurePolyana();
 if(screen==='tournaments') renderTournaments();
 if(screen==='home'||screen==='you') renderStats();
}

function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}}
function renderStats(){
 const hands=num(localStorage.getItem('ps_saved_hands'));
 const tours=readJSON('ps_tournaments',[]).length;
 $('#homeHands').textContent=hands; $('#savedHands').textContent=hands; $('#homeTournaments').textContent=tours;
 const skill=localStorage.getItem('ps_skill')||'не определён'; $('#homeSkill').textContent=skill; $('#profileSkill').textContent=skill.toUpperCase();
}

function handleDecision(action){
 const copy={check:'Допустимый контроль банка. Для реального verdict нужен solver result.',bet33:'Небольшой c-bet выглядит естественно, но это демо без solver claim.',bet75:'Крупный сайзинг требует сильного диапазонного обоснования. Это демо, не GTO verdict.'};
 const out=$('#decisionResult'); out.textContent=copy[action]||'Решение сохранено.'; out.classList.remove('hidden');
 localStorage.setItem('ps_saved_hands',String(num(localStorage.getItem('ps_saved_hands'))+1)); renderStats();
}

function renderTournaments(){
 const list=$('#tournamentList'); const items=readJSON('ps_tournaments',[]);
 if(!items.length){list.innerHTML='<div class="emptyState"><b>ПОКА ПУСТО</b><p>Когда появятся сыгранные турниры, здесь будет история, результат и точки для разбора.</p></div>';return}
 list.innerHTML=items.map(t=>`<article class="tCard"><div class="tCardTop"><div><small>${esc(t.date)}</small><strong>${esc(t.name)}</strong></div><b>${esc(t.place)}</b></div><small>${esc(t.note)}</small></article>`).join('');
}
function addDemoTournament(){const a=readJSON('ps_tournaments',[]);a.unshift({date:new Date().toLocaleDateString('ru-RU'),name:'6-MAX · TEST',place:'3 место',note:'Демо-запись. Можно удалить очисткой localStorage.'});localStorage.setItem('ps_tournaments',JSON.stringify(a));renderTournaments();renderStats()}

async function ensurePolyana(){
 if(state.data){renderPolyana();return}
 const sources=['data/live_polyana.json','data/moscow_schedule_today.json','data/polyana_verified.json','data/moscow_clubs.json'];
 const loaded={};
 await Promise.all(sources.map(async src=>{try{const r=await fetch(src,{cache:'no-store'});if(r.ok)loaded[src]=await r.json()}catch(e){console.warn(BUILD,'data load',src,e)}}));
 state.data=loaded; renderPolyana();
}
function events(){
 const live=state.data?.['data/live_polyana.json']; const sched=state.data?.['data/moscow_schedule_today.json']; const verified=state.data?.['data/polyana_verified.json'];
 let arr=(live?.events?.length?live.events:(sched?.events?.length?sched.events:verified?.events))||[];
 return arr.map(x=>({...x,fee_rub:x.fee_rub??x.fee??null}));
}
function clubs(){
 const live=state.data?.['data/live_polyana.json']; const mc=state.data?.['data/moscow_clubs.json']; return (live?.clubs?.length?live.clubs:mc?.clubs)||[];
}
function renderPolyana(){
 const root=$('#polyanaContent'); const ev=events(); const cl=clubs(); $('#eventCount').textContent=ev.length||0;
 const q=state.query.trim().toLowerCase();
 if(state.polyTab==='today'){
  const filtered=ev.filter(e=>!q||`${e.club} ${e.tournament} ${e.format||''}`.toLowerCase().includes(q)).slice(0,60);
  root.innerHTML=`<div class="eventSectionTitle">МОСКВА · СЕГОДНЯ</div><div class="eventGrid">${filtered.map(e=>`<article class="eventCard"><div class="eventTime">${esc(e.time||'—')}</div><div class="eventName">${esc(e.tournament||'Турнир')}</div><div class="eventClub">${esc(e.club||'Клуб')}</div><div class="eventMeta">${e.format?`<span class="tag">${esc(e.format)}</span>`:''}${e.free?'<span class="tag">FREE</span>':e.fee_rub!=null?`<span class="tag">${esc(e.fee_rub)} ₽</span>`:''}${e.address?`<span class="tag">МОСКВА</span>`:''}</div></article>`).join('')}</div>${filtered.length?'':'<div class="polyEmpty">Ничего не найдено.</div>'}`;
 } else if(state.polyTab==='clubs'){
  const filtered=cl.filter(c=>!q||`${c.name} ${c.address||''}`.toLowerCase().includes(q)).slice(0,60);
  root.innerHTML=`<div class="eventSectionTitle">КЛУБЫ МОСКВЫ</div>${filtered.map(c=>`<article class="clubCard"><b>${esc(c.name)}</b><p>${esc(c.address||'Москва')}</p></article>`).join('')||'<div class="polyEmpty">Нет данных.</div>'}`;
 } else if(state.polyTab==='series'){
  root.innerHTML='<div class="eventSectionTitle">СЕРИИ</div><div class="polyEmpty">Серии будут появляться здесь отдельными карточками. В V67 раздел не подменяет данные выдуманными событиями.</div>';
 } else {
  const regs=[['Москва','Основная афиша'],['Сочи','Серии и поездки'],['Калининград','Серии и поездки'],['Минск','Серии и поездки']];
  root.innerHTML='<div class="eventSectionTitle">РЕГИОНЫ</div>'+regs.map(r=>`<article class="regionCard"><b>${r[0]}</b><p>${r[1]}</p></article>`).join('');
 }
}

function onClick(e){
 const nav=e.target.closest('[data-nav]'); if(nav){navigate(nav.dataset.nav);return}
 const dec=e.target.closest('[data-decision]'); if(dec){handleDecision(dec.dataset.decision);return}
 const pt=e.target.closest('[data-poly-tab]'); if(pt){state.polyTab=pt.dataset.polyTab;$$('[data-poly-tab]').forEach(b=>b.classList.toggle('on',b===pt));renderPolyana();return}
 if(e.target.closest('#searchToggle')){$('#polyanaSearch').classList.toggle('hidden');$('#polyanaSearchInput')?.focus();return}
 if(e.target.closest('#filterToggle')){state.polyTab='clubs';$$('[data-poly-tab]').forEach(b=>b.classList.toggle('on',b.dataset.polyTab==='clubs'));renderPolyana();return}
 if(e.target.closest('#addDemoTournament')) addDemoTournament();
}

document.addEventListener('click',onClick);
document.addEventListener('input',e=>{if(e.target.id==='polyanaSearchInput'){state.query=e.target.value;renderPolyana()}});
window.addEventListener('popstate',()=>navigate(location.hash.replace('#','')||'home',{push:false}));
window.addEventListener('hashchange',()=>{const s=location.hash.replace('#','');if(validScreens.has(s)&&s!==state.screen)navigate(s,{push:false})});

renderStats(); renderTournaments(); navigate(state.screen,{push:false});
window.PokerSwipeV67={build:BUILD,navigate,state};
})();
