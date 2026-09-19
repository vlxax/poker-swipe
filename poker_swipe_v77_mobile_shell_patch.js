/* PokerSwipe V77 MobileShell PATCH 1.1 — merge candidate. Layout/navigation only. */
(()=>{
  'use strict';
  const root=document.documentElement;
  let lastActiveId='';
  let raf=0;

  const app=()=>document.getElementById('mainApp');
  const header=()=>document.querySelector('#mainApp > .top');
  const nav=()=>document.querySelector('#mainApp > .nav');
  const active=()=>document.querySelector('#mainApp > main > .screen.active');

  function px(n,fallback){return (Number.isFinite(n)&&n>0?Math.round(n):fallback)+'px'}
  function syncViewport(){
    const vv=window.visualViewport;
    const h=Math.max(320,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||700));
    root.style.setProperty('--ps77-vh',h+'px');
  }
  function measureChrome(){
    const h=header(),n=nav();
    if(h) root.style.setProperty('--ps77-header-h',px(h.getBoundingClientRect().height,76));
    if(n) root.style.setProperty('--ps77-nav-h',px(n.getBoundingClientRect().height,72));
  }
  function normalizeShell(){
    syncViewport();
    document.body.classList.add('ps77-app-shell');
    requestAnimationFrame(measureChrome);
  }
  function resetRouteScroll(force=false){
    const s=active(); if(!s)return;
    if(force||s.id!==lastActiveId){
      lastActiveId=s.id;
      s.scrollTop=0;
      try{document.scrollingElement.scrollTop=0}catch(_e){}
    }
  }
  function afterRoute(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{normalizeShell();resetRouteScroll(true);});
  }

  /* Wrap current router. The attribute observer below also catches later router overrides. */
  const currentShow=window.show;
  if(typeof currentShow==='function'&&!currentShow.__ps77MobileShell){
    const wrapped=function(){const out=currentShow.apply(this,arguments);afterRoute();return out};
    wrapped.__ps77MobileShell=true;
    window.show=wrapped;
  }

  /* Route detection only: observe class changes on direct screens. Never react to arbitrary DOM rendering. */
  const main=app()?.querySelector('main');
  if(main){
    const routeObserver=new MutationObserver(records=>{
      if(!records.some(r=>r.type==='attributes'&&r.attributeName==='class'&&r.target.classList?.contains('screen')))return;
      const s=active();
      if(s&&s.id!==lastActiveId) afterRoute();
    });
    [...main.children].filter(x=>x.classList?.contains('screen')).forEach(x=>routeObserver.observe(x,{attributes:true,attributeFilter:['class']}));
  }

  document.addEventListener('click',e=>{if(e.target.closest?.('[data-nav]')) requestAnimationFrame(()=>resetRouteScroll(false));},true);
  window.addEventListener('resize',normalizeShell,{passive:true});
  window.visualViewport?.addEventListener('resize',normalizeShell,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)normalizeShell()});

  if(window.ResizeObserver){
    const ro=new ResizeObserver(()=>requestAnimationFrame(measureChrome));
    const h=header(),n=nav(); if(h)ro.observe(h); if(n)ro.observe(n);
  }

  normalizeShell();
  resetRouteScroll(true);
  root.dataset.mobileShellPatch='v77-1-1';
})();
