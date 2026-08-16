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
    <header class="v36Top">
      <div><div class="v36Wordmark">POKER <span>SWIPE</span></div><h1>Привет, ${userName}</h1><div class="v36Creator">by <b>ФРИКОВАЯ ДАМА</b> ♠</div></div>
      <div class="v36SkillChip">SKILL <b>${S.skill}</b></div>
    </header>

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
      <button class="v36Tile" id="v36Xray"><span>ДИАПАЗОН</span><h3>◎ РЕНТГЕН</h3><p>Сужай range по улицам и учитывай блокеры.</p><div class="v36Matrix">${'<i></i>'.repeat(28)}</div><strong>→</strong></button>
    </div>

    <button class="v36Quick" id="v36Quick"><div><span>⚡ 5 МИНУТ</span><h3>БЫСТРАЯ ТРЕНИРОВКА</h3><p>Смешанная сессия без выбора режима.</p></div><b>05:00</b></button>
    <button class="v36Hand" id="v36Hands"><div class="v36HandCard">A♠</div><div><span>СВОЯ РАЗДАЧА</span><b>Добавить руку</b><small>Найдём первую ошибку в линии.</small></div><strong>→</strong></button>
  </div>`;

  const goSwipe=()=>{try{swSession=[]}catch(e){};show('swipe')};
  document.getElementById('v36Daily').onclick=()=>show('daily');
  document.getElementById('v36Sizing').onclick=()=>show('sizing');
  document.getElementById('v36Review').onclick=()=>show('review');
  document.getElementById('v36Swipe').onclick=goSwipe;
  document.getElementById('v36Xray').onclick=()=>show('xray');
  document.getElementById('v36Quick').onclick=goSwipe;
  document.getElementById('v36Hands').onclick=()=>show('myhands');
  document.getElementById('v36Personal').onclick=()=>{if(leak&&typeof renderHeal==='function')show('heal');else goSwipe()};
  document.getElementById('v36Player').onclick=()=>show('profile');
  document.getElementById('v36Form').onclick=goSwipe;
  document.getElementById('v36Sample').onclick=()=>show('profile');
  document.body.classList.add('home-context');
};
function v35Chrome(){
  const labels={home:'ГЛАВНАЯ',myhands:'РАЗДАЧИ',tournaments:'ТУРНИРЫ',profile:'ТЫ'};
  document.querySelectorAll('.nav button').forEach(b=>{
    const key=b.dataset.nav;
    if(!labels[key])return;
    const nodes=[...b.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE);
    if(nodes.length)nodes[nodes.length-1].textContent=' '+labels[key];
  });
  const level=document.getElementById('levelChip');
  if(level)level.textContent=`НАВЫК ${S.skill}`;
}

const oldUi=window.ui;
window.ui=ui=function(){if(oldUi)oldUi.apply(this,arguments);v35Chrome()};
v35Chrome();

document.documentElement.dataset.pokerSwipeVersion='36.0';
document.querySelector('meta[name="app-version"]')?.setAttribute('content','36.0');
const build=document.querySelector('.build');if(build)build.textContent='V36 HYBRID HOME';

if(!document.getElementById('mainApp')?.classList.contains('hidden') && document.getElementById('home')?.classList.contains('active')){
  try{renderHome();ui()}catch(e){console.error('V35 home patch',e)}
}
})();
