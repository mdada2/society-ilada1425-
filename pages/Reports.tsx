import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import {
  BarChart3,
  Wallet,
  Users,
  Sprout,
  Landmark,
  ChevronRight,
  ArrowLeft,
  FileText,
  BadgeIndianRupee,
  Share2,
  Download
} from 'lucide-react';
import ReportTable, { Column } from '../components/ReportTable';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { differenceInDays, parseISO, format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import SecurityPinModal from '../components/SecurityPinModal';
import { downloadBlob } from '../utils/downloadUtils';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { calculateLoanInterest } from '../utils/loanCalculator';

// --- Real Data Integration helpers ---
// Mock schemes data (as schemes are not yet in AppContext)
const mockSchemeData = Array(8).fill(0).map((_, i) => ({
  id: i + 1,
  name: `Beneficiary ${i + 1}`,
  village: 'Rampur',
  loanDate: '2023-06-15',
  repaymentDate: '2024-03-15',
  days: 270,
  principal: 80000,
  product: 'Paddy',
  interestSubsidy: 2400
}));

// --- Report Configuration ---

type CategoryId = 'financial' | 'loan' | 'membership' | 'schemes' | 'bank_incentive' | 'inventory';

interface ReportCategory {
  id: CategoryId;
  title: string;
  icon: React.ReactNode;
  color: string;
  subTabs: string[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'financial',
    title: 'Financial Management',
    icon: <BarChart3 size={24} />,
    color: 'bg-blue-500',
    subTabs: ['Daybook', 'Receipt & Payment', 'Profit & Loss', 'General Ledger', 'Balance Sheet']
  },
  {
    id: 'inventory',
    title: 'Inventory Reports',
    icon: <Sprout size={24} />,
    color: 'bg-emerald-600',
    subTabs: ['Paddy Stock', 'Gunny Bags']
  },
  {
    id: 'loan',
    title: 'Loan Reports',
    icon: <Wallet size={24} />,
    color: 'bg-amber-500',
    subTabs: ['All Outstanding', 'Regular (FY)', 'Recovery Report', 'Repaid (FY)', 'Overdue Recoveries', 'NPA List', 'Summary', 'Loan Recovery Analysis']
  },
  {
    id: 'membership',
    title: 'Membership Reports',
    icon: <Users size={24} />,
    color: 'bg-emerald-500',
    subTabs: ['Shares Capital', 'Shares Summary', 'Caste Summary', 'Gender Summary', 'Gender + Category', 'Gender + Village', 'Gender Financial', 'Land Holding']
  },
  {
    id: 'schemes',
    title: 'Govt Schemes',
    icon: <Sprout size={24} />,
    color: 'bg-green-600',
    subTabs: ['Dr. P. Deshmukh Incentive', 'Summary']
  },
  {
    id: 'bank_incentive',
    title: 'Bank Incentive',
    icon: <Landmark size={24} />,
    color: 'bg-purple-600',
    subTabs: ['Within ₹50,000', 'Above ₹50,000', 'Summary']
  }
];

const Reports = () => {
  const { members, transactions, deleteTransaction, settings } = useApp();
  const { showConfirm } = useDialog();
  const navigate = useNavigate();
  const { categoryId, subTab } = useParams<{ categoryId: CategoryId; subTab: string }>();

  const selectedCategory = categoryId || null;
  const activeSubTab = subTab || '';

  const [activeBucket, setActiveBucket] = useState<string>('1 Year');
  const [showPinModal, setShowPinModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [filterLedgerAccount, setFilterLedgerAccount] = useState<string>('All');
  const [selectedFYRange, setSelectedFYRange] = useState<{ start: string; end: string } | null>(null);

  const activeStart = selectedFYRange
    ? selectedFYRange.start
    : (categoryId === 'bank_incentive'
        ? `${new Date(settings.financialYearStart || '2026-04-01').getFullYear() - 1}-04-01`
        : (settings.financialYearStart || '2026-04-01'));

  const activeEnd = selectedFYRange
    ? selectedFYRange.end
    : (categoryId === 'bank_incentive'
        ? `${new Date(settings.financialYearStart || '2026-04-01').getFullYear()}-03-31`
        : (settings.financialYearEnd || '2027-03-31'));

  const [repaidFilter, setRepaidFilter] = useState<'repaid' | 'outstanding'>('repaid');
  const [deshmukhFY, setDeshmukhFY] = useState<string>('2025-26');
  const [deshmukhCategory, setDeshmukhCategory] = useState<string>('ALL');
  const [npaCategoryFilter, setNpaCategoryFilter] = useState<string>('ALL');
  const [summaryViewType, setSummaryViewType] = useState<'category' | 'yearwise'>('category');
  const [sharesMinAmount, setSharesMinAmount] = useState<number | ''>('');
  const [sharesMaxAmount, setSharesMaxAmount] = useState<number | ''>('');
  const [sharesQuickFilter, setSharesQuickFilter] = useState<string>('all');
  const [sharesPeriod, setSharesPeriod] = useState<'today' | 'current_fy' | 'previous_fy'>('today');

  // Reset selected financial year range when category or sub-tab changes
  useEffect(() => {
    setSelectedFYRange(null);
    setRepaidFilter('repaid');
    setDeshmukhCategory('ALL');
    setNpaCategoryFilter('ALL');
    setSummaryViewType('category');
    setSharesMinAmount('');
    setSharesMaxAmount('');
    setSharesQuickFilter('all');
    setSharesPeriod('today');
  }, [categoryId, subTab]);

  const getFYLoans = (startDateStr: string, endDateStr: string, isNPAMode = false) => {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const cutoffDate = new Date(endDateStr);
    const effectiveStartDate = isNPAMode ? new Date('1970-01-01') : startDate;

    return members
      .map(m => {
        // 1. Check if they have a Debit transaction in the FY
        const loanDebitInFY = transactions.find(t => 
          t.memberId === m.id && 
          t.type === 'Debit' && 
          t.accountType === 'Loan' && 
          new Date(t.date) >= effectiveStartDate && 
          new Date(t.date) <= endDate
        );

        // 2. Check if they have a Credit transaction (repayment) of type Loan in the FY or early next FY (up to 3 months later)
        const nextFYCutoff = new Date(endDate.getTime() + 91 * 24 * 60 * 60 * 1000);
        const loanCreditInFY = transactions.find(t => 
          t.memberId === m.id && 
          t.type === 'Credit' && 
          t.accountType === 'Loan' && 
          new Date(t.date) >= effectiveStartDate && 
          new Date(t.date) <= nextFYCutoff
        );

        // 3. Check if their current active loan is from the FY
        const currentLoanDateStr = m.originalLoanDate || m.lastLoanCalculationDate;
        const currentLoanInFY = currentLoanDateStr && new Date(currentLoanDateStr) >= effectiveStartDate && new Date(currentLoanDateStr) <= endDate;

        // If none of these match, this member had no loan in the FY
        if (!loanDebitInFY && !loanCreditInFY && !currentLoanInFY) {
          return null;
        }

        // Determine original loan date
        let loanDate = startDateStr;
        if (loanDebitInFY) {
          loanDate = loanDebitInFY.date;
        } else if (currentLoanInFY) {
          loanDate = currentLoanDateStr!;
        } else if (loanCreditInFY) {
          if (loanCreditInFY.previousLoanCalculationDate) {
            loanDate = loanCreditInFY.previousLoanCalculationDate;
          } else {
            // Reconstruct based on interest formula
            const prin = loanCreditInFY.principalPaid || (loanCreditInFY.amount - (loanCreditInFY.interestPaid || 0)) || 30000;
            const intr = loanCreditInFY.interestPaid || 0;
            if (intr > 0 && prin > 0) {
              const estDays = Math.round((intr * 365) / (prin * 0.06));
              if (estDays > 30 && estDays < 450) {
                const repDate = new Date(loanCreditInFY.date);
                const estLoanDateObj = new Date(repDate.getTime() - estDays * 24 * 60 * 60 * 1000);
                loanDate = format(estLoanDateObj, 'yyyy-MM-dd');
              }
            }
          }
        }

        // STRICT CHECK: The loan disbursement date MUST fall within the target Financial Year!
        const parsedLoanDate = new Date(loanDate);
        if (parsedLoanDate < effectiveStartDate || parsedLoanDate > endDate) {
          return null;
        }

        // Determine loan amount
        let loanAmount = 0;
        const totalDebitsInFY = transactions
          .filter(t => t.memberId === m.id && t.type === 'Debit' && t.accountType === 'Loan' && new Date(t.date) >= effectiveStartDate && new Date(t.date) <= endDate)
          .reduce((sum, t) => sum + t.amount, 0);

        if (totalDebitsInFY > 0) {
          loanAmount = totalDebitsInFY;
        } else {
          // Reconstruct from all repayments in the period + waived + outstanding
          const creditTxnsInPeriod = transactions.filter(t => 
            t.memberId === m.id && 
            t.type === 'Credit' && 
            t.accountType === 'Loan' && 
            new Date(t.date) >= effectiveStartDate && 
            new Date(t.date) <= nextFYCutoff
          );
          
          const creditNet = creditTxnsInPeriod.reduce((sum, t) => 
            sum + (t.principalPaid || Math.max(0, t.amount - (t.interestPaid || 0))), 0
          );
          
          const waived = creditTxnsInPeriod.reduce((sum, t) => {
            if (t.waivedAmount) return sum + t.waivedAmount;
            const match = (t.details || '').match(/कर्ज माफी: ₹(\d+)/);
            return sum + (match ? parseInt(match[1]) : 0);
          }, 0);

          const outstanding = currentLoanInFY ? Math.max(0, m.loanPrincipal) : 0;
          
          loanAmount = creditNet + waived + outstanding;

          if (loanAmount === 0) {
            loanAmount = currentLoanInFY ? (m.loanPrincipal || 30000) : 30000;
          }
        }

        // Determine if they fully repaid this specific loan before cutoffDate (31-03 of that FY)
        const creditTxnsBeforeCutoff = transactions.filter(t => 
          t.memberId === m.id && 
          t.type === 'Credit' && 
          t.accountType === 'Loan' && 
          t.date >= loanDate && 
          new Date(t.date) <= cutoffDate
        );

        const principalPaidBeforeCutoff = creditTxnsBeforeCutoff.reduce((sum, t) => 
          sum + (t.principalPaid || Math.max(0, t.amount - (t.interestPaid || 0))), 0
        );

        const waivedBeforeCutoff = creditTxnsBeforeCutoff.reduce((sum, t) => {
          if (t.waivedAmount) return sum + t.waivedAmount;
          const match = (t.details || '').match(/कर्ज माफी: ₹(\d+)/);
          return sum + (match ? parseInt(match[1]) : 0);
        }, 0);

        const totalRepaidBeforeCutoff = principalPaidBeforeCutoff + waivedBeforeCutoff;

        // Fully repaid if total repaid is >= loanAmount (allowing a small 5 Rs tolerance for rounding/waivers)
        const isRepaid = totalRepaidBeforeCutoff >= (loanAmount - 5);

        // Repayment date is the date of the last installment/payment that cleared the loan
        const sortedRepayments = [...creditTxnsBeforeCutoff].sort((a, b) => a.date.localeCompare(b.date));
        const repaymentDate = isRepaid && sortedRepayments.length > 0 ? sortedRepayments[sortedRepayments.length - 1].date : '-';
        const repaymentAmount = isRepaid ? loanAmount : 0;

        const days = isRepaid
          ? differenceInDays(new Date(repaymentDate), new Date(loanDate))
          : 0;

        const productValue = isRepaid ? (loanAmount * days) : 0;

        const interest3 = isRepaid ? Math.round((productValue * 0.03) / 365) : null;
        const interest2_5 = isRepaid ? Math.round((productValue * 0.025) / 365) : null;

        const remainingPrincipal = Math.max(0, loanAmount - totalRepaidBeforeCutoff);

        // Find the last transaction that paid interest before or on cutoffDate
        const lastInterestPaymentTxn = transactions
          .filter(t => 
            t.memberId === m.id && 
            t.type === 'Credit' && 
            t.accountType === 'Loan' && 
            (t.interestPaid && t.interestPaid > 0) && 
            new Date(t.date) <= cutoffDate
          )
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        const calculationStartDate = lastInterestPaymentTxn 
          ? lastInterestPaymentTxn.date 
          : (m.lastLoanCalculationDate && new Date(m.lastLoanCalculationDate) <= cutoffDate 
              ? m.lastLoanCalculationDate 
              : loanDate);

        const daysUpToCutoff = !isRepaid
          ? Math.max(0, differenceInDays(new Date(cutoffDate), new Date(calculationStartDate)))
          : days;

        let interest6 = null;
        if (!isRepaid) {
          const result = calculateLoanInterest(
            remainingPrincipal,
            calculationStartDate,
            endDateStr,
            settings.financialYearStart,
            settings.financialYearEnd,
            false,
            loanDate, // Pass original loan date
            settings.firstYearInterestRate || 6,
            settings.subsequentYearInterestRate || 12,
            0
          );
          interest6 = result.interest;
        }

        return {
          member: m,
          loanDate,
          loanAmount,
          remainingPrincipal,
          repaymentDate,
          repaymentAmount,
          days: days > 0 ? days : 0,
          product: productValue,
          interest3,
          interest2_5,
          isRepaid,
          daysUpToCutoff,
          interest6
        };
      })
      .filter(Boolean) as any[];
  };

  // Set default subtab if category is selected but no subtab is specified
  useEffect(() => {
    if (categoryId && !subTab) {
      const category = REPORT_CATEGORIES.find(c => c.id === categoryId);
      if (category && category.subTabs.length > 0) {
        navigate(`/reports/${categoryId}/${category.subTabs[0]}`, { replace: true });
      }
    }
  }, [categoryId, subTab, navigate]);

  // --- Derived Data ---

  // Financial
  const financialData = transactions.map(t => ({
    ...t,
    account: t.accountType === 'BankTransfer' ? 'Bank' : t.accountType
  })).sort((a, b) => b.timestamp - a.timestamp);

  // Loans - Calculate LIVE interest for reports
  const loanData = members
    .filter(m => m.loanPrincipal > 0 || m.originalLoanDate)
    .map(m => {
      const loanDate = m.originalLoanDate || 'N/A';

      // मूळ कर्ज रक्कम: negative (waiver artifact) असल्यास 0 घ्या
      const safePrincipal = Math.max(0, Number(m.loanPrincipal));

      // Calculate current accrued interest (NOT hiding for reports)
      // फक्त outstanding (principal > 0) सभासदांसाठी व्याज मोजा
      let accruedInterest = 0;
      if (safePrincipal > 0 && m.lastLoanCalculationDate) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const result = calculateLoanInterest(
          safePrincipal,
          m.lastLoanCalculationDate,
          today,
          settings.financialYearStart,
          settings.financialYearEnd,
          false,
          m.originalLoanDate,
          settings.firstYearInterestRate || 6,
          settings.subsequentYearInterestRate || 12,
          m.loanInterestDue || 0
        );
        accruedInterest = result.interest;
      }

      // Repaid members (principal = 0 किंवा negative waiver): व्याज 0 दाखवा
      const totalInterest = safePrincipal > 0
        ? (Math.max(0, Number(m.loanInterestDue)) + accruedInterest)
        : 0;
      const total = safePrincipal + totalInterest;

      return {
        id: m.id,
        memberNo: m.memberNo,
        name: m.name,
        village: m.village,
        loanDate: loanDate,
        principal: safePrincipal,
        interest: totalInterest,
        total: total,
        loanType: m.loanType || 'N/A',
        overdueDays: loanDate !== 'N/A' ? differenceInDays(new Date(), parseISO(loanDate)) : 0
      };
    });


  // Membership
  const memberReportData = members.map(m => ({
    id: m.memberNo, // Use memberNo as display ID
    realId: m.id,
    name: m.name,
    shareBalance: m.shareBalance,
    dividend: 0, // Placeholder
    mobile: m.mobile,
    village: m.village,
    land: m.landArea,
    category: m.category
  }));

  // --- Helpers ---
  const handleCategoryClick = (catId: CategoryId) => {
    const category = REPORT_CATEGORIES.find(c => c.id === catId);
    if (category && category.subTabs.length > 0) {
      navigate(`/reports/${catId}/${category.subTabs[0]}`);
    } else {
      navigate(`/reports/${catId}`);
    }
  };

  const handleBack = () => {
    if (subTab) {
      navigate('/reports');
    } else if (categoryId) {
      navigate('/reports');
    } else {
      navigate('/');
    }
  };

  const verifyDelete = (item: any) => {
    setItemToDelete(item);
    setShowPinModal(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      if (selectedCategory === 'financial' && activeSubTab === 'Daybook') {
        deleteTransaction(itemToDelete.id);
      }
      setItemToDelete(null);
    }
  };

  const handleMemberClick = (memberId: string) => {
    navigate(`/members/${memberId}`);
  };

  // --- Renderers for Specific Reports ---

  const renderFinancial = () => {
    if (activeSubTab === 'Daybook') {
      const columns: Column<typeof financialData[0]>[] = [
        {
          header: 'Type', accessorKey: 'type',
          render: (item) => <span className={`px-2 py-1 rounded text-xs font-bold ${item.type === 'Credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.type === 'Credit' ? 'Receipt' : 'Payment'}</span>
        },
        { header: 'Account', accessorKey: 'accountType' },
        { header: 'Details', accessorKey: 'details' },
        { header: 'Date', accessorKey: 'date' },
        { header: 'Amount', accessorKey: 'amount', render: (item) => `₹${item.amount}` },
      ];
      return <ReportTable title="Daybook" columns={columns} data={financialData} onDelete={verifyDelete} />;
    }

    if (activeSubTab === 'Receipt & Payment') {
      const receipts = transactions.filter(t => t.type === 'Credit');
      const payments = transactions.filter(t => t.type === 'Debit');

      const groupByCategory = (data: typeof transactions) => {
        return data.reduce((acc: Record<string, number>, curr) => {
          const cat = curr.accountType === 'Expense' ? (curr.expenseCategory || 'General Expense') : curr.accountType;
          acc[cat] = (Number(acc[cat]) || 0) + Number(curr.amount);
          return acc;
        }, {} as Record<string, number>);
      };

      const receiptGroups = groupByCategory(receipts);
      const paymentGroups = groupByCategory(payments);

      const totalReceipts = (Object.values(receiptGroups) as number[]).reduce((a, b) => a + b, 0);
      const totalPayments = (Object.values(paymentGroups) as number[]).reduce((a, b) => a + b, 0);

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full">
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
            <h2 className="text-xl font-bold">Receipt & Payment Account (जमा-खर्च पत्रक)</h2>
            <div className="text-sm opacity-80">FY 2025-26</div>
          </div>

          <div className="flex-1 overflow-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x dark:divide-slate-700">
            {/* Receipts Side */}
            <div className="flex-1 flex flex-col">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 border-b dark:border-slate-700 font-bold text-emerald-700 dark:text-emerald-400 flex justify-between">
                <span>RECEIPTS (जमा)</span>
                <span>Amount (₹)</span>
              </div>
              <div className="flex-1 p-4 space-y-3">
                {Object.entries(receiptGroups).map(([cat, amount]) => (
                  <div key={cat} className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>{cat}</span>
                    <span className="font-mono">₹{amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto bg-slate-50 dark:bg-slate-900/50 p-4 border-t dark:border-slate-700 font-bold flex justify-between text-lg text-emerald-600">
                <span>Total Receipts</span>
                <span>₹{totalReceipts.toLocaleString()}</span>
              </div>
            </div>

            {/* Payments Side */}
            <div className="flex-1 flex flex-col">
              <div className="bg-red-50 dark:bg-red-950/30 p-3 border-b dark:border-slate-700 font-bold text-red-700 dark:text-red-400 flex justify-between">
                <span>PAYMENTS (खर्च)</span>
                <span>Amount (₹)</span>
              </div>
              <div className="flex-1 p-4 space-y-3">
                {Object.entries(paymentGroups).map(([cat, amount]) => (
                  <div key={cat} className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>{cat}</span>
                    <span className="font-mono">₹{amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto bg-slate-50 dark:bg-slate-900/50 p-4 border-t dark:border-slate-700 font-bold flex justify-between text-lg text-red-600">
                <span>Total Payments</span>
                <span>₹{totalPayments.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 text-white p-3 text-center font-bold text-lg">
            Closing Balance: ₹{(Number(totalReceipts) - Number(totalPayments)).toLocaleString()}
          </div>
        </div>
      );
    }

    if (activeSubTab === 'Profit & Loss') {
      const realizedInterest = transactions
        .filter(t => t.type === 'Credit' && (t.accountType === 'Loan' || t.details.toLowerCase().includes('interest')))
        .reduce((acc, curr) => acc + (curr.interestPaid || 0), 0);

      const accruedInterest = members.reduce((acc, curr) => acc + (curr.loanInterestDue || 0), 0);

      const expenses = transactions
        .filter(t => t.type === 'Debit' && t.accountType === 'Expense')
        .reduce((acc, curr) => acc + curr.amount, 0);

      const netProfit = (realizedInterest + accruedInterest) - expenses;

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border-l-4 border-green-500">
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase">Total Income (Interest)</h4>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">₹{(realizedInterest + accruedInterest).toLocaleString()}</p>
              <div className="text-xs text-slate-400 mt-2">Realized: ₹{realizedInterest.toLocaleString()} | Accrued: ₹{accruedInterest.toLocaleString()}</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border-l-4 border-red-500">
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase">Total Expenses</h4>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">₹{expenses.toLocaleString()}</p>
            </div>
            <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border-l-4 ${netProfit >= 0 ? 'border-blue-500' : 'border-amber-500'}`}>
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase">Estimated Net Profit</h4>
              <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>₹{netProfit.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-6">Profit & Loss Chart (नफा-तोटा चार्ट)</h3>
            <div className="flex flex-col gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-green-600">Income (Interest Received/Due)</span>
                  <span className="text-lg font-mono">₹{(Number(realizedInterest) + Number(accruedInterest)).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-8 rounded-full overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${Math.min(100, (Number(realizedInterest) / (Number(realizedInterest) + Number(accruedInterest) + Number(expenses) || 1)) * 100)}%` }}></div>
                  <div className="bg-green-300 h-full" style={{ width: `${Math.min(100, (Number(accruedInterest) / (Number(realizedInterest) + Number(accruedInterest) + Number(expenses) || 1)) * 100)}%` }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-red-600">Expenses (खर्च)</span>
                  <span className="text-lg font-mono">₹{Number(expenses).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-8 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full" style={{ width: `${Math.min(100, (Number(expenses) / (Number(realizedInterest) + Number(accruedInterest) + Number(expenses) || 1)) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeSubTab === 'General Ledger') {
      const accounts = ['All', ...Array.from(new Set(transactions.map(t => t.accountType === 'Expense' ? (t.expenseCategory || 'General Expense') : t.accountType)))];

      const filteredRecords = filterLedgerAccount === 'All'
        ? financialData
        : financialData.filter(t => {
          const cat = t.accountType === 'Expense' ? (t.expenseCategory || 'General Expense') : t.accountType;
          return cat === filterLedgerAccount;
        });

      const columns: Column<typeof financialData[0]>[] = [
        { header: 'Date', accessorKey: 'date' },
        {
          header: 'Type', accessorKey: 'type',
          render: (item) => <span className={`px-2 py-1 rounded text-xs font-bold ${item.type === 'Credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.type === 'Credit' ? 'Jama' : 'Nave'}</span>
        },
        { header: 'Details', accessorKey: 'details' },
        { header: 'Amount', accessorKey: 'amount', render: (item) => `₹${item.amount.toLocaleString()}` },
      ];

      return (
        <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <span className="text-sm font-bold text-slate-500">Filter Account:</span>
            <select
              value={filterLedgerAccount}
              onChange={(e) => setFilterLedgerAccount(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
            </select>
          </div>
          <ReportTable title={`General Ledger - ${filterLedgerAccount}`} columns={columns} data={filteredRecords} />
        </div>
      );
    }

    if (activeSubTab === 'Balance Sheet') {
      const totalSavings = members.reduce((acc, curr) => acc + Number(curr.savingsBalance), 0);
      const totalShares = members.reduce((acc, curr) => acc + Number(curr.shareBalance), 0);
      const totalLoanPrincipal = members.reduce((acc, curr) => acc + Number(curr.loanPrincipal), 0);

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full">
          <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
            <h2 className="text-xl font-bold">Balance Sheet (ताळेबंद)</h2>
            <div className="text-sm opacity-80">As of {new Date().toLocaleDateString()}</div>
          </div>

          <div className="flex-1 overflow-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x dark:divide-slate-700">
            {/* Liabilities Side */}
            <div className="flex-1 flex flex-col">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b dark:border-slate-700 font-bold flex justify-between">
                <span>LIABILITIES (देणी)</span>
                <span>Amount (₹)</span>
              </div>
              <div className="flex-1 p-4 space-y-4">
                <div className="flex justify-between border-b pb-2 dark:border-slate-700">
                  <span>Share Capital (वसूल भागभांडवल)</span>
                  <span className="font-mono">₹{totalShares.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b pb-2 dark:border-slate-700">
                  <span>Members Savings (ठेवी)</span>
                  <span className="font-mono">₹{totalSavings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b pb-2 dark:border-slate-700 italic text-slate-500">
                  <span>Reserve & Other Funds</span>
                  <span className="font-mono">₹0</span>
                </div>
              </div>
            </div>

            {/* Assets Side */}
            <div className="flex-1 flex flex-col">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b dark:border-slate-700 font-bold flex justify-between">
                <span>ASSETS (मालमत्ता)</span>
                <span>Amount (₹)</span>
              </div>
              <div className="flex-1 p-4 space-y-4">
                <div className="flex justify-between border-b pb-2 dark:border-slate-700">
                  <span>Loans Outstanding (कर्ज येणे बाकी)</span>
                  <span className="font-mono">₹{totalLoanPrincipal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b pb-2 dark:border-slate-700 italic text-slate-500">
                  <span>Cash & Bank Balances</span>
                  <span className="font-mono">-</span>
                </div>
                <div className="flex justify-between border-b pb-2 dark:border-slate-700 italic text-slate-500">
                  <span>Other Assets</span>
                  <span className="font-mono">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <div className="p-8 text-center text-slate-500">Feature '{activeSubTab}' is under development.</div>;
  };

  const renderInventory = () => {
    const { paddyPurchases, dispatches, inventoryAdjustments } = useApp();

    if (activeSubTab === 'Paddy Stock') {
      const totalPurchaseBags = paddyPurchases.reduce((acc, curr) => acc + (Number(curr.godownBags) || 0) + (Number(curr.shedBags) || 0) + (Number(curr.openBags) || 0), 0);
      const totalPurchaseWeight = paddyPurchases.reduce((acc, curr) => acc + (Number(curr.godownWeight) || 0) + (Number(curr.shedWeight) || 0) + (Number(curr.openWeight) || 0), 0);

      const totalDispatchBags = dispatches.reduce((acc, curr) => acc + (Number(curr.bags) || 0), 0);
      const totalDispatchWeight = dispatches.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);

      const godownBags = paddyPurchases.reduce((acc, curr) => acc + (Number(curr.godownBags) || 0), 0) - dispatches.filter(d => d.storageSource === 'Godown').reduce((acc, curr) => acc + (Number(curr.bags) || 0), 0);
      const shedBags = paddyPurchases.reduce((acc, curr) => acc + (Number(curr.shedBags) || 0), 0) - dispatches.filter(d => d.storageSource === 'Shed').reduce((acc, curr) => acc + (Number(curr.bags) || 0), 0);
      const openBags = paddyPurchases.reduce((acc, curr) => acc + (Number(curr.openBags) || 0), 0) - dispatches.filter(d => d.storageSource === 'Open').reduce((acc, curr) => acc + (Number(curr.bags) || 0), 0);

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <span className="text-sm font-bold text-emerald-600 uppercase">Total Purchased</span>
              <p className="text-3xl font-black text-emerald-800 dark:text-emerald-400 mt-1">{totalPurchaseBags.toLocaleString()} <span className="text-sm">Bags</span></p>
              <p className="text-xs text-emerald-500 font-bold">{totalPurchaseWeight.toFixed(2)} Qtl</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
              <span className="text-sm font-bold text-blue-600 uppercase">Total Dispatched</span>
              <p className="text-3xl font-black text-blue-800 dark:text-blue-400 mt-1">{totalDispatchBags.toLocaleString()} <span className="text-sm">Bags</span></p>
              <p className="text-xs text-blue-500 font-bold">{totalDispatchWeight.toFixed(2)} Qtl</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-800">
              <span className="text-sm font-bold text-amber-600 uppercase">Current Stock</span>
              <p className="text-3xl font-black text-amber-800 dark:text-amber-400 mt-1">{(totalPurchaseBags - totalDispatchBags).toLocaleString()} <span className="text-sm">Bags</span></p>
              <p className="text-xs text-amber-500 font-bold">{(totalPurchaseWeight - totalDispatchWeight).toFixed(2)} Qtl</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white font-bold">Storage Breakdown (साठा विभागणी)</div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 border dark:border-slate-700 rounded-xl">
                <div className="text-slate-500 text-xs font-bold uppercase mb-2">Godown Stock</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">{godownBags.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">Bags</div>
              </div>
              <div className="text-center p-4 border dark:border-slate-700 rounded-xl">
                <div className="text-slate-500 text-xs font-bold uppercase mb-2">Shed Stock</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">{shedBags.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">Bags</div>
              </div>
              <div className="text-center p-4 border dark:border-slate-700 rounded-xl">
                <div className="text-slate-500 text-xs font-bold uppercase mb-2">Open Stock</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">{openBags.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">Bags</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeSubTab === 'Gunny Bags') {
      const purchasedNew = paddyPurchases.reduce((acc, curr) => acc + (Number(curr.newBags) || 0), 0);
      const purchasedOld = paddyPurchases.reduce((acc, curr) => acc + (Number(curr.oldBags) || 0), 0);
      const purchasedUsed = paddyPurchases.reduce((acc, curr) => acc + (Number(curr.usedOnceBags) || 0), 0);

      const dispatchedNew = dispatches.reduce((acc, curr) => acc + (Number(curr.newBagsUsed) || 0), 0);
      const dispatchedOld = dispatches.reduce((acc, curr) => acc + (Number(curr.oldBagsUsed) || 0), 0);
      const dispatchedUsed = dispatches.reduce((acc, curr) => acc + (Number(curr.usedOnceBagsUsed) || 0), 0);

      const getAdjustment = (item: any) => {
        return inventoryAdjustments.filter(a => a.item === item).reduce((acc, curr) => {
          if (curr.type === 'Damage') return acc - curr.quantity;
          return acc + curr.quantity;
        }, 0);
      };

      const stockNew = getAdjustment('NewBags') - purchasedNew;
      const stockOld = getAdjustment('OldBags') - purchasedOld;
      const stockUsed = getAdjustment('UsedOnceBags') - purchasedUsed;

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-4 bg-emerald-600 text-white font-bold">Gunny Bags Inventory (रिकाम्या पोत्यांचा साठा)</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-4 text-left">Bag Type</th>
                <th className="p-4 text-center">Purchased (Used)</th>
                <th className="p-4 text-center">Dispatched (Left with Mal)</th>
                <th className="p-4 text-center">Current Handled</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              <tr>
                <td className="p-4 font-bold">New Bags (नवीन)</td>
                <td className="p-4 text-center">{getAdjustment('NewBags')}</td>
                <td className="p-4 text-center text-red-500">{purchasedNew}</td>
                <td className={`p-4 text-center font-black ${stockNew < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{stockNew}</td>
              </tr>
              <tr>
                <td className="p-4 font-bold">Old Bags (जुने)</td>
                <td className="p-4 text-center">{getAdjustment('OldBags')}</td>
                <td className="p-4 text-center text-red-500">{purchasedOld}</td>
                <td className={`p-4 text-center font-black ${stockOld < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{stockOld}</td>
              </tr>
              <tr>
                <td className="p-4 font-bold">Used Once (एकदा वापरलेले)</td>
                <td className="p-4 text-center">{getAdjustment('UsedOnceBags')}</td>
                <td className="p-4 text-center text-red-500">{purchasedUsed}</td>
                <td className={`p-4 text-center font-black ${stockUsed < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{stockUsed}</td>
              </tr>
            </tbody>
          </table>
          <div className="p-8 text-center text-slate-400 italic text-xs">
            Note: Use 'Inventory Entry' to add initial stock/bundles of bags.
          </div>
        </div>
      );
    }

    return <div className="p-8 text-center text-slate-500">Select a report from above.</div>;
  };

  // तारीख DD-MM-YYYY format मध्ये convert करण्यासाठी helper
  const fmtDateDMY = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A' || dateStr === '-') return dateStr;
    try {
      const [y, m, d] = dateStr.split('-');
      if (y && m && d) return `${d}-${m}-${y}`;
      return dateStr;
    } catch { return dateStr; }
  };

  const renderFYSelector = () => {
    const currentStartYear = new Date(settings.financialYearStart || '2026-04-01').getFullYear();
    
    const options = [
      {
        label: `चालू आर्थिक वर्ष ${currentStartYear}-${(currentStartYear + 1).toString().slice(-2)}`,
        start: `${currentStartYear}-04-01`,
        end: `${currentStartYear + 1}-03-31`
      },
      {
        label: `मागील आर्थिक वर्ष ${currentStartYear - 1}-${currentStartYear.toString().slice(-2)}`,
        start: `${currentStartYear - 1}-04-01`,
        end: `${currentStartYear}-03-31`
      },
      {
        label: `आर्थिक वर्ष ${currentStartYear - 2}-${(currentStartYear - 1).toString().slice(-2)}`,
        start: `${currentStartYear - 2}-04-01`,
        end: `${currentStartYear - 1}-03-31`
      }
    ];

    const currentRange = selectedFYRange || { start: settings.financialYearStart, end: settings.financialYearEnd };
    const currentVal = `${currentRange.start}_${currentRange.end}`;

    return (
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto self-start print:hidden mb-2">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">आर्थिक वर्ष निवडा (FY):</span>
        <select
          value={currentVal}
          onChange={(e) => {
            const [start, end] = e.target.value.split('_');
            setSelectedFYRange({ start, end });
          }}
          className="px-3 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
        >
          {options.map(opt => (
            <option key={`${opt.start}_${opt.end}`} value={`${opt.start}_${opt.end}`}>
              {opt.label} ({opt.start.split('-').reverse().join('.')} ते {opt.end.split('-').reverse().join('.')})
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderLoan = () => {
    const columns: Column<typeof loanData[0]>[] = [
      { header: 'No.', accessorKey: 'memberNo', width: '60px' },
      {
        header: 'Name', accessorKey: 'name', className: 'font-bold text-blue-600 hover:underline',
        render: (item) => <span onClick={(e) => { e.stopPropagation(); handleMemberClick(item.id); }}>{item.name}</span>
      },
      { header: 'Village', accessorKey: 'village' },
      { header: 'Loan Date', accessorKey: 'loanDate', render: (i) => fmtDateDMY(i.loanDate) },
      { header: 'Principal', accessorKey: 'principal', render: (i) => `${i.principal.toLocaleString()}` },
      { header: 'Interest', accessorKey: 'interest', render: (i) => `${i.interest.toLocaleString()}` },
      { header: 'Total', accessorKey: 'total', render: (i) => `${i.total.toLocaleString()}` },
    ];

    // Filter logic for Loan tabs
    let displayData = loanData;

    if (activeSubTab === 'Recovery Report') {
      // Filter for Recovery Report - show only TRUE defaulters
      // Exclude current FY regular loans
      const fyStart = new Date(activeStart);
      const fyEnd = new Date(activeEnd);

      displayData = loanData.filter(item => {
        // Must have outstanding loan balance
        if (item.total <= 0) return false;

        // If no loan date, exclude
        if (item.loanDate === 'N/A') return false;

        const loanDate = new Date(item.loanDate);

        // Exclude loans from current FY (these are regular, not defaulters yet)
        if (loanDate >= fyStart && loanDate <= fyEnd) {
          return false; // Current FY loans - not defaulters
        }

        // Include all loans from BEFORE current FY (these are defaulters)
        return true;
      });
    }

    if (activeSubTab === 'Regular (FY)') {
      // Filter for Current Financial Year
      const fyStart = new Date(activeStart);
      const fyEnd = new Date(activeEnd);

      displayData = loanData.filter(item => {
        if (item.loanDate === 'N/A') return false;
        const d = new Date(item.loanDate);
        return d >= fyStart && d <= fyEnd;
      });

      return (
        <div className="flex flex-col gap-4 h-full">
          {renderFYSelector()}
          <ReportTable
            title={`Regular Loans (FY) - ${activeStart.split('-').reverse().join('-')} to ${activeEnd.split('-').reverse().join('-')}`}
            columns={columns}
            data={displayData}
            onRowClick={(item) => handleMemberClick(item.id)}
          />
        </div>
      );
    }

    if (activeSubTab === 'Repaid (FY)') {
      const displayLoans = getFYLoans(activeStart, activeEnd)
        .filter(item => repaidFilter === 'repaid' ? item.isRepaid : !item.isRepaid)
        .map((item) => ({
          id: item.member.id,
          memberNo: item.member.memberNo,
          name: item.member.name,
          village: item.member.village,
          loanDate: item.loanDate,
          principal: repaidFilter === 'repaid' ? item.loanAmount : item.remainingPrincipal,
          repaymentDate: item.repaymentDate,
          repaymentAmount: item.repaymentAmount,
          days: item.daysUpToCutoff,
          interest: item.interest6,
          totalDue: (repaidFilter === 'repaid' ? item.loanAmount : item.remainingPrincipal) + (item.interest6 || 0)
        }));

      const columnsToUse: Column<any>[] = repaidFilter === 'repaid'
        ? [
            { header: 'No.', accessorKey: 'memberNo', width: '60px' },
            {
              header: 'Name', accessorKey: 'name', className: 'font-bold text-blue-600 hover:underline',
              render: (item) => <span onClick={(e) => { e.stopPropagation(); handleMemberClick(item.id); }}>{item.name}</span>
            },
            { header: 'Village', accessorKey: 'village' },
            { header: 'Loan Date', accessorKey: 'loanDate', render: (i) => fmtDateDMY(i.loanDate) },
            { header: 'Principal', accessorKey: 'principal', render: (i) => i.principal.toLocaleString() },
            { header: 'Repayment Date', accessorKey: 'repaymentDate', render: (i) => fmtDateDMY(i.repaymentDate) },
            { header: 'Repayment Amount', accessorKey: 'repaymentAmount', render: (i) => i.repaymentAmount.toLocaleString() },
          ]
        : [
            { header: 'No.', accessorKey: 'memberNo', width: '60px' },
            {
              header: 'Name', accessorKey: 'name', className: 'font-bold text-blue-600 hover:underline',
              render: (item) => <span onClick={(e) => { e.stopPropagation(); handleMemberClick(item.id); }}>{item.name}</span>
            },
            { header: 'Village', accessorKey: 'village' },
            { header: 'Loan Date', accessorKey: 'loanDate', render: (i) => fmtDateDMY(i.loanDate) },
            { header: 'Principal', accessorKey: 'principal', render: (i) => i.principal.toLocaleString() },
            { header: 'Days (to 31 Mar)', accessorKey: 'days', render: (i) => i.days },
            { header: '6% Interest (to 31 Mar)', accessorKey: 'interest', render: (i) => i.interest ? i.interest.toLocaleString() : '0', className: 'text-red-500 font-bold' },
            { header: 'Total (to 31 Mar)', accessorKey: 'totalDue', render: (i) => i.totalDue.toLocaleString(), className: 'font-bold' },
          ];

      return (
        <div className="flex flex-col gap-4 h-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {renderFYSelector()}
            <div className="flex gap-2">
              <button
                onClick={() => setRepaidFilter('repaid')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition ${
                  repaidFilter === 'repaid'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                पूर्ण परतफेड केलेले (Repaid)
              </button>
              <button
                onClick={() => setRepaidFilter('outstanding')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition ${
                  repaidFilter === 'outstanding'
                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                थकीत सभासद (Outstanding)
              </button>
            </div>
          </div>
          <ReportTable
            title={repaidFilter === 'repaid'
              ? `Repaid Loans (FY) - ${activeStart.split('-').reverse().join('-')} to ${activeEnd.split('-').reverse().join('-')}`
              : `Outstanding Loans (FY) - ${activeStart.split('-').reverse().join('-')} to ${activeEnd.split('-').reverse().join('-')}`
            }
            columns={columnsToUse}
            data={displayLoans}
            onRowClick={(item) => handleMemberClick(item.id)}
          />
        </div>
      );
    }

    if (activeSubTab === 'Overdue Recoveries') {
      const fyStart = new Date(activeStart);
      const fyEnd = new Date(activeEnd);

      // Find all Credit transactions of type Loan during this FY
      const recoveryTxns = transactions.filter(t => 
        t.type === 'Credit' && 
        t.accountType === 'Loan' && 
        new Date(t.date) >= fyStart && 
        new Date(t.date) <= fyEnd
      );

      // Group by member, filtering only members whose original loan was disbursed before fyStart
      const memberRecoveries = members.map(m => {
        const loanDateStr = m.originalLoanDate || m.lastLoanCalculationDate;
        if (!loanDateStr || new Date(loanDateStr) >= fyStart) {
          return null; // Exclude current FY loans
        }

        // Get all recoveries for this member in this FY
        const memberTxns = recoveryTxns.filter(t => t.memberId === m.id);
        if (memberTxns.length === 0) return null;

        const totalRecovered = memberTxns.reduce((sum, t) => 
          sum + (t.principalPaid || Math.max(0, t.amount - (t.interestPaid || 0))), 0
        );

        if (totalRecovered <= 0) return null;

        const sortedTxns = [...memberTxns].sort((a, b) => a.date.localeCompare(b.date));
        const lastPaymentDate = sortedTxns[sortedTxns.length - 1].date;

        return {
          id: m.id,
          memberNo: m.memberNo,
          name: m.name,
          village: m.village,
          loanDate: loanDateStr,
          recoveredAmount: totalRecovered,
          lastPaymentDate,
          remainingBalance: Math.max(0, m.loanPrincipal)
        };
      }).filter(Boolean) as any[];

      const recoveryColumns: Column<any>[] = [
        { header: 'No.', accessorKey: 'memberNo', width: '60px' },
        {
          header: 'Name', accessorKey: 'name', className: 'font-bold text-blue-600 hover:underline',
          render: (item) => <span onClick={(e) => { e.stopPropagation(); handleMemberClick(item.id); }}>{item.name}</span>
        },
        { header: 'Village', accessorKey: 'village' },
        { header: 'Loan Date (Original)', accessorKey: 'loanDate', render: (i) => fmtDateDMY(i.loanDate) },
        { header: 'Recovered Amount', accessorKey: 'recoveredAmount', render: (i) => i.recoveredAmount.toLocaleString(), className: 'text-green-600 font-bold' },
        { header: 'Last Payment Date', accessorKey: 'lastPaymentDate', render: (i) => fmtDateDMY(i.lastPaymentDate) },
        { header: 'Remaining Balance', accessorKey: 'remainingBalance', render: (i) => i.remainingBalance.toLocaleString(), className: 'text-slate-600 font-medium' },
      ];

      return (
        <div className="flex flex-col gap-4 h-full">
          {renderFYSelector()}
          <ReportTable
            title={`Overdue Recoveries (थकीत वसुली) - ${activeStart.split('-').reverse().join('-')} to ${activeEnd.split('-').reverse().join('-')}`}
            columns={recoveryColumns}
            data={memberRecoveries}
            onRowClick={(item) => handleMemberClick(item.id)}
          />
        </div>
      );
    }

    if (activeSubTab === 'NPA List') {
      const unpaidLoans = getFYLoans(activeStart, activeEnd, true).filter(item => !item.isRepaid);

      let filteredUnpaidLoans = unpaidLoans;
      if (npaCategoryFilter !== 'ALL') {
        filteredUnpaidLoans = unpaidLoans.filter(item => {
          const m = item.member;
          const isTribal = m.category === 'ST';
          if (npaCategoryFilter === 'LARGE_TRIBAL') {
            return m.farmerType === 'Large Farmer' && isTribal;
          }
          if (npaCategoryFilter === 'LARGE_NON_TRIBAL') {
            return m.farmerType === 'Large Farmer' && !isTribal;
          }
          if (npaCategoryFilter === 'SMALL_TRIBAL') {
            return m.farmerType === 'Small Farmer' && isTribal;
          }
          if (npaCategoryFilter === 'SMALL_NON_TRIBAL') {
            return m.farmerType === 'Small Farmer' && !isTribal;
          }
          return true;
        });
      }

      // Group unpaid loans by member name + village to merge ST and MT loans for the same person
      const groupedMap = new Map<string, any[]>();
      filteredUnpaidLoans.forEach(item => {
        const key = `${item.member.name.trim()}_${item.member.village.trim()}`;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, []);
        }
        groupedMap.get(key)!.push(item);
      });

      const npaData = Array.from(groupedMap.values()).map((groupItems) => {
        const first = groupItems[0];
        
        // Combine member numbers (e.g. "83, 83-M")
        const memberNo = groupItems.map(item => item.member.memberNo).filter((v, idx, arr) => arr.indexOf(v) === idx).join(', ');

        const row: any = {
          id: first.member.id,
          memberNo: memberNo,
          name: first.member.name,
          village: first.member.village,
          ledgerPage: first.member.ledgerPageNo || memberNo || '-',
          
          stTotal: 0,
          mtTotal: 0,
          
          st1: 0, mt1: 0,
          st2: 0, mt2: 0,
          st3: 0, mt3: 0,
          st4: 0, mt4: 0,
          st5: 0, mt5: 0,
          stAbove5: 0, mtAbove5: 0,
          
          stOverdueAmt: 0,
          mtOverdueAmt: 0,
          stOverdueInt: 0,
          mtOverdueInt: 0
        };

        const getFYStartYear = (d: Date) => {
          const y = d.getFullYear();
          const month = d.getMonth();
          return month >= 3 ? y : y - 1;
        };
        const activeEndFY = getFYStartYear(new Date(activeEnd));

        groupItems.forEach(item => {
          const loanFY = getFYStartYear(new Date(item.loanDate));
          const ageYears = activeEndFY - loanFY + 1;
          const principal = item.remainingPrincipal;
          const interest = item.interest6 || 0;

          if (item.member.loanType === 'Medium Term') {
            row.mtTotal += principal;
            row.mtOverdueAmt += principal;
            row.mtOverdueInt += interest;

            if (ageYears <= 1) row.mt1 += principal;
            else if (ageYears === 2) row.mt2 += principal;
            else if (ageYears === 3) row.mt3 += principal;
            else if (ageYears === 4) row.mt4 += principal;
            else if (ageYears === 5) row.mt5 += principal;
            else if (ageYears > 5) row.mtAbove5 += principal;
          } else {
            // Default to Short Term
            row.stTotal += principal;
            row.stOverdueAmt += principal;
            row.stOverdueInt += interest;

            if (ageYears <= 1) row.st1 += principal;
            else if (ageYears === 2) row.st2 += principal;
            else if (ageYears === 3) row.st3 += principal;
            else if (ageYears === 4) row.st4 += principal;
            else if (ageYears === 5) row.st5 += principal;
            else if (ageYears > 5) row.stAbove5 += principal;
          }
        });

        return row;
      });

      const npaColumns: Column<any>[] = [
        { header: 'अ. क्र.', accessorKey: 'memberNo', width: '50px' },
        {
          header: 'कर्जदार सभासदाचे नाव', accessorKey: 'name', className: 'font-bold text-blue-600 hover:underline',
          render: (item) => <span onClick={(e) => { e.stopPropagation(); handleMemberClick(item.id); }}>{item.name}</span>
        },
        { header: 'गाव', accessorKey: 'village' },
        { header: 'खाते पान क्र.', accessorKey: 'ledgerPage', className: 'text-center' },
        
        { header: 'एकूण कर्ज बाकी (अमु)', accessorKey: 'stTotal', render: (i) => i.stTotal > 0 ? i.stTotal.toLocaleString() : '-' },
        { header: 'एकूण कर्ज बाकी (ममु)', accessorKey: 'mtTotal', render: (i) => i.mtTotal > 0 ? i.mtTotal.toLocaleString() : '-' },
        
        { header: '1 वर्ष थकीत (अमु)', accessorKey: 'st1', render: (i) => i.st1 > 0 ? i.st1.toLocaleString() : '-' },
        { header: '1 वर्ष थकीत (ममु)', accessorKey: 'mt1', render: (i) => i.mt1 > 0 ? i.mt1.toLocaleString() : '-' },
        
        { header: '2 वर्ष थकीत (अमु)', accessorKey: 'st2', render: (i) => i.st2 > 0 ? i.st2.toLocaleString() : '-' },
        { header: '2 वर्ष थकीत (ममु)', accessorKey: 'mt2', render: (i) => i.mt2 > 0 ? i.mt2.toLocaleString() : '-' },
        
        { header: '3 वर्ष थकीत (अमु)', accessorKey: 'st3', render: (i) => i.st3 > 0 ? i.st3.toLocaleString() : '-' },
        { header: '3 वर्ष थकीत (ममु)', accessorKey: 'mt3', render: (i) => i.mt3 > 0 ? i.mt3.toLocaleString() : '-' },
        
        { header: '4 वर्ष थकीत (अमु)', accessorKey: 'st4', render: (i) => i.st4 > 0 ? i.st4.toLocaleString() : '-' },
        { header: '4 वर्ष थकीत (ममु)', accessorKey: 'mt4', render: (i) => i.mt4 > 0 ? i.mt4.toLocaleString() : '-' },
        
        { header: '5 वर्ष थकीत (अमु)', accessorKey: 'st5', render: (i) => i.st5 > 0 ? i.st5.toLocaleString() : '-' },
        { header: '5 वर्ष थकीत (ममु)', accessorKey: 'mt5', render: (i) => i.mt5 > 0 ? i.mt5.toLocaleString() : '-' },
        
        { header: '५ वर्ष वरील (अमु)', accessorKey: 'stAbove5', render: (i) => i.stAbove5 > 0 ? i.stAbove5.toLocaleString() : '-' },
        { header: '५ वर्ष वरील (ममु)', accessorKey: 'mtAbove5', render: (i) => i.mtAbove5 > 0 ? i.mtAbove5.toLocaleString() : '-' },
        
        { header: 'एकूण थकीत रक्कम (अमु)', accessorKey: 'stOverdueAmt', render: (i) => i.stOverdueAmt > 0 ? i.stOverdueAmt.toLocaleString() : '-' },
        { header: 'एकूण थकीत रक्कम (ममु)', accessorKey: 'mtOverdueAmt', render: (i) => i.mtOverdueAmt > 0 ? i.mtOverdueAmt.toLocaleString() : '-' },
        
        { header: 'एकूण थकीत व्याज (अमु)', accessorKey: 'stOverdueInt', render: (i) => i.stOverdueInt > 0 ? i.stOverdueInt.toLocaleString() : '-' },
        { header: 'एकूण थकीत व्याज (ममु)', accessorKey: 'mtOverdueInt', render: (i) => i.mtOverdueInt > 0 ? i.mtOverdueInt.toLocaleString() : '-' },
      ];

      return (
        <div className="flex flex-col gap-4 h-full w-full max-w-full min-w-0">
          <div className="flex items-center gap-4 flex-wrap">
            {renderFYSelector()}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto self-start print:hidden mb-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">प्रवर्ग निवडा (Category):</span>
              <select
                value={npaCategoryFilter}
                onChange={(e) => setNpaCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">सर्व (ALL)</option>
                <option value="LARGE_TRIBAL">मोठे कृषक आदिवासी</option>
                <option value="LARGE_NON_TRIBAL">मोठे कृषक गैर आदिवासी</option>
                <option value="SMALL_TRIBAL">लघु कृषक आदिवासी</option>
                <option value="SMALL_NON_TRIBAL">लघु कृषक गैर आदिवासी</option>
              </select>
            </div>
          </div>
          <ReportTable
            title={`दिनांक ${activeEnd.split('-').reverse().join('.')} ची थकीत कर्जदार व चालू कर्ज बाकी यादी`}
            columns={npaColumns}
            data={npaData}
            onRowClick={(item) => handleMemberClick(item.id)}
            enableDateFilter={false}
          />
        </div>
      );
    }

    if (activeSubTab === 'Summary') {
      // Define loan categories based on Farmer Type and Member Category
      const categories = [
        { id: 1, label: 'मोठे कृषक आदिवासी', farmerType: 'Large Farmer', isTribal: true },
        { id: 2, label: 'मोठे कृषक गैर आदिवासी', farmerType: 'Large Farmer', isTribal: false },
        { id: 3, label: 'लघु कृषक आदिवासी', farmerType: 'Small Farmer', isTribal: true },
        { id: 4, label: 'लघु कृषक गैर आदिवासी', farmerType: 'Small Farmer', isTribal: false },
      ];

      // Time period buckets (shifted by 365 days for year-end logic)
      const timePeriods = [
        { key: 'total', label: 'एकूण कर्ज बाकी', minDays: 0, maxDays: Infinity },
        { key: '1yr', label: '१ वर्ष वरीत', minDays: -1, maxDays: 365 },
        { key: '2yr', label: '२ वर्ष वरीत', minDays: 365, maxDays: 730 },
        { key: '3yr', label: '३ वर्ष वरीत', minDays: 730, maxDays: 1095 },
        { key: '4yr', label: '४ वर्ष वरीत', minDays: 1095, maxDays: 1460 },
        { key: '5yr', label: '५ वर्ष वरीत', minDays: 1460, maxDays: 1825 },
        { key: 'above5yr', label: '५ वर्ष वरील वरीत', minDays: 1825, maxDays: Infinity },
      ];

      const activeUnpaid = getFYLoans(activeStart, activeEnd, true).filter(item => !item.isRepaid);

      // Calculate summary data
      const summaryData = categories.map(category => {
        const row: any = {
          id: category.id,
          category: category.label,
        };

        // Filter active unpaid loans for this category
        const categoryUnpaid = activeUnpaid.filter(item => {
          const m = item.member;
          if (m.farmerType !== category.farmerType) return false;
          const isTribal = m.category === 'ST';
          if (isTribal !== category.isTribal) return false;
          return true;
        });

        // Calculate Total Overdue Interest for the category
        row.overdueInterest_amount = categoryUnpaid.reduce((sum, item) => sum + (item.interest6 || 0), 0);
        row.overdueInterest_count = categoryUnpaid.filter(item => (item.interest6 || 0) > 0).length;

        // Calculate separate Alp and Madhyam interest for the category
        const categoryAlpUnpaid = categoryUnpaid.filter(item => item.member.loanType === 'Short Term');
        row.overdueInterest_alp_amount = categoryAlpUnpaid.reduce((sum, item) => sum + (item.interest6 || 0), 0);
        row.overdueInterest_alp_count = categoryAlpUnpaid.filter(item => (item.interest6 || 0) > 0).length;

        const categoryMadhyamUnpaid = categoryUnpaid.filter(item => item.member.loanType === 'Medium Term');
        row.overdueInterest_madhyam_amount = categoryMadhyamUnpaid.reduce((sum, item) => sum + (item.interest6 || 0), 0);
        row.overdueInterest_madhyam_count = categoryMadhyamUnpaid.filter(item => (item.interest6 || 0) > 0).length;

        timePeriods.forEach(period => {
          const filteredItems = categoryUnpaid.filter(item => {
            const days = item.daysUpToCutoff;

            // For total, include all loans
            if (period.key === 'total') return days >= 0;

            // For specific periods, check if overdue falls in range
            return days > period.minDays && days <= period.maxDays;
          });

          // Alp Mudat (Short Term)
          const alpItems = filteredItems.filter(item => item.member.loanType === 'Short Term');
          const alp_count = alpItems.length;
          const alp_amount = alpItems.reduce((sum, item) => sum + item.remainingPrincipal, 0);

          // Madhyam Mudat (Medium Term)
          const madhyamItems = filteredItems.filter(item => item.member.loanType === 'Medium Term');
          const madhyam_count = madhyamItems.length;
          const madhyam_amount = madhyamItems.reduce((sum, item) => sum + item.remainingPrincipal, 0);

          row[`${period.key}_alp_count`] = alp_count;
          row[`${period.key}_alp_amount`] = alp_amount;
          row[`${period.key}_madhyam_count`] = madhyam_count;
          row[`${period.key}_madhyam_amount`] = madhyam_amount;
        });

        return row;
      });

      // Calculate subtotals and totals
      const largeFarmerTotal: any = { id: 0, category: 'एकूण मोठे कृषक', isSubtotal: true };
      const smallFarmerTotal: any = { id: 0, category: 'एकूण लघु कृषक', isSubtotal: true };
      const tribalTotal: any = { id: 0, category: 'आदिवासी घटक' };
      const generalTotal: any = { id: 0, category: 'सर्व साधारण घटक' };
      const grandTotal: any = { id: 0, category: 'एकूण योगिदा' };

      // Helper to sum properties
      const sumProps = (target: any, source1: any, source2: any, key: string) => {
        target[key] = (source1[key] || 0) + (source2[key] || 0);
      };

      // Sum Interest first
      sumProps(largeFarmerTotal, summaryData[0], summaryData[1], 'overdueInterest_amount');
      sumProps(largeFarmerTotal, summaryData[0], summaryData[1], 'overdueInterest_count');
      sumProps(largeFarmerTotal, summaryData[0], summaryData[1], 'overdueInterest_alp_amount');
      sumProps(largeFarmerTotal, summaryData[0], summaryData[1], 'overdueInterest_alp_count');
      sumProps(largeFarmerTotal, summaryData[0], summaryData[1], 'overdueInterest_madhyam_amount');
      sumProps(largeFarmerTotal, summaryData[0], summaryData[1], 'overdueInterest_madhyam_count');

      sumProps(smallFarmerTotal, summaryData[2], summaryData[3], 'overdueInterest_amount');
      sumProps(smallFarmerTotal, summaryData[2], summaryData[3], 'overdueInterest_count');
      sumProps(smallFarmerTotal, summaryData[2], summaryData[3], 'overdueInterest_alp_amount');
      sumProps(smallFarmerTotal, summaryData[2], summaryData[3], 'overdueInterest_alp_count');
      sumProps(smallFarmerTotal, summaryData[2], summaryData[3], 'overdueInterest_madhyam_amount');
      sumProps(smallFarmerTotal, summaryData[2], summaryData[3], 'overdueInterest_madhyam_count');

      sumProps(tribalTotal, summaryData[0], summaryData[2], 'overdueInterest_amount');
      sumProps(tribalTotal, summaryData[0], summaryData[2], 'overdueInterest_count');
      sumProps(tribalTotal, summaryData[0], summaryData[2], 'overdueInterest_alp_amount');
      sumProps(tribalTotal, summaryData[0], summaryData[2], 'overdueInterest_alp_count');
      sumProps(tribalTotal, summaryData[0], summaryData[2], 'overdueInterest_madhyam_amount');
      sumProps(tribalTotal, summaryData[0], summaryData[2], 'overdueInterest_madhyam_count');

      sumProps(generalTotal, summaryData[1], summaryData[3], 'overdueInterest_amount');
      sumProps(generalTotal, summaryData[1], summaryData[3], 'overdueInterest_count');
      sumProps(generalTotal, summaryData[1], summaryData[3], 'overdueInterest_alp_amount');
      sumProps(generalTotal, summaryData[1], summaryData[3], 'overdueInterest_alp_count');
      sumProps(generalTotal, summaryData[1], summaryData[3], 'overdueInterest_madhyam_amount');
      sumProps(generalTotal, summaryData[1], summaryData[3], 'overdueInterest_madhyam_count');

      sumProps(grandTotal, tribalTotal, generalTotal, 'overdueInterest_amount');
      sumProps(grandTotal, tribalTotal, generalTotal, 'overdueInterest_count');
      sumProps(grandTotal, tribalTotal, generalTotal, 'overdueInterest_alp_amount');
      sumProps(grandTotal, tribalTotal, generalTotal, 'overdueInterest_alp_count');
      sumProps(grandTotal, tribalTotal, generalTotal, 'overdueInterest_madhyam_amount');
      sumProps(grandTotal, tribalTotal, generalTotal, 'overdueInterest_madhyam_count');

      timePeriods.forEach(period => {
        // Large Farmer subtotal (rows 1 and 2)
        sumProps(largeFarmerTotal, summaryData[0], summaryData[1], `${period.key}_alp_count`);
        sumProps(largeFarmerTotal, summaryData[0], summaryData[1], `${period.key}_alp_amount`);
        sumProps(largeFarmerTotal, summaryData[0], summaryData[1], `${period.key}_madhyam_count`);
        sumProps(largeFarmerTotal, summaryData[0], summaryData[1], `${period.key}_madhyam_amount`);

        // Small Farmer subtotal (rows 3 and 4)
        sumProps(smallFarmerTotal, summaryData[2], summaryData[3], `${period.key}_alp_count`);
        sumProps(smallFarmerTotal, summaryData[2], summaryData[3], `${period.key}_alp_amount`);
        sumProps(smallFarmerTotal, summaryData[2], summaryData[3], `${period.key}_madhyam_count`);
        sumProps(smallFarmerTotal, summaryData[2], summaryData[3], `${period.key}_madhyam_amount`);

        // Tribal total (rows 1 and 3)
        sumProps(tribalTotal, summaryData[0], summaryData[2], `${period.key}_alp_count`);
        sumProps(tribalTotal, summaryData[0], summaryData[2], `${period.key}_alp_amount`);
        sumProps(tribalTotal, summaryData[0], summaryData[2], `${period.key}_madhyam_count`);
        sumProps(tribalTotal, summaryData[0], summaryData[2], `${period.key}_madhyam_amount`);

        // General total (rows 2 and 4)
        sumProps(generalTotal, summaryData[1], summaryData[3], `${period.key}_alp_count`);
        sumProps(generalTotal, summaryData[1], summaryData[3], `${period.key}_alp_amount`);
        sumProps(generalTotal, summaryData[1], summaryData[3], `${period.key}_madhyam_count`);
        sumProps(generalTotal, summaryData[1], summaryData[3], `${period.key}_madhyam_amount`);

        // Grand total
        sumProps(grandTotal, tribalTotal, generalTotal, `${period.key}_alp_count`);
        sumProps(grandTotal, tribalTotal, generalTotal, `${period.key}_alp_amount`);
        sumProps(grandTotal, tribalTotal, generalTotal, `${period.key}_madhyam_count`);
        sumProps(grandTotal, tribalTotal, generalTotal, `${period.key}_madhyam_amount`);
      });

      // --- Yearwise Overdue Summary Calculations ---
      const getYearwiseRow = (loanType: 'Short Term' | 'Medium Term', label: string, id: number) => {
        const typeLoans = activeUnpaid.filter(item => {
          if (loanType === 'Medium Term') {
            return item.member.loanType === 'Medium Term';
          } else {
            return item.member.loanType !== 'Medium Term';
          }
        });

        const row: any = {
          id,
          loanType: label,
          total_count: typeLoans.length,
          total_amount: typeLoans.reduce((sum, item) => sum + item.remainingPrincipal, 0),
          interest_amount: typeLoans.reduce((sum, item) => sum + (item.interest6 || 0), 0)
        };

        const buckets = [
          { key: '1yr', min: -1, max: 365 },
          { key: '2yr', min: 365, max: 730 },
          { key: '3yr', min: 730, max: 1095 },
          { key: '4yr', min: 1095, max: 1460 },
          { key: '5yr', min: 1460, max: 1825 },
          { key: 'above5yr', min: 1825, max: Infinity }
        ];

        buckets.forEach(b => {
          const loansInBucket = typeLoans.filter(item => {
            const days = item.daysUpToCutoff;
            return days > b.min && days <= b.max;
          });
          row[`${b.key}_count`] = loansInBucket.length;
          row[`${b.key}_amount`] = loansInBucket.reduce((sum, item) => sum + item.remainingPrincipal, 0);
        });

        return row;
      };

      const alpRow = getYearwiseRow('Short Term', 'अल्प मुदती', 1);
      const mtRow = getYearwiseRow('Medium Term', 'मध्यम मुदती', 2);

      const totalRow = {
        id: 0,
        loanType: 'एकूण',
        '1yr_count': alpRow['1yr_count'] + mtRow['1yr_count'],
        '1yr_amount': alpRow['1yr_amount'] + mtRow['1yr_amount'],
        '2yr_count': alpRow['2yr_count'] + mtRow['2yr_count'],
        '2yr_amount': alpRow['2yr_amount'] + mtRow['2yr_amount'],
        '3yr_count': alpRow['3yr_count'] + mtRow['3yr_count'],
        '3yr_amount': alpRow['3yr_amount'] + mtRow['3yr_amount'],
        '4yr_count': alpRow['4yr_count'] + mtRow['4yr_count'],
        '4yr_amount': alpRow['4yr_amount'] + mtRow['4yr_amount'],
        '5yr_count': alpRow['5yr_count'] + mtRow['5yr_count'],
        '5yr_amount': alpRow['5yr_amount'] + mtRow['5yr_amount'],
        'above5yr_count': alpRow['above5yr_count'] + mtRow['above5yr_count'],
        'above5yr_amount': alpRow['above5yr_amount'] + mtRow['above5yr_amount'],
        total_count: alpRow.total_count + mtRow.total_count,
        total_amount: alpRow.total_amount + mtRow.total_amount,
        interest_amount: alpRow.interest_amount + mtRow.interest_amount
      };

      const yearwiseData = [alpRow, mtRow, totalRow];

      // Export to CSV Yearwise (Generates styled spreadsheet matching the year-wise columns)
      const handleNPAYearwiseCSV = async () => {
        const ws: any = {};
        const merges: any[] = [];

        const titleStyle = { font: { name: 'Calibri', sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const subtitleStyle = { font: { name: 'Calibri', sz: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const headerStyle = {
          font: { name: 'Calibri', sz: 10, bold: true },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: 'E2E8F0' } },
          border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
        };
        const cellStyle = {
          font: { name: 'Calibri', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
        };
        const amtStyle = {
          font: { name: 'Calibri', sz: 10 },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
        };
        const totalStyle = {
          font: { name: 'Calibri', sz: 10, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          border: { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } }
        };
        const totalAmtStyle = {
          font: { name: 'Calibri', sz: 10, bold: true },
          alignment: { horizontal: 'right', vertical: 'center' },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          border: { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } }
        };

        const setCell = (r: number, c: number, val: any, style: any = {}) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r, c });
          ws[cellRef] = { v: val, t: typeof val === 'number' ? 'n' : 's', s: style };
        };

        // Title
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 16 } });
        setCell(0, 0, "आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं.1425", titleStyle);
        for (let c = 1; c <= 16; c++) setCell(0, c, "");

        // Subtitle
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 16 } });
        setCell(1, 0, `दिनांक ${format(activeEnd, 'dd/MM/yyyy')} च्या स्थरावरील थकीत सभासदांची वर्षवार माहिती`, subtitleStyle);
        for (let c = 1; c <= 16; c++) setCell(1, c, "");

        // Headers
        merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });
        setCell(2, 0, "अ. क्र.", headerStyle);
        setCell(3, 0, "", headerStyle);

        merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } });
        setCell(2, 1, "कर्ज प्रकार", headerStyle);
        setCell(3, 1, "", headerStyle);

        const yearHeaders = [
          "1 वर्षा पर्यंत", "2 वर्षा पर्यंत", "3 वर्षा पर्यंत",
          "4 वर्षा पर्यंत", "5 वर्षा पर्यंत", "5 वर्षा वरील",
          "एकूण थकीत रक्कम"
        ];

        let colIdx = 2;
        yearHeaders.forEach(label => {
          merges.push({ s: { r: 2, c: colIdx }, e: { r: 2, c: colIdx + 1 } });
          setCell(2, colIdx, label, headerStyle);
          setCell(2, colIdx + 1, "", headerStyle);
          setCell(3, colIdx, "स. संख्या", headerStyle);
          setCell(3, colIdx + 1, "रक्कम", headerStyle);
          colIdx += 2;
        });

        merges.push({ s: { r: 2, c: 16 }, e: { r: 3, c: 16 } });
        setCell(2, 16, "एकूण थकीत व्याज", headerStyle);
        setCell(3, 16, "", headerStyle);

        let rowIdx = 4;
        yearwiseData.forEach((row) => {
          const isTotal = row.id === 0;
          const st = isTotal ? totalStyle : cellStyle;
          const stA = isTotal ? totalAmtStyle : amtStyle;

          setCell(rowIdx, 0, isTotal ? "" : row.id, st);
          setCell(rowIdx, 1, row.loanType, st);
          
          const keys = ['1yr', '2yr', '3yr', '4yr', '5yr', 'above5yr', 'total'];
          let cIdx = 2;
          keys.forEach(k => {
            const countKey = k === 'total' ? 'total_count' : `${k}_count`;
            const amtKey = k === 'total' ? 'total_amount' : `${k}_amount`;
            setCell(rowIdx, cIdx, row[countKey] || 0, st);
            setCell(rowIdx, cIdx + 1, row[amtKey] || 0, stA);
            cIdx += 2;
          });
          setCell(rowIdx, 16, row.interest_amount || 0, stA);
          rowIdx++;
        });

        ws['!merges'] = merges;
        ws['!ref'] = `A1:Q${rowIdx}`;
        ws['!cols'] = [
          { wch: 8 }, { wch: 20 },
          { wch: 10 }, { wch: 15 },
          { wch: 10 }, { wch: 15 },
          { wch: 10 }, { wch: 15 },
          { wch: 10 }, { wch: 15 },
          { wch: 10 }, { wch: 15 },
          { wch: 10 }, { wch: 15 },
          { wch: 12 }, { wch: 18 }, { wch: 20 }
        ];

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "Yearwise Overdue Summary");
        const excelBuffer = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Yearwise_Overdue_Summary_${activeEnd}.xlsx`);
      };

      // Export to CSV Function (Generates styled spreadsheet via xlsx-js-style)
      const handleNPASummaryCSV = async () => {
        const ws: any = {};
        const merges: any[] = [];

        // Styles configuration
        const titleStyle = {
          font: { name: 'Calibri', sz: 14, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
        const subtitleStyle = {
          font: { name: 'Calibri', sz: 11, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
        const headerStyle = {
          font: { name: 'Calibri', sz: 10, bold: true },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: 'E2E8F0' } }, // Slate 200
          border: {
            top: { style: 'thin', color: { rgb: '94A3B8' } },
            bottom: { style: 'thin', color: { rgb: '94A3B8' } },
            left: { style: 'thin', color: { rgb: '94A3B8' } },
            right: { style: 'thin', color: { rgb: '94A3B8' } }
          }
        };
        const subHeaderStyle = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'F1F5F9' } }, // Slate 100
          border: {
            top: { style: 'thin', color: { rgb: 'CBD5E1' } },
            bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
          }
        };
        const countStyle = {
          font: { name: 'Calibri', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };
        const amountStyle = {
          font: { name: 'Calibri', sz: 10 },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };
        const serialStyle = {
          font: { name: 'Calibri', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '94A3B8' } },
            bottom: { style: 'thin', color: { rgb: '94A3B8' } },
            left: { style: 'thin', color: { rgb: '94A3B8' } },
            right: { style: 'thin', color: { rgb: '94A3B8' } }
          }
        };
        const categoryStyle = {
          font: { name: 'Calibri', sz: 10, bold: true },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '94A3B8' } },
            bottom: { style: 'thin', color: { rgb: '94A3B8' } },
            left: { style: 'thin', color: { rgb: '94A3B8' } },
            right: { style: 'thin', color: { rgb: '94A3B8' } }
          }
        };
        const categoryStyleTotal = {
          font: { name: 'Calibri', sz: 10, bold: true },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: 'F8FAFC' } }, // Slate 50
          border: {
            top: { style: 'thin', color: { rgb: '94A3B8' } },
            bottom: { style: 'double', color: { rgb: '475569' } },
            left: { style: 'thin', color: { rgb: '94A3B8' } },
            right: { style: 'thin', color: { rgb: '94A3B8' } }
          }
        };
        const totalCountStyle = {
          font: { name: 'Calibri', sz: 10, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'F8FAFC' } }, // Slate 50
          border: {
            top: { style: 'thin', color: { rgb: '94A3B8' } },
            bottom: { style: 'double', color: { rgb: '475569' } },
            left: { style: 'thin', color: { rgb: '94A3B8' } },
            right: { style: 'thin', color: { rgb: '94A3B8' } }
          }
        };
        const totalAmountStyle = {
          font: { name: 'Calibri', sz: 10, bold: true },
          alignment: { horizontal: 'right', vertical: 'center' },
          fill: { fgColor: { rgb: 'F8FAFC' } }, // Slate 50
          border: {
            top: { style: 'thin', color: { rgb: '94A3B8' } },
            bottom: { style: 'double', color: { rgb: '475569' } },
            left: { style: 'thin', color: { rgb: '94A3B8' } },
            right: { style: 'thin', color: { rgb: '94A3B8' } }
          }
        };

        const setCell = (r: number, c: number, val: any, style: any = {}, z: string | null = null) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r, c });
          ws[cellRef] = {
            v: val,
            t: typeof val === 'number' ? 'n' : 's',
            s: style
          };
          if (z) ws[cellRef].z = z;
        };

        // Write Title (A1:T1 merged)
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 19 } });
        setCell(0, 0, "आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं. १४२५", titleStyle);
        for (let c = 1; c < 20; c++) setCell(0, c, "", titleStyle);

        // Write Subtitle (A2:T2 merged)
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 19 } });
        setCell(1, 0, `दिनांक ${format(activeEnd, 'dd/MM/yyyy')} ची थकीत कर्जदार व चालू कर्ज बाकी यादीचे एकत्रीकरण`, subtitleStyle);
        for (let c = 1; c < 20; c++) setCell(1, c, "", subtitleStyle);

        // Write Headers (Row 3 and 4)
        // अ. क्र. (merged A3:A4)
        merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });
        setCell(2, 0, "अ. क्र.", headerStyle);
        setCell(3, 0, "", headerStyle);

        // कृषकाचे प्रकार (merged B3:B4)
        merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } });
        setCell(2, 1, "कृषकाचे प्रकार", headerStyle);
        setCell(3, 1, "", headerStyle);

        const headerTitles = [
          "एकुण कर्ज बाकी",
          "१ वर्ष थकीत",
          "२ वर्ष थकीत",
          "३ वर्ष थकीत",
          "४ वर्ष थकीत",
          "५ वर्ष थकीत",
          "५ वर्षा वरील थकीत",
          "एकुण थकीत रक्कम",
          "एकुण थकीत व्याज"
        ];

        let colHIdx = 2;
        headerTitles.forEach(title => {
          merges.push({ s: { r: 2, c: colHIdx }, e: { r: 2, c: colHIdx + 1 } });
          setCell(2, colHIdx, title, headerStyle);
          setCell(2, colHIdx + 1, "", headerStyle);

          setCell(3, colHIdx, "अनु", subHeaderStyle);
          setCell(3, colHIdx + 1, "गनु", subHeaderStyle);
          colHIdx += 2;
        });

        let currentExcelRow = 4;

        // Block writing helper
        const writeDataBlock = (sNo: string | null, label: string, dataObj: any, isTotal = false) => {
          merges.push({ s: { r: currentExcelRow, c: 0 }, e: { r: currentExcelRow + 1, c: 0 } });
          setCell(currentExcelRow, 0, sNo || "", isTotal ? totalCountStyle : serialStyle);
          setCell(currentExcelRow + 1, 0, "", isTotal ? totalCountStyle : serialStyle);

          merges.push({ s: { r: currentExcelRow, c: 1 }, e: { r: currentExcelRow + 1, c: 1 } });
          setCell(currentExcelRow, 1, label, isTotal ? categoryStyleTotal : categoryStyle);
          setCell(currentExcelRow + 1, 1, "", isTotal ? categoryStyleTotal : categoryStyle);

          const periods = ['total', '1yr', '2yr', '3yr', '4yr', '5yr', 'above5yr'];
          let colIdx = 2;

          periods.forEach(p => {
            const alpCount = dataObj[`${p}_alp_count`] || 0;
            const alpAmount = dataObj[`${p}_alp_amount`] || 0;
            setCell(currentExcelRow, colIdx, alpCount, isTotal ? totalCountStyle : countStyle);
            setCell(currentExcelRow + 1, colIdx, alpAmount, isTotal ? totalAmountStyle : amountStyle, '#,##,##0');

            const madhyamCount = dataObj[`${p}_madhyam_count`] || 0;
            const madhyamAmount = dataObj[`${p}_madhyam_amount`] || 0;
            setCell(currentExcelRow, colIdx + 1, madhyamCount, isTotal ? totalCountStyle : countStyle);
            setCell(currentExcelRow + 1, colIdx + 1, madhyamAmount, isTotal ? totalAmountStyle : amountStyle, '#,##,##0');

            colIdx += 2;
          });

          // Overdue total
          const overdue_alp_count = (dataObj['1yr_alp_count'] || 0) + (dataObj['2yr_alp_count'] || 0) + (dataObj['3yr_alp_count'] || 0) + (dataObj['4yr_alp_count'] || 0) + (dataObj['5yr_alp_count'] || 0) + (dataObj['above5yr_alp_count'] || 0);
          const overdue_alp_amount = (dataObj['1yr_alp_amount'] || 0) + (dataObj['2yr_alp_amount'] || 0) + (dataObj['3yr_alp_amount'] || 0) + (dataObj['4yr_alp_amount'] || 0) + (dataObj['5yr_alp_amount'] || 0) + (dataObj['above5yr_alp_amount'] || 0);

          const overdue_madhyam_count = (dataObj['1yr_madhyam_count'] || 0) + (dataObj['2yr_madhyam_count'] || 0) + (dataObj['3yr_madhyam_count'] || 0) + (dataObj['4yr_madhyam_count'] || 0) + (dataObj['5yr_madhyam_count'] || 0) + (dataObj['above5yr_madhyam_count'] || 0);
          const overdue_madhyam_amount = (dataObj['1yr_madhyam_amount'] || 0) + (dataObj['2yr_madhyam_amount'] || 0) + (dataObj['3yr_madhyam_amount'] || 0) + (dataObj['4yr_madhyam_amount'] || 0) + (dataObj['5yr_madhyam_amount'] || 0) + (dataObj['above5yr_madhyam_amount'] || 0);

          setCell(currentExcelRow, colIdx, overdue_alp_count, isTotal ? totalCountStyle : countStyle);
          setCell(currentExcelRow + 1, colIdx, overdue_alp_amount, isTotal ? totalAmountStyle : amountStyle, '#,##,##0');

          setCell(currentExcelRow, colIdx + 1, overdue_madhyam_count, isTotal ? totalCountStyle : countStyle);
          setCell(currentExcelRow + 1, colIdx + 1, overdue_madhyam_amount, isTotal ? totalAmountStyle : amountStyle, '#,##,##0');

          colIdx += 2;

          // Interest ST/MT
          const overdueInt_alp_count = dataObj['overdueInterest_alp_count'] || 0;
          const overdueInt_alp_amount = dataObj['overdueInterest_alp_amount'] || 0;
          const overdueInt_madhyam_count = dataObj['overdueInterest_madhyam_count'] || 0;
          const overdueInt_madhyam_amount = dataObj['overdueInterest_madhyam_amount'] || 0;

          setCell(currentExcelRow, colIdx, overdueInt_alp_count, isTotal ? totalCountStyle : countStyle);
          setCell(currentExcelRow + 1, colIdx, overdueInt_alp_amount, isTotal ? totalAmountStyle : amountStyle, '#,##,##0');

          setCell(currentExcelRow, colIdx + 1, overdueInt_madhyam_count, isTotal ? totalCountStyle : countStyle);
          setCell(currentExcelRow + 1, colIdx + 1, overdueInt_madhyam_amount, isTotal ? totalAmountStyle : amountStyle, '#,##,##0');

          currentExcelRow += 2;
        };

        // Write groups
        writeDataBlock("१", "मोठे कृषक आदिवासी", summaryData[0]);
        writeDataBlock("२", "मोठे कृषक गैर आदिवासी", summaryData[1]);
        writeDataBlock(null, "एकूण मोठे कृषक बेरीज", largeFarmerTotal, true);

        writeDataBlock("१", "लघु कृषक आदिवासी", summaryData[2]);
        writeDataBlock("२", "लघु कृषक गैर आदिवासी", summaryData[3]);
        writeDataBlock(null, "एकूण लघु कृषक बेरीज", smallFarmerTotal, true);

        writeDataBlock("१", "एकूण मोठे कृषक बेरीज", largeFarmerTotal, true);
        writeDataBlock("२", "एकूण लघु कृषक बेरीज", smallFarmerTotal, true);
        writeDataBlock(null, "एकूण", grandTotal, true);

        writeDataBlock("१", "आदिवासी कृषक", tribalTotal, true);
        writeDataBlock("२", "गैर आदिवासी कृषक", generalTotal, true);
        writeDataBlock(null, "एकूण", grandTotal, true);

        // Leave empty space and write bottom summary table
        currentExcelRow += 3;

        merges.push({ s: { r: currentExcelRow, c: 0 }, e: { r: currentExcelRow, c: 6 } });
        setCell(currentExcelRow, 0, "एकूण कर्ज बाकी व थकीतचा गोषवारा", subtitleStyle);
        for (let c = 1; c < 7; c++) setCell(currentExcelRow, c, "", subtitleStyle);

        currentExcelRow += 1;

        merges.push({ s: { r: currentExcelRow, c: 0 }, e: { r: currentExcelRow + 1, c: 0 } });
        setCell(currentExcelRow, 0, "अ. क्र.", headerStyle);
        setCell(currentExcelRow + 1, 0, "", headerStyle);

        merges.push({ s: { r: currentExcelRow, c: 1 }, e: { r: currentExcelRow + 1, c: 1 } });
        setCell(currentExcelRow, 1, "प्रकार", headerStyle);
        setCell(currentExcelRow + 1, 1, "", headerStyle);

        merges.push({ s: { r: currentExcelRow, c: 2 }, e: { r: currentExcelRow, c: 3 } });
        setCell(currentExcelRow, 2, "एकूण कर्ज बाकी रक्कम", headerStyle);
        setCell(currentExcelRow, 3, "", headerStyle);

        merges.push({ s: { r: currentExcelRow, c: 4 }, e: { r: currentExcelRow, c: 6 } });
        setCell(currentExcelRow, 4, "एकूण थकीत रक्कम", headerStyle);
        setCell(currentExcelRow, 5, "", headerStyle);
        setCell(currentExcelRow, 6, "", headerStyle);

        currentExcelRow += 1;

        setCell(currentExcelRow, 2, "सभासद", subHeaderStyle);
        setCell(currentExcelRow, 3, "रक्कम", subHeaderStyle);
        setCell(currentExcelRow, 4, "सभासद", subHeaderStyle);
        setCell(currentExcelRow, 5, "रक्कम", subHeaderStyle);
        setCell(currentExcelRow, 6, "एकूण प्रलंबित होणारे व्याज", subHeaderStyle);

        currentExcelRow += 1;

        const overdue_alp_count = (grandTotal['1yr_alp_count'] || 0) + (grandTotal['2yr_alp_count'] || 0) + (grandTotal['3yr_alp_count'] || 0) + (grandTotal['4yr_alp_count'] || 0) + (grandTotal['5yr_alp_count'] || 0) + (grandTotal['above5yr_alp_count'] || 0);
        const overdue_alp_amount = (grandTotal['1yr_alp_amount'] || 0) + (grandTotal['2yr_alp_amount'] || 0) + (grandTotal['3yr_alp_amount'] || 0) + (grandTotal['4yr_alp_amount'] || 0) + (grandTotal['5yr_alp_amount'] || 0) + (grandTotal['above5yr_alp_amount'] || 0);

        const overdue_madhyam_count = (grandTotal['1yr_madhyam_count'] || 0) + (grandTotal['2yr_madhyam_count'] || 0) + (grandTotal['3yr_madhyam_count'] || 0) + (grandTotal['4yr_madhyam_count'] || 0) + (grandTotal['5yr_madhyam_count'] || 0) + (grandTotal['above5yr_madhyam_count'] || 0);
        const overdue_madhyam_amount = (grandTotal['1yr_madhyam_amount'] || 0) + (grandTotal['2yr_madhyam_amount'] || 0) + (grandTotal['3yr_madhyam_amount'] || 0) + (grandTotal['4yr_madhyam_amount'] || 0) + (grandTotal['5yr_madhyam_amount'] || 0) + (grandTotal['above5yr_madhyam_amount'] || 0);

        // Row 1: Short Term
        setCell(currentExcelRow, 0, "१)", countStyle);
        setCell(currentExcelRow, 1, "अल्पमुदती कर्ज", categoryStyle);
        setCell(currentExcelRow, 2, grandTotal.total_alp_count || 0, countStyle);
        setCell(currentExcelRow, 3, grandTotal.total_alp_amount || 0, amountStyle, '#,##,##0');
        setCell(currentExcelRow, 4, overdue_alp_count || 0, countStyle);
        setCell(currentExcelRow, 5, overdue_alp_amount || 0, amountStyle, '#,##,##0');
        setCell(currentExcelRow, 6, grandTotal.overdueInterest_alp_amount || 0, amountStyle, '#,##,##0');

        currentExcelRow += 1;
        // Row 2: Medium Term
        setCell(currentExcelRow, 0, "२)", countStyle);
        setCell(currentExcelRow, 1, "मध्यम मुदती कर्ज", categoryStyle);
        setCell(currentExcelRow, 2, grandTotal.total_madhyam_count || 0, countStyle);
        setCell(currentExcelRow, 3, grandTotal.total_madhyam_amount || 0, amountStyle, '#,##,##0');
        setCell(currentExcelRow, 4, overdue_madhyam_count || 0, countStyle);
        setCell(currentExcelRow, 5, overdue_madhyam_amount || 0, amountStyle, '#,##,##0');
        setCell(currentExcelRow, 6, grandTotal.overdueInterest_madhyam_amount || 0, amountStyle, '#,##,##0');

        currentExcelRow += 1;

        // Total Row
        setCell(currentExcelRow, 0, "", totalCountStyle);
        setCell(currentExcelRow, 1, "एकूण बेरीज :-", categoryStyleTotal);
        setCell(currentExcelRow, 2, (grandTotal.total_alp_count || 0) + (grandTotal.total_madhyam_count || 0), totalCountStyle);
        setCell(currentExcelRow, 3, (grandTotal.total_alp_amount || 0) + (grandTotal.total_madhyam_amount || 0), totalAmountStyle, '#,##,##0');
        setCell(currentExcelRow, 4, overdue_alp_count + overdue_madhyam_count, totalCountStyle);
        setCell(currentExcelRow, 5, overdue_alp_amount + overdue_madhyam_amount, totalAmountStyle, '#,##,##0');
        setCell(currentExcelRow, 6, (grandTotal.overdueInterest_alp_amount || 0) + (grandTotal.overdueInterest_madhyam_amount || 0), totalAmountStyle, '#,##,##0');

        ws['!merges'] = merges;
        ws['!cols'] = [
          { wch: 8 },   // S.No
          { wch: 26 },  // Category
          ...Array(18).fill({ wch: 14 }) // C to T
        ];
        const maxCell = XLSXStyle.utils.encode_cell({ r: currentExcelRow + 1, c: 19 });
        ws['!ref'] = `A1:${maxCell}`;

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "NPA Summary");

        const excelBuffer = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `NPA_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

        await showConfirm({
          title: 'Export Successful!',
          titleMr: 'एक्सपोर्ट यशस्वी झाले!',
          message: 'Styled NPA Summary report exported successfully to Excel.',
          messageMr: 'NPA Summary रिपोर्ट एक्सेलमध्ये हुबेहूब रचनेसह एक्सपोर्ट झाला.',
          icon: '✅',
          confirmText: 'OK',
          confirmTextMr: 'ठीक आहे',
          confirmColor: 'green'
        });
      };

      // Share Function
      const handleNPASummaryShare = async () => {
        try {
          const shareUrl = 'https://society-ilada1425.vercel.app' + window.location.hash;
          if (Capacitor.isNativePlatform()) {
            await Share.share({
              title: 'Society Ilada - NPA Summary',
              text: 'Check out the NPA Summary report.',
              url: shareUrl,
              dialogTitle: 'Share NPA Summary'
            });
          } else if (navigator.share) {
            await navigator.share({
              title: 'Society Ilada - NPA Summary',
              text: 'Check out the NPA Summary report.',
              url: shareUrl,
            });
          } else {
            alert('Sharing is not supported on this device/browser.');
          }
        } catch (error) {
          console.log('Error sharing:', error);
        }
      };

      // Render custom table
      if (summaryViewType === 'yearwise') {
        return (
          <div className="flex flex-col gap-4 h-full w-full max-w-full min-w-0">
            {renderFYSelector()}
            
            <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-xl max-w-md self-start">
              <button 
                onClick={() => setSummaryViewType('category')} 
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${summaryViewType === 'category' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                कृषकानुसार (Default)
              </button>
              <button 
                onClick={() => setSummaryViewType('yearwise')} 
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${summaryViewType === 'yearwise' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                थकीत सभासदांची वर्षवार माहिती
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
              <div className="bg-blue-900 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-center md:text-left">थकीत सभासदांची वर्षवार माहिती</h2>
                  <p className="text-sm text-center md:text-left opacity-80 mt-1">आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं.1425</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleNPAYearwiseCSV}
                    className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
                  >
                    <Download size={16} /> Export Excel
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 min-h-[400px]">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं.1425</h3>
                  <h4 className="text-md font-semibold text-slate-600 dark:text-slate-300 mt-1">
                    दिनांक {activeEnd.split('-').reverse().join('/')} च्या स्थरावरील थकीत सभासदांची वर्षवार माहिती
                  </h4>
                </div>

                <table className="w-full text-xs border-collapse border dark:border-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0">
                    <tr className="text-center font-bold">
                      <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 p-2">अ. क्र.</th>
                      <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 p-2">कर्ज प्रकार</th>
                      <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-2">1 वर्षा पर्यंत</th>
                      <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-2">2 वर्षा पर्यंत</th>
                      <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-2">3 वर्षा पर्यंत</th>
                      <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-2">4 वर्षा पर्यंत</th>
                      <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-2">5 वर्षा पर्यंत</th>
                      <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-2">5 वर्षा वरील</th>
                      <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-2 bg-yellow-50 dark:bg-yellow-950/30">एकूण थकीत रक्कम</th>
                      <th className="border border-slate-300 dark:border-slate-600 p-2 bg-red-50 dark:bg-red-950/30">एकूण थकीत व्याज</th>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-center font-semibold text-[10px]">
                      {[...Array(7)].map((_, i) => (
                        <React.Fragment key={i}>
                          <th className="border border-slate-300 dark:border-slate-600 p-1">स. संख्या</th>
                          <th className="border border-slate-300 dark:border-slate-600 p-1">रक्कम</th>
                        </React.Fragment>
                      ))}
                      <th className="border border-slate-300 dark:border-slate-600 p-1">रक्कम</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearwiseData.map((row) => {
                      const isTotal = row.id === 0;
                      return (
                        <tr 
                          key={row.loanType} 
                          className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 text-center ${isTotal ? 'bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-400 dark:border-slate-600' : ''}`}
                        >
                          <td className="border border-slate-300 dark:border-slate-600 p-2">{isTotal ? '' : row.id}</td>
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-left font-bold">{row.loanType}</td>
                          
                          <td className="border border-slate-300 dark:border-slate-600 p-2">{row['1yr_count'] || '0'}</td>
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-mono">{(row['1yr_amount'] || 0).toLocaleString()}</td>
                          
                          <td className="border border-slate-300 dark:border-slate-600 p-2">{row['2yr_count'] || '0'}</td>
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-mono">{(row['2yr_amount'] || 0).toLocaleString()}</td>
                          
                          <td className="border border-slate-300 dark:border-slate-600 p-2">{row['3yr_count'] || '0'}</td>
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-mono">{(row['3yr_amount'] || 0).toLocaleString()}</td>
                          
                          <td className="border border-slate-300 dark:border-slate-600 p-2">{row['4yr_count'] || '0'}</td>
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-mono">{(row['4yr_amount'] || 0).toLocaleString()}</td>
                          
                          <td className="border border-slate-300 dark:border-slate-600 p-2">{row['5yr_count'] || '0'}</td>
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-mono">{(row['5yr_amount'] || 0).toLocaleString()}</td>
                          
                          <td className="border border-slate-300 dark:border-slate-600 p-2">{row['above5yr_count'] || '0'}</td>
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-mono">{(row['above5yr_amount'] || 0).toLocaleString()}</td>
                          
                          <td className="border border-slate-300 dark:border-slate-600 p-2 bg-yellow-50/50 dark:bg-yellow-950/10">{row.total_count || '0'}</td>
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-bold font-mono bg-yellow-50/50 dark:bg-yellow-950/10">{(row.total_amount || 0).toLocaleString()}</td>
                          
                          <td className="border border-slate-300 dark:border-slate-600 p-2 text-right font-bold font-mono bg-red-50/50 dark:bg-red-950/10">{(row.interest_amount || 0).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-4 h-full w-full max-w-full min-w-0">
          {renderFYSelector()}
          
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-xl max-w-md self-start">
            <button 
              onClick={() => setSummaryViewType('category')} 
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${summaryViewType === 'category' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              कृषकानुसार (Default)
            </button>
            <button 
              onClick={() => setSummaryViewType('yearwise')} 
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${summaryViewType === 'yearwise' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              थकीत सभासदांची वर्षवार माहिती
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
          <div className="bg-blue-900 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-center md:text-left">NPA Summary (गोषवारा)</h2>
              <p className="text-sm text-center md:text-left opacity-80 mt-1">आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईलदा</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleNPASummaryShare}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-100 rounded-lg transition text-sm font-medium border border-indigo-400/30"
              >
                <Share2 size={16} /> Share
              </button>
              <button
                onClick={handleNPASummaryCSV}
                className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
              >
                <Download size={16} /> CSV
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-[500px] md:min-h-0">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10">
                {/* Row 1: Periods */}
                <tr>
                  <th rowSpan={3} className="border dark:border-slate-600 p-2 font-bold">अ. क्र.</th>
                  <th rowSpan={3} className="border dark:border-slate-600 p-2 font-bold">कृषकाचे प्रकार</th>
                  {timePeriods.map(period => (
                    <th key={period.key} colSpan={4} className="border dark:border-slate-600 p-2 font-bold text-center">
                      {period.label}
                    </th>
                  ))}
                  <th colSpan={2} rowSpan={2} className="border dark:border-slate-600 p-2 font-bold text-center">
                    एकूण थकीत व्याज
                  </th>
                </tr>
                {/* Row 2: Loan Types (Alp / Madhyam) */}
                <tr>
                  {timePeriods.map(period => (
                    <React.Fragment key={`${period.key}-type`}>
                      <th colSpan={2} className="border dark:border-slate-600 p-1 font-bold text-center bg-yellow-100 dark:bg-yellow-900/40 text-xs text-yellow-800 dark:text-yellow-200 border-b-2 border-yellow-300">अल्प मुदत</th>
                      <th colSpan={2} className="border dark:border-slate-600 p-1 font-bold text-center bg-yellow-100 dark:bg-yellow-900/40 text-xs text-yellow-800 dark:text-yellow-200 border-b-2 border-yellow-300">मध्यम मुदत</th>
                    </React.Fragment>
                  ))}
                </tr>
                {/* Row 3: Count / Amount */}
                <tr>
                  {timePeriods.map(period => (
                    <React.Fragment key={`${period.key}-metrics`}>
                      {/* Alp Metrics */}
                      <th className="border dark:border-slate-600 p-1 font-medium bg-green-50 dark:bg-green-900/30 text-[10px] text-green-700">संख्या</th>
                      <th className="border dark:border-slate-600 p-1 font-medium bg-green-50 dark:bg-green-900/30 text-[10px] text-green-700">रक्कम</th>
                      {/* Madhyam Metrics */}
                      <th className="border dark:border-slate-600 p-1 font-medium bg-blue-50 dark:bg-blue-900/30 text-[10px] text-blue-700">संख्या</th>
                      <th className="border dark:border-slate-600 p-1 font-medium bg-blue-50 dark:bg-blue-900/30 text-[10px] text-blue-700">रक्कम</th>
                    </React.Fragment>
                  ))}
                  {/* Total Overdue Interest Metrics */}
                  <th className="border dark:border-slate-600 p-1 font-medium bg-slate-50 dark:bg-slate-800 text-[10px]">संख्या</th>
                  <th className="border dark:border-slate-600 p-1 font-medium bg-slate-50 dark:bg-slate-800 text-[10px]">रक्कम</th>
                </tr>
              </thead>
              <tbody>
                {/* Row 1: Large Farmer Tribal */}
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="border dark:border-slate-600 p-2 text-center">{summaryData[0].id}</td>
                  <td className="border dark:border-slate-600 p-2 font-bold">{summaryData[0].category}</td>
                  {timePeriods.map(period => (
                    <React.Fragment key={`${summaryData[0].id}-${period.key}`}>
                      <td className="border dark:border-slate-600 p-2 text-center text-green-700 bg-green-50/30">{summaryData[0][`${period.key}_alp_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-700 bg-green-50/30">{(summaryData[0][`${period.key}_alp_amount`] || 0).toLocaleString()}</td>
                      <td className="border dark:border-slate-600 p-2 text-center text-blue-700 bg-blue-50/30">{summaryData[0][`${period.key}_madhyam_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-700 bg-blue-50/30">{(summaryData[0][`${period.key}_madhyam_amount`] || 0).toLocaleString()}</td>
                    </React.Fragment>
                  ))}
                  <td className="border dark:border-slate-600 p-2 text-center">{summaryData[0].overdueInterest_count || 0}</td>
                  <td className="border dark:border-slate-600 p-2 text-right font-mono">{(summaryData[0].overdueInterest_amount || 0).toLocaleString()}</td>
                </tr>
                {/* Row 2: Large Farmer Non-Tribal */}
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="border dark:border-slate-600 p-2 text-center">{summaryData[1].id}</td>
                  <td className="border dark:border-slate-600 p-2 font-bold">{summaryData[1].category}</td>
                  {timePeriods.map(period => (
                    <React.Fragment key={`${summaryData[1].id}-${period.key}`}>
                      <td className="border dark:border-slate-600 p-2 text-center text-green-700 bg-green-50/30">{summaryData[1][`${period.key}_alp_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-700 bg-green-50/30">{(summaryData[1][`${period.key}_alp_amount`] || 0).toLocaleString()}</td>
                      <td className="border dark:border-slate-600 p-2 text-center text-blue-700 bg-blue-50/30">{summaryData[1][`${period.key}_madhyam_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-700 bg-blue-50/30">{(summaryData[1][`${period.key}_madhyam_amount`] || 0).toLocaleString()}</td>
                    </React.Fragment>
                  ))}
                  <td className="border dark:border-slate-600 p-2 text-center">{summaryData[1].overdueInterest_count || 0}</td>
                  <td className="border dark:border-slate-600 p-2 text-right font-mono">{(summaryData[1].overdueInterest_amount || 0).toLocaleString()}</td>
                </tr>
                {/* Subtotal: Large Farmer */}
                <tr className="bg-amber-50 dark:bg-amber-900/20 font-bold">
                  <td className="border dark:border-slate-600 p-2 text-center"></td>
                  <td className="border dark:border-slate-600 p-2 text-amber-700 dark:text-amber-400">{largeFarmerTotal.category}</td>
                  {timePeriods.map(period => (
                    <React.Fragment key={`large-${period.key}`}>
                      <td className="border dark:border-slate-600 p-2 text-center text-amber-700 dark:text-amber-400">{largeFarmerTotal[`${period.key}_alp_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-amber-700 dark:text-amber-400">{(largeFarmerTotal[`${period.key}_alp_amount`] || 0).toLocaleString()}</td>
                      <td className="border dark:border-slate-600 p-2 text-center text-amber-800 dark:text-amber-300 bg-amber-100/30">{largeFarmerTotal[`${period.key}_madhyam_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-amber-800 dark:text-amber-300 bg-amber-100/30">{(largeFarmerTotal[`${period.key}_madhyam_amount`] || 0).toLocaleString()}</td>
                    </React.Fragment>
                  ))}
                  <td className="border dark:border-slate-600 p-2 text-center text-amber-700 dark:text-amber-400">{largeFarmerTotal.overdueInterest_count || 0}</td>
                  <td className="border dark:border-slate-600 p-2 text-right font-mono text-amber-700 dark:text-amber-400">{(largeFarmerTotal.overdueInterest_amount || 0).toLocaleString()}</td>
                </tr>
                {/* Row 3: Small Farmer Tribal */}
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="border dark:border-slate-600 p-2 text-center">{summaryData[2].id}</td>
                  <td className="border dark:border-slate-600 p-2 font-bold">{summaryData[2].category}</td>
                  {timePeriods.map(period => (
                    <React.Fragment key={`${summaryData[2].id}-${period.key}`}>
                      <td className="border dark:border-slate-600 p-2 text-center text-green-700 bg-green-50/30">{summaryData[2][`${period.key}_alp_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-700 bg-green-50/30">{(summaryData[2][`${period.key}_alp_amount`] || 0).toLocaleString()}</td>
                      <td className="border dark:border-slate-600 p-2 text-center text-blue-700 bg-blue-50/30">{summaryData[2][`${period.key}_madhyam_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-700 bg-blue-50/30">{(summaryData[2][`${period.key}_madhyam_amount`] || 0).toLocaleString()}</td>
                    </React.Fragment>
                  ))}
                  <td className="border dark:border-slate-600 p-2 text-center">{summaryData[2].overdueInterest_count || 0}</td>
                  <td className="border dark:border-slate-600 p-2 text-right font-mono">{(summaryData[2].overdueInterest_amount || 0).toLocaleString()}</td>
                </tr>
                {/* Row 4: Small Farmer Non-Tribal */}
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="border dark:border-slate-600 p-2 text-center">{summaryData[3].id}</td>
                  <td className="border dark:border-slate-600 p-2 font-bold">{summaryData[3].category}</td>
                  {timePeriods.map(period => (
                    <React.Fragment key={`${summaryData[3].id}-${period.key}`}>
                      <td className="border dark:border-slate-600 p-2 text-center text-green-700 bg-green-50/30">{summaryData[3][`${period.key}_alp_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-700 bg-green-50/30">{(summaryData[3][`${period.key}_alp_amount`] || 0).toLocaleString()}</td>
                      <td className="border dark:border-slate-600 p-2 text-center text-blue-700 bg-blue-50/30">{summaryData[3][`${period.key}_madhyam_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-700 bg-blue-50/30">{(summaryData[3][`${period.key}_madhyam_amount`] || 0).toLocaleString()}</td>
                    </React.Fragment>
                  ))}
                  <td className="border dark:border-slate-600 p-2 text-center">{summaryData[3].overdueInterest_count || 0}</td>
                  <td className="border dark:border-slate-600 p-2 text-right font-mono">{(summaryData[3].overdueInterest_amount || 0).toLocaleString()}</td>
                </tr>
                {/* Subtotal: Small Farmer */}
                <tr className="bg-amber-50 dark:bg-amber-900/20 font-bold">
                  <td className="border dark:border-slate-600 p-2 text-center"></td>
                  <td className="border dark:border-slate-600 p-2 text-amber-700 dark:text-amber-400">{smallFarmerTotal.category}</td>
                  {timePeriods.map(period => (
                    <React.Fragment key={`small-${period.key}`}>
                      <td className="border dark:border-slate-600 p-2 text-center text-amber-700 dark:text-amber-400">{smallFarmerTotal[`${period.key}_alp_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-amber-700 dark:text-amber-400">{(smallFarmerTotal[`${period.key}_alp_amount`] || 0).toLocaleString()}</td>
                      <td className="border dark:border-slate-600 p-2 text-center text-amber-800 dark:text-amber-300 bg-amber-100/30">{smallFarmerTotal[`${period.key}_madhyam_count`] || 0}</td>
                      <td className="border dark:border-slate-600 p-2 text-right font-mono text-amber-800 dark:text-amber-300 bg-amber-100/30">{(smallFarmerTotal[`${period.key}_madhyam_amount`] || 0).toLocaleString()}</td>
                    </React.Fragment>
                  ))}
                  <td className="border dark:border-slate-600 p-2 text-center text-amber-700 dark:text-amber-400">{smallFarmerTotal.overdueInterest_count || 0}</td>
                  <td className="border dark:border-slate-600 p-2 text-right font-mono text-amber-700 dark:text-amber-400">{(smallFarmerTotal.overdueInterest_amount || 0).toLocaleString()}</td>
                </tr>
                {/* Grand Total */}
                <tr className="bg-blue-600 text-white font-bold">
                  <td className="border border-blue-500 p-2 text-center"></td>
                  <td className="border border-blue-500 p-2">एकूण</td>
                  {timePeriods.map(period => (
                    <React.Fragment key={`grand-${period.key}`}>
                      <td className="border border-blue-500 p-2 text-center text-blue-900 bg-blue-100">{grandTotal[`${period.key}_alp_count`] || 0}</td>
                      <td className="border border-blue-500 p-2 text-right font-mono text-blue-900 bg-blue-100">{(grandTotal[`${period.key}_alp_amount`] || 0).toLocaleString()}</td>
                      <td className="border border-blue-500 p-2 text-center bg-blue-200 text-blue-900">{grandTotal[`${period.key}_madhyam_count`] || 0}</td>
                      <td className="border border-blue-500 p-2 text-right font-mono bg-blue-200 text-blue-900">{(grandTotal[`${period.key}_madhyam_amount`] || 0).toLocaleString()}</td>
                    </React.Fragment>
                  ))}
                  <td className="border border-blue-500 p-2 text-center">{grandTotal.overdueInterest_count || 0}</td>
                  <td className="border border-blue-500 p-2 text-right font-mono">{(grandTotal.overdueInterest_amount || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            {/* Summary Section - Inside scrollable container for mobile visibility */}
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900 border-t-4 border-blue-600">
              <h3 className="font-bold text-center mb-4 text-slate-700 dark:text-slate-300">सारांश (Summary)</h3>
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-200 dark:bg-slate-800">
                  <tr>
                    <th rowSpan={2} className="border dark:border-slate-600 p-2 font-bold">प्रकार</th>
                    <th colSpan={4} className="border dark:border-slate-600 p-2 font-bold text-center">एकूण कर्ज बाकी</th>
                    <th colSpan={4} className="border dark:border-slate-600 p-2 font-bold text-center">एकूण वरीत (Overdue)</th>
                  </tr>
                  <tr>
                    <th className="border dark:border-slate-600 p-1 font-medium bg-green-50 dark:bg-green-900/30 text-[10px] text-green-700">अल्प मुदत संख्या</th>
                    <th className="border dark:border-slate-600 p-1 font-medium bg-green-50 dark:bg-green-900/30 text-[10px] text-green-700">अल्प मुदत रक्कम</th>
                    <th className="border dark:border-slate-600 p-1 font-medium bg-blue-50 dark:bg-blue-900/30 text-[10px] text-blue-700">मध्यम मुदत संख्या</th>
                    <th className="border dark:border-slate-600 p-1 font-medium bg-blue-50 dark:bg-blue-900/30 text-[10px] text-blue-700">मध्यम मुदत रक्कम</th>
                    <th className="border dark:border-slate-600 p-1 font-medium bg-green-50 dark:bg-green-900/30 text-[10px] text-green-700">अल्प मुदत संख्या</th>
                    <th className="border dark:border-slate-600 p-1 font-medium bg-green-50 dark:bg-green-900/30 text-[10px] text-green-700">अल्प मुदत रक्कम</th>
                    <th className="border dark:border-slate-600 p-1 font-medium bg-blue-50 dark:bg-blue-900/30 text-[10px] text-blue-700">मध्यम मुदत संख्या</th>
                    <th className="border dark:border-slate-600 p-1 font-medium bg-blue-50 dark:bg-blue-900/30 text-[10px] text-blue-700">मध्यम मुदत रक्कम</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-100 dark:hover:bg-slate-700">
                    <td className="border dark:border-slate-600 p-2 font-bold">आदिवासी घटक</td>
                    {/* Total Outstanding */}
                    <td className="border dark:border-slate-600 p-2 text-center text-green-700 bg-green-50/30">{tribalTotal.total_alp_count || 0}</td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-700 bg-green-50/30">{(tribalTotal.total_alp_amount || 0).toLocaleString()}</td>
                    <td className="border dark:border-slate-600 p-2 text-center text-blue-700 bg-blue-50/30">{tribalTotal.total_madhyam_count || 0}</td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-700 bg-blue-50/30">{(tribalTotal.total_madhyam_amount || 0).toLocaleString()}</td>

                    {/* Total Overdue */}
                    <td className="border dark:border-slate-600 p-2 text-center text-green-700 font-bold bg-green-50/50">
                      {(tribalTotal['1yr_alp_count'] || 0) + (tribalTotal['2yr_alp_count'] || 0) + (tribalTotal['3yr_alp_count'] || 0) +
                        (tribalTotal['4yr_alp_count'] || 0) + (tribalTotal['5yr_alp_count'] || 0) + (tribalTotal['above5yr_alp_count'] || 0)}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-700 font-bold bg-green-50/50">
                      {((tribalTotal['1yr_alp_amount'] || 0) + (tribalTotal['2yr_alp_amount'] || 0) + (tribalTotal['3yr_alp_amount'] || 0) +
                        (tribalTotal['4yr_alp_amount'] || 0) + (tribalTotal['5yr_alp_amount'] || 0) + (tribalTotal['above5yr_alp_amount'] || 0)).toLocaleString()}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-center text-blue-700 font-bold bg-blue-50/50">
                      {(tribalTotal['1yr_madhyam_count'] || 0) + (tribalTotal['2yr_madhyam_count'] || 0) + (tribalTotal['3yr_madhyam_count'] || 0) +
                        (tribalTotal['4yr_madhyam_count'] || 0) + (tribalTotal['5yr_madhyam_count'] || 0) + (tribalTotal['above5yr_madhyam_count'] || 0)}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-700 font-bold bg-blue-50/50">
                      {((tribalTotal['1yr_madhyam_amount'] || 0) + (tribalTotal['2yr_madhyam_amount'] || 0) + (tribalTotal['3yr_madhyam_amount'] || 0) +
                        (tribalTotal['4yr_madhyam_amount'] || 0) + (tribalTotal['5yr_madhyam_amount'] || 0) + (tribalTotal['above5yr_madhyam_amount'] || 0)).toLocaleString()}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-100 dark:hover:bg-slate-700">
                    <td className="border dark:border-slate-600 p-2 font-bold">सर्व साधारण घटक</td>
                    {/* Total Outstanding */}
                    <td className="border dark:border-slate-600 p-2 text-center text-green-700 bg-green-50/30">{generalTotal.total_alp_count || 0}</td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-700 bg-green-50/30">{(generalTotal.total_alp_amount || 0).toLocaleString()}</td>
                    <td className="border dark:border-slate-600 p-2 text-center text-blue-700 bg-blue-50/30">{generalTotal.total_madhyam_count || 0}</td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-700 bg-blue-50/30">{(generalTotal.total_madhyam_amount || 0).toLocaleString()}</td>

                    {/* Total Overdue */}
                    <td className="border dark:border-slate-600 p-2 text-center text-green-700 font-bold bg-green-50/50">
                      {(generalTotal['1yr_alp_count'] || 0) + (generalTotal['2yr_alp_count'] || 0) + (generalTotal['3yr_alp_count'] || 0) +
                        (generalTotal['4yr_alp_count'] || 0) + (generalTotal['5yr_alp_count'] || 0) + (generalTotal['above5yr_alp_count'] || 0)}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-700 font-bold bg-green-50/50">
                      {((generalTotal['1yr_alp_amount'] || 0) + (generalTotal['2yr_alp_amount'] || 0) + (generalTotal['3yr_alp_amount'] || 0) +
                        (generalTotal['4yr_alp_amount'] || 0) + (generalTotal['5yr_alp_amount'] || 0) + (generalTotal['above5yr_alp_amount'] || 0)).toLocaleString()}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-center text-blue-700 font-bold bg-blue-50/50">
                      {(generalTotal['1yr_madhyam_count'] || 0) + (generalTotal['2yr_madhyam_count'] || 0) + (generalTotal['3yr_madhyam_count'] || 0) +
                        (generalTotal['4yr_madhyam_count'] || 0) + (generalTotal['5yr_madhyam_count'] || 0) + (generalTotal['above5yr_madhyam_count'] || 0)}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-700 font-bold bg-blue-50/50">
                      {((generalTotal['1yr_madhyam_amount'] || 0) + (generalTotal['2yr_madhyam_amount'] || 0) + (generalTotal['3yr_madhyam_amount'] || 0) +
                        (generalTotal['4yr_madhyam_amount'] || 0) + (generalTotal['5yr_madhyam_amount'] || 0) + (generalTotal['above5yr_madhyam_amount'] || 0)).toLocaleString()}
                    </td>
                  </tr>
                  <tr className="bg-blue-100 dark:bg-blue-900/30 font-bold">
                    <td className="border dark:border-slate-600 p-2">एकूण योगिदा</td>
                    {/* Total Outstanding */}
                    <td className="border dark:border-slate-600 p-2 text-center text-green-800">{grandTotal.total_alp_count || 0}</td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-800">{(grandTotal.total_alp_amount || 0).toLocaleString()}</td>
                    <td className="border dark:border-slate-600 p-2 text-center text-blue-800 bg-blue-200/50">{grandTotal.total_madhyam_count || 0}</td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-800 bg-blue-200/50">{(grandTotal.total_madhyam_amount || 0).toLocaleString()}</td>

                    {/* Total Overdue */}
                    <td className="border dark:border-slate-600 p-2 text-center text-green-800">
                      {(grandTotal['1yr_alp_count'] || 0) + (grandTotal['2yr_alp_count'] || 0) + (grandTotal['3yr_alp_count'] || 0) +
                        (grandTotal['4yr_alp_count'] || 0) + (grandTotal['5yr_alp_count'] || 0) + (grandTotal['above5yr_alp_count'] || 0)}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-green-800">
                      {((grandTotal['1yr_alp_amount'] || 0) + (grandTotal['2yr_alp_amount'] || 0) + (grandTotal['3yr_alp_amount'] || 0) +
                        (grandTotal['4yr_alp_amount'] || 0) + (grandTotal['5yr_alp_amount'] || 0) + (grandTotal['above5yr_alp_amount'] || 0)).toLocaleString()}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-center text-blue-800 bg-blue-200/50">
                      {(grandTotal['1yr_madhyam_count'] || 0) + (grandTotal['2yr_madhyam_count'] || 0) + (grandTotal['3yr_madhyam_count'] || 0) +
                        (grandTotal['4yr_madhyam_count'] || 0) + (grandTotal['5yr_madhyam_count'] || 0) + (grandTotal['above5yr_madhyam_count'] || 0)}
                    </td>
                    <td className="border dark:border-slate-600 p-2 text-right font-mono text-blue-800 bg-blue-200/50">
                      {((grandTotal['1yr_madhyam_amount'] || 0) + (grandTotal['2yr_madhyam_amount'] || 0) + (grandTotal['3yr_madhyam_amount'] || 0) +
                        (grandTotal['4yr_madhyam_amount'] || 0) + (grandTotal['5yr_madhyam_amount'] || 0) + (grandTotal['above5yr_madhyam_amount'] || 0)).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      );
    }

    if (activeSubTab === 'Loan Recovery Analysis') {
      const fyStart = new Date(activeStart);
      const fyEnd = new Date(activeEnd);
      const startYear = fyStart.getFullYear();

      const monthsConfig = [
        { name: 'एप्रिल (April)', monthIndex: 3 }, // April is 3 (0-indexed)
        { name: 'मे (May)', monthIndex: 4 },
        { name: 'जून (June)', monthIndex: 5 },
        { name: 'जुलै (July)', monthIndex: 6 },
        { name: 'ऑगस्ट (August)', monthIndex: 7 },
        { name: 'सप्टेंबर (September)', monthIndex: 8 },
        { name: 'ऑक्टोबर (October)', monthIndex: 9 },
        { name: 'नोव्हेंबर (November)', monthIndex: 10 },
        { name: 'डिसेंबर (December)', monthIndex: 11 },
        { name: 'जानेवारी (January)', monthIndex: 0 },
        { name: 'फेब्रुवारी (February)', monthIndex: 1 },
        { name: 'मार्च (March)', monthIndex: 2 }
      ];

      const analysisData = monthsConfig.map((mConfig, index) => {
        const year = mConfig.monthIndex >= 3 ? startYear : startYear + 1;
        
        // Month boundary dates
        const monthStart = new Date(year, mConfig.monthIndex, 1);
        const monthEnd = new Date(year, mConfig.monthIndex + 1, 0); // Last day of month

        // Find all Debit transactions of type Loan (Disbursements) during this specific month & year
        const monthTxnDisb = transactions.filter(t => {
          if (t.type !== 'Debit' || t.accountType !== 'Loan') return false;
          const d = new Date(t.date);
          return d >= monthStart && d <= monthEnd;
        });

        const monthTxnMemberIds = new Set(monthTxnDisb.map(t => t.memberId).filter(Boolean));

        // Find all legacy/imported disbursements during this specific month & year
        const monthLegacyDisb = members.filter(m => {
          if (!m.originalLoanDate) return false;
          const d = new Date(m.originalLoanDate);
          const isDateInMonth = d >= monthStart && d <= monthEnd;
          return isDateInMonth && (m.loanPrincipal || 0) > 0 && !monthTxnMemberIds.has(m.id);
        }).map(m => ({
          memberId: m.id,
          amount: m.loanPrincipal,
          date: m.originalLoanDate
        }));

        const monthDisbTxns = [...monthTxnDisb, ...monthLegacyDisb];

        const disbAmount = monthDisbTxns.reduce((sum, t) => sum + t.amount, 0);
        const uniqueMembers = new Set(monthDisbTxns.map(t => t.memberId).filter(Boolean));
        const memberCount = uniqueMembers.size;

        let totalRepayment = 0;
        let totalInterest = 0;
        let totalWaiver = 0;

        monthDisbTxns.forEach(disb => {
          if (!disb.memberId) return;

          // Find subsequent loan disbursement date for this member (if any) to prevent matching future loan repayments
          const subsequentDisb = transactions.filter(t => 
            t.memberId === disb.memberId &&
            t.type === 'Debit' &&
            t.accountType === 'Loan' &&
            t.date > disb.date
          ).sort((a, b) => a.date.localeCompare(b.date))[0];

          const limitDate = subsequentDisb ? new Date(subsequentDisb.date) : new Date('9999-12-31');

          // Find all repayments (Credits) made on or after this disbursement date and before subsequent loan disbursement
          const repayments = transactions.filter(t => 
            t.memberId === disb.memberId &&
            t.type === 'Credit' &&
            t.accountType === 'Loan' &&
            t.date >= disb.date &&
            new Date(t.date) < limitDate
          );

          // Separate regular payments from government waivers
          const regularRepayments = repayments.filter(t => !t.isGovtWaiver);
          const waiverRepayments = repayments.filter(t => t.isGovtWaiver);

          const prinPaid = regularRepayments.reduce((sum, t) =>
            sum + (t.principalPaid !== undefined ? t.principalPaid : Math.max(0, t.amount - (t.interestPaid || 0))), 0
          );
          const intPaid = regularRepayments.reduce((sum, t) => sum + (t.interestPaid || 0), 0);
          const waivedAmt = waiverRepayments.reduce((sum, t) => sum + (t.waivedAmount || t.amount), 0);

          totalRepayment += prinPaid;
          totalInterest += intPaid;
          totalWaiver += waivedAmt;
        });

        const balance = Math.max(0, disbAmount - totalRepayment - totalWaiver);
        const recoveryPercentage = disbAmount > 0 ? ((totalRepayment + totalWaiver) / disbAmount) * 100 : 0;

        return {
          id: index + 1,
          monthName: mConfig.name,
          memberCount,
          disbAmount,
          repayment: totalRepayment,
          interest: totalInterest,
          waiver: totalWaiver,
          balance,
          recoveryPercentage
        };
      });

      const analysisColumns: Column<any>[] = [
        { header: 'अ. क्र.', accessorKey: 'id', width: '50px' },
        { header: 'महिना (Month)', accessorKey: 'monthName', className: 'font-bold' },
        { header: 'सभासद संख्या', accessorKey: 'memberCount', className: 'text-center', render: (i) => i.memberCount || '-' },
        { header: 'कर्ज वाटप (₹)', accessorKey: 'disbAmount', render: (i) => i.disbAmount > 0 ? i.disbAmount.toLocaleString() : '-' },
        { header: 'मुद्दल वसुली (₹)', accessorKey: 'repayment', render: (i) => i.repayment > 0 ? i.repayment.toLocaleString() : '-' },
        { header: 'व्याज वसुली (₹)', accessorKey: 'interest', render: (i) => i.interest > 0 ? i.interest.toLocaleString() : '-' },
        { header: 'शासकीय कर्जमाफी (₹)', accessorKey: 'waiver', render: (i) => i.waiver > 0 ? i.waiver.toLocaleString() : '-' },
        { header: 'आजअखेर शिल्लक (₹)', accessorKey: 'balance', render: (i) => i.balance > 0 ? i.balance.toLocaleString() : '-' },
        { header: 'वसुली %', accessorKey: 'recoveryPercentage', render: (i) => `${i.recoveryPercentage.toFixed(2)}%` }
      ];

      return (
        <div className="flex flex-col gap-4 h-full w-full max-w-full min-w-0">
          {renderFYSelector()}
          <ReportTable
            title={`मासिक कर्ज वाटप व वसुली विश्लेषण अहवाल (FY)`}
            columns={analysisColumns}
            data={analysisData}
            enableDateFilter={false}
            enableSearch={false}
          />
        </div>
      );
    }




    return <ReportTable title={`${activeSubTab} Report`} columns={columns} data={displayData} onRowClick={(item) => handleMemberClick(item.id)} />;
  };

  const renderMembership = () => {
    if (activeSubTab === 'Shares Capital') {
      const getSharesForMember = (m: any) => {
        if (sharesPeriod === 'today') {
          return m.shareBalance || 0;
        }
        const fyStart = settings.financialYearStart || '2026-04-01';
        const fyYear = new Date(fyStart).getFullYear();
        const cutoffDate = sharesPeriod === 'current_fy' ? `${fyYear + 1}-03-31` : `${fyYear}-03-31`;
        
        if (m.membershipDate && m.membershipDate > cutoffDate) {
          return 0;
        }
        
        let balance = m.shareBalance || 0;
        const txnsAfter = transactions.filter(t => 
          t.memberId === m.id && 
          t.accountType === 'Shares' && 
          t.date > cutoffDate
        );
        txnsAfter.forEach(t => {
          if (t.type === 'Credit') balance -= t.amount;
          else if (t.type === 'Debit') balance += t.amount;
        });
        return balance;
      };

      // Filter members who have shares > 0 and apply quick/custom filters, and sort numerically by memberNo
      const sharesMembers = members
        .map(m => ({
          ...m,
          tempShareBalance: getSharesForMember(m)
        }))
        .filter(m => m.tempShareBalance > 0)
        .filter(m => {
          const balance = m.tempShareBalance;
          
          if (sharesQuickFilter !== 'all') {
            if (sharesQuickFilter === '10') return balance === 10;
            if (sharesQuickFilter === '17') return balance === 17;
            if (sharesQuickFilter === '120') return balance === 120;
            if (sharesQuickFilter === '199') return balance === 199;
            if (sharesQuickFilter === '200') return balance === 200;
            if (sharesQuickFilter === '300') return balance === 300;
            if (sharesQuickFilter === '500') return balance === 500;
            if (sharesQuickFilter === '517') return balance === 517;
            if (sharesQuickFilter === '1000') return balance === 1000;
            if (sharesQuickFilter === 'above200') return balance > 200;
            if (sharesQuickFilter === 'above500') return balance > 500;
            if (sharesQuickFilter === 'above1000') return balance > 1000;
          }
          
          if (sharesMinAmount !== '' && balance < sharesMinAmount) return false;
          if (sharesMaxAmount !== '' && balance > sharesMaxAmount) return false;
          
          return true;
        })
        .sort((a, b) => {
          const numA = parseInt(a.memberNo.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.memberNo.replace(/\D/g, '')) || 0;
          if (numA !== numB) return numA - numB;
          return a.memberNo.localeCompare(b.memberNo);
        });

      const halfLength = Math.ceil(sharesMembers.length / 2);
      const leftHalf = sharesMembers.slice(0, halfLength);
      const rightHalf = sharesMembers.slice(halfLength);

      const leftTotal = leftHalf.reduce((sum, m) => sum + m.tempShareBalance, 0);
      const rightTotal = rightHalf.reduce((sum, m) => sum + m.tempShareBalance, 0);

      const handleSharesCapitalExport = () => {
        const ws: any = {};
        const merges: any[] = [];

        // Styles
        const titleStyle = { font: { name: 'Calibri', sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const subtitleStyleLeft = { font: { name: 'Calibri', sz: 11, bold: true }, alignment: { horizontal: 'left', vertical: 'center' } };
        const subtitleStyleRight = { font: { name: 'Calibri', sz: 11, bold: true }, alignment: { horizontal: 'right', vertical: 'center' } };
        const headerStyle = { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: 'E2E8F0' } }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
        const cellCenter = { font: { name: 'Calibri', sz: 9 }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'D3D3D3' } }, bottom: { style: 'thin', color: { rgb: 'D3D3D3' } }, left: { style: 'thin', color: { rgb: 'D3D3D3' } }, right: { style: 'thin', color: { rgb: 'D3D3D3' } } } };
        const cellLeft = { font: { name: 'Calibri', sz: 9 }, alignment: { horizontal: 'left', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'D3D3D3' } }, bottom: { style: 'thin', color: { rgb: 'D3D3D3' } }, left: { style: 'thin', color: { rgb: 'D3D3D3' } }, right: { style: 'thin', color: { rgb: 'D3D3D3' } } } };
        const cellRight = { font: { name: 'Calibri', sz: 9 }, alignment: { horizontal: 'right', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'D3D3D3' } }, bottom: { style: 'thin', color: { rgb: 'D3D3D3' } }, left: { style: 'thin', color: { rgb: 'D3D3D3' } }, right: { style: 'thin', color: { rgb: 'D3D3D3' } } } };
        const totalStyle = { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'right', vertical: 'center' }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'double', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
        const totalLabelStyle = { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'double', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };

        const setCell = (r: number, c: number, val: any, style: any = {}, z: string | null = null) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r, c });
          ws[cellRef] = { v: val, t: typeof val === 'number' ? 'n' : 's', s: style };
          if (z) ws[cellRef].z = z;
        };

        // Header Title (A1:N1 merged)
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } });
        setCell(0, 0, "आदिवासी विविध कार्यकारी सहकारी संस्था मयो. ईळदा र. नं. १४२५ विकास खंड- अर्जुनी/मोरगांव", titleStyle);
        for(let c=1; c<14; c++) setCell(0, c, "");

        // Subtitles (Row 2)
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } });
        let periodTitle = "हिस्से यादी";
        if (sharesPeriod === 'today') periodTitle = "हिस्से यादी (आज अखेर)";
        else if (sharesPeriod === 'current_fy') periodTitle = "हिस्से यादी (चालू आर्थिक वर्ष)";
        else periodTitle = "हिस्से यादी (मागील आर्थिक वर्ष)";
        setCell(1, 0, periodTitle, subtitleStyleLeft);
        for(let c=1; c<=6; c++) setCell(1, c, "");

        merges.push({ s: { r: 1, c: 7 }, e: { r: 1, c: 13 } });
        const curYear = new Date(activeEnd).getFullYear();
        setCell(1, 7, `सन:- ${curYear - 1}-${String(curYear).slice(2)}`, subtitleStyleRight);
        for(let c=8; c<14; c++) setCell(1, c, "");

        // Table Headers (Row 3)
        const leftHeaders = ["अ. क्र.", "सभासदाचे नाव", "गाव", "Gender", "Cast", "सभासद क्रमांक", "हिस्से रक्कम"];
        const rightHeaders = ["अ. क्र.", "सभासदाचे नाव", "गाव", "Gender", "Cast", "सभासद क्रमांक", "हिस्से रक्कम"];

        leftHeaders.forEach((h, c) => setCell(2, c, h, headerStyle));
        rightHeaders.forEach((h, c) => setCell(2, c + 7, h, headerStyle));

        // Data Rows
        for (let i = 0; i < halfLength; i++) {
          const r = 3 + i;
          const leftItem = leftHalf[i];
          const rightItem = rightHalf[i];

          // Left Half
          if (leftItem) {
            setCell(r, 0, i + 1, cellCenter);
            setCell(r, 1, leftItem.name, cellLeft);
            setCell(r, 2, leftItem.village, cellLeft);
            setCell(r, 3, leftItem.gender, cellCenter);
            setCell(r, 4, leftItem.category || 'GEN', cellCenter);
            setCell(r, 5, leftItem.memberNo, cellCenter);
            setCell(r, 6, leftItem.tempShareBalance || 0, cellRight, '#,##,##0');
          } else {
            for(let c=0; c<7; c++) setCell(r, c, "", cellCenter);
          }

          // Right Half
          if (rightItem) {
            setCell(r, 7, halfLength + i + 1, cellCenter);
            setCell(r, 8, rightItem.name, cellLeft);
            setCell(r, 9, rightItem.village, cellLeft);
            setCell(r, 10, rightItem.gender, cellCenter);
            setCell(r, 11, rightItem.category || 'GEN', cellCenter);
            setCell(r, 12, rightItem.memberNo, cellCenter);
            setCell(r, 13, rightItem.tempShareBalance || 0, cellRight, '#,##,##0');
          } else {
            for(let c=7; c<14; c++) setCell(r, c, "", cellCenter);
          }
        }

        // Totals Row
        const totalRowIdx = 3 + halfLength;
        for(let c=0; c<6; c++) setCell(totalRowIdx, c, "", totalLabelStyle);
        setCell(totalRowIdx, 6, leftTotal, totalStyle, '#,##,##0');

        for(let c=7; c<13; c++) setCell(totalRowIdx, c, "", totalLabelStyle);
        setCell(totalRowIdx, 13, rightTotal, totalStyle, '#,##,##0');

        ws['!merges'] = merges;
        ws['!cols'] = [
          { wch: 6 },  { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, // Left half
          { wch: 6 },  { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }  // Right half
        ];
        ws['!ref'] = `A1:N${totalRowIdx + 1}`;

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "Shares List");

        const excelBuffer = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Shares_Capital_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      };

      return (
        <div className="flex flex-col gap-4 h-full w-full max-w-full min-w-0">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in duration-300">
            {/* Header section with print/export */}
            <div className="bg-blue-900 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left">
                <h2 className="text-xl font-bold">हिस्से यादी (Shares Capital List)</h2>
                <p className="text-xs opacity-80 mt-1">आदिवासी विविध कार्यकारी सहकारी संस्था मयो. ईळदा र. नं. १४२५</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSharesCapitalExport}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
                >
                  <Download size={16} /> Export Excel
                </button>
              </div>
            </div>

            {/* Filter Section */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">कालावधी (Period):</label>
                  <select 
                    value={sharesPeriod} 
                    onChange={(e) => setSharesPeriod(e.target.value as any)}
                    className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold"
                  >
                    <option value="today">आज अखेर (As of Today)</option>
                    <option value="current_fy">चालू आर्थिक वर्ष (Current FY)</option>
                    <option value="previous_fy">मागील आर्थिक वर्ष (Previous FY)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">जलद हिस्से फिल्टर (Quick Filter):</label>
                  <select 
                    value={sharesQuickFilter} 
                    onChange={(e) => {
                      setSharesQuickFilter(e.target.value);
                      if (e.target.value !== 'all') {
                        setSharesMinAmount('');
                        setSharesMaxAmount('');
                      }
                    }}
                    className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">सर्व (All)</option>
                    <option value="10">फक्त १० रु.</option>
                    <option value="17">फक्त १७ रु.</option>
                    <option value="120">फक्त १२० रु.</option>
                    <option value="199">फक्त १९९ रु.</option>
                    <option value="200">फक्त २०० रु.</option>
                    <option value="300">फक्त ३०० रु.</option>
                    <option value="500">फक्त ५०० रु.</option>
                    <option value="517">फक्त ५१७ रु.</option>
                    <option value="1000">फक्त १००० रु.</option>
                    <option value="above200">२०० पेक्षा जास्त (&gt; 200)</option>
                    <option value="above500">५०० पेक्षा जास्त (&gt; 500)</option>
                    <option value="above1000">१००० पेक्षा जास्त (&gt; 1000)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">किमान हिस्से (Min):</label>
                    <input 
                      type="number"
                      value={sharesMinAmount}
                      placeholder="उदा. २००"
                      disabled={sharesQuickFilter !== 'all'}
                      onChange={(e) => setSharesMinAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="p-2 w-28 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">कमाल हिस्से (Max):</label>
                    <input 
                      type="number"
                      value={sharesMaxAmount}
                      placeholder="उदा. ५००"
                      disabled={sharesQuickFilter !== 'all'}
                      onChange={(e) => setSharesMaxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="p-2 w-28 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSharesQuickFilter('all');
                    setSharesMinAmount('');
                    setSharesMaxAmount('');
                    setSharesPeriod('today');
                  }}
                  className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold self-end transition-all"
                >
                  फिल्टर रिसेट
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between text-xs border-b border-slate-200 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-400">
              <span>एकूण हिस्सेदार: {sharesMembers.length}</span>
              <span>एकूण हिस्से रक्कम: ₹{(leftTotal + rightTotal).toLocaleString()}</span>
            </div>

            {/* Split Tables Container */}
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                
                {/* Left Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200">
                      <tr>
                        <th className="p-2 border-b text-center w-12">अ. क्र.</th>
                        <th className="p-2 border-b">सभासदाचे नाव</th>
                        <th className="p-2 border-b">गाव</th>
                        <th className="p-2 border-b text-center">Gender</th>
                        <th className="p-2 border-b text-center">Cast</th>
                        <th className="p-2 border-b text-center">क्रमांक</th>
                        <th className="p-2 border-b text-right">हिस्से रक्कम</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leftHalf.map((m, idx) => (
                        <tr 
                          key={m.id} 
                          onClick={() => handleMemberClick(m.id)}
                          className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50 cursor-pointer border-b dark:border-slate-700"
                        >
                          <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                          <td className="p-2 font-bold text-blue-600 dark:text-blue-400 hover:underline">{m.name}</td>
                          <td className="p-2 text-slate-600 dark:text-slate-400">{m.village}</td>
                          <td className="p-2 text-center text-slate-500">{m.gender}</td>
                          <td className="p-2 text-center text-slate-500">{m.category || 'GEN'}</td>
                          <td className="p-2 text-center text-slate-600 dark:text-slate-300 font-mono font-bold">{m.memberNo}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">₹{m.tempShareBalance.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 dark:bg-slate-700 font-bold text-slate-800 dark:text-white border-t-2">
                        <td colSpan={6} className="p-2 text-center">एकूण हिस्से रक्कम (डावी बाजू)</td>
                        <td className="p-2 text-right font-mono text-lg text-emerald-600 dark:text-emerald-400">₹{leftTotal.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Right Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200">
                      <tr>
                        <th className="p-2 border-b text-center w-12">अ. क्र.</th>
                        <th className="p-2 border-b">सभासदाचे नाव</th>
                        <th className="p-2 border-b">गाव</th>
                        <th className="p-2 border-b text-center">Gender</th>
                        <th className="p-2 border-b text-center">Cast</th>
                        <th className="p-2 border-b text-center">क्रमांक</th>
                        <th className="p-2 border-b text-right">हिस्से रक्कम</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rightHalf.map((m, idx) => (
                        <tr 
                          key={m.id} 
                          onClick={() => handleMemberClick(m.id)}
                          className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50 cursor-pointer border-b dark:border-slate-700"
                        >
                          <td className="p-2 text-center text-slate-500">{halfLength + idx + 1}</td>
                          <td className="p-2 font-bold text-blue-600 dark:text-blue-400 hover:underline">{m.name}</td>
                          <td className="p-2 text-slate-600 dark:text-slate-400">{m.village}</td>
                          <td className="p-2 text-center text-slate-500">{m.gender}</td>
                          <td className="p-2 text-center text-slate-500">{m.category || 'GEN'}</td>
                          <td className="p-2 text-center text-slate-600 dark:text-slate-300 font-mono font-bold">{m.memberNo}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">₹{m.tempShareBalance.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 dark:bg-slate-700 font-bold text-slate-800 dark:text-white border-t-2">
                        <td colSpan={6} className="p-2 text-center">एकूण हिस्से रक्कम (उजवी बाजू)</td>
                        <td className="p-2 text-right font-mono text-lg text-emerald-600 dark:text-emerald-400">₹{rightTotal.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

          </div>
        </div>
      );
    }

    if (activeSubTab === 'Shares Summary') {
      const gendersList = ['Male', 'Female', 'Other'];
      const categoriesList = ['OPEN', 'SC', 'ST', 'OBC', 'NT'];

      const getCategoryLabelMr = (cat: string) => {
        if (cat === 'OPEN') return 'Gen';
        return cat;
      };

      const getGenderLabelMr = (gender: string) => {
        if (gender === 'Male') return 'Male';
        if (gender === 'Female') return 'Female';
        return 'Transg';
      };

      // Calculate counts and amounts
      const matrix: Record<string, Record<string, { count: number; amount: number }>> = {};
      gendersList.forEach(g => {
        matrix[g] = {};
        categoriesList.forEach(c => {
          matrix[g][c] = { count: 0, amount: 0 };
        });
      });

      members.forEach(m => {
        const g = gendersList.includes(m.gender) ? m.gender : 'Other';
        const c = categoriesList.includes(m.category) ? m.category : 'OPEN';
        if (matrix[g] && matrix[g][c]) {
          matrix[g][c].count += 1;
          matrix[g][c].amount += (m.shareBalance || 0);
        }
      });

      const genderTotals: Record<string, { count: number; amount: number }> = {};
      gendersList.forEach(g => {
        let totalCount = 0;
        let totalAmount = 0;
        categoriesList.forEach(c => {
          totalCount += matrix[g][c].count;
          totalAmount += matrix[g][c].amount;
        });
        genderTotals[g] = { count: totalCount, amount: totalAmount };
      });

      const categoryTotals: Record<string, { count: number; amount: number }> = {};
      categoriesList.forEach(c => {
        let totalCount = 0;
        let totalAmount = 0;
        gendersList.forEach(g => {
          totalCount += matrix[g][c].count;
          totalAmount += matrix[g][c].amount;
        });
        categoryTotals[c] = { count: totalCount, amount: totalAmount };
      });

      const grandTotalCount = gendersList.reduce((sum, g) => sum + genderTotals[g].count, 0);
      const grandTotalAmount = gendersList.reduce((sum, g) => sum + genderTotals[g].amount, 0);

      // Bottom distribution statistics
      const sharesCount = (cond: (val: number) => boolean) => {
        return members.filter(m => cond(m.shareBalance || 0)).length;
      };

      const distUnder10 = sharesCount(v => v > 0 && v <= 1000);
      const distUnder100 = sharesCount(v => v > 0 && v <= 10000);
      const distAbove100 = sharesCount(v => v > 10000);
      const distUnder20000 = sharesCount(v => v > 0 && v <= 20000);
      const distAbove20000 = sharesCount(v => v > 20000);

      const handleSharesSummaryExport = () => {
        const ws: any = {};
        const merges: any[] = [];

        // Styles
        const titleStyle = { font: { name: 'Calibri', sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const headerStyle = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: 'E2E8F0' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };
        const cellCenter = {
          font: { name: 'Calibri', sz: 9 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
            left: { style: 'thin', color: { rgb: 'D3D3D3' } },
            right: { style: 'thin', color: { rgb: 'D3D3D3' } }
          }
        };
        const cellRight = {
          font: { name: 'Calibri', sz: 9 },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
            left: { style: 'thin', color: { rgb: 'D3D3D3' } },
            right: { style: 'thin', color: { rgb: 'D3D3D3' } }
          }
        };
        const totalStyle = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };
        const totalStyleRight = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'right', vertical: 'center' },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        ws['A2'] = { v: "Number of member of the co-operetive society", t: 's', s: titleStyle };
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 13 } });

        ws['A3'] = { v: "संस्थेचे एकुण सभासद त्यांचे हिस्से रक्कम", t: 's', s: titleStyle };
        merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 13 } });

        const headers1 = [
          "S. n.", "Gender", "Gen", "", "SC", "", "ST", "", "OBC", "", "NT", "", "Total Member", "Total Amount"
        ];
        headers1.forEach((val, colIdx) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r: 4, c: colIdx });
          ws[cellRef] = { v: val, t: 's', s: headerStyle };
        });

        const headers2 = [
          "", "", "Member", "Amount", "Member", "Amount", "Member", "Amount", "Member", "Amount", "Member", "Amount", "", ""
        ];
        headers2.forEach((val, colIdx) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r: 5, c: colIdx });
          ws[cellRef] = { v: val, t: 's', s: headerStyle };
        });

        merges.push({ s: { r: 4, c: 0 }, e: { r: 5, c: 0 } });
        merges.push({ s: { r: 4, c: 1 }, e: { r: 5, c: 1 } });
        merges.push({ s: { r: 4, c: 2 }, e: { r: 4, c: 3 } });
        merges.push({ s: { r: 4, c: 4 }, e: { r: 4, c: 5 } });
        merges.push({ s: { r: 4, c: 6 }, e: { r: 4, c: 7 } });
        merges.push({ s: { r: 4, c: 8 }, e: { r: 4, c: 9 } });
        merges.push({ s: { r: 4, c: 10 }, e: { r: 4, c: 11 } });
        merges.push({ s: { r: 4, c: 12 }, e: { r: 5, c: 12 } });
        merges.push({ s: { r: 4, c: 13 }, e: { r: 5, c: 13 } });

        let rowIdx = 6;
        gendersList.forEach((gender, idx) => {
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: idx + 1, t: 'n', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 1 })] = { v: getGenderLabelMr(gender), t: 's', s: cellCenter };

          let colC = 2;
          categoriesList.forEach(cat => {
            const data = matrix[gender][cat];
            ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: colC })] = { v: data.count, t: 'n', s: cellCenter };
            ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: colC + 1 })] = { v: data.amount, t: 'n', s: cellRight };
            colC += 2;
          });

          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 12 })] = { v: genderTotals[gender].count, t: 'n', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 13 })] = { v: genderTotals[gender].amount, t: 'n', s: cellRight };
          rowIdx++;
        });

        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: "", t: 's', s: totalStyle };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 1 })] = { v: "Total", t: 's', s: totalStyle };

        let colTotalIdx = 2;
        categoriesList.forEach(cat => {
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: colTotalIdx })] = { v: categoryTotals[cat].count, t: 'n', s: totalStyle };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: colTotalIdx + 1 })] = { v: "", t: 's', s: totalStyle };
          colTotalIdx += 2;
        });
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 12 })] = { v: grandTotalCount, t: 'n', s: totalStyle };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 13 })] = { v: grandTotalAmount, t: 'n', s: totalStyleRight };

        rowIdx += 3;

        const distHeaders = ["Under 10", "Under 100", "Above 100", "Under 20000", "Above 20000"];
        distHeaders.forEach((val, colIdx) => {
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: colIdx + 1 })] = { v: val, t: 's', s: headerStyle };
        });
        const distValues = [distUnder10, distUnder100, distAbove100, distUnder20000, distAbove20000];
        distValues.forEach((val, colIdx) => {
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx + 1, c: colIdx + 1 })] = { v: val, t: 'n', s: cellCenter };
        });

        ws['!merges'] = merges;
        ws['!ref'] = `A1:N${rowIdx + 3}`;
        ws['!cols'] = [
          { wch: 6 },  { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
          { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
          { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }
        ];

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "Shares Summary");
        const excelBuffer = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Shares_Capital_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      };

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-600 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-center md:text-left">संस्थेचे एकूण सभासद व त्यांचे हिस्से रक्कम गोषवारा</h2>
              <p className="text-sm text-center md:text-left opacity-80 mt-1">Number of member of the co-operative society & Share Capital Summary</p>
            </div>
            <button
              onClick={handleSharesSummaryExport}
              className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
            >
              <Download size={16} /> Export Excel
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 mb-6">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 text-center">
                    <th className="p-3 border-r dark:border-slate-600" rowSpan={2}>S. n.</th>
                    <th className="p-3 border-r dark:border-slate-600" rowSpan={2}>Gender</th>
                    <th className="p-3 border-r dark:border-slate-600" colSpan={2}>Gen</th>
                    <th className="p-3 border-r dark:border-slate-600" colSpan={2}>SC</th>
                    <th className="p-3 border-r dark:border-slate-600" colSpan={2}>ST</th>
                    <th className="p-3 border-r dark:border-slate-600" colSpan={2}>OBC</th>
                    <th className="p-3 border-r dark:border-slate-600" colSpan={2}>NT</th>
                    <th className="p-3 border-r dark:border-slate-600" rowSpan={2}>Total Member</th>
                    <th className="p-3" rowSpan={2}>Total Amount</th>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-center">
                    <th className="p-2 border-r dark:border-slate-600">Member</th>
                    <th className="p-2 border-r dark:border-slate-600">Amount</th>
                    <th className="p-2 border-r dark:border-slate-600">Member</th>
                    <th className="p-2 border-r dark:border-slate-600">Amount</th>
                    <th className="p-2 border-r dark:border-slate-600">Member</th>
                    <th className="p-2 border-r dark:border-slate-600">Amount</th>
                    <th className="p-2 border-r dark:border-slate-600">Member</th>
                    <th className="p-2 border-r dark:border-slate-600">Amount</th>
                    <th className="p-2 border-r dark:border-slate-600">Member</th>
                    <th className="p-2 border-r dark:border-slate-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {gendersList.map((gender, idx) => (
                    <tr key={gender} className="border-b dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 text-center">
                      <td className="p-2 border-r dark:border-slate-600 text-slate-500">{idx + 1}</td>
                      <td className="p-2 border-r dark:border-slate-600 font-bold">{getGenderLabelMr(gender)}</td>
                      {categoriesList.map(cat => {
                        const data = matrix[gender][cat];
                        return (
                          <React.Fragment key={cat}>
                            <td className="p-2 border-r dark:border-slate-600 font-mono">{data.count}</td>
                            <td className="p-2 border-r dark:border-slate-600 text-right font-mono">₹{data.amount.toLocaleString()}</td>
                          </React.Fragment>
                        );
                      })}
                      <td className="p-2 border-r dark:border-slate-600 font-bold font-mono text-blue-600 dark:text-blue-400">{genderTotals[gender].count}</td>
                      <td className="p-2 text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">₹{genderTotals[gender].amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 dark:bg-slate-700 font-bold text-slate-800 dark:text-white text-center border-t-2">
                    <td className="p-2 border-r dark:border-slate-600" colSpan={2}>Total</td>
                    {categoriesList.map(cat => (
                      <React.Fragment key={cat}>
                        <td className="p-2 border-r dark:border-slate-600 font-mono">{categoryTotals[cat].count}</td>
                        <td className="p-2 border-r dark:border-slate-600 font-mono">-</td>
                      </React.Fragment>
                    ))}
                    <td className="p-2 border-r dark:border-slate-600 font-bold font-mono text-blue-800 dark:text-blue-200">{grandTotalCount}</td>
                    <td className="p-2 text-right font-bold font-mono text-emerald-700 dark:text-emerald-300">₹{grandTotalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Distribution stats */}
            <div className="grid grid-cols-5 gap-4 mt-6">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Under 10</div>
                <div className="text-xl font-bold font-mono">{distUnder10}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Under 100</div>
                <div className="text-xl font-bold font-mono">{distUnder100}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Above 100</div>
                <div className="text-xl font-bold font-mono">{distAbove100}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Under 20000</div>
                <div className="text-xl font-bold font-mono">{distUnder20000}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Above 20000</div>
                <div className="text-xl font-bold font-mono">{distAbove20000}</div>
              </div>
            </div>

          </div>
        </div>
      );
    }

    if (activeSubTab === 'Caste Summary') {
      // Summary Table using real data aggregation
      const summaryMap = memberReportData.reduce((acc, curr) => {
        const cat = curr.category || 'Unknown';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const summaryData = Object.entries(summaryMap).map(([cat, count], idx) => ({
        id: idx + 1,
        category: cat,
        count: count as number
      }));

      // Add total row
      const totalCount = summaryData.reduce((sum, item) => sum + item.count, 0);
      summaryData.push({
        id: 0,
        category: 'एकूण (Total)',
        count: totalCount
      });

      const columns = [
        { header: 'Category', accessorKey: 'category' },
        { header: 'Count', accessorKey: 'count' },
      ];
      return <ReportTable title="Caste Summary" columns={columns} data={summaryData} enableSearch={false} />;
    }

    // --- NEW: Gender Summary Report ---
    if (activeSubTab === 'Gender Summary') {
      const genderMap = members.reduce((acc, curr) => {
        const gender = curr.gender || 'Unknown';
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const total = members.length;
      const summaryData = Object.entries(genderMap).map(([gender, count], idx) => ({
        id: idx + 1,
        gender: gender === 'Male' ? 'पुरुष (Male)' : gender === 'Female' ? 'महिला (Female)' : gender,
        count: count as number,
        percentage: total > 0 ? (((count as number) / total) * 100).toFixed(1) + '%' : '0%'
      }));

      // Add total row
      summaryData.push({
        id: 0,
        gender: 'एकूण (Total)',
        count: total,
        percentage: '100%'
      });

      const handleExportGenderSummary = async () => {
        const headers = ['लिंग (Gender)', 'संख्या (Count)', 'टक्केवारी (%)'];
        const rows = summaryData.map(item => [
          item.gender,
          item.count,
          item.percentage
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gender Summary");
        XLSX.writeFile(wb, `Gender_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

        await showConfirm({
          title: 'Export Successful!',
          titleMr: 'एक्सपोर्ट यशस्वी झाले!',
          message: 'Gender Summary report exported successfully to Excel.',
          messageMr: 'Gender Summary रिपोर्ट एक्सेलमध्ये यशस्वीपणे एक्सपोर्ट झाला.',
          icon: '✅',
          confirmText: 'OK',
          confirmTextMr: 'ठीक आहे',
          confirmColor: 'green'
        });
      };

      const handleShareGenderSummary = async () => {
        try {
          const shareUrl = 'https://society-ilada1425.vercel.app' + window.location.hash;
          if (Capacitor.isNativePlatform()) {
            await Share.share({
              title: 'Society Ilada - Gender Summary',
              text: 'Gender-wise member distribution report.',
              url: shareUrl,
              dialogTitle: 'Share Gender Summary'
            });
          } else if (navigator.share) {
            await navigator.share({
              title: 'Society Ilada - Gender Summary',
              text: 'Gender-wise member distribution report.',
              url: shareUrl,
            });
          } else {
            alert('Sharing is not supported on this device/browser.');
          }
        } catch (error) {
          console.log('Error sharing:', error);
        }
      };

      const columns = [
        { header: 'अ. क्र.', accessorKey: 'id', render: (i: any) => i.id === 0 ? '' : i.id, width: '80px' },
        { header: 'लिंग (Gender)', accessorKey: 'gender', className: 'font-bold' },
        { header: 'संख्या (Count)', accessorKey: 'count', className: 'text-center' },
        { header: 'टक्केवारी (%)', accessorKey: 'percentage', className: 'text-center font-mono' },
      ];

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-600 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-center md:text-left">Gender Summary (लिंग गोषवारा)</h2>
              <p className="text-sm text-center md:text-left opacity-80 mt-1">सभासदांचे लिंगनिहाय वितरण</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShareGenderSummary}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-100 rounded-lg transition text-sm font-medium border border-emerald-400/30"
              >
                <Share2 size={16} /> Share
              </button>
              <button
                onClick={handleExportGenderSummary}
                className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
              >
                <Download size={16} /> CSV
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
            <ReportTable title="" columns={columns} data={summaryData} enableSearch={false} />
          </div>
        </div>
      );
    }

    // --- NEW: Gender + Category Report ---
    if (activeSubTab === 'Gender + Category') {
      const getCategoryLabel = (cat: string) => {
        switch (cat) {
          case 'ST': return 'आदिवासी (ST)';
          case 'SC': return 'विशेष घटक (SC)';
          case 'OBC': return 'सर्व साधारण (OBC)';
          case 'OPEN': return 'इतर (OPEN)';
          default: return cat;
        }
      };

      const categories = ['ST', 'SC', 'OBC', 'OPEN'];
      const genders = ['Male', 'Female', 'Other'];

      const crossTabData: any[] = [];
      let rowId = 1;

      categories.forEach(cat => {
        genders.forEach(gender => {
          const count = members.filter(m => m.category === cat && m.gender === gender).length;
          if (count > 0) {
            const genderLabel = gender === 'Male' ? 'पुरुष' : gender === 'Female' ? 'महिला' : 'इतर';
            crossTabData.push({
              id: rowId++,
              category: getCategoryLabel(cat),
              gender: genderLabel,
              count: count
            });
          }
        });

        // Subtotal for category
        const categoryTotal = members.filter(m => m.category === cat).length;
        if (categoryTotal > 0) {
          crossTabData.push({
            id: 0,
            category: getCategoryLabel(cat) + ' - एकूण',
            gender: '',
            count: categoryTotal,
            isSubtotal: true
          });
        }
      });

      // Grand Total
      crossTabData.push({
        id: 0,
        category: 'सर्व एकूण (Grand Total)',
        gender: '',
        count: members.length,
        isGrandTotal: true
      });

      const handleExportGenderCategory = async () => {
        const headers = ['वर्ग (Category)', 'लिंग (Gender)', 'संख्या (Count)'];
        const rows = crossTabData.map(item => [
          item.category,
          item.gender,
          item.count
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gender by Category");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Gender_by_Category_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

        await showConfirm({
          title: 'Export Successful!',
          titleMr: 'एक्सपोर्ट यशस्वी झाले!',
          message: 'Gender by Category report exported successfully to Excel.',
          messageMr: 'Gender by Category रिपोर्ट एक्सेलमध्ये यशस्वीपणे एक्सपोर्ट झाला.',
          icon: '✅',
          confirmText: 'OK',
          confirmTextMr: 'ठीक आहे',
          confirmColor: 'green'
        });
      };

      const handleShareGenderCategory = async () => {
        try {
          const shareUrl = 'https://society-ilada1425.vercel.app' + window.location.hash;
          if (Capacitor.isNativePlatform()) {
            await Share.share({
              title: 'Society Ilada - Gender + Category Report',
              text: 'Gender and category-wise member distribution.',
              url: shareUrl,
              dialogTitle: 'Share Gender + Category'
            });
          } else if (navigator.share) {
            await navigator.share({
              title: 'Society Ilada - Gender + Category Report',
              text: 'Gender and category-wise member distribution.',
              url: shareUrl,
            });
          } else {
            alert('Sharing is not supported on this device/browser.');
          }
        } catch (error) {
          console.log('Error sharing:', error);
        }
      };

      const columns = [
        { header: 'अ. क्र.', accessorKey: 'id', render: (i: any) => i.id === 0 ? '' : i.id, width: '80px' },
        {
          header: 'प्रवर्ग (Category)',
          accessorKey: 'category',
          className: 'font-bold',
          render: (i: any) => i.isSubtotal || i.isGrandTotal ? <span className={i.isGrandTotal ? 'text-blue-700 font-bold' : 'text-amber-700'}>{i.category}</span> : i.category
        },
        { header: 'लिंग (Gender)', accessorKey: 'gender' },
        {
          header: 'संख्या (Count)',
          accessorKey: 'count',
          className: 'text-center font-mono',
          render: (i: any) => i.isGrandTotal ? <span className="font-bold text-blue-700">{i.count}</span> : i.count
        },
      ];

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-600 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-center md:text-left">Gender + Category (लिंग आणि प्रवर्ग)</h2>
              <p className="text-sm text-center md:text-left opacity-80 mt-1">जातीनिहाय महिला/पुरुष सभासद</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShareGenderCategory}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-100 rounded-lg transition text-sm font-medium border border-emerald-400/30"
              >
                <Share2 size={16} /> Share
              </button>
              <button
                onClick={handleExportGenderCategory}
                className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
              >
                <Download size={16} /> CSV
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
            <ReportTable title="" columns={columns} data={crossTabData} enableSearch={false} />
          </div>
        </div>
      );
    }

    // --- NEW: Gender + Village Report ---
    if (activeSubTab === 'Gender + Village') {
      const villages = Array.from(new Set(members.map(m => m.village).filter(v => v && v.trim() !== ''))).sort();

      const villageData = villages.map((village, idx) => {
        const maleCount = members.filter(m => m.village === village && m.gender === 'Male').length;
        const femaleCount = members.filter(m => m.village === village && m.gender === 'Female').length;
        const otherCount = members.filter(m => m.village === village && m.gender === 'Other').length;
        const total = maleCount + femaleCount + otherCount;

        return {
          id: idx + 1,
          village: village,
          male: maleCount,
          female: femaleCount,
          other: otherCount,
          total: total
        };
      });

      // Grand Total
      const grandTotal = {
        id: 0,
        village: 'एकूण (Total)',
        male: villageData.reduce((sum, v) => sum + v.male, 0),
        female: villageData.reduce((sum, v) => sum + v.female, 0),
        other: villageData.reduce((sum, v) => sum + v.other, 0),
        total: members.length
      };
      villageData.push(grandTotal);

      const handleExportGenderVillage = async () => {
        const headers = ['अ. क्र.', 'गाव (Village)', 'पुरुष (Male)', 'महिला (Female)', 'इतर (Other)', 'एकूण (Total)'];
        const rows = villageData.map(item => [
          item.id || '',
          item.village,
          item.male,
          item.female,
          item.other,
          item.total
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gender-Village Summary");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Gender_Village_Summary_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

        await showConfirm({
          title: 'Export Successful!',
          titleMr: 'एक्सपोर्ट यशस्वी झाले!',
          message: 'Gender by Village report exported successfully to Excel.',
          messageMr: 'Gender by Village रिपोर्ट एक्सेलमध्ये यशस्वीपणे एक्सपोर्ट झाला.',
          icon: '✅',
          confirmText: 'OK',
          confirmTextMr: 'ठीक आहे',
          confirmColor: 'green'
        });
      };

      const handleShareGenderVillage = async () => {
        try {
          const shareUrl = 'https://society-ilada1425.vercel.app' + window.location.hash;
          if (Capacitor.isNativePlatform()) {
            await Share.share({
              title: 'Society Ilada - Gender + Village Report',
              text: 'Village-wise gender distribution of members.',
              url: shareUrl,
              dialogTitle: 'Share Gender + Village'
            });
          } else if (navigator.share) {
            await navigator.share({
              title: 'Society Ilada - Gender + Village Report',
              text: 'Village-wise gender distribution of members.',
              url: shareUrl,
            });
          } else {
            alert('Sharing is not supported on this device/browser.');
          }
        } catch (error) {
          console.log('Error sharing:', error);
        }
      };

      const columns = [
        { header: 'अ. क्र.', accessorKey: 'id', render: (i: any) => i.id === 0 ? '' : i.id, width: '80px' },
        {
          header: 'गाव (Village)',
          accessorKey: 'village',
          className: 'font-bold',
          render: (i: any) => i.id === 0 ? <span className="text-blue-700 font-bold">{i.village}</span> : i.village
        },
        { header: 'पुरुष (Male)', accessorKey: 'male', className: 'text-center text-blue-600 font-mono' },
        { header: 'महिला (Female)', accessorKey: 'female', className: 'text-center text-pink-600 font-mono' },
        { header: 'इतर (Other)', accessorKey: 'other', className: 'text-center text-slate-600 font-mono' },
        {
          header: 'एकूण (Total)',
          accessorKey: 'total',
          className: 'text-center font-bold font-mono',
          render: (i: any) => i.id === 0 ? <span className="text-blue-700 font-bold">{i.total}</span> : i.total
        },
      ];

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-600 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-center md:text-left">Gender + Village (गावनिहाय लिंग)</h2>
              <p className="text-sm text-center md:text-left opacity-80 mt-1">गावनिहाय महिला/पुरुष वितरण</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShareGenderVillage}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-100 rounded-lg transition text-sm font-medium border border-emerald-400/30"
              >
                <Share2 size={16} /> Share
              </button>
              <button
                onClick={handleExportGenderVillage}
                className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
              >
                <Download size={16} /> CSV
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
            <ReportTable title="" columns={columns} data={villageData} enableSearch={false} />
          </div>
        </div>
      );
    }

    // --- NEW: Gender Financial Report ---
    if (activeSubTab === 'Gender Financial') {
      const genders = ['Male', 'Female'];
      const todayStr = new Date().toISOString().split('T')[0];

      const financialData = genders.map((gender, idx) => {
        const genderMembers = members.filter(m => m.gender === gender);
        const count = genderMembers.length;

        const totalShares = genderMembers.reduce((sum, m) => sum + (m.shareBalance || 0), 0);
        const totalSavings = genderMembers.reduce((sum, m) => sum + (m.savingsBalance || 0), 0);
        const totalLoanPrincipal = genderMembers.reduce((sum, m) => sum + (m.loanPrincipal || 0), 0);

        // Calculate total loan interest (stored + accrued)
        const totalLoanInterest = genderMembers.reduce((sum, m) => {
          let memberInterest = m.loanInterestDue || 0;

          // Add accrued interest for members with outstanding loans
          if (m.loanPrincipal > 0) {
            const lastDate = m.lastLoanCalculationDate || m.originalLoanDate || '2022-04-01';
            const { interest: accrued } = calculateLoanInterest(
              m.loanPrincipal,
              lastDate,
              todayStr,
              settings.financialYearStart,
              settings.financialYearEnd,
              true,
              m.originalLoanDate,
              settings.firstYearInterestRate || 6,
              settings.subsequentYearInterestRate || 12,
              m.loanInterestDue || 0
            );
            memberInterest += accrued;
          }

          return sum + memberInterest;
        }, 0);

        const totalFD = genderMembers.reduce((sum, m) => sum + (m.fdBalance || 0), 0);

        const avgShares = count > 0 ? Math.round(totalShares / count) : 0;
        const avgSavings = count > 0 ? Math.round(totalSavings / count) : 0;
        const avgLoan = count > 0 ? Math.round(totalLoanPrincipal / count) : 0;

        return {
          id: idx + 1,
          gender: gender === 'Male' ? 'पुरुष (Male)' : 'महिला (Female)',
          count: count,
          totalShares: totalShares,
          avgShares: avgShares,
          totalSavings: totalSavings,
          avgSavings: avgSavings,
          totalLoanPrincipal: totalLoanPrincipal,
          avgLoan: avgLoan,
          totalLoanInterest: totalLoanInterest,
          totalFD: totalFD
        };
      });

      // Grand Total
      const grandTotal = {
        id: 0,
        gender: 'एकूण (Total)',
        count: members.length,
        totalShares: financialData.reduce((sum, g) => sum + g.totalShares, 0),
        avgShares: 0,
        totalSavings: financialData.reduce((sum, g) => sum + g.totalSavings, 0),
        avgSavings: 0,
        totalLoanPrincipal: financialData.reduce((sum, g) => sum + g.totalLoanPrincipal, 0),
        avgLoan: 0,
        totalLoanInterest: financialData.reduce((sum, g) => sum + g.totalLoanInterest, 0),
        totalFD: financialData.reduce((sum, g) => sum + g.totalFD, 0)
      };
      financialData.push(grandTotal);

      const handleExportGenderFinancial = async () => {
        const headers = [
          'लिंग (Gender)', 'संख्या', 'एकूण शेअर', 'सरासरी शेअर',
          'एकूण बचत', 'सरासरी बचत', 'एकूण कर्ज', 'सरासरी कर्ज',
          'एकूण व्याज', 'एकूण FD'
        ];
        const rows = financialData.map(item => [
          item.gender,
          item.count,
          item.totalShares,
          item.avgShares || '-',
          item.totalSavings,
          item.avgSavings || '-',
          item.totalLoanPrincipal,
          item.avgLoan || '-',
          item.totalLoanInterest,
          item.totalFD
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gender Financial");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Gender_Financial_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

        await showConfirm({
          title: 'Export Successful!',
          titleMr: 'एक्सपोर्ट यशस्वी झाले!',
          message: 'Gender Financial report exported successfully to Excel.',
          messageMr: 'Gender Financial रिपोर्ट एक्सेलमध्ये यशस्वीपणे एक्सपोर्ट झाला.',
          icon: '✅',
          confirmText: 'OK',
          confirmTextMr: 'ठीक आहे',
          confirmColor: 'green'
        });
      };

      const handleShareGenderFinancial = async () => {
        try {
          const shareUrl = 'https://society-ilada1425.vercel.app' + window.location.hash;
          if (Capacitor.isNativePlatform()) {
            await Share.share({
              title: 'Society Ilada - Gender Financial Report',
              text: 'Gender-wise financial summary of members.',
              url: shareUrl,
              dialogTitle: 'Share Gender Financial'
            });
          } else if (navigator.share) {
            await navigator.share({
              title: 'Society Ilada - Gender Financial Report',
              text: 'Gender-wise financial summary of members.',
              url: shareUrl,
            });
          } else {
            alert('Sharing is not supported on this device/browser.');
          }
        } catch (error) {
          console.log('Error sharing:', error);
        }
      };

      const columns = [
        { header: 'अ. क्र.', accessorKey: 'id', render: (i: any) => i.id === 0 ? '' : i.id, width: '60px' },
        {
          header: 'लिंग (Gender)',
          accessorKey: 'gender',
          className: 'font-bold',
          render: (i: any) => i.id === 0 ? <span className="text-blue-700 font-bold">{i.gender}</span> : i.gender
        },
        { header: 'संख्या', accessorKey: 'count', className: 'text-center' },
        { header: 'एकूण शेअर', accessorKey: 'totalShares', render: (i: any) => `₹${i.totalShares.toLocaleString()}`, className: 'text-right font-mono text-green-600' },
        { header: 'सरासरी शेअर', accessorKey: 'avgShares', render: (i: any) => i.avgShares > 0 ? `₹${i.avgShares.toLocaleString()}` : '-', className: 'text-right font-mono text-xs' },
        { header: 'एकूण बचत', accessorKey: 'totalSavings', render: (i: any) => `₹${i.totalSavings.toLocaleString()}`, className: 'text-right font-mono text-blue-600' },
        { header: 'सरासरी बचत', accessorKey: 'avgSavings', render: (i: any) => i.avgSavings > 0 ? `₹${i.avgSavings.toLocaleString()}` : '-', className: 'text-right font-mono text-xs' },
        { header: 'एकूण कर्ज', accessorKey: 'totalLoanPrincipal', render: (i: any) => `₹${i.totalLoanPrincipal.toLocaleString()}`, className: 'text-right font-mono text-red-600' },
        { header: 'सरासरी कर्ज', accessorKey: 'avgLoan', render: (i: any) => i.avgLoan > 0 ? `₹${i.avgLoan.toLocaleString()}` : '-', className: 'text-right font-mono text-xs' },
        { header: 'एकूण व्याज', accessorKey: 'totalLoanInterest', render: (i: any) => `₹${i.totalLoanInterest.toLocaleString()}`, className: 'text-right font-mono text-orange-600' },
        { header: 'एकूण FD', accessorKey: 'totalFD', render: (i: any) => `₹${i.totalFD.toLocaleString()}`, className: 'text-right font-mono text-purple-600' },
      ];

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-600 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-center md:text-left">Gender Financial (लिंगनिहाय आर्थिक)</h2>
              <p className="text-sm text-center md:text-left opacity-80 mt-1">महिला/पुरुष सभासदांचे आर्थिक तपशील</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShareGenderFinancial}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-100 rounded-lg transition text-sm font-medium border border-emerald-400/30"
              >
                <Share2 size={16} /> Share
              </button>
              <button
                onClick={handleExportGenderFinancial}
                className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
              >
                <Download size={16} /> CSV
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
            <ReportTable title="" columns={columns} data={financialData} enableSearch={false} />
          </div>
        </div>
      );
    }

    if (activeSubTab === 'Land Holding') {
      const columns = [
        { header: 'No.', accessorKey: 'id', width: '60px' },
        { header: 'Name', accessorKey: 'name' },
        { header: 'Village', accessorKey: 'village' },
        { header: 'Land', accessorKey: 'land' },
        { header: 'Share Bal', accessorKey: 'shareBalance', render: (i: any) => `₹${i.shareBalance}` },
      ];
      return <ReportTable title="Land Holding Report" columns={columns} data={memberReportData} onRowClick={(item) => handleMemberClick(item.realId)} />;
    }

    return <div className="p-8 text-center text-slate-500">Feature '{activeSubTab}' is under development.</div>;
  };

  const renderSchemes = () => {
    const startYear = parseInt(deshmukhFY.split('-')[0]);
    const endYear = startYear + 1;
    const startDate = new Date(`${startYear}-04-01`);
    const endDate = new Date(`${endYear}-03-31`);
    const deshmukCutoff = new Date(`${endYear}-06-30`);

    const fySelector = (
      <div className="mb-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border dark:border-slate-700 flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">आर्थिक वर्ष निवडा (Select FY):</label>
            <select 
              value={deshmukhFY} 
              onChange={(e) => setDeshmukhFY(e.target.value)}
              className="p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="2024-25">2024-25</option>
              <option value="2025-26">2025-26</option>
              <option value="2026-27">2026-27</option>
            </select>
          </div>

          {activeSubTab === 'Dr. P. Deshmukh Incentive' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">प्रवर्ग निवडा (Category):</label>
              <select 
                value={deshmukhCategory} 
                onChange={(e) => setDeshmukhCategory(e.target.value)}
                className="p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="ALL">सर्व (ALL)</option>
                <option value="ST">अनुसूचित जमाती (ST)</option>
                <option value="SC">अनुसूचित जाती (SC)</option>
                <option value="OBC">इतर मागासवर्गीय (OBC)</option>
                <option value="OPEN">सर्वसाधारण (OPEN)</option>
              </select>
            </div>
          )}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-emerald-100/50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30">
          कालावधी: ०१ एप्रिल {startYear} ते ३० जून {endYear} (कटऑफ तारीख: ३०-०६-{endYear})
        </span>
      </div>
    );

    const allResolvedIncentiveData = members
      .map(m => {
        // 1. Look for a loan debit in the target FY (01-04 to 31-03)
        const fYLoanDebit = transactions.find(t => 
          t.memberId === m.id && 
          t.type === 'Debit' && 
          t.accountType === 'Loan' && 
          new Date(t.date) >= startDate && 
          new Date(t.date) <= endDate
        );

        // 2. Or look for a loan credit (repayment) in the target FY (01-04 to 30-06-cutoff)
        const fYLoanCredit = transactions.find(t => 
          t.memberId === m.id && 
          t.type === 'Credit' && 
          t.accountType === 'Loan' && 
          new Date(t.date) >= startDate && 
          new Date(t.date) <= deshmukCutoff
        );

        // 3. Or fallback to current member loan details if they are in the target FY
        const currentLoanDateStr = m.originalLoanDate || m.lastLoanCalculationDate;
        const currentLoanInFY = currentLoanDateStr && new Date(currentLoanDateStr) >= startDate && new Date(currentLoanDateStr) <= endDate;

        if (!fYLoanDebit && !fYLoanCredit && !currentLoanInFY) {
          return null;
        }

        let loanDate = `${startYear}-04-01`;
        let principal = 0;

        if (fYLoanDebit) {
          loanDate = fYLoanDebit.date;
          principal = fYLoanDebit.amount;
        } else if (fYLoanCredit) {
          loanDate = fYLoanCredit.previousLoanCalculationDate || (currentLoanInFY ? currentLoanDateStr! : `${startYear}-04-01`);
          principal = fYLoanCredit.principalPaid || (fYLoanCredit.amount - (fYLoanCredit.interestPaid || 0));
        } else if (currentLoanInFY) {
          loanDate = currentLoanDateStr!;
          principal = Math.max(0, m.loanPrincipal);
        }

        // Let's determine repayments of this loan. Repayments occur after loanDate and up to deshmukCutoff
        const repaymentTxns = transactions.filter(t => 
          t.memberId === m.id && 
          t.type === 'Credit' && 
          t.accountType === 'Loan' && 
          t.date >= loanDate && 
          new Date(t.date) <= deshmukCutoff
        );

        // Sum repayments
        const totalRepaid = repaymentTxns.reduce((sum, t) => 
          sum + (t.principalPaid || Math.max(0, t.amount - (t.interestPaid || 0))), 0
        );

        // If there is a later debit transaction, this loan MUST have been repaid, or we check if totalRepaid clears it.
        const hasLaterLoan = transactions.some(t =>
          t.memberId === m.id &&
          t.type === 'Debit' &&
          t.accountType === 'Loan' &&
          new Date(t.date) > new Date(loanDate)
        );

        // fully repaid?
        const isRepaid = totalRepaid >= (principal - 5) || hasLaterLoan || (currentLoanInFY && m.loanPrincipal <= 0);

        let repaymentDateStr = '-';
        if (isRepaid) {
          if (repaymentTxns.length > 0) {
            const sortedRepayments = [...repaymentTxns].sort((a, b) => a.date.localeCompare(b.date));
            repaymentDateStr = sortedRepayments[sortedRepayments.length - 1].date;
          } else if (hasLaterLoan) {
            const laterLoans = transactions
              .filter(t => t.memberId === m.id && t.type === 'Debit' && t.accountType === 'Loan' && new Date(t.date) > new Date(loanDate))
              .sort((a, b) => a.date.localeCompare(b.date));
            
            if (laterLoans.length > 0) {
              const nextLoanDate = new Date(laterLoans[0].date);
              const repaidDateObj = new Date(nextLoanDate.getTime() - 24 * 60 * 60 * 1000);
              repaymentDateStr = format(repaidDateObj, 'yyyy-MM-dd');
            } else {
              repaymentDateStr = `${endYear}-03-31`;
            }
          }
        }

        const displayRepaymentDate = isRepaid ? repaymentDateStr : 'Ongoing (सुरु)';

        const toDate = isRepaid ? new Date(repaymentDateStr) : new Date();
        const days = differenceInDays(toDate, new Date(loanDate));

        const productValue = principal * days;

        const repaidBeforeCutoff = isRepaid && new Date(repaymentDateStr) <= deshmukCutoff;
        const incentive = repaidBeforeCutoff ? Math.round(principal * 0.03) : null;

        return {
          realId: m.id,
          name: m.name,
          category: m.category,
          village: m.village,
          loanDate: loanDate,
          repaymentDate: displayRepaymentDate,
          days: days,
          principal: principal,
          product: productValue,
          subsidy: incentive,
          bankAccount: m.bankAccountNo || 'N/A',
          ledgerPageNo: m.ledgerPageNo || ''
        };
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;
        // STRICT CHECK: The loan disbursement date MUST fall within the target Financial Year!
        const parsedLoanDate = new Date(item.loanDate);
        if (parsedLoanDate < startDate || parsedLoanDate > endDate) {
          return false;
        }
        return true;
      });

    if (activeSubTab === 'Dr. P. Deshmukh Incentive') {
      const getCategoryHeaderLabel = (cat: string) => {
        switch (cat) {
          case 'ST': return ' अनुसूचित जमाती (ST)';
          case 'SC': return 'अनुसूचित जाती (SC)';
          case 'OBC': return 'इतर मागासवर्गीय (OBC)';
          case 'OPEN': return 'सर्वसाधारण (OPEN)';
          default: return 'सर्व';
        }
      };

      const incentiveData = allResolvedIncentiveData
        .filter(item => {
          if (deshmukhCategory !== 'ALL' && item.category !== deshmukhCategory) return false;
          return true;
        })
        .map((item, idx) => ({
          ...item,
          product: item.product.toLocaleString(),
          id: idx + 1
        }));

      const handleDeshmukhDetailedExport = () => {
        const ws: any = {};
        const merges: any[] = [];

        // Styles
        const subtitleStyle = { font: { name: 'Calibri', sz: 12, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const metaStyleLeft = { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'center' } };
        const metaStyleRight = { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'right', vertical: 'center' } };
        const metaStyleCenter = { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        
        const headerStyle = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: 'F5EBE6' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        const cellCenter = {
          font: { name: 'Calibri', sz: 9 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        const cellLeft = {
          font: { name: 'Calibri', sz: 9 },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        const cellRight = {
          font: { name: 'Calibri', sz: 9 },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        const totalStyle = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        const totalStyleRight = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        ws['A1'] = { v: "डॉ.पंजाबराव देशमुख व्याज सवलत योजना - व्याज सवलत अनुदान मागणी प्रस्ताव", t: 's', s: subtitleStyle };
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } });

        ws['A2'] = { v: "आदिवासी विविध कार्यकारी सहकारी संस्था मर्या. ईळदा र.नं. १४२५", t: 's', s: subtitleStyle };
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 14 } });

        ws['A3'] = { v: "तालुका:- अर्जुनी/मोरगाव जिल्हा:- गोंदिया", t: 's', s: subtitleStyle };
        merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 14 } });

        ws['A5'] = { v: "बँक शाखा:- केशोरी", t: 's', s: metaStyleLeft };
        merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 3 } });

        ws['E5'] = { v: "IFS Code:- UTIB0SGDC01", t: 's', s: metaStyleCenter };
        merges.push({ s: { r: 4, c: 4 }, e: { r: 4, c: 8 } });

        ws['J5'] = { v: "खाते क्र. : - ०२००३०२०००००००२", t: 's', s: metaStyleRight };
        merges.push({ s: { r: 4, c: 9 }, e: { r: 4, c: 14 } });

        ws['A6'] = { v: `पिक कर्ज वाटप वर्ष/कालावधी :- ०१/०४/${startYear} ते ३०/०६/${endYear}`, t: 's', s: metaStyleLeft };
        merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: 9 } });

        ws['K6'] = { v: `प्रवर्ग - ${getCategoryHeaderLabel(deshmukhCategory)}`, t: 's', s: metaStyleRight };
        merges.push({ s: { r: 5, c: 10 }, e: { r: 5, c: 14 } });

        const row8 = ["अ.क्र.", "खाते पान क्र.", "शेतकऱ्याचे पूर्ण नाव", "जात", "गाव", "पिकाचे नाव", "पीक कर्ज उचल (रु. ३ लाखा पर्यंत)", "", "कर्ज वसुली", "", "", "कर्ज वाटप दिवस उचल तारखेपासून वसूल तारखे पर्यंत", "प्रॉडक्ट", "वार्षिक तीन टक्के दराने व्याज सवलतीची रक्कम", "बचत खात्याचा तपशील (बँक शाखा. IFSC, खाते क्र.)"];
        row8.forEach((val, colIdx) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r: 7, c: colIdx });
          ws[cellRef] = { v: val, t: 's', s: headerStyle };
        });

        const row9 = ["", "", "", "", "", "", "दिनांक", "रक्कम", "दिनांक", "रक्कम", "व्याज", "", "", "", ""];
        row9.forEach((val, colIdx) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r: 8, c: colIdx });
          ws[cellRef] = { v: val, t: 's', s: headerStyle };
        });

        for (let colIdx = 0; colIdx < 15; colIdx++) {
          const cellRef = XLSXStyle.utils.encode_cell({ r: 9, c: colIdx });
          ws[cellRef] = { v: colIdx + 1, t: 'n', s: headerStyle };
        }

        merges.push({ s: { r: 7, c: 0 }, e: { r: 8, c: 0 } });
        merges.push({ s: { r: 7, c: 1 }, e: { r: 8, c: 1 } });
        merges.push({ s: { r: 7, c: 2 }, e: { r: 8, c: 2 } });
        merges.push({ s: { r: 7, c: 3 }, e: { r: 8, c: 3 } });
        merges.push({ s: { r: 7, c: 4 }, e: { r: 8, c: 4 } });
        merges.push({ s: { r: 7, c: 5 }, e: { r: 8, c: 5 } });
        merges.push({ s: { r: 7, c: 6 }, e: { r: 7, c: 7 } });
        merges.push({ s: { r: 7, c: 8 }, e: { r: 7, c: 10 } });
        merges.push({ s: { r: 7, c: 11 }, e: { r: 8, c: 11 } });
        merges.push({ s: { r: 7, c: 12 }, e: { r: 8, c: 12 } });
        merges.push({ s: { r: 7, c: 13 }, e: { r: 8, c: 13 } });
        merges.push({ s: { r: 7, c: 14 }, e: { r: 8, c: 14 } });

        let rowIdx = 10;
        let totalPrincipal = 0;
        let totalRecovery = 0;
        let totalProduct = 0;
        let totalSubsidy = 0;

        incentiveData.forEach((item, idx) => {
          const isRepaidVal = item.repaymentDate !== 'Ongoing (सुरु)' && item.repaymentDate !== '-';
          const recAmt = isRepaidVal ? item.principal : 0;
          const subAmt = item.subsidy || 0;

          totalPrincipal += item.principal;
          totalRecovery += recAmt;
          totalProduct += (item.principal * item.days);
          totalSubsidy += subAmt;

          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: idx + 1, t: 'n', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 1 })] = { v: item.ledgerPageNo || '', t: 's', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 2 })] = { v: item.name, t: 's', s: cellLeft };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 3 })] = { v: item.category, t: 's', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 4 })] = { v: item.village, t: 's', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 5 })] = { v: 'भात पिक', t: 's', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 6 })] = { v: fmtDateDMY(item.loanDate), t: 's', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 7 })] = { v: item.principal, t: 'n', s: cellRight };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 8 })] = { v: isRepaidVal ? fmtDateDMY(item.repaymentDate) : '-', t: 's', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 9 })] = { v: recAmt, t: 'n', s: cellRight };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 10 })] = { v: '', t: 's', s: cellRight };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 11 })] = { v: item.days, t: 'n', s: cellCenter };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 12 })] = { v: (item.principal * item.days), t: 'n', s: cellRight };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 13 })] = { v: subAmt > 0 ? subAmt : '', t: 's', s: cellRight };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 14 })] = { v: item.bankAccount || '', t: 's', s: cellCenter };

          rowIdx++;
        });

        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: '', t: 's', s: totalStyle };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 1 })] = { v: '', t: 's', s: totalStyle };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 2 })] = { v: 'एकूण', t: 's', s: totalStyle };
        merges.push({ s: { r: rowIdx, c: 2 }, e: { r: rowIdx, c: 5 } });
        for (let c = 3; c <= 5; c++) ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: c })] = { v: '', t: 's', s: totalStyle };

        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 6 })] = { v: '', t: 's', s: totalStyle };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 7 })] = { v: totalPrincipal, t: 'n', s: totalStyleRight };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 8 })] = { v: '', t: 's', s: totalStyle };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 9 })] = { v: totalRecovery, t: 'n', s: totalStyleRight };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 10 })] = { v: '', t: 's', s: totalStyle };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 11 })] = { v: '', t: 's', s: totalStyle };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 12 })] = { v: totalProduct, t: 'n', s: totalStyleRight };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 13 })] = { v: totalSubsidy, t: 'n', s: totalStyleRight };
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 14 })] = { v: '', t: 's', s: totalStyle };

        rowIdx += 2;

        const certStyleTitle = { font: { name: 'Calibri', sz: 12, bold: true, underline: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const certStyleBody = { font: { name: 'Calibri', sz: 10 }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true } };

        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: "प्रमाणपत्र-", t: 's', s: certStyleTitle };
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 14 } });
        rowIdx++;

        const totalBeneficiaries = incentiveData.length;
        const formattedTotalBeneficiaries = totalBeneficiaries < 10 ? `०${totalBeneficiaries}` : String(totalBeneficiaries);
        const certText = `प्रमाणित करण्यात येते कि , १) उक्त विवरणपत्राप्रमाणे नमुद ०१ ते ${formattedTotalBeneficiaries} लाभार्थी संस्थेचे कर्जदार असुन विवरणपत्रात नमुद कर्जे ही पीक आहेत. २) सदर कर्जाची उचल दिनांक ०१/०४/${startYear} नंतर झाली आहे. ३) उचल केलेल्या पीक कर्जाची विहीत मुदतीत संपुर्ण वसुली झाली आहे व सदर शेतकरी डॉ. पंजाबराव देशमुख व्याज सवलत योजने अंतर्गत लाभास पात्र आहेत.`;
        
        ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: certText, t: 's', s: certStyleBody };
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx + 2, c: 14 } });

        ws['!merges'] = merges;
        ws['!ref'] = `A1:O${rowIdx + 3}`;
        ws['!cols'] = [
          { wch: 6 },  { wch: 10 }, { wch: 25 }, { wch: 8 },  { wch: 12 },
          { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
          { wch: 8 },  { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 22 }
        ];

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "Deshmukh Incentive List");
        const excelBuffer = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Dr_Panjabrao_Deshmukh_Incentive_List_${deshmukhFY}_${deshmukhCategory}.xlsx`);
      };

      const columns: Column<typeof incentiveData[0]>[] = [
        { header: 'अ. क्र.', accessorKey: 'id', width: '50px' },
        { header: 'खाते पान क्र.', accessorKey: 'ledgerPageNo', width: '70px', className: 'font-mono text-center' },
        { header: 'सभासदांचे नाव', accessorKey: 'name', className: 'font-bold text-slate-700 dark:text-slate-300' },
        { header: 'प्रवर्ग', accessorKey: 'category' },
        { header: 'गांव', accessorKey: 'village' },
        { header: 'कर्ज तारीख', accessorKey: 'loanDate', render: (i) => fmtDateDMY(i.loanDate) },
        { header: 'परतफेड दिनांक', accessorKey: 'repaymentDate', render: (i) => fmtDateDMY(i.repaymentDate) },
        { header: 'दिवस', accessorKey: 'days' },
        { header: 'मुद्दल', accessorKey: 'principal', render: (i) => `${i.principal.toLocaleString()}` },
        { header: 'प्रॉडक्ट', accessorKey: 'product', width: '200px', className: 'text-xs font-mono text-slate-600 dark:text-slate-400' },
        {
          header: '3% व्याज सवलत रक्कम',
          accessorKey: 'subsidy',
          render: (i) => i.subsidy ? `${i.subsidy.toLocaleString()}` : '',
          className: 'font-bold text-green-600 text-center'
        },
        { header: 'बँक खाते', accessorKey: 'bankAccount', className: 'font-mono text-xs' },
      ];

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-600 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-center md:text-left">डॉ. पंजाबराव देशमुख व्याज सवलत योजना यादी</h2>
              <p className="text-sm text-center md:text-left opacity-80 mt-1">Detailed list for Dr. P. Deshmukh Interest Subvention</p>
            </div>
            <button
              onClick={handleDeshmukhDetailedExport}
              className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
            >
              <Download size={16} /> Export Excel (प्रमाणपत्रासह)
            </button>
          </div>
          <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
            {fySelector}
            <div className="flex-1 overflow-auto">
              <ReportTable title="" columns={columns} data={incentiveData} enableDateFilter={false} enableExport={false} enableShare={false} onRowClick={(item) => handleMemberClick(item.realId)} />
            </div>
          </div>
        </div>
      );
    }

    if (activeSubTab === 'Summary') {
      const getCategoryLabel = (cat: string) => {
        switch (cat) {
          case 'ST': return 'आदिवासी घटक (ST)';
          case 'SC': return 'विशेष घटक (SC)';
          case 'OBC': return 'सर्व साधारण (OBC)';
          case 'OPEN': return 'इतर (OPEN)';
          default: return cat;
        }
      };

      const categories = ['ST', 'OBC', 'SC', 'OPEN'];

      const summaryData = categories.map((cat, idx) => {
        const catItems = allResolvedIncentiveData.filter(item => 
          item.category === cat && 
          item.repaymentDate !== 'Ongoing (सुरु)' && 
          item.subsidy !== null && 
          item.subsidy > 0
        );

        let disbursement = 0, repayment = 0, totalProduct = 0, incentive = 0;

        catItems.forEach(item => {
          const isRepaid = item.repaymentDate !== 'Ongoing (सुरु)';
          disbursement += item.principal;
          if (isRepaid) repayment += item.principal;
          totalProduct += item.product;
          if (isRepaid) incentive += (item.subsidy || 0);
        });

        return {
          id: idx + 1,
          category: getCategoryLabel(cat),
          crop: 'भात पिक',
          memberCount: catItems.length,
          disbursement,
          repayment,
          product: totalProduct,
          subsidy: incentive,
          totalBenefit: incentive
        };
      }).filter(item => item.memberCount > 0);

      const handleDeshmukhSummaryExport = () => {
        const ws: any = {};
        const merges: any[] = [];

        // Styles
        const titleStyle = { font: { name: 'Calibri', sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const subtitleStyle = { font: { name: 'Calibri', sz: 12, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const metaStyleLeft = { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'center' } };
        const metaStyleRight = { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'right', vertical: 'center' } };

        const headerStyle = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: 'E2E8F0' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        const cellCenter = {
          font: { name: 'Calibri', sz: 9 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
            left: { style: 'thin', color: { rgb: 'D3D3D3' } },
            right: { style: 'thin', color: { rgb: 'D3D3D3' } }
          }
        };

        const cellLeft = {
          font: { name: 'Calibri', sz: 9 },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
            left: { style: 'thin', color: { rgb: 'D3D3D3' } },
            right: { style: 'thin', color: { rgb: 'D3D3D3' } }
          }
        };

        const cellRight = {
          font: { name: 'Calibri', sz: 9 },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
            left: { style: 'thin', color: { rgb: 'D3D3D3' } },
            right: { style: 'thin', color: { rgb: 'D3D3D3' } }
          }
        };

        const totalStyle = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        const totalStyleRight = {
          font: { name: 'Calibri', sz: 9, bold: true },
          alignment: { horizontal: 'right', vertical: 'center' },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };

        ws['A1'] = { v: "संस्थेचे नाव :- आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं. १४२५", t: 's', s: subtitleStyle };
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } });

        ws['A2'] = { v: "डॉ. पंजाबराव देशमुख ३% दराने पीक प्रोत्साहन व्याज सवलत योजना अनुदान मागणी प्रस्ताव", t: 's', s: subtitleStyle };
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 8 } });

        ws['A4'] = { v: "बँकेचे व शाखेचे नाव :- केशोरी", t: 's', s: metaStyleLeft };
        merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: 3 } });

        ws['G4'] = { v: `हंगाम वर्ष (कर्ज वाटप) :- ${deshmukhFY}`, t: 's', s: metaStyleRight };
        merges.push({ s: { r: 3, c: 6 }, e: { r: 3, c: 8 } });

        ws['A5'] = { v: `पिक कर्ज वाटप वर्ष/कालावधी :- ०१/०४/${startYear} ते ३०/०६/${endYear}   ( एकत्रीकरण )`, t: 's', s: titleStyle };
        merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 8 } });

        const headers1 = ["अ. क्र.", "प्रकार", "पिकाचे नाव", "सभासद संख्या", "कर्जवाटप रक्कम", "कर्ज परतफेड", "प्रॉडक्ट", "३% व्याज सवलत रुपये", "एकूण व्याज सवलत लाभाची रक्कम"];
        headers1.forEach((val, colIdx) => {
          const cellRef = XLSXStyle.utils.encode_cell({ r: 6, c: colIdx });
          ws[cellRef] = { v: val, t: 's', s: headerStyle };
        });

        for (let colIdx = 0; colIdx < 9; colIdx++) {
          const cellRef = XLSXStyle.utils.encode_cell({ r: 7, c: colIdx });
          ws[cellRef] = { v: colIdx + 1, t: 'n', s: headerStyle };
        }

        let rowIdx = 8;
        const allDataRows = [...summaryData];
        if (allDataRows.length > 0) {
          const totals = allDataRows.reduce((acc, curr) => ({
            id: 0,
            category: 'एकूण',
            crop: '',
            memberCount: acc.memberCount + curr.memberCount,
            disbursement: acc.disbursement + curr.disbursement,
            repayment: acc.repayment + curr.repayment,
            product: acc.product + curr.product,
            subsidy: acc.subsidy + curr.subsidy,
            totalBenefit: acc.totalBenefit + curr.totalBenefit
          }), { memberCount: 0, disbursement: 0, repayment: 0, product: 0, subsidy: 0, totalBenefit: 0 } as any);
          allDataRows.push(totals);
        }

        allDataRows.forEach((item) => {
          const isTotal = item.id === 0;
          const st = isTotal ? totalStyle : cellCenter;
          const stR = isTotal ? totalStyleRight : cellRight;

          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: isTotal ? '' : item.id, t: isTotal ? 's' : 'n', s: st };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 1 })] = { v: item.category, t: 's', s: isTotal ? totalStyle : cellLeft };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 2 })] = { v: isTotal ? '' : item.crop, t: 's', s: st };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 3 })] = { v: item.memberCount, t: 'n', s: st };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 4 })] = { v: item.disbursement, t: 'n', s: stR };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 5 })] = { v: item.repayment, t: 'n', s: stR };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 6 })] = { v: item.product, t: 'n', s: stR };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 7 })] = { v: item.subsidy, t: 'n', s: stR };
          ws[XLSXStyle.utils.encode_cell({ r: rowIdx, c: 8 })] = { v: item.totalBenefit, t: 'n', s: stR };

          rowIdx++;
        });

        ws['!merges'] = merges;
        ws['!ref'] = `A1:I${rowIdx}`;
        ws['!cols'] = [
          { wch: 8 },  { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
          { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 22 }
        ];

        const wb = XLSXStyle.utils.book_new();
        XLSXStyle.utils.book_append_sheet(wb, ws, "Deshmukh Summary");
        const excelBuffer = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Dr_Panjabrao_Deshmukh_Incentive_Summary_${deshmukhFY}.xlsx`);
      };

      const columns: Column<any>[] = [
        { header: 'अ. क्र.', accessorKey: 'id', render: (i) => i.id === 0 ? '' : i.id },
        { header: 'प्रवर्ग', accessorKey: 'category', render: (i) => i.id === 0 ? <span className="font-bold">{i.category}</span> : i.category },
        { header: 'पिकाचे नाव', accessorKey: 'crop' },
        { header: 'सभासद संख्या', accessorKey: 'memberCount', className: 'text-center' },
        { header: 'कर्जवाटप रक्कम', accessorKey: 'disbursement', render: (i) => i.disbursement.toLocaleString() },
        { header: 'कर्ज परतफेड', accessorKey: 'repayment', render: (i) => i.repayment.toLocaleString() },
        { header: 'प्रॉडक्ट', accessorKey: 'product', render: (i) => i.product.toLocaleString() },
        { header: '३% व्याज सवलत रुपये', accessorKey: 'subsidy', render: (i) => i.subsidy.toLocaleString(), className: 'text-green-600 font-bold' },
        { header: 'एकूण व्याज सवलत लाभाची रक्कम', accessorKey: 'totalBenefit', render: (i) => i.totalBenefit.toLocaleString(), className: 'text-green-600 font-bold' },
      ];

      return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-600 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-center md:text-left">डॉ. पंजाबराव देशमुख व्याज सवलत योजना - एकत्रीकरण गोषवारा</h2>
              <p className="text-sm text-center md:text-left opacity-80 mt-1">Summary of Dr. P. Deshmukh Interest Subvention</p>
            </div>
            <button
              onClick={handleDeshmukhSummaryExport}
              className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 rounded-lg transition text-sm font-medium border border-green-400/30"
            >
              <Download size={16} /> Export Excel
            </button>
          </div>
          <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
            {fySelector}
            <div className="flex-1 overflow-auto">
              <ReportTable title="" columns={columns} data={summaryData} enableExport={false} enableShare={false} />
            </div>
          </div>
        </div>
      );
    }

    return <div className="p-8 text-center text-slate-500">Feature '{activeSubTab}' is under development.</div>;
  };

  const renderBankIncentive = () => {
    const allIncentiveLoans = getFYLoans(activeStart, activeEnd);

    if (activeSubTab === 'Within ₹50,000' || activeSubTab === 'Above ₹50,000') {
      const isAbove = activeSubTab === 'Above ₹50,000';
      const filteredLoans = allIncentiveLoans.filter(item => {
        return isAbove ? item.loanAmount > 50000 : item.loanAmount <= 50000;
      });

      const incentiveData = filteredLoans.map((item, idx) => ({
        id: idx + 1,
        name: item.member.name,
        loanDate: item.loanDate,
        loanAmount: item.loanAmount,
        repaymentDate: item.repaymentDate,
        repaymentAmount: item.repaymentAmount,
        days: item.days,
        product: item.product,
        interest3: item.interest3,
        interest2_5: item.interest2_5,
        bankAccount: item.member.bankAccountNo || 'N/A'
      }));

      const fmtDate = (dateStr: string) => {
        if (!dateStr || dateStr === '-') return '-';
        try {
          const [y, m, d] = dateStr.split('-');
          if (y && m && d) return `${d}-${m}-${y}`;
          return dateStr;
        } catch { return dateStr; }
      };

      const columns: Column<any>[] = [
        { header: 'अ. क्र.', accessorKey: 'id', width: '50px' },
        { header: 'सभासदांचे नाव', accessorKey: 'name', className: 'font-bold' },
        { header: 'कर्ज तारीख', accessorKey: 'loanDate', render: (i) => fmtDate(i.loanDate) },
        { header: 'कर्ज रक्कम', accessorKey: 'loanAmount', render: (i) => `${i.loanAmount.toLocaleString()}` },
        { header: 'परतफेड तारीख', accessorKey: 'repaymentDate', render: (i) => fmtDate(i.repaymentDate) },
        { header: 'परतफेड रक्कम', accessorKey: 'repaymentAmount', render: (i) => i.repaymentAmount > 0 ? `${i.repaymentAmount.toLocaleString()}` : '-' },
        { header: 'दिवस', accessorKey: 'days', render: (i) => i.days > 0 ? i.days : '-' },
        { header: 'प्रॉडक्ट', accessorKey: 'product', render: (i) => i.product > 0 ? i.product.toLocaleString() : '-' },
        { header: '3% व्याज', accessorKey: 'interest3', render: (i) => i.interest3 ? `${i.interest3.toLocaleString()}` : '-', className: 'text-blue-600 font-bold text-center' },
        { header: '2.50% व्याज', accessorKey: 'interest2_5', render: (i) => i.interest2_5 ? `${i.interest2_5.toLocaleString()}` : '-', className: 'text-indigo-600 font-bold text-center' },
      ];

      return (
        <div className="flex flex-col gap-4 h-full">
          {renderFYSelector()}
          <ReportTable title={`Bank Incentive - ${activeSubTab}`} columns={columns} data={incentiveData} enableDateFilter={false} />
        </div>
      );
    }

    if (activeSubTab === 'Summary') {
      const limits = [
        { title: '50,000 /- पावेतो', threshold: 50000, above: false },
        { title: '50,000 /- चे वरील', threshold: 50000, above: true }
      ];

      const summaryData = limits.map((l, idx) => {
        const filtered = allIncentiveLoans.filter(item => {
          return l.above ? item.loanAmount > l.threshold : item.loanAmount <= l.threshold;
        });

        const disbursement = filtered.reduce((sum, item) => sum + item.loanAmount, 0);
        const repayment = filtered.reduce((sum, item) => sum + item.repaymentAmount, 0);
        const product = filtered.reduce((sum, item) => sum + item.product, 0);
        const int3 = filtered.reduce((sum, item) => sum + (item.interest3 || 0), 0);
        const int2_5 = filtered.reduce((sum, item) => sum + (item.interest2_5 || 0), 0);
        const repaidCount = filtered.filter(item => item.isRepaid).length;
        const balance = disbursement - repayment;

        return {
          id: idx + 1,
          memberCount: filtered.length,
          limit: l.title,
          disbDate: '-',
          disbAmount: disbursement,
          repaidDate: activeEnd.split('-').reverse().join('.'),
          repaidMemberCount: repaidCount,
          repaymentAmount: repayment,
          product: product,
          interest3: int3,
          interest2_5: int2_5,
          balance: balance,
          total: repayment + balance
        };
      });

      if (summaryData.length > 0) {
        const totals = summaryData.reduce((acc, curr) => ({
          id: 0,
          memberCount: acc.memberCount + curr.memberCount,
          limit: 'एकूण',
          disbDate: '',
          disbAmount: acc.disbAmount + curr.disbAmount,
          repaidDate: '',
          repaidMemberCount: acc.repaidMemberCount + curr.repaidMemberCount,
          repaymentAmount: acc.repaymentAmount + curr.repaymentAmount,
          product: acc.product + curr.product,
          interest3: acc.interest3 + curr.interest3,
          interest2_5: acc.interest2_5 + curr.interest2_5,
          balance: acc.balance + curr.balance,
          total: acc.total + curr.total
        }), { memberCount: 0, disbAmount: 0, repaidMemberCount: 0, repaymentAmount: 0, product: 0, interest3: 0, interest2_5: 0, balance: 0, total: 0 } as any);
        summaryData.push(totals);
      }

      const columns: Column<any>[] = [
        { header: 'अ. क्र.', accessorKey: 'id', render: (i) => i.id === 0 ? '' : i.id },
        { header: 'सभासद संख्या', accessorKey: 'memberCount' },
        { header: 'कर्ज वाटप मर्यादा', accessorKey: 'limit', render: (i) => i.id === 0 ? <span className="font-bold text-blue-600">{i.limit}</span> : i.limit },
        { header: 'कर्जवाटप तारीख', accessorKey: 'disbDate' },
        { header: 'कर्जवाटप रक्कम', accessorKey: 'disbAmount', render: (i) => i.disbAmount.toLocaleString() },
        { header: 'कर्जपरतफेड तारीख', accessorKey: 'repaidDate' },
        { header: 'सभासद संख्या (परतफेड)', accessorKey: 'repaidMemberCount' },
        { header: 'रक्कम (परतफेड)', accessorKey: 'repaymentAmount', render: (i) => i.repaymentAmount.toLocaleString() },
        { header: 'प्रॉडक्ट', accessorKey: 'product', render: (i) => i.product.toLocaleString() },
        { header: '3% प्रमाणे व्याज', accessorKey: 'interest3', render: (i) => i.interest3.toLocaleString(), className: 'text-blue-600' },
        { header: '2.50% प्रमाणे व्याज', accessorKey: 'interest2_5', render: (i) => i.interest2_5.toLocaleString(), className: 'text-indigo-600' },
        { header: 'चालु कर्जबाकी', accessorKey: 'balance', render: (i) => i.balance.toLocaleString() },
        { header: 'एकूण', accessorKey: 'total', render: (i) => i.total === 0 ? '-' : i.total.toLocaleString(), className: 'font-bold' },
      ];

      return (
        <div className="flex flex-col gap-4 h-full">
          {renderFYSelector()}
          <ReportTable title="Bank Incentive Summary (गोषवारा)" columns={columns} data={summaryData} enableDateFilter={false} />
        </div>
      );
    }
    return null;
  };

  const renderContent = () => {
    switch (selectedCategory) {
      case 'financial': return renderFinancial();
      case 'loan': return renderLoan();
      case 'membership': return renderMembership();
      case 'schemes': return renderSchemes();
      case 'bank_incentive': return renderBankIncentive();
      case 'inventory' as CategoryId: return renderInventory();
      default: return null;
    }
  };

  // --- Main Render ---

  if (!selectedCategory) {
    // Grid View
    return (
      <div className="p-4 md:p-8 pb-24 animate-fade-in">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
          <FileText className="text-blue-600" /> Reports Center
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {REPORT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className="group bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-800 transition-all text-left flex flex-col justify-between h-48 relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 ${cat.color} opacity-10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>

              <div>
                <div className={`w-12 h-12 ${cat.color} text-white rounded-xl flex items-center justify-center mb-4 shadow-md`}>
                  {cat.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {cat.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {cat.subTabs.length} Report Types
                </p>
              </div>

              <div className="flex items-center text-sm font-medium text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors self-start mt-4">
                View Reports <ChevronRight size={16} className="ml-1" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Details View
  const currentCategory = REPORT_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 p-4 shadow-sm z-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition text-slate-600 dark:text-slate-300">
              <ArrowLeft size={20} />
            </button>
            <div className={`p-2 rounded-lg ${currentCategory?.color} text-white`}>
              {currentCategory?.icon}
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              {currentCategory?.title}
            </h1>
          </div>

          {/* Sub-Tabs Scroller */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {currentCategory?.subTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => navigate(`/reports/${categoryId}/${tab}`)}
                className={`
                   px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                   ${activeSubTab === tab
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}
                `}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 p-4 md:pb-4 pb-24 bg-slate-50 dark:bg-slate-900 overflow-y-auto md:overflow-hidden">
        {renderContent()}
      </div>

      <SecurityPinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={confirmDelete}
        title="Confirm Deletion"
      />
    </div>
  );
};

export default Reports;
