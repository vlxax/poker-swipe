/* PokerSwipe V33 — contextual poker reference brain.
   This layer deliberately separates facts, assumptions and training guidance.
   It is not presented as a commercial solver or an exact ICM calculator. */
(function(){
  'use strict';

  const previous=window.PokerBrain;
  if(!previous||typeof previous.gradeDecision!=='function')return;

  const RANKS='23456789TJQKA';
  const MATRIX_RANKS=[...'AKQJT98765432'];
  const SUITS=['s','h','d','c'];
  const STREET_RU={PREFLOP:'префлоп',FLOP:'флоп',TURN:'тёрн',RIVER:'ривер'};
  const SOURCE_MAP={
    EXACT_REFERENCE_NODE:'CURATED_SCENARIO',
    PREFLOP_ATLAS:'REFERENCE_ATLAS',
    POSTFLOP_ATLAS:'STRUCTURAL_MODEL',
    LINE_MODEL:'LINE_REFERENCE',
    NO_MODEL:'INSUFFICIENT_CONTEXT'
  };

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};
  const baseId=id=>String(id||'').replace(/_V\d+$/,'');
  const normStreet=value=>{
    const s=String(value||'PREFLOP').toUpperCase();
    if(/ПРЕФЛОП|PRE/.test(s))return'PREFLOP';
    if(/ФЛОП|FLOP/.test(s))return'FLOP';
    if(/Т[ЕЁ]РН|TURN/.test(s))return'TURN';
    if(/РИВЕР|RIVER/.test(s))return'RIVER';
    return s;
  };
  const normAction=value=>{
    const a=String(value||'').toUpperCase();
    if(/ФОЛД|ПАС|FOLD/.test(a))return'FOLD';
    if(/КОЛЛ|CALL/.test(a))return'CALL';
    if(/ЧЕК|CHECK/.test(a))return'CHECK';
    if(/СТАВ|BET/.test(a))return'BET';
    if(/ПУШ|ОЛЛ|PUSH|JAM/.test(a))return'PUSH';
    if(/РЕЙЗ|RAISE|3-БЕТ|3BET/.test(a))return'RAISE';
    return a;
  };
  const cardCode=value=>{
    const raw=String(value||'').trim().replace(/^10/i,'T');
    if(raw.length<2)return'';
    const rank=raw[0].toUpperCase();
    const tail=raw.slice(1).toLowerCase();
    const suit=tail.includes('♠')||tail==='s'?'s':tail.includes('♥')||tail==='h'?'h':tail.includes('♦')||tail==='d'?'d':tail.includes('♣')||tail==='c'?'c':'';
    return RANKS.includes(rank)&&suit?rank+suit:'';
  };
  const rankValue=card=>RANKS.indexOf(cardCode(card)[0])+2;
  const cardLabel=card=>{const c=cardCode(card);return c?`${c[0]==='T'?'10':c[0]}${{s:'♠',h:'♥',d:'♦',c:'♣'}[c[1]]}`:''};

  function positions(spot={}){
    const raw=String(spot.pos||spot.heroSeat||spot.position||'').trim();
    const split=raw.split(/\s+(?:vs|против)\s+/i).map(x=>x.trim()).filter(Boolean);
    return {hero:(spot.heroPosition||split[0]||'').toUpperCase(),villain:(spot.villainPosition||split[1]||'').toUpperCase()};
  }

  function parseOpenSize(text=''){
    const t=String(text).replace(',','.');
    const m=t.match(/(?:откр(?:ыл|ыла|ытие)|open|raise|рейз)[^\d]{0,12}(\d+(?:\.\d+)?)\s*(?:bb|бб)/i);
    return m?num(m[1]):null;
  }

  function inferredPreflopLine(spot,pos,street){
    if(spot.preflopLine)return {text:String(spot.preflopLine),inferred:false,openSize:spot.openSizeBB??parseOpenSize(spot.preflopLine)};
    const current=String(spot.ctx||spot.context||'');
    if(street==='PREFLOP')return {text:current||'Действие до Hero не указано.',inferred:false,openSize:spot.openSizeBB??parseOpenSize(current)};
    if(/3\s*-?bet|3-бет/i.test(current))return {text:'3-bet pot; точные размеры префлопа не указаны.',inferred:true,openSize:null};
    const late=['BTN','CO','HJ','UTG'].includes(pos.hero),blind=['BB','SB'].includes(pos.villain);
    const villainLate=['BTN','CO','HJ','UTG'].includes(pos.villain),heroBlind=['BB','SB'].includes(pos.hero);
    const open=num(spot.openSizeBB)||2.2;
    if(late&&blind)return {text:`${pos.hero} открыл ${String(open).replace('.',',')} ББ → ${pos.villain} колл.`,inferred:spot.openSizeBB==null,openSize:open};
    if(villainLate&&heroBlind)return {text:`${pos.villain} открыл ${String(open).replace('.',',')} ББ → ${pos.hero} колл.`,inferred:spot.openSizeBB==null,openSize:open};
    return {text:'Префлоп-линия не восстановлена.',inferred:true,openSize:null};
  }

  function contextForSpot(spot={}){
    const street=normStreet(spot.street);
    const pos=positions(spot);
    const pre=inferredPreflopLine(spot,pos,street);
    const hero=(spot.hero||spot.heroCards||[]).map(cardCode).filter(Boolean);
    const board=(spot.board||[]).map(cardCode).filter(Boolean);
    const stack=num(spot.stack??spot.effStack??spot.effectiveStackBB);
    const pot=num(spot.pot??spot.potBB);
    const current=String(spot.currentLine||spot.ctx||spot.context||'').trim();
    const format=String(spot.format||spot.game||'').toUpperCase();
    const stage=String(spot.stage||'').toUpperCase();
    const explicitHistory=Array.isArray(spot.actionHistory)?spot.actionHistory.filter(Boolean).join(' → '):String(spot.actionHistory||'').trim();
    const facts=[
      {key:'hero',ok:hero.length===2,w:14,label:'карты Hero'},
      {key:'positions',ok:!!pos.hero&&!!pos.villain,w:12,label:'обе позиции'},
      {key:'stack',ok:stack!=null&&stack>0,w:10,label:'эффективный стек'},
      {key:'pot',ok:street==='PREFLOP'||(pot!=null&&pot>0),w:10,label:'банк перед решением'},
      {key:'board',ok:street==='PREFLOP'||board.length===({FLOP:3,TURN:4,RIVER:5}[street]||0),w:12,label:'полный борд улицы'},
      {key:'preflop',ok:street==='PREFLOP'||(!pre.inferred&&!!pre.text),w:17,label:'точная префлоп-линия и open-size'},
      {key:'current',ok:!!current||!!explicitHistory,w:14,label:'действия до решения'},
      {key:'format',ok:!!format,w:5,label:'формат/число игроков'},
      {key:'stage',ok:format!=='MTT'||!!stage,w:6,label:'стадия/ICM-контекст'}
    ];
    const score=Math.round(facts.reduce((s,x)=>s+(x.ok?x.w:0),0));
    const missing=facts.filter(x=>!x.ok).map(x=>x.label);
    const assumptions=[];
    if(pre.inferred&&street!=='PREFLOP')assumptions.push(`Префлоп принят как учебное допущение: ${pre.text}`);
    if((stage==='BUBBLE'||stage==='FT')&&(!spot.payouts||!spot.tableStacks))assumptions.push('Без выплат и стеков всего стола точный ICM-вывод невозможен.');
    const openKind=pre.openSize==null?'не указан':pre.openSize<=2.5?'стандартный':pre.openSize<=3?'увеличенный':'крупный';
    return {street,pos,hero,board,stack,pot,current,format,stage,preflop:pre.text,openSize:pre.openSize,openKind,explicitHistory,score,missing,assumptions};
  }

  function suitCounts(cards){return cards.map(cardCode).filter(Boolean).reduce((m,c)=>(m[c[1]]=(m[c[1]]||0)+1,m),{});}
  function maxSuit(cards){const counts=suitCounts(cards),entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);return entries[0]||['',0];}
  function straightWindows(cards){
    const values=new Set(cards.map(rankValue).filter(v=>v>=2));
    if(values.has(14))values.add(1);
    const windows=[];
    for(let low=1;low<=10;low++){
      const seq=Array.from({length:5},(_,i)=>low+i),have=seq.filter(v=>values.has(v));
      if(have.length===4)windows.push({low,missing:seq.find(v=>!values.has(v)),open:!values.has(low)||!values.has(low+4)});
      if(have.length===5)windows.push({low,made:true});
    }
    return windows;
  }
  function drawInfo(hero=[],board=[]){
    const all=[...hero,...board].map(cardCode).filter(Boolean),[suit,suitN]=maxSuit(all),windows=straightWindows(all);
    const madeStraight=windows.some(x=>x.made),draws=windows.filter(x=>!x.made);
    const topBoard=Math.max(0,...board.map(rankValue)),heroValues=hero.map(rankValue).filter(Boolean);
    return {
      flush:suitN>=5?'made':suitN===4&&board.length<5?'draw':null,
      flushSuit:suit,
      straight:madeStraight?'made':draws.length>=2?'double-gut/open-ended':draws.length===1?'gutshot/open-ended':null,
      twoOvercards:heroValues.length===2&&heroValues.every(v=>v>topBoard),
      windows:draws
    };
  }

  function textureText(board=[]){
    const cards=board.map(cardCode).filter(Boolean);if(cards.length<3)return'';
    const ranks=cards.map(rankValue),unique=new Set(ranks),[,nSuit]=maxSuit(cards),span=Math.max(...ranks)-Math.min(...ranks);
    const paired=unique.size<ranks.length,connected=span<=5||straightWindows(cards).length>0;
    const parts=[];
    if(paired)parts.push('спаренная');
    if(nSuit>=3)parts.push('монотонная');else if(nSuit===2)parts.push('двухмастная');else parts.push('радуга');
    parts.push(connected?'связная':'несвязная');
    return parts.join(', ');
  }

  function madeHandText(hero,board){
    let bucket='';
    try{bucket=previous.handBucket?.(hero.map(cardLabel),board.map(cardLabel))||previous.handBucket?.(hero,board)||''}catch(_){bucket=''}
    const map={AIR:'пока без готовой руки',OVERCARDS:'две оверкарты',DRAW:'дро',COMBO_DRAW:'комбо-дро',MIDDLE_PAIR:'средняя/карманная пара',TOP_PAIR:'топ-пара',OVERPAIR:'оверпара',TWO_PAIR_PLUS:'две пары или сильнее',NUTTED:'очень сильная готовая рука'};
    return map[bucket]||'';
  }

  function streetStory(input={}){
    const c=input.street&&input.hero&&input.board&&input.pos?input:contextForSpot(input);
    const street=normStreet(c.street),board=(c.board||[]).map(cardCode).filter(Boolean),hero=(c.hero||[]).map(cardCode).filter(Boolean);
    if(street==='PREFLOP'){
      const size=c.openSize!=null?`Размер открытия ${String(c.openSize).replace('.',',')} ББ — ${c.openKind}. `:'';
      return `${size}${c.preflop||c.current||'Сначала восстанови, кто открылся и каким размером.'}`.trim();
    }
    if(board.length<3)return'Борд заполнен не полностью — эволюцию текстуры пока не оценить.';
    const streetN={FLOP:3,TURN:4,RIVER:5}[street],prev=street==='FLOP'?[]:board.slice(0,streetN-1),next=board[streetN-1];
    const before=drawInfo(hero,prev),after=drawInfo(hero,board),parts=[];
    if(street==='FLOP')parts.push(`Флоп ${textureText(board)}.`);
    else parts.push(`${STREET_RU[street][0].toUpperCase()+STREET_RU[street].slice(1)} ${cardLabel(next)}: ${textureText(board)}.`);
    const made=madeHandText(hero,board);if(made)parts.push(`У Hero ${made}.`);
    if(after.flush==='draw'&&before.flush!=='draw')parts.push('На этой улице у Hero появилось флеш-дро.');
    if(street==='RIVER'&&before.flush==='draw')parts.push(after.flush==='made'?'Ривер закрыл флеш-дро.':'Ривер не закрыл флеш-дро.');
    if(after.straight&&before.straight!==after.straight){
      if(after.straight==='made')parts.push('Стрит закрылся.');
      else parts.push(`Появилось стрит-дро (${after.straight}).`);
    }
    if(street==='RIVER'&&before.straight&&!before.straight.includes('made')&&after.straight!=='made')parts.push('Ривер не закрыл стрит-дро.');
    if(after.twoOvercards)parts.push('Обе карманные карты выше старшей карты борда.');
    return parts.join(' ');
  }

  const WHY={
    'RFI BTN':'Поздняя позиция позволяет открывать шире: за спиной меньше игроков, а позиция помогает реализовать эквити.',
    'BB defence':'Большой блайнд уже вложил фишку и получает цену на защиту; решение всё равно зависит от размера открытия.',
    'dry board c-bet':'На сухом A-high у префлоп-агрессора обычно больше сильных Ax, поэтому небольшой c-bet может работать широким диапазоном.',
    'dynamic board':'Связный борд лучше взаимодействует с диапазоном защиты BB, поэтому автоматическая ставка всем диапазоном хуже.',
    'turn value barrel':'Сильная готовая рука продолжает добирать и не даёт бесплатную карту дро.',
    'thin value':'Ставка на тонкое велью оправдана только если можно назвать худшие руки, которые реально коллируют.',
    'river bluffcatch':'Сначала цена колла и набор велью/блефов соперника, затем сила собственной пары.',
    'price defence':'Маленький размер требует защищать больше рук, но не отменяет анализ диапазона и блокеров.'
  };

  function cleanWhy(spot,result){
    if(WHY[spot.concept])return WHY[spot.concept];
    const raw=String(spot.why||result.explanation||'').trim();
    return raw
      .replace(/range advantage/gi,'преимущество диапазона')
      .replace(/showdown(?: value)?/gi,'шоудаун-велью')
      .replace(/fold equity/gi,'фолд-эквити')
      .replace(/hand bucket/gi,'тип руки')
      .replace(/board texture/gi,'текстуру борда')
      .replace(/size-family/gi,'семейство размеров')
      .replace(/policy/gi,'стратегический ориентир')||'Для уверенного вывода не хватает контекста.';
  }

  function recomputeSpecial(result,spot,action,size){
    if(baseId(spot.spotId||spot.id)!=='T_JT85_KQ')return result;
    const chosen=normAction(action),policy={BET:.72,CHECK:.28},freq=policy[chosen]||0;
    const actionGrade=chosen==='BET'?'g':chosen==='CHECK'?'y':'r';
    let sizeGrade=null;
    if(chosen==='BET'&&size!=null){const v=num(size);sizeGrade=v>=55&&v<=100?'g':v>=40&&v<=120?'y':'r'}
    const grade=actionGrade==='r'||sizeGrade==='r'?'r':actionGrade==='y'||sizeGrade==='y'?'y':'g';
    const score=chosen==='BET'?(sizeGrade==='r'?62:sizeGrade==='y'?82:94):chosen==='CHECK'?58:20;
    return {...result,grade,actionGrade,sizeGrade,action:chosen,actionFrequency:freq,topActions:[{action:'BET',freq:.72},{action:'CHECK',freq:.28}],score,source:'PRO_REVIEWED_SCENARIO',confidence:78,sizeBest:75,sizeDistance:size==null?null:Math.abs(num(size)-75),concept:'turn.semi_bluff.oesd_overcards'};
  }

  function gradeDecision(spot={},action,size=null){
    let result=previous.gradeDecision(spot,action,size);
    result=recomputeSpecial(result,spot,action,size);
    const context=contextForSpot(spot),story=streetStory(context),special=baseId(spot.spotId||spot.id)==='T_JT85_KQ';
    const reason=special
      ?'KQ на JT85 после двух чеков — это не просто «есть шоудаун-велью»: у руки две оверкарты и сильное стрит-дро. Без особого ICM или эксплойтной причины ставка — основной учебный ориентир; чек остаётся допустимой альтернативой, а не автоматическим ответом.'
      :cleanWhy(spot,result);
    const limits=context.missing.length?`Вывод ограничен: не указаны ${context.missing.slice(0,3).join(', ')}.`:'Контекст решения восстановлен достаточно полно.';
    const confidence=Math.min(Number(result.confidence)||0,Math.round(34+context.score*.64));
    const source=SOURCE_MAP[result.source]||result.source||'REFERENCE_MODEL';
    return {...result,source,confidence,modelVersion:'33.0',explanation:`${story} ${reason} ${limits}`.replace(/\s+/g,' ').trim(),analysisDetails:{context,story,reason,limits,assumptions:context.assumptions}};
  }

  function analyzeHand(hand={}){
    const original=previous.analyzeHand?.(hand);
    if(!original?.result)return original;
    const last=(hand.actions||[]).filter(x=>x.actor==='HERO').at(-1);
    if(!last)return original;
    const count={FLOP:3,TURN:4,RIVER:5}[last.street]||0;
    const spot={...hand,spotId:'USER_HAND',street:last.street,pos:`${hand.heroSeat||'HERO'} vs ${hand.villainSeat||'VILLAIN'}`,hero:hand.hero||[],board:(hand.board||[]).slice(0,count),stack:hand.effStack,pot:last.potBefore||hand.pot,ctx:last.context||last.actionHistory||'Точка решения из сохранённой раздачи',actionHistory:hand.actions,format:hand.format};
    const result=gradeDecision(spot,last.action,last.pct??null);
    return {...original,match:result.source,confidence:result.confidence,result,summary:result.explanation};
  }

  function classCombos(handClass){
    const k=String(handClass||''),a=k[0],b=k[1],kind=k[2]||'';if(!a||!b)return[];
    const out=[];
    if(a===b){for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)out.push(a+SUITS[i]+'|'+b+SUITS[j]);return out}
    for(const s1 of SUITS)for(const s2 of SUITS){if(kind==='s'&&s1!==s2)continue;if(kind==='o'&&s1===s2)continue;out.push(a+s1+'|'+b+s2)}
    return out;
  }
  function comboCount(classes,dead=[]){const blocked=new Set(dead.map(cardCode).filter(Boolean));let total=0;for(const k of classes||[])for(const pair of classCombos(k)){const [a,b]=pair.split('|');if(!blocked.has(a)&&!blocked.has(b))total++}return total}
  function matrixClasses(){const out=[];for(let r=0;r<13;r++)for(let c=0;c<13;c++)out.push(r===c?MATRIX_RANKS[r]+MATRIX_RANKS[c]:r<c?MATRIX_RANKS[r]+MATRIX_RANKS[c]+'s':MATRIX_RANKS[c]+MATRIX_RANKS[r]+'o');return out}
  function representative(k){const combos=classCombos(k);return combos.length?combos[0].split('|'):[]}
  function classStrength(k){
    const pair=k.length===2,hi=RANKS.indexOf(k[0])+2,lo=RANKS.indexOf(k[1])+2,gap=Math.max(0,hi-lo-1);
    let x=hi*3+lo+(pair?34+hi*1.8:0)+(k.endsWith('s')?5:0)+(gap===0?4:gap===1?2:-gap*1.2)+(hi===14?4:0);
    return x;
  }
  function rangePreset(pos='BTN'){
    const pct={UTG:.18,HJ:.22,CO:.29,BTN:.45,SB:.50,BB:.58}[String(pos).toUpperCase()]||.30;
    const all=matrixClasses().sort((a,b)=>classStrength(b)-classStrength(a));
    return new Set(all.slice(0,Math.round(all.length*pct)));
  }

  window.PokerBrainV33={
    version:'33.0',contextForSpot,streetStory,drawInfo,textureText,cardCode,cardLabel,
    classCombos,comboCount,matrixClasses,representative,rangePreset,normAction,normStreet,
    truth:'Контекстная учебная reference-модель. Не коммерческий solver и не точный ICM-калькулятор.'
  };
  window.PokerBrain={...previous,version:'33.0',gradeDecision,analyzeHand,contextForSpot,streetStory};
})();
