import test from 'node:test';
import assert from 'node:assert/strict';
import { UO_DATA } from '../ranges-data.js';
import { STRUCTURED_LIBRARY, MODE_ACTION_CHOICES } from '../structured-library.js';
import { canonicalHands, safeChart } from '../core.js';
import {
  decodeStructured, strictCandidates, uoDecisionCandidates, rangeShapeCompare, masterySummary,
  compareActiveSets, compareActionMaps, structuredBoundaryCandidates, fisherYates, handStats,
  isDue, selectAdaptiveQuestions, rangeComposition
} from '../trainer-core.js';

const ranks=UO_DATA.rank_order;
test('all structured charts decode to exactly 169 canonical hands',()=>{
  const canonical=new Set(canonicalHands(ranks));
  for(const rec of STRUCTURED_LIBRARY){const cells=decodeStructured(rec,ranks);assert.equal(Object.keys(cells).length,169,rec.id);for(const h of Object.keys(cells))assert.ok(canonical.has(h),`${rec.id}:${h}`);}
});
test('strict candidates never expose unknown/source-only labels',()=>{
  const allowed=new Set(['AI','RAISE','CALL','CHECK','4BET','5BET','ISOLATE','OVERLIMP']);
  for(const rec of STRUCTURED_LIBRARY)for(const [,v] of strictCandidates(rec,MODE_ACTION_CHOICES,ranks))assert.ok(allowed.has(v.action),`${rec.id}:${v.action}`);
});
test('UO decision candidates exclude source-only labels',()=>{
  for(const p of UO_DATA.positions)for(const s of UO_DATA.stack_bands){const c=safeChart(UO_DATA,p,s);const rows=uoDecisionCandidates(c,ranks);assert.ok(rows.length>0,`${p}:${s}`);for(const [,v] of rows)assert.ok(['AI','RAISE','CALL','CHECK','4BET','5BET','ISOLATE','OVERLIMP'].includes(v.action));}
});
test('shape compare reports hand and combo errors',()=>{const r=rangeShapeCompare(new Set(['AA','KK','AKs']),new Set(['AA','QQ','AKs']));assert.deepEqual(new Set(r.missed),new Set(['KK']));assert.deepEqual(new Set(r.extra),new Set(['QQ']));assert.equal(r.missedCombos,6);assert.equal(r.extraCombos,6);});
test('mastery is separated by skill kind and penalizes low coverage',()=>{
  const h=[
    {spotId:'x',kind:'boundary',trainingMode:'exam',timestamp:'2026-09-10T00:00:00Z',answers:[{h:'AA',correct:true,responseMs:1000},{h:'KK',correct:true,responseMs:1200}]},
    {spotId:'x',kind:'decision',trainingMode:'exam',timestamp:'2026-09-10T00:00:00Z',answers:[{h:'AA',correct:false,responseMs:900}]}
  ];
  const b=masterySummary(h,'x',['AA','KK','QQ','JJ'],{kind:'boundary'}),d=masterySummary(h,'x',['AA','KK'],{kind:'decision'});
  assert.equal(b.accuracy,100);assert.equal(b.coverage,50);assert.equal(b.skill,71);assert.equal(d.accuracy,0);assert.equal(d.coverage,50);
});
test('correction retries do not inflate main skill stats',()=>{
  const h=[{spotId:'x',kind:'decision',trainingMode:'learn',isCorrection:false,timestamp:'2026-09-10T00:00:00Z',answers:[{h:'AA',correct:false,responseMs:1000}]},{spotId:'x',kind:'decision',trainingMode:'learn',isCorrection:true,timestamp:'2026-09-10T00:01:00Z',answers:[{h:'AA',correct:true,responseMs:500}]}];
  const s=handStats(h,'x',{kind:'decision'}).get('AA');assert.equal(s.seen,1);assert.equal(s.correct,0);
});
test('unseen hands are new, not due',()=>{assert.equal(isDue(undefined,Date.now()),false);});
test('adaptive selection keeps a mix of weak, unseen and review',()=>{
  const candidates=['AA','KK','QQ','JJ','TT','99','88','77','66','55'].map(h=>[h,{action:'IN'}]);
  const hist=[{spotId:'x',kind:'boundary',trainingMode:'exam',timestamp:new Date(Date.now()-2*864e5).toISOString(),answers:[{h:'AA',correct:false,responseMs:1000},{h:'KK',correct:true,responseMs:1000},{h:'QQ',correct:true,responseMs:900},{h:'JJ',correct:true,responseMs:900}]}];
  const stats=handStats(hist,'x',{kind:'boundary'}),sel=selectAdaptiveQuestions(candidates,stats,6,()=>.5).map(x=>x[0]);assert.ok(sel.includes('AA'));assert.ok(sel.some(h=>!stats.has(h)));
});
test('range diff is directional and action diff catches action changes',()=>{const d=compareActiveSets(['AA','KK'],['AA','QQ']);assert.deepEqual(d.added,['QQ']);assert.deepEqual(d.removed,['KK']);const ch=compareActionMaps({AA:'AI',KK:'AI'},{AA:'RAISE',KK:'AI'},['AA','KK']);assert.deepEqual(ch,[{h:'AA',from:'AI',to:'RAISE'}]);});
test('structured semantic boundary candidates are valid hand classes',()=>{const rec=STRUCTURED_LIBRARY.find(x=>structuredBoundaryCandidates(x,ranks).length>0);assert.ok(rec);for(const [h,v] of structuredBoundaryCandidates(rec,ranks)){assert.ok(canonicalHands(ranks).includes(h));assert.ok(['IN','OUT'].includes(v.action));assert.ok(v.score>0);}});
test('range composition conserves active hand count',()=>{const set=new Set(['AA','AKs','AQs','KQs']);const rows=rangeComposition(set);assert.equal(rows.reduce((n,x)=>n+x.hands,0),4);});
test('fisher-yates preserves items',()=>{const a=[1,2,3,4,5],b=fisherYates(a,()=>.42);assert.deepEqual([...b].sort(),a);assert.equal(b.length,a.length);});
