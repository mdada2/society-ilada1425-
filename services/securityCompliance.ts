import { Member, Transaction, AuditLog, SuspiciousActivity, ComplianceRule, SecurityAlert, DataValidationResult } from '../types';
import { format } from 'date-fns';

// ============================================================================
// PHASE 10: SECURITY & COMPLIANCE
// ============================================================================

// --- 1. Audit Trail System ---
const auditLogs: AuditLog[] = [];

export const logAudit = (
    userId: string,
    userName: string,
    action: AuditLog['action'],
    entityType: AuditLog['entityType'],
    entityId: string,
    details: string,
    changes?: AuditLog['changes']
): AuditLog => {
    const log: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        userId,
        userName,
        action,
        entityType,
        entityId,
        details,
        changes
    };

    auditLogs.push(log);
    return log;
};

export const getAuditLogs = (
    filters?: {
        userId?: string;
        action?: AuditLog['action'];
        entityType?: AuditLog['entityType'];
        startDate?: number;
        endDate?: number;
    }
): AuditLog[] => {
    let filtered = [...auditLogs];

    if (filters) {
        if (filters.userId) {
            filtered = filtered.filter(log => log.userId === filters.userId);
        }
        if (filters.action) {
            filtered = filtered.filter(log => log.action === filters.action);
        }
        if (filters.entityType) {
            filtered = filtered.filter(log => log.entityType === filters.entityType);
        }
        if (filters.startDate) {
            filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
            filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
        }
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
};

// --- 2. Suspicious Activity Detection ---
export const detectSuspiciousActivity = (
    members: Member[],
    transactions: Transaction[]
): SuspiciousActivity[] => {
    const suspicious: SuspiciousActivity[] = [];

    // Check for large transactions (> ₹100,000)
    transactions.forEach(txn => {
        if (txn.amount > 100000) {
            suspicious.push({
                id: `sus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                activityType: 'large_transaction',
                severity: txn.amount > 500000 ? 'high' : 'medium',
                description: `Large transaction of ₹${txn.amount.toLocaleString('en-IN')} detected`,
                entityType: 'transaction',
                entityId: txn.id,
                riskScore: Math.min((txn.amount / 10000), 100),
                autoBlocked: false,
                resolved: false
            });
        }
    });

    // Check for unusual patterns (multiple transactions in short time)
    const recentTransactions = transactions.filter(t => {
        const hoursSince = (Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60);
        return hoursSince <= 24;
    });

    const txnsByMember: { [key: string]: Transaction[] } = {};
    recentTransactions.forEach(txn => {
        if (!txnsByMember[txn.memberId]) {
            txnsByMember[txn.memberId] = [];
        }
        txnsByMember[txn.memberId].push(txn);
    });

    Object.entries(txnsByMember).forEach(([memberId, txns]) => {
        if (txns.length > 5) {
            const member = members.find(m => m.id === memberId);
            suspicious.push({
                id: `sus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                activityType: 'unusual_pattern',
                severity: 'medium',
                description: `${txns.length} transactions in 24 hours for ${member?.name || 'Unknown'}`,
                entityType: 'member',
                entityId: memberId,
                riskScore: Math.min(txns.length * 10, 100),
                autoBlocked: false,
                resolved: false
            });
        }
    });

    // Check for data anomalies (negative balances, etc.)
    members.forEach(member => {
        if ((member.savingsBalance || 0) < 0) {
            suspicious.push({
                id: `sus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                activityType: 'data_anomaly',
                severity: 'high',
                description: `Negative savings balance detected for ${member.name}`,
                entityType: 'member',
                entityId: member.id,
                riskScore: 80,
                autoBlocked: false,
                resolved: false
            });
        }
    });

    return suspicious.sort((a, b) => b.riskScore - a.riskScore);
};

// --- 3. Compliance Rules ---
export const complianceRules: ComplianceRule[] = [
    {
        id: 'comp_1',
        name: 'Maximum Loan Limit',
        category: 'financial',
        description: 'Ensure no loan exceeds ₹500,000',
        enabled: true,
        severity: 'error',
        checkFunction: 'checkMaxLoanLimit',
        schedule: 'realtime'
    },
    {
        id: 'comp_2',
        name: 'Interest Rate Compliance',
        category: 'financial',
        description: 'Verify interest rates are within legal limits (6-12%)',
        enabled: true,
        severity: 'error',
        checkFunction: 'checkInterestRates',
        schedule: 'daily'
    },
    {
        id: 'comp_3',
        name: 'Member Data Completeness',
        category: 'data_privacy',
        description: 'Ensure all members have required information',
        enabled: true,
        severity: 'warning',
        checkFunction: 'checkMemberDataCompleteness',
        schedule: 'weekly'
    },
    {
        id: 'comp_4',
        name: 'Transaction Documentation',
        category: 'operational',
        description: 'All transactions must have proper documentation',
        enabled: true,
        severity: 'warning',
        checkFunction: 'checkTransactionDocs',
        schedule: 'daily'
    },
    {
        id: 'comp_5',
        name: 'Audit Trail Retention',
        category: 'regulatory',
        description: 'Maintain audit logs for minimum 7 years',
        enabled: true,
        severity: 'error',
        checkFunction: 'checkAuditRetention',
        schedule: 'monthly'
    }
];

// --- 4. Compliance Checker ---
export const checkCompliance = (
    members: Member[],
    transactions: Transaction[]
): Array<{ rule: ComplianceRule; passed: boolean; violations: string[] }> => {
    const results: Array<{ rule: ComplianceRule; passed: boolean; violations: string[] }> = [];

    complianceRules.forEach(rule => {
        if (!rule.enabled) return;

        const violations: string[] = [];

        switch (rule.checkFunction) {
            case 'checkMaxLoanLimit':
                members.forEach(m => {
                    if ((m.loanPrincipal || 0) > 500000) {
                        violations.push(`${m.name} has loan of ₹${m.loanPrincipal?.toLocaleString('en-IN')}`);
                    }
                });
                break;

            case 'checkInterestRates':
                // Assuming 6-12% is valid range
                members.forEach(m => {
                    if (m.loanPrincipal && m.loanPrincipal > 0) {
                        // This is a simplified check
                        const estimatedRate = ((m.loanInterestDue || 0) / m.loanPrincipal) * 100;
                        if (estimatedRate < 6 || estimatedRate > 12) {
                            violations.push(`${m.name} may have interest rate outside 6-12% range`);
                        }
                    }
                });
                break;

            case 'checkMemberDataCompleteness':
                members.forEach(m => {
                    if (!m.mobile || !(m as any).address || !m.village) {
                        violations.push(`${m.name} has incomplete data`);
                    }
                });
                break;

            case 'checkTransactionDocs':
                const undocumented = transactions.filter(t => !t.details || t.details.trim() === '');
                if (undocumented.length > 0) {
                    violations.push(`${undocumented.length} transactions lack proper documentation`);
                }
                break;

            case 'checkAuditRetention':
                const sevenYearsAgo = Date.now() - (7 * 365 * 24 * 60 * 60 * 1000);
                const oldLogs = auditLogs.filter(log => log.timestamp < sevenYearsAgo);
                if (oldLogs.length === 0 && auditLogs.length > 0) {
                    violations.push('Audit logs may not cover full 7-year retention period');
                }
                break;
        }

        results.push({
            rule,
            passed: violations.length === 0,
            violations
        });
    });

    return results;
};

// --- 5. Data Validation Engine ---
export const validateData = (
    members: Member[],
    transactions: Transaction[]
): DataValidationResult => {
    const errors: DataValidationResult['errors'] = [];
    const warnings: DataValidationResult['warnings'] = [];

    // Validate members
    members.forEach(member => {
        // Required fields
        if (!member.name || member.name.trim() === '') {
            errors.push({ field: `Member ${member.id}`, message: 'Name is required', severity: 'error' });
        }

        if (!member.mobile || !/^[6-9]\d{9}$/.test(member.mobile)) {
            errors.push({ field: `Member ${member.name}`, message: 'Invalid mobile number', severity: 'error' });
        }

        // Logical validations
        if ((member.savingsBalance || 0) < 0) {
            errors.push({ field: `Member ${member.name}`, message: 'Negative savings balance', severity: 'error' });
        }

        if ((member.loanPrincipal || 0) < 0) {
            errors.push({ field: `Member ${member.name}`, message: 'Negative loan principal', severity: 'error' });
        }

        // Warnings
        if (!(member as any).address) {
            warnings.push({ field: `Member ${member.name}`, message: 'Address is missing' });
        }

        if ((member.loanPrincipal || 0) > 300000) {
            warnings.push({ field: `Member ${member.name}`, message: 'High loan amount (>₹3L)' });
        }
    });

    // Validate transactions
    transactions.forEach(txn => {
        if (txn.amount <= 0) {
            errors.push({ field: `Transaction ${txn.id}`, message: 'Amount must be positive', severity: 'error' });
        }

        if (!txn.details || txn.details.trim() === '') {
            warnings.push({ field: `Transaction ${txn.id}`, message: 'Missing transaction details' });
        }

        if (!members.find(m => m.id === txn.memberId)) {
            errors.push({ field: `Transaction ${txn.id}`, message: 'Member not found', severity: 'error' });
        }
    });

    // Calculate quality score
    const totalChecks = members.length * 5 + transactions.length * 3;
    const issuesCount = errors.length + warnings.length;
    const score = Math.max(0, Math.round(((totalChecks - issuesCount) / totalChecks) * 100));

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        score
    };
};

// --- 6. Generate Security Alert ---
export const generateSecurityAlert = (
    type: SecurityAlert['type'],
    severity: SecurityAlert['severity'],
    message: string,
    details: any
): SecurityAlert => {
    return {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type,
        severity,
        message,
        details,
        acknowledged: false
    };
};

// --- 7. Get Security Summary ---
export const getSecuritySummary = (
    members: Member[],
    transactions: Transaction[]
): string => {
    const suspicious = detectSuspiciousActivity(members, transactions);
    const compliance = checkCompliance(members, transactions);
    const validation = validateData(members, transactions);

    const criticalSuspicious = suspicious.filter(s => s.severity === 'critical').length;
    const highSuspicious = suspicious.filter(s => s.severity === 'high').length;

    const failedCompliance = compliance.filter(c => !c.passed && c.rule.severity === 'error').length;
    const warningCompliance = compliance.filter(c => !c.passed && c.rule.severity === 'warning').length;

    return `
🔒 **Security & Compliance Summary**
सुरक्षा आणि अनुपालन सारांश

**Audit Logs:**
Total Logs: ${auditLogs.length}
Recent (24h): ${auditLogs.filter(l => Date.now() - l.timestamp < 86400000).length}

**Suspicious Activities:**
Total Detected: ${suspicious.length}
Critical: ${criticalSuspicious}
High Risk: ${highSuspicious}

**Compliance Status:**
Total Rules: ${complianceRules.filter(r => r.enabled).length}
Failed (Errors): ${failedCompliance}
Warnings: ${warningCompliance}

**Data Validation:**
Quality Score: ${validation.score}%
Errors: ${validation.errors.length}
Warnings: ${validation.warnings.length}

${validation.score >= 90 ? '✅ Excellent data quality' : validation.score >= 70 ? '⚠️ Good, needs improvement' : '❌ Poor data quality, action required'}
  `.trim();
};

// --- 8. Export Audit Report ---
export const exportAuditReport = (
    startDate: number,
    endDate: number
): string => {
    const logs = getAuditLogs({ startDate, endDate });

    const report = `
AUDIT TRAIL REPORT
Period: ${format(new Date(startDate), 'dd-MM-yyyy')} to ${format(new Date(endDate), 'dd-MM-yyyy')}

Total Activities: ${logs.length}

BREAKDOWN BY ACTION:
- Create: ${logs.filter(l => l.action === 'create').length}
- Update: ${logs.filter(l => l.action === 'update').length}
- Delete: ${logs.filter(l => l.action === 'delete').length}
- View: ${logs.filter(l => l.action === 'view').length}
- Export: ${logs.filter(l => l.action === 'export').length}

BREAKDOWN BY ENTITY:
- Members: ${logs.filter(l => l.entityType === 'member').length}
- Transactions: ${logs.filter(l => l.entityType === 'transaction').length}
- Loans: ${logs.filter(l => l.entityType === 'loan').length}
- Reports: ${logs.filter(l => l.entityType === 'report').length}
- Settings: ${logs.filter(l => l.entityType === 'settings').length}

DETAILED LOGS:
${logs.slice(0, 50).map(log => `
[${format(new Date(log.timestamp), 'dd-MM-yyyy HH:mm:ss')}]
User: ${log.userName} (${log.userId})
Action: ${log.action.toUpperCase()}
Entity: ${log.entityType} (${log.entityId})
Details: ${log.details}
${log.changes ? `Changes: ${log.changes.length} field(s) modified` : ''}
`).join('\n---\n')}

${logs.length > 50 ? `\n... and ${logs.length - 50} more entries` : ''}

Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm:ss')}
  `.trim();

    return report;
};
