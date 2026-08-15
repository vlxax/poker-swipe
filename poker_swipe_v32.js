/* PokerSwipe V32 stability layer.
   It uses the live PokerSwipeCore bridge installed by index.html and keeps
   product screens/assets intact while fixing persistence and data integrity. */
(()=>{
'use strict';

const core=window.PokerSwipeCore;
if(!core){
  console.error('POKER SWIPE V32: core bridge is missing');
  return;
}

const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
const state=()=>window.S;
const esc=v=>window.esc?window.esc(v):String(v??'');
const uid=(prefix='attempt')=>{
  const id=window.crypto?.randomUUID?.()||`${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${id}`;
};
const scoreEvent=e=>Number.isFinite(Number(e?.policyScore))?Math.max(0,Math.min(100,Number(e.policyScore))):e?.grade==='g'?92:e?.grade==='y'?62:25;
const eligible=e=>e&&e.mode!=='diagnostic'&&e.mode!=='legacy'&&!e.excludeFromProfile;
const rankEligible=e=>eligible(e)&&!e.excludeFromRank&&!['review','heal'].includes(e.mode);
const realEvents=()=>Array.isArray(state().events)?state().events.filter(rankEligible):[];
const localDay=()=>window.today();

function showStorageWarning(message){
  let el=q('#v32StorageWarning');
  if(!el){
    el=document.createElement('div');el.id='v32StorageWarning';el.className='v32StorageWarning';
    document.body.appendChild(el);
  }
  el.innerHTML=`<b>ДАННЫЕ НЕ СОХРАНЕНЫ</b><span>${esc(message||'Хранилище браузера недоступно. Сделай экспорт профиля.')}</span>`;
}
function clearStorageWarning(){q('#v32StorageWarning')?.remove()}

const subscribers=new Set();
let savePublishingTimer=null;
function saveV32(){
  const S=state();
  S.version='32.0';S.schemaVersion=32;S.updatedAt=Date.now();
  try{
    localStorage.setItem(core.storageKey,JSON.stringify(S));
    clearStorageWarning();
  }catch(error){
    console.error('POKER SWIPE STORAGE ERROR',error);
    showStorageWarning(error?.message);
    return false;
  }
  try{window.ui?.()}catch(error){console.warn('UI refresh after save failed',error)}
  clearTimeout(savePublishingTimer);
  /* Public profiles stay off until a server verifies Telegram initData and RLS
     is covered by negative tests. This prevents accidental insecure writes. */
  subscribers.forEach(fn=>{try{fn(S)}catch(error){console.warn('Store subscriber failed',error)}});
  return true;
}
window.save=saveV32;

function dedupeExistingEvents(S){
  const out=[],seenAttempts=new Set();
  for(const event of Array.isArray(S.events)?S.events:[]){
    if(event?.attemptId){if(seenAttempts.has(event.attemptId))continue;seenAttempts.add(event.attemptId)}
    const prev=out[out.length-1];
    const sameFast=prev&&['sizing','daily','heal'].includes(event?.mode)&&prev.mode===event.mode&&prev.spotId===event.spotId&&prev.action===event.action&&Math.abs(Number(event.ts)-Number(prev.ts))<1200;
    if(sameFast)continue;
    out.push(event);
  }
  S.events=out.slice(-600);
}

function migrateV32(S,{save=true}={}){
  if(!S||typeof S!=='object')throw new Error('Некорректный формат состояния');
  try{
    const backupKey=`${core.storageKey}_pre_v32`;
    if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,JSON.stringify(S));
  }catch(_){}
  S.events=Array.isArray(S.events)?S.events:[];
  S.hands=Array.isArray(S.hands)?S.hands:[];
  S.myHands18=Array.isArray(S.myHands18)?S.myHands18:[];
  S.tournaments=Array.isArray(S.tournaments)?S.tournaments:[];
  S.drafts=S.drafts&&typeof S.drafts==='object'?S.drafts:{};
  S.dailyArchive=Array.isArray(S.dailyArchive)?S.dailyArchive:[];
  S.snapshots=Array.isArray(S.snapshots)?S.snapshots:[];
  S.seenSwipe=Array.isArray(S.seenSwipe)?S.seenSwipe:[];
  S.xray={runs:0,pre:0,narrow:0,river:0,blockers:0,best:0,history:[],...S.xray};
  S.xray.history=Array.isArray(S.xray.history)?S.xray.history:[];
  S.xray.counts={pre:0,narrow:0,river:0,blockers:0,...(S.xray.counts||{})};
  if(!Object.values(S.xray.counts).some(Boolean)&&Number(S.xray.runs)>0){
    for(const k of ['pre','narrow','river','blockers'])S.xray.counts[k]=Number(S.xray[k])?Number(S.xray.runs):0;
  }
  const known=new Set(S.myHands18.map(h=>String(h.id)));
  S.hands.forEach((hand,index)=>{
    const id=String(hand?.id||`legacy_${hand?.ts||hand?.createdAt||index}`);
    if(known.has(id))return;
    S.myHands18.push({...hand,id,version:hand?.version||'legacy',legacy:true,createdAt:hand?.createdAt||hand?.ts||Date.now()});
    known.add(id);
  });
  S.tournaments=S.tournaments.map(t=>({...t,bountyCount:Math.max(0,numberV32(t.bountyCount)),bountyWon:Math.max(0,numberV32(t.bountyWon)),schemaVersion:32}));
  dedupeExistingEvents(S);
  S.version='32.0';S.schemaVersion=32;
  if(save)saveV32();
  return S;
}

function numberV32(value){
  if(typeof value==='number')return Number.isFinite(value)?value:0;
  const cleaned=String(value??'').trim().replace(/\s+/g,'').replace(',','.');
  const n=Number(cleaned);return Number.isFinite(n)?n:0;
}
window.t23Num=numberV32;

function baselineSkill(){
  const S=state(),p=S.diagnosticProfile31||S.diagnosticProfile25;
  const n=Number(p?.overall);
  return Number.isFinite(n)?Math.max(1,Math.min(99,n)):Number.isFinite(Number(S.skillBaseline))?Number(S.skillBaseline):50;
}
function overallSkillV32(){
  const events=realEvents().slice(-120),baseline=baselineSkill(),baselineWeight=20;
  if(!events.length)return Math.round(baseline);
  const total=events.reduce((sum,event)=>sum+scoreEvent(event),0);
  return Math.max(1,Math.min(99,Math.round((baseline*baselineWeight+total)/(baselineWeight+events.length))));
}
function formScoreV32(){
  const events=realEvents().slice(-20);
  return events.length?Math.round(events.reduce((sum,event)=>sum+scoreEvent(event),0)/events.length):50;
}
function touchDayV32(){
  const S=state(),day=localDay();
  if(S.lastDay===day)return;
  if(!S.lastDay){S.streak=1;S.lastDay=day;return}
  const previous=new Date(`${S.lastDay}T12:00:00`),current=new Date(`${day}T12:00:00`);
  const diff=Math.round((current-previous)/86400000);
  S.streak=diff===1?Math.max(1,Number(S.streak)||0)+1:1;
  S.lastDay=day;
}
function disciplineV32(){
  const events=realEvents().slice(-40);if(events.length<5)return null;
  const red=events.filter(e=>e.grade==='r').length;
  const blind=events.filter(e=>e.grade==='r'&&Number(e.confidence)>=90).length;
  return Math.max(20,Math.min(98,Math.round(92-red/events.length*48-blind*2.5)));
}
function statV32(events){
  return {n:events.length,score:events.length?Math.round(events.reduce((s,e)=>s+scoreEvent(e),0)/events.length):0};
}
function rankMetricsV32(){
  const events=realEvents();
  const pre=statV32(events.filter(e=>/PRE|ПРЕ/i.test(e.street||'')||/RFI|BB DEFENCE|3.?BET|FLAT IP|PREFLOP/i.test(e.concept||'')));
  const post=statV32(events.filter(e=>/FLOP|TURN|RIVER|ФЛОП|Т[ЕЁ]РН|РИВЕР/i.test(e.street||'')&&e.mode!=='sizing'));
  const size=statV32(events.filter(e=>e.mode==='sizing'||e.sizePct!=null));
  const ds=disciplineV32(),disc={n:events.length,score:Number.isFinite(ds)?ds:0};
  const values=[pre,post,size,disc].filter(x=>x.n>=5&&Number.isFinite(x.score)).map(x=>x.score);
  return{sample:events.length,min:values.length?Math.min(...values):0,pre,post,size,disc};
}
window.overallSkill=overallSkillV32;
window.formScore=formScoreV32;
window.touchDay=touchDayV32;
window.disciplineScore=disciplineV32;
window.rankMetrics28=rankMetricsV32;

let sizingAttempt=null,reviewAttempt=null;
const baseRecord=window.recordEvent;
window.recordEvent=function recordEventV32(input={}){
  const event={...input};
  if(event.mode==='daily')event.attemptId=event.attemptId||`daily:${localDay()}:${event.spotId||'spot'}`;
  else if(event.mode==='heal'){
    event.attemptId=event.attemptId||`heal:${event.concept||'course'}:${event.action||'step'}`;
    event.excludeFromRank=true;
  }else if(event.mode==='review'){
    event.attemptId=event.attemptId||reviewAttempt||uid('review');
    event.excludeFromRank=true;
  }
  else if(event.mode==='sizing')event.attemptId=event.attemptId||sizingAttempt||uid('sizing');
  event.attemptId=event.attemptId||uid(event.mode||'decision');
  const existing=state().events.find(x=>x.attemptId===event.attemptId);
  if(existing)return existing;
  const result=baseRecord(event);
  state().skill=overallSkillV32();
  const todayRow={date:localDay(),skill:state().skill,form:formScoreV32()};
  const last=state().snapshots.at(-1);
  if(last?.date===todayRow.date)state().snapshots[state().snapshots.length-1]=todayRow;
  else state().snapshots.push(todayRow);
  state().snapshots=state().snapshots.slice(-90);
  saveV32();
  return result;
};

const baseSizing=window.renderSizing;
function stripDecorativeContextV32(){
  qa('#swipeCard > .spot30,#sizingArea > .spot30,#dailyArea > .spot30,#reviewArea > .spot30,#healArea > .spot30,#xrayArea > .spot30').forEach(el=>el.remove());
}
const baseSwipe=window.renderSwipe;
window.renderSwipe=function renderSwipeV32(){const result=baseSwipe.apply(this,arguments);setTimeout(stripDecorativeContextV32,0);return result};
window.renderSizing=function renderSizingV32(){
  sizingAttempt=uid('sizing');
  const result=baseSizing.apply(this,arguments);
  setTimeout(()=>{
    stripDecorativeContextV32();
    const button=q('#sizeLock');if(!button||button.dataset.v32Locked)return;
    button.dataset.v32Locked='ready';
    const handler=button.onclick;
    button.onclick=event=>{
      if(button.dataset.submitted==='1')return;
      button.dataset.submitted='1';button.disabled=true;button.setAttribute('aria-busy','true');
      handler?.call(button,event);
    };
  },0);
  return result;
};
const baseReview=window.renderReview;
window.renderReview=function renderReviewV32(){reviewAttempt=uid('review');return baseReview.apply(this,arguments)};

function cancelQuickV32(goHome=true){
  clearTimeout(window.swTimer);
  if(window.quick){window.quick.active=false;window.quick.index=0}
  window.swTimer=null;window.swLocked=false;
  if(goHome)window.show('home');
}
window.cancelQuick32=cancelQuickV32;
window.quickBanner=function quickBannerV32(){
  const quick=window.quick;if(!quick?.active)return'';
  return `<div class="quickBanner v32QuickBanner"><b>⚡ 5 МИНУТ · ${quick.index+1}/${quick.flow.length}</b><div class="quickDots">${quick.flow.map((x,i)=>`<i class="${i<quick.index?'done':i===quick.index?'on':''}"></i>`).join('')}</div><button type="button" onclick="cancelQuick32()">ОТМЕНА</button></div>`;
};
const baseShow=window.show;
window.show=function showV32(id){
  if(window.quick?.active&&['home','myhands','tournaments','profile','quickgame30'].includes(id))cancelQuickV32(false);
  const result=baseShow.apply(this,arguments);setTimeout(stripDecorativeContextV32,0);return result;
};

function metricModal(title,value,body){
  window.openModal(`<span class="ey">${esc(title)}</span><h1>${esc(value)}</h1><p>${body}</p><button class="primary" id="v32MetricClose">ПОНЯЛА →</button>`);
  setTimeout(()=>{const b=q('#v32MetricClose');if(b)b.onclick=window.closeModal},0);
}
function enhanceHomeV32(){
  const stats=q('.v31Stats');if(!stats)return;
  if(!stats.querySelector('[data-v32-metric="streak"]'))stats.insertAdjacentHTML('beforeend',`<span data-v32-metric="streak"><b>${Number(state().streak)||0}</b> серия</span>`);
  const rows=[...stats.children],sample=realEvents().length;
  const info=[
    ['SKILL',state().skill,`Долгий уровень: baseline диагностики имеет вес 20 решений, затем постепенно растворяется в дистанции. Сейчас подтверждено решений: ${sample}.`],
    ['ФОРМА',formScoreV32(),`Среднее качество последних ${Math.min(20,sample)} зачётных решений. Диагностика, Heal и Review сюда не входят.`],
    ['РЕШЕНИЯ',sample,'Только уникальные зачётные действия. Повторы Daily, двойные тапы и учебный Review ранг не фармят.'],
    ['СЕРИЯ',Number(state().streak)||0,'Считаются только последовательные локальные календарные дни. После пропуска серия начинается заново.']
  ];
  rows.forEach((el,index)=>{
    const data=info[index];if(!data)return;
    el.classList.add('v32Metric');el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`Открыть описание: ${data[0]}`);
    const open=()=>metricModal(data[0],data[1],data[2]);el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
  });
}
const baseHome=window.renderHome;
window.renderHome=function renderHomeV32(){const result=baseHome.apply(this,arguments);enhanceHomeV32();return result};

function downloadJson(data,name){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.exportPokerSwipe32=()=>downloadJson({format:'PokerSwipe Backup',schemaVersion:32,exportedAt:new Date().toISOString(),state:state()},`pokerswipe-backup-${localDay()}.json`);
function importStateFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(String(reader.result||'')),incoming=parsed?.state||parsed;
      if(!incoming||typeof incoming!=='object'||!Array.isArray(incoming.events))throw new Error('Это не backup PokerSwipe');
      window.S=migrateV32(typeof structuredClone==='function'?structuredClone(incoming):JSON.parse(JSON.stringify(incoming)),{save:false});
      if(!saveV32())throw new Error('Не удалось записать импорт');
      window.openModal('<span class="ey">ИМПОРТ ГОТОВ</span><h2>ДАННЫЕ ВОССТАНОВЛЕНЫ</h2><p>Приложение перезапустится с восстановленным профилем.</p>');
      setTimeout(()=>location.reload(),900);
    }catch(error){window.openModal(`<span class="ey">ИМПОРТ НЕ УДАЛСЯ</span><h2>ФАЙЛ НЕ ПОДОШЁЛ</h2><p>${esc(error.message)}</p>`)}
  };
  reader.readAsText(file);
}

function profileToolsV32(){
  const root=q('#profileArea');if(!root)return;
  root.querySelector('.v32ProfileTools')?.remove();
  const bytes=new Blob([JSON.stringify(state())]).size;
  const box=document.createElement('div');box.className='panel v32ProfileTools';
  box.innerHTML=`<span class="ey">УПРАВЛЕНИЕ ПРОФИЛЕМ · V32</span><h2>ДАННЫЕ ПОД КОНТРОЛЕМ</h2><p class="mut small">Локальный профиль: ${(bytes/1024).toFixed(1)} КБ. Публичная синхронизация временно отключена до серверной проверки Telegram и RLS.</p><div class="v32ToolGrid"><button id="v32Heal">HEAL-КУРСЫ</button><button id="v32Retake">ПЕРЕПРОЙТИ ТЕСТ</button><button id="v32Export">ЭКСПОРТ JSON</button><button id="v32Import">ИМПОРТ JSON</button></div><input class="hidden" id="v32ImportFile" type="file" accept="application/json,.json">`;
  root.appendChild(box);
  q('#v32Heal').onclick=()=>window.show('heal');
  q('#v32Retake').onclick=()=>window.startDiagnostic25?.(true);
  q('#v32Export').onclick=window.exportPokerSwipe32;
  q('#v32Import').onclick=()=>q('#v32ImportFile').click();
  q('#v32ImportFile').onchange=e=>{const file=e.target.files?.[0];if(file)importStateFile(file)};
  const players=q('#players28Box');if(players)players.innerHTML='<h3>ДРУГИЕ ИГРОКИ</h3><div class="sync28">Публичные профили временно отключены: сначала серверная проверка Telegram и RLS, потом социальный слой.</div>';
}
const baseProfile=window.renderProfile;
window.renderProfile=function renderProfileV32(){const result=baseProfile.apply(this,arguments);profileToolsV32();setTimeout(profileToolsV32,60);return result};

/* Disable the unsafe automatic public layer until a verified backend is added. */
window.publishProfile28=async()=>false;
window.loadPlayers28=async()=>[];

function setCard(id,card){const el=q('#'+id);if(!el)return;el.dataset.card=card;window.refreshCardButton18?.(id)}
window.wireEq18=function wireEqV32(){
  const draft=state().drafts?.equity||{},defaults={eh1:draft.eh1||'As',eh2:draft.eh2||'Kh',ev1:draft.ev1||'Qc',ev2:draft.ev2||'Qd'};
  Object.entries(defaults).forEach(([id,card])=>{if(!q('#'+id)?.dataset.card)setCard(id,card)});
  [1,2,3,4,5].forEach(i=>{if(draft['eb'+i])setCard('eb'+i,draft['eb'+i])});
  if(q('#pot18')&&draft.pot)q('#pot18').value=draft.pot;if(q('#call18')&&draft.call)q('#call18').value=draft.call;
  let latest=null,request=0,worker=null;
  try{if('Worker'in window)worker=new Worker('equity_worker_v32.js',{name:'pokerswipe-equity'})}catch(error){console.warn('Equity worker unavailable',error)}
  const get=id=>q('#'+id)?.dataset.card||null;
  const render=()=>{
    const p=Number(q('#pot18')?.value||0),c=Number(q('#call18')?.value||0),need=c/(p+c+c)*100;
    if(q('#potr'))q('#potr').textContent=p+' BB';if(q('#callr'))q('#callr').textContent=c+' BB';
    if(!latest)return;
    q('#eqout').innerHTML=`<div class="eqResultCompact18"><div><strong>${latest.h.toFixed(1)}%</strong><small>ТЫ</small></div><b>VS</b><div><strong>${latest.v.toFixed(1)}%</strong><small>ОПП</small></div></div><p class="mut small">${latest.approx?'Monte Carlo · ':''}${latest.n.toLocaleString('ru-RU')} раскладов</p>`;
    const edge=latest.h-need;q('#math18').className='answer18 '+(edge>=0?'good18':'bad18');q('#math18').innerHTML=`<h2>${edge>=0?'CALL ✓':'FOLD'}</h2><p>Нужно ${need.toFixed(1)}%. Equity ${latest.h.toFixed(1)}%. ${edge>=0?`Запас +${edge.toFixed(1)} п.п.`:`Не хватает ${Math.abs(edge).toFixed(1)} п.п.`}</p>`;
  };
  const calculate=()=>{
    const hero=[get('eh1'),get('eh2')],villain=[get('ev1'),get('ev2')],board=[1,2,3,4,5].map(i=>get('eb'+i)).filter(Boolean),known=[...hero,...villain,...board].filter(Boolean);
    latest=null;
    if(!hero.every(Boolean)||!villain.every(Boolean)||new Set(known).size!==known.length){q('#eqout').innerHTML='<p>Выбери две разные руки без повторяющихся карт.</p>';q('#math18').innerHTML='';return}
    const exact=board.length>=3?window.equity18(hero,villain,board):null;
    if(exact){latest={...exact,approx:false};render();return}
    const id=++request;q('#eqout').innerHTML='<div class="v32Calculating">СЧИТАЮ ПРЕФЛОП…</div>';q('#math18').innerHTML='<p>Перебираю случайные борды вне интерфейсного потока.</p>';
    if(!worker){q('#eqout').innerHTML='<p>Этот браузер не запустил фоновый расчёт. Открой приложение через HTTPS/Telegram.</p>';return}
    worker.onmessage=event=>{if(event.data?.id!==id)return;latest=event.data.result;render()};
    worker.onerror=()=>{if(id===request)q('#eqout').innerHTML='<p>Фоновый расчёт не запустился. Обнови приложение.</p>'};
    worker.postMessage({id,hero,villain,board,samples:40000});
  };
  window.bindCardPicker18(['eh1','eh2','ev1','ev2','eb1','eb2','eb3','eb4','eb5'],calculate);
  ['pot18','call18'].forEach(id=>{const el=q('#'+id);if(el)el.oninput=render});
  calculate();
};

function handTitle(hand){return hand.hero||hand.raw?.hero?.map(c=>c||'—').join(' ')||'Раздача'}
const toolsHtml=`<div class="my18Tools"><button class="my18Tool eqCard" onclick="myGo18('eq')"><span class="vis18">A♠ Q♥</span><span class="ey">КАЛЬКУЛЯТОР</span><h2>ALL-IN</h2><p>Префлоп и postflop equity.</p><span class="go">СЧИТАТЬ →</span></button><button class="my18Tool pushCard" onclick="myGo18('push')"><span class="vis18">8 BB</span><span class="ey">ОРИЕНТИР</span><h2>PUSH<br>/ FOLD</h2><p>Без ложной ICM-точности.</p><span class="go">РЕШИТЬ →</span></button><button class="my18Tool reconCard" onclick="myGo18('recon')"><span class="vis18">↯</span><span class="ey">ПОСЛЕ КАТКИ</span><h2>РАЗБОР<br>РАЗДАЧИ</h2><p>Валидная линия и единая шкала.</p><span class="go">РАЗОБРАТЬ →</span></button></div>`;
window.myHub18=function myHubV32(){
  const hands=[...(state().myHands18||[])].sort((a,b)=>Number(b.createdAt||b.id||0)-Number(a.createdAt||a.id||0));
  return `<div class="my18"><span class="ey">ИНСТРУМЕНТЫ ДЛЯ ОФЛАЙНА</span><h1 class="impact">МОИ<br><span class="pink">КАРТЫ.</span></h1><div class="my18Intro">Калькуляторы и единая история раздач. Старые записи мигрированы и больше не спрятаны во втором массиве.</div>${toolsHtml}<div class="v32HandsHead"><span class="ey">ВСЯ ИСТОРИЯ · ${hands.length}</span><button data-v32-all-hands>ЭКСПОРТ ВСЕХ</button></div><div class="v32HandsList">${hands.length?hands.map(hand=>`<div class="v32HandRow"><button class="v32HandOpen" ${hand.raw?`data-saved22="${esc(hand.id)}"`:''}><b>${esc(handTitle(hand))} · ${esc(hand.pos||hand.heroPos||'')}</b><small>${esc(hand.question||hand.result||'сохранено')}${hand.legacy?' · старая запись':''}</small></button><div><button data-v32-hand-export="${esc(hand.id)}">JSON</button><button data-v32-hand-delete="${esc(hand.id)}">УДАЛИТЬ</button></div></div>`).join(''):'<div class="saved18"><b>Пока пусто.</b><small>Принеси сюда первую спорную раздачу.</small></div>'}</div></div>`;
};
function bindHandsV32(){
  q('[data-v32-all-hands]')?.addEventListener('click',()=>downloadJson(state().myHands18,`pokerswipe-hands-${localDay()}.json`),{once:true});
  qa('[data-v32-hand-export]').forEach(button=>button.onclick=()=>{const hand=state().myHands18.find(x=>String(x.id)===button.dataset.v32HandExport);if(hand)downloadJson(hand,`pokerswipe-hand-${hand.id}.json`)});
  qa('[data-v32-hand-delete]').forEach(button=>button.onclick=()=>confirmHandDelete(button.dataset.v32HandDelete));
}
function confirmHandDelete(id){
  const hand=state().myHands18.find(x=>String(x.id)===String(id));if(!hand)return;
  window.openModal(`<span class="ey">УДАЛИТЬ РАЗДАЧУ?</span><h2>${esc(handTitle(hand))}</h2><p>Это действие можно отменить сразу после удаления.</p><div class="grid2"><button class="secondary" id="v32HandNo">ОСТАВИТЬ</button><button class="primary" id="v32HandYes">УДАЛИТЬ</button></div>`);
  setTimeout(()=>{q('#v32HandNo').onclick=window.closeModal;q('#v32HandYes').onclick=()=>{const index=state().myHands18.findIndex(x=>String(x.id)===String(id));const removed=state().myHands18.splice(index,1)[0];saveV32();window.closeModal();window.renderMy();window.openModal('<h2>РАЗДАЧА УДАЛЕНА</h2><button class="primary" id="v32UndoHand">ОТМЕНИТЬ →</button>');setTimeout(()=>q('#v32UndoHand').onclick=()=>{state().myHands18.splice(index,0,removed);saveV32();window.closeModal();window.renderMy()},0)}},0);
}
const baseMy=window.renderMy;
window.renderMy=function renderMyV32(){const result=baseMy.apply(this,arguments);setTimeout(bindHandsV32,0);return result};

const baseHandSave=window.hr22Save;
window.hr22Save=function saveHandV32(){
  const hand=baseHandSave.apply(this,arguments);
  if(state().drafts)delete state().drafts.hand;
  saveV32();
  return hand;
};

window.t23Return=t=>numberV32(t?.prize)+numberV32(t?.bountyWon);
window.t23Profit=t=>window.t23Return(t)-window.t23Cost(t);
window.t23Card=function tournamentCardV32(t){
  const profit=window.t23Profit(t),status=window.t23Status(t),mode=t.type==='offline'?'offline':'online';
  const bountyMoney=numberV32(t.bountyWon);
  return `<button class="t23Card ${mode} ${profit>0?'profit':profit<0?'loss':''} ${status==='win'?'win':''}" data-t23open="${esc(t.id)}"><div class="t23Row"><div class="t23Poster ${mode}">${esc(window.t23Initials(t.name))}</div><div class="t23Main"><b>${esc(t.name||'Без названия')}</b><div class="t23Meta"><span class="t23Tag ${mode}">${mode==='online'?'ОНЛАЙН':'ОФЛАЙН'}</span><span>${window.t23DateLabel(t.date)}</span>${t.field?`<span>· ${t.field} игроков</span>`:''}</div>${status?`<span class="t23Status ${status}">${window.t23StatusLabel(t)}</span>`:''}</div><div class="t23Money"><b class="${profit>0?'green':profit<0?'red':''}">${profit>0?'+':''}${window.t23Money(profit,t.currency)}</b><small>результат</small></div></div><div class="t23Facts"><div class="t23Fact"><span>БАЙ-ИН</span><b>${window.t23Money(t.buyin,t.currency)} × ${Math.max(1,t.entries||1)}</b></div><div class="t23Fact"><span>BOUNTY</span><b>${t.bountyCount||0}${bountyMoney?` · ${window.t23Money(bountyMoney,t.currency)}`:''}</b></div><div class="t23Fact"><span>МЕСТО</span><b>${t.place||'—'}${t.field?'/'+t.field:''}</b></div></div></button>`;
};

function tournamentFormV32(t={}){
  const edit=Boolean(t.id),type=t.type||'online',currency=t.currency||window.T23_CURRENCY||'USD';
  return `<div class="t23Form"><span class="ey">${edit?'РЕДАКТИРОВАТЬ':'НОВЫЙ ТУРНИР'} · V32</span><h2>${edit?'ИСПРАВЬ ТУРНИР':'ДОБАВЬ ТУРНИР'}</h2><div id="v32TournamentError" class="v32FormError hidden"></div><div class="t23Field"><label>ГДЕ ИГРАЛ</label><div class="t23Type"><button data-t23type="online" class="${type==='online'?'on':''}">ОНЛАЙН</button><button data-t23type="offline" class="${type==='offline'?'on':''}">ОФЛАЙН</button></div></div><div class="t23Field"><label>НАЗВАНИЕ</label><input id="t23Name" maxlength="60" value="${esc(t.name||'')}" placeholder="Sunday Storm / Triton"></div><div class="t23FormGrid"><div class="t23Field"><label>ДАТА</label><input id="t23Date" type="date" value="${esc(t.date||localDay())}"></div><div class="t23Field"><label>ВАЛЮТА</label><select id="t23Currency"><option value="USD" ${currency==='USD'?'selected':''}>$ USD</option><option value="EUR" ${currency==='EUR'?'selected':''}>€ EUR</option><option value="RUB" ${currency==='RUB'?'selected':''}>₽ RUB</option></select></div></div><div class="t23FormGrid"><div class="t23Field"><label>БАЙ-ИН</label><input id="t23Buyin" inputmode="decimal" value="${t.buyin??''}" placeholder="10,5"></div><div class="t23Field"><label>ПУЛЬ</label><input id="t23Entries" inputmode="numeric" value="${t.entries??1}" placeholder="1"></div></div><div class="t23FormGrid"><div class="t23Field"><label>BOUNTY · КОЛИЧЕСТВО</label><input id="t23BCount" inputmode="numeric" value="${t.bountyCount??0}"></div><div class="t23Field"><label>BOUNTY · ДЕНЬГИ</label><input id="t23BWon" inputmode="decimal" value="${t.bountyWon??0}"></div></div><div class="t23FormGrid"><div class="t23Field"><label>ПРИЗОВЫЕ БЕЗ BOUNTY</label><input id="t23Prize" inputmode="decimal" value="${t.prize??0}"></div><div class="t23Field"><label>МЕСТО</label><input id="t23Place" inputmode="numeric" value="${t.place??''}"></div></div><div class="t23Field"><label>ПОЛЕ</label><input id="t23Field" inputmode="numeric" value="${t.field??''}"></div><div class="t23FormActions">${edit?'<button class="t23Delete" id="t23Delete">УДАЛИТЬ</button>':'<span></span>'}<button class="primary" id="t23Save">${edit?'СОХРАНИТЬ':'ДОБАВИТЬ'} →</button></div></div>`;
}
function showTournamentError(message){const box=q('#v32TournamentError');if(!box)return;box.textContent=message;box.classList.remove('hidden');box.scrollIntoView?.({block:'nearest'})}
window.openTournamentForm23=function openTournamentFormV32(id=null){
  const old=id?state().tournaments.find(x=>String(x.id)===String(id)):null;let type=old?.type||'online';
  window.openModal(tournamentFormV32(old||{type}));
  setTimeout(()=>{
    qa('[data-t23type]').forEach(button=>button.onclick=()=>{type=button.dataset.t23type;qa('[data-t23type]').forEach(x=>x.classList.toggle('on',x.dataset.t23type===type))});
    q('#t23Save').onclick=()=>{
      const name=q('#t23Name').value.trim(),date=q('#t23Date').value||localDay(),buyin=numberV32(q('#t23Buyin').value),entries=Math.round(numberV32(q('#t23Entries').value)),place=Math.round(numberV32(q('#t23Place').value)),field=Math.round(numberV32(q('#t23Field').value));
      if(!name)return showTournamentError('Добавь название турнира.');
      if(date>localDay())return showTournamentError('Дата турнира не может быть в будущем.');
      if(buyin<=0)return showTournamentError('Бай-ин должен быть больше нуля. Для фриролла укажи минимальную условную стоимость отдельно позже.');
      if(entries<1)return showTournamentError('Количество пуль должно быть не меньше одной.');
      if(place<0||field<0||(place&&field&&place>field))return showTournamentError('Место не может быть больше размера поля.');
      const record={...old,id:old?.id||uid('t32'),schemaVersion:32,type,name,date,currency:q('#t23Currency').value||'USD',buyin,entries,bountyCount:Math.max(0,Math.round(numberV32(q('#t23BCount').value))),bountyWon:Math.max(0,numberV32(q('#t23BWon').value)),prize:Math.max(0,numberV32(q('#t23Prize').value)),place:Math.max(0,place),field:Math.max(0,field),updatedAt:Date.now(),createdAt:old?.createdAt||Date.now()};
      state().tournaments=state().tournaments.filter(x=>String(x.id)!==String(record.id));state().tournaments.push(record);window.T23_CURRENCY=record.currency;saveV32();window.closeModal();window.renderTournaments23();
    };
    if(q('#t23Delete'))q('#t23Delete').onclick=()=>requestTournamentDelete(old.id);
  },0);
};
function requestTournamentDelete(id){
  const tournament=state().tournaments.find(x=>String(x.id)===String(id));if(!tournament)return;
  window.openModal(`<span class="ey">УДАЛИТЬ ТУРНИР?</span><h2>${esc(tournament.name)}</h2><p>Запись исчезнет из статистики. После удаления будет кнопка Undo.</p><div class="grid2"><button class="secondary" id="v32TournamentNo">ОСТАВИТЬ</button><button class="primary" id="v32TournamentYes">УДАЛИТЬ</button></div>`);
  setTimeout(()=>{q('#v32TournamentNo').onclick=window.closeModal;q('#v32TournamentYes').onclick=()=>{const index=state().tournaments.findIndex(x=>String(x.id)===String(id)),removed=state().tournaments.splice(index,1)[0];saveV32();window.renderTournaments23();window.openModal('<h2>ТУРНИР УДАЛЁН</h2><button class="primary" id="v32UndoTournament">UNDO →</button>');setTimeout(()=>q('#v32UndoTournament').onclick=()=>{state().tournaments.splice(index,0,removed);saveV32();window.closeModal();window.renderTournaments23()},0)}},0);
}
window.openTournament23=function openTournamentV32(id){
  const tournament=state().tournaments.find(x=>String(x.id)===String(id));if(!tournament)return;
  const profit=window.t23Profit(tournament),cost=window.t23Cost(tournament),returned=window.t23Return(tournament),roi=cost?profit/cost*100:0,status=window.t23Status(tournament),mode=tournament.type==='offline'?'offline':'online';
  window.openModal(`<div class="t23Form"><div class="t23DetailTop"><div class="t23DetailPoster">${esc(window.t23Initials(tournament.name))}</div><div><span class="ey">${mode==='online'?'ОНЛАЙН':'ОФЛАЙН'} · ${window.t23DateLabel(tournament.date)}</span><h2 style="margin:3px 0">${esc(tournament.name)}</h2>${status?`<span class="t23Status ${status}">${window.t23StatusLabel(tournament)}</span>`:''}</div></div><div class="t23DetailGrid"><div><small>ВЛОЖЕНО</small><b>${window.t23Money(cost,tournament.currency)}</b></div><div><small>ВЕРНУЛОСЬ</small><b>${window.t23Money(returned,tournament.currency)}</b></div><div><small>ПРОФИТ</small><b class="${profit>0?'green':profit<0?'red':''}">${profit>0?'+':''}${window.t23Money(profit,tournament.currency)}</b></div><div><small>ROI</small><b>${cost?(roi>0?'+':'')+roi.toFixed(1)+'%':'—'}</b></div><div><small>BOUNTY</small><b>${tournament.bountyCount||0} · ${window.t23Money(numberV32(tournament.bountyWon),tournament.currency)}</b></div><div><small>МЕСТО</small><b>${tournament.place||'—'}${tournament.field?'/'+tournament.field:''}</b></div></div><div class="t23DetailActions24"><button class="primary" id="t23Edit">РЕДАКТИРОВАТЬ →</button><button class="t23EditGhost24" id="t23QuickDelete">УДАЛИТЬ</button></div></div>`);
  setTimeout(()=>{
    q('#t23Edit').onclick=event=>{event.preventDefault();window.closeModal();setTimeout(()=>window.openTournamentForm23(id),80)};
    q('#t23QuickDelete').onclick=event=>{event.preventDefault();requestTournamentDelete(id)};
  },0);
};

core.store.getState=()=>state();
core.store.subscribe=listener=>{subscribers.add(listener);return()=>subscribers.delete(listener)};
core.store.dispatch=action=>{
  if(typeof action==='function')action(state());
  else if(action?.type==='MERGE_STATE'&&action.payload&&typeof action.payload==='object')Object.assign(state(),action.payload);
  else throw new Error('Unknown store action');
  saveV32();return state();
};
core.store.replaceState=next=>{window.S=migrateV32(next,{save:false});saveV32();return state()};
core.analytics.recordDecision=event=>window.recordEvent(event);
core.router.open=id=>window.show(id);

migrateV32(state(),{save:false});
if(state().drafts?.hand)try{window.HR22=JSON.parse(JSON.stringify(state().drafts.hand))}catch(_){}
if(!state().diagDone&&state().drafts?.diagnostic?.results?.length){
  try{window.D25={...state().drafts.diagnostic,active:true,started:performance.now(),pending:null};window.renderDiagnostic()}catch(error){console.warn('Diagnostic draft restore failed',error)}
}
if(state().drafts?.quick?.active&&Date.now()-Number(state().drafts.quick.savedAt||0)<3600000){
  try{
    const draft=state().drafts.quick;window.quick={...draft.quick,active:true};window.swSession=draft.swSession||[];window.swIndex=Number(draft.swIndex)||0;window.swSessionGrades=draft.swSessionGrades||[];
    const mode=window.quick.flow?.[window.quick.index]||'swipe';setTimeout(()=>window.show(mode==='memory'?'swipe':mode),0);
  }catch(error){console.warn('Quick draft restore failed',error)}
}
state().skill=overallSkillV32();
saveV32();

let draftSaveTimer=null;
function writeDraftsV32(){
    clearTimeout(draftSaveTimer);draftSaveTimer=null;
    const S=state();S.drafts=S.drafts||{};
    if(q('#myArea #hr22Next')&&window.HR22)S.drafts.hand=JSON.parse(JSON.stringify(window.HR22));
    if(q('#myArea #eqout')){
      const value=id=>q('#'+id)?.dataset.card||null;
      S.drafts.equity={eh1:value('eh1'),eh2:value('eh2'),ev1:value('ev1'),ev2:value('ev2'),...Object.fromEntries([1,2,3,4,5].map(i=>['eb'+i,value('eb'+i)])),pot:q('#pot18')?.value||12,call:q('#call18')?.value||5};
    }
    if(!S.diagDone&&window.D25?.active&&window.D25.results?.length)S.drafts.diagnostic=JSON.parse(JSON.stringify(window.D25));else if(S.diagDone)delete S.drafts.diagnostic;
    if(window.quick?.active)S.drafts.quick={active:true,savedAt:Date.now(),quick:JSON.parse(JSON.stringify(window.quick)),swSession:JSON.parse(JSON.stringify(window.swSession||[])),swIndex:window.swIndex,swSessionGrades:JSON.parse(JSON.stringify(window.swSessionGrades||[]))};else delete S.drafts.quick;
    saveV32();
}
function captureDraftsV32(){
  clearTimeout(draftSaveTimer);
  draftSaveTimer=setTimeout(writeDraftsV32,350);
}
document.addEventListener('click',captureDraftsV32);
document.addEventListener('input',captureDraftsV32);
window.addEventListener('pagehide',writeDraftsV32);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')writeDraftsV32()});

document.documentElement.dataset.pokerSwipeVersion='32.0';
document.documentElement.dataset.pokerSwipeSchema='32';
const meta=q('meta[name="app-version"]');if(meta)meta.content='32.0';
document.title='POKER SWIPE — V32 STABLE';
const build=q('.build');if(build)build.textContent='V32 STABLE';
if(!q('#mainApp')?.classList.contains('hidden')&&q('#home')?.classList.contains('active'))window.renderHome();
window.__pokerBooted=true;
window.__pokerReadyV32=true;
window.dispatchEvent(new CustomEvent('pokerswipe:ready',{detail:{version:'32.0',schemaVersion:32}}));
})();
