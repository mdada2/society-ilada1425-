import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { format } from 'date-fns';
import { Download, AlertTriangle, CheckCircle, List, TrendingUp, IndianRupee, Calendar, Users, Filter, Printer, Table, Share2 } from 'lucide-react';
import { TransactionType } from '../../types';
import { calculateLoanInterest } from '../../utils/loanCalculator';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { downloadBlob } from '../../utils/downloadUtils';
import { exportFinancialReportToExcel } from '../../services/excelExport';

const Reports = () => {
    const { transactions, members, settings } = useApp();
    // Dates
    const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd')); // To Date
    const [fromDate, setFromDate] = useState(settings.financialYearStart); // From Date
    const [useDateFilter, setUseDateFilter] = useState(false); // Toggle

    const [activeTab, setActiveTab] = useState<'daybook' | 'active_loans' | 'defaulters' | 'all_outstanding'>('daybook');

    // View Modes
    const [outstandingView, setOutstandingView] = useState<'list' | 'summary'>('list');

    const outstandingSummaryRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();

    const dayTransactions = transactions.filter(t => t.date === reportDate);

    const totalCredit = dayTransactions
        .filter(t => t.type === TransactionType.CREDIT)
        .reduce((sum, t) => sum + t.amount, 0);

    const totalDebit = dayTransactions
        .filter(t => t.type === TransactionType.DEBIT)
        .reduce((sum, t) => sum + t.amount, 0);

    // Helper: Native Difference in Days (Robust)
    const getDifferenceInDays = (d1Str: string, d2Str: string): number => {
        if (!d1Str || !d2Str) return 0;
        try {
            const parse = (s: string) => {
                if (!s.includes('-')) return new Date().getTime(); // Fallback
                const p = s.split('-');
                return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
            };
            const t1 = parse(d1Str);
            const t2 = parse(d2Str);
            return Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
        } catch (e) {
            return 0;
        }
    };

    // 1. Get All Outstanding Loans based on REPORT DATE (To Date)
    const allOutstandingLoans = useMemo(() => {
        let filteredMembers = members.filter(m => m.loanPrincipal > 0);

        // Apply Date Range Filter if Enabled (Filter by Loan Taken Date)
        if (useDateFilter) {
            const start = new Date(fromDate).getTime();
            const end = new Date(reportDate).getTime();
            filteredMembers = filteredMembers.filter(m => {
                const loanDate = new Date(m.originalLoanDate || m.lastLoanCalculationDate || '2000-01-01').getTime();
                return loanDate >= start && loanDate <= end;
            });
        }

        return filteredMembers.map(m => {
            const lastCalcDate = m.lastLoanCalculationDate || '2022-04-01';

            const { interest: accrued } = calculateLoanInterest(
                m.loanPrincipal,
                lastCalcDate,
                reportDate,
                settings.financialYearStart,
                settings.financialYearEnd,
                false, // Show interest in reports (NPA/defaulters need to see accumulated interest)
                undefined,
                settings.firstYearInterestRate || 6,
                settings.subsequentYearInterestRate || 12
            );

            const totalInterest = m.loanInterestDue + accrued;
            const agingDate = m.originalLoanDate || lastCalcDate;

            return {
                ...m,
                loanDate: agingDate,
                calculatedInterest: totalInterest,
                totalDue: m.loanPrincipal + totalInterest
            };
        });
    }, [members, reportDate, fromDate, useDateFilter, settings]);

    const activeLoans = allOutstandingLoans.filter(m => {
        const daysPending = getDifferenceInDays(m.loanDate, reportDate);
        return daysPending <= 365;
    });

    const defaulterLoans = allOutstandingLoans.filter(m => {
        const daysPending = getDifferenceInDays(m.loanDate, reportDate);
        return daysPending > 365;
    });

    // --- All Outstanding Goshwara Logic ---
    const outstandingGoshwara = useMemo(() => {
        // Structure: Rows for Large Farmer, Small Farmer, Total
        // Cols: Short Term (Thakit/Chalu), Medium Term (Thakit/Chalu)

        const createBucket = () => ({ count: 0, amount: 0, interest: 0 });
        const createRow = (label: string) => ({
            label,
            st_thakit: createBucket(),
            st_chalu: createBucket(),
            mt_thakit: createBucket(),
            mt_chalu: createBucket(),
        });

        const rows = {
            large: createRow('मोठे कृषक'),
            small: createRow('लघु कृषक'),
            st_cat: createRow('आदिवासी कृषक'),
            non_st: createRow('बिगर आदिवासी कृषक'),
        };

        allOutstandingLoans.forEach(loan => {
            const days = getDifferenceInDays(loan.loanDate, reportDate);
            const isThakit = days > 365;
            const isMediumTerm = (loan.loanType || '').toLowerCase().includes('medium');
            const isLargeFarmer = (loan.farmerType || '').toLowerCase().includes('large');
            const isST = (loan.category || '').toUpperCase() === 'ST';

            const targetRowFarmer = isLargeFarmer ? rows.large : rows.small;
            const targetRowCategory = isST ? rows.st_cat : rows.non_st;

            const amount = loan.totalDue;
            const interest = loan.calculatedInterest;

            // Helper to add to bucket
            const addToBucket = (row: typeof rows.large) => {
                if (isMediumTerm) {
                    if (isThakit) {
                        row.mt_thakit.count++;
                        row.mt_thakit.amount += amount;
                        row.mt_thakit.interest += interest;
                    }
                    else {
                        row.mt_chalu.count++;
                        row.mt_chalu.amount += amount;
                        row.mt_chalu.interest += interest;
                    }
                } else {
                    // Short Term
                    if (isThakit) {
                        row.st_thakit.count++;
                        row.st_thakit.amount += amount;
                        row.st_thakit.interest += interest;
                    }
                    else {
                        row.st_chalu.count++;
                        row.st_chalu.amount += amount;
                        row.st_chalu.interest += interest;
                    }
                }
            };

            addToBucket(targetRowFarmer);
            addToBucket(targetRowCategory);
        });

        // Calculate Totals for Farmer Table
        const farmerTotal = createRow('एकूण');
        ['st_thakit', 'st_chalu', 'mt_thakit', 'mt_chalu'].forEach(k => {
            const key = k as keyof typeof rows.large;
            if (typeof rows.large[key] === 'object') {
                // @ts-ignore
                farmerTotal[key].count = rows.large[key].count + rows.small[key].count;
                // @ts-ignore
                farmerTotal[key].amount = rows.large[key].amount + rows.small[key].amount;
                // @ts-ignore
                farmerTotal[key].interest = rows.large[key].interest + rows.small[key].interest;
            }
        });

        // Calculate Totals for Category Table
        const catTotal = createRow('एकूण');
        ['st_thakit', 'st_chalu', 'mt_thakit', 'mt_chalu'].forEach(k => {
            const key = k as keyof typeof rows.large;
            if (typeof rows.st_cat[key] === 'object') {
                // @ts-ignore
                catTotal[key].count = rows.st_cat[key].count + rows.non_st[key].count;
                // @ts-ignore
                catTotal[key].amount = rows.st_cat[key].amount + rows.non_st[key].amount;
                // @ts-ignore
                catTotal[key].interest = rows.st_cat[key].interest + rows.non_st[key].interest;
            }
        });

        return {
            farmerTable: [rows.large, rows.small, farmerTotal],
            categoryTable: [rows.st_cat, rows.non_st, catTotal]
        };
    }, [allOutstandingLoans, reportDate]);

    const handleExportExcel = () => {
        exportFinancialReportToExcel(members, transactions);
    };

    const handleShareExcel = async () => {
        exportFinancialReportToExcel(members, transactions);
    };

    const handlePrintRef = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
        if (ref.current) {
            try {
                const canvasOptions = {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false
                };
                const canvas = await html2canvas(ref.current, canvasOptions);
                const imgData = canvas.toDataURL('image/jpeg', 0.7);
                const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const ratio = pdfWidth / canvas.width;
                const imgHeight = canvas.height * ratio;

                pdf.addImage(imgData, 'JPEG', 0, 10, pdfWidth, imgHeight);
                const pdfBlob = pdf.output('blob');
                downloadBlob(pdfBlob, `${filename}.pdf`);
                setTimeout(() => alert("Download complete"), 500);
            } catch (e) {
                console.error(e);
                alert("Print failed");
            }
        } else {
            window.print();
        }
    };

    const handleShareRefPDF = async (ref: React.RefObject<HTMLDivElement>, filename: string, title: string) => {
        if (ref.current) {
            try {
                const canvasOptions = {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false
                };
                const canvas = await html2canvas(ref.current, canvasOptions);
                const imgData = canvas.toDataURL('image/jpeg', 0.7);
                const pdf = new jsPDF('l', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const ratio = pdfWidth / canvas.width;
                const imgHeight = canvas.height * ratio;
                pdf.addImage(imgData, 'JPEG', 0, 10, pdfWidth, imgHeight);

                const pdfBlob = pdf.output('blob');
                const file = new File([pdfBlob], `${filename}.pdf`, { type: 'application/pdf' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title, text: `${title} PDF attached.` });
                } else {
                    alert("Sharing not supported.");
                }
            } catch (e) {
                console.error(e);
                alert("Failed to share PDF.");
            }
        }
    };

    const formatDateDisplay = (d?: string) => {
        if (!d) return '';
        try {
            return format(new Date(d), 'dd-MM-yyyy');
        } catch (e) { return d; }
    };

    const renderLoanTable = (data: typeof allOutstandingLoans, title: string, description: string, iconType: 'check' | 'alert' | 'list', isAllOutstanding: boolean = false) => {
        const safeData = Array.isArray(data) ? data : [];

        const totalPrincipal = safeData.reduce((sum, item) => sum + item.loanPrincipal, 0);
        const totalInterest = safeData.reduce((sum, item) => sum + item.calculatedInterest, 0);
        const grandTotal = safeData.reduce((sum, item) => sum + item.totalDue, 0);

        // Use settings for headers
        const h = settings.reportHeaders;

        const exportData = safeData.map(m => ({
            [h.memberNo || 'Member No']: m.memberNo,
            [h.name || 'Name']: m.name,
            [h.village || 'Village']: m.village,
            [h.loanDate || 'OriginalLoanDate']: formatDateDisplay(m.loanDate),
            [h.days || 'DaysPending']: getDifferenceInDays(m.loanDate, reportDate),
            [h.principal || 'LoanPrincipal']: m.loanPrincipal,
            [h.interest || 'InterestDue']: m.calculatedInterest,
            [h.totalDue || 'TotalDue']: m.totalDue
        }));

        return (
            <div>
                {/* Sticky Summary Section */}
                <div className="sticky top-32 md:top-[72px] z-20 bg-slate-50 dark:bg-slate-900 py-4 -mx-6 px-6 shadow-sm border-b dark:border-slate-800 transition-all">
                    {/* Date Selection & Filters */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                            <Calendar size={18} />
                        </div>

                        {/* Date Inputs */}
                        <div className="flex items-center gap-2 md:gap-4 flex-1">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">From Date</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={e => setFromDate(e.target.value)}
                                    className="w-full p-1.5 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </div>
                            <div className="text-slate-400 pt-4">➜</div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">To Date (As On)</label>
                                <input
                                    type="date"
                                    value={reportDate}
                                    onChange={e => setReportDate(e.target.value)}
                                    className="w-full p-1.5 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Filter Toggle */}
                        <div className="border-t md:border-t-0 md:border-l dark:border-slate-700 pt-2 md:pt-0 md:pl-4 mt-2 md:mt-0">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <div className="relative">
                                    <input type="checkbox" className="sr-only peer" checked={useDateFilter} onChange={e => setUseDateFilter(e.target.checked)} />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </div>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                    <Filter size={12} /> Filter by Loan Date (कर्ज दिनांकानुसार)
                                </span>
                            </label>
                        </div>

                        <div className="ml-auto text-right text-[10px] text-slate-500 dark:text-slate-400 hidden lg:block max-w-[150px]">
                            <p>Calculation: Up to 'To Date'</p>
                            <p>{useDateFilter ? "Showing: Loans taken in range" : "Showing: All outstanding"}</p>
                        </div>
                    </div>

                    {/* Totals Summary Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Members</p>
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-purple-600 dark:text-purple-400" />
                                <p className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">{safeData.length}</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Principal</p>
                            <div className="flex items-center gap-2">
                                <IndianRupee size={16} className="text-blue-600 dark:text-blue-400" />
                                <p className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">₹{totalPrincipal.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Interest (Est.)</p>
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-orange-600 dark:text-orange-400" />
                                <p className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">₹{totalInterest.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 p-3 md:p-4 rounded-xl shadow-sm border border-red-100 dark:border-red-900/50 flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Grand Total Due</p>
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
                                <p className="text-lg md:text-xl font-bold text-red-700 dark:text-red-300">₹{grandTotal.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* View Toggle for All Outstanding */}
                {isAllOutstanding && (
                    <div className="flex gap-2 my-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                        <button
                            onClick={() => setOutstandingView('list')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${outstandingView === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
                        >
                            <List size={16} /> List (यादी)
                        </button>
                        <button
                            onClick={() => setOutstandingView('summary')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${outstandingView === 'summary' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500'}`}
                        >
                            <Table size={16} /> Goshwara (गोषवारा)
                        </button>
                    </div>
                )}

                {/* Scrollable Content */}
                <div className="pt-2">
                    {(!isAllOutstanding || outstandingView === 'list') && (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-slate-500 dark:text-slate-400 text-sm italic flex items-center gap-2">
                                    {iconType === 'alert' && <AlertTriangle size={16} className="text-red-500" />}
                                    {iconType === 'check' && <CheckCircle size={16} className="text-green-500" />}
                                    {iconType === 'list' && <List size={16} className="text-blue-500" />}
                                    {description}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleExportExcel}
                                        className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded hover:bg-emerald-700 transition shadow-sm text-sm"
                                    >
                                        <Download size={16} /> Export Excel
                                    </button>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">
                                            <tr>
                                                <th className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{h.memberNo}</th>
                                                <th className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{h.name}</th>
                                                <th className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{h.village}</th>
                                                <th className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{h.loanDate}</th>
                                                <th className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{h.days}</th>
                                                <th className="p-3 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">{h.principal}</th>
                                                <th className="p-3 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">{h.interest}</th>
                                                <th className="p-3 text-right font-bold text-slate-800 dark:text-white whitespace-nowrap">{h.totalDue}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {safeData.length === 0 ? (
                                                <tr><td colSpan={8} className="p-6 text-center text-slate-500 dark:text-slate-400">No records found.</td></tr>
                                            ) : safeData.map(m => {
                                                const days = getDifferenceInDays(m.loanDate, reportDate);
                                                const isDefaulter = days > 365;
                                                return (
                                                    <tr
                                                        key={m.id}
                                                        onClick={() => navigate(`/members/${m.id}`)}
                                                        className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                                                    >
                                                        <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">#{m.memberNo}</td>
                                                        <td className="p-3 font-medium text-slate-800 dark:text-white whitespace-nowrap">{m.name}</td>
                                                        <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{m.village}</td>
                                                        <td className="p-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{formatDateDisplay(m.loanDate)}</td>
                                                        <td className="p-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                                            <span className={`px-2 py-1 rounded ${isDefaulter ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                                                {days} days
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">₹{m.loanPrincipal.toLocaleString()}</td>
                                                        <td className="p-3 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">₹{m.calculatedInterest.toLocaleString()}</td>
                                                        <td className="p-3 text-right font-bold text-slate-800 dark:text-white whitespace-nowrap">₹{m.totalDue.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* --- GOSHAWARA TABLE VIEW --- */}
                    {isAllOutstanding && outstandingView === 'summary' && (
                        <div className="space-y-8 animate-fade-in" ref={outstandingSummaryRef}>
                            <div className="flex justify-end no-print gap-2">
                                <button
                                    onClick={handleExportExcel}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-emerald-700 transition shadow-sm font-bold"
                                >
                                    <Download size={16} /> Export Excel
                                </button>

                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleShareRefPDF(outstandingSummaryRef, `Outstanding_Goshwara_${reportDate}`, "Outstanding Goshwara Report")}
                                        className="bg-indigo-600 text-white px-3 py-2 rounded-l flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm font-bold"
                                    >
                                        <Share2 size={16} /> Share PDF
                                    </button>
                                    <button
                                        onClick={() => handlePrintRef(outstandingSummaryRef, `Outstanding_Goshwara_${reportDate}`)}
                                        className="bg-blue-600 text-white px-3 py-2 rounded-r flex items-center gap-2 hover:bg-blue-700 transition shadow-sm font-bold border-l border-white/20"
                                    >
                                        <Printer size={16} /> Print
                                    </button>
                                </div>
                            </div>

                            {[
                                { title: 'कृषकाचे प्रकारानुसार', data: outstandingGoshwara.farmerTable, showHeader: true },
                                { title: 'सामाजिक प्रवर्गानुसार', data: outstandingGoshwara.categoryTable, showHeader: false }
                            ].map((section, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
                                    {section.showHeader && (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b dark:border-slate-700 text-center">
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{section.title}</h3>
                                            <p className="text-xs text-slate-500">As on: {formatDateDisplay(reportDate)}</p>
                                        </div>
                                    )}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-center border-collapse text-xs md:text-sm">
                                            <thead>
                                                <tr className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                                    <th rowSpan={3} className="border dark:border-slate-600 p-2 min-w-[150px]">प्रकार</th>
                                                    <th colSpan={6} className="border dark:border-slate-600 p-2 bg-blue-50 dark:bg-blue-900/20">अल्प मुदती</th>
                                                    <th colSpan={6} className="border dark:border-slate-600 p-2 bg-purple-50 dark:bg-purple-900/20">मध्यम मुदती</th>
                                                    <th colSpan={2} className="border dark:border-slate-600 p-2 bg-orange-50 dark:bg-orange-900/20">एकूण थकीत व्याज</th>
                                                </tr>
                                                <tr className="bg-slate-50 dark:bg-slate-700/50">
                                                    {/* Short Term */}
                                                    <th colSpan={2} className="border dark:border-slate-600 p-2 text-red-600 dark:text-red-400">थकीत</th>
                                                    <th colSpan={2} className="border dark:border-slate-600 p-2 text-green-600 dark:text-green-400">चालू</th>
                                                    <th colSpan={2} className="border dark:border-slate-600 p-2 font-bold">एकूण</th>
                                                    {/* Medium Term */}
                                                    <th colSpan={2} className="border dark:border-slate-600 p-2 text-red-600 dark:text-red-400">थकीत</th>
                                                    <th colSpan={2} className="border dark:border-slate-600 p-2 text-green-600 dark:text-green-400">चालू</th>
                                                    <th colSpan={2} className="border dark:border-slate-600 p-2 font-bold">एकूण</th>
                                                    {/* Total Interest */}
                                                    <th rowSpan={2} className="border dark:border-slate-600 p-1 text-orange-600 dark:text-orange-400">सभा</th>
                                                    <th rowSpan={2} className="border dark:border-slate-600 p-1 text-orange-600 dark:text-orange-400">रक्कम</th>
                                                </tr>
                                                <tr className="text-[10px] text-slate-500">
                                                    {Array(2).fill(null).map((_, i) => (
                                                        <React.Fragment key={i}>
                                                            <th className="border dark:border-slate-600 p-1">सभा</th>
                                                            <th className="border dark:border-slate-600 p-1">रक्कम</th>
                                                            <th className="border dark:border-slate-600 p-1">सभा</th>
                                                            <th className="border dark:border-slate-600 p-1">रक्कम</th>
                                                            <th className="border dark:border-slate-600 p-1 font-bold">सभा</th>
                                                            <th className="border dark:border-slate-600 p-1 font-bold">रक्कम</th>
                                                        </React.Fragment>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.data.map((row: any, rIdx: number) => {
                                                    const isTotal = rIdx === section.data.length - 1;
                                                    // Calculate total interest for this row
                                                    const totalInterestCount = row.st_thakit.count + row.st_chalu.count + row.mt_thakit.count + row.mt_chalu.count;
                                                    const totalInterestAmount = row.st_thakit.interest + row.st_chalu.interest + row.mt_thakit.interest + row.mt_chalu.interest;

                                                    return (
                                                        <tr key={rIdx} className={`${isTotal ? 'bg-slate-100 dark:bg-slate-700 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                                            <td className="border dark:border-slate-600 p-2 text-left">{row.label}</td>

                                                            {/* Short Term Data */}
                                                            <td className="border dark:border-slate-600 p-2 text-red-600 dark:text-red-400">{row.st_thakit.count}</td>
                                                            <td className="border dark:border-slate-600 p-2 text-red-600 dark:text-red-400">{row.st_thakit.amount.toLocaleString()}</td>
                                                            <td className="border dark:border-slate-600 p-2 text-green-600 dark:text-green-400">{row.st_chalu.count}</td>
                                                            <td className="border dark:border-slate-600 p-2 text-green-600 dark:text-green-400">{row.st_chalu.amount.toLocaleString()}</td>
                                                            <td className="border dark:border-slate-600 p-2 font-bold">{row.st_thakit.count + row.st_chalu.count}</td>
                                                            <td className="border dark:border-slate-600 p-2 font-bold">{(row.st_thakit.amount + row.st_chalu.amount).toLocaleString()}</td>

                                                            {/* Medium Term Data */}
                                                            <td className="border dark:border-slate-600 p-2 text-red-600 dark:text-red-400">{row.mt_thakit.count}</td>
                                                            <td className="border dark:border-slate-600 p-2 text-red-600 dark:text-red-400">{row.mt_thakit.amount.toLocaleString()}</td>
                                                            <td className="border dark:border-slate-600 p-2 text-green-600 dark:text-green-400">{row.mt_chalu.count}</td>
                                                            <td className="border dark:border-slate-600 p-2 text-green-600 dark:text-green-400">{row.mt_chalu.amount.toLocaleString()}</td>
                                                            <td className="border dark:border-slate-600 p-2 font-bold">{row.mt_thakit.count + row.mt_chalu.count}</td>
                                                            <td className="border dark:border-slate-600 p-2 font-bold">{(row.mt_thakit.amount + row.mt_chalu.amount).toLocaleString()}</td>

                                                            {/* Total Interest */}
                                                            <td className="border dark:border-slate-600 p-2 font-bold text-orange-600 dark:text-orange-400">{totalInterestCount}</td>
                                                            <td className="border dark:border-slate-600 p-2 font-bold text-orange-600 dark:text-orange-400">{totalInterestAmount.toLocaleString()}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

};

export default Reports;