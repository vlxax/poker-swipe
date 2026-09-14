import { UO_DATA, RANGE_LIBRARY } from './ranges-data.js';
import { actionMap, safeChart, canonicalHands, conceptLeaks, sourceModeLabel, validateUO } from './core.js';
import { loadChartAsset } from './chart-assets.js';
import { STRUCTURED_LIBRARY, MODE_ACTION_CHOICES } from './structured-library.js';

const POSITIONS = UO_DATA.positions || [];
const STACKS = UO_DATA.stack_bands || [];
const RANKS = UO_DATA.rank_order || ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const PREF_KEY = 'pokerswipe.ranges.v9';
const HISTORY_KEY = 'pokerswipe.ranges.history';
const structuredById = new Map(STRUCTURED_LIBRARY.map(x => [x.id, x]));
const manifestById = new Map(RANGE_LIBRARY.map(x => [x.chart_id, x]));

const ACTION_LABEL = {
  AI:'ОЛЛ-ИН', RAISE:'РЕЙЗ', nAI:'nAI', LOW_PLAYABILITY:'НИЗКАЯ ИГРАЕМОСТЬ',
  UNSELECTED:'НЕ ВЫБРАНО', CALL:'КОЛЛ', CHECK:'ЧЕК', '4BET':'4-БЕТ', '5BET':'5-БЕТ',
  ISOLATE:'ИЗОЛЕЙТ', OVERLIMP:'ОВЕРЛИМП', SOURCE_MIX:'СМЕШАННАЯ ЗОНА', SOURCE_OTHER:'ДРУГАЯ ЗОНА',
  MARGIN_5:'5% ЗАПАС И ВЫШЕ', MARGIN_10:'10% ЗАПАС И ВЫШЕ', MARGIN_15:'15% ЗАПАС И ВЫШЕ', MARGIN_20:'20% ЗАПАС И ВЫШЕ'
};
const ACTION_HELP = {
  AI:'В исходном чарте эта рука отмечена как олл-ин.',
  RAISE:'В исходном чарте эта рука отмечена как рейз.',
  CALL:'В исходном чарте эта рука отмечена как колл.',
  CHECK:'В исходном чарте эта рука отмечена как чек.',
  '4BET':'В исходном чарте эта рука отмечена как 4-бет.',
  '5BET':'В исходном чарте эта рука отмечена как 5-бет.',
  ISOLATE:'В исходном чарте эта рука отмечена как изолейт.',
  OVERLIMP:'В исходном чарте эта рука отмечена как оверлимп.',
  nAI:'В источнике стоит nAI. Точная расшифровка не подтверждена, поэтому это не используется как покерное действие в строгом тесте.',
  LOW_PLAYABILITY:'Это пометка источника, а не самостоятельное покерное действие.',
  UNSELECTED:'Клетка не выделена. Мы не переименовываем её во «фолд» без подтверждения источника.'
};

const state = {
  view:'home', position:'BTN', stack:'18-25', selected:null,
  quiz:null, results:null,
  libQuery:'', libPage:0, libPreview:null, libMode:'', libPosition:'', libStack:'',
  libMatrix:false, libHand:null, trainingMode:'learn', buildId:null, buildSelected:new Set(), buildCompared:false
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function shuffled(a){ const x=[...a]; for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];} return x; }
function history(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return []}}
function mastery(){
  const rows=history(), byChart=new Map();
  for(const r of rows){ const id=r.chartId||`UO:${r.position}:${r.stack}`; if(!byChart.has(id))byChart.set(id,{attempts:0,correct:0,total:0,wrong:new Map(),last:r.timestamp}); const m=byChart.get(id); m.attempts++;m.correct+=r.correct||0;m.total+=r.total||0; if(r.timestamp>m.last)m.last=r.timestamp; for(const w of r.wrong||[])m.wrong.set(w.h,(m.wrong.get(w.h)||0)+1); }
  return byChart;
}
function masteryPct(m){return !m||!m.total?0:Math.round(100*m.correct/m.total)}
function spotContext(r){return [sourceModeLabel(r?.source_mode||r?.mode),r?.position||r?.pos,r?.stack,r?.opponent,r?.open,r?.bet].filter(Boolean).join(' · ')}


function ensureCss(){
  if(document.querySelector('link[data-ranges-ui]')) return;
  const l=document.createElement('link'); l.rel='stylesheet'; l.href='ranges-ui/ranges-ui.css'; l.dataset.rangesUi='1'; document.head.appendChild(l);
}
function ensureScreen(){
  let s=document.getElementById('ranges');
  if(!s){
    s=document.createElement('section'); s.id='ranges'; s.className='screen psScreen'; s.innerHTML='<div id="rangesArea"></div>';
    const x=document.getElementById('xray'); (x?.parentNode||document.getElementById('mainApp')||document.body).insertBefore(s,x||null);
  } else {
    s.classList.add('psScreen');
    if(!s.querySelector('#rangesArea')) s.innerHTML='<div id="rangesArea"></div>';
  }
  return s;
}
function chart(){ return safeChart(UO_DATA,state.position,state.stack); }
function savePrefs(){ try{localStorage.setItem(PREF_KEY,JSON.stringify({position:state.position,stack:state.stack}));}catch{} }
function loadPrefs(){
  try{const p=JSON.parse(localStorage.getItem(PREF_KEY)||'null'); if(p&&POSITIONS.includes(p.position))state.position=p.position; if(p&&STACKS.includes(p.stack))state.stack=p.stack;}catch{}
}
function options(values,current,blank,labelFn=x=>x){
  return `${blank?`<option value="">${esc(blank)}</option>`:''}${values.map(x=>`<option value="${esc(x)}" ${x===current?'selected':''}>${esc(labelFn(x))}</option>`).join('')}`;
}
function handAt(r,c){ const a=RANKS[r],b=RANKS[c]; if(r===c)return a+a; return r<c?a+b+'s':b+a+'o'; }
function header(){ return `<div class="rv6-head"><div><div class="rv6-brand">POKER SWIPE</div><h1>МОИ РЕНДЖИ</h1></div><button class="rv6-home" data-view="home">ГЛАВНАЯ</button></div>`; }
function nav(){ return `<div class="rv6-nav rv9-nav"><button data-view="home" class="${state.view==='home'?'on':''}">СЕГОДНЯ</button><button data-view="setup" class="${['setup','quiz','results'].includes(state.view)?'on':''}">ТРЕНЕР</button><button data-view="build" class="${state.view==='build'?'on':''}">СОБРАТЬ</button><button data-view="library" class="${state.view==='library'?'on':''}">СПОТЫ</button></div>`; }
function spotBar(editable=true){ return `<div class="rv6-spot"><div><small>ТЕКУЩИЙ СПОТ</small><strong>${esc(state.position)} · ${esc(state.stack)} BB</strong><span>Структурированный UO</span></div>${editable?`<button data-view="setup">ИЗМЕНИТЬ</button>`:''}</div>`; }

function home(){
  const ms=mastery(), trained=[...ms.values()], total=trained.reduce((a,m)=>a+m.total,0), correct=trained.reduce((a,m)=>a+m.correct,0), readiness=total?Math.round(100*correct/total):0;
  const weak=[...ms.entries()].filter(([,m])=>m.wrong.size).sort((a,b)=>masteryPct(a[1])-masteryPct(b[1])).slice(0,3);
  return `<div class="rv6-home-screen">
    <div class="rv9-readiness"><small>ГОТОВНОСТЬ ПО ПРОЙДЕННОМУ</small><strong>${readiness}%</strong><p>${total?`${total} решений уже проверено. Следующая сессия должна начинаться с прошлых ошибок.`:'Начни первую сессию — PokerSwipe будет собирать твои слабые руки и возвращать их в повторение.'}</p></div>
    ${weak.length?`<div class="rv9-today"><b>СЕГОДНЯ В ПРИОРИТЕТЕ</b>${weak.map(([id,m])=>`<div><span>${esc(id)}</span><em>${masteryPct(m)}% · ошибок ${[...m.wrong.values()].reduce((a,b)=>a+b,0)}</em></div>`).join('')}</div>`:''}
    <button class="rv6-primary-card" data-view="setup"><span>1</span><div><b>ТРЕНИРОВАТЬ РЕШЕНИЯ</b><p>Учить · экзамен · быстрый режим. История ошибок влияет на вопросы.</p></div><i>→</i></button>
    <button class="rv6-card" data-view="build" data-build-uo="1"><span>2</span><div><b>СОБРАТЬ РЕНДЖ</b><p>Отметь 169 рук по памяти и сравни с источником: пропуски и лишние руки.</p></div><i>→</i></button>
    <button class="rv6-card" data-view="library"><span>3</span><div><b>ВЫБРАТЬ ПОКЕРНЫЙ СПОТ</b><p>1578 source-чартов · 284 с подтверждёнными действиями.</p></div><i>→</i></button>
  </div>`;
}
function matrix(c){
  const truth=actionMap(c); let out='<div class="rv6-grid">';
  for(let r=0;r<13;r++) for(let col=0;col<13;col++){
    const h=handAt(r,col),a=truth[h]||'UNSELECTED';
    out+=`<button class="rv6-cell" data-hand="${h}" data-action="${a}" aria-label="${h}: ${esc(ACTION_LABEL[a]||a)}">${h}</button>`;
  }
  return out+'</div>';
}
function study(c){
  const truth=actionMap(c),a=state.selected?(truth[state.selected]||'UNSELECTED'):null;
  return `${spotBar()}<div class="rv6-panel"><div class="rv6-title"><div><h2>ГОТОВЫЙ ДИАПАЗОН</h2><p>Нажми на руку — увидишь точную отметку исходного структурированного чарта.</p></div></div>${matrix(c)}${state.selected?`<div class="rv6-hand-detail"><strong>${state.selected}</strong><b>${esc(ACTION_LABEL[a]||a)}</b><p>${esc(ACTION_HELP[a]||'')}</p></div>`:`<div class="rv6-hint">Выбери руку в таблице 👆</div>`}<button class="rv6-big" data-view="setup">ПРОВЕРИТЬ СЕБЯ →</button></div>`;
}

function setup(){
  return `<div class="rv6-panel rv6-setup"><h2>ТРЕНЕР РЕШЕНИЙ</h2><p>UO полностью структурирован. Для vs open / 3-bet / squeeze и других узлов выбери конкретный спот в «СПОТЫ».</p>
  <div class="rv9-mode"><button data-train-mode="learn" class="${state.trainingMode==='learn'?'on':''}">УЧИТЬ<small>ответ сразу</small></button><button data-train-mode="exam" class="${state.trainingMode==='exam'?'on':''}">ЭКЗАМЕН<small>разбор в конце</small></button><button data-train-mode="rapid" class="${state.trainingMode==='rapid'?'on':''}">БЫСТРО<small>считаем время</small></button></div>
  <div class="rv6-fields"><label>ПОЗИЦИЯ<select id="rv6Pos">${options(POSITIONS,state.position)}</select></label><label>СТЕК<select id="rv6Stack">${options(STACKS,state.stack)}</select></label></div><button class="rv6-big" id="rv6Start">НАЧАТЬ · 10 РЕШЕНИЙ</button><button class="rv6-link" data-view="library">Выбрать другой покерный спот</button></div>`;
}
function buildQuestions(c){
  const truth=actionMap(c),hands=canonicalHands(RANKS),interesting=hands.filter(h=>(truth[h]||'UNSELECTED')!=='UNSELECTED'),inactive=hands.filter(h=>(truth[h]||'UNSELECTED')==='UNSELECTED');
  const id=`UO:${state.position}:${state.stack}`, m=mastery().get(id), wrong=m?[...m.wrong.keys()].filter(h=>hands.includes(h)):[];
  const priority=shuffled(wrong), rest=shuffled([...interesting,...inactive].filter(h=>!wrong.includes(h)));
  return [...priority,...rest].slice(0,10).map(h=>({h,truth:truth[h]||'UNSELECTED',kind:'uo'}));
}
function startQuiz(){ state.quiz={questions:buildQuestions(chart()),index:0,answers:[],answered:false,last:null,kind:'uo',mode:state.trainingMode,startedAt:performance.now(),questionAt:performance.now()}; state.results=null; state.view='quiz'; render(); }

function decodeStructured(rec){
  const raw=atob(rec.cells),hands=canonicalHands(RANKS),out={};
  for(let i=0;i<169;i++){
    const b0=raw.charCodeAt(i*3),b1=raw.charCodeAt(i*3+1),b2=raw.charCodeAt(i*3+2);
    const v=(b0<<16)|(b1<<8)|b2;
    const q=[(v>>16)&15,(v>>12)&15,(v>>8)&15,(v>>4)&15],coverage=(v&15)/15;
    if(!q.some(Boolean)){out[hands[i]]={action:'UNSELECTED',slot:-1,weights:{},coverage,pure:false};continue;}
    const bestSlot=q.indexOf(Math.max(...q)),top=q[bestSlot]/15,weights={};
    q.forEach((n,j)=>{if(n)weights[rec.labels[j]]=n/15;});
    out[hands[i]]={action:rec.labels[bestSlot],slot:bestSlot,weights,coverage,pure:coverage>=11/15&&top>=13/15,top};
  }
  return out;
}
function strictCandidates(rec){
  const cells=decodeStructured(rec),allowed=new Set(MODE_ACTION_CHOICES[rec.mode]||[]);
  return Object.entries(cells).filter(([,v])=>v.pure&&allowed.has(v.action));
}
function sourceCandidates(rec){
  const cells=decodeStructured(rec);
  return Object.entries(cells).map(([h,v])=>[h,{...v,sourceTruth:v.action||'UNSELECTED'}]);
}
function balancedSourceQuestions(rec,limit=10){
  const rows=sourceCandidates(rec),buckets=new Map();
  for(const row of rows){const a=row[1].sourceTruth||'UNSELECTED'; if(!buckets.has(a))buckets.set(a,[]); buckets.get(a).push(row);}
  const labels=[...rec.labels.filter(Boolean),'UNSELECTED'].filter((x,i,a)=>a.indexOf(x)===i && buckets.has(x));
  const picked=[]; let round=0;
  while(picked.length<limit && labels.length){
    let added=false;
    for(const a of labels){
      const b=buckets.get(a); if(!b?.length)continue;
      if(round===0)b.sort(()=>Math.random()-.5);
      const row=b.pop(); if(row){picked.push(row);added=true;if(picked.length>=limit)break;}
    }
    if(!added)break; round++;
  }
  if(picked.length<limit){
    const used=new Set(picked.map(([h])=>h));
    for(const row of shuffled(rows)){if(!used.has(row[0])){picked.push(row);used.add(row[0]);if(picked.length>=limit)break;}}
  }
  const choices=labels;
  return shuffled(picked).map(([h,v])=>({h,truth:v.sourceTruth,kind:'source',libraryId:rec.id,choices,pure:v.pure,weights:v.weights}));
}
function startSourceQuiz(id){
  const rec=structuredById.get(id); if(!rec)return;
  const qs=balancedSourceQuestions(rec,10); if(!qs.length)return;
  state.quiz={questions:qs,index:0,answers:[],answered:false,last:null,kind:'source',libraryId:id,mode:'learn',startedAt:performance.now(),questionAt:performance.now()};
  state.results=null; state.libPreview=null; state.libMatrix=false; state.libHand=null; state.view='quiz'; render();
}
function startLibraryQuiz(id){
  const rec=structuredById.get(id); if(!rec||!rec.trainable)return;
  const candidates=strictCandidates(rec),present=new Set(candidates.map(([,v])=>v.action));
  const choices=(MODE_ACTION_CHOICES[rec.mode]||[]).filter(a=>present.has(a));
  if(candidates.length<4||choices.length<2)return;
  const qs=shuffled(candidates).slice(0,Math.min(10,candidates.length)).map(([h,v])=>({h,truth:v.action,kind:'library',libraryId:id,choices,pure:true}));
  state.quiz={questions:qs,index:0,answers:[],answered:false,last:null,kind:'library',libraryId:id,mode:'learn',startedAt:performance.now(),questionAt:performance.now()};
  state.results=null; state.libPreview=null; state.libMatrix=false; state.libHand=null; state.view='quiz'; render();
}
function choiceActions(q){
  const choices=['library','source'].includes(q.kind) ? q.choices : [...new Set(['AI','RAISE','UNSELECTED',...(q.truth==='nAI'?['nAI']:[]),...(q.truth==='LOW_PLAYABILITY'?['LOW_PLAYABILITY']:[])])];
  return choices.map(a=>`<button data-answer="${a}">${esc(ACTION_LABEL[a]||a)}</button>`).join('');
}
function quiz(){
  const q=state.quiz?.questions[state.quiz.index]; if(!q)return '';
  const last=state.quiz.last,rec=['library','source'].includes(q.kind)?structuredById.get(q.libraryId):null;
  const context=rec?[sourceModeLabel(rec.mode),rec.pos,rec.stack,rec.opp,rec.bet].filter(Boolean).join(' · '):`${state.position} · ${state.stack} BB`;
  const prompt=q.kind==='library'?'ЧТО ДЕЛАЕМ?':q.kind==='source'?'КАК РУКА ОТМЕЧЕНА В ИСХОДНОМ ЧАРТЕ?':'КАК ЭТА РУКА ОТМЕЧЕНА В ЧАРТЕ?';
  return `<div class="rv6-quiz"><div class="rv6-quiz-top"><span>${state.quiz.index+1} / ${state.quiz.questions.length}</span><strong>${esc(context)}</strong></div><div class="rv6-question"><small>${prompt}</small><div class="rv6-big-hand">${q.h}</div><div class="rv6-choices">${choiceActions(q)}</div>${state.quiz.answered?`<div class="rv6-feedback ${last.correct?'ok':'bad'}"><b>${last.correct?'ВЕРНО':'НЕВЕРНО'} · ${esc(ACTION_LABEL[q.truth]||q.truth)}</b><p>${esc(q.kind==='source'?(q.pure?'Однозначная source-метка этого чарта.':'Тренировка воспроизводит метку/доминирующий цвет источника без переименования в покерное действие.'):(ACTION_HELP[q.truth]||'Действие подтверждено легендой исходного чарта.'))}</p><button id="rv6Next">${state.quiz.index+1===state.quiz.questions.length?'ПОКАЗАТЬ РЕЗУЛЬТАТ':'СЛЕДУЮЩАЯ →'}</button></div>`:''}</div><button class="rv6-quit" data-view="${q.kind==='library'?'library':'setup'}">Закончить тренировку</button></div>`;
}
function answer(a){ if(state.quiz.answered)return; const q=state.quiz.questions[state.quiz.index],correct=a===q.truth,row={h:q.h,user:a,truth:q.truth,correct,kind:q.kind,libraryId:q.libraryId,choices:q.choices,pure:q.pure,weights:q.weights,responseMs:Math.round(performance.now()-(state.quiz.questionAt||performance.now()))}; state.quiz.answers.push(row); state.quiz.answered=true; state.quiz.last=row; if(state.quiz.mode==='exam'){ if(state.quiz.index+1>=state.quiz.questions.length){finishQuiz();return;} state.quiz.index++;state.quiz.answered=false;state.quiz.last=null;state.quiz.questionAt=performance.now();render();return;} render(); }
function nextQuestion(){ if(state.quiz.index+1>=state.quiz.questions.length){finishQuiz();return;} state.quiz.index++; state.quiz.answered=false; state.quiz.last=null; state.quiz.questionAt=performance.now(); render(); }
function finishQuiz(){
  const ans=state.quiz.answers,correct=ans.filter(x=>x.correct).length,wrong=ans.filter(x=>!x.correct),isExternal=['library','source'].includes(state.quiz.kind);
  const leaks=isExternal?[]:conceptLeaks(chart(),{mode:'actions',userActions:new Map(ans.map(x=>[x.h,x.user]))}).filter(x=>x.wrongC>0).slice(0,3);
  state.results={correct,total:ans.length,wrong,leaks,kind:state.quiz.kind,libraryId:state.quiz.libraryId,avgResponseMs:ans.length?Math.round(ans.reduce((a,x)=>a+(x.responseMs||0),0)/ans.length):0}; saveResult(); state.view='results'; render();
}
function saveResult(){
  if(!state.results)return; const lib=state.results.libraryId?structuredById.get(state.results.libraryId):null;
  const payload={mode:'ranges',version:9,kind:state.results.kind,position:lib?.pos||state.position,stack:lib?.stack||state.stack,sourceMode:lib?.mode||'UO',chartId:lib?.id||null,correct:state.results.correct,total:state.results.total,wrong:state.results.wrong,leaks:state.results.leaks,avgResponseMs:state.results.avgResponseMs||null,timestamp:new Date().toISOString()};
  try{const arr=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');arr.unshift(payload);localStorage.setItem(HISTORY_KEY,JSON.stringify(arr.slice(0,200)));}catch{}
  try{window.dispatchEvent(new CustomEvent('pokerswipe:ranges-training-result',{detail:payload}));}catch{}
}
function results(){
  const r=state.results,score=Math.round(r.correct/r.total*100),lib=r.libraryId?structuredById.get(r.libraryId):null;
  return `<div class="rv6-results"><small>РЕЗУЛЬТАТ</small><strong>${r.correct} / ${r.total}</strong><h2>${score>=90?'ОТЛИЧНО':score>=70?'ХОРОШО':'ЕСТЬ ЧТО ДОРАБОТАТЬ'}</h2><p class="rv9-speed">Среднее решение: ${r.avgResponseMs?`${(r.avgResponseMs/1000).toFixed(1)} сек`:'—'} · это точность сессии, не знание всего ренджа.</p>${r.wrong.length?`<div class="rv6-wrong"><b>ОШИБКИ</b>${r.wrong.map(x=>`<div><span>${x.h}</span><small>ты: ${esc(ACTION_LABEL[x.user]||x.user)} · чарт: ${esc(ACTION_LABEL[x.truth]||x.truth)}</small></div>`).join('')}</div>`:`<div class="rv6-perfect">Все ответы верные 🎯</div>`}${r.leaks?.length?`<div class="rv6-leaks"><b>ЧАЩЕ ВСЕГО ОШИБКА В</b><p>${r.leaks.map(x=>esc(x.label)).join(' · ')}</p></div>`:''}<button class="rv6-big" id="rv6RetryWrong" ${r.wrong.length?'':'disabled'}>ПОВТОРИТЬ ОШИБКИ</button>${lib?`<button class="rv6-link" id="rv7BackSource">Вернуться к этому ренджу</button>`:`<button class="rv6-link" data-view="study">Посмотреть диапазон</button>`}<button class="rv6-link" data-view="home">Готово</button></div>`;
}
function retryWrong(){
  const wrong=state.results.wrong;if(!wrong.length)return;
  state.quiz={questions:wrong.map(x=>({h:x.h,truth:x.truth,kind:x.kind,libraryId:x.libraryId,choices:x.choices,pure:x.pure,weights:x.weights})),index:0,answers:[],answered:false,last:null,kind:state.results.kind,libraryId:state.results.libraryId}; state.view='quiz'; render();
}

function buildTarget(){
  if(state.buildId){const rec=structuredById.get(state.buildId); if(rec)return {id:rec.id,rec,cells:decodeStructured(rec),label:spotContext(manifestById.get(rec.id)||rec)};}
  const c=chart(), truth=actionMap(c), cells={}; for(const h of canonicalHands(RANKS))cells[h]={action:truth[h]||'UNSELECTED'};
  return {id:`UO:${state.position}:${state.stack}`,rec:null,cells,label:`UO · ${state.position} · ${state.stack} BB`};
}
function buildRange(){
  const t=buildTarget(), truth=new Set(Object.entries(t.cells).filter(([,v])=>v.action!=='UNSELECTED').map(([h])=>h)), user=state.buildSelected;
  const missed=[...truth].filter(h=>!user.has(h)), extra=[...user].filter(h=>!truth.has(h)), hit=[...user].filter(h=>truth.has(h));
  const precision=user.size?Math.round(100*hit.length/user.size):100, recall=truth.size?Math.round(100*hit.length/truth.size):100;
  return `<div class="rv6-panel"><h2>СОБЕРИ РЕНДЖ</h2><p>${esc(t.label)}</p><div class="rv9-build-help">Отметь все руки, которые считаешь выделенными в исходном диапазоне. Это тренирует <b>spot → range</b>, а не одну руку за раз.</div>
  <div class="rv6-grid rv9-build-grid">${canonicalHands(RANKS).map(h=>`<button class="rv6-cell ${user.has(h)?'picked':''} ${state.buildCompared?(truth.has(h)?(user.has(h)?'hit':'miss'):(user.has(h)?'extra':'')):''}" data-build-hand="${h}">${h}</button>`).join('')}</div>
  ${state.buildCompared?`<div class="rv9-compare"><div><b>${precision}%</b><small>без лишних</small></div><div><b>${recall}%</b><small>нашла рендж</small></div><div><b>${missed.length}</b><small>пропущено</small></div><div><b>${extra.length}</b><small>лишних</small></div></div>${missed.length?`<p><b>Пропустила:</b> ${missed.slice(0,24).join(', ')}${missed.length>24?'…':''}</p>`:''}${extra.length?`<p><b>Добавила лишнего:</b> ${extra.slice(0,24).join(', ')}${extra.length>24?'…':''}</p>`:''}`:''}
  <button class="rv6-big" id="rv9Compare">${state.buildCompared?'СБРОСИТЬ И СОБРАТЬ СНОВА':'СРАВНИТЬ С ИСТОЧНИКОМ'}</button><button class="rv6-link" data-view="library">Выбрать другой рендж</button></div>`;
}

function baseLibraryRows(){
  const q=state.libQuery.trim().toLowerCase();
  return RANGE_LIBRARY.filter(r=>!q||[r.source_mode,r.spot,r.position,r.stack,r.opponent,r.open,r.bet].join(' ').toLowerCase().includes(q));
}
function libRows({skip=null}={}){
  return baseLibraryRows().filter(r=>(skip==='mode'||!state.libMode||r.source_mode===state.libMode)&&(skip==='position'||!state.libPosition||r.position===state.libPosition)&&(skip==='stack'||!state.libStack||r.stack===state.libStack));
}
function uniq(rows,key){return [...new Set(rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));}
function parsedMatrix(rec){
  const cells=decodeStructured(rec),hands=canonicalHands(RANKS);
  return `<div class="rv7-source-grid">${hands.map(h=>{const v=cells[h];return `<button class="rv7-source-cell" data-lib-hand="${h}" data-slot="${v.slot}" data-pure="${v.pure?'1':'0'}">${h}</button>`;}).join('')}</div>`;
}
function library(){
  const filtered=libRows(),page=filtered.slice(state.libPage*10,state.libPage*10+10),modes=uniq(libRows({skip:'mode'}),'source_mode'),positions=uniq(libRows({skip:'position'}),'position'),stacks=uniq(libRows({skip:'stack'}),'stack');
  let modal='';
  if(state.libPreview){
    const r=manifestById.get(state.libPreview),rec=structuredById.get(state.libPreview);
    if(r&&rec){
      const cells=state.libMatrix?decodeStructured(rec):null,detail=state.libHand&&cells?cells[state.libHand]:null;
      modal=`<div class="rv6-modal"><div class="rv6-viewer"><div><strong>${esc(sourceModeLabel(r.source_mode))}</strong><button id="rv6Close">ЗАКРЫТЬ</button></div><p>${esc([r.position,r.stack,r.opponent,r.bet].filter(Boolean).join(' · '))}</p>${state.libMatrix?parsedMatrix(rec):`<img id="rv6Chart" data-path="${esc(r.compressed_file)}" alt="Исходный чарт"><span id="rv6Loading">ЗАГРУЖАЮ…</span>`}${detail?`<div class="rv6-hand-detail"><strong>${esc(state.libHand)}</strong><b>${esc(ACTION_LABEL[detail.action]||detail.action)}</b><p>${detail.pure?'Однозначная зона источника.':'Смешанная или пограничная зона — в строгий тест не попадает.'}</p></div>`:''}<button class="rv6-link" id="rv7ToggleMatrix">${state.libMatrix?'ПОКАЗАТЬ ОРИГИНАЛ':'ИНТЕРАКТИВНЫЕ 169 РУК'}</button><button class="rv6-big" id="rv8TrainChart" data-id="${esc(r.chart_id)}">ТРЕНИРОВАТЬ ЭТОТ ЧАРТ</button><button class="rv6-link" id="rv9BuildSource" data-id="${esc(r.chart_id)}">СОБРАТЬ ЭТОТ РЕНДЖ ПО ПАМЯТИ</button>${rec.trainable?`<button class="rv6-link" id="rv6TrainSource" data-id="${esc(r.chart_id)}">СТРОГИЙ ТЕСТ РЕШЕНИЙ</button>`:`<div class="rv6-data-note"><b>Source-режим</b><p>Покерная семантика части цветов здесь не подтверждена. Поэтому тест проверяет точную метку исходного чарта, не выдумывая fold/call/raise.</p></div>`}</div></div>`;
    }
  }
  return `<div class="rv6-panel"><h2>ВСЯ БАЗА</h2><p>Все 1578 чартов доступны для тренировки по source-меткам. Значок «РЕШЕНИЯ» означает, что для этого чарта дополнительно доступен строгий тест подтверждённых покерных действий.</p><input class="rv6-search" id="rv6Search" value="${esc(state.libQuery)}" placeholder="Например: BTN 25BB"><div class="rv6-filter-row"><select id="rv6Mode">${options(modes,state.libMode,'Ситуация',sourceModeLabel)}</select><select id="rv6LibPos">${options(positions,state.libPosition,'Позиция')}</select><select id="rv6LibStack">${options(stacks,state.libStack,'Стек')}</select></div><div class="rv6-list">${page.map(r=>{const rec=structuredById.get(r.chart_id);return `<button data-preview="${esc(r.chart_id)}"><span><b>${esc(sourceModeLabel(r.source_mode))}</b><small>${esc([r.position,r.stack,r.opponent].filter(Boolean).join(' · '))}</small></span><em class="rv7-train-badge">ТРЕНИРОВКА</em>${rec?.trainable?'<em class="rv7-train-badge">РЕШЕНИЯ</em>':''}<i>→</i></button>`;}).join('')||'<p>Ничего не найдено.</p>'}</div><div class="rv6-pages"><button id="rv6Prev" ${state.libPage===0?'disabled':''}>←</button><span>${filtered.length} найдено</span><button id="rv6PageNext" ${(state.libPage+1)*10>=filtered.length?'disabled':''}>→</button></div></div>${modal}`;
}
async function hydratePreview(){
  const img=document.getElementById('rv6Chart'); if(!img)return;
  try{const src=await loadChartAsset(img.dataset.path); if(!src)throw new Error('asset'); img.src=src; document.getElementById('rv6Loading')?.remove();}
  catch{const x=document.getElementById('rv6Loading'); if(x)x.textContent='НЕ УДАЛОСЬ ЗАГРУЗИТЬ';}
}
function render(){
  const host=document.getElementById('rangesArea'); if(!host)return; const c=chart();
  if(!c){host.innerHTML='<div class="rv6"><h2>Нет данных для выбранного спота</h2></div>';return;}
  const body=state.view==='home'?home():state.view==='study'?study(c):state.view==='setup'?setup():state.view==='quiz'?quiz():state.view==='results'?results():state.view==='build'?buildRange():library();
  host.innerHTML=`<div class="rv6">${header()}${state.view!=='quiz'?nav():''}${body}</div>`; bind(); hydratePreview(); savePrefs();
}
function goto(v){state.view=v;state.selected=null;if(v==='build'&&!state.buildId){state.buildSelected=new Set();state.buildCompared=false;}if(v!=='library'){state.libPreview=null;state.libMatrix=false;state.libHand=null;}render();}
function bind(){
  document.querySelectorAll('#ranges [data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.buildUo){state.buildId=null;state.buildSelected=new Set();state.buildCompared=false;}goto(b.dataset.view)});
  document.querySelectorAll('#ranges .rv6-cell').forEach(b=>b.onclick=()=>{state.selected=b.dataset.hand;render();});
  document.getElementById('rv6Pos')?.addEventListener('change',e=>{state.position=e.target.value;render();});
  document.getElementById('rv6Stack')?.addEventListener('change',e=>{state.stack=e.target.value;render();});
  document.getElementById('rv6Start')?.addEventListener('click',startQuiz);
  document.querySelectorAll('#ranges [data-train-mode]').forEach(b=>b.onclick=()=>{state.trainingMode=b.dataset.trainMode;render();});
  document.querySelectorAll('#ranges [data-build-hand]').forEach(b=>b.onclick=()=>{if(state.buildCompared)return;const h=b.dataset.buildHand;state.buildSelected.has(h)?state.buildSelected.delete(h):state.buildSelected.add(h);render();});
  document.getElementById('rv9Compare')?.addEventListener('click',()=>{if(state.buildCompared){state.buildSelected=new Set();state.buildCompared=false;}else state.buildCompared=true;render();});
  document.querySelectorAll('#ranges [data-answer]').forEach(b=>b.onclick=()=>answer(b.dataset.answer));
  document.getElementById('rv6Next')?.addEventListener('click',nextQuestion);
  document.getElementById('rv6RetryWrong')?.addEventListener('click',retryWrong);
  document.getElementById('rv7BackSource')?.addEventListener('click',()=>{state.libPreview=state.results.libraryId;state.libMatrix=false;state.view='library';render();});
  const search=document.getElementById('rv6Search'); if(search)search.oninput=()=>{state.libQuery=search.value;state.libPage=0;render();document.getElementById('rv6Search')?.focus();};
  for(const [id,key] of [['rv6Mode','libMode'],['rv6LibPos','libPosition'],['rv6LibStack','libStack']]) document.getElementById(id)?.addEventListener('change',e=>{state[key]=e.target.value;state.libPage=0;render();});
  document.querySelectorAll('#ranges [data-preview]').forEach(b=>b.onclick=()=>{state.libPreview=b.dataset.preview;state.libMatrix=false;state.libHand=null;render();});
  document.getElementById('rv6Close')?.addEventListener('click',()=>{state.libPreview=null;state.libMatrix=false;state.libHand=null;render();});
  document.getElementById('rv7ToggleMatrix')?.addEventListener('click',()=>{state.libMatrix=!state.libMatrix;state.libHand=null;render();});
  document.querySelectorAll('#ranges [data-lib-hand]').forEach(b=>b.onclick=()=>{state.libHand=b.dataset.libHand;render();});
  document.getElementById('rv8TrainChart')?.addEventListener('click',e=>startSourceQuiz(e.currentTarget.dataset.id));
  document.getElementById('rv9BuildSource')?.addEventListener('click',e=>{state.buildId=e.currentTarget.dataset.id;state.buildSelected=new Set();state.buildCompared=false;state.libPreview=null;state.view='build';render();});
  document.getElementById('rv6TrainSource')?.addEventListener('click',e=>startLibraryQuiz(e.currentTarget.dataset.id));
  document.getElementById('rv6Prev')?.addEventListener('click',()=>{state.libPage=Math.max(0,state.libPage-1);render();});
  document.getElementById('rv6PageNext')?.addEventListener('click',()=>{state.libPage++;render();});
}
function mount(){ensureCss();ensureScreen();render();return true;}
function unmount(){const host=document.getElementById('rangesArea');if(host)host.innerHTML='';}

loadPrefs();
const integrity=validateUO(UO_DATA); if(!integrity.ok)console.error('[Ranges v9] UO data errors',integrity.errors);
if(STRUCTURED_LIBRARY.length!==1578)console.error('[Ranges v9] structured library count',STRUCTURED_LIBRARY.length);
mount();
window.renderRanges=render;
window.PokerSwipeRanges={version:9,mount,unmount,render,state,data:{uo:UO_DATA,library:RANGE_LIBRARY,structured:STRUCTURED_LIBRARY},validate:()=>({uo:validateUO(UO_DATA),library:RANGE_LIBRARY.length,structured:STRUCTURED_LIBRARY.length,trainable:STRUCTURED_LIBRARY.filter(x=>x.trainable).length,sourceTrainable:STRUCTURED_LIBRARY.length})};
