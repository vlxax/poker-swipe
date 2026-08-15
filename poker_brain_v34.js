/* PokerSwipe V34 — street-by-street teaching brain.
   Adds plain-language reasoning, explicit street evolution and tournament-context caveats
   on top of V33 without pretending to be a commercial solver. */
(function(){
  'use strict';
  const previous=window.PokerBrain;
  const V33=window.PokerBrainV33;
  if(!previous||!V33||typeof previous.gradeDecision!=='function')return;

  const RANK_VALUE={2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14};
  const STREET_RU={PREFLOP:'Префлоп',FLOP:'Флоп',TURN:'Тёрн',RIVER:'Ривер'};
  const ACTION_RU={FOLD:'фолд',CALL:'колл',CHECK:'чек',BET:'ставка',RAISE:'рейз',PUSH:'пуш'};
  const baseId=id=>String(id||'').replace(/_V\d+$/,'');
  const num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};
  const normAction=a=>{
    const s=String(a||'').toUpperCase();
    if(/ФОЛД|FOLD|ПАС/.test(s))return'FOLD'; if(/КОЛЛ|CALL/.test(s))return'CALL';
    if(/ЧЕК|CHECK/.test(s))return'CHECK'; if(/ПУШ|ОЛЛ|JAM|PUSH/.test(s))return'PUSH';
    if(/РЕЙЗ|RAISE|3.?БЕТ|3BET/.test(s))return'RAISE'; if(/СТАВ|BET/.test(s))return'BET'; return s;
  };
  const card=c=>V33.cardCode(c);
  const cards=a=>(a||[]).map(card).filter(Boolean);
  const rank=c=>RANK_VALUE[card(c)?.[0]]||0;
  const suit=c=>card(c)?.[1]||'';
  const label=c=>V33.cardLabel(c)||'';

  function hist(values){return values.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{});}
  function straightState(all){
    const vals=new Set(all.map(rank).filter(Boolean)); if(vals.has(14))vals.add(1);
    let made=false, open=false, gut=0;
    for(let low=1;low<=10;low++){
      const seq=[low,low+1,low+2,low+3,low+4], have=seq.filter(v=>vals.has(v));
      if(have.length===5)made=true;
      if(have.length===4){
        const missing=seq.find(v=>!vals.has(v));
        if(missing===low||missing===low+4)open=true; else gut++;
      }
    }
    return {made,open,gut};
  }
  function handFeatures(heroRaw,boardRaw){
    const hero=cards(heroRaw),board=cards(boardRaw),all=[...hero,...board];
    const boardRanks=board.map(rank), heroRanks=hero.map(rank), allRanks=all.map(rank);
    const boardHist=hist(boardRanks), allHist=hist(allRanks), suitHist=hist(all.map(suit));
    const maxBoard=Math.max(0,...boardRanks), minBoard=Math.min(99,...boardRanks);
    const pairs=Object.entries(allHist).filter(([,n])=>n>=2).map(([r,n])=>({r:+r,n})).sort((a,b)=>b.r-a.r);
    const trips=pairs.some(x=>x.n>=3), twoPair=pairs.filter(x=>x.n>=2).length>=2;
    const flushN=Math.max(0,...Object.values(suitHist));
    const st=straightState(all);
    const pocketPair=heroRanks.length===2&&heroRanks[0]===heroRanks[1];
    const boardPairRanks=new Set(Object.entries(boardHist).filter(([,n])=>n>=2).map(([r])=>+r));
    const heroPairRanks=heroRanks.filter(r=>boardRanks.includes(r));
    const topPair=heroPairRanks.includes(maxBoard);
    const overpair=pocketPair&&heroRanks[0]>maxBoard;
    const middlePair=heroPairRanks.length&&!topPair;
    const overcards=heroRanks.filter(r=>r>maxBoard).length;
    let made='без готовой пары';
    if(flushN>=5)made='флеш или сильнее'; else if(st.made)made='стрит или сильнее'; else if(trips)made='трипс или сильнее'; else if(twoPair)made='две пары'; else if(overpair)made='оверпара'; else if(topPair)made='топ-пара'; else if(middlePair)made='пара ниже топ-пары'; else if(pocketPair)made='карманная пара';
    const draw=[];
    if(flushN===4&&board.length<5)draw.push('флеш-дро');
    if(st.open)draw.push('двустороннее стрит-дро'); else if(st.gut>=2)draw.push('двойной гатшот'); else if(st.gut===1)draw.push('гатшот');
    return {made,draw,overcards,pocketPair,topPair,overpair,middlePair,maxBoard,minBoard,boardPairRanks};
  }

  function streetDelta(street,hero,board){
    if(street==='PREFLOP')return 'Постфлоп-карт ещё нет: решение строится вокруг позиции, глубины стека, размера открытия и игроков за спиной.';
    const n={FLOP:3,TURN:4,RIVER:5}[street]||board.length;
    const now=board.slice(0,n), before=street==='FLOP'?[]:board.slice(0,n-1);
    const a=handFeatures(hero,now), b=handFeatures(hero,before), newCard=now.at(-1);
    const bits=[];
    if(street==='FLOP')bits.push(`Пришёл флоп ${now.map(label).join(' ')}.`); else bits.push(`${STREET_RU[street]} ${label(newCard)}.`);
    if(a.made!==b.made)bits.push(`Готовая рука изменилась: ${b.made} → ${a.made}.`);
    const newDraw=a.draw.filter(x=>!b.draw.includes(x)); if(newDraw.length)bits.push(`Появилось ${newDraw.join(' и ')}.`);
    const lostDraw=b.draw.filter(x=>!a.draw.includes(x));
    if(street==='RIVER'&&lostDraw.length&&a.made===b.made)bits.push(`${lostDraw.join(' и ')} не закрылось.`);
    if(a.overcards===2&&a.made==='без готовой пары')bits.push('Обе карманные карты остаются оверкартами к борду.');
    return bits.join(' ');
  }

  function tournamentRead(context,spot){
    const stage=String(spot.stage||context.stage||'').toUpperCase();
    const eff=num(spot.stack??spot.effStack??spot.effectiveStackBB??context.stack);
    const avg=num(spot.avgStackBB??spot.averageStackBB);
    const left=num(spot.playersLeft??spot.left);
    const icm=/BUBBLE|FT|FINAL|PAYJUMP|ITM/.test(stage)||spot.icm===true;
    if(icm&&(!spot.payouts||!spot.tableStacks))return 'Турнирное давление возможно, но без выплат и стеков остальных игроков я не буду притворяться, что знаю точный ICM.';
    if(icm&&avg&&eff&&eff<=Math.max(20,avg*.9))return `Это ICM-чувствительная точка: effective ${eff} ББ при среднем около ${avg} ББ. Здесь допустимо сильнее беречь стек, чем в обычном chipEV-споте.`;
    if(left&&left<=20)return `Осталось ${left} игроков. Поздняя стадия может сдвигать частоты, поэтому жёсткий chipEV-автопилот опасен.`;
    return 'Специального ICM-сигнала в переданном контексте нет; базовый ориентир — chipEV и структура диапазонов.';
  }

  function rangeReason(spot,result,context){
    const concept=String(result.concept||spot.concept||'');
    const pos=context.pos||{};
    if(/RFI|preflop|open/i.test(concept)&&pos.hero)return `${pos.hero} задаёт ширину стартового диапазона: чем позже позиция, тем больше рук можно прибыльно продолжать.`;
    if(/BB defence|defen/i.test(concept))return 'BB уже вложил большой блайнд и получает лучшую цену, поэтому защищает заметно шире, чем игрок без вложенных фишек.';
    if(/dry|c-bet/i.test(concept))return 'На сухой доске у префлоп-агрессора чаще остаются сильные верхние пары и оверпары, поэтому маленькая ставка может давить на широкий слабый диапазон.';
    if(/dynamic|wet|connected/i.test(concept))return 'На связной доске у защищавшегося игрока больше двух пар, дро и сильных продолжений. Ставить «потому что мы агрессор» уже недостаточно.';
    if(context.street==='RIVER')return 'На ривере диапазоны уже узкие: важно, какие худшие руки платят на велью и какие реальные блефы остаются у соперника.';
    return 'Главный вопрос не «сильная ли у нас рука», а как наша рука взаимодействует с диапазоном соперника после всей предыдущей линии.';
  }

  function actionReason(result,chosen){
    const top=[...(result.topActions||[])].sort((a,b)=>Number(b.freq)-Number(a.freq));
    const best=top[0], mine=top.find(x=>normAction(x.action)===chosen);
    const bestPct=best?Math.round(Number(best.freq)*(Number(best.freq)<=1?100:1)):null;
    const minePct=mine?Math.round(Number(mine.freq)*(Number(mine.freq)<=1?100:1)):0;
    if(!best)return 'Модель не имеет достаточно надёжного action mix для этой точки, поэтому жёсткий вердикт ставить нельзя.';
    if(normAction(best.action)===chosen)return `${ACTION_RU[chosen]||chosen} — основная учебная линия (${bestPct}%). Она лучше всего соответствует сохранённому reference-сценарию.`;
    return `${ACTION_RU[chosen]||chosen} встречается примерно ${minePct}%, а основной ориентир — ${ACTION_RU[normAction(best.action)]||best.action} около ${bestPct}%. Поэтому выбранная линия требует отдельной причины, а не должна быть дефолтом.`;
  }

  function specialKQ(result,spot,action,size,context){
    if(baseId(spot.spotId||spot.id)!=='T_JT85_KQ')return result;
    const chosen=normAction(action), tour=tournamentRead(context,spot),icmSensitive=/ICM-чувствительная|Поздняя стадия/.test(tour);
    const policy=icmSensitive?{BET:.58,CHECK:.42}:{BET:.82,CHECK:.18};
    const freq=policy[chosen]||0, max=Math.max(...Object.values(policy));
    let ag=freq>=max*.85?'g':freq>=max*.4?'y':'r', sg=null;
    if(chosen==='BET'&&size!=null){const v=num(size);sg=v>=55&&v<=90?'g':v>=40&&v<=110?'y':'r';}
    const grade=ag==='r'||sg==='r'?'r':ag==='y'||sg==='y'?'y':'g';
    const score=Math.round(100*(.8*(freq/max)+.2*(sg==null?1:sg==='g'?1:sg==='y'?.65:.2)));
    return {...result,grade,actionGrade:ag,sizeGrade:sg,action:chosen,actionFrequency:freq,topActions:[{action:'BET',freq:policy.BET},{action:'CHECK',freq:policy.CHECK}],score,source:'PRO_REVIEWED_SCENARIO',confidence:icmSensitive?72:86,sizeBest:75,sizeDistance:size==null?null:Math.abs(num(size)-75),concept:'turn.semi_bluff.oesd_overcards'};
  }

  function buildSections(spot,result,context,chosen){
    const hero=cards(context.hero),board=cards(context.board),features=handFeatures(hero,board);
    const handLine=`Сейчас у Hero ${features.made}${features.draw.length?`, плюс ${features.draw.join(' и ')}`:''}${features.overcards===2&&features.made==='без готовой пары'?', и две оверкарты':''}.`;
    const before=`${context.preflop?`Префлоп: ${context.preflop}`:'Префлоп-линия не восстановлена.'}${context.street!=='PREFLOP'&&context.current?` До текущего решения: ${context.current}`:''}`;
    const change=streetDelta(context.street,hero,board);
    const range=rangeReason(spot,result,context);
    const action=actionReason(result,chosen);
    const tournament=tournamentRead(context,spot);
    const missing=context.missing?.length?`Не хватает: ${context.missing.slice(0,4).join(', ')}. Чем меньше этих данных, тем меньше доверия к частотам.`:'Ключевой контекст этой точки заполнен.';
    return {before,change,hand:handLine,range,action,tournament,missing};
  }

  function gradeDecision(spot={},action,size=null){
    let result=previous.gradeDecision(spot,action,size);
    const context=V33.contextForSpot(spot), chosen=normAction(action);
    result=specialKQ(result,spot,action,size,context);
    const sections=buildSections(spot,result,context,chosen);
    const compact=[sections.change,sections.hand,sections.action,sections.tournament].filter(Boolean).join(' ');
    const confidence=Math.min(Number(result.confidence)||0,Math.round(30+context.score*.7));
    return {...result,confidence,modelVersion:'34.0',explanation:compact,analysisDetails:{...(result.analysisDetails||{}),context,sections,assumptions:context.assumptions||[]}};
  }

  function analyzeHand(hand={}){
    const base=previous.analyzeHand?.(hand);
    const heroActions=(hand.actions||[]).filter(a=>String(a.actor).toUpperCase()==='HERO');
    if(!heroActions.length)return base;
    const streetReports=heroActions.map(a=>{
      const n={PREFLOP:0,FLOP:3,TURN:4,RIVER:5}[String(a.street||'').toUpperCase()]??0;
      const spot={...hand,spotId:'USER_HAND',street:a.street,pos:`${hand.heroSeat||'HERO'} vs ${hand.villainSeat||'VILLAIN'}`,hero:hand.hero||[],board:(hand.board||[]).slice(0,n),stack:hand.effStack,pot:a.potBefore||hand.pot,ctx:a.context||a.actionHistory||'',actionHistory:hand.actions,format:hand.format,stage:hand.stage,payouts:hand.payouts,tableStacks:hand.tableStacks,avgStackBB:hand.avgStackBB,playersLeft:hand.playersLeft};
      return {street:String(a.street||'').toUpperCase(),action:a.action,result:gradeDecision(spot,a.action,a.pct??null)};
    });
    const last=streetReports.at(-1)?.result;
    return {...base,match:last?.source||base?.match,confidence:last?.confidence??base?.confidence,result:last||base?.result,streetReports,summary:last?.explanation||base?.summary};
  }

  window.PokerBrainV34={version:'34.0',gradeDecision,analyzeHand,handFeatures,streetDelta,buildSections,tournamentRead};
  window.PokerBrain={...previous,version:'34.0',gradeDecision,analyzeHand};
})();
