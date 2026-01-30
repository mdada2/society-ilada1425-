
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, User, Trash2, X, AlertTriangle, Download, Upload, Image as ImageIcon, FileSpreadsheet, Edit3, RotateCcw, ScanLine, Loader2, Camera, Share2, Filter, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Member } from '../types';
import { calculateLoanInterest } from '../utils/loanCalculator';
import { format } from 'date-fns';
import { scanIDCard } from '../services/ai';
import { downloadBlob, exportTSV } from '../utils/downloadUtils';

const Members = () => {
  const { members, addMember, deleteMember, settings, importMembers, updateMembers } = useApp();
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
    membershipDate: format(new Date(), 'yyyy-MM-dd')
  });

  // Real-time duplicate check
  const isDuplicateMemberNo = useMemo(() => {
    if (!newMember.memberNo) return false;
    return members.some(m => m.memberNo === newMember.memberNo);
  }, [newMember.memberNo, members]);

  // -- New Loan Tab State --
  const [activeTab, setActiveTab] = useState<'list' | 'new_loan'>('list');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [disbursementData, setDisbursementData] = useState<Record<string, { shareAmount: number, loanAmount: number, date: string, loanType: string }>>({});
  const [disbursedLog, setDisbursedLog] = useState<Set<string>>(new Set());

  // -- Disbursement Handlers --
  const handleDisbursementChange = (id: string, field: string, value: any) => {
    setDisbursementData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          shareAmount: 0,
          loanAmount: members.find(m => m.id === id)?.loanPrincipal || 0,
          date: format(new Date(), 'yyyy-MM-dd'),
          loanType: members.find(m => m.id === id)?.loanType || 'Short Term'
        }),
        [field]: value
      }
    }));
  };

  const handleSaveDisbursement = (id: string) => {
    const memberIndex = members.findIndex(m => m.id === id);
    if (memberIndex === -1) return;

    const data = disbursementData[id] || {
      shareAmount: 0,
      loanAmount: members[memberIndex].loanPrincipal || 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      loanType: members[memberIndex].loanType || 'Short Term'
    };

    const updatedMember = {
      ...members[memberIndex],
      shareBalance: (members[memberIndex].shareBalance || 0) + (data.shareAmount || 0),
      loanPrincipal: data.loanAmount,
      originalLoanDate: data.date,
      lastLoanCalculationDate: data.date,
      loanType: data.loanType as any
    };

    const newMembersList = [...members];
    newMembersList[memberIndex] = updatedMember;
    updateMembers(newMembersList);

    setDisbursedLog(prev => new Set(prev).add(id));
    // Optional: Add a transaction record here if needed in future
  };

  const generateDisbursementCSV = () => {
    const idsToExport = selectedMemberIds.filter(id => disbursedLog.has(id));
    if (idsToExport.length === 0) return null;

    const headers = ["Member No", "Name", "Total Share Balance", "Shares Added", "New Loan Principal", "Loan Date", "Loan Type"];
    const rows = idsToExport.map(id => {
      const m = members.find(x => x.id === id);
      if (!m) return [];
      const data = disbursementData[id] || {};
      return [
        m.memberNo, m.name, m.shareBalance, data.shareAmount || 0, m.loanPrincipal,
        m.originalLoanDate, m.loanType
      ];
    }).filter(row => row.length > 0);

    // Return headers and rows for TSV export
    return { headers, rows };
  };

  const handleExportDisbursedList = () => {
    const data = generateDisbursementCSV();
    if (!data) { alert("No disbursed members to export. Please 'Save' at least one loan."); return; }

    // Use shared TSV utility for better Marathi text compatibility
    exportTSV(data.headers, data.rows, `Loan_Disbursement_${format(new Date(), 'dd-MM-yyyy')}`);
  };

  const handleShareDisbursedList = async () => {
    const data = generateDisbursementCSV();
    if (!data) { alert("No disbursed members to share."); return; }

    // Generate TSV content for sharing
    const tsvContent = [
      data.headers.join('\t'),
      ...data.rows.map(row => row.join('\t'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/csv;charset=utf-8' });
    const file = new File([blob], `Loan_Disbursement_${format(new Date(), 'dd-MM-yyyy')}.csv`, { type: 'text/csv' });

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
      searchText: `${m.name} ${m.memberNo} ${m.mobile}`.toLowerCase()
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
        // Current FY borrowers ONLY - members with loans from current FY (01-04-2025 to 31-03-2026)
        // Exclude defaulters from previous years
        const hasLoan = (m.loanPrincipal || 0) > 0;
        if (!hasLoan) {
          matchesStatus = false;
        } else {
          // Check if loan is from current FY
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate;
          if (loanDate) {
            const fyStart = new Date('2025-04-01');
            const fyEnd = new Date('2026-03-31');
            const loanDateObj = new Date(loanDate);
            // Include ONLY current FY loans
            matchesStatus = loanDateObj >= fyStart && loanDateObj <= fyEnd;
          } else {
            matchesStatus = false; // No date info - exclude
          }
        }
      } else if (filterStatus === 'Defaulters') {
        // TRUE Defaulters - members with outstanding loans from BEFORE current FY
        // Exclude current FY (01-04-2025 to 31-03-2026) - they are regular borrowers, not defaulters
        const hasOutstanding = (m.loanPrincipal || 0) > 0 || (m.loanInterestDue || 0) > 0;
        if (!hasOutstanding) {
          matchesStatus = false;
        } else {
          // Check if loan is from current FY
          const loanDate = m.originalLoanDate || m.lastLoanCalculationDate;
          if (loanDate) {
            const fyStart = new Date('2025-04-01');
            const fyEnd = new Date('2026-03-31');
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

      // In New Loan tab, only show members who DON'T have an outstanding loan
      if (activeTab === 'new_loan') {
        const hasNoOutstanding = (m.loanPrincipal || 0) <= 0 && (m.loanInterestDue || 0) <= 0;
        return matchesVillage && matchesCategory && matchesStatus && matchesFarmerType && hasNoOutstanding && m.isActive;
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
    setNewMember({ category: 'OPEN', gender: 'Male', farmerType: 'Small Farmer', designation: 'शेतकरी', photoUrl: '', membershipDate: format(new Date(), 'yyyy-MM-dd') });
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
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const extractedData = await scanIDCard(base64);

      if (extractedData) {
        setNewMember(prev => ({
          ...prev,
          name: extractedData.name || prev.name,
          dob: extractedData.dob || prev.dob,
          aadhar: extractedData.idNo || prev.aadhar,
          gender: extractedData.gender || prev.gender
        }));
        alert("ID Scanned! Details auto-filled.");
      } else {
        alert("Could not scan ID. Please fill details manually.");
      }
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
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

  const handleExportMembers = () => {
    const membersToExport = filteredMembers;
    if (membersToExport.length === 0) { alert("No members found to export."); return; }

    const headers = [
      "Member No", "Name", "Designation", "Gender", "Village", "Membership Date", "Mobile", "Category", "DOB", "Aadhar",
      "Savings Balance", "Share Balance", "Original Loan Principal", "Original Loan Date", "Last Loan Principal", "Last Payment Date", "Loan Interest Due (Total)", "Loan Account No", "Loan Type", "Farmer Type", "FD Balance"
    ];

    const formatDateCSV = (d?: string) => {
      if (!d) return '';
      try { return format(new Date(d), 'dd-MM-yyyy'); } catch (e) { return d; }
    };

    const todayStr = new Date().toISOString().split('T')[0];

    const rows = membersToExport.map(m => {
      let totalInterest = m.loanInterestDue;
      if (m.loanPrincipal > 0) {
        const lastDate = m.lastLoanCalculationDate || '2022-04-01';
        const { interest: accrued } = calculateLoanInterest(m.loanPrincipal, lastDate, todayStr, settings.financialYearStart, settings.financialYearEnd, true, m.originalLoanDate);
        totalInterest += accrued;
      }
      // Calculate original loan principal from transaction history if available
      const originalPrincipal = m.originalLoanDate ? m.loanPrincipal : 0; // Simplified - could be enhanced with transaction history
      return [
        m.memberNo, m.name, m.designation || 'शेतकरी', m.gender || 'Male', m.village,
        formatDateCSV(m.membershipDate), `'${m.mobile}`, m.category, formatDateCSV(m.dob), `'${m.aadhar}`,
        m.savingsBalance, m.shareBalance, originalPrincipal, formatDateCSV(m.originalLoanDate),
        m.loanPrincipal || 0, formatDateCSV(m.lastLoanCalculationDate), totalInterest,
        `'${m.loanAccountNo || ''}`, m.loanType || 'Short Term', m.farmerType || 'Small Farmer', m.fdBalance
      ];
    });

    exportTSV(headers, rows, `Members_List_${format(new Date(), 'dd-MM-yyyy')}`);
  };

  const handleShareMembers = async () => {
    const membersToExport = filteredMembers;
    if (membersToExport.length === 0) { alert("No members to share."); return; }

    const headers = [
      "Member No", "Name", "Designation", "Gender", "Village", "Membership Date", "Mobile", "Category", "DOB", "Aadhar",
      "Savings Balance", "Share Balance", "Original Loan Principal", "Original Loan Date", "Last Loan Principal", "Last Payment Date", "Loan Interest Due (Total)", "Loan Account No", "Loan Type", "Farmer Type", "FD Balance"
    ];

    const formatDateCSV = (d?: string) => {
      if (!d) return '';
      try { return format(new Date(d), 'dd-MM-yyyy'); } catch (e) { return d; }
    };

    const todayStr = new Date().toISOString().split('T')[0];

    const rows = membersToExport.map(m => {
      let totalInterest = m.loanInterestDue;
      if (m.loanPrincipal > 0) {
        const lastDate = m.lastLoanCalculationDate || '2022-04-01';
        const { interest: accrued } = calculateLoanInterest(m.loanPrincipal, lastDate, todayStr, settings.financialYearStart, settings.financialYearEnd, true, m.originalLoanDate);
        totalInterest += accrued;
      }
      // Calculate original loan principal from transaction history if available
      const originalPrincipal = m.originalLoanDate ? m.loanPrincipal : 0; // Simplified - could be enhanced with transaction history
      return [
        m.memberNo, m.name, m.designation || 'शेतकरी', m.gender || 'Male', m.village,
        formatDateCSV(m.membershipDate), `'${m.mobile}`, m.category, formatDateCSV(m.dob), `'${m.aadhar}`,
        m.savingsBalance, m.shareBalance, originalPrincipal, formatDateCSV(m.originalLoanDate),
        m.loanPrincipal || 0, formatDateCSV(m.lastLoanCalculationDate), totalInterest,
        `'${m.loanAccountNo || ''}`, m.loanType || 'Short Term', m.farmerType || 'Small Farmer', m.fdBalance
      ];
    });

    // Generate TSV content for sharing
    const tsvContent = [
      headers.join('\t'),
      ...rows.map(row => row.map(val => String(val ?? '')).join('\t'))
    ].join('\n');

    const fileName = `Members_List_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/csv;charset=utf-8;' });
    const file = new File([blob], fileName, { type: 'text/csv' });
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
    const headers = ["MemberNo", "Name", "Designation", "Gender", "Village", "MembershipDate", "Mobile", "Category", "DOB", "Aadhar", "OriginalLoanPrincipal", "OriginalLoanDate", "LastLoanPrincipal", "LastPaymentDate", "LoanInterestDue", "LoanAccountNo", "LoanType", "BankAccountNo", "LandArea", "SavingsBalance", "ShareBalance", "FDBalance"];
    const sampleRow = ["101", "Sample Name", "शेतकरी", "Male", "Ilada", "01-01-2022", "'9999999999", "OPEN", "01-01-1990", "'123456789012", "50000", "01-04-2024", "50000", "01-04-2024", "0", "'LN001", "Short Term", "'BANK001", "2.5", "0", "0", "0"];
    exportTSV(headers, [sampleRow], "Import_Template");
  };

  const parseNumberSafe = (val: string) => {
    if (!val) return 0;
    const clean = val.replace(/[,₹\s"]/g, '');
    return parseFloat(clean) || 0;
  };

  const parseDateSafe = (dateStr: string) => {
    if (!dateStr) return undefined;
    const clean = dateStr.trim().replace(/^"|"$/g, '');
    if (!clean) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const parts = clean.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return undefined;
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let csv = event.target?.result as string;
        csv = csv.replace(/^\uFEFF/, '');
        if (csv.includes('à') || csv.includes('ð') || csv.includes('Ã')) {
          try {
            const bytes = new Uint8Array(csv.length);
            for (let i = 0; i < csv.length; i++) bytes[i] = csv.charCodeAt(i);
            csv = new TextDecoder('utf-8').decode(bytes);
          } catch (err) { console.warn("Encoding repair failed."); }
        }
        const firstLine = csv.split('\n')[0];
        let delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
        const lines = csv.split(/\r?\n/);
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const findCol = (possibleNames: string[]) => headers.findIndex(h => possibleNames.includes(h));
        const idxMemberNo = findCol(['memberno', 'member no', 'no', 'id', 'no.']);
        const idxName = findCol(['name', 'membername', 'full name', 'fullname', 'member name']);
        if (idxMemberNo === -1 || idxName === -1) {
          alert(`Import Failed: Could not find 'MemberNo' or 'Name' columns.`);
          if (e.target) e.target.value = ''; return;
        }
        const idxGender = findCol(['gender', 'sex']);
        const idxDesignation = findCol(['designation', 'role', 'post', 'pad']);
        const idxVillage = findCol(['village', 'city', 'address']);
        const idxMembershipDate = findCol(['membershipdate', 'reg date', 'joining date']);
        const idxMobile = findCol(['mobile', 'phone', 'contact']);
        const idxCategory = findCol(['category', 'caste']);
        const idxDOB = findCol(['dob', 'date of birth', 'birthdate']);
        const idxAadhar = findCol(['aadhar', 'uid']);
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

        // Create map of existing members by Member Number for quick lookup
        const existingMembersMap = new Map<string, Member>(members.map(m => [m.memberNo, m]));

        // Track CSV internal duplicates
        const csvMemberNumbers = new Map<string, number>();

        // Statistics
        const stats = { added: 0, updated: 0, csvDuplicates: 0, total: 0 };

        const newMembers: Member[] = [];
        const updatedMembers: Member[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
          if (values.length < 2) continue;
          const memberNo = values[idxMemberNo];
          const name = values[idxName];
          if (!memberNo || !name) continue;

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
          const originalLoanDate = idxOriginalLoanDate !== -1 ? parseDateSafe(values[idxOriginalLoanDate]) : undefined;
          const lastPaymentDate = idxLastPaymentDate !== -1 ? parseDateSafe(values[idxLastPaymentDate]) : undefined;
          const membershipDate = idxMembershipDate !== -1 ? parseDateSafe(values[idxMembershipDate]) : undefined;
          const originalLoanPrincipal = idxOriginalLoanPrin !== -1 ? parseNumberSafe(values[idxOriginalLoanPrin]) : 0;
          const lastLoanPrincipal = idxLastLoanPrin !== -1 ? parseNumberSafe(values[idxLastLoanPrin]) : 0;

          // Check if member already exists
          const existingMember = existingMembersMap.get(memberNo);

          if (existingMember) {
            // Use type assertion since we've already checked that existingMember is truthy
            const existing = existingMember as Member;

            // Update only empty fields - preserve existing data
            const mergeField = (existingVal: any, newVal: any) => {
              // If existing value is empty/null/0, use new value
              if (existingVal === '' || existingVal === null || existingVal === undefined || existingVal === 0) {
                return newVal;
              }
              return existingVal; // Preserve existing data
            };

            const updatedMember: Member = {
              ...existing,
              name: mergeField(existing.name, name) as string,
              gender: mergeField(existing.gender, gender) as any,
              designation: mergeField(existing.designation, idxDesignation !== -1 ? (values[idxDesignation] || 'शेतकरी') : 'शेतकरी') as string,
              village: mergeField(existing.village, idxVillage !== -1 ? (values[idxVillage] || '') : '') as string,
              membershipDate: mergeField(existing.membershipDate, membershipDate) as string | undefined,
              mobile: mergeField(existing.mobile, idxMobile !== -1 ? (values[idxMobile] || '') : '') as string,
              category: mergeField(existing.category, idxCategory !== -1 ? ((values[idxCategory] || 'OPEN') as any) : 'OPEN') as any,
              dob: mergeField(existing.dob, idxDOB !== -1 ? (values[idxDOB] || '') : '') as string,
              aadhar: mergeField(existing.aadhar, idxAadhar !== -1 ? (values[idxAadhar] || '') : '') as string,
              bankAccountNo: mergeField(existing.bankAccountNo, idxBankAcc !== -1 ? (values[idxBankAcc] || '') : '') as string,
              landArea: mergeField(existing.landArea, idxLand !== -1 ? (values[idxLand] || '') : '') as string,
              loanAccountNo: mergeField(existing.loanAccountNo, idxLoanAcc !== -1 ? (values[idxLoanAcc] || '') : '') as string,
              loanType: mergeField(existing.loanType, parsedLoanType || 'Short Term') as any,
              loanPrincipal: mergeField(existing.loanPrincipal, lastLoanPrincipal || originalLoanPrincipal) as number,
              loanInterestDue: mergeField(existing.loanInterestDue, idxLoanInterest !== -1 ? parseNumberSafe(values[idxLoanInterest]) : 0) as number,
              lastLoanCalculationDate: mergeField(existing.lastLoanCalculationDate, lastPaymentDate || originalLoanDate) as string | undefined,
              originalLoanDate: mergeField(existing.originalLoanDate, originalLoanDate) as string | undefined,
              savingsBalance: mergeField(existing.savingsBalance, idxSavings !== -1 ? parseNumberSafe(values[idxSavings]) : 0) as number,
              shareBalance: mergeField(existing.shareBalance, idxShare !== -1 ? parseNumberSafe(values[idxShare]) : 0) as number,
              fdBalance: mergeField(existing.fdBalance, idxFD !== -1 ? parseNumberSafe(values[idxFD]) : 0) as number,
            };
            updatedMembers.push(updatedMember);
            stats.updated++;
          } else {
            // Add new member
            const newM: Member = {
              id: Date.now().toString() + i + Math.random().toString(36).substr(2, 5),
              memberNo: memberNo, name: name, gender: gender as any,
              designation: idxDesignation !== -1 ? (values[idxDesignation] || 'शेतकरी') : 'शेतकरी',
              village: idxVillage !== -1 ? (values[idxVillage] || '') : '',
              membershipDate: membershipDate, mobile: idxMobile !== -1 ? (values[idxMobile] || '') : '',
              category: idxCategory !== -1 ? ((values[idxCategory] || 'OPEN') as any) : 'OPEN',
              dob: idxDOB !== -1 ? (values[idxDOB] || '') : '',
              aadhar: idxAadhar !== -1 ? (values[idxAadhar] || '') : '',
              bankAccountNo: idxBankAcc !== -1 ? (values[idxBankAcc] || '') : '',
              landArea: idxLand !== -1 ? (values[idxLand] || '') : '',
              loanAccountNo: idxLoanAcc !== -1 ? (values[idxLoanAcc] || '') : '',
              loanType: parsedLoanType || 'Short Term', farmerType: 'Small Farmer',
              loanPrincipal: lastLoanPrincipal || originalLoanPrincipal,
              lastLoanCalculationDate: lastPaymentDate || originalLoanDate, originalLoanDate: originalLoanDate,
              loanInterestDue: idxLoanInterest !== -1 ? parseNumberSafe(values[idxLoanInterest]) : 0, savingsBalance: idxSavings !== -1 ? parseNumberSafe(values[idxSavings]) : 0,
              shareBalance: idxShare !== -1 ? parseNumberSafe(values[idxShare]) : 0,
              fdBalance: idxFD !== -1 ? parseNumberSafe(values[idxFD]) : 0,
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
          const summaryLines = [
            '📊 Import Complete!',
            '',
            `✅ ${stats.added} नवीन सभासद जोडले (New members added)`,
            `🔄 ${stats.updated} सभासद अपडेट केले (Existing members updated)`,
            stats.csvDuplicates > 0 ? `⚠️ ${stats.csvDuplicates} डुप्लिकेट rows वगळले (Duplicate rows skipped)` : '',
            '',
            `📈 एकूण ${stats.total} rows processed`
          ].filter(line => line !== '').join('\n');

          alert(summaryLines);
        } else {
          // Better error message with debugging info
          const debugInfo = [
            '❌ Import Failed: No valid member data found.',
            '',
            'Please check:',
            '✓ CSV has "MemberNo" and "Name" columns',
            '✓ At least one row with data (not just headers)',
            '✓ MemberNo and Name are not empty',
            '',
            `Rows in file: ${lines.length}`,
            `Delimiter detected: "${delimiter}"`
          ].join('\n');

          alert(debugInfo);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse CSV.");
      }
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 pb-24">
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
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
            <Upload size={18} /> <span className="hidden sm:inline">Import CSV</span>
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>

          <button onClick={handleShareMembers} className="bg-purple-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition shadow-sm text-sm">
            <Share2 size={18} /> <span className="hidden sm:inline">Share</span>
          </button>

          <button onClick={handleExportMembers} className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition shadow-sm text-sm">
            <Download size={18} /> <span className="hidden sm:inline">Export</span>
          </button>

          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm text-sm">
            <Plus size={18} /> <span className="hidden sm:inline">Add Member</span>
          </button>
        </div>
      </div>

      {/* Smart Search & Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 mb-6 flex gap-3 items-center">
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
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-full max-w-md shadow-2xl animate-fade-in-up border dark:border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b dark:border-slate-700 pb-3">
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
                  <option value="">All Categories</option><option value="OPEN">OPEN</option><option value="OBC">OBC</option><option value="SC">SC</option><option value="ST">ST</option></select></div>
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
      <div className="flex gap-4 mb-6 border-b dark:border-slate-700">
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
      </div>

      {/* Tabs Content */}
      {activeTab === 'list' ? (
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
      ) : (
        <div className="space-y-6">
          {/* New Loan Selection Section */}
          <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-4 flex items-center gap-2">
              <div className="bg-yellow-100 dark:bg-yellow-800 p-1.5 rounded-lg"><Plus size={18} /></div> Select Members for Loan Disbursement / कर्ज वाटपासाठी सभासद निवडा
            </h3>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700 overflow-hidden max-h-[400px] overflow-y-auto overflow-x-auto mobile-scroll">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700 shadow-sm">
                  <tr>
                    <th className="p-3 w-10"><input type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMemberIds(filteredMembers.map(m => m.id));
                        else setSelectedMemberIds([]);
                      }}
                      checked={filteredMembers.length > 0 && selectedMemberIds.length === filteredMembers.length}
                    /></th>
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
                    return (
                      <tr key={m.id} className={`border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        onClick={() => {
                          if (isSelected) setSelectedMemberIds(prev => prev.filter(id => id !== m.id));
                          else setSelectedMemberIds(prev => [...prev, m.id]);
                        }}
                      >
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => {
                            if (isSelected) setSelectedMemberIds(prev => prev.filter(id => id !== m.id));
                            else setSelectedMemberIds(prev => [...prev, m.id]);
                          }} />
                        </td>
                        <td className={`p-3 ${isDisbursed ? 'text-emerald-600 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>{m.memberNo}</td>
                        <td className={`p-3 font-medium ${isDisbursed ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                          {m.name} {isDisbursed && '(Disbursed)'}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{m.village}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">₹{m.loanPrincipal.toLocaleString()}</td>
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
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-indigo-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-slate-800 dark:text-white">Loan Disbursement Details</h3>
                <div className="flex gap-2">
                  <button onClick={handleExportDisbursedList} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition">
                    <FileSpreadsheet size={18} /> Export List
                  </button>
                  <button onClick={handleShareDisbursedList} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition">
                    <Share2 size={18} /> Share List
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 text-sm border-b dark:border-slate-700">
                      <th className="pb-3 pl-2">Name</th>
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
                        loanAmount: member.loanPrincipal || 0, // Default to existing or 0
                        date: format(new Date(), 'yyyy-MM-dd'),
                        loanType: member.loanType || 'Short Term'
                      };
                      const isSaved = disbursedLog.has(id);

                      return (
                        <tr key={id} className={`group ${isSaved ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                          <td className={`py-3 pl-2 font-medium ${isSaved ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {member.name}
                            <div className="text-xs text-slate-400 font-normal">#{member.memberNo} | Cur shares: ₹{member.shareBalance}</div>
                          </td>
                          <td className="py-3 pr-2">
                            <input type="number"
                              value={data.shareAmount || ''}
                              placeholder="0"
                              onChange={e => handleDisbursementChange(id, 'shareAmount', parseFloat(e.target.value))}
                              className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <input type="number"
                              value={data.loanAmount || ''}
                              placeholder="Principal"
                              onChange={e => handleDisbursementChange(id, 'loanAmount', parseFloat(e.target.value))}
                              className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <input type="date"
                              value={data.date}
                              onChange={e => handleDisbursementChange(id, 'date', e.target.value)}
                              className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <select value={data.loanType} onChange={e => handleDisbursementChange(id, 'loanType', e.target.value)}
                              className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                              <option>Short Term</option>
                              <option>Medium Term</option>
                            </select>
                          </td>
                          <td className="py-3">
                            <button onClick={() => handleSaveDisbursement(id)} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition ${isSaved ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
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

      {/* Members List (Original - Hidden when tab is new_loan) */}


      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto shadow-2xl border dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
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
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Full Name *</label><input required type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.name || ''} onChange={e => setNewMember({ ...newMember, name: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Member No *</label><input required type="text" className={`w-full p-2 border rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${isDuplicateMemberNo ? 'border-red-500 focus:ring-red-500' : 'dark:border-slate-600'}`} value={newMember.memberNo || ''} onChange={e => setNewMember({ ...newMember, memberNo: e.target.value })} />{newMember.memberNo && isDuplicateMemberNo && <div className="flex items-center gap-1 text-red-500 text-xs mt-1 font-medium animate-pulse"><AlertTriangle size={12} /> Member No already exists!</div>}</div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Membership Date</label><input type="date" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.membershipDate || ''} onChange={e => setNewMember({ ...newMember, membershipDate: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Gender *</label><select className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.gender} onChange={e => setNewMember({ ...newMember, gender: e.target.value as any })}><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Designation *</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.designation || 'शेतकरी'} onChange={e => setNewMember({ ...newMember, designation: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Village *</label><input required type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.village || ''} onChange={e => setNewMember({ ...newMember, village: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Mobile</label><input type="tel" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.mobile || ''} onChange={e => setNewMember({ ...newMember, mobile: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Date of Birth</label><input type="date" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.dob || ''} onChange={e => setNewMember({ ...newMember, dob: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Category</label><select className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.category} onChange={e => setNewMember({ ...newMember, category: e.target.value as any })}><option value="OPEN">OPEN</option><option value="OBC">OBC</option><option value="SC">SC</option><option value="ST">ST</option></select></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Farmer Type</label><select className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.farmerType || 'Small Farmer'} onChange={e => setNewMember({ ...newMember, farmerType: e.target.value as any })}><option value="Small Farmer">Small Farmer (लघु कृषक)</option><option value="Large Farmer">Large Farmer (मोठे कृषक)</option></select></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Aadhar No</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.aadhar || ''} onChange={e => setNewMember({ ...newMember, aadhar: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Bank Acc No</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.bankAccountNo || ''} onChange={e => setNewMember({ ...newMember, bankAccountNo: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Loan Acc No</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.loanAccountNo || ''} onChange={e => setNewMember({ ...newMember, loanAccountNo: e.target.value })} /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Land (Ha.R)</label><input type="text" className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newMember.landArea || ''} onChange={e => setNewMember({ ...newMember, landArea: e.target.value })} /></div>
              <div className="md:col-span-2 flex gap-4 mt-4"><button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">Cancel</button><button type="submit" disabled={isDuplicateMemberNo} className={`flex-1 py-2 rounded font-medium text-white transition ${isDuplicateMemberNo ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>{isDuplicateMemberNo ? 'Fix Error' : 'Save Member'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm m-4 shadow-2xl border border-red-100 dark:border-red-900">
            <div className="text-center mb-6"><div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={32} /></div><h3 className="text-xl font-bold text-slate-800 dark:text-white">Confirm Deletion</h3><p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter Security PIN to delete this member.</p></div>
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
