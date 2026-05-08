import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
    subTabs: ['All Outstanding', 'Regular (FY)', 'Recovery Report', 'NPA List', 'Summary']
  },
  {
    id: 'membership',
    title: 'Membership Reports',
    icon: <Users size={24} />,
    color: 'bg-emerald-500',
    subTabs: ['Shares Capital', 'Caste Summary', 'Gender Summary', 'Gender + Category', 'Gender + Village', 'Gender Financial', 'Land Holding']
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

      // Calculate current accrued interest (NOT hiding for reports)
      let accruedInterest = 0;
      if (m.loanPrincipal > 0 && m.lastLoanCalculationDate) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const result = calculateLoanInterest(
          m.loanPrincipal,
          m.lastLoanCalculationDate,
          today,
          settings.financialYearStart,
          settings.financialYearEnd,
          false, // Show interest in reports - don't hide for first FY
          m.originalLoanDate, // Pass original loan date
          settings.firstYearInterestRate || 6,
          settings.subsequentYearInterestRate || 12
        );
        accruedInterest = result.interest;
      }

      const totalInterest = Number(m.loanInterestDue) + accruedInterest;
      const total = Number(m.loanPrincipal) + totalInterest;

      return {
        id: m.id,
        memberNo: m.memberNo,
        name: m.name,
        village: m.village,
        loanDate: loanDate,
        principal: Number(m.loanPrincipal),
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

  const renderLoan = () => {
    const columns: Column<typeof loanData[0]>[] = [
      { header: 'No.', accessorKey: 'memberNo', width: '60px' },
      {
        header: 'Name', accessorKey: 'name', className: 'font-bold text-blue-600 hover:underline',
        render: (item) => <span onClick={(e) => { e.stopPropagation(); handleMemberClick(item.id); }}>{item.name}</span>
      },
      { header: 'Village', accessorKey: 'village' },
      { header: 'Loan Date', accessorKey: 'loanDate' },
      { header: 'Principal', accessorKey: 'principal', render: (i) => `₹${i.principal.toLocaleString()}` },
      { header: 'Interest', accessorKey: 'interest', render: (i) => `₹${i.interest.toLocaleString()}` },
      { header: 'Total', accessorKey: 'total', render: (i) => `₹${i.total.toLocaleString()}` },
    ];

    // Filter logic for Loan tabs
    let displayData = loanData;

    if (activeSubTab === 'Recovery Report') {
      // Filter for Recovery Report - show only TRUE defaulters
      // Exclude current FY regular loans (01-04-2025 to 31-03-2026)
      const fyStart = new Date('2025-04-01');
      const fyEnd = new Date('2026-03-31');

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
      // Filter for Current Financial Year (01/04/2025 to 31/03/2026)
      const fyStart = new Date('2025-04-01');
      const fyEnd = new Date('2026-03-31');

      displayData = loanData.filter(item => {
        if (item.loanDate === 'N/A') return false;
        const d = new Date(item.loanDate);
        return d >= fyStart && d <= fyEnd;
      });
    }

    if (activeSubTab === 'NPA List') {
      const buckets = ['1 Year', '2 Years', '3 Years', '4 Years', '5 Years', '> 5 Years'];

      const filteredByBucket = loanData.filter(item => {
        const days = item.overdueDays;
        switch (activeBucket) {
          case '1 Year': return days > 365 && days <= 730;
          case '2 Years': return days > 730 && days <= 1095;
          case '3 Years': return days > 1095 && days <= 1460;
          case '4 Years': return days > 1460 && days <= 1825;
          case '5 Years': return days > 1825 && days <= 2190;
          case '> 5 Years': return days > 2190;
          default: return false;
        }
      });

      return (
        <div className="flex flex-col gap-4 h-full">
          <div className="flex flex-wrap gap-2 pb-2">
            {buckets.map(bucket => (
              <button
                key={bucket}
                onClick={() => setActiveBucket(bucket)}
                className={`
                  px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors flex-grow sm:flex-grow-0 text-center
                  ${activeBucket === bucket
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}
                `}
              >
                {bucket}
              </button>
            ))}
          </div>
          <ReportTable
            title={`NPA List - ${activeBucket}`}
            columns={[...columns, { header: 'Overdue Days', accessorKey: 'overdueDays' }]}
            data={filteredByBucket}
            onRowClick={(item) => handleMemberClick(item.id)}
          />
        </div>
      )
    }

    if (activeSubTab === 'Summary') {
      // Define loan categories based on Farmer Type and Member Category
      const categories = [
        { id: 1, label: 'मोठे कृषक आदिवासी', farmerType: 'Large Farmer', isTribal: true },
        { id: 2, label: 'मोठे कृषक गैर आदिवासी', farmerType: 'Large Farmer', isTribal: false },
        { id: 3, label: 'लघु कृषक आदिवासी', farmerType: 'Small Farmer', isTribal: true },
        { id: 4, label: 'लघु कृषक गैर आदिवासी', farmerType: 'Small Farmer', isTribal: false },
      ];

      // Time period buckets
      const timePeriods = [
        { key: 'total', label: 'एकूण कर्ज बाकी', minDays: 0, maxDays: Infinity },
        { key: '1yr', label: '१ वर्ष वरीत', minDays: 365, maxDays: 730 },
        { key: '2yr', label: '२ वर्ष वरीत', minDays: 730, maxDays: 1095 },
        { key: '3yr', label: '३ वर्ष वरीत', minDays: 1095, maxDays: 1460 },
        { key: '4yr', label: '४ वर्ष वरीत', minDays: 1460, maxDays: 1825 },
        { key: '5yr', label: '५ वर्ष वरीत', minDays: 1825, maxDays: 2190 },
        { key: 'above5yr', label: '५ वर्ष वरील वरीत', minDays: 2190, maxDays: Infinity },
      ];

      // Calculate summary data
      const summaryData = categories.map(category => {
        const row: any = {
          id: category.id,
          category: category.label,
        };

        // Filter members for this category
        const categoryMembers = members.filter(m => {
          if (m.farmerType !== category.farmerType) return false;
          const isTribal = m.category === 'ST';
          if (isTribal !== category.isTribal) return false;
          return m.loanPrincipal > 0;
        });

        // Calculate Total Overdue Interest for the category (including live accrued interest)
        // EXCLUDE current FY loans (01-04-2025 to 31-03-2026) - they are not defaulters yet
        const fyStart = new Date('2025-04-01');
        const fyEnd = new Date('2026-03-31');

        row.overdueInterest_amount = categoryMembers.reduce((sum, m) => {
          // Exclude current FY loans
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate;
          if (loanDate) {
            const loanDateObj = new Date(loanDate);
            if (loanDateObj >= fyStart && loanDateObj <= fyEnd) {
              return sum; // Skip current FY loans
            }
          }

          // Calculate accrued interest (same logic as loanData)
          let accruedInterest = 0;
          if (m.loanPrincipal > 0 && m.lastLoanCalculationDate) {
            const today = format(new Date(), 'yyyy-MM-dd');
            const result = calculateLoanInterest(
              m.loanPrincipal,
              m.lastLoanCalculationDate,
              today,
              settings.financialYearStart,
              settings.financialYearEnd,
              false, // Show interest in reports
              m.originalLoanDate,
              settings.firstYearInterestRate || 6,
              settings.subsequentYearInterestRate || 12
            );
            accruedInterest = result.interest;
          }
          const totalInterest = (Number(m.loanInterestDue) || 0) + accruedInterest;
          return sum + totalInterest;
        }, 0);

        row.overdueInterest_count = categoryMembers.filter(m => {
          // Exclude current FY loans
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate;
          if (loanDate) {
            const loanDateObj = new Date(loanDate);
            if (loanDateObj >= fyStart && loanDateObj <= fyEnd) {
              return false; // Skip current FY loans
            }
          }

          // Calculate accrued interest
          let accruedInterest = 0;
          if (m.loanPrincipal > 0 && m.lastLoanCalculationDate) {
            const today = format(new Date(), 'yyyy-MM-dd');
            const result = calculateLoanInterest(
              m.loanPrincipal,
              m.lastLoanCalculationDate,
              today,
              settings.financialYearStart,
              settings.financialYearEnd,
              false,
              m.originalLoanDate,
              settings.firstYearInterestRate || 6,
              settings.subsequentYearInterestRate || 12
            );
            accruedInterest = result.interest;
          }
          const totalInterest = (Number(m.loanInterestDue) || 0) + accruedInterest;
          return totalInterest > 0;
        }).length;

        timePeriods.forEach(period => {
          const filteredMembers = categoryMembers.filter(m => {
            // Calculate overdue days
            const loanDate = m.originalLoanDate || m.lastLoanCalculationDate;
            if (!loanDate) return false;

            const days = differenceInDays(new Date(), parseISO(loanDate));

            // For total, include all loans
            if (period.key === 'total') return days >= 0;

            // For specific periods, check if overdue falls in range
            return days > period.minDays && days <= period.maxDays;
          });

          // Alp Mudat (Short Term)
          const alpMembers = filteredMembers.filter(m => m.loanType === 'Short Term');
          const alp_count = alpMembers.length;
          const alp_amount = alpMembers.reduce((sum, m) => sum + m.loanPrincipal, 0);

          // Madhyam Mudat (Medium Term)
          const madhyamMembers = filteredMembers.filter(m => m.loanType === 'Medium Term');
          const madhyam_count = madhyamMembers.length;
          const madhyam_amount = madhyamMembers.reduce((sum, m) => sum + m.loanPrincipal, 0);

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

      sumProps(smallFarmerTotal, summaryData[2], summaryData[3], 'overdueInterest_amount');
      sumProps(smallFarmerTotal, summaryData[2], summaryData[3], 'overdueInterest_count');

      sumProps(tribalTotal, summaryData[0], summaryData[2], 'overdueInterest_amount');
      sumProps(tribalTotal, summaryData[0], summaryData[2], 'overdueInterest_count');

      sumProps(generalTotal, summaryData[1], summaryData[3], 'overdueInterest_amount');
      sumProps(generalTotal, summaryData[1], summaryData[3], 'overdueInterest_count');

      sumProps(grandTotal, tribalTotal, generalTotal, 'overdueInterest_amount');
      sumProps(grandTotal, tribalTotal, generalTotal, 'overdueInterest_count');

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

      // Export to CSV Function
      const handleNPASummaryCSV = async () => {
        // Prepare headers
        const headers = [
          'Category',
          ...timePeriods.flatMap(p => [
            `${p.label} - Alp Count`,
            `${p.label} - Alp Amount`,
            `${p.label} - Madhyam Count`,
            `${p.label} - Madhyam Amount`
          ]),
          'Total Overdue Interest Count',
          'Total Overdue Interest Amount'
        ];

        // Prepare data rows
        const rows = [
          ...summaryData,
          largeFarmerTotal,
          smallFarmerTotal,
          tribalTotal,
          generalTotal,
          grandTotal
        ].map(row => [
          row.category,
          ...timePeriods.flatMap(p => [
            row[`${p.key}_alp_count`] || 0,
            row[`${p.key}_alp_amount`] || 0,
            row[`${p.key}_madhyam_count`] || 0,
            row[`${p.key}_madhyam_amount`] || 0
          ]),
          row.overdueInterest_count || 0,
          row.overdueInterest_amount || 0
        ]);

        // Export using shared utility for proper Excel Unicode support
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "NPA Summary");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `NPA_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

        await showConfirm({
          title: 'Export Successful!',
          titleMr: 'एक्सपोर्ट यशस्वी झाले!',
          message: 'NPA Summary report exported successfully to Excel.',
          messageMr: 'NPA Summary रिपोर्ट एक्सेलमध्ये यशस्वीपणे एक्सपोर्ट झाला.',
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
      return (
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
      );
    }




    return <ReportTable title={`${activeSubTab} Report`} columns={columns} data={displayData} onRowClick={(item) => handleMemberClick(item.id)} />;
  };

  const renderMembership = () => {
    if (activeSubTab === 'Shares Capital') {
      const columns = [
        { header: 'No.', accessorKey: 'id', width: '60px' },
        { header: 'Name', accessorKey: 'name' },
        { header: 'Share Bal', accessorKey: 'shareBalance', render: (i: any) => `₹${i.shareBalance}` },
        { header: 'Dividend', accessorKey: 'dividend', render: (i: any) => `₹${i.dividend}` },
        { header: 'Mobile', accessorKey: 'mobile' },
      ];
      return <ReportTable title="Shares Capital" columns={columns} data={memberReportData} onRowClick={(item) => handleMemberClick(item.realId)} />;
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
          <div className="flex-1 overflow-auto p-6">
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
          <div className="flex-1 overflow-auto p-6">
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
          <div className="flex-1 overflow-auto p-6">
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
              settings.subsequentYearInterestRate || 12
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
          <div className="flex-1 overflow-auto p-6">
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
    if (activeSubTab === 'Dr. P. Deshmukh Incentive') {
      const startDate = new Date('2025-04-01');
      const endDate = new Date('2026-06-30');

      const incentiveData = members
        .filter(m => {
          if (!m.currentLoanRequestDate && !m.lastLoanCalculationDate && !m.originalLoanDate) return false;
          const dStr = m.originalLoanDate || m.lastLoanCalculationDate || '2025-04-01';
          const d = new Date(dStr);
          return d >= startDate && d <= endDate;
        })
        .map((m, idx) => {
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate || '2025-04-01';
          const isRepaid = m.loanPrincipal === 0;
          const principal = m.loanPrincipal > 0 ? m.loanPrincipal : 50000;
          const days = differenceInDays(new Date(), new Date(loanDate));
          const productValue = principal * days;
          const productStr = productValue.toLocaleString();
          const incentive = isRepaid ? Math.round(principal * 0.03) : null;

          return {
            id: idx + 1,
            name: m.name,
            category: m.category,
            village: m.village,
            loanDate: loanDate,
            repaymentDate: isRepaid ? 'Paid (परतफेड)' : 'Ongoing (सुरु)',
            days: days,
            principal: principal,
            product: productStr,
            subsidy: incentive,
            bankAccount: m.bankAccountNo || 'N/A'
          };
        });

      const columns: Column<typeof incentiveData[0]>[] = [
        { header: 'अ. क्र.', accessorKey: 'id', width: '50px' },
        { header: 'सभासदांचे नाव', accessorKey: 'name', className: 'font-bold text-slate-700' },
        { header: 'प्रवर्ग', accessorKey: 'category' },
        { header: 'गांव', accessorKey: 'village' },
        { header: 'कर्ज तारीख', accessorKey: 'loanDate' },
        { header: 'परतफेड दिनांक', accessorKey: 'repaymentDate' },
        { header: 'दिवस', accessorKey: 'days' },
        { header: 'मुद्दल', accessorKey: 'principal', render: (i) => `₹${i.principal.toLocaleString()}` },
        { header: 'प्रॉडक्ट', accessorKey: 'product', width: '200px', className: 'text-xs font-mono text-slate-600' },
        {
          header: '3% व्याज सवलत रक्कम',
          accessorKey: 'subsidy',
          render: (i) => i.subsidy ? `₹${i.subsidy.toLocaleString()}` : '',
          className: 'font-bold text-green-600 text-center'
        },
        { header: 'बँक खाते', accessorKey: 'bankAccount', className: 'font-mono text-xs' },
      ];

      return <ReportTable title="Dr. P. Deshmukh Interest Subvention (3%)" columns={columns} data={incentiveData} />;
    }

    if (activeSubTab === 'Summary') {
      const startDate = new Date('2025-04-01');
      const endDate = new Date('2026-06-30');

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
        const filteredMembers = members.filter(m => {
          if (m.category !== cat) return false;

          // Only include members with active loans (current borrowers)
          if ((m.loanPrincipal || 0) <= 0) return false;

          const dStr = m.originalLoanDate || m.lastLoanCalculationDate || '2025-04-01';
          const d = new Date(dStr);
          return d >= startDate && d <= endDate;
        });

        let disbursement = 0, repayment = 0, totalProduct = 0, incentive = 0;

        filteredMembers.forEach(m => {
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate || '2025-04-01';
          const principal = m.loanPrincipal > 0 ? m.loanPrincipal : 50000;
          const days = differenceInDays(new Date(), new Date(loanDate));
          const isRepaid = m.loanPrincipal === 0;

          disbursement += principal;
          if (isRepaid) repayment += principal;
          totalProduct += principal * days;
          if (isRepaid) incentive += Math.round(principal * 0.03);
        });

        return {
          id: idx + 1,
          category: getCategoryLabel(cat),
          crop: 'भात पिक',
          memberCount: filteredMembers.length,
          disbursement,
          repayment,
          product: totalProduct,
          subsidy: incentive,
          totalBenefit: incentive
        };
      }).filter(item => item.memberCount > 0);

      if (summaryData.length > 0) {
        const totals = summaryData.reduce((acc, curr) => ({
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
        summaryData.push(totals);
      }

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

      return <ReportTable title="Govt Schemes Summary (एकत्रीकरण)" columns={columns} data={summaryData} />;
    }

    return <div className="p-8 text-center text-slate-500">Feature '{activeSubTab}' is under development.</div>;
  };

  const renderBankIncentive = () => {
    if (activeSubTab === 'Within ₹50,000' || activeSubTab === 'Above ₹50,000') {
      const isAbove = activeSubTab === 'Above ₹50,000';
      const startDate = new Date('2025-04-01');
      const endDate = new Date('2026-03-31');

      const incentiveData = members
        .filter(m => {
          // Target Year Check: लोन तारीख FY 2025-26 मध्ये असावी
          const dStr = m.originalLoanDate || m.lastLoanCalculationDate;
          if (!dStr) return false;
          const d = new Date(dStr);
          if (!(d >= startDate && d <= endDate)) return false;

          // कर्ज रक्कम निश्चित करा: चालू कर्ज > DEBIT txn > principalPaid > 0
          // व्याजासकट रक्कम (repayment amount) वापरू नये - फक्त मुद्दल
          let effectiveAmount = 0;
          if (m.loanPrincipal > 0) {
            effectiveAmount = m.loanPrincipal; // अजून कर्ज बाकी आहे
          } else {
            // कर्ज परतफेड झाले - transaction मधून फक्त मुद्दल शोधा
            const loanDebitTxn = transactions
              .filter(t => t.memberId === m.id && t.type === 'Debit' && t.accountType === 'Loan')
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const loanCreditTxn = transactions
              .filter(t => t.memberId === m.id && t.type === 'Credit' && t.accountType === 'Loan')
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            // principalPaid वापरा (व्याज वगळून), नसल्यास DEBIT amount वापरा
            effectiveAmount = loanDebitTxn?.amount || loanCreditTxn?.principalPaid || 0;
          }

          if (effectiveAmount === 0) return false;
          const matchesThreshold = isAbove ? effectiveAmount > 50000 : effectiveAmount <= 50000;
          return matchesThreshold;
        })
        .map((m, idx) => {
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate || '2025-04-01';
          const isRepaid = m.loanPrincipal === 0;

          // Actual loan amount: DEBIT LOAN txn मधून मुद्दल रक्कम शोधा
          const loanDebitTxn = transactions
            .filter(t => t.memberId === m.id && t.type === 'Debit' && t.accountType === 'Loan')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

          // Actual repayment: सर्वात शेवटचा CREDIT LOAN transaction
          const repaymentTxn = isRepaid
            ? transactions
                .filter(t => t.memberId === m.id && t.type === 'Credit' && t.accountType === 'Loan')
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
            : null;

          // कर्ज रक्कम: फक्त मुद्दल (principalPaid > DEBIT amount > current principal)
          // व्याजासकट रक्कम दाखवू नये
          const actualLoanAmount = loanDebitTxn?.amount
            || (isRepaid ? (repaymentTxn?.principalPaid || m.loanPrincipal || 0) : m.loanPrincipal);

          // 31 मार्च 2026 ची कटऑफ तारीख
          const cutoffDate = new Date('2026-03-31');
          const repaymentDate = repaymentTxn ? repaymentTxn.date : '-';

          // परतफेड 31 मार्च पूर्वी झाली का?
          const repaidBeforeCutoff = repaymentTxn
            ? new Date(repaymentTxn.date) <= cutoffDate
            : false;

          // फक्त 31 मार्च पूर्वी परतफेड केलेल्यांना रक्कम दाखवा - व्याज वगळून फक्त मुद्दल
          const repaymentAmount = repaidBeforeCutoff
            ? (repaymentTxn?.principalPaid || actualLoanAmount)
            : 0;

          const days = repaidBeforeCutoff && repaymentTxn
            ? differenceInDays(new Date(repaymentDate), new Date(loanDate))
            : 0;
          const productValue = repaidBeforeCutoff ? (actualLoanAmount * days) : 0;

          // व्याज फक्त 31 मार्च पूर्वी परतफेड झाल्यासच दाखवा
          const interest3 = repaidBeforeCutoff ? Math.round((productValue * 0.03) / 365) : null;
          const interest2_5 = repaidBeforeCutoff ? Math.round((productValue * 0.025) / 365) : null;

          return {
            id: idx + 1,
            name: m.name,
            loanDate: loanDate,
            loanAmount: actualLoanAmount,
            repaymentDate: repaidBeforeCutoff ? repaymentDate : '-',
            repaymentAmount: repaymentAmount,
            days: days > 0 ? days : 0,
            product: productValue,
            interest3: interest3,
            interest2_5: interest2_5
          };
        });

      const columns: Column<any>[] = [
        { header: 'अ. क्र.', accessorKey: 'id', width: '50px' },
        { header: 'सभासदांचे नाव', accessorKey: 'name', className: 'font-bold' },
        { header: 'कर्ज तारीख', accessorKey: 'loanDate' },
        { header: 'कर्ज रक्कम', accessorKey: 'loanAmount', render: (i) => `₹${i.loanAmount.toLocaleString()}` },
        { header: 'परतफेड तारीख', accessorKey: 'repaymentDate' },
        { header: 'परतफेड रक्कम', accessorKey: 'repaymentAmount', render: (i) => i.repaymentAmount > 0 ? `₹${i.repaymentAmount.toLocaleString()}` : '-' },
        { header: 'दिवस', accessorKey: 'days', render: (i) => i.days > 0 ? i.days : '-' },
        { header: 'प्रॉडक्ट', accessorKey: 'product', render: (i) => i.product > 0 ? i.product.toLocaleString() : '-' },
        { header: '3% व्याज', accessorKey: 'interest3', render: (i) => i.interest3 ? `₹${i.interest3.toLocaleString()}` : '-', className: 'text-blue-600 font-bold text-center' },
        { header: '2.50% व्याज', accessorKey: 'interest2_5', render: (i) => i.interest2_5 ? `₹${i.interest2_5.toLocaleString()}` : '-', className: 'text-indigo-600 font-bold text-center' },
      ];

      return <ReportTable title={`Bank Incentive - ${activeSubTab}`} columns={columns} data={incentiveData} />;
    }

    if (activeSubTab === 'Summary') {
      const startDate = new Date('2025-04-01');
      const endDate = new Date('2026-03-31');

      const limits = [
        { title: '50,000 /- पावेतो', threshold: 50000, above: false },
        { title: '50,000 /- चे वरील', threshold: 50000, above: true }
      ];

      const summaryData = limits.map((l, idx) => {
        const filtered = members.filter(m => {
          const principal = m.loanPrincipal > 0 ? m.loanPrincipal : (m.originalLoanDate ? 50000 : 0);
          if (principal === 0) return false;

          const matches = l.above ? principal > l.threshold : principal <= l.threshold;
          if (!matches) return false;

          const dStr = m.originalLoanDate || m.lastLoanCalculationDate || '2025-04-01';
          const d = new Date(dStr);
          return d >= startDate && d <= endDate;
        });

        let disbursement = 0, repayment = 0, product = 0, int3 = 0, int2_5 = 0, repaidCount = 0;

        filtered.forEach(m => {
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate || '2025-04-01';
          const isRepaid = m.loanPrincipal === 0;
          const principal = l.above ? (isRepaid ? 120000 : m.loanPrincipal) : (isRepaid ? 45000 : m.loanPrincipal);

          disbursement += principal;
          if (isRepaid) {
            repaidCount++;
            repayment += principal;
            // Mock product & interest for summary based on FY 25-26
            const days = differenceInDays(new Date('2025-12-15'), new Date(loanDate));
            const prod = principal * days;
            product += prod;
            int3 += Math.round((prod * 0.03) / 365);
            int2_5 += Math.round((prod * 0.025) / 365);
          }
        });

        const balance = disbursement - repayment;

        return {
          id: idx + 1,
          memberCount: filtered.length,
          limit: l.title,
          disbDate: '-',
          disbAmount: disbursement,
          repaidDate: '31.03.2025',
          repaidMemberCount: repaidCount,
          repaymentAmount: repayment,
          product: product,
          interest3: int3,
          interest2_5: int2_5,
          balance: balance,
          total: repayment + balance
        };
      });

      // Total Row
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
        { header: 'एकुण', accessorKey: 'total', render: (i) => i.total === 0 ? '-' : i.total.toLocaleString(), className: 'font-bold' },
      ];

      return <ReportTable title="Bank Incentive Summary (गोषवारा)" columns={columns} data={summaryData} />;
    }

    return <div className="p-8 text-center text-slate-500">Feature '{activeSubTab}' is under development.</div>;
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
      <div className="flex-1 overflow-auto p-4 pb-24 bg-slate-50 dark:bg-slate-900">
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
