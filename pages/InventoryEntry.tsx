
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { PackagePlus, Save, Trash2, Edit, X, Archive, History, AlertCircle, ShieldCheck } from 'lucide-react';
import { InventoryAdjustment } from '../types';

const InventoryEntry = () => {
    const { inventoryAdjustments, addInventoryAdjustment, updateInventoryAdjustment, deleteInventoryAdjustment, settings } = useApp();

    // Delete Security State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
    const [deletePin, setDeletePin] = useState('');
    const [deleteError, setDeleteError] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [type, setType] = useState<InventoryAdjustment['type']>('NewStock');
    const [item, setItem] = useState<InventoryAdjustment['item']>('NewBags');
    const [quantity, setQuantity] = useState<number | ''>(0);
    const [weight, setWeight] = useState<number | ''>(0);
    const [reason, setReason] = useState('');

    const resetForm = () => {
        setEditingId(null);
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setType('NewStock');
        setItem('NewBags');
        setQuantity(0);
        setWeight(0);
        setReason('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const record: InventoryAdjustment = {
            id: editingId || Date.now().toString(),
            date,
            type,
            item,
            quantity: Number(quantity) || 0,
            weight: weight ? Number(weight) : undefined,
            reason,
            timestamp: editingId ? (inventoryAdjustments.find(a => a.id === editingId)?.timestamp || Date.now()) : Date.now()
        };

        if (editingId) updateInventoryAdjustment(record);
        else addInventoryAdjustment(record);
        resetForm();
        alert("Inventory Adjustment Saved!");
    };

    const handleEdit = (record: InventoryAdjustment) => {
        setEditingId(record.id);
        setDate(record.date);
        setType(record.type);
        setItem(record.item);
        setQuantity(record.quantity);
        setWeight(record.weight || 0);
        setReason(record.reason);
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
            deleteInventoryAdjustment(recordToDelete);
            setShowDeleteModal(false);
            setRecordToDelete(null);
        } else {
            setDeleteError("चुकीचा पिन! (Incorrect PIN)");
        }
    };

    return (
        <div className="pt-0 md:pt-1 px-1 pb-24">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <PackagePlus className="text-emerald-600" /> Inventory Entry (स्टॉक नोंदणी)
            </h2>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700 mb-2">
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-700 dark:text-white">
                        {editingId ? "Edit Entry (नोंद बदला)" : "New Stock Entry (नवीन स्टॉक/ॲडजस्टमेंट)"}
                    </h3>
                    {editingId && (
                        <button onClick={resetForm} className="text-sm text-red-500 hover:underline flex items-center gap-1 font-bold">
                            <X size={14} /> Cancel Edit
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">दिनांक (Date)</label>
                            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">प्रकार (Adjustment Type)</label>
                            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                                <option value="NewStock">New Stock Received (नवीन माल आला)</option>
                                <option value="OpeningStock">Opening Stock (सुरुवातीचा साठा)</option>
                                <option value="Damage">Damage / Loss (नुकसान/कमी झाला)</option>
                                <option value="Correction">Correction (दुरुस्ती)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">वस्तू (Item)</label>
                            <select value={item} onChange={e => setItem(e.target.value as any)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                                <optgroup label="Bags (पोते)">
                                    <option value="NewBags">New Bags (नवीन पोते)</option>
                                    <option value="OldBags">Old Bags (जुने पोते)</option>
                                    <option value="UsedOnceBags">Used Once (एकदा वापरलेले)</option>
                                </optgroup>
                                <optgroup label="Paddy (धान साठा)">
                                    <option value="PaddyGodown">Paddy in Godown</option>
                                    <option value="PaddyShed">Paddy in Shed</option>
                                    <option value="PaddyOpen">Paddy in Open</option>
                                </optgroup>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">संख्या (Qty/Bags)</label>
                                <input type="number" required value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 font-bold" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">वजन (Weight Qtl - Optional)</label>
                                <input type="number" step="0.01" value={weight || ''} onChange={e => setWeight(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">कारण / टिप्पणी (Reason / Note)</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter details..." className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white h-20" />
                    </div>

                    <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-lg">
                        <Save size={20} /> {editingId ? "Update Entry" : "Save Stock Entry"}
                    </button>
                </form>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white border-b dark:border-slate-700 pb-2 flex items-center gap-2">
                    <History size={20} /> History
                </h3>
                {inventoryAdjustments.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-xl text-center text-slate-500 border border-dashed dark:border-slate-700">
                        No adjustment records found.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {[...inventoryAdjustments].sort((a, b) => b.timestamp - a.timestamp).map(a => (
                            <div key={a.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700 flex justify-between items-center group text-sm">
                                <div className="flex gap-3 items-center">
                                    <div className={`p-2 rounded-full ${a.type === 'Damage' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        <Archive size={18} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white">
                                            {a.item.replace('Paddy', 'Paddy in ')}: {a.type === 'Damage' ? '-' : '+'}{a.quantity}
                                            <span className="text-xs font-normal text-slate-400 ml-2">({a.type})</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {format(new Date(a.date), 'dd/MM/yyyy')} — {a.reason || 'No reason'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(a)} className="p-1.5 text-slate-400 hover:text-amber-500 transition"><Edit size={16} /></button>
                                    <button onClick={() => initiateDelete(a.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition"><Trash2 size={16} /></button>
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

export default InventoryEntry;

