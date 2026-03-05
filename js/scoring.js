// ═══════════════════════════════════════════════════════════════
//  Feature ROI Calculator — Scoring Engine
// ═══════════════════════════════════════════════════════════════

import { getSettings } from './store.js';

/**
 * Effort size to numeric value mapping
 */
const EFFORT_MAP = {
    'XS': 1,
    'S': 2,
    'M': 5,
    'L': 8,
    'XL': 13
};

/**
 * Calculate RICE score
 * RICE = (Reach × Impact × Confidence) / Effort
 * @param {Object} params
 * @param {number} params.reach - Users exposed (thousands)
 * @param {number} params.impact - Impact score (0.25=minimal, 0.5=low, 1=medium, 2=high, 3=massive) 
 * @param {number} params.confidence - Confidence (0-1)
 * @param {number} params.effort - Effort in person-months or size
 * @returns {number} RICE score
 */
export function riceScore({ reach, impact, confidence, effort }) {
    if (!effort || effort === 0) return 0;
    return (reach * impact * confidence) / effort;
}

/**
 * Calculate feature score using current settings formula
 * @param {Object} feature - Feature object from store
 * @param {Object} results - Calculated results
 * @returns {number} Score
 */
export function calculateScore(feature, results) {
    const settings = getSettings();
    const formula = settings.scoreFormula || 'rice';
    const weights = settings.scoreWeights || { reach: 1, impact: 1, confidence: 1, effort: 1 };

    const reach = (feature.inputs.usersExposed || 0) / 1000; // in thousands
    const effort = EFFORT_MAP[feature.costs.effortSize] || feature.costs.effortPoints || 5;
    const confidence = feature.inputs.confidence / 10; // normalize 1-10 to 0-1

    // Derive impact from ROI
    let impact;
    if (results.roi > 500) impact = 3;
    else if (results.roi > 200) impact = 2;
    else if (results.roi > 50) impact = 1;
    else if (results.roi > 0) impact = 0.5;
    else impact = 0.25;

    if (formula === 'rice') {
        return riceScore({
            reach: reach * weights.reach,
            impact: impact * weights.impact,
            confidence: confidence * weights.confidence,
            effort: effort * weights.effort
        });
    }

    if (formula === 'weighted_ev') {
        // Weighted EV: EV * confidence / effort
        return (results.ev * confidence) / (effort * 1000);
    }

    if (formula === 'custom') {
        // Custom: weighted sum
        return (
            reach * (weights.reach || 1) +
            impact * 100 * (weights.impact || 1) +
            confidence * 100 * (weights.confidence || 1) -
            effort * 10 * (weights.effort || 1)
        );
    }

    return riceScore({ reach, impact, confidence, effort });
}

/**
 * Rank features by score
 * @param {Array<{feature: Object, results: Object}>} featureResults - Array of feature+results pairs
 * @returns {Array} Sorted by score descending with rank
 */
export function rankFeatures(featureResults) {
    const scored = featureResults.map(({ feature, results }) => ({
        feature,
        results,
        score: calculateScore(feature, results)
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.map((item, index) => ({
        ...item,
        rank: index + 1
    }));
}
