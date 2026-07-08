import React, { useState, useMemo } from 'react';
import { FileText, Search, Plus, Trash2, Edit2, Download, Printer, Settings, Check, X, Calculator } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NclRecord } from '../types';
import { format } from 'date-fns';
import { downloadBlob } from '../utils/downloadUtils';
import * as XLSX from 'xlsx';

const VILLAGE_SORT_ORDER = [
  'ईळदा',
  'परसटोला',
  'अरततोंडी',
  'धमदिटोला',
  'धमदीटोला',
  'जुनेवानी',
  'जांभळी',
  'कन्हाळगाव',
  'सायगाव',
  'सायगांव',
  'राजोली',
  'भरनोली',
  'खडकी',
  'तिरखुरी',
  'दतरखुरी'
];

export default function NclManager() {
  const {
    members,
    nclRecords,
    addNclRecord,
    updateNclRecord,
    deleteNclRecord,
    settings,
    updateSettings
  } = useApp();

  const [activeTab, setActiveTab] = useState<'manage' | 'print'>('manage');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecord, setEditingRecord] = useState<NclRecord | null>(null);

  // Global NCL Configuration variables
  const ratePerAcre = settings.nclRatePerAcre ?? 32000;
  const defaultRevenueCircle = settings.nclRevenueCircleDefault ?? 'कनेरी';

  // Config State
  const [rateInput, setRateInput] = useState(ratePerAcre);
  const [circleInput, setCircleInput] = useState(defaultRevenueCircle);
  const [showConfig, setShowConfig] = useState(false);

  // Handle global settings save
  const handleSaveSettings = () => {
    updateSettings({
      nclRatePerAcre: Number(rateInput),
      nclRevenueCircleDefault: circleInput
    });
    setShowConfig(false);
  };

  // Sort function to order NCL entries by village using custom order
  const sortedNclRecords = useMemo(() => {
    return [...nclRecords].sort((a, b) => {
      const memberA = members.find(m => m.id === a.memberId);
      const memberB = members.find(m => m.id === b.memberId);
      if (!memberA) return 1;
      if (!memberB) return -1;

      const idxA = VILLAGE_SORT_ORDER.findIndex(v => 
        memberA.village.toLowerCase().includes(v.toLowerCase()) || 
        v.toLowerCase().includes(memberA.village.toLowerCase())
      );
      const idxB = VILLAGE_SORT_ORDER.findIndex(v => 
        memberB.village.toLowerCase().includes(v.toLowerCase()) || 
        v.toLowerCase().includes(memberB.village.toLowerCase())
      );

      const valA = idxA === -1 ? 999 : idxA;
      const valB = idxB === -1 ? 999 : idxB;

      if (valA !== valB) return valA - valB;

      // Secondary sorting by member number
      return memberA.memberNo.localeCompare(memberB.memberNo);
    });
  }, [nclRecords, members]);

  // List of members who are NOT already in the NCL list
  const availableMembers = useMemo(() => {
    const existingIds = new Set(nclRecords.map(r => r.memberId));
    return members.filter(m => !existingIds.has(m.id));
  }, [members, nclRecords]);

  // Search filtered list of available members
  const searchedMembers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return availableMembers.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.memberNo.includes(q) ||
      m.village.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [searchQuery, availableMembers]);

  // Add member to NCL list
  const handleAddMember = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    // Convert landArea string safely
    const landNum = parseFloat(member.landArea) || 0;

    const newRecord: NclRecord = {
      id: `ncl_${memberId}_${Date.now()}`,
      memberId,
      revenueCircle: defaultRevenueCircle,
      landArea: landNum,
      wetPaddyAcres: landNum, // defaults wet paddy to total acres
      dryPaddyAcres: 0,
      summerCropAcres: 0,
      recommendedAcres: landNum,
      recommendedCash: landNum * ratePerAcre,
      inspectorAcres: landNum,
      inspectorCash: landNum * ratePerAcre
    };

    addNclRecord(newRecord);
    setSearchQuery('');
  };

  // NCL list stats
  const stats = useMemo(() => {
    let totalLand = 0;
    let totalDemandCash = 0;
    nclRecords.forEach(r => {
      totalLand += r.landArea;
      const totalAcres = r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres;
      totalDemandCash += totalAcres * ratePerAcre;
    });
    return {
      count: nclRecords.length,
      totalLand,
      totalDemandCash
    };
  }, [nclRecords, ratePerAcre]);

  // Save NCL record edits
  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    // Calculate total demand acres and cash
    const totalAcres = editingRecord.wetPaddyAcres + editingRecord.dryPaddyAcres + editingRecord.summerCropAcres;
    const totalCash = totalAcres * ratePerAcre;

    const updated = {
      ...editingRecord,
      recommendedAcres: editingRecord.recommendedAcres ?? totalAcres,
      recommendedCash: editingRecord.recommendedCash ?? totalCash,
      inspectorAcres: editingRecord.inspectorAcres ?? totalAcres,
      inspectorCash: editingRecord.inspectorCash ?? totalCash
    };

    updateNclRecord(updated);
    setEditingRecord(null);
  };

  // Export NCL list to Excel
  const handleExportExcel = () => {
    const headers = [
      'अ. क्र.',
      'सभासदाचे नाव',
      'सभा. क्रमांक',
      'हिस्से जमा रक्कम',
      'गाव',
      'महसूल मंडळ',
      'आराजी (एकर)',
      'धान ओलीत आराजी',
      'धान ओलीत नगदी',
      'धान कोरडवाहू आराजी',
      'धान कोरडवाहू नगदी',
      'एकूण खरीप आराजी',
      'एकूण खरीप नगदी',
      'बागायती आराजी',
      'बागायती नगदी',
      'एकूण मागणी आराजी',
      'एकूण मागणी नगदी',
      'संस्थेची शिफारस आराजी',
      'संस्थेची शिफारस नगदी',
      'निरीक्षक शिफारस आराजी',
      'निरीक्षक शिफारस नगदी'
    ];

    const rows = sortedNclRecords.map((r, idx) => {
      const m = members.find(mem => mem.id === r.memberId);
      const paddyTotalAcres = r.wetPaddyAcres + r.dryPaddyAcres;
      const paddyTotalCash = paddyTotalAcres * ratePerAcre;
      const totalDemandAcres = paddyTotalAcres + r.summerCropAcres;
      const totalDemandCash = totalDemandAcres * ratePerAcre;

      return [
        idx + 1,
        m?.name || 'N/A',
        m?.memberNo || 'N/A',
        m?.shareBalance || 0,
        m?.village || 'N/A',
        r.revenueCircle,
        r.landArea,
        r.wetPaddyAcres,
        r.wetPaddyAcres * ratePerAcre,
        r.dryPaddyAcres,
        r.dryPaddyAcres * ratePerAcre,
        paddyTotalAcres,
        paddyTotalCash,
        r.summerCropAcres,
        r.summerCropAcres * ratePerAcre,
        totalDemandAcres,
        totalDemandCash,
        r.recommendedAcres ?? totalDemandAcres,
        r.recommendedCash ?? totalDemandCash,
        r.inspectorAcres ?? totalDemandAcres,
        r.inspectorCash ?? totalDemandCash
      ];
    });

    // Add Total Row
    if (rows.length > 0) {
      const totals = rows.reduce((acc, curr) => {
        for (let col = 6; col < curr.length; col++) {
          acc[col] = (acc[col] || 0) + (curr[col] as number);
        }
        return acc;
      }, ['एकूण', '', '', rows.reduce((s, c) => s + (c[3] as number), 0), '', ''] as any[]);

      rows.push(totals);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NCL Report");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `NCL_Report_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-32 animate-fade-in no-print">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="text-blue-600" /> कमाल कर्ज मर्यादा पत्रके (NCL)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            पतसंस्थेच्या सभासदांसाठी आराजीनिहाय (एकर) कर्ज मर्यादा यादी व्यवस्थापन
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab(activeTab === 'manage' ? 'print' : 'manage')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow transition ${
              activeTab === 'print'
                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            {activeTab === 'print' ? <Edit2 size={16} /> : <Printer size={16} />}
            {activeTab === 'print' ? 'नोंदणी व्ह्यू (Manage)' : 'प्रिंट प्रिव्ह्यू (Print View)'}
          </button>
          {activeTab === 'print' && (
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow flex items-center gap-2 font-semibold text-sm transition"
            >
              <Printer size={16} /> प्रिंट करा
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow flex items-center gap-2 font-semibold text-sm transition"
          >
            <Download size={16} /> Excel Export
          </button>
        </div>
      </div>

      {activeTab === 'manage' ? (
        <div className="space-y-6">
          {/* Settings & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Global Configuration Card */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-md border dark:border-slate-700 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                    <Settings className="text-slate-400" size={18} /> NCL दर आणि मंडळ
                  </h3>
                  <button
                    onClick={() => {
                      if (!showConfig) {
                        setRateInput(ratePerAcre);
                        setCircleInput(defaultRevenueCircle);
                      }
                      setShowConfig(!showConfig);
                    }}
                    className="text-xs text-blue-600 hover:underline font-bold"
                  >
                    {showConfig ? 'रद्द' : 'बदला'}
                  </button>
                </div>

                {!showConfig ? (
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">प्रति एकर कर्ज मर्यादा दर:</span>
                      <span className="font-mono font-bold text-blue-600">₹{ratePerAcre.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">डिफॉल्ट महसूल मंडळ:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{defaultRevenueCircle}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 mt-3 animate-fade-in">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">कर्ज दर प्रति एकर (₹)</label>
                      <input
                        type="number"
                        value={rateInput}
                        onChange={e => setRateInput(Number(e.target.value))}
                        className="w-full p-1.5 text-xs border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">महसूल मंडळ नाव</label>
                      <input
                        type="text"
                        value={circleInput}
                        onChange={e => setCircleInput(e.target.value)}
                        className="w-full p-1.5 text-xs border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900"
                      />
                    </div>
                    <button
                      onClick={handleSaveSettings}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <Check size={12} /> जतन करा
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Total Members Stats */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-md border dark:border-slate-700 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">NCL यादीतील एकूण सभासद</span>
                <p className="text-3xl font-black text-slate-800 dark:text-white mt-1">{stats.count}</p>
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                एकूण १३९७ नोंदणीकृत सभासदांपैकी समाविष्ट संख्या
              </div>
            </div>

            {/* Total Demand / Land */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-md border dark:border-slate-700 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">एकूण शेतजमीन / कर्ज मागणी</span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {stats.totalLand.toFixed(2)} <span className="text-xs">एकर</span>
                </p>
                <p className="text-sm font-bold text-blue-600 mt-0.5">
                  ₹{stats.totalDemandCash.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Add Member Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border dark:border-slate-700 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">कर्ज मागणी नुसार सभासदाला NCL यादीत जोडा</h3>
            <div className="relative">
              <input
                type="text"
                placeholder="सभासदाचे नाव, खाते क्रमांक किंवा गाव शोधून निवडा..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition text-sm text-slate-800 dark:text-slate-100"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />

              {searchQuery && (
                <div className="absolute top-11 left-0 right-0 border dark:border-slate-700 rounded-lg max-h-60 overflow-y-auto bg-white dark:bg-slate-800 shadow-xl z-20">
                  {searchedMembers.length > 0 ? (
                    searchedMembers.map(m => (
                      <div
                        key={m.id}
                        onClick={() => handleAddMember(m.id)}
                        className="p-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center text-sm border-b dark:border-slate-700"
                      >
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{m.name}</span>
                          <span className="text-xs text-slate-500 ml-2">({m.village})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">क्रमांक: {m.memberNo} | जमीन: {m.landArea || '0'} एकर</span>
                          <Plus size={16} className="text-blue-600" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-400 text-xs">कोणतेही नवीन सभासद सापडले नाहीत किंवा आधीच यादीत समाविष्ट आहेत.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 text-sm">
              NCL सभासद यादी (गावानुसार सॉर्ट केलेली)
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold">
                  <tr className="border-b dark:border-slate-700">
                    <th className="p-3">अ. क्र.</th>
                    <th className="p-3">नाव व क्रमांक</th>
                    <th className="p-3">गाव / मंडळ</th>
                    <th className="p-3">आराजी (एकर)</th>
                    <th className="p-3">धान ओलीत (एकर)</th>
                    <th className="p-3">धान कोरडवाहू (एकर)</th>
                    <th className="p-3">बागा. उन्हाळी (एकर)</th>
                    <th className="p-3">एकूण मागणी</th>
                    <th className="p-3 text-center">क्रिया</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                  {sortedNclRecords.length > 0 ? (
                    sortedNclRecords.map((r, idx) => {
                      const m = members.find(mem => mem.id === r.memberId);
                      const totalAcres = r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres;
                      const totalCash = totalAcres * ratePerAcre;

                      return (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3 font-mono">{idx + 1}</td>
                          <td className="p-3">
                            <p className="font-bold text-slate-900 dark:text-white">{m?.name || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400">क्रमांक: {m?.memberNo || 'N/A'} | हिस्से: ₹{m?.shareBalance || 0}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-medium">{m?.village || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400">मंडळ: {r.revenueCircle}</p>
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-600">{r.landArea} एकर</td>
                          <td className="p-3 font-mono">{r.wetPaddyAcres} ac (₹{(r.wetPaddyAcres * ratePerAcre).toLocaleString()})</td>
                          <td className="p-3 font-mono">{r.dryPaddyAcres} ac (₹{(r.dryPaddyAcres * ratePerAcre).toLocaleString()})</td>
                          <td className="p-3 font-mono">{r.summerCropAcres} ac (₹{(r.summerCropAcres * ratePerAcre).toLocaleString()})</td>
                          <td className="p-3">
                            <p className="font-mono font-bold text-emerald-600">{totalAcres} ac</p>
                            <p className="text-[10px] text-slate-400 font-mono">₹{totalCash.toLocaleString()}</p>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setEditingRecord(r)}
                                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => deleteNclRecord(r.id)}
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded transition"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 text-sm">यादीमध्ये कोणतेही सभासद जोडलेले नाहीत. कृपया वरील शोध पेटी वापरून सभासद जोडा.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Print Layout preview in application context */
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border dark:border-slate-700 overflow-x-auto p-4 md:p-8">
          <div className="text-center font-bold text-slate-800 dark:text-white mb-6">
            <h2 className="text-lg">दि गोंदिया डिस्ट्रिक्ट सेंट्रल को-ऑपरेटिव्ह बँक लि., गोंदिया</h2>
            <h3 className="text-sm mt-1">आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. न. १४२५ विकास खंड - अर्जुनी/मोर.</h3>
            <h4 className="text-xs text-slate-500 dark:text-slate-400 mt-1">सन २०२६-२०२७ ते २०२८-२०२९ पावेतो कमाल कर्ज मर्यादा पत्रके (NCL)</h4>
          </div>

          <table className="w-full text-[10px] border border-collapse border-slate-300 dark:border-slate-600">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-600">
                <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">अ. क्र.</th>
                <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 p-1.5 text-left">सभासदाचे नाव</th>
                <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">सभा. क्रमांक</th>
                <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 p-1.5 text-right">हिस्से जमा रक्कम</th>
                <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">गाव</th>
                <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">महसूल मंडळ</th>
                <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">आराजी (एकर)</th>
                <th colSpan={6} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">सभासदांचे खरीप / रब्बी पिक कर्ज मागणी तपशील</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">बागायती पिके व इतर उन्हाळी पिके</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">एकूण कर्ज मागणी</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">संस्थेची कर्ज मर्यादा शिफारस</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1.5 text-center">शाखा निरीक्षकाची शिफारस</th>
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-600">
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1 text-center">धान ओलीत</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1 text-center">धान कोरडवाहू</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1 text-center">एकूण</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1 text-center">उन्हाळी पिके</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1 text-center">एकूण मागणी</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1 text-center">संस्था</th>
                <th colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1 text-center">शाखा निरीक्षक</th>
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-600">
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">आराजी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">नगदी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">आराजी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">नगदी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">आराजी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">नगदी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">आराजी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">नगदी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">आराजी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">नगदी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">आराजी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">नगदी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">आराजी</th>
                <th className="border border-slate-300 dark:border-slate-600 p-1 text-center">नगदी</th>
              </tr>
            </thead>
            <tbody>
              {sortedNclRecords.map((r, idx) => {
                const m = members.find(mem => mem.id === r.memberId);
                const paddyTotalAcres = r.wetPaddyAcres + r.dryPaddyAcres;
                const paddyTotalCash = paddyTotalAcres * ratePerAcre;
                const totalDemandAcres = paddyTotalAcres + r.summerCropAcres;
                const totalDemandCash = totalDemandAcres * ratePerAcre;

                return (
                  <tr key={r.id} className="border-b border-slate-300 dark:border-slate-600 font-mono text-center">
                    <td className="border border-slate-300 dark:border-slate-600 p-1">{idx + 1}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-left font-sans font-bold">{m?.name || 'N/A'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1">{m?.memberNo || 'N/A'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">₹{(m?.shareBalance || 0).toLocaleString()}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 font-sans">{m?.village || 'N/A'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 font-sans">{r.revenueCircle}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 font-bold">{r.landArea.toFixed(2)}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1">{r.wetPaddyAcres > 0 ? r.wetPaddyAcres.toFixed(2) : '-'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">{r.wetPaddyAcres > 0 ? (r.wetPaddyAcres * ratePerAcre).toLocaleString() : '-'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1">{r.dryPaddyAcres > 0 ? r.dryPaddyAcres.toFixed(2) : '-'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">{r.dryPaddyAcres > 0 ? (r.dryPaddyAcres * ratePerAcre).toLocaleString() : '-'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 font-bold">{paddyTotalAcres > 0 ? paddyTotalAcres.toFixed(2) : '-'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-right font-bold">{paddyTotalCash > 0 ? paddyTotalCash.toLocaleString() : '-'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1">{r.summerCropAcres > 0 ? r.summerCropAcres.toFixed(2) : '-'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">{r.summerCropAcres > 0 ? (r.summerCropAcres * ratePerAcre).toLocaleString() : '-'}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 font-bold text-blue-600">{totalDemandAcres.toFixed(2)}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-right font-bold text-blue-600">{totalDemandCash.toLocaleString()}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 font-bold text-emerald-600">{(r.recommendedAcres ?? totalDemandAcres).toFixed(2)}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-right font-bold text-emerald-600">{(r.recommendedCash ?? totalDemandCash).toLocaleString()}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 font-bold">{(r.inspectorAcres ?? totalDemandAcres).toFixed(2)}</td>
                    <td className="border border-slate-300 dark:border-slate-600 p-1 text-right font-bold">{(r.inspectorCash ?? totalDemandCash).toLocaleString()}</td>
                  </tr>
                );
              })}

              {/* Grand Total Row */}
              {sortedNclRecords.length > 0 && (
                <tr className="bg-slate-50 dark:bg-slate-900 border-t-2 border-double border-slate-400 font-mono font-bold text-center">
                  <td colSpan={3} className="border border-slate-300 dark:border-slate-600 p-1 font-sans">एकूण</td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">
                    ₹{sortedNclRecords.reduce((sum, r) => sum + (members.find(mem => mem.id === r.memberId)?.shareBalance || 0), 0).toLocaleString()}
                  </td>
                  <td colSpan={2} className="border border-slate-300 dark:border-slate-600 p-1"></td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1">
                    {sortedNclRecords.reduce((sum, r) => sum + r.landArea, 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1">
                    {sortedNclRecords.reduce((sum, r) => sum + r.wetPaddyAcres, 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.wetPaddyAcres * ratePerAcre), 0).toLocaleString()}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1">
                    {sortedNclRecords.reduce((sum, r) => sum + r.dryPaddyAcres, 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.dryPaddyAcres * ratePerAcre), 0).toLocaleString()}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.wetPaddyAcres + r.dryPaddyAcres), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">
                    {sortedNclRecords.reduce((sum, r) => sum + ((r.wetPaddyAcres + r.dryPaddyAcres) * ratePerAcre), 0).toLocaleString()}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1">
                    {sortedNclRecords.reduce((sum, r) => sum + r.summerCropAcres, 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.summerCropAcres * ratePerAcre), 0).toLocaleString()}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">
                    {sortedNclRecords.reduce((sum, r) => sum + ((r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres) * ratePerAcre), 0).toLocaleString()}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.recommendedAcres ?? (r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres)), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.recommendedCash ?? ((r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres) * ratePerAcre)), 0).toLocaleString()}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.inspectorAcres ?? (r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres)), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-600 p-1 text-right">
                    {sortedNclRecords.reduce((sum, r) => sum + (r.inspectorCash ?? ((r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres) * ratePerAcre)), 0).toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Editing Dialog Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={handleUpdateRecord}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border dark:border-slate-700 w-full max-w-lg overflow-hidden animate-zoom-in"
          >
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold">NCL तपशील संपादन (Edit NCL Record)</h3>
              <button type="button" onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  सभासद: {members.find(m => m.id === editingRecord.memberId)?.name}
                </p>
                <p className="text-slate-500 mt-1">
                  गाव: {members.find(m => m.id === editingRecord.memberId)?.village}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">एकूण शेतजमीन / आराजी (एकर)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingRecord.landArea}
                    onChange={e => setEditingRecord({ ...editingRecord, landArea: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">महसूल मंडळ</label>
                  <input
                    type="text"
                    required
                    value={editingRecord.revenueCircle}
                    onChange={e => setEditingRecord({ ...editingRecord, revenueCircle: e.target.value })}
                    className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="border-t dark:border-slate-700 pt-4">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2">कर्ज मागणी तपशील (आराजी एकर मध्ये)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">धान ओलीत</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRecord.wetPaddyAcres}
                      onChange={e => setEditingRecord({ ...editingRecord, wetPaddyAcres: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">₹{(editingRecord.wetPaddyAcres * ratePerAcre).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">धान कोरडवाहू</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRecord.dryPaddyAcres}
                      onChange={e => setEditingRecord({ ...editingRecord, dryPaddyAcres: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">₹{(editingRecord.dryPaddyAcres * ratePerAcre).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">बागायती/उन्हाळी</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRecord.summerCropAcres}
                      onChange={e => setEditingRecord({ ...editingRecord, summerCropAcres: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">₹{(editingRecord.summerCropAcres * ratePerAcre).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="border-t dark:border-slate-700 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">संस्थेची शिफारस (आराजी एकर)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="रिकामे सोडल्यास एकूण मागणीएवढे"
                    value={editingRecord.recommendedAcres || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, recommendedAcres: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">संस्थेची शिफारस नगदी (₹)</label>
                  <input
                    type="number"
                    placeholder="रिकामे सोडल्यास एकूण मागणीएवढे"
                    value={editingRecord.recommendedCash || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, recommendedCash: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">निरीक्षक शिफारस (आराजी एकर)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="रिकामे सोडल्यास एकूण मागणीएवढे"
                    value={editingRecord.inspectorAcres || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, inspectorAcres: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">निरीक्षक शिफारस नगदी (₹)</label>
                  <input
                    type="number"
                    placeholder="रिकामे सोडल्यास एकूण मागणीएवढे"
                    value={editingRecord.inspectorCash || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, inspectorCash: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full p-2 border dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t dark:border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 border dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                रद्द
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 shadow transition"
              >
                बदल जतन करा
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Styled Printable NCL Sheet Document */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            font-size: 8px !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print, nav, header, footer, button, .ios-tabbar, #mitra-widget {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-sheet {
            display: block !important;
            padding: 20px !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 8px !important;
            color: black !important;
          }
          th, td {
            border: 1px solid #000 !important;
            padding: 4px !important;
            text-align: center !important;
          }
          th {
            background-color: #f2f2f2 !important;
          }
          @page {
            size: landscape;
            margin: 0.5cm;
          }
        }
      `}</style>

      {/* Print sheet replica hidden in standard UI, displayed on window.print() */}
      <div className="hidden print:block print-sheet">
        <div className="text-center font-bold text-black mb-4">
          <h2 className="text-sm">दि गोंदिया डिस्ट्रिक्ट सेंट्रल को-ऑपरेटिव्ह बँक लि., गोंदिया</h2>
          <h3 className="text-xs mt-0.5">आदिवासी विविध कार्यकारी सहकारी संस्था मर्यादित ईळदा र. न. १४२५ विकास खंड - अर्जुनी/मोर.</h3>
          <h4 className="text-[10px] mt-0.5">सन २०२६-२०२७ ते २०२८-२०२९ पावेतो कमाल कर्ज मर्यादा पत्रके (NCL)</h4>
        </div>

        <table className="w-full border border-collapse border-black text-[8px]">
          <thead>
            <tr className="bg-slate-100 border-b border-black">
              <th rowSpan={3} className="border border-black p-1 text-center">अ. क्र.</th>
              <th rowSpan={3} className="border border-black p-1 text-left">सभासदाचे नाव</th>
              <th rowSpan={3} className="border border-black p-1 text-center">सभा. क्रमांक</th>
              <th rowSpan={3} className="border border-black p-1 text-right">हिस्से जमा रक्कम</th>
              <th rowSpan={3} className="border border-black p-1 text-center">गाव</th>
              <th rowSpan={3} className="border border-black p-1 text-center">महसूल मंडळ</th>
              <th rowSpan={3} className="border border-black p-1 text-center">आराजी (एकर)</th>
              <th colSpan={6} className="border border-black p-1 text-center">सभासदांचे खरीप / रब्बी पिक कर्ज मागणी तपशील</th>
              <th colSpan={2} className="border border-black p-1 text-center">बागायती पिके व इतर उन्हाळी पिके</th>
              <th colSpan={2} className="border border-black p-1 text-center">एकूण कर्ज मागणी</th>
              <th colSpan={2} className="border border-black p-1 text-center">संस्थेची कर्ज मर्यादा शिफारस</th>
              <th colSpan={2} className="border border-black p-1 text-center">शाखा निरीक्षकाची शिफारस</th>
            </tr>
            <tr className="bg-slate-100 border-b border-black">
              <th colSpan={2} className="border border-black p-0.5 text-center">धान ओलीत</th>
              <th colSpan={2} className="border border-black p-0.5 text-center">धान कोरडवाहू</th>
              <th colSpan={2} className="border border-black p-0.5 text-center">एकूण</th>
              <th colSpan={2} className="border border-black p-0.5 text-center">उन्हाळी पिके</th>
              <th colSpan={2} className="border border-black p-0.5 text-center">एकूण मागणी</th>
              <th colSpan={2} className="border border-black p-0.5 text-center">संस्था</th>
              <th colSpan={2} className="border border-black p-0.5 text-center">शाखा निरीक्षक</th>
            </tr>
            <tr className="bg-slate-100 border-b border-black">
              <th className="border border-black p-0.5 text-center">आराजी</th>
              <th className="border border-black p-0.5 text-center">नगदी</th>
              <th className="border border-black p-0.5 text-center">आराजी</th>
              <th className="border border-black p-0.5 text-center">नगदी</th>
              <th className="border border-black p-0.5 text-center">आराजी</th>
              <th className="border border-black p-0.5 text-center">नगदी</th>
              <th className="border border-black p-0.5 text-center">आराजी</th>
              <th className="border border-black p-0.5 text-center">नगदी</th>
              <th className="border border-black p-0.5 text-center">आराजी</th>
              <th className="border border-black p-0.5 text-center">नगदी</th>
              <th className="border border-black p-0.5 text-center">आराजी</th>
              <th className="border border-black p-0.5 text-center">नगदी</th>
              <th className="border border-black p-0.5 text-center">आराजी</th>
              <th className="border border-black p-0.5 text-center">नगदी</th>
            </tr>
          </thead>
          <tbody>
            {sortedNclRecords.map((r, idx) => {
              const m = members.find(mem => mem.id === r.memberId);
              const paddyTotalAcres = r.wetPaddyAcres + r.dryPaddyAcres;
              const paddyTotalCash = paddyTotalAcres * ratePerAcre;
              const totalDemandAcres = paddyTotalAcres + r.summerCropAcres;
              const totalDemandCash = totalDemandAcres * ratePerAcre;

              return (
                <tr key={r.id} className="border-b border-black text-center font-mono">
                  <td className="border border-black p-1">{idx + 1}</td>
                  <td className="border border-black p-1 text-left font-sans font-bold">{m?.name || 'N/A'}</td>
                  <td className="border border-black p-1">{m?.memberNo || 'N/A'}</td>
                  <td className="border border-black p-1 text-right">₹{(m?.shareBalance || 0).toLocaleString()}</td>
                  <td className="border border-black p-1 font-sans">{m?.village || 'N/A'}</td>
                  <td className="border border-black p-1 font-sans">{r.revenueCircle}</td>
                  <td className="border border-black p-1 font-bold">{r.landArea.toFixed(2)}</td>
                  <td className="border border-black p-1">{r.wetPaddyAcres > 0 ? r.wetPaddyAcres.toFixed(2) : '-'}</td>
                  <td className="border border-black p-1 text-right">{r.wetPaddyAcres > 0 ? (r.wetPaddyAcres * ratePerAcre).toLocaleString() : '-'}</td>
                  <td className="border border-black p-1">{r.dryPaddyAcres > 0 ? r.dryPaddyAcres.toFixed(2) : '-'}</td>
                  <td className="border border-black p-1 text-right">{r.dryPaddyAcres > 0 ? (r.dryPaddyAcres * ratePerAcre).toLocaleString() : '-'}</td>
                  <td className="border border-black p-1 font-bold">{paddyTotalAcres > 0 ? paddyTotalAcres.toFixed(2) : '-'}</td>
                  <td className="border border-black p-1 text-right font-bold">{paddyTotalCash > 0 ? paddyTotalCash.toLocaleString() : '-'}</td>
                  <td className="border border-black p-1">{r.summerCropAcres > 0 ? r.summerCropAcres.toFixed(2) : '-'}</td>
                  <td className="border border-black p-1 text-right">{r.summerCropAcres > 0 ? (r.summerCropAcres * ratePerAcre).toLocaleString() : '-'}</td>
                  <td className="border border-black p-1 font-bold">{totalDemandAcres.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold">{totalDemandCash.toLocaleString()}</td>
                  <td className="border border-black p-1 font-bold">{(r.recommendedAcres ?? totalDemandAcres).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold">{(r.recommendedCash ?? totalDemandCash).toLocaleString()}</td>
                  <td className="border border-black p-1 font-bold">{(r.inspectorAcres ?? totalDemandAcres).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold">{(r.inspectorCash ?? totalDemandCash).toLocaleString()}</td>
                </tr>
              );
            })}

            {/* Grand Total Row */}
            {sortedNclRecords.length > 0 && (
              <tr className="bg-slate-100 font-bold border-t border-black text-center font-mono">
                <td colSpan={3} className="border border-black p-1 font-sans">एकूण</td>
                <td className="border border-black p-1 text-right">
                  ₹{sortedNclRecords.reduce((sum, r) => sum + (members.find(mem => mem.id === r.memberId)?.shareBalance || 0), 0).toLocaleString()}
                </td>
                <td colSpan={2} className="border border-black p-1"></td>
                <td className="border border-black p-1">
                  {sortedNclRecords.reduce((sum, r) => sum + r.landArea, 0).toFixed(2)}
                </td>
                <td className="border border-black p-1">
                  {sortedNclRecords.reduce((sum, r) => sum + r.wetPaddyAcres, 0).toFixed(2)}
                </td>
                <td className="border border-black p-1 text-right">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.wetPaddyAcres * ratePerAcre), 0).toLocaleString()}
                </td>
                <td className="border border-black p-1">
                  {sortedNclRecords.reduce((sum, r) => sum + r.dryPaddyAcres, 0).toFixed(2)}
                </td>
                <td className="border border-black p-1 text-right">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.dryPaddyAcres * ratePerAcre), 0).toLocaleString()}
                </td>
                <td className="border border-black p-1">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.wetPaddyAcres + r.dryPaddyAcres), 0).toFixed(2)}
                </td>
                <td className="border border-black p-1 text-right">
                  {sortedNclRecords.reduce((sum, r) => sum + ((r.wetPaddyAcres + r.dryPaddyAcres) * ratePerAcre), 0).toLocaleString()}
                </td>
                <td className="border border-black p-1">
                  {sortedNclRecords.reduce((sum, r) => sum + r.summerCropAcres, 0).toFixed(2)}
                </td>
                <td className="border border-black p-1 text-right">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.summerCropAcres * ratePerAcre), 0).toLocaleString()}
                </td>
                <td className="border border-black p-1">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres), 0).toFixed(2)}
                </td>
                <td className="border border-black p-1 text-right">
                  {sortedNclRecords.reduce((sum, r) => sum + ((r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres) * ratePerAcre), 0).toLocaleString()}
                </td>
                <td className="border border-black p-1">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.recommendedAcres ?? (r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres)), 0).toFixed(2)}
                </td>
                <td className="border border-black p-1 text-right">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.recommendedCash ?? ((r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres) * ratePerAcre)), 0).toLocaleString()}
                </td>
                <td className="border border-black p-1">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.inspectorAcres ?? (r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres)), 0).toFixed(2)}
                </td>
                <td className="border border-black p-1 text-right">
                  {sortedNclRecords.reduce((sum, r) => sum + (r.inspectorCash ?? ((r.wetPaddyAcres + r.dryPaddyAcres + r.summerCropAcres) * ratePerAcre)), 0).toLocaleString()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
