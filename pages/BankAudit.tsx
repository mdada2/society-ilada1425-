
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { Landmark, LandmarkIcon, Plus, History, Trash2, Scale, ArrowUpCircle, ArrowDownCircle, ShieldCheck, FileText, CheckCircle, AlertTriangle, X, Save, Edit, Eye } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { SocietyBank, AuditNote, TransactionType } from '../types';

const BankAudit = () => {
    const { societyBanks, auditNotes, addSocietyBank, updateSocietyBank, deleteSocietyBank, addAuditNote, updateAuditNote, deleteAuditNote, transactions, addTransaction, members, settings } = useApp();

    // Tabs
    const [activeTab, setActiveTab] = useState<'banks' | 'audit' | 'trial'>('banks');

    // Modal States
    const [showBankModal, setShowBankModal] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);

    // Statement Modal State
    const [selectedBankForStatement, setSelectedBankForStatement] = useState<SocietyBank | null>(null);

    // Security PIN Modal for Banks
    const [showDeleteBankModal, setShowDeleteBankModal] = useState(false);
    const [bankToDelete, setBankToDelete] = useState<string | null>(null);
    const [bankDeletePin, setBankDeletePin] = useState('');
    const [bankDeleteError, setBankDeleteError] = useState('');

    // Form States (Bank)
    const [editingBankId, setEditingBankId] = useState<string | null>(null);
    const [bankName, setBankName] = useState('');
    const [accNo, setAccNo] = useState('');
    const [accType, setAccType] = useState<'Current' | 'Savings' | 'KCC'>('Savings');
    const [initialBalance, setInitialBalance] = useState<number | ''>('');

    // Form States (Audit)
    const [auditSubject, setAuditSubject] = useState('');
    const [auditDesc, setAuditDesc] = useState('');

    // Form States (Transfer)
    const [transferBankId, setTransferBankId] = useState('');
    const [transferType, setTransferType] = useState<TransactionType>(TransactionType.CREDIT);
    const [transferAmount, setTransferAmount] = useState<number | ''>('');
    const [transferDetails, setTransferDetails] = useState('');

    // --- Trial Balance Logic ---
    const trialBalance = useMemo(() => {
        const shares = members.reduce((s, m) => s + m.shareBalance, 0);
        const savings = members.reduce((s, m) => s + m.savingsBalance, 0);
        const deposits = members.reduce((s, m) => s + m.fdBalance, 0);
        const loans = members.reduce((s, m) => s + m.loanPrincipal, 0);
        const bankBalances = societyBanks.reduce((s, b) => s + b.balance, 0);
        const totalCredit = transactions.filter(t => {
            if (t.isGovtWaiver) return false;
            if (t.accountType === 'BankTransfer') {
                return t.type === TransactionType.DEBIT;
            }
            return t.type === TransactionType.CREDIT && !t.bankId;
        }).reduce((s, t) => s + t.amount, 0);

        const totalDebit = transactions.filter(t => {
            if (t.accountType === 'BankTransfer') {
                return t.type === TransactionType.CREDIT;
            }
            return t.type === TransactionType.DEBIT && !t.bankId;
        }).reduce((s, t) => s + t.amount, 0);
        const cashInHand = totalCredit - totalDebit;

        return {
            liabilities: [
                { name: 'Share Capital (भाग भांडवल)', amount: shares },
                { name: 'Member Savings (सभासद बचत)', amount: savings },
                { name: 'Member Deposits (ठेवी)', amount: deposits },
            ],
            assets: [
                { name: 'Outstanding Loans (कर्ज बाकी)', amount: loans },
                { name: 'Cash in Hand (हातातील रोकड)', amount: cashInHand },
                { name: 'Bank Balances (बँक शिल्लक)', amount: bankBalances },
            ],
            totalLiab: shares + savings + deposits,
            totalAssets: loans + cashInHand + bankBalances
        };
    }, [members, societyBanks, transactions]);

    // --- Bank Statement Transactions Logic ---
    const bankStatementTransactions = useMemo(() => {
        if (!selectedBankForStatement) return [];
        return transactions.filter(t =>
            (t.accountType === 'BankTransfer' && t.bankId === selectedBankForStatement.id)
        ).sort((a, b) => b.timestamp - a.timestamp);
    }, [selectedBankForStatement, transactions]);

    const handleOpenAddBank = () => {
        setEditingBankId(null);
        setBankName('');
        setAccNo('');
        setAccType('Savings');
        setInitialBalance('');
        setShowBankModal(true);
    };

    const handleOpenEditBank = (bank: SocietyBank) => {
        setEditingBankId(bank.id);
        setBankName(bank.bankName);
        setAccNo(bank.accountNo);
        setAccType(bank.accountType);
        setInitialBalance(bank.balance);
        setShowBankModal(true);
    };

    const handleAddBank = (e: React.FormEvent) => {
        e.preventDefault();
        const balanceValue = initialBalance === '' ? 0 : initialBalance;

        if (editingBankId) {
            updateSocietyBank({
                id: editingBankId,
                bankName, accountNo: accNo, accountType: accType, balance: balanceValue
            });
        } else {
            const newBank: SocietyBank = {
                id: Date.now().toString(),
                bankName, accountNo: accNo, accountType: accType, balance: balanceValue
            };
            addSocietyBank(newBank);
        }
        setShowBankModal(false);
    };

    const initiateDeleteBank = (id: string) => {
        setBankToDelete(id);
        setBankDeletePin('');
        setBankDeleteError('');
        setShowDeleteBankModal(true);
    };

    const confirmDeleteBank = () => {
        if (bankDeletePin === settings.securityPin && bankToDelete) {
            deleteSocietyBank(bankToDelete);
            setShowDeleteBankModal(false);
            setBankToDelete(null);
        } else {
            setBankDeleteError("चुकीचा पिन! (Incorrect PIN)");
        }
    };

    const handleAddAuditNote = (e: React.FormEvent) => {
        e.preventDefault();
        const newNote: AuditNote = {
            id: Date.now().toString(),
            date: format(new Date(), 'yyyy-MM-dd'),
            subject: auditSubject, description: auditDesc, status: 'Pending'
        };
        addAuditNote(newNote);
        setShowAuditModal(false);
        setAuditSubject(''); setAuditDesc('');
    };

    const handleBankTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferBankId || transferAmount === '') return;
        const txn: any = {
            id: Date.now().toString(),
            date: format(new Date(), 'yyyy-MM-dd'),
            type: transferType,
            accountType: 'BankTransfer',
            bankId: transferBankId,
            amount: transferAmount,
            details: transferDetails || (transferType === TransactionType.CREDIT ? "Cash deposited in bank" : "Cash withdrawn from bank"),
            timestamp: Date.now(),
            memberId: null
        };
        addTransaction(txn);
        setShowTransferModal(false);
        setTransferAmount(''); setTransferDetails('');
    };

    const formatDateDisplay = (dateStr: string) => {
        try { return format(new Date(dateStr), 'dd-MM-yyyy'); } catch (e) { return dateStr; }
    };

    const handlePrintTrialBalance = async () => {
        const element = document.querySelector('.trial-balance-content') as HTMLElement;
        if (!element) return;

        try {
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const { downloadBlob } = await import('../utils/downloadUtils');
            const pdfBlob = pdf.output('blob');
            await downloadBlob(pdfBlob, `Trial_Balance_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('PDF generation failed');
        }
    };

    const handlePrintBankStatement = async () => {
        const element = document.querySelector('.bank-statement-content') as HTMLElement;
        if (!element || !selectedBankForStatement) return;

        try {
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const { downloadBlob } = await import('../utils/downloadUtils');
            const pdfBlob = pdf.output('blob');
            await downloadBlob(pdfBlob, `${selectedBankForStatement.bankName}_Statement_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('PDF generation failed');
        }
    };

    return (
        <div className="p-4 md:p-6 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Landmark className="text-blue-600" /> Bank & Audit Manager
                    </h2>
                    <p className="text-sm text-slate-500">संस्थेचे खाते आणि ताळेबंद व्यवस्थापन</p>
                </div>
                <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('banks')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${activeTab === 'banks' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}><LandmarkIcon size={16} /> Banks</button>
                    <button onClick={() => setActiveTab('trial')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${activeTab === 'trial' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-300' : 'text-slate-500'}`}><Scale size={16} /> Trial Balance</button>
                    <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${activeTab === 'audit' ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-300' : 'text-slate-500'}`}><ShieldCheck size={16} /> Audit Notes</button>
                </div>
            </div>

            {activeTab === 'banks' && (
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Society Accounts</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setShowTransferModal(true)} className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm hover:bg-amber-200 transition"><History size={16} /> Cash ⇄ Bank</button>
                            <button onClick={handleOpenAddBank} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm hover:bg-blue-700 transition"><Plus size={16} /> Add Bank</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {societyBanks.map(bank => (
                            <div
                                key={bank.id}
                                onClick={() => setSelectedBankForStatement(bank)}
                                className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border dark:border-slate-700 relative overflow-hidden group transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><LandmarkIcon size={80} /></div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${bank.accountType === 'Current' ? 'bg-purple-100 text-purple-700' : bank.accountType === 'KCC' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{bank.accountType} Account</span>
                                    <div className="flex gap-2 relative z-10">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenEditBank(bank); }}
                                            className="p-1.5 bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 transition"
                                            title="Edit Bank Details"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); initiateDeleteBank(bank.id); }}
                                            className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded hover:bg-red-100 transition"
                                            title="Delete Bank Account"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <h4 className="text-xl font-black text-slate-800 dark:text-white mb-1">{bank.bankName}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-4">Acc No: {bank.accountNo}</p>
                                <div className="pt-4 border-t dark:border-slate-700 flex justify-between items-center">
                                    <span className="text-slate-500 text-xs font-bold uppercase">Balance:</span>
                                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">₹{bank.balance.toLocaleString()}</span>
                                </div>
                                <div className="absolute bottom-2 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                    <Eye size={12} /> Click to View Statement
                                </div>
                            </div>
                        ))}
                        {societyBanks.length === 0 && (
                            <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <LandmarkIcon size={48} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-slate-500">कोणतेही बँक खाते जोडलेले नाही.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'trial' && (
                <div className="animate-fade-in space-y-6 trial-balance-content">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border dark:border-slate-700">
                        <div className="text-center mb-2 pb-4 border-b dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider">Trial Balance (कच्चा ताळेबंद)</h3>
                            <p className="text-sm text-slate-500">Financial Situation as of {format(new Date(), 'dd MMMM yyyy')}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-t-xl font-black text-sm uppercase tracking-widest border-b-2 border-red-500">देणी (Liabilities)</h4>
                                <div className="border dark:border-slate-700 border-t-0 rounded-b-xl overflow-hidden">
                                    {trialBalance.liabilities.map((item, i) => (
                                        <div key={i} className="flex justify-between p-4 border-b last:border-0 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{item.name}</span>
                                            <span className="font-mono font-bold">₹{item.amount.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="bg-slate-100 dark:bg-slate-700 p-4 flex justify-between font-black text-slate-800 dark:text-white">
                                        <span>एकूण देणी (Total Liabilities)</span>
                                        <span>₹{trialBalance.totalLiab.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3 rounded-t-xl font-black text-sm uppercase tracking-widest border-b-2 border-green-500">येणी / मालमत्ता (Assets)</h4>
                                <div className="border dark:border-slate-700 border-t-0 rounded-b-xl overflow-hidden">
                                    {trialBalance.assets.map((item, i) => (
                                        <div key={i} className="flex justify-between p-4 border-b last:border-0 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{item.name}</span>
                                            <span className="font-mono font-bold">₹{item.amount.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="bg-slate-100 dark:bg-slate-700 p-4 flex justify-between font-black text-slate-800 dark:text-white">
                                        <span>एकूण येणी (Total Assets)</span>
                                        <span>₹{trialBalance.totalAssets.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={`mt-8 p-3 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 ${Math.abs(trialBalance.totalLiab - trialBalance.totalAssets) < 1 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10'}`}>
                            <div className="flex items-center gap-4">
                                {Math.abs(trialBalance.totalLiab - trialBalance.totalAssets) < 1 ? (
                                    <CheckCircle size={40} className="text-emerald-600" />
                                ) : (
                                    <AlertTriangle size={40} className="text-red-600" />
                                )}
                                <div>
                                    <h5 className="font-bold text-lg">{Math.abs(trialBalance.totalLiab - trialBalance.totalAssets) < 1 ? "Accounts Balanced" : "Balance Mismatch"}</h5>
                                    <p className="text-sm opacity-70">{Math.abs(trialBalance.totalLiab - trialBalance.totalAssets) < 1 ? "देणी आणि येणी यांची जुळवणी बरोबर आहे." : `ताळेबंद जुळत नाही. फरक: ₹${Math.abs(trialBalance.totalLiab - trialBalance.totalAssets).toLocaleString()}`}</p>
                                </div>
                            </div>
                            <button onClick={handlePrintTrialBalance} className="bg-white dark:bg-slate-700 text-slate-700 dark:text-white px-6 py-2 rounded-xl shadow-md font-bold flex items-center gap-2 hover:scale-105 transition"><FileText size={20} /> Print Statement</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Audit Checklist & Notes</h3>
                        <button onClick={() => setShowAuditModal(true)} className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm"><Plus size={16} /> New Note</button>
                    </div>
                    <div className="space-y-4">
                        {auditNotes.map(note => (
                            <div key={note.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${note.status === 'Resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{note.status}</span>
                                        <span className="text-xs text-slate-400">{format(new Date(note.date), 'dd/MM/yyyy')}</span>
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{note.subject}</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{note.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    {note.status === 'Pending' && (
                                        <button onClick={() => updateAuditNote({ ...note, status: 'Resolved' })} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition" title="Mark Resolved"><CheckCircle size={18} /></button>
                                    )}
                                    <button onClick={() => deleteAuditNote(note.id)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                        {auditNotes.length === 0 && <div className="text-center py-12 text-slate-400 italic">No audit notes found.</div>}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showBankModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-3 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-bold">{editingBankId ? 'Edit Bank Account' : 'Add Society Bank'}</h3>
                            <button onClick={() => setShowBankModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddBank} className="space-y-4">
                            <div><label className="text-sm font-bold block mb-1">Bank Name</label><input required value={bankName} onChange={e => setBankName(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" placeholder="e.g. ADCC Bank, SBI" /></div>
                            <div><label className="text-sm font-bold block mb-1">Account No</label><input required value={accNo} onChange={e => setAccNo(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" /></div>
                            <div><label className="text-sm font-bold block mb-1">Account Type</label><select value={accType} onChange={e => setAccType(e.target.value as any)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"><option value="Savings">Savings (बचत)</option><option value="Current">Current (चालू)</option><option value="KCC">KCC (कर्ज खाते / पत मर्यादा)</option></select></div>
                            <div>
                                <label className="text-sm font-bold block mb-1">Initial Balance (₹)</label>
                                <input
                                    type="number"
                                    required
                                    value={initialBalance}
                                    onChange={e => setInitialBalance(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 font-bold"
                                    placeholder="Enter initial balance"
                                />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition">
                                <Save size={20} /> {editingBankId ? 'Update & Save' : 'Save Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Bank Security PIN Modal */}
            {showDeleteBankModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-3 animate-fade-in-up">
                        <div className="text-center mb-2">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Security Check</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter PIN to delete this bank account.</p>
                        </div>
                        <div className="space-y-4">
                            <input
                                type="password"
                                autoFocus
                                className="w-full p-3 text-center text-2xl tracking-widest border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="PIN"
                                maxLength={4}
                                value={bankDeletePin}
                                onChange={e => setBankDeletePin(e.target.value)}
                            />
                            {bankDeleteError && <p className="text-red-500 text-center text-sm font-medium">{bankDeleteError}</p>}
                            <div className="flex gap-3">
                                <button onClick={() => setShowDeleteBankModal(false)} className="flex-1 py-2 border dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
                                <button onClick={confirmDeleteBank} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">Delete Account</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTransferModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-3 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-bold">Bank Transfer (नकद ⇄ बँक)</h3>
                            <button onClick={() => setShowTransferModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleBankTransfer} className="space-y-4">
                            <div><label className="text-sm font-bold block mb-1">Select Bank</label><select required value={transferBankId} onChange={e => setTransferBankId(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"><option value="">-- निवडा --</option>{societyBanks.map(b => <option key={b.id} value={b.id}>{b.bankName} ({b.accountNo})</option>)}</select></div>
                            <div><label className="text-sm font-bold block mb-1">Type</label><select value={transferType} onChange={e => setTransferType(e.target.value as any)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"><option value={TransactionType.CREDIT}>Cash to Bank (जमा)</option><option value={TransactionType.DEBIT}>Bank to Cash (नावे)</option></select></div>
                            <div>
                                <label className="text-sm font-bold block mb-1">Amount (₹)</label>
                                <input
                                    type="number"
                                    required
                                    value={transferAmount}
                                    onChange={e => setTransferAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 font-bold text-lg"
                                    placeholder="Enter amount"
                                />
                            </div>
                            <div><label className="text-sm font-bold block mb-1">Details</label><input value={transferDetails} onChange={e => setTransferDetails(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" placeholder="उदा. चेक नं, पावती नं इ." /></div>
                            <button type="submit" className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-700 transition shadow-md">
                                <History size={20} /> Update Balances
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showAuditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-3 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-bold">New Audit Note</h3>
                            <button onClick={() => setShowAuditModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddAuditNote} className="space-y-4">
                            <div><label className="text-sm font-bold block mb-1">Subject (विषय)</label><input required value={auditSubject} onChange={e => setAuditSubject(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" /></div>
                            <div><label className="text-sm font-bold block mb-1">Description (तपशील)</label><textarea required rows={4} value={auditDesc} onChange={e => setAuditDesc(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" /></div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition">
                                <Save size={20} /> Save Note
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Bank Statement Modal */}
            {selectedBankForStatement && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedBankForStatement(null)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border dark:border-slate-700 animate-fade-in-up bank-statement-content" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-t-2xl flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Landmark size={24} className="text-blue-600" /> {selectedBankForStatement.bankName}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">Acc: {selectedBankForStatement.accountNo} | Passbook View</p>
                            </div>
                            <button onClick={() => setSelectedBankForStatement(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition"><X size={24} /></button>
                        </div>

                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 flex justify-between items-center border-b dark:border-slate-700">
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Current Balance</span>
                            <span className="text-2xl font-black text-blue-700 dark:text-blue-400">₹{selectedBankForStatement.balance.toLocaleString()}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0 shadow-sm">
                                    <tr>
                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300">Date</th>
                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300">Particulars (तपशील)</th>
                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-right">Debit (नावे)</th>
                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-right">Credit (जमा)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {bankStatementTransactions.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No transactions found for this bank.</td></tr>
                                    ) : bankStatementTransactions.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                                            <td className="p-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDateDisplay(t.date)}</td>
                                            <td className="p-4 text-slate-600 dark:text-slate-400 max-w-xs">{t.details}</td>
                                            <td className="p-4 text-right font-mono font-bold text-red-600 dark:text-red-400">
                                                {t.type === TransactionType.DEBIT ? `₹${t.amount.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-green-600 dark:text-green-400">
                                                {t.type === TransactionType.CREDIT ? `₹${t.amount.toLocaleString()}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-2xl flex justify-end">
                            <button onClick={handlePrintBankStatement} className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition"><FileText size={16} /> Print Statement</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BankAudit;

