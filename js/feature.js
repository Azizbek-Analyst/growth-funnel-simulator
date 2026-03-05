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

// ═══════════════════════════════════════════════════════════════
//  A/B Test Calculators (purely in-memory, not persisted)
// ═══════════════════════════════════════════════════════════════

const Z_TABLE = { 0.005: 2.576, 0.01: 2.326, 0.025: 1.960, 0.05: 1.645, 0.10: 1.282, 0.20: 0.842 };

function zFromAlpha(alpha, twoSided = true) {
    const key = twoSided ? alpha / 2 : alpha;
    if (Z_TABLE[key]) return Z_TABLE[key];
    const sorted = Object.keys(Z_TABLE).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
        if (key >= sorted[i] && key <= sorted[i + 1]) {
            const ratio = (key - sorted[i]) / (sorted[i + 1] - sorted[i]);
            return Z_TABLE[sorted[i]] * (1 - ratio) + Z_TABLE[sorted[i + 1]] * ratio;
        }
    }
    return 1.96;
}

function zFromPower(power) {
    const beta = 1 - power;
    return zFromAlpha(beta, false);
}

// Approximate normal CDF using Abramowitz & Stegun
function normalCDF(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.SQRT2;
    const tt = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * tt + a4) * tt) + a3) * tt + a2) * tt + a1) * tt * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
}

// Approximate t-distribution CDF for large df via normal; for small df use series
function tCDF(t, df) {
    if (df >= 30) return normalCDF(t);
    const x = df / (df + t * t);
    const a = df / 2, b = 0.5;
    const ibeta = incompleteBeta(x, a, b);
    const cdf = 1 - 0.5 * ibeta;
    return t >= 0 ? cdf : 1 - cdf;
}

function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const maxIter = 200;
    const eps = 1e-14;
    const lnBeta = gammaLn(a) + gammaLn(b) - gammaLn(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
    let f = 1, c = 1, d = 0;
    for (let i = 0; i <= maxIter; i++) {
        let m = i >> 1;
        let numerator;
        if (i === 0) numerator = 1;
        else if (i % 2 === 0) numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
        else numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
        d = 1 + numerator * d;
        if (Math.abs(d) < eps) d = eps;
        d = 1 / d;
        c = 1 + numerator / c;
        if (Math.abs(c) < eps) c = eps;
        f *= d * c;
        if (Math.abs(d * c - 1) < eps) break;
    }
    return front * (f - 1);
}

function gammaLn(z) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let x = z, y = z;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ── Sample Size Calculator ──────────────────────────────────
function calcSampleSize() {
    const p1 = parseFloat(document.getElementById('ab-baseline-cr').value || 0) / 100;
    const mde = parseFloat(document.getElementById('ab-mde').value || 0) / 100;
    const alpha = parseFloat(document.getElementById('ab-alpha').value);
    const power = parseFloat(document.getElementById('ab-power').value);
    const dailyTraffic = parseFloat(document.getElementById('ab-daily-traffic').value || 0);

    if (p1 <= 0 || mde <= 0) {
        document.getElementById('ab-res-n').textContent = '—';
        document.getElementById('ab-res-total').textContent = '—';
        document.getElementById('ab-res-duration').textContent = '—';
        return;
    }

    const p2 = p1 + mde;
    const pPool = (p1 + p2) / 2;
    const za = zFromAlpha(alpha);
    const zb = zFromPower(power);
    const n = Math.ceil(
        Math.pow(za * Math.sqrt(2 * pPool * (1 - pPool)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2)
        / Math.pow(p1 - p2, 2)
    );
    const total = n * 2;

    document.getElementById('ab-res-n').textContent = n.toLocaleString();
    document.getElementById('ab-res-total').textContent = total.toLocaleString();

    if (dailyTraffic > 0) {
        const days = Math.ceil(total / dailyTraffic);
        if (days <= 90) {
            document.getElementById('ab-res-duration').textContent = `${days}d`;
        } else {
            document.getElementById('ab-res-duration').textContent = `${(days / 7).toFixed(1)}w`;
        }
    } else {
        document.getElementById('ab-res-duration').textContent = '—';
    }
}

// ── Conversion Test (Chi-Squared / Z-Test) ──────────────────
function calcConversionTest() {
    const n1 = parseInt(document.getElementById('ab-conv-n1').value);
    const x1 = parseInt(document.getElementById('ab-conv-x1').value);
    const n2 = parseInt(document.getElementById('ab-conv-n2').value);
    const x2 = parseInt(document.getElementById('ab-conv-x2').value);
    const alpha = parseFloat(document.getElementById('ab-conv-alpha').value);

    const resultsEl = document.getElementById('ab-conv-results');

    if (!n1 || !n2 || n1 < 1 || n2 < 1 || isNaN(x1) || isNaN(x2) || x1 > n1 || x2 > n2) {
        resultsEl.style.display = 'none';
        return;
    }

    const p1 = x1 / n1;
    const p2 = x2 / n2;
    const pPool = (x1 + x2) / (n1 + n2);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
    const z = se > 0 ? (p2 - p1) / se : 0;
    const chi2 = z * z;
    const pValue = 2 * (1 - normalCDF(Math.abs(z)));

    const confPct = ((1 - alpha) * 100).toFixed(0);
    const isSignificant = pValue < alpha;

    document.getElementById('ab-conv-cr1').textContent = (p1 * 100).toFixed(2) + '%';
    document.getElementById('ab-conv-cr2').textContent = (p2 * 100).toFixed(2) + '%';
    document.getElementById('ab-conv-uplift').textContent = ((p2 - p1) * 100).toFixed(2) + 'pp';
    document.getElementById('ab-conv-rel-uplift').textContent = p1 > 0 ? ((p2 - p1) / p1 * 100).toFixed(1) + '%' : '—';
    document.getElementById('ab-conv-zscore').textContent = z.toFixed(4);
    document.getElementById('ab-conv-chi2').textContent = chi2.toFixed(4);
    document.getElementById('ab-conv-pvalue').textContent = pValue < 0.0001 ? '<0.0001' : pValue.toFixed(4);

    const verdictEl = document.getElementById('ab-conv-verdict');
    if (isSignificant) {
        verdictEl.className = 'alert alert-info';
        verdictEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span><strong>${t('feature.abSignificant')} ${confPct}%.</strong> ${p2 > p1 ? t('feature.abVariantWins') : t('feature.abControlWins')}.</span>`;
    } else {
        verdictEl.className = 'alert alert-warning';
        verdictEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${t('feature.abNotSignificant')} ${confPct}%. p = ${pValue.toFixed(4)}</span>`;
    }

    resultsEl.style.display = 'block';
}

// ── Revenue Test (2-Sample Welch's T-Test) ──────────────────
function calcRevenueTest() {
    const n1 = parseInt(document.getElementById('ab-rev-n1').value);
    const mean1 = parseFloat(document.getElementById('ab-rev-mean1').value);
    const sd1 = parseFloat(document.getElementById('ab-rev-sd1').value);
    const n2 = parseInt(document.getElementById('ab-rev-n2').value);
    const mean2 = parseFloat(document.getElementById('ab-rev-mean2').value);
    const sd2 = parseFloat(document.getElementById('ab-rev-sd2').value);
    const alpha = parseFloat(document.getElementById('ab-rev-alpha').value);

    const resultsEl = document.getElementById('ab-rev-results');

    if (!n1 || !n2 || n1 < 2 || n2 < 2 || isNaN(mean1) || isNaN(mean2) || isNaN(sd1) || isNaN(sd2) || sd1 < 0 || sd2 < 0) {
        resultsEl.style.display = 'none';
        return;
    }

    const v1 = (sd1 * sd1) / n1;
    const v2 = (sd2 * sd2) / n2;
    const se = Math.sqrt(v1 + v2);
    const tStat = se > 0 ? (mean2 - mean1) / se : 0;
    const df = se > 0 ? Math.pow(v1 + v2, 2) / (Math.pow(v1, 2) / (n1 - 1) + Math.pow(v2, 2) / (n2 - 1)) : 1;
    const pValue = 2 * (1 - tCDF(Math.abs(tStat), df));

    const confPct = ((1 - alpha) * 100).toFixed(0);
    const tCrit = zFromAlpha(alpha);
    const ciLow = (mean2 - mean1) - tCrit * se;
    const ciHigh = (mean2 - mean1) + tCrit * se;
    const isSignificant = pValue < alpha;

    document.getElementById('ab-rev-res-mean1').textContent = formatCurrency(mean1);
    document.getElementById('ab-rev-res-mean2').textContent = formatCurrency(mean2);
    document.getElementById('ab-rev-diff').textContent = formatCurrency(mean2 - mean1);
    document.getElementById('ab-rev-ci').textContent = `[${formatCurrency(ciLow)}, ${formatCurrency(ciHigh)}]`;
    document.getElementById('ab-rev-tstat').textContent = tStat.toFixed(4);
    document.getElementById('ab-rev-df').textContent = df.toFixed(1);
    document.getElementById('ab-rev-pvalue').textContent = pValue < 0.0001 ? '<0.0001' : pValue.toFixed(4);

    const verdictEl = document.getElementById('ab-rev-verdict');
    if (isSignificant) {
        verdictEl.className = 'alert alert-info';
        const winner = mean2 > mean1 ? t('feature.abVariantWins') : t('feature.abControlWins');
        verdictEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span><strong>${t('feature.abSignificant')} ${confPct}%.</strong> ${winner}.</span>`;
    } else {
        verdictEl.className = 'alert alert-warning';
        verdictEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${t('feature.abNoSignificantRev')}. p = ${pValue.toFixed(4)}</span>`;
    }

    resultsEl.style.display = 'block';
}

// ── Bind A/B inputs ─────────────────────────────────────────
document.querySelectorAll('.ab-input').forEach(el => {
    el.addEventListener('input', () => {
        calcSampleSize();
        calcConversionTest();
        calcRevenueTest();
    });
    el.addEventListener('change', () => {
        calcSampleSize();
        calcConversionTest();
        calcRevenueTest();
    });
});

function prefillAbFromFeature() {
    const crEl = document.getElementById('ab-baseline-cr');
    if (crEl && feature.inputs.baselineCR) {
        crEl.value = (feature.inputs.baselineCR * 100).toFixed(1);
    }
    const trafficEl = document.getElementById('ab-daily-traffic');
    if (trafficEl && feature.inputs.usersExposed) {
        trafficEl.value = Math.round(feature.inputs.usersExposed / 30);
    }
}

// ── Init ────────────────────────────────────────────────────
renderHeader();
populateInputs();
prefillAbFromFeature();
recalculate();
calcSampleSize();
calcConversionTest();
calcRevenueTest();
