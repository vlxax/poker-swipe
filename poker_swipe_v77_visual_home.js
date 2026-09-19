/* PokerSwipe V77 Visual Home PATCH 1.3 — visual composition only. */
(()=>{
 'use strict';
 const $=(s,r=document)=>r.querySelector(s);
 const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const rt=()=>window.PokerSwipeRuntime;
 function topLeak(){try{return rt()?.getTopLeak?.()||null}catch(_){return null}}
 function snapshot(){try{return rt()?.getSnapshot?.()||{}}catch(_){return {}}}
 function ensureCreatorMark(){
   const top=$('#mainApp > .top'); if(!top)return;
   top.classList.add('creatorTop');
   let mark=top.querySelector('.topRightMark24');
   if(!mark){mark=document.createElement('div');mark.className='topRightMark24';mark.innerHTML='<span>by</span><b>ФРИКОВАЯ ДАМА</b><i>💋</i>';top.appendChild(mark)}
 }
 function renderVisualHome(){
   const h=$('#home'); if(!h)return;
   const s=snapshot(), L=topLeak();
   const skill=esc(s.skill??'—'), form=esc(s.form??'—'), base=esc(s.events??0);
   const focus=L?esc(L.concept||L.name||L.key||'ТВОЙ ПАТТЕРН'):'VS OPEN';
   const focusCopy=L?'Есть повторяемость. Короткая тренировка по этому паттерну.':'Набери ещё решений — пока без выдуманного диагноза.';
   h.innerHTML=`<div class="vh77">
    <section class="vh77-stats" aria-label="Статистика">
      <div class="vh77-stat"><span class="vh77-ey">SKILL</span><b>${skill}</b><small>общий уровень</small></div>
      <div class="vh77-stat"><span class="vh77-ey">FORM</span><b>${form}</b><small>последние 20</small></div>
      <div class="vh77-stat"><span class="vh77-ey">БАЗА</span><b>${base}</b><small>решений</small></div>
    </section>
    <section class="vh77-card vh77-hero">
      <div class="vh77-heroText"><span class="vh77-ey">РАЗДАЧА ДНЯ</span><h1>ОДНА<br><span>РУКА.</span></h1><p>Один сложный спот: решение, размер и логика.</p><button class="vh77-primary" id="vh77Daily">ПЕРЕЙТИ К<br>РАЗДАЧЕ ДНЯ <span>→</span></button></div>
      <div class="vh77-lady vh77-dino" aria-hidden="true"><img src="poker_swipe_daily_dino.jpeg" alt=""></div>
    </section>
    <section class="vh77-card vh77-focus"><div><span class="vh77-ey">ТВОЯ ИГРА</span><h2>ПРОВЕРИМ: ${focus}</h2><p>${focusCopy}</p></div><button class="vh77-smallCta" id="vh77Focus">ПРОВЕРИТЬ →</button></section>
    <section class="vh77-grid">
      <button class="vh77-tool" id="vh77Sizing"><span class="vh77-ey">САЙЗИНГ</span><b>СКОЛЬКО<br>СТАВИМ?</b><p>Выбери размер и пойми, зачем он здесь.</p><span class="vh77-toolFoot"><span class="vh77-chips"><i></i><i></i><i></i></span><span class="vh77-arrow">→</span></span></button>
      <button class="vh77-tool" id="vh77Review"><span class="vh77-ey">РАЗБОР ЛИНИИ</span><b>ГДЕ<br>СЛОМАЛОСЬ?</b><p>Найди первую реальную ошибку.</p><span class="vh77-toolFoot"><span class="vh77-dots"><i></i><i></i><i></i><i></i><i></i></span><span class="vh77-arrow">→</span></span></button>
    </section>
    <button class="vh77-card vh77-wide" id="vh77Exploit"><div><span class="vh77-ey">ЭКСПЛОЙТ</span><b>ЧИТАЙ СОПЕРНИКА</b><p>Замечай паттерны и меняй стратегию.</p></div><span class="vh77-eye">◉</span><span class="vh77-arrow">→</span></button>
    <section class="vh77-grid">
      <button class="vh77-tool" id="vh77Swipe"><span class="vh77-ey">10 РУК</span><b>POKER<br>SWIPE</b><p>Решение + размер. Быстро, но не тупо.</p><span class="vh77-toolFoot"><span style="font-size:28px">← 🂡 →</span><span class="vh77-arrow">→</span></span></button>
      <button class="vh77-tool" id="vh77Xray"><span class="vh77-ey">РЕНДЖИ</span><b>◎ РЕНТГЕН</b><p>Позиция, стек и ситуация — с чем играть.</p><span class="vh77-toolFoot"><span class="vh77-dots"><i></i><i></i><i></i><i></i></span><span class="vh77-arrow">→</span></span></button>
    </section>
    <button class="vh77-card vh77-quick" id="vh77Quick"><div><span class="vh77-ey">⚡ 5 МИНУТ</span><b>БЫСТРАЯ ТРЕНИРОВКА</b></div><strong>05:00</strong></button>
   </div>`;
   const go=id=>window.show?.(id);
   $('#vh77Daily').onclick=()=>go('daily');
   $('#vh77Sizing').onclick=()=>go('sizing');
   $('#vh77Review').onclick=()=>go('review');
   $('#vh77Exploit').onclick=()=>go('exploit');
   $('#vh77Swipe').onclick=()=>{rt()?.resetSwipe?.();go('swipe')};
   $('#vh77Xray').onclick=()=>go('xray');
   $('#vh77Focus').onclick=()=>L?rt()?.startHealForConcept?.(L.concept):(rt()?.resetSwipe?.(),go('swipe'));
   $('#vh77Quick').onclick=()=>typeof window.startQuick==='function'?window.startQuick():(rt()?.resetSwipe?.(),go('swipe'));
 }
 function install(){ensureCreatorMark();window.renderHome=renderVisualHome;const home=$('#home');if(home?.classList.contains('active'))renderVisualHome()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
 setTimeout(install,80);
 window.PokerSwipeVisualHome={render:renderVisualHome};
})();
