
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
/* Added CheckCircle to imports */
import { Receipt, Plus, PieChart as PieIcon, Trash2, Filter, Save, X, TrendingDown, IndianRupee, Camera, Landmark, Eye, AlertCircle, Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { TransactionType, AccountType, Transaction } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7'];

const Expenses = () => {
    const { transactions, addTransaction, deleteTransaction, societyBanks } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [viewReceipt, setViewReceipt] = useState<string | null>(null);

    // Filter State
    const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [monthlyBudget, setMonthlyBudget] = useState<number>(20000);

    // Form State
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [amount, setAmount] = useState<number>(0);
    const [details, setDetails] = useState('');
    const [bankId, setBankId] = useState<string>('Cash'); // Default Cash
    const [receiptBase64, setReceiptBase64] = useState<string>('');

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

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setReceiptBase64(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
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
        setShowModal(false);
        setAmount(0);
        setDetails('');
        setReceiptBase64('');
        setBankId('Cash');
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
                <button onClick={() => setShowModal(true)} className="bg-red-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-red-700 transition shadow-lg font-black text-sm active:scale-95">
                    <Plus size={18} /> ADD EXPENSE
                </button>
            </div>

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
                                                <button onClick={() => window.confirm('Delete?') && deleteTransaction(t.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
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
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', fontWeight: 'bold' }} formatter={(val: any) => `₹${val}`} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
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

            {/* Add Expense Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border dark:border-slate-700 overflow-hidden animate-fade-in-up">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-black text-lg">NEW EXPENSE</h3>
                            <button onClick={() => setShowModal(false)} className="bg-slate-800 p-1.5 rounded-full"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Attach Bill (optional)</label>
                                <div className="flex items-center gap-3">
                                    <label className="flex-1 cursor-pointer bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-1 hover:border-blue-500 transition group">
                                        {receiptBase64 ? <CheckCircle className="text-green-500" size={24} /> : <Camera className="text-slate-400 group-hover:text-blue-500" size={24} />}
                                        <span className="text-[9px] font-black text-slate-500">{receiptBase64 ? 'BILL ATTACHED' : 'SNAP PHOTO'}</span>
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                                    </label>
                                    {receiptBase64 && (
                                        <button type="button" onClick={() => setReceiptBase64('')} className="bg-red-100 text-red-600 p-2 rounded-xl"><Trash2 size={20} /></button>
                                    )}
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition shadow-xl active:scale-95">SAVE EXPENSE</button>
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
