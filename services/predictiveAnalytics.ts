import { Member, Transaction, CashFlowPrediction, LoanRecoveryForecast, MemberGrowthPrediction } from '../types';
import { addMonths, format, differenceInMonths, parseISO } from 'date-fns';

// ============================================================================
// PHASE 7: PREDICTIVE ANALYTICS
// ============================================================================

// --- 1. Cash Flow Prediction ---
export const predictCashFlow = (
    members: Member[],
    transactions: Transaction[],
    monthsAhead: number = 3
): CashFlowPrediction[] => {
    const predictions: CashFlowPrediction[] = [];
    const today = new Date();

    // Calculate historical averages
    const recentTransactions = transactions.filter(t => {
        const txnDate = new Date(t.date);
        const monthsAgo = differenceInMonths(today, txnDate);
        return monthsAgo <= 6; // Last 6 months
    });

    const avgMonthlyLoanRepayments = calculateAverage(
        recentTransactions.filter(t => t.accountType === 'Loan' && t.type === 'Credit'),
        'amount'
    );

    const avgMonthlySavings = calculateAverage(
        recentTransactions.filter(t => t.accountType === 'Savings' && t.type === 'Credit'),
        'amount'
    );

    const avgMonthlyLoans = calculateAverage(
        recentTransactions.filter(t => t.accountType === 'Loan' && t.type === 'Debit'),
        'amount'
    );

    const avgMonthlyWithdrawals = calculateAverage(
        recentTransactions.filter(t => t.accountType === 'Savings' && t.type === 'Debit'),
        'amount'
    );

    // Predict for next N months
    for (let i = 1; i <= monthsAhead; i++) {
        const futureDate = addMonths(today, i);
        const period = format(futureDate, 'yyyy-MM');

        // Apply seasonal adjustments
        const seasonalFactor = getSeasonalFactor(futureDate.getMonth());

        const loanRepayments = avgMonthlyLoanRepayments * seasonalFactor;
        const savingsDeposits = avgMonthlySavings * seasonalFactor;
        const newLoans = avgMonthlyLoans * seasonalFactor;
        const withdrawals = avgMonthlyWithdrawals * seasonalFactor;
        const operationalExpenses = 5000; // Estimated

        const predictedInflow = loanRepayments + savingsDeposits;
        const predictedOutflow = newLoans + withdrawals + operationalExpenses;
        const netCashFlow = predictedInflow - predictedOutflow;

        // Determine trend
        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (i > 1) {
            const prevPrediction = predictions[i - 2];
            if (netCashFlow > prevPrediction.netCashFlow * 1.1) trend = 'increasing';
            else if (netCashFlow < prevPrediction.netCashFlow * 0.9) trend = 'decreasing';
        }

        predictions.push({
            period,
            predictedInflow,
            predictedOutflow,
            netCashFlow,
            confidence: 75 - (i * 5), // Confidence decreases with time
            breakdown: {
                loanRepayments,
                savingsDeposits,
                newLoans,
                withdrawals,
                operationalExpenses
            },
            trend
        });
    }

    return predictions;
};

// --- 2. Loan Recovery Forecast ---
export const forecastLoanRecovery = (
    members: Member[],
    transactions: Transaction[]
): LoanRecoveryForecast[] => {
    const forecasts: LoanRecoveryForecast[] = [];

    // Get members with outstanding loans
    const membersWithLoans = members.filter(m => (m.loanPrincipal || 0) > 0);

    membersWithLoans.forEach(member => {
        const currentOutstanding = (member.loanPrincipal || 0) + (member.loanInterestDue || 0);

        // Calculate payment history
        const memberTransactions = transactions.filter(
            t => t.memberId === member.id && t.accountType === 'Loan' && t.type === 'Credit'
        );

        const avgMonthlyPayment = calculateAverage(memberTransactions, 'amount');
        const paymentConsistency = calculatePaymentConsistency(memberTransactions);

        // Predict recovery
        const monthsToRecover = avgMonthlyPayment > 0
            ? Math.ceil(currentOutstanding / avgMonthlyPayment)
            : 24; // Default 2 years if no payment history

        const predictedRecoveryDate = format(
            addMonths(new Date(), monthsToRecover),
            'yyyy-MM-dd'
        );

        // Calculate recovery probability based on payment history
        let recoveryProbability = 50; // Base probability
        if (paymentConsistency > 0.8) recoveryProbability = 90;
        else if (paymentConsistency > 0.5) recoveryProbability = 70;
        else if (paymentConsistency > 0.3) recoveryProbability = 50;
        else recoveryProbability = 30;

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' = 'medium';
        if (recoveryProbability >= 80) riskLevel = 'low';
        else if (recoveryProbability < 50) riskLevel = 'high';

        // Generate monthly predictions
        const monthlyPredictions = [];
        let remainingBalance = currentOutstanding;

        for (let i = 1; i <= Math.min(monthsToRecover, 12); i++) {
            const expectedPayment = Math.min(avgMonthlyPayment, remainingBalance);
            remainingBalance -= expectedPayment;

            monthlyPredictions.push({
                month: format(addMonths(new Date(), i), 'yyyy-MM'),
                expectedPayment,
                remainingBalance: Math.max(0, remainingBalance)
            });
        }

        // Suggested actions
        const suggestedActions = [];
        if (riskLevel === 'high') {
            suggestedActions.push('Send payment reminder immediately');
            suggestedActions.push('Schedule personal meeting');
            suggestedActions.push('Consider restructuring loan');
        } else if (riskLevel === 'medium') {
            suggestedActions.push('Send monthly payment reminder');
            suggestedActions.push('Monitor payment pattern');
        } else {
            suggestedActions.push('Continue regular follow-up');
        }

        forecasts.push({
            memberId: member.id,
            memberName: member.name,
            currentOutstanding,
            predictedRecoveryDate,
            recoveryProbability,
            riskLevel,
            suggestedActions,
            monthlyPredictions
        });
    });

    // Sort by risk level (high risk first)
    return forecasts.sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
};

// --- 3. Member Growth Prediction ---
export const predictMemberGrowth = (
    members: Member[],
    monthsAhead: number = 6
): MemberGrowthPrediction[] => {
    const predictions: MemberGrowthPrediction[] = [];
    const today = new Date();

    // Calculate historical growth rate
    const membersByMonth: { [key: string]: number } = {};

    members.forEach(m => {
        // Use current date as fallback if joiningDate doesn't exist
        const joinDate = (m as any).joiningDate || format(new Date(), 'yyyy-MM-dd');
        const month = format(parseISO(joinDate), 'yyyy-MM');
        membersByMonth[month] = (membersByMonth[month] || 0) + 1;
    });

    const monthlyGrowthRates = Object.values(membersByMonth);
    const avgMonthlyGrowth = monthlyGrowthRates.length > 0
        ? monthlyGrowthRates.reduce((a, b) => a + b, 0) / monthlyGrowthRates.length
        : 2; // Default 2 members per month

    // Predict for next N months
    let currentTotal = members.length;

    for (let i = 1; i <= monthsAhead; i++) {
        const futureDate = addMonths(today, i);
        const period = format(futureDate, 'yyyy-MM');
        const month = futureDate.getMonth();

        // Apply seasonal factor
        const seasonalFactor = getSeasonalFactor(month);
        const predictedNewMembers = Math.round(avgMonthlyGrowth * seasonalFactor);

        // Predict churn (typically 1-2% monthly)
        const churnRate = 0.01;
        const predictedChurnMembers = Math.round(currentTotal * churnRate);

        const netGrowth = predictedNewMembers - predictedChurnMembers;
        currentTotal += netGrowth;

        const growthRate = (netGrowth / currentTotal) * 100;

        // Determine factors
        const seasonalTrend = getSeasonalTrendDescription(month);
        const economicIndicators = 'Stable agricultural season';
        const historicalPattern = avgMonthlyGrowth > 3 ? 'Strong growth' : 'Moderate growth';

        predictions.push({
            period,
            predictedNewMembers,
            predictedChurnMembers,
            netGrowth,
            totalMembersProjected: currentTotal,
            confidence: 70 - (i * 3),
            growthRate,
            factors: {
                seasonalTrend,
                economicIndicators,
                historicalPattern
            }
        });
    }

    return predictions;
};

// --- 4. Helper: Calculate Average ---
function calculateAverage(transactions: Transaction[], field: 'amount'): number {
    if (transactions.length === 0) return 0;
    const sum = transactions.reduce((acc, t) => acc + t[field], 0);
    return sum / transactions.length;
}

// --- 5. Helper: Calculate Payment Consistency ---
function calculatePaymentConsistency(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0;

    // Calculate how regularly payments are made
    const monthsWithPayments = new Set(
        transactions.map(t => format(new Date(t.date), 'yyyy-MM'))
    ).size;

    const totalMonths = transactions.length > 0
        ? differenceInMonths(new Date(), new Date(transactions[0].date)) + 1
        : 1;

    return monthsWithPayments / totalMonths;
}

// --- 6. Helper: Get Seasonal Factor ---
function getSeasonalFactor(month: number): number {
    // Agricultural society - higher activity during harvest seasons
    // Month: 0=Jan, 1=Feb, ..., 11=Dec

    // Harvest seasons (Oct-Dec, Mar-Apr): Higher activity
    if (month >= 9 || month <= 1 || (month >= 2 && month <= 3)) {
        return 1.2; // 20% increase
    }

    // Planting season (Jun-Aug): Moderate activity
    if (month >= 5 && month <= 7) {
        return 0.9; // 10% decrease
    }

    // Other months: Normal activity
    return 1.0;
}

// --- 7. Helper: Get Seasonal Trend Description ---
function getSeasonalTrendDescription(month: number): string {
    if (month >= 9 || month <= 1) {
        return 'Harvest season - High activity expected';
    } else if (month >= 2 && month <= 3) {
        return 'Post-harvest - Moderate activity';
    } else if (month >= 5 && month <= 7) {
        return 'Planting season - Lower activity';
    } else {
        return 'Normal season - Stable activity';
    }
}

// --- 8. Get Prediction Summary ---
export const getPredictionSummary = (
    cashFlowPredictions: CashFlowPrediction[],
    loanRecoveryForecasts: LoanRecoveryForecast[],
    memberGrowthPredictions: MemberGrowthPrediction[]
): string => {
    const nextMonthCashFlow = cashFlowPredictions[0];
    const highRiskLoans = loanRecoveryForecasts.filter(f => f.riskLevel === 'high').length;
    const nextMonthGrowth = memberGrowthPredictions[0];

    return `
📊 **Prediction Summary**

**Cash Flow (Next Month):**
- Inflow: ₹${Math.round(nextMonthCashFlow.predictedInflow).toLocaleString('en-IN')}
- Outflow: ₹${Math.round(nextMonthCashFlow.predictedOutflow).toLocaleString('en-IN')}
- Net: ₹${Math.round(nextMonthCashFlow.netCashFlow).toLocaleString('en-IN')}
- Trend: ${nextMonthCashFlow.trend}

**Loan Recovery:**
- High Risk Loans: ${highRiskLoans}
- Total Forecasts: ${loanRecoveryForecasts.length}

**Member Growth:**
- New Members: ${nextMonthGrowth.predictedNewMembers}
- Net Growth: ${nextMonthGrowth.netGrowth}
- Projected Total: ${nextMonthGrowth.totalMembersProjected}
  `.trim();
};
