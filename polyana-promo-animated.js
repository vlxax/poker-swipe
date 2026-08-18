(() => {
'use strict';

/*
  PokerSwipe · Polyana animated Heads Up promo
  Adapted from the user's Figma Make animation.
  It ONLY decorates the existing .pspAd image in Polyana.
  No tournament/filter/navigation logic is changed.
*/

const BUILD = 'polyana-headsup-promo-figma-v1';
const IMG_MATCH = 'headsup_promo_frikovaya_dama';

const EMBERS = Array.from({length:38}, (_,i) => ({
  left: 52 + Math.sin(i * 1.9) * 26,
  bottom: 12 + (i % 5) * 6,
  delay: (i * 0.31) % 4.5,
  duration: 2.2 + (i % 6) * 0.4,
  size: 1.5 + (i % 4),
  ex: ((i % 9) - 4) * 12,
  color: i % 4 === 0 ? '#fff7a0' : i % 4 === 1 ? '#ffa020' : i % 4 === 2 ? '#ff6600' : '#b4ff00'
}));

const SPARKS = Array.from({length:12}, (_,i) => ({
  left: 50 + Math.cos(i * 1.5) * 24,
  top: 18 + Math.sin(i * 2.3) * 28,
  delay: (i * 0.55) % 5,
  duration: 1.3 + (i % 4) * 0.35,
  size: 5 + (i % 5) * 2.5
}));

function el(tag, cls){
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  return n;
}

function addEffects(stage){
  stage.appendChild(el('div','psPromoFxShimmer'));
  stage.appendChild(el('div','psPromoFxBorder'));
  stage.appendChild(el('div','psPromoFxScan'));

  const embers=el('div','psPromoFxEmbers');
  EMBERS.forEach(e=>{
    const p=el('i','psPromoFxEmber');
    p.style.left=e.left+'%';
    p.style.bottom=e.bottom+'%';
    p.style.width=e.size+'px';
    p.style.height=e.size+'px';
    p.style.background=e.color;
    p.style.boxShadow=`0 0 ${e.size*2.5}px ${e.color}`;
    p.style.setProperty('--ps-ex',e.ex+'px');
    p.style.animationDuration=e.duration+'s';
    p.style.animationDelay=e.delay+'s';
    embers.appendChild(p);
  });
  stage.appendChild(embers);

  const sparks=el('div','psPromoFxSparks');
  SPARKS.forEach(s=>{
    const p=el('i','psPromoFxSpark');
    p.style.left=s.left+'%';
    p.style.top=s.top+'%';
    p.style.width=s.size+'px';
    p.style.height=s.size+'px';
    p.style.animationDuration=s.duration+'s';
    p.style.animationDelay=s.delay+'s';
    p.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L13.2 10.8 L22 12 L13.2 13.2 L12 22 L10.8 13.2 L2 12 L10.8 10.8 Z" fill="#ffe566"/></svg>';
    sparks.appendChild(p);
  });
  stage.appendChild(sparks);

  [
    ['tl','rgba(180,255,0,.15)'],
    ['tr','rgba(255,130,0,.12)'],
    ['bl','rgba(180,255,0,.08)'],
    ['br','rgba(255,130,0,.08)']
  ].forEach(([pos,bg],i)=>{
    const g=el('div',`psPromoFxGlow ${pos}`);
    g.style.background=bg;
    g.style.animationDuration=(2.5+i*.4)+'s';
    g.style.animationDelay=(i*.5)+'s';
    stage.appendChild(g);
  });
}

function decorate(){
  const candidates=[...document.querySelectorAll('.pspAd img')];
  const img=candidates.find(x =>
    String(x.getAttribute('src')||'').includes(IMG_MATCH) ||
    /HEADS\s*UP|ФРИКОВАЯ\s*ДАМА/i.test(String(x.getAttribute('alt')||''))
  );
  if(!img)return false;

  const ad=img.closest('.pspAd');
  if(!ad)return false;
  if(ad.dataset.psPromoBuild===BUILD)return true;

  let stage=img.closest('.psPromoFxStage');
  if(!stage){
    stage=el('div','psPromoFxStage');
    img.parentNode.insertBefore(stage,img);
    stage.appendChild(img);
  }

  stage.querySelectorAll('.psPromoFxShimmer,.psPromoFxBorder,.psPromoFxScan,.psPromoFxEmbers,.psPromoFxSparks,.psPromoFxGlow').forEach(n=>n.remove());
  addEffects(stage);

  img.classList.add('psPromoFxImage');
  ad.classList.add('pspAdAnimated');
  ad.dataset.psPromoBuild=BUILD;
  stage.dataset.psPromoBuild=BUILD;
  return true;
}

let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    decorate();
  });
}

const observer=new MutationObserver(schedule);

function start(){
  decorate();
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('pageshow',schedule);
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-nav],[data-psp-tab],[data-psp-filters]')) setTimeout(schedule,0);
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

window.PokerSwipePolyanaPromo={refresh:decorate,build:BUILD};
})();