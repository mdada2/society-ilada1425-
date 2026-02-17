
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { ShoppingBag, Save, Copy, Share2, Trash2, Edit, Plus, Settings, X, Archive, AlertCircle, Check, Calculator, IndianRupee, ArrowRight, ShieldCheck, Warehouse, Lock, Unlock, ChevronUp, ChevronDown, Calendar, Filter, Download } from 'lucide-react';
import { PaddyPurchaseRecord, PaddySeason } from '../types';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';

const PaddyPurchase = () => {
    const { paddyPurchases, addPaddyPurchase, updatePaddyPurchase, deletePaddyPurchase, paddySeasons, addPaddySeason, updatePaddySeason, setActiveSeason, getActiveSeason, getPurchasesBySeason, getSuggestedSeason, settings, updateSettings } = useApp();

    // Settings & Calculator UI State
    const [showSettings, setShowSettings] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [showSeasonModal, setShowSeasonModal] = useState(false);
    const [seasonFilter, setSeasonFilter] = useState<string>('all'); // 'all' or season code

    // Ref for Recent Records Image Download
    const recentRecordsRef = useRef<HTMLDivElement>(null);

    // Storage Capacities (Synced from Global Settings)
    const godownCapacity = settings.paddySettings?.godownCapacity || 10000;
    const shedCapacity = settings.paddySettings?.shedCapacity || 5000;

    // Smart Calculator States
    const [calcArea, setCalcArea] = useState<string>('1.00');
    const [calcRate, setCalcRate] = useState<string>('40');
    const [calcPrice, setCalcPrice] = useState<string>('2300');

    // Delete Security State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
    const [deletePin, setDeletePin] = useState('');
    const [deleteError, setDeleteError] = useState('');

    // Edit Settings State
    const [isEditingCapacities, setIsEditingCapacities] = useState(false);
    const [tempGodownCap, setTempGodownCap] = useState<number | ''>(0);
    const [tempShedCap, setTempShedCap] = useState<number | ''>(0);

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedTextId, setExpandedTextId] = useState<string | null>(null);

    // Season Creation State
    const [newSeasonType, setNewSeasonType] = useState<'kharif' | 'rabi'>('kharif');
    const [newSeasonYear, setNewSeasonYear] = useState(new Date().getFullYear().toString());
    const [newSeasonStartDate, setNewSeasonStartDate] = useState('');
    const [newSeasonEndDate, setNewSeasonEndDate] = useState('');

    // Auto-fill season dates when type or year changes
    useEffect(() => {
        const year = parseInt(newSeasonYear);
        if (isNaN(year)) return;

        if (newSeasonType === 'kharif') {
            setNewSeasonStartDate(`${year}-11-01`);
            setNewSeasonEndDate(`${year + 1}-03-31`);
        } else {
            setNewSeasonStartDate(`${year}-05-01`);
            setNewSeasonEndDate(`${year}-07-31`);
        }
    }, [newSeasonType, newSeasonYear]);

    // Get current active season
    const activeSeason = getActiveSeason();
    const currentSeasonCode = activeSeason?.code || '';

    // Get suggested season if no active season
    const suggestedSeason = !activeSeason ? getSuggestedSeason() : null;

    const toggleTextFormat = (id: string) => {
        setExpandedTextId(prev => prev === id ? null : id);
    };

    // Form State
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [centerName, setCenterName] = useState('ईळदा');

    const [tribalMembers, setTribalMembers] = useState(0);
    const [nonTribalMembers, setNonTribalMembers] = useState(0);

    const [newBags, setNewBags] = useState<number | ''>(0);
    const [newWeight, setNewWeight] = useState<number | ''>(0);
    const [oldBags, setOldBags] = useState<number | ''>(0);
    const [oldWeight, setOldWeight] = useState<number | ''>(0);
    const [usedOnceBags, setUsedOnceBags] = useState<number | ''>(0);
    const [usedOnceWeight, setUsedOnceWeight] = useState<number | ''>(0);

    // Lock States
    const [isNewLocked, setIsNewLocked] = useState(false);
    const [isOldLocked, setIsOldLocked] = useState(false);
    const [isUsedOnceLocked, setIsUsedOnceLocked] = useState(true);

    const [godownBags, setGodownBags] = useState(0);
    const [godownWeight, setGodownWeight] = useState(0);
    const [shedBags, setShedBags] = useState(0);
    const [shedWeight, setShedWeight] = useState(0);
    const [openBags, setOpenBags] = useState(0);
    const [openWeight, setOpenWeight] = useState(0);

    const formTotalMembers = tribalMembers + nonTribalMembers;
    const formTotalBags = (Number(newBags) || 0) + (Number(oldBags) || 0) + (Number(usedOnceBags) || 0);
    const formTotalWeight = (Number(newWeight) || 0) + (Number(oldWeight) || 0) + (Number(usedOnceWeight) || 0);

    const formatDateDisplay = (dateStr: string) => {
        try { return format(new Date(dateStr), 'dd-MM-yyyy'); } catch (e) { return dateStr; }
    };

    const handleCopy = (r: PaddyPurchaseRecord) => {
        const text = generateShareText(r);
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard! (माहिती कॉपी झाली)");
    };

    const handleShare = async (r: PaddyPurchaseRecord) => {
        const shareText = generateShareText(r, paddyPurchases);
        try {
            await Share.share({
                title: `Paddy Purchase - ${r.centerName}`,
                text: shareText,
                dialogTitle: 'Share Paddy Purchase Record'
            });
        } catch (error) {
            console.error('Error sharing:', error);
            // Fallback to clipboard
            navigator.clipboard.writeText(shareText);
            alert('📋 Copied to clipboard!');
        }
    };

    // Image Download Handler (JPG/PNG)
    const handleDownloadRecordsImage = async (imageFormat: 'jpeg' | 'png' = 'jpeg') => {
        if (recentRecordsRef.current) {
            try {
                const canvas = await html2canvas(recentRecordsRef.current, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });

                const mimeType = imageFormat === 'png' ? 'image/png' : 'image/jpeg';
                const imgData = canvas.toDataURL(mimeType, 0.9);

                // Create download link
                const link = document.createElement('a');
                link.href = imgData;
                link.download = `Paddy_Purchase_Records_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.${imageFormat}`;
                link.click();

                setTimeout(() => alert(`✅ ${imageFormat.toUpperCase()} Image downloaded!`), 500);
            } catch (error) {
                console.error('Image Download Error:', error);
                alert('Failed to download image. Please try again.');
            }
        }
    };

    // --- CALCULATOR LOGIC ---
    const calculatedStats = useMemo(() => {
        const area = parseFloat(calcArea) || 0;
        const rate = parseFloat(calcRate) || 0;
        const price = parseFloat(calcPrice) || 0;

        const weight = area * rate;
        const bags = weight > 0 ? Math.ceil(weight / 0.40) : 0;
        const amount = weight * price;

        return {
            weight,
            bags,
            amount,
            hasInput: calcArea !== '' && calcRate !== '' && calcPrice !== ''
        };
    }, [calcArea, calcRate, calcPrice]);



    const handleSaveCapacities = () => {
        updateSettings({
            paddySettings: {
                godownCapacity: Number(tempGodownCap) || 0,
                shedCapacity: Number(tempShedCap) || 0
            }
        });
        setIsEditingCapacities(false);
    };

    // Logic to calculate stocks excluding current editing record
    const currentStocks = useMemo(() => {
        return paddyPurchases
            .filter(p => p.id !== editingId)
            .reduce((acc, p) => ({
                godown: acc.godown + (p.godownBags || 0),
                godownWeight: acc.godownWeight + (p.godownWeight || 0),
                shed: acc.shed + (p.shedBags || 0),
                shedWeight: acc.shedWeight + (p.shedWeight || 0),
                // Accumulate Bag Types
                newBags: acc.newBags + (p.newBags || 0),
                newWeight: acc.newWeight + (p.newWeight || 0),
                oldBags: acc.oldBags + (p.oldBags || 0),
                oldWeight: acc.oldWeight + (p.oldWeight || 0),
                usedOnceBags: acc.usedOnceBags + (p.usedOnceBags || 0),
                usedOnceWeight: acc.usedOnceWeight + (p.usedOnceWeight || 0),
                // Accumulate Open Storage
                open: acc.open + (p.openBags || 0),
                openWeight: acc.openWeight + (p.openWeight || 0),
            }), {
                godown: 0, godownWeight: 0, shed: 0, shedWeight: 0,
                newBags: 0, newWeight: 0, oldBags: 0, oldWeight: 0, usedOnceBags: 0, usedOnceWeight: 0,
                open: 0, openWeight: 0
            });
    }, [paddyPurchases, editingId]);

    const remainingGodown = Math.max(0, godownCapacity - currentStocks.godown);
    const remainingShed = Math.max(0, shedCapacity - currentStocks.shed);

    // Auto-allocate storage logic: Godown -> Shed -> Open
    useEffect(() => {
        const totalInputBags = formTotalBags;

        // 1. Fill Godown
        let toGodown = Math.min(totalInputBags, remainingGodown);
        let leftAfterGodown = totalInputBags - toGodown;

        // 2. Fill Shed
        let toShed = Math.min(leftAfterGodown, remainingShed);
        let leftAfterShed = leftAfterGodown - toShed;

        // 3. Fill Open
        let toOpen = leftAfterShed;

        setGodownBags(toGodown);
        setGodownWeight(toGodown * 0.40);
        setShedBags(toShed);
        setShedWeight(toShed * 0.40);
        setOpenBags(toOpen);
        setOpenWeight(toOpen * 0.40);
    }, [newBags, oldBags, usedOnceBags, remainingGodown, remainingShed, formTotalBags]);

    const resetForm = () => {
        setEditingId(null);
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setCenterName('ईळदा');
        setTribalMembers(0);
        setNonTribalMembers(0);

        // Always reset bag inputs to prevent accidental double-counting in next entry
        setNewBags(0);
        setNewWeight(0);
        setOldBags(0);
        setOldWeight(0);
        setUsedOnceBags(0);
        setUsedOnceWeight(0);
    };

    const handleEdit = (record: PaddyPurchaseRecord) => {
        setEditingId(record.id);
        setDate(record.date);
        setCenterName(record.centerName);
        setTribalMembers(record.tribalMembers);
        setNonTribalMembers(record.nonTribalMembers);
        setNewBags(record.newBags);
        setNewWeight(record.newWeight);
        setOldBags(record.oldBags);
        setOldWeight(record.oldWeight);
        setUsedOnceBags(record.usedOnceBags);
        setUsedOnceWeight(record.usedOnceWeight);

        // Auto-unlock fields when editing so user can easily fix mistakes
        setIsNewLocked(false);
        setIsOldLocked(false);
        setIsUsedOnceLocked(false);

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
            deletePaddyPurchase(recordToDelete);
            setShowDeleteModal(false);
            setRecordToDelete(null);
        } else {
            setDeleteError("चुकीचा पिन! (Incorrect PIN)");
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Check if we have an active season
        if (!currentSeasonCode && !suggestedSeason) {
            alert("कृपया प्रथम हंगाम तयार करा! (Please create a season first!)");
            setShowSeasonModal(true);
            return;
        }

        const record: PaddyPurchaseRecord = {
            id: editingId || Date.now().toString(),
            date, centerName, tribalMembers, nonTribalMembers,
            season: currentSeasonCode || suggestedSeason?.code || '',
            newBags: Number(newBags) || 0,
            newWeight: Number(newWeight) || 0,
            oldBags: Number(oldBags) || 0,
            oldWeight: Number(oldWeight) || 0,
            usedOnceBags: Number(usedOnceBags) || 0,
            usedOnceWeight: Number(usedOnceWeight) || 0,
            godownBags, godownWeight, shedBags, shedWeight, openBags, openWeight,

            // Storage Cumulative
            cumulativeGodownBags: (currentStocks.godown || 0) + godownBags,
            cumulativeGodownWeight: (currentStocks.godownWeight || 0) + godownWeight,
            cumulativeShedBags: (currentStocks.shed || 0) + shedBags,
            cumulativeShedWeight: (currentStocks.shedWeight || 0) + shedWeight,
            cumulativeOpenBags: openBags, // Open is reset every time typically? Or does it accumulate? Assuming accumulates for "Total Stock" logic
            cumulativeOpenWeight: openWeight,

            // Bag Type Cumulative
            cumulativeNewBags: (currentStocks.newBags || 0) + (Number(newBags) || 0),
            cumulativeNewWeight: (currentStocks.newWeight || 0) + (Number(newWeight) || 0),
            cumulativeOldBags: (currentStocks.oldBags || 0) + (Number(oldBags) || 0),
            cumulativeOldWeight: (currentStocks.oldWeight || 0) + (Number(oldWeight) || 0),
            cumulativeUsedOnceBags: (currentStocks.usedOnceBags || 0) + (Number(usedOnceBags) || 0),
            cumulativeUsedOnceWeight: (currentStocks.usedOnceWeight || 0) + (Number(usedOnceWeight) || 0),

            timestamp: editingId ? (paddyPurchases.find(p => p.id === editingId)?.timestamp || Date.now()) : Date.now()
        };

        if (editingId) updatePaddyPurchase(record);
        else addPaddyPurchase(record);
        resetForm();
        alert("Record Saved Successfully");
    };

    const handleCreateSeason = () => {
        const year = parseInt(newSeasonYear);
        if (isNaN(year)) {
            alert("कृपया योग्य वर्ष टाका! (Please enter a valid year!)");
            return;
        }

        const code = newSeasonType === 'kharif' ? `${year.toString().slice(-2)}K` : `${year.toString().slice(-2)}R`;
        const name = newSeasonType === 'kharif'
            ? `खरीप ${year}-${(year + 1).toString().slice(-2)}`
            : `रब्बी ${year}`;

        // Check if season already exists
        if (paddySeasons.some(s => s.code === code)) {
            alert(`हंगाम "${code}" आधीच अस्तित्वात आहे! (Season "${code}" already exists!)`);
            return;
        }

        const newSeason: PaddySeason = {
            id: Date.now().toString(),
            code,
            name,
            type: newSeasonType,
            startDate: newSeasonStartDate,
            endDate: newSeasonEndDate,
            isActive: paddySeasons.length === 0, // First season is active by default
            createdAt: Date.now()
        };

        addPaddySeason(newSeason);
        setShowSeasonModal(false);
        alert(`हंगाम "${code}" यशस्वीरित्या तयार झाला! (Season "${code}" created successfully!)`);
    };

    const handleQuickCreateSeason = () => {
        if (!suggestedSeason) return;

        const newSeason: PaddySeason = {
            id: Date.now().toString(),
            code: suggestedSeason.code,
            name: suggestedSeason.name,
            type: suggestedSeason.type,
            startDate: suggestedSeason.startDate,
            endDate: suggestedSeason.endDate,
            isActive: true,
            createdAt: Date.now()
        };

        addPaddySeason(newSeason);
        alert(`हंगाम "${suggestedSeason.code}" यशस्वीरित्या तयार झाला! (Season "${suggestedSeason.code}" created successfully!)`);
    };

    // Filter purchases based on selected season
    const filteredPurchases = useMemo(() => {
        if (seasonFilter === 'all') return paddyPurchases;
        return getPurchasesBySeason(seasonFilter);
    }, [seasonFilter, paddyPurchases, getPurchasesBySeason]);

    const generateShareText = (r: PaddyPurchaseRecord, allRecords: PaddyPurchaseRecord[] = []) => {
        const totalMembers = r.tribalMembers + r.nonTribalMembers;
        const formattedDate = format(new Date(r.date), 'dd/MM/yyyy');
        const pad = (num: number) => num < 10 && num >= 0 ? `0${num}` : num;

        // Dynamic Calculation: Filter records up to this one (inclusive) based on timestamp
        // If allRecords is not provided, fall back to just this record (initial behavior)
        const relevantRecords = allRecords.length > 0
            ? allRecords.filter(rec => rec.timestamp <= r.timestamp)
            : [r];

        // Calculate Cumulative Allocations
        const totalGodown = relevantRecords.reduce((sum, rec) => sum + (rec.godownBags || 0), 0);
        const totalGodownWeight = relevantRecords.reduce((sum, rec) => sum + (rec.godownWeight || 0), 0);

        const totalShed = relevantRecords.reduce((sum, rec) => sum + (rec.shedBags || 0), 0);
        const totalShedWeight = relevantRecords.reduce((sum, rec) => sum + (rec.shedWeight || 0), 0);

        // Open storage might be treated differently depending on business logic, 
        // but for consistency with "Total Stock", we accumulate it unless user specifies otherwise.
        // Based on previous code, Open seemed to be per-transaction in some places, but Total = G+S+O.
        // Let's accumulate Open too for correct "Total Storage"
        const totalOpen = relevantRecords.reduce((sum, rec) => sum + (rec.openBags || 0), 0);
        const totalOpenWeight = relevantRecords.reduce((sum, rec) => sum + (rec.openWeight || 0), 0);

        const totalStorageBags = totalGodown + totalShed + totalOpen;
        const totalStorageWeight = (totalGodownWeight + totalShedWeight + totalOpenWeight).toFixed(2);

        // Calculate Cumulative Bag Types
        const totalNew = relevantRecords.reduce((sum, rec) => sum + (rec.newBags || 0), 0);
        const totalNewWeight = relevantRecords.reduce((sum, rec) => sum + (rec.newWeight || 0), 0);

        const totalUsed = relevantRecords.reduce((sum, rec) => sum + (rec.usedOnceBags || 0), 0);
        const totalUsedWeight = relevantRecords.reduce((sum, rec) => sum + (rec.usedOnceWeight || 0), 0);

        // Derive Old as Balancing Figure
        const derivedOldBags = totalStorageBags - totalNew - totalUsed;
        const derivedOldWeight = (parseFloat(totalStorageWeight) - totalNewWeight - totalUsedWeight).toFixed(2);

        return `_*Online खरेदी*_
\`खरेदी केंद्राचे नाव:-${r.centerName}\`
दिनांक:- ${formattedDate}
> *आदि सभासद*  :- *${pad(r.tribalMembers)}*
> *गैर आदि सभा*  :- *${pad(r.nonTribalMembers)}*
> *एकूण सभासद* :- *${pad(totalMembers)}*

* नविन पोते  :- ${pad(totalNew)}
* वजन        :- ${totalNewWeight.toFixed(2)}
* जुने पोते    :- ${pad(derivedOldBags)}
* वजन        :- ${derivedOldWeight}
* एकदा वापरलेला :- ${pad(totalUsed)}
* वजन               :- ${totalUsedWeight.toFixed(2)}

> *एकुण पोते:-*   *${pad(totalStorageBags)}*
> *एकुण वजन:-* *${totalStorageWeight}*

> *गोदामात खरेदी*
* पोते   :- ${pad(totalGodown)}
* वजन :- ${totalGodownWeight.toFixed(2)}
> *शेडमध्ये खरेदी*
* पोते   :- ${pad(totalShed)}
* वजन :- ${totalShedWeight.toFixed(2)}
> *उघडयावर खरेदी*
* पोते    :- ${pad(totalOpen)}
* वजन  :- ${totalOpenWeight.toFixed(2)}`;
    };

    return (
        <div className="p-4 md:p-6 pb-24 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <ShoppingBag className="text-amber-600" /> Paddy Purchase (धान खरेदी)
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setShowCalculator(!showCalculator); setShowSettings(false); }}
                        className={`p-2 rounded-full transition-all ${showCalculator ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                        title="खरेदी गणकयंत्र"
                    >
                        <Calculator size={20} />
                    </button>
                    <button
                        onClick={() => { setShowSettings(!showSettings); setShowCalculator(false); }}
                        className={`p-2 rounded-full transition-all ${showSettings ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                        title="Storage Settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* SEASON SELECTOR & MANAGEMENT */}
            <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="text-emerald-600 dark:text-emerald-400" size={20} />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">हंगाम (Season):</span>

                        {activeSeason ? (
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-sm font-bold shadow-md">
                                    {activeSeason.code}
                                </span>
                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                    {activeSeason.name}
                                </span>
                            </div>
                        ) : suggestedSeason ? (
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-sm font-bold shadow-md animate-pulse">
                                    {suggestedSeason.code}
                                </span>
                                <button
                                    onClick={handleQuickCreateSeason}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                    <Plus size={14} className="inline mr-1" />
                                    हंगाम सुरू करा
                                </button>
                            </div>
                        ) : (
                            <span className="text-xs text-red-600 dark:text-red-400 font-bold">
                                कोणताही हंगाम नाही!
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {paddySeasons.length > 0 && (
                            <select
                                value={currentSeasonCode}
                                onChange={(e) => setActiveSeason(e.target.value)}
                                className="px-3 py-1 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {paddySeasons.map(s => (
                                    <option key={s.id} value={s.code}>
                                        {s.code} - {s.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <button
                            onClick={() => setShowSeasonModal(true)}
                            className="px-3 py-1 bg-slate-800 dark:bg-emerald-600 hover:bg-slate-700 dark:hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition shadow-sm flex items-center gap-1"
                        >
                            <Plus size={16} />
                            नवीन हंगाम
                        </button>
                    </div>
                </div>
            </div>

            {/* SEASON CREATION MODAL */}
            {showSeasonModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Calendar className="text-emerald-600" />
                                नवीन हंगाम तयार करा
                            </h3>
                            <button onClick={() => setShowSeasonModal(false)} className="text-slate-400 hover:text-red-500 transition">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">हंगाम प्रकार (Season Type)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setNewSeasonType('kharif')}
                                        className={`p-3 rounded-lg border-2 font-bold transition ${newSeasonType === 'kharif' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'}`}
                                    >
                                        खरीप (Kharif)
                                    </button>
                                    <button
                                        onClick={() => setNewSeasonType('rabi')}
                                        className={`p-3 rounded-lg border-2 font-bold transition ${newSeasonType === 'rabi' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'}`}
                                    >
                                        रब्बी (Rabi)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">वर्ष (Year)</label>
                                <input
                                    type="number"
                                    value={newSeasonYear}
                                    onChange={(e) => setNewSeasonYear(e.target.value)}
                                    className="w-full p-3 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="2025"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">सुरुवात (Start)</label>
                                    <input
                                        type="date"
                                        value={newSeasonStartDate}
                                        onChange={(e) => setNewSeasonStartDate(e.target.value)}
                                        className="w-full p-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">समाप्ती (End)</label>
                                    <input
                                        type="date"
                                        value={newSeasonEndDate}
                                        onChange={(e) => setNewSeasonEndDate(e.target.value)}
                                        className="w-full p-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <p className="text-sm text-emerald-800 dark:text-emerald-300 font-bold">
                                    हंगाम कोड: <span className="text-lg">{newSeasonType === 'kharif' ? `${newSeasonYear.slice(-2)}K` : `${newSeasonYear.slice(-2)}R`}</span>
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowSeasonModal(false)}
                                    className="flex-1 px-4 py-3 border dark:border-slate-600 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                >
                                    रद्द करा
                                </button>
                                <button
                                    onClick={handleCreateSeason}
                                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-md"
                                >
                                    हंगाम तयार करा
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK CALCULATOR PANEL */}
            {showCalculator && (
                <div className="mb-6 p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-blue-200 dark:border-blue-900 animate-fade-in ring-4 ring-blue-500/5">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <Calculator size={20} /> खरेदी गणकयंत्र (Smart Calculator)
                        </h3>
                        <button onClick={() => setShowCalculator(false)} className="text-slate-400 hover:text-red-500 transition">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Inputs Section */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">आराजी (Area in Hectare)</label>
                                <input
                                    type="number" step="0.01" placeholder="आराजी टाका"
                                    value={calcArea} onChange={(e) => setCalcArea(e.target.value)}
                                    className="w-full p-3 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">वजन दर (Weight Rate)</label>
                                <input
                                    type="number" placeholder="दर टाका"
                                    value={calcRate} onChange={(e) => setCalcRate(e.target.value)}
                                    className="w-full p-3 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">भाव / रक्कम दर (Price per Qtl)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                    <input
                                        type="number" placeholder="भाव टाका"
                                        value={calcPrice} onChange={(e) => setCalcPrice(e.target.value)}
                                        className="w-full p-3 pl-8 border dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Results Section */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-blue-950 p-6 rounded-2xl border border-blue-100 dark:border-blue-900 flex flex-col justify-center gap-6 shadow-inner">
                            <div className="text-center">
                                <span className="text-xs text-blue-600 dark:text-blue-300 font-bold uppercase tracking-wider">एकूण वजन (Total Weight)</span>
                                <p className={`text-3xl font-black transition-all duration-300 ${calculatedStats.hasInput ? 'text-blue-800 dark:text-white scale-100' : 'text-slate-300 dark:text-slate-700 opacity-30'}`}>
                                    {calculatedStats.weight.toFixed(2)} <span className="text-sm font-normal">Qtl</span>
                                </p>
                            </div>

                            <div className="h-px bg-blue-200 dark:bg-blue-800 w-1/2 mx-auto"></div>

                            <div className="text-center">
                                <span className="text-xs text-blue-600 dark:text-blue-300 font-bold uppercase tracking-wider">अपेक्षित पोते (Expected Bags)</span>
                                <p className={`text-3xl font-black transition-all duration-300 ${calculatedStats.hasInput ? 'text-blue-800 dark:text-white scale-100' : 'text-slate-300 dark:text-slate-700 opacity-30'}`}>
                                    {calculatedStats.bags} <span className="text-sm font-normal">Bags</span>
                                </p>
                            </div>

                            <div className="h-px bg-blue-200 dark:bg-blue-800 w-1/2 mx-auto"></div>

                            <div className="text-center">
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">एकूण रक्कम (Total Amount)</span>
                                <p className={`text-3xl font-black transition-all duration-300 ${calculatedStats.hasInput ? 'text-emerald-700 dark:text-emerald-400 scale-105' : 'text-slate-300 dark:text-slate-700 opacity-30'}`}>
                                    <span className="text-sm font-normal mr-1">₹</span>
                                    {calculatedStats.amount.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <div className="mb-6 p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Archive size={18} className="text-amber-600" /> Storage Capacity Configuration (साठवणूक क्षमता)
                        </h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-red-500 transition">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Godown Setting */}
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900">
                            <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                <Archive size={16} /> Max Godown Capacity (Bags)
                            </label>
                            <div className="flex items-center gap-2">
                                {isEditingCapacities ? (
                                    <input
                                        type="number" value={tempGodownCap}
                                        onChange={(e) => setTempGodownCap(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="Enter Capacity"
                                        className="flex-1 p-2 border border-blue-500 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                                    />
                                ) : (
                                    <div className="flex-1 p-2 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                                        {godownCapacity} Bags
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 uppercase font-bold flex justify-between">
                                <span>Stock: {currentStocks.godown}</span>
                                <span className="text-green-600">Free: {Math.max(0, (isEditingCapacities ? (Number(tempGodownCap) || 0) : godownCapacity) - currentStocks.godown)}</span>
                            </div>
                        </div>

                        {/* Shed Setting */}
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900">
                            <label className="block text-sm font-bold text-purple-800 dark:text-purple-300 mb-2 flex items-center gap-2">
                                <Warehouse size={16} /> Max Shed Capacity (Bags)
                            </label>
                            <div className="flex items-center gap-2">
                                {isEditingCapacities ? (
                                    <input
                                        type="number" value={tempShedCap}
                                        onChange={(e) => setTempShedCap(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="Enter Capacity"
                                        className="flex-1 p-2 border border-purple-500 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                                    />
                                ) : (
                                    <div className="flex-1 p-2 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                                        {shedCapacity} Bags
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 uppercase font-bold flex justify-between">
                                <span>Stock: {currentStocks.shed}</span>
                                <span className="text-green-600">Free: {Math.max(0, (isEditingCapacities ? (Number(tempShedCap) || 0) : shedCapacity) - currentStocks.shed)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        {isEditingCapacities ? (
                            <>
                                <button onClick={() => setIsEditingCapacities(false)} className="px-4 py-2 text-sm text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">Cancel</button>
                                <button onClick={handleSaveCapacities} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition">Save Capacities</button>
                            </>
                        ) : (
                            <button onClick={() => { setTempGodownCap(godownCapacity); setTempShedCap(shedCapacity); setIsEditingCapacities(true); }} className="px-6 py-2 bg-slate-800 dark:bg-blue-600 text-white font-bold rounded-lg hover:bg-slate-700 dark:hover:bg-blue-700 transition flex items-center gap-2">
                                <Edit size={16} /> Edit Capacities
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Input Form */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-8">
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-700 dark:text-white">
                        {editingId ? "Edit Record (माहिती बदला)" : "New Entry (नवीन नोंद)"}
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
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">खरेदी केंद्राचे नाव</label>
                            <input type="text" required value={centerName} onChange={e => setCenterName(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">दिनांक</label>
                            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Members (सभासद)</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">आदि सभा (Tribal)</label>
                                <input type="number" min="0" placeholder="0" value={tribalMembers || ''} onChange={e => setTribalMembers(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">गैर सभा (Non-Tribal)</label>
                                <input type="number" min="0" placeholder="0" value={nonTribalMembers || ''} onChange={e => setNonTribalMembers(Number(e.target.value))} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">एकूण सभा (Total)</label>
                                <div className="w-full p-2 bg-slate-200 dark:bg-slate-700 rounded font-bold text-center text-slate-800 dark:text-white">{formTotalMembers}</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex justify-between items-center mb-3 text-sm font-bold text-amber-800 dark:text-amber-400 uppercase">
                            <h4>Bag Details (पोते तपशील)</h4>
                            <span className="text-[10px] bg-amber-200 dark:bg-amber-800 px-2 py-0.5 rounded font-bold">1 Bag = 0.40 Qtl</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {/* New Bags */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-slate-600">नविन पोते (New)</label>
                                    <button type="button" onClick={() => setIsNewLocked(!isNewLocked)} className={`p-1 rounded transition ${isNewLocked ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100'}`}>
                                        {isNewLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                    </button>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="number" min="0" placeholder="Bags"
                                            readOnly={isNewLocked}
                                            value={newBags}
                                            onChange={e => {
                                                const v = e.target.value === '' ? '' : Number(e.target.value);
                                                setNewBags(v);
                                                if (!isNewLocked) setNewWeight(v === '' ? 0 : v * 0.40);
                                            }}
                                            className={`w-full p-2 border dark:border-slate-600 rounded transition ${isNewLocked ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-75' : 'bg-white dark:bg-slate-800'}`}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="number" step="0.01" placeholder="Weight"
                                            readOnly={isNewLocked}
                                            value={newWeight}
                                            onChange={e => setNewWeight(e.target.value === '' ? '' : Number(e.target.value))}
                                            className={`w-full p-2 border dark:border-slate-600 rounded transition ${isNewLocked ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-75' : 'bg-white dark:bg-slate-800'}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Old Bags */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-slate-600">जुने पोते (Old)</label>
                                    <button type="button" onClick={() => setIsOldLocked(!isOldLocked)} className={`p-1 rounded transition ${isOldLocked ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100'}`}>
                                        {isOldLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                    </button>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="number" min="0" placeholder="Bags"
                                            readOnly={isOldLocked}
                                            value={oldBags}
                                            onChange={e => {
                                                const v = e.target.value === '' ? '' : Number(e.target.value);
                                                setOldBags(v);
                                                if (!isOldLocked) setOldWeight(v === '' ? 0 : v * 0.40);
                                            }}
                                            className={`w-full p-2 border dark:border-slate-600 rounded transition ${isOldLocked ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-75' : 'bg-white dark:bg-slate-800'}`}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="number" step="0.01" placeholder="Weight"
                                            readOnly={isOldLocked}
                                            value={oldWeight}
                                            onChange={e => setOldWeight(e.target.value === '' ? '' : Number(e.target.value))}
                                            className={`w-full p-2 border dark:border-slate-600 rounded transition ${isOldLocked ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-75' : 'bg-white dark:bg-slate-800'}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Used Once Bags */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-slate-600">एकदा वापरलेला (Used Once)</label>
                                    <button type="button" onClick={() => setIsUsedOnceLocked(!isUsedOnceLocked)} className={`p-1 rounded transition ${isUsedOnceLocked ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100'}`}>
                                        {isUsedOnceLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                    </button>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="number" min="0" placeholder="Bags"
                                            readOnly={isUsedOnceLocked}
                                            value={usedOnceBags}
                                            onChange={e => {
                                                const v = e.target.value === '' ? '' : Number(e.target.value);
                                                setUsedOnceBags(v);
                                                if (!isUsedOnceLocked) setUsedOnceWeight(v === '' ? 0 : v * 0.40);
                                            }}
                                            className={`w-full p-2 border dark:border-slate-600 rounded transition ${isUsedOnceLocked ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-75' : 'bg-white dark:bg-slate-800'}`}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="number" step="0.01" placeholder="Weight"
                                            readOnly={isUsedOnceLocked}
                                            value={usedOnceWeight}
                                            onChange={e => setUsedOnceWeight(e.target.value === '' ? '' : Number(e.target.value))}
                                            className={`w-full p-2 border dark:border-slate-600 rounded transition ${isUsedOnceLocked ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-75' : 'bg-white dark:bg-slate-800'}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col justify-end">
                                <div className="flex gap-4 bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg items-center font-bold">
                                    <div className="flex-1"><label className="block text-xs text-amber-800">Total Bags: {formTotalBags}</label></div>
                                    <div className="flex-1 text-right"><label className="block text-xs text-amber-800">Total Qtl: {formTotalWeight.toFixed(2)}</label></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200">
                        <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-400 uppercase mb-3 flex items-center gap-2">
                            <Archive size={16} /> Storage Allocation (साठवणूक विभागणी)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase tracking-tight">गोदामात खरेदी (Godown)</label>
                                <div className="flex gap-1">
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-center text-sm font-bold text-blue-600">{currentStocks.godown + godownBags} <span className="text-[9px] font-normal block text-slate-500">Total Bags</span></div>
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-center text-sm font-bold text-blue-600">{(currentStocks.godownWeight + godownWeight).toFixed(2)} <span className="text-[9px] font-normal block text-slate-500">Total Qtl</span></div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase tracking-tight">शेडमध्ये खरेदी (Shed)</label>
                                <div className="flex gap-1">
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-center text-sm font-bold text-purple-600">{currentStocks.shed + shedBags} <span className="text-[9px] font-normal block text-slate-500">Total Bags</span></div>
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-center text-sm font-bold text-purple-600">{(currentStocks.shedWeight + shedWeight).toFixed(2)} <span className="text-[9px] font-normal block text-slate-500">Total Qtl</span></div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase tracking-tight">उघड्यावर खरेदी (Open)</label>
                                <div className="flex gap-1">
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-center text-sm font-bold text-amber-600">{(currentStocks.open || 0) + openBags} <span className="text-[9px] font-normal block text-slate-500">Total Bags</span></div>
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-center text-sm font-bold text-amber-600">{((currentStocks.openWeight || 0) + openWeight).toFixed(2)} <span className="text-[9px] font-normal block text-slate-500">Total Qtl</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg">
                        <Save size={20} /> {editingId ? "Update Record" : "Save Record"}
                    </button>
                </form>
            </div >

            <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center border-b dark:border-slate-700 pb-2 gap-2">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Recent Records</h3>
                    <div className="flex items-center gap-2">
                        {/* Download Buttons */}
                        <button
                            onClick={() => handleDownloadRecordsImage('jpeg')}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm font-medium flex items-center gap-1 transition shadow-sm"
                            title="Download as JPG"
                        >
                            <Download size={16} /> JPG
                        </button>
                        <button
                            onClick={() => handleDownloadRecordsImage('png')}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs md:text-sm font-medium flex items-center gap-1 transition shadow-sm"
                            title="Download as PNG"
                        >
                            <Download size={16} /> PNG
                        </button>
                        {/* Season Filter */}
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
                {filteredPurchases.length === 0 ? <p className="text-slate-500 text-center py-8">No records found.</p> : [...filteredPurchases].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50).map(record => {
                    // Dynamic Calculation Context for this record
                    const relevantRecords = filteredPurchases.filter(r => r.timestamp <= record.timestamp);


                    const totalGodown = relevantRecords.reduce((sum, r) => sum + (r.godownBags || 0), 0);
                    const totalShed = relevantRecords.reduce((sum, r) => sum + (r.shedBags || 0), 0);
                    const totalOpen = relevantRecords.reduce((sum, r) => sum + (r.openBags || 0), 0);
                    const totalRecBags = totalGodown + totalShed + totalOpen;

                    const totalGodownW = relevantRecords.reduce((sum, r) => sum + (r.godownWeight || 0), 0);
                    const totalShedW = relevantRecords.reduce((sum, r) => sum + (r.shedWeight || 0), 0);
                    const totalOpenW = relevantRecords.reduce((sum, r) => sum + (r.openWeight || 0), 0);
                    const totalRecWeight = totalGodownW + totalShedW + totalOpenW;

                    const totalNew = relevantRecords.reduce((sum, r) => sum + (r.newBags || 0), 0);
                    const totalNewW = relevantRecords.reduce((sum, r) => sum + (r.newWeight || 0), 0);

                    const totalUsed = relevantRecords.reduce((sum, r) => sum + (r.usedOnceBags || 0), 0);
                    const totalUsedW = relevantRecords.reduce((sum, r) => sum + (r.usedOnceWeight || 0), 0);

                    const derivedOldBags = totalRecBags - totalNew - totalUsed;
                    const derivedOldWeight = totalRecWeight - totalNewW - totalUsedW;

                    return (
                        <div key={record.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
                            <div className="p-4 flex justify-between items-start border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-slate-800 dark:text-white">{record.centerName}</h4>
                                        {record.season && (
                                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold">
                                                {record.season}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">{formatDateDisplay(record.date)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => {
                                        navigator.clipboard.writeText(generateShareText(record, paddyPurchases));
                                        alert("Copied to clipboard!");
                                    }} className="p-2 text-slate-500 hover:text-blue-600 transition" title="Copy Info"><Copy size={18} /></button>
                                    <button onClick={async () => {
                                        try {
                                            await Share.share({
                                                title: `Paddy Purchase - ${record.centerName}`,
                                                text: generateShareText(record, paddyPurchases),
                                                dialogTitle: 'Share Paddy Purchase Info'
                                            });
                                        } catch (error) {
                                            console.error('Share failed:', error);
                                        }
                                    }} className="p-2 text-slate-500 hover:text-green-600 transition" title="Share Info"><Share2 size={18} /></button>
                                    <button onClick={() => handleEdit(record)} className="p-2 text-slate-500 hover:text-amber-600 transition" title="Edit Entry"><Edit size={18} /></button>
                                    <button onClick={() => initiateDelete(record.id)} className="p-2 text-slate-500 hover:text-red-600 transition" title="Delete Entry"><Trash2 size={18} /></button>
                                </div>
                            </div>
                            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                                <div>
                                    <span className="block text-[10px] text-slate-400 uppercase">Members</span>
                                    {record.tribalMembers + record.nonTribalMembers}
                                </div>

                                <div>
                                    <span className="block text-[10px] text-slate-400 uppercase">Total (एकूण)</span>
                                    {totalRecBags} Bags <span className="text-[10px] text-slate-400">/ {totalRecWeight.toFixed(2)} Qtl</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-blue-500 uppercase">New (नवीन)</span>
                                    {totalNew} <span className="text-[10px] text-slate-400">/ {totalNewW.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-blue-500 uppercase">Old (जुने)</span>
                                    {derivedOldBags} <span className="text-[10px] text-slate-400">/ {derivedOldWeight.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-blue-500 uppercase">Used (एकदा)</span>
                                    {totalUsed} <span className="text-[10px] text-slate-400">/ {totalUsedW.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* View Text Format */}
                            <div className="relative group">
                                <button onClick={() => toggleTextFormat(record.id)} className="w-full text-left p-2 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1">
                                    {expandedTextId === record.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />} View Text Format
                                </button>
                                {expandedTextId === record.id && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700">
                                        <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed select-all">
                                            {generateShareText(record, paddyPurchases)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Delete Confirmation Modal */}
            {
                showDeleteModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-red-100 dark:border-red-900 animate-fade-in-up">
                            <div className="text-center mb-6">
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
                )
            }

            {/* Hidden Container for Beautiful Image Export */}
            <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: '800px' }}>
                <div ref={recentRecordsRef} className="bg-white p-8 space-y-4">
                    <h2 className="text-6xl font-bold text-center text-slate-800 mb-6">खरेदी केंद्र ईळदा</h2>
                    {[...filteredPurchases].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10).map((record, index) => {
                        // Calculate running totals up to this record
                        const relevantRecords = filteredPurchases.filter(r => r.timestamp <= record.timestamp);
                        const totalGodown = relevantRecords.reduce((sum, r) => sum + (r.godownBags || 0), 0);
                        const totalShed = relevantRecords.reduce((sum, r) => sum + (r.shedBags || 0), 0);
                        const totalOpen = relevantRecords.reduce((sum, r) => sum + (r.openBags || 0), 0);
                        const totalRecBags = totalGodown + totalShed + totalOpen;

                        const totalGodownW = relevantRecords.reduce((sum, r) => sum + (r.godownWeight || 0), 0);
                        const totalShedW = relevantRecords.reduce((sum, r) => sum + (r.shedWeight || 0), 0);
                        const totalOpenW = relevantRecords.reduce((sum, r) => sum + (r.openWeight || 0), 0);
                        const totalRecWeight = totalGodownW + totalShedW + totalOpenW;

                        // Calculate cumulative New and Used bags/weight
                        const cumulativeNew = relevantRecords.reduce((sum, r) => sum + (r.newBags || 0), 0);
                        const cumulativeNewWeight = relevantRecords.reduce((sum, r) => sum + (r.newWeight || 0), 0);
                        const cumulativeUsed = relevantRecords.reduce((sum, r) => sum + (r.usedOnceBags || 0), 0);
                        const cumulativeUsedWeight = relevantRecords.reduce((sum, r) => sum + (r.usedOnceWeight || 0), 0);

                        // Derive Old bags as: Total Storage - New - Used (matching WhatsApp share logic)
                        const derivedOldBags = totalRecBags - cumulativeNew - cumulativeUsed;
                        const derivedOldWeight = totalRecWeight - cumulativeNewWeight - cumulativeUsedWeight;

                        return (
                            <div key={record.id} className="border-2 border-slate-300 rounded-lg p-4 bg-slate-50 shadow-md">
                                {/* Date Header */}
                                <div className="bg-blue-100 px-4 py-4 rounded-md mb-5">
                                    <p className="text-4xl font-bold text-slate-800">दिनांक: {format(new Date(record.date), 'dd/MM/yyyy')}</p>
                                </div>

                                {/* Member Stats */}
                                <div className="border-l-4 border-blue-500 pl-5 mb-5">
                                    <p className="text-3xl font-medium">आदि सभासद :- {record.tribalMembers || 0}</p>
                                    <p className="text-3xl font-medium">गैर आदि सभा :- {record.nonTribalMembers || 0}</p>
                                    <p className="text-4xl font-bold">एकूण सभासद :- {(record.tribalMembers || 0) + (record.nonTribalMembers || 0)}</p>
                                </div>

                                {/* Purchase Details */}
                                <div className="space-y-2 mb-5">
                                    <p className="text-3xl">• नविन पोते :- {cumulativeNew}</p>
                                    <p className="text-3xl">• वजन :- {cumulativeNewWeight.toFixed(2)}</p>
                                    <p className="text-3xl">• जुने पोते :- {derivedOldBags}</p>
                                    <p className="text-3xl font-bold text-green-700">• वजन :- {derivedOldWeight.toFixed(2)}</p>
                                    <p className="text-3xl">• एकदा वापरलेला :- {cumulativeUsed}</p>
                                    <p className="text-3xl">• वजन :- {cumulativeUsedWeight.toFixed(2)}</p>
                                </div>

                                {/* Totals */}
                                <div className="border-l-4 border-green-600 pl-5 mb-5 bg-green-50 py-4">
                                    <p className="text-4xl font-bold">एकूण पोते:- {totalRecBags}</p>
                                    <p className="text-4xl font-bold text-green-700">एकूण वजन:- {totalRecWeight.toFixed(2)}</p>
                                </div>

                                {/* Storage Details */}
                                <div className="border-l-4 border-purple-500 pl-5 space-y-4">
                                    <div>
                                        <p className="font-bold text-3xl">गोदामात खरेदी</p>
                                        <p className="text-2xl">• पोते :- {totalGodown}</p>
                                        <p className="text-2xl">• वजन :- {totalGodownW.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-3xl">शेडमध्ये खरेदी</p>
                                        <p className="text-2xl">• पोते :- {totalShed}</p>
                                        <p className="text-2xl">• वजन :- {totalShedW.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-3xl">उघड्यावर खरेदी</p>
                                        <p className="text-2xl">• पोते :- {totalOpen}</p>
                                        <p className="text-2xl">• वजन :- {totalOpenW.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Timestamp */}
                                <p className="text-right text-lg text-slate-500 mt-5">{format(new Date(record.timestamp), 'h:mm a')}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div >
    );
};

export default PaddyPurchase;
