/* PokerSwipe — My Tournaments visual-only enhancer.
   Does not touch tournament data, handlers, persistence, routing, or bottom navigation. */
(function(){
  'use strict';

  function markTournamentScreen(){
    const candidates = [
      document.getElementById('tournaments'),
      document.getElementById('screen-tournaments'),
      document.querySelector('[data-screen="tournaments"]'),
      document.querySelector('.tournamentsScreen'),
      document.querySelector('.t23Screen'),
      document.getElementById('ps72TournamentScreen'),
      document.getElementById('ps72Modal')
    ].filter(Boolean);

    candidates.forEach(el => el.classList.add('ps-tournaments-premium'));
  }

  function protectBottomNav(){
    const nav = document.querySelector('.nav, .bottomNav');
    if(nav) nav.dataset.psPreserveNav = 'true';
  }

  function enhance(){
    markTournamentScreen();
    protectBottomNav();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', enhance, {once:true});
  } else {
    enhance();
  }

  // Existing PokerSwipe re-renders screens dynamically.
  // Re-apply only harmless visual marker after DOM updates.
  if(typeof MutationObserver !== 'undefined'){
    const observer = new MutationObserver(() => {
      requestAnimationFrame(enhance);
    });
    observer.observe(document.documentElement,{subtree:true,childList:true});
  }
})();
