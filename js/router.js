// ═══════════════════════════════════════════════════════════════
//  Feature ROI Calculator — Router & Shared UI
// ═══════════════════════════════════════════════════════════════

import { isLoggedIn, getUser, logout, getCurrentProject, getProjects, setCurrentProjectId, setUser, ensureDefaultData } from './store.js';
import { t, getLang, setLang, applyTranslations } from './i18n.js';
import { getLikes, hasLiked, likeOnce } from './likes.js';

/**
 * Check auth and redirect if needed
 */
export function requireAuth() {
  if (!isLoggedIn()) {
    setUser({
      name: 'Guest',
      email: 'guest@local',
      role: 'viewer'
    });
    ensureDefaultData();
  }
  return true;
}

/**
 * Render sidebar into the page
 */
export function renderSidebar(activePage) {
  const user = getUser();
  const project = getCurrentProject();
  const container = document.getElementById('sidebar');
  if (!container) return;

  const lang = getLang();
  const enActive = lang === 'en' ? 'active' : '';
  const ruActive = lang === 'ru' ? 'active' : '';

  container.innerHTML = `
    <div class="sidebar__logo">
      <div class="sidebar__logo-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
      </div>
      <span class="sidebar__logo-text">ROI Calculator</span>
    </div>

    <div class="sidebar__lang">
      <button class="lang-btn ${enActive}" data-lang="en">EN</button>
      <button class="lang-btn ${ruActive}" data-lang="ru">RU</button>
    </div>
    
    <nav class="sidebar__nav">
      <a href="/dashboard.html" class="sidebar__link ${activePage === 'dashboard' ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        <span data-i18n="nav.dashboard">${t('nav.dashboard')}</span>
      </a>
      <a href="/compare.html" class="sidebar__link ${activePage === 'compare' ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <span data-i18n="nav.compare">${t('nav.compare')}</span>
      </a>
      <a href="/funnel.html" class="sidebar__link ${activePage === 'funnel' ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        <span data-i18n="nav.funnel">${t('nav.funnel')}</span>
      </a>
      <a href="/docs.html" class="sidebar__link ${activePage === 'docs' ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <span data-i18n="nav.docs">${t('nav.docs')}</span>
      </a>
      <a href="/settings.html" class="sidebar__link ${activePage === 'settings' ? 'active' : ''}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span data-i18n="nav.settings">${t('nav.settings')}</span>
      </a>
    </nav>

    <div class="sidebar__like">
      <button class="sidebar__like-btn ${hasLiked() ? 'liked' : ''}" id="sidebar-like-btn" ${hasLiked() ? 'disabled' : ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${hasLiked() ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span>${hasLiked() ? t('sidebar.likeThanks') : t('sidebar.likeBtn')}</span>
      </button>
      <span class="sidebar__like-count" id="sidebar-like-count">${getLikes()} ${t('sidebar.likesCount')}</span>
    </div>

    <div class="sidebar__counter" id="sidebar-visitor-counter"></div>

    <div class="sidebar__footer">
      <div class="sidebar__user">
        <div class="sidebar__avatar">${user?.name?.[0]?.toUpperCase() || 'U'}</div>
        <div class="sidebar__user-info">
          <div class="sidebar__user-name truncate">${user?.name || 'User'}</div>
          <div class="sidebar__user-role">${project?.name || t('nav.noProject')}</div>
        </div>
        <button class="btn-icon btn-ghost" id="logout-btn" data-tooltip="${t('nav.logout')}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
        </button>
      </div>
    </div>
  `;

  // Language toggle
  container.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      renderSidebar(activePage);
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    logout();
    window.location.href = '/';
  });

  document.getElementById('sidebar-like-btn')?.addEventListener('click', () => {
    const likes = likeOnce();
    const btn = document.getElementById('sidebar-like-btn');
    const countEl = document.getElementById('sidebar-like-count');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('liked');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
      btn.querySelector('span').textContent = t('sidebar.likeThanks');
    }
    if (countEl) countEl.textContent = `${likes} ${t('sidebar.likesCount')}`;
  });

  // Visitor counter — load once per page
  const counterBox = document.getElementById('sidebar-visitor-counter');
  if (counterBox && !counterBox.dataset.loaded) {
    counterBox.dataset.loaded = '1';
    const s1 = document.createElement('script');
    s1.src = 'https://www.freevisitorcounters.com/auth.php?id=3f605157960797a9d70dc8ee76aff102c8ff160d';
    document.body.appendChild(s1);
    const s2 = document.createElement('script');
    s2.src = 'https://www.freevisitorcounters.com/en/home/counter/1513068/t/0';
    counterBox.appendChild(s2);
  }
}

/**
 * Initialize mobile sidebar toggle
 */
export function initMobileToggle() {
  const toggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

/**
 * Tab switching helper
 */
export function initTabs(tabsContainer) {
  if (!tabsContainer) return;
  const tabs = tabsContainer.querySelectorAll('.tab');
  const panels = tabsContainer.closest('.card, .tab-container, section, main')?.querySelectorAll('.tab-panel')
    || document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}
