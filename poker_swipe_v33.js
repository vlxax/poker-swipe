/* PokerSwipe V33 — pro-review UI and workflow upgrade. */
(function(){
  'use strict';
  if(!window.PokerSwipeCore||!window.PokerBrainV33)return;

  const Brain=window.PokerBrainV33;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pct=value=>Math.round((Number(value)||0)*(Number(value)<=1?100:1));
  const labelCard=card=>Brain.cardLabel(card)||'—';

  /* ---------- Honest, readable strategy panel ---------- */
  const sourceLabels={
    CURATED_SCENARIO:'ПРОВЕРЕННЫЙ СЦЕНАРИЙ',
    PRO_REVIEWED_SCENARIO:'СЦЕНАРИЙ ПОСЛЕ ПРО-РЕВЬЮ',
    REFERENCE_ATLAS:'УЧЕБНЫЙ АТЛАС',
    STRUCTURAL_MODEL:'СТРУКТУРНАЯ МОДЕЛЬ',
    REFERENCE_MODEL:'УЧЕБНАЯ МОДЕЛЬ',
    LINE_REFERENCE:'МОДЕЛЬ ЛИНИИ',
    INSUFFICIENT_CONTEXT:'НЕ ХВАТАЕТ КОНТЕКСТА',
    REPAIR_MODEL:'КОРИДОР ИСПРАВЛЕНИЯ',
    LINE_MODEL:'МОДЕЛЬ ЛИНИИ'
  };
  window.brainSourceLabel=function brainSourceLabelV33(source=''){return sourceLabels[source]||String(source).replaceAll('_',' ')};
  window.brainPanel=function brainPanelV33(result){
    if(!result)return'';
    const context=result.analysisDetails?.context;
    const rows=(result.topActions||[]).map(item=>{
      const value=pct(item.freq);
      return `<div class="brainAction"><span>${esc(item.action)}</span><i><span style="width:${value}%"></span></i><b>${value}%</b></div>`;
    }).join('');
    const math=result.river?`<div class="brainMath"><div><span class="ey">НУЖНО НА КОЛЛ</span><b>${result.river.requiredEquity.toFixed(1)}%</b></div><div><span class="ey">MDF</span><b>${result.river.mdf.toFixed(1)}%</b></div><div><span class="ey">БЛЕФ / ВЕЛЬЮ</span><b>${result.river.bluffPerValue.toFixed(2)}</b></div></div>`:'';
    const completeness=context?`<div class="v33Completeness"><div><span>ПОЛНОТА КОНТЕКСТА</span><b>${context.score}%</b></div><i><span style="width:${context.score}%"></span></i>${context.missing?.length?`<small>Не хватает: ${esc(context.missing.slice(0,3).join(', '))}.</small>`:'<small>Ключевые факты этой точки указаны.</small>'}</div>`:'';
    const assumptions=result.analysisDetails?.assumptions||[];
    return `<div class="brainPanel v33BrainPanel"><div class="brainHead"><b>◉ СТРАТЕГИЧЕСКИЙ ОРИЕНТИР</b><span class="brainSource">${esc(window.brainSourceLabel(result.source))} · ${result.confidence}%</span></div>${result.score!=null?`<div class="brainScore">${result.score}</div>`:''}<div class="brainPolicy">${rows}</div>${math}${completeness}<div class="v33Explain"><span>РАЗБОР ПРОСТЫМИ СЛОВАМИ</span><p>${esc(result.explanation||'')}</p></div>${assumptions.length?`<details class="v33Assumptions"><summary>Какие допущения использованы</summary>${assumptions.map(x=>`<p>${esc(x)}</p>`).join('')}</details>`:''}${result.sizeBest!=null?`<p class="mut small">Ближайший учебный размер: ≈${result.sizeBest}%${Number.isFinite(result.sizeDistance)?` · разница ${Math.round(result.sizeDistance)} п.п.`:''}</p>`:''}<p class="v33Method">Reference-модель для обучения, не выдача коммерческого солвера.</p></div>`;
  };

  function humanizeLabels(root=document){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      return /^(SCRIPT|STYLE|TEXTAREA)$/i.test(node.parentElement?.tagName||'')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(!node.nodeValue||!/(GTO BRAIN|EXACT NODE|NODE ENGINE|confidence|COMBO REMOVAL · EXACT)/i.test(node.nodeValue))return;
      node.nodeValue=node.nodeValue
        .replace(/GTO BRAIN V19 ONLINE/gi,'ПОКЕРНЫЙ РАЗБОР V33')
        .replace(/GTO BRAIN/gi,'ПОКЕРНЫЙ РАЗБОР')
        .replace(/EXACT NODE/gi,'ПРОВЕРЕННЫЙ СЦЕНАРИЙ')
        .replace(/NODE ENGINE/gi,'REFERENCE ENGINE')
        .replace(/COMBO REMOVAL · EXACT/gi,'ТОЧНЫЙ УЧЁТ БЛОКЕРОВ')
        .replace(/confidence/gi,'полнота');
    });
  }

  /* ---------- Full decision context on training cards ---------- */
  function contextHtml(context,compact=false){
    const assumed=context.assumptions?.length>0;
    return `<div class="v33Context ${compact?'compact':''}"><div class="v33ContextHead"><span>КОНТЕКСТ РЕШЕНИЯ</span><b>${context.score}%</b></div><div class="v33ContextFacts"><span>${esc(context.pos.hero||'HERO')} vs ${esc(context.pos.villain||'VILLAIN')}</span>${context.openSize!=null?`<span>OPEN ${String(context.openSize).replace('.',',')} ББ · ${esc(context.openKind)}</span>`:''}${context.pot!=null?`<span>БАНК ${context.pot} ББ</span>`:''}${context.stack!=null?`<span>ЭФФ. ${context.stack} ББ</span>`:''}</div><p><b>Префлоп:</b> ${esc(context.preflop||'не восстановлен')}</p>${context.street!=='PREFLOP'?`<p><b>${esc({FLOP:'Флоп',TURN:'Тёрн',RIVER:'Ривер'}[context.street]||'Сейчас')}:</b> ${esc(context.current||'действие не указано')}</p>`:''}${assumed?'<small>Пометка: часть линии — учебное допущение, а не факт.</small>':''}</div>`;
  }
  function enhanceSwipeContext(){
    const visual=q('#swipeVisual'),spot=window.swSession?.[window.swIndex];if(!visual||!spot)return;
    const context=Brain.contextForSpot({...spot,format:'MTT'});
    visual.querySelector('.v33Context')?.remove();
    const passport=visual.querySelector('.v31Passport');
    if(passport){
      const line=passport.querySelector('.v31Line');
      if(line)line.innerHTML=`<span>ПОЛНАЯ ЛИНИЯ ДО РЕШЕНИЯ</span><b>Префлоп:</b> ${esc(context.preflop)}${context.street!=='PREFLOP'?`<br><b>${esc({FLOP:'Флоп',TURN:'Тёрн',RIVER:'Ривер'}[context.street])}:</b> ${esc(context.current)}`:''}`;
      passport.insertAdjacentHTML('afterend',contextHtml(context,true));
    }else visual.insertAdjacentHTML('afterbegin',contextHtml(context,true));
  }
  const renderSwipeBase=window.renderSwipe;
  window.renderSwipe=function renderSwipeV33(){const value=renderSwipeBase.apply(this,arguments);setTimeout(()=>{enhanceSwipeContext();enhanceDirectInputs();humanizeLabels(q('#swipeCard')||document)},0);return value};

  function sizingContextFromDom(){
    const text=q('#sizingArea .panel > p.mut')?.textContent||'';
    const m=text.match(/(UTG|HJ|CO|BTN|SB|BB)\s+vs\s+(UTG|HJ|CO|BTN|SB|BB)/i);
    const three=/3BET|3-BET|3-БЕТ/i.test(text);
    const pre=three?'3-bet pot; точные размеры префлопа в этом старом споте не сохранены.':m?`${m[1].toUpperCase()} открыл 2,2 ББ → ${m[2].toUpperCase()} колл (учебное допущение).`:'Префлоп-линия в этом споте не восстановлена.';
    return {pre,text,assumed:!three&&!!m};
  }
  function enhanceSizingContext(){
    const panel=q('#sizingArea .panel');if(!panel||panel.querySelector('.v33SizingContext'))return;
    const c=sizingContextFromDom();
    const box=document.createElement('div');box.className='v33SizingContext';box.innerHTML=`<span>ЛИНИЯ ДО РЕШЕНИЯ</span><p><b>Префлоп:</b> ${esc(c.pre)}</p><p><b>Текущая точка:</b> ${esc(c.text||'не указана')}</p>`;
    const lead=panel.querySelector('p.mut');lead?.insertAdjacentElement('afterend',box);
  }
  const renderSizingBase=window.renderSizing;
  window.renderSizing=function renderSizingV33(){const value=renderSizingBase.apply(this,arguments);setTimeout(()=>{enhanceSizingContext();enhanceDirectInputs();humanizeLabels(q('#sizingArea')||document)},0);return value};

  /* ---------- Direct keyboard input alongside every relevant slider ---------- */
  const directIds=new Set(['swSize','sizeRange','stack18','bound18','pot18','call18','hrstack','hrpot','hrvsize','hrhsize']);
  function unitFor(id){if(['swSize','sizeRange','hrvsize','hrhsize'].includes(id))return'%';return'ББ'}
  function enhanceRange(range){
    if(!range?.id||!directIds.has(range.id)||range.dataset.v33Direct)return;
    range.dataset.v33Direct='1';
    const unit=unitFor(range.id),wrap=document.createElement('label');wrap.className='v33DirectInput';
    wrap.innerHTML=`<span>ВВЕСТИ С КЛАВИАТУРЫ</span><div><input type="text" inputmode="decimal" autocomplete="off" aria-label="Ввести значение ${unit}" value="${String(range.value).replace('.',',')}"><b>${unit}</b></div><small class="v33DirectError"></small>`;
    range.insertAdjacentElement('afterend',wrap);
    const input=wrap.querySelector('input'),error=wrap.querySelector('small');
    const sync=()=>{if(document.activeElement!==input)input.value=String(range.value).replace('.',',')};
    range.addEventListener('input',sync);
    const commit=()=>{
      const value=Number(input.value.trim().replace(',','.')),min=Number(range.min),max=Number(range.max),step=Number(range.step||1);
      if(!Number.isFinite(value)){error.textContent='Нужно число.';wrap.classList.add('error');return}
      const bounded=Math.max(min,Math.min(max,value));
      const snapped=step?Math.round(bounded/step)*step:bounded;
      range.value=String(Number(snapped.toFixed(3)));wrap.classList.remove('error');error.textContent='';
      range.dispatchEvent(new Event('input',{bubbles:true}));range.dispatchEvent(new Event('change',{bubbles:true}));sync();
    };
    input.addEventListener('change',commit);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit();input.blur()}});
  }
  function enhanceDirectInputs(root=document){qa('input[type="range"]',root).forEach(enhanceRange)}

  /* ---------- Push/Fold: hand matrix + context honesty ---------- */
  const pushState=window.PokerSwipeV33PushState||{pos:'BTN',stage:'MID',mode:'PUSH',stack:9,bound:9};
  window.PokerSwipeV33PushState=pushState;
  function pushCellClass(result){return result.label==='FOLD'?'fold':result.label==='MIX'?'mix':'go'}
  function pushWhy(result){
    const verb=pushState.mode==='CALL'?'колла против пуша':'первого действия';
    if(result.label==='FOLD')return `${result.c} не входит в основной диапазон ${verb} при ${pushState.stack} ББ.`;
    if(result.label==='MIX')return `${result.c} находится у границы: поле, анте и реальные ICM-данные могут перевернуть решение.`;
    if(result.label==='RAISE')return `При ${pushState.stack} ББ модель предпочитает обычное открытие, а не превращает весь диапазон в пуш.`;
    return `${result.c} достаточно высоко в reference-диапазоне ${verb}.`;
  }
  function pushMatrixHtml(current=''){
    return Brain.matrixClasses().map(k=>{
      const cards=Brain.representative(k),r=window.push18(cards,pushState.pos,pushState.stack,pushState.stage,pushState.mode);
      return `<button type="button" class="v33MatrixCell ${pushCellClass(r)} ${k===current?'selected':''}" data-v33-pf="${k}" title="${k}: ${r.label} ${r.p}%"><span>${k}</span></button>`;
    }).join('');
  }
  window.pushView18=function pushViewV33(){
    return `<div class="tool18 v33Push"><div class="toolTop"><button class="back18" onclick="myGo18('hub')">←</button><div><h2>SHORT-STACK MAP</h2><small>push / call / min-raise без ложной ICM-точности</small></div></div><div class="segs18"><button id="first18" class="${pushState.mode==='PUSH'?'on':''}">Я ПЕРВЫЙ</button><button id="callmode18" class="${pushState.mode==='CALL'?'on':''}">В МЕНЯ ПУШ</button></div><div class="panel18"><div class="label18">ПОЗИЦИЯ</div><div class="pos18">${['UTG','HJ','CO','BTN','SB','BB'].map(x=>`<button data-pos18="${x}" class="${x===pushState.pos?'on':''}">${x}</button>`).join('')}</div><div class="label18" style="margin-top:13px">РУКА</div><div class="cards18">${window.cardButton18('ph1','A♠')}${window.cardButton18('ph2','7♠')}</div><div class="read18" style="margin-top:13px"><span>Эффективный стек</span><strong id="stackr">${pushState.stack} ББ</strong></div><input id="stack18" class="range18" type="range" min="3" max="30" value="${pushState.stack}"></div><div class="panel18"><div class="label18">СТАДИЯ</div><div class="stages18">${[['START','СТАРТ'],['MID','MID'],['BUBBLE','БАББЛ'],['ITM','ITM'],['FT','FT']].map(x=>`<button data-stage18="${x[0]}" class="${x[0]===pushState.stage?'on':''}">${x[1]}</button>`).join('')}</div><div id="v33IcmFields" class="v33IcmFields ${['BUBBLE','FT'].includes(pushState.stage)?'show':''}"><p>Для точного ICM нужны выплаты и стеки всех игроков. Пока матрица показывает только осторожный chipEV-ориентир.</p><div><input id="v33Paid" type="number" min="1" placeholder="оплачиваемых мест"><input id="v33Left" type="number" min="2" placeholder="игроков осталось"></div></div></div><div id="pout18" class="answer18"></div><div class="panel18 v33MatrixPanel"><div class="v33MatrixHead"><div><span class="label18">МАТРИЦА РУК</span><p>Нажми класс руки — карты и разбор обновятся.</p></div><div class="v33MatrixLegend"><i class="go"></i> играть <i class="mix"></i> микс <i class="fold"></i> пас</div></div><div class="v33HandMatrix" id="v33PushMatrix"></div></div><div class="panel18"><div class="label18">НАЙДИ ГРАНИЦУ</div><p class="small mut">Проверь, на каком стеке действие меняется.</p><input id="bound18" class="range18" type="range" min="3" max="30" value="${pushState.bound}"><div id="boundr" class="small"></div></div><div class="aggroRule"><b>Метод:</b> reference policy по позиции, классу руки и стеку. Баббл/финалка без payout structure и всех стеков не называются точным ICM.</div></div>`;
  };
  window.wirePush18=function wirePushV33(){
    const setCard=(id,value)=>{const el=q('#'+id);if(!el)return;el.dataset.card=value;window.refreshCardButton18(id)};
    setCard('ph1',pushState.h1||'As');setCard('ph2',pushState.h2||'7s');
    const currentClass=()=>window.GTOBrainV20?.handClass(q('#ph1')?.dataset.card,q('#ph2')?.dataset.card)||'';
    const renderMatrix=()=>{
      const root=q('#v33PushMatrix');if(!root)return;root.innerHTML=pushMatrixHtml(currentClass());
      qa('[data-v33-pf]',root).forEach(button=>button.onclick=()=>{
        const cards=Brain.representative(button.dataset.v33Pf);if(cards.length<2)return;
        pushState.h1=cards[0];pushState.h2=cards[1];setCard('ph1',cards[0]);setCard('ph2',cards[1]);render();
      });
    };
    const render=()=>{
      const stack=q('#stack18');if(stack)pushState.stack=Number(stack.value);
      const bound=q('#bound18');if(bound)pushState.bound=Number(bound.value);
      const h=[q('#ph1')?.dataset.card||null,q('#ph2')?.dataset.card||null];pushState.h1=h[0];pushState.h2=h[1];
      if(!h.every(Boolean)){q('#pout18').innerHTML='<p>Выбери две карты.</p>';return}
      const r=window.push18(h,pushState.pos,pushState.stack,pushState.stage,pushState.mode),z=window.push18(h,pushState.pos,pushState.bound,pushState.stage,pushState.mode);
      q('#stackr').textContent=pushState.stack+' ББ';q('#pout18').className='answer18 '+(r.label==='FOLD'?'bad18':r.label==='MIX'?'mix18':'good18');
      const icm=['BUBBLE','FT'].includes(pushState.stage)?'<span class="v33ContextFlag">ICM-ДАННЫЕ НЕПОЛНЫЕ</span>':'<span class="v33ContextFlag ok">CHIP-EV КОНТЕКСТ</span>';
      q('#pout18').innerHTML=`<span class="ey">${r.c} · ${pushState.pos} · ${pushState.stack} ББ</span><h2>${r.label}</h2><p>${pushState.mode==='CALL'?'Продолжение':'Агрессивное действие'} ${r.p}% · альтернатива ${Math.max(0,100-(r.p||0))}%</p><div class="pfWhy24"><b>ПОЧЕМУ</b>${esc(pushWhy(r))}</div>${icm}`;
      q('#boundr').textContent=`${pushState.bound} ББ → ${z.label} · ${z.p}%`;
      q('#v33IcmFields')?.classList.toggle('show',['BUBBLE','FT'].includes(pushState.stage));
      renderMatrix();enhanceDirectInputs(q('.v33Push')||document);
    };
    qa('[data-pos18]').forEach(button=>button.onclick=()=>{pushState.pos=button.dataset.pos18;qa('[data-pos18]').forEach(x=>x.classList.toggle('on',x===button));render()});
    qa('[data-stage18]').forEach(button=>button.onclick=()=>{pushState.stage=button.dataset.stage18;qa('[data-stage18]').forEach(x=>x.classList.toggle('on',x===button));render()});
    q('#first18').onclick=()=>{pushState.mode='PUSH';q('#first18').classList.add('on');q('#callmode18').classList.remove('on');render()};
    q('#callmode18').onclick=()=>{pushState.mode='CALL';q('#callmode18').classList.add('on');q('#first18').classList.remove('on');render()};
    window.bindCardPicker18(['ph1','ph2'],render);
    ['stack18','bound18'].forEach(id=>q('#'+id)?.addEventListener('input',render));
    render();
  };

  /* ---------- Hand Review: line notes, carried pot, street storytelling ---------- */
  function reachedStreetKeys(){
    const order=['pre','flop','turn','river'],out=[];
    for(const key of order){if(!window.HR22?.streets?.[key]?.heroAction)break;out.push(key);if(window.HR22.streets[key].heroAction==='FOLD')break}
    return out;
  }
  function actionRu(action){return({NONE:'—',LIMP:'лимп',RAISE:'рейз',PUSH:'олл-ин',FOLD:'пас',CALL:'колл',CHECK:'чек',BET:'бет'}[action]||action||'—')}
  function streetLine(key){
    const s=window.HR22.streets[key],post=key!=='pre',u=post?'%':' ББ';
    const sized=a=>['BET','RAISE','PUSH'].includes(a);
    return `Оппонент: ${actionRu(s.villAction)}${sized(s.villAction)?` ${s.villSize}${u}`:''} → Hero: ${actionRu(s.heroAction)}${sized(s.heroAction)?` ${s.heroSize}${u}`:''}`;
  }
  function suggestedPot(key){
    const order=['pre','flop','turn','river'],i=order.indexOf(key);if(i<=0)return null;
    const prev=window.HR22.streets[order[i-1]],base=Number(prev.pot)||0;
    if(order[i-1]==='pre'){
      if(prev.villAction==='RAISE'&&prev.heroAction==='CALL')return Math.max(base+2*Number(prev.villSize||0),3);
      if(prev.heroAction==='RAISE'&&['NONE','LIMP'].includes(prev.villAction))return Math.max(base+Number(prev.heroSize||0),3);
      return base;
    }
    const villBet=prev.villAction==='BET'?base*Number(prev.villSize||0)/100:0;
    const heroBet=prev.heroAction==='BET'?base*Number(prev.heroSize||0)/100:prev.heroAction==='CALL'?villBet:0;
    return Number((base+villBet+heroBet).toFixed(1));
  }
  function enhanceHandBuilder(){
    const root=q('#myArea .hr22');if(!root||!window.HR22)return;
    enhanceDirectInputs(root);
    if(window.HR22.step!==1||root.querySelector('.v33LineNote'))return;
    const key=window.HR22.street,s=window.HR22.streets[key];
    const panel=root.querySelector('.panel18');if(!panel)return;
    const box=document.createElement('div');box.className='v33LineNote';
    const suggestion=key!=='pre'?suggestedPot(key):null;
    box.innerHTML=`<span>ДЕЙСТВИЯ ДО ЭТОЙ ТОЧКИ · МОЖНО ДОПИСАТЬ</span><p>${esc(streetLine(key))}</p><textarea id="v33HistoryNote" placeholder="Например: BTN open 2,2 ББ → BB call; флоп чек → bet 33% → call">${esc(s.historyNote||'')}</textarea>${suggestion!=null?`<button type="button" id="v33CarryPot">ПОДСТАВИТЬ БАНК ИЗ ПРОШЛОЙ УЛИЦЫ · ≈ ${suggestion} ББ</button>`:''}<small>Эта заметка попадёт в итоговый разбор. Если размер неизвестен — так и напиши, приложение не будет его выдумывать.</small>`;
    panel.appendChild(box);
    q('#v33HistoryNote').oninput=event=>{s.historyNote=event.target.value};
    const carry=q('#v33CarryPot');if(carry)carry.onclick=()=>{s.pot=suggestion;const range=q('#hrpot');if(range){range.value=suggestion;range.dispatchEvent(new Event('input',{bubbles:true}))}enhanceDirectInputs(root)};
  }
  const reconBase=window.reconView18;
  window.reconView18=function reconViewV33(){const value=reconBase.apply(this,arguments);setTimeout(enhanceHandBuilder,0);return value};

  const streetEvalBase=window.hr22StreetEval;
  window.hr22StreetEval=function streetEvalV33(key){
    const result=streetEvalBase.apply(this,arguments),state=window.HR22,s=state?.streets?.[key];if(!state||!s)return result;
    const board=key==='pre'?[]:s.board.filter(Boolean),street={pre:'PREFLOP',flop:'FLOP',turn:'TURN',river:'RIVER'}[key];
    const story=Brain.streetStory({street,hero:state.hero,board,pos:{hero:state.heroPos,villain:state.villPos},preflop:`${streetLine('pre')}`,current:streetLine(key)});
    let recommendation=result.why;
    const cls=window.GTOBrainV20?.handClass(state.hero[0],state.hero[1]);
    const ranks=board.map(c=>Brain.cardCode(c)[0]).join('');
    if(key==='turn'&&cls==='KQo'&&['JT85','TJ85'].some(x=>[...x].every(r=>ranks.includes(r)))&&s.villAction==='CHECK'){
      recommendation='KQ здесь имеет две оверкарты и сильное стрит-дро. После чека BB ставка — основной учебный ориентир; чек оставляем как контекстную альтернативу, а не как автоматический ответ.';
      if(s.heroAction==='BET'){result.status='good';result.label='ОСНОВНАЯ ЛИНИЯ';result.score=86}else if(s.heroAction==='CHECK'){result.status='warn';result.label='НУЖЕН КОНТЕКСТ';result.score=62}
    }
    result.story=story;result.why=`${story} ${s.historyNote?`Дополнительная история: ${s.historyNote}. `:''}${recommendation} Это reference-ориентир; точный ответ меняют префлоп-сайзинг, диапазоны, ICM и риды.`;
    return result;
  };
  function handContextScore(){
    const state=window.HR22,reached=reachedStreetKeys();if(!state)return 0;
    let score=0;if(state.hero?.every(Boolean))score+=18;if(state.heroPos&&state.villPos)score+=12;if(Number(state.stack)>0)score+=10;
    if(state.format)score+=5;if(reached.includes('pre'))score+=18;
    const post=reached.filter(x=>x!=='pre');score+=Math.round(post.length/3*27);
    if(post.every(x=>Number(state.streets[x].pot)>0))score+=5;
    if(reached.some(x=>state.streets[x].historyNote))score+=5;
    return Math.min(100,score);
  }
  function injectHandReportContext(){
    const root=q('#myArea .hr22'),hero=root?.querySelector('.hr22ReportHero');if(!root||!hero||root.querySelector('.v33HandContext'))return;
    const score=handContextScore(),reached=reachedStreetKeys(),state=window.HR22;
    const names={pre:'ПРЕФЛОП',flop:'ФЛОП',turn:'ТЁРН',river:'РИВЕР'};
    const timeline=reached.map(key=>`<div><b>${names[key]}</b><span>${esc(streetLine(key))}</span>${state.streets[key].historyNote?`<small>${esc(state.streets[key].historyNote)}</small>`:''}</div>`).join('');
    hero.insertAdjacentHTML('afterend',`<div class="v33HandContext"><div class="v33ContextHead"><span>ВОССТАНОВЛЕНО ${reached.length}/4 УЛИЦ</span><b>${score}% контекста</b></div><div class="v33Timeline">${timeline}</div><p>Оценка отражает качество выбранной линии относительно учебной модели. Результат банка не меняет оценку прошлого решения.</p></div>`);
    humanizeLabels(root);
  }
  const reportBase=window.hr22Report;
  window.hr22Report=function handReportV33(){const value=reportBase.apply(this,arguments);setTimeout(injectHandReportContext,0);return value};

  /* ---------- X-Ray: custom hero/board + a range that cannot resurrect ---------- */
  const xray={active:false,started:false,pos:'BTN',hero:[null,null],board:[null,null,null,null,null],stage:0,current:new Set(),candidate:new Set(),lines:['','','',''],funnel:[]};
  const stageNames=['ПРЕФЛОП','ФЛОП','ТЁРН','РИВЕР'];
  const deadAt=stage=>[...xray.hero,...xray.board.slice(0,[0,3,4,5][stage])].filter(Boolean);
  const requiredBoard=stage=>[0,3,4,5][stage];
  function customMatrix(){
    return Brain.matrixClasses().map(k=>`<button type="button" class="v33MatrixCell ${xray.candidate.has(k)?xray.current.has(k)?'go':'fold':'dead'}" data-v33-xr="${k}" ${xray.candidate.has(k)?'':'disabled'}><span>${k}</span></button>`).join('');
  }
  function syncXrayCards(){
    ['v33xh1','v33xh2'].forEach((id,i)=>{const el=q('#'+id);if(el){el.dataset.card=xray.hero[i]||'';window.refreshCardButton18(id)}});
    for(let i=0;i<5;i++){const el=q('#v33xb'+i);if(el){el.dataset.card=xray.board[i]||'';window.refreshCardButton18(el.id)}}
  }
  function readXrayCards(){
    xray.hero=['v33xh1','v33xh2'].map(id=>q('#'+id)?.dataset.card||null);
    xray.board=Array.from({length:5},(_,i)=>q('#v33xb'+i)?.dataset.card||null);
  }
  function xrayCounts(){return {raw:Brain.comboCount(xray.current,[]),live:Brain.comboCount(xray.current,deadAt(xray.stage)),classes:xray.current.size}}
  function renderCustomXray(){
    const area=q('#xrayArea');if(!area)return;
    const counts=xrayCounts(),need=requiredBoard(xray.stage),line=xray.lines[xray.stage]||'';
    area.innerHTML=`<div class="xrStage v33CustomXray"><div class="toolTop"><button class="back18" id="v33XrBack">←</button><div><span class="ey">◎ СВОЙ РЕНТГЕН</span><h2>РУКА + БОРД + ЖИВОЙ RANGE</h2></div></div><div class="v33XrSetup"><label>ПОЗИЦИЯ ОППОНЕНТА<select id="v33XrPos">${['UTG','HJ','CO','BTN','SB','BB'].map(p=>`<option ${p===xray.pos?'selected':''}>${p}</option>`).join('')}</select></label><div><span>ТВОЯ РУКА</span><div class="cards18">${window.cardButton18('v33xh1','A♠')}${window.cardButton18('v33xh2','K♥')}</div></div><div><span>БОРД ДО РИВЕРА</span><div class="v33XrBoard">${Array.from({length:5},(_,i)=>window.cardButton18('v33xb'+i,'—',true)).join('')}</div></div></div>${!xray.started?`<div class="v33XrIntro"><h3>СТАРТОВЫЙ RANGE · ${xray.pos}</h3><p>Начни с позиционного пресета, затем вручную убирай классы после каждого действия. Убитые руки на следующей улице не воскреснут.</p><button class="primary" id="v33XrStart">НАЧАТЬ С ПРЕСЕТА ${xray.pos} →</button></div>`:`<div class="v33XrProgress">${stageNames.map((name,i)=>`<span class="${i<xray.stage?'done':i===xray.stage?'on':''}">${name}</span>`).join('')}</div><div class="v33XrLine"><label>ЛИНИЯ ОППОНЕНТА · ${stageNames[xray.stage]}<input id="v33XrLine" value="${esc(line)}" placeholder="например: check-call 33%"></label></div><div class="v33XrStats"><div><span>КЛАССОВ</span><b>${counts.classes}</b></div><div><span>КОМБО ДО БЛОКЕРОВ</span><b>${counts.raw}</b></div><div><span>ЖИВЫХ КОМБО</span><b>${counts.live}</b></div></div>${need&&!xray.board.slice(0,need).every(Boolean)?`<div class="v33XrWarning">Для ${stageNames[xray.stage].toLowerCase()} выбери ${need} карт борда.</div>`:''}<div class="v33MatrixHead"><div><span class="label18">ОСТАВЬ РЕАЛЬНЫЕ РУКИ</span><p>Зелёные остаются, тёмные убраны.</p></div></div><div class="v33HandMatrix" id="v33XrMatrix">${customMatrix()}</div><div class="v33XrActions"><button class="secondary" id="v33XrResetStreet">ВЕРНУТЬ УЛИЦУ</button><button class="primary" id="v33XrNext">${xray.stage<3?'ЗАФИКСИРОВАТЬ → '+stageNames[xray.stage+1]:'ЗАВЕРШИТЬ RANGE →'}</button></div>${xray.funnel.length?`<div class="v33Funnel">${xray.funnel.map((x,i)=>`<span>${stageNames[i]} <b>${x}</b></span>`).join('<i>→</i>')}</div>`:''}`}</div>`;
    syncXrayCards();
    q('#v33XrBack').onclick=()=>{xray.active=false;xray.started=false;window.renderXray()};
    q('#v33XrPos').onchange=event=>{xray.pos=event.target.value;if(!xray.started)renderCustomXray()};
    window.bindCardPicker18(['v33xh1','v33xh2','v33xb0','v33xb1','v33xb2','v33xb3','v33xb4'],()=>{readXrayCards();renderCustomXray()});
    if(!xray.started){q('#v33XrStart').onclick=()=>{readXrayCards();xray.started=true;xray.stage=0;xray.current=Brain.rangePreset(xray.pos);xray.candidate=new Set(xray.current);xray.funnel=[];xray.lines=['','','',''];renderCustomXray()};return}
    q('#v33XrLine').oninput=event=>{xray.lines[xray.stage]=event.target.value};
    qa('[data-v33-xr]').forEach(button=>button.onclick=()=>{const k=button.dataset.v33Xr;xray.current.has(k)?xray.current.delete(k):xray.current.add(k);renderCustomXray()});
    q('#v33XrResetStreet').onclick=()=>{xray.current=new Set(xray.candidate);renderCustomXray()};
    q('#v33XrNext').onclick=()=>{
      readXrayCards();const need=requiredBoard(xray.stage);
      if(need&&!xray.board.slice(0,need).every(Boolean)){window.openModal(`<span class="ey">НЕ ХВАТАЕТ БОРДА</span><h2>ВЫБЕРИ ${need} КАРТ</h2><p>Без карт этой улицы блокеры и число комбинаций будут неверными.</p>`);return}
      xray.funnel[xray.stage]=Brain.comboCount(xray.current,deadAt(xray.stage));
      if(xray.stage<3){xray.stage++;xray.candidate=new Set(xray.current);renderCustomXray();return}
      if(window.S){window.S.xray=window.S.xray||{};window.S.xray.customRuns=(window.S.xray.customRuns||0)+1;window.save?.()}
      const final=xrayCounts();
      q('.v33CustomXray').insertAdjacentHTML('beforeend',`<div class="v33XrDone"><span class="ey">RANGE ДОШЁЛ ДО РИВЕРА</span><h2>${final.live} живых комбинаций</h2><p>${xray.current.size} классов после линии: ${esc(xray.lines.filter(Boolean).join(' → ')||'действия не подписаны')}.</p><button class="secondary" id="v33XrAgain">НОВЫЙ RANGE</button></div>`);
      q('#v33XrNext').disabled=true;q('#v33XrAgain').onclick=()=>{xray.started=false;xray.stage=0;renderCustomXray()};
    };
  }
  const renderXrayBase=window.renderXray;
  window.renderXray=function renderXrayV33(){
    if(xray.active){renderCustomXray();return}
    const value=renderXrayBase.apply(this,arguments);
    setTimeout(()=>{
      const root=q('#xrayArea .xrStage');if(root&&!q('#v33XrayCustom')){
        root.insertAdjacentHTML('beforeend','<button class="secondary v33CustomButton" id="v33XrayCustom">СВОЯ РУКА И СВОЙ БОРД →</button><p class="v33CustomHint">Выбери карты, стартовый диапазон и проведи оставшиеся комбинации до ривера.</p>');
        q('#v33XrayCustom').onclick=()=>{xray.active=true;renderCustomXray()};
      }
      humanizeLabels(q('#xrayArea')||document);
    },0);
    return value;
  };

  /* ---------- Global wiring / build marker ---------- */
  const observer=new MutationObserver(records=>{
    if(!records.some(r=>r.addedNodes.length))return;
    requestAnimationFrame(()=>{enhanceDirectInputs();humanizeLabels(document)});
  });
  observer.observe(document.body,{subtree:true,childList:true});
  enhanceDirectInputs();humanizeLabels(document);
  document.documentElement.dataset.pokerSwipeVersion='33.0';
  window.PokerSwipeCore.version='33.0';
  const build=q('.build');if(build)build.textContent='V33 УМНАЯ ЛИНИЯ';
})();
