(() => {
'use strict';

/*
  PokerSwipe 3D Bottom Navigation
  Adapted from the user's Figma Make export.
  It changes ONLY the visual contents of existing .nav [data-nav] buttons.
  Existing navigation click handlers and data-nav attributes are preserved.
*/

const BUILD = 'poker3d-nav-figma-v1';

const labels = {
  home: 'ГЛАВНАЯ',
  cards: 'РАЗДАЧИ',
  meadow: 'ПОЛЯНА',
  tour: 'МОИ ТУРНИРЫ',
  me: 'ТЫ'
};

const order = ['home','cards','meadow','tour','me'];

function iconHome(on){
  const l=on?'#7aaa00':'#2a2a2a', f=on?'#c8f135':'#3d3d3d', r=on?'#a8d020':'#333';
  const rL=on?'#4a7a00':'#1e1e1e', rR=on?'#d8ff55':'#555';
  return `<svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="psHWin" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="${on?'#fff9c4':'#333'}"/>
        <stop offset="100%" stop-color="${on?'#ffcc00':'#1a1a1a'}" stop-opacity=".7"/>
      </radialGradient>
      <filter id="psHGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <ellipse cx="18" cy="33" rx="11" ry="2" fill="#000" opacity="${on?.25:.15}"/>
    <path d="M7 19v10l7 4V23z" fill="${l}"/>
    <path d="M14 23v10h10V23z" fill="${f}"/>
    <path d="M24 23v10l5-4V19z" fill="${r}" opacity=".8"/>
    <path d="M16.5 28v5h3v-5a1.5 1.5 0 0 0-3 0z" fill="#0e0e0e" opacity=".45"/>
    <circle cx="19" cy="30.5" r=".6" fill="${on?'#c8f135':'#3a3a3a'}"/>
    <rect x="21" y="25" width="4" height="4" rx=".5" fill="url(#psHWin)"/>
    <path d="M21 27h4M23 25v4" stroke="#fff" stroke-width=".5" opacity=".4"/>
    ${on?'<rect x="20" y="24" width="6" height="6" rx="1" fill="#ffcc00" opacity=".08" filter="url(#psHGlow)"/>':''}
    <path d="M7 19l7 4 4-7-8-2z" fill="${rL}"/>
    <path d="M29 19l-5 4-4-7 8-2z" fill="${rR}"/>
    <path d="M11 10l7 6 7-6" stroke="${on?'#fff':'#555'}" stroke-width="1" stroke-linejoin="round" opacity=".35"/>
    <path d="M22 14v-5h3v5" fill="${on?'#6e9400':'#2a2a2a'}"/>
    <rect x="21.5" y="9" width="4" height="1.2" rx=".4" fill="${on?'#8db800':'#333'}"/>
    ${on?'<circle cx="23" cy="7.5" r="1.2" fill="#c8f135" opacity=".25"/><circle cx="24" cy="5.5" r=".8" fill="#c8f135" opacity=".15"/><circle cx="22.5" cy="4" r=".5" fill="#c8f135" opacity=".08"/>':''}
    <circle cx="18" cy="10" r="1.8" fill="${on?'#fff':'#444'}" opacity="${on?.9:.4}" ${on?'filter="url(#psHGlow)"':''}/>
  </svg>`;
}

function iconCards(on){
  return `<svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="psCBack" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${on?'#7aaa00':'#2e2e2e'}"/><stop offset="100%" stop-color="${on?'#3a6000':'#1a1a1a'}"/></linearGradient>
      <linearGradient id="psCFront" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${on?'#f5fff0':'#3a3a3a'}"/><stop offset="100%" stop-color="${on?'#e0f5c8':'#282828'}"/></linearGradient>
      <linearGradient id="psCEdge" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${on?'#2e5000':'#111'}"/><stop offset="100%" stop-color="${on?'#3a6000':'#1e1e1e'}"/></linearGradient>
      <filter id="psCShadow"><feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity=".5"/></filter>
    </defs>
    <g transform="rotate(-22 18 22)" filter="url(#psCShadow)">
      <rect x="4" y="8" width="13" height="19" rx="2" fill="url(#psCBack)"/>
      <rect x="5.5" y="9.5" width="10" height="16" rx="1" stroke="${on?'#5a9000':'#222'}" stroke-width=".6" opacity=".6"/>
      <path d="M5.5 9.5l10 16M15.5 9.5L5.5 25.5" stroke="${on?'#5a9000':'#222'}" stroke-width=".5" opacity=".3"/>
    </g>
    <g transform="rotate(20 18 22)" filter="url(#psCShadow)">
      <rect x="19" y="8" width="13" height="19" rx="2" fill="#1a1a1a" stroke="${on?'#c8f135':'#333'}"/>
      <text x="21" y="16" font-size="6" font-weight="900" font-family="Georgia,serif" fill="${on?'#c8f135':'#3a3a3a'}">K</text>
      <path d="M25.5 20c0 0-3-2.2-3-3.8a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 1.6-3 3.8-3 3.8z" fill="${on?'#ff4466':'#3a3a3a'}"/>
    </g>
    <path d="M11 9.5l2-1.5v19l-2 1.5z" fill="url(#psCEdge)"/>
    <path d="M11 28.5l2-1.5h14l-2 1.5z" fill="${on?'#2e5000':'#111'}" opacity=".7"/>
    <rect x="13" y="8" width="14" height="20" rx="2" fill="url(#psCFront)" filter="url(#psCShadow)"/>
    <rect x="13" y="8" width="14" height="20" rx="2" stroke="${on?'#8db800':'#444'}" stroke-width=".8" fill="none" opacity=".5"/>
    <text x="15" y="15" font-size="7" font-weight="900" font-family="Georgia,serif" fill="${on?'#1a3000':'#555'}">A</text>
    <path d="M20 16l2.5 4L20 24l-2.5-4z" fill="${on?'#e05000':'#444'}"/>
    <path d="M20 17.5l1.2 2.5L20 22.5l-1.2-2.5z" fill="#fff" opacity=".2"/>
  </svg>`;
}

function iconCrown(on){
  return `<svg viewBox="0 0 38 38" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="psCrTop" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${on?'#fff':'#888'}"/><stop offset="40%" stop-color="${on?'#d8ff55':'#666'}"/><stop offset="100%" stop-color="${on?'#6e9400':'#333'}"/></linearGradient>
      <linearGradient id="psCrBase" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${on?'#b0d820':'#555'}"/><stop offset="100%" stop-color="${on?'#5a8000':'#2a2a2a'}"/></linearGradient>
      <linearGradient id="psCrSide"><stop stop-color="${on?'#4a7000':'#1a1a1a'}"/><stop offset="100%" stop-color="${on?'#8ab800':'#2e2e2e'}"/></linearGradient>
      <radialGradient id="psGGreen" cx="35%" cy="25%" r="65%"><stop stop-color="#e0ffb0"/><stop offset="60%" stop-color="${on?'#c8f135':'#555'}"/><stop offset="100%" stop-color="${on?'#4a8000':'#333'}"/></radialGradient>
      <radialGradient id="psGRuby" cx="35%" cy="25%" r="65%"><stop stop-color="#ffc0c0"/><stop offset="60%" stop-color="${on?'#ff4466':'#555'}"/><stop offset="100%" stop-color="${on?'#880022':'#333'}"/></radialGradient>
      <radialGradient id="psGSapph" cx="35%" cy="25%" r="65%"><stop stop-color="#c0d8ff"/><stop offset="60%" stop-color="${on?'#4488ff':'#555'}"/><stop offset="100%" stop-color="${on?'#002288':'#333'}"/></radialGradient>
      <radialGradient id="psGAmeth" cx="35%" cy="25%" r="65%"><stop stop-color="#e8c0ff"/><stop offset="60%" stop-color="${on?'#cc44ff':'#555'}"/><stop offset="100%" stop-color="${on?'#660088':'#333'}"/></radialGradient>
      <filter id="psCrGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    ${on?'<ellipse cx="19" cy="34" rx="13" ry="2.5" fill="#c8f135" opacity=".18" filter="url(#psCrGlow)"/>':''}
    <path d="M5 28h28l-2 3H7z" fill="${on?'#3a6000':'#181818'}"/>
    <path d="M5 25h28v3H5z" fill="url(#psCrBase)"/>
    ${[8,14,19,24,30].map(x=>`<circle cx="${x}" cy="26.5" r="1.2" fill="${on?'#d8ff55':'#333'}" stroke="${on?'#fff':'#222'}" stroke-width=".4" opacity=".8"/>`).join('')}
    <path d="M5 25L7 12l5 7 4-11 3 9 3-9 4 11 5-7 2 13z" fill="url(#psCrSide)" opacity=".5"/>
    <path d="M6 25L8 13l5 7 4-11 2 7 2-7 4 11 5-7 2 12z" fill="url(#psCrTop)"/>
    <path d="M8 13l2.5-3 2.5 3-2.5 3z" fill="url(#psGRuby)"/>
    <path d="M14 9l2.5-3.5L19 9l-2.5 3z" fill="url(#psGAmeth)"/>
    <path d="M19 5l3.2 4-3.2 4-3.2-4z" fill="url(#psGGreen)" ${on?'filter="url(#psCrGlow)"':''}/>
    <path d="M22 9l2.5-3.5 2.5 3.5-2.5 3z" fill="url(#psGAmeth)"/>
    <path d="M27 13l2.5-3 2.5 3-2.5 3z" fill="url(#psGSapph)"/>
    ${on?'<path d="M19 2v2M19 13v2M16 7.5h2M21 7.5h2" stroke="#c8f135" stroke-width=".8" stroke-linecap="round" opacity=".7"/>':''}
  </svg>`;
}

function iconTrophy(on){
  return `<svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="psTGold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${on?'#fff7aa':'#666'}"/><stop offset="30%" stop-color="${on?'#ffd700':'#555'}"/><stop offset="70%" stop-color="${on?'#c8a000':'#3a3a3a'}"/><stop offset="100%" stop-color="${on?'#7a6000':'#1e1e1e'}"/></linearGradient>
      <linearGradient id="psTSide"><stop stop-color="${on?'#5a4400':'#181818'}"/><stop offset="100%" stop-color="${on?'#c8a000':'#2a2a2a'}"/></linearGradient>
      <filter id="psTGlow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse cx="18" cy="34" rx="9" ry="1.8" fill="#000" opacity="${on?.3:.15}"/>
    <path d="M11 31h14l1 2H10z" fill="${on?'#5a4400':'#1a1a1a'}"/>
    <rect x="11" y="29.5" width="14" height="1.5" rx=".5" fill="url(#psTGold)"/>
    <path d="M15.5 27h5M18 24v5.5" stroke="url(#psTGold)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M10 11c-3.5 0-5.5 2-5.5 4.5S6.5 20 10 20" stroke="url(#psTGold)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M26 11c3.5 0 5.5 2 5.5 4.5S29.5 20 26 20" stroke="url(#psTGold)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M10 8h2v14l-2-2z" fill="url(#psTSide)"/>
    <path d="M12 8h12v12a6 6 0 0 1-12 0V8z" fill="url(#psTGold)" ${on?'filter="url(#psTGlow)"':''}/>
    <rect x="12" y="8" width="12" height="2.5" fill="${on?'#fff7aa':'#666'}" opacity=".5"/>
    <path d="M18 12l1.3 2.8H22.4l-2.5 2 1 3L18 18.2l-2.9 1.6 1-3-2.5-2h3.1z" fill="${on?'#fff7aa':'#3a3a3a'}" opacity=".5"/>
    <ellipse cx="8.5" cy="19.5" rx="2" ry="3" fill="${on?'#8db800':'#2a2a2a'}" opacity=".8" transform="rotate(-35 8.5 19.5)"/>
    <ellipse cx="27.5" cy="19.5" rx="2" ry="3" fill="${on?'#8db800':'#2a2a2a'}" opacity=".8" transform="rotate(35 27.5 19.5)"/>
  </svg>`;
}

function iconUser(on){
  return `<svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="psUSkin" cx="40%" cy="35%" r="60%"><stop stop-color="${on?'#e0ffb0':'#444'}"/><stop offset="50%" stop-color="${on?'#a8d820':'#333'}"/><stop offset="100%" stop-color="${on?'#5a8a00':'#1e1e1e'}"/></radialGradient>
      <radialGradient id="psUHair" cx="50%" cy="0%" r="80%"><stop stop-color="${on?'#6e9400':'#2a2a2a'}"/><stop offset="100%" stop-color="${on?'#2e4a00':'#111'}"/></radialGradient>
      <linearGradient id="psUBody" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${on?'#c8f135':'#333'}"/><stop offset="100%" stop-color="${on?'#5a8000':'#1a1a1a'}"/></linearGradient>
      <linearGradient id="psUBadge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${on?'#ffe566':'#555'}"/><stop offset="50%" stop-color="${on?'#ffd700':'#3a3a3a'}"/><stop offset="100%" stop-color="${on?'#c8a000':'#222'}"/></linearGradient>
      <filter id="psUGlow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    ${on?'<circle cx="16" cy="13" r="12" fill="#c8f135" opacity=".08"/>':''}
    <ellipse cx="16" cy="22" rx="7" ry="2" fill="#000" opacity=".2"/>
    <circle cx="16" cy="13" r="7.5" fill="url(#psUHair)"/>
    <circle cx="16" cy="13" r="6" fill="url(#psUSkin)"/>
    <ellipse cx="14" cy="10.5" rx="2.5" ry="1.8" fill="#fff" opacity=".15"/>
    <ellipse cx="13.5" cy="13" rx="1.2" ry="1.4" fill="#0e0e0e" opacity=".6"/>
    <ellipse cx="18.5" cy="13" rx="1.2" ry="1.4" fill="#0e0e0e" opacity=".6"/>
    <path d="M13 15.5q3 2.5 6 0" stroke="#0e0e0e" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".5"/>
    <path d="M7 31c0-5.5 4-9 9-9s9 3.5 9 9" fill="url(#psUBody)" opacity=".9"/>
    <circle cx="26" cy="9" r="6" fill="url(#psUBadge)" ${on?'filter="url(#psUGlow)"':''}/>
    <circle cx="26" cy="9" r="6" stroke="${on?'#fff7aa':'#333'}" stroke-width=".7" opacity=".5"/>
    <text x="26" y="11.5" text-anchor="middle" font-size="6" font-weight="800" font-family="Barlow Condensed,sans-serif" fill="${on?'#3a2000':'#555'}">LV</text>
  </svg>`;
}

const iconFns={home:iconHome,cards:iconCards,meadow:iconCrown,tour:iconTrophy,me:iconUser};

function inferType(button,index){
  const nav=String(button.dataset.nav||'').toLowerCase();
  const text=String(button.textContent||'').toLowerCase();
  const source=nav+' '+text;
  if(/home|main|глав/.test(source))return'home';
  if(/hand|card|deal|раздач|рук/.test(source))return'cards';
  if(/polyana|meadow|полян/.test(source))return'meadow';
  if(/tour|турнир/.test(source))return'tour';
  if(/profile|user|you|\bme\b|статист|профил|ты/.test(source))return'me';
  return order[index]||null;
}

function isOn(button){
  return button.classList.contains('on') ||
         button.classList.contains('active') ||
         button.getAttribute('aria-current')==='page' ||
         button.dataset.active==='true';
}

function renderButton(button,type){
  const on=isOn(button);
  const state=on?'1':'0';
  if(button.dataset.ps3dType===type &&
     button.dataset.ps3dState===state &&
     button.querySelector('.ps3d-icon')) return;

  button.dataset.ps3dType=type;
  button.dataset.ps3dState=state;
  button.dataset.ps3dBuild=BUILD;

  button.innerHTML=
    `<span class="ps3d-icon" aria-hidden="true">${iconFns[type](on)}</span>`+
    `<span class="ps3d-label">${labels[type]}</span>`;
}

let scheduled=false;
function apply(){
  scheduled=false;
  const nav=document.querySelector('.nav');
  if(!nav)return;
  const buttons=[...nav.querySelectorAll('[data-nav]')];
  buttons.forEach((button,index)=>{
    const type=inferType(button,index);
    if(type)renderButton(button,type);
  });
  nav.dataset.ps3dBuild=BUILD;
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(apply);
}

const observer=new MutationObserver(schedule);
function start(){
  apply();
  observer.observe(document.documentElement,{
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['class','aria-current','data-active']
  });
  document.addEventListener('click',e=>{
    if(e.target.closest?.('.nav [data-nav]')) setTimeout(schedule,0);
  },true);
  window.addEventListener('pageshow',schedule);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

window.PokerSwipe3DNav={refresh:apply,build:BUILD};
})();