import { requireAuth, renderSidebar, initMobileToggle } from './router.js';
import { getFeatures, formatCurrency, formatPercent, formatMonths } from './store.js';
import { calculateFeature } from './calculator.js';
import { calculateScore } from './scoring.js';
import { renderComparisonChart } from './charts.js';
import { t, applyTranslations } from './i18n.js';

if (!requireAuth()) throw new Error('Not authenticated');
renderSidebar('compare');
initMobileToggle();
applyTranslations();

window.addEventListener('lang-changed', () => {
    applyTranslations();
    renderSidebar('compare');
    render();
});

let features = getFeatures();

function getWhatIf() {
    return {
        confidenceMult: parseFloat(document.getElementById('whatif-confidence').value),
        discountRate: parseFloat(document.getElementById('whatif-discount').value) / 100,
        horizon: parseInt(document.getElementById('whatif-horizon').value),
    };
}

function computeAll() {
    const whatIf = getWhatIf();
    const sortMetric = document.getElementById('sort-metric').value;

    let computed = features.map(f => {
        const adjustedInputs = {
            ...f.inputs,
            probability: Math.min(f.inputs.probability * whatIf.confidenceMult, 1),
            discountRate: whatIf.discountRate,
            horizon: whatIf.horizon,
            costs: f.costs,
        };
        const results = calculateFeature(adjustedInputs);
        const score = calculateScore(f, results);
        return { feature: f, results, score };
    });

    // Sort
    const sortFns = {
        roi: (a, b) => b.results.roi - a.results.roi,
        ev: (a, b) => b.results.ev - a.results.ev,
        payback: (a, b) => a.results.payback - b.results.payback,
        revenue: (a, b) => b.results.totalRevenue - a.results.totalRevenue,
        score: (a, b) => b.score - a.score,
    };
    computed.sort(sortFns[sortMetric] || sortFns.roi);
    return computed;
}

function render() {
    const computed = computeAll();
    const sortMetric = document.getElementById('sort-metric').value;

    if (computed.length === 0) {
        document.getElementById('compare-table-container').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <h3 class="empty-state__title">${t('compare.noFeatures')}</h3>
        <p class="empty-state__desc">${t('compare.noFeaturesDesc')}</p>
        <a href="/dashboard.html" class="btn btn-primary">${t('compare.goToDashboard')}</a>
      </div>`;
        return;
    }

    const dc = { go: 'decision-go', nogo: 'decision-nogo', explore: 'decision-explore' };

    document.getElementById('compare-table-container').innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('compare.thRank')}</th><th>${t('compare.thFeature')}</th><th>${t('compare.thDecision')}</th><th>${t('compare.thEffort')}</th>
            <th>${t('compare.thRoi')}</th><th>${t('compare.thPayback')}</th><th>${t('compare.thEv')}</th><th>${t('compare.thRevenue')}</th><th>${t('compare.thScore')}</th>
          </tr>
        </thead>
        <tbody>
          ${computed.map((c, i) => `
            <tr style="cursor:pointer" onclick="window.location.href='/feature.html?id=${c.feature.id}'">
              <td class="text-muted">${i + 1}</td>
              <td><strong>${c.feature.name}</strong></td>
              <td><span class="badge ${dc[c.feature.decision] || 'decision-explore'}">${c.feature.decision}</span></td>
              <td>${c.feature.costs.effortSize || 'M'}</td>
              <td class="font-mono ${c.results.roi >= 0 ? 'text-success' : 'text-danger'}">${formatPercent(c.results.roi)}</td>
              <td class="font-mono">${formatMonths(c.results.payback)}</td>
              <td class="font-mono">${formatCurrency(c.results.ev)}</td>
              <td class="font-mono">${formatCurrency(c.results.totalRevenue)}</td>
              <td class="font-mono font-semibold">${c.score.toFixed(1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

    // Chart
    const metricMap = { roi: 'roi', ev: 'ev', payback: 'payback', revenue: 'totalRevenue', score: null };
    const metricLabels = { roi: 'ROI %', ev: 'Expected Value ($)', payback: 'Payback (months)', revenue: 'Total Revenue ($)', score: 'Score' };

    const chartFeatures = computed.map(c => ({
        name: c.feature.name,
        value: sortMetric === 'score' ? c.score : c.results[metricMap[sortMetric]],
    }));
    renderComparisonChart('chart-compare', chartFeatures, metricLabels[sortMetric]);
}

// What-if slider updates
['whatif-confidence', 'whatif-discount', 'whatif-horizon'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
        const valEl = document.getElementById(id + '-val');
        if (id === 'whatif-confidence') valEl.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
        if (id === 'whatif-discount') valEl.textContent = e.target.value + '%';
        if (id === 'whatif-horizon') valEl.textContent = e.target.value;
        render();
    });
});

document.getElementById('sort-metric').addEventListener('change', render);

render();
