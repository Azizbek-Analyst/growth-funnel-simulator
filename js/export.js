// ═══════════════════════════════════════════════════════════════
//  Feature ROI Calculator — Export Module
// ═══════════════════════════════════════════════════════════════

import { formatCurrency, formatPercent, formatMonths, getSettings } from './store.js';

/**
 * Export features to CSV
 */
export function exportCSV(features, results) {
    const headers = ['Name', 'Stage', 'Owner', 'ROI', 'Payback', 'EV', 'Monthly Revenue', 'Total Revenue', 'Total Cost', 'Score', 'Updated'];
    const settings = getSettings();
    const rows = features.map((f, i) => {
        const r = results[i];
        return [
            f.name, f.stage, f.ownerId,
            r ? r.roi.toFixed(1) + '%' : '',
            r ? formatMonths(r.payback) : '',
            r ? r.ev.toFixed(0) : '',
            r ? r.monthlyRevenue.toFixed(0) : '',
            r ? r.totalRevenue.toFixed(0) : '',
            r ? r.costBreakdown.total.toFixed(0) : '',
            '', f.updatedAt
        ].map(v => `"${v}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    download(csv, 'features-export.csv', 'text/csv');
}

/**
 * Export features to JSON
 */
export function exportJSON(features, results) {
    const data = features.map((f, i) => ({ ...f, calculatedResults: results[i] || null }));
    download(JSON.stringify(data, null, 2), 'features-export.json', 'application/json');
}

/**
 * Export feature as PDF one-pager
 */
export async function exportPDF(feature, results) {
    const html2pdf = (await import('html2pdf.js')).default;
    const el = document.createElement('div');
    el.style.cssText = 'padding:40px;font-family:Inter,sans-serif;color:#0F172A;max-width:800px;';
    const s = getSettings();

    el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1E40AF;">
      <div>
        <h1 style="font-size:24px;margin:0;color:#1E40AF;">Feature Brief</h1>
        <p style="color:#64748B;margin:4px 0 0;font-size:14px;">${new Date().toLocaleDateString()}</p>
      </div>
      <div style="text-align:right;">
        <span style="background:${feature.decision === 'go' ? '#D1FAE5' : feature.decision === 'nogo' ? '#FEE2E2' : '#DBEAFE'};color:${feature.decision === 'go' ? '#065F46' : feature.decision === 'nogo' ? '#991B1B' : '#1E40AF'};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">${feature.decision.toUpperCase()}</span>
      </div>
    </div>
    <h2 style="font-size:20px;margin:0 0 8px;">${feature.name}</h2>
    <p style="color:#64748B;font-size:13px;margin:0 0 24px;">Stage: ${feature.stage} | Owner: ${feature.ownerId}</p>
    
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;">
      ${kpiBox('ROI', formatPercent(results.roi), '#1E40AF')}
      ${kpiBox('Payback', formatMonths(results.payback), '#F59E0B')}
      ${kpiBox('Expected Value', formatCurrency(results.ev), '#10B981')}
      ${kpiBox('Incr. Revenue', formatCurrency(results.totalRevenue), '#3B82F6')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
      <div>
        <h3 style="font-size:14px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Key Inputs</h3>
        ${infoRow('Users Exposed', feature.inputs.usersExposed?.toLocaleString())}
        ${infoRow('Baseline CR', (feature.inputs.baselineCR * 100).toFixed(1) + '%')}
        ${infoRow('Baseline AOV', formatCurrency(feature.inputs.baselineAOV))}
        ${infoRow('CR Uplift', (feature.inputs.crUplift * 100).toFixed(1) + 'pp')}
        ${infoRow('Probability', (feature.inputs.probability * 100).toFixed(0) + '%')}
        ${infoRow('Horizon', feature.inputs.horizon + ' months')}
      </div>
      <div>
        <h3 style="font-size:14px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Costs</h3>
        ${infoRow('One-time', formatCurrency(results.costBreakdown.oneTime))}
        ${infoRow('Recurring/mo', formatCurrency(results.costBreakdown.monthlyRecurring))}
        ${infoRow('Total Cost', formatCurrency(results.costBreakdown.total))}
        ${infoRow('Effort', feature.costs.effortSize)}
      </div>
    </div>

    <div style="margin-bottom:24px;">
      <h3 style="font-size:14px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Financial Summary</h3>
      ${infoRow('Monthly Revenue', formatCurrency(results.monthlyRevenue))}
      ${infoRow('Total Revenue (' + feature.inputs.horizon + 'mo)', formatCurrency(results.totalRevenue))}
      ${infoRow('Total Profit', formatCurrency(results.totalProfit))}
      ${infoRow('Net Present Value', formatCurrency(results.npv))}
    </div>
    ${feature.notes ? `<div style="margin-top:16px;padding:16px;background:#F8FAFC;border-radius:8px;"><h3 style="font-size:14px;color:#64748B;margin:0 0 8px;">Notes</h3><p style="font-size:13px;color:#334155;margin:0;">${feature.notes}</p></div>` : ''}
  `;

    html2pdf().set({
        margin: 10, filename: `${feature.name.replace(/\s+/g, '-')}-brief.pdf`,
        html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el).save();
}

function kpiBox(label, value, color) {
    return `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;border-top:3px solid ${color};"><div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${label}</div><div style="font-size:20px;font-weight:700;font-family:'Fira Code',monospace;">${value}</div></div>`;
}

function infoRow(label, value) {
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F1F5F9;font-size:13px;"><span style="color:#64748B;">${label}</span><span style="font-weight:600;">${value}</span></div>`;
}

function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
