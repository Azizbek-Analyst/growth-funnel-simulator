// ═══════════════════════════════════════════════════════════════
//  Funnel Impact Calculator — Core Logic
// ═══════════════════════════════════════════════════════════════

import { requireAuth, renderSidebar, initMobileToggle } from './router.js';
import { t, applyTranslations } from './i18n.js';

if (!requireAuth()) throw new Error('Not authenticated');
renderSidebar('funnel');
initMobileToggle();
applyTranslations();

window.addEventListener('lang-changed', () => {
    applyTranslations();
    renderSidebar('funnel');
    renderAll();
});

// ── State ───────────────────────────────────────────────────
let steps = [
  { name: 'Landing Page', value: 10000 },
  { name: 'Sign-Up Started', value: 3500 },
  { name: 'Sign-Up Completed', value: 2000 },
  { name: 'First Purchase', value: 800 },
];

// ── Helpers ─────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString('en-US');
const fmtPct = (n) => (n * 100).toFixed(1) + '%';
const fmtPP = (n) => (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + ' pp';
const fmtMoney = (n) => '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

function getConversions() {
  return steps.map((s, i) => {
    if (i === 0) return 1;
    return steps[i - 1].value > 0 ? s.value / steps[i - 1].value : 0;
  });
}

function getFinalConversion() {
  if (steps.length < 2 || steps[0].value === 0) return 0;
  return steps[steps.length - 1].value / steps[0].value;
}

function getBottleneckIndex() {
  const convs = getConversions();
  let minIdx = 1, minVal = convs[1] ?? 1;
  for (let i = 2; i < convs.length; i++) {
    if (convs[i] < minVal) { minVal = convs[i]; minIdx = i; }
  }
  return minIdx;
}

function stepLabel(i) {
  return steps[i - 1]?.name + ' → ' + steps[i]?.name;
}

// ── Render All ──────────────────────────────────────────────
function renderAll() {
  renderFunnel();
  renderTarget();
  renderStrategy();
  renderSimulator();
  renderCompare();
  renderMessage();
}

// ── Block 1: Funnel Overview ────────────────────────────────
function renderFunnel() {
  const convs = getConversions();
  const tbody = document.getElementById('funnel-tbody');
  const bnIdx = getBottleneckIndex();

  tbody.innerHTML = steps.map((s, i) => `
    <tr>
      <td><span class="step-num">${i + 1}</span></td>
      <td><input type="text" value="${s.name}" data-i="${i}" data-f="name" placeholder="Step name"></td>
      <td style="text-align:right"><input type="number" value="${s.value}" data-i="${i}" data-f="value" min="0" step="1"></td>
      <td class="conv-cell ${i > 0 && i === bnIdx ? 'bottleneck' : ''}">
        ${i === 0 ? '<span style="color:var(--color-text-muted);font-size:12px">entry</span>' : fmtPct(convs[i])}
      </td>
      <td>${steps.length > 2 ? `<button class="remove-btn" data-i="${i}" title="Remove">✕</button>` : ''}</td>
    </tr>
  `).join('');

  // events
  tbody.querySelectorAll('input[data-f="name"]').forEach(el =>
    el.addEventListener('input', e => { steps[+e.target.dataset.i].name = e.target.value; })
  );
  tbody.querySelectorAll('input[data-f="value"]').forEach(el =>
    el.addEventListener('input', e => { steps[+e.target.dataset.i].value = parseFloat(e.target.value) || 0; renderAll(); })
  );
  tbody.querySelectorAll('.remove-btn').forEach(el =>
    el.addEventListener('click', e => { steps.splice(+e.target.dataset.i, 1); renderAll(); })
  );

  // Summary chips
  const finalCR = getFinalConversion();
  const totalDrop = steps[0].value - steps[steps.length - 1].value;
  document.getElementById('summary-chips').innerHTML = `
    <div class="chip chip--primary"><div class="chip__label">${t('funnel.finalConversion')}</div><div class="chip__value">${fmtPct(finalCR)}</div><div class="chip__sub">${steps[0].name} → ${steps[steps.length - 1].name}</div></div>
    <div class="chip chip--danger"><div class="chip__label">${t('funnel.totalDropoff')}</div><div class="chip__value">${fmt(totalDrop)}</div><div class="chip__sub">${t('funnel.usersLost')}</div></div>
    <div class="chip chip--accent"><div class="chip__label">${t('funnel.bottleneck')}</div><div class="chip__value">${fmtPct(convs[bnIdx])}</div><div class="chip__sub">${stepLabel(bnIdx)}</div></div>
  `;
}

// ── Block 2: Target Goal ────────────────────────────────────
function renderTarget() {
  const currentCR = getFinalConversion();
  const targetPP = parseFloat(document.getElementById('target-pp').value) || 1;
  const targetCR = currentCR + targetPP / 100;
  const traffic = steps[0].value;
  const currentPurchases = Math.round(traffic * currentCR);
  const targetPurchases = Math.round(traffic * targetCR);
  const extra = targetPurchases - currentPurchases;

  document.getElementById('target-range').textContent = `${fmtPct(currentCR)} → ${fmtPct(targetCR)}`;
  document.getElementById('target-result').innerHTML = `
    <div class="chip"><div class="chip__label">${t('funnel.currentPurchases')}</div><div class="chip__value">${fmt(currentPurchases)}</div></div>
    <div class="chip"><div class="chip__label">${t('funnel.targetPurchases')}</div><div class="chip__value">${fmt(targetPurchases)}</div></div>
    <div class="chip chip--primary"><div class="chip__label">${t('funnel.extraPurchases')}</div><div class="chip__value">+${fmt(extra)}</div></div>
  `;
}

// ── Block 3: Improvement Strategy ───────────────────────────
function getStrategy() {
  return document.querySelector('input[name="strategy"]:checked')?.value || 'bottleneck';
}

let _lastStepKey = '';
let _selectedSteps = {};

function renderStrategy() {
  const strategy = getStrategy();
  const convs = getConversions();
  const currentCR = getFinalConversion();
  const targetPP = parseFloat(document.getElementById('target-pp').value) || 1;
  const targetCR = currentCR + targetPP / 100;
  const factor = currentCR > 0 ? targetCR / currentCR : 1;

  // Show/hide step checkboxes
  const cbContainer = document.getElementById('step-checkboxes');
  if (strategy === 'selected') {
    cbContainer.style.display = '';

    // Build a key to detect when funnel steps have changed
    const stepKey = steps.map(s => s.name).join('|');
    const needsRebuild = stepKey !== _lastStepKey;

    if (needsRebuild) {
      _lastStepKey = stepKey;
      // Initialize all steps as selected when first switching or steps change
      steps.slice(1).forEach((_, i) => {
        const idx = i + 1;
        if (!(idx in _selectedSteps)) _selectedSteps[idx] = true;
      });
      // Clean up removed steps
      Object.keys(_selectedSteps).forEach(k => {
        if (+k >= steps.length) delete _selectedSteps[k];
      });
    }

    cbContainer.innerHTML = steps.slice(1).map((s, i) => {
      const idx = i + 1;
      const isChecked = _selectedSteps[idx] !== false;
      return `<label><input type="checkbox" data-step="${idx}" ${isChecked ? 'checked' : ''}> ${stepLabel(idx)}</label>`;
    }).join('');
    cbContainer.querySelectorAll('input').forEach(el =>
      el.addEventListener('change', (e) => {
        _selectedSteps[+e.target.dataset.step] = e.target.checked;
        renderStrategy();
      })
    );
  } else {
    cbContainer.style.display = 'none';
  }

  let rows = [];

  if (strategy === 'bottleneck') {
    const bnIdx = getBottleneckIndex();
    const crI = convs[bnIdx];
    const productOthers = currentCR / crI;
    const newCrI = productOthers > 0 ? targetCR / productOthers : 0;
    const deltaPP = newCrI - crI;
    const deltaRel = crI > 0 ? (deltaPP / crI) : 0;
    const extraUsersAtStep = Math.round(steps[bnIdx - 1].value * deltaPP);

    rows.push({
      label: stepLabel(bnIdx),
      current: fmtPct(crI),
      required: fmtPct(newCrI),
      absDelta: fmtPP(deltaPP),
      relDelta: (deltaRel * 100).toFixed(1) + '%',
      extraUsers: '+' + fmt(extraUsersAtStep) + ' users',
    });

  } else if (strategy === 'selected') {
    const checked = [...cbContainer.querySelectorAll('input:checked')].map(el => +el.dataset.step);
    if (checked.length > 0) {
      const stepFactor = Math.pow(factor, 1 / checked.length);
      checked.forEach(idx => {
        const crI = convs[idx];
        const newCrI = crI * stepFactor;
        const deltaPP = newCrI - crI;
        const deltaRel = crI > 0 ? (deltaPP / crI) : 0;
        const extraUsersAtStep = Math.round(steps[idx - 1].value * deltaPP);
        rows.push({
          label: stepLabel(idx),
          current: fmtPct(crI),
          required: fmtPct(newCrI),
          absDelta: fmtPP(deltaPP),
          relDelta: (deltaRel * 100).toFixed(1) + '%',
          extraUsers: '+' + fmt(extraUsersAtStep) + ' users',
        });
      });
    }

  } else { // equal
    const stepFactor = Math.pow(factor, 1 / (steps.length - 1));
    for (let idx = 1; idx < steps.length; idx++) {
      const crI = convs[idx];
      const newCrI = crI * stepFactor;
      const deltaPP = newCrI - crI;
      const deltaRel = crI > 0 ? (deltaPP / crI) : 0;
      const extraUsersAtStep = Math.round(steps[idx - 1].value * deltaPP);
      rows.push({
        label: stepLabel(idx),
        current: fmtPct(crI),
        required: fmtPct(newCrI),
        absDelta: fmtPP(deltaPP),
        relDelta: (deltaRel * 100).toFixed(1) + '%',
        extraUsers: '+' + fmt(extraUsersAtStep) + ' users',
      });
    }
  }

  document.getElementById('strategy-output').innerHTML = rows.length ? `
    <table class="strategy-result-table">
      <thead><tr><th>${t('funnel.stratThStep')}</th><th>${t('funnel.stratThCurrent')}</th><th>${t('funnel.stratThRequired')}</th><th>${t('funnel.stratThChange')}</th><th>${t('funnel.stratThRelative')}</th><th>${t('funnel.stratThExtraUsers')}</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr>
          <td>${r.label}</td>
          <td class="mono">${r.current}</td>
          <td class="mono">${r.required}</td>
          <td class="mono positive">${r.absDelta}</td>
          <td class="mono positive">${r.relDelta}</td>
          <td class="mono positive">${r.extraUsers}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  ` : `<p class="text-sm text-muted">${t('funnel.selectAtLeast')}</p>`;
}

// ── Block 4: Impact Simulator ───────────────────────────────
function renderSimulator() {
  const convs = getConversions();
  const stepSelect = document.getElementById('sim-step');
  const currentSelection = stepSelect.value;

  // Populate step dropdown
  const options = steps.slice(1).map((s, i) => {
    const idx = i + 1;
    return `<option value="${idx}" ${String(idx) === currentSelection ? 'selected' : ''}>${stepLabel(idx)}</option>`;
  }).join('');
  stepSelect.innerHTML = options;

  const idx = parseInt(stepSelect.value) || 1;
  const upliftPct = parseFloat(document.getElementById('sim-uplift').value) || 5;
  const aov = parseFloat(document.getElementById('sim-aov').value) || 50;
  const horizon = parseInt(document.getElementById('sim-horizon').value) || 12;
  const traffic = steps[0].value;

  const crOld = convs[idx];
  const crNew = crOld * (1 + upliftPct / 100);

  // New final conversion
  let finalNew = 1;
  for (let i = 1; i < steps.length; i++) {
    finalNew *= (i === idx ? crNew : convs[i]);
  }
  const finalOld = getFinalConversion();

  const purchasesOld = Math.round(traffic * finalOld);
  const purchasesNew = Math.round(traffic * finalNew);
  const deltaPurchases = purchasesNew - purchasesOld;
  const deltaRevMonth = deltaPurchases * aov;
  const deltaRevTotal = deltaRevMonth * horizon;

  document.getElementById('sim-results').innerHTML = `
    <div class="sim-result-card"><div class="sim-result-card__label">Conversion Change</div><div class="sim-result-card__value">${fmtPct(crOld)} → ${fmtPct(crNew)}</div><div class="sim-result-card__sub">${stepLabel(idx)}</div></div>
    <div class="sim-result-card"><div class="sim-result-card__label">Final Conversion</div><div class="sim-result-card__value">${fmtPct(finalOld)} → ${fmtPct(finalNew)}</div></div>
    <div class="sim-result-card sim-result-card--green"><div class="sim-result-card__label">Extra Purchases</div><div class="sim-result-card__value">+${fmt(deltaPurchases)} / mo</div></div>
    <div class="sim-result-card sim-result-card--green"><div class="sim-result-card__label">Revenue Increase</div><div class="sim-result-card__value">+${fmtMoney(deltaRevMonth)} / mo</div><div class="sim-result-card__sub">+${fmtMoney(deltaRevTotal)} / ${horizon}mo</div></div>
  `;

  // Funnel visual comparison
  renderFunnelVisual(idx, crNew);
}

function renderFunnelVisual(changedIdx, newCrAtIdx) {
  const convs = getConversions();
  const colors = ['hsl(220,70%,55%)', 'hsl(220,60%,62%)', 'hsl(220,50%,68%)', 'hsl(220,40%,74%)', 'hsl(220,30%,80%)', 'hsl(220,20%,86%)'];

  // Current funnel values
  const currentValues = steps.map(s => s.value);

  // Simulated funnel values
  const simValues = [steps[0].value];
  for (let i = 1; i < steps.length; i++) {
    const cr = (i === changedIdx ? newCrAtIdx : convs[i]);
    simValues.push(Math.round(simValues[i - 1] * cr));
  }

  const maxVal = Math.max(...currentValues, ...simValues, 1);

  function buildViz(title, values, highlight) {
    return `
      <div class="funnel-viz">
        <div class="funnel-viz__title">${title}</div>
        ${values.map((v, i) => {
      const w = Math.max((v / maxVal) * 100, 8);
      const bg = highlight && i >= changedIdx ? 'hsl(145,50%,50%)' : colors[i % colors.length];
      return `
            ${i > 0 ? '<div class="funnel-arrow-between">↓</div>' : ''}
            <div class="funnel-bar" style="width:${w}%;background:${bg};border-radius:6px;margin:0 auto;">
              <span>${fmt(v)}</span>
            </div>`;
    }).join('')}
      </div>`;
  }

  document.getElementById('funnel-visual-compare').innerHTML =
    buildViz(t('funnel.currentFunnel'), currentValues, false) +
    buildViz(t('funnel.afterImprovement'), simValues, true);
}

// ── Compare All Steps ───────────────────────────────────────
function renderCompare() {
  const convs = getConversions();
  const traffic = steps[0].value;
  const finalOld = getFinalConversion();
  const upliftPct = parseFloat(document.getElementById('sim-uplift').value) || 5;
  const aov = parseFloat(document.getElementById('sim-aov').value) || 50;
  const horizon = parseInt(document.getElementById('sim-horizon').value) || 12;

  const results = [];
  for (let idx = 1; idx < steps.length; idx++) {
    const crNew = convs[idx] * (1 + upliftPct / 100);
    let finalNew = 1;
    for (let i = 1; i < steps.length; i++) {
      finalNew *= (i === idx ? crNew : convs[i]);
    }
    const deltaPurchases = Math.round(traffic * finalNew) - Math.round(traffic * finalOld);
    const revenueImpact = deltaPurchases * aov * horizon;
    results.push({ idx, label: stepLabel(idx), deltaPurchases, revenueImpact });
  }

  const bestIdx = results.reduce((best, r) => r.revenueImpact > best.revenueImpact ? r : best, results[0]);

  document.getElementById('compare-output').innerHTML = `
    <table class="compare-table">
      <thead><tr><th>${t('funnel.compareThStep')}</th><th>${t('funnel.compareThExtra')}</th><th>${t('funnel.compareThRevenue')} (${horizon}mo)</th></tr></thead>
      <tbody>${results.map(r => `
        <tr class="${r.idx === bestIdx.idx ? 'best-row' : ''}">
          <td>${r.label} ${r.idx === bestIdx.idx ? '⭐' : ''}</td>
          <td class="mono">+${fmt(r.deltaPurchases)}</td>
          <td class="mono">${fmtMoney(r.revenueImpact)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="margin-top:12px;font-size:13px;color:var(--color-text-muted);">
      ⭐ <strong>${t('funnel.bestStep')}</strong> ${bestIdx.label} — <strong>${fmtMoney(bestIdx.revenueImpact)}</strong> ${t('funnel.potentialRevenue')}
    </div>
  `;
}

// ── Summary Message ─────────────────────────────────────────
function renderMessage() {
  const currentCR = getFinalConversion();
  const targetPP = parseFloat(document.getElementById('target-pp').value) || 1;
  const targetCR = currentCR + targetPP / 100;
  const traffic = steps[0].value;
  const extra = Math.round(traffic * targetCR) - Math.round(traffic * currentCR);
  const convs = getConversions();
  const bnIdx = getBottleneckIndex();
  const crI = convs[bnIdx];
  const productOthers = currentCR / crI;
  const newCrI = productOthers > 0 ? targetCR / productOthers : 0;
  const extraUsersAtBn = Math.round(steps[bnIdx - 1].value * (newCrI - crI));

  document.getElementById('message-card').innerHTML = `
    <div class="message-card__heading">📊 ${t('funnel.summaryHeading')}</div>
    <div class="message-card__text">
      ${t('funnel.summaryTo')} <strong>${fmtPct(currentCR)}</strong> ${t('funnel.summaryTo2')} <strong>${fmtPct(targetCR)}</strong><br><br>
      ${t('funnel.summaryNeed')} <strong>+${fmt(extra)} ${t('funnel.summaryExtra')}</strong><br><br>
      ${t('funnel.summaryBest')} <strong>${stepLabel(bnIdx)}</strong><br>
      ${fmtPct(crI)} → ${fmtPct(newCrI)} <strong>(+${fmt(extraUsersAtBn)} users)</strong>
    </div>
  `;
}

// ── Events ──────────────────────────────────────────────────
document.getElementById('target-pp').addEventListener('input', renderAll);
document.getElementById('sim-step').addEventListener('change', () => { renderSimulator(); renderCompare(); });
document.getElementById('sim-uplift').addEventListener('input', () => { renderSimulator(); renderCompare(); });
document.getElementById('sim-aov').addEventListener('input', () => { renderSimulator(); renderCompare(); });
document.getElementById('sim-horizon').addEventListener('change', () => { renderSimulator(); renderCompare(); });

document.querySelectorAll('input[name="strategy"]').forEach(el => {
  el.addEventListener('change', () => {
    document.querySelectorAll('.strategy-option').forEach(o => o.classList.remove('active'));
    el.closest('.strategy-option').classList.add('active');
    renderStrategy();
  });
});

document.getElementById('add-step-btn').addEventListener('click', () => {
  const lastVal = steps.length > 0 ? Math.round(steps[steps.length - 1].value * 0.5) : 1000;
  steps.push({ name: `Step ${steps.length + 1}`, value: lastVal });
  renderAll();
});

document.getElementById('reset-btn').addEventListener('click', () => {
  steps = [
    { name: 'Landing Page', value: 10000 },
    { name: 'Sign-Up Started', value: 3500 },
    { name: 'Sign-Up Completed', value: 2000 },
    { name: 'First Purchase', value: 800 },
  ];
  document.getElementById('target-pp').value = 1;
  document.getElementById('sim-uplift').value = 5;
  document.getElementById('sim-aov').value = 50;
  document.getElementById('sim-horizon').value = '12';
  renderAll();
});

// ── Init ────────────────────────────────────────────────────
renderAll();
