// ═══════════════════════════════════════════════════════════════
//  Feature ROI Calculator — Validation Engine
// ═══════════════════════════════════════════════════════════════

/**
 * Validate all feature inputs
 * @param {Object} inputs - Feature inputs
 * @param {Object} costs - Feature costs
 * @returns {{ errors: Array, warnings: Array }}
 */
export function validateFeature(inputs, costs) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!inputs.usersExposed || inputs.usersExposed <= 0) {
        errors.push({ field: 'usersExposed', message: 'Users exposed must be greater than 0' });
    }
    if (!inputs.baselineCR || inputs.baselineCR <= 0) {
        errors.push({ field: 'baselineCR', message: 'Baseline CR is required' });
    }
    if (!inputs.baselineAOV || inputs.baselineAOV <= 0) {
        errors.push({ field: 'baselineAOV', message: 'Baseline AOV is required' });
    }

    // Percentage validations
    if (inputs.baselineCR > 1) {
        errors.push({ field: 'baselineCR', message: 'Baseline CR should be between 0 and 1 (e.g. 0.05 = 5%)' });
    }
    if (inputs.probability < 0 || inputs.probability > 1) {
        errors.push({ field: 'probability', message: 'Probability must be between 0 and 1' });
    }
    if (inputs.marginPct < 0 || inputs.marginPct > 1) {
        errors.push({ field: 'marginPct', message: 'Margin must be between 0% and 100%' });
    }
    if (inputs.cannibalizationPct < 0 || inputs.cannibalizationPct > 1) {
        errors.push({ field: 'cannibalizationPct', message: 'Cannibalization must be between 0% and 100%' });
    }

    // CR uplift validation
    if (inputs.crUpliftType === 'pp') {
        if (inputs.baselineCR + inputs.crUplift > 1) {
            errors.push({ field: 'crUplift', message: 'Baseline CR + uplift cannot exceed 100%' });
        }
    }

    // Warnings
    if (inputs.crUplift > 0.1 && !inputs.evidenceLink) {
        warnings.push({ field: 'crUplift', message: 'High uplift (>10pp) without evidence — consider adding supporting data' });
    }

    if (inputs.probability > 0.9 && inputs.confidence < 7) {
        warnings.push({ field: 'probability', message: 'High probability with low confidence — these seem inconsistent' });
    }

    const totalOneTime = (costs.engineering || 0) + (costs.design || 0) +
        (costs.pm || 0) + (costs.legal || 0) + (costs.vendor || 0);
    if (totalOneTime === 0) {
        warnings.push({ field: 'costs', message: 'No costs entered — is this feature truly free?' });
    }

    // Check if payback exceeds horizon (calculated inline)
    const monthlyGain = inputs.usersExposed * inputs.crUplift * inputs.baselineAOV * (inputs.marginPct || 1);
    const monthlyRecurring = (costs.infra || 0) + (costs.support || 0) + (costs.licensing || 0);
    const totalCost = totalOneTime + monthlyRecurring * inputs.horizon;

    if (monthlyGain > 0) {
        const payback = totalCost / monthlyGain;
        if (payback > inputs.horizon) {
            warnings.push({ field: 'horizon', message: `Payback period (${payback.toFixed(1)} months) exceeds the time horizon (${inputs.horizon} months)` });
        }
    }

    return { errors, warnings };
}

/**
 * Parse percentage input - handles both "5" (as 5%) and "0.05" formats
 * @param {string} value - Input value
 * @param {boolean} isPercentage - If true, value is in percentage (e.g. 5 = 5%)
 * @returns {number} Decimal value (0-1)
 */
export function parsePercentage(value, isPercentage = true) {
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    return isPercentage ? num / 100 : num;
}

/**
 * Format decimal as display percentage
 * @param {number} decimal - Decimal value (0-1)
 * @returns {string} Formatted percentage string
 */
export function displayPercentage(decimal) {
    return (decimal * 100).toFixed(1);
}
