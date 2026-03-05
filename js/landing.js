// Landing page no longer requires explicit authorization or project creation.
// All initialization is handled lazily by the router when a user opens the app
// (Dashboard, Documentation, etc.), so this file intentionally stays minimal.

import { getLang, setLang, applyTranslations } from './i18n.js';

applyTranslations();
updateLangToggle();

document.querySelectorAll('.landing-nav__lang .lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setLang(btn.dataset.lang);
    updateLangToggle();
  });
});

function updateLangToggle() {
  const lang = getLang();
  document.querySelectorAll('.landing-nav__lang .lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}
