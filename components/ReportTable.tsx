import React, { useState } from 'react';
import { Download, Share2, Search, Calendar, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { downloadBlob } from '../utils/downloadUtils';
import * as XLSX from 'xlsx';

export interface Column<T> {
    header: string;
    accessorKey: keyof T | string;
    render?: (item: T) => React.ReactNode;
    width?: string;
    className?: string; // Standard HTML class attribute
}

interface ReportTableProps<T> {
    title: string;
    columns: Column<T>[];
    data: T[];
    onRowClick?: (item: T) => void;
    enableDateFilter?: boolean;
    onDateRangeChange?: (start: string, end: string) => void;
    onDelete?: (item: T) => void;
    enableSearch?: boolean;
    enableExport?: boolean;
    enableShare?: boolean;
}

function ReportTable<T extends { id?: string | number }>({
    title,
    columns,
    data,
    onRowClick,
    enableDateFilter = true,
    onDateRangeChange,
    onDelete,
    enableSearch = true,
    enableExport = true,
    enableShare = true,
}: ReportTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Filter Data
    const filteredData = data.filter((item) => {
        // Basic search implementation - checks all string values
        if (enableSearch && searchTerm) {
            const searchStr = searchTerm.toLowerCase();
            const matches = Object.values(item as any).some((val) =>
                String(val).toLowerCase().includes(searchStr)
            );
            if (!matches) return false;
        }
        return true;
    });

    // Sort Data
    const sortedData = React.useMemo(() => {
        if (!sortConfig) return filteredData;
        return [...filteredData].sort((a: any, b: any) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
            return sortConfig.direction === 'asc'
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue));
        });
    }, [filteredData, sortConfig]);

    const hasTotalsRow = sortedData.some(item => 
        (item as any).id === 0 || 
        String((item as any).name || '').includes('एकूण') || 
        String((item as any).limit || '').includes('एकूण') || 
        String((item as any).category || '').includes('एकूण')
    );

    const getColumnTotal = (colKey: string) => {
        const sumKeys = [
            'principal', 'recoveredAmount', 'remainingBalance', 'repaymentAmount', 
            'interest', 'totalDue', 'balance', 'loanAmount', 'interest3', 'interest2_5',
            'disbAmount', 'total', 'subsidy', 'disbursement', 'repayment', 'product',
            'stTotal', 'mtTotal', 'st1', 'mt1', 'st2', 'mt2', 'st3', 'mt3', 'st4', 'mt4',
            'st5', 'mt5', 'stAbove5', 'mtAbove5', 'stOverdueAmt', 'mtOverdueAmt', 'stOverdueInt', 'mtOverdueInt',
            'memberCount', 'waiver'
        ];
        
        if (!sumKeys.some(k => k.toLowerCase() === colKey.toLowerCase())) {
            return null;
        }

        let total = 0;
        let hasValues = false;
        sortedData.forEach(item => {
            if ((item as any).id === 0) return;
            const val = (item as any)[colKey];
            if (val !== undefined && val !== null && val !== '') {
                const num = Number(val);
                if (!isNaN(num)) {
                    total += num;
                    hasValues = true;
                }
            }
        });

        return hasValues ? total : null;
    };

    const handleSort = (key: string) => {
        setSortConfig((current) => {
            if (current?.key === key && current.direction === 'asc') {
                return { key, direction: 'desc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const handleExportCSV = () => {
        if (data.length === 0) return;

        // Excel साठी render value extract करणे:
        // col.render असल्यास वापरा - जर plain string/number असेल तर Excel मध्ये टाका
        // React element असल्यास raw value वापरा
        const getExcelValue = (item: T, col: Column<T>): string | number => {
            let val: any = '';
            if (col.render) {
                const rendered = col.render(item);
                if (typeof rendered === 'string' || typeof rendered === 'number') {
                    val = rendered;
                } else {
                    val = (item as any)[col.accessorKey] ?? '';
                }
            } else {
                val = (item as any)[col.accessorKey] ?? '';
            }

            if (typeof val === 'string') {
                // ISO date → DD-MM-YYYY
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                    return `${val.slice(8, 10)}-${val.slice(5, 7)}-${val.slice(0, 4)}`;
                }
                if (val.trim() === '-' || val.trim() === 'N/A') {
                    return '';
                }
                // Convert formatted strings like "30,000" or "₹ 30,000" to actual numbers for Excel formulas
                const cleanStr = val.replace(/[₹\s,R]/g, '').trim();
                if (cleanStr !== '' && !isNaN(Number(cleanStr))) {
                    return Number(cleanStr);
                }
            }
            return val;
        };

        const headers = columns.map(c => c.header);
        const rows = data.map(item => columns.map(col => getExcelValue(item, col)));

        // Add total row if table has totals enabled (i.e. tfoot would render)
        if (!hasTotalsRow && data.length > 0) {
            const totalRow = columns.map((col, idx) => {
                const totalVal = getColumnTotal(col.accessorKey as string);
                if (idx === 0 || col.accessorKey === 'memberNo' || col.accessorKey === 'id' || col.header.toLowerCase() === 'no.') {
                    return data.length;
                } else if (col.accessorKey === 'name' || col.accessorKey === 'monthName' || idx === 1) {
                    return 'एकूण (Total)';
                } else if (col.accessorKey === 'recoveryPercentage') {
                    const totalDisb = getColumnTotal('disbAmount');
                    const totalRepay = getColumnTotal('repayment');
                    const totalWaiver = getColumnTotal('waiver');
                    if (totalDisb && totalDisb > 0) {
                        const totalRepayVal = totalRepay || 0;
                        const totalWaiverVal = totalWaiver || 0;
                        return `${(((totalRepayVal + totalWaiverVal) / totalDisb) * 100).toFixed(2)}%`;
                    }
                    return '0.00%';
                } else if (totalVal !== null) {
                    return totalVal;
                }
                return '';
            });
            rows.push(totalRow);
        }

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const fileName = `${title.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
        downloadBlob(blob, fileName);
    };

    const handleShare = async () => {
        try {
            // Import Capacitor Share dynamically
            const { Share } = await import('@capacitor/share');
            const { Capacitor } = await import('@capacitor/core');

            const shareUrl = 'https://society-ilada1425.vercel.app' + window.location.hash;

            if (Capacitor.isNativePlatform()) {
                // Android/iOS: Use Capacitor Share
                await Share.share({
                    title: `Society Ilada - ${title}`,
                    text: `Check out the ${title} report.`,
                    url: shareUrl,
                    dialogTitle: 'Share Report'
                });
            } else {
                // Web: Use Web Share API if available
                if (navigator.share) {
                    await navigator.share({
                        title: `Society Ilada - ${title}`,
                        text: `Check out the ${title} report.`,
                        url: shareUrl,
                    });
                } else {
                    alert('Sharing is not supported on this device/browser.');
                }
            }
        } catch (error) {
            console.log('Error sharing:', error);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col h-full">
            {/* Header Controls */}
            <div className="p-4 border-b dark:border-slate-700 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h2>
                    <div className="flex gap-2">
                        {enableShare && (
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition text-sm font-medium"
                            >
                                <Share2 size={16} /> Share
                            </button>
                        )}
                        {enableExport && (
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                            >
                                <Download size={16} /> CSV
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-3">
                    {/* Date Filter */}
                    {enableDateFilter && (
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border dark:border-slate-700 w-full lg:w-auto">
                            <Calendar size={18} className="text-slate-400 ml-2" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    if (onDateRangeChange) onDateRangeChange(e.target.value, endDate);
                                }}
                                className="bg-transparent text-sm outline-none text-slate-700 dark:text-slate-300 w-full lg:w-32"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    if (onDateRangeChange) onDateRangeChange(startDate, e.target.value);
                                }}
                                className="bg-transparent text-sm outline-none text-slate-700 dark:text-slate-300 w-full lg:w-32"
                            />
                        </div>
                    )}

                    {/* Search */}
                    {enableSearch && (
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search records..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full min-w-max text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                        <tr>
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    onClick={() => handleSort(col.accessorKey as string)}
                                    className={`p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${col.className || ''}`}
                                    style={{ width: col.width }}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {sortConfig?.key === col.accessorKey && (
                                            sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                        )}
                                    </div>
                                </th>
                            ))}
                            {onDelete && <th className="p-4 w-16 sticky right-0 bg-slate-50 dark:bg-slate-900 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedData.length > 0 ? (
                            sortedData.map((item, rowIdx) => (
                                <tr
                                    key={rowIdx}
                                    onClick={() => onRowClick && onRowClick(item)}
                                    className={`
                    group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `}
                                >
                                    {columns.map((col, colIdx) => (
                                        <td
                                            key={colIdx}
                                            className={`p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap ${col.className || ''}`}
                                        >
                                            {col.render ? col.render(item) : (item as any)[col.accessorKey]}
                                        </td>
                                    ))}

                                    {onDelete && (
                                        <td className="p-4 w-16 sticky right-0 bg-white dark:bg-slate-800 group-hover:bg-blue-50/50 dark:group-hover:bg-slate-800/50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-none transition-colors text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(item);
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                                                title="Delete Record"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length + (onDelete ? 1 : 0)} className="text-center p-8 text-slate-400">
                                    No records found matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {!hasTotalsRow && sortedData.length > 0 && (
                        <tfoot className="bg-slate-50 dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10 font-bold text-slate-800 dark:text-white">
                            <tr>
                                {columns.map((col, idx) => {
                                    const totalVal = getColumnTotal(col.accessorKey as string);
                                    let content: React.ReactNode = '';

                                    if (idx === 0 || col.accessorKey === 'memberNo' || col.accessorKey === 'id' || col.header.toLowerCase() === 'no.') {
                                        content = `${sortedData.length}`;
                                    } else if (col.accessorKey === 'name' || col.accessorKey === 'monthName' || idx === 1) {
                                        content = 'एकूण (Total)';
                                    } else if (col.accessorKey === 'recoveryPercentage') {
                                        const totalDisb = getColumnTotal('disbAmount');
                                        const totalRepay = getColumnTotal('repayment');
                                        const totalWaiver = getColumnTotal('waiver');
                                        if (totalDisb && totalDisb > 0) {
                                            const totalRepayVal = totalRepay || 0;
                                            const totalWaiverVal = totalWaiver || 0;
                                            content = `${(((totalRepayVal + totalWaiverVal) / totalDisb) * 100).toFixed(2)}%`;
                                        } else {
                                            content = '0.00%';
                                        }
                                    } else if (totalVal !== null) {
                                        content = totalVal.toLocaleString();
                                    }

                                    return (
                                        <td
                                            key={idx}
                                            className={`p-4 text-sm font-bold whitespace-nowrap ${col.className || ''}`}
                                        >
                                            {content}
                                        </td>
                                    );
                                })}
                                {onDelete && <td className="p-4 w-16 sticky right-0 bg-slate-50 dark:bg-slate-900 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none"></td>}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Footer / Pagination (simplified for now) */}
            <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-xl text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                <span>Showing {sortedData.length} entries</span>
                <span>{title} System Report</span>
            </div>
        </div>
    );
}

export default ReportTable;
