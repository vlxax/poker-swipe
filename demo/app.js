'use strict';

const app = document.getElementById('app');
let currentTaskId = null;

async function api(url, body) {
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return res.json();
}
function esc(v){return String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function card(c){const suit=c.slice(-1);const red=suit==='h'||suit==='d';return `<span class="card ${red?'red':''}">${esc(c)}</span>`;}
function shell(content, back=false){return `${back?'<button class="back" id="back">← Назад</button>':''}${content}`;}

function renderHome(screen){
  currentTaskId=null;
  app.innerHTML=shell(`<section class="home-hero"><div class="eyebrow">POKERSWIPE</div><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><div class="home-orb">♠</div><button class="primary" id="start">${esc(screen.primaryAction.label)}</button>${screen.resumeAction?`<button class="secondary" id="resume">${esc(screen.resumeAction.label)}</button>`:''}</section>`);
  document.getElementById('start').addEventListener('click',start);
  if(document.getElementById('resume'))document.getElementById('resume').addEventListener('click',resume);
}
function renderTask(screen){
  currentTaskId=screen.taskId;
  app.innerHTML=shell(`<div class="hero-row"><div><div class="eyebrow">${esc(screen.header.eyebrow)}</div><h1>${esc(screen.header.title)}</h1></div><div class="progress-pill">${esc(screen.header.progressText)}</div></div><div class="context-grid">${screen.context.map(x=>`<div class="context-card"><small>${esc(x.label)}</small><strong>${esc(x.value)}</strong></div>`).join('')}</div><div class="board-label">Твои карты</div><div class="cards hero-cards">${screen.cards.hero.map(card).join('')}</div><div class="board-label">Доска</div><div class="cards">${screen.cards.board.map(card).join('')}</div><div class="section-title">ТВОЁ ДЕЙСТВИЕ</div><div class="actions">${screen.actions.map(a=>`<button class="action" data-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div><div class="metric-row"><span>Счёт ${screen.footer.score}</span><span>Точность ${Math.round(screen.footer.accuracy*100)}%</span></div>`,true);
  document.getElementById('back').addEventListener('click',leave);
  app.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>submit(btn.dataset.action)));
}
function renderAnswer(screen){
  const v=screen.verdict,p=screen.progress;
  app.innerHTML=shell(`<div class="answer-panel ${v.correct?'correct':v.severity==='close'?'close':'wrong'}"><div class="eyebrow">РАЗБОР</div><h2>${esc(v.title)}</h2><div class="compare"><div><small>Твой выбор</small><strong>${esc(v.chosen)}</strong></div><div><small>По стратегии</small><strong>${esc(v.expected)}</strong></div></div><p>${esc(screen.explanation)}</p><div class="metric-row"><span>${p.answered}/${p.length}</span><span>${Math.round(p.accuracy*100)}%</span></div><button class="primary" id="next">${esc(screen.nextAction.label)}</button></div>`,true);
  document.getElementById('back').addEventListener('click',leave);
  document.getElementById('next').addEventListener('click',next);
}
function renderSummary(screen){
  const m=screen.metrics;
  app.innerHTML=shell(`<div class="summary"><div class="eyebrow">ГОТОВО</div><h1>${esc(screen.title)}</h1><div class="score-big">${Math.round(m.accuracy*100)}%</div><div class="summary-grid"><div><small>Точно</small><strong>${m.correct}</strong></div><div><small>Почти</small><strong>${m.close}</strong></div><div><small>Ошибки</small><strong>${m.incorrect}</strong></div><div><small>Очки</small><strong>${m.score}</strong></div></div><button class="primary" id="restart">${esc(screen.restartAction.label)}</button><button class="secondary" id="home">На главную</button></div>`);
  document.getElementById('restart').addEventListener('click',start);
  document.getElementById('home').addEventListener('click',leave);
}
function render(payload){
  if(!payload.ok){app.innerHTML=`<div class="error">${esc(payload.code||'ERROR')}: ${esc(payload.message||'')}</div>`;return;}
  const s=payload.screen;
  if(s.type==='home')renderHome(s);else if(s.type==='task')renderTask(s);else if(s.type==='answer')renderAnswer(s);else renderSummary(s);
}
async function boot(){render(await api('/api/app/boot'));}
async function start(){render(await api('/api/session/start',{length:10}));}
async function submit(action){render(await api('/api/session/action',{taskId:currentTaskId,action}));}
async function next(){render(await api('/api/session/next',{}));}
async function leave(){render(await api('/api/session/leave',{}));}
async function resume(){render(await api('/api/session/resume',{}));}
boot();
