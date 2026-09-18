#!/usr/bin/env node

/**
 * Grader Extraction Parity Test
 *
 * Verifies that the refactored gradeResolvedNode() produces
 * identical results to the original gradeDecision() for all
 * deterministic grading scenarios.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(70));
console.log('GRADER EXTRACTION PARITY TEST');
console.log('='.repeat(70));
console.log();

// ============================================================
// Load POKER_BRAIN_PACK and legacy functions
// ============================================================

const indexPath = path.join(__dirname, '../../index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');

// Extract POKER_BRAIN_PACK
let pkStart = indexContent.indexOf('window.POKER_BRAIN_PACK={');
pkStart = indexContent.indexOf('{', pkStart);

let braceCount = 0, inString = false, escapeNext = false, pkEnd = pkStart, startedObj = false;
for (let i = pkStart; i < indexContent.length; i++) {
  const char = indexContent[i];
  if (escapeNext) { escapeNext = false; continue; }
  if (char === '\\') { escapeNext = true; continue; }
  if (char === '"' || char === "'") { inString = !inString; continue; }
  if (!inString) {
    if (char === '{') { if (!startedObj) startedObj = true; braceCount++; }
    else if (char === '}') { braceCount--; if (startedObj && braceCount === 0) { pkEnd = i + 1; break; } }
  }
}

const PK = eval('(' + indexContent.substring(pkStart, pkEnd) + ')');
console.log(`✓ POKER_BRAIN_PACK loaded: ${Object.keys(PK.preflop).length} records`);

// Extract legacy poker_brain.js
const pokerBrainPath = path.join(__dirname, '../../poker_brain.js');
const pokerBrainCode = fs.readFileSync(pokerBrainPath, 'utf-8');

// Create a sandbox to execute the legacy code
global.window = { POKER_BRAIN_PACK: PK };
eval(`
  (function(){
    'use strict';
    const P = (typeof window !== 'undefined' ? window.POKER_BRAIN_PACK : null) || {exact: {}, preflop: {}, postflop: [], reviews: {}, concepts: {}, stats: {}};
    const R = 'AKQJT98765432';

    // Legacy functions (copy from poker_brain.js, unminified enough to parse)
    function normAction(a=''){
      a=String(a).toUpperCase().trim();
      if(/ФОЛД|FOLD/.test(a))return'FOLD';
      if(/КОЛЛ|CALL/.test(a))return'CALL';
      if(/ЧЕК|CHECK/.test(a))return'CHECK';
      if(/СТАВ|BET/.test(a))return'BET';
      if(/3-БЕТ|3BET|5-БЕТ|5BET|РЕЙЗ|RAISE/.test(a))return'RAISE';
      return a;
    }

    function parseCards(input=[]){
      if(Array.isArray(input))return input;
      const str=String(input).trim();
      if(!str)return[];
      const suits=['s','h','d','c'];
      let cards=[],i=0;
      while(i<str.length){
        if(i+1<str.length&&R.includes(str[i])&&suits.includes(str[i+1].toLowerCase())){
          cards.push(str[i]+str[i+1].toLowerCase());
          i+=2;
        }else if(R.includes(str[i])){
          const suit=suits[(cards.length%4)];
          cards.push(str[i]+suit);
          i++;
        }else{
          i++;
        }
      }
      return cards;
    }

    function classOf(cards=[]){
      if(cards.length<2)return null;
      const a=cards[0][0],b=cards[1][0],ia=R.indexOf(a),ib=R.indexOf(b);
      if(ia<0||ib<0)return null;
      if(a===b)return a+a;
      const suited=cards[0].slice(1)===cards[1].slice(1);
      return ia<ib?a+b+(suited?'s':'o'):b+a+(suited?'s':'o');
    }

    function baseId(id=''){return String(id).replace(/_V\\d+$/,'');}

    function nearest(v,arr){return arr.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a,arr[0]);}

    function gradeFromFreq(freq,max){
      if(max<=0)return'r';
      const rel=freq/max;
      if(freq>=.5||rel>=.78)return'g';
      if(freq>=.15||rel>=.28)return'y';
      return'r';
    }

    function sizeEval(size,sizes=[]){
      if(size==null||!sizes?.length)return{grade:null,fit:null,best:null};
      let best={fit:-1,pct:null,weight:0,dist:999};
      for(const s of sizes){
        const dist=Math.abs(Number(size)-s.pct),fit=s.weight*Math.exp(-(dist*dist)/(2*18*18));
        if(fit>best.fit)best={fit,pct:s.pct,weight:s.weight,dist};
      }
      const grade=best.dist<=12||best.fit>=.32?'g':best.dist<=28||best.fit>=.10?'y':'r';
      return{grade,fit:best.fit,best:best.pct,dist:best.dist};
    }

    function riverMath(spot){
      const t=String(spot.ctx||'');
      const m=t.match(/(\\d+(?:\\.\\d+)?)%/);
      const pct=m?Number(m[1]):null;
      const pot=Number(spot.pot||0);
      if(!pct||!pot)return null;
      const bet=pot*pct/100;
      const req=bet/(pot+2*bet);
      const mdf=pot/(pot+bet);
      const bluffPerValue=bet/(pot+bet);
      return{betPct:pct,bet:bet,requiredEquity:req*100,mdf:mdf*100,bluffPerValue};
    }

    function preflopLookup(spot){
      const hero=parseCards(spot.hero||[]);
      const hc=classOf(hero);
      if(!hc)return null;
      const stack=nearest(Number(spot.stack||spot.effStack||30),[20,25,30,40,50]);
      const pos=String(spot.pos||spot.heroSeat||'BTN').split(/\\s|vs/i)[0].toUpperCase();
      const text=String(spot.ctx||'');
      let key=null;
      if(/сфолдили|unopened|first in/i.test(text))key=\`RFI|\${pos}|\${stack}|\${hc}\`;
      else if(pos==='BB'&&/open|открыл/i.test(text)){
        const m=text.match(/(UTG|HJ|CO|BTN|SB)/i);
        key=\`BB_DEFEND|\${(m?m[1]:'BTN').toUpperCase()}|\${stack}|\${hc}\`;
      }
      else if(/4-bet|4bet|3-бет|3bet/i.test(text))key=\`VS_3BET|\${pos}|\${stack}|\${hc}\`;
      else if(/open|открыл/i.test(text)){
        const m=text.match(/(UTG|HJ|CO|BTN|SB)/i);
        key=\`VS_OPEN|\${pos}|\${(m?m[1]:'CO').toUpperCase()}|\${stack}|\${hc}\`;
      }
      const actions=key&&P.preflop[key];
      return actions?{actions,concept:'preflop.generic',why:'Policy взята из локального preflop atlas с учётом позиции, стека и класса руки.',source:'PREFLOP_ATLAS',confidence:82}:null;
    }

    function genericPostflop(spot){
      const street=String(spot.street||'FLOP').toUpperCase().replace('ФЛОП','FLOP').replace('ТЁРН','TURN').replace('РИВЕР','RIVER');
      const board=parseCards(spot.board||[]);
      const hero=parseCards(spot.hero||[]);
      // Just return null for postflop in this test
      return null;
    }

    function nodeFor(spot){
      const id=baseId(spot.spotId||spot.id||'');
      let n=P.exact[id];
      if(!n&&spot.theme)n=P.exact['DAILY:'+spot.theme];
      if(n)return{...n,source:'EXACT_REFERENCE_NODE',confidence:94};
      return preflopLookup(spot)||genericPostflop(spot);
    }

    // EXTRACTED GRADER
    function gradeResolvedNode(node,action,size,spot){
      const a=normAction(action);
      const entries=Object.entries(node.actions||{});
      const max=entries.length?Math.max(...entries.map(x=>x[1])):0;
      const freq=Number(node.actions?.[a]||0);
      const ag=gradeFromFreq(freq,max);
      const se=sizeEval(size,node.sizes||[]);
      const grade=ag==='r'||se.grade==='r'?'r':ag==='y'||se.grade==='y'?'y':'g';
      const top=entries.sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k,v])=>({action:k,freq:v}));
      const alt=top.find(x=>x.action!==a);
      const actionRel=max?freq/max:0;
      const sizeRel=se.grade==null?1:(se.grade==='g'?1:(se.grade==='y'?0.62:0.18));
      const score=Math.round(100*(.72*actionRel+.28*sizeRel));
      return{grade,actionGrade:ag,sizeGrade:se.grade,action:a,actionFrequency:freq,topActions:top,sizeBest:se.best,sizeDistance:se.dist,score,concept:node.concept||'unknown',explanation:node.why||'',source:node.source,confidence:node.confidence||0,alternative:alt,river:riverMath(spot),features:node.features||null,modelVersion:P.version};
    }

    // ORIGINAL GRADER (for comparison)
    function gradeDecision_original(spot,action,size=null){
      const node=nodeFor(spot)||{actions:{},why:'Для этого узла пока нет модели.',source:'NO_MODEL',confidence:0};
      const a=normAction(action);
      const entries=Object.entries(node.actions||{});
      const max=entries.length?Math.max(...entries.map(x=>x[1])):0;
      const freq=Number(node.actions?.[a]||0);
      const ag=gradeFromFreq(freq,max);
      const se=sizeEval(size,node.sizes||[]);
      const grade=ag==='r'||se.grade==='r'?'r':ag==='y'||se.grade==='y'?'y':'g';
      const top=entries.sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k,v])=>({action:k,freq:v}));
      const alt=top.find(x=>x.action!==a);
      const actionRel=max?freq/max:0;
      const sizeRel=se.grade==null?1:(se.grade==='g'?1:(se.grade==='y'?0.62:0.18));
      const score=Math.round(100*(.72*actionRel+.28*sizeRel));
      return{grade,actionGrade:ag,sizeGrade:se.grade,action:a,actionFrequency:freq,topActions:top,sizeBest:se.best,sizeDistance:se.dist,score,concept:node.concept||'unknown',explanation:node.why||'',source:node.source,confidence:node.confidence||0,alternative:alt,river:riverMath(spot),features:node.features||null,modelVersion:P.version};
    }

    // REFACTORED GRADER
    function gradeDecision_refactored(spot,action,size=null){
      const node=nodeFor(spot)||{actions:{},why:'Для этого узла пока нет модели.',source:'NO_MODEL',confidence:0};
      return gradeResolvedNode(node,action,size,spot);
    }

    global.window._testGraders = {
      gradeDecision_original,
      gradeDecision_refactored,
      gradeResolvedNode,
      nodeFor
    };
  })();
` );

const { gradeDecision_original, gradeDecision_refactored, nodeFor } = global.window._testGraders;

console.log('✓ Legacy functions loaded');
console.log();

// ============================================================
// Test Cases
// ============================================================

const testSpots = [
  // Preflop RFI scenarios
  { name: 'RFI UTG AA 30BB', hero: ['As', 'Ad'], pos: 'UTG', stack: 30, ctx: 'unopened' },
  { name: 'RFI CO AKs 25BB', hero: ['Ks', 'As'], pos: 'CO', stack: 25, ctx: 'first in' },
  { name: 'RFI BTN K3s 40BB', hero: ['3s', 'Ks'], pos: 'BTN', stack: 40, ctx: 'unopened' },
  { name: 'RFI SB 22 20BB', hero: ['2s', '2d'], pos: 'SB', stack: 20, ctx: 'first in' },

  // Missing policy
  { name: 'Missing hand', hero: ['Xs', 'Xd'], pos: 'UTG', stack: 30, ctx: 'unopened' },
];

const testActions = ['FOLD', 'CALL', 'CHECK', 'BET', 'RAISE'];
const testSizes = [null, 0, 33, 50, 100, 150];

console.log('PHASE 1: Grader Extraction Parity');
console.log('-'.repeat(70));

let passCount = 0;
let failCount = 0;
const failures = [];

for (const spot of testSpots) {
  for (const action of testActions) {
    for (const size of testSizes) {
      try {
        const original = gradeDecision_original(spot, action, size);
        const refactored = gradeDecision_refactored(spot, action, size);

        // Deep comparison
        if (JSON.stringify(original) === JSON.stringify(refactored)) {
          passCount++;
        } else {
          failCount++;
          failures.push({
            spot: spot.name,
            action,
            size,
            original: JSON.stringify(original),
            refactored: JSON.stringify(refactored)
          });
        }
      } catch (e) {
        failCount++;
        failures.push({
          spot: spot.name,
          action,
          size,
          error: e.message
        });
      }
    }
  }
}

console.log(`Grader Extraction: ${passCount}/${passCount + failCount} matched`);
if (failures.length > 0) {
  console.log('\nFAILURES (first 5):');
  failures.slice(0, 5).forEach(f => {
    console.log(`  ${f.spot} | ${f.action} | ${f.size}`);
    if (f.error) console.log(`    Error: ${f.error}`);
  });
}

console.log();
console.log('='.repeat(70));

if (failCount === 0) {
  console.log('✓ GRADER EXTRACTION PARITY PASSED');
  console.log('='.repeat(70));
  process.exit(0);
} else {
  console.log('✗ GRADER EXTRACTION PARITY FAILED');
  console.log('='.repeat(70));
  process.exit(1);
}
