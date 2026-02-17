
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Users, AlertTriangle, TrendingUp, Wallet, BarChart3, PieChart as PieChartIcon, Activity, Landmark, ShoppingBag, ArrowUpRight, ArrowDownRight, IndianRupee, ChevronRight, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, AreaChart, Area, CartesianGrid
} from 'recharts';
import { format } from 'date-fns';
import { TransactionType } from '../types';

const Dashboard = () => {
    const { members, transactions, societyBanks, paddyPurchases } = useApp();
    const navigate = useNavigate();

    // Persist chart selection
    const [chartType, setChartType] = useState<string>(() => {
        return localStorage.getItem('dashboard_chart_type') || 'bar';
    });

    useEffect(() => {
        localStorage.setItem('dashboard_chart_type', chartType);
    }, [chartType]);

    const stats = useMemo(() => {
        const totalMembers = members.length;
        const activeMembers = members.filter(m => m.isActive).length;
        const outstandingLoans = members.filter(m => m.loanPrincipal > 0).length;
        const loansGiven = members.reduce((sum, m) => sum + m.loanPrincipal, 0);
        // Deposits include Savings and FDs
        const deposits = members.reduce((sum, m) => sum + m.savingsBalance + m.fdBalance, 0);
        const shareCapital = members.reduce((sum, m) => sum + m.shareBalance, 0);

        const today = format(new Date(), 'yyyy-MM-dd');
        const todaysTrans = transactions.filter(t => t.date === today);
        const todayCollection = todaysTrans
            .filter(t => t.type === TransactionType.CREDIT)
            .reduce((sum, t) => sum + t.amount, 0);
        const todayExpense = todaysTrans
            .filter(t => t.type === TransactionType.DEBIT)
            .reduce((sum, t) => sum + t.amount, 0);

        const totalCredit = transactions.filter(t => t.type === TransactionType.CREDIT).reduce((sum, t) => sum + t.amount, 0);
        const totalDebit = transactions.filter(t => t.type === TransactionType.DEBIT).reduce((sum, t) => sum + t.amount, 0);
        const cashInHand = totalCredit - totalDebit;

        // Bank Stats
        const totalBankBalance = societyBanks.reduce((sum, b) => sum + b.balance, 0);

        // Paddy Stats
        const totalPaddyWeight = paddyPurchases.reduce((sum, p) => sum + p.newWeight + p.oldWeight + p.usedOnceWeight, 0);
        const totalPaddyBags = paddyPurchases.reduce((sum, p) => sum + p.newBags + p.oldBags + p.usedOnceBags, 0);

        return {
            totalMembers, activeMembers, outstandingLoans, loansGiven, deposits, shareCapital,
            todayCollection, todayExpense, cashInHand, totalBankBalance, totalPaddyWeight, totalPaddyBags
        };
    }, [members, transactions, societyBanks, paddyPurchases]);

    // Enhanced Chart Data
    const chartData = [
        { name: 'Loans Given', value: stats.loansGiven, color: '#ef4444' }, // Red
        { name: 'Deposits', value: stats.deposits, color: '#10b981' }, // Emerald
        { name: 'Shares', value: stats.shareCapital, color: '#3b82f6' }, // Blue
        { name: 'Cash', value: stats.cashInHand, color: '#f59e0b' }, // Amber
        { name: 'Bank Bal', value: stats.totalBankBalance, color: '#8b5cf6' }, // Violet
    ];

    const renderChart = () => {
        switch (chartType) {
            case 'pie':
                return (
                    <div className="w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    formatter={(value: number) => `₹${value.toLocaleString()}`}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                );
            case 'area':
                return (
                    <div className="w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    formatter={(value: number) => `₹${value.toLocaleString()}`}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                );
            default: // 'bar'
                return (
                    <div className="w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    formatter={(value: number) => `₹${value.toLocaleString()}`}
                                />
                                <Bar dataKey="value" barSize={30} radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                );
        }
    };

    return (
        <div className="p-4 md:p-6 pb-28 bg-ios-gray-50 dark:bg-black min-h-screen">
            {/* Print Only Header */}
            <div className="hidden print:block text-center mb-2 border-b-2 border-black pb-4">
                <h1 className="text-3xl font-bold text-black">Society Ilada</h1>
                <p className="text-slate-600">Dashboard Status Report</p>
                <p className="text-sm mt-1">Date: {format(new Date(), 'dd-MM-yyyy')}</p>
            </div>

            <div className="flex justify-between items-center mb-1 print:hidden">
                <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold text-ios-gray-900 dark:text-white">Dashboard</h2>
                </div>
                <span className="text-xs font-semibold text-ios-gray-500 bg-ios-gray-100 dark:bg-ios-gray-800 px-3 py-1.5 rounded-ios">{format(new Date(), 'dd MMM yyyy')}</span>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-1 print:grid-cols-2 print:gap-4">
                {/* Members */}
                <Link to="/members" className="ios-card p-5 rounded-ios-xl hover:shadow-ios-md transition-all duration-200 ios-touch group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Users size={80} /></div>
                    <p className="text-xs font-semibold text-ios-gray-500 dark:text-ios-gray-400 mb-2">Total Members</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-bold text-ios-gray-900 dark:text-white">{stats.totalMembers}</h3>
                        <span className="ios-badge text-ios-green bg-ios-green/10">{stats.activeMembers} Active</span>
                    </div>
                </Link>

                {/* Cash in Hand */}
                <div className="ios-card p-5 rounded-ios-xl hover:shadow-ios-md transition-all duration-200 group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet size={80} /></div>
                    <p className="text-xs font-semibold text-ios-gray-500 dark:text-ios-gray-400 mb-2">Cash In Hand</p>
                    <h3 className="text-3xl font-bold text-ios-orange">₹{stats.cashInHand.toLocaleString()}</h3>
                    <div className="flex gap-3 mt-2">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-ios-green"><ArrowUpRight size={12} /> ₹{stats.todayCollection.toLocaleString()}</div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-ios-red"><ArrowDownRight size={12} /> ₹{stats.todayExpense.toLocaleString()}</div>
                    </div>
                </div>

                {/* Total Bank Balance (New) */}
                <Link to="/bank-audit" className="ios-card p-5 rounded-ios-xl hover:shadow-ios-md transition-all duration-200 ios-touch group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Landmark size={80} /></div>
                    <p className="text-xs font-semibold text-ios-gray-500 dark:text-ios-gray-400 mb-2">Bank Balance</p>
                    <h3 className="text-3xl font-bold text-ios-indigo">₹{stats.totalBankBalance.toLocaleString()}</h3>
                    <p className="text-xs text-ios-gray-400 mt-1 font-medium">{societyBanks.length} Accounts</p>
                </Link>

                {/* Outstanding Loans */}
                <Link to="/reports" className="ios-card p-5 rounded-ios-xl hover:shadow-ios-md transition-all duration-200 ios-touch group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><AlertTriangle size={80} /></div>
                    <p className="text-xs font-semibold text-ios-gray-500 dark:text-ios-gray-400 mb-2">Active Loans</p>
                    <h3 className="text-3xl font-bold text-ios-red">{stats.outstandingLoans}</h3>
                    <p className="text-xs text-ios-gray-400 mt-1 font-medium">₹{(stats.loansGiven / 100000).toFixed(2)}L Disbursed</p>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                {/* Main Chart Section */}
                <div className="lg:col-span-2 ios-card p-6 rounded-ios-2xl min-w-0 print:border-black print:shadow-none">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-lg font-semibold text-ios-gray-900 dark:text-white flex items-center gap-2">
                            {chartType === 'bar' && <BarChart3 size={20} className="text-ios-blue" />}
                            {chartType === 'pie' && <PieChartIcon size={20} className="text-ios-blue" />}
                            {chartType === 'area' && <Activity size={20} className="text-ios-blue" />}
                            Financial Overview
                        </h3>
                        <div className="ios-segmented print:hidden">
                            <button
                                onClick={() => setChartType('bar')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-ios transition-all ${chartType === 'bar' ? 'bg-white dark:bg-ios-gray-900 text-ios-blue shadow-ios' : 'text-ios-gray-600 dark:text-ios-gray-400'}`}
                            >
                                Bar
                            </button>
                            <button
                                onClick={() => setChartType('pie')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-ios transition-all ${chartType === 'pie' ? 'bg-white dark:bg-ios-gray-900 text-ios-blue shadow-ios' : 'text-ios-gray-600 dark:text-ios-gray-400'}`}
                            >
                                Pie
                            </button>
                            <button
                                onClick={() => setChartType('area')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-ios transition-all ${chartType === 'area' ? 'bg-white dark:bg-ios-gray-900 text-ios-blue shadow-ios' : 'text-ios-gray-600 dark:text-ios-gray-400'}`}
                            >
                                Area
                            </button>
                        </div>
                    </div>

                    <div className="h-72 w-full" style={{ minWidth: 0 }}>
                        {renderChart()}
                    </div>
                </div>

                {/* Side Widgets Column */}
                <div className="space-y-6">

                    {/* Paddy Stats Widget */}
                    <Link to="/paddy-purchase" className="block bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-800 dark:to-emerald-900/20 p-5 rounded-2xl border border-green-200 dark:border-emerald-800 relative overflow-hidden group">
                        <div className="absolute right-0 bottom-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><ShoppingBag size={100} /></div>
                        <h4 className="text-sm font-black text-green-800 dark:text-green-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <ShoppingBag size={16} /> Paddy Procurement
                        </h4>
                        <div className="flex gap-4">
                            <div>
                                <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalPaddyWeight.toFixed(2)}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Quintals (क्विंटल)</p>
                            </div>
                            <div className="w-px bg-green-200 dark:bg-emerald-800 h-10"></div>
                            <div>
                                <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalPaddyBags}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Bags (पोते)</p>
                            </div>
                        </div>
                    </Link>

                    {/* Bank Accounts List Widget */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border dark:border-slate-700">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                                <Landmark size={16} /> Bank Accounts
                            </h4>
                            <Link to="/bank-audit" className="text-[10px] font-bold text-blue-600 hover:underline">View All</Link>
                        </div>
                        <div className="space-y-3">
                            {societyBanks.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-2">No banks added.</p>
                            ) : (
                                societyBanks.slice(0, 3).map(bank => (
                                    <div key={bank.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{bank.bankName}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">...{bank.accountNo.slice(-4)}</p>
                                        </div>
                                        <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">₹{bank.balance.toLocaleString()}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border dark:border-slate-700">
                        <h4 className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Quick Actions</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Link to="/transactions" className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-center text-xs font-bold hover:bg-blue-100 transition flex flex-col items-center gap-1">
                                <IndianRupee size={18} /> New Entry
                            </Link>
                            <Link to="/members" className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl text-center text-xs font-bold hover:bg-purple-100 transition flex flex-col items-center gap-1">
                                <Users size={18} /> Add Member
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

