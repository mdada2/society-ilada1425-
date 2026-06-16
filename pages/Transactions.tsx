
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { TransactionType, AccountType, Member } from '../types';
import { calculateLoanInterest } from '../utils/loanCalculator';
import { format } from 'date-fns';
import { Search, Calculator, Save, Printer, MessageSquare, CheckCircle, FileDown, Users, X, Wand2, Loader2, Trash2, AlertCircle, Share2, ArrowRight, ShieldCheck as FundIcon, CheckSquare, Square, History } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { generateNarration } from '../services/ai';
import { downloadBlob } from '../utils/downloadUtils';

const Transactions = () => {
    const { members, addTransaction, deleteTransaction, transactions, settings, societyBanks } = useApp();
    const location = useLocation();
    const navigate = useNavigate();

    // Track previous fund state for amount adjustments
    const prevFundsRef = useRef({ building: false, joint: false });
    const isInitialLoadRef = useRef(true);
    const isRedirectedRef = useRef(false); // Track if navigation came from Member details
    const prevMemberIdRef = useRef('');

    // Handle Incoming State (Redirection from Member Details)
    useEffect(() => {
        if (location.state) {
            const { memberId, type, accountType } = location.state as any;
            if (memberId) {
                setMemberId(memberId);
                isRedirectedRef.current = true; // Mark as redirected to prevent auto-defaults
            }
            if (type) setType(type);
            if (accountType) setAccountType(accountType);

            // Clear state after reading to prevent re-triggering
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);

    // Form State
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [type, setType] = useState<TransactionType>(TransactionType.CREDIT);
    const [memberId, setMemberId] = useState<string>('');
    const [accountType, setAccountType] = useState<AccountType | 'Expense'>(AccountType.SAVINGS);
    const [amount, setAmount] = useState<number>(0);
    const [details, setDetails] = useState('');
    const [search, setSearch] = useState('');

    // Fund States
    const [includeBuildingFund, setIncludeBuildingFund] = useState(false);
    const [includeJointFund, setIncludeJointFund] = useState(false);

    // AI State
    const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);

    // UI State
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Loan Logic State
    const [newPeriodInterest, setNewPeriodInterest] = useState<number>(0);
    const [loanBreakdown, setLoanBreakdown] = useState<string[]>([]);
    const [currentLoanAccNo, setCurrentLoanAccNo] = useState('');
    const [loanType, setLoanType] = useState<'Short Term' | 'Medium Term'>('Short Term');
    const [farmerType, setFarmerType] = useState<'Small Farmer' | 'Large Farmer'>('Small Farmer');

    const [lastSavedTransaction, setLastSavedTransaction] = useState<any>(null);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // कर्ज माफी (Loan Waiver)
    const [applyWaiver, setApplyWaiver] = useState(false);
    const WAIVER_THRESHOLD = 500; // ₹500 पर्यंतची बाकी रक्कम माफ करता येईल
    const receiptRef = useRef<HTMLDivElement>(null);
    const datePickerRef = useRef<HTMLInputElement>(null); // Calendar picker साठी

    const selectedMember = members.find(m => m.id === memberId);

    // Constants for Funds
    const BUILDING_FUND_FIXED = 300;
    const getJointFundAmt = (principal: number) => Math.round(principal * 0.01);

    // Check if member already paid funds in this FY
    const fundStatus = useMemo(() => {
        if (!selectedMember) return { building: false, joint: false };
        const fyStart = settings.financialYearStart;

        const memberTxns = transactions.filter(t => t.memberId === selectedMember.id && t.date >= fyStart);
        return {
            building: memberTxns.some(t => t.details.includes("ईमारत नीधी") || t.details.includes("Building Fund")),
            joint: memberTxns.some(t => t.details.includes("जाईन्ट फंड") || t.details.includes("Joint Fund"))
        };
    }, [selectedMember, transactions, settings.financialYearStart]);

    // Logic when Member, Type or Category changes
    useEffect(() => {
        setNewPeriodInterest(0);
        setLoanBreakdown([]);

        if (selectedMember) {
            // Only auto-switch to LOAN and reset amount if member selection actually changed
            if (selectedMember.id !== prevMemberIdRef.current) {
                if (type === TransactionType.CREDIT && !isRedirectedRef.current) {
                    setAccountType(AccountType.LOAN);
                }
                setAmount(0);
                prevMemberIdRef.current = selectedMember.id;
            }
            // Reset redirect flag after first logic pass
            isRedirectedRef.current = false;

            setCurrentLoanAccNo(selectedMember.loanAccountNo || '');
            if (selectedMember.loanType) setLoanType(selectedMember.loanType);
            setFarmerType(selectedMember.farmerType || 'Small Farmer');

            if (selectedMember.loanPrincipal > 0) {
                const safeLastDate = selectedMember.lastLoanCalculationDate || '2022-04-01';
                const result = calculateLoanInterest(
                    selectedMember.loanPrincipal,
                    safeLastDate,
                    date,
                    settings.financialYearStart,
                    settings.financialYearEnd,
                    false,
                    selectedMember.originalLoanDate,
                    settings.firstYearInterestRate || 6,
                    settings.subsequentYearInterestRate || 12,
                    selectedMember.loanInterestDue || 0
                );

                // चालू वर्षातील नवीन कर्ज आहे का? (Is this a current FY loan?)
                // उदा. originalLoanDate >= 2025-04-01 असल्यास चालू वर्षाचे कर्ज
                const isCurrentFYLoan = !!(selectedMember.originalLoanDate &&
                    selectedMember.originalLoanDate >= settings.financialYearStart);

                // निवडलेली तारीख 31 मार्च किंवा त्यापूर्वी आहे का?
                // financialYearEnd = "2026-03-31", त्यामुळे date <= financialYearEnd म्हणजे ≤ 31 मार्च
                const isDateBeforeNewFY = date <= settings.financialYearEnd;

                // जर चालू वर्षाचे कर्ज आणि तारीख 31 मार्च किंवा आधीची असेल तर व्याज शून्य दाखवावे
                const suppressInterest = isCurrentFYLoan && isDateBeforeNewFY;

                // व्याज display: suppress असल्यास 0 दाखवावे
                setNewPeriodInterest(suppressInterest ? 0 : result.interest);
                setLoanBreakdown(suppressInterest ? [] : result.breakdown);

                // Auto-check funds and auto-calculate amount ONLY for Loan Credit
                if (type === TransactionType.CREDIT && accountType === AccountType.LOAN) {
                    const needsBuilding = !fundStatus.building;
                    const needsJoint = !fundStatus.joint;
                    setIncludeBuildingFund(needsBuilding);
                    setIncludeJointFund(needsJoint);

                    const bFund = needsBuilding ? BUILDING_FUND_FIXED : 0;
                    const jFund = needsJoint ? getJointFundAmt(selectedMember.loanPrincipal) : 0;

                    if (suppressInterest) {
                        // 31 मार्च पूर्वी भरणा: फक्त मुद्दल + निधी, व्याज नाही
                        setAmount(selectedMember.loanPrincipal + bFund + jFund);
                    } else {
                        // 1 एप्रिल नंतर: मुद्दल + व्याज + निधी
                        const totalInterest = selectedMember.loanInterestDue + result.interest;
                        setAmount(selectedMember.loanPrincipal + totalInterest + bFund + jFund);
                    }

                    prevFundsRef.current = { building: needsBuilding, joint: needsJoint };
                }
            }
        } else {
            setCurrentLoanAccNo('');
            setIncludeBuildingFund(false);
            setIncludeJointFund(false);
            setAmount(0);
            prevMemberIdRef.current = '';
        }
        isInitialLoadRef.current = false;
    }, [selectedMember, date, settings, fundStatus, type, accountType]);

    // Adjust Amount when Checkboxes are toggled
    useEffect(() => {
        if (isInitialLoadRef.current || !selectedMember || accountType !== AccountType.LOAN || type !== TransactionType.CREDIT) return;

        const bAmt = BUILDING_FUND_FIXED;
        const jAmt = getJointFundAmt(selectedMember.loanPrincipal);

        let newAmount = amount;

        if (includeBuildingFund !== prevFundsRef.current.building) {
            newAmount += includeBuildingFund ? bAmt : -bAmt;
        }
        if (includeJointFund !== prevFundsRef.current.joint) {
            newAmount += includeJointFund ? jAmt : -jAmt;
        }

        if (newAmount !== amount) {
            setAmount(Math.max(0, newAmount));
        }

        prevFundsRef.current = { building: includeBuildingFund, joint: includeJointFund };
    }, [includeBuildingFund, includeJointFund]);

    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
        setter(value);
        if (lastSavedTransaction) setLastSavedTransaction(null);
        if (statusMsg) setStatusMsg(null);
    };

    const handleSelectMember = (m: Member) => {
        setMemberId(m.id);
        setSearch('');
        setShowMemberModal(false);
        if (lastSavedTransaction) setLastSavedTransaction(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMsg(null);

        try {
            const isLoanCredit = accountType === AccountType.LOAN && type === TransactionType.CREDIT;
            const bFundAmt = (isLoanCredit && includeBuildingFund && selectedMember) ? BUILDING_FUND_FIXED : 0;
            const jFundAmt = (isLoanCredit && includeJointFund && selectedMember) ? getJointFundAmt(selectedMember.loanPrincipal) : 0;
            const totalFunds = bFundAmt + jFundAmt;

            if (amount < totalFunds) {
                setStatusMsg({ type: 'error', text: "एकूण रक्कम ही निधींच्या रक्कमेपेक्षा (₹" + totalFunds + ") कमी असू शकत नाही." });
                return;
            }

            // Prevent Overpayment for Loans
            if (accountType === AccountType.LOAN && type === TransactionType.CREDIT && amount > grandTotalPending) {
                setStatusMsg({ type: 'error', text: `रक्कम एकूण बाकी (₹${grandTotalPending}) पेक्षा जास्त असू शकत नाही. (Cannot pay more than outstanding)` });
                return;
            }

            const netPaymentForLoan = amount - totalFunds;

            const transaction: any = {
                id: Date.now().toString(),
                date, type, accountType,
                amount: amount,
                details: details,
                timestamp: Date.now(),
                memberId: selectedMember?.id || null,
                memberName: selectedMember?.name || search || 'General Entry'
            };

            if (selectedMember) {
                const memberUpdates: any = {};

                if (type === TransactionType.DEBIT && accountType === AccountType.LOAN) {
                    // Don't update loanPrincipal here - AppContext.tsx handles it in addTransaction (line 334)
                    // memberUpdates.loanPrincipal = selectedMember.loanPrincipal + amount; // REMOVED: This was causing double addition
                    memberUpdates.lastLoanCalculationDate = date;
                    transaction.details = `${details} (Loan Disbursed)`.trim();
                }
                else if (type === TransactionType.CREDIT && accountType === AccountType.LOAN) {
                    const totalInterestDue = selectedMember.loanInterestDue + newPeriodInterest;
                    let intPaid = 0;
                    let prinPaid = 0;

                    if (netPaymentForLoan <= totalInterestDue) {
                        intPaid = netPaymentForLoan;
                        prinPaid = 0;
                    } else {
                        intPaid = totalInterestDue;
                        prinPaid = netPaymentForLoan - totalInterestDue;
                    }

                    transaction.interestAccrued = newPeriodInterest;
                    transaction.interestPaid = intPaid;
                    transaction.principalPaid = prinPaid;

                    let fundDetails = "";
                    if (bFundAmt > 0) fundDetails += `ईमारत नीधी: ₹${bFundAmt} `;
                    if (jFundAmt > 0) fundDetails += `जाईन्ट फंड: ₹${jFundAmt} `;

                    transaction.details = `${details} ${fundDetails ? `(${fundDetails})` : ''} (Paid Int: ₹${intPaid}, Prin: ₹${prinPaid})`.trim();

                    // कर्ज माफी: उर्वरित रक्कम माफ करायची असल्यास loanPrincipal आणि loanInterestDue शून्य करा
                    if (applyWaiver && canWaive) {
                        memberUpdates.loanPrincipal = 0;
                        memberUpdates.loanInterestDue = 0;
                        transaction.waivedAmount = remainingAfterPayment; // Bank Incentive साठी मूळ कर्ज रक्कम मिळवण्यासाठी
                        transaction.details = `${transaction.details} (कर्ज माफी: ₹${remainingAfterPayment})`.trim();
                    }

                    if (bFundAmt > 0) {
                        const bBank = societyBanks.find(b => b.accountNo === "15");
                        if (bBank) {
                            addTransaction({
                                id: `FUND-BF-${transaction.id}`, date, type: TransactionType.CREDIT, accountType: 'BankTransfer',
                                amount: bFundAmt, details: `Building Fund from ${selectedMember.name} (Ref: ${transaction.id})`,
                                bankId: bBank.id, timestamp: Date.now() + 1, memberId: null
                            });
                        }
                    }
                    if (jFundAmt > 0) {
                        const jBank = societyBanks.find(b => b.accountNo === "10");
                        if (jBank) {
                            addTransaction({
                                id: `FUND-JF-${transaction.id}`, date, type: TransactionType.CREDIT, accountType: 'BankTransfer',
                                amount: jFundAmt, details: `Joint Fund from ${selectedMember.name} (Ref: ${transaction.id})`,
                                bankId: jBank.id, timestamp: Date.now() + 2, memberId: null
                            });
                        }
                    }
                }
                addTransaction(transaction, memberUpdates);
            } else {
                addTransaction(transaction);
            }

            setStatusMsg({ type: 'success', text: 'व्यवहार यशस्वीरित्या सेव्ह झाला!' });
            setLastSavedTransaction(transaction);
            setAmount(0);
            setDetails('');
            setSearch('');
            setMemberId('');
            setIncludeBuildingFund(false);
            setIncludeJointFund(false);
            setApplyWaiver(false);

            // Auto hide success msg after 3s
            setTimeout(() => setStatusMsg(null), 3000);

        } catch (err) {
            console.error("Save Error:", err);
            setStatusMsg({ type: 'error', text: 'काहीतरी चुकीचे घडले. कृपया पुन्हा प्रयत्न करा.' });
        }
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.memberNo.includes(search) ||
        m.village.toLowerCase().includes(search.toLowerCase())
    );

    const totalInterestDisplay = selectedMember ? selectedMember.loanInterestDue + newPeriodInterest : 0;
    const bFundPreview = (includeBuildingFund && selectedMember) ? BUILDING_FUND_FIXED : 0;
    const jFundPreview = (includeJointFund && selectedMember) ? getJointFundAmt(selectedMember.loanPrincipal) : 0;
    const grandTotalPending = selectedMember ? (selectedMember.loanPrincipal + totalInterestDisplay + bFundPreview + jFundPreview) : 0;

    // कर्ज माफी: भरणा केल्यानंतर किती बाकी शिल्लक राहील?
    const remainingAfterPayment = (accountType === AccountType.LOAN && type === TransactionType.CREDIT && selectedMember && amount > 0)
        ? Math.max(0, grandTotalPending - amount)
        : 0;
    const canWaive = remainingAfterPayment > 0 && remainingAfterPayment <= WAIVER_THRESHOLD;

    const previewData = lastSavedTransaction || {
        date, type, accountType, amount, memberName: selectedMember?.name, details: details || '-'
    };

    const recentTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
    }, [transactions]);

    const formatDateDisplay = (dateStr: string) => {
        try { return format(new Date(dateStr), 'dd-MM-yyyy'); } catch (e) { return dateStr; }
    };

    const handleDelete = (id: string) => {
        if (!id) return;
        const success = deleteTransaction(id);
        setShowDeleteConfirm(null);
        if (success) {
            alert('व्यवहार यशस्वीरित्या हटवला!');
        } else {
            alert('व्यवहार हटवताना त्रुटी आली. (Error deleting transaction)');
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-40 w-full overflow-x-hidden">
            <style>{`
                /* RECENT TABLE BASE STYLES */
                .recent-table { width: 100%; border-collapse: collapse; }
                .recent-table-wrapper { 
                    overflow: auto; 
                    max-height: 480px; 
                    -webkit-overflow-scrolling: touch; 
                    position: relative;
                }

                /* MOBILE ONLY: Prominent Scrollbar & Table Fixes */
                @media (max-width: 768px) {
                    .recent-table {
                        min-width: 520px; /* Forces horizontal scroll */
                        font-size: 13px;
                        margin-bottom: 12px; /* Extra space for the handle */
                    }
                    .recent-table th, .recent-table td {
                        padding: 8px 10px;
                        white-space: nowrap;
                    }
                    .recent-table-wrapper {
                        border: 1px solid #e5e7eb;
                        border-radius: 6px;
                        overflow-x: scroll !important; 
                        padding-bottom: 8px !important; /* Larger gap for visibility */
                    }
                    
                    /* Custom Blue Prominent Scrollbar for Mobile */
                    .mobile-scroll::-webkit-scrollbar { 
                        height: 14px !important;    /* Thicker for visibility */
                        display: block !important;
                        -webkit-appearance: none;
                    }
                    .mobile-scroll::-webkit-scrollbar-track { 
                        background: #cbd5e1 !important; /* Darker track for contrast */
                        border-radius: 10px;
                        border: 1px solid #94a3b8;
                    }
                    .mobile-scroll::-webkit-scrollbar-thumb { 
                        background-color: #2563eb !important; /* Vibrant Blue */
                        border-radius: 10px; 
                        border: 2px solid #cbd5e1;
                        box-shadow: 0 0 5px rgba(0,0,0,0.2);
                    }
                    .mobile-scroll {
                        scrollbar-width: auto;
                        scrollbar-color: #2563eb #cbd5e1;
                        -ms-overflow-style: scrollbar;
                    }
                }
            `}</style>
            <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-6 text-slate-400 dark:text-white px-1 text-left">Daily Transaction Entry</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2 px-0 sm:px-2">
                <div className="md:col-span-2 space-y-3 flex flex-col items-start md:block">
                    {/* Form Container - Full width on mobile */}
                    <div className="bg-white dark:bg-slate-800 p-3 md:p-5 rounded-md shadow-sm border dark:border-slate-700 w-full">
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] sm:text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Date (दिनांक)</label>
                                    {/* Custom DD-MM-YYYY Date Input */}
                                    <div className="relative flex items-center w-full border dark:border-slate-600 rounded bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-blue-500">
                                        <input
                                            type="text"
                                            value={date ? `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(0, 4)}` : ''}
                                            onChange={e => {
                                                let raw = e.target.value.replace(/\D/g, '');
                                                if (raw.length > 8) raw = raw.slice(0, 8);
                                                let formatted = raw;
                                                if (raw.length > 4) formatted = raw.slice(0, 2) + '-' + raw.slice(2, 4) + '-' + raw.slice(4);
                                                else if (raw.length > 2) formatted = raw.slice(0, 2) + '-' + raw.slice(2);
                                                const match = formatted.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                                                if (match) handleInputChange(setDate, `${match[3]}-${match[2]}-${match[1]}`);
                                            }}
                                            placeholder="DD-MM-YYYY"
                                            maxLength={10}
                                            className="flex-1 p-2 bg-transparent text-slate-900 dark:text-white outline-none text-xs sm:text-sm"
                                        />
                                        {/* Hidden date input - opened via showPicker() */}
                                        <input
                                            ref={datePickerRef}
                                            type="date"
                                            value={date}
                                            onChange={e => handleInputChange(setDate, e.target.value)}
                                            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                            tabIndex={-1}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                try {
                                                    (datePickerRef.current as any)?.showPicker?.();
                                                } catch {
                                                    datePickerRef.current?.click();
                                                }
                                            }}
                                            className="pr-2 pl-1 text-slate-400 hover:text-blue-500 transition-colors"
                                            title="Calendar खोला"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] sm:text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Type</label>
                                    <select value={type} onChange={e => handleInputChange(setType, e.target.value as TransactionType)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm">
                                        <option value={TransactionType.CREDIT}>Credit (जमा)</option>
                                        <option value={TransactionType.DEBIT}>Debit (नावे)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Member Search</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input type="text" placeholder="Type Name or No..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                        <Search className="absolute left-2 top-2.5 text-slate-400" size={18} />
                                        {search && (
                                            <div className="mt-1 border dark:border-slate-600 rounded max-h-48 overflow-y-auto bg-white dark:bg-slate-800 absolute z-20 w-full shadow-xl">
                                                {filteredMembers.map(m => (<div key={m.id} className="p-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer text-sm text-slate-800 dark:text-slate-200 border-b dark:border-slate-700" onClick={() => handleSelectMember(m)}>#{m.memberNo} - {m.name} <span className="text-[10px] text-slate-500">({m.village})</span></div>))}
                                            </div>
                                        )}
                                    </div>
                                    <button type="button" onClick={() => setShowMemberModal(true)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md active:scale-95"><Users size={24} /></button>
                                </div>
                                {selectedMember && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-800 dark:text-blue-300 flex justify-between items-center animate-fade-in">
                                        <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">{selectedMember.name.charAt(0)}</div><span>{selectedMember.name}</span></div>
                                        <button type="button" onClick={() => { setMemberId(''); setSearch(''); }} className="text-red-500 hover:text-red-700 text-[10px] uppercase font-black">Change</button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Account Category</label>
                                <select value={accountType} onChange={e => handleInputChange(setAccountType, e.target.value as any)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value={AccountType.SAVINGS}>Savings (बचत)</option>
                                    <option value={AccountType.SHARES}>Shares (शेअर्स)</option>
                                    <option value={AccountType.LOAN}>Loan (कर्ज)</option>
                                    <option value={AccountType.FD}>FD</option>
                                    <option value="Expense">Expense/Other (इतर खर्च)</option>
                                </select>
                            </div>

                            {/* Funds Section for Loan Credit */}
                            {type === TransactionType.CREDIT && accountType === AccountType.LOAN && selectedMember && (
                                <div className="p-2 md:p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 space-y-2 animate-fade-in">
                                    <h4 className="font-bold text-indigo-800 dark:text-indigo-400 text-[11px] md:text-sm flex items-center gap-2 mb-1">
                                        <FundIcon size={14} /> वार्षिक निधी कपात (FY Fund Collection)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            disabled={fundStatus.building}
                                            onClick={() => setIncludeBuildingFund(!includeBuildingFund)}
                                            className={`flex items-center justify-between p-2 rounded-md border transition-all ${fundStatus.building ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' : includeBuildingFund ? 'bg-indigo-600 border-indigo-700 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-indigo-200 text-slate-700 dark:text-slate-300 hover:border-indigo-500'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {fundStatus.building ? <CheckCircle size={14} /> : includeBuildingFund ? <CheckSquare size={14} /> : <Square size={14} />}
                                                <div className="text-left">
                                                    <p className="text-[10px] font-bold">ईमारत</p>
                                                    <p className="text-[8px] opacity-80">₹{BUILDING_FUND_FIXED}</p>
                                                </div>
                                            </div>
                                            {fundStatus.building && <span className="text-[8px] font-black uppercase">Ok</span>}
                                        </button>

                                        <button
                                            type="button"
                                            disabled={fundStatus.joint}
                                            onClick={() => setIncludeJointFund(!includeJointFund)}
                                            className={`flex items-center justify-between p-2 rounded-md border transition-all ${fundStatus.joint ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' : includeJointFund ? 'bg-indigo-600 border-indigo-700 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-indigo-200 text-slate-700 dark:text-slate-300 hover:border-indigo-500'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {fundStatus.joint ? <CheckCircle size={14} /> : includeJointFund ? <CheckSquare size={14} /> : <Square size={14} />}
                                                <div className="text-left">
                                                    <p className="text-[10px] font-bold">जाईन्ट</p>
                                                    <p className="text-[8px] opacity-80">1%</p>
                                                </div>
                                            </div>
                                            {fundStatus.joint && <span className="text-[8px] font-black uppercase">Ok</span>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedMember && (selectedMember.loanPrincipal > 0 || selectedMember.loanInterestDue > 0) && (
                                <div className={`p-2 md:p-4 rounded-lg text-xs border dark:border-slate-600 ${accountType === AccountType.LOAN && type === TransactionType.CREDIT ? 'bg-slate-50 dark:bg-slate-900 border-blue-200 dark:border-blue-900' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-bold text-slate-400 dark:text-white text-[11px]">Loan Pending (कर्ज बाकी):</p>
                                        {!(accountType === AccountType.LOAN && type === TransactionType.CREDIT) && (
                                            <button type="button" onClick={() => { setType(TransactionType.CREDIT); setAccountType(AccountType.LOAN); }} className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded hover:bg-red-700 flex items-center gap-1 transition">Pay Now <ArrowRight size={8} /></button>
                                        )}
                                    </div>

                                    <div className="space-y-1 animate-fade-in">
                                        <div className="flex justify-between text-slate-500 text-[10px]"><span>Principal:</span><span>₹{selectedMember.loanPrincipal.toLocaleString()}</span></div>
                                        <div className="flex justify-between text-slate-500 text-[10px]"><span>Interest:</span><span>₹{totalInterestDisplay.toLocaleString()}</span></div>

                                        <div className="flex justify-between font-bold text-sm text-slate-400 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                                            <span>Grand Total:</span>
                                            <div className="flex items-center gap-2">
                                                {accountType === AccountType.LOAN && type === TransactionType.CREDIT && grandTotalPending > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleInputChange(setAmount, grandTotalPending); setApplyWaiver(false); }}
                                                        className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded hover:bg-blue-700 flex items-center gap-1 transition font-black"
                                                        title="Grand Total amount fill करा"
                                                    >
                                                        संपूर्ण भरा ↑
                                                    </button>
                                                )}
                                                <span className="text-red-600 dark:text-red-400">₹{grandTotalPending.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Savings Balance Display */}
                            {selectedMember && accountType === AccountType.SAVINGS && (
                                <div className="p-3 rounded-lg text-xs border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 text-slate-700 dark:text-slate-300 animate-fade-in">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold">Savings Balance (बचत खात्यावरील रक्कम):</span>
                                        <span className="font-mono font-bold text-green-600 dark:text-green-400">₹{(selectedMember.savingsBalance || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            {/* Shares Balance Display */}
                            {selectedMember && accountType === AccountType.SHARES && (
                                <div className="p-3 rounded-lg text-xs border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 text-slate-700 dark:text-slate-300 animate-fade-in">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold">Shares Balance (हिस्से रक्कम):</span>
                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">₹{(selectedMember.shareBalance || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            {/* FD Balance Display */}
                            {selectedMember && accountType === AccountType.FD && (
                                <div className="p-3 rounded-lg text-xs border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 text-slate-700 dark:text-slate-300 animate-fade-in">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold">FD Balance (मुदत ठेव रक्कम):</span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">₹{(selectedMember.fdBalance || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Amount (एकूण रक्कम) ₹</label>
                                <input type="number" required min="1" value={amount || ''} onChange={e => handleInputChange(setAmount, parseFloat(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xl font-black focus:ring-2 focus:ring-blue-500 outline-none shadow-inner" />
                            </div>

                            {/* कर्ज माफी (Loan Waiver) Option */}
                            {canWaive && selectedMember && accountType === AccountType.LOAN && type === TransactionType.CREDIT && (
                                <div className={`p-2 rounded-lg border transition-all animate-fade-in ${applyWaiver ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700'}`}>
                                    <button
                                        type="button"
                                        onClick={() => setApplyWaiver(!applyWaiver)}
                                        className="flex items-center gap-2 w-full text-left"
                                    >
                                        {applyWaiver
                                            ? <CheckSquare size={14} className="text-amber-700 dark:text-amber-400 flex-shrink-0" />
                                            : <Square size={14} className="text-amber-500 flex-shrink-0" />
                                        }
                                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                                            बाकी ₹{remainingAfterPayment} माफ करा (Waive Remaining Balance)
                                        </span>
                                    </button>
                                    {applyWaiver && (
                                        <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 ml-5">
                                            ✓ भरणा सेव्ह झाल्यावर उर्वरित ₹{remainingAfterPayment} माफ होईल आणि कर्जखाते पूर्णपणे शून्य होईल.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-[10px] font-medium text-slate-700 dark:text-slate-300">Details / Narration</label>
                                    <button type="button" onClick={async () => { if (!amount || !selectedMember) return; setIsGeneratingNarration(true); setDetails(await generateNarration(type, accountType, amount, selectedMember.name)); setIsGeneratingNarration(false); }} className="flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800" disabled={isGeneratingNarration}>{isGeneratingNarration ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}Smart AI</button>
                                </div>
                                <textarea rows={1} value={details} onChange={e => handleInputChange(setDetails, e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs" />
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg active:scale-95 text-sm"><Save size={18} /> Save Transaction</button>

                            {statusMsg && (
                                <div className={`p-2 rounded-lg text-xs font-bold animate-fade-in flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                    {statusMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                    {statusMsg.text}
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                <div className="space-y-3 flex flex-col items-start md:block">
                    {/* Receipt Preview - Full width on mobile */}
                    <div className="bg-white dark:bg-slate-800 p-3 md:p-5 rounded-md shadow-sm border dark:border-slate-700 lg:sticky lg:top-6 w-full border-t-4 border-t-red-500">
                        <h3 className="font-bold text-slate-400 dark:text-white mb-3 flex items-center gap-2 text-sm md:text-base">{lastSavedTransaction ? <CheckCircle className="text-green-500" /> : <Calculator className="text-blue-500" />}{lastSavedTransaction ? 'Last Saved Receipt' : 'Receipt Preview'}</h3>
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 p-2 md:p-4 rounded-lg bg-slate-50 dark:bg-slate-900 overflow-x-auto min-h-[140px]">
                            <div className="text-center mb-2 border-b border-slate-200 dark:border-slate-700 pb-2"><h4 className="font-bold text-slate-400 dark:text-white text-lg">Society Ilada</h4><p className="text-xs text-slate-500 dark:text-slate-400">Date: {formatDateDisplay(previewData.date)}</p></div>
                            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                <div className="flex justify-between"><span>Member:</span><span className="font-bold">{previewData.memberName || 'General'}</span></div>
                                <div className="flex justify-between"><span>Type:</span><span className={`font-bold ${previewData.type === TransactionType.CREDIT ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{previewData.type === TransactionType.CREDIT ? 'Credit (जमा)' : 'Debit (नावे)'}</span></div>
                                <div className="flex justify-between"><span>Account:</span><span>{previewData.accountType}</span></div>
                                <div className="flex justify-between text-lg font-bold border-t dark:border-slate-700 pt-2 mt-2"><span>Amount:</span><span>₹{Number(previewData.amount || 0).toLocaleString()}</span></div>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            <button onClick={() => window.print()} disabled={!lastSavedTransaction} className="w-full py-2 bg-slate-800 dark:bg-slate-600 text-white rounded font-medium flex items-center justify-center gap-2 hover:bg-slate-700 transition disabled:opacity-30"><Printer size={18} /> Print</button>
                            <button onClick={async () => { if (!lastSavedTransaction || !receiptRef.current) return; const canvasOptions = { scale: 2, logging: false }; const canvas = await html2canvas(receiptRef.current, canvasOptions); const imgData = canvas.toDataURL('image/jpeg', 0.7); const pdf = new jsPDF('p', 'mm', 'a5'); pdf.addImage(imgData, 'JPEG', 0, 0, 148, 210); const itemBlob = pdf.output('blob'); downloadBlob(itemBlob, `Receipt_${lastSavedTransaction.id.slice(-6)}.pdf`); }} disabled={!lastSavedTransaction} className="w-full py-2 bg-indigo-600 text-white rounded font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition disabled:opacity-30"><FileDown size={18} /> Download PDF</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Transactions List - Full width on mobile */}
            <div className="bg-white dark:bg-slate-800 rounded-md shadow-sm border dark:border-slate-700 overflow-hidden animate-fade-in-up mt-3 border-t-4 border-t-yellow-400 w-full">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-slate-400 dark:text-white flex items-center gap-2 text-sm"><History size={16} className="text-blue-600" /> अलीकडचे व्यवहार (Recent)</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 animate-pulse">आडवे स्क्रोल करा →</span>
                </div>
                <div className="recent-table-wrapper mobile-scroll pb-2 mx-1">
                    <table className="recent-table text-left text-[13px]">
                        <thead className="bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 text-slate-600 dark:text-slate-400 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 font-bold uppercase tracking-tighter">दिनांक</th>
                                <th className="p-2 font-bold uppercase tracking-tighter">सभासद / तपशील</th>
                                <th className="p-2 font-bold uppercase tracking-tighter">प्रकार</th>
                                <th className="p-2 font-bold uppercase tracking-tighter">खाते</th>
                                <th className="p-2 font-bold uppercase tracking-tighter text-right">रक्कम</th>
                                <th className="p-2 font-bold uppercase tracking-tighter text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTransactions.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No transactions found.</td></tr>
                            ) : recentTransactions.map(t => (
                                <tr key={t.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="p-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-xs">{formatDateDisplay(t.date)}</td>
                                    <td className="p-4">
                                        {t.memberId ? (
                                            <button
                                                onClick={() => navigate(`/members/${t.memberId}`)}
                                                className="font-bold text-blue-600 dark:text-blue-400 hover:underline text-left block"
                                            >
                                                {t.memberName || "General Entry"}
                                            </button>
                                        ) : (
                                            <p className="font-bold text-slate-800 dark:text-white">{t.memberName || "General Entry"}</p>
                                        )}
                                        <p className="text-[10px] text-slate-500 truncate max-w-[300px]">{t.details}</p>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${t.type === TransactionType.CREDIT ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{t.accountType}</span>
                                    </td>
                                    <td className="p-4 text-right font-black text-base whitespace-nowrap">
                                        <div className={`flex flex-col items-end ${t.type === TransactionType.CREDIT ? 'text-green-600' : 'text-red-600'}`}>
                                            <span>₹{t.amount.toLocaleString()}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        <button
                                            onClick={() => setShowDeleteConfirm(t.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete Transaction"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Member Selection Modal */}
            {showMemberModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border dark:border-slate-700 animate-fade-in-up">
                        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-2xl">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Users className="text-blue-600" /> सभासद निवडा (Select Member)</h3>
                            <button onClick={() => setShowMemberModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X size={24} /></button>
                        </div>
                        <div className="p-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input autoFocus type="text" placeholder="नाव किंवा नंबरने शोधा..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 p-3 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {filteredMembers.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 italic">No members found.</div>
                            ) : filteredMembers.map(m => (
                                <div key={m.id} onClick={() => handleSelectMember(m)} className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 rounded-xl transition cursor-pointer flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">{m.name.charAt(0)}</div>
                                        <div><p className="font-bold text-slate-800 dark:text-white">{m.name}</p><p className="text-xs text-slate-500">#{m.memberNo} | {m.village}</p></div>
                                    </div>
                                    <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-3 border dark:border-slate-700 animate-fade-in-up">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center">
                                <Trash2 size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">व्यवहार हटवायचा?</h3>
                                <p className="text-slate-500 dark:text-slate-400 mt-2">तुम्हाला खात्री आहे की तुम्हाला हा व्यवहार कायमचा हटवायचा आहे? हे परत मिळवता येणार नाही.</p>
                            </div>
                            <div className="flex w-full gap-3 mt-2">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-200 transition"
                                >
                                    रद्द करा
                                </button>
                                <button
                                    onClick={() => handleDelete(showDeleteConfirm)}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition"
                                >
                                    हो, हटवा
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Receipt Print Template - Fixed width issue by constraining container */}
            <div className="fixed top-0 left-0 w-0 h-0 overflow-hidden opacity-0 pointer-events-none -z-50">
                <div ref={receiptRef} className="bg-white text-black p-3 w-[148mm] min-h-[210mm] border font-sans">
                    <div className="text-center border-b-2 border-black pb-4 mb-2"><h1 className="text-2xl font-bold uppercase tracking-wider">Society Ilada</h1><p className="text-sm">Receipt / Slip</p></div>
                    <div className="flex justify-between mb-2 text-sm"><p>Date: <span className="font-bold">{formatDateDisplay(previewData.date)}</span></p><p>Receipt No: <span className="font-bold">#{previewData.id ? previewData.id.slice(-6) : 'PREVIEW'}</span></p></div>
                    <div className="space-y-4 mb-2 text-sm">
                        <div className="flex border-b border-dotted border-gray-400 pb-1"><span className="w-32">Member:</span><span className="font-bold flex-1">{previewData.memberName || 'General'}</span></div>
                        <div className="flex border-b border-dotted border-gray-400 pb-1"><span className="w-32">Type:</span><span className="font-bold flex-1">{previewData.type}</span></div>
                        <div className="flex border-b border-dotted border-gray-400 pb-1"><span className="w-32">Account:</span><span className="font-bold flex-1">{previewData.accountType}</span></div>
                        <div className="flex border-b border-dotted border-gray-400 pb-1"><span className="w-32">Amount:</span><span className="font-bold text-xl flex-1">₹{Number(previewData.amount || 0).toLocaleString()}</span></div>
                        <div className="flex border-b border-dotted border-gray-400 pb-1"><span className="w-32">Details:</span><span className="flex-1 italic">{previewData.details}</span></div>
                    </div>
                    <div className="mt-auto pt-8 flex justify-between items-end"><div className="text-center"><p className="text-xs">_________________</p><p className="text-xs font-bold">Authorized Sign</p></div><div className="text-center"><p className="text-xs">_________________</p><p className="text-xs font-bold">Member Sign</p></div></div>
                </div>
            </div>
        </div>
    );
};

export default Transactions;

