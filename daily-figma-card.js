(() => {
'use strict';

const BUILD = 'pokerswipe-visual-assets-v4';

const ASSETS = {
  bg: 'assets/app-background/pokerswipe-global-bg-v4.jpg',
  tournaments: 'assets/my-tournaments/winner-demon-v3.png',
  hands: 'assets/my-hands/lounge-demon-v3.png',
  chips: 'assets/bet-sizing/neon-chips-v3.png',
  dailyWebp: 'assets/daily-hand/demon-cards-v2.webp',
  dailyPng: 'assets/daily-hand/demon-cards-v2.png'
};

function makeImg(cls, src, alt=''){
  const img=document.createElement('img');
  img.className=cls;
  img.src=src;
  img.alt=alt;
  img.draggable=false;
  img.setAttribute('aria-hidden', alt ? 'false' : 'true');
  return img;
}

function mountGlobalBackground(){
  document.documentElement.classList.add('psVisualV3');
  document.body.classList.add('psVisualV3Body');

  let probe=document.getElementById('psVisualV3BgPreload');
  if(!probe){
    probe=makeImg('psVisualV3BgPreload',ASSETS.bg);
    probe.id='psVisualV3BgPreload';
    probe.style.display='none';
    document.body.appendChild(probe);
  }
}

/* Primary lime CTA — uses canonical PokerSwipe bubble classes (not unstyled dailyFigmaCta). */
function addDailyCta(card){
  const copy=card?.querySelector('.v36DailyCopy');
  if(!copy) return;
  let btn=copy.querySelector('.dailyFigmaCta');
  if(!btn){
    btn=document.createElement('button');
    btn.type='button';
    copy.appendChild(btn);
  }
  btn.className='primary pgCta pgBubblePress dailyFigmaCta';
  btn.setAttribute('aria-label','Перейти к раздаче дня');
  btn.textContent='ПЕРЕЙТИ К РАЗДАЧЕ ДНЯ';
  if(!btn.dataset.wired){
    btn.dataset.wired='1';
    btn.addEventListener('click',(e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(typeof window.show==='function') window.show('daily');
    });
  }
}

function mountDailyDemon(){
  const card=document.querySelector('#home #v36Daily, #home .v36Daily');
  if(!card)return;
  card.classList.add('v36DailyFigma');
  card.dataset.dailyFigmaBuild=BUILD;
  addDailyCta(card);
  const art=card.querySelector('.v36Cards');
  if(!art)return;
  art.classList.remove('dailyChipVisual');
  art.classList.add('dailyDemonVisual');
  art.querySelectorAll('i,.dailyPokerChip,.dailyDemonAsset').forEach(el=>el.remove());
  const demon=makeImg('dailyDemonAsset',ASSETS.dailyWebp);
  demon.onerror=()=>{
    if(!demon.dataset.fallback){
      demon.dataset.fallback='1';
      demon.src=ASSETS.dailyPng;
    }
  };
  art.appendChild(demon);
}

function mountSizingChips(){
  const candidates=[
    document.querySelector('#home #v36Sizing'),
    document.querySelector('#home .v36Sizing'),
    document.querySelector('#home .sizingTile')
  ].filter(Boolean);
  const sizing=candidates[0];
  if(!sizing)return;

  let holder=sizing.querySelector('.v36Chips,.chipsPreview');
  if(!holder){
    holder=document.createElement('div');
    holder.className='v36Chips psSizingAssetHolder';
    sizing.appendChild(holder);
  }
  holder.classList.add('psSizingAssetHolder');
  holder.querySelectorAll('i,.v36ChipAsset,.psSizingChipsAsset').forEach(el=>el.remove());
  holder.appendChild(makeImg('psSizingChipsAsset',ASSETS.chips));
}

function mountMyTournaments(){
  const roots=[
    document.querySelector('#ps72TournamentScreen'),
    document.querySelector('#tournamentsArea'),
    document.querySelector('#tournaments')
  ].filter(Boolean);

  for(const root of roots){
    let hero=root.querySelector('.ps72hero,.t23Hero,.v48Hero,.t23,.panel');
    if(!hero)hero=root;
    hero.classList.add('psTournamentHeroV3');
    if(!hero.querySelector(':scope > .psTournamentDemonV3')){
      hero.appendChild(makeImg('psTournamentDemonV3',ASSETS.tournaments));
    }
    break;
  }
}

function mountMyHands(){
  const root=document.querySelector('#myhands,#myArea,#my');
  if(!root)return;

  let hero=root.querySelector('.my18,.myHero,.panel,.myHandsHero');
  if(!hero)hero=root;
  hero.classList.add('psMyHandsHeroV3');

  if(!hero.querySelector(':scope > .psMyHandsDemonV3')){
    hero.appendChild(makeImg('psMyHandsDemonV3',ASSETS.hands));
  }
}

function enhance(){
  mountGlobalBackground();
  mountDailyDemon();
  mountSizingChips();
  mountMyTournaments();
  mountMyHands();
}

let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    enhance();
  });
}

function start(){
  enhance();

  new MutationObserver(schedule).observe(document.body,{
    subtree:true,
    childList:true
  });

  document.addEventListener('click',()=>{
    setTimeout(schedule,0);
    setTimeout(schedule,120);
  },true);

  window.addEventListener('pageshow',schedule);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else start();

window.PokerSwipeVisualAssetsV4={build:BUILD,refresh:enhance,assets:ASSETS};
})();
