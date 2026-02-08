
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { format } from 'date-fns';
import { Receipt, Plus, PieChart as PieIcon, Trash2, X, TrendingDown, Eye, AlertCircle, Sparkles, CheckCircle, Users, Calendar, CreditCard, FileText, Download, Share2 } from 'lucide-react';
import { TransactionType, StaffSalary } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { downloadBlob } from '../utils/downloadUtils';
import * as XLSX from 'xlsx';

const EXPENSE_CATEGORIES = [
    'Office Expenses (कार्यालयीन खर्च)',
    'Salary (पगार)',
    'Tea/Refreshment (चहा-पाणी)',
    'Stationery (स्टेशनरी)',
    'Travel (प्रवास खर्च)',
    'Maintenance (देखभाल)',
    'Electricity (वीज बिल)',
    'Audit Fees (ऑडिट फी)',
    'Other (इतर)'
];

const DESIGNATIONS = [
    'Manager (व्यवस्थापक)',
    'Accountant (लेखापाल)',
    'Clerk (लिपिक)',
    'Peon (चपराशी)',
    'Security Guard (सुरक्षा रक्षक)',
    'Daily Worker (रोजनदार)',
    'Other (इतर)'
];

const MARATHI_MONTHS: Record<string, string> = {
    '01': 'जानेवारी', '02': 'फेब्रुवारी', '03': 'मार्च', '04': 'एप्रिल',
    '05': 'मे', '06': 'जून', '07': 'जुलै', '08': 'ऑगस्ट',
    '09': 'सप्टेंबर', '10': 'ऑक्टोबर', '11': 'नोव्हेंबर', '12': 'डिसेंबर'
};

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7'];

const Expenses = () => {
    const { transactions, addTransaction, deleteTransaction, societyBanks, staffSalaries, addStaffSalary, updateStaffSalary, deleteStaffSalary, settings } = useApp();
    const { showConfirm } = useDialog();

    // Tab State
    const [activeTab, setActiveTab] = useState<'expenses' | 'salary'>('expenses');

    // Expense Modal State
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [viewReceipt, setViewReceipt] = useState<string | null>(null);
    const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [monthlyBudget, setMonthlyBudget] = useState<number>(20000);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [amount, setAmount] = useState<number>(0);
    const [details, setDetails] = useState('');
    const [bankId, setBankId] = useState<string>('Cash');
    const [receiptBase64, setReceiptBase64] = useState<string>('');

    // Salary Modal State
    const [showSalaryModal, setShowSalaryModal] = useState(false);
    const [editingSalary, setEditingSalary] = useState<StaffSalary | null>(null);
    const [salaryForm, setSalaryForm] = useState({
        employeeName: '',
        designation: DESIGNATIONS[0],
        employeeType: 'Permanent' as 'Permanent' | 'Daily Wage' | 'Contract',
        month: format(new Date(), 'yyyy-MM'),
        grossSalary: 0,
        deductions: 0,
        accountNumber: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        paymentStatus: 'Pending' as 'Paid' | 'Pending' | 'Partial',
        paymentMode: 'Bank Transfer' as 'Cash' | 'Bank Transfer' | 'Cheque',
        remarks: ''
    });

    // Salary Filters
    const [salaryFilterMonth, setSalaryFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [salaryFilterStatus, setSalaryFilterStatus] = useState<'All' | 'Paid' | 'Pending' | 'Partial'>('All');
    const [salaryFilterEmployee, setSalaryFilterEmployee] = useState<string>('All');

    // Filter expenses
    const expenses = useMemo(() => {
        return transactions.filter(t =>
            t.type === TransactionType.DEBIT &&
            (t.accountType === 'Expense' || (t.accountType === 'BankTransfer' && t.details.includes("Expense"))) &&
            t.date.startsWith(filterMonth)
        ).sort((a, b) => b.timestamp - a.timestamp);
    }, [transactions, filterMonth]);

    const totalExpense = useMemo(() => expenses.reduce((sum, t) => sum + t.amount, 0), [expenses]);
    const budgetProgress = Math.min(100, (totalExpense / monthlyBudget) * 100);

    const chartData = useMemo(() => {
        const grouped: Record<string, number> = {};
        expenses.forEach(t => {
            const cat = t.expenseCategory || 'Other';
            const shortCat = cat.split('(')[0].trim();
            grouped[shortCat] = (grouped[shortCat] || 0) + t.amount;
        });
        return Object.entries(grouped).map(([name, value]) => ({ name, value }));
    }, [expenses]);

    // Filter salaries
    const filteredSalaries = useMemo(() => {
        return staffSalaries.filter(s => {
            const matchesMonth = s.month === salaryFilterMonth;
            const matchesStatus = salaryFilterStatus === 'All' || s.paymentStatus === salaryFilterStatus;
            const matchesEmployee = salaryFilterEmployee === 'All' || s.employeeName === salaryFilterEmployee;
            return matchesMonth && matchesStatus && matchesEmployee;
        }).sort((a, b) => b.timestamp - a.timestamp);
    }, [staffSalaries, salaryFilterMonth, salaryFilterStatus, salaryFilterEmployee]);

    // Get unique employee names for dropdown
    const uniqueEmployees = useMemo(() => {
        const names = new Set(staffSalaries.map(s => s.employeeName));
        return Array.from(names).sort();
    }, [staffSalaries]);

    const salaryStats = useMemo(() => {
        const monthSalaries = staffSalaries.filter(s => s.month === salaryFilterMonth);
        const totalSalary = monthSalaries.reduce((sum, s) => sum + s.netPayable, 0);
        const paidCount = monthSalaries.filter(s => s.paymentStatus === 'Paid').length;
        const pendingAmount = monthSalaries.filter(s => s.paymentStatus === 'Pending').reduce((sum, s) => sum + s.netPayable, 0);
        return { totalSalary, paidCount, pendingAmount, totalCount: monthSalaries.length };
    }, [staffSalaries, salaryFilterMonth]);

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setReceiptBase64(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleExpenseSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const transaction: any = {
            id: Date.now().toString(),
            date,
            type: TransactionType.DEBIT,
            accountType: bankId === 'Cash' ? 'Expense' : 'BankTransfer',
            bankId: bankId === 'Cash' ? undefined : bankId,
            amount,
            details: `${details}${bankId !== 'Cash' ? ' (Paid via Bank)' : ''}`,
            expenseCategory: category,
            memberId: null,
            timestamp: Date.now(),
            receiptUrl: receiptBase64
        };
        addTransaction(transaction);
        setShowExpenseModal(false);
        setAmount(0);
        setDetails('');
        setReceiptBase64('');
        setBankId('Cash');
    };

    const handleSalarySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const netPayable = salaryForm.grossSalary - salaryForm.deductions;

        const salary: StaffSalary = {
            id: editingSalary?.id || Date.now().toString(),
            employeeName: salaryForm.employeeName,
            designation: salaryForm.designation,
            employeeType: salaryForm.employeeType,
            month: salaryForm.month,
            grossSalary: salaryForm.grossSalary,
            deductions: salaryForm.deductions,
            netPayable: netPayable,
            accountNumber: salaryForm.accountNumber,
            paymentDate: salaryForm.paymentDate,
            paymentStatus: salaryForm.paymentStatus,
            paymentMode: salaryForm.paymentMode,
            remarks: salaryForm.remarks,
            timestamp: editingSalary?.timestamp || Date.now()
        };

        if (editingSalary) {
            updateStaffSalary(salary);
        } else {
            addStaffSalary(salary);
        }

        setShowSalaryModal(false);
        setEditingSalary(null);
        resetSalaryForm();
    };

    const resetSalaryForm = () => {
        setSalaryForm({
            employeeName: '',
            designation: DESIGNATIONS[0],
            employeeType: 'Permanent',
            month: format(new Date(), 'yyyy-MM'),
            grossSalary: 0,
            deductions: 0,
            accountNumber: '',
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            paymentStatus: 'Pending',
            paymentMode: 'Bank Transfer',
            remarks: ''
        });
    };

    const handleEditSalary = (salary: StaffSalary) => {
        setEditingSalary(salary);
        setSalaryForm({
            employeeName: salary.employeeName,
            designation: salary.designation,
            employeeType: salary.employeeType,
            month: salary.month,
            grossSalary: salary.grossSalary,
            deductions: salary.deductions,
            accountNumber: salary.accountNumber,
            paymentDate: salary.paymentDate,
            paymentStatus: salary.paymentStatus,
            paymentMode: salary.paymentMode || 'Bank Transfer',
            remarks: salary.remarks || ''
        });
        setShowSalaryModal(true);
    };

    const handleDeleteSalary = (id: string) => {
        const pin = window.prompt('सुरक्षा PIN प्रविष्ट करा:');
        if (pin === settings.securityPin) {
            deleteStaffSalary(id);
        } else {
            alert('चुकीचा PIN!');
        }
    };

    const handleExportSalaryCSV = () => {
        const [year, month] = salaryFilterMonth.split('-');
        const monthName = MARATHI_MONTHS[month] || month;

        const headers = [
            'Employee Name',
            'Designation',
            'Type',
            'Month',
            'Gross Salary',
            'Deductions',
            'Net Payable',
            'Account Number',
            'Payment Date',
            'Payment Status',
            'Payment Mode',
            'Remarks'
        ];

        const rows = filteredSalaries.map(s => [
            s.employeeName,
            s.designation,
            s.employeeType,
            `${monthName} ${year}`,
            s.grossSalary.toString(),
            s.deductions.toString(),
            s.netPayable.toString(),
            s.accountNumber || '-',
            format(new Date(s.paymentDate), 'dd/MM/yyyy'),
            s.paymentStatus,
            s.paymentMode || 'Bank Transfer',
            s.remarks || '-'
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Salary");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        downloadBlob(blob, `Salary_${monthName}_${year}.xlsx`);
    };

    const handleShareSalary = async () => {
        const [year, month] = salaryFilterMonth.split('-');
        const monthName = MARATHI_MONTHS[month] || month;

        let text = `📊 *Staff Salary Report - ${monthName} ${year}*\n\n`;
        text += `Total Salaries: ₹${salaryStats.totalSalary.toLocaleString()}\n`;
        text += `Paid: ${salaryStats.paidCount}/${salaryStats.totalCount}\n`;
        text += `Pending: ₹${salaryStats.pendingAmount.toLocaleString()}\n\n`;
        text += `*Salary Details:*\n`;

        filteredSalaries.forEach((s, i) => {
            text += `\n${i + 1}. ${s.employeeName} (${s.designation.split('(')[0].trim()})\n`;
            text += `   Gross: ₹${s.grossSalary.toLocaleString()} | Deductions: ₹${s.deductions.toLocaleString()}\n`;
            text += `   Net: ₹${s.netPayable.toLocaleString()} | Status: ${s.paymentStatus}\n`;
        });

        try {
            const shareUrl = 'https://society-ilada1425.vercel.app' + window.location.hash;
            if (Capacitor.isNativePlatform()) {
                await Share.share({
                    title: `Salary Report - ${monthName} ${year}`,
                    text: text,
                    url: shareUrl,
                    dialogTitle: 'Share Salary Report'
                });
            } else if (navigator.share) {
                await navigator.share({
                    title: `Salary Report - ${monthName} ${year}`,
                    text: text,
                    url: shareUrl
                });
            } else {
                alert('Sharing is not supported on this device/browser.');
            }
        } catch (error) {
            console.log('Error sharing:', error);
        }
    };


    return (
        <div className="p-4 md:p-6 pb-24 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Receipt className="text-red-600" /> Expense Manager
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">खर्च व्यवस्थापन व बजेट ट्रॅकिंग</p>
                </div>
                <button
                    onClick={() => activeTab === 'expenses' ? setShowExpenseModal(true) : setShowSalaryModal(true)}
                    className="bg-red-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-red-700 transition shadow-lg font-black text-sm active:scale-95"
                >
                    <Plus size={18} /> {activeTab === 'salary' ? 'ADD SALARY' : 'ADD EXPENSE'}
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-6 py-3 rounded-xl font-black text-sm transition-all whitespace-nowrap ${activeTab === 'expenses'
                        ? 'bg-red-600 text-white shadow-lg'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                >
                    खर्च (Expenses)
                </button>
                <button
                    onClick={() => setActiveTab('salary')}
                    className={`px-6 py-3 rounded-xl font-black text-sm transition-all whitespace-nowrap ${activeTab === 'salary'
                        ? 'bg-red-600 text-white shadow-lg'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                >
                    कर्मचारी पगार (Staff Salary)
                </button>
            </div>

            {/* Expenses Tab Content */}
            {activeTab === 'expenses' && (
                <>
                    {/* Budget Tracker & Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="md:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Monthly Budget Status</span>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-white">₹{totalExpense.toLocaleString()} / ₹{monthlyBudget.toLocaleString()}</h4>
                                </div>
                                <span className={`text-xs font-black ${budgetProgress > 90 ? 'text-red-600' : 'text-green-600'}`}>{budgetProgress.toFixed(0)}% Used</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-900 h-3 rounded-full overflow-hidden border dark:border-slate-700">
                                <div
                                    className={`h-full transition-all duration-500 ${budgetProgress > 90 ? 'bg-red-500' : budgetProgress > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                                    style={{ width: `${budgetProgress}%` }}
                                />
                            </div>
                            {budgetProgress > 90 && (
                                <p className="text-[10px] text-red-500 mt-2 font-bold flex items-center gap-1"><AlertCircle size={12} /> Warning: Monthly budget almost exhausted!</p>
                            )}
                        </div>

                        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex flex-col justify-center border-b-4 border-red-500">
                            <label className="text-[10px] font-black text-slate-500 uppercase">Total Spent this Month</label>
                            <div className="flex items-center justify-between">
                                <span className="text-2xl font-black text-red-400">₹{totalExpense.toLocaleString()}</span>
                                <div className="p-2 bg-red-900/30 rounded-lg text-red-400"><TrendingDown size={24} /></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* List Section */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 overflow-hidden">
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                                    <h3 className="text-sm font-black uppercase text-slate-500">Recent Transactions</h3>
                                    <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-xs p-1.5 border rounded bg-white dark:bg-slate-800 dark:border-slate-600 font-bold" />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {expenses.length === 0 ? (
                                                <tr><td className="p-10 text-center text-slate-400 italic">No records for this month.</td></tr>
                                            ) : expenses.map(t => (
                                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                                                    <td className="p-4">
                                                        <div className="font-black text-slate-800 dark:text-white">{t.expenseCategory?.split('(')[0]}</div>
                                                        <div className="text-[10px] text-slate-500 font-bold">{format(new Date(t.date), 'dd MMM yyyy')} • {t.details}</div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {t.receiptUrl && (
                                                            <button onClick={() => setViewReceipt(t.receiptUrl!)} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition"><Eye size={16} /></button>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="font-black text-red-600 dark:text-red-400 text-base">₹{t.amount.toLocaleString()}</div>
                                                        <div className="text-[9px] text-slate-400 uppercase font-black">{t.bankId ? 'Bank' : 'Cash'}</div>
                                                    </td>
                                                    <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={async () => {
                                                            const confirmed = await showConfirm({
                                                                title: 'Delete Expense?',
                                                                titleMr: 'खर्च हटवायचा?',
                                                                message: 'This expense record will be permanently deleted.',
                                                                messageMr: 'हा खर्च रेकॉर्ड कायमचा हटवला जाईल.',
                                                                icon: '🗑️',
                                                                confirmText: 'Delete',
                                                                confirmTextMr: 'हटवा',
                                                                confirmColor: 'red'
                                                            });
                                                            if (confirmed) deleteTransaction(t.id);
                                                        }} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Section */}
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                                <h3 className="text-sm font-black uppercase text-slate-500 mb-6 flex items-center gap-2"><PieIcon size={16} /> Spending Split</h3>
                                <div className="h-64 w-full">
                                    {chartData.length > 0 && (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                                                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '12px', fontWeight: 'bold' }} formatter={(val: any) => `₹${val}`} />
                                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-xl text-white relative overflow-hidden">
                                <Sparkles className="absolute -right-2 -top-2 opacity-20" size={80} />
                                <h4 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles size={16} /> AI Insight</h4>
                                <p className="text-xs font-medium leading-relaxed opacity-90">
                                    या महिन्यात 'चहा-पाणी' खर्च मागील महिन्यापेक्षा १२% ने कमी झाला आहे. 'स्टेशनरी' खर्च सर्वात जास्त आहे, शक्य असल्यास ठोक खरेदीचा विचार करा.
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Staff Salary Tab Content */}
            {activeTab === 'salary' && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Total Salaries</span>
                                    <h4 className="text-2xl font-black text-slate-800 dark:text-white">₹{salaryStats.totalSalary.toLocaleString()}</h4>
                                </div>
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <span className="text-blue-600 dark:text-blue-400 text-3xl font-black">₹</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Paid Count</span>
                                    <h4 className="text-2xl font-black text-green-600 dark:text-green-400">{salaryStats.paidCount} / {salaryStats.totalCount}</h4>
                                </div>
                                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                    <CheckCircle className="text-green-600 dark:text-green-400" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Pending Amount</span>
                                    <h4 className="text-2xl font-black text-orange-600 dark:text-orange-400">₹{salaryStats.pendingAmount.toLocaleString()}</h4>
                                </div>
                                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                                    <AlertCircle className="text-orange-600 dark:text-orange-400" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Month</label>
                                <input
                                    type="month"
                                    value={salaryFilterMonth}
                                    onChange={e => setSalaryFilterMonth(e.target.value)}
                                    className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Payment Status</label>
                                <select
                                    value={salaryFilterStatus}
                                    onChange={e => setSalaryFilterStatus(e.target.value as any)}
                                    className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                >
                                    <option value="All">All</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Partial">Partial</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">कर्मचारी निवडा (Select Employee)</label>
                                <select
                                    value={salaryFilterEmployee}
                                    onChange={e => setSalaryFilterEmployee(e.target.value)}
                                    className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                >
                                    <option value="All">सर्व (All)</option>
                                    {uniqueEmployees.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Salary List */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 overflow-hidden">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-sm font-black uppercase text-slate-500">Salary Records</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExportSalaryCSV}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 transition font-bold text-xs active:scale-95"
                                    title="Export to CSV"
                                >
                                    <Download size={16} /> CSV
                                </button>
                                <button
                                    onClick={handleShareSalary}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition font-bold text-xs active:scale-95"
                                    title="Share Report"
                                >
                                    <Share2 size={16} /> SHARE
                                </button>
                            </div>
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                            <div className="min-w-[800px]">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-900">
                                        <tr>
                                            <th className="p-3 font-black text-[10px] uppercase text-slate-600 dark:text-slate-400 whitespace-nowrap">Employee</th>
                                            <th className="p-3 font-black text-[10px] uppercase text-slate-600 dark:text-slate-400 whitespace-nowrap">Month</th>
                                            <th className="p-3 font-black text-[10px] uppercase text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">Gross</th>
                                            <th className="p-3 font-black text-[10px] uppercase text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">Deductions</th>
                                            <th className="p-3 font-black text-[10px] uppercase text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">Net Payable</th>
                                            <th className="p-3 font-black text-[10px] uppercase text-slate-600 dark:text-slate-400 whitespace-nowrap">Status</th>
                                            <th className="p-3 font-black text-[10px] uppercase text-slate-600 dark:text-slate-400 whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-slate-700">
                                        {filteredSalaries.length === 0 ? (
                                            <tr><td colSpan={7} className="p-10 text-center text-slate-400 italic">No salary records found.</td></tr>
                                        ) : filteredSalaries.map(salary => {
                                            const [year, month] = salary.month.split('-');
                                            const monthName = MARATHI_MONTHS[month] || month;
                                            return (
                                                <tr key={salary.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                                                    <td className="p-3">
                                                        <div className="font-black text-slate-800 dark:text-white">{salary.employeeName}</div>
                                                        <div className="text-[10px] text-slate-500 font-bold">{salary.designation.split('(')[0]}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">{monthName} {year}</div>
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-300">₹{salary.grossSalary.toLocaleString()}</td>
                                                    <td className="p-3 text-right font-bold text-red-600 dark:text-red-400">₹{salary.deductions.toLocaleString()}</td>
                                                    <td className="p-3 text-right font-black text-green-600 dark:text-green-400 text-base">₹{salary.netPayable.toLocaleString()}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${salary.paymentStatus === 'Paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                            salary.paymentStatus === 'Pending' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                                                                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                            }`}>
                                                            {salary.paymentStatus}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleEditSalary(salary)} className="text-blue-600 hover:text-blue-700"><FileText size={16} /></button>
                                                            <button onClick={() => handleDeleteSalary(salary.id)} className="text-red-600 hover:text-red-700"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3 p-4">
                            {filteredSalaries.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 italic">No salary records found.</div>
                            ) : filteredSalaries.map(salary => {
                                const [year, month] = salary.month.split('-');
                                const monthName = MARATHI_MONTHS[month] || month;
                                return (
                                    <div key={salary.id} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border dark:border-slate-700">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="font-black text-slate-800 dark:text-white text-base">{salary.employeeName}</div>
                                                <div className="text-xs text-slate-500 font-bold">{salary.designation.split('(')[0]}</div>
                                                <div className="text-xs text-slate-400 mt-1">{monthName} {year}</div>
                                            </div>
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${salary.paymentStatus === 'Paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                salary.paymentStatus === 'Pending' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                                                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                }`}>
                                                {salary.paymentStatus}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase font-bold">Gross</div>
                                                <div className="font-bold text-slate-700 dark:text-slate-300">₹{salary.grossSalary.toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase font-bold">Deductions</div>
                                                <div className="font-bold text-red-600 dark:text-red-400">₹{salary.deductions.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg mb-3">
                                            <div className="text-[10px] text-green-700 dark:text-green-400 uppercase font-bold">Net Payable</div>
                                            <div className="font-black text-green-700 dark:text-green-400 text-lg">₹{salary.netPayable.toLocaleString()}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEditSalary(salary)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition font-bold text-xs">
                                                <FileText size={14} /> Edit
                                            </button>
                                            <button onClick={() => handleDeleteSalary(salary.id)} className="flex-1 bg-red-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 transition font-bold text-xs">
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Add Expense Modal */}
            {showExpenseModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border dark:border-slate-700 overflow-hidden animate-fade-in-up">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-black text-lg">NEW EXPENSE</h3>
                            <button onClick={() => setShowExpenseModal(false)} className="bg-slate-800 p-1.5 rounded-full"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Date</label>
                                    <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Paid Via</label>
                                    <select value={bankId} onChange={e => setBankId(e.target.value)} className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold">
                                        <option value="Cash">Cash (रोख)</option>
                                        {societyBanks.map(b => <option key={b.id} value={b.id}>{b.bankName} ({b.accountNo})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold">
                                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Amount (₹)</label>
                                <input type="number" required min="1" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} className="w-full p-3 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-2xl font-black text-red-600" placeholder="0.00" />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Details</label>
                                <input type="text" required value={details} onChange={e => setDetails(e.target.value)} className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold" placeholder="तपशील..." />
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition shadow-xl active:scale-95">SAVE EXPENSE</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add/Edit Salary Modal */}
            {showSalaryModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl border dark:border-slate-700 overflow-hidden animate-fade-in-up my-8">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-black text-lg">{editingSalary ? 'EDIT SALARY' : 'NEW SALARY'}</h3>
                            <button onClick={() => { setShowSalaryModal(false); setEditingSalary(null); resetSalaryForm(); }} className="bg-slate-800 p-1.5 rounded-full"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSalarySubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">कर्मचारी नाव *</label>
                                    <input
                                        type="text"
                                        required
                                        value={salaryForm.employeeName}
                                        onChange={e => setSalaryForm({ ...salaryForm, employeeName: e.target.value })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                        placeholder="नाव प्रविष्ट करा"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">पद *</label>
                                    <select
                                        value={salaryForm.designation}
                                        onChange={e => setSalaryForm({ ...salaryForm, designation: e.target.value })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                    >
                                        {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">कर्मचारी प्रकार *</label>
                                    <select
                                        value={salaryForm.employeeType}
                                        onChange={e => setSalaryForm({ ...salaryForm, employeeType: e.target.value as any })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                    >
                                        <option value="Permanent">Permanent (कायमस्वरूपी)</option>
                                        <option value="Daily Wage">Daily Wage (रोजनदार)</option>
                                        <option value="Contract">Contract (करारबद्ध)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">महिना *</label>
                                    <input
                                        type="month"
                                        required
                                        value={salaryForm.month}
                                        onChange={e => setSalaryForm({ ...salaryForm, month: e.target.value })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">एकूण पगार (₹) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={salaryForm.grossSalary || ''}
                                        onChange={e => setSalaryForm({ ...salaryForm, grossSalary: Number(e.target.value) })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">कपात (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={salaryForm.deductions || ''}
                                        onChange={e => setSalaryForm({ ...salaryForm, deductions: Number(e.target.value) })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border-2 border-green-200 dark:border-green-800">
                                <label className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase">निव्वळ देय (Net Payable)</label>
                                <div className="text-2xl font-black text-green-700 dark:text-green-400">₹{(salaryForm.grossSalary - salaryForm.deductions).toLocaleString()}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">खाते क्रमांक</label>
                                    <input
                                        type="text"
                                        value={salaryForm.accountNumber}
                                        onChange={e => setSalaryForm({ ...salaryForm, accountNumber: e.target.value })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                        placeholder="खाते क्रमांक"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">पेमेंट तारीख *</label>
                                    <input
                                        type="date"
                                        required
                                        value={salaryForm.paymentDate}
                                        onChange={e => setSalaryForm({ ...salaryForm, paymentDate: e.target.value })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">पेमेंट स्थिती *</label>
                                    <select
                                        value={salaryForm.paymentStatus}
                                        onChange={e => setSalaryForm({ ...salaryForm, paymentStatus: e.target.value as any })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                    >
                                        <option value="Pending">Pending (प्रलंबित)</option>
                                        <option value="Paid">Paid (दिलेले)</option>
                                        <option value="Partial">Partial (अंशतः)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">पेमेंट पद्धत</label>
                                    <select
                                        value={salaryForm.paymentMode}
                                        onChange={e => setSalaryForm({ ...salaryForm, paymentMode: e.target.value as any })}
                                        className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                    >
                                        <option value="Cash">Cash (रोख)</option>
                                        <option value="Bank Transfer">Bank Transfer (बँक हस्तांतरण)</option>
                                        <option value="Cheque">Cheque (धनादेश)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">टिप्पणी</label>
                                <textarea
                                    value={salaryForm.remarks}
                                    onChange={e => setSalaryForm({ ...salaryForm, remarks: e.target.value })}
                                    className="w-full p-2.5 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold"
                                    rows={2}
                                    placeholder="टिप्पणी (optional)"
                                />
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition shadow-xl active:scale-95">
                                {editingSalary ? 'UPDATE SALARY' : 'SAVE SALARY'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* View Receipt Modal */}
            {viewReceipt && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" onClick={() => setViewReceipt(null)}>
                    <div className="max-w-full max-h-full relative">
                        <button className="absolute -top-12 right-0 text-white flex items-center gap-2 font-black uppercase tracking-widest"><X /> Close</button>
                        <img src={viewReceipt} alt="Receipt" className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl border-4 border-white/10 object-contain" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
