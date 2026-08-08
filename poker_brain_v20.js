/* POKER SWIPE V19 — GTO BRAIN CORE
   Architecture:
   exact node -> nearest node -> transparent estimate.
   IMPORTANT: estimated frequencies are never presented as solver truth.
*/
(function(){
"use strict";
const R="23456789TJQKA";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sigmoid=x=>1/(1+Math.exp(-x));
const round=(x,n=1)=>+x.toFixed(n);

function handClass(a,b){
  if(!a||!b) return "";
  a=String(a).toUpperCase().replace("10","T"); b=String(b).toUpperCase().replace("10","T");
  const r1=a[0],r2=b[0],s1=a.slice(-1),s2=b.slice(-1);
  if(r1===r2) return r1+r2;
  const hi=R.indexOf(r1)>R.indexOf(r2)?r1:r2, lo=hi===r1?r2:r1;
  return hi+lo+(s1===s2?"s":"o");
}
function handFeatures(h){
  if(!h) return null;
  const pair=h.length===2, suited=h.endsWith("s"), r1=R.indexOf(h[0])+2, r2=pair?r1:R.indexOf(h[1])+2;
  const hi=Math.max(r1,r2),lo=Math.min(r1,r2),gap=Math.max(0,hi-lo-1);
  return {pair,suited,hi,lo,gap,broadway:(hi>=10?1:0)+(lo>=10?1:0),ace:hi===14||lo===14};
}
function preflopStrength(h){
  const f=handFeatures(h); if(!f)return 0;
  let x=(f.hi-2)/12*.43+(f.lo-2)/12*.18;
  if(f.pair)x+=.28+(f.hi-2)/12*.18;
  if(f.suited)x+=.055;
  if(f.gap===0)x+=.055; else if(f.gap===1)x+=.025; else x-=Math.min(.09,f.gap*.014);
  x+=f.broadway*.025+(f.ace?.035:0);
  return clamp(x,0,1);
}
const posIndex={UTG:0,HJ:1,CO:2,BTN:3,SB:4,BB:5};

function normalize(q={}){
  return {
    game:q.game||"MTT", street:(q.street||"PREFLOP").toUpperCase(),
    spot:(q.spot||"RFI").toUpperCase(), position:(q.position||"BTN").toUpperCase(),
    villainPosition:(q.villainPosition||"BB").toUpperCase(),
    stack:+q.stack||20, hand:(q.hand||"").toUpperCase(),
    stage:(q.stage||"MID").toUpperCase(), board:q.board||[],
    pot:+q.pot||0, facing:+q.facing||0, payouts:q.payouts||null, stacks:q.stacks||null
  };
}

/* Curated anchor nodes.
   These are app training anchors, not claimed to be exports from a commercial solver.
   Their purpose is deterministic node matching + interpolation architecture. */
const NODES = [
 {id:"mtt_btn_10_rfi",street:"PREFLOP",spot:"RFI",position:"BTN",stack:10,actions:["FOLD","PUSH"],threshold:.39},
 {id:"mtt_btn_15_rfi",street:"PREFLOP",spot:"RFI",position:"BTN",stack:15,actions:["FOLD","RAISE","PUSH"],threshold:.34},
 {id:"mtt_btn_20_rfi",street:"PREFLOP",spot:"RFI",position:"BTN",stack:20,actions:["FOLD","RAISE"],threshold:.31},
 {id:"mtt_co_15_rfi",street:"PREFLOP",spot:"RFI",position:"CO",stack:15,actions:["FOLD","RAISE","PUSH"],threshold:.42},
 {id:"mtt_co_20_rfi",street:"PREFLOP",spot:"RFI",position:"CO",stack:20,actions:["FOLD","RAISE"],threshold:.39},
 {id:"mtt_hj_20_rfi",street:"PREFLOP",spot:"RFI",position:"HJ",stack:20,actions:["FOLD","RAISE"],threshold:.46},
 {id:"mtt_utg_20_rfi",street:"PREFLOP",spot:"RFI",position:"UTG",stack:20,actions:["FOLD","RAISE"],threshold:.53},
 {id:"mtt_sb_10_rfi",street:"PREFLOP",spot:"RFI",position:"SB",stack:10,actions:["FOLD","PUSH"],threshold:.33},
 {id:"mtt_sb_15_rfi",street:"PREFLOP",spot:"RFI",position:"SB",stack:15,actions:["FOLD","RAISE","PUSH"],threshold:.29},
 {id:"mtt_bb_10_call",street:"PREFLOP",spot:"CALL_VS_SHOVE",position:"BB",stack:10,actions:["FOLD","CALL"],threshold:.55},
 {id:"mtt_bb_15_call",street:"PREFLOP",spot:"CALL_VS_SHOVE",position:"BB",stack:15,actions:["FOLD","CALL"],threshold:.59}
];

function distance(n,q){
  let d=Math.abs(n.stack-q.stack)/5;
  d+=n.street===q.street?0:20;
  d+=n.spot===q.spot?0:6;
  d+=n.position===q.position?0:Math.abs((posIndex[n.position]??2)-(posIndex[q.position]??2))*1.4;
  return d;
}
function nodeMatch(q){
  const same=NODES.filter(n=>n.street===q.street&&n.spot===q.spot);
  if(!same.length)return null;
  const ranked=same.map(n=>({n,d:distance(n,q)})).sort((a,b)=>a.d-b.d);
  const exact=ranked.find(x=>x.d===0);
  if(exact)return {type:"EXACT",confidence:1,node:exact.n,distance:0};
  const best=ranked[0];
  return {type:"NEAREST",confidence:clamp(1-best.d/10,.25,.94),node:best.n,distance:round(best.d,2)};
}
function icmModifier(q){
  // We refuse to fake exact ICM without payouts + all relevant stacks.
  if(q.stage==="BUBBLE"||q.stage==="FT"){
    if(!q.payouts||!q.stacks) return {value:-.045, exact:false, note:"ICM context incomplete: payout + table stacks missing"};
    return {value:-.025, exact:false, note:"ICM-aware approximation; no equilibrium tree solved on device"};
  }
  return {value:0,exact:true,note:"chip-EV context"};
}
function frequencies(q,match){
  const s=preflopStrength(q.hand), icm=icmModifier(q);
  const n=match?.node;
  let threshold=(n?.threshold ?? .43)+icm.value;
  let aggression=sigmoid((s-threshold)*12);
  let actions=n?.actions || (q.spot==="CALL_VS_SHOVE"?["FOLD","CALL"]:["FOLD","RAISE"]);
  let f={};
  if(actions.length===2){
    f[actions[1]]=aggression*100; f[actions[0]]=100-f[actions[1]];
  }else{
    let push=clamp((15-q.stack)/8,0,1)*aggression;
    let raise=aggression-push*.62;
    f.PUSH=push*62; f.RAISE=raise*100; f.FOLD=Math.max(0,100-f.PUSH-f.RAISE);
  }
  Object.keys(f).forEach(k=>f[k]=round(f[k]));
  const sum=Object.values(f).reduce((a,b)=>a+b,0);
  if(sum && Math.abs(sum-100)>.05){let k=Object.keys(f)[0];f[k]=round(f[k]+100-sum)}
  return {freq:f,strength:round(s*100),icm};
}
function evProxy(freq,chosen){
  // Relative decision-quality proxy, explicitly not solver chip-EV.
  const best=Math.max(...Object.values(freq));
  const own=freq[chosen]??0;
  const loss=round((best-own)/100*.35,3);
  return {lossBB:loss,label:loss<.025?"CLEAN":loss<.10?"SMALL":"LEAK"};
}
function explain(q,r){
  const f=handFeatures(q.hand), reasons=[];
  if(f?.pair)reasons.push("pair retains equity and realizes cleanly");
  if(f?.suited)reasons.push("suitedness improves realization");
  if(f?.ace)reasons.push("ace blocker changes continue density");
  if(f&&f.gap>=3)reasons.push("poor connectivity reduces realization");
  if(q.position==="BTN"||q.position==="SB")reasons.push("late position widens pressure range");
  if(q.stack<=12)reasons.push("short stack increases jam utility and lowers postflop realization cost");
  if(r.icm.note!=="chip-EV context")reasons.push(r.icm.note);
  return reasons;
}
function analyze(input){
  const q=normalize(input), match=nodeMatch(q);
  if(q.street!=="PREFLOP"){
    const pr=postReference20(q);
    return {engine:"REFERENCE",confidence:pr.confidence,query:q,nodeId:null,nodeDistance:null,
      actions:pr.policy,texture:pr.texture,sprBin:pr.sprBin,context:pr.context,
      reasons:["board texture","SPR","position","facing size"],warning:"Reference model"};
  }
  const fr=frequencies(q,match);
  const engine=match?.type||"ESTIMATE";
  const confidence=round((match?.confidence||.35)*(fr.icm.exact?1:.72),2);
  return {engine,confidence,nodeId:match?.node?.id||null,nodeDistance:match?.distance??null,query:q,actions:fr.freq,
          handStrength:fr.strength,reasons:explain(q,fr),warning:engine==="EXACT"?
          "Exact app anchor node. Frequencies are generated by Poker Swipe's training model, not a commercial solver export.":
          engine==="NEAREST"?"Nearest training node + interpolation. Treat as study guidance, not solver ground truth.":
          "Heuristic estimate only."};
}
function compare(input,chosen){
  const r=analyze(input); if(!r.actions)return {...r,decision:null};
  return {...r,decision:{chosen,...evProxy(r.actions,chosen)}};
}
function whatIf(input,field,values){
  return values.map(v=>{const q={...input,[field]:v},r=analyze(q);return {value:v,engine:r.engine,confidence:r.confidence,actions:r.actions}});
}

function allHandClasses20(){
  const out=[];
  for(let i=R.length-1;i>=0;i--){
    out.push(R[i]+R[i]);
    for(let j=i-1;j>=0;j--){out.push(R[i]+R[j]+"s");out.push(R[i]+R[j]+"o");}
  }
  return out;
}
const HAND_CLASSES20=allHandClasses20();
const STACKS20=Array.from({length:36},(_,i)=>i+5);
const POSITIONS20=["UTG","HJ","CO","BTN","SB","BB"];
const PREFLOP_FAMILIES20=["RFI","VS_OPEN","VS_3BET","CALL_VS_SHOVE"];
const TEXTURES20=["A_HIGH_DRY","K_HIGH_DRY","Q_HIGH_DRY","LOW_DRY","LOW_CONNECTED","MID_CONNECTED","HIGH_CONNECTED","MONOTONE","TWO_TONE_HIGH","TWO_TONE_LOW","PAIRED_HIGH","PAIRED_LOW","STRAIGHT_HEAVY","FLUSH_HEAVY","TURN_OVER","RIVER_OVER","RIVER_BRICK","RIVER_FLUSH","RIVER_STRAIGHT","BROADWAY_DYNAMIC"];
const HAND_BUCKETS20=["AIR","ACE_HIGH","PAIR_WEAK","PAIR_STRONG","TWO_PAIR","SET_PLUS","DRAW_WEAK","DRAW_STRONG","NUT_DRAW","BLUFF_CATCH","THIN_VALUE","NUT_VALUE"];
const SPR20=[.5,1,2,4,7], CONTEXT20=["IP_CHECKED_TO","OOP_FIRST","FACING_SMALL","FACING_BIG","FACING_OVERBET"];
function logicalStats20(){
  return {
    preflopStates:HAND_CLASSES20.length*STACKS20.length*POSITIONS20.length*PREFLOP_FAMILIES20.length,
    postflopStates:TEXTURES20.length*HAND_BUCKETS20.length*SPR20.length*CONTEXT20.length*2,
    handClasses:HAND_CLASSES20.length
  };
}
function texture20(board=[]){
  if(!board.length)return"UNKNOWN";
  const ranks=board.map(x=>R.indexOf(String(x)[0].toUpperCase())+2).filter(x=>x>=2);
  const suits=board.map(x=>String(x).slice(-1).toLowerCase());
  const max=Math.max(...ranks),min=Math.min(...ranks),paired=new Set(ranks).size<ranks.length;
  const sc=Math.max(...Object.values(suits.reduce((m,s)=>(m[s]=(m[s]||0)+1,m),{})));
  if(sc>=3)return"MONOTONE"; if(paired)return max>=12?"PAIRED_HIGH":"PAIRED_LOW";
  if(max-min<=4)return max>=11?"HIGH_CONNECTED":max>=8?"MID_CONNECTED":"LOW_CONNECTED";
  if(max===14)return"A_HIGH_DRY";if(max===13)return"K_HIGH_DRY";if(max===12)return"Q_HIGH_DRY";return"LOW_DRY";
}
function postReference20(q){
  const texture=texture20(q.board||[]);
  const spr=q.pot>0?q.stack/q.pot:4;
  const sprBin=SPR20.reduce((a,b)=>Math.abs(b-spr)<Math.abs(a-spr)?b:a,SPR20[0]);
  const facing=q.facing||0;
  const context=facing<=0?(q.position==="BTN"||q.position==="CO"?"IP_CHECKED_TO":"OOP_FIRST"):
    facing<q.pot*.4?"FACING_SMALL":facing<q.pot*.9?"FACING_BIG":"FACING_OVERBET";
  const dynamic=/CONNECTED|MONOTONE|TWO_TONE|FLUSH|STRAIGHT/.test(texture);
  let policy;
  if(context==="IP_CHECKED_TO")policy=dynamic?{CHECK:47,BET_33:28,BET_75:25}:{CHECK:28,BET_25:52,BET_75:20};
  else if(context==="OOP_FIRST")policy=dynamic?{CHECK:81,BET_33:10,BET_75:9}:{CHECK:72,BET_25:22,BET_75:6};
  else if(context==="FACING_SMALL")policy=dynamic?{FOLD:28,CALL:58,RAISE:14}:{FOLD:22,CALL:64,RAISE:14};
  else if(context==="FACING_BIG")policy=dynamic?{FOLD:49,CALL:43,RAISE:8}:{FOLD:42,CALL:50,RAISE:8};
  else policy={FOLD:64,CALL:31,RAISE:5};
  return{texture,sprBin,context,policy,confidence:.46};
}

window.GTOBrainV20={version:"20.0",nodes:NODES,handClass,analyze,compare,whatIf,logicalStats:logicalStats20,texture: texture20,postReference:postReference20,
 disclaimer:"Training/review engine. Exact commercial-solver equilibrium data is not bundled."};
})();
window.GTOBrainV19=window.GTOBrainV20;
