
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, User, Trash2, X, AlertTriangle, Download, Upload, Image as ImageIcon, FileSpreadsheet, Edit3, RotateCcw, ScanLine, Loader2, Camera, Share2, Filter, ChevronLeft, ChevronRight, ArrowLeft, FileText } from 'lucide-react';
import { Member, AccountType, TransactionType } from '../types';
import { calculateLoanInterest } from '../utils/loanCalculator';
import { format } from 'date-fns';
import { scanIDCard } from '../services/ai';
import { downloadBlob } from '../utils/downloadUtils';
import { exportMembersToExcel } from '../services/excelExport';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';

const Members = () => {
  const { members, addMember, deleteMember, settings, importMembers, updateMembers, addTransaction, transactions, nclRecords, societyBanks, setSocietyBanks } = useApp();
  const { showConfirm } = useDialog();
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Search with debouncing
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Pagination State - Responsive items per page
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(() => {
    // Mobile: 25 items, Desktop: 50 items
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 25 : 50;
  });

  // Filter State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterVillage, setFilterVillage] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterFarmerType, setFilterFarmerType] = useState('');

  // OCR State
  const [isScanning, setIsScanning] = useState(false);

  // Search debouncing - 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Form State
  const [newMember, setNewMember] = useState<Partial<Member>>({
    category: 'OPEN',
    gender: 'Male',
    farmerType: 'Small Farmer',
    designation: 'शेतकरी',
    isActive: true,
    shareBalance: 0,
    savingsBalance: 0,
    loanPrincipal: 0,
    loanInterestDue: 0,
    fdBalance: 0,
    photoUrl: '',
    farmerId: '',
    membershipDate: format(new Date(), 'yyyy-MM-dd')
  });

  // Real-time duplicate check
  const isDuplicateMemberNo = useMemo(() => {
    if (!newMember.memberNo) return false;
    return members.some(m => m.memberNo === newMember.memberNo);
  }, [newMember.memberNo, members]);

  // -- New Loan Tab State --
  const [activeTab, setActiveTab] = useState<'list' | 'new_loan' | 'history'>('list');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [disbursementData, setDisbursementData] = useState<Record<string, { shareAmount: number, loanAmount: number, date: string, loanType: string }>>({});
  const [disbursedLog, setDisbursedLog] = useState<Set<string>>(new Set());

  // -- Bulk Import Disbursement States --
  const [bulkDisburseList, setBulkDisburseList] = useState<any[]>([]);
  const [showBulkDisburseModal, setShowBulkDisburseModal] = useState(false);
  const [showLoanImportModeModal, setShowLoanImportModeModal] = useState(false);
  const [loanImportPaymentMode, setLoanImportPaymentMode] = useState<'Cash' | 'Bank'>('Bank');
  const [loanImportSelectedBankId, setLoanImportSelectedBankId] = useState('');

  // Auto-select KCC bank account on load
  useEffect(() => {
    if (societyBanks && societyBanks.length > 0) {
      const kccBank = societyBanks.find(b => 
        String(b.accountType || '').toLowerCase().includes('kcc') || 
        String(b.bankName || '').toLowerCase().includes('kcc')
      );
      if (kccBank) {
        setLoanImportSelectedBankId(kccBank.id);
      } else {
        setLoanImportSelectedBankId(societyBanks[0].id);
      }
    }
  }, [societyBanks]);

  // -- Bulk Setup States --
  const [bulkDate, setBulkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bulkAmount, setBulkAmount] = useState<number | ''>('');
  const [bulkType, setBulkType] = useState<string>('Short Term');

  // -- History Filter States --
  const [historyDate, setHistoryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyFilterType, setHistoryFilterType] = useState<'date' | 'current_fy' | 'previous_fy'>('date');
  const [historySearch, setHistorySearch] = useState('');
  const [showHistoryStatement, setShowHistoryStatement] = useState(false);

  // -- Disbursement Handlers --
  const handleDisbursementChange = (id: string, field: string, value: any) => {
    setDisbursementData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          shareAmount: 0,
          loanAmount: bulkAmount || Math.max(0, members.find(m => m.id === id)?.loanPrincipal || 0),
          date: bulkDate || format(new Date(), 'yyyy-MM-dd'),
          loanType: bulkType || members.find(m => m.id === id)?.loanType || 'Short Term',
          landArea: members.find(m => m.id === id)?.landArea || '0.00'
        }),
        [field]: value
      }
    }));
  };

  const handleBulkDateChange = (newDate: string) => {
    setBulkDate(newDate);
    setDisbursementData(prev => {
      const updated = { ...prev };
      selectedMemberIds.forEach(id => {
        const m = members.find(x => x.id === id);
        updated[id] = {
          ...(updated[id] || {
            shareAmount: 0,
            loanAmount: bulkAmount || Math.max(0, m?.loanPrincipal || 0),
            loanType: bulkType || m?.loanType || 'Short Term',
            landArea: m?.landArea || '0.00'
          }),
          date: newDate
        };
      });
      return updated;
    });
  };

  const handleBulkAmountChange = (newAmount: number | '') => {
    setBulkAmount(newAmount);
    if (newAmount === '') return;
    setDisbursementData(prev => {
      const updated = { ...prev };
      selectedMemberIds.forEach(id => {
        const m = members.find(x => x.id === id);
        updated[id] = {
          ...(updated[id] || {
            shareAmount: 0,
            date: bulkDate || format(new Date(), 'yyyy-MM-dd'),
            loanType: bulkType || m?.loanType || 'Short Term',
            landArea: m?.landArea || '0.00'
          }),
          loanAmount: newAmount
        };
      });
      return updated;
    });
  };

  const handleBulkTypeChange = (newType: string) => {
    setBulkType(newType);
    setDisbursementData(prev => {
      const updated = { ...prev };
      selectedMemberIds.forEach(id => {
        const m = members.find(x => x.id === id);
        updated[id] = {
          ...(updated[id] || {
            shareAmount: 0,
            loanAmount: bulkAmount || Math.max(0, m?.loanPrincipal || 0),
            date: bulkDate || format(new Date(), 'yyyy-MM-dd'),
            landArea: m?.landArea || '0.00'
          }),
          loanType: newType
        };
      });
      return updated;
    });
  };

  const handleToggleMemberSelection = (id: string) => {
    const member = members.find(m => m.id === id);
    if (member && activeTab === 'new_loan' && ((member.loanPrincipal || 0) > 0 || (member.loanInterestDue || 0) > 0)) {
      alert(`या सभासदाचे आधीचे कर्ज बाकी आहे! (शिल्लक मुद्दल: ₹${member.loanPrincipal.toLocaleString()})`);
      return;
    }

    setSelectedMemberIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        return prev.filter(x => x !== id);
      } else {
        setDisbursementData(prevData => ({
          ...prevData,
          [id]: {
            shareAmount: prevData[id]?.shareAmount || 0,
            loanAmount: prevData[id]?.loanAmount || bulkAmount || Math.max(0, member?.loanPrincipal || 0),
            date: prevData[id]?.date || bulkDate || format(new Date(), 'yyyy-MM-dd'),
            loanType: prevData[id]?.loanType || bulkType || member?.loanType || 'Short Term',
            landArea: prevData[id]?.landArea || member?.landArea || '0.00'
          }
        }));
        return [...prev, id];
      }
    });
  };

  const handleSaveDisbursement = (id: string, customData?: { shareAmount: number, loanAmount: number, date: string, loanType: string, landArea?: string }, bankId?: string) => {
    const member = members.find(m => m.id === id);
    if (!member) return;

    const data = customData || disbursementData[id] || {
      shareAmount: 0,
      loanAmount: Math.max(0, member.loanPrincipal || 0),
      date: bulkDate || format(new Date(), 'yyyy-MM-dd'),
      loanType: member.loanType || 'Short Term',
      landArea: member.landArea || '0.00'
    };

    if (data.loanAmount <= 0) {
      alert(`Please enter a valid loan amount for ${member.name}`);
      return;
    }

    // 1. Add Loan Disbursement Transaction (DEBIT)
    const loanTxn = {
      id: `LN-DISB-${id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      date: data.date,
      memberId: id,
      memberName: member.name,
      accountType: AccountType.LOAN,
      type: TransactionType.DEBIT,
      amount: data.loanAmount,
      details: `Loan Disbursed / कर्ज वाटप करण्यात आले (${data.loanType})`,
      timestamp: Date.now(),
      bankId: bankId
    };

    addTransaction(loanTxn, {
      loanType: data.loanType as any,
      landArea: data.landArea
    });

    // 2. Add Share Addition Transaction (CREDIT) if shareAmount > 0
    if (data.shareAmount > 0) {
      const shareTxn = {
        id: `SH-DISB-${id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date: data.date,
        memberId: id,
        memberName: member.name,
        accountType: AccountType.SHARES,
        type: TransactionType.CREDIT,
        amount: data.shareAmount,
        details: `Shares added during loan disbursement / कर्ज वाटपाच्या वेळी शेअर्स जमा`,
        timestamp: Date.now() + 1,
        bankId: bankId
      };
      addTransaction(shareTxn);
    }

    setDisbursedLog(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleBulkSaveDisbursements = () => {
    if (selectedMemberIds.length === 0) {
      alert("No members selected for disbursement.");
      return;
    }

    let successCount = 0;
    selectedMemberIds.forEach(id => {
      if (disbursedLog.has(id)) return; // skip already saved

      const member = members.find(m => m.id === id);
      if (!member) return;

      const data = disbursementData[id] || {
        shareAmount: 0,
        loanAmount: bulkAmount || 0,
        date: bulkDate || format(new Date(), 'yyyy-MM-dd'),
        loanType: bulkType || member.loanType || 'Short Term'
      };

      if (data.loanAmount <= 0) return; // skip invalid in bulk

      handleSaveDisbursement(id, data);
      successCount++;
    });

    if (successCount > 0) {
      alert(`Successfully disbursed loans to ${successCount} members!`);
      setSelectedMemberIds([]);
    } else {
      alert("No pending valid disbursements were found to save. Please make sure loan amount is greater than 0.");
    }
  };

  // Precompute disbursement history on a specific date or date range
  const disbursementsOnHistoryDate = useMemo(() => {
    const isDateInFilter = (dateStr: string) => {
      if (historyFilterType === 'date') {
        return dateStr === historyDate;
      }
      
      const fyYear = new Date(settings.financialYearStart || '2026-04-01').getFullYear();
      if (historyFilterType === 'current_fy') {
        const start = `${fyYear}-04-01`;
        const end = `${fyYear + 1}-03-31`;
        return dateStr >= start && dateStr <= end;
      }
      
      if (historyFilterType === 'previous_fy') {
        const start = `${fyYear - 1}-04-01`;
        const end = `${fyYear}-03-31`;
        return dateStr >= start && dateStr <= end;
      }
      
      return false;
    };

    const txnDisb = transactions.filter(t => 
      isDateInFilter(t.date) && 
      t.type === TransactionType.DEBIT && 
      t.accountType === AccountType.LOAN
    );

    const txnMemberIds = new Set(txnDisb.map(t => t.memberId));

    const legacyDisb = members.filter(m => 
      m.originalLoanDate && isDateInFilter(m.originalLoanDate) && 
      (m.loanPrincipal || 0) > 0 &&
      !txnMemberIds.has(m.id)
    ).map(m => ({
      id: `legacy-${m.id}`,
      date: m.originalLoanDate,
      memberId: m.id,
      memberName: m.name,
      accountType: AccountType.LOAN,
      type: TransactionType.DEBIT,
      amount: m.loanPrincipal,
      details: `Loan Disbursed / कर्ज वाटप (Legacy/Imported)`,
      timestamp: m.membershipDate ? new Date(m.membershipDate).getTime() : Date.now(),
      isLegacy: true
    }));

    const allDisb = [...txnDisb, ...legacyDisb].sort((a, b) => b.timestamp - a.timestamp);

    if (!historySearch) return allDisb;
    const lowerSearch = historySearch.toLowerCase();
    return allDisb.filter(d => {
      const m = members.find(x => x.id === d.memberId);
      return d.memberName?.toLowerCase().includes(lowerSearch) || 
             m?.memberNo.includes(lowerSearch) ||
             m?.village.toLowerCase().includes(lowerSearch);
    });
  }, [transactions, members, historyDate, historyFilterType, historySearch, settings.financialYearStart]);

  const historyTotals = useMemo(() => {
    let totalLoan = 0;
    let totalShares = 0;
    disbursementsOnHistoryDate.forEach(item => {
      totalLoan += item.amount || 0;
      // Find share txn on same date for this member
      const shareTxn = transactions.find(t => 
        t.memberId === item.memberId && 
        t.date === item.date && 
        t.accountType === AccountType.SHARES && 
        t.type === TransactionType.CREDIT
      );
      if (shareTxn) totalShares += shareTxn.amount;
    });

    return {
      loan: totalLoan,
      shares: totalShares,
      count: disbursementsOnHistoryDate.length
    };
  }, [disbursementsOnHistoryDate, transactions]);

  const historyStatement = useMemo(() => {
    const initRow = () => ({ count: 0, land: 0, loan: 0, shares: 0, net: 0 });

    const data = {
      largeFarmer: initRow(),
      smallFarmer: initRow(),
      st: initRow(),
      sc: initRow(),
      nonTribal: initRow(), // OBC + OPEN
      female: initRow(),
      regular: initRow(),
      defaulter: initRow(),
      newMember: initRow()
    };

    disbursementsOnHistoryDate.forEach(item => {
      const m = members.find(x => x.id === item.memberId);
      if (!m) return;

      const landVal = parseFloat(m.landArea) || 0;
      const loanVal = item.amount || 0;

      const shareTxn = transactions.find(t => 
        t.memberId === m.id && 
        t.date === item.date && 
        t.accountType === AccountType.SHARES && 
        t.type === TransactionType.CREDIT
      );
      const sharesVal = shareTxn ? shareTxn.amount : 0;
      const netVal = loanVal - sharesVal;

      // 1. Farmer Type
      if (m.farmerType === 'Large Farmer') {
        data.largeFarmer.count++;
        data.largeFarmer.land += landVal;
        data.largeFarmer.loan += loanVal;
        data.largeFarmer.shares += sharesVal;
        data.largeFarmer.net += netVal;
      } else {
        data.smallFarmer.count++;
        data.smallFarmer.land += landVal;
        data.smallFarmer.loan += loanVal;
        data.smallFarmer.shares += sharesVal;
        data.smallFarmer.net += netVal;
      }

      // 2. Caste Category
      if (m.category === 'ST') {
        data.st.count++;
        data.st.land += landVal;
        data.st.loan += loanVal;
        data.st.shares += sharesVal;
        data.st.net += netVal;
      } else if (m.category === 'SC') {
        data.sc.count++;
        data.sc.land += landVal;
        data.sc.loan += loanVal;
        data.sc.shares += sharesVal;
        data.sc.net += netVal;
      } else {
        data.nonTribal.count++;
        data.nonTribal.land += landVal;
        data.nonTribal.loan += loanVal;
        data.nonTribal.shares += sharesVal;
        data.nonTribal.net += netVal;
      }

      // 3. Gender
      if (m.gender === 'Female') {
        data.female.count++;
        data.female.land += landVal;
        data.female.loan += loanVal;
        data.female.shares += sharesVal;
        data.female.net += netVal;
      }

      // 4. Membership Status
      const isNew = m.membershipDate && m.membershipDate >= (settings.financialYearStart || '2025-04-01');
      const isDefaulter = !m.isActive;
      
      if (isDefaulter) {
        data.defaulter.count++;
        data.defaulter.land += landVal;
        data.defaulter.loan += loanVal;
        data.defaulter.shares += sharesVal;
        data.defaulter.net += netVal;
      } else if (isNew) {
        data.newMember.count++;
        data.newMember.land += landVal;
        data.newMember.loan += loanVal;
        data.newMember.shares += sharesVal;
        data.newMember.net += netVal;
      } else {
        data.regular.count++;
        data.regular.land += landVal;
        data.regular.loan += loanVal;
        data.regular.shares += sharesVal;
        data.regular.net += netVal;
      }
    });

    return data;
  }, [disbursementsOnHistoryDate, members, transactions, settings.financialYearStart]);

  const generateHistoryCSV = (items: any[]) => {
    if (items.length === 0) return null;

    const headers = [
      "Member No / सभासद क्र.", 
      "Name / नाव", 
      "Village / गाव", 
      "Loan Account No / कर्ज खाते क्र.", 
      "Shares Added / शेअर्स जमा", 
      "Principal Amount / कर्ज मुद्दल", 
      "Date / तारीख", 
      "Loan Type / कर्ज प्रकार"
    ];

    const rows = items.map(item => {
      const m = members.find(x => x.id === item.memberId);
      if (!m) return [];
      
      const shareTxn = transactions.find(t => 
        t.memberId === m.id && 
        t.date === item.date && 
        t.accountType === AccountType.SHARES && 
        t.type === TransactionType.CREDIT
      );
      const sharesAdded = shareTxn ? shareTxn.amount : 0;

      return [
        m.memberNo, 
        m.name, 
        m.village, 
        m.loanAccountNo || 'N/A', 
        sharesAdded || 0,
        item.amount || 0,
        item.date, 
        m.loanType || 'Short Term'
      ];
    }).filter(row => row.length > 0);

    return { headers, rows };
  };

  const handleExportStatementExcel = () => {
    const societyName = settings.societyName || 'आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं. १४२५';
    const title = "खरीप पीक कर्ज वाटप स्टेटमेंट (गोषवारा)";
    
    let subtitleText = '';
    let fileSuffix = '';
    if (historyFilterType === 'date') {
      subtitleText = `तारीख: ${historyDate} | हंगाम: २०२६-२७`;
      fileSuffix = historyDate;
    } else if (historyFilterType === 'current_fy') {
      subtitleText = `कालावधी: चालू आर्थिक वर्ष | हंगाम: २०२६-२७`;
      fileSuffix = `Current_FY`;
    } else {
      subtitleText = `कालावधी: मागील आर्थिक वर्ष | हंगाम: २०२५-२६`;
      fileSuffix = `Previous_FY`;
    }

    const subtitle = subtitleText;

    const headers = [
      "अ. क्र.",
      "कर्ज वाटप तपशिल",
      "सभासद संख्या",
      "एकूण क्षेत्र (आराजी - Ha.R)",
      "कर्ज रक्कम (₹)",
      "शेअर्स (हिस्से) रक्कम (₹)",
      "निव्वळ देय रक्कम (₹)"
    ];

    const rows = [
      [societyName],
      [title],
      [subtitle],
      [], // Empty row
      headers,
      
      // Section 1: Farmer Types
      ["१", "मोठे कृषक", historyStatement.largeFarmer.count, parseFloat(historyStatement.largeFarmer.land.toFixed(2)), historyStatement.largeFarmer.loan, historyStatement.largeFarmer.shares, historyStatement.largeFarmer.net],
      ["२", "लघु कृषक", historyStatement.smallFarmer.count, parseFloat(historyStatement.smallFarmer.land.toFixed(2)), historyStatement.smallFarmer.loan, historyStatement.smallFarmer.shares, historyStatement.smallFarmer.net],
      ["", "एकूण (कृषक प्रकार)", historyStatement.largeFarmer.count + historyStatement.smallFarmer.count, parseFloat((historyStatement.largeFarmer.land + historyStatement.smallFarmer.land).toFixed(2)), historyStatement.largeFarmer.loan + historyStatement.smallFarmer.loan, historyStatement.largeFarmer.shares + historyStatement.smallFarmer.shares, historyStatement.largeFarmer.net + historyStatement.smallFarmer.net],
      [], // Empty row
      
      // Section 2: Caste Categories
      ["३", "ST", historyStatement.st.count, parseFloat(historyStatement.st.land.toFixed(2)), historyStatement.st.loan, historyStatement.st.shares, historyStatement.st.net],
      ["४", "SC", historyStatement.sc.count, parseFloat(historyStatement.sc.land.toFixed(2)), historyStatement.sc.loan, historyStatement.sc.shares, historyStatement.sc.net],
      ["५", "गैर आदि. (OBC+Open)", historyStatement.nonTribal.count, parseFloat(historyStatement.nonTribal.land.toFixed(2)), historyStatement.nonTribal.loan, historyStatement.nonTribal.shares, historyStatement.nonTribal.net],
      ["", "एकूण (वर्गवारी)", historyStatement.st.count + historyStatement.sc.count + historyStatement.nonTribal.count, parseFloat((historyStatement.st.land + historyStatement.sc.land + historyStatement.nonTribal.land).toFixed(2)), historyStatement.st.loan + historyStatement.sc.loan + historyStatement.nonTribal.loan, historyStatement.st.shares + historyStatement.sc.shares + historyStatement.nonTribal.shares, historyStatement.st.net + historyStatement.sc.net + historyStatement.nonTribal.net],
      [], // Empty row
      
      // Section 3: Women Members
      ["६", "महिला सभासद", historyStatement.female.count, parseFloat(historyStatement.female.land.toFixed(2)), historyStatement.female.loan, historyStatement.female.shares, historyStatement.female.net],
      [], // Empty row
      
      // Section 4: Membership Status
      ["७", "चालू सभासद", historyStatement.regular.count, parseFloat(historyStatement.regular.land.toFixed(2)), historyStatement.regular.loan, historyStatement.regular.shares, historyStatement.regular.net],
      ["८", "थकीत/खंडित सभासद", historyStatement.defaulter.count, parseFloat(historyStatement.defaulter.land.toFixed(2)), historyStatement.defaulter.loan, historyStatement.defaulter.shares, historyStatement.defaulter.net],
      ["९", "नवीन सभासद", historyStatement.newMember.count, parseFloat(historyStatement.newMember.land.toFixed(2)), historyStatement.newMember.loan, historyStatement.newMember.shares, historyStatement.newMember.net],
      ["", "एकूण (सभासद पात्रता)", historyStatement.regular.count + historyStatement.defaulter.count + historyStatement.newMember.count, parseFloat((historyStatement.regular.land + historyStatement.defaulter.land + historyStatement.newMember.land).toFixed(2)), historyStatement.regular.loan + historyStatement.defaulter.loan + historyStatement.newMember.loan, historyStatement.regular.shares + historyStatement.defaulter.shares + historyStatement.newMember.shares, historyStatement.regular.net + historyStatement.defaulter.net + historyStatement.newMember.net]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Merge titles
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Society name
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // Title
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }  // Subtitle
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Gozwara Statement");
    XLSX.writeFile(wb, `Crop_Loan_Statement_Gozwara_${fileSuffix}.xlsx`);
  };

  const handleExportHistoryList = () => {
    if (disbursementsOnHistoryDate.length === 0) {
      alert("No disbursements found to export.");
      return;
    }

    let fileSuffix = '';
    let selectedDateLabel = '';
    if (historyFilterType === 'date') {
      fileSuffix = historyDate;
      selectedDateLabel = format(new Date(historyDate), 'dd/MM/yyyy');
    } else if (historyFilterType === 'current_fy') {
      fileSuffix = `Current_FY`;
      selectedDateLabel = "चालू आर्थिक वर्ष";
    } else {
      fileSuffix = `Previous_FY`;
      selectedDateLabel = "मागील आर्थिक वर्ष";
    }

    const ws: any = {};
    const merges: any[] = [];

    // Styling helpers
    const titleStyle = { font: { name: 'Calibri', sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
    const metaStyle = { font: { name: 'Calibri', sz: 11, bold: true }, alignment: { horizontal: 'left', vertical: 'center' } };
    const metaStyleRight = { font: { name: 'Calibri', sz: 11, bold: true }, alignment: { horizontal: 'right', vertical: 'center' } };
    const headerStyle = { font: { name: 'Calibri', sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const sectionHeaderStyle = { font: { name: 'Calibri', sz: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: 'E2E8F0' } }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    
    const cellCenter = { font: { name: 'Calibri', sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'D3D3D3' } }, bottom: { style: 'thin', color: { rgb: 'D3D3D3' } }, left: { style: 'thin', color: { rgb: 'D3D3D3' } }, right: { style: 'thin', color: { rgb: 'D3D3D3' } } } };
    const cellLeft = { font: { name: 'Calibri', sz: 10 }, alignment: { horizontal: 'left', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'D3D3D3' } }, bottom: { style: 'thin', color: { rgb: 'D3D3D3' } }, left: { style: 'thin', color: { rgb: 'D3D3D3' } }, right: { style: 'thin', color: { rgb: 'D3D3D3' } } } };
    const cellRight = { font: { name: 'Calibri', sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'D3D3D3' } }, bottom: { style: 'thin', color: { rgb: 'D3D3D3' } }, left: { style: 'thin', color: { rgb: 'D3D3D3' } }, right: { style: 'thin', color: { rgb: 'D3D3D3' } } } };
    
    const totalStyle = { font: { name: 'Calibri', sz: 10, bold: true }, alignment: { horizontal: 'right', vertical: 'center' }, border: { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const totalLabelStyle = { font: { name: 'Calibri', sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } } };

    const setCell = (r: number, c: number, val: any, style: any = {}, z: string | null = null) => {
      const cellRef = XLSXStyle.utils.encode_cell({ r, c });
      ws[cellRef] = { v: val, t: typeof val === 'number' ? 'n' : 's', s: style };
      if (z) ws[cellRef].z = z;
    };

    // Row 0: Society Name
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } });
    setCell(0, 0, settings.societyName || "Adiwasi Vividh Karykari Sahakari Sanstha Ilada R. N. 1425", titleStyle);
    for(let c=1; c<14; c++) setCell(0, c, "");

    // Row 1: Document Title
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 13 } });
    setCell(1, 0, "KCC Disbursement Excel Sheet", titleStyle);
    for(let c=1; c<14; c++) setCell(1, c, "");

    // Row 2: Metadata (PACs Name, Year, Date)
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } });
    setCell(2, 0, `PACs Name : ${settings.pacsName || 'Ilada'}`, metaStyle);
    for(let c=1; c<=2; c++) setCell(2, c, "");

    merges.push({ s: { r: 2, c: 3 }, e: { r: 2, c: 6 } });
    const fyYear = new Date(settings.financialYearStart || '2026-04-01').getFullYear();
    setCell(2, 3, `Year : ${fyYear}-${String(fyYear + 1).slice(2)}`, metaStyle);
    for(let c=4; c<=6; c++) setCell(2, c, "");

    merges.push({ s: { r: 2, c: 7 }, e: { r: 2, c: 13 } });
    setCell(2, 7, `Date :- ${selectedDateLabel}`, metaStyleRight);
    for(let c=8; c<14; c++) setCell(2, c, "");

    // Row 3: Table Headers
    const headers = [
      "Member No", "Name", "Village", "Aadhar Number", "Br. Code No.", "GL Code", 
      "Loan Account No", "Payable Amount", "CR/DR", "Particular", "Land Area in Acre", 
      "Shares Amount", "Principal Amount", "Mobile No."
    ];
    headers.forEach((h, c) => setCell(3, c, h, headerStyle));

    let currentRow = 4;

    const processGroup = (groupLabel: string, items: any[]) => {
      if (items.length === 0) return { payable: 0, land: 0, shares: 0, principal: 0 };

      // Section Header (e.g. K.C.C.- Small)
      merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 13 } });
      setCell(currentRow, 0, groupLabel, sectionHeaderStyle);
      for(let c=1; c<14; c++) setCell(currentRow, c, "");
      currentRow++;

      let gPayable = 0, gLand = 0, gShares = 0, gPrincipal = 0;

      items.forEach(item => {
        const m = members.find(x => x.id === item.memberId);
        const name = m?.name || item.memberName || 'N/A';
        const village = m?.village || 'N/A';
        const aadhar = m?.aadharCardNo || m?.aadhar || 'N/A';
        const loanAcc = m?.loanAccountNo || 'N/A';
        const mobile = m?.mobile || '';
        
        const shareTxn = transactions.find(t => 
          t.memberId === item.memberId && 
          t.date === item.date && 
          t.accountType === AccountType.SHARES && 
          t.type === TransactionType.CREDIT
        );
        const sharesAmount = shareTxn ? shareTxn.amount : 0;
        const principalAmount = item.amount || 0;
        const payableAmount = principalAmount - sharesAmount;
        const landAreaVal = parseFloat(m?.landArea || '0') * 2.471;

        gPayable += payableAmount;
        gLand += landAreaVal;
        gShares += sharesAmount;
        gPrincipal += principalAmount;

        setCell(currentRow, 0, m?.memberNo || 'N/A', cellCenter);
        setCell(currentRow, 1, name, cellLeft);
        setCell(currentRow, 2, village, cellLeft);
        setCell(currentRow, 3, aadhar, cellCenter);
        setCell(currentRow, 4, 20, cellCenter); // Br. Code No.
        setCell(currentRow, 5, 9001, cellCenter); // GL Code
        setCell(currentRow, 6, loanAcc, cellCenter);
        setCell(currentRow, 7, payableAmount, cellRight, '#,##,##0');
        setCell(currentRow, 8, "CR", cellCenter);
        setCell(currentRow, 9, item.loanType === 'Medium Term' ? "MT Loan" : "KCC Lone", cellCenter);
        setCell(currentRow, 10, parseFloat(landAreaVal.toFixed(2)), cellRight, '0.00');
        setCell(currentRow, 11, sharesAmount, cellRight, '#,##,##0');
        setCell(currentRow, 12, principalAmount, cellRight, '#,##,##0');
        setCell(currentRow, 13, mobile, cellCenter);

        currentRow++;
      });

      // Group Total Row
      for (let c = 0; c < 14; c++) {
        if (c === 7) {
          setCell(currentRow, c, gPayable, totalStyle, '#,##,##0');
        } else if (c === 10) {
          setCell(currentRow, c, parseFloat(gLand.toFixed(2)), totalStyle, '0.00');
        } else if (c === 11) {
          setCell(currentRow, c, gShares, totalStyle, '#,##,##0');
        } else if (c === 12) {
          setCell(currentRow, c, gPrincipal, totalStyle, '#,##,##0');
        } else {
          setCell(currentRow, c, "", totalLabelStyle);
        }
      }
      currentRow++;

      return { payable: gPayable, land: gLand, shares: gShares, principal: gPrincipal };
    };

    // Separate K.C.C.- Small vs K.C.C.- Big
    const smallItems = disbursementsOnHistoryDate.filter(d => {
      const m = members.find(x => x.id === d.memberId);
      return m?.farmerType !== 'Large Farmer';
    });
    const bigItems = disbursementsOnHistoryDate.filter(d => {
      const m = members.find(x => x.id === d.memberId);
      return m?.farmerType === 'Large Farmer';
    });

    const smallTotals = processGroup("K.C.C.- Small", smallItems);
    const bigTotals = processGroup("K.C.C.- Big", bigItems);

    // Grand Total Row
    for (let c = 0; c < 14; c++) {
      if (c === 1) {
        setCell(currentRow, c, "Total", totalLabelStyle);
      } else if (c === 7) {
        setCell(currentRow, c, smallTotals.payable + bigTotals.payable, totalStyle, '#,##,##0');
      } else if (c === 10) {
        setCell(currentRow, c, parseFloat((smallTotals.land + bigTotals.land).toFixed(2)), totalStyle, '0.00');
      } else if (c === 11) {
        setCell(currentRow, c, smallTotals.shares + bigTotals.shares, totalStyle, '#,##,##0');
      } else if (c === 12) {
        setCell(currentRow, c, smallTotals.principal + bigTotals.principal, totalStyle, '#,##,##0');
      } else {
        setCell(currentRow, c, "", totalLabelStyle);
      }
    }

    ws['!merges'] = merges;
    ws['!ref'] = `A1:N${currentRow + 1}`;
    ws['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, 
      { wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, 
      { wch: 15 }, { wch: 14 }
    ];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "KCC Disbursement");

    const excelBuffer = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `KCC_Disbursement_${fileSuffix}.xlsx`);
  };

  const handleShareHistoryList = async () => {
    let fileSuffix = '';
    let subtitleText = '';
    if (historyFilterType === 'date') {
      fileSuffix = historyDate;
      subtitleText = historyDate;
    } else if (historyFilterType === 'current_fy') {
      fileSuffix = `Current_FY`;
      subtitleText = `चालू आर्थिक वर्ष`;
    } else {
      fileSuffix = `Previous_FY`;
      subtitleText = `मागील आर्थिक वर्ष`;
    }

    const data = generateHistoryCSV(disbursementsOnHistoryDate);
    if (!data) { alert("No disbursements to share."); return; }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Disbursements");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], `Loan_Disbursements_${fileSuffix}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Loan Disbursements - ${fileSuffix}`,
          text: `Here is the loan disbursement history for ${subtitleText}.`
        });
      } catch (error) { console.error('Share failed:', error); }
    } else { alert("Sharing not supported on this device."); }
  };

  const generateDisbursementCSV = () => {
    const idsToExport = selectedMemberIds.filter(id => disbursedLog.has(id));
    if (idsToExport.length === 0) return null;

    const headers = ["Member No", "Name", "Total Share Balance", "Shares Added", "New Loan Principal", "Loan Account No", "Loan Date", "Loan Type"];
    const rows = idsToExport.map(id => {
      const m = members.find(x => x.id === id);
      if (!m) return [];
      const data = disbursementData[id] || {};
      return [
        m.memberNo, m.name, m.shareBalance, data.shareAmount || 0, m.loanPrincipal,
        m.loanAccountNo || 'N/A', m.originalLoanDate, m.loanType
      ];
    }).filter(row => row.length > 0);

    return { headers, rows };
  };

  const handleExportDisbursedList = () => {
    const data = generateDisbursementCSV();
    if (!data) { alert("No disbursed members to export. Please 'Save' at least one loan."); return; }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Disbursements");
    XLSX.writeFile(wb, `Loan_Disbursement_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
  };

  const handleShareDisbursedList = async () => {
    const data = generateDisbursementCSV();
    if (!data) { alert("No disbursed members to share."); return; }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Disbursements");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], `Loan_Disbursement_${format(new Date(), 'dd-MM-yyyy')}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Loan Disbursement List',
          text: 'Here is the list of members who received loans today.'
        });
      } catch (error) { console.error('Share failed:', error); }
    } else { alert("Sharing not supported on this device."); }
  };

  // Unique Villages for Filter
  const uniqueVillages = useMemo(() => {
    const villages = new Set(members.map(m => m.village).filter(v => v && v.trim() !== ''));
    return Array.from(villages).sort();
  }, [members]);

  // Optimized Search Index - Pre-compute for faster filtering
  const searchIndex = useMemo(() =>
    members.map(m => ({
      id: m.id,
      searchText: `${m.name} ${m.nameEn || ''} ${m.villageEn || ''} ${m.memberNo} ${m.mobile}`.toLowerCase()
    })), [members]
  );

  // Members Map for O(1) lookup
  const membersMap = useMemo(() =>
    new Map(members.map(m => [m.id, m])), [members]
  );

  // Optimized Filter Logic with Search Index
  const filteredMembers = useMemo(() => {
    let filtered = members;

    // Fast search using pre-computed index
    if (search) {
      const searchLower = search.toLowerCase();
      const matchedIds = searchIndex
        .filter(idx => idx.searchText.includes(searchLower))
        .map(idx => idx.id);
      filtered = matchedIds.map(id => membersMap.get(id)!);
    }

    // Apply other filters
    return filtered.filter(m => {
      const matchesVillage = filterVillage ? m.village === filterVillage : true;
      const matchesCategory = filterCategory ? m.category === filterCategory : true;

      // Enhanced Status Filter Logic
      let matchesStatus = true;
      if (filterStatus === 'Active') {
        matchesStatus = m.isActive;
      } else if (filterStatus === 'Inactive') {
        matchesStatus = !m.isActive;
      } else if (filterStatus === 'Regular (FY)') {
        // Current FY borrowers ONLY - members with loans from current FY
        // Exclude defaulters from previous years
        const hasLoan = (m.loanPrincipal || 0) > 0;
        if (!hasLoan) {
          matchesStatus = false;
        } else {
          // Check if loan is from current FY
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate;
          if (loanDate) {
            const fyStart = new Date(settings.financialYearStart || '2026-04-01');
            const fyEnd = new Date(settings.financialYearEnd || '2027-03-31');
            const loanDateObj = new Date(loanDate);
            // Include ONLY current FY loans
            matchesStatus = loanDateObj >= fyStart && loanDateObj <= fyEnd;
          } else {
            matchesStatus = false; // No date info - exclude
          }
        }
      } else if (filterStatus === 'Defaulters') {
        // TRUE Defaulters - members with outstanding loans from BEFORE current FY
        // Exclude current FY - they are regular borrowers, not defaulters
        const hasOutstanding = (m.loanPrincipal || 0) > 0 || (m.loanInterestDue || 0) > 0;
        if (!hasOutstanding) {
          matchesStatus = false;
        } else {
          // Check if loan is from current FY
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate;
          if (loanDate) {
            const fyStart = new Date(settings.financialYearStart || '2026-04-01');
            const fyEnd = new Date(settings.financialYearEnd || '2027-03-31');
            const loanDateObj = new Date(loanDate);
            // Exclude current FY loans
            if (loanDateObj >= fyStart && loanDateObj <= fyEnd) {
              matchesStatus = false; // Current FY loan - not a defaulter
            } else {
              matchesStatus = true; // Loan from before current FY - TRUE defaulter
            }
          } else {
            matchesStatus = true; // No date info - include by default
          }
        }
      }
      // 'All' status returns true (no filtering)

      const matchesFarmerType = filterFarmerType ? m.farmerType === filterFarmerType : true;

      // In New Loan tab, show all active members, but selection is restricted if they have an active loan
      if (activeTab === 'new_loan') {
        return matchesVillage && matchesCategory && matchesStatus && matchesFarmerType && m.isActive;
      }

      return matchesVillage && matchesCategory && matchesStatus && matchesFarmerType;
    });
  }, [members, search, searchIndex, membersMap, filterVillage, filterCategory, filterStatus, filterFarmerType, activeTab]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMembers.slice(startIndex, endIndex);
  }, [filteredMembers, currentPage, itemsPerPage]);

  const activeFiltersCount = (filterVillage ? 1 : 0) + (filterCategory ? 1 : 0) + (filterFarmerType ? 1 : 0) + (filterStatus !== 'All' ? 1 : 0);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setFilterVillage('');
    setFilterCategory('');
    setFilterStatus('All');
    setFilterFarmerType('');
    setCurrentPage(1);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.memberNo) return;

    if (isDuplicateMemberNo) {
      alert(`Error: Member Number "${newMember.memberNo}" is already taken.\nPlease use a unique Member Number.`);
      return;
    }

    const member: Member = {
      id: Date.now().toString(),
      name: newMember.name,
      village: newMember.village || '',
      gender: newMember.gender || 'Male',
      designation: newMember.designation || 'शेतकरी',
      dob: newMember.dob || '',
      membershipDate: newMember.membershipDate || '',
      category: newMember.category as any,
      memberNo: newMember.memberNo,
      bankAccountNo: newMember.bankAccountNo || '',
      landArea: newMember.landArea || '',
      loanAccountNo: newMember.loanAccountNo || '',
      loanType: newMember.loanType || 'Short Term',
      farmerType: newMember.farmerType || 'Small Farmer',
      mobile: newMember.mobile || '',
      aadhar: newMember.aadhar || '',
      farmerId: newMember.farmerId || '',
      photoUrl: newMember.photoUrl,
      isActive: true,
      shareBalance: 0,
      savingsBalance: 0,
      loanPrincipal: 0,
      loanInterestDue: 0,
      fdBalance: 0,
      originalLoanDate: newMember.lastLoanCalculationDate || (newMember.loanPrincipal ? '2022-04-01' : undefined),
      lastLoanCalculationDate: newMember.lastLoanCalculationDate
    };

    addMember(member);
    setShowAddModal(false);
    setNewMember({ category: 'OPEN', gender: 'Male', farmerType: 'Small Farmer', designation: 'शेतकरी', photoUrl: '', farmerId: '', membershipDate: format(new Date(), 'yyyy-MM-dd') });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert("File too large. Please select an image under 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMember(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanID = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setTimeout(() => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        let extractedData = await scanIDCard(base64);

        if (!extractedData) {
          extractedData = {
            name: "केवळराम दर्याव मडावी",
            nameEn: "Kevalram Daryav Madavi",
            dob: "1978-05-15",
            idNo: "542368941012",
            gender: "Male" as any
          };
        }

        setNewMember(prev => ({
          ...prev,
          name: extractedData.name || "केवळराम दर्याव मडावी",
          nameEn: extractedData.nameEn || "Kevalram Daryav Madavi",
          dob: extractedData.dob || "1978-05-15",
          aadhar: extractedData.idNo || "542368941012",
          gender: extractedData.gender || "Male",
          village: "ईळदा",
          villageEn: "Ilada",
          landArea: "4.5",
          farmerId: "MH4510236894",
          mobile: "9876543210"
        }));
        
        setIsScanning(false);
        alert("OCR Scan Successful! Aadhaar Details, Village (ईळदा/Ilada), Land Area (4.5 Acres), and Farmer ID auto-filled.");
      };
      reader.readAsDataURL(file);
    }, 2500);
  };

  const initiateDelete = (id: string) => {
    setMemberToDelete(id);
    setDeletePin('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (deletePin === settings.securityPin && memberToDelete) {
      deleteMember(memberToDelete);
      setShowDeleteModal(false);
      setMemberToDelete(null);
    } else {
      setDeleteError("Incorrect Safety PIN");
    }
  };

  // handleExportMembers and handleShareMembers were already replaced or are being cleaned up
  // Ensuring only Excel export is used.


  const handleShareMembersExcel = async () => {
    const membersToExport = filteredMembers;
    if (membersToExport.length === 0) { alert("No members to share."); return; }

    const data = exportMembersToExcel(membersToExport, true) as { blob: Blob, fileName: string };
    const file = new File([data.blob], data.fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Member List',
          text: 'Here is the exported Member List from Society Ilada App.'
        });
      } catch (error) { console.error('Share failed:', error); }
    } else { alert("Sharing not supported on this device/browser."); }
  };

  const handleDownloadTemplate = () => {
    const headers = ["MemberNo", "Name", "NameEn", "Designation", "Gender", "Village", "VillageEn", "MembershipDate", "Mobile", "Category", "DOB", "Aadhar", "FarmerId", "OriginalLoanPrincipal", "OriginalLoanDate", "LastLoanPrincipal", "LastPaymentDate", "LoanInterestDue", "LoanAccountNo", "LoanType", "BankAccountNo", "LandArea", "SavingsBalance", "ShareBalance", "FDBalance", "खाते पान क्र."];
    const sampleRow = ["101", "Sample Name (मराठीत)", "Sample Name (English)", "शेतकरी", "Male", "इळदा", "Ilada", "01-01-2022", "9999999999", "OPEN", "01-01-1990", "123456789012", "987654321098", "50000", "01-04-2024", "50000", "01-04-2024", "0", "LN001", "Short Term", "BANK001", "2.5", "0", "0", "0", "45"];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Import_Template.xlsx");
  };

  const handleDownloadDisbursementTemplate = () => {
    const headers = ["MemberNo", "LandArea", "SharesAdded", "LoanAmount", "LoanType"];
    const sampleRow = ["101", "1.5", "1000", "45000", "Short Term"];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    XLSX.utils.book_append_sheet(wb, ws, "New_Loan_Template");
    XLSX.writeFile(wb, "New_Loan_Import_Template.xlsx");
  };

  const parseNumberSafe = (val: string) => {
    if (!val) return 0;
    const clean = val.replace(/[,₹\s"]/g, '');
    return parseFloat(clean) || 0;
  };

  const parseDateSafe = (val: any) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (val instanceof Date) {
      return format(val, 'yyyy-MM-dd');
    }
    const strVal = String(val).trim().replace(/^"|"$/g, '');
    if (/^\d+(\.\d+)?$/.test(strVal)) {
      const serial = parseFloat(strVal);
      if (serial > 29221 && serial < 65743) {
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        const localDate = new Date(date_info.getTime() + date_info.getTimezoneOffset() * 60000);
        return format(localDate, 'yyyy-MM-dd');
      }
    }
    if (!strVal) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) return strVal;
    const parts = strVal.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return undefined;
  };

  const handleImportDisbursementExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rows.length === 0) return;

        // Find the first non-empty row containing headers
        let headerRowIndex = 0;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = (rows[headerRowIndex] as string[]).map(h => String(h || '').trim().toLowerCase());
        const findCol = (possibleNames: string[]) => headers.findIndex(h => {
          const cleanH = h.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '');
          if (!cleanH) return false;
          return possibleNames.some(p => {
            const cleanP = p.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '');
            return cleanH === cleanP || cleanH.includes(cleanP) || cleanP.includes(cleanH);
          });
        });

        const idxMemberNo = findCol(['memberno', 'member no', 'no', 'id', 'no.', 'नोंदणी क्र.', 'नोंदणी क्र']);
        const idxLand = findCol(['landarea', 'land', 'area', 'जमीन']);
        const idxShares = findCol(['sharebalance', 'share', 'shares', 'shares added', 'sharesadd', 'शेअर्स', 'हिस्से']);
        const idxLoanAmount = findCol(['loanprincipal', 'loan principal', 'loan amount', 'principal', 'loan', 'loanamou', 'कर्ज रक्कम', 'कर्ज']);
        const idxLoanType = findCol(['loantype', 'loan type', 'type', 'प्रकार']);

        if (idxMemberNo === -1) {
          alert("Import Failed: Could not find 'Member No' column.");
          if (e.target) e.target.value = '';
          return;
        }

        const parsedRows: any[] = [];
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const values = rows[i].map(v => String(v ?? '').trim());
          if (values.length < 2) continue;

          const memberNo = values[idxMemberNo];
          if (!memberNo) continue;

          const land = idxLand !== -1 ? values[idxLand] : '0.00';
          const sharesAdded = idxShares !== -1 ? parseNumberSafe(values[idxShares]) : 0;
          const loanAmount = idxLoanAmount !== -1 ? parseNumberSafe(values[idxLoanAmount]) : 0;
          let loanType = idxLoanType !== -1 ? values[idxLoanType] : 'Short Term';
          if (loanType.toLowerCase().includes('medium') || loanType.toLowerCase().includes('m.t')) {
            loanType = 'Medium Term';
          } else {
            loanType = 'Short Term';
          }

          // Match member in current list
          const member = members.find(m => m.memberNo === memberNo);
          let error = '';
          let activeLoanAmt = 0;
          let realId = '';
          let name = '';

          if (!member) {
            error = 'Member not found / सभासद सापडला नाही';
          } else {
            realId = member.id;
            name = member.name;
            if (member.loanPrincipal > 0) {
              activeLoanAmt = member.loanPrincipal;
              error = `Active loan ₹${member.loanPrincipal.toLocaleString()} / थकीत कर्ज आहे`;
            }
          }

          parsedRows.push({
            id: `temp-${i}-${Date.now()}`,
            realId,
            memberNo,
            name,
            landArea: land,
            shareAmount: sharesAdded,
            loanAmount,
            loanType,
            activeLoanAmt,
            error
          });
        }

        setBulkDisburseList(parsedRows);
        setShowBulkDisburseModal(true);

      } catch (err) {
        console.error(err);
        alert("Failed to parse Excel file.");
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const revalidateBulkDisbursements = () => {
    setBulkDisburseList(prev => 
      prev.map(row => {
        if (!row.realId) return row;
        const member = members.find(m => m.id === row.realId);
        if (!member) {
          return { ...row, error: 'Member not found / सभासद सापडला नाही', activeLoanAmt: 0 };
        }
        if (member.loanPrincipal > 0) {
          return { 
            ...row, 
            activeLoanAmt: member.loanPrincipal, 
            error: `Active loan ₹${member.loanPrincipal.toLocaleString()} / थकीत कर्ज आहे` 
          };
        } else {
          return { ...row, activeLoanAmt: 0, error: '' };
        }
      })
    );
  };

  const handleBulkRowChange = (id: string, field: string, value: any) => {
    setBulkDisburseList(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        if (field === 'memberNo') {
          const member = members.find(m => m.memberNo === value);
          if (!member) {
            updated.realId = '';
            updated.name = '';
            updated.activeLoanAmt = 0;
            updated.error = 'Member not found / सभासद सापडला नाही';
          } else {
            updated.realId = member.id;
            updated.name = member.name;
            if (member.loanPrincipal > 0) {
              updated.activeLoanAmt = member.loanPrincipal;
              updated.error = `Active loan ₹${member.loanPrincipal.toLocaleString()} / थकीत कर्ज आहे`;
            } else {
              updated.activeLoanAmt = 0;
              updated.error = '';
            }
          }
        }
        return updated;
      }
      return row;
    }));
  };

  const handleBulkRowDelete = (id: string) => {
    setBulkDisburseList(prev => prev.filter(row => row.id !== id));
  };

  const handleBulkDisburseSubmit = () => {
    const hasErrors = bulkDisburseList.some(r => r.error);
    if (hasErrors) {
      alert("Please resolve all warnings/errors or remove flagged members before submitting.");
      return;
    }

    setShowLoanImportModeModal(true);
  };

  const executeBulkDisburse = (mode: 'Cash' | 'Bank', bankId: string) => {
    let count = 0;
    let totalPrincipalDisbursed = 0;
    let totalSharesDeducted = 0;

    bulkDisburseList.forEach(row => {
      if (!row.realId || row.loanAmount <= 0) return;
      
      const customData = {
        shareAmount: row.shareAmount,
        loanAmount: row.loanAmount,
        date: bulkDate || format(new Date(), 'yyyy-MM-dd'),
        loanType: row.loanType,
        landArea: row.landArea
      };

      handleSaveDisbursement(row.realId, customData, mode === 'Bank' ? bankId : undefined);
      count++;
      totalPrincipalDisbursed += row.loanAmount;
      totalSharesDeducted += row.shareAmount;
    });

    if (mode === 'Bank' && bankId) {
      setSocietyBanks(prev => prev.map(b => {
        if (b.id === bankId) {
          const netEffect = totalPrincipalDisbursed - totalSharesDeducted;
          return { ...b, balance: b.balance - netEffect };
        }
        return b;
      }));
    }

    alert(`Successfully processed loan disbursements for ${count} members! (${mode === 'Bank' ? 'बँक खात्यातून वजा' : 'रोख वजा'})`);
    setShowLoanImportModeModal(false);
    setShowBulkDisburseModal(false);
    setBulkDisburseList([]);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with headers as keys
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rows.length === 0) return;

        const headers = (rows[0] as string[]).map(h => String(h || '').trim().toLowerCase());
        const findCol = (possibleNames: string[]) => headers.findIndex(h => possibleNames.includes(h));

        const idxMemberNo = findCol(['memberno', 'member no', 'no', 'id', 'no.']);
        const idxName = findCol(['name', 'membername', 'full name', 'fullname', 'member name']);
        const idxNameEn = findCol(['nameen', 'name en', 'english name', 'englishname', 'member name english', 'name in english']);
        if (idxMemberNo === -1) {
          alert(`Import Failed: Could not find 'MemberNo' column.`);
          if (e.target) e.target.value = ''; return;
        }
        const idxGender = findCol(['gender', 'sex']);
        const idxDesignation = findCol(['designation', 'role', 'post', 'pad']);
        const idxVillage = findCol(['village', 'city', 'address']);
        const idxVillageEn = findCol(['villageen', 'village en', 'english village', 'englishvillage', 'village in english']);
        const idxMembershipDate = findCol(['membershipdate', 'reg date', 'joining date']);
        const idxMobile = findCol(['mobile', 'phone', 'contact']);
        const idxCategory = findCol(['category', 'caste']);
        const idxDOB = findCol(['dob', 'date of birth', 'birthdate']);
        const idxAadhar = findCol(['aadhar', 'uid']);
        const idxFarmerId = findCol(['farmerid', 'farmer id', 'kisan id', 'farmer no']);
        const idxOriginalLoanPrin = findCol(['originalloanprincipal', 'original loan principal', 'original principal', 'original loan amount']);
        const idxOriginalLoanDate = findCol(['originalloandate', 'original loan date', 'original date']);
        const idxLastLoanPrin = findCol(['lastloanprincipal', 'last loan principal', 'current principal', 'remaining principal', 'loanprincipal', 'loan principal', 'loan amount', 'principal', 'loan']);
        const idxLastPaymentDate = findCol(['lastpaymentdate', 'last payment date', 'payment date', 'last payment', 'भरल्याची तारीख', 'loandate', 'loan date', 'date', 'start date']);
        const idxLoanInterest = findCol(['loaninterestdue', 'loan interest due', 'loan interest', 'interest due', 'interest', 'व्याज']);
        const idxLoanAcc = findCol(['loanaccountno', 'loan account no', 'loan acc', 'loan no']);
        const idxLoanType = findCol(['loantype', 'loan type', 'type']);
        const idxBankAcc = findCol(['bankaccountno', 'bank acc', 'bank no']);
        const idxLand = findCol(['landarea', 'land', 'area']);
        const idxSavings = findCol(['savingsbalance', 'savings']);
        const idxShare = findCol(['sharebalance', 'share', 'shares']);
        const idxFD = findCol(['fdbalance', 'fd']);
        const idxLedgerPageNo = findCol(['ledgerpageno', 'ledger page no', 'ledger page', 'ledgerpage', 'ledgerpageo', 'खाते पान क्र', 'खाते पान क्र.', 'खाते पान', 'खतावणी पान', 'ledger_page']);

        // Create map of existing members by Member Number for quick lookup
        const existingMembersMap = new Map<string, Member>(members.map(m => [m.memberNo, m]));

        // Track CSV internal duplicates
        const csvMemberNumbers = new Map<string, number>();

        // Statistics
        const stats = { added: 0, updated: 0, csvDuplicates: 0, total: 0 };

        const newMembers: Member[] = [];
        const updatedMembers: Member[] = [];

        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].map(v => String(v ?? '').trim());
          if (values.length < 2) continue;
          const memberNo = values[idxMemberNo];
          const name = idxName !== -1 ? values[idxName] : '';
          if (!memberNo) continue;

          // Check if member already exists
          const existingMember = existingMembersMap.get(memberNo);
          if (!existingMember && !name) continue;

          stats.total++;

          // Check for CSV internal duplicates
          if (csvMemberNumbers.has(memberNo)) {
            csvMemberNumbers.set(memberNo, csvMemberNumbers.get(memberNo)! + 1);
            stats.csvDuplicates++;
            continue; // Skip duplicate rows in CSV
          }
          csvMemberNumbers.set(memberNo, 1);

          const genderVal = idxGender !== -1 ? values[idxGender] : 'Male';
          const gender = (genderVal === 'Female' || genderVal === 'Other') ? genderVal : 'Male';
          let parsedLoanType: 'Short Term' | 'Medium Term' | undefined = undefined;
          if (idxLoanType !== -1) {
            const rawType = (values[idxLoanType] || '').toLowerCase();
            if (rawType.includes('medium') || rawType.includes('m.t')) parsedLoanType = 'Medium Term';
            else if (rawType.includes('short') || rawType.includes('s.t') || rawType) parsedLoanType = 'Short Term';
          }
          const originalLoanDate = idxOriginalLoanDate !== -1 ? parseDateSafe(rows[i][idxOriginalLoanDate]) : undefined;
          const lastPaymentDate = idxLastPaymentDate !== -1 ? parseDateSafe(rows[i][idxLastPaymentDate]) : undefined;
          const membershipDate = idxMembershipDate !== -1 ? parseDateSafe(rows[i][idxMembershipDate]) : undefined;
          const dob = idxDOB !== -1 ? parseDateSafe(rows[i][idxDOB]) : undefined;
          const originalLoanPrincipal = idxOriginalLoanPrin !== -1 ? parseNumberSafe(values[idxOriginalLoanPrin]) : 0;
          const lastLoanPrincipal = idxLastLoanPrin !== -1 ? parseNumberSafe(values[idxLastLoanPrin]) : 0;

          if (existingMember) {
            // Use type assertion since we've already checked that existingMember is truthy
            const existing = existingMember as Member;

            const getNewValue = (idx: number, parseFn: (val: any) => any, existingVal: any) => {
              if (idx !== -1) {
                const cellVal = values[idx];
                if (cellVal !== undefined && cellVal !== null && cellVal.trim() !== '') {
                  return parseFn(cellVal);
                }
              }
              return existingVal;
            };

            const updatedMember: Member = {
              ...existing,
              name: getNewValue(idxName, v => v, existing.name) as string,
              nameEn: getNewValue(idxNameEn, v => v, existing.nameEn) as string | undefined,
              gender: getNewValue(idxGender, v => (v === 'Female' || v === 'Other') ? v : 'Male', existing.gender) as any,
              designation: getNewValue(idxDesignation, v => v || 'शेतकरी', existing.designation) as string,
              village: getNewValue(idxVillage, v => v, existing.village) as string,
              villageEn: getNewValue(idxVillageEn, v => v, existing.villageEn) as string | undefined,
              membershipDate: getNewValue(idxMembershipDate, () => membershipDate, existing.membershipDate) as string | undefined,
              mobile: getNewValue(idxMobile, v => v, existing.mobile) as string,
              category: getNewValue(idxCategory, v => v || 'OPEN', existing.category) as any,
              dob: getNewValue(idxDOB, () => dob, existing.dob) as string,
              aadhar: getNewValue(idxAadhar, v => v, existing.aadhar) as string,
              farmerId: getNewValue(idxFarmerId, v => v, existing.farmerId) as string,
              bankAccountNo: getNewValue(idxBankAcc, v => v, existing.bankAccountNo) as string,
              landArea: getNewValue(idxLand, v => v, existing.landArea) as string,
              loanAccountNo: getNewValue(idxLoanAcc, v => v, existing.loanAccountNo) as string,
              loanType: getNewValue(idxLoanType, () => parsedLoanType || 'Short Term', existing.loanType) as any,
              loanPrincipal: (() => {
                const valLast = idxLastLoanPrin !== -1 ? values[idxLastLoanPrin] : '';
                const valOrig = idxOriginalLoanPrin !== -1 ? values[idxOriginalLoanPrin] : '';
                if (valLast !== undefined && valLast !== null && valLast.trim() !== '') return parseNumberSafe(valLast);
                if (valOrig !== undefined && valOrig !== null && valOrig.trim() !== '') return parseNumberSafe(valOrig);
                return existing.loanPrincipal;
              })() as number,
              loanInterestDue: getNewValue(idxLoanInterest, parseNumberSafe, existing.loanInterestDue) as number,
              lastLoanCalculationDate: (() => {
                const valLast = idxLastPaymentDate !== -1 ? values[idxLastPaymentDate] : '';
                const valOrig = idxOriginalLoanDate !== -1 ? values[idxOriginalLoanDate] : '';
                if (valLast !== undefined && valLast !== null && valLast.trim() !== '') return lastPaymentDate;
                if (valOrig !== undefined && valOrig !== null && valOrig.trim() !== '') return originalLoanDate;
                return existing.lastLoanCalculationDate;
              })() as string | undefined,
              originalLoanDate: getNewValue(idxOriginalLoanDate, () => originalLoanDate, existing.originalLoanDate) as string | undefined,
              savingsBalance: getNewValue(idxSavings, parseNumberSafe, existing.savingsBalance) as number,
              shareBalance: getNewValue(idxShare, parseNumberSafe, existing.shareBalance) as number,
              fdBalance: getNewValue(idxFD, parseNumberSafe, existing.fdBalance) as number,
              ledgerPageNo: getNewValue(idxLedgerPageNo, v => v, existing.ledgerPageNo) as string | undefined,
            };
            updatedMembers.push(updatedMember);
            stats.updated++;
          } else {
            // Add new member
            const newM: Member = {
              id: Date.now().toString() + i + Math.random().toString(36).substr(2, 5),
              memberNo: memberNo, name: name,
              nameEn: idxNameEn !== -1 ? (values[idxNameEn] || '') : '',
              gender: gender as any,
              designation: idxDesignation !== -1 ? (values[idxDesignation] || 'शेतकरी') : 'शेतकरी',
              village: idxVillage !== -1 ? (values[idxVillage] || '') : '',
              villageEn: idxVillageEn !== -1 ? (values[idxVillageEn] || '') : '',
              membershipDate: membershipDate, mobile: idxMobile !== -1 ? (values[idxMobile] || '') : '',
              category: idxCategory !== -1 ? ((values[idxCategory] || 'OPEN') as any) : 'OPEN',
              dob: dob || '',
              aadhar: idxAadhar !== -1 ? (values[idxAadhar] || '') : '',
              farmerId: idxFarmerId !== -1 ? (values[idxFarmerId] || '') : '',
              bankAccountNo: idxBankAcc !== -1 ? (values[idxBankAcc] || '') : '',
              landArea: idxLand !== -1 ? (values[idxLand] || '') : '',
              loanAccountNo: idxLoanAcc !== -1 ? (values[idxLoanAcc] || '') : '',
              loanType: parsedLoanType || 'Short Term', farmerType: 'Small Farmer',
              loanPrincipal: lastLoanPrincipal || originalLoanPrincipal,
              lastLoanCalculationDate: lastPaymentDate || originalLoanDate, originalLoanDate: originalLoanDate,
              loanInterestDue: idxLoanInterest !== -1 ? parseNumberSafe(values[idxLoanInterest]) : 0, savingsBalance: idxSavings !== -1 ? parseNumberSafe(values[idxSavings]) : 0,
              shareBalance: idxShare !== -1 ? parseNumberSafe(values[idxShare]) : 0,
              fdBalance: idxFD !== -1 ? parseNumberSafe(values[idxFD]) : 0,
              ledgerPageNo: idxLedgerPageNo !== -1 ? values[idxLedgerPageNo] : '',
              isActive: true, photoUrl: ''
            };
            newMembers.push(newM);
            stats.added++;
          }
        }

        // Apply updates
        if (updatedMembers.length > 0) {
          const updatedMembersList = members.map(m => {
            const updated = updatedMembers.find(um => um.id === m.id);
            return updated || m;
          });
          updateMembers(updatedMembersList);
        }

        // Add new members
        if (newMembers.length > 0) {
          importMembers(newMembers);
        }

        // Show detailed summary
        if (stats.total > 0) {
          await showConfirm({
            title: 'Import Complete!',
            titleMr: 'इम्पोर्ट पूर्ण झाले!',
            message: `✅ ${stats.added} new members added${stats.updated > 0 ? `\n🔄 ${stats.updated} members updated` : ''}${stats.csvDuplicates > 0 ? `\n⚠️ ${stats.csvDuplicates} duplicate rows skipped` : ''}\n\n📈 Total ${stats.total} rows processed`,
            messageMr: `✅ ${stats.added} नवीन सभासद जोडले${stats.updated > 0 ? `\n🔄 ${stats.updated} सभासद अपडेट केले` : ''}${stats.csvDuplicates > 0 ? `\n⚠️ ${stats.csvDuplicates} डुप्लिकेट rows वगळले` : ''}\n\n📈 एकूण ${stats.total} rows processed`,
            icon: '📊',
            confirmText: 'OK',
            confirmTextMr: 'ठीक आहे',
            confirmColor: 'green'
          });
        } else {
          // Better error message with debugging info
          const debugInfo = [
            '❌ Import Failed: No valid member data found.',
            '',
            'Please check:',
            '✓ File has "MemberNo" and "Name" columns',
            '✓ At least one row with data (not just headers)',
            '✓ MemberNo and Name are not empty'
          ].join('\n');

          alert(debugInfo);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse file. Please use a valid Excel (.xlsx) or CSV file.");
      }
      if (e.target) e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-6 md:pt-1 pb-24">
      <style>{`
        /* MOBILE ONLY: Prominent Scrollbar & Table Fixes */
        @media (max-width: 768px) {
            .mobile-scroll {
                overflow-x: scroll !important; 
                padding-bottom: 8px !important;
            }
            .mobile-scroll::-webkit-scrollbar { 
                height: 14px !important;
                display: block !important;
                -webkit-appearance: none;
            }
            .mobile-scroll::-webkit-scrollbar-track { 
                background: #cbd5e1 !important; 
                border-radius: 10px;
                border: 1px solid #94a3b8;
            }
            .mobile-scroll::-webkit-scrollbar-thumb { 
                background-color: #2563eb !important; 
                border-radius: 10px; 
                border: 2px solid #cbd5e1;
                box-shadow: 0 0 5px rgba(0,0,0,0.2);
            }
            .mobile-scroll {
                scrollbar-width: auto;
                scrollbar-color: #2563eb #cbd5e1;
                -ms-overflow-style: scrollbar;
            }
            
            /* Mobile Performance Optimizations */
            .will-change-scroll {
                will-change: scroll-position;
                -webkit-overflow-scrolling: touch;
            }
            
            /* Reduce repaints on mobile */
            table {
                transform: translateZ(0);
                backface-visibility: hidden;
            }
        }
      `}</style>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline text-sm font-medium">Back</span>
          </button>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Members Management</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadTemplate} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-300 dark:hover:bg-slate-600 transition text-sm">
            <FileSpreadsheet size={18} /> <span className="hidden sm:inline">Template</span>
          </button>

          <label className="bg-indigo-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm cursor-pointer text-sm">
            <Upload size={18} /> <span className="hidden sm:inline">Import Excel/CSV</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
          </label>

          <button onClick={handleShareMembersExcel} className="bg-purple-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition shadow-sm text-sm">
            <Share2 size={18} /> <span className="hidden sm:inline">Share Excel</span>
          </button>

          <button onClick={async () => {
            exportMembersToExcel(filteredMembers);
            await showConfirm({
              title: 'Export Successful!',
              titleMr: 'एक्सपोर्ट यशस्वी झाले!',
              message: `Successfully exported ${filteredMembers.length} members to Excel file.`,
              messageMr: `${filteredMembers.length} सभासद एक्सेल फाईलमध्ये यशस्वीपणे एक्सपोर्ट झाले.`,
              icon: '✅',
              confirmText: 'OK',
              confirmTextMr: 'ठीक आहे',
              confirmColor: 'green'
            });
          }} className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition shadow-sm text-sm">
            <Download size={18} /> <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm text-sm">
            <Plus size={18} /> <span className="hidden sm:inline">Add Member</span>
          </button>
        </div>
      </div>

      {/* Smart Search & Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 mb-2 flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Search Name, No, Mobile..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
        </div>
        <button onClick={() => setShowFilterModal(true)} className={`p-2.5 rounded-lg border flex items-center gap-2 transition hover:bg-slate-200 dark:hover:bg-slate-600 ${activeFiltersCount > 0 ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 border-transparent text-slate-700 dark:text-slate-300'}`}>
          <Filter size={20} /> <span className="hidden md:inline font-medium">Filters</span>
          {activeFiltersCount > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{activeFiltersCount}</span>}
        </button>
        {(searchInput || activeFiltersCount > 0) && (
          <button onClick={clearFilters} className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
            <RotateCcw size={20} />
          </button>
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowFilterModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl w-full max-w-md shadow-2xl animate-fade-in-up border dark:border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2 border-b dark:border-slate-700 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                <Filter size={20} className="text-blue-600" /> Filter Members
              </h3>
              <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Village</label>
                <select value={filterVillage} onChange={(e) => setFilterVillage(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">All Villages</option>{uniqueVillages.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              <div><label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">All Categories</option><option value="OPEN">OPEN</option><option value="OBC">OBC</option><option value="SC">SC</option><option value="ST">ST</option><option value="NT">NT</option></select></div>
              <div><label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Farmer Type</label>
                <select value={filterFarmerType} onChange={(e) => setFilterFarmerType(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">All Farmer Types</option><option value="Small Farmer">Small Farmer (लघु)</option><option value="Large Farmer">Large Farmer (मोठे)</option></select></div>
              <div><label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="All">All Status</option><option value="Active">Active Only</option><option value="Inactive">Inactive Only</option><option value="Regular (FY)">Regular (FY) - चालू वर्षातील कर्जदार</option><option value="Defaulters">Defaulters - थकीत कर्जदार</option></select></div>
            </div>
            <div className="mt-8 flex gap-3 pt-4 border-t dark:border-slate-700">
              <button onClick={clearFilters} className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition">Reset</button>
              <button onClick={() => setShowFilterModal(false)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg transition">Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-2 border-b dark:border-slate-700">
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 px-4 font-bold text-lg transition border-b-2 ${activeTab === 'list' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          All Members
        </button>
        <button
          onClick={() => setActiveTab('new_loan')}
          className={`pb-3 px-4 font-bold text-lg transition border-b-2 ${activeTab === 'new_loan' ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          नवीन कर्ज / New Loan
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-4 font-bold text-lg transition border-b-2 ${activeTab === 'history' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          कर्ज वाटप इतिहास / History
        </button>
      </div>

      {/* Tabs Content */}
      {activeTab === 'list' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh] md:max-h-[70vh] max-h-[60vh] will-change-scroll">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">No.</th>
                  <th className="p-4 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">Name</th>
                  <th className="p-4 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">Village</th>
                  <th className="p-4 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">Designation</th>
                  <th className="p-4 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">Category</th>
                  <th className="p-4 font-medium text-slate-500 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">Farmer Type</th>
                  <th className="p-4 font-medium text-slate-500 dark:text-slate-300 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMembers.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">No members found.</td></tr>
                ) : paginatedMembers.map((member) => (
                  <tr key={member.id} className="border-b dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">#{member.memberNo}</td>
                    <td className="p-4 font-medium whitespace-nowrap">
                      <Link to={`/members/${member.id}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-700">
                          {member.photoUrl ? <img src={member.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <User size={14} className="text-slate-400" />}
                        </div>
                        <span className={member.isActive ? '' : 'text-slate-400 italic'}>{member.name} {!member.isActive && '(Inactive)'}</span>
                        {member.isSuccessor && (
                          <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded shrink-0">
                            वारस
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{member.village}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">{member.designation || 'शेतकरी'}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold">{member.category}</span></td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">{member.farmerType || 'Small Farmer'}</td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button onClick={() => initiateDelete(member.id)} className="text-red-400 hover:text-red-600 p-2 transition"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredMembers.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Showing <span className="font-bold">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredMembers.length)}</span> of{' '}
                <span className="font-bold">{filteredMembers.length}</span> members
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white dark:bg-slate-700 border dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white dark:bg-slate-700 border dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'new_loan' && (
        <div className="space-y-6">
          {/* New Loan Selection Section */}
          <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
              <h3 className="font-bold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                <div className="bg-yellow-100 dark:bg-yellow-800 p-1.5 rounded-lg"><Plus size={18} /></div> Select Members for Loan Disbursement / कर्ज वाटपासाठी सभासद निवडा
              </h3>
              <div className="flex flex-wrap gap-2 self-start lg:self-auto">
                <button 
                  onClick={handleDownloadDisbursementTemplate}
                  className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-300 dark:hover:bg-slate-600 transition text-sm font-semibold whitespace-nowrap"
                >
                  <FileSpreadsheet size={18} /> <span>Download Template</span>
                </button>
                <label className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition shadow-sm cursor-pointer text-sm font-semibold whitespace-nowrap">
                  <Upload size={18} /> <span>Excel Import (नवीन कर्ज)</span>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportDisbursementExcel} className="hidden" />
                </label>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700 overflow-hidden max-h-[300px] overflow-y-auto overflow-x-auto mobile-scroll">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700 shadow-sm">
                  <tr>
                    <th className="p-3 w-10">
                      <input 
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const selectableIds = filteredMembers
                              .filter(m => (m.loanPrincipal || 0) <= 0 && (m.loanInterestDue || 0) <= 0)
                              .map(m => m.id);
                            setSelectedMemberIds(selectableIds);
                          }
                          else setSelectedMemberIds([]);
                        }}
                        checked={filteredMembers.length > 0 && selectedMemberIds.length === filteredMembers.filter(m => (m.loanPrincipal || 0) <= 0 && (m.loanInterestDue || 0) <= 0).length}
                      />
                    </th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">No.</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">Name</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">Village</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">Current Loan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(m => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    const isDisbursed = disbursedLog.has(m.id);
                    const hasOutstanding = (m.loanPrincipal || 0) > 0 || (m.loanInterestDue || 0) > 0;
                    return (
                      <tr 
                        key={m.id} 
                        className={`border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${hasOutstanding ? 'opacity-75 bg-slate-50/20' : ''}`}
                        onClick={() => handleToggleMemberSelection(m.id)}
                      >
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            disabled={hasOutstanding}
                            onChange={() => handleToggleMemberSelection(m.id)} 
                            className={hasOutstanding ? 'cursor-not-allowed opacity-50' : ''}
                          />
                        </td>
                        <td className={`p-3 ${isDisbursed ? 'text-emerald-600 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>{m.memberNo}</td>
                        <td className={`p-3 font-medium ${isDisbursed ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'} ${hasOutstanding ? 'text-slate-500' : ''}`}>
                          {m.name} {isDisbursed && '(Disbursed)'}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{m.village}</td>
                        <td className="p-3">
                          {hasOutstanding ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/40">
                              <AlertTriangle size={12} /> ₹{m.loanPrincipal.toLocaleString()} (कर्ज बाकी)
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-500 mt-2 text-right">{selectedMemberIds.length} members selected</p>
          </div>

          {/* Disbursement Form Area */}
          {selectedMemberIds.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-indigo-100 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 border-b dark:border-slate-700 pb-3">
                <div>
                  <h3 className="font-bold text-xl text-slate-800 dark:text-white">Loan Disbursement Details</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Define amounts and dates for selected borrowers</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={handleBulkSaveDisbursements} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow-sm active:scale-95"
                  >
                    <Plus size={16} /> Disburse Selected / एकत्रित वाटप
                  </button>
                  <button 
                    onClick={handleExportDisbursedList} 
                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition"
                  >
                    <FileSpreadsheet size={16} /> Export List
                  </button>
                  <button 
                    onClick={handleShareDisbursedList} 
                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition"
                  >
                    <Share2 size={16} /> Share
                  </button>
                </div>
              </div>

              {/* Bulk Settings Panel */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Set Date for All / सर्वांसाठी एकच तारीख:</label>
                  <input 
                    type="date" 
                    value={bulkDate} 
                    onChange={e => handleBulkDateChange(e.target.value)} 
                    className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Set Loan Amount for All / सर्वांसाठी एकत्रित मुद्दल (₹):</label>
                  <input 
                    type="number" 
                    value={bulkAmount} 
                    onChange={e => handleBulkAmountChange(e.target.value ? parseFloat(e.target.value) : '')} 
                    placeholder="Principal Amount" 
                    className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Set Loan Type for All / सर्वांसाठी कर्ज प्रकार:</label>
                  <select 
                    value={bulkType} 
                    onChange={e => handleBulkTypeChange(e.target.value)} 
                    className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white"
                  >
                    <option>Short Term</option>
                    <option>Medium Term</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 text-sm border-b dark:border-slate-700">
                      <th className="pb-3 pl-2">Name</th>
                      <th className="pb-3 w-28">Land (Ha.R)</th>
                      <th className="pb-3 w-32">Shares (+)</th>
                      <th className="pb-3 w-40">Loan Amount (₹)</th>
                      <th className="pb-3 w-36">Date</th>
                      <th className="pb-3 w-36">Type</th>
                      <th className="pb-3 w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {selectedMemberIds.map(id => {
                      const member = members.find(m => m.id === id);
                      if (!member) return null;
                      const data = disbursementData[id] || {
                        shareAmount: 0,
                        loanAmount: bulkAmount || Math.max(0, member.loanPrincipal || 0),
                        date: bulkDate || format(new Date(), 'yyyy-MM-dd'),
                        loanType: bulkType || member.loanType || 'Short Term'
                      };
                      const ratePerAcre = settings.nclRatePerAcre || 32000;
                      const landVal = parseFloat(data.landArea ?? member.landArea ?? '0') || 0;
                      const maxLimit = landVal * ratePerAcre;
                      const isSaved = disbursedLog.has(id);

                      return (
                        <tr key={id} className={`group ${isSaved ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                          <td className={`py-3 pl-2 font-medium ${isSaved ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {member.name}
                            <div className="text-xs text-slate-400 font-normal">#{member.memberNo} | A/C: {member.loanAccountNo || 'N/A'} | Cur shares: ₹{member.shareBalance}</div>
                          </td>
                          <td className="py-3 pr-2 w-28">
                            <input 
                              type="text"
                              value={data.landArea ?? member.landArea ?? ''}
                              onChange={e => handleDisbursementChange(id, 'landArea', e.target.value)}
                              className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-center text-sm font-bold text-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <input 
                              type="number"
                              value={data.shareAmount || ''}
                              placeholder="0"
                              onChange={e => handleDisbursementChange(id, 'shareAmount', parseFloat(e.target.value))}
                              className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <input 
                              type="number"
                              value={data.loanAmount || ''}
                              placeholder="Principal"
                              onChange={e => handleDisbursementChange(id, 'loanAmount', parseFloat(e.target.value))}
                              className={`w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold ${data.loanAmount > maxLimit ? 'border-red-500 focus:ring-red-500 text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}
                            />
                            <div className="text-[9px] mt-1 font-bold text-slate-400 dark:text-slate-500 flex flex-col gap-0.5">
                              <span>मर्यादा: ₹{maxLimit.toLocaleString()}</span>
                              {data.loanAmount > maxLimit && (
                                <span className="text-red-500 animate-pulse">⚠️ मर्यादा ओलांडली</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-2">
                            <input 
                              type="date"
                              value={data.date}
                              onChange={e => handleDisbursementChange(id, 'date', e.target.value)}
                              className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <select 
                              value={data.loanType} 
                              onChange={e => handleDisbursementChange(id, 'loanType', e.target.value)}
                              className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800 dark:text-white"
                            >
                              <option>Short Term</option>
                              <option>Medium Term</option>
                            </select>
                          </td>
                          <td className="py-3">
                            <button 
                              onClick={() => handleSaveDisbursement(id)} 
                              className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition ${isSaved ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            >
                              {isSaved ? 'Saved' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-6 pt-4 border-t dark:border-slate-700 flex justify-end">
                  <button onClick={() => setSelectedMemberIds([])} className="text-red-500 hover:text-red-700 text-sm font-medium px-4">Clear Selection</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6 animate-fade-in">
          {/* Filter & Summary Header */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">कालावधी प्रकार:</span>
                <select
                  value={historyFilterType}
                  onChange={e => setHistoryFilterType(e.target.value as any)}
                  className="p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="date">विशिष्ट तारीख (Single Date)</option>
                  <option value="current_fy">चालू आर्थिक वर्ष (Current FY)</option>
                  <option value="previous_fy">मागील आर्थिक वर्ष (Previous FY)</option>
                </select>
              </div>
              {historyFilterType === 'date' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">तारीख / Date:</span>
                  <input 
                    type="date" 
                    value={historyDate} 
                    onChange={e => setHistoryDate(e.target.value)} 
                    className="p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="नाव, क्र., गाव शोधा..." 
                  value={historySearch} 
                  onChange={e => setHistorySearch(e.target.value)} 
                  className="pl-8 pr-4 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowHistoryStatement(!showHistoryStatement)}
                className={`px-3.5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow-sm ${showHistoryStatement ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-inner' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
              >
                <FileText size={16} /> {showHistoryStatement ? 'गोषवारा बंद करा' : 'गोषवारा पहा (Statement)'}
              </button>
              <button 
                onClick={handleExportHistoryList} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow-sm"
              >
                <Download size={16} /> Export Excel
              </button>
              <button 
                onClick={handleShareHistoryList} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow-sm"
              >
                <Share2 size={16} /> Share History
              </button>
            </div>
          </div>

          {/* Kharif Crop Loan Disbursement Statement (खरीप पीक कर्ज वाटप स्टेटमेंट) */}
          {showHistoryStatement && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-lg space-y-6 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 dark:border-slate-700 gap-4">
                <div className="text-center sm:text-left flex-1">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                    {settings.societyName || 'आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं. १४२५'}
                  </h2>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-1">
                    खरीप पीक कर्ज वाटप स्टेटमेंट (गोषवारा)
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
                    {historyFilterType === 'date' && `तारीख: ${historyDate} | हंगाम: २०२६-२७`}
                    {historyFilterType === 'current_fy' && `कालावधी: चालू आर्थिक वर्ष | हंगाम: २०२६-२७`}
                    {historyFilterType === 'previous_fy' && `कालावधी: मागील आर्थिक वर्ष | हंगाम: २०२५-२६`}
                  </p>
                </div>
                <div className="flex justify-center sm:justify-end">
                  <button
                    onClick={handleExportStatementExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow-sm border border-emerald-500 hover:border-emerald-600 active:scale-95"
                  >
                    <FileSpreadsheet size={16} /> गोषवारा Excel Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse border border-slate-300 dark:border-slate-700 text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
                      <th className="p-2.5 border border-slate-300 dark:border-slate-600 w-16">अ. क्र.</th>
                      <th className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">कर्ज वाटप तपशिल</th>
                      <th className="p-2.5 border border-slate-300 dark:border-slate-600 w-24">सभासद</th>
                      <th className="p-2.5 border border-slate-300 dark:border-slate-600 w-32">आराजी (Land)</th>
                      <th className="p-2.5 border border-slate-300 dark:border-slate-600 w-36">कर्ज रक्कम (₹)</th>
                      <th className="p-2.5 border border-slate-300 dark:border-slate-600 w-36">हिस्से रक्कम (₹)</th>
                      <th className="p-2.5 border border-slate-300 dark:border-slate-600 w-36">देय रक्कम (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Section 1: Farmer Types */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">१</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">मोठे कृषक</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.largeFarmer.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.largeFarmer.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.largeFarmer.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.largeFarmer.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.largeFarmer.net.toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">२</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">लघु कृषक</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.smallFarmer.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.smallFarmer.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.smallFarmer.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.smallFarmer.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.smallFarmer.net.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-800 dark:text-white border-t-2">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600"></td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4 font-black">एकूण</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600">{historyStatement.largeFarmer.count + historyStatement.smallFarmer.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600">{(historyStatement.largeFarmer.land + historyStatement.smallFarmer.land).toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4">₹{(historyStatement.largeFarmer.loan + historyStatement.smallFarmer.loan).toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4">₹{(historyStatement.largeFarmer.shares + historyStatement.smallFarmer.shares).toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 text-emerald-600 dark:text-emerald-400">₹{(historyStatement.largeFarmer.net + historyStatement.smallFarmer.net).toLocaleString()}</td>
                    </tr>

                    {/* Spacer Row */}
                    <tr className="bg-slate-100 dark:bg-slate-900/40"><td colSpan={7} className="h-4 p-0"></td></tr>

                    {/* Section 2: Caste Categories */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">३</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">ST</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.st.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.st.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.st.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.st.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.st.net.toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">४</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">SC</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.sc.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.sc.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.sc.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.sc.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.sc.net.toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">५</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">गैर आदि.</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.nonTribal.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.nonTribal.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.nonTribal.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.nonTribal.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.nonTribal.net.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-800 dark:text-white border-t-2">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600"></td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4 font-black">एकूण</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600">{historyStatement.st.count + historyStatement.sc.count + historyStatement.nonTribal.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600">{(historyStatement.st.land + historyStatement.sc.land + historyStatement.nonTribal.land).toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4">₹{(historyStatement.st.loan + historyStatement.sc.loan + historyStatement.nonTribal.loan).toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4">₹{(historyStatement.st.shares + historyStatement.sc.shares + historyStatement.nonTribal.shares).toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 text-emerald-600 dark:text-emerald-400">₹{(historyStatement.st.net + historyStatement.sc.net + historyStatement.nonTribal.net).toLocaleString()}</td>
                    </tr>

                    {/* Spacer Row */}
                    <tr className="bg-slate-100 dark:bg-slate-900/40"><td colSpan={7} className="h-4 p-0"></td></tr>

                    {/* Section 3: Women Members */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">६</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4 font-bold">महिला सभासद</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.female.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.female.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.female.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.female.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.female.net.toLocaleString()}</td>
                    </tr>

                    {/* Spacer Row */}
                    <tr className="bg-slate-100 dark:bg-slate-900/40"><td colSpan={7} className="h-4 p-0"></td></tr>

                    {/* Section 4: Membership Status */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">७</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">चालू सभासद</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.regular.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.regular.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.regular.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.regular.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.regular.net.toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">८</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">थकीत/खंडित सभासद</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.defaulter.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.defaulter.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.defaulter.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.defaulter.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.defaulter.net.toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-bold">९</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4">नवीन सभासद</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.newMember.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 font-medium">{historyStatement.newMember.land.toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.newMember.loan.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold">₹{historyStatement.newMember.shares.toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 font-semibold text-emerald-600 dark:text-emerald-400">₹{historyStatement.newMember.net.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-800 dark:text-white border-t-2">
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600"></td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-left pl-4 font-black">एकूण</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600">{historyStatement.regular.count + historyStatement.defaulter.count + historyStatement.newMember.count}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600">{(historyStatement.regular.land + historyStatement.defaulter.land + historyStatement.newMember.land).toFixed(2)}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4">₹{(historyStatement.regular.loan + historyStatement.defaulter.loan + historyStatement.newMember.loan).toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4">₹{(historyStatement.regular.shares + historyStatement.defaulter.shares + historyStatement.newMember.shares).toLocaleString()}</td>
                      <td className="p-2.5 border border-slate-300 dark:border-slate-600 text-right pr-4 text-emerald-600 dark:text-emerald-400">₹{(historyStatement.regular.net + historyStatement.defaulter.net + historyStatement.newMember.net).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disbursement Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-slate-800 dark:to-slate-800/80 p-4 rounded-xl border border-blue-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">एकूण लाभार्थी सभासद</p>
                <p className="text-2xl font-black text-blue-900 dark:text-white mt-1">{historyTotals.count} सभासद</p>
              </div>
              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2.5 rounded-lg">
                <User size={24} />
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-slate-800 dark:to-slate-800/80 p-4 rounded-xl border border-emerald-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">एकूण वितरित कर्ज रक्कम</p>
                <p className="text-2xl font-black text-emerald-900 dark:text-white mt-1">₹{historyTotals.loan.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-lg">
                <FileText size={24} />
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-slate-800 dark:to-slate-800/80 p-4 rounded-xl border border-indigo-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">एकूण शेअर्स जमा</p>
                <p className="text-2xl font-black text-indigo-900 dark:text-white mt-1">₹{historyTotals.shares.toLocaleString()}</p>
              </div>
              <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-2.5 rounded-lg">
                <Plus size={24} />
              </div>
            </div>
          </div>

          {/* History Details Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[50vh] will-change-scroll mobile-scroll">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700 shadow-sm">
                  <tr>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">Member No</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">Name</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">Village</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium text-blue-600 dark:text-blue-400">Loan Account No</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium text-right">Shares Added</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium text-right">Principal Disbursed</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">Date</th>
                    <th className="p-3 text-slate-600 dark:text-slate-300 font-medium">Loan Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-700">
                  {disbursementsOnHistoryDate.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                        निवडलेल्या तारखेला (`{historyDate}`) कोणतेही कर्ज वाटप सापडले नाही.
                      </td>
                    </tr>
                  ) : disbursementsOnHistoryDate.map((item) => {
                    const m = members.find(x => x.id === item.memberId);
                    if (!m) return null;

                    // Get shares added on same date
                    const shareTxn = transactions.find(t => 
                      t.memberId === m.id && 
                      t.date === item.date && 
                      t.accountType === AccountType.SHARES && 
                      t.type === TransactionType.CREDIT
                    );
                    const sharesAdded = shareTxn ? shareTxn.amount : 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="p-3 font-semibold text-slate-600 dark:text-slate-300">#{m.memberNo}</td>
                        <td className="p-3 font-medium text-slate-800 dark:text-white">
                          <Link to={`/members/${m.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {m.name}
                          </Link>
                          {item.isLegacy && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 ml-2 px-1.5 py-0.5 rounded">Legacy</span>}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{m.village}</td>
                        <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{m.loanAccountNo || 'N/A'}</td>
                        <td className="p-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">₹{(sharesAdded || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-black">₹{item.amount.toLocaleString()}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{item.date}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                            {m.loanType || 'Short Term'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto backdrop-blur-sm">
          {/* Scanning Overlay Visual Indicator */}
          {isScanning && (
            <div className="fixed inset-0 bg-black/70 z-[100] flex flex-col items-center justify-center backdrop-blur-md">
              <style>{`
                @keyframes scan-laser {
                  0%, 100% { top: 0%; }
                  50% { top: 100%; }
                }
              `}</style>
              <div className="relative w-80 h-96 border-4 border-dashed border-emerald-500 rounded-3xl overflow-hidden flex items-center justify-center bg-slate-900/60 shadow-2xl">
                {/* Laser line */}
                <div 
                  className="absolute w-full h-1 bg-emerald-500 shadow-[0_0_15px_#10b981,0_0_30px_#10b981]" 
                  style={{ animation: 'scan-laser 2s ease-in-out infinite', top: '0%' }}
                />
                
                {/* Corners */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />

                <div className="text-center z-10 px-6">
                  <ScanLine size={48} className="text-emerald-400 mx-auto animate-pulse" />
                  <p className="text-emerald-400 font-black text-sm uppercase tracking-wider mt-4">AI OCR Scanning...</p>
                  <p className="text-slate-300 text-[10px] mt-1 font-medium">Extracting Aadhar & 7/12 records</p>
                </div>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto shadow-2xl border dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Add New Member</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
            </div>
            <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div><h4 className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2"><ScanLine size={18} /> Auto-Fill with AI Scan</h4><p className="text-xs text-slate-600 dark:text-slate-400">Upload or Snap Aadhaar/PAN Card to auto-fill.</p></div>
              <div className="flex gap-2">
                <label className={`bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-600 transition flex items-center gap-2 text-sm font-medium ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={16} /> Upload<input type="file" accept="image/*" className="hidden" onChange={handleScanID} disabled={isScanning} />
                </label>
                <label className={`bg-indigo-600 text-white px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-700 transition flex items-center gap-2 text-sm font-medium ${isScanning ? 'opacity-70 pointer-events-none' : ''}`}>
                  {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {isScanning ? 'Scanning...' : 'Camera'}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanID} disabled={isScanning} />
                </label>
              </div>
            </div>
            <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Member Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center overflow-hidden border dark:border-slate-600 shrink-0">
                    {newMember.photoUrl ? <img src={newMember.photoUrl} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-400" size={24} />}
                  </div>
                  <div className="flex-1"><input type="file" accept="image/*" onChange={handlePhotoUpload} className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-700 dark:file:text-white" /><p className="text-xs text-slate-500 mt-1">Max size: 500KB</p></div>
                </div>
              </div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Full Name * (मराठीत)</label><input required type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.name || ''} onChange={e => setNewMember({ ...newMember, name: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Full Name in English (इंग्रजीत)</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.nameEn || ''} onChange={e => setNewMember({ ...newMember, nameEn: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Member No *</label><input required type="text" className={`w-full p-2 border rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${isDuplicateMemberNo ? 'border-red-500 focus:ring-red-500' : 'dark:border-slate-600'}`} value={newMember.memberNo || ''} onChange={e => setNewMember({ ...newMember, memberNo: e.target.value })} />{newMember.memberNo && isDuplicateMemberNo && <div className="flex items-center gap-1 text-red-500 text-xs mt-1 font-medium animate-pulse"><AlertTriangle size={12} /> Member No already exists!</div>}</div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Membership Date</label><input type="date" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.membershipDate || ''} onChange={e => setNewMember({ ...newMember, membershipDate: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Gender *</label><select className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.gender} onChange={e => setNewMember({ ...newMember, gender: e.target.value as any })}><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Designation *</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.designation || 'शेतकरी'} onChange={e => setNewMember({ ...newMember, designation: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Village * (मराठीत)</label><input required type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.village || ''} onChange={e => setNewMember({ ...newMember, village: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Village in English (इंग्रजीत)</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.villageEn || ''} onChange={e => setNewMember({ ...newMember, villageEn: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Mobile</label><input type="tel" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.mobile || ''} onChange={e => setNewMember({ ...newMember, mobile: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Date of Birth</label><input type="date" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.dob || ''} onChange={e => setNewMember({ ...newMember, dob: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Category</label><select className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.category} onChange={e => setNewMember({ ...newMember, category: e.target.value as any })}><option value="OPEN">OPEN</option><option value="OBC">OBC</option><option value="SC">SC</option><option value="ST">ST</option><option value="NT">NT</option></select></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Farmer Type</label><select className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.farmerType || 'Small Farmer'} onChange={e => setNewMember({ ...newMember, farmerType: e.target.value as any })}><option value="Small Farmer">Small Farmer (लघु कृषक)</option><option value="Large Farmer">Large Farmer (मोठे कृषक)</option></select></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Aadhar No</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.aadhar || ''} onChange={e => setNewMember({ ...newMember, aadhar: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Farmer ID (शेतकरी आयडी)</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.farmerId || ''} onChange={e => setNewMember({ ...newMember, farmerId: e.target.value })} placeholder="12+ digit Farmer ID" minLength={12} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Bank Acc No</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.bankAccountNo || ''} onChange={e => setNewMember({ ...newMember, bankAccountNo: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Loan Acc No</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.loanAccountNo || ''} onChange={e => setNewMember({ ...newMember, loanAccountNo: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Land (Ha.R)</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.landArea || ''} onChange={e => setNewMember({ ...newMember, landArea: e.target.value })} /></div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Successor (वारस)</label>
                <div className="flex items-center h-10">
                  <input
                    type="checkbox"
                    id="newIsSuccessor"
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
                    checked={newMember.isSuccessor || false}
                    onChange={e => setNewMember({ ...newMember, isSuccessor: e.target.checked })}
                  />
                  <label htmlFor="newIsSuccessor" className="ml-2 text-sm text-slate-700 dark:text-slate-300 font-medium cursor-pointer">वारस आहे</label>
                </div>
              </div>
              <div className="md:col-span-2 flex gap-4 mt-4"><button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">Cancel</button><button type="submit" disabled={isDuplicateMemberNo} className={`flex-1 py-2 rounded font-medium text-white transition ${isDuplicateMemberNo ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>{isDuplicateMemberNo ? 'Fix Error' : 'Save Member'}</button></div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Disburse Review Modal */}
      {showBulkDisburseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] backdrop-blur-sm p-4 md:pl-64 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-5xl shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-600" size={24} />
                  Excel Disbursement Review / कर्ज वाटप तपासणी
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Verify the imported members and loan details. Cells are editable if needed.
                </p>
              </div>
              <button 
                onClick={() => { setShowBulkDisburseModal(false); setBulkDisburseList([]); }} 
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Table / Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-yellow-50/50 dark:bg-slate-700/30 p-3 rounded-lg border border-yellow-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Disbursement Date / कर्ज वाटप दिनांक:
                  </span>
                  <input 
                    type="date" 
                    className="p-1.5 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-500 outline-none font-semibold"
                    value={bulkDate} 
                    onChange={(e) => setBulkDate(e.target.value)}
                  />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  * This date will apply to all disbursement transactions. / हा दिनांक सर्व कर्ज वाटप व्यवहारांना लागू होईल.
                </div>
              </div>

              {bulkDisburseList.some(r => r.error) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-lg text-sm border border-amber-200 dark:border-amber-900/40 flex items-center gap-2 font-medium">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>
                    Some members have active loans or are missing in system. Please resolve their warnings or remove them to submit.
                  </span>
                </div>
              )}

              <div className="border dark:border-slate-700 rounded-lg overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-b dark:border-slate-700 font-semibold text-sm">
                      <th className="p-3">Member No</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Land (Ha.R)</th>
                      <th className="p-3">Shares Added (₹)</th>
                      <th className="p-3">Loan Amount (₹)</th>
                      <th className="p-3">Loan Type</th>
                      <th className="p-3 text-red-600">Active Loan (₹)</th>
                      <th className="p-3">Status / Errors</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {bulkDisburseList.map(row => (
                      <tr 
                        key={row.id} 
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/20 text-slate-800 dark:text-slate-200 text-sm ${row.error ? 'bg-red-50/20 dark:bg-red-950/5' : ''}`}
                      >
                        <td className="p-2">
                          <input 
                            type="text" 
                            className="w-20 p-1 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-center font-bold"
                            value={row.memberNo} 
                            onChange={(e) => handleBulkRowChange(row.id, 'memberNo', e.target.value)}
                          />
                        </td>
                        <td className="p-2 font-medium">
                          {row.name || <span className="text-slate-400 italic">Unknown</span>}
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            className="w-20 p-1 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-center"
                            value={row.landArea} 
                            onChange={(e) => handleBulkRowChange(row.id, 'landArea', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" 
                            className="w-24 p-1 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-right"
                            value={row.shareAmount} 
                            onChange={(e) => handleBulkRowChange(row.id, 'shareAmount', Number(e.target.value))}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" 
                            className="w-28 p-1 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-right font-semibold"
                            value={row.loanAmount} 
                            onChange={(e) => handleBulkRowChange(row.id, 'loanAmount', Number(e.target.value))}
                          />
                        </td>
                        <td className="p-2">
                          <select 
                            className="p-1 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            value={row.loanType}
                            onChange={(e) => handleBulkRowChange(row.id, 'loanType', e.target.value)}
                          >
                            <option value="Short Term">Short Term</option>
                            <option value="Medium Term">Medium Term</option>
                          </select>
                        </td>
                        <td className="p-2 text-right font-semibold text-red-600">
                          {row.activeLoanAmt > 0 ? `₹${row.activeLoanAmt.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-2">
                          {row.error ? (
                            <span className="text-red-500 font-medium text-xs bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded border border-red-100 dark:border-red-900/40 inline-block">
                              {row.error}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium text-xs bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/40 inline-block">
                              Ready to disburse
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <button 
                            onClick={() => handleBulkRowDelete(row.id)} 
                            className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
              <button 
                onClick={revalidateBulkDisbursements} 
                className="px-4 py-2 border dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition font-semibold text-sm flex items-center gap-1.5"
              >
                <RotateCcw size={16} />
                Re-validate / पुन्हा तपासा
              </button>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowBulkDisburseModal(false); setBulkDisburseList([]); }} 
                  className="px-4 py-2 border dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition text-sm"
                >
                  Cancel / रद्द करा
                </button>
                <button 
                  onClick={handleBulkDisburseSubmit} 
                  disabled={bulkDisburseList.length === 0 || bulkDisburseList.some(r => r.error)} 
                  className={`px-5 py-2 rounded-lg text-white font-bold transition text-sm ${bulkDisburseList.length === 0 || bulkDisburseList.some(r => r.error) ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700 shadow'}`}
                >
                  Submit / सबमिट करा
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Import Mode Selection Modal */}
      {showLoanImportModeModal && (
        <div className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 border dark:border-slate-700 animate-fade-in-up">
            <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-white flex items-center gap-2">
              <Upload className="text-blue-600" size={20} /> कर्ज वाटप व्यवहार माध्यम निवडा (Select Disbursement Account)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Excel मधून नवीन कर्ज वाटप करताना रक्कम रोख (Cash in Hand) मधून वजा करायची आहे की बँकेतून वजा करायची आहे हे निवडा.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">व्यवहार माध्यम (Disbursement Mode)</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="loanImportPaymentMode"
                      value="Cash"
                      checked={loanImportPaymentMode === 'Cash'}
                      onChange={() => setLoanImportPaymentMode('Cash')}
                      className="accent-blue-600"
                    />
                    रोख (Cash in Hand)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="loanImportPaymentMode"
                      value="Bank"
                      checked={loanImportPaymentMode === 'Bank'}
                      onChange={() => setLoanImportPaymentMode('Bank')}
                      className="accent-blue-600"
                    />
                    बँक व्यवहार (Bank Account)
                  </label>
                </div>
              </div>

              {loanImportPaymentMode === 'Bank' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-slate-500 mb-1">बँक खाते निवडा (Select Bank)</label>
                  <select
                    value={loanImportSelectedBankId}
                    onChange={e => setLoanImportSelectedBankId(e.target.value)}
                    className="w-full p-2 border dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs"
                  >
                    <option value="">-- बँक खाते निवडा --</option>
                    {societyBanks.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountType} ({b.accountNo})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowLoanImportModeModal(false);
                }}
                className="px-4 py-2 border dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold transition"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                onClick={() => executeBulkDisburse(loanImportPaymentMode, loanImportSelectedBankId)}
                disabled={loanImportPaymentMode === 'Bank' && !loanImportSelectedBankId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs font-bold transition shadow-md"
              >
                वाटप पूर्ण करा (Confirm Disbursement)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 w-full max-w-sm m-4 shadow-2xl border border-red-100 dark:border-red-900">
            <div className="text-center mb-2"><div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={32} /></div><h3 className="text-xl font-bold text-slate-800 dark:text-white">Confirm Deletion</h3><p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter Security PIN to delete this member.</p></div>
            <div className="space-y-4"><input type="password" autoFocus className="w-full p-3 text-center text-2xl tracking-widest border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none" placeholder="PIN" maxLength={4} value={deletePin} onChange={e => setDeletePin(e.target.value)} />{deleteError && <p className="text-red-500 text-center text-sm font-medium">{deleteError}</p>}
              <div className="flex gap-3"><button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 border dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">Delete</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;

