import * as XLSX from 'xlsx';
import { Member, Transaction, PaddyDO, DispatchRecord } from '../types';
import { format } from 'date-fns';

// ============================================================================
// EXCEL EXPORT SERVICE
// ============================================================================

// --- 1. Export Members to Excel ---
export const exportMembersToExcel = (members: Member[], returnBlob: boolean = false): void | { blob: Blob, fileName: string } => {
    // Prepare data for Excel using exact same headers as the Import Template
    const data = members.map(m => ({
        'MemberNo': m.memberNo,
        'Name': m.name,
        'Designation': m.designation || 'शेतकरी',
        'Gender': m.gender,
        'Village': m.village,
        'MembershipDate': m.membershipDate || '',
        'Mobile': m.mobile || '',
        'Category': m.category,
        'DOB': m.dob || '',
        'Aadhar': m.aadhar || '',
        'FarmerId': m.farmerId || '',
        'OriginalLoanPrincipal': m.loanPrincipal || 0,
        'OriginalLoanDate': m.originalLoanDate || '',
        'LastLoanPrincipal': m.loanPrincipal || 0,
        'LastPaymentDate': m.lastLoanCalculationDate || '',
        'LoanInterestDue': m.loanInterestDue || 0,
        'LoanAccountNo': m.loanAccountNo || '',
        'LoanType': m.loanType || '',
        'BankAccountNo': m.bankAccountNo || '',
        'LandArea': m.landArea || '',
        'SavingsBalance': m.savingsBalance || 0,
        'ShareBalance': m.shareBalance || 0,
        'FDBalance': m.fdBalance || 0,
        'खाते पान क्र.': m.ledgerPageNo || ''
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths for all 24 columns
    ws['!cols'] = [
        { wch: 12 }, // MemberNo
        { wch: 25 }, // Name
        { wch: 15 }, // Designation
        { wch: 10 }, // Gender
        { wch: 20 }, // Village
        { wch: 15 }, // MembershipDate
        { wch: 12 }, // Mobile
        { wch: 12 }, // Category
        { wch: 15 }, // DOB
        { wch: 15 }, // Aadhar
        { wch: 16 }, // FarmerId
        { wch: 20 }, // OriginalLoanPrincipal
        { wch: 15 }, // OriginalLoanDate
        { wch: 20 }, // LastLoanPrincipal
        { wch: 15 }, // LastPaymentDate
        { wch: 15 }, // LoanInterestDue
        { wch: 15 }, // LoanAccountNo
        { wch: 15 }, // LoanType
        { wch: 15 }, // BankAccountNo
        { wch: 12 }, // LandArea
        { wch: 15 }, // SavingsBalance
        { wch: 15 }, // ShareBalance
        { wch: 15 }, // FDBalance
        { wch: 15 }  // खाते पान क्र.
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Members');

    // Generate filename with timestamp
    const fileName = `Members_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;

    if (returnBlob) {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        return { blob, fileName };
    }

    // Write file
    XLSX.writeFile(wb, fileName);
};

// --- 2. Export Transactions to Excel ---
export const exportTransactionsToExcel = (
    transactions: Transaction[],
    members: Member[]
): void => {
    // Prepare data for Excel
    const data = transactions.map(t => {
        const member = members.find(m => m.id === t.memberId);
        return {
            'Date': format(new Date(t.date), 'dd-MM-yyyy'),
            'Transaction ID': t.id,
            'Member ID': t.memberId,
            'Member Name': member?.name || 'Unknown',
            'Type': t.type,
            'Account Type': t.accountType,
            'Amount': t.amount,
            'Details': t.details,
            'Payment Method': (t as any).paymentMethod || 'Cash'
        };
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 15 }, // Transaction ID
        { wch: 12 }, // Member ID
        { wch: 25 }, // Member Name
        { wch: 10 }, // Type
        { wch: 15 }, // Account Type
        { wch: 12 }, // Amount
        { wch: 40 }, // Details
        { wch: 15 }  // Payment Method
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // Generate filename with timestamp
    const filename = `Transactions_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);
};

// --- 3. Export Loans to Excel ---
export const exportLoansToExcel = (members: Member[]): void => {
    // Filter members with loans
    const membersWithLoans = members.filter(m => (m.loanPrincipal || 0) > 0);

    // Prepare data for Excel
    const data = membersWithLoans.map(m => ({
        'Member ID': m.id,
        'Name': m.name,
        'Mobile': m.mobile,
        'Village': m.village,
        'Loan Principal': m.loanPrincipal || 0,
        'Interest Due': m.loanInterestDue || 0,
        'Total Outstanding': (m.loanPrincipal || 0) + (m.loanInterestDue || 0),
        'Loan Date': (m as any).loanDate ? format(new Date((m as any).loanDate), 'dd-MM-yyyy') : '',
        'Interest Rate': (m as any).loanInterestRate ? `${(m as any).loanInterestRate}%` : '12%',
        'Status': (m as any).status || 'Active'
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
        { wch: 12 }, // Member ID
        { wch: 25 }, // Name
        { wch: 12 }, // Mobile
        { wch: 20 }, // Village
        { wch: 15 }, // Loan Principal
        { wch: 15 }, // Interest Due
        { wch: 18 }, // Total Outstanding
        { wch: 12 }, // Loan Date
        { wch: 15 }, // Interest Rate
        { wch: 10 }  // Status
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Loans');

    // Generate filename with timestamp
    const filename = `Loans_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);
};

// --- 4. Export Financial Report to Excel ---
export const exportFinancialReportToExcel = (
    members: Member[],
    transactions: Transaction[]
): void => {
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
        { 'Metric': 'Total Members', 'Value': members.length },
        { 'Metric': 'Active Members', 'Value': members.filter(m => (m as any).status === 'Active').length },
        { 'Metric': 'Total Savings', 'Value': members.reduce((sum, m) => sum + (m.savingsBalance || 0), 0) },
        { 'Metric': 'Total Shares', 'Value': members.reduce((sum, m) => sum + (m.shareBalance || 0), 0) },
        { 'Metric': 'Total Loan Principal', 'Value': members.reduce((sum, m) => sum + (m.loanPrincipal || 0), 0) },
        { 'Metric': 'Total Interest Due', 'Value': members.reduce((sum, m) => sum + (m.loanInterestDue || 0), 0) },
        { 'Metric': 'Total Transactions', 'Value': transactions.length },
        { 'Metric': 'Total Credits', 'Value': transactions.filter(t => t.type === 'Credit').reduce((sum, t) => sum + t.amount, 0) },
        { 'Metric': 'Total Debits', 'Value': transactions.filter(t => t.type === 'Debit').reduce((sum, t) => sum + t.amount, 0) }
    ];

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Members by Village Sheet
    const villageStats: { [key: string]: number } = {};
    members.forEach(m => {
        villageStats[m.village] = (villageStats[m.village] || 0) + 1;
    });

    const villageData = Object.entries(villageStats).map(([village, count]) => ({
        'Village': village,
        'Members': count,
        'Percentage': ((count / members.length) * 100).toFixed(2) + '%'
    }));

    const villageWs = XLSX.utils.json_to_sheet(villageData);
    villageWs['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, villageWs, 'By Village');

    // Account Type Breakdown Sheet
    const accountBreakdown = [
        {
            'Account Type': 'Savings',
            'Total Transactions': transactions.filter(t => t.accountType === 'Savings').length,
            'Total Amount': transactions.filter(t => t.accountType === 'Savings').reduce((sum, t) => sum + t.amount, 0)
        },
        {
            'Account Type': 'Loan',
            'Total Transactions': transactions.filter(t => t.accountType === 'Loan').length,
            'Total Amount': transactions.filter(t => t.accountType === 'Loan').reduce((sum, t) => sum + t.amount, 0)
        },
        {
            'Account Type': 'Share',
            'Total Transactions': transactions.filter(t => (t.accountType as string) === 'Share').length,
            'Total Amount': transactions.filter(t => (t.accountType as string) === 'Share').reduce((sum, t) => sum + t.amount, 0)
        }
    ];

    const accountWs = XLSX.utils.json_to_sheet(accountBreakdown);
    accountWs['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, accountWs, 'Account Breakdown');

    // Generate filename with timestamp
    const filename = `Financial_Report_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);
};

// --- 5. Export Custom Data to Excel ---
export const exportCustomDataToExcel = (
    data: any[],
    sheetName: string,
    filename?: string
): void => {
    if (data.length === 0) {
        console.warn('No data to export');
        return;
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns based on content
    const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate filename
    const finalFilename = filename || `Export_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;

    // Write file
    XLSX.writeFile(wb, finalFilename);
};

// --- 6. Export Dispatch Records to Excel ---
export const exportDispatchesToExcel = (dispatches: any[]): void => {
    if (dispatches.length === 0) return;

    const data = dispatches.map(d => ({
        'Date': d.date,
        'Season': d.season || '',
        'Mill Name': d.millName,
        'D.O. No': d.doNumber || '',
        'T.P. No': d.tpNumber || '',
        'Truck No': d.truckNumber,
        'Storage': d.storageSource,
        'Bags': d.bags,
        'Weight': d.weight,
        'New Bags': d.newBagsUsed,
        'Old Bags': d.oldBagsUsed,
        'Used Once': d.usedOnceBagsUsed
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 12 }, // Season
        { wch: 25 }, // Mill Name
        { wch: 15 }, // D.O. No
        { wch: 15 }, // T.P. No
        { wch: 15 }, // Truck No
        { wch: 15 }, // Storage
        { wch: 10 }, // Bags
        { wch: 10 }, // Weight
        { wch: 10 }, // New Bags
        { wch: 10 }, // Old Bags
        { wch: 10 }  // Used Once
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Dispatches');
    const filename = `Dispatches_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
    XLSX.writeFile(wb, filename);
};

// --- 7. Export D.O. Summary to Excel ---
export const exportPaddyDOsToExcel = (paddyDOs: PaddyDO[], dispatches: DispatchRecord[]): void => {
    if (paddyDOs.length === 0) return;

    const data = paddyDOs.map(d => {
        // Calculate dynamic stats
        const seasonDispatches = dispatches.filter(dispatch => 
            dispatch.season === d.season && 
            (dispatch.doNumber || '').toUpperCase().trim() === d.doNumber.toUpperCase().trim()
        );
        
        const dispatchedBags = seasonDispatches.reduce((sum, curr) => sum + (Number(curr.bags) || 0), 0);
        const dispatchedWeight = seasonDispatches.reduce((sum, curr) => sum + (Number(curr.weight) || 0), 0);
        
        // Sum up bag types used for this D.O.
        const newBagsUsed = seasonDispatches.reduce((sum, curr) => sum + (Number(curr.newBagsUsed) || 0), 0);
        const oldBagsUsed = seasonDispatches.reduce((sum, curr) => sum + (Number(curr.oldBagsUsed) || 0), 0);
        const usedOnceBagsUsed = seasonDispatches.reduce((sum, curr) => sum + (Number(curr.usedOnceBagsUsed) || 0), 0);

        const balanceBags = Math.max(0, d.approvedBags - dispatchedBags);
        const balanceWeight = Math.max(0, d.approvedWeight - dispatchedWeight);
        const completionPct = d.approvedBags > 0 ? `${Math.min(100, Math.round((dispatchedBags / d.approvedBags) * 100))}%` : '0%';

        return {
            'D.O. Date': d.date,
            'Season': d.season,
            'D.O. Number': d.doNumber,
            'Mill Name': d.millName,
            'Approved Bags': d.approvedBags,
            'Approved Weight (Qtl)': d.approvedWeight,
            'Dispatched Bags (Total)': dispatchedBags,
            'Dispatched Weight (Total Qtl)': dispatchedWeight,
            'New Bags (नवीन पोते)': newBagsUsed,
            'Old Bags (जुने पोते)': oldBagsUsed,
            'Used Once Bags (एकदा वापरलेले)': usedOnceBagsUsed,
            'Balance Bags': balanceBags,
            'Balance Weight (Qtl)': balanceWeight,
            'Completion Rate': completionPct
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws['!cols'] = [
        { wch: 12 }, // D.O. Date
        { wch: 12 }, // Season
        { wch: 15 }, // D.O. Number
        { wch: 25 }, // Mill Name
        { wch: 15 }, // Approved Bags
        { wch: 20 }, // Approved Weight (Qtl)
        { wch: 20 }, // Dispatched Bags (Total)
        { wch: 25 }, // Dispatched Weight (Total Qtl)
        { wch: 20 }, // New Bags (नवीन पोते)
        { wch: 20 }, // Old Bags (जुने पोते)
        { wch: 25 }, // Used Once Bags (एकदा वापरलेले)
        { wch: 15 }, // Balance Bags
        { wch: 20 }, // Balance Weight (Qtl)
        { wch: 15 }  // Completion Rate
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'DO_Summary');
    const filename = `DO_Summary_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
    XLSX.writeFile(wb, filename);
};

// --- 8. Get Export Summary ---
export const getExportSummary = (): string => {
    return `
📊 **Excel Export Available**

**Available Exports:**
• Members - Complete member list with balances
• Transactions - All transaction history
• Loans - Outstanding loan details
• Financial Report - Multi-sheet summary report

**Commands:**
• \`/export members\` - Export all members
• \`/export transactions\` - Export transactions
• \`/export loans\` - Export loan details
• \`/export report\` - Export financial report

**File Format:** .xlsx (Microsoft Excel)
**Location:** Downloads folder
**Includes:** Headers, formatting, auto-sized columns

💡 Files are timestamped for easy tracking.
  `.trim();
};
