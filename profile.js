/* PokerSwipe · «Твой покерный почерк»
 * Single owner of window.renderProfile. Read-only analytics: does not mutate grading/EV/state.
 */
(function () {
'use strict';

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list = x => Array.isArray(x) ? x.filter(v => v && typeof v === 'object') : [];
const num = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null;
const pct = (n,d) => d ? Math.round(n / d * 100) : null;
const clamp = (n,a,b) => Math.max(a, Math.min(b,n));

const ACTIVITY = [
 ['daily','Раздача дня',['daily']],['swipe','Poker Swipe',['swipe','training','quickgame']],
 ['sizing','Сайзинг',['sizing']],['review','Разбор линии',['review']],['myhands','Мои раздачи',['myhands']],
 ['heal','Heal',['heal']],['exploit','Эксплойт',['exploit']],['ranges','Ренджи',['ranges']],
 ['xray','Рентген',['xray']],['polyana','Поляна',['polyana']],['mytournaments','Мои турниры',[]]
];

const LABELS = {
 'preflop.rfi':'Открытия префлоп','preflop.open':'Открытия префлоп','rfi':'Открытия префлоп',
 'bb_defence':'Защита большого блайнда','bb.defence':'Защита большого блайнда','preflop.bb_defence':'Защита большого блайнда',
 '3bet':'Игра против 3-бета','3-bet':'Игра против 3-бета','preflop.3bet':'Игра против 3-бета',
 'river_bluffcatch':'Блафф-кэтч на ривере','thin_value':'Тонкое вэлью','sizing':'Размер ставки'
};

function currentState(){ return window.PokerSwipeCore?.store?.getState?.() ?? window.S ?? null; }
function confidence(e){ const n=num(e.playerConfidence ?? e.confidence); return n!==null && n>=0 && n<=100 ? n : null; }
function gradeLabel(g){ return g==='g'?'основная линия':g==='y'?'допустимая линия':'ошибка'; }
function eventTime(e){ return num(e.ts) ?? (Date.parse(e.date)||0); }

function cleanEvents(state){
 const seen=new Set();
 return list(state?.events).filter(e=>{
  if(e.mode==='diagnostic'||e.mode==='legacy'||e.excludeFromProfile||e.test===true||!['g','y','r'].includes(e.grade)) return false;
  const id=e.eventId??e.id;
  if(id!=null){ const k=String(id); if(seen.has(k)) return false; seen.add(k); }
  return true;
 }).sort((a,b)=>eventTime(a)-eventTime(b));
}
function summary(events){
 const n=events.length,g=events.filter(e=>e.grade==='g').length,r=events.filter(e=>e.grade==='r').length;
 return {n,g,r,y:n-g-r,accuracy:pct(g,n),errorRate:pct(r,n)};
}
function conceptKey(e){ return String(e.conceptId||e.concept||'').trim(); }
function label(key){ return LABELS[key] || window.conceptLabel?.(key) || key.replace(/[._]/g,' ').replace(/\b\w/g,m=>m.toUpperCase()); }
function groups(events){
 const m=new Map();
 for(const e of events){ const key=conceptKey(e); if(!key||key==='unknown') continue; if(!m.has(key))m.set(key,[]); m.get(key).push(e); }
 return [...m].map(([key,a])=>{
  const s=summary(a),confidentWrong=a.filter(e=>e.grade==='r'&&confidence(e)!==null&&confidence(e)>=80).length;
  return {key,events:a,...s,confidentWrong};
 });
}
function streetOf(e){ return String(e.street||'').toUpperCase(); }
function inPreflop(e){ const s=streetOf(e),k=conceptKey(e); return /^(PREFLOP|ПРЕФЛОП)$/.test(s)||/^preflop\.|RFI|BB defence|3-?bet/i.test(k); }
function inPostflop(e){ const s=streetOf(e),k=conceptKey(e); return /^(FLOP|TURN|RIVER|ФЛОП|ТЕРН|ТЁРН|РИВЕР)$/.test(s)||/^postflop\./i.test(k); }
function inSizing(e){ return e.mode==='sizing'||e.gradeSize!=null||/sizing|size|bet_size/i.test(conceptKey(e)); }

function statusFor(n){ return n<10?'Собираем данные':n<20?'Виден паттерн':'Есть выборка'; }
function axisModel(name,events){
 const s=summary(events),concepts=groups(events).sort((a,b)=>b.n-a.n);
 return {name,events,concepts,...s,status:statusFor(s.n)};
}
function evidenceRank(g){ return g.n*2 + g.confidentWrong*4 + g.r; }
function latestProofs(g){ return g.events.slice(-4).reverse(); }
function strengthCandidate(concepts){
 return concepts.filter(g=>g.n>=10 && g.accuracy>=75 && summary(g.events.slice(-5)).accuracy>=60)
  .sort((a,b)=>(b.accuracy-a.accuracy)||(b.n-a.n))[0]||null;
}
function growthCandidate(concepts){
 const confident=concepts.filter(g=>g.n>=6&&g.confidentWrong>=2).sort((a,b)=>(b.confidentWrong-a.confidentWrong)||(b.errorRate-a.errorRate))[0];
 if(confident) return confident;
 return concepts.filter(g=>g.n>=10&&g.r>=2).sort((a,b)=>(b.errorRate-a.errorRate)||evidenceRank(b)-evidenceRank(a))[0]||null;
}
function compareAxis(axis){
 if(axis.events.length<40) return null;
 const before=summary(axis.events.slice(-40,-20)),after=summary(axis.events.slice(-20));
 const d=(after.accuracy??0)-(before.accuracy??0);
 return {name:axis.name,before:before.accuracy,after:after.accuracy,d,n:40};
}
function matrix(events){
 const cells=[0,0,0,0]; let missing=0,acceptable=0;
 for(const e of events){ if(e.grade==='y'){acceptable++;continue;} const c=confidence(e); if(c===null){missing++;continue;} cells[(e.grade==='r'?2:0)+(c>=80?0:1)]++; }
 return {cells,missing,acceptable};
}
function uniqueHands(state){
 const seen=new Set(); return [...list(state?.hands),...list(state?.myHands18)].filter(h=>{const id=h.sourceHandId?`${h.sourceRoom||''}:${h.sourceHandId}`:h.id;if(id==null)return true;const k=String(id);if(seen.has(k))return false;seen.add(k);return true;}).length;
}
function model(state){
 const events=cleanEvents(state),concepts=groups(events),m=matrix(events);
 const axes=[axisModel('Префлоп',events.filter(inPreflop)),axisModel('Постфлоп',events.filter(inPostflop)),axisModel('Сайзинг',events.filter(inSizing))];
 const strength=strengthCandidate(concepts),growth=growthCandidate(concepts);
 const changes=axes.map(compareAxis).filter(Boolean).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,3);
 return {events,concepts,m,axes,strength,growth,changes};
}

function proofRows(g){
 return latestProofs(g).map(e=>`<p class="pid-proof"><span>${esc(e.date||'Без даты')}</span><b>${esc(e.action||e.answer||'Решение')}</b><small>${gradeLabel(e.grade)}${confidence(e)!==null?' · уверенность '+confidence(e)+'%':''}</small></p>`).join('');
}
function evidence(g){
 if(!g) return '';
 return `<details class="pid-evidence"><summary><span>Почему мы так считаем?</span><b>${g.n} решений</b></summary><p class="pid-explain">Основная линия: ${g.g}. Допустимая: ${g.y}. Ошибок: ${g.r}.${g.confidentWrong?` Ошибок при высокой уверенности: ${g.confidentWrong}.`:''}</p>${proofRows(g)}<p class="pid-note">Повторы одной и той же задачи могут переоценивать силу сигнала. Профиль описывает сохранённые упражнения, а не всю реальную игру.</p></details>`;
}
function axisCard(a){
 const score=a.n>=10?a.accuracy:null;
 const top=a.concepts.slice(0,3);
 return `<details class="pid-axis" ${a.name==='Префлоп'?'open':''}><summary><span><b>${a.name}</b><small>${a.status} · ${a.n} решений</small></span><strong>${score===null?'—':score+'%'}</strong></summary><div class="pid-axis-body">${score!==null?`<div class="pid-meter"><i style="width:${clamp(score,0,100)}%"></i></div>`:''}${top.length?top.map(g=>`<div class="pid-topic"><span>${esc(label(g.key))}<small>${g.n} решений · ${g.r} ошибок${g.confidentWrong?' · '+g.confidentWrong+' уверенных':''}</small></span><b>${g.n>=6?g.accuracy+'%':'—'}</b></div>`).join(''):`<p class="pid-muted">Пока нет достаточно конкретных тем, чтобы показать разбор.</p>`}</div></details>`;
}
function mainObservation(strength,growth,has){
 if(!has) return 'Я только начинаю собирать твой покерный почерк. Первые решения покажут, на что ты уже можешь опереться и где чаще всего теряешь точность.';
 if(strength&&growth) return `${label(strength.key)} сейчас выглядит твоей опорой. А в теме «${label(growth.key)}» есть паттерн, который стоит проверить внимательнее.`;
 if(growth) return `В теме «${label(growth.key)}» уже виден повторяющийся паттерн. Я бы начала разбор именно отсюда.`;
 if(strength) return `«${label(strength.key)}» сейчас выглядит самой устойчивой частью твоей сохранённой выборки.`;
 return 'Данных уже достаточно для карты игры, но пока рано делать сильные выводы по отдельным темам.';
}
function spotlight(type,g){
 const isStrength=type==='strength';
 if(!g) return `<article class="pid-spot ${isStrength?'pid-spot-good':'pid-spot-grow'}"><span class="pid-ey">${isStrength?'ТВОЯ ОПОРА':'ТОЧКА РОСТА'}</span><h3>${isStrength?'Пока ищем устойчивую сильную сторону':'Пока собираем повторяющийся паттерн'}</h3><p>${isStrength?'Нужно хотя бы 10 решений в одной теме и стабильность на последних задачах.':'Уверенная ошибка важна для обучения, но не означает большой проигрыш в фишках без достоверного EV.'}</p></article>`;
 const line=isStrength?`${g.accuracy}% основных линий на ${g.n} решениях.`:`${g.r} ошибок на ${g.n} решениях${g.confidentWrong?`, из них ${g.confidentWrong} при высокой уверенности`:''}.`;
 return `<article class="pid-spot ${isStrength?'pid-spot-good':'pid-spot-grow'}"><span class="pid-ey">${isStrength?'ТВОЯ ОПОРА':'ТОЧКА РОСТА'}</span><h3>${esc(label(g.key))}</h3><p>${line}</p>${evidence(g)}</article>`;
}
function changesBlock(changes){
 if(!changes.length) return `<div class="pid-change-empty"><b>Пока сравнивать рано</b><p>«Что изменилось» появится после двух полных отрезков по 20 решений внутри одной зоны. Сравниваем только похожие группы задач.</p></div>`;
 return changes.map(c=>`<div class="pid-change"><span><b>${c.name}</b><small>предыдущие 20 → последние 20</small></span><strong class="${c.d>0?'pid-up':c.d<0?'pid-down':''}">${c.before}% → ${c.after}%</strong><em>${c.d>0?'+':''}${c.d} п.п.</em></div>`).join('')+`<p class="pid-note">Это изменение качества решений в сохранённых упражнениях. Оно не доказывает изменение винрейта или турнирных результатов.</p>`;
}
function activityBlock(state,events){
 const rows=ACTIVITY.map(([route,name,modes])=>{
  const s=summary(events.filter(e=>modes.includes(e.mode))); let value=s.n,detail=s.n?`${s.n} решений`:'нет решений';
  if(route==='myhands'){value=uniqueHands(state);detail='сохранённых раздач';}
  if(route==='mytournaments'){value=list(state.tournaments).length;detail='турниров в истории';}
  if(route==='heal'){const c=Object.values(state.healCourses||{}).filter(Array.isArray);value=c.filter(a=>a.length&&a.every(v=>v===1||v===true)).length;detail='завершённых курсов';}
  if(route==='polyana'){value='—';detail='расписание и планы';}
  if(route==='ranges'&&!s.n){value='—';detail='справочник';}
  if(route==='xray'&&!s.n){value=num(state.xray?.runs)??'—';detail='прохождений';}
  return `<div><span>${name}<small>${detail}</small></span><b>${value||'—'}</b></div>`;
 }).join('');
 return `<details class="pid-details"><summary>Активность в приложении <span>не оценка игры</span></summary><div class="pid-activity">${rows}</div></details>`;
}

function render(){
 const root=document.getElementById('profileArea'); if(!root) return;
 const state=currentState();
 if(!state){ root.innerHTML='<div class="pid"><section class="pid-error"><h2>Профиль пока недоступен</h2><p>Не удалось загрузить данные игрока. Попробуй открыть профиль снова.</p></section></div>'; return; }
 const M=model(state),has=M.events.length>0;
 const name=state.nick||state.name||'ЛЕРА';
 const observation=mainObservation(M.strength,M.growth,has);
 const matrixCount=M.m.cells.reduce((a,b)=>a+b,0);
 const confidenceSummary=matrixCount?`${M.m.cells[2]} уверенных ошибок · ${M.m.cells[0]} уверенных основных линий`:'Пока нет достаточных отметок уверенности';
 const skill=(has||state.diagDone)?num(state.skill):null;

 root.innerHTML=`<div class="pid" data-profile-build="poker-handwriting-v2">
  <header class="pid-intro">
   <p class="pid-screen-ey">ПРОФИЛЬ</p>
   <div class="pid-person"><span class="pid-avatar">♠</span><div><b>${esc(name)}</b><small>${M.events.length} решений в истории</small></div>${skill!==null?`<span class="pid-skill">Skill ${esc(skill)}</span>`:''}</div>
   <h1 class="impact">ТВОЙ ПОКЕРНЫЙ ПОЧЕРК</h1>
   <div class="pid-voice"><span class="pid-ey">ФРИКОВАЯ ДАМА ЗАМЕТИЛА</span><p>${esc(observation)}</p></div>
  </header>

  ${!has?`<section class="pid-collect"><span class="pid-ey">ДОСЬЕ СОБИРАЕТСЯ</span><h2>Мне нужны твои решения, а не просто клики.</h2><p>Когда появится выборка, здесь будут конкретные темы, доказательства и изменения — без психологических ярлыков и без выдуманного EV.</p></section>`:`
  <section class="pid-map">
   <div class="pid-heading"><div><span class="pid-ey">КАРТА ТВОЕЙ ИГРЫ</span><h2>Три направления. Внутри — конкретные споты.</h2></div><small>Нажми на зону ↓</small></div>
   <div class="pid-axes">${M.axes.map(axisCard).join('')}</div>
  </section>

  <section class="pid-spots">${spotlight('strength',M.strength)}${spotlight('growth',M.growth)}</section>

  <section class="pid-changes"><div class="pid-heading"><div><span class="pid-ey">ЧТО ИЗМЕНИЛОСЬ</span><h2>Сравнение с собой</h2></div></div>${changesBlock(M.changes)}</section>
  `}

  <section class="pid-secondary">
   <details class="pid-details"><summary>Уверенность и ошибки <span>${esc(confidenceSummary)}</span></summary>${matrixCount?`<div class="pid-confidence"><div><span>Верно · уверенно</span><b>${M.m.cells[0]}</b></div><div><span>Верно · с сомнением</span><b>${M.m.cells[1]}</b></div><div><span>Ошибка · уверенно</span><b>${M.m.cells[2]}</b></div><div><span>Ошибка · с сомнением</span><b>${M.m.cells[3]}</b></div></div><p class="pid-note">Высокая уверенность — от 80%. Уверенная ошибка важнее для обучения, но без достоверного EV мы не называем её «дорогой».</p>`:`<p class="pid-muted">Когда в решениях появится уверенность, здесь будет связь между уверенностью и качеством ответа.</p>`}</details>
   ${activityBlock(state,M.events)}
   <details class="pid-details"><summary>Границы наблюдения <span>что профиль знает</span></summary><p class="pid-muted">Профиль строится по сохранённым упражнениям PokerSwipe. Турнирный результат не используется как доказательство качества решения. Частота коллов или рейзов сама по себе не превращается в «стиль игрока»: нужен контекст доступных действий и состава задач.</p></details>
  </section>

  <details class="pid-settings"><summary>Данные и настройки <span>↗</span></summary><div class="pid-tools">${typeof window.exportPokerSwipe32==='function'?'<button type="button" data-pid-action="export">Скачать данные</button>':''}${typeof window.importPokerSwipe32==='function'?'<label>Восстановить из файла<input type="file" data-pid-import accept="application/json,.json"></label>':''}${typeof window.startDiagnostic25==='function'?'<button type="button" data-pid-action="diagnostic">Повторить диагностику</button>':''}</div><p class="pid-note" id="pid-status" role="status"></p></details>
 </div>`;

 root.onclick=e=>{
  const a=e.target.closest('[data-pid-action]')?.dataset.pidAction;
  if(a==='export') window.exportPokerSwipe32?.();
  if(a==='diagnostic'&&window.confirm('Начать диагностику заново?')) window.startDiagnostic25?.(true);
 };
 const input=root.querySelector('[data-pid-import]');
 if(input) input.onchange=async()=>{const file=input.files?.[0]; if(!file)return; try{await window.importPokerSwipe32(file);render();}catch(e){const s=root.querySelector('#pid-status');if(s)s.textContent='Не удалось восстановить данные. Проверь файл.';}};
}

window.PokerSwipeProfile={render,model,cleanEvents,confidence};
window.renderProfile=render;
window.renderProfile.__psVisualV2=true;
window.renderProfile.__psProfileHandwriting=true;
})();
