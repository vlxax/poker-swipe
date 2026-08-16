/* PokerSwipe V40 — POLYANA / SERIES / MY TRIP vertical-slice prototype */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORE='pokerswipe.v40.poliana';
const state={view:'today',city:'Москва',seriesId:null,tripStep:null,disc:['NLH','PLO','HU'],maxBuyin:5000,budget:50000,from:'2026-09-14',to:'2026-09-20',selected:{}};
try{Object.assign(state,JSON.parse(localStorage.getItem(STORE)||'{}'))}catch(_){ }
function persist(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(_){}}
function money(v){return Number(v||0).toLocaleString('ru-RU')+' ₽'}
function selectedEvents(){return Object.entries(state.selected||{}).map(([id,p])=>({...EVENTS.find(x=>x.id===id),priority:p})).filter(x=>x.id)}
function baseCost(){return selectedEvents().reduce((a,x)=>a+x.buyin+x.fee,0)}
function maxCost(){return selectedEvents().reduce((a,x)=>a+(x.buyin+x.fee)*Math.max(1,x.bullets||1),0)}
function toast(t){const old=$('.p40Toast');if(old)old.remove();const d=document.createElement('div');d.className='p40Toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),1500)}
const TODAY=[
 {id:'m1',time:'19:00',name:'NLH DEEP',club:'Level',tags:['NLH','9-MAX','DEEP'],buyin:1000,fee:0,levels:20,reentry:1,stack:'30K',bb:'~112 BB'},
 {id:'m2',time:'20:00',name:'PLO 6-MAX',club:'Straddle',tags:['PLO','6-MAX'],buyin:1000,fee:0,levels:20,reentry:1,stack:'25K',bb:'~84 BB'},
 {id:'m3',time:'21:00',name:'MYSTERY BOUNTY',club:'Quantum',tags:['NLH','MYSTERY'],buyin:1500,fee:0,levels:15,reentry:2,stack:'20K',bb:'~67 BB'}
];
const SERIES=[
 {id:'kal',city:'Калининград',name:'KALININGRAD SERIES',date:'12—20 СЕН',count:47,from:1000,tags:['NLH','PLO','HU','OFC']},
 {id:'min',city:'Минск',name:'MINSK POKER SERIES',date:'18—27 СЕН',count:34,from:1000,tags:['NLH','PLO','OFC']},
 {id:'mos',city:'Москва',name:'MOSCOW SERIES',date:'2—8 ОКТ',count:38,from:1000,tags:['NLH','PLO','HU']}
];
const EVENTS=[
 {id:'e1',day:'14 СЕН · ПН',date:'14 СЕН',time:'16:00',name:'MAIN EVENT · DAY 1A',tags:['NLH','DEEP','9-MAX'],buyin:5000,fee:500,levels:30,reentry:1,bullets:2,gtd:'1M',startBB:250,lateBB:28},
 {id:'e2',day:'15 СЕН · ВТ',date:'15 СЕН',time:'16:00',name:'PLO CHAMPIONSHIP',tags:['PLO','6-MAX','DEEP'],buyin:4000,fee:500,levels:30,reentry:0,bullets:1,gtd:'500K',startBB:200,lateBB:31},
 {id:'e3',day:'15 СЕН · ВТ',date:'15 СЕН',time:'21:00',name:'NLH MYSTERY',tags:['NLH','MYSTERY','9-MAX'],buyin:3000,fee:300,levels:20,reentry:1,bullets:2,gtd:'300K',startBB:150,lateBB:24,planWindow:'до ~22:45'},
 {id:'e4',day:'17 СЕН · ЧТ',date:'17 СЕН',time:'17:00',name:'HEADS-UP CHAMPIONSHIP',tags:['HU','NLH','FREEZEOUT'],buyin:5000,fee:500,levels:20,reentry:0,bullets:1,gtd:'200K',startBB:100,lateBB:65},
 {id:'e5',day:'18 СЕН · ПТ',date:'18 СЕН',time:'18:00',name:'NLH DEEP STACK',tags:['NLH','6-MAX','DEEP'],buyin:3500,fee:300,levels:25,reentry:1,bullets:2,gtd:'350K',startBB:180,lateBB:34},
 {id:'e6',day:'19 СЕН · СБ',date:'19 СЕН',time:'20:00',name:'PLO MYSTERY BOUNTY',tags:['PLO','MYSTERY','6-MAX'],buyin:4500,fee:500,levels:20,reentry:1,bullets:2,gtd:'400K',startBB:160,lateBB:27}
];
function tags(a){return `<div class="p40Tags">${a.map((x,i)=>`<span class="p40Tag ${i===0?'lime':''}">${x}</span>`).join('')}</div>`}
function shell(body,k='ТВОЯ ЖИВАЯ ИГРА',title='ПОЛЯНА.',desc='Турниры рядом, серии и твой следующий выезд.'){
 return `<div class="p40"><div class="p40Hero"><span class="p40Kicker">${k}</span><h1>${title.replace('.', '<em>.</em>')}</h1>${desc?`<p>${desc}</p>`:''}</div>${body}</div>`
}
function renderToday(){
 return shell(`<div class="p40TopTabs"><button class="on" data-p40tab="today">СЕГОДНЯ</button><button data-p40tab="series">СЕРИИ</button></div>
 <div class="p40Bar"><button class="p40Chip on">МОСКВА</button><button class="p40Chip">СЕГОДНЯ</button><button class="p40Chip">ЗАВТРА</button><button class="p40Chip">ФИЛЬТРЫ</button></div>
 <div class="p40SectionTitle"><h2>Сегодня на поляне</h2><span>${TODAY.length} тестовых турнира</span></div>
 ${TODAY.map(x=>`<article class="p40Event"><div class="p40Time">СЕГОДНЯ · ${x.time}</div><h3>${x.name}</h3>${tags(x.tags)}<div class="p40Money">${money(x.buyin)}${x.fee?` + ${money(x.fee)}`:''}</div><div class="p40Meta">${x.club} · ${x.levels} min · ${x.reentry} re-entry</div><div class="p40EventFoot"><button class="p40Link" data-p40today="${x.id}">ПОДРОБНЕЕ →</button><button class="p40Add" data-p40quick="${x.id}">+</button></div></article>`).join('')}`)
}
function renderSeriesList(){
 return shell(`<div class="p40TopTabs"><button data-p40tab="today">СЕГОДНЯ</button><button class="on" data-p40tab="series">СЕРИИ</button></div>
 <div class="p40Bar">${['ВСЕ','МОСКВА','МИНСК','КАЛИНИНГРАД','СОЧИ'].map((x,i)=>`<button class="p40Chip ${i===0?'on':''}">${x}</button>`).join('')}</div>
 <div class="p40SectionTitle"><h2>Куда едем</h2><span>серии · тестовый каталог</span></div>
 ${SERIES.map(s=>`<article class="p40Series"><span class="p40Kicker">${s.city} · ${s.date}</span><h3>${s.name}</h3>${tags(s.tags)}<div class="p40Meta">${s.count} турниров · от ${money(s.from)}</div><div class="p40SeriesFoot"><button class="p40Link" data-p40series="${s.id}">СМОТРЕТЬ →</button><span>♠</span></div></article>`).join('')}`,'ЖИВОЙ ПОКЕР · БОЛЬШИЕ СЕРИИ','СЕРИИ.','Расписание, дисциплины и поездка вокруг твоей игры.')
}
function renderSeries(){const s=SERIES.find(x=>x.id===state.seriesId)||SERIES[0];
 return shell(`<button class="p40Back" data-p40back="series">← <b>СЕРИИ</b></button><section class="p40SeriesHero"><span class="p40Kicker">${s.city} · ${s.date}</span><h1>${s.name}</h1><p>${s.count} турниров · ${s.tags.join(' · ')}</p><div class="p40TopTabs"><button data-p40schedule>РАСПИСАНИЕ</button><button class="on" data-p40trip>+ МОЯ ПОЕЗДКА</button></div></section>
 <div class="p40SectionTitle"><h2>Главные события</h2><span>пример сетки</span></div>${EVENTS.slice(0,3).map(eventCard).join('')}
 <button class="p40Primary" data-p40trip>СПЛАНИРОВАТЬ ПОЕЗДКУ →</button>`,'ПОЛЯНА · СЕРИЯ','KALININGRAD SERIES.','Открой расписание или собери свою сетку под даты, дисциплины и бюджет.')
}
function eventCard(e,selectable=false){const chosen=state.selected?.[e.id];return `<article class="p40Event ${chosen?'p40Selected':''}"><div class="p40Time">${e.date} · ${e.time}</div><h3>${e.name}</h3>${tags(e.tags)}<div class="p40Money">${money(e.buyin)} + ${money(e.fee)} fee</div><div class="p40Meta">${e.startBB} BB start · ${e.levels} min · ${e.reentry} re-entry · GTD ${e.gtd}</div><div class="p40EventFoot"><button class="p40Link" data-p40event="${e.id}">ПОДРОБНЕЕ →</button>${selectable?`<button class="p40Add" data-p40add="${e.id}">${chosen?'✓':'+'}</button>`:''}</div></article>`}
function renderTripForm(){return shell(`<button class="p40Back" data-p40back="series-detail">← <b>KALININGRAD SERIES</b></button><div class="p40Form">
 <div class="p40DateRow"><div class="p40Field"><label>С</label><input id="p40from" type="date" value="${state.from}"></div><div class="p40Field"><label>ПО</label><input id="p40to" type="date" value="${state.to}"></div></div>
 <div class="p40Field"><label>ИГРАЮ · МОЖНО НЕСКОЛЬКО</label><div class="p40ChoiceGrid">${['NLH','PLO','HU','OFC','PINEAPPLE','MIXED'].map(x=>`<button class="p40Choice ${state.disc.includes(x)?'on':''}" data-p40disc="${x}">${x}</button>`).join('')}</div></div>
 <div class="p40Field"><label>ВХОД ДО</label><input id="p40max" inputmode="numeric" value="${state.maxBuyin}"></div>
 <div class="p40Field"><label>ОБЩИЙ БЮДЖЕТ</label><input id="p40budget" inputmode="numeric" value="${state.budget}"></div>
 <button class="p40Primary" data-p40find>НАЙТИ ТУРНИРЫ →</button></div>`,'СОБЕРЁМ ТВОЮ СЕТКУ','МОЯ ПОЕЗДКА.','Даты, несколько дисциплин и реальный лимит. Без анкеты на двадцать экранов.')}
function renderResults(){const filtered=EVENTS.filter(e=>e.buyin<=Number(state.maxBuyin||999999)&&e.tags.some(t=>state.disc.includes(t)));
 return shell(`<button class="p40Back" data-p40back="trip-form">← <b>НАСТРОЙКИ</b></button><div class="p40ResultsHead"><div class="p40ResultCount">${filtered.length} ТУРНИРОВ.</div><div class="p40Meta">14—20 сентября · ${state.disc.join(' + ')} · до ${money(state.maxBuyin)}</div></div>${filtered.map(e=>eventCard(e,true)).join('')}${selectedEvents().length?floatBar():''}`,'ТВОЯ ВЫБОРКА','ПОДХОДИТ.','Добавляй турниры и расставляй приоритеты A / B / C.')}
function floatBar(){return `<div class="p40Float"><div><b>МОЯ СЕТКА · ${selectedEvents().length}</b><br><span>${money(baseCost())} основные входы</span></div><button data-p40openplan>ОТКРЫТЬ →</button></div>`}
function renderPriority(id){const e=EVENTS.find(x=>x.id===id);if(!e)return;window.openModal(`<span class="p40Kicker">КУДА СТАВИМ?</span><h2 style="font-size:30px;margin:4px 0 14px">${e.name}</h2><div class="p40Priority"><button data-p40pri="A" data-id="${id}"><b>A</b>ГЛАВНЫЙ<small>хочу сыграть обязательно</small></button><button data-p40pri="B" data-id="${id}"><b>B</b>ХОЧУ<small>если не конфликтует</small></button><button data-p40pri="C" data-id="${id}"><b>C</b>ЗАПАСНОЙ<small>если появится окно</small></button></div>`);setTimeout(()=>{$$('[data-p40pri]').forEach(b=>b.onclick=()=>{state.selected[id]=b.dataset.p40pri;persist();window.closeModal();toast(`Добавлено как ${b.dataset.p40pri}`);render()})},0)}
function renderPlan(){const items=selectedEvents();const byDay={};items.forEach(e=>(byDay[e.day]||(byDay[e.day]=[])).push(e));return shell(`<button class="p40Back" data-p40back="results">← <b>ТУРНИРЫ СЕРИИ</b></button><section class="p40TripHero"><span class="p40Kicker">14—20 СЕН · KALININGRAD SERIES</span><h1>КАЛИНИНГРАД.</h1><div class="p40Tags"><span class="p40Tag lime">${items.length} EVENTS</span><span class="p40Tag">${items.reduce((a,x)=>a+(x.bullets||1),0)} MAX BULLETS</span></div><div class="p40Next"><span class="p40Kicker">СЛЕДУЮЩЕЕ</span><b>${items[0]?.name||'Добавь первый турнир'}</b><div class="p40Meta">${items[0]?items[0].date+' · '+items[0].time:'Сетка пока пустая'}</div></div></section>
 <div class="p40SummaryGrid"><button class="p40Summary on" data-p40plansub="grid"><span>СЕТКА</span><b>${items.length}</b><small>турниров</small></button><button class="p40Summary" data-p40plansub="budget"><span>БЮДЖЕТ</span><b>${Math.round(baseCost()/100)/10}K</b><small>основные</small></button><button class="p40Summary" data-p40plansub="logistics"><span>ЛОГИСТИКА</span><b>0/4</b><small>заполнено</small></button></div>
 <div id="p40PlanBody">${planGrid(byDay)}</div>`,'МОЯ ИГРА · ПОЕЗДКА','МОЯ ПОЕЗДКА.','Сетка, бюджет и логистика — без отдельного «чемоданчика».')}
function planGrid(byDay){if(!Object.keys(byDay).length)return '<div class="p40Notice"><b>Сетка пустая.</b> Вернись в расписание и добавь турниры.</div>';let out='';Object.entries(byDay).forEach(([day,arr])=>{out+=`<div class="p40Day"><div class="p40DayHead"><span>${day}</span><span>${arr.length} EVENT${arr.length>1?'S':''}</span></div>${arr.map((e,i)=>`<article class="p40PlanCard ${e.priority==='C'?'p40PlanB':''}"><div class="p40PriorityBadge ${e.priority.toLowerCase()}">${e.priority}</div><div><h4>${e.name}</h4><p>${e.time} · ${e.tags.slice(0,2).join(' · ')} · ${e.bullets} bullet${e.bullets>1?'s':''}${e.priority==='C'&&e.planWindow?' · окно '+e.planWindow:''}</p></div><div class="p40PlanPrice">${money(e.buyin+e.fee)}</div></article>`).join('')}</div>`});out+=`<div class="p40Rest">СР · 16 СЕН · REST / ВОЗМОЖНЫЙ DAY 2</div>`;return out}
function budgetView(){return `<section class="p40BudgetHero"><span class="p40Kicker">ПОКЕР</span><div class="p40ResultCount">${money(baseCost())}</div><div class="p40Meta">основные входы</div><div class="p40Notice">С выбранными bullets максимум: <b>${money(maxCost())}</b><br>Лимит поездки: ${money(state.budget)}</div></section><div class="p40SummaryGrid"><div class="p40Summary"><span>ВХОДЫ</span><b>${Math.round(selectedEvents().reduce((a,x)=>a+x.buyin,0)/100)/10}K</b><small>без fee</small></div><div class="p40Summary"><span>FEE</span><b>${Math.round(selectedEvents().reduce((a,x)=>a+x.fee,0)/100)/10}K</b><small>отдельно</small></div><div class="p40Summary"><span>МАКС</span><b>${Math.round(maxCost()/100)/10}K</b><small>все bullets</small></div></div>`}
function logisticsView(){return `<div class="p40SectionTitle"><h2>Логистика</h2><span>ручной план</span></div>${[['ДОРОГА','+ добавить'],['ЖИЛЬЁ','+ добавить'],['ЕДА','1 500 ₽ / день'],['НА МЕСТЕ','3 000 ₽']].map(x=>`<div class="p40InfoCard"><span class="p40Kicker">${x[0]}</span><div class="p40Money">${x[1]}</div></div>`).join('')}<div class="p40Notice">На тесте PokerSwipe <b>не бронирует</b> билеты и жильё. Здесь только бюджет поездки.</div>`}
function detailModal(e){window.openModal(`<span class="p40Kicker">${e.date} · ${e.time}</span><h2 style="font-size:30px;line-height:.95;margin:5px 0">${e.name}</h2>${tags(e.tags)}<div class="p40Money">${money(e.buyin)} + ${money(e.fee)} fee</div><div class="p40SummaryGrid" style="margin-top:14px"><div class="p40Summary"><span>СТАРТ</span><b>${e.startBB} BB</b><small>по структуре</small></div><div class="p40Summary"><span>УРОВНИ</span><b>${e.levels}m</b><small>blind level</small></div><div class="p40Summary"><span>LATE</span><b>${e.lateBB} BB</b><small>конец рег.</small></div></div><div class="p40Notice">GTD <b>${e.gtd}</b> · re-entry ${e.reentry}. Тестовые данные — здесь проверяем UX, не афишу.</div>`)}
function render(){const root=$('#tournamentsArea');if(!root)return;let html='';if(state.view==='today')html=renderToday();if(state.view==='series')html=renderSeriesList();if(state.view==='series-detail')html=renderSeries();if(state.view==='trip-form')html=renderTripForm();if(state.view==='results')html=renderResults();if(state.view==='plan')html=renderPlan();root.innerHTML=html;bind();persist()}
function bind(){
 $$('[data-p40tab]').forEach(b=>b.onclick=()=>{state.view=b.dataset.p40tab;render()});
 $$('[data-p40series]').forEach(b=>b.onclick=()=>{state.seriesId=b.dataset.p40series;state.view='series-detail';render()});
 $$('[data-p40trip]').forEach(b=>b.onclick=()=>{state.view='trip-form';render()});
 $('[data-p40find]')?.addEventListener('click',()=>{state.from=$('#p40from')?.value||state.from;state.to=$('#p40to')?.value||state.to;state.maxBuyin=Number($('#p40max')?.value||state.maxBuyin);state.budget=Number($('#p40budget')?.value||state.budget);state.view='results';render()});
 $$('[data-p40disc]').forEach(b=>b.onclick=()=>{const x=b.dataset.p40disc;state.disc=state.disc.includes(x)?state.disc.filter(v=>v!==x):[...state.disc,x];b.classList.toggle('on')});
 $$('[data-p40add]').forEach(b=>b.onclick=()=>renderPriority(b.dataset.p40add));
 $$('[data-p40event]').forEach(b=>b.onclick=()=>detailModal(EVENTS.find(x=>x.id===b.dataset.p40event)));
 $$('[data-p40today]').forEach(b=>b.onclick=()=>{const e=TODAY.find(x=>x.id===b.dataset.p40today);window.openModal(`<span class="p40Kicker">СЕГОДНЯ · ${e.time}</span><h2>${e.name}</h2>${tags(e.tags)}<div class="p40Money">${money(e.buyin)}</div><div class="p40Notice">${e.stack} stack · ${e.levels} min · ${e.reentry} re-entry<br>Сейчас ориентировочно <b>${e.bb}</b>.</div><button class="p40Primary" id="p40todayAdd">+ В ПЛАН</button>`);setTimeout(()=>$('#p40todayAdd').onclick=()=>{window.closeModal();toast('Добавлено в Мою игру')},0)});
 $$('[data-p40quick]').forEach(b=>b.onclick=()=>toast('Добавлено в Мою игру'));
 $('[data-p40openplan]')?.addEventListener('click',()=>{state.view='plan';render()});
 $$('[data-p40back]').forEach(b=>b.onclick=()=>{const v=b.dataset.p40back;state.view=v==='series-detail'?'series-detail':v==='trip-form'?'trip-form':v==='results'?'results':'series';render()});
 $$('[data-p40plansub]').forEach(b=>b.onclick=()=>{const body=$('#p40PlanBody');if(!body)return;$$('[data-p40plansub]').forEach(x=>x.classList.toggle('on',x===b));const s=b.dataset.p40plansub;if(s==='grid'){const by={};selectedEvents().forEach(e=>(by[e.day]||(by[e.day]=[])).push(e));body.innerHTML=planGrid(by)}if(s==='budget')body.innerHTML=budgetView();if(s==='logistics')body.innerHTML=logisticsView()});
}
const baseRender=window.renderTournaments23;
window.renderTournaments23=function(){render()};
const baseShow=window.show;
window.show=function(id){const r=baseShow.apply(this,arguments);if(id==='tournaments')setTimeout(render,0);return r};
function chrome(){const b=$('[data-nav="tournaments"]');if(b&&b.childNodes.length)b.childNodes[b.childNodes.length-1].textContent=' ПОЛЯНА'}
const oldUi=window.ui;window.ui=function(){const r=oldUi?.apply(this,arguments);chrome();return r};
chrome();
window.PokerSwipePolianaV40={state,render,EVENTS,SERIES,TODAY};
document.documentElement.dataset.pokerSwipeVersion='40.0-poliana';
})();
