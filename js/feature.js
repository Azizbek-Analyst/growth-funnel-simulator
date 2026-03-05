import { requireAuth, renderSidebar, initMobileToggle, initTabs } from './router.js';
import { getFeatureById, updateFeature, formatCurrency, formatPercent, formatMonths } from './store.js';
import { calculateFeature } from './calculator.js';
import { calculateScenarios, sensitivityAnalysis, getScenarioChartData } from './scenarios.js';
import { calculateScore } from './scoring.js';
import { validateFeature } from './validation.js';
import { renderCumulativeChart, renderScenarioChart } from './charts.js';
import { exportPDF } from './export.js';
import { t, applyTranslations } from './i18n.js';

if (!requireAuth()) throw new Error('Not authenticated');
renderSidebar('dashboard');
initMobileToggle();
applyTranslations();

window.addEventListener('lang-changed', () => {
    applyTranslations();
    renderSidebar('dashboard');
});

const params = new URLSearchParams(window.location.search);
const featureId = params.get('id');
if (!featureId) { window.location.href = '/dashboard.html'; throw new Error('No feature ID'); }

let feature = getFeatureById(featureId);
if (!feature) { window.location.href = '/dashboard.html'; throw new Error('Feature not found'); }

// Init tabs
initTabs(document.getElementById('feature-tabs'));

// ── Populate Header ─────────────────────────────────────────
function renderHeader() {
    const dc = { go: 'decision-go', nogo: 'decision-nogo', explore: 'decision-explore' };
    document.getElementById('feature-header').innerHTML = `
    <div class="feature-header__info">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="feature-header__title" contenteditable="true" id="feature-title">${feature.name}</h1>
          <select id="header-decision" class="form-select" style="width:auto;padding:4px 10px;font-size:12px;font-weight:600;">
            <option value="explore" ${feature.decision === 'explore' ? 'selected' : ''}>Explore</option>
            <option value="go" ${feature.decision === 'go' ? 'selected' : ''}>Go</option>
            <option value="nogo" ${feature.decision === 'nogo' ? 'selected' : ''}>No-Go</option>
          </select>
        </div>
        <div class="feature-header__meta">
          <span>Stage: <select id="header-stage" class="form-select" style="width:auto;padding:2px 8px;font-size:12px;display:inline;border:none;background:var(--color-bg-alt);border-radius:var(--radius-sm);">
            <option value="draft" ${feature.stage === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="analysis" ${feature.stage === 'analysis' ? 'selected' : ''}>Analysis</option>
            <option value="approved" ${feature.stage === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="in-progress" ${feature.stage === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="launched" ${feature.stage === 'launched' ? 'selected' : ''}>Launched</option>
          </select></span>
          <span>Owner: ${feature.ownerId}</span>
        </div>
      </div>
    </div>
    <div class="flex gap-3">
      <span class="badge badge-primary font-mono" id="header-score" data-tooltip="RICE Score"></span>
    </div>`;
    document.getElementById('header-decision').addEventListener('change', (e) => { feature.decision = e.target.value; });
    document.getElementById('header-stage').addEventListener('change', (e) => { feature.stage = e.target.value; });
    document.getElementById('feature-title').addEventListener('blur', (e) => { feature.name = e.target.textContent.trim() || feature.name; });
}

// ── Populate Inputs ─────────────────────────────────────────
const inputMap = {
    'inp-users': { key: 'usersExposed', factor: 1 },
    'inp-cr': { key: 'baselineCR', factor: 0.01 },
    'inp-aov': { key: 'baselineAOV', factor: 1 },
    'inp-horizon': { key: 'horizon', factor: 1 },
    'inp-cr-uplift': { key: 'crUplift', factor: 0.01 },
    'inp-aov-change': { key: 'aovUpliftPct', factor: 0.01 },
    'inp-probability': { key: 'probability', factor: 0.01 },
    'inp-confidence': { key: 'confidence', factor: 1 },
    'inp-arpu': { key: 'baselineARPU', factor: 1 },
    'inp-retention': { key: 'retentionChangePct', factor: 0.01 },
    'inp-lifetime': { key: 'avgLifetimeMonths', factor: 1 },
    'inp-margin': { key: 'marginPct', factor: 0.01 },
    'inp-discount': { key: 'discountRate', factor: 0.01 },
    'inp-cannibal': { key: 'cannibalizationPct', factor: 0.01 },
    'inp-evidence': { key: 'evidenceLink', factor: null },
};

const costMap = {
    'cost-eng': 'engineering', 'cost-design': 'design', 'cost-pm': 'pm',
    'cost-legal': 'legal', 'cost-vendor': 'vendor',
    'cost-infra': 'infra', 'cost-support': 'support', 'cost-licensing': 'licensing',
    'cost-effort-size': 'effortSize', 'cost-effort-pts': 'effortPoints',
    'cost-opportunity': 'opportunityCost',
};

function populateInputs() {
    for (const [elId, { key, factor }] of Object.entries(inputMap)) {
        const el = document.getElementById(elId);
        if (!el) continue;
        if (factor === null) { el.value = feature.inputs[key] || ''; }
        else if (factor !== 1) { el.value = (feature.inputs[key] / factor).toFixed(factor === 0.01 ? 1 : 0); }
        else { el.value = feature.inputs[key]; }
    }
    for (const [elId, key] of Object.entries(costMap)) {
        const el = document.getElementById(elId);
        if (el) el.value = feature.costs[key] || (el.type === 'number' ? 0 : '');
    }
    document.getElementById('notes-text').value = feature.notes || '';
    document.getElementById('confidence-value').textContent = feature.inputs.confidence;
}

function readInputs() {
    for (const [elId, { key, factor }] of Object.entries(inputMap)) {
        const el = document.getElementById(elId);
        if (!el) continue;
        if (factor === null) { feature.inputs[key] = el.value; }
        else { feature.inputs[key] = parseFloat(el.value || 0) * factor; }
    }
    for (const [elId, key] of Object.entries(costMap)) {
        const el = document.getElementById(elId);
        if (!el) continue;
        feature.costs[key] = el.type === 'number' ? parseFloat(el.value || 0) : el.value;
    }
    feature.notes = document.getElementById('notes-text').value;
}

// ── Calculate & Render Results ──────────────────────────────
let currentResults = null;

function recalculate() {
    readInputs();
    try {
        currentResults = calculateFeature({ ...feature.inputs, costs: feature.costs });
    } catch (e) { console.error('Calc error:', e); return; }

    const { errors, warnings } = validateFeature(feature.inputs, feature.costs);
    renderWarnings(errors, warnings);
    renderLiveKPIs(currentResults);
    renderFullResults(currentResults);
    renderScenarios();
    renderHistory();

    // Score
    const score = calculateScore(feature, currentResults);
    const scoreEl = document.getElementById('header-score');
    if (scoreEl) scoreEl.textContent = `Score: ${score.toFixed(1)}`;

    // Charts
    renderCumulativeChart('chart-cumulative', currentResults.cashFlowData);
    renderCumulativeChart('chart-results-cumulative', currentResults.cashFlowData);
}

function renderWarnings(errors, warnings) {
    const c = document.getElementById('warnings-container');
    c.innerHTML = '';
    errors.forEach(e => {
        c.innerHTML += `<div class="alert alert-danger"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>${e.message}</span></div>`;
    });
    warnings.forEach(w => {
        c.innerHTML += `<div class="alert alert-warning"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>${w.message}</span></div>`;
    });
}

function renderLiveKPIs(r) {
    document.getElementById('live-kpis').innerHTML = `
    <div class="kpi-card" style="--kpi-color:#1E40AF"><div class="kpi-card__label">ROI</div><div class="kpi-card__value">${formatPercent(r.roi)}</div><div class="kpi-card__sub">return on investment</div></div>
    <div class="kpi-card" style="--kpi-color:#F59E0B"><div class="kpi-card__label">Payback</div><div class="kpi-card__value">${formatMonths(r.payback)}</div><div class="kpi-card__sub">break-even period</div></div>
    <div class="kpi-card" style="--kpi-color:#10B981"><div class="kpi-card__label">Expected Value</div><div class="kpi-card__value">${formatCurrency(r.ev)}</div><div class="kpi-card__sub">probability-weighted</div></div>
    <div class="kpi-card" style="--kpi-color:#3B82F6"><div class="kpi-card__label">Monthly Revenue</div><div class="kpi-card__value">${formatCurrency(r.monthlyRevenue)}</div><div class="kpi-card__sub">incremental / month</div></div>
  `;
}

function renderFullResults(r) {
    document.getElementById('full-kpis').innerHTML = `
    <div class="kpi-card" style="--kpi-color:#1E40AF"><div class="kpi-card__label">ROI</div><div class="kpi-card__value">${formatPercent(r.roi)}</div></div>
    <div class="kpi-card" style="--kpi-color:#F59E0B"><div class="kpi-card__label">Payback Period</div><div class="kpi-card__value">${formatMonths(r.payback)}</div></div>
    <div class="kpi-card" style="--kpi-color:#10B981"><div class="kpi-card__label">Expected Value</div><div class="kpi-card__value">${formatCurrency(r.ev)}</div></div>
    <div class="kpi-card" style="--kpi-color:#3B82F6"><div class="kpi-card__label">Total Revenue</div><div class="kpi-card__value">${formatCurrency(r.totalRevenue)}</div><div class="kpi-card__sub">${feature.inputs.horizon} month horizon</div></div>
  `;

    // Sensitivity
    const sens = sensitivityAnalysis(feature);
    document.getElementById('sensitivity-table').innerHTML = `
    <table class="sensitivity-table">
      <thead><tr><th>Driver</th><th>-20%</th><th>Base EV</th><th>+20%</th><th>Impact</th></tr></thead>
      <tbody>${sens.map(s => `<tr>
        <td>${s.driver}</td>
        <td class="font-mono">${formatCurrency(s.lowValue)}</td>
        <td class="font-mono">${formatCurrency(s.baseValue)}</td>
        <td class="font-mono">${formatCurrency(s.highValue)}</td>
        <td class="impact-${s.impactLevel}">${s.impactPct.toFixed(0)}%</td>
      </tr>`).join('')}</tbody>
    </table>`;

    // Breakdown
    document.getElementById('results-breakdown').innerHTML = `
    <div class="grid grid-3 gap-4">
      <div class="form-group"><span class="form-hint">Monthly Revenue</span><span class="font-mono font-semibold">${formatCurrency(r.monthlyRevenue)}</span></div>
      <div class="form-group"><span class="form-hint">Total Revenue</span><span class="font-mono font-semibold">${formatCurrency(r.totalRevenue)}</span></div>
      <div class="form-group"><span class="form-hint">Monthly Profit</span><span class="font-mono font-semibold">${formatCurrency(r.monthlyProfit)}</span></div>
      <div class="form-group"><span class="form-hint">Total Profit</span><span class="font-mono font-semibold">${formatCurrency(r.totalProfit)}</span></div>
      <div class="form-group"><span class="form-hint">NPV</span><span class="font-mono font-semibold">${formatCurrency(r.npv)}</span></div>
      <div class="form-group"><span class="form-hint">Total Cost</span><span class="font-mono font-semibold">${formatCurrency(r.costBreakdown.total)}</span></div>
      <div class="form-group"><span class="form-hint">LTV per User</span><span class="font-mono font-semibold">${formatCurrency(r.ltv.perUser)}</span></div>
      <div class="form-group"><span class="form-hint">Total LTV Impact</span><span class="font-mono font-semibold">${formatCurrency(r.ltv.total)}</span></div>
    </div>`;
}

// ── Scenarios ───────────────────────────────────────────────
function renderScenarios() {
    const scenarioResults = calculateScenarios(feature);
    const chartData = getScenarioChartData(scenarioResults);

    const scenNames = { pessimistic: 'Pessimistic', base: 'Base', optimistic: 'Optimistic' };
    const scenColors = { pessimistic: '#EF4444', base: '#1E40AF', optimistic: '#10B981' };

    document.getElementById('scenario-cards').innerHTML = Object.entries(scenNames).map(([key, label]) => {
        const s = feature.scenarios[key];
        const r = scenarioResults[key];
        return `<div class="scenario-card ${key === 'base' ? 'active' : ''}">
      <div class="scenario-card__title"><span style="width:10px;height:10px;border-radius:50%;background:${scenColors[key]};display:inline-block;"></span>${label}</div>
      <div class="scenario-card__fields">
        <div class="form-group"><div class="flex justify-between"><span class="form-hint">CR Uplift</span><span class="font-mono text-sm">${(s.crUplift * 100).toFixed(1)}pp</span></div></div>
        <div class="form-group"><div class="flex justify-between"><span class="form-hint">AOV Change</span><span class="font-mono text-sm">${(s.aovUpliftPct * 100).toFixed(1)}%</span></div></div>
        <div class="form-group"><div class="flex justify-between"><span class="form-hint">Probability</span><span class="font-mono text-sm">${(s.probability * 100).toFixed(0)}%</span></div></div>
        <hr style="border:none;border-top:1px solid var(--color-border);">
        <div class="form-group"><div class="flex justify-between"><span class="form-hint">EV</span><span class="font-mono font-semibold">${formatCurrency(r.ev)}</span></div></div>
        <div class="form-group"><div class="flex justify-between"><span class="form-hint">ROI</span><span class="font-mono font-semibold">${formatPercent(r.roi)}</span></div></div>
      </div>
    </div>`;
    }).join('');

    renderScenarioChart('chart-scenarios', chartData);
}

// ── History ─────────────────────────────────────────────────
function renderHistory() {
    const hist = feature.history || [];
    document.getElementById('history-list').innerHTML = hist.length === 0
        ? '<p class="text-muted text-sm p-4">No changes recorded yet.</p>'
        : hist.map(h => `<div class="flex items-center gap-3 p-3" style="border-bottom:1px solid var(--color-border-light);">
        <div class="sidebar__avatar" style="width:28px;height:28px;font-size:10px;">${(h.actor || 'U')[0].toUpperCase()}</div>
        <div class="flex-1"><div class="text-sm"><strong>${h.actor}</strong> updated <span class="text-muted">${h.changes?.join(', ')}</span></div>
          <div class="text-xs text-muted">${new Date(h.timestamp).toLocaleString()}</div></div>
      </div>`).join('');
}

// ── Advanced toggle ─────────────────────────────────────────
document.getElementById('advanced-mode').addEventListener('change', (e) => {
    document.getElementById('advanced-inputs').classList.toggle('hidden', !e.target.checked);
});

// ── Confidence slider ───────────────────────────────────────
document.getElementById('inp-confidence').addEventListener('input', (e) => {
    document.getElementById('confidence-value').textContent = e.target.value;
    recalculate();
});

// ── Auto-recalculate on input change ────────────────────────
let calcTimeout;
document.querySelectorAll('.form-input, .form-select, .range-input').forEach(el => {
    el.addEventListener('input', () => {
        clearTimeout(calcTimeout);
        calcTimeout = setTimeout(recalculate, 150);
    });
    el.addEventListener('change', () => {
        clearTimeout(calcTimeout);
        recalculate();
    });
});

// ── Save ────────────────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', () => {
    readInputs();
    feature = updateFeature(featureId, {
        name: feature.name, stage: feature.stage, decision: feature.decision,
        inputs: feature.inputs, costs: feature.costs,
        scenarios: feature.scenarios, notes: feature.notes,
        results: currentResults
    });
    const btn = document.getElementById('save-btn');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved!';
    setTimeout(() => {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Changes';
    }, 2000);
});

// ── Export PDF ──────────────────────────────────────────────
document.getElementById('export-pdf-btn').addEventListener('click', () => {
    readInputs();
    if (currentResults) exportPDF(feature, currentResults);
});

// ── Init ────────────────────────────────────────────────────
renderHeader();
populateInputs();
recalculate();
