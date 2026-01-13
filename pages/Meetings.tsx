
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, getDay } from 'date-fns';
import { Handshake, Calendar, Users, FileText, Plus, Trash2, Save, X, Briefcase, UserPlus, UserMinus, Search, CheckSquare, Square, Edit, AlertTriangle, ShieldCheck, Printer, Download, Banknote, MapPin, Crown, Award, Share2, FileSpreadsheet, Settings2, Check, BellRing, ClipboardList, Mail, Eye, Loader2, Clock } from 'lucide-react';
import { Meeting, Member } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { downloadBlob } from '../utils/downloadUtils';
import { loadDVOTFont } from '../utils/fontLoader';
import { Capacitor } from '@capacitor/core';

const MARATHI_DAYS = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
const SOCIETY_FULL_NAME = "आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं. १४२५";

const Meetings = () => {
  const { meetings, addMeeting, updateMeeting, deleteMeeting, members, settings, updateSettings, updateMember } = useApp();
  const { chairmanId, viceChairmanIds } = settings;
  const currentViceChairmanIds = viceChairmanIds || [];

  // Tab State
  const [activeTab, setActiveTab] = useState<'records' | 'board' | 'allowance' | 'notice'>('records');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0 });

  // Delete Security State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Meeting Form State
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [venue, setVenue] = useState('');
  const [type, setType] = useState<Meeting['type']>('Monthly');
  const [attendeesCount, setAttendeesCount] = useState(0);
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [resolutions, setResolutions] = useState('');

  // Board Management State
  const [boardSearch, setBoardSearch] = useState('');

  // Allowance State
  const [allowanceMeetingId, setAllowanceMeetingId] = useState<string>('');
  const [isEditingRates, setIsEditingRates] = useState(false);
  const [rates, setRates] = useState({
    travel: settings.allowanceSettings?.travelAllowance || 100,
    incidental: settings.allowanceSettings?.incidentalExpenses || 50,
    fee: settings.allowanceSettings?.meetingFee || 200
  });

  // --- Notice State ---
  const [noticeOutwardPrefix, setNoticeOutwardPrefix] = useState('६३७');
  const [noticeDate, setNoticeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [noticeRecipientId, setNoticeRecipientId] = useState('');
  const [noticeMeetingType, setNoticeMeetingType] = useState('साधारण सभा');
  const [noticeMeetingDate, setNoticeMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [noticeMeetingDay, setNoticeMeetingDay] = useState('गुरुवार');
  const [noticeMeetingTime, setNoticeMeetingTime] = useState('०८:३०');
  const [noticeMeetingTimePeriod, setNoticeMeetingTimePeriod] = useState('सकाळी'); // New Period State
  const [noticeMeetingVenue, setNoticeMeetingVenue] = useState('संस्थेच्या कार्यालयात');
  const [noticeAgenda, setNoticeAgenda] = useState<string>(
    "मागील सभेचे इतिवृत्त वाचून कायम करणे.\nमाहे ऑक्टोबर २०२५ चा जमाखर्च वाचून मंजूर करणे.\nआधारभूत धान खरेदी करीता संस्थेला धान खरेदीस मंजुरी मिळणेबाबत.\nशासकिय परिपत्रकाचे वाचन करणे.\nमा. अध्यक्षाच्या परवानगीने वेळेवर येणाऱ्या विषयांवर चर्चा करणे."
  );
  const [noticeMainBody, setNoticeMainBody] = useState('या नोटीसाद्वारे आपणास कळविण्यात येते की, संस्थेच्या व्यवस्थापकीय संचालक मंडळाची [सभेचा प्रकार] दिनांक [तारीख] रोज [वार] ला [वेळ] वाजता [स्थळ] होईल तरी सभेला आपण वेळेवर उपस्थित राहावे ही विनंती.');

  const noticePrintRef = useRef<HTMLDivElement>(null);
  const allowanceRef = useRef<HTMLDivElement>(null);

  // Helper for Marathi Numbers
  const toMarathiNumber = (n: any) => {
    if (!n) return '';
    const marathiDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return n.toString().split('').map((digit: string) => {
      const idx = parseInt(digit);
      return isNaN(idx) ? digit : marathiDigits[idx];
    }).join('');
  };

  // Helper to convert English Time to Marathi Display
  const formatTimeMarathi = (timeStr: string) => {
    if (!timeStr) return '';
    return toMarathiNumber(timeStr);
  };

  // Helper to normalize Marathi digits to English digits for form validation
  const normalizeMarathiDigits = (value: string) => {
    if (!value) return '';
    return value.replace(/[०-९]/g, d => "०१२३४५६७८९".indexOf(d).toString());
  };

  // Helper to get display designation
  const getDisplayDesignation = (m: Member) => {
    if (m.id === chairmanId) return 'अध्यक्ष';
    if (currentViceChairmanIds.includes(m.id)) return 'उपाध्यक्ष';
    return m.gender === 'Female' ? 'संचालिका' : 'संचालक';
  };

  // Derived Notice Outward No
  const noticeOutwardNo = useMemo(() => {
    const d = new Date(noticeDate);
    const year = !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
    return `${noticeOutwardPrefix}/${toMarathiNumber(year)}`;
  }, [noticeOutwardPrefix, noticeDate]);

  // Logic for Board Members
  const boardMemberIds = new Set(settings.boardMembers || []);

  const currentDirectors = useMemo<Member[]>(() => {
    const directors = members.filter(m => boardMemberIds.has(m.id));
    return directors.sort((a, b) => {
      if (a.id === chairmanId) return -1;
      if (b.id === chairmanId) return 1;
      const aIndex = currentViceChairmanIds.indexOf(a.id);
      const bIndex = currentViceChairmanIds.indexOf(b.id);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [members, settings.boardMembers, chairmanId, currentViceChairmanIds]);

  // Get selected recipient for notice preview
  const selectedRecipient = useMemo(() => {
    if (!noticeRecipientId && currentDirectors.length > 0) return currentDirectors[0];
    return currentDirectors.find(d => d.id === noticeRecipientId) || currentDirectors[0];
  }, [noticeRecipientId, currentDirectors]);

  // Set default recipient to first director (chairman)
  useEffect(() => {
    if (currentDirectors.length > 0 && !noticeRecipientId) {
      setNoticeRecipientId(currentDirectors[0].id);
    }
  }, [currentDirectors, noticeRecipientId]);

  const toggleDirectorStatus = (memberId: string) => {
    const currentIds = settings.boardMembers || [];
    let newIds;
    if (currentIds.includes(memberId)) {
      newIds = currentIds.filter(id => id !== memberId);
      if (memberId === chairmanId) updateSettings({ chairmanId: '' });
      if (currentViceChairmanIds.includes(memberId)) {
        updateSettings({ viceChairmanIds: currentViceChairmanIds.filter(id => id !== memberId) });
      }
    } else {
      newIds = [...currentIds, memberId];
    }
    updateSettings({ boardMembers: newIds });
  };

  const handleRoleUpdate = (role: 'chairman' | 'viceChairman1' | 'viceChairman2', id: string) => {
    if (role === 'chairman') updateSettings({ chairmanId: id });
    else {
      const newIds = [...currentViceChairmanIds];
      if (role === 'viceChairman1') newIds[0] = id;
      if (role === 'viceChairman2') newIds[1] = id;
      updateSettings({ viceChairmanIds: newIds.filter(Boolean) });
    }
  };

  // Allowance Calculation Logic
  const allowanceData = useMemo(() => {
    const meeting = meetings.find(m => m.id === allowanceMeetingId);
    if (!meeting || !meeting.attendees) return [];
    const rows = meeting.attendees.map(attendeeName => {
      const member = members.find(m => m.name === attendeeName);
      const role = member ? getDisplayDesignation(member) : 'संचालक';
      let sort = 3;
      if (role === 'अध्यक्ष') sort = 0;
      else if (role === 'उपाध्यक्ष') sort = 1;

      return {
        name: attendeeName,
        designation: role,
        sortOrder: sort,
        village: member?.village || '-',
        venue: meeting.venue || 'संस्थेच्या कार्यालयात',
        days: 1,
        travel: rates.travel,
        incidental: rates.incidental,
        fee: rates.fee,
        total: rates.travel + rates.incidental + rates.fee
      };
    });
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [allowanceMeetingId, meetings, members, rates, chairmanId, currentViceChairmanIds]);

  const allowanceTotal = allowanceData.reduce((sum, item) => sum + item.total, 0);

  useEffect(() => {
    if (chairmanId && !noticeRecipientId) {
      setNoticeRecipientId(chairmanId);
    }
  }, [chairmanId, activeTab]);

  useEffect(() => {
    if (noticeMeetingDate) {
      const dateObj = new Date(noticeMeetingDate);
      if (!isNaN(dateObj.getTime())) {
        const dayIndex = getDay(dateObj);
        setNoticeMeetingDay(MARATHI_DAYS[dayIndex]);
      }
    }
  }, [noticeMeetingDate]);

  useEffect(() => {
    if (settings.allowanceSettings) {
      setRates({
        travel: settings.allowanceSettings.travelAllowance,
        incidental: settings.allowanceSettings.incidentalExpenses,
        fee: settings.allowanceSettings.meetingFee
      });
    }
  }, [settings.allowanceSettings]);

  const formatDateMarathi = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${toMarathiNumber(parts[2])}/${toMarathiNumber(parts[1])}/${toMarathiNumber(parts[0])}`;
  };

  const getProcessedNoticeBody = () => {
    const timeDisplay = `${noticeMeetingTimePeriod} ${formatTimeMarathi(noticeMeetingTime)}`;
    return noticeMainBody
      .replace('[सभेचा प्रकार]', `<strong>${noticeMeetingType}</strong>`)
      .replace('[तारीख]', `<strong>${formatDateMarathi(noticeMeetingDate)}</strong>`)
      .replace('[वार]', `<strong>${noticeMeetingDay}</strong>`)
      .replace('[वेळ]', `<strong>${timeDisplay}</strong>`)
      .replace('[स्थळ]', `<strong>${noticeMeetingVenue}</strong>`);
  };

  const agendaItems = useMemo(() => {
    return noticeAgenda.split('\n').filter(line => line.trim() !== '');
  }, [noticeAgenda]);

  // Signature Page Template
  const renderSignaturePageTemplate = () => {
    const el = document.createElement('div');
    el.style.width = '210mm';
    el.style.height = '297mm';
    el.style.padding = '15mm';
    el.style.fontFamily = "'DVOT SurekhMR', serif";
    el.style.backgroundColor = 'white';
    el.style.color = 'black';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';

    // Sort directors for signature page: Chairman, Vice-chairmen, Male directors, Female directors (संचालिका at bottom)
    const sortedDirectors = [...currentDirectors].sort((a, b) => {
      // Chairman first
      if (a.id === chairmanId) return -1;
      if (b.id === chairmanId) return 1;

      // Vice-chairmen next
      const aIndex = currentViceChairmanIds.indexOf(a.id);
      const bIndex = currentViceChairmanIds.indexOf(b.id);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Female directors (संचालिका) at the bottom
      if (a.gender === 'Female' && b.gender !== 'Female') return 1;
      if (a.gender !== 'Female' && b.gender === 'Female') return -1;

      // Otherwise sort by name
      return a.name.localeCompare(b.name);
    });

    const tableRows = sortedDirectors.map((d, i) => `
        <tr>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">${toMarathiNumber(i + 1)}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: left; font-weight: bold;">${d.name}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">${d.village}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">${getDisplayDesignation(d)}</td>
            <td style="border: 1px solid black; padding: 8px; height: 40px;"></td>
        </tr>
      `).join('');

    el.innerHTML = `
        <div style="text-align: center; border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 10px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: bold;">${SOCIETY_FULL_NAME}</h1>
            <p style="margin: 5px 0; font-size: 14px; font-weight: bold;">नोटीस मिळाल्याची स्वाक्षरी यादी (पावती रजिस्टर)</p>
        </div>
        
        <div style="margin-bottom: 20px; font-size: 14px; display: flex; justify-content: space-between; font-weight: bold; background: #f3f4f6; padding: 10px; border-radius: 5px; border: 1px solid #ccc;">
            <span>सभेचा प्रकार: ${noticeMeetingType}</span>
            <span>तारीख: ${formatDateMarathi(noticeMeetingDate)}</span>
            <span>वेळ: ${noticeMeetingTimePeriod} ${formatTimeMarathi(noticeMeetingTime)}</span>
            <span>वार: ${noticeMeetingDay}</span>
        </div>

        <p style="margin-bottom: 20px; font-size: 14px; text-indent: 30px; line-height: 1.6; text-align: justify;">
            संस्थेच्या संचालक मंडळाची वरील दिवशी व वेळी आयोजित केलेल्या सभेची नोटीस आम्हाला खालीलप्रमाणे प्रत्यक्ष वेळेत व स्वरूपात मिळाली असून आम्ही सभेला उपस्थित राहण्याचे मान्य करीत आहोत.
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="background-color: #eee;">
                    <th style="border: 1px solid black; padding: 10px; width: 40px;">अ.क्र.</th>
                    <th style="border: 1px solid black; padding: 10px; text-align: left;">संचालकाचे नाव</th>
                    <th style="border: 1px solid black; padding: 10px; width: 100px;">गाव</th>
                    <th style="border: 1px solid black; padding: 10px; width: 100px;">पद</th>
                    <th style="border: 1px solid black; padding: 10px; width: 250px;">स्वाक्षरी</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>

        <div style="margin-top: auto; padding-top: 60px; display: flex; justify-content: space-between; text-align: center; font-weight: bold;">
            <div style="width: 40%;">
                <p>सचिव</p>
                <p style="margin-top: 30px;">_________________</p>
                <p style="font-size: 9px; margin-top: 5px;">${SOCIETY_FULL_NAME}</p>
            </div>
            <div style="width: 40%;">
                <p>अध्यक्ष</p>
                <p style="margin-top: 30px;">_________________</p>
                <p style="font-size: 9px; margin-top: 5px;">${SOCIETY_FULL_NAME}</p>
            </div>
        </div>
      `;
    return el;
  };

  const handlePrintAllNotices = async () => {
    if (currentDirectors.length === 0) {
      alert("कृपया प्रथम 'Directors' टॅबमध्ये जाऊन संचालक निवडा.");
      return;
    }

    setIsPrinting(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');

      // Load and embed DVOT SurekhMR font
      try {
        await loadDVOTFont(pdf);
        pdf.setFont('DVOT SurekhMR', 'normal');
      } catch (fontError) {
        console.warn('Could not load custom font, using default:', fontError);
      }

      const directors = [...currentDirectors];
      const totalPages = Math.ceil(directors.length / 2) + 1; // +1 for signature page

      setPrintProgress({ current: 0, total: totalPages });

      // Platform-specific canvas options
      const canvasOptions = {
        scale: Capacitor.isNativePlatform() ? 1.5 : 2,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff',
        allowTaint: false
      };

      const printContainer = document.createElement('div');
      printContainer.style.position = 'fixed';
      printContainer.style.top = '-10000px';
      printContainer.style.left = '-10000px';
      document.body.appendChild(printContainer);

      // Process notices in pairs (2 per page)
      for (let i = 0; i < directors.length; i += 2) {
        const container = document.createElement('div');
        container.style.width = '297mm';
        container.style.height = '210mm';
        container.style.display = 'flex';
        container.style.backgroundColor = 'white';
        container.style.padding = '5mm';
        container.style.gap = '5mm';

        const n1 = renderSingleNoticeTemplate(directors[i], true);
        container.appendChild(n1);

        if (directors[i + 1]) {
          const n2 = renderSingleNoticeTemplate(directors[i + 1], true);
          container.appendChild(n2);
        }

        printContainer.appendChild(container);

        // Update progress
        const currentPage = Math.floor(i / 2) + 1;
        setPrintProgress({ current: currentPage, total: totalPages });

        // Add small delay to prevent memory overflow on Android
        if (Capacitor.isNativePlatform() && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const canvas = await html2canvas(container, canvasOptions);
        printContainer.removeChild(container);

        if (i > 0) pdf.addPage();
        // Use JPEG with 0.7 quality to reduce file size significantly
        const imgData = canvas.toDataURL('image/jpeg', 0.7);
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
      }

      // Add signature page
      pdf.addPage();
      const sigOrientation = pdf.internal.pageSize.getWidth() < pdf.internal.pageSize.getHeight();
      if (!sigOrientation) {
        // Switch to portrait for signature page
        const currentPageCount = pdf.internal.pages.length - 1;
        pdf.deletePage(currentPageCount);
        pdf.addPage('portrait');
      }
      setPrintProgress({ current: totalPages, total: totalPages });

      const sigPageEl = renderSignaturePageTemplate();
      printContainer.appendChild(sigPageEl);

      if (Capacitor.isNativePlatform()) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const sigCanvas = await html2canvas(sigPageEl, canvasOptions);
      printContainer.removeChild(sigPageEl);

      // Use JPEG for signature page as well
      const sigImgData = sigCanvas.toDataURL('image/jpeg', 0.7);
      pdf.addImage(sigImgData, 'JPEG', 0, 0, 210, 297);

      document.body.removeChild(printContainer);
      const itemBlob = pdf.output('blob');
      await downloadBlob(itemBlob, `Meeting_Notices_Packet_${format(new Date(noticeMeetingDate), 'dd_MM_yyyy')}.pdf`);

    } catch (e) {
      console.error('Print all notices error:', e);
      alert("प्रिंट प्रक्रिया अयशस्वी झाली. कृपया पुन्हा प्रयत्न करा.");
    } finally {
      setIsPrinting(false);
      setPrintProgress({ current: 0, total: 0 });
    }
  };

  const renderSingleNoticeTemplate = (director: Member, forLandscape: boolean = false) => {
    const el = document.createElement('div');
    el.style.width = '140mm';
    el.style.height = '200mm';
    el.style.border = '1px solid #ccc';
    el.style.padding = '10mm';
    el.style.fontFamily = "'DVOT SurekhMR', serif";
    el.style.fontSize = '11px';
    el.style.color = 'black';
    el.style.lineHeight = '1.6';
    el.style.backgroundColor = 'white';
    el.style.boxSizing = 'border-box';

    const timeDisplay = `${noticeMeetingTimePeriod} ${formatTimeMarathi(noticeMeetingTime)}`;

    el.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #000; margin-bottom: 12px; padding-bottom: 8px;">
        <h2 style="margin: 0; font-size: 14px; font-weight: bold; color: #000;">${SOCIETY_FULL_NAME}</h2>
        <p style="margin: 2px 0; font-size: 10px; color: #000;">E-mail secretaryilada1425@gmail.com</p>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: normal; margin-bottom: 12px; font-size: 12px;">
        <span>जा.क्र. ${noticeOutwardNo}</span>
        <span>दिनांक ${formatDateMarathi(noticeDate)}</span>
      </div>
      <div style="text-align: center; margin-bottom: 12px;">
        <h1 style="font-size: 20px; font-weight: bold; border-bottom: 2px solid black; display: inline-block; margin-bottom: 2px; padding-bottom: 2px;">सभेचे नोटीस</h1>
        <div style="font-size: 12px; font-weight: normal; margin-top: 4px; font-style: italic;">साधारण/तातडीची/तहकुब सभा</div>
      </div>
      <div style="margin-bottom: 12px; font-size: 11px;">
        <p style="font-weight: normal; margin: 0;">प्रति,</p>
        <p style="font-weight: normal; margin: 0; margin-left: 24px; font-size: 13px;">अध्यक्ष/सदस्य ${director.gender === 'Female' ? 'श्रीमती.' : 'श्री.'} <b>${director.name} मु. ${director.village}</b></p>
      </div>
      <div style="text-align: justify; margin-bottom: 12px; text-indent: 40px; font-size: 13px; line-height: 1.8;">
        ${getProcessedNoticeBody().replace(/<strong>/g, '<u><b>').replace(/<\/strong>/g, '</b></u>')}
      </div>
      <div style="margin-bottom: 16px;">
        <h3 style="text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 8px; font-size: 13px;">-: सभेचे विषय :-</h3>
        <div style="margin-left: 4px; font-size: 11px; line-height: 1.8;">
          ${agendaItems.map((item, idx) => `<div style="display: flex; gap: 8px; margin-bottom: 4px;"><span style="font-weight: normal;">${toMarathiNumber(idx + 1)}</span> <span style="font-weight: normal; font-size: 13px;">${item}</span></div>`).join('')}
        </div>
      </div>
      <div style="margin-top: 100px;">
        <div style="display: flex; justify-content: space-between; text-align: center; margin-bottom: 4px;">
          <div style="width: 45%;">
            <p style="font-size: 12px; font-weight: normal; margin: 0;">सचिव</p>
          </div>
          <div style="width: 45%;">
            <p style="font-size: 12px; font-weight: normal; margin: 0;">अध्यक्ष</p>
          </div>
        </div>
        <p style="font-size: 14px; font-weight: bold; font-style: italic; text-align: center; margin: 0;">${SOCIETY_FULL_NAME}</p>
      </div>
    `;
    return el;
  };

  const handleSaveDefaultRates = () => {
    updateSettings({ allowanceSettings: { travelAllowance: rates.travel, incidentalExpenses: rates.incidental, meetingFee: rates.fee } });
    setIsEditingRates(false);
  };

  const handlePrintAllowance = async () => {
    if (allowanceRef.current) {
      try {
        const canvasOptions = {
          scale: Capacitor.isNativePlatform() ? 1.5 : 2,
          backgroundColor: '#ffffff',
          logging: false
        };
        const canvas = await html2canvas(allowanceRef.current, canvasOptions);
        const imgData = canvas.toDataURL('image/jpeg', 0.7);
        const pdf = new jsPDF('l', 'mm', 'a4');

        // Load and embed DVOT SurekhMR font
        try {
          await loadDVOTFont(pdf);
          pdf.setFont('DVOT SurekhMR', 'normal');
        } catch (fontError) {
          console.warn('Could not load custom font for allowance:', fontError);
        }

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const ratio = pdfWidth / canvas.width;
        const imgHeight = canvas.height * ratio;
        pdf.addImage(imgData, 'JPEG', 0, 10, pdfWidth, imgHeight);
        const itemBlob = pdf.output('blob');
        downloadBlob(itemBlob, `Allowance_Report_${formatDateMarathi(meetings.find(m => m.id === allowanceMeetingId)?.date || '')}.pdf`);
      } catch (e) { alert("Print failed"); }
    }
  };

  const handleSubmitMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    const attendeesList: string[] = (currentDirectors.filter(d => selectedAttendees.has(d.name)).map(d => d.name) as string[]);
    const manualAttendees: string[] = Array.from(selectedAttendees as Set<string>).filter((name: string) => !currentDirectors.some(d => d.name === name));
    attendeesList.push(...manualAttendees);

    const meetingData: Meeting = {
      id: editingMeetingId || Date.now().toString(),
      title, date, venue, type,
      attendeesCount: attendeesList.length > 0 ? attendeesList.length : attendeesCount,
      attendees: attendeesList, resolutions,
      timestamp: editingMeetingId ? (meetings.find(m => m.id === editingMeetingId)?.timestamp || Date.now()) : Date.now()
    };
    if (editingMeetingId) updateMeeting(meetingData); else addMeeting(meetingData);
    setShowModal(false);
  };

  const initiateDeleteMeeting = (id: string) => {
    setMeetingToDelete(id); setDeletePin(''); setDeleteError(''); setShowDeleteModal(true);
  };

  const confirmDeleteMeeting = () => {
    if (deletePin === settings.securityPin && meetingToDelete) {
      deleteMeeting(meetingToDelete); setShowDeleteModal(false); setMeetingToDelete(null);
    } else setDeleteError("Incorrect PIN");
  };

  return (
    <div className="p-4 md:p-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Handshake className="text-blue-600" /> Meetings & Resolutions
        </h2>

        <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg overflow-x-auto no-scrollbar max-w-full">
          <button onClick={() => setActiveTab('records')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'records' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><FileText size={16} /> Records</button>
          <button onClick={() => setActiveTab('notice')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'notice' ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><BellRing size={16} /> सभेचे नोटीस</button>
          <button onClick={() => setActiveTab('board')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'board' ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Briefcase size={16} /> Directors</button>
          <button onClick={() => setActiveTab('allowance')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'allowance' ? 'bg-white dark:bg-slate-600 text-green-600 dark:text-green-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Banknote size={16} /> Allowance</button>
        </div>
      </div>

      {activeTab === 'notice' && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                <ClipboardList className="text-purple-600" /> नोटीस माहिती भरा (Notice Details)
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">जा. क्र. (Outward No)</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={noticeOutwardPrefix}
                      onChange={e => setNoticeOutwardPrefix(e.target.value)}
                      className="w-full p-2 border-y border-l dark:border-slate-600 rounded-l dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="उदा. ६३७"
                    />
                    <span className="p-2 border dark:border-slate-600 rounded-r bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold border-l-0">
                      /{toMarathiNumber(new Date(noticeDate).getFullYear())}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">नोटीस दिनांक</label>
                  <input type="date" value={noticeDate} onChange={e => setNoticeDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white" />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-1">अध्यक्ष/सदस्य निवड (Recipient)</label>
                <select value={noticeRecipientId} onChange={e => setNoticeRecipientId(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white font-bold text-blue-600">
                  {currentDirectors.map(d => <option key={d.id} value={d.id}>{d.name} ({getDisplayDesignation(d)})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">सभेचा प्रकार</label>
                  <select value={noticeMeetingType} onChange={e => setNoticeMeetingType(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white">
                    <option value="साधारण सभा">साधारण सभा</option>
                    <option value="तातडीची सभा">तातडीची सभा</option>
                    <option value="तहकुब सभा">तहकुब सभा</option>
                    <option value="मासिक सभा">मासिक सभा</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">सभेचा दिनांक</label>
                  <input type="date" value={noticeMeetingDate} onChange={e => setNoticeMeetingDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">दिवस / वार</label>
                  <input type="text" readOnly value={noticeMeetingDay} className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">प्रहर (Period)</label>
                  <select
                    value={noticeMeetingTimePeriod}
                    onChange={e => setNoticeMeetingTimePeriod(e.target.value)}
                    className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white font-bold"
                  >
                    <option value="सकाळी">सकाळी (Morning)</option>
                    <option value="दुपारी">दुपारी (Afternoon)</option>
                    <option value="सायंकाळी">सायंकाळी (Evening)</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Clock size={12} /> सभेची वेळ (Time)</label>
                <input
                  type="time"
                  value={noticeMeetingTime}
                  onChange={e => {
                    const normalized = normalizeMarathiDigits(e.target.value);
                    setNoticeMeetingTime(normalized);
                  }}
                  className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white font-bold text-lg"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-1">सभेचे विषय (एक ओळ एक विषय)</label>
                <textarea rows={5} value={noticeAgenda} onChange={e => setNoticeAgenda(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowPreview(!showPreview)} className="bg-amber-100 text-amber-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                  <Eye size={20} /> {showPreview ? 'लपवा' : 'Preview पहा'}
                </button>
                <button
                  onClick={handlePrintAllNotices}
                  disabled={isPrinting}
                  className={`bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition ${isPrinting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                >
                  {isPrinting ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
                  {isPrinting ? 'प्रिंट होत आहे...' : 'सर्व नोटीस प्रिंट'}
                </button>
              </div>
            </div>

            <div className={`bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border-2 border-dashed border-slate-300 flex justify-center overflow-x-auto min-h-[600px] ${!showPreview ? 'hidden lg:flex' : ''}`}>
              <div ref={noticePrintRef} className="bg-white text-black p-8 w-[140mm] shadow-2xl relative h-fit border border-slate-300" style={{ fontFamily: "'DVOT SurekhMR', serif" }}>
                <div className="text-center border-b pb-2 mb-3 border-black">
                  <h1 className="text-[13px] font-normal text-black">{SOCIETY_FULL_NAME}</h1>
                  <div className="text-[9px] mt-0.5">E-mail secretaryilada1425@gmail.com</div>
                </div>
                <div className="flex justify-between font-normal mb-3 text-[11px]">
                  <span>जा.क्र. {noticeOutwardNo}</span>
                  <span>दिनांक {formatDateMarathi(noticeDate)}</span>
                </div>
                <div className="text-center mb-3">
                  <h2 className="text-[20px] font-bold inline-block" style={{ borderBottom: '2px solid black', paddingBottom: '2px' }}>सभेचे नोटीस</h2>
                  <div className="text-[11px] font-normal mt-1 italic">साधारण/तातडीची/तहकुब सभा</div>
                </div>
                <div className="mb-3 text-[11px]">
                  <p className="font-normal">प्रति,</p>
                  <p className="font-normal ml-6">
                    {selectedRecipient ? `अध्यक्ष/सदस्य ${selectedRecipient.gender === 'Female' ? 'श्रीमती.' : 'श्री.'} ${selectedRecipient.name} मु. ${selectedRecipient.village}` : 'अध्यक्ष/सचिव श्री. _____________________'}
                  </p>
                </div>
                <div className="mb-3 text-[11px] leading-relaxed text-justify" style={{ textIndent: '40px' }}>
                  <p dangerouslySetInnerHTML={{ __html: getProcessedNoticeBody().replace(/<strong>/g, '<u><b>').replace(/<\/strong>/g, '</b></u>') }} />
                </div>
                <div className="mb-4">
                  <h3 className="text-center font-bold text-[11px] mb-2" style={{ textDecoration: 'underline' }}>-: सभेचे विषय :-</h3>
                  <div className="space-y-1 text-[11px] leading-relaxed">
                    {agendaItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 ml-1">
                        <span className="font-normal">{toMarathiNumber(idx + 1)})</span>
                        <span className="font-normal" dangerouslySetInnerHTML={{ __html: item.replace(/माहे (\S+)/g, 'माहे <u>$1</u>').replace(/चा (\S+)/g, 'चा <u>$1</u>').replace(/(\d+)/g, '<u>$1</u>') }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: '100px' }}>
                  <div className="flex justify-between text-center mb-1">
                    <div className="w-[45%]">
                      <p className="text-[11px] font-normal">सचिव</p>
                    </div>
                    <div className="w-[45%]">
                      <p className="text-[11px] font-normal">अध्यक्ष</p>
                    </div>
                  </div>
                  <p className="text-[11px] font-normal italic text-center">आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं. १४२५</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'board' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200">
              <h3 className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                <Briefcase size={20} /> Executive Board (कार्यकारी संचालक मंडळ)
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">सभासदांमधून संचालक निवडा.</p>
              <p className="text-xs font-bold mt-2 text-slate-500">Current Selection: {currentDirectors.length} Members</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                <Crown size={20} className="text-amber-500" /> Key Roles (पदाधिकारी निवड)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">Chairman (अध्यक्ष)</label>
                  <select value={chairmanId || ''} onChange={(e) => handleRoleUpdate('chairman', e.target.value)} className="w-full p-2 text-sm border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold">
                    <option value="">-- Select --</option>
                    {currentDirectors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">Vice-Chair 1 (उपाध्यक्ष)</label>
                  <select value={currentViceChairmanIds[0] || ''} onChange={(e) => handleRoleUpdate('viceChairman1', e.target.value)} className="w-full p-2 text-sm border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
                    <option value="">-- Select --</option>
                    {currentDirectors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">Vice-Chair 2 (उपाध्यक्ष)</label>
                  <select value={currentViceChairmanIds[1] || ''} onChange={(e) => handleRoleUpdate('viceChairman2', e.target.value)} className="w-full p-2 text-sm border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
                    <option value="">-- Select --</option>
                    {currentDirectors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[550px]">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col overflow-hidden">
              <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Select From Members</h4>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input type="text" placeholder="Search by name..." value={boardSearch} onChange={e => setBoardSearch(e.target.value)} className="w-full pl-9 p-2 rounded border dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {members.filter(m => !boardMemberIds.has(m.id) && (m.name.toLowerCase().includes(boardSearch.toLowerCase()) || m.memberNo.includes(boardSearch))).slice(0, 50).map(m => (
                  <div key={m.id} className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition border border-transparent hover:border-slate-200">
                    <div><p className="text-sm font-bold text-slate-700 dark:text-slate-200">{m.name}</p><p className="text-xs text-slate-500">#{m.memberNo} | {m.village}</p></div>
                    <button onClick={() => toggleDirectorStatus(m.id)} className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 transition"><UserPlus size={18} /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col overflow-hidden">
              <div className="p-4 border-b dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20"><h4 className="font-bold text-amber-800 dark:text-amber-400">Current Board Members ({currentDirectors.length})</h4></div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {currentDirectors.length === 0 ? <p className="text-center text-slate-400 text-sm py-8">No directors selected yet.</p> : currentDirectors.map(m => (
                  <div key={m.id} className={`flex justify-between items-center p-2 rounded border dark:border-slate-700 ${m.id === chairmanId ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/40' : 'bg-slate-50 dark:bg-slate-700/30'}`}>
                    <div><p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">{m.name}{m.id === chairmanId && <Crown size={14} className="text-amber-600" />}{currentViceChairmanIds.includes(m.id) && <Award size={14} className="text-blue-600" />}</p><p className="text-xs text-slate-500">#{m.memberNo} | {m.village}</p></div>
                    <button onClick={() => toggleDirectorStatus(m.id)} className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 transition"><UserMinus size={18} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'allowance' && (
        <div className="animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><Banknote className="text-green-600" /> बैठक भत्ता (Meeting Allowance)</h3>
              <div className="flex gap-2">
                {isEditingRates ? (
                  <button onClick={handleSaveDefaultRates} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-bold text-sm shadow-md"><Check size={16} /> Save Rates</button>
                ) : (
                  <button onClick={() => setIsEditingRates(true)} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-200 transition font-bold text-sm border"><Settings2 size={16} /> Edit Rates</button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Select Meeting</label>
                <select value={allowanceMeetingId} onChange={e => setAllowanceMeetingId(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="">-- Select Meeting --</option>
                  {meetings.map(m => (<option key={m.id} value={m.id}>{m.title} ({formatDateMarathi(m.date)})</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">Travel (प्रवास)</label>
                <input type="number" disabled={!isEditingRates} value={rates.travel} onChange={e => setRates({ ...rates, travel: Number(e.target.value) })} className="w-full p-2 border rounded font-bold dark:bg-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">Incidental (प्रासंगीक)</label>
                <input type="number" disabled={!isEditingRates} value={rates.incidental} onChange={e => setRates({ ...rates, incidental: Number(e.target.value) })} className="w-full p-2 border rounded font-bold dark:bg-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">Meeting Fee (फी)</label>
                <input type="number" disabled={!isEditingRates} value={rates.fee} onChange={e => setRates({ ...rates, fee: Number(e.target.value) })} className="w-full p-2 border rounded font-bold dark:bg-slate-900 dark:text-white" />
              </div>
            </div>
            {allowanceMeetingId && (
              <div className="mt-6 flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                <button onClick={handlePrintAllowance} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition font-bold text-sm"><Printer size={16} /> Print Voucher</button>
              </div>
            )}
          </div>
          {allowanceMeetingId ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-x-auto">
              <div ref={allowanceRef} className="bg-white dark:bg-slate-800 p-8 min-w-[900px] text-black dark:text-white">
                <div className="text-center mb-8 border-b pb-4">
                  <h2 className="text-xl font-bold mb-1">{SOCIETY_FULL_NAME}</h2>
                  <h3 className="text-lg font-bold underline">Meeting Allowance Voucher (बैठक भत्ता बिल)</h3>
                  <p className="text-sm text-slate-500 mt-2">Meeting: {meetings.find(m => m.id === allowanceMeetingId)?.title} | Date: {formatDateMarathi(meetings.find(m => m.id === allowanceMeetingId)?.date || '')}</p>
                </div>
                <table className="w-full text-center border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700">
                      <th className="border p-2">अ. क्र.</th>
                      <th className="border p-2 text-left">संचालकाचे नाव</th>
                      <th className="border p-2">पद</th>
                      <th className="border p-2">प्रवास भत्ता</th>
                      <th className="border p-2">प्रासंगीक खर्च</th>
                      <th className="border p-2">बैठक भत्ता</th>
                      <th className="border p-2 font-bold">एकूण</th>
                      <th className="border p-2 w-32">स्वाक्षरी</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowanceData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="border p-2">{toMarathiNumber(idx + 1)}</td>
                        <td className="border p-2 text-left font-medium">{row.name}</td>
                        <td className="border p-2">{row.designation}</td>
                        <td className="border p-2">{toMarathiNumber(row.travel)}</td>
                        <td className="border p-2">{toMarathiNumber(row.incidental)}</td>
                        <td className="border p-2">{toMarathiNumber(row.fee)}</td>
                        <td className="border p-2 font-bold">{toMarathiNumber(row.total)}</td>
                        <td className="border p-2"></td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-slate-50 dark:bg-slate-900">
                      <td className="border p-2" colSpan={6}>एकूण (Total)</td>
                      <td className="border p-2">{toMarathiNumber(allowanceTotal)}</td>
                      <td className="border p-2"></td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-16 flex justify-between px-8 text-center font-bold">
                  <div className="w-[45%]">
                    <p>सचिव</p>
                    <p className="mt-8">___________</p>
                    <p className="text-[10px] mt-1 text-slate-500">{SOCIETY_FULL_NAME}</p>
                  </div>
                  <div className="w-[45%]">
                    <p>अध्यक्ष</p>
                    <p className="mt-8">___________</p>
                    <p className="text-[10px] mt-1 text-slate-500">{SOCIETY_FULL_NAME}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (<div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-dashed border-2">कृपया सभेची निवड करा.</div>)}
        </div>
      )}

      {activeTab === 'records' && (
        <div className="animate-fade-in">
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditingMeetingId(null); setTitle(''); setDate(format(new Date(), 'yyyy-MM-dd')); setVenue(''); setType('Monthly'); setAttendeesCount(0); setSelectedAttendees(new Set()); setResolutions(''); setShowModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm font-bold text-sm"><Plus size={18} /> Record New Meeting</button>
          </div>
          {meetings.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700"><Handshake size={48} className="mx-auto text-slate-300 mb-4" /><p className="text-slate-500 dark:text-slate-400">No meeting records found.</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {meetings.sort((a, b) => b.timestamp - a.timestamp).map(meeting => (
                <div key={meeting.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden group">
                  <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
                    <div><h3 className="font-bold text-lg text-slate-800 dark:text-white">{meeting.title}</h3><p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2"><Calendar size={14} /> {formatDateMarathi(meeting.date)}<span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">{meeting.type}</span></p></div>
                    <div className="flex gap-2"><button onClick={() => { setEditingMeetingId(meeting.id); setTitle(meeting.title); setDate(meeting.date); setVenue(meeting.venue || ''); setType(meeting.type); setAttendeesCount(meeting.attendeesCount); setResolutions(meeting.resolutions); setSelectedAttendees(new Set(meeting.attendees || [])); setShowModal(true); }} className="p-2 text-slate-500 hover:text-blue-600 rounded transition"><Edit size={18} /></button><button onClick={() => initiateDeleteMeeting(meeting.id)} className="p-2 text-slate-500 hover:text-red-600 rounded transition"><Trash2 size={18} /></button></div>
                  </div>
                  <div className="p-4"><div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border dark:border-slate-700"><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">ठराव (Resolutions)</p><p className="text-slate-800 dark:text-white whitespace-pre-wrap text-sm">{meeting.resolutions}</p></div>
                    <div className="flex justify-end gap-2 mt-4 print:hidden">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          window.print();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition font-bold text-sm"
                      >
                        <Printer size={16} /> Print
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center"><h3 className="text-xl font-bold text-slate-800 dark:text-white">{editingMeetingId ? 'Edit Meeting' : 'Record Meeting'}</h3><button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button></div>
            <div className="p-6 overflow-y-auto"><form onSubmit={handleSubmitMeeting} className="space-y-4"><div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Meeting Title</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Date</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div><div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Type</label><select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"><option value="Monthly">Monthly</option><option value="AGM">AGM</option><option value="Emergency">Emergency</option><option value="Committee">Committee</option></select></div></div>
              <div><label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">उपस्थित संचालक (Select Attendees)</label><div className="max-h-40 overflow-y-auto border rounded p-2 bg-slate-50 dark:bg-slate-900">{currentDirectors.map(d => (<div key={d.id} className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" onClick={() => { const n = new Set(selectedAttendees); n.has(d.name) ? n.delete(d.name) : n.add(d.name); setSelectedAttendees(n); }}>{selectedAttendees.has(d.name) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}<span className="text-sm">{d.name}</span></div>))}</div></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Resolutions (इतिवृत्त)</label><textarea required rows={5} value={resolutions} onChange={e => setResolutions(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div><button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"><Save size={20} /> Save Record</button></form></div></div></div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm p-4"><div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-red-100 dark:border-red-900 animate-fade-in-up"><div className="text-center mb-6"><div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><ShieldCheck size={32} /></div><h3 className="text-xl font-bold text-slate-800 dark:text-white">Security Check</h3><p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter Security PIN to delete this record.</p></div><div className="space-y-4"><input type="password" autoFocus className="w-full p-3 text-center text-2xl tracking-widest border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none" placeholder="PIN" maxLength={4} value={deletePin} onChange={e => setDeletePin(e.target.value)} />{deleteError && <p className="text-red-500 text-center text-sm font-medium">{deleteError}</p>}<div className="flex gap-3"><button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 border dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={confirmDeleteMeeting} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">Delete</button></div></div></div></div>
      )}
    </div>
  );
};

export default Meetings;
