(() => {
'use strict';

/*
  PokerSwipe · Раздача дня · Figma Make card port
  Safe visual patch over the existing #v36Daily card.
  Cards on the right are replaced by the animated Poker DNA chip.
*/

const BUILD='daily-figma-card-v2-chip';

function enhance(){
  const card=document.querySelector('#home #v36Daily, #home .v36Daily');
  if(!card)return false;

  card.classList.add('v36DailyFigma');
  card.dataset.dailyFigmaBuild=BUILD;

  const copy=card.querySelector('.v36DailyCopy');
  if(copy && !copy.querySelector('.dailyFigmaCta')){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='dailyFigmaCta';
    btn.setAttribute('aria-label','Разобрать раздачу дня');
    btn.innerHTML='<span>Разобрать</span><b>→</b>';
    copy.appendChild(btn);
  }

  const art=card.querySelector('.v36Cards');
  if(art){
    art.classList.add('dailyChipVisual');
    art.querySelectorAll('i').forEach(el=>el.remove());

    if(!art.querySelector('.dailyPokerChip')){
      const chip=document.createElement('img');
      chip.className='dailyPokerChip';
      chip.src='assets/daily-chip/daily-chip-anim.webp';
      chip.alt='';
      chip.setAttribute('aria-hidden','true');
      chip.draggable=false;
      art.appendChild(chip);
    }
  }

  return true;
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
    new MutationObserver(schedule).observe(home,{subtree:true,childList:true});
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-nav="home"]'))setTimeout(schedule,0);
  },true);

  window.addEventListener('pageshow',schedule);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}

window.PokerSwipeDailyFigma={build:BUILD,refresh:enhance};
})();
