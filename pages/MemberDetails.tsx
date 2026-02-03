import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Edit, Save, X, Info, CreditCard, Plus, User, Camera, ChevronDown, ChevronUp, FileText, Minus, Wallet, TrendingUp, Sparkles, Loader2, Trash2, AlertCircle, Share2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { TransactionType, AccountType, Member } from '../types';
import { calculateLoanInterest } from '../utils/loanCalculator';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { generateNarration, generateCreditScore } from '../services/ai';
import { downloadBlob } from '../utils/downloadUtils';
import { exportTransactionsToExcel } from '../services/excelExport';
import { Capacitor } from '@capacitor/core';

const MemberDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getMember, transactions, updateMember, deleteTransaction, settings } = useApp();
    const member = getMember(id || '');

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Member | null>(null);

    // Accrued Interest State
    const [accruedInterest, setAccruedInterest] = useState(0);
    const [interestBreakdown, setInterestBreakdown] = useState<string[]>([]);
    const [showBreakdown, setShowBreakdown] = useState(false);

    // AI Score State
    const [aiScore, setAiScore] = useState<any>(null);
    const [loadingScore, setLoadingScore] = useState(false);

    // Delete Modal State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Print Ref
    const printRef = useRef<HTMLDivElement>(null);

    // Helper to format date for display
    const formatDateDisplay = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), 'dd-MM-yyyy');
        } catch (e) {
            return dateStr;
        }
    };

    // Initialize form data when member loads
    useEffect(() => {
        if (member) {
            setFormData(member);
        }
    }, [member]);

    // Calculate Accrued Interest dynamically
    useEffect(() => {
        if (member && member.loanPrincipal > 0) {
            // Default to 1st April 2022 if no date set, per society rules context
            const lastDate = member.lastLoanCalculationDate || '2022-04-01';
            const today = format(new Date(), 'yyyy-MM-dd');

            const { interest, breakdown } = calculateLoanInterest(
                member.loanPrincipal,
                lastDate,
                today,
                settings.financialYearStart,
                settings.financialYearEnd,
                true, // Hide interest during first FY
                member.originalLoanDate // Pass original loan date for first FY calculation
            );

            setAccruedInterest(interest);
            setInterestBreakdown(breakdown);
        } else {
            setAccruedInterest(0);
            setInterestBreakdown([]);
        }
    }, [member, settings]);

    const memberTransactions = useMemo(() => {
        if (!member) return [];
        return transactions.filter(t => t.memberId === member.id).sort((a, b) => b.timestamp - a.timestamp);
    }, [transactions, member]);

    const totalInterestToShow = useMemo(() => {
        return (member ? (member.loanInterestDue || 0) : 0) + accruedInterest;
    }, [member, accruedInterest]);

    const totalLoanOutstanding = useMemo(() => {
        return Math.max(0, (member ? (member.loanPrincipal || 0) : 0) + totalInterestToShow);
    }, [member, totalInterestToShow]);

    const handleResetInterest = () => {
        if (!member || !window.confirm('व्याज ₹0 करायचे आहे का? (Reset Loan Interest Due to ₹0?)')) return;

        // Reset both loanInterestDue AND lastLoanCalculationDate to make total interest ₹0
        const today = format(new Date(), 'yyyy-MM-dd');
        const updatedMember = {
            ...member,
            loanInterestDue: 0,
            lastLoanCalculationDate: today  // This will make accruedInterest = ₹0
        };
        updateMember(updatedMember);

        // Show success message - no reload needed, React will update the UI
        alert('✅ व्याज ₹0 केले! Data saved.');
    };

    const handleGenerateScore = async () => {
        if (!member) return;
        setLoadingScore(true);
        const result = await generateCreditScore(member, memberTransactions);
        setAiScore(result);
        setLoadingScore(false);
    };

    if (!member || !formData) return <div className="p-6 text-slate-800 dark:text-white">Member not found</div>;

    const handleSave = () => {
        if (formData) {
            updateMember(formData);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setFormData(member);
        setIsEditing(false);
    };

    const initiateDelete = (id: string) => {
        setShowDeleteConfirm(id);
    };

    const confirmDelete = () => {
        if (showDeleteConfirm) {
            const success = deleteTransaction(showDeleteConfirm);
            if (success) {
                alert("Transaction Deleted Successfully");
            } else {
                alert("Error deleting transaction");
            }
            setShowDeleteConfirm(null);
        }
    };

    const handlePhotoEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && formData) {
            if (file.size > 500 * 1024) {
                alert("File too large. Please select an image under 500KB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, photoUrl: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleQuickTransaction = (accountType: AccountType, type: TransactionType) => {
        navigate('/transactions', {
            state: {
                memberId: member.id,
                type: type,
                accountType: accountType
            }
        });
    };

    const generateTransactionsCSVBlob = () => {
        const headers = ["Date", "Type", "Account", "Amount", "Details"];
        const rows = memberTransactions.map(t => [
            formatDateDisplay(t.date),
            t.type,
            t.accountType,
            t.amount,
            t.details
        ]);

        return { headers, rows };
    };



    // ... inside component ...

    const handleShareTransactions = async () => {
        // Fallback for sharing - still use Excel locally
        exportTransactionsToExcel(memberTransactions, [member]);
    };

    const exportTransactions = () => {
        exportTransactionsToExcel(memberTransactions, [member]);
    };

    // ...

    const handleDownloadPDF = async () => {
        if (printRef.current) {
            try {
                // Platform-specific canvas options
                const canvasOptions = {
                    scale: Capacitor.isNativePlatform() ? 1.5 : 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    allowTaint: false
                };

                const canvas = await html2canvas(printRef.current, canvasOptions);
                const imgData = canvas.toDataURL('image/jpeg', 0.7);
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = pdfWidth / imgWidth;
                const imgComponentHeight = imgHeight * ratio;

                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgComponentHeight);

                // Use blob + downloadUtils for consistent behavior
                const pdfBlob = pdf.output('blob');
                downloadBlob(pdfBlob, `${member.name}_Statement.pdf`);

                setTimeout(() => alert("Download complete"), 500);
            } catch (error) {
                console.error("PDF Generation Error:", error);
                alert("Failed to generate PDF. Please try again.");
            }
        }
    };

    const handleSharePDF = async () => {
        if (printRef.current) {
            try {
                // Platform-specific canvas options
                const canvasOptions = {
                    scale: Capacitor.isNativePlatform() ? 1.5 : 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    allowTaint: false
                };

                const canvas = await html2canvas(printRef.current, canvasOptions);
                const imgData = canvas.toDataURL('image/jpeg', 0.7);
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const ratio = pdfWidth / canvas.width;
                const imgHeight = canvas.height * ratio;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);

                const pdfBlob = pdf.output('blob');
                await downloadBlob(pdfBlob, `${member.name}_Statement.pdf`);
            } catch (error) {
                console.error("Share Error:", error);
                alert("Failed to share PDF. Please try again.");
            }
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full pb-40"> {/* Increased bottom padding */}
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 no-print">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                    <ArrowLeft size={20} /> Back to List
                </button>

                <div className="flex gap-2 self-end sm:self-auto">
                    {isEditing ? (
                        <>
                            <button onClick={handleCancel} className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded flex items-center gap-2 transition hover:bg-slate-300 dark:hover:bg-slate-600 text-sm md:text-base">
                                <X size={18} /> Cancel
                            </button>
                            <button onClick={handleSave} className="px-3 py-1.5 md:px-4 md:py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 font-bold transition shadow-sm text-sm md:text-base">
                                <Save size={18} /> Save
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-2 font-medium transition text-sm md:text-base">
                            <Edit size={18} /> Edit Profile
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-4 md:p-6 mb-6 print:shadow-none print:border-0 print:bg-white print:text-black">
                {/* Sticky Header Wrapper */}
                <div className="sticky top-16 md:top-0 z-20 bg-white dark:bg-slate-800 -mx-4 px-4 md:-mx-6 md:px-6 -mt-4 pt-4 md:-mt-6 md:pt-6 pb-4 border-b dark:border-slate-700 mb-6 shadow-sm print:static print:shadow-none print:border-none print:m-0 print:p-0">
                    {/* Top Section: Name & Basic Info */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex items-center gap-4 flex-1 w-full">
                            {/* Profile Photo Display */}
                            <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden border-4 border-white dark:border-slate-600 shadow-sm shrink-0 flex items-center justify-center relative group">
                                {isEditing ? (
                                    <>
                                        {formData?.photoUrl ? (
                                            <img src={formData.photoUrl} alt="Profile" className="w-full h-full object-cover opacity-75" />
                                        ) : (
                                            <User size={32} className="text-slate-400" />
                                        )}
                                        <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30 hover:bg-black/50 transition z-10">
                                            <Camera size={24} className="text-white opacity-80" />
                                            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoEdit} />
                                        </label>
                                    </>
                                ) : (
                                    member.photoUrl ? (
                                        <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={32} className="text-slate-400" />
                                    )
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {isEditing ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full p-2 border bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:border-slate-500 dark:text-white rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Member No</label>
                                            <input
                                                type="text"
                                                value={formData.memberNo}
                                                onChange={e => setFormData({ ...formData, memberNo: e.target.value })}
                                                className="w-full p-2 border bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:border-slate-500 dark:text-white rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Village</label>
                                            <input
                                                type="text"
                                                value={formData.village}
                                                onChange={e => setFormData({ ...formData, village: e.target.value })}
                                                className="w-full p-2 border bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:border-slate-500 dark:text-white rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Gender</label>
                                            <select
                                                value={formData.gender || 'Male'}
                                                onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                                                className="w-full p-2 border bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:border-slate-500 dark:text-white rounded"
                                            >
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-white print:text-black truncate">{member.name}</h1>
                                        <p className="text-slate-500 dark:text-slate-400 print:text-slate-600 text-sm md:text-base">
                                            #{member.memberNo} | {member.village} | {member.gender || 'Male'}
                                            {member.membershipDate ? ` | Reg: ${formatDateDisplay(member.membershipDate)}` : ''}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 no-print self-end sm:self-start">
                            {!isEditing && (
                                <>
                                    <button onClick={handleSharePDF} className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 flex items-center gap-2" title="Share Statement PDF">
                                        <Share2 size={20} /> <span className="hidden md:inline">Share</span>
                                    </button>
                                    <button onClick={handleDownloadPDF} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 flex items-center gap-2" title="Download Statement PDF">
                                        <FileText size={20} /> <span className="hidden md:inline">Statement</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Financial Overview (Interactive Cards) */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-6 mb-6 md:mb-8">

                    {/* Savings Card */}
                    <div className="group p-3 md:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800 print:border-black min-w-0 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer active:scale-95 relative flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400 uppercase font-bold truncate flex items-center gap-1">
                                <Wallet size={12} /> Savings (बचत)
                            </p>
                            <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white print:text-black truncate">₹{member.savingsBalance.toLocaleString()}</p>
                        </div>
                        {!isEditing && (
                            <div className="mt-3 flex gap-2 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleQuickTransaction(AccountType.SAVINGS, TransactionType.CREDIT); }}
                                    className="flex-1 py-1 bg-green-600 text-white text-[10px] md:text-xs font-bold rounded shadow hover:bg-green-700 transition flex items-center justify-center gap-1"
                                    title="Deposit Savings"
                                >
                                    <Plus size={12} /> Add
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleQuickTransaction(AccountType.SAVINGS, TransactionType.DEBIT); }}
                                    className="flex-1 py-1 bg-red-500 text-white text-[10px] md:text-xs font-bold rounded shadow hover:bg-red-600 transition flex items-center justify-center gap-1"
                                    title="Withdraw Savings"
                                >
                                    <Minus size={12} /> W/D
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Shares Card */}
                    <div className="group p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 print:border-black min-w-0 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer active:scale-95 relative flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] md:text-xs text-blue-600 dark:text-blue-400 uppercase font-bold truncate flex items-center gap-1">
                                <TrendingUp size={12} /> Shares (शेअर्स)
                            </p>
                            <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white print:text-black truncate">₹{member.shareBalance.toLocaleString()}</p>
                        </div>
                        {!isEditing && (
                            <div className="mt-3 flex gap-2 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleQuickTransaction(AccountType.SHARES, TransactionType.CREDIT); }}
                                    className="flex-1 py-1 bg-blue-600 text-white text-[10px] md:text-xs font-bold rounded shadow hover:bg-blue-700 transition flex items-center justify-center gap-1"
                                    title="Invest Shares"
                                >
                                    <Plus size={12} /> Add
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleQuickTransaction(AccountType.SHARES, TransactionType.DEBIT); }}
                                    className="flex-1 py-1 bg-red-500 text-white text-[10px] md:text-xs font-bold rounded shadow hover:bg-red-600 transition flex items-center justify-center gap-1"
                                    title="Withdraw Shares"
                                >
                                    <Minus size={12} /> W/D
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Loan Principal Card */}
                    <div className="group p-3 md:p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 print:border-black relative flex flex-col justify-between min-w-0 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer active:scale-95">
                        <div>
                            <p className="text-[10px] md:text-xs text-red-600 dark:text-red-400 uppercase font-bold truncate flex items-center gap-1">
                                <CreditCard size={12} /> Loan Principal (मुद्दल)
                            </p>
                            <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white print:text-black truncate">
                                ₹{Math.max(0, member.loanPrincipal).toLocaleString()}
                            </p>
                            {member.loanPrincipal < 0 && (
                                <p className="text-[10px] font-bold text-green-600 dark:text-green-400">
                                    + ₹{Math.abs(member.loanPrincipal).toLocaleString()} (Advance)
                                </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1">
                                {member.loanType && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border dark:border-slate-600 shadow-sm truncate">{member.loanType}</p>
                                )}
                                {member.farmerType && (
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 shadow-sm truncate">{member.farmerType}</p>
                                )}
                            </div>
                        </div>

                        {!isEditing && (
                            <div className="mt-3 flex justify-end gap-2 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                                {Number(member.loanPrincipal || 0) > 0 ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleQuickTransaction(AccountType.LOAN, TransactionType.CREDIT); }}
                                        className="w-full px-2 py-1.5 bg-red-600 text-white text-[10px] md:text-xs font-bold rounded shadow hover:bg-red-700 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                                    >
                                        Pay Now <CreditCard size={12} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleQuickTransaction(AccountType.LOAN, TransactionType.DEBIT); }}
                                        className="w-full px-2 py-1.5 bg-blue-600 text-white text-[10px] md:text-xs font-bold rounded shadow hover:bg-blue-700 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                                    >
                                        Give Loan <Plus size={12} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Interest Card */}
                    <div className="group p-3 md:p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800 print:border-black relative flex flex-col min-w-0 transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
                    >
                        <div>
                            <p className="text-[10px] md:text-xs text-orange-600 dark:text-orange-400 uppercase font-bold flex items-center gap-1 truncate">
                                <Info size={12} /> Loan Interest (व्याज)
                            </p>
                            <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white print:text-black truncate">₹{totalInterestToShow.toLocaleString()}</p>
                        </div>

                        {accruedInterest === 0 && Number(member.loanPrincipal || 0) > 0 && (
                            <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-medium bg-green-50 dark:bg-green-900/30 inline-block px-1.5 rounded truncate max-w-full">
                                Interest Free
                            </p>
                        )}

                        {!isEditing && (
                            <div className="mt-auto pt-2 no-print flex gap-2 flex-wrap">
                                {accruedInterest > 0 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowBreakdown(!showBreakdown); }}
                                        className="text-[10px] md:text-xs flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white whitespace-nowrap"
                                    >
                                        {showBreakdown ? 'Hide Details' : 'Show Details'}
                                        {showBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                )}
                                {/* Always show Reset button for testing */}
                                <button
                                    onClick={handleResetInterest}
                                    className="text-[10px] md:text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition whitespace-nowrap"
                                    title="Reset old unpaid interest to ₹0"
                                >
                                    Reset Interest
                                </button>
                            </div>
                        )}
                    </div>

                    {/* AI Credit Score Card */}
                    <div className="group p-3 md:p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 print:border-black relative flex flex-col min-w-0 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
                        <div>
                            <p className="text-[10px] md:text-xs text-indigo-600 dark:text-indigo-400 uppercase font-bold flex items-center gap-1 truncate">
                                <Sparkles size={12} /> AI Credit Score
                            </p>
                            {aiScore ? (
                                <div>
                                    <p className="text-xl md:text-2xl font-bold text-indigo-700 dark:text-indigo-300">{aiScore.score}<span className="text-xs text-slate-400 font-normal">/900</span></p>
                                    <p className={`text-xs font-bold ${aiScore.rating === 'Excellent' || aiScore.rating === 'Good' ? 'text-green-600' : 'text-red-500'}`}>{aiScore.rating}</p>
                                </div>
                            ) : (
                                <div className="h-10 flex items-center">
                                    {loadingScore ? <Loader2 className="animate-spin text-indigo-500" size={20} /> : <p className="text-xs text-slate-500 italic">Click to generate</p>}
                                </div>
                            )}
                        </div>
                        {!aiScore && !loadingScore && (
                            <button
                                onClick={handleGenerateScore}
                                className="mt-2 w-full py-1 bg-indigo-600 text-white text-[10px] font-bold rounded shadow hover:bg-indigo-700 transition"
                            >
                                Generate
                            </button>
                        )}
                        {aiScore && (
                            <p className="text-[10px] mt-2 text-slate-600 dark:text-slate-400 leading-tight line-clamp-2" title={aiScore.reason}>
                                {aiScore.reason}
                            </p>
                        )}
                    </div>
                </div>

                {/* Interest Breakdown Panel */}
                {showBreakdown && accruedInterest > 0 && (
                    <div className="mb-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border dark:border-slate-700 text-sm animate-fade-in no-print">
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-2 border-b dark:border-slate-700 pb-1">Interest Calculation Details (व्याज तपशील)</p>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                            <span>Booked Interest (Already in system):</span>
                            <span className="font-mono">₹{member.loanInterestDue}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-2 border-b dark:border-slate-800 pb-2">
                            <span>+ Accrued Interest (Not yet booked):</span>
                            <span className="font-mono text-orange-600">₹{accruedInterest}</span>
                        </div>
                        <div className="space-y-1">
                            {interestBreakdown.map((line, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-slate-500 dark:text-slate-500 font-mono pl-2 border-l-2 border-slate-300 dark:border-slate-700 whitespace-pre-wrap">
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Personal Details Grid (Editable) */}
                {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t dark:border-slate-700 pt-4 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Mobile</label>
                            <input type="text" value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Category</label>
                            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                <option value="OPEN">OPEN</option>
                                <option value="OBC">OBC</option>
                                <option value="SC">SC</option>
                                <option value="ST">ST</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Aadhar</label>
                            <input type="text" value={formData.aadhar} onChange={e => setFormData({ ...formData, aadhar: e.target.value })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Loan Acc No</label>
                            <input type="text" value={formData.loanAccountNo} onChange={e => setFormData({ ...formData, loanAccountNo: e.target.value })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Loan Type</label>
                            <select value={formData.loanType || 'Short Term'} onChange={e => setFormData({ ...formData, loanType: e.target.value as any })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                <option value="Short Term">Short Term (अल्प)</option>
                                <option value="Medium Term">Medium Term (मध्यम)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Farmer Type</label>
                            <select value={formData.farmerType || 'Small Farmer'} onChange={e => setFormData({ ...formData, farmerType: e.target.value as any })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                <option value="Small Farmer">Small Farmer (लघु कृषक)</option>
                                <option value="Large Farmer">Large Farmer (मोठे कृषक)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Land Area</label>
                            <input type="text" value={formData.landArea} onChange={e => setFormData({ ...formData, landArea: e.target.value })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Bank Acc No</label>
                            <input type="text" value={formData.bankAccountNo} onChange={e => setFormData({ ...formData, bankAccountNo: e.target.value })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">DOB</label>
                            <input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Original Loan Date (उचल तारीख)</label>
                            <input type="date" value={formData.originalLoanDate || ''} onChange={e => setFormData({ ...formData, originalLoanDate: e.target.value })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Registration Date (नोंदणी तारीख)</label>
                            <input type="date" value={formData.membershipDate || ''} onChange={e => setFormData({ ...formData, membershipDate: e.target.value })}
                                className="bg-white text-slate-900 border-slate-300 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm border-t dark:border-slate-700 pt-4 text-slate-600 dark:text-slate-300">
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">Mobile:</span> {member.mobile}</div>
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">Category:</span> {member.category}</div>
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">Farmer Type:</span> {member.farmerType || 'Small Farmer'}</div>
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">Aadhar:</span> {member.aadhar}</div>
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">Loan Acc:</span> {member.loanAccountNo}</div>
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">Land:</span> {member.landArea}</div>
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">Bank Acc:</span> {member.bankAccountNo}</div>
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">DOB:</span> {formatDateDisplay(member.dob)}</div>
                        <div><span className="text-slate-500 dark:text-slate-400 font-medium">Orig. Loan Date:</span> {formatDateDisplay(member.originalLoanDate)}</div>

                        <div className="sm:col-span-2 md:col-span-4 mt-2 pt-2 border-t dark:border-slate-700 flex flex-col sm:flex-row sm:gap-4 font-bold text-slate-800 dark:text-slate-200">
                            <span className="block mb-1 sm:mb-0">Total Loan Outstanding (एकूण बाकी): <span className="text-red-600 dark:text-red-400">₹{Math.max(0, totalLoanOutstanding).toLocaleString()}</span></span>
                            {accruedInterest > 0 && <span className="text-xs font-normal text-slate-500 self-start sm:self-center">(Inc. Accrued Interest)</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* Transactions History */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden print:border-t print:border-black print:text-black w-full max-w-full">
                <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 dark:text-white">Transaction History</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleShareTransactions}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-xs md:text-sm font-medium no-print"
                            title="Share Transactions"
                        >
                            <Share2 size={16} /> Share
                        </button>
                        <button
                            onClick={exportTransactions}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition text-xs md:text-sm font-medium no-print"
                            title="Export Excel"
                        >
                            <Download size={16} /> Export Excel
                        </button>
                    </div>
                </div>
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">
                                <th className="p-3 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap">Date</th>
                                <th className="p-3 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap">Type</th>
                                <th className="p-3 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap">Account</th>
                                <th className="p-3 font-medium text-slate-500 dark:text-slate-300 min-w-[200px]">Details</th>
                                <th className="p-3 font-medium text-slate-500 dark:text-slate-300 text-right whitespace-nowrap">Amount</th>
                                <th className="p-3 font-medium text-slate-500 dark:text-slate-300 text-right whitespace-nowrap no-print">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberTransactions.map((t) => (
                                <tr key={t.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDateDisplay(t.date)}</td>
                                    <td className="p-3 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded text-xs ${t.type === TransactionType.CREDIT ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'}`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.accountType}</td>
                                    <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">{t.details}</td>
                                    <td className={`p-3 text-right font-mono whitespace-nowrap ${t.type === TransactionType.CREDIT ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {t.type === TransactionType.CREDIT ? '+' : '-'}₹{t.amount.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right no-print">
                                        <div className="relative z-10">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); initiateDelete(t.id); }}
                                                className="p-2 bg-red-50 text-red-600 border border-red-100 rounded hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/50 transition shadow-sm cursor-pointer"
                                                title="Delete Transaction"
                                            >
                                                <Trash2 size={16} className="pointer-events-none" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {memberTransactions.length === 0 && (
                                <tr><td colSpan={6} className="p-6 text-center text-slate-500 dark:text-slate-400">No transactions recorded.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl max-w-sm w-full border dark:border-slate-700 animate-fade-in-up">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-500">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Delete Transaction?</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Are you sure you want to delete this record? <br />
                                <span className="font-bold text-red-500">Member Balance will be reverted.</span>
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 py-2.5 border dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-lg transition"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print Container */}
            <div style={{ position: 'fixed', top: '-10000px', left: '-10000px' }}>
                <div ref={printRef} className="bg-white text-black p-10 w-[210mm] min-h-[297mm] flex flex-col font-sans relative">
                    <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                        <h1 className="text-3xl font-bold uppercase tracking-wider">Society Ilada</h1>
                        <p className="text-sm text-slate-600">Reg. No. 1425 | Management System</p>
                        <div className="mt-2 px-4 py-1 bg-slate-800 text-white inline-block text-sm font-bold rounded">ACCOUNT STATEMENT</div>
                    </div>

                    <div className="flex justify-between mb-8">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Member Details</p>
                            <h2 className="text-xl font-bold">{member.name}</h2>
                            <p>Member No: <span className="font-mono font-bold">#{member.memberNo}</span></p>
                            <p>Village: {member.village}</p>
                            <p>Mobile: {member.mobile}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase font-bold">Statement Info</p>
                            <p>Date: {format(new Date(), 'dd-MM-yyyy')}</p>
                            <p>Time: {format(new Date(), 'hh:mm a')}</p>
                            <p className="mt-2">Loan Acc: {member.loanAccountNo || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Account Summary Grid */}
                    <div className="mb-8">
                        <h3 className="text-sm font-bold uppercase border-b border-slate-400 mb-4 pb-1">Financial Summary</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                                <span>Savings Balance</span>
                                <span className="font-bold">₹{member.savingsBalance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                                <span>Share Balance</span>
                                <span className="font-bold">₹{member.shareBalance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                                <span>Loan Principal</span>
                                <span className="font-bold text-red-600">₹{member.loanPrincipal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                                <span>Interest Due</span>
                                <span className="font-bold text-orange-600">₹{totalInterestToShow.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                                <span>Original Loan Date</span>
                                <span>{formatDateDisplay(member.originalLoanDate)}</span>
                            </div>
                            <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                                <span>Farmer Type</span>
                                <span>{member.farmerType || 'Small Farmer'}</span>
                            </div>
                            <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                                <span>Membership Date</span>
                                <span>{formatDateDisplay(member.membershipDate)}</span>
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-slate-100 border border-slate-300 rounded flex justify-between items-center">
                            <span className="font-bold text-lg">Total Loan Outstanding</span>
                            <span className="font-bold text-xl text-red-700">₹{totalLoanOutstanding.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="flex-1">
                        <h3 className="text-sm font-bold uppercase border-b border-slate-400 mb-4 pb-1">Recent Transactions (Last 10)</h3>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-200">
                                <tr>
                                    <th className="p-2 text-left">Date</th>
                                    <th className="p-2 text-left">Type</th>
                                    <th className="p-2 text-left">Details</th>
                                    <th className="p-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {memberTransactions.slice(0, 10).map((t, i) => (
                                    <tr key={i} className="border-b border-slate-100">
                                        <td className="p-2">{formatDateDisplay(t.date)}</td>
                                        <td className="p-2">{t.type}</td>
                                        <td className="p-2 text-xs text-slate-600">{t.details}</td>
                                        <td className="p-2 text-right font-mono">₹{t.amount.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-8 text-center text-xs text-slate-400 border-t border-slate-200">
                        <p>Generated by Society Ilada Management System</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default MemberDetails;