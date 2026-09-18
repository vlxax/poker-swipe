import { UO_DATA, RANGE_LIBRARY } from './ranges-data.js';
import { actionMap, safeChart, canonicalHands, sourceModeLabel, validateUO, comboCount, familyForHand, FAMILY_LABELS } from './core.js';
import { loadChartAsset } from './chart-assets.js';
import { STRUCTURED_LIBRARY, MODE_ACTION_CHOICES } from './structured-library.js';
import {
  ACTION_LABELS, CONFIRMED_ACTIONS, decodeStructured, strictCandidates, uoDecisionCandidates,
  activeSetFromChart, activeSetFromStructured, fisherYates, handStats, selectAdaptiveQuestions,
  rangeShapeCompare, shapeLeakSummary, masterySummary, uoBoundaryCandidates,
  structuredBoundaryCandidates, compareActiveSets, compareActionMaps, rangeComposition
} from './trainer-core.js';

const POSITIONS=UO_DATA.positions||[];
const STACKS=UO_DATA.stack_bands||[];
const RANKS=UO_DATA.rank_order||['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const HANDS=canonicalHands(RANKS);
const PREF_KEY='pokerswipe.ranges.v12';
const HISTORY_KEY='pokerswipe.ranges.history';
const structuredById=new Map(STRUCTURED_LIBRARY.map(x=>[x.id,x]));
const manifestById=new Map(RANGE_LIBRARY.map(x=>[x.chart_id,x]));
let rapidTimer=null;

const MODE_LABEL={
  callpush:'КОЛЛ ПРОТИВ ОЛЛ-ИНА',vs1r:'ПРОТИВ ОТКРЫТИЯ',vssqueeze:'ПРОТИВ СКВИЗА',
  vs1r1c:'ПРОТИВ РЕЙЗА И КОЛЛА',vs3bet:'ПРОТИВ 3-БЕТА',vs2r:'ПРОТИВ ДВУХ РЕЙЗОВ',
  sbvsbb:'SB ПРОТИВ BB',vs1rshort:'ПРОТИВ КОРОТКОГО ОПЕНА',vs4bet:'ПРОТИВ 4-БЕТА',
  vslimp:'ПРОТИВ ЛИМПА',huante:'ХЕДЗ-АП С АНТЕ'
};
const labelMode=v=>MODE_LABEL[v]||sourceModeLabel(v)||'ПРЕФЛОП';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtStack=s=>!s?'':(/bb$/i.test(String(s))?String(s):`${s} BB`);
const pct=n=>`${Math.round(n||0)}%`;
const nowIso=()=>new Date().toISOString();

const state={
  view:'home', prevView:'home', position:'BTN', stack:'18-25', spotId:null,
  selectedHand:null, trainingMode:'learn', quiz:null, results:null,
  buildSelected:new Set(), buildCompared:false,
  query:'', filterMode:'', filterPos:'', filterStack:'', page:0,
  showOriginal:false, diffStack:null, diffPosition:null
};

function loadHistory(){try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function saveHistory(row){try{const a=loadHistory();a.unshift(row);localStorage.setItem(HISTORY_KEY,JSON.stringify(a.slice(0,500)));}catch{}}
function loadPrefs(){try{const p=JSON.parse(localStorage.getItem(PREF_KEY)||'null');if(p&&POSITIONS.includes(p.position))state.position=p.position;if(p&&STACKS.includes(p.stack))state.stack=p.stack;if(p?.spotId)state.spotId=p.spotId;}catch{}}
function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify({position:state.position,stack:state.stack,spotId:state.spotId}));}catch{}}

function ensureCss(){if(document.querySelector('link[data-ranges-ui]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='ranges-ui/ranges-ui.css';l.dataset.rangesUi='1';document.head.appendChild(l);}
function ensureScreen(){let s=document.getElementById('ranges');if(!s){s=document.createElement('section');s.id='ranges';s.className='screen psScreen';s.innerHTML='<div id="rangesArea"></div>';const x=document.getElementById('xray');(x?.parentNode||document.getElementById('mainApp')||document.body).insertBefore(s,x||null);}else{s.classList.add('psScreen');if(!s.querySelector('#rangesArea'))s.innerHTML='<div id="rangesArea"></div>';}return s;}

function uoId(position=state.position,stack=state.stack){return `UO:${position}:${stack}`;}
function currentSpotId(){return state.spotId||uoId();}
function isUoId(id){return String(id||'').startsWith('UO:');}
function parseUoId(id){const [,position,stack]=String(id).split(':');return {position,stack};}
function setSpot(id){state.spotId=id;if(isUoId(id)){const p=parseUoId(id);if(POSITIONS.includes(p.position))state.position=p.position;if(STACKS.includes(p.stack))state.stack=p.stack;}state.selectedHand=null;state.buildSelected=new Set();state.buildCompared=false;state.showOriginal=false;}
function currentUoChart(){const id=currentSpotId();const p=isUoId(id)?parseUoId(id):{position:state.position,stack:state.stack};return safeChart(UO_DATA,p.position,p.stack);}
function uoChartFor(meta){return safeChart(UO_DATA,meta?.position||state.position,meta?.stack||state.stack);}
function spotMeta(id=currentSpotId()){
  if(isUoId(id)){const {position,stack}=parseUoId(id);return {id,type:'uo',title:`${position} · ${fmtStack(stack)}`,mode:'RFI · ПЕРВЫЙ В БАНК',position,stack,opponent:'',bet:'',open:'',actionContext:'до нас все сфолдили'};}
  const m=manifestById.get(id),r=structuredById.get(id);if(!m||!r)return null;
  return {id,type:'library',title:[m.position,fmtStack(m.stack)].filter(Boolean).join(' · '),mode:labelMode(m.source_mode),position:m.position,stack:m.stack,opponent:m.opponent,bet:m.bet,open:m.open,spot:m.spot,actionContext:m.spot||'',rec:r,manifest:m};
}
function contextLine(meta){return [meta?.position,fmtStack(meta?.stack),meta?.actionContext||'',meta?.opponent?`vs ${meta.opponent}`:'',meta?.open?`open ${meta.open}`:'',meta?.bet?`size ${meta.bet}`:''].filter(Boolean).join(' · ');}
function confirmedDecisionRows(meta){if(!meta)return[];if(meta.type==='uo')return uoDecisionCandidates(uoChartFor(meta),RANKS);return strictCandidates(meta.rec,MODE_ACTION_CHOICES,RANKS);}
function boundaryRows(meta){if(!meta)return[];if(meta.type==='uo')return uoBoundaryCandidates(uoChartFor(meta),RANKS);return structuredBoundaryCandidates(meta.rec,RANKS);}
function activeSet(meta){if(!meta)return new Set();if(meta.type==='uo')return activeSetFromChart(uoChartFor(meta),RANKS);return activeSetFromStructured(meta.rec,RANKS);}
function eligibleForMastery(meta,kind='boundary'){const rows=kind==='decision'?confirmedDecisionRows(meta):boundaryRows(meta);return new Set(rows.map(([h])=>h));}
function masteryFor(meta,kind='boundary'){return masterySummary(loadHistory(),meta.id,eligibleForMastery(meta,kind),{kind});}
function skillFor(meta){
  const boundary=masteryFor(meta,'boundary'), decision=confirmedDecisionRows(meta).length>=4?masteryFor(meta,'decision'):null;
  return {boundary,decision};
}

function header(){return `<header class="rg-head"><div><div class="rg-brand">POKER SWIPE</div><h1>РЕНДЖИ</h1></div>${state.view==='home'?'<button class="rg-home" data-app-home>ГЛАВНАЯ</button>':'<button class="rg-back" data-back>← НАЗАД</button>'}</header>`;}
function nav(){if(['quiz','results'].includes(state.view))return'';return `<nav class="rg-nav"><button data-view="home" class="${state.view==='home'?'on':''}">СЕГОДНЯ</button><button data-view="spots" class="${['spots','spot','study','build','diff'].includes(state.view)?'on':''}">СПОТЫ</button></nav>`;}
function appHome(){try{if(typeof window.show==='function')window.show('home');else location.hash='#home';}catch{}}

function aggregateSpotHistory(){
  const rows=loadHistory().filter(x=>x.version>=10&&x.strict!==false&&x.spotId&&Array.isArray(x.answers)&&!x.isCorrection),ids=[...new Set(rows.map(x=>x.spotId))],out=[];
  for(const id of ids){const meta=spotMeta(id);if(!meta)continue;const skills=skillFor(meta);out.push({id,meta,skills});}
  return out.sort((a,b)=>Math.min(a.skills.boundary.skill,a.skills.decision?.skill??100)-Math.min(b.skills.boundary.skill,b.skills.decision?.skill??100));
}

function dailyPlan(limit=20){
  const trained=aggregateSpotHistory();
  const pool=[];
  for(const x of trained){
    for(const kind of ['decision','boundary']){
      const candidates=kind==='decision'?confirmedDecisionRows(x.meta):boundaryRows(x.meta);
      if(kind==='decision' && new Set(candidates.map(([,v])=>v.action)).size<2) continue;
      const stats=handStats(loadHistory(),x.id,{kind});
      for(const [h,v] of candidates){
        const st=stats.get(h);
        const bucket=!st?'new':(st.lastCorrect===false?'error':(isDueLocal(st)?'due':'review'));
        if(bucket==='review') continue;
        pool.push({spotId:x.id,kind,h,v,bucket,st});
      }
    }
  }
  const rank={error:0,due:1,new:2,review:3};
  pool.sort((a,b)=>(rank[a.bucket]-rank[b.bucket])||((b.st?.wrong||0)-(a.st?.wrong||0))||Math.random()-.5);
  const quotas={error:8,due:7,new:5}, out=[], seen=new Set();
  for(const bucket of ['error','due','new']){
    let n=quotas[bucket];
    for(const x of pool){if(n<=0||out.length>=limit)break;const k=`${x.spotId}|${x.kind}|${x.h}`;if(x.bucket!==bucket||seen.has(k))continue;seen.add(k);out.push(x);n--;}
  }
  for(const x of pool){if(out.length>=limit)break;const k=`${x.spotId}|${x.kind}|${x.h}`;if(seen.has(k))continue;seen.add(k);out.push(x);}
  return out;
}
function isDueLocal(stat){
  if(!stat?.lastAt)return false;
  const t=Date.parse(stat.lastAt);if(!Number.isFinite(t))return false;
  if(!stat.lastCorrect)return t+12*60*60*1000<=Date.now();
  const days=stat.streak>=4?7:stat.streak>=2?3:1;
  return t+days*86400000<=Date.now();
}
function startToday(){
  const plan=dailyPlan(20);if(!plan.length){go('spots');return;}
  const questions=plan.map(x=>{
    const meta=spotMeta(x.spotId);
    const candidates=x.kind==='decision'?confirmedDecisionRows(meta):boundaryRows(meta);
    const choices=x.kind==='decision'?[...new Set(candidates.map(([,v])=>v.action))]:['IN','OUT'];
    return {spotId:x.spotId,h:x.h,kind:x.kind,truth:x.kind==='decision'?x.v.action:(x.v.active?'IN':'OUT'),choices,bucket:x.bucket};
  }).filter(q=>q.kind!=='decision'||q.choices.length>=2);
  state.quiz={spotId:null,kind:'today',mode:'exam',questions,index:0,answers:[],answered:false,last:null,startedAt:performance.now(),questionAt:performance.now(),isCorrection:false,isToday:true};
  state.results=null;state.view='quiz';render();
}

function home(){
  const trained=aggregateSpotHistory(),weak=trained.slice(0,3),due=trained.reduce((n,x)=>n+x.skills.boundary.due+(x.skills.decision?.due||0),0),newHands=trained.reduce((n,x)=>n+x.skills.boundary.newCount+(x.skills.decision?.newCount||0),0);
  const continueSpot=weak[0]?.id||currentSpotId(),plan=dailyPlan(20),planErrors=plan.filter(x=>x.bucket==='error').length,planDue=plan.filter(x=>x.bucket==='due').length,planNew=plan.filter(x=>x.bucket==='new').length;
  const categories=new Map();for(const x of trained){const k=x.meta.mode,v=categories.get(k)||{sum:0,n:0};v.sum+=Math.min(x.skills.boundary.skill,x.skills.decision?.skill??100);v.n++;categories.set(k,v);}const cat=[...categories].map(([k,v])=>[k,Math.round(v.sum/v.n)]).sort((a,b)=>a[1]-b[1]).slice(0,5);
  return `<main class="rg-home-screen">
    <section class="rg-today"><div class="rg-eyebrow">СЕГОДНЯ</div><h2>${due?`${due} рук пора повторить`:trained.length?'Нет просроченных повторений':'Начни с первого спота'}</h2><p>${trained.length?`${newHands} рук ещё не проверялись. Ошибки, новые руки и повторения теперь считаются отдельно.`:'Выбери спот: сначала изучи матрицу, затем собери её и тренируй границу.'}</p>${plan.length?`<div class="rg-today-mix"><span>${planErrors} ошибок</span><span>${planDue} повторить</span><span>${planNew} новых</span></div><button class="rg-primary" id="rgStartToday">НАЧАТЬ · ${plan.length} РЕШЕНИЙ</button>`:`<button class="rg-primary" data-view="spots">ВЫБРАТЬ СПОТ</button>`}</section>
    ${cat.length?`<section class="rg-section"><h3>НАВЫКИ ПО СИТУАЦИЯМ</h3>${cat.map(([k,v])=>`<div class="rg-skill-row"><span>${esc(k)}</span><strong>${v}%</strong></div>`).join('')}</section>`:''}
    ${weak.length?`<section class="rg-section"><div class="rg-section-head"><h3>СЛАБЫЕ СПОТЫ</h3><button data-view="spots">ВСЕ</button></div>${weak.map(x=>`<button class="rg-weak" data-open-spot="${esc(x.id)}"><span><b>${esc(x.meta.mode)}</b><small>${esc(contextLine(x.meta))}</small></span><strong>${Math.min(x.skills.boundary.skill,x.skills.decision?.skill??100)}%</strong></button>`).join('')}</section>`:''}
    <section class="rg-section"><h3>КАК ТРЕНИРОВАТЬ</h3><div class="rg-flow"><span>1</span><div><b>ИЗУЧИ</b><p>Посмотри размер диапазона, состав и границы.</p></div><span>2</span><div><b>СОБЕРИ</b><p>Восстанови форму по памяти.</p></div><span>3</span><div><b>ЗАКРЕПИ</b><p>Граница и решения теперь имеют отдельный прогресс.</p></div></div></section>
  </main>`;
}

function spotCategories(){return [
  ['','ВСЕ'],['vs1r','ПРОТИВ ОПЕНА'],['vs1rshort','ПРОТИВ КОРОТКОГО ОПЕНА'],['vs3bet','ПРОТИВ 3-БЕТА'],['vs4bet','ПРОТИВ 4-БЕТА'],
  ['vssqueeze','СКВИЗ'],['vs1r1c','РЕЙЗ + КОЛЛ'],['vs2r','ДВА РЕЙЗА'],['callpush','CALL / PUSH'],['sbvsbb','SB vs BB'],['vslimp','ПРОТИВ ЛИМПА'],['huante','HU']
];}
function rowsFiltered(){
  const q=state.query.trim().toLowerCase();return RANGE_LIBRARY.filter(r=>(!state.filterMode||r.source_mode===state.filterMode)&&(!state.filterPos||r.position===state.filterPos)&&(!state.filterStack||r.stack===state.filterStack)&&(!q||[r.source_mode,r.spot,r.position,r.stack,r.opponent,r.open,r.bet,labelMode(r.source_mode)].join(' ').toLowerCase().includes(q)));
}
function uniq(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));}
function spots(){
  const rows=rowsFiltered(),page=rows.slice(state.page*12,state.page*12+12);const pos=uniq(RANGE_LIBRARY.map(x=>x.position)),stacks=uniq(RANGE_LIBRARY.map(x=>x.stack));
  return `<main><section class="rg-section rg-uo-picker"><h2>ВЫБЕРИ СПОТ</h2><p>Сначала ситуация. Потом — изучение, сборка диапазона, границы или экзамен.</p><div class="rg-fields"><label>ПОЗИЦИЯ<select id="rgUoPos">${POSITIONS.map(x=>`<option ${x===state.position?'selected':''}>${x}</option>`).join('')}</select></label><label>СТЕК<select id="rgUoStack">${STACKS.map(x=>`<option ${x===state.stack?'selected':''}>${x}</option>`).join('')}</select></label></div><button class="rg-secondary" id="rgOpenUo">ОТКРЫТЬ ${esc(state.position)} · ${esc(fmtStack(state.stack))}</button></section>
    <section class="rg-section"><h3>ДРУГИЕ ПРЕФЛОП-СИТУАЦИИ</h3><div class="rg-chips">${spotCategories().map(([v,l])=>`<button data-mode="${v}" class="${state.filterMode===v?'on':''}">${l}</button>`).join('')}</div><input id="rgSearch" class="rg-search" value="${esc(state.query)}" placeholder="BTN 25BB, vs 3-bet, SB…"><div class="rg-filter"><select id="rgPos"><option value="">Любая позиция</option>${pos.map(x=>`<option ${x===state.filterPos?'selected':''}>${esc(x)}</option>`).join('')}</select><select id="rgStack"><option value="">Любой стек</option>${stacks.map(x=>`<option ${x===state.filterStack?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="rg-spot-list">${page.map(r=>{const rec=structuredById.get(r.chart_id);const strict=rec&&strictCandidates(rec,MODE_ACTION_CHOICES,RANKS).length>=4;return `<button data-open-spot="${esc(r.chart_id)}"><span><b>${esc(labelMode(r.source_mode))}</b><small>${esc([r.position,fmtStack(r.stack),r.opponent?`vs ${r.opponent}`:'',r.bet?`size ${r.bet}`:''].filter(Boolean).join(' · '))}</small></span><em>${strict?'РЕШЕНИЯ':'RANGE'}</em><i>→</i></button>`;}).join('')||'<p class="rg-muted">Ничего не найдено.</p>'}</div>
      <div class="rg-pages"><button id="rgPrev" ${state.page===0?'disabled':''}>←</button><span>${rows.length} спотов</span><button id="rgNext" ${(state.page+1)*12>=rows.length?'disabled':''}>→</button></div>
    </section></main>`;
}

function spot(){
  const meta=spotMeta();if(!meta)return `<div class="rg-empty">Спот не найден.</div>`;
  const skills=skillFor(meta),decision=confirmedDecisionRows(meta),boundary=boundaryRows(meta),canDecision=decision.length>=4&&new Set(decision.map(([,v])=>v.action)).size>=2,active=activeSet(meta),combos=comboCount(active),rangePct=(100*combos/1326).toFixed(1);
  return `<main><section class="rg-spot-hero"><div class="rg-eyebrow">${esc(meta.mode)}</div><h2>${esc(meta.title||contextLine(meta))}</h2><p>${esc(contextLine(meta))}</p><div class="rg-range-facts"><span><b>${rangePct}%</b><small>РАЗМЕР RANGE</small></span><span><b>${combos}</b><small>COMBOS</small></span></div><div class="rg-split-mastery"><div><small>ГРАНИЦА</small><b>${skills.boundary.skill}%</b><em>${skills.boundary.seen}/${skills.boundary.total} рук</em></div>${skills.decision?`<div><small>РЕШЕНИЯ</small><b>${skills.decision.skill}%</b><em>${skills.decision.seen}/${skills.decision.total} рук</em></div>`:''}</div></section>
    <section class="rg-actions"><button class="rg-primary" data-spot-action="study"><b>ИЗУЧИТЬ РЕНДЖ</b><small>матрица · состав · мои слабые руки</small></button><button data-spot-action="build"><b>СОБРАТЬ ПО ПАМЯТИ</b><small>форма + combos ошибок</small></button>${boundary.length?`<button data-start="boundary"><b>ТРЕНИРОВАТЬ ГРАНИЦУ</b><small>${boundary.length} стратегически пограничных рук</small></button>`:''}${canDecision?`<button data-start="decision" data-mode-train="learn"><b>ТРЕНИРОВАТЬ РЕШЕНИЯ</b><small>подтверждённые действия</small></button><button data-start="decision" data-mode-train="exam"><b>ЭКЗАМЕН</b><small>разбор только в конце</small></button><button data-start="decision" data-mode-train="rapid"><b>БЫСТРО · 5 СЕК</b><small>скорость + точность</small></button>`:''}</section>
    ${!canDecision?`<div class="rg-note"><b>Здесь нет надёжной проверки action.</b><p>Можно изучать форму, собирать диапазон и тренировать границу. Fold/call/raise не придумываются, если source этого не подтверждает.</p></div>`:''}
    ${meta.type==='uo'?uoDiffCard(meta,active)+uoPositionDiffCard(meta,active):''}
  </main>`;
}
function uoDiffCard(meta,active){
  const idx=STACKS.indexOf(meta.stack);const next=idx>=0&&idx<STACKS.length-1?STACKS[idx+1]:idx>0?STACKS[idx-1]:null;if(!next)return'';const other=safeChart(UO_DATA,meta.position,next);if(!other)return'';const d=compareActiveSets(active,activeSetFromChart(other,RANKS));return `<section class="rg-section"><h3>КАК МЕНЯЕТСЯ РЕНДЖ</h3><button class="rg-diff-card" data-diff-stack="${esc(next)}"><span><b>${esc(fmtStack(meta.stack))} → ${esc(fmtStack(next))}</b><small>Добавилось ${d.added.length} · ушло ${d.removed.length}</small></span><i>→</i></button></section>`;
}


function uoPositionDiffCard(meta,active){
  const idx=POSITIONS.indexOf(meta.position),next=idx>=0&&idx<POSITIONS.length-1?POSITIONS[idx+1]:idx>0?POSITIONS[idx-1]:null;
  if(!next)return'';const other=safeChart(UO_DATA,next,meta.stack);if(!other)return'';
  const d=compareActiveSets(active,activeSetFromChart(other,RANKS));
  return `<section class="rg-section"><h3>КАК МЕНЯЕТСЯ ПО ПОЗИЦИИ</h3><button class="rg-diff-card" data-diff-position="${esc(next)}"><span><b>${esc(meta.position)} → ${esc(next)} · ${esc(fmtStack(meta.stack))}</b><small>Добавилось ${d.added.length} · ушло ${d.removed.length}</small></span><i>→</i></button></section>`;
}

function matrixCellClass(action,active){return `rg-cell ${active?'active':''} ${CONFIRMED_ACTIONS.has(action)?`a-${action.replace(/[^A-Z0-9]/g,'')}`:'source'}`;}
function study(){
  const meta=spotMeta(),sel=state.selectedHand;if(!meta)return'';let cells={},original='';
  if(meta.type==='uo'){const map=actionMap(currentUoChart());for(const h of HANDS)cells[h]={action:map[h]||'UNSELECTED',active:(map[h]||'UNSELECTED')!=='UNSELECTED',pure:true};}else cells=decodeStructured(meta.rec,RANKS);
  const d=sel?cells[sel]:null,confirmed=d&&d.pure&&CONFIRMED_ACTIONS.has(d.action),active=activeSet(meta),combos=comboCount(active),composition=rangeComposition(active).slice(0,6),bStats=masteryFor(meta,'boundary').stats,dStats=masteryFor(meta,'decision').stats;
  if(meta.type==='library'&&state.showOriginal)original=`<div class="rg-original"><img id="rgChart" data-path="${esc(meta.manifest.compressed_file)}" alt="Исходный чарт"><span id="rgLoading">ЗАГРУЖАЮ…</span></div>`;
  const heat=h=>{const st=dStats.get(h)||bStats.get(h);if(!st)return'unseen';const a=st.seen?st.correct/st.seen:0;return st.lastCorrect===false||a<.6?'weak':a>=.85&&st.seen>=2?'mastered':'shaky';};
  return `<main><section class="rg-section"><div class="rg-section-head"><div><div class="rg-eyebrow">${esc(meta.mode)}</div><h2>${esc(meta.title)}</h2></div>${meta.type==='library'?`<button id="rgOriginal">${state.showOriginal?'МАТРИЦА':'ОРИГИНАЛ'}</button>`:''}</div><p>${esc(contextLine(meta))}</p><div class="rg-range-facts"><span><b>${(100*combos/1326).toFixed(1)}%</b><small>RANGE</small></span><span><b>${combos}</b><small>COMBOS</small></span></div>${original||`<div class="rg-grid">${HANDS.map(h=>`<button class="${matrixCellClass(cells[h].action,cells[h].active)} ${sel===h?'selected':''} mastery-${heat(h)}" data-hand="${h}">${h}</button>`).join('')}</div><div class="rg-mastery-legend"><span>● не проверено</span><span>● шатко</span><span>● ошибка</span><span>● освоено</span></div>`}
    ${composition.length?`<div class="rg-composition"><b>СОСТАВ RANGE</b>${composition.map(x=>`<div><span>${esc(x.label)}</span><strong>${x.combos} combos</strong></div>`).join('')}</div>`:''}
    ${sel&&d?`<div class="rg-hand-card"><strong>${sel}</strong><div>${confirmed?`<b>${esc(ACTION_LABELS[d.action])}</b><p>Действие подтверждено и может проверяться в тренере решений.</p>`:`<b>${d.active?'ВХОДИТ В RANGE':'ВНЕ RANGE'}</b><p>${d.active?'Здесь изучается форма диапазона; неподтверждённый action не подменяется догадкой.':'Эта рука вне выделенной области source.'}</p>`}${(dStats.get(sel)||bStats.get(sel))?`<small>Попыток ${(dStats.get(sel)||bStats.get(sel)).seen} · ошибок ${(dStats.get(sel)||bStats.get(sel)).wrong}</small>`:''}</div></div>`:''}
    <div class="rg-legend"><span><i class="in"></i>в range</span><span><i></i>вне range</span></div></section><section class="rg-actions"><button data-spot-action="build"><b>СОБРАТЬ ПО ПАМЯТИ</b><small>проверить всю форму</small></button><button data-start="boundary"><b>ТРЕНИРОВАТЬ ГРАНИЦУ</b><small>стратегические пороги</small></button></section></main>`;
}

function build(){
  const meta=spotMeta(),truth=activeSet(meta),cmp=rangeShapeCompare(truth,state.buildSelected),leaks=shapeLeakSummary(cmp.missed,cmp.extra);
  return `<main><section class="rg-section"><div class="rg-eyebrow">СОБЕРИ РЕНДЖ ПО ПАМЯТИ</div><h2>${esc(meta?.title||'')}</h2><p>${esc(contextLine(meta))}</p><div class="rg-build-help">Отметь диапазон целиком. Ошибки считаются и по hand classes, и по реальным combos.</div><div class="rg-grid rg-build-grid">${HANDS.map(h=>{let cl='';if(state.buildCompared)cl=truth.has(h)?(state.buildSelected.has(h)?'hit':'miss'):(state.buildSelected.has(h)?'extra':'');return `<button class="rg-cell ${state.buildSelected.has(h)?'picked':''} ${cl}" data-build-hand="${h}">${h}</button>`;}).join('')}</div>${state.buildCompared?`<div class="rg-build-score"><div><strong>${cmp.score}%</strong><small>ТОЧНОСТЬ ФОРМЫ</small></div><div><strong>${cmp.missedCombos}</strong><small>COMBOS ПРОПУЩЕНО</small></div><div><strong>${cmp.extraCombos}</strong><small>COMBOS ЛИШНИХ</small></div></div>${leaks.length?`<div class="rg-leaks"><b>ГДЕ СМЕЩЕНА ГРАНИЦА</b>${leaks.map(x=>`<p>${esc(x.label)} · пропущено ${x.missed} · лишних ${x.extra}</p>`).join('')}</div>`:''}${cmp.missed.length?`<p class="rg-listline"><b>Пропустила:</b> ${cmp.missed.slice(0,30).join(', ')}${cmp.missed.length>30?'…':''}</p>`:''}${cmp.extra.length?`<p class="rg-listline"><b>Лишние:</b> ${cmp.extra.slice(0,30).join(', ')}${cmp.extra.length>30?'…':''}</p>`:''}`:''}<button class="rg-primary" id="rgCompare">${state.buildCompared?'СОБРАТЬ ЗАНОВО':'СРАВНИТЬ'}</button></section></main>`;
}

function diff(){
  const meta=spotMeta();if(!meta||meta.type!=='uo')return'';
  const byPos=!!state.diffPosition;
  const other=byPos?state.diffPosition:(state.diffStack||STACKS[Math.min(STACKS.length-1,STACKS.indexOf(meta.stack)+1)]);
  const aChart=safeChart(UO_DATA,meta.position,meta.stack);
  const bChart=byPos?safeChart(UO_DATA,other,meta.stack):safeChart(UO_DATA,meta.position,other);
  if(!aChart||!bChart)return'';
  const a=activeSetFromChart(aChart,RANKS),b=activeSetFromChart(bChart,RANKS),d=compareActiveSets(a,b);
  const changed=compareActionMaps(actionMap(aChart),actionMap(bChart),HANDS).filter(x=>a.has(x.h)&&b.has(x.h));
  const title=byPos?`${meta.position} → ${other} · ${fmtStack(meta.stack)}`:`${meta.position} · ${fmtStack(meta.stack)} → ${fmtStack(other)}`;
  return `<main><section class="rg-section"><div class="rg-eyebrow">${byPos?'СРАВНЕНИЕ ПОЗИЦИЙ':'СРАВНЕНИЕ СТЕКОВ'}</div><h2>${esc(title)}</h2><div class="rg-diff"><div><strong>+${d.added.length}</strong><small>ВОШЛИ В RANGE</small><p>${d.added.slice(0,40).join(', ')||'—'}</p></div><div><strong>−${d.removed.length}</strong><small>ВЫШЛИ ИЗ RANGE</small><p>${d.removed.slice(0,40).join(', ')||'—'}</p></div></div>${changed.length?`<div class="rg-action-changes"><b>ИЗМЕНИЛОСЬ ДЕЙСТВИЕ · ${changed.length}</b>${changed.slice(0,40).map(x=>`<p><strong>${x.h}</strong> ${esc(ACTION_LABELS[x.from]||x.from)} → ${esc(ACTION_LABELS[x.to]||x.to)}</p>`).join('')}</div>`:''}</section></main>`;
}

function startTraining(kind,mode='learn'){
  const meta=spotMeta(),hist=loadHistory();let candidates=kind==='decision'?confirmedDecisionRows(meta):boundaryRows(meta);if(!candidates.length)return;
  const choices=kind==='decision'?[...new Set(candidates.map(([,v])=>v.action))]:['IN','OUT'];if(kind==='decision'&&choices.length<2)return;
  const stats=handStats(hist,meta.id,{kind}),limit=mode==='learn'?10:mode==='exam'?30:20,selected=selectAdaptiveQuestions(candidates,stats,limit),questions=selected.map(([h,v])=>({h,truth:kind==='decision'?v.action:(v.active?'IN':'OUT'),kind,choices}));
  state.trainingMode=mode;state.quiz={spotId:meta.id,kind,mode,questions,index:0,answers:[],answered:false,last:null,startedAt:performance.now(),questionAt:performance.now(),isCorrection:false};state.results=null;state.prevView='spot';state.view='quiz';render();
}
function quiz(){
  const q=state.quiz?.questions[state.quiz.index],meta=spotMeta(q?.spotId||state.quiz?.spotId);if(!q||!meta)return'';const last=state.quiz.last,progress=Math.round((state.quiz.index/state.quiz.questions.length)*100),isBoundary=q.kind==='boundary';
  const choices=q.choices.map(a=>`<button data-answer="${a}" class="${last?.user===a?'chosen':''}">${esc(isBoundary?(a==='IN'?'ВХОДИТ В РЕНДЖ':'ВНЕ РЕНДЖА'):(ACTION_LABELS[a]||a))}</button>`).join('');
  const showFeedback=state.quiz.mode!=='exam'&&state.quiz.answered;
  return `<main class="rg-quiz"><div class="rg-quiz-top"><button data-quit>← ВЫЙТИ</button><span>${state.quiz.index+1}/${state.quiz.questions.length}</span><em>${state.quiz.isToday?'СЕГОДНЯ':state.quiz.mode==='rapid'?'5 СЕК':state.quiz.mode==='exam'?'ЭКЗАМЕН':'УЧИТЬ'}</em></div><div class="rg-progress"><i style="width:${progress}%"></i></div>${state.quiz.mode==='rapid'?'<div class="rg-rapid-clock"><i></i></div>':''}<div class="rg-context"><b>${esc(meta.mode)}</b><span>${esc(contextLine(meta))}</span></div><section class="rg-question"><small>${isBoundary?'ЭТА РУКА ВХОДИТ В ДИАПАЗОН?':'ЧТО ДЕЛАЕМ?'}</small><div class="rg-big-hand">${q.h}</div><div class="rg-choices">${choices}</div>${showFeedback?`<div class="rg-feedback ${last.correct?'ok':'bad'}"><b>${last.correct?'ВЕРНО':'ОШИБКА'} · ${esc(isBoundary?(q.truth==='IN'?'В РЕНДЖЕ':'ВНЕ РЕНДЖА'):(ACTION_LABELS[q.truth]||q.truth))}</b><button id="rgQuizNext">${state.quiz.index+1===state.quiz.questions.length?'РЕЗУЛЬТАТ':'СЛЕДУЮЩАЯ →'}</button></div>`:''}</section></main>`;
}
function answer(user){
  if(!state.quiz||state.quiz.answered)return;clearRapid();const q=state.quiz.questions[state.quiz.index],responseMs=Math.round(performance.now()-state.quiz.questionAt),correct=user===q.truth;const row={spotId:q.spotId||state.quiz.spotId,kind:q.kind,h:q.h,user,truth:q.truth,correct,responseMs};state.quiz.answers.push(row);state.quiz.answered=true;state.quiz.last=row;
  if(state.quiz.mode==='exam'){nextQuestion();return;}render();
}
function nextQuestion(){if(!state.quiz)return;if(state.quiz.index+1>=state.quiz.questions.length){finishQuiz();return;}state.quiz.index++;state.quiz.answered=false;state.quiz.last=null;state.quiz.questionAt=performance.now();render();}
function finishQuiz(){
  clearRapid();const q=state.quiz,ans=q.answers,correct=ans.filter(x=>x.correct).length,wrong=ans.filter(x=>!x.correct),avg=ans.length?Math.round(ans.reduce((n,x)=>n+x.responseMs,0)/ans.length):0,confident=wrong.filter(x=>x.responseMs<2500&&x.user!=='__TIMEOUT__');
  state.results={spotId:q.spotId,kind:q.kind,mode:q.mode,correct,total:ans.length,wrong,answers:ans,avgResponseMs:avg,confident,isToday:!!q.isToday};
  if(q.isToday){
    const groups=new Map();
    for(const a of ans){const k=`${a.spotId}|${a.kind}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a);}
    for(const rows of groups.values()){
      const meta=spotMeta(rows[0].spotId),c=rows.filter(x=>x.correct).length,w=rows.filter(x=>!x.correct);
      saveHistory({mode:'ranges',version:12,strict:true,spotId:rows[0].spotId,kind:rows[0].kind,trainingMode:'exam',isCorrection:false,isToday:true,position:meta?.position,stack:meta?.stack,sourceMode:meta?.mode,correct:c,total:rows.length,answers:rows,wrong:w,timestamp:nowIso()});
    }
  }else{
    const meta=spotMeta(q.spotId);
    saveHistory({mode:'ranges',version:12,strict:true,spotId:q.spotId,kind:q.kind,trainingMode:q.mode,isCorrection:!!q.isCorrection,position:meta?.position,stack:meta?.stack,sourceMode:meta?.mode,correct,total:ans.length,answers:ans,wrong,timestamp:nowIso()});
  }
  try{window.dispatchEvent(new CustomEvent('pokerswipe:ranges-training-result',{detail:state.results}));}catch{}
  state.view='results';render();
}
function results(){
  const r=state.results;if(!r)return'';
  const score=r.total?Math.round(100*r.correct/r.total):0,median=r.answers.length?[...r.answers].map(x=>x.responseMs).sort((a,b)=>a-b)[Math.floor(r.answers.length/2)]:0,timeouts=r.answers.filter(x=>x.user==='__TIMEOUT__').length;
  let summary='';
  if(r.isToday){
    const spots=new Set(r.answers.map(x=>x.spotId)).size,decision=r.answers.filter(x=>x.kind==='decision').length,boundary=r.answers.filter(x=>x.kind==='boundary').length;
    summary=`Сегодня: ${spots} спотов · ${decision} решений · ${boundary} рук на границе.`;
  }else{
    const meta=spotMeta(r.spotId),m=masteryFor(meta,r.kind);summary=`${r.kind==='decision'?'Решения':'Граница'}: навык ${m.skill}% · coverage ${m.coverage}% · ${m.due} рук к повторению.`;
  }
  return `<main><section class="rg-result"><div class="rg-eyebrow">${r.isToday?'СЕГОДНЯ · ИТОГ':'РЕЗУЛЬТАТ СЕССИИ'}</div><strong>${r.correct}/${r.total}</strong><h2>ТОЧНОСТЬ СЕССИИ · ${score}%</h2><p>${esc(summary)}</p><div class="rg-result-grid"><div><b>${(median/1000).toFixed(1)}с</b><small>МЕДИАНА</small></div><div><b>${r.confident.length}</b><small>БЫСТРЫХ ОШИБОК</small></div><div><b>${timeouts}</b><small>НЕ УСПЕЛА</small></div></div>${r.wrong.length?`<div class="rg-wrong"><b>ОШИБКИ</b>${r.wrong.map(x=>`<div><strong>${x.h}</strong><span>${x.user==='__TIMEOUT__'?'не успела':x.kind==='boundary'?(x.user==='IN'?'в range':'вне range'):(ACTION_LABELS[x.user]||x.user)} → ${x.kind==='boundary'?(x.truth==='IN'?'в range':'вне range'):(ACTION_LABELS[x.truth]||x.truth)}</span></div>`).join('')}</div>`:`<div class="rg-perfect">В этой сессии ошибок нет 🎯</div>`}${r.isToday?'<button class="rg-primary" data-view="home">ГОТОВО</button>':`<button class="rg-primary" id="rgRetry" ${r.wrong.length?'':'disabled'}>РАЗОБРАТЬ ОШИБКИ</button><p class="rg-muted">Мгновенный повтор считается коррекцией и не повышает основной mastery как полноценный экзамен.</p><button class="rg-secondary" data-open-spot="${esc(r.spotId)}">ВЕРНУТЬСЯ К СПОТУ</button>`}</section></main>`;
}
function retryWrong(){const r=state.results;if(!r?.wrong?.length)return;const meta=spotMeta(r.spotId);const choices=r.kind==='boundary'?['IN','OUT']:[...new Set(confirmedDecisionRows(meta).map(([,v])=>v.action))];if(choices.length<2&&r.kind==='decision')return;state.quiz={spotId:r.spotId,kind:r.kind,mode:'learn',questions:r.wrong.map(x=>({h:x.h,truth:x.truth,kind:r.kind,choices})),index:0,answers:[],answered:false,last:null,startedAt:performance.now(),questionAt:performance.now(),isCorrection:true};state.view='quiz';render();}

async function hydrateOriginal(){const img=document.getElementById('rgChart');if(!img)return;try{const src=await loadChartAsset(img.dataset.path);if(!src)throw 0;img.src=src;document.getElementById('rgLoading')?.remove();}catch{const x=document.getElementById('rgLoading');if(x)x.textContent='НЕ УДАЛОСЬ ЗАГРУЗИТЬ';}}
function clearRapid(){if(rapidTimer){clearTimeout(rapidTimer);rapidTimer=null;}}
function armRapid(){clearRapid();if(state.view!=='quiz'||state.quiz?.mode!=='rapid'||state.quiz?.answered)return;const elapsed=performance.now()-state.quiz.questionAt,remaining=Math.max(20,5000-elapsed);rapidTimer=setTimeout(()=>{if(state.view==='quiz'&&state.quiz&&!state.quiz.answered)answer('__TIMEOUT__');},remaining);}

function render(){
  clearRapid();const host=document.getElementById('rangesArea');if(!host)return;let body='';
  if(state.view==='home')body=home();else if(state.view==='spots')body=spots();else if(state.view==='spot')body=spot();else if(state.view==='study')body=study();else if(state.view==='build')body=build();else if(state.view==='quiz')body=quiz();else if(state.view==='results')body=results();else if(state.view==='diff')body=diff();else body=home();
  host.innerHTML=`<div class="rg-app">${header()}${nav()}${body}</div>`;bind();hydrateOriginal();savePrefs();armRapid();
}
function go(v){state.prevView=state.view;state.view=v;state.selectedHand=null;if(v!=='build'){state.buildCompared=false;}render();}
function back(){if(state.view==='spot')go('spots');else if(['study','build','diff'].includes(state.view))go('spot');else if(['quiz','results'].includes(state.view)){state.spotId=state.quiz?.spotId||state.results?.spotId||state.spotId;go('spot');}else go('home');}

function bind(){
  document.querySelectorAll('#ranges [data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
  document.getElementById('rgStartToday')?.addEventListener('click',startToday);
  document.querySelector('#ranges [data-app-home]')?.addEventListener('click',appHome);
  document.querySelector('#ranges [data-back]')?.addEventListener('click',back);
  document.querySelectorAll('#ranges [data-open-spot]').forEach(b=>b.onclick=()=>{if(b.dataset.openSpot){setSpot(b.dataset.openSpot);go('spot');}else go('spots');});
  document.getElementById('rgUoPos')?.addEventListener('change',e=>{state.position=e.target.value;});
  document.getElementById('rgUoStack')?.addEventListener('change',e=>{state.stack=e.target.value;});
  document.getElementById('rgOpenUo')?.addEventListener('click',()=>{setSpot(uoId(state.position,state.stack));go('spot');});
  document.querySelectorAll('#ranges [data-mode]').forEach(b=>b.onclick=()=>{state.filterMode=b.dataset.mode;state.page=0;render();});
  const q=document.getElementById('rgSearch');if(q)q.onchange=()=>{state.query=q.value;state.page=0;render();};
  document.getElementById('rgPos')?.addEventListener('change',e=>{state.filterPos=e.target.value;state.page=0;render();});
  document.getElementById('rgStack')?.addEventListener('change',e=>{state.filterStack=e.target.value;state.page=0;render();});
  document.getElementById('rgPrev')?.addEventListener('click',()=>{state.page=Math.max(0,state.page-1);render();});
  document.getElementById('rgNext')?.addEventListener('click',()=>{state.page++;render();});
  document.querySelectorAll('#ranges [data-spot-action]').forEach(b=>b.onclick=()=>{if(b.dataset.spotAction==='build'){state.buildSelected=new Set();state.buildCompared=false;}go(b.dataset.spotAction);});
  document.querySelectorAll('#ranges [data-start]').forEach(b=>b.onclick=()=>startTraining(b.dataset.start,b.dataset.modeTrain||'learn'));
  document.querySelectorAll('#ranges [data-hand]').forEach(b=>b.onclick=()=>{state.selectedHand=b.dataset.hand;render();});
  document.getElementById('rgOriginal')?.addEventListener('click',()=>{state.showOriginal=!state.showOriginal;state.selectedHand=null;render();});
  document.querySelectorAll('#ranges [data-build-hand]').forEach(b=>b.onclick=()=>{if(state.buildCompared)return;const h=b.dataset.buildHand;state.buildSelected.has(h)?state.buildSelected.delete(h):state.buildSelected.add(h);render();});
  document.getElementById('rgCompare')?.addEventListener('click',()=>{if(state.buildCompared){state.buildSelected=new Set();state.buildCompared=false;}else state.buildCompared=true;render();});
  document.querySelectorAll('#ranges [data-answer]').forEach(b=>b.onclick=()=>answer(b.dataset.answer));
  document.getElementById('rgQuizNext')?.addEventListener('click',nextQuestion);
  document.querySelector('#ranges [data-quit]')?.addEventListener('click',()=>{state.spotId=state.quiz?.spotId||state.spotId;go('spot');});
  document.getElementById('rgRetry')?.addEventListener('click',retryWrong);
  document.querySelectorAll('#ranges [data-diff-stack]').forEach(b=>b.onclick=()=>{state.diffPosition=null;state.diffStack=b.dataset.diffStack;go('diff');});
  document.querySelectorAll('#ranges [data-diff-position]').forEach(b=>b.onclick=()=>{state.diffStack=null;state.diffPosition=b.dataset.diffPosition;go('diff');});
}

function mount(){ensureCss();ensureScreen();render();return true;}
function unmount(){clearRapid();const h=document.getElementById('rangesArea');if(h)h.innerHTML='';}
loadPrefs();
const integrity=validateUO(UO_DATA);if(!integrity.ok)console.error('[Ranges v12] UO data errors',integrity.errors);
if(STRUCTURED_LIBRARY.length!==1578)console.error('[Ranges v12] structured library count',STRUCTURED_LIBRARY.length);
mount();
window.renderRanges=render;
window.PokerSwipeRanges={version:12,mount,unmount,render,state,validate:()=>({uo:validateUO(UO_DATA),library:RANGE_LIBRARY.length,structured:STRUCTURED_LIBRARY.length,strictCharts:STRUCTURED_LIBRARY.filter(r=>strictCandidates(r,MODE_ACTION_CHOICES,RANKS).length>=4).length})};
