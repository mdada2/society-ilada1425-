
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { format } from 'date-fns';
import { Truck, Save, Trash2, Edit, X, Archive, AlertCircle, MapPin, ClipboardList, Package, Share2, Download, Send, ShieldCheck, Calendar, Filter } from 'lucide-react';
import { DispatchRecord } from '../types';
import { downloadBlob } from '../utils/downloadUtils';
import { exportDispatchesToExcel } from '../services/excelExport';

const Dispatch = () => {
    const { dispatches, addDispatch, updateDispatch, deleteDispatch, paddySeasons, getActiveSeason, settings } = useApp();
    const { showConfirm } = useDialog();

    // Season state
    const [seasonFilter, setSeasonFilter] = useState<string>('all');
    const activeSeason = getActiveSeason();
    const currentSeasonCode = activeSeason?.code || '';

    // Delete Security State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
    const [deletePin, setDeletePin] = useState('');
    const [deleteError, setDeleteError] = useState('');

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
            doNumber,
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

    const handleEdit = (record: DispatchRecord) => {
        setEditingId(record.id);
        setDate(record.date);
        setMillName(record.millName);
        setDoNumber(record.doNumber || '');
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
                            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">मिलचे नाव (Mill Name)</label>
                            <input type="text" required placeholder="Mill Name" value={millName} onChange={e => setMillName(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">D.O. नंबर</label>
                            <input type="text" placeholder="D.O. No" value={doNumber} onChange={e => setDoNumber(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">T.P. नंबर</label>
                            <input type="text" placeholder="T.P. No" value={tpNumber} onChange={e => setTpNumber(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">ट्रक नंबर (Truck No.)</label>
                            <input type="text" required placeholder="MH-35-..." value={truckNumber} onChange={e => setTruckNumber(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase" />
                        </div>
                    </div>

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
                                            {d.doNumber && <span>DO: {d.doNumber}</span>}
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

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 w-full max-w-sm shadow-2xl border border-red-100 dark:border-red-900 animate-fade-in-up">
                        <div className="text-center mb-2">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Security Check</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter Security PIN to delete this record.</p>
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
        </div>
    );
};

export default Dispatch;

