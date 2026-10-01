// Saved game state + a tiny event bus.
import { getUser } from './auth.js';
const key = () => getUser() ? 'neura-island-save-v1:' + getUser() : null;

function defaults() {
  return {
    version: 1,
    name: '',
    lang: 'en',
    level: 2, // 1 = Explorer, 2 = Scientist, 3 = Inventor
    sound: true,
    tts: false,
    quality: 'high',
    qualityChosen: false, // true once the player picks graphics themselves
    voiceEn: '',
    voiceRo: '',
    screenControls: 'auto', // on-screen joystick: 'auto' | 'on' | 'off'
    started: false,
    introDone: false,
    progress: {}, // stationId -> { seen:[], exps:[], passed, best, attempts, visited }
    crystals: [],
    field: {}, // island challenges solved: stationId -> true
    finalPassed: false,
    finalBest: 0,
    finishedAt: null,
    pos: null,
  };
}

export const state = defaults();

export function hasSave() {
  try {
    return !!key() && !!localStorage.getItem(key());
  } catch {
    return false;
  }
}

export function load() {
  Object.assign(state, defaults());
  if (!key()) return false;
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.assign(state, defaults(), data);
    return true;
  } catch {
    return false;
  }
}

export function save() {
  try {
    if (key()) localStorage.setItem(key(), JSON.stringify(state));
  } catch {
    /* storage can be blocked; the game still works for this session */
  }
}

export function resetProgress() {
  const keep = { lang: state.lang, sound: state.sound, tts: state.tts, quality: state.quality, qualityChosen: state.qualityChosen, voiceEn: state.voiceEn, voiceRo: state.voiceRo, screenControls: state.screenControls };
  Object.assign(state, defaults(), keep);
  save();
}

export function sp(id) {
  if (!state.progress[id]) {
    state.progress[id] = { seen: [], exps: [], passed: false, best: 0, attempts: 0, visited: false };
  }
  return state.progress[id];
}

const listeners = {};
export const bus = {
  on(ev, fn) {
    (listeners[ev] ||= []).push(fn);
    return () => (listeners[ev] = listeners[ev].filter((f) => f !== fn));
  },
  emit(ev, data) {
    (listeners[ev] || []).slice().forEach((fn) => fn(data));
  },
};
