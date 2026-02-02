import { Member, Transaction, BulkCalculationResult, BulkSMSJob, BulkOperation } from '../types';
import { calculateLoanInterest } from '../utils/loanCalculator';
import { format } from 'date-fns';

// ============================================================================
// PHASE 4: BULK OPERATIONS
// ============================================================================

// --- 1. Bulk Interest Calculation ---
export const bulkCalculateInterest = (
    members: Member[],
    calculationDate?: string
): BulkCalculationResult[] => {
    const results: BulkCalculationResult[] = [];
    const calcDate = calculationDate || format(new Date(), 'yyyy-MM-dd');

    members.forEach(member => {
        try {
            // Skip members without loans
            if ((member.loanPrincipal || 0) <= 0) {
                return;
            }

            const previousInterest = member.loanInterestDue || 0;

            // Calculate new interest
            const { interest: calculatedInterest } = calculateLoanInterest(
                member.loanPrincipal || 0,
                member.lastLoanCalculationDate || member.originalLoanDate || calcDate,
                calcDate,
                undefined,
                undefined,
                true,
                member.originalLoanDate
            );

            const newTotalInterest = previousInterest + calculatedInterest;
            const totalDue = (member.loanPrincipal || 0) + newTotalInterest;

            results.push({
                memberId: member.id,
                memberNo: member.memberNo,
                name: member.name,
                previousInterest,
                calculatedInterest,
                newTotalInterest,
                principal: member.loanPrincipal || 0,
                totalDue,
                calculationDate: calcDate,
                success: true
            });
        } catch (error: any) {
            results.push({
                memberId: member.id,
                memberNo: member.memberNo,
                name: member.name,
                previousInterest: member.loanInterestDue || 0,
                calculatedInterest: 0,
                newTotalInterest: member.loanInterestDue || 0,
                principal: member.loanPrincipal || 0,
                totalDue: (member.loanPrincipal || 0) + (member.loanInterestDue || 0),
                calculationDate: calcDate,
                success: false,
                error: error.message
            });
        }
    });

    return results;
};

// --- 2. Apply Bulk Interest Calculation ---
export const applyBulkInterestCalculation = (
    members: Member[],
    results: BulkCalculationResult[],
    updateMember: (id: string, updates: Partial<Member>) => void
): { success: number; failed: number } => {
    let success = 0;
    let failed = 0;

    results.forEach(result => {
        if (result.success) {
            try {
                const member = members.find(m => m.id === result.memberId);
                if (member) {
                    updateMember(result.memberId, {
                        loanInterestDue: result.newTotalInterest,
                        lastLoanCalculationDate: result.calculationDate
                    });
                    success++;
                } else {
                    failed++;
                }
            } catch (error) {
                failed++;
            }
        } else {
            failed++;
        }
    });

    return { success, failed };
};

// --- 3. Bulk SMS/WhatsApp Message Preparation ---
export const prepareBulkSMS = (
    members: Member[],
    messageTemplate: string,
    filterCriteria?: {
        hasLoan?: boolean;
        village?: string;
        minLoanAmount?: number;
    }
): BulkSMSJob => {
    let filteredMembers = members;

    // Apply filters
    if (filterCriteria) {
        if (filterCriteria.hasLoan) {
            filteredMembers = filteredMembers.filter(m => (m.loanPrincipal || 0) > 0);
        }
        if (filterCriteria.village) {
            filteredMembers = filteredMembers.filter(m => m.village === filterCriteria.village);
        }
        if (filterCriteria.minLoanAmount) {
            filteredMembers = filteredMembers.filter(m => (m.loanPrincipal || 0) >= filterCriteria.minLoanAmount);
        }
    }

    // Filter members with valid mobile numbers
    const recipients = filteredMembers
        .filter(m => m.mobile && m.mobile.length === 10)
        .map(m => ({
            memberId: m.id,
            memberNo: m.memberNo,
            name: m.name,
            mobile: m.mobile
        }));

    return {
        id: `sms-${Date.now()}`,
        recipients,
        message: messageTemplate,
        status: 'draft',
        sentCount: 0,
        failedCount: 0,
        createdAt: Date.now()
    };
};

// --- 4. Generate Payment Reminder SMS ---
export const generatePaymentReminderSMS = (
    member: Member,
    totalDue: number
): string => {
    return `नमस्कार ${member.name},
  
तुमचे कर्ज परतफेड:
मुद्दल: ₹${(member.loanPrincipal || 0).toLocaleString('en-IN')}
व्याज: ₹${(member.loanInterestDue || 0).toLocaleString('en-IN')}
एकूण: ₹${totalDue.toLocaleString('en-IN')}

कृपया लवकरात लवकर परतफेड करा.

- ${member.village || 'Society'} सहकारी संस्था`;
};

// --- 5. Generate Meeting Alert SMS ---
export const generateMeetingAlertSMS = (
    memberName: string,
    meetingTitle: string,
    meetingDate: string,
    venue: string
): string => {
    return `नमस्कार ${memberName},

सभा सूचना:
विषय: ${meetingTitle}
तारीख: ${meetingDate}
ठिकाण: ${venue}

कृपया उपस्थित रहा.

- सहकारी संस्था`;
};

// --- 6. Bulk Transaction Validation ---
export const validateBulkTransactions = (
    transactions: Array<{
        date: string;
        memberNo: string;
        accountType: string;
        type: string;
        amount: number;
        details: string;
    }>,
    members: Member[]
): {
    valid: Array<any>;
    invalid: Array<{ row: number; field: string; message: string }>;
} => {
    const valid: Array<any> = [];
    const invalid: Array<{ row: number; field: string; message: string }> = [];

    transactions.forEach((txn, index) => {
        const row = index + 1;
        const errors: string[] = [];

        // Validate date
        if (!txn.date || isNaN(Date.parse(txn.date))) {
            invalid.push({ row, field: 'date', message: 'Invalid date format' });
            return;
        }

        // Validate member
        const member = members.find(m => m.memberNo === txn.memberNo);
        if (!member) {
            invalid.push({ row, field: 'memberNo', message: `Member ${txn.memberNo} not found` });
            return;
        }

        // Validate account type
        const validAccountTypes = ['Savings', 'Loan', 'Shares', 'FD', 'Expense'];
        if (!validAccountTypes.includes(txn.accountType)) {
            invalid.push({ row, field: 'accountType', message: 'Invalid account type' });
            return;
        }

        // Validate transaction type
        if (!['Credit', 'Debit'].includes(txn.type)) {
            invalid.push({ row, field: 'type', message: 'Invalid transaction type' });
            return;
        }

        // Validate amount
        if (!txn.amount || txn.amount <= 0) {
            invalid.push({ row, field: 'amount', message: 'Amount must be greater than 0' });
            return;
        }

        // If all validations pass, add to valid list
        valid.push({
            ...txn,
            memberId: member.id,
            memberName: member.name,
            timestamp: Date.now()
        });
    });

    return { valid, invalid };
};

// --- 7. Bulk Member Update ---
export const bulkUpdateMembers = (
    members: Member[],
    updates: Array<{
        memberNo: string;
        field: string;
        value: any;
    }>,
    updateMember: (id: string, updates: Partial<Member>) => void
): { success: number; failed: number; errors: string[] } => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    updates.forEach(update => {
        try {
            const member = members.find(m => m.memberNo === update.memberNo);
            if (!member) {
                errors.push(`Member ${update.memberNo} not found`);
                failed++;
                return;
            }

            // Validate field
            const validFields = ['village', 'mobile', 'landArea', 'category', 'bankAccount'];
            if (!validFields.includes(update.field)) {
                errors.push(`Invalid field: ${update.field} for member ${update.memberNo}`);
                failed++;
                return;
            }

            // Apply update
            updateMember(member.id, { [update.field]: update.value });
            success++;
        } catch (error: any) {
            errors.push(`Error updating member ${update.memberNo}: ${error.message}`);
            failed++;
        }
    });

    return { success, failed, errors };
};

// --- 8. Generate Bulk Operation Summary ---
export const generateBulkOperationSummary = (
    operation: BulkOperation
): string => {
    const duration = operation.completedAt && operation.startedAt
        ? Math.round((operation.completedAt - operation.startedAt) / 1000)
        : 0;

    const successRate = operation.totalItems > 0
        ? Math.round((operation.processedItems / operation.totalItems) * 100)
        : 0;

    return `
**Bulk Operation Summary**

Type: ${operation.type}
Status: ${operation.status}

Total Items: ${operation.totalItems}
Processed: ${operation.processedItems}
Failed: ${operation.failedItems}
Success Rate: ${successRate}%

Duration: ${duration} seconds
${operation.errorLog && operation.errorLog.length > 0 ? `\nErrors:\n${operation.errorLog.slice(0, 5).join('\n')}` : ''}
  `.trim();
};

// --- 9. Export Bulk Calculation Results to CSV ---
export const exportBulkCalculationToCSV = (
    results: BulkCalculationResult[]
): string => {
    const headers = [
        'Member No',
        'Name',
        'Principal',
        'Previous Interest',
        'Calculated Interest',
        'New Total Interest',
        'Total Due',
        'Calculation Date',
        'Status'
    ];

    const rows = results.map(r => [
        r.memberNo,
        r.name,
        r.principal,
        r.previousInterest,
        r.calculatedInterest,
        r.newTotalInterest,
        r.totalDue,
        r.calculationDate,
        r.success ? 'Success' : `Failed: ${r.error}`
    ]);

    return [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
};

// --- 10. Simulate SMS Sending (for testing) ---
export const simulateSMSSending = async (
    job: BulkSMSJob,
    onProgress?: (sent: number, total: number) => void
): Promise<{ sent: number; failed: number }> => {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < job.recipients.length; i++) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Simulate 95% success rate
        if (Math.random() > 0.05) {
            sent++;
        } else {
            failed++;
        }

        if (onProgress) {
            onProgress(sent + failed, job.recipients.length);
        }
    }

    return { sent, failed };
};
