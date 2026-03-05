// ═══════════════════════════════════════════════════════════════
//  Feature ROI Calculator — Chart Helpers (Chart.js wrappers)
// ═══════════════════════════════════════════════════════════════

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const chartInstances = {};

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

const tooltipStyle = {
    backgroundColor: '#0F172A',
    titleFont: { family: "'Inter', sans-serif", size: 13 },
    bodyFont: { family: "'Fira Code', monospace", size: 12 },
    padding: 12, cornerRadius: 8,
};

function currencyTick(v) {
    if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + v;
}

export function renderCumulativeChart(canvasId, data) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Cumulative Gain', data: data.gains, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 },
                { label: 'Cumulative Cost', data: data.costs, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 },
                { label: 'Net Gain', data: data.net, borderColor: '#1E40AF', backgroundColor: 'transparent', borderDash: [6, 4], tension: 0.3, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { family: "'Inter',sans-serif", size: 12 } } }, tooltip: { ...tooltipStyle, callbacks: { label: c => `${c.dataset.label}: $${c.parsed.y.toLocaleString()}` } } },
            scales: { x: { grid: { display: false } }, y: { grid: { color: '#F1F5F9' }, ticks: { callback: currencyTick } } }
        }
    });
}

export function renderScenarioChart(canvasId, chartData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                { label: 'Expected Value', data: chartData.ev, backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(30,64,175,0.8)', 'rgba(16,185,129,0.7)'], borderColor: ['#EF4444', '#1E40AF', '#10B981'], borderWidth: 2, borderRadius: 8, borderSkipped: false },
                { label: 'Total Revenue', data: chartData.revenue, backgroundColor: ['rgba(239,68,68,0.2)', 'rgba(30,64,175,0.2)', 'rgba(16,185,129,0.2)'], borderColor: ['#EF4444', '#1E40AF', '#10B981'], borderWidth: 1.5, borderRadius: 8, borderSkipped: false }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }, tooltip: { ...tooltipStyle, callbacks: { label: c => `${c.dataset.label}: $${c.parsed.y.toLocaleString()}` } } },
            scales: { x: { grid: { display: false } }, y: { grid: { color: '#F1F5F9' }, ticks: { callback: currencyTick } } }
        }
    });
}

export function renderComparisonChart(canvasId, features, metric = 'ROI') {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    const colors = ['#1E40AF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316'];
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: features.map(f => f.name),
            datasets: [{ label: metric, data: features.map(f => f.value), backgroundColor: features.map((_, i) => colors[i % colors.length] + 'CC'), borderColor: features.map((_, i) => colors[i % colors.length]), borderWidth: 2, borderRadius: 6, borderSkipped: false }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: tooltipStyle },
            scales: { x: { grid: { color: '#F1F5F9' } }, y: { grid: { display: false } } }
        }
    });
}
