// ═══════════════════════════════════════════════════════════════
//  Feature ROI Calculator — Scenario Engine
// ═══════════════════════════════════════════════════════════════

import { calculateFeature } from './calculator.js';

/**
 * Calculate results for all 3 scenarios
 * @param {Object} feature - Feature object from store
 * @returns {{ pessimistic: Object, base: Object, optimistic: Object }}
 */
export function calculateScenarios(feature) {
    const { inputs, costs, scenarios } = feature;

    const results = {};

    for (const [name, scenarioOverrides] of Object.entries(scenarios)) {
        const scenarioInputs = {
            ...inputs,
            ...scenarioOverrides,
            costs
        };
        results[name] = {
            ...calculateFeature(scenarioInputs),
            name,
            probability: scenarioOverrides.probability || inputs.probability
        };
    }

    return results;
}

/**
 * Generate sensitivity analysis
 * Shows how key metrics change when each input is varied ±20%
 * @param {Object} feature - Feature object
 * @returns {Array<{driver: string, baseValue: number, lowValue: number, highValue: number, impactPct: number}>}
 */
export function sensitivityAnalysis(feature) {
    const { inputs, costs } = feature;
    const baseResults = calculateFeature({ ...inputs, costs });
    const baseEV = baseResults.ev;

    const drivers = [
        { key: 'usersExposed', label: 'Users Exposed', value: inputs.usersExposed },
        { key: 'crUplift', label: 'CR Uplift', value: inputs.crUplift },
        { key: 'baselineAOV', label: 'Baseline AOV', value: inputs.baselineAOV },
        { key: 'probability', label: 'Probability', value: inputs.probability },
        { key: 'aovUpliftPct', label: 'AOV Change', value: inputs.aovUpliftPct },
    ];

    const results = drivers.map(driver => {
        if (driver.value === 0) {
            return {
                driver: driver.label,
                baseValue: baseEV,
                lowValue: baseEV,
                highValue: baseEV,
                impactPct: 0,
                impactLevel: 'low'
            };
        }

        // Low scenario (-20%)
        const lowInputs = { ...inputs, [driver.key]: driver.value * 0.8, costs };
        const lowResults = calculateFeature(lowInputs);

        // High scenario (+20%)
        const highInputs = { ...inputs, [driver.key]: driver.value * 1.2, costs };
        const highResults = calculateFeature(highInputs);

        const impactRange = Math.abs(highResults.ev - lowResults.ev);
        const impactPct = baseEV !== 0 ? (impactRange / Math.abs(baseEV)) * 100 : 0;

        return {
            driver: driver.label,
            baseValue: baseEV,
            lowValue: lowResults.ev,
            highValue: highResults.ev,
            impactPct,
            impactLevel: impactPct > 30 ? 'high' : impactPct > 10 ? 'medium' : 'low'
        };
    });

    // Sort by impact (highest first)
    return results.sort((a, b) => b.impactPct - a.impactPct);
}

/**
 * Get scenario comparison data for charts
 * @param {Object} scenarioResults - Results from calculateScenarios
 * @returns {Object} Chart-ready data
 */
export function getScenarioChartData(scenarioResults) {
    const labels = ['Pessimistic', 'Base', 'Optimistic'];
    const scenarios = [scenarioResults.pessimistic, scenarioResults.base, scenarioResults.optimistic];

    return {
        labels,
        revenue: scenarios.map(s => s.totalRevenue),
        profit: scenarios.map(s => s.totalProfit),
        roi: scenarios.map(s => s.roi),
        ev: scenarios.map(s => s.ev),
        payback: scenarios.map(s => Math.min(s.payback, 36)) // cap at 36 for visualization
    };
}
