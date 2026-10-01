import { h, clear, shuffle, md } from './dom.js';
import { getUser, logout } from '../auth.js';
import { L, t, levelName } from '../i18n.js';
import { state, sp, save, hasSave, resetProgress } from '../state.js';
import { bipFace, face } from './avatars.js';
import { STATION_META } from '../content/meta.js';
import { STATIONS } from '../content/index.js';
import { runQuiz, passMark } from './quiz.js';
import { sfx, speak, stopSpeaking, canSpeak, setAmbience, voicesFor, pickVoice, isNaturalVoice, onVoicesChanged } from '../audio.js';
import { islands, hub, bridges, stationIslands, edgeRadius } from '../world/layout.js';
import { setupCanvas, C, text as ctext, dot } from './draw.js';

const LEVEL_ICONS = { 1: '🌱', 2: '🔬', 3: '🚀' };

function flag(lang) {
  return lang === 'ro'
    ? h('span', { class: 'flag' }, h('i', { style: { background: '#002b7f' } }), h('i', { style: { background: '#fcd116' } }), h('i', { style: { background: '#ce1126' } }))
    : h('span', { class: 'flag', style: { background: '#012169', position: 'relative' } }, h('i', { style: { background: 'linear-gradient(90deg, transparent 40%, #fff 40%, #fff 44%, #c8102e 44%, #c8102e 56%, #fff 56%, #fff 60%, transparent 60%), linear-gradient(0deg, transparent 35%, #fff 35%, #fff 40%, #c8102e 40%, #c8102e 60%, #fff 60%, #fff 65%, transparent 65%)' } }));
}

function accountRow(game) {
  const button = h('button', { class: 'btn small', type: 'button' }, t('logout'));
  button.addEventListener('click', () => {
    if (game.mode !== 'title' && game.player) {
      const { pos, yaw } = game.player;
      state.pos = { x: pos.x, z: pos.z, yaw };
    }
    save();
    stopSpeaking();
    setAmbience(false);
    logout();
    window.location.reload();
  });
  return h('div', { class: 'set-row account-row' }, h('span', null, t('account') + ': ' + getUser()), button);
}

// ---------- Title screen ----------
export function titleScreen(game) {
  return new Promise((resolve) => {
    const saved = hasSave() && state.started;
    const screen = h('div', { class: 'title-screen' });
    game.ui.appendChild(screen);
    let mode = saved ? 'home' : 'setup';
    let name = state.name || '';
    let level = state.level || 2;

    const render = () => {
      clear(screen);
      const logo = h('div', { class: 'logo' }, h('div', { class: 'bip', html: bipFace(120, 'happy') }), h('h1', null, t('gameTitle')), h('div', { class: 'tag' }, t('tagline')));
      const panel = h('div', { class: 'title-panel' });
      panel.appendChild(accountRow(game));
      const langRow = h('div', { class: 'flags' });
      for (const lg of ['en', 'ro']) {
        const b = h('button', { class: 'flag-btn' + (state.lang === lg ? ' on' : ''), type: 'button' }, flag(lg), lg === 'en' ? 'English' : 'Română');
        b.addEventListener('click', () => {
          game.setLang(lg);
          sfx('click');
          render();
        });
        langRow.appendChild(b);
      }
      panel.appendChild(h('div', { class: 'field' }, h('div', { class: 'lab' }, t('chooseLang')), langRow));

      if (mode === 'home') {
        const cont = h('button', { class: 'btn primary big' }, '▶ ' + t('continue') + (state.name ? ' · ' + state.name : ''));
        cont.addEventListener('click', () => {
          sfx('open');
          screen.remove();
          resolve({ fresh: false });
        });
        const neu = h('button', { class: 'btn big' }, '✨ ' + t('newGame'));
        const confirm = h('div', { class: 'confirm', hidden: true }, h('div', null, t('resetConfirm')));
        const yes = h('button', { class: 'btn primary' }, t('resetYes'));
        const no = h('button', { class: 'btn' }, t('no'));
        confirm.appendChild(h('div', { class: 'row-btns' }, yes, no));
        neu.addEventListener('click', () => (confirm.hidden = false));
        no.addEventListener('click', () => (confirm.hidden = true));
        yes.addEventListener('click', () => {
          resetProgress();
          name = '';
          mode = 'setup';
          render();
        });
        const done = STATION_META.filter((m) => sp(m.id).passed).length;
        panel.append(
          h('div', { class: 'note', style: { textAlign: 'center', fontSize: '17px' } }, `${LEVEL_ICONS[state.level]} ${levelName(state.level)} · ${t('cores')}: ${done}/13`),
          h('div', { class: 'title-actions' }, cont, neu),
          confirm,
        );
      } else {
        const input = h('input', { type: 'text', maxlength: 20, placeholder: t('namePlaceholder'), value: name, id: 'player-name', autocomplete: 'off' });
        input.addEventListener('input', () => (name = input.value));
        panel.appendChild(h('div', { class: 'field' }, h('label', { class: 'lab', for: 'player-name' }, t('yourName')), input));
        const levels = h('div', { class: 'levels' });
        for (const lv of [1, 2, 3]) {
          const c = h('button', { class: 'level-card' + (level === lv ? ' on' : ''), type: 'button' }, h('div', { class: 'li' }, LEVEL_ICONS[lv]), h('h4', null, t('level' + lv)), h('p', null, t('level' + lv + 'd')));
          c.addEventListener('click', () => {
            level = lv;
            sfx('click');
            levels.querySelectorAll('.level-card').forEach((el, i) => el.classList.toggle('on', i + 1 === lv));
          });
          levels.appendChild(c);
        }
        panel.appendChild(h('div', { class: 'field' }, h('div', { class: 'lab' }, t('chooseLevel')), levels));
        const go = h('button', { class: 'btn primary big' }, '🚀 ' + t('start'));
        go.addEventListener('click', () => {
          state.name = (name || '').trim().slice(0, 20) || (state.lang === 'ro' ? 'Explorator' : 'Explorer');
          state.level = level;
          state.started = true;
          save();
          sfx('open');
          screen.remove();
          resolve({ fresh: true });
        });
        panel.appendChild(h('div', { class: 'title-actions' }, go));
      }
      screen.appendChild(h('div', { class: 'title-card' }, logo, panel));
    };
    render();
  });
}

// ---------- Generic panel helper ----------
function modal(game, { title, icon, width = 'narrow', onClose }) {
  const overlay = h('div', { class: 'overlay' });
  const closeBtn = h('button', { class: 'btn icon x-btn', 'aria-label': t('close') }, '✕');
  const body = h('div', { class: 'panel-body' });
  const panel = h('div', { class: 'panel ' + width, role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'panel-head' }, icon ? h('div', { class: 'badge', style: { background: '#7b5cff' } }, icon) : null, h('h2', null, title), closeBtn), body);
  overlay.appendChild(panel);
  game.ui.appendChild(overlay);
  sfx('open');
  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
    stopSpeaking();
    sfx('close');
    onClose && onClose();
  };
  const onKey = (e) => {
    if (e.code === 'Escape' && !document.querySelector('.dialog')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });
  return { overlay, panel, body, close };
}

// Voice picker for the current language, best voices first.
function voiceRow() {
  const lang = state.lang === 'ro' ? 'ro' : 'en';
  const langName = lang === 'ro' ? 'română' : 'English';
  const list = voicesFor(lang);
  const current = pickVoice(lang);
  const note = h('div', { class: 'sub' });
  const select = h('select', { id: 'voice-select', 'aria-label': t('voice') });
  const wrap = h('div', { class: 'row-btns' });
  if (!list.length) {
    note.textContent = t('voiceNone', { lang: langName });
    return h('div', { class: 'set-row' }, h('div', null, h('div', { class: 'lab' }, t('voice')), note));
  }
  select.appendChild(h('option', { value: '' }, t('voiceAuto')));
  for (const v of list) {
    const label = v.name.replace(/^Microsoft\s+/i, '').replace(/\s*-\s*.*$/, '') + (isNaturalVoice(v) ? ' ✨ ' + t('voiceNatural') : '');
    select.appendChild(h('option', { value: v.name }, label));
  }
  select.value = (lang === 'ro' ? state.voiceRo : state.voiceEn) || '';
  select.addEventListener('change', () => {
    if (lang === 'ro') state.voiceRo = select.value;
    else state.voiceEn = select.value;
    save();
    speak(t('voiceSample'));
  });
  const test = h('button', { class: 'btn small', type: 'button' }, '🔊 ' + t('voiceTest'));
  test.addEventListener('click', () => speak(t('voiceSample')));
  note.textContent = list.some(isNaturalVoice) ? t('voiceGood') : t('voiceBasic');
  void current;
  wrap.append(select, test);
  return h('div', { class: 'set-row' }, h('div', null, h('div', { class: 'lab' }, t('voice')), note), wrap);
}

// ---------- Pause / settings ----------
export function openMenu(game) {
  const m = modal(game, { title: t('menu'), icon: '☰', width: 'medium', onClose: () => game.closePanel() });
  const render = () => {
    clear(m.body);
    m.panel.querySelector('h2').textContent = t('menu');
    m.body.appendChild(accountRow(game));
    const row = (lab, control, sub) => h('div', { class: 'set-row' }, h('div', null, h('div', { class: 'lab' }, lab), sub ? h('div', { class: 'sub' }, sub) : null), control);
    const segCtl = (opts, val, on) => {
      const el = h('div', { class: 'seg' });
      for (const [v, label] of opts) {
        const b = h('button', { type: 'button', class: v === val ? 'on' : '' }, label);
        b.addEventListener('click', () => {
          on(v);
          sfx('click');
          render();
        });
        el.appendChild(b);
      }
      return el;
    };
    m.body.append(
      row(t('language'), segCtl([['en', 'English'], ['ro', 'Română']], state.lang, (v) => game.setLang(v))),
      row(t('difficulty'), segCtl([[1, LEVEL_ICONS[1] + ' ' + t('level1')], [2, LEVEL_ICONS[2] + ' ' + t('level2')], [3, LEVEL_ICONS[3] + ' ' + t('level3')]], state.level, (v) => {
        state.level = v;
        save();
        game.refreshAll();
      }), t('difficultyNote')),
      row(t('sound'), segCtl([[true, t('on')], [false, t('off')]], state.sound, (v) => {
        state.sound = v;
        setAmbience(v);
        save();
      })),
      canSpeak()
        ? row(t('readAloud'), segCtl([[true, t('on')], [false, t('off')]], state.tts, (v) => {
            state.tts = v;
            if (!v) stopSpeaking();
            save();
          }), t('readAloudNote'))
        : null,
      canSpeak() ? voiceRow() : null,
      row(t('quality'), segCtl([['high', t('qualityHigh')], ['low', t('qualityLow')]], state.quality, (v) => {
        state.quality = v;
        state.qualityChosen = true;
        save();
        game.applyQuality();
      }), t('graphicsNote')),
      row(t('screenControls'), segCtl([['auto', t('scAuto')], ['on', t('on')], ['off', t('off')]], state.screenControls || 'auto', (v) => {
        state.screenControls = v;
        save();
        game.setScreenControls(v);
      }), t('screenControlsNote')),
      // The browser draws 3D without the graphics card: tell the grown-ups how to switch it on.
      game.gpu.software && /Windows/.test(navigator.userAgent) ? h('div', { class: 'gpu-tip' }, '💡 ', t('gpuTip')) : null,
    );
    // Progress overview.
    const grid = h('div', { class: 'progress-grid' });
    STATION_META.forEach((mt) => {
      const p = sp(mt.id);
      grid.appendChild(h('div', { class: 'pg' + (p.passed ? ' done' : ''), style: p.passed ? { background: mt.color } : null, title: L(mt.title) }, h('span', { class: 'n' }, mt.num), h('span', { class: 's' }, p.passed ? '✓ ' + p.best : '·')));
    });
    m.body.append(h('div', { class: 'set-row', style: { display: 'block' } }, h('div', { class: 'lab' }, t('progressTitle') + ` · ${state.name}`), grid));
    // Reset.
    const reset = h('button', { class: 'btn small' }, '🗑️ ' + t('resetProgress'));
    const confirm = h('div', { class: 'confirm', hidden: true }, h('div', null, t('resetConfirm')));
    const yes = h('button', { class: 'btn primary small' }, t('resetYes'));
    const no = h('button', { class: 'btn small' }, t('no'));
    confirm.appendChild(h('div', { class: 'row-btns' }, yes, no));
    reset.addEventListener('click', () => (confirm.hidden = false));
    no.addEventListener('click', () => (confirm.hidden = true));
    yes.addEventListener('click', () => {
      resetProgress();
      window.location.reload();
    });
    const resume = h('button', { class: 'btn primary big' }, '▶ ' + t('resume'));
    resume.addEventListener('click', () => m.close());
    m.body.append(h('div', { class: 'set-row' }, reset, resume), confirm);
  };
  render();
  // Voices can arrive a moment after the page loads.
  onVoicesChanged(() => m.overlay.isConnected && render());
  return m;
}

// ---------- Info sign ----------
export function openSign(game, sign) {
  const m = modal(game, { title: L(sign.title), icon: 'i', width: 'medium', onClose: () => game.closePanel() });
  const txt = L(sign.text);
  m.body.append(h('div', { class: 'say' }, h('div', { class: 'av', html: face('ada', 64) }), h('div', { class: 'bubble sign-text', html: md(txt) })));
  if (canSpeak()) {
    const b = h('button', { class: 'btn small ghost', style: { marginTop: '12px' } }, '🔊 ' + t('readPage'));
    b.addEventListener('click', () => speak(L(sign.title) + '. ' + txt));
    m.body.appendChild(b);
  }
  if (state.tts) speak(L(sign.title) + '. ' + txt);
  return m;
}

// ---------- Teleport map ----------
export function openMap(game) {
  const m = modal(game, { title: t('mapTitle'), icon: '🗺️', width: 'medium', onClose: () => game.closePanel() });
  const W = 640;
  const canvas = h('canvas');
  const wrap = h('div', { class: 'map-wrap' }, canvas);
  m.body.append(h('p', { class: 'note', style: { textAlign: 'center' } }, t('mapHint')), wrap);
  const g = setupCanvas(canvas, W, W);
  const S = W / 250;
  const X = (x) => W / 2 + x * S;
  const Y = (z) => W / 2 + z * S;
  const targets = [];
  const draw = (hover) => {
    g.fillStyle = '#3aa6c9';
    g.fillRect(0, 0, W, W);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.arc(W / 2, W / 2, 40 + i * 30, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.lineWidth = 2;
      g.stroke();
    }
    // Bridges.
    for (const b of bridges) {
      const open = b.unlockedBy === null || sp(b.unlockedBy).passed;
      g.strokeStyle = open ? '#b37a4c' : 'rgba(255,255,255,0.45)';
      g.lineWidth = open ? 6 : 3;
      g.setLineDash(open ? [] : [6, 6]);
      g.beginPath();
      g.moveTo(X(b.sx), Y(b.sz));
      g.lineTo(X(b.ex), Y(b.ez));
      g.stroke();
      g.setLineDash([]);
    }
    // Islands.
    for (const isl of islands) {
      g.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const r = edgeRadius(isl, a) + 3;
        const px = X(isl.x + Math.cos(a) * r);
        const py = Y(isl.z + Math.sin(a) * r);
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.fillStyle = '#f0dfa8';
      g.fill();
      g.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const r = edgeRadius(isl, a);
        const px = X(isl.x + Math.cos(a) * r);
        const py = Y(isl.z + Math.sin(a) * r);
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.fillStyle = '#7cc75a';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#1d2340';
      g.stroke();
    }
    targets.length = 0;
    // Hub marker.
    targets.push({ id: 'hub', x: X(hub.x), y: Y(hub.z), r: 26, ok: true });
    dot(g, X(0), Y(0), hover === 'hub' ? 22 : 18, '#7b5cff');
    ctext(g, '🗼', X(0), Y(0) + 1, { size: 18 });
    ctext(g, t('hub'), X(0), Y(0) + 34, { size: 15, color: '#fff' });
    // Station markers.
    stationIslands.forEach((isl, i) => {
      const meta = STATION_META[i];
      const ok = game.world.isUnlocked(meta.id);
      const passed = sp(meta.id).passed;
      const x = X(isl.x);
      const y = Y(isl.z);
      targets.push({ id: meta.id, x, y, r: 24, ok });
      dot(g, x, y, hover === meta.id && ok ? 22 : 18, ok ? meta.color : '#9aa3bf');
      ctext(g, ok ? String(meta.num) : '🔒', x, y + 1, { size: ok ? 20 : 15, color: '#fff' });
      if (passed) dot(g, x + 15, y - 15, 9, '#1fbfa2', '#1d2340', 2);
      if (state.field && state.field[meta.id]) ctext(g, '⭐', x - 16, y - 15, { size: 15 });
      if (passed) ctext(g, '✓', x + 15, y - 14, { size: 12, color: '#fff' });
    });
    // Player.
    const p = game.player.pos;
    g.save();
    g.translate(X(p.x), Y(p.z));
    g.rotate(-game.player.yaw + Math.PI);
    g.beginPath();
    g.moveTo(0, -12);
    g.lineTo(8, 8);
    g.lineTo(0, 4);
    g.lineTo(-8, 8);
    g.closePath();
    g.fillStyle = '#ff6b3d';
    g.fill();
    g.strokeStyle = '#1d2340';
    g.lineWidth = 2.5;
    g.stroke();
    g.restore();
  };
  draw();
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * W;
    return targets.find((tg) => Math.hypot(tg.x - x, tg.y - y) < tg.r);
  };
  canvas.addEventListener('pointermove', (e) => {
    const tg = pick(e);
    canvas.style.cursor = tg && tg.ok ? 'pointer' : 'default';
    draw(tg && tg.id);
  });
  canvas.addEventListener('click', (e) => {
    const tg = pick(e);
    if (!tg) return;
    if (!tg.ok) {
      sfx('bad');
      return;
    }
    m.close();
    game.teleportTo(tg.id);
  });
  void C;
  return m;
}

// ---------- Final challenge ----------
export function openFinal(game) {
  let celebrate = false;
  const m = modal(game, {
    title: t('finalTitle'),
    icon: '🏆',
    width: 'medium',
    onClose: () => {
      game.closePanel();
      if (celebrate) game.finalDialog();
    },
  });
  const n = STATION_META.length;
  const need = passMark(n);
  const intro = () => {
    clear(m.body);
    const start = h('button', { class: 'btn primary big' }, t('testStart'));
    m.body.append(
      h(
        'div',
        { class: 'result' },
        h('div', { html: face('ada', 100) }),
        h('p', { style: { fontSize: '19px', maxWidth: '50ch' } }, t('finalIntro', { n, p: need })),
        state.finalPassed ? h('p', null, t('alreadyPassed', { a: state.finalBest, b: n })) : null,
        start,
        state.finalPassed ? certButton() : null,
      ),
    );
    start.addEventListener('click', () => {
      // One question per station, preferring the hardest one allowed.
      const qs = STATION_META.map((mt) => {
        const pool = STATIONS[mt.id].quiz.filter((q) => (q.level || 1) <= state.level);
        const top = Math.max(...pool.map((q) => q.level || 1));
        const best = pool.filter((q) => (q.level || 1) === top);
        return shuffle(best)[0];
      });
      runQuiz(m.body, qs, { onFinish: result });
    });
  };
  const certButton = () => {
    const b = h('button', { class: 'btn grape' }, '📜 ' + t('certificate'));
    b.addEventListener('click', () => showCert());
    return b;
  };
  const result = (score, total) => {
    clear(m.body);
    const passed = score >= need;
    const first = passed && !state.finalPassed;
    if (passed) {
      state.finalPassed = true;
      state.finalBest = Math.max(state.finalBest || 0, score);
      if (!state.finishedAt) state.finishedAt = new Date().toISOString();
      save();
      sfx('fanfare');
    } else sfx('bad');
    const again = h('button', { class: 'btn' }, '🔁 ' + t('testRetake'));
    again.addEventListener('click', intro);
    m.body.append(
      h(
        'div',
        { class: 'result' },
        h('div', { html: passed ? bipFace(120, 'happy') : face('ada', 110) }),
        h('h3', null, passed ? t('resultPass') : t('resultFail')),
        h('p', { style: { fontSize: '20px' } }, t('resultScore', { a: score, b: total })),
        h('p', null, passed ? t('resultPassMsgFinal') : t('resultFailMsg', { p: need })),
        h('div', { class: 'row-btns', style: { justifyContent: 'center' } }, passed ? certButton() : again),
      ),
    );
    if (first) {
      celebrate = true;
      game.onFinalPassed();
    }
  };
  const showCert = () => {
    clear(m.body);
    const date = new Date(state.finishedAt || Date.now()).toLocaleDateString(state.lang === 'ro' ? 'ro-RO' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    const coreLine = h('div', { class: 'cores-line' }, STATION_META.map((mt) => h('i', { style: { background: mt.color } })));
    m.body.append(
      h(
        'div',
        { class: 'cert' },
        h('div', { html: bipFace(90, 'happy') }),
        h('h2', null, t('certificate')),
        h('div', null, t('certText')),
        h('div', { class: 'who' }, state.name),
        h('div', { style: { maxWidth: '46ch' } }, t('certText2')),
        coreLine,
        h('div', { class: 'meta' }, h('span', null, t('certLevel') + ': ' + LEVEL_ICONS[state.level] + ' ' + levelName(state.level)), h('span', null, t('certDate') + ': ' + date)),
        h('div', { style: { fontFamily: 'var(--display)', fontStyle: 'italic' } }, '— ' + t('certSigned')),
      ),
    );
  };
  intro();
  return m;
}
