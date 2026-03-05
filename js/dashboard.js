import { requireAuth, renderSidebar, initMobileToggle } from './router.js';
import { getFeatures, createFeature, deleteFeature, getCurrentProject, formatCurrency, formatPercent, formatMonths } from './store.js';
import { calculateFeature } from './calculator.js';
import { calculateScore } from './scoring.js';
import { exportCSV, exportJSON } from './export.js';
import { t, applyTranslations } from './i18n.js';

const META_KEY = 'roi_calculator_meta';

function shouldRedirectToDocs() {
    try {
        const raw = localStorage.getItem(META_KEY);
        if (!raw) return true;
        const meta = JSON.parse(raw);
        return !meta.hasSeenDocs;
    } catch {
        return true;
    }
}

if (!requireAuth()) throw new Error('Not authenticated');

if (shouldRedirectToDocs()) {
    window.location.href = '/docs.html';
}

renderSidebar('dashboard');
initMobileToggle();
applyTranslations();

const project = getCurrentProject();
document.getElementById('project-name').textContent = project?.name || t('feature.selectProject');

window.addEventListener('lang-changed', () => {
    applyTranslations();
    renderSidebar('dashboard');
    loadFeatures();
});

let allFeatures = [];
let allResults = [];

function loadFeatures() {
    allFeatures = getFeatures();
    allResults = allFeatures.map(f => {
        try { return calculateFeature({ ...f.inputs, costs: f.costs }); }
        catch { return null; }
    });
    renderStats();
    renderTable();
}

function renderStats() {
    const container = document.getElementById('stats-grid');
    const total = allFeatures.length;
    const avgROI = allResults.filter(r => r && isFinite(r.roi)).reduce((s, r) => s + r.roi, 0) / (total || 1);
    const totalEV = allResults.filter(r => r).reduce((s, r) => s + r.ev, 0);
    const approved = allFeatures.filter(f => f.decision === 'go').length;

    container.innerHTML = `
    <div class="kpi-card animate-slide-up" style="--kpi-color: var(--color-primary)">
      <div class="kpi-card__label">${t('dash.totalFeatures')}</div>
      <div class="kpi-card__value">${total}</div>
      <div class="kpi-card__sub">${t('dash.acrossStages')}</div>
    </div>
    <div class="kpi-card animate-slide-up" style="--kpi-color: var(--color-success)">
      <div class="kpi-card__label">${t('dash.avgRoi')}</div>
      <div class="kpi-card__value">${formatPercent(avgROI)}</div>
      <div class="kpi-card__sub">${t('dash.weightedAvg')}</div>
    </div>
    <div class="kpi-card animate-slide-up" style="--kpi-color: var(--color-accent)">
      <div class="kpi-card__label">${t('dash.portfolioEv')}</div>
      <div class="kpi-card__value">${formatCurrency(totalEV)}</div>
      <div class="kpi-card__sub">${t('dash.totalEv')}</div>
    </div>
    <div class="kpi-card animate-slide-up" style="--kpi-color: #8B5CF6">
      <div class="kpi-card__label">${t('dash.approved')}</div>
      <div class="kpi-card__value">${approved}</div>
      <div class="kpi-card__sub">${t('dash.goDecision')}</div>
    </div>
  `;
}

function renderTable() {
    const container = document.getElementById('features-table-container');
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const stageFilter = document.getElementById('stage-filter').value;

    let filtered = allFeatures.map((f, i) => ({ feature: f, results: allResults[i], index: i }));

    if (searchTerm) filtered = filtered.filter(x => x.feature.name.toLowerCase().includes(searchTerm));
    if (stageFilter) filtered = filtered.filter(x => x.feature.stage === stageFilter);

    document.getElementById('feature-count').textContent = `${filtered.length} feature${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <h3 class="empty-state__title">${t('dash.noFeatures')}</h3>
        <p class="empty-state__desc">${t('dash.noFeaturesDesc')}</p>
        <button class="btn btn-primary" id="empty-create-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('dash.createFeature')}
        </button>
      </div>
    `;
        document.getElementById('empty-create-btn')?.addEventListener('click', openModal);
        return;
    }

    const stageColors = { draft: 'badge-neutral', analysis: 'badge-primary', approved: 'badge-success', 'in-progress': 'badge-warning', launched: 'badge-success' };
    const decisionColors = { go: 'decision-go', nogo: 'decision-nogo', explore: 'decision-explore' };

    container.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('dash.thName')}</th>
            <th>${t('dash.thStage')}</th>
            <th>${t('dash.thDecision')}</th>
            <th>${t('dash.thEffort')}</th>
            <th>${t('dash.thRoi')}</th>
            <th>${t('dash.thPayback')}</th>
            <th>${t('dash.thEv')}</th>
            <th>${t('dash.thRevenue')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(({ feature: f, results: r }) => `
            <tr class="feature-row" data-id="${f.id}" style="cursor:pointer">
              <td><strong>${f.name}</strong></td>
              <td><span class="badge ${stageColors[f.stage] || 'badge-neutral'}">${f.stage}</span></td>
              <td><span class="badge ${decisionColors[f.decision] || 'decision-explore'}">${f.decision}</span></td>
              <td>${f.costs.effortSize || 'M'}</td>
              <td class="font-mono ${r && r.roi >= 0 ? 'text-success' : 'text-danger'}">${r ? formatPercent(r.roi) : '—'}</td>
              <td class="font-mono">${r ? formatMonths(r.payback) : '—'}</td>
              <td class="font-mono">${r ? formatCurrency(r.ev) : '—'}</td>
              <td class="font-mono">${r ? formatCurrency(r.totalRevenue) : '—'}</td>
              <td>
                <button class="btn btn-ghost btn-sm delete-btn" data-id="${f.id}" data-tooltip="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

    container.querySelectorAll('.feature-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) return;
            window.location.href = `/feature.html?id=${row.dataset.id}`;
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this feature?')) {
                deleteFeature(btn.dataset.id);
                loadFeatures();
            }
        });
    });
}

// Modal
function openModal() { document.getElementById('create-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('create-modal').classList.add('hidden'); }

document.getElementById('create-feature-btn').addEventListener('click', openModal);
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('create-modal').addEventListener('click', (e) => {
    if (e.target.id === 'create-modal') closeModal();
});

document.getElementById('create-feature-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('feature-name').value.trim();
    const stage = document.getElementById('feature-stage').value;
    const effortSize = document.getElementById('feature-effort').value;
    if (!name) return;
    const feature = createFeature({ name, stage, costs: { effortSize } });
    closeModal();
    document.getElementById('feature-name').value = '';
    window.location.href = `/feature.html?id=${feature.id}`;
});

// Filters
document.getElementById('search-input').addEventListener('input', renderTable);
document.getElementById('stage-filter').addEventListener('change', renderTable);

// Export
document.getElementById('export-csv-btn').addEventListener('click', () => {
    exportCSV(allFeatures, allResults);
});

loadFeatures();
