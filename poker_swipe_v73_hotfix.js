/* PokerSwipe V73 hotfix — final DOM guard against legacy renderers. */
(function(){
  'use strict';

  const LABELS = {
    home:'ИГРАТЬ',
    myhands:'МОИ',
    polyana:'ПОЛЯНА',
    profile:'ПРОФИЛЬ',
    mytournaments:'МОИ ТУРНИРЫ'
  };

  function isNavIcon(el){
    if(!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if(el.classList?.contains('ps3d-icon')) return true;
    if(el.tagName === 'I' && !el.classList?.contains('ps73NavLabel') && !el.classList?.contains('ps3d-label')) return true;
    return !!el.querySelector?.('svg');
  }

  function setButtonLabel(btn, label){
    if(!btn) return;

    [...btn.childNodes].forEach((node)=>{
      if(node.nodeType === Node.TEXT_NODE) node.remove();
    });

    [...btn.children].forEach((child)=>{
      if(isNavIcon(child)) return;
      if(child.classList?.contains('ps73NavLabel') || child.classList?.contains('ps3d-label')) return;
      child.remove();
    });

    const staleLabels = btn.querySelectorAll('.ps73NavLabel, .ps3d-label');
    staleLabels.forEach((node, index)=>{ if(index > 0) node.remove(); });

    let span = btn.querySelector(':scope > span.ps73NavLabel, :scope > span.ps3d-label');
    if(!span){
      span = document.createElement('span');
      btn.appendChild(span);
    }
    span.className = 'ps73NavLabel ps3d-label';
    span.textContent = label;
  }

  function ensureFiveNav(){
    const nav=document.querySelector('.nav');
    if(!nav) return;

    let my=nav.querySelector('[data-nav="mytournaments"]');
    if(!my){
      my=document.createElement('button');
      my.type='button';
      my.dataset.nav='mytournaments';
      my.innerHTML='<i class="tourNav23" aria-hidden="true">♜</i>';
    }

    const nodes={
      home:nav.querySelector('[data-nav="home"]'),
      myhands:nav.querySelector('[data-nav="myhands"]'),
      polyana:nav.querySelector('[data-nav="polyana"]') || nav.querySelector('[data-nav="tournaments"]'),
      profile:nav.querySelector('[data-nav="profile"]'),
      mytournaments:my
    };

    if(nodes.polyana && nodes.polyana.dataset.nav==='tournaments') nodes.polyana.dataset.nav='polyana';

    const order=['home','myhands','polyana','profile','mytournaments'];
    order.forEach(key=>{
      const btn=nodes[key];
      if(btn) setButtonLabel(btn,LABELS[key]);
    });
    const desired=order.map(key=>nodes[key]).filter(Boolean);
    const current=[...nav.children].filter(el=>el.matches?.('button[data-nav]'));
    const sameOrder=desired.length===current.length && desired.every((el,i)=>current[i]===el);
    if(!sameOrder) desired.forEach(btn=>nav.appendChild(btn));

    nav.querySelectorAll('[data-nav="tournaments"]').forEach(btn=>{
      if(btn!==nodes.polyana) btn.remove();
    });

    nodes.mytournaments.onclick=null;
  }

  function makeStatsPassive(){
    ['v36Player','v36Form','v36Sample'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el || el.dataset.ps73Passive==='1') return;
      el.dataset.ps73Passive='1';
      el.setAttribute('aria-disabled','true');
      el.setAttribute('tabindex','-1');
      const clone=el.cloneNode(true);
      clone.dataset.ps73Passive='1';
      clone.setAttribute('aria-disabled','true');
      clone.setAttribute('tabindex','-1');
      el.replaceWith(clone);
    });
  }

  function openMyTournaments(e){
    const btn=e.target?.closest?.('.nav [data-nav="mytournaments"]');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if(typeof window.openMyTournamentsV72==='function') return window.openMyTournamentsV72();
    if(typeof window.openMyTournamentsV71==='function') return window.openMyTournamentsV71();
    if(typeof window.openMyTournamentsV59==='function') return window.openMyTournamentsV59();
    if(typeof window.openMyTournamentsV58==='function') return window.openMyTournamentsV58();
  }

  function patch(){
    ensureFiveNav();
    makeStatsPassive();
  }

  document.addEventListener('click',openMyTournaments,true);
  document.addEventListener('pointerup',openMyTournaments,true);

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patch,{once:true});
  else patch();

  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;patch();});
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});

  window.addEventListener('load',patch);
  window.POKER_SWIPE_BUILD='V73 NAV+HOME+MAP HOTFIX';
  document.documentElement.dataset.pokerSwipeHotfix='73';
})();
