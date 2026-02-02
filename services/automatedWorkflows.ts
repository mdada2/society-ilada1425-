import { Member, Transaction, AutoCategorizationRule, ReconciliationResult, WorkflowRule } from '../types';
import { format } from 'date-fns';

// ============================================================================
// PHASE 8: AUTOMATED WORKFLOWS
// ============================================================================

// --- 1. Auto-Categorization Engine ---
export const autoCategorizationRules: AutoCategorizationRule[] = [
    // Loan-related patterns
    { id: '1', pattern: 'कर्ज|loan|कर्जा', category: 'Loan Payment', accountType: 'Loan' as any, confidence: 90, priority: 10 },
    { id: '2', pattern: 'व्याज|interest', category: 'Interest Payment', accountType: 'Loan' as any, confidence: 85, priority: 9 },

    // Savings-related patterns
    { id: '3', pattern: 'बचत|savings|जमा', category: 'Savings Deposit', accountType: 'Savings' as any, confidence: 90, priority: 10 },
    { id: '4', pattern: 'काढणे|withdrawal|निकासी', category: 'Savings Withdrawal', accountType: 'Savings' as any, confidence: 85, priority: 9 },

    // Share-related patterns
    { id: '5', pattern: 'शेअर|share|भाग', category: 'Share Purchase', accountType: 'Share' as any, confidence: 90, priority: 10 },

    // Fee-related patterns
    { id: '6', pattern: 'फी|fee|शुल्क', category: 'Membership Fee', accountType: 'Savings' as any, confidence: 80, priority: 8 },
    { id: '7', pattern: 'दंड|penalty|जुर्माना', category: 'Penalty', accountType: 'Loan' as any, confidence: 85, priority: 9 },

    // General patterns
    { id: '8', pattern: 'देणे|payment|भरणा', category: 'General Payment', accountType: 'Savings' as any, confidence: 70, priority: 5 },
    { id: '9', pattern: 'परतावा|refund|return', category: 'Refund', accountType: 'Savings' as any, confidence: 75, priority: 7 },
];

export const categorizeTransaction = (
    transaction: Transaction,
    customRules: AutoCategorizationRule[] = []
): { category: string; confidence: number; rule?: AutoCategorizationRule } => {
    const allRules = [...customRules, ...autoCategorizationRules]
        .sort((a, b) => b.priority - a.priority);

    const details = transaction.details.toLowerCase();

    for (const rule of allRules) {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(details) && transaction.accountType === rule.accountType) {
            return {
                category: rule.category,
                confidence: rule.confidence,
                rule
            };
        }
    }

    // Default categorization
    return {
        category: 'Uncategorized',
        confidence: 50
    };
};

export const batchCategorizeTransactions = (
    transactions: Transaction[],
    customRules: AutoCategorizationRule[] = []
): Array<Transaction & { suggestedCategory: string; confidence: number }> => {
    return transactions.map(txn => {
        const result = categorizeTransaction(txn, customRules);
        return {
            ...txn,
            suggestedCategory: result.category,
            confidence: result.confidence
        };
    });
};

// --- 2. Auto-Reconciliation ---
export const reconcileTransactions = (
    members: Member[],
    transactions: Transaction[]
): ReconciliationResult => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const discrepancies: ReconciliationResult['discrepancies'] = [];

    let matchedCount = 0;
    let unmatchedCount = 0;

    // Check each member's balance
    members.forEach(member => {
        // Calculate expected balance from transactions
        const memberTransactions = transactions.filter(t => t.memberId === member.id);

        const savingsTransactions = memberTransactions.filter(t => t.accountType === 'Savings');
        const expectedSavings = savingsTransactions.reduce((sum, t) => {
            return sum + (t.type === 'Credit' ? t.amount : -t.amount);
        }, 0);

        const loanTransactions = memberTransactions.filter(t => t.accountType === 'Loan');
        const expectedLoan = loanTransactions.reduce((sum, t) => {
            return sum + (t.type === 'Debit' ? t.amount : -t.amount);
        }, 0);

        // Compare with member's current balance
        const savingsDiff = Math.abs((member.savingsBalance || 0) - expectedSavings);
        const loanDiff = Math.abs((member.loanPrincipal || 0) - expectedLoan);

        if (savingsDiff > 1) { // Allow ₹1 tolerance
            discrepancies.push({
                transactionId: member.id,
                issue: `Savings balance mismatch for ${member.name}`,
                expectedAmount: expectedSavings,
                actualAmount: member.savingsBalance || 0
            });
            unmatchedCount++;
        } else {
            matchedCount++;
        }

        if (loanDiff > 1) {
            discrepancies.push({
                transactionId: member.id,
                issue: `Loan balance mismatch for ${member.name}`,
                expectedAmount: expectedLoan,
                actualAmount: member.loanPrincipal || 0
            });
            unmatchedCount++;
        } else {
            matchedCount++;
        }
    });

    const suggestions = [];
    if (discrepancies.length > 0) {
        suggestions.push('Review transaction history for discrepancies');
        suggestions.push('Check for missing or duplicate transactions');
        suggestions.push('Verify manual balance adjustments');
    } else {
        suggestions.push('All balances are reconciled correctly');
    }

    return {
        date: today,
        totalTransactions: transactions.length,
        matchedTransactions: matchedCount,
        unmatchedTransactions: unmatchedCount,
        discrepancies,
        balanceMatches: discrepancies.length === 0,
        suggestions
    };
};

// --- 3. Auto-Backup System ---
export const generateBackupData = (
    members: Member[],
    transactions: Transaction[]
): string => {
    const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
            members,
            transactions,
            summary: {
                totalMembers: members.length,
                totalTransactions: transactions.length,
                totalSavings: members.reduce((sum, m) => sum + (m.savingsBalance || 0), 0),
                totalLoans: members.reduce((sum, m) => sum + (m.loanPrincipal || 0), 0)
            }
        }
    };

    return JSON.stringify(backup, null, 2);
};

export const validateBackupData = (backupJson: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    try {
        const backup = JSON.parse(backupJson);

        if (!backup.timestamp) {
            errors.push('Missing timestamp');
        }

        if (!backup.data) {
            errors.push('Missing data object');
        }

        if (!backup.data.members || !Array.isArray(backup.data.members)) {
            errors.push('Invalid or missing members array');
        }

        if (!backup.data.transactions || !Array.isArray(backup.data.transactions)) {
            errors.push('Invalid or missing transactions array');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    } catch (error) {
        return {
            valid: false,
            errors: ['Invalid JSON format']
        };
    }
};

// --- 4. Auto-Report Generation ---
export const generateFinancialReport = (
    members: Member[],
    transactions: Transaction[],
    period: 'daily' | 'weekly' | 'monthly'
): string => {
    const today = new Date();
    const periodLabel = period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly';

    const totalSavings = members.reduce((sum, m) => sum + (m.savingsBalance || 0), 0);
    const totalLoans = members.reduce((sum, m) => sum + (m.loanPrincipal || 0), 0);
    const totalInterest = members.reduce((sum, m) => sum + (m.loanInterestDue || 0), 0);

    const recentTransactions = transactions.filter(t => {
        const txnDate = new Date(t.date);
        const daysDiff = Math.floor((today.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24));

        if (period === 'daily') return daysDiff === 0;
        if (period === 'weekly') return daysDiff <= 7;
        if (period === 'monthly') return daysDiff <= 30;
        return false;
    });

    const totalCredits = recentTransactions
        .filter(t => t.type === 'Credit')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = recentTransactions
        .filter(t => t.type === 'Debit')
        .reduce((sum, t) => sum + t.amount, 0);

    return `
📊 **${periodLabel} Financial Report**
Date: ${format(today, 'dd-MM-yyyy')}

**Overall Summary:**
• Total Members: ${members.length}
• Total Savings: ₹${totalSavings.toLocaleString('en-IN')}
• Total Loans Outstanding: ₹${totalLoans.toLocaleString('en-IN')}
• Total Interest Due: ₹${totalInterest.toLocaleString('en-IN')}

**${periodLabel} Activity:**
• Total Transactions: ${recentTransactions.length}
• Total Credits: ₹${totalCredits.toLocaleString('en-IN')}
• Total Debits: ₹${totalDebits.toLocaleString('en-IN')}
• Net Cash Flow: ₹${(totalCredits - totalDebits).toLocaleString('en-IN')}

**Account Breakdown:**
• Loan Transactions: ${recentTransactions.filter(t => t.accountType === 'Loan').length}
• Savings Transactions: ${recentTransactions.filter(t => t.accountType === 'Savings').length}
• Share Transactions: ${recentTransactions.filter(t => (t.accountType as string) === 'Share').length}

Generated automatically by Society Mitra AI
  `.trim();
};

// --- 5. Workflow Execution Engine ---
export const executeWorkflow = (
    rule: WorkflowRule,
    members: Member[],
    transactions: Transaction[]
): { success: boolean; message: string; results?: any } => {
    if (!rule.enabled) {
        return { success: false, message: 'Workflow is disabled' };
    }

    try {
        switch (rule.type) {
            case 'categorization':
                const categorized = batchCategorizeTransactions(transactions);
                return {
                    success: true,
                    message: `Categorized ${categorized.length} transactions`,
                    results: categorized
                };

            case 'reconciliation':
                const reconciliation = reconcileTransactions(members, transactions);
                return {
                    success: true,
                    message: `Reconciliation complete: ${reconciliation.matchedTransactions} matched, ${reconciliation.unmatchedTransactions} unmatched`,
                    results: reconciliation
                };

            case 'backup':
                const backup = generateBackupData(members, transactions);
                return {
                    success: true,
                    message: `Backup generated: ${(backup.length / 1024).toFixed(2)} KB`,
                    results: backup
                };

            case 'report':
                const report = generateFinancialReport(members, transactions, 'daily');
                return {
                    success: true,
                    message: 'Report generated successfully',
                    results: report
                };

            default:
                return { success: false, message: 'Unknown workflow type' };
        }
    } catch (error: any) {
        return { success: false, message: `Workflow execution failed: ${error.message}` };
    }
};

// --- 6. Schedule Checker ---
export const shouldRunWorkflow = (rule: WorkflowRule): boolean => {
    if (!rule.enabled || !rule.schedule) return false;

    const now = new Date();
    const lastRun = rule.lastRun ? new Date(rule.lastRun) : null;

    // Check if enough time has passed based on frequency
    if (lastRun) {
        const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

        if (rule.schedule.frequency === 'daily' && hoursSinceLastRun < 24) return false;
        if (rule.schedule.frequency === 'weekly' && hoursSinceLastRun < 168) return false;
        if (rule.schedule.frequency === 'monthly' && hoursSinceLastRun < 720) return false;
    }

    // Check time of day
    if (rule.schedule.time) {
        const [hours, minutes] = rule.schedule.time.split(':').map(Number);
        if (now.getHours() !== hours || now.getMinutes() !== minutes) return false;
    }

    // Check day of week for weekly schedules
    if (rule.schedule.frequency === 'weekly' && rule.schedule.dayOfWeek !== undefined) {
        if (now.getDay() !== rule.schedule.dayOfWeek) return false;
    }

    // Check day of month for monthly schedules
    if (rule.schedule.frequency === 'monthly' && rule.schedule.dayOfMonth !== undefined) {
        if (now.getDate() !== rule.schedule.dayOfMonth) return false;
    }

    return true;
};

// --- 7. Get Workflow Summary ---
export const getWorkflowSummary = (rules: WorkflowRule[]): string => {
    const enabled = rules.filter(r => r.enabled).length;
    const disabled = rules.filter(r => !r.enabled).length;

    const byType = {
        categorization: rules.filter(r => r.type === 'categorization').length,
        reconciliation: rules.filter(r => r.type === 'reconciliation').length,
        backup: rules.filter(r => r.type === 'backup').length,
        report: rules.filter(r => r.type === 'report').length
    };

    return `
🤖 **Automated Workflows Summary**

Total Rules: ${rules.length}
Enabled: ${enabled}
Disabled: ${disabled}

**By Type:**
• Categorization: ${byType.categorization}
• Reconciliation: ${byType.reconciliation}
• Backup: ${byType.backup}
• Report: ${byType.report}
  `.trim();
};
