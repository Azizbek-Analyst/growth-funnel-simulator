import { requireAuth, renderSidebar, initMobileToggle } from './router.js';
import { getSettings, updateSettings, getOrganizations, getCurrentOrgId, getProjects, createProject, setCurrentProjectId, getCurrentProjectId, getUser } from './store.js';
import { t, applyTranslations } from './i18n.js';

if (!requireAuth()) throw new Error('Not authenticated');
renderSidebar('settings');
initMobileToggle();
applyTranslations();

window.addEventListener('lang-changed', () => {
    applyTranslations();
    renderSidebar('settings');
    populate();
});

const settings = getSettings();
const user = getUser();

// ── Populate ────────────────────────────────────────────────
function populate() {
    document.getElementById('formula-type').value = settings.scoreFormula || 'rice';
    document.getElementById('w-reach').value = settings.scoreWeights?.reach || 1;
    document.getElementById('w-impact').value = settings.scoreWeights?.impact || 1;
    document.getElementById('w-confidence').value = settings.scoreWeights?.confidence || 1;
    document.getElementById('w-effort').value = settings.scoreWeights?.effort || 1;
    document.getElementById('set-currency').value = settings.currency || 'USD';
    document.getElementById('set-horizon').value = settings.defaultHorizon || 12;
    document.getElementById('set-discount').value = (settings.discountRate || 0) * 100;

    updateFormulaDisplay();
    renderOrg();
    renderProjects();
}

function updateFormulaDisplay() {
    const type = document.getElementById('formula-type').value;
    const display = document.getElementById('formula-display');
    const formulas = {
        rice: 'Score = (Reach × Impact × Confidence) / Effort',
        weighted_ev: 'Score = (EV × Confidence) / (Effort × 1000)',
        custom: 'Score = Reach×W₁ + Impact×100×W₂ + Confidence×100×W₃ − Effort×10×W₄',
    };
    display.textContent = formulas[type] || formulas.rice;
}

function renderOrg() {
    const orgs = getOrganizations();
    const currentOrg = orgs.find(o => o.id === getCurrentOrgId());
    document.getElementById('org-info').innerHTML = currentOrg
        ? `<div class="flex items-center gap-4">
        <div class="sidebar__avatar" style="width:48px;height:48px;font-size:18px;border-radius:var(--radius-lg);">${currentOrg.name[0]}</div>
        <div><div class="font-semibold">${currentOrg.name}</div>
          <div class="text-sm text-muted">Plan: ${currentOrg.plan} | Admin: ${user?.email || 'N/A'}</div></div>
       </div>`
        : `<p class="text-muted">${t('settings.noOrg')}</p>`;
}

function renderProjects() {
    const projects = getProjects();
    const currentId = getCurrentProjectId();
    document.getElementById('projects-list').innerHTML = projects.length === 0
        ? `<p class="text-muted text-sm">${t('settings.noProjects')}</p>`
        : projects.map(p => `
      <div class="flex items-center gap-3 p-3" style="background:${p.id === currentId ? 'var(--color-primary-50)' : 'var(--color-bg-alt)'};border-radius:var(--radius-md);cursor:pointer;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${p.id === currentId ? 'var(--color-primary)' : 'var(--color-text-muted)'}" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="text-sm ${p.id === currentId ? 'font-semibold text-primary' : ''}">${p.name}</span>
        ${p.id === currentId ? `<span class="badge badge-primary">${t('settings.active')}</span>` : ''}
        <button class="btn btn-ghost btn-sm select-project" data-id="${p.id}" style="margin-left:auto;">${t('settings.select')}</button>
      </div>
    `).join('');

    document.querySelectorAll('.select-project').forEach(btn => {
        btn.addEventListener('click', () => {
            setCurrentProjectId(btn.dataset.id);
            renderProjects();
            renderSidebar('settings');
        });
    });
}

// ── Formula type change ─────────────────────────────────────
document.getElementById('formula-type').addEventListener('change', updateFormulaDisplay);

// ── Create Project ──────────────────────────────────────────
document.getElementById('create-project-btn').addEventListener('click', () => {
    const name = document.getElementById('new-project-name').value.trim();
    if (!name) return;
    createProject(name);
    document.getElementById('new-project-name').value = '';
    renderProjects();
});

// ── Save ────────────────────────────────────────────────────
document.getElementById('save-settings-btn').addEventListener('click', () => {
    updateSettings({
        scoreFormula: document.getElementById('formula-type').value,
        scoreWeights: {
            reach: parseFloat(document.getElementById('w-reach').value) || 1,
            impact: parseFloat(document.getElementById('w-impact').value) || 1,
            confidence: parseFloat(document.getElementById('w-confidence').value) || 1,
            effort: parseFloat(document.getElementById('w-effort').value) || 1,
        },
        currency: document.getElementById('set-currency').value,
        defaultHorizon: parseInt(document.getElementById('set-horizon').value) || 12,
        discountRate: parseFloat(document.getElementById('set-discount').value) / 100 || 0,
    });

    const btn = document.getElementById('save-settings-btn');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved!';
    setTimeout(() => {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Settings';
    }, 2000);
});

// ── Clear Data ──────────────────────────────────────────────
document.getElementById('clear-data-btn').addEventListener('click', () => {
    if (confirm(t('settings.clearConfirm'))) {
        localStorage.removeItem('roi_calculator');
        window.location.href = '/';
    }
});

populate();
