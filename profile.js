/* =========================================================
   PokerSwipe V38 — PLAYER DASHBOARD
   Clean replacement for the old layered YOU/Profile screen.
   No ranks, no avatar ladder, no duplicated legacy profile DOM.
   ========================================================= */
(function(){
'use strict';

function v38Esc(s){
  return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function v38Events(){
  const state=typeof S!=='undefined'?S:window.S;
  return (Array.isArray(state?.events)?state.events:[]).filter(e=>e.mode!=='diagnostic'&&!e.excludeFromProfile);
}
function v38GradeScore(g){ return g==='g'?1:g==='y'?0.62:g==='r'?0:0.5; }
function v38Stat(filter){
  const a=v38Events().filter(filter);
  return {n:a.length,score:a.length?Math.round(a.reduce((s,e)=>s+v38GradeScore(e.grade),0)/a.length*100):0};
}
function v38SplitStat(filter){
  const a=v38Events().filter(filter);
  const cur=a.slice(-20), prev=a.slice(-40,-20);
  const score=x=>x.length?Math.round(x.reduce((s,e)=>s+v38GradeScore(e.grade),0)/x.length*100):null;
  const now=score(cur), before=score(prev);
  return {n:a.length,score:now??score(a)??0,delta:(now!=null&&before!=null)?now-before:null};
}
function v38Confidence(n){
  if(n<8)return ['НИЗКАЯ','Нужно больше решений'];
  if(n<25)return ['СРЕДНЯЯ','Уже виден паттерн'];
  return ['ВЫСОКАЯ','Выборка достаточно устойчива'];
}
function v38State(score,n){
  if(n<5)return 'Мало данных';
  if(score>=80)return 'Сильная зона';
  if(score>=68)return 'Стабильно';
  if(score>=55)return 'Есть потери';
  return 'Главная проблема';
}
function v38Trend(delta){
  if(delta==null)return '<span class="v38Trend neutral">—</span>';
  if(delta>=4)return `<span class="v38Trend up">↑ ${delta}</span>`;
  if(delta<=-4)return `<span class="v38Trend down">↓ ${Math.abs(delta)}</span>`;
  return '<span class="v38Trend neutral">→</span>';
}
function v38ConceptName(leak){
  try{return leak?conceptLabel(leak.concept):''}catch(e){return String(leak?.concept||'').toUpperCase()}
}
function v38LastForm(){
  try{return typeof formScore==='function'?formScore():50}catch(e){return 50}
}
function v38ScoreBar(x){return Math.max(3,Math.min(100,Number(x)||0))}
function v38Row(name,stat){
  const value=stat.n>=5?stat.score:'—';
  return `<div class="v38SkillRow">
    <div class="v38SkillHead">
      <div><b>${name}</b><small>${v38State(stat.score,stat.n)} · ${stat.n} решений</small></div>
      <div class="v38SkillScore">${value} ${stat.n>=5?v38Trend(stat.delta):''}</div>
    </div>
    <div class="v38Bar ${stat.n<5?'pending':''}"><i style="width:${stat.n>=5?v38ScoreBar(stat.score):0}%"></i></div>
  </div>`;
}
function v38StateObject(){return typeof S!=='undefined'?S:(window.S||{})}
function v38Score(events){return events.length?Math.round(events.reduce((s,e)=>s+v38GradeScore(e.grade),0)/events.length*100):null}
function v38ModeStat(events,modes){const a=events.filter(e=>modes.includes(String(e.mode||'').toLowerCase()));return{n:a.length,score:v38Score(a)}}
function v38Value(score,n){return n>=5&&score!=null?String(score):'—'}
function v38ConceptStats(events){
  const map={};
  events.filter(e=>e.concept).forEach(e=>{
    const key=String(e.concept),x=map[key]||(map[key]={concept:key,n:0,g:0,y:0,r:0,blind:0,events:[]});
    x.n++;x[e.grade]=(x[e.grade]||0)+1;x.events.push(e);
    if(e.grade==='r'&&Number(e.confidence)>=80)x.blind++;
  });
  return Object.values(map).map(x=>({...x,score:v38Score(x.events)}));
}
function v38ModuleCard(id,title,value,meta,sub,tone=''){
  return `<button class="v38Module ${tone}" data-v38go="${id}"><span>${title}</span><b>${value}</b><small>${meta}</small><em>${sub}</em><i>→</i></button>`;
}
function v38Identity(events,pre,post,size,disc){
  if(events.length<8)return ['ПРОФИЛЬ СОБИРАЕТСЯ','PokerSwipe пока наблюдает и не будет придумывать тебе стиль по нескольким рукам.'];
  const acts=events.map(e=>String(e.action||'').toUpperCase()),raises=acts.filter(x=>/RAISE|BET|ALL.?IN|ПУШ/.test(x)).length,calls=acts.filter(x=>/CALL|КОЛЛ/.test(x)).length;
  const known=[pre,post,size,disc].filter(x=>x.n>=5).sort((a,b)=>b.score-a.score);
  const strong=known[0],weak=known[known.length-1];
  if(raises>calls*1.35)return ['АГРЕССИВНЫЙ, НО ПРОВЕРЯЕМЫЙ',`Ты чаще выбираешь давление. ${weak&&weak.score<60?'Главный риск — качество решений в слабой зоне, а не сама агрессия.':'Пока эта агрессия держится на приемлемом качестве решений.'}`];
  if(calls>raises*1.35)return ['ЛЮБИШЬ ДОЙТИ ДО ШОУДАУНА',`Колл встречается чаще агрессивных действий. ${weak&&weak.score<60?'Важно проверить, где это дисциплина, а где дорогое любопытство.':'Пока это не выглядит автоматическим ликованием.'}`];
  return ['СБАЛАНСИРОВАННЫЙ ИГРОК',strong?`Сильнее всего сейчас выглядит зона с оценкой ${strong.score}. Слабую часть профиля проверяем только на достаточной выборке.`:'Стиль уже проявляется, но для точного вывода нужно больше решений.'];
}
function v38ConfidenceMatrix(events){
  const c={rightSure:0,rightUnsure:0,wrongUnsure:0,wrongSure:0};
  events.filter(e=>Number.isFinite(Number(e.confidence))).forEach(e=>{
    const sure=Number(e.confidence)>=80,right=e.grade==='g';
    if(right&&sure)c.rightSure++;else if(right)c.rightUnsure++;else if(!right&&sure)c.wrongSure++;else c.wrongUnsure++;
  });return c;
}
function v38Tendencies(events){
  const out=[],mistakes=events.filter(e=>e.grade==='r'),actions=mistakes.map(e=>String(e.action||'').toUpperCase());
  const calls=actions.filter(x=>/CALL|КОЛЛ/.test(x)).length,aggr=actions.filter(x=>/RAISE|BET|ALL.?IN|ПУШ/.test(x)).length;
  if(mistakes.length>=5&&calls/mistakes.length>=.4)out.push(['ЛЮБИШЬ УЗНАТЬ','Заметная доля ошибок приходится на коллы. Это сигнал проверить bluff-catch, а не готовый диагноз.']);
  if(mistakes.length>=5&&aggr/mistakes.length>=.4)out.push(['ДАВИШЬ БЕЗ ДОСТАТОЧНОЙ ОПОРЫ','Среди ошибок часто встречаются агрессивные действия. Проверь, где диапазону не хватает value или fold equity.']);
  const sized=events.filter(e=>Number.isFinite(Number(e.sizePct))&&Number.isFinite(Number(e.sizeBest)));
  const under=sized.filter(e=>Number(e.sizePct)+12<Number(e.sizeBest)).length;
  if(sized.length>=5&&under/sized.length>=.4)out.push(['НЕДОБИРАЕШЬ САЙЗОМ',`В ${under} из ${sized.length} оценённых сайзингов выбранный размер был заметно меньше ориентира.`]);
  const unsureRight=events.filter(e=>e.grade==='g'&&Number(e.confidence)<80&&Number.isFinite(Number(e.confidence))).length;
  if(events.length>=10&&unsureRight>=4)out.push(['ЗНАЕШЬ БОЛЬШЕ, ЧЕМ ДУМАЕШЬ',`${unsureRight} правильных решений были приняты без высокой уверенности.`]);
  return out.slice(0,3);
}
function v38Timeline(state,events){
  const snaps=(Array.isArray(state.snapshots)?state.snapshots:[]).slice(-4).reverse();
  if(snaps.length)return snaps.map((x,i)=>`<div class="v38TimelineRow"><span>${v38Esc(x.date||'')}</span><b>${i===0?'POKER DNA':'SKILL'} ${Number(x.skill)||50}</b><small>FORM ${Number(x.form)||50}</small></div>`).join('');
  const labels={daily:'Раздача дня',swipe:'Poker Swipe',sizing:'Сайзинг',review:'Разбор линии',heal:'Heal',quickgame:'Быстрая игра'};
  return events.slice(-4).reverse().map(e=>`<div class="v38TimelineRow"><span>${v38Esc(e.date||'')}</span><b>${v38Esc(labels[e.mode]||'Решение')}</b><small>${e.grade==='g'?'Сильная линия':e.grade==='r'?'Ошибка':'Допустимо'} · ${v38Esc(v38ConceptName(e)||'')}</small></div>`).join('')||'<div class="v38Empty">История появится после первых решений.</div>';
}

window.renderProfile=function(){
  const root=document.getElementById('profileArea'); if(!root)return;
  const state=v38StateObject();
  const ev=v38Events();
  const sample=ev.length;
  const skill=Number(state.skill||50);
  const form=v38LastForm();
  const leak=typeof topLeak==='function'?topLeak():null;
  const conf=v38Confidence(sample);

  const pre=v38SplitStat(e=>/RFI|BB defence|3-bet|flat IP|polar 3-bet/i.test(e.concept||'') || String(e.street||'').toUpperCase()==='ПРЕФЛОП');
  const size=v38SplitStat(e=>e.mode==='sizing'||e.sizePct!=null);
  const post=v38SplitStat(e=>String(e.street||'').toUpperCase()!=='ПРЕФЛОП' && e.street && e.mode!=='sizing');
  const disc=v38SplitStat(e=>e.mode!=='diagnostic');
  try{
    if(typeof disciplineScore==='function'){
      const ds=disciplineScore();
      if(Number.isFinite(ds))disc.score=ds;
    }
  }catch(e){}

  const recent=ev.slice(-20), previous=ev.slice(-40,-20);
  const avg=a=>a.length?Math.round(a.reduce((s,e)=>s+v38GradeScore(e.grade),0)/a.length*100):null;
  const rn=avg(recent), pn=avg(previous);
  const formDelta=(rn!=null&&pn!=null)?rn-pn:null;
  const identity=v38Identity(ev,pre,post,size,disc),matrix=v38ConfidenceMatrix(ev);
  const concepts=v38ConceptStats(ev),strongZones=concepts.filter(x=>x.n>=5).sort((a,b)=>b.score-a.score).slice(0,3);
  const blindZones=concepts.filter(x=>x.n>=3&&(x.blind>0||x.score<60)).sort((a,b)=>(b.blind-a.blind)||(a.score-b.score)).slice(0,3);
  const tendencies=v38Tendencies(ev);
  const daily=v38ModeStat(ev,['daily']),training=v38ModeStat(ev,['swipe','quickgame','training']),sizingMode=v38ModeStat(ev,['sizing']),review=v38ModeStat(ev,['review']);
  const hands=(Array.isArray(state.hands)?state.hands.length:0)+(Array.isArray(state.myHands18)?state.myHands18.length:0);
  const courses=Object.values(state.healCourses||{}),closed=courses.filter(x=>Array.isArray(x)&&x.length&&x.every(Boolean)).length,steps=courses.reduce((n,x)=>n+(Array.isArray(x)?x.filter(Boolean).length:0),0);
  const tournaments=Array.isArray(state.tournaments)?state.tournaments.length:0;
  const planned=Object.keys(window.PokerSwipePolianaV40?.state?.selected||{}).length;
  const name=v38Esc(state.nick||state.name||'ИГРОК');
  const verdict=sample<8?'Я ещё не знаю тебя достаточно хорошо. Дай мне несколько решений — и я начну говорить фактами.':leak?`${v38ConceptName(leak)} повторяется чаще остальных ошибок. Особенно внимательно смотрим на решения, где ты была уверена.`:formDelta>=4?'Ты стала заметно чище на последнем отрезке. Теперь важно удержать результат на новых спотах.':'Профиль уже собран. Ищи правду не в одной цифре, а в структуре решений.';
  const comparison=[['PREFLOP',pre],['POSTFLOP',post],['SIZING',size],['DISCIPLINE',disc]].filter(x=>x[1].n>=5);
  const won=comparison.filter(x=>(x[1].delta||0)>=4).length,lost=comparison.filter(x=>(x[1].delta||0)<=-4).length;

  root.innerHTML=`<div class="v38You">
    <header class="v38Hero">
      <div class="v38IdentityTop"><div><span class="v38Eyebrow">${name} · ${sample} РЕШЕНИЙ</span><h1>${identity[0].replace(',','<br><em>,</em>')}</h1></div><span class="v38Suit">♠</span></div>
      <p>${identity[1]}</p>

      <div class="v38HeroGrid">
        <div class="v38MainScore">
          <span>POKER DNA</span>
          <b>${skill}</b>
          <small>${formDelta==null?'нужна предыдущая выборка':`${formDelta>=0?'+':''}${formDelta} к прошлому отрезку`}</small>
        </div>
        <div class="v38HeroMeta">
          <div><span>ФОРМА</span><b>${form}</b>${v38Trend(formDelta)}</div>
          <div><span>ДОСТОВЕРНОСТЬ</span><b>${conf[0]}</b><small>${conf[1]}</small></div>
        </div>
      </div>
      <button class="v38TextButton" id="v38How">КАК ЭТО СЧИТАЕТСЯ? ↓</button>
      <div class="v38Method hidden" id="v38Method">
        <b>Уровень игры</b> меняется от качества решений, а не от количества входов в приложение. PokerSwipe смотрит на последние решения, размеры ставок, повторяемость ошибок и выборку. Одна удачная сессия не делает тебя сильнее, одна плохая — не ломает профиль.
      </div>
    </header>

    <section class="v38Queen"><span class="v38Eyebrow">ФРИКОВАЯ ДАМА ГОВОРИТ</span><blockquote>«${v38Esc(verdict)}»</blockquote></section>

    <section class="v38Section" id="v38Dna">
      <div class="v38SectionTitle"><div><span class="v38Eyebrow">КАРТА ПОКЕРНОГО МОЗГА</span><h2>POKER DNA</h2></div><small>↑↓ против предыдущей выборки</small></div>
      ${v38Row('Префлоп',pre)}
      ${v38Row('Постфлоп',post)}
      ${v38Row('Размеры ставок',size)}
      ${v38Row('Дисциплина решений',disc)}
      <div class="v38ConceptGrid">${concepts.sort((a,b)=>b.n-a.n).slice(0,6).map(x=>`<div><span>${v38Esc(v38ConceptName(x))}</span><b>${v38Value(x.score,x.n)}</b><small>${x.n} решений${x.n<5?' · мало данных':''}</small></div>`).join('')||'<div class="v38Empty">Детальная карта откроется после первых решений.</div>'}</div>
    </section>

    <section class="v38Section">
      <div class="v38SectionTitle"><div><span class="v38Eyebrow">ВСЁ ПРИЛОЖЕНИЕ В ОДНОМ МЕСТЕ</span><h2>ТВОЯ ИГРА ПО РАЗДЕЛАМ</h2></div></div>
      <div class="v38Modules">
        ${v38ModuleCard('daily','DAILY',v38Value(daily.score,daily.n),`${daily.n} решений`,daily.n>=5?`точность ${daily.score}%`:'нужна выборка')}
        ${v38ModuleCard('swipe','TRAINING',v38Value(training.score,training.n),`${training.n} решений`,training.n>=5?`качество ${training.score}%`:'нужна выборка')}
        ${v38ModuleCard('myhands','MY HANDS',String(hands),`${hands} сохранено`,review.n?`${review.n} разборов`:'реальная игра')}
        ${v38ModuleCard('heal','HEAL',String(closed),`${closed} курсов закрыто`,`${steps} шагов пройдено`,closed?'good':'')}
        ${v38ModuleCard('tournaments','ПОЛЯНА',String(tournaments||planned),`${tournaments} турниров`,`${planned} в плане`)}
        ${v38ModuleCard('sizing','SIZING',v38Value(sizingMode.score,sizingMode.n),`${sizingMode.n} решений`,sizingMode.n>=5?`качество ${sizingMode.score}%`:'нужна выборка')}
      </div>
    </section>

    <section class="v38Split">
      <div class="v38Zone good"><span class="v38Eyebrow">СИЛЬНЫЕ СТОРОНЫ</span><h2>${strongZones.length?'НА ЭТО МОЖНО ОПЕРЕТЬСЯ':'ЕЩЁ НЕ ДОКАЗАНО'}</h2>${strongZones.map(x=>`<div class="v38ZoneRow"><div><b>${v38Esc(v38ConceptName(x))}</b><small>${x.n} решений</small></div><strong>${x.score}</strong></div>`).join('')||'<p>Нужно минимум 5 решений в одной зоне.</p>'}</div>
      <div class="v38Zone bad"><span class="v38Eyebrow">СЛЕПЫЕ ЗОНЫ</span><h2>${blindZones.length?'ТУТ ТЫ ТЕРЯЕШЬ':'ПОКА НЕ НАЙДЕНЫ'}</h2>${blindZones.map(x=>`<div class="v38ZoneRow"><div><b>${v38Esc(v38ConceptName(x))}</b><small>${x.r} ошибок · ${x.blind} уверенных</small></div><strong>${x.score}</strong></div>`).join('')||'<p>Нет повторяемого паттерна на достаточной выборке.</p>'}${blindZones.length?'<button class="v38Primary" id="v38TrainLeak">ПРОВЕРИТЬ ГЛАВНЫЙ ЛИК →</button>':''}</div>
    </section>

    <section class="v38Section">
      <div class="v38SectionTitle"><div><span class="v38Eyebrow">КАК ТЫ ДУМАЕШЬ</span><h2>УВЕРЕННОСТЬ × РЕЗУЛЬТАТ</h2></div></div>
      <div class="v38Matrix"><div class="good"><span>ПРАВИЛЬНО + УВЕРЕНА</span><b>${matrix.rightSure}</b></div><div><span>ПРАВИЛЬНО + СОМНЕВАЛАСЬ</span><b>${matrix.rightUnsure}</b></div><div><span>ОШИБЛАСЬ + СОМНЕВАЛАСЬ</span><b>${matrix.wrongUnsure}</b></div><div class="bad"><span>ОШИБЛАСЬ + УВЕРЕНА</span><b>${matrix.wrongSure}</b><small>самые дорогие ошибки</small></div></div>
    </section>

    <section class="v38Section">
      <div class="v38SectionTitle"><div><span class="v38Eyebrow">ПОВЕДЕНЧЕСКИЕ ПАТТЕРНЫ</span><h2>ТВОИ ТЕНДЕНЦИИ</h2></div></div>
      <div class="v38Tendencies">${tendencies.map((x,i)=>`<article><span>0${i+1}</span><div><b>${x[0]}</b><p>${x[1]}</p></div></article>`).join('')||'<div class="v38Empty">Пока данных недостаточно. Здесь не будет фейковой психологии ради красивого текста.</div>'}</div>
    </section>

    <section class="v38Versus">
      <div><span class="v38Eyebrow">ТЫ VS ТЫ · ПОСЛЕДНИЕ 20</span><h2>${comparison.length?`${won} : ${lost}`:'НУЖНА ДИСТАНЦИЯ'}</h2><p>${comparison.length?`Сейчас ты сильнее прошлого отрезка в ${won} зонах; просадка есть в ${lost}. Нейтральные изменения не считаются победой или поражением.`:'Сравнение появится, когда будет две сопоставимые выборки.'}</p></div>
      <div class="v38Compare">${comparison.map(x=>`<div><span>${x[0]}</span><b>${v38Trend(x[1].delta)}</b></div>`).join('')}</div>
    </section>

    <section class="v38Section"><div class="v38SectionTitle"><div><span class="v38Eyebrow">БИОГРАФИЯ ИГРОКА</span><h2>КАК МЕНЯЕТСЯ ТВОЯ ИГРА</h2></div></div><div class="v38Timeline">${v38Timeline(state,ev)}</div></section>

    <section class="v38Foot">
      <span>${sample} решений · серия ${Number(state.streak||0)} дней</span>
      <button id="v38Data">ДАННЫЕ И ПРОФИЛЬ →</button>
    </section>
  </div>`;

  const goSwipe=()=>{try{swSession=[]}catch(e){};show('swipe')};
  const trainLeak=()=>{
    const target=blindZones[0]?.concept||leak?.concept;
    if(target && typeof startConceptSwipe==='function') startConceptSwipe(target);
    else goSwipe();
  };
  document.getElementById('v38TrainLeak')?.addEventListener('click',trainLeak);
  root.querySelectorAll('[data-v38go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.v38go)));
  document.getElementById('v38Data')?.addEventListener('click',()=>{
    if(typeof openModal==='function')openModal(`<span class="v38Eyebrow">ПРОФИЛЬ И ДАННЫЕ</span><h2>${name}</h2><p>${sample} решений хранятся в локальном профиле этого устройства.</p><button class="v38Primary" id="v38ExportNow">ЭКСПОРТ ДАННЫХ</button>`);
    setTimeout(()=>document.getElementById('v38ExportNow')?.addEventListener('click',()=>window.exportPokerSwipe32?.()),0);
  });
  document.getElementById('v38How')?.addEventListener('click',()=>{
    document.getElementById('v38Method')?.classList.toggle('hidden');
  });
};

})();
