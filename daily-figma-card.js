(() => {
'use strict';

/*
  PokerSwipe · asset swap patch
  1) Раздача дня: old chip/cards -> animated Demon
  2) Сколько ставим: old CSS pink chips -> 3 green PokerSwipe chip assets

  Assets are already expected in the repository:
    assets/daily-hand/dino-chaos.webp
    assets/daily-hand/dino-poster.png
    assets/bet-sizing/poker-chip-green.webp
    assets/bet-sizing/poker-chip-green.png
*/

const BUILD='daily-figma-card-v3-demon-green-chips';

function addDailyCta(card){
  const copy=card?.querySelector('.v36DailyCopy');
  if(copy && !copy.querySelector('.dailyFigmaCta')){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='dailyFigmaCta';
    btn.setAttribute('aria-label','Разобрать раздачу дня');
    btn.innerHTML='<span>Разобрать</span><b>→</b>';
    copy.appendChild(btn);
  }
}

function mountDemon(card){
  if(!card)return;

  const art=card.querySelector('.v36Cards');
  if(!art)return;

  art.classList.remove('dailyChipVisual');
  art.classList.add('dailyDemonVisual');

  /* Remove the old Q/J/? cards and any previous daily chip. */
  art.querySelectorAll('i,.dailyPokerChip,.dailyDemonAsset').forEach(el=>el.remove());

  const demon=document.createElement('img');
  demon.className='dailyDemonAsset';
  demon.src='assets/daily-hand/dino-chaos.webp';
  demon.alt='';
  demon.setAttribute('aria-hidden','true');
  demon.draggable=false;

  /* Static poster if animated WebP fails for any reason. */
  demon.onerror=()=>{
    if(!demon.dataset.fallback){
      demon.dataset.fallback='1';
      demon.src='assets/daily-hand/dino-poster.png';
    }
  };

  art.appendChild(demon);
}

function mountSizingChips(){
  const sizing=document.querySelector('#home #v36Sizing, #home .v36Sizing');
  if(!sizing)return;

  const holder=sizing.querySelector('.v36Chips');
  if(!holder)return;

  holder.classList.add('v36ChipsAsset');

  /* Remove old CSS-generated pink/lime discs. */
  holder.querySelectorAll('i').forEach(el=>el.remove());

  if(holder.querySelector('.v36ChipAsset'))return;

  for(let n=0;n<3;n++){
    const chip=document.createElement('img');
    chip.className=`v36ChipAsset v36ChipAsset${n+1}`;
    chip.src='assets/bet-sizing/poker-chip-green.webp';
    chip.alt='';
    chip.setAttribute('aria-hidden','true');
    chip.draggable=false;
    chip.onerror=()=>{
      if(!chip.dataset.fallback){
        chip.dataset.fallback='1';
        chip.src='assets/bet-sizing/poker-chip-green.png';
      }
    };
    holder.appendChild(chip);
  }
}

function enhance(){
  const card=document.querySelector('#home #v36Daily, #home .v36Daily');

  if(card){
    card.classList.add('v36DailyFigma');
    card.dataset.dailyFigmaBuild=BUILD;
    addDailyCta(card);
    mountDemon(card);
  }

  mountSizingChips();
  return !!card;
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

  const home=document.getElementById('home');
  if(home){
    new MutationObserver(schedule).observe(home,{
      subtree:true,
      childList:true
    });
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-nav="home"]')){
      setTimeout(schedule,0);
    }
  },true);

  window.addEventListener('pageshow',schedule);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}

window.PokerSwipeDailyFigma={
  build:BUILD,
  refresh:enhance
};
})();
