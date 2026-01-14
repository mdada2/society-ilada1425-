
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Member, Transaction, AppSettings, LocalSettings, TransactionType, AccountType, Meeting, PaddyPurchaseRecord, SocietyBank, AuditNote, DispatchRecord, InventoryAdjustment } from '../types';
import { db, auth, signInWithEmail, signUpWithEmail, signOutUser, sendPasswordResetEmail as sendResetEmail, setupRecaptcha, signInWithPhone, verifyOTP, clearRecaptcha } from '../services/firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User, ConfirmationResult, ApplicationVerifier } from 'firebase/auth';

interface AppContextType {
  members: Member[];
  transactions: Transaction[];
  meetings: Meeting[];
  paddyPurchases: PaddyPurchaseRecord[];
  dispatches: DispatchRecord[];
  inventoryAdjustments: InventoryAdjustment[];
  societyBanks: SocietyBank[];
  auditNotes: AuditNote[];
  settings: AppSettings;
  localSettings: LocalSettings;
  isAuthenticated: boolean;
  currentUser: User | null;
  isCloudSynced: boolean;
  isSyncing: boolean;
  cloudPermissionError: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithPhone: (phoneNumber: string, appVerifier: ApplicationVerifier) => Promise<ConfirmationResult>;
  verifyPhoneOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
  setupPhoneAuth: (containerId: string) => ApplicationVerifier;
  clearPhoneAuth: () => void;
  addMember: (member: Member) => void;
  deleteMember: (id: string) => void;
  addTransaction: (transaction: Transaction, memberUpdates?: Partial<Member>) => void;
  deleteTransaction: (transactionId: string) => boolean;
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (meeting: Meeting) => void;
  deleteMeeting: (id: string) => void;
  addPaddyPurchase: (record: PaddyPurchaseRecord) => void;
  updatePaddyPurchase: (record: PaddyPurchaseRecord) => void;
  deletePaddyPurchase: (id: string) => void;
  addDispatch: (record: DispatchRecord) => void;
  updateDispatch: (record: DispatchRecord) => void;
  deleteDispatch: (id: string) => void;
  addInventoryAdjustment: (record: InventoryAdjustment) => void;
  updateInventoryAdjustment: (record: InventoryAdjustment) => void;
  deleteInventoryAdjustment: (id: string) => void;
  addSocietyBank: (bank: SocietyBank) => void;
  updateSocietyBank: (bank: SocietyBank) => void;
  deleteSocietyBank: (id: string) => void;
  addAuditNote: (note: AuditNote) => void;
  updateAuditNote: (note: AuditNote) => void;
  deleteAuditNote: (id: string) => void;
  updateMember: (member: Member) => void;
  updateMembers: (updatedMembers: Member[]) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  updateLocalSettings: (newLocal: Partial<LocalSettings>) => void;
  resetData: (data: any) => void;
  getMember: (id: string) => Member | undefined;
  importMembers: (newMembers: Member[]) => void;
  syncToCloud: () => Promise<void>;
  restoreFromCloud: () => Promise<boolean>;
}

export const defaultSettings: AppSettings = {
  securityPin: '1234',
  societyName: 'Society Ilada',
  financialYearStart: '2025-04-01',
  financialYearEnd: '2026-03-31',
  boardMembers: [],
  chairmanId: '',
  viceChairmanIds: [],
  allowanceSettings: { travelAllowance: 100, incidentalExpenses: 50, meetingFee: 200 },
  lastBackupDate: 0,
  autoBackupOnLogout: false,
  reportHeaders: {
    memberNo: 'No.', name: 'Name', village: 'Village', loanDate: 'Loan Date',
    days: 'Days', principal: 'Principal', interest: 'Int. (Est.)', totalDue: 'Total Due',
    dp_memberNo: 'सभासद क्रमांक', dp_name: 'सभासदांचे नाव', dp_category: 'प्रवर्ग',
    dp_village: 'गांव', dp_disbursementDate: 'उछल दिनांक', dp_principal: 'मुद्दल रक्कम',
    dp_repaymentDate: 'दिलेला कर्ज दिनांक', dp_repaidAmount: 'रक्कम', dp_days: 'दिवस',
    dp_product: 'प्रॉडक्ट', dp_incentive: '३% व्याज', dp_bankAccount: 'बँक खाते क्रमांक'
  },
  paddySettings: {
    godownCapacity: 10000,
    shedCapacity: 5000
  }
};

export const defaultLocalSettings: LocalSettings = {
  theme: 'system',
  enableAI: true,
  aiTransparency: 30,
  aiBlurStrength: 'xl'
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [paddyPurchases, setPaddyPurchases] = useState<PaddyPurchaseRecord[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [inventoryAdjustments, setInventoryAdjustments] = useState<InventoryAdjustment[]>([]);
  const [societyBanks, setSocietyBanks] = useState<SocietyBank[]>([]);
  const [auditNotes, setAuditNotes] = useState<AuditNote[]>([]);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [localSettings, setLocalSettings] = useState<LocalSettings>(() => {
    const saved = localStorage.getItem('local_settings');
    return saved ? { ...defaultLocalSettings, ...JSON.parse(saved) } : defaultLocalSettings;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudPermissionError, setCloudPermissionError] = useState(false);

  const isRestoring = useRef(false);
  const isInitialized = useRef(false);
  const lastCloudTimestamp = useRef<number>(0);

  // Firebase Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const effectiveTheme = localSettings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : localSettings.theme;

    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
    localStorage.setItem('local_settings', JSON.stringify(localSettings));
  }, [localSettings]);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const setupListener = () => {
      const docRef = doc(db, "societies", "ilada_main");
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        retryCount = 0; // Reset retry count on successful connection
        if (docSnap.exists()) {
          const data = docSnap.data();
          const cloudTS = data.lastUpdated || 0;
          if (cloudTS > lastCloudTimestamp.current) {
            lastCloudTimestamp.current = cloudTS;
            isRestoring.current = true;
            if (data.members) setMembers(data.members);
            if (data.transactions) setTransactions(data.transactions);
            if (data.meetings) setMeetings(data.meetings);
            if (data.paddyPurchases) setPaddyPurchases(data.paddyPurchases);
            if (data.dispatches) setDispatches(data.dispatches);
            if (data.inventoryAdjustments) setInventoryAdjustments(data.inventoryAdjustments);
            if (data.societyBanks) setSocietyBanks(data.societyBanks);
            if (data.auditNotes) setAuditNotes(data.auditNotes);
            if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
            setIsCloudSynced(true);
            isInitialized.current = true;
            setTimeout(() => { isRestoring.current = false; }, 1000);
          }
        } else {
          isInitialized.current = true;
        }
      }, (error) => {
        console.warn('Firebase connection error:', error.code);

        if (error.code === 'permission-denied') {
          setCloudPermissionError(true);
          isInitialized.current = true;
        } else if (error.code === 'unavailable' || error.message.includes('ERR_CONNECTION_CLOSED')) {
          // Connection error - retry with exponential backoff
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying Firebase connection (${retryCount}/${maxRetries})...`);
            setTimeout(() => {
              setupListener();
            }, retryDelay * retryCount);
          } else {
            console.error('Max retries reached. Working in offline mode.');
            isInitialized.current = true;
            setIsCloudSynced(false);
          }
        } else {
          isInitialized.current = true;
        }
      });
      return unsubscribe;
    };

    const unsubscribe = setupListener();
    return () => unsubscribe();
  }, []);

  const syncToCloud = async () => {
    if (!isInitialized.current || !navigator.onLine || isRestoring.current) return;
    setIsSyncing(true);
    try {
      const timestamp = Date.now();
      const sanitizedData = JSON.parse(JSON.stringify({
        members, transactions, meetings, paddyPurchases, dispatches, inventoryAdjustments, societyBanks, auditNotes, settings, lastUpdated: timestamp
      }));
      await setDoc(doc(db, "societies", "ilada_main"), sanitizedData);
      lastCloudTimestamp.current = timestamp;
      setIsCloudSynced(true);
      setCloudPermissionError(false);
    } catch (e: any) {
      if (e.code === 'permission-denied') setCloudPermissionError(true);
      setIsCloudSynced(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreFromCloud = async (): Promise<boolean> => {
    if (!navigator.onLine) { alert("इंटरनेट आवश्यक आहे."); return false; }
    try {
      const docSnap = await getDoc(doc(db, "societies", "ilada_main"));
      if (docSnap.exists()) {
        const data = docSnap.data();
        isRestoring.current = true;
        setMembers(data.members || []);
        setTransactions(data.transactions || []);
        setMeetings(data.meetings || []);
        setPaddyPurchases(data.paddyPurchases || []);
        setDispatches(data.dispatches || []);
        setInventoryAdjustments(data.inventoryAdjustments || []);
        setSocietyBanks(data.societyBanks || []);
        setAuditNotes(data.auditNotes || []);
        if (data.settings) setSettings(data.settings);
        isRestoring.current = false;
        setIsCloudSynced(true);
        return true;
      }
      return false;
    } catch (e) { return false; }
  };

  useEffect(() => {
    if (!isInitialized.current || isRestoring.current) return;
    localStorage.setItem('members', JSON.stringify(members));
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('meetings', JSON.stringify(meetings));
    localStorage.setItem('paddyPurchases', JSON.stringify(paddyPurchases));
    localStorage.setItem('dispatches', JSON.stringify(dispatches));
    localStorage.setItem('inventoryAdjustments', JSON.stringify(inventoryAdjustments));
    localStorage.setItem('societyBanks', JSON.stringify(societyBanks));
    localStorage.setItem('auditNotes', JSON.stringify(auditNotes));
    localStorage.setItem('settings', JSON.stringify(settings));
    setIsCloudSynced(false);
    const timeout = setTimeout(syncToCloud, 3000);
    return () => clearTimeout(timeout);
  }, [members, transactions, meetings, paddyPurchases, dispatches, inventoryAdjustments, societyBanks, auditNotes, settings]);

  const login = async (email: string, password: string): Promise<void> => {
    await signInWithEmail(email, password);
  };

  const signup = async (email: string, password: string): Promise<void> => {
    await signUpWithEmail(email, password);
  };

  const logout = async (): Promise<void> => {
    await signOutUser();
  };

  const resetPassword = async (email: string): Promise<void> => {
    await sendResetEmail(email);
  };

  // Phone Authentication Methods
  const setupPhoneAuth = (containerId: string): ApplicationVerifier => {
    return setupRecaptcha(containerId, false);
  };

  const loginWithPhone = async (phoneNumber: string, appVerifier: ApplicationVerifier): Promise<ConfirmationResult> => {
    const confirmationResult = await signInWithPhone(phoneNumber, appVerifier);
    return confirmationResult;
  };

  const verifyPhoneOTP = async (confirmationResult: ConfirmationResult, otp: string): Promise<void> => {
    await verifyOTP(confirmationResult, otp);
    // User will be automatically set by onAuthStateChanged listener
  };

  const clearPhoneAuth = (): void => {
    clearRecaptcha();
  };
  const addMember = (member: Member) => setMembers(prev => [...prev, member]);
  const updateMember = (updatedMember: Member) => setMembers(prev => prev.map(m => m.id === updatedMember.id ? updatedMember : m));
  const updateMembers = (updatedMembers: Member[]) => {
    const updatesMap = new Map(updatedMembers.map(m => [m.id, m]));
    setMembers(prev => prev.map(m => updatesMap.has(m.id) ? updatesMap.get(m.id)! : m));
  };
  const deleteMember = (id: string) => setMembers(prev => prev.filter(m => m.id !== id));
  const updateSettings = (newSettings: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...newSettings }));
  const updateLocalSettings = (newLocal: Partial<LocalSettings>) => setLocalSettings(prev => ({ ...prev, ...newLocal }));
  const importMembers = (newMembers: Member[]) => setMembers(prev => [...prev, ...newMembers]);

  const addTransaction = (transaction: Transaction, memberUpdates?: Partial<Member>) => {
    if (transaction.memberId) {
      const member = members.find(m => m.id === transaction.memberId);
      if (member) {
        transaction.previousLoanCalculationDate = member.lastLoanCalculationDate;
        const updatedMember = { ...member, ...memberUpdates };
        const amt = transaction.amount;
        if (transaction.type === TransactionType.CREDIT) {
          if (transaction.accountType === AccountType.SAVINGS) updatedMember.savingsBalance += amt;
          if (transaction.accountType === AccountType.SHARES) updatedMember.shareBalance += amt;
          if (transaction.accountType === AccountType.LOAN) {
            if (transaction.interestAccrued) updatedMember.loanInterestDue += transaction.interestAccrued;
            if (transaction.interestPaid) updatedMember.loanInterestDue -= transaction.interestPaid;
            if (transaction.principalPaid) updatedMember.loanPrincipal -= transaction.principalPaid;
            updatedMember.lastLoanCalculationDate = transaction.date;
          }
        } else {
          if (transaction.accountType === AccountType.SAVINGS) updatedMember.savingsBalance -= amt;
          if (transaction.accountType === AccountType.LOAN) {
            if (updatedMember.loanPrincipal <= 0) updatedMember.originalLoanDate = transaction.date;
            updatedMember.loanPrincipal += amt;
            updatedMember.lastLoanCalculationDate = transaction.date;
          }
        }
        updateMember(updatedMember);
      }
    }

    // Bank specific logic for society bank accounts
    if (transaction.accountType === 'BankTransfer' && transaction.bankId) {
      setSocietyBanks(prev => prev.map(b => {
        if (b.id === transaction.bankId) {
          return { ...b, balance: transaction.type === TransactionType.CREDIT ? b.balance + transaction.amount : b.balance - transaction.amount };
        }
        return b;
      }));
    }

    setTransactions(prev => [...prev, transaction]);
  };

  const deleteTransaction = (transactionId: string): boolean => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return false;
    if (transaction.memberId) {
      const member = members.find(m => m.id === transaction.memberId);
      if (member) {
        const updatedMember = { ...member };
        const amt = transaction.amount;
        if (transaction.type === TransactionType.CREDIT) {
          if (transaction.accountType === AccountType.SAVINGS) updatedMember.savingsBalance -= amt;
          if (transaction.accountType === AccountType.SHARES) updatedMember.shareBalance -= amt;
          if (transaction.accountType === AccountType.LOAN) {
            updatedMember.loanPrincipal += (transaction.principalPaid || 0);
            updatedMember.loanInterestDue += (transaction.interestPaid || 0);
            if (transaction.interestAccrued) updatedMember.loanInterestDue -= transaction.interestAccrued;
            if (transaction.previousLoanCalculationDate) updatedMember.lastLoanCalculationDate = transaction.previousLoanCalculationDate;
          }
        } else {
          if (transaction.accountType === AccountType.SAVINGS) updatedMember.savingsBalance += amt;
          if (transaction.accountType === AccountType.LOAN) {
            updatedMember.loanPrincipal -= amt;
            if (transaction.previousLoanCalculationDate) updatedMember.lastLoanCalculationDate = transaction.previousLoanCalculationDate;
          }
        }
        updateMember(updatedMember);
      }
    }

    if (transaction.accountType === 'BankTransfer' && transaction.bankId) {
      setSocietyBanks(prev => prev.map(b => {
        if (b.id === transaction.bankId) {
          // Revert balance
          return { ...b, balance: transaction.type === TransactionType.CREDIT ? b.balance - transaction.amount : b.balance + transaction.amount };
        }
        return b;
      }));
    }

    setTransactions(prev => prev.filter(t => t.id !== transactionId));
    return true;
  };

  const addMeeting = (meeting: Meeting) => setMeetings(prev => [meeting, ...prev]);
  const updateMeeting = (updatedMeeting: Meeting) => setMeetings(prev => prev.map(m => m.id === updatedMeeting.id ? updatedMeeting : m));
  const deleteMeeting = (id: string) => setMeetings(prev => prev.filter(m => m.id !== id));

  const addPaddyPurchase = (record: PaddyPurchaseRecord) => setPaddyPurchases(prev => [record, ...prev]);
  const updatePaddyPurchase = (updatedRecord: PaddyPurchaseRecord) => setPaddyPurchases(prev => prev.map(p => p.id === updatedRecord.id ? updatedRecord : p));
  const deletePaddyPurchase = (id: string) => setPaddyPurchases(prev => prev.filter(p => p.id !== id));

  const addDispatch = (record: DispatchRecord) => setDispatches(prev => [record, ...prev]);
  const updateDispatch = (updatedRecord: DispatchRecord) => setDispatches(prev => prev.map(p => p.id === updatedRecord.id ? updatedRecord : p));
  const deleteDispatch = (id: string) => setDispatches(prev => prev.filter(p => p.id !== id));

  const addInventoryAdjustment = (record: InventoryAdjustment) => setInventoryAdjustments(prev => [record, ...prev]);
  const updateInventoryAdjustment = (updatedRecord: InventoryAdjustment) => setInventoryAdjustments(prev => prev.map(p => p.id === updatedRecord.id ? updatedRecord : p));
  const deleteInventoryAdjustment = (id: string) => setInventoryAdjustments(prev => prev.filter(p => p.id !== id));

  const addSocietyBank = (bank: SocietyBank) => setSocietyBanks(prev => [...prev, bank]);
  const updateSocietyBank = (bank: SocietyBank) => setSocietyBanks(prev => prev.map(b => b.id === bank.id ? bank : b));
  const deleteSocietyBank = (id: string) => setSocietyBanks(prev => prev.filter(b => b.id !== id));

  const addAuditNote = (note: AuditNote) => setAuditNotes(prev => [note, ...prev]);
  const updateAuditNote = (note: AuditNote) => setAuditNotes(prev => prev.map(n => n.id === note.id ? note : n));
  const deleteAuditNote = (id: string) => setAuditNotes(prev => prev.filter(n => n.id !== id));

  const resetData = (data: any) => {
    isRestoring.current = true;
    setMembers(data.members || []);
    setTransactions(data.transactions || []);
    setMeetings(data.meetings || []);
    setDispatches(data.dispatches || []);
    setInventoryAdjustments(data.inventoryAdjustments || []);
    setSocietyBanks(data.societyBanks || []);
    setAuditNotes(data.auditNotes || []);
    setSettings(data.settings || defaultSettings);
    isRestoring.current = false;
    window.location.reload();
  };
  const getMember = (id: string) => members.find(m => m.id === id);

  return (
    <AppContext.Provider value={{
      members, transactions, meetings, paddyPurchases, dispatches, inventoryAdjustments, societyBanks, auditNotes, settings, localSettings, isAuthenticated, currentUser, isCloudSynced, isSyncing, cloudPermissionError,
      login, signup, logout, resetPassword, loginWithPhone, verifyPhoneOTP, setupPhoneAuth, clearPhoneAuth, addMember, deleteMember, addTransaction, deleteTransaction,
      addMeeting, updateMeeting, deleteMeeting,
      addPaddyPurchase, updatePaddyPurchase, deletePaddyPurchase,
      addDispatch, updateDispatch, deleteDispatch,
      addInventoryAdjustment, updateInventoryAdjustment, deleteInventoryAdjustment,
      addSocietyBank, updateSocietyBank, deleteSocietyBank,
      addAuditNote, updateAuditNote, deleteAuditNote,
      updateMember, updateMembers, updateSettings, updateLocalSettings, resetData, getMember, importMembers, syncToCloud, restoreFromCloud
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
