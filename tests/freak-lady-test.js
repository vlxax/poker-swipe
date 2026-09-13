// PokerSwipe — Freak Lady reconstructed smoke tests
// Browser test helper. Load library + reactive engine first.
(function(global){
  'use strict';

  function assert(name, condition, details=''){
    const row = { name, pass: !!condition, details };
    if (!condition) console.error('[FreakLady TEST FAIL]', name, details);
    else console.log('[FreakLady TEST PASS]', name);
    return row;
  }

  function countBase(){
    const lib = global.FREAK_LADY_LIBRARY || [];
    return {
      total: lib.length,
      correct: lib.filter(x => x.grade === 'g' && !x.meta && x.context !== 'session').length,
      yellow: lib.filter(x => x.grade === 'y' && !x.meta && x.context !== 'session').length,
      wrong: lib.filter(x => x.grade === 'r' && !x.meta && x.context !== 'session').length,
      meta: lib.filter(x => x.meta === true).length,
      session: lib.filter(x => x.context === 'session').length,
    };
  }

  function runFreakLadyTests(){
    const results = [];
    const lib = global.FREAK_LADY_LIBRARY || [];
    const counts = countBase();

    results.push(assert('TOTAL COUNT = 217', counts.total === 217, JSON.stringify(counts)));
    results.push(assert('CORRECT = 64', counts.correct === 64, String(counts.correct)));
    results.push(assert('YELLOW = 32', counts.yellow === 32, String(counts.yellow)));
    results.push(assert('WRONG = 82', counts.wrong === 82, String(counts.wrong)));
    results.push(assert('META = 31', counts.meta === 31, String(counts.meta)));
    results.push(assert('SESSION = 8', counts.session === 8, String(counts.session)));

    const ids = new Set(lib.map(x => x.id));
    const texts = new Set(lib.map(x => x.text));
    results.push(assert('UNIQUE IDS', ids.size === lib.length, `${ids.size}/${lib.length}`));
    results.push(assert('UNIQUE TEXTS', texts.size === lib.length, `${texts.size}/${lib.length}`));

    results.push(assert('FreakLady exists', typeof global.FreakLady === 'object'));
    results.push(assert('debug exists', !!global.FreakLady?.debug));
    results.push(assert('selectPhrase exists', typeof global.FreakLady?.debug?.selectPhrase === 'function'));
    results.push(assert('getEligiblePool exists', typeof global.FreakLady?.debug?.getEligiblePool === 'function'));

    global.FreakLady?.debug?.resetSession();
    const before = global.FreakLady?.debug?.getState();
    const host = document.createElement('div');
    document.body.appendChild(host);
    global.FreakLady?.react(host, 'thinking', 'daily');
    const after = global.FreakLady?.debug?.getState();
    results.push(assert('THINKING does not count hand', before.handCount === after.handCount));
    results.push(assert('THINKING does not alter correct', before.sessionStats.correct === after.sessionStats.correct));
    results.push(assert('THINKING maps thinking.png', !!host.querySelector('img[src*="thinking.png"]')));

    global.FreakLady?.debug?.resetSession();
    for(let i=0;i<3;i++) global.FreakLady?.react(host,'r','swipe');
    let comeback = false;
    for(let i=0;i<3;i++){
      const r = global.FreakLady?.react(host,'g','swipe');
      const t = r?.querySelector('strong')?.textContent || '';
      if (/вернул|камебек|возвращ/i.test(t)) comeback = true;
    }
    results.push(assert('COMEBACK after 3 wrong + 3 correct', comeback));

    global.FreakLady?.debug?.resetSession();
    const cw = global.FreakLady?.debug?.selectPhrase('r','swipe',{confidence:95,action:'call'});
    results.push(assert('CONFIDENTLY_WRONG selection', cw?.category === 'confidently_wrong', cw?.id || ''));

    global.FreakLady?.debug?.resetSession();
    const lc = global.FreakLady?.debug?.selectPhrase('g','swipe',{confidence:30,action:'call'});
    results.push(assert('LOW_CONFIDENCE selection', lc?.category === 'low_confidence', lc?.id || ''));

    global.FreakLady?.debug?.resetSession();
    let repeatedOkay = true;
    for(let i=0;i<10;i++){
      const p = global.FreakLady?.debug?.selectPhrase('r','swipe',{
        action:'call', concept:'hero_call', isRepeatedLeak:true
      });
      if(!p || p.category !== 'repeated_leak' || p.leakConcept !== 'hero_call'){
        repeatedOkay = false; break;
      }
    }
    results.push(assert('REPEATED LEAK exact concept', repeatedOkay));

    global.FreakLady?.debug?.resetHistory();
    const pool = global.FreakLady?.debug?.getEligiblePool('g','swipe',{action:'call'});
    const seen = new Set(); let repeats = 0;
    for(let i=0;i<Math.min(pool.length,20);i++){
      const p = global.FreakLady?.debug?.selectPhrase('g','swipe',{action:'call'});
      if(p){
        if(seen.has(p.id)) repeats++;
        seen.add(p.id);
      }
    }
    results.push(assert('ANTI-REPEAT', repeats === 0, `repeats=${repeats}`));

    const sizingPool = global.FreakLady?.debug?.getEligiblePool('g','sizing');
    results.push(assert('CONTEXT ISOLATION sizing', sizingPool.every(x => x.context === 'sizing')));

    const sessionPool = (global.FREAK_LADY_LIBRARY || []).filter(x => x.context === 'session');
    results.push(assert('SESSION LIBRARY context', sessionPool.length === 8 && sessionPool.every(x => x.context === 'session')));

    const expectedAssets = ['idle','thinking','correct','skeptical','wrong','streak'];
    results.push(assert('ASSET MAP complete', expectedAssets.every(k => typeof global.FreakLady?.assets?.[k] === 'string')));

    host.remove();

    const failed = results.filter(x => !x.pass);
    console.log(`[FreakLady TESTS] ${results.length - failed.length}/${results.length} PASS`);
    return { pass: failed.length === 0, results, counts };
  }

  global.runFreakLadyTests = runFreakLadyTests;
})(window);
