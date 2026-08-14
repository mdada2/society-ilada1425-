
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
  const [activeTab, setActiveTab] = useState<'records' | 'board' | 'allowance' | 'notice' | 'invitation'>('records');

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

  // --- Invitation Card State ---
  const [inviteType, setInviteType] = useState<'15aug' | '26jan' | 'custom'>('15aug');
  const [inviteEdition, setInviteEdition] = useState('८०');
  const [inviteDate, setInviteDate] = useState(format(new Date(), 'yyyy-08-15'));
  const [inviteTime, setInviteTime] = useState('०८:१०');
  const [invitePeriod, setInvitePeriod] = useState('सकाळी');
  const [inviteChiefGuest, setInviteChiefGuest] = useState('');
  const [inviteGuestDesignation, setInviteGuestDesignation] = useState('अध्यक्ष');
  const [customEventName, setCustomEventName] = useState('महाराष्ट्र दिनानिमित्त');

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

  // --- Annual General Meeting Notice (AGM Notice) State ---
  const [agmYear, setAgmYear] = useState('३५वी');
  const [agmOutwardNo, setAgmOutwardNo] = useState('622/2025');
  const [agmNoticeDate, setAgmNoticeDate] = useState('2025-08-21');
  const [agmMeetingYear, setAgmMeetingYear] = useState('2024-25');
  const [agmMeetingDate, setAgmMeetingDate] = useState('2025-09-23');
  const [agmMeetingTime, setAgmMeetingTime] = useState('12:00');
  const [agmMeetingPeriod, setAgmMeetingPeriod] = useState('दुपारी');
  const [agmVenue, setAgmVenue] = useState('संस्थेचे नविन गोडाऊन येथे');
  const [agmChairmanName, setAgmChairmanName] = useState('श्री. तानाजी शामराव ताराम');
  const [agmAgenda, setAgmAgenda] = useState<string>(
    "मागील वार्षिक साधारण सभेचे ( आमसभेचे ) प्रतिवृत्त वाचुन कायम करणे.\nसंस्थेचे सन 2024-25 या वर्षाचे वार्षिक पत्रक, जमा खर्च , नफा तोटा पत्रक , ताळेबंद पत्रक , व्यापारी पत्रके वाचुन मंजूर करणे.\nसंस्थेचे सन 2024-25 चे ऑडिट दोष दुरुस्ती अहवाल संचालक मंडळाने मंजूरी केलेले दोष दुरुस्ती अहवाल सहित स्वीकारणे.\nसंस्थेचे सन 2024-25 या वर्षाचे मंजूर अंदाज पत्रकाच्या कमी अधिक तरतुदीस मंजूरी देणे व सन 2025-26 च्या अंदाज पत्रकास शिफारस करणे.\nसंस्थेचे सन 2025-26 वर्षाकरीता लेखापरीक्षणासाठी लेखापरीक्षक नियुक्त करणे.\nउपविधी क्र. ५ मधील मर्यादेस राहुन पुढील वर्षाकरीता उभारावयाची बाहेरील कर्जाची मर्यादा ठरवणे.\nथकीत सभासदाला संस्थेच्या कामकाजात भाग घेता येणार नाही.\nथकीत सभासदाचे अवॉर्ड कार्यवाही करण्यास निर्णय घेणे. ( अवॉर्ड कारवाई करीता येणारा अतिरिक्त खर्च वसूल करणे)\nमा. अध्यक्षाच्या परवानगीने वेळेवर येणारे विषय।"
  );
  const [agmTips, setAgmTips] = useState<string>(
    "१) कोरम अभावी तहकूब झालेली सभा त्याच दिवशी, त्याच ठिकाणी विषय सुचीप्रमाणे अर्ध्या तासानंतर घेण्यात येईल. त्यास कोरमची आवश्यकता राहणार नाही.\n२) ज्या सभासदांना विषयाला अनुसरून काही प्रश्न विचारावयांचे असल्यास सभेच्या ३ दिवसा अगोदर संस्थेच्या कार्यालयीन वेळात लेखी अर्जाने कळवावे अन्यथा वेळेवर विचारलेल्या प्रश्नांचा विचार केला जाणार नाही.\n३) सभासदाशिवाय इतरांना सभेत भाग घेता येणार नाही.\n४) संस्थेचे वार्षिक हिसोबाचे पत्रके सन 2024-25 चे संस्थेच्या कार्यालयात कार्यालयीन वेळात नोटीस बोर्डवर पाहावयास मिळेल।"
  );
  const [agmManagerName, setAgmManagerName] = useState('श्री. सी. बी. बागडेरिया');
  const [agmViceChairmanName, setAgmViceChairmanName] = useState('श्री. सि. व्ही. रामटेके');
  const [agmChairmanSignName, setAgmChairmanSignName] = useState('श्री. टी. एस. ताराम');
  const [agmForwardList, setAgmForwardList] = useState<string>(
    "१) मा. तालुका सहायक निबंधक साहेब सहकारी संस्था अर्जुनी/मोर. यांचे माहिती करीता सादर।\n२) मा. उपप्रादेशिक व्यवस्थापक साहेब शाखा- नवेगाव/बांध यांचे माहिती करीता सादर।\n३) मा. शाखा व्यवस्थापक साहेब शाखा दि. गोंदिया डि. से. को. ऑप. बँक शाखा- केशोरी\n४) मा. उपलेखा परीक्षक साहेब सहकारी संस्था, अर्जुनी/मोर।"
  );

  // --- AGM Font Sizes ---
  const [agmBodyFontSize, setAgmBodyFontSize] = useState<number>(14.5);
  const [agmAgendaFontSize, setAgmAgendaFontSize] = useState<number>(13.0);
  const [agmTipsFontSize, setAgmTipsFontSize] = useState<number>(11.5);
  const [agmForwardFontSize, setAgmForwardFontSize] = useState<number>(12.5);

  const noticePrintRef = useRef<HTMLDivElement>(null);
  const agmNoticePrintRef = useRef<HTMLDivElement>(null);
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
    const chairman = members.find(m => m.id === settings.chairmanId);
    if (chairman && !inviteChiefGuest) {
      setInviteChiefGuest(chairman.name);
    }
  }, [members, settings.chairmanId, inviteChiefGuest]);

  useEffect(() => {
    if (inviteDate) {
      const dateObj = new Date(inviteDate);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        if (inviteType === '15aug') {
          setInviteEdition(toMarathiNumber(year - 1946));
        } else if (inviteType === '26jan') {
          setInviteEdition(toMarathiNumber(year - 1949));
        }
      }
    }
  }, [inviteDate, inviteType]);

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

    // Automatic font size adjustment based on number of directors
    const directorCount = sortedDirectors.length;
    let tableFontSize = '13px';
    let headerFontSize = '14px';

    if (directorCount <= 10) {
      tableFontSize = '13px';
      headerFontSize = '14px';
    } else if (directorCount <= 13) {
      tableFontSize = '12px';
      headerFontSize = '13px';
    } else {
      tableFontSize = '11px';
      headerFontSize = '12px';
    }

    const tableRows = sortedDirectors.map((d, i) => `
        <tr>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">${toMarathiNumber(i + 1)}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: left; font-weight: bold; white-space: nowrap;">${d.gender === 'Female' ? 'श्रीमती.' : 'श्री.'} ${d.name}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">${d.village}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">${getDisplayDesignation(d)}</td>
            <td style="border: 1px solid black; padding: 8px; height: 40px; text-align: center;"></td>
        </tr>
      `).join('');

    el.innerHTML = `
        <div style="text-align: center; border-bottom: 2px solid #333; margin-bottom: 8px; padding-bottom: 4px;">
            <h1 style="margin: 0; font-size: 16px; font-weight: bold;">${SOCIETY_FULL_NAME}</h1>
            <p style="margin: 2px 0; font-size: ${headerFontSize}; font-weight: bold;">नोटीस मिळाल्याची स्वाक्षरी यादी (पावती रजिस्टर)</p>
        </div>
        
        <div style="margin-bottom: 8px; font-size: ${headerFontSize}; display: flex; justify-content: space-between; font-weight: bold; background: #f3f4f6; padding: 6px; border-radius: 5px; border: 1px solid #ccc;">
            <span style="text-align: center; flex: 1;">सभेचा प्रकार: ${noticeMeetingType}</span>
            <span style="text-align: center; flex: 1;">तारीख: ${formatDateMarathi(noticeMeetingDate)}</span>
            <span style="text-align: center; flex: 1;">वेळ: ${noticeMeetingTimePeriod} ${formatTimeMarathi(noticeMeetingTime)}</span>
            <span style="text-align: center; flex: 1;">वार: ${noticeMeetingDay}</span>
        </div>

        <p style="margin-bottom: 8px; font-size: ${headerFontSize}; text-indent: 30px; line-height: 1.4; text-align: justify;">
            संस्थेच्या संचालक मंडळाची वरील दिवशी व वेळी आयोजित केलेल्या सभेची नोटीस आम्हाला खालीलप्रमाणे प्रत्यक्ष वेळेत व स्वरूपात मिळाली असून आम्ही सभेला उपस्थित राहण्याचे मान्य करीत आहोत.
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: ${tableFontSize};">
            <thead>
                <tr style="background-color: #eee;">
                    <th style="border: 1px solid black; padding: 10px; width: 40px; text-align: center;">अ.क्र.</th>
                    <th style="border: 1px solid black; padding: 10px; text-align: left;">संचालकाचे नाव</th>
                    <th style="border: 1px solid black; padding: 10px; width: 100px; text-align: center;">गाव</th>
                    <th style="border: 1px solid black; padding: 10px; width: 100px; text-align: center;">पद</th>
                    <th style="border: 1px solid black; padding: 10px; width: 250px; text-align: center;">स्वाक्षरी</th>
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

  const renderSingleAgmNoticeTemplate = (recipientName: string = '', isForPdf = false) => {
    const el = document.createElement('div');
    el.className = "flex flex-col text-black bg-white";
    el.style.width = '210mm';
    el.style.height = '297mm';
    el.style.padding = '8mm 12mm 6mm 12mm';
    el.style.border = '2px solid #000';
    el.style.fontFamily = "'DVOT SurekhMR', serif";
    el.style.boxSizing = 'border-box';

    el.style.fontSize = `${agmBodyFontSize}px`;
    el.style.lineHeight = '1.45';

    const formattedNoticeDate = agmNoticeDate.split('-').reverse().join('/');
    const formattedMeetingDate = agmMeetingDate.split('-').reverse().join('/');
    const day = getInviteDay(agmMeetingDate);

    // Format list items
    const agendaLines = agmAgenda.split('\n').filter(l => l.trim() !== '');
    const tipLines = agmTips.split('\n').filter(l => l.trim() !== '');
    const forwardLines = agmForwardList.split('\n').filter(l => l.trim() !== '');

    const agendaHtml = agendaLines.map((line, idx) => {
      const cleanLine = line.replace(/^\d+[\s\.\)-]+/, '').trim();
      return `<li style="margin-bottom: 3px; text-align: justify; text-indent: -18px; padding-left: 18px;">${toMarathiNumber(idx + 1)}) ${cleanLine}</li>`;
    }).join('');

    const tipsHtml = tipLines.map((line) => {
      return `<li style="margin-bottom: 2px; text-align: justify;">${line}</li>`;
    }).join('');

    const forwardHtml = forwardLines.map((line) => {
      return `<li style="margin-bottom: 1px; text-align: justify;">${line}</li>`;
    }).join('');

    const sigBlockHtml = `
      <div style="display: flex; justify-content: space-between; text-align: center; font-weight: bold; font-size: ${agmBodyFontSize - 1}px; margin-top: 10px; margin-bottom: 4px;">
        <div style="width: 33%;">
          <p style="margin: 0; font-size: ${agmBodyFontSize}px; white-space: nowrap;">${agmManagerName}</p>
          <p style="margin: 2px 0 0 0; font-size: ${agmBodyFontSize - 2}px; font-weight: normal;">प्रभारी व्यवस्थापक</p>
        </div>
        <div style="width: 33%;">
          <p style="margin: 0; font-size: ${agmBodyFontSize}px; white-space: nowrap;">${agmViceChairmanName}</p>
          <p style="margin: 2px 0 0 0; font-size: ${agmBodyFontSize - 2}px; font-weight: normal;">उपाध्यक्ष</p>
        </div>
        <div style="width: 33%;">
          <p style="margin: 0; font-size: ${agmBodyFontSize}px; white-space: nowrap;">${agmChairmanSignName}</p>
          <p style="margin: 2px 0 0 0; font-size: ${agmBodyFontSize - 2}px; font-weight: normal;">अध्यक्ष</p>
        </div>
      </div>
      <p style="text-align: center; font-weight: bold; margin: 3px 0 6px 0; font-size: ${agmBodyFontSize - 1.5}px; letter-spacing: 0.5px;">
        आदिवासी विविध कार्य. सह. संस्था मर्या. ईळदा र. नं.१४२५
      </p>
    `;

    el.innerHTML = `
      <!-- Header -->
      <div style="text-align: center; position: relative;">
        <p style="margin: 0; font-size: ${agmBodyFontSize - 2.5}px; font-weight: bold; letter-spacing: 0.5px;">* बिना सहकार नाही उध्दार *</p>
        <h1 style="margin: 2px 0 0 0; font-size: ${agmBodyFontSize + 4.5}px; font-weight: bold; color: #000; letter-spacing: 0.5px;">
          आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र.नं.१४२५
        </h1>
        <p style="margin: 0; font-size: ${agmBodyFontSize - 1}px; font-weight: bold;">ता.अर्जुनी/मोर. जि. गोंदिया</p>
        <div style="border-bottom: 1.5px solid #000; margin-top: 4px; margin-bottom: 2px;"></div>
      </div>

      <!-- Year and Outward Row -->
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${agmBodyFontSize - 1}px; margin-top: 2px; padding: 0 4px;">
        <div style="width: 25%;">
          <span>वर्ष ${agmYear},</span>
        </div>
        <div style="width: 50%; text-align: center;">
          <h2 style="margin: 0; font-size: ${agmBodyFontSize + 5.5}px; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px; white-space: nowrap;">
            वार्षिक सर्वसाधारण सभेची नोटीस
          </h2>
        </div>
        <div style="width: 25%; text-align: right;">
          <span>दिनांक: ${toMarathiNumber(formattedNoticeDate)}</span>
        </div>
      </div>

      <!-- Subtitle and Outward Row -->
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${agmBodyFontSize - 1}px; margin-top: 2px; margin-bottom: 6px; padding: 0 4px;">
        <div style="font-size: ${agmBodyFontSize - 1}px; width: 33%;">
          जावक क्र. ${toMarathiNumber(agmOutwardNo)}
        </div>
        <div style="font-size: ${agmBodyFontSize - 1}px; font-style: italic; width: 34%; text-align: center;">
          ( संस्थेच्या सभासदाकरिता )
        </div>
        <div style="width: 33%;"></div>
      </div>

      <!-- Recipient Address Line (Single Line, No Wrap) -->
      <div style="font-size: ${agmBodyFontSize + 0.5}px; font-weight: bold; margin-bottom: 6px; padding-bottom: 4px; display: flex; align-items: baseline; gap: 4px;">
        <span style="white-space: nowrap;">प्रति, सभासद श्री / श्रीमती :</span>
        <span style="border-bottom: 1px dashed #000; flex: 1; min-width: 150px; display: inline-block;">
          ${recipientName || '&nbsp;'}
        </span>
        <span style="white-space: nowrap; margin-left: 10px;">राहणार :</span>
        <span style="border-bottom: 1px dashed #000; width: 110px; display: inline-block;">&nbsp;</span>
      </div>

      <!-- Salutation and Body -->
      <div style="margin-bottom: 6px;">
        <p style="margin: 0; font-weight: bold; font-size: ${agmBodyFontSize}px;">महोदय,</p>
        <p style="text-indent: 40px; margin: 2px 0 0 0; text-align: justify; font-weight: 500; font-size: ${agmBodyFontSize}px; line-height: 1.45;">
          आपणास सदर नोटीसाद्वारे सुचित करण्यात येते की, आदिवासी विविध कार्यकारी सह. संस्था मर्या. ईळदा र. नं. १४२५ या संस्थेची सन ${toMarathiNumber(agmMeetingYear)} ची <strong>“वार्षिक आमसभा”</strong> ( सर्वसाधारण सभा ) दि. <strong>${toMarathiNumber(formattedMeetingDate)}</strong> रोज <strong>${day}</strong> ${agmMeetingPeriod} ठीक <strong>${toMarathiNumber(agmMeetingTime)}</strong> वाजता <strong>${agmVenue}</strong> घेण्याचे ठरवले आहे. तरी संस्थेचे सर्व सभासदांनी सभेला हजर राहुन खालील विषय सुची प्रमाणे सभेचे कामकाज चालविण्यास मदत करावे. सभेचे अध्यक्ष मा. श्री. <strong>${agmChairmanName}</strong> यांच्या अध्यक्षते खाली सभा पार पडेल.
        </p>
      </div>

      <!-- Agenda Title -->
      <p style="text-align: center; font-weight: bold; margin: 4px 0; font-size: ${agmBodyFontSize + 0.5}px; text-decoration: underline;">
        -: सभेपुढील विषय :-
      </p>

      <!-- Agenda List -->
      <ul style="list-style-type: none; padding-left: 0; margin: 0 0 4px 0; font-size: ${agmAgendaFontSize}px; line-height: 1.4;">
        ${agendaHtml}
      </ul>

      <!-- Tips Title & List -->
      <div style="border: 1.5px solid #000; background-color: #f1f5f9; padding: 6px 10px; margin-top: 6px; border-radius: 4px; font-size: ${agmTipsFontSize}px; line-height: 1.35;">
        <span style="font-weight: bold; text-decoration: underline; display: block; margin-bottom: 3px;">टिप:-</span>
        <ul style="list-style-type: none; padding-left: 0; margin: 0;">
          ${tipsHtml}
        </ul>
      </div>

      <!-- First Signature Block -->
      ${sigBlockHtml}

      <!-- Separator for Dispatch Copy Removed -->
      <div style="margin-top: 5px; margin-bottom: 5px;"></div>

      <!-- Forward / Copy Section -->
      <div style="font-size: ${agmForwardFontSize}px; line-height: 1.4; margin-bottom: 4px;">
        <span style="font-weight: bold; text-decoration: underline; display: block; margin-bottom: 3px;">प्रतिलीपी सादर :-</span>
        <ul style="list-style-type: none; padding-left: 0; margin: 0;">
          ${forwardHtml}
        </ul>
      </div>

      <!-- Bottom Signature Block (Repeated) -->
      <div style="margin-top: auto;">
        ${sigBlockHtml}
      </div>
    `;

    return el;
  };

  const handlePrintAgmNotice = async () => {
    setIsPrinting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');

      // Load custom font
      try {
        await loadDVOTFont(pdf);
        pdf.setFont('DVOT SurekhMR', 'normal');
      } catch (fontError) {
        console.warn('Could not load custom font, using default:', fontError);
      }

      const totalPages = 1;
      setPrintProgress({ current: 1, total: totalPages });

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

      // Render general blank notice
      const container = renderSingleAgmNoticeTemplate('', true);
      printContainer.appendChild(container);

      const canvas = await html2canvas(container, canvasOptions);
      printContainer.removeChild(container);
      document.body.removeChild(printContainer);

      const imgData = canvas.toDataURL('image/jpeg', 0.7);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

      const itemBlob = pdf.output('blob');
      await downloadBlob(itemBlob, `AGM_Meeting_Notice_${format(new Date(agmMeetingDate), 'dd_MM_yyyy')}.pdf`);

    } catch (e) {
      console.error('Print AGM notice error:', e);
      alert("प्रिंट प्रक्रिया अयशस्वी झाली. कृपया पुन्हा प्रयत्न करा.");
    } finally {
      setIsPrinting(false);
      setPrintProgress({ current: 0, total: 0 });
    }
  };

  const renderSingleInvitationTemplate = (recipientName: string, isForPdf = false) => {
    const el = document.createElement('div');
    el.className = "p-6 flex flex-col justify-between text-black relative bg-white";
    el.style.width = '185mm';
    el.style.height = '125mm';
    el.style.border = '5px double #000';
    el.style.fontFamily = "'DVOT SurekhMR', serif";
    el.style.boxSizing = 'border-box';

    const marathiDate = inviteDate.split('-').reverse().join('.');
    const day = getInviteDay(inviteDate);
    
    let eventName = '';
    if (inviteType === '15aug') {
      eventName = `${inviteEdition} व्या स्वातंत्र्य दिनानिमित्त`;
    } else if (inviteType === '26jan') {
      eventName = `${inviteEdition} व्या प्रजासत्ताक दिनानिमित्त`;
    } else {
      eventName = customEventName || `राष्ट्रीय दिनानिमित्त`;
    }

    const flagSvgStr = `
      <svg viewBox="0 0 100 24" style="width: 100px; height: 24px;">
        <path d="M 0 6 Q 25 2 50 6 T 100 6 L 100 12 Q 75 12 50 16 T 0 16 Z" fill="#FF9933" />
        <path d="M 0 11 Q 25 7 50 11 T 100 11 L 100 17 Q 75 17 50 21 T 0 21 Z" fill="#FFFFFF" />
        <path d="M 0 16 Q 25 12 50 16 T 100 16 L 100 22 Q 75 22 50 26 T 0 26 Z" fill="#138808" />
        <circle cx="50" cy="13.5" r="2.5" fill="none" stroke="#000080" stroke-width="0.4" />
      </svg>
    `;

    const isBlank = recipientName.startsWith('___');
    const displayName = isBlank ? '' : recipientName;

    el.innerHTML = `
      <div style="text-align: center; border-bottom: 1.5px solid #ccc; padding-bottom: 6px; margin-bottom: 6px;">
        <h2 style="font-size: 19px; font-weight: bold; margin: 0; color: #000; letter-spacing: 0.5px;">${SOCIETY_FULL_NAME}</h2>
        <p style="font-size: 13px; margin: 2px 0 0 0; color: #475569; font-weight: bold;">ता. अर्जुनी/मोर. जि. गोंदिया</p>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; margin: 6px 0;">
        <div>${flagSvgStr}</div>
        <h3 style="font-size: 22px; font-weight: bold; text-decoration: underline; margin: 0; letter-spacing: 1px;">✡ निमंत्रण पत्रिका ✡</h3>
        <div>${flagSvgStr}</div>
      </div>

      <div style="margin: 8px 0; font-size: 17px; line-height: 1.7; flex: 1; display: flex; flex-direction: column; justify-content: center;">
        <div style="width: 100%;">
          <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 17.5px;">
            श्री/श्रीमती <span style="border-bottom: 2px solid #000; padding: 0 10px; min-width: 440px; display: inline-block; text-align: center; font-weight: bold; margin: 0 4px;">${displayName}</span> स.न.वि.वि.
          </p>
          <p style="text-indent: 40px; margin: 0; text-align: justify; font-weight: bold;">
            आपणास कळविण्यात येते की दि. <strong>${toMarathiNumber(marathiDate)}</strong> रोज <strong>${day}</strong> ला ${invitePeriod !== 'none' ? '<strong>' + invitePeriod + '</strong> ' : ''}ठीक <strong>${toMarathiNumber(inviteTime)}</strong> वाजता <strong>${eventName}</strong> ध्वजारोहण मा. श्री. <strong>${inviteChiefGuest}</strong> ${inviteGuestDesignation} ${SOCIETY_FULL_NAME} यांचे शुभ हस्ते होत आहे.
          </p>
          <p style="text-align: center; margin-top: 10px; font-weight: bold; font-size: 17px; letter-spacing: 0.5px;">
            तरी सदर कार्यक्रमास आपली उपस्थिती प्रार्थनीय आहे.
          </p>
        </div>
      </div>

      <div style="margin-top: auto; border-top: 1.5px solid #ddd; padding-top: 6px;">
        <div style="text-align: center; font-size: 16px; font-weight: bold; line-height: 1.4;">
          <p style="margin: 0; text-decoration: underline; letter-spacing: 0.5px;">आपले विनीत</p>
          <p style="margin: 3px 0 0 0; font-size: 13.5px; color: #334155;">संचालक मंडळ तथा सचिव व कर्मचारी</p>
          <p style="margin: 1px 0 0 0; font-size: 12px; color: #475569;">${SOCIETY_FULL_NAME}</p>
        </div>
      </div>
    `;

    return el;
  };

  const getInviteDay = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return '';
      return MARATHI_DAYS[getDay(dateObj)];
    } catch (e) {
      return '';
    }
  };

  const handlePrintInvitation = async (printType: 'directors' | 'blank') => {
    setIsPrinting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      try {
        await loadDVOTFont(pdf);
        pdf.setFont('DVOT SurekhMR', 'normal');
      } catch (fontError) {
        console.warn('Could not load custom font, using default:', fontError);
      }

      const recipients = printType === 'directors' 
        ? currentDirectors.map(d => d.name) 
        : ['________________________________________'];

      const totalPages = Math.ceil(recipients.length / 2);
      setPrintProgress({ current: 0, total: totalPages });

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

      for (let i = 0; i < recipients.length; i += 2) {
        const container = document.createElement('div');
        container.style.width = '210mm';
        container.style.height = '297mm';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.backgroundColor = 'white';
        container.style.padding = '15mm 10mm';
        container.style.gap = '25mm';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'flex-start';

        const card1 = renderSingleInvitationTemplate(recipients[i], true);
        container.appendChild(card1);

        if (recipients[i + 1]) {
          const card2 = renderSingleInvitationTemplate(recipients[i + 1], true);
          container.appendChild(card2);
        } else {
          const cardBlank = renderSingleInvitationTemplate('________________________________________', true);
          container.appendChild(cardBlank);
        }

        printContainer.appendChild(container);

        const currentPage = Math.floor(i / 2) + 1;
        setPrintProgress({ current: currentPage, total: totalPages });

        if (Capacitor.isNativePlatform() && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const canvas = await html2canvas(container, canvasOptions);
        printContainer.removeChild(container);

        if (i > 0) pdf.addPage();
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      document.body.removeChild(printContainer);
      
      const filename = inviteType === '15aug' ? 'Independence_Day_Invitation.pdf' : inviteType === '26jan' ? 'Republic_Day_Invitation.pdf' : 'Invitation_Card.pdf';
      const blob = pdf.output('blob');
      await downloadBlob(blob, filename);
    } catch (err) {
      console.error(err);
      alert('प्रिंट करताना अडचण आली!');
    } finally {
      setIsPrinting(false);
      setPrintProgress({ current: 0, total: 0 });
    }
  };

  // Helper to get recipient designation for notice
  const getRecipientDesignation = (director: Member) => {
    const isChairman = director.id === chairmanId;
    const isViceChairman = currentViceChairmanIds.includes(director.id);
    const prefix = director.gender === 'Female' ? 'श्रीमती.' : 'श्री.';

    if (isChairman) {
      return `अध्यक्ष ${prefix} <b>${director.name} मु. ${director.village}</b>`;
    } else if (isViceChairman) {
      return `उपाध्यक्ष ${prefix} <b>${director.name} मु. ${director.village}</b>`;
    } else {
      // Regular member
      const memberTitle = director.gender === 'Female' ? 'संचालिका/सदस्या' : 'संचालक/सदस्य';
      return `${memberTitle} ${prefix} <b>${director.name} मु. ${director.village}</b>`;
    }
  };

  const renderSingleNoticeTemplate = (director: Member, forLandscape: boolean = false) => {
    const el = document.createElement('div');
    el.style.width = '140mm';
    el.style.height = '200mm';
    el.style.border = '1px solid #ccc';
    el.style.padding = '10mm';
    el.style.fontFamily = "'DVOT SurekhMR', serif";
    el.style.fontSize = '13px';
    el.style.color = 'black';
    el.style.lineHeight = '1.6';
    el.style.backgroundColor = 'white';
    el.style.boxSizing = 'border-box';

    const timeDisplay = `${noticeMeetingTimePeriod} ${formatTimeMarathi(noticeMeetingTime)}`;

    el.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #000; margin-bottom: 12px; padding-bottom: 8px;">
        <h2 style="margin: 0; font-size: 16px; font-weight: bold; color: #000;">${SOCIETY_FULL_NAME}</h2>
        <p style="margin: 2px 0; font-size: 11px; color: #000;">E-mail secretaryilada1425@gmail.com</p>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: normal; margin-bottom: 12px; font-size: 13px;">
        <span>जा.क्र. ${noticeOutwardNo}</span>
        <span>दिनांक ${formatDateMarathi(noticeDate)}</span>
      </div>
      <div style="text-align: center; margin-bottom: 12px;">
        <h1 style="font-size: 22px; font-weight: bold; border-bottom: 2px solid black; display: inline-block; margin-bottom: 2px; padding-bottom: 2px;">सभेचे नोटीस</h1>
        <div style="font-size: 13px; font-weight: normal; margin-top: 4px; font-style: italic;">साधारण/तातडीची/तहकुब सभा</div>
      </div>
      <div style="margin-bottom: 12px; font-size: 13px;">
        <p style="font-weight: normal; margin: 0;">प्रति,</p>
        <p style="font-weight: normal; margin: 0; margin-left: 24px; font-size: 14px;">${getRecipientDesignation(director)}</p>
      </div>
      <div style="text-align: justify; margin-bottom: 12px; text-indent: 40px; font-size: 14px; line-height: 1.8;">
        ${getProcessedNoticeBody().replace(/<strong>/g, '<u><b>').replace(/<\/strong>/g, '</b></u>')}
      </div>
      <div style="margin-bottom: 16px;">
        <h3 style="text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 8px; font-size: 14px;">-: सभेचे विषय :-</h3>
        <div style="margin-left: 4px; font-size: 13px; line-height: 1.8;">
          ${agendaItems.map((item, idx) => `<div style="display: flex; gap: 8px; margin-bottom: 4px;"><span style="font-weight: normal;">${toMarathiNumber(idx + 1)}</span> <span style="font-weight: normal; font-size: 14px;">${item}</span></div>`).join('')}
        </div>
      </div>
      <div style="margin-top: 100px;">
        <div style="display: flex; justify-content: space-between; text-align: center; margin-bottom: 4px;">
          <div style="width: 45%;">
            <p style="font-size: 13px; font-weight: normal; margin: 0;">सचिव</p>
          </div>
          <div style="width: 45%;">
            <p style="font-size: 13px; font-weight: normal; margin: 0;">अध्यक्ष</p>
          </div>
        </div>
        <p style="font-size: 15px; font-weight: bold; font-style: italic; text-align: center; margin: 0;">${SOCIETY_FULL_NAME}</p>
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

  const confirmDeleteMeeting = () => {
    if (deletePin === settings.securityPin && meetingToDelete) {
      deleteMeeting(meetingToDelete); setShowDeleteModal(false); setMeetingToDelete(null);
    } else setDeleteError("Incorrect PIN");
  };

  const initiateDeleteMeeting = (id: string) => {
    setMeetingToDelete(id); setDeletePin(''); setDeleteError(''); setShowDeleteModal(true);
  };

  const totalLength = agmAgenda.length + agmTips.length + agmForwardList.length;
  let baseFontSize = 15.5;
  if (totalLength > 1200) {
    baseFontSize = 13.0;
  } else if (totalLength > 1000) {
    baseFontSize = 14.0;
  } else if (totalLength < 700) {
    baseFontSize = 16.5;
  }

  return (
    <div className="p-4 md:p-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Handshake className="text-blue-600" /> Meetings & Resolutions
        </h2>

        <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg overflow-x-auto no-scrollbar max-w-full">
          <button onClick={() => setActiveTab('records')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'records' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><FileText size={16} /> Records</button>
          <button onClick={() => setActiveTab('notice')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'notice' ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><BellRing size={16} /> सभेचे नोटीस</button>
          <button onClick={() => setActiveTab('agm_notice')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'agm_notice' ? 'bg-white dark:bg-slate-600 text-teal-600 dark:text-teal-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><FileText size={16} /> वार्षिक आमसभा नोटीस</button>
          <button onClick={() => setActiveTab('invitation')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'invitation' ? 'bg-white dark:bg-slate-600 text-rose-600 dark:text-rose-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Mail size={16} /> निमंत्रण पत्रिका</button>
          <button onClick={() => setActiveTab('board')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'board' ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Briefcase size={16} /> Directors</button>
          <button onClick={() => setActiveTab('allowance')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'allowance' ? 'bg-white dark:bg-slate-600 text-green-600 dark:text-green-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Banknote size={16} /> Allowance</button>
        </div>
      </div>

      {activeTab === 'notice' && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                <ClipboardList className="text-purple-600" /> नोटीस माहिती भरा (Notice Details)
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-2">
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

              <div className="grid grid-cols-2 gap-4 mb-2">
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
                  <h1 className="text-[16px] font-normal text-black">{SOCIETY_FULL_NAME}</h1>
                  <div className="text-[11px] mt-0.5">E-mail secretaryilada1425@gmail.com</div>
                </div>
                <div className="flex justify-between font-normal mb-3 text-[13px]">
                  <span>जा.क्र. {noticeOutwardNo}</span>
                  <span>दिनांक {formatDateMarathi(noticeDate)}</span>
                </div>
                <div className="text-center mb-3">
                  <h2 className="text-[22px] font-bold inline-block" style={{ borderBottom: '2px solid black', paddingBottom: '2px' }}>सभेचे नोटीस</h2>
                  <div className="text-[13px] font-normal mt-1 italic">साधारण/तातडीची/तहकुब सभा</div>
                </div>
                <div className="mb-3 text-[13px]">
                  <p className="font-normal">प्रति,</p>
                  <p className="font-normal ml-6 text-[14px]" dangerouslySetInnerHTML={{ __html: selectedRecipient ? getRecipientDesignation(selectedRecipient) : 'अध्यक्ष/सचिव श्री. _____________________' }} />
                </div>
                <div className="mb-3 text-[14px] leading-relaxed text-justify" style={{ textIndent: '40px' }}>
                  <p dangerouslySetInnerHTML={{ __html: getProcessedNoticeBody().replace(/<strong>/g, '<u><b>').replace(/<\/strong>/g, '</b></u>') }} />
                </div>
                <div className="mb-4">
                  <h3 className="text-center font-bold text-[14px] mb-2" style={{ textDecoration: 'underline' }}>-: सभेचे विषय :-</h3>
                  <div className="space-y-1 text-[13px] leading-relaxed">
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
                      <p className="text-[13px] font-normal">सचिव</p>
                    </div>
                    <div className="w-[45%]">
                      <p className="text-[13px] font-normal">अध्यक्ष</p>
                    </div>
                  </div>
                  <p className="text-[15px] font-normal italic text-center">आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. नं. १४२५</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agm_notice' && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {/* Form Details */}
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                <ClipboardList className="text-teal-600" /> वार्षिक आमसभा नोटीस माहिती भरा (AGM Details)
              </h3>

              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">वर्ष (उदा. ३५वी)</label>
                  <input type="text" value={agmYear} onChange={e => setAgmYear(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">जावक क्र. (Outward No)</label>
                  <input type="text" value={agmOutwardNo} onChange={e => setAgmOutwardNo(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">नोटीस दिनांक</label>
                  <input type="date" value={agmNoticeDate} onChange={e => setAgmNoticeDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">सभेचे आर्थिक वर्ष (FY Year)</label>
                  <input type="text" value={agmMeetingYear} onChange={e => setAgmMeetingYear(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">सभेचा दिनांक</label>
                  <input type="date" value={agmMeetingDate} onChange={e => setAgmMeetingDate(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">प्रहर (Period)</label>
                  <select value={agmMeetingPeriod} onChange={e => setAgmMeetingPeriod(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold">
                    <option value="सकाळी">सकाळी</option>
                    <option value="दुपारी">दुपारी</option>
                    <option value="संध्याकाळी">संध्याकाळी</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">सभेची वेळ (Time)</label>
                  <input type="text" value={agmMeetingTime} onChange={e => setAgmMeetingTime(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">सभेचे स्थळ (Venue)</label>
                  <input type="text" value={agmVenue} onChange={e => setAgmVenue(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">सभेचे अध्यक्ष (Meeting Chairman)</label>
                  <input type="text" value={agmChairmanName} onChange={e => setAgmChairmanName(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">प्रभारी व्यवस्थापक</label>
                  <input type="text" value={agmManagerName} onChange={e => setAgmManagerName(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">उपाध्यक्ष</label>
                  <input type="text" value={agmViceChairmanName} onChange={e => setAgmViceChairmanName(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">अध्यक्ष (स्वाक्षरी नाव)</label>
                  <input type="text" value={agmChairmanSignName} onChange={e => setAgmChairmanSignName(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-bold" />
                </div>
              </div>

              <div className="mb-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">सभेपुढील विषय सूची (Agenda Subjects)</label>
                <textarea rows={6} value={agmAgenda} onChange={e => setAgmAgenda(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-medium" />
              </div>

              <div className="mb-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">टिप (Notes)</label>
                <textarea rows={4} value={agmTips} onChange={e => setAgmTips(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-medium" />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 mb-1">प्रतिलीपी सादर (Copy Forwarded to)</label>
                <textarea rows={4} value={agmForwardList} onChange={e => setAgmForwardList(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-xs font-medium" />
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                  🔍 फॉन्ट आकार नियंत्रण (Font Size Controls)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700">
                    <span className="font-semibold text-slate-500">मुख्य मजकूर:</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setAgmBodyFontSize(Math.max(10, agmBodyFontSize - 0.5))} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold dark:text-white">-</button>
                      <span className="font-bold text-slate-800 dark:text-white w-8 text-center">{agmBodyFontSize.toFixed(1)}</span>
                      <button type="button" onClick={() => setAgmBodyFontSize(Math.min(22, agmBodyFontSize + 0.5))} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold dark:text-white">+</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700">
                    <span className="font-semibold text-slate-500">सभेचे विषय:</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setAgmAgendaFontSize(Math.max(10, agmAgendaFontSize - 0.5))} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold dark:text-white">-</button>
                      <span className="font-bold text-slate-800 dark:text-white w-8 text-center">{agmAgendaFontSize.toFixed(1)}</span>
                      <button type="button" onClick={() => setAgmAgendaFontSize(Math.min(22, agmAgendaFontSize + 0.5))} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold dark:text-white">+</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700">
                    <span className="font-semibold text-slate-500">टिप (Notes):</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setAgmTipsFontSize(Math.max(8, agmTipsFontSize - 0.5))} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold dark:text-white">-</button>
                      <span className="font-bold text-slate-800 dark:text-white w-8 text-center">{agmTipsFontSize.toFixed(1)}</span>
                      <button type="button" onClick={() => setAgmTipsFontSize(Math.min(20, agmTipsFontSize + 0.5))} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold dark:text-white">+</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700">
                    <span className="font-semibold text-slate-500">प्रतिलीपी:</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setAgmForwardFontSize(Math.max(9, agmForwardFontSize - 0.5))} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold dark:text-white">-</button>
                      <span className="font-bold text-slate-800 dark:text-white w-8 text-center">{agmForwardFontSize.toFixed(1)}</span>
                      <button type="button" onClick={() => setAgmForwardFontSize(Math.min(22, agmForwardFontSize + 0.5))} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold dark:text-white">+</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowPreview(!showPreview)} className="bg-amber-100 text-amber-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                  <Eye size={20} /> {showPreview ? 'लपवा' : 'Preview पहा'}
                </button>
                <button
                  onClick={handlePrintAgmNotice}
                  disabled={isPrinting}
                  className={`bg-teal-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition ${isPrinting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-teal-700'}`}
                >
                  {isPrinting ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
                  {isPrinting ? 'प्रिंट होत आहे...' : 'आमसभा नोटीस प्रिंट (A4)'}
                </button>
              </div>
            </div>

            {/* Live Preview */}
            <div className={`bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border-2 border-dashed border-slate-300 flex justify-center overflow-x-auto min-h-[700px] ${!showPreview ? 'hidden lg:flex' : ''}`}>
              <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                <div ref={agmNoticePrintRef} className="bg-white text-black w-[210mm] shadow-2xl relative min-h-[297mm] border-2 border-black flex flex-col" style={{ fontFamily: "'DVOT SurekhMR', serif", boxSizing: 'border-box', fontSize: `${baseFontSize}px`, padding: '8mm 12mm 6mm 12mm', lineHeight: '1.45' }}>
                  
                  {/* Header */}
                  <div className="text-center relative">
                    <p className="m-0 font-bold tracking-wider" style={{ fontSize: `${baseFontSize - 1.5}px` }}>* बिना सहकार नाही उध्दार *</p>
                    <h1 className="m-1 font-bold text-black letter-spacing-[0.5px]" style={{ fontSize: `${baseFontSize + 4.5}px` }}>
                      आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र.नं.१४२५
                    </h1>
                    <p className="m-0 text-[13px] font-bold text-slate-800">ता.अर्जुनी/मोर. जि. गोंदिया</p>
                    <div className="border-b border-black mt-2 mb-1"></div>
                  </div>

                  {/* Year, Title and Date Row */}
                  <div className="flex justify-between font-bold text-[13px] mt-2 px-1">
                    <div className="w-[25%]">
                      <span>वर्ष {agmYear},</span>
                    </div>
                    <div className="w-[50%] text-center">
                      <h2 className="m-0 text-[20px] font-bold underline tracking-wider whitespace-nowrap">
                        वार्षिक सर्वसाधारण सभेची नोटीस
                      </h2>
                    </div>
                    <div className="w-[25%] text-right">
                      <span>दिनांक: {toMarathiNumber(agmNoticeDate.split('-').reverse().join('/'))}</span>
                    </div>
                  </div>

                  {/* Subtitle and Outward Row */}
                  <div className="flex justify-between font-bold text-[13px] mt-1 mb-3 px-1">
                    <div className="w-[33%] text-left">
                      जावक क्र. {toMarathiNumber(agmOutwardNo)}
                    </div>
                    <div className="w-[34%] text-center italic text-slate-700">
                      ( संस्थेच्या सभासदाकरिता )
                    </div>
                    <div className="w-[33%]"></div>
                  </div>

                  {/* Recipient Address Line */}
                  <div className="font-bold mb-3 border-b border-dashed border-slate-300 pb-2 flex items-baseline gap-1" style={{ fontSize: `${baseFontSize + 0.5}px` }}>
                    <span className="whitespace-nowrap">प्रति, सभासद श्री / श्रीमती :</span>
                    <span className="border-b border-dashed border-black flex-1 pl-2 text-slate-800 font-bold">
                      &nbsp;
                    </span>
                    <span className="ml-2 whitespace-nowrap">राहणार :</span>
                    <span className="border-b border-dashed border-black w-[110px]">&nbsp;</span>
                  </div>

                  {/* Salutation and Body */}
                  <div className="mb-3" style={{ fontSize: `${baseFontSize}px` }}>
                    <p className="m-0 font-bold">महोदय,</p>
                    <p className="indent-10 m-1 text-justify leading-relaxed font-medium">
                      आपणास सदर नोटीसाद्वारे सुचित करण्यात येते की, आदिवासी विविध कार्यकारी सह. संस्था मर्या. ईळदा र. नं. १४२५ या संस्थेची सन {toMarathiNumber(agmMeetingYear)} ची <strong>“वार्षिक आमसभा”</strong> ( सर्वसाधारण सभा ) दि. <strong>{toMarathiNumber(agmMeetingDate.split('-').reverse().join('/'))}</strong> रोज <strong>{getInviteDay(agmMeetingDate)}</strong> {agmMeetingPeriod} ठीक <strong>{toMarathiNumber(agmMeetingTime)}</strong> वाजता <strong>{agmVenue}</strong> घेण्याचे ठरवले आहे. तरी संस्थेचे सर्व सभासदांनी सभेला हजर राहुन खालील विषय सुची प्रमाणे सभेचे कामकाज चालविण्यास मदत करावे. सभेचे अध्यक्ष मा. श्री. <strong>{agmChairmanName}</strong> यांच्या अध्यक्षते खाली सभा पार पडेल.
                    </p>
                  </div>

                  {/* Agenda Title */}
                  <p className="text-center font-bold my-2 underline" style={{ fontSize: `${baseFontSize + 0.5}px` }}>
                    -: सभेपुढील विषय :-
                  </p>

                  {/* Agenda List */}
                  <ul className="list-none pl-0 m-0 space-y-1 font-medium" style={{ fontSize: `${baseFontSize - 1.5}px`, lineHeight: '1.4' }}>
                    {agmAgenda.split('\n').filter(l => l.trim() !== '').map((line, idx) => (
                      <li key={idx} className="text-justify pl-[18px] -indent-[18px]">
                        {toMarathiNumber(idx + 1)}) {line.replace(/^\d+[\s\.\)-]+/, '').trim()}
                      </li>
                    ))}
                  </ul>

                  {/* Tips Title & List */}
                  <div className="border border-black bg-slate-100 p-2 mt-3 rounded font-medium text-slate-800" style={{ fontSize: `${baseFontSize - 2}px`, lineHeight: '1.35' }}>
                    <span className="font-bold underline block mb-1">टिप:-</span>
                    <ul className="list-none pl-0 m-0 space-y-0.5">
                      {agmTips.split('\n').filter(l => l.trim() !== '').map((line, idx) => (
                        <li key={idx} className="text-justify">{line}</li>
                      ))}
                    </ul>
                  </div>

                  {/* First Signature Block */}
                  <div className="py-2 mt-4">
                    <div className="flex justify-between text-center font-bold" style={{ fontSize: `${baseFontSize - 0.5}px` }}>
                      <div className="w-[33%]">
                        <p className="m-0 whitespace-nowrap">{agmManagerName}</p>
                        <p className="m-0 font-normal" style={{ fontSize: `${baseFontSize - 1.5}px` }}>प्रभारी व्यवस्थापक</p>
                      </div>
                      <div className="w-[33%]">
                        <p className="m-0 whitespace-nowrap">{agmViceChairmanName}</p>
                        <p className="m-0 font-normal" style={{ fontSize: `${baseFontSize - 1.5}px` }}>उपाध्यक्ष</p>
                      </div>
                      <div className="w-[33%]">
                        <p className="m-0 whitespace-nowrap">{agmChairmanSignName}</p>
                        <p className="m-0 font-normal" style={{ fontSize: `${baseFontSize - 1.5}px` }}>अध्यक्ष</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-center font-bold m-1 underline" style={{ fontSize: `${baseFontSize - 1}px` }}>
                    आदिवासी विविध कार्य. सह. संस्था मर्या. ईळदा र. नं.१४२५
                  </p>

                  {/* Separator Removed */}
                  <div className="mt-4"></div>

                  {/* Forward Section */}
                  <div className="font-medium mb-3" style={{ fontSize: `${baseFontSize - 1}px`, lineHeight: '1.4' }}>
                    <span className="font-bold underline block mb-1">प्रतिलीपी सादर :-</span>
                    <ul className="list-none pl-0 m-0 space-y-0.5">
                      {agmForwardList.split('\n').filter(l => l.trim() !== '').map((line, idx) => (
                        <li key={idx} className="text-justify">{line}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Bottom Signature Block (Repeated) */}
                  <div className="mt-auto">
                    <div className="py-2">
                      <div className="flex justify-between text-center font-bold" style={{ fontSize: `${baseFontSize - 0.5}px` }}>
                        <div className="w-[33%]">
                          <p className="m-0 whitespace-nowrap">{agmManagerName}</p>
                          <p className="m-0 font-normal" style={{ fontSize: `${baseFontSize - 1.5}px` }}>प्रभारी व्यवस्थापक</p>
                        </div>
                        <div className="w-[33%]">
                          <p className="m-0 whitespace-nowrap">{agmViceChairmanName}</p>
                          <p className="m-0 font-normal" style={{ fontSize: `${baseFontSize - 1.5}px` }}>उपाध्यक्ष</p>
                        </div>
                        <div className="w-[33%]">
                          <p className="m-0 whitespace-nowrap">{agmChairmanSignName}</p>
                          <p className="m-0 font-normal" style={{ fontSize: `${baseFontSize - 1.5}px` }}>अध्यक्ष</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-center font-bold m-1 underline" style={{ fontSize: `${baseFontSize - 1}px` }}>
                      आदिवासी विविध कार्य. सह. संस्था मर्या. ईळदा र. नं.१४२५
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invitation' && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Invitation Details Form */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                <Mail className="text-rose-600" /> निमंत्रण पत्रिका माहिती भरा (Invitation Details)
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">कार्यक्रम प्रकार (Event Type)</label>
                  <select
                    value={inviteType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setInviteType(val);
                      const currentYear = new Date().getFullYear();
                      if (val === '15aug') {
                        setInviteDate(`${currentYear}-08-15`);
                      } else if (val === '26jan') {
                        setInviteDate(`${currentYear + 1}-01-26`);
                      }
                    }}
                    className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="15aug">१५ ऑगस्ट (स्वातंत्र्य दिन)</option>
                    <option value="26jan">२६ जानेवारी (प्रजासत्ताक दिन)</option>
                    <option value="custom">इतर / राष्ट्रीय दिन (Custom)</option>
                  </select>
                </div>

                {inviteType === 'custom' && (
                  <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-slate-500 mb-1">उत्सवाचे नाव (उदा. महाराष्ट्र दिनानिमित्त / संविधान दिनानिमित्त)</label>
                    <input
                      type="text"
                      value={customEventName}
                      onChange={(e) => setCustomEventName(e.target.value)}
                      className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold"
                      placeholder="उदा. महाराष्ट्र दिनानिमित्त"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">दिनांक (Date)</label>
                    <input
                      type="date"
                      value={inviteDate}
                      onChange={(e) => setInviteDate(e.target.value)}
                      className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">दिवस / वार (Day)</label>
                    <input
                      type="text"
                      disabled
                      value={getInviteDay(inviteDate)}
                      className="w-full p-2 border dark:border-slate-600 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">प्रहर (Period)</label>
                    <select
                      value={invitePeriod}
                      onChange={(e) => setInvitePeriod(e.target.value)}
                      className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold"
                    >
                      <option value="none">काही नाही</option>
                      <option value="सकाळी">सकाळी</option>
                      <option value="दुपारी">दुपारी</option>
                      <option value="संध्याकाळी">संध्याकाळी</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">वेळ (Time)</label>
                    <input
                      type="text"
                      value={inviteTime}
                      onChange={(e) => setInviteTime(e.target.value)}
                      className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">उत्सव वर्ष (Ed. No.)</label>
                    <input
                      type="text"
                      value={inviteEdition}
                      onChange={(e) => setInviteEdition(e.target.value)}
                      className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ध्वजारोहण शुभहस्ते (Chief Guest Name)</label>
                  <input
                    type="text"
                    value={inviteChiefGuest}
                    onChange={(e) => setInviteChiefGuest(e.target.value)}
                    className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold"
                    placeholder="उदा. मा. श्री. तानाजी शामराव ताराम"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">हुद्दा / पद (Designation)</label>
                  <input
                    type="text"
                    value={inviteGuestDesignation}
                    onChange={(e) => setInviteGuestDesignation(e.target.value)}
                    className="w-full p-2 border dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div className="pt-4 border-t dark:border-slate-700 space-y-3">
                  <button
                    onClick={() => handlePrintInvitation('directors')}
                    className="w-full bg-rose-600 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-rose-700 transition shadow-sm font-bold text-sm"
                  >
                    <Printer size={18} /> संचालक निमंत्रण पत्रिका प्रिंट करा (Print for Directors)
                  </button>

                  <button
                    onClick={() => handlePrintInvitation('blank')}
                    className="w-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-600 transition font-bold text-sm border dark:border-slate-600"
                  >
                    <Download size={18} /> कोरी निमंत्रण पत्रिका प्रिंट करा (Print Blank Card)
                  </button>
                </div>
              </div>
            </div>

            {/* Live Interactive Card Preview */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700">
              <span className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Live Preview (निमंत्रण पत्रिका स्वरूप)</span>
              
              <div
                className="bg-white text-black p-4 rounded-lg shadow-xl relative border-2 border-dashed border-slate-400 w-full max-w-[420px] min-h-[275px] flex flex-col justify-between"
                style={{ fontFamily: "'DVOT SurekhMR', serif" }}
              >
                {/* Header Block */}
                <div className="text-center border-b pb-1 mb-1 border-slate-300">
                  <h4 className="text-[11px] font-bold text-slate-800 leading-tight">{SOCIETY_FULL_NAME}</h4>
                  <p className="text-[8.5px] text-slate-500 mt-0.5">ता. अर्जुनी/मोर. जि. गोंदिया</p>
                </div>

                {/* Flags and Title Row */}
                <div className="flex items-center justify-between my-1">
                  <svg viewBox="0 0 100 24" className="w-14 h-5 opacity-90">
                    <path d="M 0 6 Q 25 2 50 6 T 100 6 L 100 12 Q 75 12 50 16 T 0 16 Z" fill="#FF9933" />
                    <path d="M 0 11 Q 25 7 50 11 T 100 11 L 100 17 Q 75 17 50 21 T 0 21 Z" fill="#FFFFFF" />
                    <path d="M 0 16 Q 25 12 50 16 T 100 16 L 100 22 Q 75 22 50 26 T 0 26 Z" fill="#138808" />
                    <circle cx="50" cy="13.5" r="2.5" fill="none" stroke="#000080" strokeWidth="0.4" />
                  </svg>

                  <h3 className="text-xs font-bold text-black text-center underline">✡ निमंत्रण पत्रिका ✡</h3>

                  <svg viewBox="0 0 100 24" className="w-14 h-5 opacity-90">
                    <path d="M 0 6 Q 25 2 50 6 T 100 6 L 100 12 Q 75 12 50 16 T 0 16 Z" fill="#FF9933" />
                    <path d="M 0 11 Q 25 7 50 11 T 100 11 L 100 17 Q 75 17 50 21 T 0 21 Z" fill="#FFFFFF" />
                    <path d="M 0 16 Q 25 12 50 16 T 100 16 L 100 22 Q 75 22 50 26 T 0 26 Z" fill="#138808" />
                    <circle cx="50" cy="13.5" r="2.5" fill="none" stroke="#000080" strokeWidth="0.4" />
                  </svg>
                </div>

                {/* Content Block */}
                <div className="flex-1 flex flex-col justify-center text-[10.5px] leading-relaxed my-1.5">
                  <p className="mb-1.5 font-bold">
                    श्री/श्रीमती <span className="border-b border-dashed border-black px-3 py-0.5 inline-block text-center font-bold text-slate-800 min-w-[120px]">_________________</span> स.न.वि.वि.
                  </p>
                  <p className="text-justify indent-6">
                    आपणास कळविण्यात येते की दि. <strong>{inviteDate.split('-').reverse().join('.')}</strong> रोज <strong>{getInviteDay(inviteDate)}</strong> ला {invitePeriod !== 'none' ? <strong>{invitePeriod} </strong> : ''}ठीक <strong>{inviteTime}</strong> वाजता <strong>{inviteType === '15aug' ? `${inviteEdition} व्या स्वातंत्र्य दिनानिमित्त` : inviteType === '26jan' ? `${inviteEdition} व्या प्रजासत्ताक दिनानिमित्त` : (customEventName || 'राष्ट्रीय दिनानिमित्त')}</strong> ध्वजारोहण मा. श्री. <strong>{inviteChiefGuest}</strong> {inviteGuestDesignation} {SOCIETY_FULL_NAME} यांचे शुभ हस्ते होत आहे.
                  </p>
                  <p className="text-center font-bold mt-2 text-[11px]">
                    तरी सदर कार्यक्रमास आपली उपस्थिती प्रार्थनीय आहे.
                  </p>
                </div>

                {/* Footer Signature Block */}
                <div className="border-t pt-1 mt-1 text-center text-[9px] font-bold">
                  <p className="underline text-slate-700">आपले विनीत</p>
                  <p className="text-slate-600 mt-0.5">संचालक मंडळ तथा सचिव व कर्मचारी</p>
                  <p className="text-slate-500 mt-0.5">{SOCIETY_FULL_NAME}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'board' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[550px]">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col overflow-hidden">
              <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Select From Members</h4>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input type="text" placeholder="Search by name..." value={boardSearch} onChange={e => setBoardSearch(e.target.value)} className="w-full pl-9 p-2 rounded border dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {members.filter(m => !boardMemberIds.has(m.id) && (m.name.toLowerCase().includes(boardSearch.toLowerCase()) || (m.nameEn && m.nameEn.toLowerCase().includes(boardSearch.toLowerCase())) || m.memberNo.includes(boardSearch))).slice(0, 50).map(m => (
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
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 mb-2">
            <div className="flex justify-between items-center mb-2">
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
                <div className="text-center mb-2 border-b pb-4">
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
          <div className="flex justify-end mb-2">
            <button onClick={() => { setEditingMeetingId(null); setTitle(''); setDate(format(new Date(), 'yyyy-MM-dd')); setVenue(''); setType('Monthly'); setAttendeesCount(0); setSelectedAttendees(new Set()); setResolutions(''); setShowModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm font-bold text-sm"><Plus size={18} /> Record New Meeting</button>
          </div>
          {meetings.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700"><Handshake size={48} className="mx-auto text-slate-300 mb-2" /><p className="text-slate-500 dark:text-slate-400">No meeting records found.</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm p-4"><div className="bg-white dark:bg-slate-800 rounded-xl p-3 w-full max-w-sm shadow-2xl border border-red-100 dark:border-red-900 animate-fade-in-up"><div className="text-center mb-2"><div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-2 text-red-600"><ShieldCheck size={32} /></div><h3 className="text-xl font-bold text-slate-800 dark:text-white">Security Check</h3><p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter Security PIN to delete this record.</p></div><div className="space-y-4"><input type="password" autoFocus className="w-full p-3 text-center text-2xl tracking-widest border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none" placeholder="PIN" maxLength={4} value={deletePin} onChange={e => setDeletePin(e.target.value)} />{deleteError && <p className="text-red-500 text-center text-sm font-medium">{deleteError}</p>}<div className="flex gap-3"><button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 border dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button><button onClick={confirmDeleteMeeting} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">Delete</button></div></div></div></div>
      )}
    </div>
  );
};

export default Meetings;

