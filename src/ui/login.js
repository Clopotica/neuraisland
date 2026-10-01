import { h, clear } from './dom.js';
import { state } from '../state.js';
import { t } from '../i18n.js';
import { login } from '../auth.js';
import { bipFace } from './avatars.js';

export function loginScreen() {
  const loading = document.getElementById('loading');
  loading.hidden = true;
  state.lang = navigator.language?.toLowerCase().startsWith('ro') ? 'ro' : 'en';
  return new Promise((resolve) => {
    const screen = h('div', { class: 'title-screen login-screen' });
    document.getElementById('ui').appendChild(screen);
    let username = '';
    let busy = false;
    const render = () => {
      document.documentElement.lang = state.lang;
      clear(screen);
      const user = h('input', { id: 'login-user', name: 'username', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: 40, required: true, value: username });
      const password = h('input', { id: 'login-password', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
      const error = h('p', { id: 'login-error', class: 'login-error', role: 'alert', hidden: true });
      const submit = h('button', { class: 'btn primary big', type: 'submit' }, t('login'));
      const languages = h('div', { class: 'seg', 'aria-label': t('chooseLang') });
      for (const [lang, label] of [['en', 'English'], ['ro', 'Română']]) {
        languages.appendChild(h('button', { type: 'button', class: state.lang === lang ? 'on' : '', 'aria-pressed': String(state.lang === lang), onclick: () => {
          if (busy) return;
          username = user.value;
          state.lang = lang;
          render();
        } }, label));
      }
      const form = h('form', { class: 'title-panel login-panel', 'aria-labelledby': 'login-title' },
        languages,
        h('h2', { id: 'login-title' }, t('loginTitle')),
        h('p', { class: 'note' }, t('loginHint')),
        h('div', { class: 'field' }, h('label', { class: 'lab', for: 'login-user' }, t('username')), user),
        h('div', { class: 'field' }, h('label', { class: 'lab', for: 'login-password' }, t('password')), password),
        error, submit);
      user.addEventListener('input', () => { error.hidden = true; });
      password.addEventListener('input', () => { error.hidden = true; });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy) return;
        busy = true;
        submit.disabled = true;
        submit.textContent = t('loggingIn');
        error.hidden = true;
        try {
          if (await login(user.value, password.value)) {
            password.value = '';
            screen.remove();
            loading.hidden = false;
            resolve();
            return;
          }
          error.textContent = t('loginInvalid');
        } catch {
          error.textContent = t('loginUnavailable');
        } finally {
          busy = false;
          submit.disabled = false;
          submit.textContent = t('login');
        }
        error.hidden = false;
        password.value = '';
        password.focus();
      });
      screen.appendChild(h('div', { class: 'title-card login-card' },
        h('div', { class: 'logo' }, h('div', { class: 'bip', html: bipFace(110, 'happy') }), h('h1', null, t('gameTitle'))), form));
      user.focus();
    };
    render();
  });
}
