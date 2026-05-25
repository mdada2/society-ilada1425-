import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { format } from 'date-fns';
import { Truck, Save, Trash2, Edit, X, Archive, AlertCircle, MapPin, ClipboardList, Package, Share2, Download, Send, ShieldCheck, Calendar, Filter, Plus } from 'lucide-react';
import { DispatchRecord, PaddyDO } from '../types';
import { downloadBlob } from '../utils/downloadUtils';
import { exportDispatchesToExcel, exportPaddyDOsToExcel } from '../services/excelExport';

const Dispatch = () => {
    const { dispatches, addDispatch, updateDispatch, deleteDispatch, paddyDOs, addPaddyDO, updatePaddyDO, deletePaddyDO, paddySeasons, getActiveSeason, settings } = useApp();
    const { showConfirm } = useDialog();

    // Tab state
    const [activeTab, setActiveTab] = useState<'dispatches' | 'deliveryOrders'>('dispatches');

    // Season state
    const [seasonFilter, setSeasonFilter] = useState<string>('all');
    const activeSeason = getActiveSeason();
    const currentSeasonCode = activeSeason?.code || '';

    // D.O. Entry form states
    const [doDate, setDoDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [doNumInput, setDoNumInput] = useState('');
    const [doMillName, setDoMillName] = useState('');
    const [doApprovedBags, setDoApprovedBags] = useState<number | ''>(0);
    const [doApprovedWeight, setDoApprovedWeight] = useState<number | ''>(0);
    const [editingDoId, setEditingDoId] = useState<string | null>(null);

    // Delete Security State for Dispatches
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
    const [deletePin, setDeletePin] = useState('');
    const [deleteError, setDeleteError] = useState('');

    // Delete Security State for D.O.s
    const [showDoDeleteModal, setShowDoDeleteModal] = useState(false);
    const [doToDelete, setDoToDelete] = useState<string | null>(null);
    const [doDeletePin, setDoDeletePin] = useState('');
    const [doDeleteError, setDoDeleteError] = useState('');

    // Dispatch form states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [millName, setMillName] = useState('');
    const [doNumber, setDoNumber] = useState('');
    const [tpNumber, setTpNumber] = useState('');
    const [truckNumber, setTruckNumber] = useState('');
    const [driverName, setDriverName] = useState('');
    const [storageSource, setStorageSource] = useState<'Godown' | 'Shed' | 'Open'>('Godown');
    const [bags, setBags] = useState<number | ''>(0);
    const [weight, setWeight] = useState<number | ''>(0);
    const [newBagsUsed, setNewBagsUsed] = useState<number>(0);
    const [oldBagsUsed, setOldBagsUsed] = useState<number>(0);
    const [usedOnceBagsUsed, setUsedOnceBagsUsed] = useState<number>(0);

    // Helper calculations: Group dispatches by D.O. number to track balance
    const doStatsMap = useMemo(() => {
        const stats: Record<string, { bags: number; weight: number }> = {};
        
        // Filter dispatches for the current season
        const seasonDispatches = dispatches.filter(d => d.season === currentSeasonCode);
        
        seasonDispatches.forEach(d => {
            if (!d.doNumber) return;
            const upperDO = d.doNumber.toUpperCase().trim();
            if (!stats[upperDO]) {
                stats[upperDO] = { bags: 0, weight: 0 };
            }
            stats[upperDO].bags += d.bags || 0;
            stats[upperDO].weight += d.weight || 0;
        });
        return stats;
    }, [dispatches, currentSeasonCode]);

    // Active season DO list
    const currentSeasonDOs = useMemo(() => {
        return paddyDOs.filter(d => d.season === currentSeasonCode);
    }, [paddyDOs, currentSeasonCode]);

    // Filtered D.O. list based on season filter for Tab 2
    const filteredDOs = useMemo(() => {
        if (seasonFilter === 'all') return paddyDOs;
        return paddyDOs.filter(d => d.season === seasonFilter);
    }, [seasonFilter, paddyDOs]);

    // Selected D.O. record in form
    const selectedDO = useMemo(() => {
        if (!doNumber || doNumber === 'MANUAL') return null;
        return currentSeasonDOs.find(d => d.doNumber.toUpperCase().trim() === doNumber.toUpperCase().trim());
    }, [doNumber, currentSeasonDOs]);

    const selectedDOStats = useMemo(() => {
        if (!selectedDO) return null;
        const upperDO = selectedDO.doNumber.toUpperCase().trim();
        return doStatsMap[upperDO] || { bags: 0, weight: 0 };
    }, [selectedDO, doStatsMap]);

    const resetForm = () => {
        setEditingId(null);
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setMillName('');
        setDoNumber('');
        setTpNumber('');
        setTruckNumber('');
        setDriverName('');
        setStorageSource('Godown');
        setBags(0);
        setWeight(0);
        setNewBagsUsed(0);
        setOldBagsUsed(0);
        setUsedOnceBagsUsed(0);
    };

    const handleDOChange = (val: string) => {
        setDoNumber(val);
        if (val === 'MANUAL') {
            setMillName('');
            return;
        }
        const matchedDO = currentSeasonDOs.find(d => d.doNumber.toUpperCase().trim() === val.toUpperCase().trim());
        if (matchedDO) {
            setMillName(matchedDO.millName);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Total bags check
        const totalBagsAllocated = Number(newBagsUsed) + Number(oldBagsUsed) + Number(usedOnceBagsUsed);
        if (totalBagsAllocated !== Number(bags)) {
            const confirmed = await showConfirm({
                title: 'Bag Count Mismatch',
                titleMr: 'पोत्यांची संख्या जुळत नाही',
                message: `Total bags (${bags}) doesn't match the sum of bag types (${totalBagsAllocated}). Do you want to proceed anyway?`,
                messageMr: `एकूण पोते (${bags}) आणि पोत्यांची बेरीज (${totalBagsAllocated}) जुळत नाही. तरीही पुढे जायचे?`,
                icon: '⚠️',
                confirmText: 'Proceed Anyway',
                confirmTextMr: 'तरीही पुढे जा',
                confirmColor: 'amber'
            });
            if (!confirmed) {
                return;
            }
        }

        const record: DispatchRecord = {
            id: editingId || Date.now().toString(),
            date,
            season: currentSeasonCode,
            millName,
            doNumber: doNumber === 'MANUAL' ? '' : doNumber.toUpperCase().trim(),
            tpNumber,
            truckNumber,
            driverName,
            storageSource,
            bags: Number(bags) || 0,
            weight: Number(weight) || 0,
            newBagsUsed: Number(newBagsUsed) || 0,
            oldBagsUsed: Number(oldBagsUsed) || 0,
            usedOnceBagsUsed: Number(usedOnceBagsUsed) || 0,
            timestamp: editingId ? (dispatches.find(d => d.id === editingId)?.timestamp || Date.now()) : Date.now()
        };

        if (editingId) updateDispatch(record);
        else addDispatch(record);
        resetForm();
        alert("Dispatch Record Saved!");
    };

    const handleDOSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentSeasonCode) {
            alert("कृपया प्रथम हंगाम सुरू करा! (Please create a season first!)");
            return;
        }

        const record: PaddyDO = {
            id: editingDoId || Date.now().toString(),
            season: currentSeasonCode,
            doNumber: doNumInput.toUpperCase().trim(),
            millName: doMillName,
            approvedBags: Number(doApprovedBags) || 0,
            approvedWeight: Number(doApprovedWeight) || 0,
            date: doDate,
            timestamp: editingDoId ? (paddyDOs.find(d => d.id === editingDoId)?.timestamp || Date.now()) : Date.now()
        };

        if (editingDoId) updatePaddyDO(record);
        else addPaddyDO(record);

        // Reset DO form
        setEditingDoId(null);
        setDoNumInput('');
        setDoMillName('');
        setDoApprovedBags(0);
        setDoApprovedWeight(0);
        setDoDate(format(new Date(), 'yyyy-MM-dd'));
        alert("D.O. Record Saved successfully!");
    };

    const handleEdit = (record: DispatchRecord) => {
        setEditingId(record.id);
        setDate(record.date);
        setMillName(record.millName);
        
        // If the DO number is present in current season DOs, set it, else manual
        const hasDO = currentSeasonDOs.some(d => d.doNumber.toUpperCase().trim() === (record.doNumber || '').toUpperCase().trim());
        if (record.doNumber && hasDO) {
            setDoNumber(record.doNumber);
        } else {
            setDoNumber(record.doNumber ? 'MANUAL' : '');
        }

        setTpNumber(record.tpNumber || '');
        setTruckNumber(record.truckNumber);
        setDriverName(record.driverName || '');
        setStorageSource(record.storageSource);
        setBags(record.bags);
        setWeight(record.weight);
        setNewBagsUsed(record.newBagsUsed);
        setOldBagsUsed(record.oldBagsUsed);
        setUsedOnceBagsUsed(record.usedOnceBagsUsed);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDoEdit = (record: PaddyDO) => {
        setEditingDoId(record.id);
        setDoDate(record.date);
        setDoNumInput(record.doNumber);
        setDoMillName(record.millName);
        setDoApprovedBags(record.approvedBags);
        setDoApprovedWeight(record.approvedWeight);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const initiateDelete = (id: string) => {
        setRecordToDelete(id);
        setDeletePin('');
        setDeleteError('');
        setShowDeleteModal(true);
    };

    const confirmDelete = () => {
        if (deletePin === settings.securityPin && recordToDelete) {
            deleteDispatch(recordToDelete);
            setShowDeleteModal(false);
            setRecordToDelete(null);
        } else {
            setDeleteError("चुकीचा पिन! (Incorrect PIN)");
        }
    };

    const initiateDoDelete = (id: string) => {
        setDoToDelete(id);
        setDoDeletePin('');
        setDoDeleteError('');
        setShowDoDeleteModal(true);
    };

    const confirmDoDelete = () => {
        if (doDeletePin === settings.securityPin && doToDelete) {
            deletePaddyDO(doToDelete);
            setShowDoDeleteModal(false);
            setDoToDelete(null);
        } else {
            setDoDeleteError("चुकीचा पिन! (Incorrect PIN)");
        }
    };

    const handleShare = (record: DispatchRecord) => {
        const text = `🚛 *Society Dispatch Summary*
---------------------------
📅 Date: ${format(new Date(record.date), 'dd/MM/yyyy')}
🏢 Mill: ${record.millName}
🆔 D.O. No: ${record.doNumber || 'N/A'}
🆔 T.P. No: ${record.tpNumber || 'N/A'}
🚚 Truck: ${record.truckNumber}
📦 Storage: ${record.storageSource}
---------------------------
📊 *Quantity:*
👜 Total Bags: ${record.bags}
⚖️ Total Weight: ${record.weight} Qtl
---------------------------
🔹 New Bags: ${record.newBagsUsed}
🔹 Old Bags: ${record.oldBagsUsed}
🔹 Used Once: ${record.usedOnceBagsUsed}
---------------------------`;

        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    const handleExportExcel = async () => {
        exportDispatchesToExcel(filteredDispatches);
        await showConfirm({
            title: 'Export Successful!',
            titleMr: 'एक्सपोर्ट यशस्वी झाले!',
            message: `Successfully exported ${filteredDispatches.length} dispatch records to Excel file.`,
            messageMr: `${filteredDispatches.length} डिस्पॅच रेकॉर्ड एक्सेल फाईलमध्ये यशस्वीपणे एक्सपोर्ट झाले.`,
            icon: '✅',
            confirmText: 'OK',
            confirmTextMr: 'ठीक आहे',
            confirmColor: 'green'
        });
    };

    const handleExportDOs = async () => {
        exportPaddyDOsToExcel(filteredDOs, dispatches);
        await showConfirm({
            title: 'Export Successful!',
            titleMr: 'एक्सपोर्ट यशस्वी झाले!',
            message: `Successfully exported ${filteredDOs.length} D.O. summary records to Excel file.`,
            messageMr: `${filteredDOs.length} डी.ओ. पत्रक गोषवारा एक्सेल फाईलमध्ये यशस्वीपणे एक्सपोर्ट झाले.`,
            icon: '✅',
            confirmText: 'OK',
            confirmTextMr: 'ठीक आहे',
            confirmColor: 'green'
        });
    };

    // Filter dispatches by season
    const filteredDispatches = useMemo(() => {
        if (seasonFilter === 'all') return dispatches;
        return dispatches.filter(d => d.season === seasonFilter);
    }, [seasonFilter, dispatches]);

    return (
        <div className="p-4 md:p-6 pb-24">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <Truck className="text-blue-600" /> Dispatch (मिलला माल पाठवणे)
            </h2>

            {/* SEASON INDICATOR */}
            {activeSeason && (
                <div className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2">
                        <Calendar className="text-emerald-600 dark:text-emerald-400" size={18} />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">सध्याचा हंगाम:</span>
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-sm font-bold">
                            {activeSeason.code}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                            {activeSeason.name}
                        </span>
                    </div>
                </div>
            )}

            {/* TABS SELECTOR CONTAINER */}
            <div className="flex border-b dark:border-slate-700 mb-6 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('dispatches')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'dispatches' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                    <Truck size={18} />
                    ट्रक निहाय जावक (Truck Dispatches)
                </button>
                <button
                    onClick={() => setActiveTab('deliveryOrders')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'deliveryOrders' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                    <ClipboardList size={18} />
                    डी.ओ. नोंदणी व गोषवारा (D.O. Register & Balance)
                </button>
            </div>

            {/* TAB 1: DISPATCHES (TRUCK ENTRYS & LIST) */}
            {activeTab === 'dispatches' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700 mb-2">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-slate-700">
                            <h3 className="font-bold text-lg text-slate-700 dark:text-white">
                                {editingId ? "Edit Dispatch (नोंद बदला)" : "New Dispatch (नवीन नोंद)"}
                            </h3>
                            {editingId && (
                                <button onClick={resetForm} className="text-sm text-red-500 hover:underline flex items-center gap-1 font-bold">
                                    <X size={14} /> Cancel Edit
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">दिनांक (Date)</label>
                                    <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
                                </div>
                                
                                {/* D.O. Number Dropdown / Manual */}
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">D.O. नंबर (D.O. Dropdown)</label>
                                    {currentSeasonDOs.length > 0 ? (
                                        <select
                                            value={doNumber}
                                            onChange={e => handleDOChange(e.target.value)}
                                            className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm"
                                        >
                                            <option value="">-- D.O. निवडा --</option>
                                            {currentSeasonDOs.map(d => (
                                                <option key={d.id} value={d.doNumber}>
                                                    {d.doNumber} ({d.millName})
                                                </option>
                                            ))}
                                            <option value="MANUAL">मॅन्युअली नोंदवा (Manual Entry)</option>
                                        </select>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                placeholder="D.O. No"
                                                value={doNumber === 'MANUAL' ? '' : doNumber}
                                                onChange={e => setDoNumber(e.target.value.toUpperCase())}
                                                className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('deliveryOrders')}
                                                className="px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition whitespace-nowrap"
                                            >
                                                + D.O.
                                            </button>
                                        </div>
                                    )}
                                    {doNumber === 'MANUAL' && (
                                        <div className="mt-2">
                                            <input
                                                type="text"
                                                required
                                                placeholder="D.O. नंबर लिहा"
                                                onChange={e => setDoNumber(e.target.value.toUpperCase())}
                                                className="w-full p-2 border border-blue-500 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase font-bold text-xs"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">मिलचे नाव (Mill Name)</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Mill Name"
                                        value={millName}
                                        onChange={e => setMillName(e.target.value)}
                                        readOnly={!!selectedDO}
                                        className={`w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm ${selectedDO ? 'bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-400' : ''}`}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">T.P. नंबर</label>
                                    <input type="text" placeholder="T.P. No" value={tpNumber} onChange={e => setTpNumber(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">ट्रक नंबर (Truck No.)</label>
                                    <input type="text" required placeholder="MH-35-..." value={truckNumber} onChange={e => setTruckNumber(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase text-sm" />
                                </div>
                            </div>

                            {/* Live DO Balance Info Badge */}
                            {selectedDO && selectedDOStats && (
                                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-blue-950 rounded-xl border border-blue-200 dark:border-blue-800/80 flex items-center justify-between text-xs animate-fade-in shadow-inner">
                                    <div>
                                        <p className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1">
                                            <ShieldCheck size={14} /> D.O. {selectedDO.doNumber} मंजूर पत्र साठा माहिती:
                                        </p>
                                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                                            एकूण मंजूर: <span className="font-bold text-slate-950 dark:text-white">{selectedDO.approvedBags} पोते</span> ({selectedDO.approvedWeight} Qtl)
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold text-slate-500 dark:text-slate-400 block text-[10px]">शिल्लक बॅलन्स (DO Balance):</span>
                                        <span className={`text-base font-black ${(selectedDO.approvedBags - selectedDOStats.bags) > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                                            {Math.max(0, selectedDO.approvedBags - selectedDOStats.bags)} Bags
                                        </span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                            ({Math.max(0, selectedDO.approvedWeight - selectedDOStats.weight).toFixed(2)} Qtl शिल्लक)
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700">
                                    <h4 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
                                        <MapPin size={16} /> STORAGE SOURCE
                                    </h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Godown', 'Shed', 'Open'].map(src => (
                                            <button
                                                key={src}
                                                type="button"
                                                onClick={() => setStorageSource(src as any)}
                                                className={`p-3 rounded-lg border-2 transition-all font-bold text-sm ${storageSource === src ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                            >
                                                {src === 'Open' ? 'उघडयावर' : src === 'Shed' ? 'शेड' : 'गोडाऊन'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-400 mb-3 flex items-center gap-2">
                                        <Package size={16} /> TOTAL QUANTITY
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">एकूण पोते (Total Bags)</label>
                                            <input type="number" required value={bags || ''} onChange={e => setBags(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">एकूण वजन (Weight Qtl)</label>
                                            <input type="number" step="0.01" required value={weight || ''} onChange={e => setWeight(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900">
                                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                                    <ClipboardList size={16} /> BAG TYPE BREAKDOWN
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">नवीन (New)</label>
                                        <input type="number" value={newBagsUsed || ''} onChange={e => setNewBagsUsed(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-800" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">जुने (Old)</label>
                                        <input type="number" value={oldBagsUsed || ''} onChange={e => setOldBagsUsed(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-800" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">एकदा वापरलेले</label>
                                        <input type="number" value={usedOnceBagsUsed || ''} onChange={e => setUsedOnceBagsUsed(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-800" />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg">
                                <Save size={20} /> {editingId ? "Update Dispatch" : "Save Dispatch Record"}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b dark:border-slate-700 pb-2">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Recent Dispatches</h3>
                            <div className="flex items-center gap-3">
                                {paddySeasons.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Filter size={16} className="text-slate-500" />
                                        <select
                                            value={seasonFilter}
                                            onChange={(e) => setSeasonFilter(e.target.value)}
                                            className="px-3 py-1 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="all">सर्व हंगाम (All Seasons)</option>
                                            {paddySeasons.map(s => (
                                                <option key={s.id} value={s.code}>
                                                    {s.code} - {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {filteredDispatches.length > 0 && (
                                    <button onClick={handleExportExcel} className="flex items-center gap-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-emerald-600 hover:text-white transition font-bold shadow-sm">
                                        <Download size={16} /> Export Excel
                                    </button>
                                )}
                            </div>
                        </div>
                        {filteredDispatches.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl text-center text-slate-500 border border-dashed dark:border-slate-700">
                                No dispatch records found.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {[...filteredDispatches].sort((a, b) => b.timestamp - a.timestamp).map(d => (
                                    <div key={d.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 flex justify-between items-center group">
                                        <div className="flex gap-4 items-center">
                                            <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-full text-blue-600 dark:text-blue-400">
                                                <Truck size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-slate-800 dark:text-white">{d.millName} <span className="text-sm font-normal text-slate-400">({d.truckNumber})</span></h4>
                                                    {d.season && (
                                                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold">
                                                            {d.season}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 mt-1 uppercase font-medium">
                                                    <span className="text-blue-500 font-bold">{format(new Date(d.date), 'dd/MM/yyyy')}</span>
                                                    {d.doNumber && <span className="bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-bold px-1 rounded">DO: {d.doNumber}</span>}
                                                    {d.tpNumber && <span>TP: {d.tpNumber}</span>}
                                                    <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600 dark:text-slate-300">{d.storageSource}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="font-bold text-slate-800 dark:text-white">{d.bags} Bags</div>
                                                <div className="text-xs text-slate-500">{d.weight} Qtl</div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleShare(d)} className="p-2 text-slate-400 hover:text-green-500 transition" title="Share via WhatsApp"><Send size={18} /></button>
                                                <button onClick={() => handleEdit(d)} className="p-2 text-slate-400 hover:text-amber-500 transition"><Edit size={18} /></button>
                                                <button onClick={() => initiateDelete(d.id)} className="p-2 text-slate-400 hover:text-red-500 transition"><Trash2 size={18} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: DELIVERY ORDERS (D.O. CREATE & BALANCE SUMMARY) */}
            {activeTab === 'deliveryOrders' && (
                <div className="space-y-6">
                    {/* D.O. Creation Form */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
                        <h3 className="font-bold text-lg text-slate-700 dark:text-white mb-4 pb-2 border-b dark:border-slate-700">
                            {editingDoId ? "डी.ओ. पत्र दुरुस्ती (Edit Delivery Order)" : "नवीन डी.ओ. पत्र नोंदणी (Register New D.O.)"}
                        </h3>
                        <form onSubmit={handleDOSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">मंजूर दिनांक (DO Date)</label>
                                    <input type="date" required value={doDate} onChange={e => setDoDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">D.O. नंबर</label>
                                    <input type="text" required placeholder="D.O. Number" value={doNumInput} onChange={e => setDoNumInput(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase font-bold text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">मिलचे नाव (Mill Name)</label>
                                    <input type="text" required placeholder="Mill Name" value={doMillName} onChange={e => setDoMillName(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">मंजूर एकूण पोते (Approved Bags)</label>
                                    <input type="number" required value={doApprovedBags || ''} onChange={e => setDoApprovedBags(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">मंजूर एकूण वजन (Weight Qtl)</label>
                                    <input type="number" step="0.01" required value={doApprovedWeight || ''} onChange={e => setDoApprovedWeight(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                {editingDoId && (
                                    <button type="button" onClick={() => { setEditingDoId(null); setDoNumInput(''); setDoMillName(''); setDoApprovedBags(0); setDoApprovedWeight(0); }} className="px-4 py-2 border dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm">रद्द करा</button>
                                )}
                                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 transition flex items-center gap-2 shadow-md text-sm">
                                    <Save size={16} /> D.O. जतन करा (Save D.O. Record)
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* D.O. Summary / Balance Sheet Report */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b dark:border-slate-700 pb-2">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <ClipboardList className="text-blue-600" /> डी.ओ. गोषवारा व शिल्लक साठा पत्रक (D.O. Summary & Balance Report)
                            </h3>
                            <div className="flex items-center gap-3">
                                {filteredDOs.length > 0 && (
                                    <button onClick={handleExportDOs} className="flex items-center gap-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-emerald-600 hover:text-white transition font-bold shadow-sm">
                                        <Download size={16} /> Export Excel
                                    </button>
                                )}
                                {paddySeasons.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Filter size={16} className="text-slate-500" />
                                        <select
                                            value={seasonFilter}
                                            onChange={(e) => setSeasonFilter(e.target.value)}
                                            className="px-3 py-1 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="all">सर्व हंगाम (All Seasons)</option>
                                            {paddySeasons.map(s => (
                                                <option key={s.id} value={s.code}>
                                                    {s.code} - {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {filteredDOs.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl text-center text-slate-500 border border-dashed dark:border-slate-700">
                                कोणतीही डी.ओ. नोंदणी आढळली नाही (No D.O. records found).
                            </div>
                        ) : (
                            <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-md">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase border-b dark:border-slate-600">
                                            <th className="p-4">डी.ओ. नंबर / मिलचे नाव</th>
                                            <th className="p-4 text-center">दिनांक</th>
                                            <th className="p-4 text-center">मंजूर साठा (Approved)</th>
                                            <th className="p-4 text-center">जावक साठा (Sent by Trucks)</th>
                                            <th className="p-4 text-center">शिल्लक साठा (Balance Remaining)</th>
                                            <th className="p-4">पूर्णता प्रगती (Progress)</th>
                                            <th className="p-4 text-right">कृती</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-slate-700">
                                        {[...filteredDOs].sort((a, b) => b.timestamp - a.timestamp).map(d => {
                                            const stats = doStatsMap[d.doNumber.toUpperCase().trim()] || { bags: 0, weight: 0 };
                                            const balanceBags = Math.max(0, d.approvedBags - stats.bags);
                                            const balanceWeight = Math.max(0, d.approvedWeight - stats.weight);
                                            const pct = d.approvedBags > 0 ? Math.min(100, Math.round((stats.bags / d.approvedBags) * 100)) : 0;

                                            return (
                                                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                                    <td className="p-4">
                                                        <p className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">{d.doNumber}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">{d.millName}</p>
                                                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-[9px] text-slate-600 dark:text-slate-300 font-bold rounded mt-1 inline-block">{d.season}</span>
                                                    </td>
                                                    <td className="p-4 text-center text-slate-500 dark:text-slate-400 font-medium">
                                                        {format(new Date(d.date), 'dd/MM/yyyy')}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <p className="font-bold text-slate-800 dark:text-slate-200">{d.approvedBags} bags</p>
                                                        <p className="text-xs text-slate-500">{d.approvedWeight.toFixed(2)} Qtl</p>
                                                    </td>
                                                    <td className="p-4 text-center text-blue-600 dark:text-blue-400">
                                                        <p className="font-bold">{stats.bags} bags</p>
                                                        <p className="text-xs">{stats.weight.toFixed(2)} Qtl</p>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <p className={`font-black ${balanceBags > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                                                            {balanceBags} bags
                                                        </p>
                                                        <p className="text-xs text-slate-500">{balanceWeight.toFixed(2)} Qtl</p>
                                                    </td>
                                                    <td className="p-4 min-w-[120px]">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden shadow-inner">
                                                                <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }}></div>
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-400">{pct}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex gap-1 justify-end opacity-80 hover:opacity-100">
                                                            <button onClick={() => handleDoEdit(d)} className="p-1.5 text-slate-400 hover:text-amber-500 transition"><Edit size={16} /></button>
                                                            <button onClick={() => initiateDoDelete(d.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Dispatch Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 w-full max-w-sm shadow-2xl border border-red-100 dark:border-red-900 animate-fade-in-up">
                        <div className="text-center mb-2">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Security Check</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter Security PIN to delete this dispatch record.</p>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="password"
                                autoFocus
                                className="w-full p-3 text-center text-2xl tracking-widest border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="PIN"
                                maxLength={4}
                                value={deletePin}
                                onChange={e => setDeletePin(e.target.value)}
                            />

                            {deleteError && <p className="text-red-500 text-center text-sm font-medium">{deleteError}</p>}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-2 border dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* D.O. Delete Confirmation Modal */}
            {showDoDeleteModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 w-full max-w-sm shadow-2xl border border-red-100 dark:border-red-900 animate-fade-in-up">
                        <div className="text-center mb-2">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">D.O. Security Check</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter Security PIN to delete this D.O. record.</p>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="password"
                                autoFocus
                                className="w-full p-3 text-center text-2xl tracking-widest border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="PIN"
                                maxLength={4}
                                value={doDeletePin}
                                onChange={e => setDoDeletePin(e.target.value)}
                            />

                            {doDeleteError && <p className="text-red-500 text-center text-sm font-medium">{doDeleteError}</p>}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDoDeleteModal(false)}
                                    className="flex-1 py-2 border dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDoDelete}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
                                >
                                    Delete D.O.
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dispatch;
