/* PokerSwipe — ТЫ / ПРОФИЛЬ (single owner of window.renderProfile) */
(function () {
  'use strict';

  const HIGH_CONF = 80;
  const MIN_SHOW = 10;
  const MIN_DIAGNOSIS = 20;

  function state() {
    if (typeof window.PokerSwipeCore?.store?.getState === 'function') {
      return window.PokerSwipeCore.store.getState();
    }
    return window.S || { events: [], skill: 50, nick: '', snapshots: [], hands: [], dailyArchive: [], healCourses: {}, tournaments: [], xray: { runs: 0 }, streak: 0 };
  }

  function esc(v) {
    if (typeof window.esc === 'function') return window.esc(v);
    return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function eventsForProfile() {
    return (state().events || []).filter((e) => e && e.mode !== 'diagnostic' && !e.excludeFromProfile);
  }

  function gradeWeight(g) {
    if (g === 'g') return 1;
    if (g === 'y') return 0.55;
    if (g === 'r') return 0;
    return null;
  }

  function weightedQuality(ev) {
    const w = [];
    for (const e of ev) {
      const g = gradeWeight(e.grade);
      if (g === null) continue;
      w.push(g);
    }
    if (!w.length) return null;
    return Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 100);
  }

  function playerConfidence(e) {
    const c = e.confidence;
    if (c === null || c === undefined || c === '') return null;
    const n = Number(c);
    return Number.isFinite(n) ? n : null;
  }

  function conceptName(c) {
    try {
      return typeof conceptLabel === 'function' ? conceptLabel(c) : String(c || '');
    } catch (err) {
      return String(c || '');
    }
  }

  function splitSkill(filter) {
    const all = eventsForProfile().filter(filter);
    const cur = all.slice(-20);
    const prev = all.slice(-40, -20);
    const now = weightedQuality(cur);
    const before = weightedQuality(prev);
    const overall = weightedQuality(all);
    return {
      n: all.length,
      score: now ?? overall,
      delta: now != null && before != null ? now - before : null,
    };
  }

  function profileStatusLabel(n) {
    if (n < MIN_SHOW) return 'Собираем выборку';
    if (n < MIN_DIAGNOSIS) return 'Паттерн проявляется';
    return 'Достаточно для выводов';
  }

  function sampleReliability(n) {
    if (n < 8) return ['Низкая', 'Нужно больше решений в профиле'];
    if (n < 25) return ['Средняя', 'Уже виден общий паттерн'];
    return ['Высокая', 'Выборка устойчивая'];
  }

  function confidenceMatrix(ev) {
    const m = { cc: 0, cu: 0, yOk: 0, wu: 0, wc: 0, unknown: 0 };
    for (const e of ev) {
      const pc = playerConfidence(e);
      if (pc === null) {
        m.unknown++;
        continue;
      }
      const high = pc >= HIGH_CONF;
      if (e.grade === 'g') {
        if (high) m.cc++;
        else m.cu++;
      } else if (e.grade === 'y') {
        m.yOk++;
      } else if (e.grade === 'r') {
        if (high) m.wc++;
        else m.wu++;
      } else {
        m.unknown++;
      }
    }
    return m;
  }

  function blindZones(ev) {
    const by = {};
    for (const e of ev) {
      if (e.grade !== 'r') continue;
      const pc = playerConfidence(e);
      if (pc === null || pc < HIGH_CONF) continue;
      const key = e.concept || 'unknown';
      if (!by[key]) by[key] = { concept: key, n: 0, examples: [] };
      by[key].n++;
      if (by[key].examples.length < 3) by[key].examples.push(e);
    }
    return Object.values(by)
      .filter((x) => x.n >= 2)
      .sort((a, b) => b.n - a.n);
  }

  function confirmedStrengths(ev) {
    const stats = typeof conceptStats === 'function' ? conceptStats() : [];
    return stats
      .filter((x) => x.n >= MIN_SHOW && x.score >= 75 && (x.r || 0) <= Math.max(1, Math.floor(x.n * 0.15)))
      .slice(0, 4);
  }

  function healProgress() {
    const courses = state().healCourses || {};
    let done = 0;
    let total = 0;
    for (const steps of Object.values(courses)) {
      if (!Array.isArray(steps)) continue;
      total += steps.length;
      done += steps.filter(Boolean).length;
    }
    return { done, total };
  }

  function exploitOverview() {
    try {
      const raw = localStorage.getItem('pokerswipe_exploit_session_v1');
      if (!raw) return null;
      const snap = JSON.parse(raw);
      const stats = snap?.stats || snap?.progress?.stats || snap;
      const tasks = Number(stats?.tasksSeen ?? stats?.overview?.tasksSeen ?? 0);
      if (!tasks) return { tasksSeen: 0 };
      const acc = stats?.accuracy ?? stats?.overview?.accuracy;
      return {
        tasksSeen: tasks,
        accuracyPercent: acc != null && Number.isFinite(Number(acc)) ? Math.round(Number(acc) * (Number(acc) <= 1 ? 100 : 1)) : null,
      };
    } catch (e) {
      return null;
    }
  }

  function polyanaFavorites() {
    try {
      const raw = localStorage.getItem('psp-polyana-favorite-clubs-v1');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.length : 0;
    } catch (e) {
      return 0;
    }
  }

  function tournamentSummary() {
    const list = Array.isArray(state().tournaments) ? state().tournaments : [];
    if (!list.length) return { count: 0 };
    if (typeof t23Stats === 'function') {
      try {
        const st = t23Stats();
        return { count: st.count, profit: st.profit, currency: st.currency, invested: st.invested };
      } catch (e) { /* fall through */ }
    }
    return { count: list.length };
  }

  function sectionCards(ev) {
    const q = (mode) => weightedQuality(ev.filter(mode));
    const n = (mode) => ev.filter(mode).length;
    const heal = healProgress();
    const xr = state().xray || {};
    const exploit = exploitOverview();
    const polyFav = polyanaFavorites();
    const tour = tournamentSummary();
    const dailyArch = state().dailyArchive || [];
    const handsSaved = (state().hands || []).length;
    const recon = (state().myHands18 || []).length;

    return [
      {
        id: 'daily',
        title: 'Раздача дня',
        route: 'daily',
        primary: `${dailyArch.length} в архиве`,
        secondary: dailyArch.length ? 'завершённые дни, не общий счётчик решений' : 'раздел ещё не отмечал прохождения',
      },
      {
        id: 'swipe',
        title: 'Swipe / тренировка',
        route: 'swipe',
        primary: n((e) => e.mode === 'swipe' || e.mode === 'quickgame') + ' решений',
        secondary: q((e) => e.mode === 'swipe' || e.mode === 'quickgame') != null
          ? `взвешенное качество ${q((e) => e.mode === 'swipe' || e.mode === 'quickgame')}/100`
          : 'мало данных для оценки',
      },
      {
        id: 'sizing',
        title: 'Sizing',
        route: 'sizing',
        primary: n((e) => e.mode === 'sizing' || e.sizePct != null) + ' решений',
        secondary: q((e) => e.mode === 'sizing' || e.sizePct != null) != null
          ? `качество ${q((e) => e.mode === 'sizing' || e.sizePct != null)}/100`
          : 'мало данных',
      },
      {
        id: 'review',
        title: 'Review',
        route: 'review',
        primary: n((e) => e.mode === 'review') + ' упражнений',
        secondary: 'разбор учебных линий, не импортированные руки',
      },
      {
        id: 'myhands',
        title: 'My Hands',
        route: 'myhands',
        primary: `${handsSaved} раздач в коллекции`,
        secondary: recon ? `+ ${recon} черновиков recon` : 'сохранённые разборы из реальной игры',
      },
      {
        id: 'heal',
        title: 'Heal',
        route: 'heal',
        primary: heal.total ? `${heal.done}/${heal.total} шагов курса` : 'курсы не начаты',
        secondary: 'прогресс прохождения ≠ подтверждённое исправление лика',
      },
      {
        id: 'exploit',
        title: 'Exploit',
        route: 'exploit',
        primary: exploit?.tasksSeen ? `${exploit.tasksSeen} задач` : 'нет сохранённой статистики',
        secondary: exploit?.accuracyPercent != null ? `точность ответов ${exploit.accuracyPercent}%` : 'мини-приложение не записывало сессию',
      },
      {
        id: 'ranges',
        title: 'Ranges / X-Ray',
        route: 'ranges',
        primary: (xr.runs || 0) + ' сессий рентгена',
        secondary: xr.best ? `лучший результат ${xr.best}/100` : 'справочник и тренажёр диапазонов',
      },
      {
        id: 'polyana',
        title: 'Поляна',
        route: 'polyana',
        primary: polyFav ? `${polyFav} избранных клубов` : 'избранное не настроено',
        secondary: 'расписание и карта — отдельно от покерного skill',
      },
      {
        id: 'mytournaments',
        title: 'Мои турниры',
        route: 'mytournaments',
        primary: tour.count ? `${tour.count} турниров` : 'история пуста',
        secondary:
          tour.profit != null && tour.currency
            ? `результат ${tour.profit >= 0 ? '+' : ''}${tour.profit} ${tour.currency}`
            : 'реальные бай-ины и призы, не планы Поляны',
      },
    ];
  }

  function skillSummary(ev, n) {
    const skill = Number.isFinite(Number(state().skill)) ? Number(state().skill) : 50;
    const lines = [];
    if (n < MIN_SHOW) {
      lines.push('Skill пока опирается на короткую выборку — не путай с финальным уровнем.');
    } else {
      lines.push('Skill — накопленная оценка качества решений с учётом свежести и сложности спотов.');
    }
    const leak = typeof topLeak === 'function' ? topLeak() : null;
    if (leak && leak.n >= 3) {
      lines.push(`Повторяемость: ${conceptName(leak.concept)} (${leak.r}/${leak.n} ошибок в концепте).`);
    }
    return { skill, lines };
  }

  function youVsYou(ev) {
    const recent = ev.slice(-20);
    const previous = ev.slice(-40, -20);
    const r = weightedQuality(recent);
    const p = weightedQuality(previous);
    if (r == null || p == null || !previous.length) {
      return { ok: false, text: 'Сравнение «ты vs ты» появится после двух сопоставимых отрезков по 20 решений.' };
    }
    const delta = r - p;
    let text;
    if (Math.abs(delta) < 4) text = 'Качество решений примерно на том же уровне — смотри конкретные зоны ниже.';
    else if (delta > 0) text = `Взвешенное качество последних 20 решений выше предыдущих 20 на ${delta} п.п.`;
    else text = `Последние 20 решений слабее предыдущих 20 на ${Math.abs(delta)} п.п.`;
    return { ok: true, recent: r, previous: p, delta, text };
  }

  function snapshotHistory() {
    const snaps = (state().snapshots || []).slice(-14);
    if (snaps.length < 2) return null;
    return snaps;
  }

  function bindTools(root) {
    const box = root.querySelector('.psTools');
    if (!box) return;
    box.querySelector('#psHeal')?.addEventListener('click', () => window.show?.('heal'));
    box.querySelector('#psRetake')?.addEventListener('click', () => window.startDiagnostic25?.(true));
    box.querySelector('#psExport')?.addEventListener('click', () => window.exportPokerSwipe32?.());
    box.querySelector('#psImport')?.addEventListener('click', () => box.querySelector('#psImportFile')?.click());
    box.querySelector('#psImportFile')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          const incoming = parsed?.state || parsed;
          if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.events)) {
            throw new Error('Это не backup PokerSwipe');
          }
          const next = typeof structuredClone === 'function' ? structuredClone(incoming) : JSON.parse(JSON.stringify(incoming));
          if (window.PokerSwipeCore?.store?.replaceState) {
            window.PokerSwipeCore.store.replaceState(next);
            window.PokerSwipeCore.store.save?.();
          } else {
            window.S = next;
            if (typeof save === 'function') save();
          }
          window.openModal?.('<span class="ey">ИМПОРТ</span><h2>Данные восстановлены</h2><p>Перезагрузка…</p>');
          setTimeout(() => location.reload(), 800);
        } catch (err) {
          window.openModal?.(`<span class="ey">ИМПОРТ</span><h2>Не удалось</h2><p>${esc(err.message)}</p>`);
        }
      };
      reader.readAsText(file);
    });
  }

  function renderProfile() {
    const root = document.getElementById('profileArea');
    if (!root) return;
    root.className = 'psYouRoot';

    const ev = eventsForProfile();
    const n = ev.length;
    const nick = esc(state().nick || state().name || 'ИГРОК');
    const status = profileStatusLabel(n);
    const rel = sampleReliability(n);
    const sum = skillSummary(ev, n);
    const form = typeof formScore === 'function' ? formScore() : null;

    const pre = splitSkill((e) => /RFI|BB defence|3-bet|flat IP|polar 3-bet/i.test(e.concept || '') || String(e.street || '').toUpperCase() === 'ПРЕФЛОП');
    const post = splitSkill((e) => String(e.street || '').toUpperCase() !== 'ПРЕФЛОП' && e.street && e.mode !== 'sizing');
    const size = splitSkill((e) => e.mode === 'sizing' || e.sizePct != null);
    let discScore = null;
    try {
      if (typeof disciplineScore === 'function') discScore = disciplineScore();
    } catch (e) { /* noop */ }
    const disc = { n, score: Number.isFinite(discScore) ? discScore : weightedQuality(ev), delta: null };

    const matrix = confidenceMatrix(ev.filter((e) => playerConfidence(e) != null));
    const blinds = blindZones(ev);
    const strengths = confirmedStrengths(ev);
    const vs = youVsYou(ev);
    const history = snapshotHistory();
    const sections = sectionCards(ev);

    const dnaNodes = [
      ['Префлоп', pre],
      ['Постфлоп', post],
      ['Sizing', size],
      ['Дисциплина', disc],
    ];

    root.innerHTML = `<div class="psYou">
      <header class="psHero">
        <span class="psEy">ТЫ · ${nick} · POKER DNA</span>
        <h1>ТВОЁ<br><em>ПОКЕРНОЕ ДОСЬЕ.</em></h1>
        <p>Агрегат решений и разделов. Тренировки, импорт рук и турниры остаются в своих экранах — здесь только сводка.</p>
        <span class="psStateChip">${esc(status)} · ${n} решений в профиле</span>
        <div class="psHeroGrid">
          <div class="psSkillBig">
            <span>SKILL</span>
            <b>${sum.skill}</b>
            <small>${esc(sum.lines[0])}</small>
          </div>
          <div class="psHeroMeta">
            <div>
              <span>ФОРМА (20)</span>
              <b>${form != null ? form : '—'}</b>
              <small>качество последних решений, не изменение Skill</small>
            </div>
            <div>
              <span>ДОСТОВЕРНОСТЬ</span>
              <b>${esc(rel[0])}</b>
              <small>${esc(rel[1])}</small>
            </div>
          </div>
        </div>
        <button type="button" class="psMethodToggle" id="psHow">КАК СЧИТАЕТСЯ SKILL И ВЫБОРКА? ↓</button>
        <div class="psMethod hidden" id="psMethod">
          <b>Skill</b> обновляется из качества решений (g / y / r с весами), а не из числа входов в приложение.
          <b> Форма</b> — только последние 20 решений. <b>Взвешенное качество</b> в картах разделов — не «точность ответов», если это не доля верных в Exploit.
          Диагностика, тестовые и помеченные excludeFromProfile события сюда не попадают.
        </div>
      </header>

      <section class="psBlock">
        <div class="psBlockHead">
          <div><span class="psEy">КАРТА НАВЫКОВ</span><h2>POKER DNA</h2></div>
          <small>размер выборки у каждой зоны</small>
        </div>
        <div class="psDnaGrid">
          ${dnaNodes
            .map(([label, st]) => {
              const sc = st.score != null ? st.score : '—';
              const showBar = st.n >= 5 && st.score != null;
              return `<div class="psDnaNode">
              <b>${esc(label)}</b>
              <div class="psScore">${sc}${st.delta != null && Math.abs(st.delta) >= 4 ? (st.delta > 0 ? ` <small>↑${st.delta}</small>` : ` <small>↓${Math.abs(st.delta)}</small>`) : ''}</div>
              <small>${st.n} реш. · ${st.n < MIN_SHOW ? 'мало данных' : 'оценка по выборке'}</small>
              ${showBar ? `<div class="psBar"><i style="width:${Math.max(3, Math.min(100, st.score))}%"></i></div>` : ''}
            </div>`;
            })
            .join('')}
        </div>
      </section>

      <section class="psBlock">
        <span class="psEy">РАЗДЕЛЫ ПРИЛОЖЕНИЯ</span>
        <h2>СТАТИСТИКА ПО ЭКРАНАМ</h2>
        <div class="psSections">
          ${sections
            .map(
              (s) => `<button type="button" class="psSecCard" data-ps-route="${esc(s.route)}">
            <div class="psSecTop"><b>${esc(s.title)}</b><span>→</span></div>
            <p><strong>${esc(s.primary)}</strong> · ${esc(s.secondary)}</p>
          </button>`
            )
            .join('')}
        </div>
      </section>

      <section class="psBlock">
        <span class="psEy">СИЛЬНЫЕ СТОРОНЫ</span>
        <h2>ПОДТВЕРЖДЁННЫЕ ЗОНЫ</h2>
        ${
          strengths.length
            ? `<div class="psList">${strengths
                .map(
                  (s) =>
                    `<div class="psListItem"><strong>${esc(conceptName(s.concept))}</strong> · ${s.score}/100 · ${s.n} реш. · ошибок ${s.r || 0}</div>`
                )
                .join('')}</div>`
            : `<p class="psEmpty">Нужно ≥${MIN_SHOW} решений в концепте и устойчивое качество ≥75 — без этого сильную сторону не называем.</p>`
        }
      </section>

      <section class="psBlock">
        <span class="psEy">СЛЕПЫЕ ЗОНЫ</span>
        <h2>УВЕРЕННОСТЬ И ОШИБКА</h2>
        ${
          blinds.length
            ? `<div class="psList">${blinds
                .map((b) => {
                  const ex = b.examples
                    .map((e) => `${esc(conceptName(e.concept))} · conf ${playerConfidence(e)}`)
                    .join('; ');
                  return `<div class="psListItem"><strong>${esc(conceptName(b.concept))}</strong> — ${b.n} повтор${b.n === 1 ? '' : 'а'} при уверенности ≥${HIGH_CONF}. ${ex}</div>`;
                })
                .join('')}</div>`
            : `<p class="psEmpty">Нужны повторяющиеся ошибки (≥2) с явно высокой уверенностью игрока в решении.</p>`
        }
      </section>

      <section class="psBlock">
        <span class="psEy">МАТРИЦА УВЕРЕННОСТИ ИГРОКА</span>
        <h2>РЕШЕНИЕ × УВЕРЕННОСТЬ</h2>
        <p class="psEmpty" style="margin-bottom:8px">Только поле confidence (твоя уверенность). Линия y не считается провалом. Без confidence: ${matrix.unknown} событий.</p>
        <div class="psMatrix">
          <div><span>ВЕРНО · ВЫСОКАЯ</span><b>${matrix.cc}</b></div>
          <div><span>ВЕРНО · НИЗКАЯ</span><b>${matrix.cu}</b></div>
          <div><span>ДОПУСТИМО (y)</span><b>${matrix.yOk}</b></div>
          <div><span>ОШИБКА · ВЫСОКАЯ</span><b>${matrix.wc}</b></div>
          <div><span>ОШИБКА · НИЗКАЯ</span><b>${matrix.wu}</b></div>
        </div>
      </section>

      <section class="psBlock">
        <span class="psEy">ТЫ VS ТЫ</span>
        <h2>ДВА ОТРЕЗКА ПО 20 РЕШЕНИЙ</h2>
        ${
          vs.ok
            ? `<div class="psVs">
            <div><b>${vs.previous}</b><small>предыдущие 20</small></div>
            <div class="psVsMid">${vs.delta > 0 ? '+' : ''}${vs.delta} п.п.</div>
            <div><b>${vs.recent}</b><small>последние 20</small></div>
          </div><p class="psEmpty">${esc(vs.text)}</p>`
            : `<p class="psEmpty">${esc(vs.text)}</p>`
        }
      </section>

      <section class="psBlock">
        <span class="psEy">ИСТОРИЯ</span>
        <h2>SKILL И ФОРМА ПО ДНЯМ</h2>
        ${
          history
            ? `<div class="psHistory">${history
                .map((s) => {
                  const h = Math.max(4, Math.round((s.skill || 0) * 0.56));
                  return `<div class="psHistBar" style="height:${h}px" title="${esc(s.date)} skill ${s.skill}"></div>`;
                })
                .join('')}</div><p class="psEmpty">Последние ${history.length} дней из snapshots (skill по дню).</p>`
            : `<p class="psEmpty">История появится после нескольких дней с сохранёнными snapshots.</p>`
        }
      </section>

      <section class="psBlock psTools panel">
        <span class="psEy">СЛУЖЕБНОЕ</span>
        <h2>ДАННЫЕ И НАСТРОЙКИ</h2>
        <p class="psEmpty">Экспорт, импорт, Heal и повтор диагностики — те же действия, что в V32 tools.</p>
        <div class="v32ToolGrid">
          <button type="button" id="psHeal">HEAL-КУРСЫ</button>
          <button type="button" id="psRetake">ПЕРЕПРОЙТИ ТЕСТ</button>
          <button type="button" id="psExport">ЭКСПОРТ JSON</button>
          <button type="button" id="psImport">ИМПОРТ JSON</button>
        </div>
        <input class="hidden" id="psImportFile" type="file" accept="application/json,.json" hidden>
      </section>
    </div>`;

    root.querySelector('#psHow')?.addEventListener('click', () => root.querySelector('#psMethod')?.classList.toggle('hidden'));
    root.querySelectorAll('[data-ps-route]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ps-route');
        if (id === 'mytournaments') {
          if (typeof window.openMyTournamentsV72 === 'function') window.openMyTournamentsV72();
          else if (typeof window.show === 'function') window.show('mytournaments');
          return;
        }
        if (typeof window.show === 'function') window.show(id);
      });
    });
    bindTools(root);
  }

  renderProfile.__psVisualV2 = true;
  window.renderProfile = renderProfile;

  if (document.getElementById('profile')?.classList.contains('active')) {
    try {
      renderProfile();
    } catch (e) {
      console.error('[profile]', e);
    }
  }
})();
