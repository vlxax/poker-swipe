/* PokerSwipe V35 — product/UX home reset */
(function(){
'use strict';

function v35Safe(v,fallback=''){return v==null?fallback:String(v)}
function v35LeakName(leak){
  if(!leak)return 'Нужно ещё немного данных';
  try{return typeof conceptLabel==='function'?conceptLabel(leak.concept):v35Safe(leak.concept,'Найден повторяющийся паттерн')}catch(e){return v35Safe(leak.concept,'Найден повторяющийся паттерн')}
}
function v35Focus(leak){
  if(leak){
    const label=v35LeakName(leak);
    return {
      kicker:'ТВОЯ ТРЕНИРОВКА СЕГОДНЯ',
      title:`Проверяем: ${label}`,
      body:`Похожая ошибка уже повторялась. Вместо случайного набора задач PokerSwipe даст короткую проверку именно этой зоны.`,
      cta:'НАЧАТЬ ПРОВЕРКУ',
      kind:'leak'
    };
  }
  return {
    kicker:'ТВОЯ ТРЕНИРОВКА СЕГОДНЯ',
    title:'Собираем твой Poker DNA',
    body:'Сейчас важнее не придумать тебе «лик», а набрать честную выборку. 10 контекстных спотов дадут приложению новые данные о твоих решениях.',
    cta:'ПРОЙТИ 10 СПОТОВ',
    kind:'sample'
  };
}

window.renderHome=function(){
  const h=document.getElementById('home'); if(!h)return;
  const m=typeof m30==='function'?m30():{sample:(window.S?.events||[]).length};
  const leak=typeof topLeak==='function'?topLeak():null;
  const form=typeof formScore==='function'?formScore():50;
  const sample=Number(m?.sample||0);
  const leakName=v35LeakName(leak);
  const leakCount=leak?Number(leak.r||0):0;
  const leakSample=leak?Number(leak.n||0):0;
  const userName=v35Safe(window.S?.name||window.S?.nick||'VLXAX','VLXAX').toUpperCase();

  h.innerHTML=`<div class="v36Home">
<div class="v36Stats">
      <button class="v36Stat" id="v36Player"><span>SKILL</span><b>${S.skill}</b><small>общий уровень</small></button>
      <button class="v36Stat" id="v36Form"><span>FORM</span><b>${form}</b><small>последние 20</small></button>
      <button class="v36Stat" id="v36Sample"><span>БАЗА</span><b>${sample}</b><small>решений</small></button>
    </div>

    <section class="v36Daily" id="v36Daily">
      <div class="v36DailyCopy"><span class="v36Eyebrow">РАЗДАЧА ДНЯ</span><h2>ОДНА<br><em>РУКА.</em></h2><p>Один сложный спот: решение, размер и логика.</p></div>
      <div class="v36Cards" aria-hidden="true"><i>Q♠</i><i>J♣</i><i>?</i></div><strong class="v36Arrow">→</strong>
    </section>

    <section class="v36Personal">
      <div><span>${leak?'ТВОЯ ИГРА':'POKER DNA'}</span><h3>${leak?`Проверим: ${leakName}`:'Собираем честную выборку'}</h3>
      <p>${leak?`${leakCount} ошибок на ${leakSample} похожих решениях. Короткая тренировка по твоему паттерну.`:'Ещё несколько решений, и PokerSwipe начнёт искать повторяющиеся ошибки.'}</p></div>
      <button id="v36Personal">${leak?'ПРОВЕРИТЬ':'НАЧАТЬ'} →</button>
    </section>

    <div class="v36Grid">
      <button class="v36Tile v36Sizing" id="v36Sizing"><span>САЙЗИНГ</span><h3>СКОЛЬКО<br>СТАВИМ?</h3><p>Выбери размер и пойми, зачем он здесь.</p><div class="v36Chips"><i></i><i></i><i></i></div><strong>→</strong></button>
      <button class="v36Tile" id="v36Review"><span>РАЗБОР ЛИНИИ</span><h3>ГДЕ<br>СЛОМАЛОСЬ?</h3><p>Найди первую реальную ошибку.</p><div class="v36Streets">PRE ●<br>FLOP ●<br>TURN △<br>RIVER ?</div><strong>→</strong></button>
      <button class="v36Tile" id="v36Swipe"><span>10 РУК</span><h3>POKER<br>SWIPE</h3><p>Решение + размер. Быстро, но не тупо.</p><div class="v36SwipeMark">← <i>J♠</i> →</div><strong>→</strong></button>
      <button class="v36Tile" id="v36Xray"><span>РЕНДЖИ</span><h3>◎ РЕНДЖИ</h3><p>Выбери позицию, стек и ситуацию — покажем с чем играть.</p><div class="v36Matrix">${'<i></i>'.repeat(28)}</div><strong>→</strong></button>
    </div>

    <button class="v36Quick" id="v36Quick"><div><span>⚡ 5 МИНУТ</span><h3>БЫСТРАЯ ТРЕНИРОВКА</h3><p>Смешанная сессия без выбора режима.</p></div><b>05:00</b></button>
  </div>`;

  const goSwipe=()=>{try{swSession=[]}catch(e){};show('swipe')};
  document.getElementById('v36Daily').onclick=()=>show('daily');
  document.getElementById('v36Sizing').onclick=()=>show('sizing');
  document.getElementById('v36Review').onclick=()=>show('review');
  document.getElementById('v36Swipe').onclick=goSwipe;
  document.getElementById('v36Xray').onclick=()=>show('xray');
  document.getElementById('v36Quick').onclick=goSwipe;
  document.getElementById('v36Personal').onclick=()=>{if(leak&&typeof renderHeal==='function')show('heal');else goSwipe()};
  document.getElementById('v36Player').onclick=()=>show('profile');
  document.getElementById('v36Form').onclick=goSwipe;
  document.getElementById('v36Sample').onclick=()=>show('profile');
  h.querySelectorAll('.v36Matrix i').forEach((cell,n)=>cell.style.setProperty('--i',n));
  document.body.classList.add('home-context');
};
function v35Chrome(){
  const level=document.getElementById('levelChip');
  if(level)level.textContent=`НАВЫК ${S.skill}`;
}

const oldUi=window.ui;
window.ui=ui=function(){if(oldUi)oldUi.apply(this,arguments);v35Chrome()};
v35Chrome();

document.documentElement.dataset.pokerSwipeVersion='37.0';
document.querySelector('meta[name="app-version"]')?.setAttribute('content','37.0');
const build=document.querySelector('.build');if(build)build.textContent='V37 CLEAN HYBRID';

if(!document.getElementById('mainApp')?.classList.contains('hidden') && document.getElementById('home')?.classList.contains('active')){
  try{renderHome();ui()}catch(e){console.error('V37 home render',e)}
}
})();


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
  return (Array.isArray(window.S?.events)?S.events:[]).filter(e=>e.mode!=='diagnostic'&&!e.excludeFromProfile);
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
  return `<div class="v38SkillRow">
    <div class="v38SkillHead">
      <div><b>${name}</b><small>${v38State(stat.score,stat.n)} · ${stat.n} решений</small></div>
      <div class="v38SkillScore">${stat.score||'—'} ${v38Trend(stat.delta)}</div>
    </div>
    <div class="v38Bar"><i style="width:${v38ScoreBar(stat.score)}%"></i></div>
  </div>`;
}
function v38MainAction(leak){
  if(leak){
    const label=v38ConceptName(leak);
    const n=Number(leak.n||0), r=Number(leak.r||0);
    const blind=(leak.events||[]).filter(e=>e.grade==='r'&&Number(e.confidence)>=80).length;
    return `<section class="v38Focus">
      <span class="v38Eyebrow">ГЛАВНОЕ СЕЙЧАС</span>
      <div class="v38FocusTop"><h2>${v38Esc(label)}</h2><span class="v38Danger">${r}/${n}</span></div>
      <p>${blind?`Здесь есть ${blind} уверенных ошиб${blind===1?'ка':'ки'}: это уже похоже на слепую зону, а не на случайный миссклик.`:`Ошибка повторяется. Нужна короткая контрольная выборка на новых спотах.`}</p>
      <button class="v38Primary" id="v38TrainLeak">ПРОВЕРИТЬ НА НОВЫХ РУКАХ →</button>
    </section>`;
  }
  return `<section class="v38Focus">
    <span class="v38Eyebrow">ГЛАВНОЕ СЕЙЧАС</span>
    <h2>СОБРАТЬ ВЫБОРКУ</h2>
    <p>Пока недостаточно повторяющихся решений, чтобы честно назвать что-то твоим ликом.</p>
    <button class="v38Primary" id="v38BuildSample">СЫГРАТЬ 10 СПОТОВ →</button>
  </section>`;
}

window.renderProfile=function(){
  const root=document.getElementById('profileArea'); if(!root)return;
  const ev=v38Events();
  const sample=ev.length;
  const skill=Number(window.S?.skill||50);
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
  const red=recent.filter(e=>e.grade==='r').length;
  const blind=recent.filter(e=>e.grade==='r'&&Number(e.confidence)>=80).length;
  const strong=recent.filter(e=>e.grade==='g').length;

  root.innerHTML=`<div class="v38You">
    <header class="v38Hero">
      <span class="v38Eyebrow">ТВОЯ ИГРА</span>
      <h1>КАК ТЫ ИГРАЕШЬ<br><em>СЕЙЧАС.</em></h1>
      <p>Не ранг и не медалька. Здесь только то, что PokerSwipe уже может подтвердить твоими решениями.</p>

      <div class="v38HeroGrid">
        <div class="v38MainScore">
          <span>УРОВЕНЬ ИГРЫ</span>
          <b>${skill}</b>
          <small>из 100 · ${sample} решений</small>
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

    ${v38MainAction(leak)}

    <section class="v38Section">
      <div class="v38SectionTitle"><div><span class="v38Eyebrow">РАЗЛОЖЕНИЕ ИГРЫ</span><h2>ГДЕ СИЛЬНО. ГДЕ ТЕЧЁТ.</h2></div><small>↑↓ против предыдущей выборки</small></div>
      ${v38Row('Префлоп',pre)}
      ${v38Row('Постфлоп',post)}
      ${v38Row('Размеры ставок',size)}
      ${v38Row('Дисциплина решений',disc)}
    </section>

    <section class="v38Recent">
      <div class="v38SectionTitle"><div><span class="v38Eyebrow">ПОСЛЕДНИЕ 20</span><h2>ЧТО ПРОИСХОДИТ С ФОРМОЙ</h2></div></div>
      <div class="v38RecentGrid">
        <div><span>СИЛЬНЫЕ</span><b class="good">${strong}</b><small>основная линия</small></div>
        <div><span>ОШИБКИ</span><b class="bad">${red}</b><small>явные потери</small></div>
        <div><span>СЛЕПЫЕ ЗОНЫ</span><b class="${blind?'bad':''}">${blind}</b><small>уверен и ошибся</small></div>
      </div>
      <p class="v38RecentText">${formDelta==null?'Нужно ещё немного дистанции, чтобы сравнить форму с предыдущим отрезком.':formDelta>=4?`Форма выросла на ${formDelta} пунктов. Это уже изменение, а не одна удачная рука.`:formDelta<=-4?`Форма просела на ${Math.abs(formDelta)} пунктов. Стоит посмотреть, где именно появились повторяющиеся ошибки.`:'Форма примерно стабильна. Ищи улучшение не в общей цифре, а в конкретных слабых зонах.'}</p>
    </section>

    <section class="v38Next">
      <span class="v38Eyebrow">ЧТО ДЕЛАТЬ ДАЛЬШЕ</span>
      <h2>${leak?'НЕ ФАРМИТЬ ОЧКИ. ПРОВЕРИТЬ ЛИК.':'НЕ ГАДАТЬ. НАБРАТЬ ДАННЫЕ.'}</h2>
      <p>${leak?`Сейчас полезнее решить новые споты по «${v38Esc(v38ConceptName(leak))}», чем проходить случайную тренировку.`:'Когда появится повторяемый паттерн, этот экран сам поменяет рекомендацию.'}</p>
      <div class="v38Actions">
        <button class="v38Primary" id="v38NextTrain">${leak?'ТРЕНИРОВАТЬ СЛАБУЮ ЗОНУ':'ПОКЕР SWIPE'} →</button>
        <button class="v38Secondary" id="v38OwnHand">ДОБАВИТЬ СВОЮ РАЗДАЧУ</button>
      </div>
    </section>

    <section class="v38Foot">
      <span>${sample} решений в профиле</span>
      <button id="v38Data">ИСТОРИЯ / ДАННЫЕ →</button>
    </section>
  </div>`;

  const goSwipe=()=>{try{swSession=[]}catch(e){};show('swipe')};
  const trainLeak=()=>{
    if(leak && typeof startConceptSwipe==='function') startConceptSwipe(leak.concept);
    else goSwipe();
  };
  document.getElementById('v38TrainLeak')?.addEventListener('click',trainLeak);
  document.getElementById('v38BuildSample')?.addEventListener('click',goSwipe);
  document.getElementById('v38NextTrain')?.addEventListener('click',trainLeak);
  document.getElementById('v38OwnHand')?.addEventListener('click',()=>show('myhands'));
  document.getElementById('v38Data')?.addEventListener('click',()=>{
    const el=document.getElementById('v38Method');
    if(el){el.classList.remove('hidden');el.scrollIntoView({behavior:'smooth',block:'center'});}
  });
  document.getElementById('v38How')?.addEventListener('click',()=>{
    document.getElementById('v38Method')?.classList.toggle('hidden');
  });
};

document.documentElement.dataset.pokerSwipeVersion='38.0';
document.querySelector('meta[name="app-version"]')?.setAttribute('content','38.0');
const v38Build=document.querySelector('.build');if(v38Build)v38Build.textContent='V38 PLAYER DASHBOARD';
})();
