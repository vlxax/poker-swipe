export const DEFAULT_RANKS=['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
export const ACTIONS=['AI','nAI','RAISE','LOW_PLAYABILITY','UNSELECTED'];
export const USER_UNANSWERED='UNANSWERED';
export const SHAPE_ACTIVE='ACTIVE';

export function handAt(r,c,ranks=DEFAULT_RANKS){const a=ranks[r],b=ranks[c];if(r===c)return a+a;return r<c?a+b+'s':b+a+'o';}
export function canonicalHands(ranks=DEFAULT_RANKS){const out=[];for(let r=0;r<13;r++)for(let c=0;c<13;c++)out.push(handAt(r,c,ranks));return out;}
export function comboFor(h){return h.length===2?6:(h.endsWith('s')?4:12);}
export function comboCount(iterable){let n=0;for(const h of iterable||[])n+=comboFor(h);return n;}
export function actionMap(chart){const out={};for(const [a,v] of Object.entries(chart?.actions||{}))for(const h of (v?.hands||[]))out[h]=a;return out;}
export function activeHands(chart){const m=actionMap(chart);return Object.keys(m).filter(h=>m[h]!=='UNSELECTED');}

export function shapeComparison(chart,paint){const truth=new Set(activeHands(chart)),mine=new Set(paint||[]);const overlap=[...mine].filter(h=>truth.has(h));const extras=[...mine].filter(h=>!truth.has(h));const miss=[...truth].filter(h=>!mine.has(h));const mineC=comboCount(mine),truthC=comboCount(truth),overlapC=comboCount(overlap),extraC=comboCount(extras),missC=comboCount(miss);const precision=mineC?overlapC/mineC:0,recall=truthC?overlapC/truthC:0;const f1=(precision+recall)?2*precision*recall/(precision+recall):0;return{truth,mine,overlap,extras,miss,mineC,truthC,overlapC,extraC,missC,precision,recall,score:Math.round(f1*100)};}

export function actionComparison(chart,userActions){
  const truth=actionMap(chart),user=userActions instanceof Map?Object.fromEntries(userActions):{...(userActions||{})};
  let totalC=0,answeredC=0,correctC=0;const mismatches=[],unanswered=[],confusion={};
  for(const h of canonicalHands()){
    const t=truth[h]||'UNSELECTED',has=Object.prototype.hasOwnProperty.call(user,h),u=has?user[h]:USER_UNANSWERED,w=comboFor(h);totalC+=w;
    if(!has){unanswered.push({h,truth:t,user:USER_UNANSWERED,combos:w});continue;}
    answeredC+=w;if(t===u)correctC+=w;else mismatches.push({h,truth:t,user:u,combos:w});const key=`${u}->${t}`;confusion[key]=(confusion[key]||0)+w;
  }
  const accuracy=answeredC?correctC/answeredC:0,coverage=totalC?answeredC/totalC:0;
  return{truth,user,totalC,answeredC,correctC,mismatches,unanswered,accuracy,coverage,accuracyPct:Math.round(accuracy*100),coveragePct:Math.round(coverage*100),score:Math.round(accuracy*coverage*100),confusion};
}

function rankIndex(r){return DEFAULT_RANKS.indexOf(r);}
export function familyForHand(h){
  if(h.length===2)return 'POCKET_PAIRS';
  const suited=h.endsWith('s'),a=h[0],b=h[1];
  const suffix=suited?'SUITED':'OFFSUIT';
  if(a==='A')return `AX_${suffix}`;
  if(a==='K')return `KX_${suffix}`;
  if(a==='Q')return `QX_${suffix}`;
  if(a==='J')return `JX_${suffix}`;
  if(a==='T')return `TX_${suffix}`;
  const gap=Math.abs(rankIndex(a)-rankIndex(b));
  if(suited&&gap===1)return 'SUITED_CONNECTORS';
  if(suited&&gap===2)return 'SUITED_GAPPERS';
  if(!suited&&gap===1)return 'OFFSUIT_CONNECTORS';
  return suited?'OTHER_SUITED':'OTHER_OFFSUIT';
}
export const FAMILY_LABELS={POCKET_PAIRS:'карманные пары',AX_SUITED:'suited Ax',AX_OFFSUIT:'offsuit Ax',KX_SUITED:'suited Kx',KX_OFFSUIT:'offsuit Kx',QX_SUITED:'suited Qx',QX_OFFSUIT:'offsuit Qx',JX_SUITED:'suited Jx',JX_OFFSUIT:'offsuit Jx',TX_SUITED:'suited Tx',TX_OFFSUIT:'offsuit Tx',SUITED_CONNECTORS:'suited connectors',SUITED_GAPPERS:'suited gappers',OFFSUIT_CONNECTORS:'offsuit connectors',OTHER_SUITED:'прочие suited руки',OTHER_OFFSUIT:'прочие offsuit руки'};

export function conceptLeaks(chart,{mode='shape',paint=new Set(),userActions=new Map()}={}){
  const rows=new Map();const add=(h,type,combos,truth,user)=>{const family=familyForHand(h),x=rows.get(family)||{family,label:FAMILY_LABELS[family]||family,extraC:0,missC:0,wrongC:0,unansweredC:0,hands:[]};x[type]+=combos;x.hands.push({h,truth,user,type,combos});rows.set(family,x);};
  if(mode==='actions'){
    const cmp=actionComparison(chart,userActions);for(const x of cmp.mismatches)add(x.h,'wrongC',x.combos,x.truth,x.user);for(const x of cmp.unanswered)add(x.h,'unansweredC',x.combos,x.truth,x.user);
  }else{
    const cmp=shapeComparison(chart,paint);for(const h of cmp.extras)add(h,'extraC',comboFor(h),'UNSELECTED',SHAPE_ACTIVE);for(const h of cmp.miss)add(h,'missC',comboFor(h),actionMap(chart)[h]||'UNSELECTED','INACTIVE');
  }
  return [...rows.values()].map(x=>({...x,severity:x.extraC+x.missC+x.wrongC+x.unansweredC})).sort((a,b)=>b.severity-a.severity||a.label.localeCompare(b.label));
}

export function boundaryHands(chart,{includeAction=true}={}){const map=actionMap(chart),rows=[];for(let r=0;r<13;r++)for(let c=0;c<13;c++){const h=handAt(r,c),a=map[h]||'UNSELECTED';let participation=0,action=0;for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const rr=r+dr,cc=c+dc;if(rr<0||rr>=13||cc<0||cc>=13)continue;const nh=handAt(rr,cc),na=map[nh]||'UNSELECTED';if((a!=='UNSELECTED')!==(na!=='UNSELECTED'))participation++;if(includeAction&&a!==na)action++;}if(participation||action)rows.push({h,a,participation,action,score:participation*3+action,kind:participation?'matrix-participation':'matrix-action'});}return rows.sort((x,y)=>y.score-x.score||y.participation-x.participation||x.h.localeCompare(y.h));}

export function semanticBoundaryHands(chart){
  const map=actionMap(chart),groups=new Map();
  for(const h of canonicalHands()){const f=familyForHand(h),arr=groups.get(f)||[];arr.push(h);groups.set(f,arr);}
  const rows=[];
  for(const [family,hands] of groups){hands.sort((a,b)=>canonicalHands().indexOf(a)-canonicalHands().indexOf(b));for(let i=0;i<hands.length;i++){const h=hands[i],a=map[h]||'UNSELECTED';let participation=0,action=0;for(const j of [i-1,i+1]){if(j<0||j>=hands.length)continue;const na=map[hands[j]]||'UNSELECTED';if((a!=='UNSELECTED')!==(na!=='UNSELECTED'))participation++;if(a!==na)action++;}if(participation||action)rows.push({h,a,family,label:FAMILY_LABELS[family]||family,participation,action,score:participation*5+action*2,kind:participation?'concept-participation':'concept-action'});}}
  return rows.sort((a,b)=>b.score-a.score||a.family.localeCompare(b.family)||a.h.localeCompare(b.h));
}

export function personalizedDrill(chart,{mode='shape',paint=new Set(),userActions=new Map(),limit=10}={}){
  const matrix=boundaryHands(chart,{includeAction:true}),semantic=semanticBoundaryHands(chart),all=[...semantic,...matrix],byHand=new Map();for(const b of all){const p=byHand.get(b.h);if(!p||b.score>p.score)byHand.set(b.h,b);}const items=[];
  if(mode==='actions'){
    const cmp=actionComparison(chart,userActions);for(const m of cmp.mismatches){const b=byHand.get(m.h);items.push({h:m.h,a:m.truth,type:'action-error',family:familyForHand(m.h),priority:200+(b?.score||0)});}for(const m of cmp.unanswered){const b=byHand.get(m.h);if(b)items.push({h:m.h,a:m.truth,type:'action-unanswered-boundary',family:familyForHand(m.h),priority:100+b.score});}
  }else{
    const cmp=shapeComparison(chart,paint);for(const h of [...cmp.miss,...cmp.extras]){const b=byHand.get(h);items.push({h,a:actionMap(chart)[h]||'UNSELECTED',type:'shape-error',family:familyForHand(h),priority:200+(b?.score||0)});}
  }
  for(const b of all){if(!items.some(x=>x.h===b.h))items.push({h:b.h,a:b.a,type:b.kind,family:b.family||familyForHand(b.h),priority:b.score});}
  items.sort((x,y)=>y.priority-x.priority||x.h.localeCompare(y.h));const out=[];const seen=new Set();for(const x of items){if(seen.has(x.h))continue;seen.add(x.h);out.push(x);if(out.length>=limit)break;}return out;
}

export function fisherYates(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function describeShapeLeak(cmp,leaks=[]){if(!cmp)return{title:'Нет результата',detail:''};if(cmp.missC===0&&cmp.extraC===0)return{title:'Форма совпала с source.',detail:'Ни лишних, ни пропущенных combos.'};const top=leaks[0];let title='Граница range смещена.';if(cmp.missC>cmp.extraC*1.25)title='Ты строишь range уже source.';else if(cmp.extraC>cmp.missC*1.25)title='Ты строишь range шире source.';return{title,detail:`${top?`Главный leak: ${top.label}. `:''}Лишних ${cmp.extraC} combos, пропущено ${cmp.missC}.`};}
export function describeActionLeak(cmp,leaks=[]){if(!cmp)return{title:'Нет результата',detail:''};if(cmp.coverage===0)return{title:'Ты ещё не разметила действия.',detail:'Неотвеченные клетки не считаются UNSELECTED. Начни с любой части матрицы.'};if(!cmp.mismatches.length&&cmp.coverage===1)return{title:'Действия совпали с source.',detail:'Все combo-weighted actions совпали.'};const pairs=Object.entries(cmp.confusion).filter(([k])=>{const [u,t]=k.split('->');return u!==t;}).sort((a,b)=>b[1]-a[1]);const top=pairs[0],family=leaks.find(x=>x.wrongC>0);return{title:cmp.coverage<.9?'Результат пока неполный.':'Главная ошибка — неверный action.',detail:`${family?`Главный leak: ${family.label}. `:''}${top?`${top[0]}: ${top[1]} combos. `:''}Coverage ${cmp.coveragePct}%.`};}
export function sourceModeLabel(v){const known={callpush:'КОЛЛ / ОЛЛ-ИН',vs1r:'ПРОТИВ РЕЙЗА',vssqueeze:'ПРОТИВ СКВИЗА',vs1r1c:'ПРОТИВ РЕЙЗА И КОЛЛА',vs3bet:'ПРОТИВ 3-БЕТА',vs2r:'ПРОТИВ ДВУХ РЕЙЗОВ',sbvsbb:'SB ПРОТИВ BB',vs1rshort:'ПРОТИВ КОРОТКОГО ОПЕНА',vs4bet:'ПРОТИВ 4-БЕТА',vslimp:'ПРОТИВ ЛИМПА'};return known[v]||v||'РЕНДЖ';}
export function safeChart(UO_DATA,position,stack){return UO_DATA?.charts?.find(c=>c.position===position&&c.stack_bb===stack)||null;}
export function validateUO(UO_DATA){const errors=[],seen=new Set(),canonical=new Set(canonicalHands(UO_DATA?.rank_order||DEFAULT_RANKS));for(const c of UO_DATA?.charts||[]){const map=actionMap(c),hands=Object.keys(map),set=new Set(hands);if(hands.length!==169)errors.push(`${c.id}: ${hands.length} hands`);if(set.size!==169)errors.push(`${c.id}: duplicate hand`);if(comboCount(hands)!==1326)errors.push(`${c.id}: combo total ${comboCount(hands)}`);for(const h of canonical)if(!set.has(h))errors.push(`${c.id}: missing canonical ${h}`);for(const h of set)if(!canonical.has(h))errors.push(`${c.id}: unexpected hand ${h}`);const key=`${c.position}|${c.stack_bb}`;if(seen.has(key))errors.push(`${c.id}: duplicate position/stack ${key}`);seen.add(key);}for(const p of UO_DATA?.positions||[])for(const s of UO_DATA?.stack_bands||[])if(!seen.has(`${p}|${s}`))errors.push(`missing ${p}|${s}`);return{ok:errors.length===0,errors,charts:UO_DATA?.charts?.length||0};}
