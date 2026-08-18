/* PokerSwipe V34 — clearer explanations and per-street hand review UI. */
(function(){
  'use strict';
  if(!window.PokerBrainV34)return;
  const q=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pct=v=>Math.round((Number(v)||0)*(Number(v)<=1?100:1));

  const brainPanelBase=window.brainPanel;
  window.brainPanel=function brainPanelV34(result){
    if(!result)return brainPanelBase?.(result)||'';
    const sections=result.analysisDetails?.sections;
    if(!sections)return brainPanelBase?.(result)||'';
    const rows=(result.topActions||[]).map(item=>`<div class="brainAction"><span>${esc(item.action)}</span><i><span style="width:${pct(item.freq)}%"></span></i><b>${pct(item.freq)}%</b></div>`).join('');
    const context=result.analysisDetails?.context;
    const blocks=[
      ['1 · ЧТО БЫЛО ДО РЕШЕНИЯ',sections.before],
      ['2 · ЧТО ИЗМЕНИЛА ЭТА УЛИЦА',sections.change],
      ['3 · ЧТО У НАС ЗА РУКА',sections.hand],
      ['4 · ЧТО ПРОИСХОДИТ С ДИАПАЗОНАМИ',sections.range],
      ['5 · ПОЧЕМУ ЭТО ДЕЙСТВИЕ',sections.action],
      ['6 · ТУРНИРНЫЙ КОНТЕКСТ',sections.tournament]
    ].filter(x=>x[1]).map(([h,t])=>`<div class="v34ExplainStep"><span>${esc(h)}</span><p>${esc(t)}</p></div>`).join('');
    return `<div class="brainPanel v34BrainPanel"><div class="brainHead"><b>◉ ПОКЕРНЫЙ РАЗБОР</b><span class="brainSource">${esc(window.brainSourceLabel?.(result.source)||result.source||'REFERENCE')} · ${result.confidence}%</span></div>${result.score!=null?`<div class="brainScore">${result.score}</div>`:''}<div class="brainPolicy">${rows}</div>${context?`<div class="v33Completeness"><div><span>ПОЛНОТА КОНТЕКСТА</span><b>${context.score}%</b></div><i><span style="width:${context.score}%"></span></i></div>`:''}<div class="v34Explain">${blocks}</div><div class="v34Missing"><b>ЧЕГО НЕ ХВАТАЕТ ДЛЯ БОЛЕЕ ТОЧНОГО ВЫВОДА</b><p>${esc(sections.missing)}</p></div>${result.sizeBest!=null?`<p class="mut small">Учебный ориентир размера: около ${result.sizeBest}% банка.</p>`:''}<p class="v33Method">Это обучающая reference-модель. Она обязана показывать допущения, а не изображать точный solver там, где данных нет.</p></div>`;
  };

  // Enrich the hand-builder report after V33 has rendered it.
  const reportBase=window.hr22Report;
  if(typeof reportBase==='function')window.hr22Report=function hr22ReportV34(){
    const value=reportBase.apply(this,arguments);
    setTimeout(()=>{
      const root=q('#myArea .hr22'); if(!root||root.querySelector('.v34StreetReview'))return;
      const state=window.HR22; if(!state)return;
      const keys=['pre','flop','turn','river'].filter(k=>state.streets?.[k]?.reached!==false && (k==='pre'||state.streets?.[k]?.board?.filter(Boolean).length));
      const map={pre:'PREFLOP',flop:'FLOP',turn:'TURN',river:'RIVER'};
      const title={pre:'ПРЕФЛОП',flop:'ФЛОП',turn:'ТЁРН',river:'РИВЕР'};
      const cardsFor=k=>k==='pre'?[]:state.streets[k].board.filter(Boolean);
      const reviews=keys.map(k=>{
        const s=state.streets[k], street=map[k], action=s.heroAction||'CHECK';
        const spot={spotId:'USER_HAND_'+street,street,pos:`${state.heroPos||'HERO'} vs ${state.villPos||'VILLAIN'}`,hero:state.hero||[],board:cardsFor(k),stack:state.stack,pot:s.pot,currentLine:s.historyNote||'',ctx:s.historyNote||'',preflopLine:state.streets.pre?.historyNote||'',format:state.format||'MTT'};
        const r=window.PokerBrain.gradeDecision(spot,action,s.heroSize||null), sec=r.analysisDetails?.sections||{};
        return `<div class="v34Street"><div class="v34StreetHead"><b>${title[k]}</b><span>${esc(action)} · ${r.score??'—'}/100</span></div><p><strong>Изменение:</strong> ${esc(sec.change||'')}</p><p><strong>Рука:</strong> ${esc(sec.hand||'')}</p><p><strong>Почему:</strong> ${esc(sec.action||'')}</p></div>`;
      }).join('');
      root.insertAdjacentHTML('beforeend',`<section class="v34StreetReview"><span class="ey">РАЗДАЧА ПО УЛИЦАМ</span><h2>НЕ «ПРАВИЛЬНО / НЕПРАВИЛЬНО», А ПОЧЕМУ</h2>${reviews}</section>`);
    },0);
    return value;
  };

  // Visible build marker.
  document.documentElement.dataset.pokerSwipeVersion='34.0';
  const build=q('.build'); if(build)build.textContent='V34 УМНЫЙ РАЗБОР';
})();

/* PokerSwipe — safe loader for the Figma 3D bottom navigation.
   Kept outside the V34 brain guard so it always runs. */
(() => {
  'use strict';
  const CSS_ID='poker3d-nav-css';
  const SCRIPT_ID='poker3d-nav-script';

  if(!document.getElementById(CSS_ID)){
    const link=document.createElement('link');
    link.id=CSS_ID;
    link.rel='stylesheet';
    link.href='poker3d-nav.css';
    document.head.appendChild(link);
  }

  function loadPoker3DNav(){
    if(window.PokerSwipe3DNav){
      window.PokerSwipe3DNav.refresh?.();
      return;
    }
    if(document.getElementById(SCRIPT_ID))return;
    const script=document.createElement('script');
    script.id=SCRIPT_ID;
    script.src='poker3d-nav.js';
    script.defer=true;
    document.body.appendChild(script);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',loadPoker3DNav,{once:true});
  }else{
    loadPoker3DNav();
  }
})();


/* PokerSwipe — safe loader for the animated Polyana Heads Up promo.
   Visual only: Polyana data/filters/solver are untouched. */
(() => {
  'use strict';
  const CSS_ID='polyana-promo-animated-css';
  const SCRIPT_ID='polyana-promo-animated-script';

  if(!document.getElementById(CSS_ID)){
    const link=document.createElement('link');
    link.id=CSS_ID;
    link.rel='stylesheet';
    link.href='polyana-promo-animated.css';
    document.head.appendChild(link);
  }

  function loadPolyanaPromo(){
    if(window.PokerSwipePolyanaPromo){
      window.PokerSwipePolyanaPromo.refresh?.();
      return;
    }
    if(document.getElementById(SCRIPT_ID))return;
    const script=document.createElement('script');
    script.id=SCRIPT_ID;
    script.src='polyana-promo-animated.js';
    script.defer=true;
    document.body.appendChild(script);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',loadPolyanaPromo,{once:true});
  }else{
    loadPolyanaPromo();
  }
})();


/* PokerSwipe — Polyana Filters V3 loader.
   Separate file + cache-busted URL so Telegram/iOS do not keep the old filter patch. */
(() => {
  'use strict';
  const CSS_ID='polyana-filters-v3-css';
  const JS_ID='polyana-filters-v3-js';
  const V='20260818-1';
  if(!document.getElementById(CSS_ID)){
    const l=document.createElement('link');
    l.id=CSS_ID;l.rel='stylesheet';l.href='polyana-filters-v3.css?v='+V;
    document.head.appendChild(l);
  }
  function load(){
    if(window.PokerSwipePolyanaFiltersV3){window.PokerSwipePolyanaFiltersV3.refresh?.();return}
    if(document.getElementById(JS_ID))return;
    const s=document.createElement('script');
    s.id=JS_ID;s.src='polyana-filters-v3.js?v='+V;s.defer=true;
    document.body.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

/* PokerSwipe — Daily Figma Make card loader.
   Safe adapter: no React/Vite project files are added to the repository. */
(() => {
  'use strict';
  const CSS_ID='daily-figma-card-css';
  const JS_ID='daily-figma-card-js';
  const V='20260818-1';

  if(!document.getElementById(CSS_ID)){
    const l=document.createElement('link');
    l.id=CSS_ID;
    l.rel='stylesheet';
    l.href='daily-figma-card.css?v='+V;
    document.head.appendChild(l);
  }

  function load(){
    if(window.PokerSwipeDailyFigma){
      window.PokerSwipeDailyFigma.refresh?.();
      return;
    }
    if(document.getElementById(JS_ID))return;
    const s=document.createElement('script');
    s.id=JS_ID;
    s.src='daily-figma-card.js?v='+V;
    s.defer=true;
    document.body.appendChild(s);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',load,{once:true});
  }else{
    load();
  }
})();
