'use strict';

const RANKS='23456789TJQKA';
function rank5(cards){
  const ranks=cards.map(c=>RANKS.indexOf(c[0])+2).sort((a,b)=>b-a),suits=cards.map(c=>c[1]),counts={};
  ranks.forEach(r=>counts[r]=(counts[r]||0)+1);
  const unique=[...new Set(ranks)].sort((a,b)=>b-a);if(unique[0]===14)unique.push(1);
  let straight=0;for(let i=0;i<=unique.length-5;i++)if(unique[i]-unique[i+4]===4){straight=unique[i];break}
  const flush=suits.every(s=>s===suits[0]);
  const groups=Object.entries(counts).map(([r,n])=>[Number(r),n]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  if(flush&&straight)return[8,straight];
  if(groups[0][1]===4)return[7,groups[0][0],groups[1][0]];
  if(groups[0][1]===3&&groups[1]?.[1]>=2)return[6,groups[0][0],groups[1][0]];
  if(flush)return[5,...ranks];
  if(straight)return[4,straight];
  if(groups[0][1]===3)return[3,groups[0][0],...groups.filter(x=>x[1]===1).map(x=>x[0]).sort((a,b)=>b-a)];
  const pairs=groups.filter(x=>x[1]===2).map(x=>x[0]).sort((a,b)=>b-a);
  if(pairs.length>=2)return[2,pairs[0],pairs[1],groups.find(x=>x[1]===1)?.[0]||0];
  if(pairs.length===1)return[1,pairs[0],...groups.filter(x=>x[1]===1).map(x=>x[0]).sort((a,b)=>b-a)];
  return[0,...ranks];
}
function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x!==y)return x>y?1:-1}return 0}
function best7(cards){
  let best=null;
  for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
    const value=rank5([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(!best||compare(value,best)>0)best=value;
  }
  return best;
}
function deck(){const cards=[];for(const r of RANKS)for(const s of 'shdc')cards.push(r+s);return cards}
function sampleWithoutReplacement(source,count){
  const copy=source.slice();
  for(let i=0;i<count;i++){const j=i+Math.floor(Math.random()*(copy.length-i));[copy[i],copy[j]]=[copy[j],copy[i]]}
  return copy.slice(0,count);
}
self.onmessage=event=>{
  const {id,hero=[],villain=[],board=[],samples=40000}=event.data||{},known=[...hero,...villain,...board];
  if(hero.length!==2||villain.length!==2||board.length>5||new Set(known).size!==known.length){self.postMessage({id,error:'INVALID_CARDS'});return}
  const remaining=deck().filter(card=>!known.includes(card)),need=5-board.length;
  let wins=0,losses=0,ties=0;
  for(let i=0;i<samples;i++){
    const runout=sampleWithoutReplacement(remaining,need),full=[...board,...runout];
    const result=compare(best7([...hero,...full]),best7([...villain,...full]));
    if(result>0)wins++;else if(result<0)losses++;else ties++;
  }
  const heroEq=(wins+ties/2)/samples*100;
  self.postMessage({id,result:{h:heroEq,v:100-heroEq,n:samples,approx:true}});
};
