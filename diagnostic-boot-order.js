// Diagnostic script to trace execution order during boot
// Run this in browser console or load as script to see when functions are called

const executionLog = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Override console methods to log to our array
console.log = function(...args) {
  executionLog.push({ type: 'log', message: args.join(' '), stack: new Error().stack });
  return originalLog.apply(console, args);
};

console.error = function(...args) {
  executionLog.push({ type: 'error', message: args.join(' '), stack: new Error().stack });
  return originalError.apply(console, args);
};

console.warn = function(...args) {
  executionLog.push({ type: 'warn', message: args.join(' '), stack: new Error().stack });
  return originalWarn.apply(console, args);
};

// Monitor key state changes
const stateMonitor = {
  checkWindowS: setInterval(() => {
    if (typeof window.S !== 'undefined' && !stateMonitor.foundS) {
      stateMonitor.foundS = true;
      console.log('[MONITOR] window.S is now defined');
    }
  }, 10),
  foundS: false,

  checkShow: setInterval(() => {
    if (typeof show !== 'undefined' && !stateMonitor.foundShow) {
      stateMonitor.foundShow = true;
      console.log('[MONITOR] show() is now defined');
    }
  }, 10),
  foundShow: false,

  checkCore: setInterval(() => {
    if (window.PokerSwipeCore && !stateMonitor.foundCore) {
      stateMonitor.foundCore = true;
      console.log('[MONITOR] PokerSwipeCore is now defined');
    }
  }, 10),
  foundCore: false
};

// Listen for errors
window.addEventListener('error', (e) => {
  console.error('[WINDOW ERROR]', e.message, 'at', e.filename + ':' + e.lineno);
});

// After page fully loads, check state
window.addEventListener('load', () => {
  setTimeout(() => {
    const report = {
      timestamp: new Date().toISOString(),
      windowSdefined: typeof window.S !== 'undefined',
      showDefined: typeof show !== 'undefined',
      loadDefined: typeof load !== 'undefined',
      saveDefined: typeof save !== 'undefined',
      pokerSwipeCores: !!window.PokerSwipeCore,
      pokerBrainDefined: !!window.PokerBrain,
      renderSizingDefined: typeof renderSizing !== 'undefined',
      rankIndex28Defined: typeof rankIndex28 !== 'undefined',
      DIAG25Defined: typeof DIAG25 !== 'undefined',
      renderTournaments23Defined: typeof renderTournaments23 !== 'undefined',
      renderStoryDefined: typeof renderStory !== 'undefined',
      uiDefined: typeof ui !== 'undefined',
      selfCheckDefined: typeof selfCheck !== 'undefined',
      executionLogLength: executionLog.length,
      errorCount: executionLog.filter(x => x.type === 'error').length,
      warnCount: executionLog.filter(x => x.type === 'warn').length
    };

    console.log('=== BOOT DIAGNOSTICS ===');
    console.table(report);

    // Find all ReferenceErrors
    const referenceErrors = executionLog.filter(x => x.type === 'error' && /ReferenceError|is not defined/i.test(x.message));
    if (referenceErrors.length) {
      console.log('=== REFERENCE ERRORS DETECTED ===');
      referenceErrors.forEach((err, i) => {
        console.log(`${i+1}. ${err.message}`);
      });
    }

    // Clean up monitoring
    clearInterval(stateMonitor.checkWindowS);
    clearInterval(stateMonitor.checkShow);
    clearInterval(stateMonitor.checkCore);

    // Store report globally
    window.__bootDiagnostics = report;
    window.__executionLog = executionLog;

    console.log('=== Log stored in window.__executionLog ===');
  }, 500);
});
