import { actionMap, canonicalHands, familyForHand, FAMILY_LABELS, boundaryHands, semanticBoundaryHands, comboCount } from './core.js';

export const CONFIRMED_ACTIONS = new Set(['AI','RAISE','CALL','CHECK','4BET','5BET','ISOLATE','OVERLIMP']);
export const ACTION_LABELS = {
  AI:'ОЛЛ-ИН', RAISE:'РЕЙЗ', CALL:'КОЛЛ', CHECK:'ЧЕК', '4BET':'4-БЕТ', '5BET':'5-БЕТ',
  ISOLATE:'ИЗОЛЕЙТ', OVERLIMP:'ОВЕРЛИМП'
};

export function decodeStructured(rec, ranks){
  const raw=globalThis.atob ? globalThis.atob(rec.cells) : Buffer.from(rec.cells,'base64').toString('binary');
  const hands=canonicalHands(ranks), out={};
  for(let i=0;i<169;i++){
    const b0=raw.charCodeAt(i*3), b1=raw.charCodeAt(i*3+1), b2=raw.charCodeAt(i*3+2);
    const v=(b0<<16)|(b1<<8)|b2;
    const q=[(v>>16)&15,(v>>12)&15,(v>>8)&15,(v>>4)&15], coverage=(v&15)/15;
    if(!q.some(Boolean)){out[hands[i]]={action:'UNSELECTED',slot:-1,weights:{},coverage,pure:false,active:false};continue;}
    const bestSlot=q.indexOf(Math.max(...q)), top=q[bestSlot]/15, weights={};
    q.forEach((n,j)=>{ if(n && rec.labels[j]) weights[rec.labels[j]]=n/15; });
    out[hands[i]]={action:rec.labels[bestSlot],slot:bestSlot,weights,coverage,top,pure:coverage>=11/15&&top>=13/15,active:true};
  }
  return out;
}

export function strictCandidates(rec, modeChoices, ranks){
  const allowed=new Set((modeChoices[rec.mode]||[]).filter(a=>CONFIRMED_ACTIONS.has(a)));
  return Object.entries(decodeStructured(rec,ranks)).filter(([,v])=>v.pure&&allowed.has(v.action));
}
export function uoDecisionCandidates(chart, ranks){
  const truth=actionMap(chart);return canonicalHands(ranks).filter(h=>CONFIRMED_ACTIONS.has(truth[h])).map(h=>[h,{action:truth[h],pure:true,active:true}]);
}
export function activeSetFromChart(chart, ranks){const m=actionMap(chart);return new Set(canonicalHands(ranks).filter(h=>(m[h]||'UNSELECTED')!=='UNSELECTED'));}
export function activeSetFromStructured(rec, ranks){const cells=decodeStructured(rec,ranks);return new Set(Object.entries(cells).filter(([,v])=>v.active).map(([h])=>h));}
export function fisherYates(items, random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

const MODE_WEIGHT={exam:1,rapid:1,learn:.75,correction:.2};
export function handStats(history, spotId, {kind=null, includeCorrections=false}={}){
  const map=new Map();
  for(const row of history||[]){
    if(row.spotId!==spotId || !Array.isArray(row.answers)) continue;
    if(kind && row.kind!==kind) continue;
    if(row.isCorrection && !includeCorrections) continue;
    const weight=row.isCorrection?MODE_WEIGHT.correction:(MODE_WEIGHT[row.trainingMode]??.75);
    for(const a of row.answers){
      if(!a?.h) continue;
      const s=map.get(a.h)||{h:a.h,seen:0,correct:0,wrong:0,weightedSeen:0,weightedCorrect:0,streak:0,lastAt:null,lastCorrect:null,totalMs:0,timeouts:0};
      s.seen++;s.weightedSeen+=weight;s.totalMs+=Number(a.responseMs)||0;if(a.user==='__TIMEOUT__')s.timeouts++;
      if(a.correct){s.correct++;s.weightedCorrect+=weight;s.streak=s.lastCorrect===false?1:s.streak+1;}else{s.wrong++;s.streak=0;}
      s.lastCorrect=!!a.correct;s.lastAt=row.timestamp||s.lastAt;map.set(a.h,s);
    }
  }
  return map;
}
export function dueAt(stat){
  if(!stat?.lastAt)return null;const t=Date.parse(stat.lastAt);if(!Number.isFinite(t))return null;
  if(!stat.lastCorrect)return t+12*60*60*1000;const days=stat.streak>=4?7:stat.streak>=2?3:1;return t+days*24*60*60*1000;
}
export function isDue(stat,now=Date.now()){const t=dueAt(stat);return t!==null&&t<=now;}

export function selectAdaptiveQuestions(candidates, stats, limit=10, random=Math.random){
  const now=Date.now(), rows=candidates.map(([h,v])=>{const s=stats?.get(h);return {h,v,s,unseen:!s,due:isDue(s,now),errorRate:s?.seen?s.wrong/s.seen:0,slow:s?.seen?s.totalMs/s.seen>6000:false,tie:random()};});
  const weak=rows.filter(x=>x.s&&(x.due||x.errorRate>0||x.s.lastCorrect===false)).sort((a,b)=>(Number(b.s.lastCorrect===false)-Number(a.s.lastCorrect===false))||(b.errorRate-a.errorRate)||Number(b.due)-Number(a.due)||a.tie-b.tie);
  const unseen=rows.filter(x=>x.unseen).sort((a,b)=>a.tie-b.tie), review=rows.filter(x=>x.s&&!weak.includes(x)).sort((a,b)=>Number(b.slow)-Number(a.slow)||a.tie-b.tie);
  const out=[],seen=new Set();const add=(arr,n)=>{for(const x of arr){if(out.length>=limit||n<=0)break;if(seen.has(x.h))continue;seen.add(x.h);out.push([x.h,x.v]);n--;}};
  add(weak,Math.ceil(limit*.4));add(unseen,Math.ceil(limit*.3));add(review,Math.ceil(limit*.3));add([...weak,...unseen,...review],limit-out.length);return out;
}

export function rangeShapeCompare(truthSet,userSet){
  const truth=new Set(truthSet||[]),user=new Set(userSet||[]),hit=[...user].filter(h=>truth.has(h)),missed=[...truth].filter(h=>!user.has(h)),extra=[...user].filter(h=>!truth.has(h));
  const precision=user.size?hit.length/user.size:1,recall=truth.size?hit.length/truth.size:1,f1=(precision+recall)?2*precision*recall/(precision+recall):0;
  return {hit,missed,extra,precision,recall,score:Math.round(f1*100),truthCombos:comboCount(truth),userCombos:comboCount(user),missedCombos:comboCount(missed),extraCombos:comboCount(extra)};
}
export function shapeLeakSummary(missed=[],extra=[]){
  const counts=new Map();for(const h of [...missed,...extra]){const f=familyForHand(h),v=counts.get(f)||{family:f,label:FAMILY_LABELS[f]||f,missed:0,extra:0};if(missed.includes(h))v.missed++;else v.extra++;counts.set(f,v);}return [...counts.values()].sort((a,b)=>(b.missed+b.extra)-(a.missed+a.extra)).slice(0,3);
}

export function masterySummary(history,spotId,eligibleHands,{kind=null}={}){
  const stats=handStats(history,spotId,{kind}),eligible=[...eligibleHands],seen=eligible.filter(h=>stats.has(h)),wrong=seen.filter(h=>stats.get(h).wrong>0),due=seen.filter(h=>isDue(stats.get(h))),fresh=eligible.filter(h=>!stats.has(h));
  const weightedSeen=seen.reduce((n,h)=>n+stats.get(h).weightedSeen,0),weightedCorrect=seen.reduce((n,h)=>n+stats.get(h).weightedCorrect,0);
  const accuracy=weightedSeen?Math.round(100*weightedCorrect/weightedSeen):0,coverage=eligible.length?Math.round(100*seen.length/eligible.length):0;
  // Conservative skill score: high accuracy is not enough until enough of the node was actually sampled.
  const skill=Math.round(accuracy*Math.sqrt(coverage/100||0));
  return {stats,seen:seen.length,total:eligible.length,wrong:wrong.length,due:due.length,newCount:fresh.length,accuracy,coverage,mastery:skill,skill};
}

export function uoBoundaryCandidates(chart,ranks){
  const truth=actionMap(chart),active=h=>(truth[h]||'UNSELECTED')!=='UNSELECTED',merged=[...semanticBoundaryHands(chart),...boundaryHands(chart)],seen=new Set(),out=[];
  for(const x of merged){if(seen.has(x.h))continue;seen.add(x.h);out.push([x.h,{action:active(x.h)?'IN':'OUT',active:active(x.h),score:x.score||0,family:familyForHand(x.h)}]);}return out;
}
export function structuredBoundaryCandidates(rec,ranks){
  const cells=decodeStructured(rec,ranks),hands=canonicalHands(ranks),idx=new Map(hands.map((h,i)=>[h,i])),score=new Map();
  const add=(h,n)=>score.set(h,(score.get(h)||0)+n);
  // Semantic neighbours inside the same poker hand family.
  const groups=new Map();for(const h of hands){const f=familyForHand(h),a=groups.get(f)||[];a.push(h);groups.set(f,a);}for(const arr of groups.values()){arr.sort((a,b)=>idx.get(a)-idx.get(b));for(let i=0;i<arr.length;i++){for(const j of [i-1,i+1])if(j>=0&&j<arr.length&&cells[arr[i]].active!==cells[arr[j]].active)add(arr[i],6);}}
  // Matrix edge remains a secondary signal, not the only definition of a boundary.
  for(let r=0;r<13;r++)for(let c=0;c<13;c++){const h=hands[r*13+c],a=cells[h].active;for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const rr=r+dr,cc=c+dc;if(rr<0||rr>=13||cc<0||cc>=13)continue;if(cells[hands[rr*13+cc]].active!==a)add(h,1);}}
  return [...score].map(([h,s])=>[h,{action:cells[h].active?'IN':'OUT',active:cells[h].active,score:s,family:familyForHand(h)}]).sort((a,b)=>b[1].score-a[1].score||idx.get(a[0])-idx.get(b[0]));
}
export function compareActiveSets(a,b){const A=new Set(a||[]),B=new Set(b||[]);return {added:[...B].filter(h=>!A.has(h)),removed:[...A].filter(h=>!B.has(h)),common:[...A].filter(h=>B.has(h))};}
export function compareActionMaps(a,b,hands){const changed=[];for(const h of hands||[]){const x=a[h]||'UNSELECTED',y=b[h]||'UNSELECTED';if(x!==y)changed.push({h,from:x,to:y});}return changed;}
export function rangeComposition(active){const groups=new Map();for(const h of active||[]){const f=familyForHand(h),x=groups.get(f)||{family:f,label:FAMILY_LABELS[f]||f,hands:0,combos:0};x.hands++;x.combos+=h.length===2?6:h.endsWith('s')?4:12;groups.set(f,x);}return [...groups.values()].sort((a,b)=>b.combos-a.combos);}
