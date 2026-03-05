// ═══════════════════════════════════════════════════════════════
//  Feature ROI Calculator — Core Calculation Engine
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate incremental monthly revenue from a feature
 * @param {number} usersExposed - Total users/traffic exposed
 * @param {number} baselineCR - Baseline conversion rate (0-1)
 * @param {number} crUplift - Conversion rate uplift (absolute pp, e.g. 0.02 = 2pp)
 * @param {number} baselineAOV - Baseline average order value
 * @param {number} aovUpliftPct - AOV uplift as percentage (0-1)
 * @returns {number} Monthly incremental revenue
 */
export function incrementalRevenue(usersExposed, baselineCR, crUplift, baselineAOV, aovUpliftPct = 0) {
    const newCR = baselineCR + crUplift;
    const newAOV = baselineAOV * (1 + aovUpliftPct);

    const baselineRev = usersExposed * baselineCR * baselineAOV;
    const newRev = usersExposed * newCR * newAOV;

    return newRev - baselineRev;
}

/**
 * Calculate total revenue over a horizon
 * @param {number} monthlyRevenue - Monthly incremental revenue
 * @param {number} horizon - Time horizon in months
 * @returns {number} Total incremental revenue
 */
export function totalRevenue(monthlyRevenue, horizon) {
    return monthlyRevenue * horizon;
}

/**
 * Calculate incremental profit
 * @param {number} revenue - Revenue amount
 * @param {number} marginPct - Margin percentage (0-1)
 * @returns {number} Profit
 */
export function incrementalProfit(revenue, marginPct) {
    return revenue * marginPct;
}

/**
 * Calculate incremental LTV impact
 * @param {number} usersExposed - Users exposed
 * @param {number} baselineARPU - Baseline ARPU
 * @param {number} retentionChangePct - Retention change percentage (0-1)
 * @param {number} avgLifetimeMonths - Average customer lifetime in months
 * @returns {{ perUser: number, total: number }} LTV impact
 */
export function incrementalLTV(usersExposed, baselineARPU, retentionChangePct, avgLifetimeMonths) {
    const ltvChange = baselineARPU * retentionChangePct * avgLifetimeMonths;
    return {
        perUser: ltvChange,
        total: ltvChange * usersExposed
    };
}

/**
 * Calculate ROI percentage
 * @param {number} totalGain - Total monetary gain
 * @param {number} totalCost - Total cost (one-time + recurring)
 * @returns {number} ROI as percentage (e.g. 250 = 250%)
 */
export function calculateROI(totalGain, totalCost) {
    if (totalCost === 0) return totalGain > 0 ? Infinity : 0;
    return ((totalGain - totalCost) / totalCost) * 100;
}

/**
 * Calculate payback period in months
 * @param {number} totalCost - Total cost
 * @param {number} monthlyGain - Monthly gain
 * @returns {number} Payback in months (Infinity if no gain)
 */
export function paybackPeriod(totalCost, monthlyGain) {
    if (monthlyGain <= 0) return Infinity;
    return totalCost / monthlyGain;
}

/**
 * Calculate Expected Value
 * @param {number} gain - Potential gain
 * @param {number} probability - Probability of success (0-1)
 * @returns {number} Expected value
 */
export function expectedValue(gain, probability) {
    return gain * probability;
}

/**
 * Apply DCF (Discounted Cash Flow) adjustment
 * @param {number[]} monthlyCashflows - Array of monthly cash flows
 * @param {number} annualDiscountRate - Annual discount rate (e.g. 0.1 = 10%)
 * @returns {number} Net Present Value
 */
export function dcfAdjust(monthlyCashflows, annualDiscountRate) {
    const monthlyRate = Math.pow(1 + annualDiscountRate, 1 / 12) - 1;
    return monthlyCashflows.reduce((npv, cf, i) => {
        return npv + cf / Math.pow(1 + monthlyRate, i + 1);
    }, 0);
}

/**
 * Apply cannibalization adjustment
 * @param {number} revenue - Revenue before cannibalization
 * @param {number} cannibalizationPct - Cannibalization percentage (0-1)
 * @returns {number} Adjusted revenue
 */
export function applyCannibalization(revenue, cannibalizationPct) {
    return revenue * (1 - cannibalizationPct);
}

/**
 * Calculate total costs
 * @param {Object} costs - Cost breakdown
 * @param {number} horizon - Time horizon in months
 * @returns {{ oneTime: number, recurringTotal: number, total: number }}
 */
export function calculateTotalCosts(costs, horizon) {
    const oneTime = (costs.engineering || 0) + (costs.design || 0) +
        (costs.pm || 0) + (costs.legal || 0) + (costs.vendor || 0);
    const monthlyRecurring = (costs.infra || 0) + (costs.support || 0) + (costs.licensing || 0);
    const recurringTotal = monthlyRecurring * horizon;
    return {
        oneTime,
        monthlyRecurring,
        recurringTotal,
        total: oneTime + recurringTotal
    };
}

/**
 * Generate cumulative cash flow data for chart
 * @param {number} totalOneTimeCost - One-time costs
 * @param {number} monthlyRecurringCost - Monthly recurring cost
 * @param {number} monthlyGain - Monthly incremental gain
 * @param {number} horizon - Time horizon in months
 * @returns {{ labels: string[], costs: number[], gains: number[], net: number[] }}
 */
export function cumulativeCashFlow(totalOneTimeCost, monthlyRecurringCost, monthlyGain, horizon) {
    const labels = [];
    const costs = [];
    const gains = [];
    const net = [];

    let cumCost = totalOneTimeCost;
    let cumGain = 0;

    // Month 0
    labels.push('M0');
    costs.push(-cumCost);
    gains.push(0);
    net.push(-cumCost);

    for (let m = 1; m <= horizon; m++) {
        cumCost += monthlyRecurringCost;
        cumGain += monthlyGain;
        labels.push(`M${m}`);
        costs.push(-cumCost);
        gains.push(cumGain);
        net.push(cumGain - cumCost);
    }

    return { labels, costs, gains, net };
}

/**
 * Run a full feature calculation
 * @param {Object} inputs - Feature inputs
 * @returns {Object} Complete results
 */
export function calculateFeature(inputs) {
    const {
        usersExposed = 0,
        baselineCR = 0,
        crUplift = 0,
        baselineAOV = 0,
        aovUpliftPct = 0,
        baselineARPU = 0,
        retentionChangePct = 0,
        avgLifetimeMonths = 12,
        probability = 1,
        horizon = 12,
        marginPct = 1,
        discountRate = 0,
        cannibalizationPct = 0,
        costs = {}
    } = inputs;

    // Revenue
    let monthlyRev = incrementalRevenue(usersExposed, baselineCR, crUplift, baselineAOV, aovUpliftPct);
    monthlyRev = applyCannibalization(monthlyRev, cannibalizationPct);

    const totalRev = totalRevenue(monthlyRev, horizon);

    // Profit
    const monthlyProfit = incrementalProfit(monthlyRev, marginPct);
    const totalProfit = monthlyProfit * horizon;

    // LTV
    const ltv = incrementalLTV(usersExposed, baselineARPU || baselineAOV * baselineCR, retentionChangePct, avgLifetimeMonths);

    // Costs
    const costBreakdown = calculateTotalCosts(costs, horizon);

    // ROI
    const roi = calculateROI(totalProfit, costBreakdown.total);

    // Payback
    const payback = paybackPeriod(costBreakdown.total, monthlyProfit);

    // Expected Value
    const ev = expectedValue(totalProfit - costBreakdown.total, probability);

    // DCF
    let npv = 0;
    if (discountRate > 0) {
        const cashflows = Array(horizon).fill(monthlyProfit - costBreakdown.monthlyRecurring);
        cashflows[0] -= costBreakdown.oneTime; // subtract one-time cost from first month
        npv = dcfAdjust(cashflows, discountRate);
    } else {
        npv = totalProfit - costBreakdown.total;
    }

    // Cash flow data
    const cashFlowData = cumulativeCashFlow(
        costBreakdown.oneTime,
        costBreakdown.monthlyRecurring,
        monthlyProfit,
        horizon
    );

    return {
        monthlyRevenue: monthlyRev,
        totalRevenue: totalRev,
        monthlyProfit,
        totalProfit,
        ltv,
        costBreakdown,
        roi,
        payback,
        ev,
        npv,
        cashFlowData
    };
}
