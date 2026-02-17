
import React, { useState } from 'react';
import { calculateLoanInterest } from '../utils/loanCalculator';
import { format } from 'date-fns';
import { Calculator, IndianRupee, Sprout, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

const LoanCalculatorPage = () => {
    const { settings } = useApp();
    const [activeTab, setActiveTab] = useState<'standard' | 'incentive'>('standard');

    // Standard Calculator State
    const [principal, setPrincipal] = useState<number>(50000);
    const [startDate, setStartDate] = useState('2022-04-01');
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [result, setResult] = useState<{ interest: number; breakdown: string[] } | null>(null);

    // Incentive Calculator State
    const [incPrincipal, setIncPrincipal] = useState<number>(10000);
    const [incStartDate, setIncStartDate] = useState('2025-07-15');
    const [incEndDate, setIncEndDate] = useState('2026-06-30'); // Extended Default Date
    const [incResult, setIncResult] = useState<{ days: number; product: number; incentive: number } | null>(null);

    const handleCalculate = (e: React.FormEvent) => {
        e.preventDefault();
        const res = calculateLoanInterest(
            principal,
            startDate,
            endDate,
            settings.financialYearStart,
            settings.financialYearEnd,
            false, // Show interest calculations for user reference
            startDate, // Use start date as original loan date for calculator
            settings.firstYearInterestRate || 6,
            settings.subsequentYearInterestRate || 12
        );
        setResult(res);
    };

    const handleIncentiveCalculate = (e: React.FormEvent) => {
        e.preventDefault();

        const start = new Date(incStartDate);
        const end = new Date(incEndDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const product = incPrincipal * diffDays;
        // Formula: (Product * 3) / 36500
        const incentive = Math.round((product * 3) / 36500);

        setIncResult({
            days: diffDays,
            product: product,
            incentive: incentive
        });
    };

    return (
        <div className="p-6 md:pt-1 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white flex items-center gap-2">
                <Calculator className="text-blue-600" /> Calculators
            </h2>

            {/* Tabs */}
            <div className="flex gap-2 mb-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('standard')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'standard' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
                >
                    <Calculator size={16} /> Loan Interest (Liability)
                </button>
                <button
                    onClick={() => setActiveTab('incentive')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'incentive' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
                >
                    <Sprout size={16} /> Dr. P. Deshmukh (Incentive)
                </button>
            </div>

            {activeTab === 'standard' ? (
                <div className="animate-fade-in">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-100 dark:border-blue-800 flex gap-2">
                        <Info size={16} className="shrink-0 mt-0.5" />
                        <span>Calculates interest payable by member. Uses FY settings ({format(new Date(settings.financialYearStart), 'dd-MM-yyyy')} to {format(new Date(settings.financialYearEnd), 'dd-MM-yyyy')}) for 0% logic.</span>
                    </p>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700 mb-2">
                        <form onSubmit={handleCalculate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Principal Amount (₹)</label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="number"
                                        value={principal}
                                        onChange={(e) => setPrincipal(Number(e.target.value))}
                                        className="w-full pl-10 p-3 border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-3 border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full p-3 border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition shadow-lg"
                            >
                                Calculate Interest
                            </button>
                        </form>
                    </div>

                    {result && (
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700 animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 border-b dark:border-slate-700 pb-2">Calculation Result</h3>

                            <div className="flex justify-between items-center mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                                <span className="text-green-800 dark:text-green-300 font-medium">Total Interest Payable</span>
                                <span className="text-2xl font-bold text-green-700 dark:text-green-400">₹{result.interest.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <span className="text-blue-800 dark:text-blue-300 font-medium">Total Amount (Prin + Int)</span>
                                <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">₹{(principal + result.interest).toLocaleString()}</span>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase">Calculation Breakdown</p>
                                {result.breakdown.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">No interest accrued for this period.</p>
                                ) : (
                                    result.breakdown.map((line, idx) => (
                                        <div key={idx} className="text-sm text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border dark:border-slate-700">
                                            {line}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="animate-fade-in">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 bg-amber-50 dark:bg-amber-900/20 p-3 rounded border border-amber-100 dark:border-amber-800 flex gap-2">
                        <Info size={16} className="shrink-0 mt-0.5" />
                        <span>Calculates the 3% Incentive amount given to member. Formula: (Principal × Days × 3) / 36500.</span>
                    </p>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700 mb-2 border-l-4 border-l-amber-500">
                        <form onSubmit={handleIncentiveCalculate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Loan Principal (मुद्दल)</label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="number"
                                        value={incPrincipal}
                                        onChange={(e) => setIncPrincipal(Number(e.target.value))}
                                        className="w-full pl-10 p-3 border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Loan Taken Date (उचल दिनांक)</label>
                                    <input
                                        type="date"
                                        value={incStartDate}
                                        onChange={(e) => setIncStartDate(e.target.value)}
                                        className="w-full p-3 border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Repayment Date (भरणा दिनांक)</label>
                                    <input
                                        type="date"
                                        value={incEndDate}
                                        onChange={(e) => setIncEndDate(e.target.value)}
                                        className="w-full p-3 border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold transition shadow-lg"
                            >
                                Calculate Incentive
                            </button>
                        </form>
                    </div>

                    {incResult && (
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700 animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 border-b dark:border-slate-700 pb-2">Incentive Result</h3>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded border dark:border-slate-600">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Total Days</p>
                                    <p className="text-xl font-bold text-slate-800 dark:text-white">{incResult.days}</p>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded border dark:border-slate-600">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Product (Prin × Days)</p>
                                    <p className="text-xl font-bold text-slate-800 dark:text-white">{incResult.product.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                                <div>
                                    <span className="text-amber-800 dark:text-amber-300 font-bold block">3% Incentive Amount</span>
                                    <span className="text-xs text-amber-700 dark:text-amber-400">(परत मिळणारे व्याज अनुदान)</span>
                                </div>
                                <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">₹{incResult.incentive.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LoanCalculatorPage;

