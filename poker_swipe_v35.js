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
  const ri=typeof rankIndex28==='function'?rankIndex28():0;
  const ranks=(window.RANKS28||[]);
  const r=ranks[ri]||{name:(typeof v31Rank==='function'?v31Rank(S.skill):'ТВОЙ УРОВЕНЬ')};
  const next=ranks[ri+1];
  const np=next&&typeof rankPct30==='function'?rankPct30(ri+1,m):100;
  const leak=typeof topLeak==='function'?topLeak():null;
  const form=typeof formScore==='function'?formScore():50;
  const focus=v35Focus(leak);
  const leakCount=leak?Number(leak.r||0):0;
  const leakSample=leak?Number(leak.n||0):0;
  const leakConfidence=leakSample>=30?'устойчивый':leakSample>=16?'вероятный':leakSample>=6?'подозрение':'мало данных';
  const sample=Number(m?.sample||0);
  const rankName=v35Safe(r?.name,'Уровень');
  const nextName=v35Safe(next?.name,'максимальный уровень');

  h.innerHTML=`<div class="v35Home">
    <div class="v35BrandRow">
      <div class="v35Wordmark">POKER <span>SWIPE</span></div>
      <div class="v35Status"><i></i> анализ включён</div>
    </div>

    <section class="v35Today">
      <div class="v35TodayLabel">${focus.kicker}</div>
      <h1>${focus.title}</h1>
      <p>${focus.body}</p>
      <div class="v35TodayMeta">
        <span><b>${sample}</b> решений в базе</span>
        <span><b>${rankName}</b></span>
        ${leak?`<span><b>${leakCount}/${leakSample}</b> ошибок в выборке</span>`:''}
      </div>
      <button class="v35Start" id="v35Start"><span>${focus.cta}</span><strong>→</strong></button>
    </section>

    <div class="v35Snapshot">
      <div class="v35Stat"><span>Навык</span><b>${S.skill}</b></div>
      <div class="v35Stat"><span>Форма</span><b>${form}</b></div>
      <div class="v35Stat"><span>Выборка</span><b>${sample}</b></div>
    </div>

    <section class="v35Section">
      <div class="v35SectionHead"><h2>Твоя игра</h2><span>не диагноз по одной раздаче</span></div>
      <div class="v35Leak">
        <div>
          <div class="v35LeakKicker">${leak?'САМАЯ ПОДОЗРИТЕЛЬНАЯ ЗОНА':'ПОКА БЕЗ ЖЁСТКОГО ВЫВОДА'}</div>
          <h3>${v35LeakName(leak)}</h3>
          <p>${leak?`${leakCount} ошибок на ${leakSample} похожих решениях. Статус: ${leakConfidence}.`:'PokerSwipe пока набирает выборку и не будет придумывать красивый лик из нескольких рук.'}</p>
        </div>
        <div class="v35LeakBadge"><div><b>${leak?leakCount:'?'}</b><span>${leak?'ошибок':'данных'}</span></div></div>
      </div>
    </section>

    <section class="v35Section">
      <div class="v35SectionHead"><h2>Своя раздача</h2><span>самый полезный материал — твоя реальная игра</span></div>
      <button class="v35Hand" id="v35Hands">
        <div class="v35HandIcon">A♠</div>
        <div><b>Добавить и разобрать руку</b><span>Сохраним линию по улицам и найдём, где решение начало терять качество.</span></div>
        <strong>→</strong>
      </button>
    </section>

    <section class="v35Section">
      <div class="v35SectionHead"><h2>Другие тренировки</h2><span>когда нужна конкретная механика</span></div>
      <div class="v35Tools">
        <button class="v35Tool" id="v35Sizing"><span>Сайзинг</span><b>Сколько ставим?</b><i>→</i></button>
        <button class="v35Tool" id="v35Review"><span>Разбор линии</span><b>Где сломалось?</b><i>→</i></button>
        <button class="v35Tool" id="v35Xray"><span>Диапазон</span><b>Рентген</b><i>→</i></button>
        <button class="v35Tool" id="v35Daily"><span>Один спот</span><b>Раздача дня</b><i>→</i></button>
      </div>
    </section>

    <section class="v35Section v35Career">
      <div class="v35CareerTop"><div><span>ТВОЙ УРОВЕНЬ</span><b>${rankName}${next?` → ${nextName}`:''}</b></div><strong>${Math.round(np)}%</strong></div>
      <div class="v35CareerTrack"><i style="width:${Math.max(0,Math.min(100,np))}%"></i></div>
    </section>
  </div>`;

  const goSwipe=()=>{try{swSession=[]}catch(e){};show('swipe')};
  document.getElementById('v35Start').onclick=()=>{
    if(leak && typeof renderHeal==='function') show('heal'); else goSwipe();
  };
  document.getElementById('v35Hands').onclick=()=>show('myhands');
  document.getElementById('v35Sizing').onclick=()=>show('sizing');
  document.getElementById('v35Review').onclick=()=>show('review');
  document.getElementById('v35Xray').onclick=()=>show('xray');
  document.getElementById('v35Daily').onclick=()=>show('daily');
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

document.documentElement.dataset.pokerSwipeVersion='35.0';
document.querySelector('meta[name="app-version"]')?.setAttribute('content','35.0');
const build=document.querySelector('.build');if(build)build.textContent='V35 UX RESET';

if(!document.getElementById('mainApp')?.classList.contains('hidden') && document.getElementById('home')?.classList.contains('active')){
  try{renderHome();ui()}catch(e){console.error('V35 home patch',e)}
}
})();
