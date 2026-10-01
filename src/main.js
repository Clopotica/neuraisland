import './styles.css';
import { load, state } from './state.js';
import { Game } from './game.js';
import { restoreSession } from './auth.js';
import { loginScreen } from './ui/login.js';

async function boot() {
  try {
    const game = new Game();
    window.__game = game;
    await game.start();
  } catch (err) {
    console.error(err);
    const el = document.getElementById('loading');
    if (el) {
      el.querySelector('p').textContent =
        'Bip could not start 3D graphics on this device (WebGL is needed). Try another browser such as Chrome, Edge or Firefox.';
    }
  }
}

// Wait for the fonts (if online) so 3D signs render with the right typeface.
const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
async function start() {
  if (!restoreSession()) await loginScreen();
  const language = state.lang;
  if (!load()) state.lang = language;
  await fontsReady;
  await boot();
}
start();
