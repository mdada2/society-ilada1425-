import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Wrench,
  Upload,
  FileSpreadsheet,
  Play,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  BarChart3,
  Layers,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawRow {
  colA: string;
  colB: string;
  colC: string;
  colD: string;
  colE: string;
  colF: string;
  colK: number;
  colL: number;
  [key: string]: any;
}

interface ConsolidatedRow {
  colA: string;
  colB: string;
  colC: string;
  colD: string;
  colE: string;
  colF: string;
  totalK: number;
  totalL: number;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (val: any): number => {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

const fmtNum = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Component ────────────────────────────────────────────────────────────────

const Tools: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [consolidated, setConsolidated] = useState<ConsolidatedRow[]>([]);
  const [colKName, setColKName] = useState('Col K');
  const [colLName, setColLName] = useState('Col L');
  const [colCName, setColCName] = useState('Col C');
  const [colDName, setColDName] = useState('Col D');
  const [colEName, setColEName] = useState('Col E');
  const [colFName, setColFName] = useState('Col F');
  const [status, setStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Two-File Merger state ─────────────────────────────────────────────────
  const [mFile1, setMFile1] = useState<File | null>(null);
  const [mFile2, setMFile2] = useState<File | null>(null);
  const [mHeaders1, setMHeaders1] = useState<string[]>([]);
  const [mHeaders2, setMHeaders2] = useState<string[]>([]);
  const [mRows1, setMRows1] = useState<any[][]>([]);
  const [mRows2, setMRows2] = useState<any[][]>([]);
  const [mergedRows, setMergedRows] = useState<any[][]>([]);
  const [mergedHeaders, setMergedHeaders] = useState<string[]>([]);
  const [mergeStatus, setMergeStatus] = useState<'idle' | 'reading1' | 'reading2' | 'done' | 'error'>('idle');
  const [mergeError, setMergeError] = useState('');
  const [mergeDownloading, setMergeDownloading] = useState(false);
  const [mFile1Name, setMFile1Name] = useState('');
  const [keyColCount, setKeyColCount] = useState(2); // default: A+B as key
  const [mFile2Name, setMFile2Name] = useState('');
  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  // ── File reading ────────────────────────────────────────────────────────────

  const readFile = useCallback((f: File) => {
    setStatus('reading');
    setErrorMsg('');
    setConsolidated([]);
    setRawRows([]);
    setHeaders([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (json.length < 2) {
          setErrorMsg('File मध्ये कमीत कमी 2 rows असणे आवश्यक आहे (header + data).');
          setStatus('error');
          return;
        }

        const hdr: string[] = (json[0] as any[]).map((h) => String(h ?? ''));
        setHeaders(hdr);

        // Detect column names from header row
        setColCName(hdr[2] || 'Col C');
        setColDName(hdr[3] || 'Col D');
        setColEName(hdr[4] || 'Col E');
        setColFName(hdr[5] || 'Col F');
        setColKName(hdr[10] || 'Col K');
        setColLName(hdr[11] || 'Col L');

        const rows: RawRow[] = json.slice(1).map((row: any[]) => ({
          colA: String(row[0] ?? '').trim(),
          colB: String(row[1] ?? '').trim(),
          colC: String(row[2] ?? '').trim(),
          colD: String(row[3] ?? '').trim(),
          colE: String(row[4] ?? '').trim(),
          colF: String(row[5] ?? '').trim(),
          colK: toNum(row[10]),
          colL: toNum(row[11]),
          _raw: row,
        }));

        setRawRows(rows);
        setWorkbook(wb);
        setStatus('idle');
      } catch (err: any) {
        setErrorMsg('File वाचताना error आला: ' + (err.message ?? String(err)));
        setStatus('error');
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorMsg('कृपया फक्त .xlsx, .xls किंवा .csv file upload करा.');
      setStatus('error');
      return;
    }
    setFile(f);
    setStatus('reading');
    readFile(f);
  };

  // Drag & Drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  // ── Process ─────────────────────────────────────────────────────────────────

  const processData = () => {
    if (!rawRows.length) return;

    const map = new Map<string, ConsolidatedRow>();

    rawRows.forEach((row) => {
      const key = `${row.colA}|||${row.colB}`;
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.totalK += row.colK;
        existing.totalL += row.colL;
        existing.count += 1;
        // C,D,E,F: fill blank values from later rows if first was empty
        if (!existing.colC && row.colC) existing.colC = row.colC;
        if (!existing.colD && row.colD) existing.colD = row.colD;
        if (!existing.colE && row.colE) existing.colE = row.colE;
        if (!existing.colF && row.colF) existing.colF = row.colF;
      } else {
        map.set(key, {
          colA: row.colA,
          colB: row.colB,
          colC: row.colC,
          colD: row.colD,
          colE: row.colE,
          colF: row.colF,
          totalK: row.colK,
          totalL: row.colL,
          count: 1,
        });
      }
    });

    setConsolidated(Array.from(map.values()));
    setStatus('done');
  };

  // ── Download ─────────────────────────────────────────────────────────────────

  const downloadUpdated = () => {
    if (!workbook || !consolidated.length) return;
    setDownloading(true);

    try {
      // Build new sheet data (A, B, C, D, E, F, K, L, Total, Count)
      const sheetData: any[][] = [
        [
          'Col A', 'Col B',
          colCName, colDName, colEName, colFName,
          colKName + ' (बेरीज)', colLName + ' (बेरीज)',
          'एकूण (K+L)', 'Records'
        ],
        ...consolidated.map((r) => [
          r.colA, r.colB,
          r.colC, r.colD, r.colE, r.colF,
          r.totalK, r.totalL,
          r.totalK + r.totalL, r.count
        ]),
      ];

      const newWS = XLSX.utils.aoa_to_sheet(sheetData);

      // Column widths
      newWS['!cols'] = [
        { wch: 25 }, { wch: 25 },
        { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
      ];

      // Remove old "Consolidated" sheet if it exists, then add fresh one
      const existingIdx = workbook.SheetNames.indexOf('Consolidated');
      if (existingIdx !== -1) {
        workbook.SheetNames.splice(existingIdx, 1);
        delete workbook.Sheets['Consolidated'];
      }

      XLSX.utils.book_append_sheet(workbook, newWS, 'Consolidated');

      const outName = file
        ? file.name.replace(/\.(xlsx|xls|csv)$/i, '') + '_Consolidated.xlsx'
        : 'Consolidated.xlsx';

      XLSX.writeFile(workbook, outName);
    } catch (err: any) {
      setErrorMsg('Download करताना error: ' + (err.message ?? String(err)));
      setStatus('error');
    } finally {
      setDownloading(false);
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────────

  const reset = () => {
    setFile(null);
    setWorkbook(null);
    setRawRows([]);
    setHeaders([]);
    setConsolidated([]);
    setStatus('idle');
    setErrorMsg('');
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Two-File Merger logic ─────────────────────────────────────────────────

  const readMergeFile = (f: File, num: 1 | 2) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (json.length < 2) { setMergeError('File मध्ये कमीत कमी 2 rows असणे आवश्यक आहे.'); setMergeStatus('error'); return; }
        const hdr = (json[0] as any[]).map((h: any) => String(h ?? ''));
        const rows = json.slice(1) as any[][];
        if (num === 1) { setMHeaders1(hdr); setMRows1(rows); setMFile1Name(f.name); }
        else { setMHeaders2(hdr); setMRows2(rows); setMFile2Name(f.name); }
        setMergeStatus('idle');
      } catch (err: any) { setMergeError('File वाचताना error: ' + (err.message ?? '')); setMergeStatus('error'); }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleMergeFile = (f: File | null, num: 1 | 2) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { setMergeError('कृपया .xlsx, .xls किंवा .csv file upload करा.'); setMergeStatus('error'); return; }
    setMergeError('');
    setMergeStatus(num === 1 ? 'reading1' : 'reading2');
    if (num === 1) setMFile1(f); else setMFile2(f);
    readMergeFile(f, num);
  };

  const buildKey = (row: any[], kc: number) =>
    row.slice(0, kc).map((v: any) => String(v ?? '').trim().toLowerCase()).join('|||');

  const mergeFiles = () => {
    if (!mRows1.length || !mRows2.length) { setMergeError('कृपया दोन्ही files upload करा.'); setMergeStatus('error'); return; }
    setMergeError('');

    const kc = keyColCount;

    // Extra columns from each file (after the key columns)
    const extra1Hdrs = mHeaders1.slice(kc);
    const extra2Hdrs = mHeaders2.slice(kc);

    // Columns only in File2 (not already in File1 extras)
    const onlyIn2 = extra2Hdrs.filter(h => !extra1Hdrs.includes(h));
    // Columns in both: mark them clearly
    const extra1Final = extra1Hdrs.map(h => extra2Hdrs.includes(h) ? h + ' (File1)' : h);
    // For columns in both, add (File2) suffix; for File2-only, use as-is
    const extra2Final = [
      ...extra2Hdrs.filter(h => extra1Hdrs.includes(h)).map(h => h + ' (File2)'),
      ...onlyIn2,
    ];

    const finalHdrs = [...mHeaders1.slice(0, kc), ...extra1Final, ...extra2Final];
    setMergedHeaders(finalHdrs);

    // Build lookup from File2
    const map2 = new Map<string, any[]>();
    mRows2.forEach(row => {
      const extraRow2 = [
        ...extra2Hdrs.filter(h => extra1Hdrs.includes(h)).map(h => row[mHeaders2.indexOf(h)]),
        ...onlyIn2.map(h => row[mHeaders2.indexOf(h)]),
      ];
      map2.set(buildKey(row, kc), extraRow2);
    });

    const blank1 = extra1Final.map(() => '');
    const blank2 = extra2Final.map(() => '');
    const merged: any[][] = [];
    const matchedKeys = new Set<string>();

    mRows1.forEach(row => {
      const key = buildKey(row, kc);
      matchedKeys.add(key);
      merged.push([...row.slice(0, kc), ...row.slice(kc), ...(map2.get(key) ?? blank2)]);
    });

    mRows2.forEach(row => {
      if (!matchedKeys.has(buildKey(row, kc)))
        merged.push([...row.slice(0, kc), ...blank1,
          ...extra2Hdrs.filter(h => extra1Hdrs.includes(h)).map(h => row[mHeaders2.indexOf(h)]),
          ...onlyIn2.map(h => row[mHeaders2.indexOf(h)])]);
    });

    setMergedRows(merged);
    setMergeStatus('done');
  };

  const downloadMerged = () => {
    if (!mergedRows.length) return;
    setMergeDownloading(true);
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([mergedHeaders, ...mergedRows]);
      ws['!cols'] = mergedHeaders.map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Merged');
      XLSX.writeFile(wb, (mFile1Name.replace(/\.(xlsx|xls|csv)$/i, '') || 'File1') + '_Merged.xlsx');
    } catch (err: any) { setMergeError('Download error: ' + (err.message ?? '')); }
    finally { setMergeDownloading(false); }
  };

  const resetMerger = () => {
    setMFile1(null); setMFile2(null);
    setMHeaders1([]); setMHeaders2([]); setMRows1([]); setMRows2([]);
    setMergedRows([]); setMergedHeaders([]);
    setMergeStatus('idle'); setMergeError(''); setMFile1Name(''); setMFile2Name('');
    if (fileInput1Ref.current) fileInput1Ref.current.value = '';
    if (fileInput2Ref.current) fileInput2Ref.current.value = '';
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const totalDuplicates = rawRows.length - consolidated.length;
  const grandK = consolidated.reduce((s, r) => s + r.totalK, 0);
  const grandL = consolidated.reduce((s, r) => s + r.totalL, 0);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 pb-24 md:pb-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-3 rounded-2xl shadow-lg">
          <Wrench size={26} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Tools</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Excel Data Processing Utilities</p>
        </div>
      </div>

      {/* ── Tool Card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">

        {/* Card Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center gap-3">
          <Layers size={22} className="text-white/90" />
          <div>
            <h2 className="text-white font-bold text-lg">Excel Duplicate Consolidator</h2>
            <p className="text-violet-200 text-xs mt-0.5">
              Col A &amp; B = Unique Key · Col C,D,E,F = माहिती · Col K &amp; L = बेरीज
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* ── How it works info ── */}
          <div className="flex gap-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4">
            <Info size={18} className="text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-800 dark:text-indigo-300 space-y-1">
              <p className="font-semibold">हे Tool काय करते?</p>
              <ul className="list-disc list-inside space-y-1 text-indigo-700 dark:text-indigo-400">
                <li>Column <strong>A</strong> आणि <strong>B</strong> — Unique Key म्हणून वापरतो (duplicates शोधतो)</li>
                <li>Column <strong>C, D, E, F</strong> — संबंधित माहिती (पहिल्या record मधून घेतो)</li>
                <li>Column <strong>K</strong> व <strong>L</strong> — numeric values एकत्र <strong>बेरीज</strong> करतो</li>
                <li>Duplicate rows वगळून <strong>एकच unique record</strong> ठेवतो</li>
                <li>Original workbook मध्ये <strong>"Consolidated"</strong> नावाची नवीन sheet घालतो</li>
              </ul>
            </div>
          </div>

          {/* ── Upload Zone ── */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200
                ${isDragging
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 scale-[1.01]'
                  : 'border-slate-300 dark:border-slate-600 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10'
                }`}
            >
              <div className={`p-4 rounded-full transition-all duration-200 ${isDragging ? 'bg-violet-100 dark:bg-violet-800' : 'bg-slate-100 dark:bg-slate-700'}`}>
                <Upload size={32} className={isDragging ? 'text-violet-600' : 'text-slate-400'} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {isDragging ? 'इथे सोडा!' : 'Excel File Upload करा'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Drag &amp; Drop करा किंवा <span className="text-violet-600 font-medium">Browse</span> करा
                </p>
                <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv supported</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            /* ── File Selected ── */
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
              <div className="bg-green-100 dark:bg-green-900/40 p-3 rounded-xl">
                <FileSpreadsheet size={28} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB
                  {rawRows.length > 0 && ` · ${rawRows.length} rows`}
                </p>
              </div>
              <button
                onClick={reset}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                title="Remove file"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* ── Status Messages ── */}
          {status === 'reading' && (
            <div className="flex items-center gap-3 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4">
              <Loader2 size={20} className="animate-spin shrink-0" />
              <span className="text-sm font-medium">File वाचत आहे...</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <AlertCircle size={20} className="shrink-0" />
              <span className="text-sm">{errorMsg}</span>
            </div>
          )}

          {/* ── Preview Toggle ── */}
          {rawRows.length > 0 && status !== 'reading' && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition"
            >
              {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showPreview ? 'Preview लपवा' : `Original Data Preview (${rawRows.length} rows)`}
            </button>
          )}

          {/* ── Preview Table ── */}
          {showPreview && rawRows.length > 0 && (
            <div className="overflow-auto max-h-60 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                  <tr>
                    {['#', 'Col A', 'Col B', colCName, colDName, colEName, colFName, colKName, colLName].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-medium">{row.colA}</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{row.colB}</td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{row.colC}</td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{row.colD}</td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{row.colE}</td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{row.colF}</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 text-right">{fmtNum(row.colK)}</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 text-right">{fmtNum(row.colL)}</td>
                    </tr>
                  ))}
                  {rawRows.length > 20 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-center text-slate-400 italic">
                        ... आणखी {rawRows.length - 20} rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Action Buttons ── */}
          {rawRows.length > 0 && status !== 'reading' && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={processData}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md hover:opacity-90 transition-all duration-200 active:scale-95 w-full sm:w-auto"
              >
                <Play size={18} />
                Process &amp; Consolidate
              </button>

              {consolidated.length > 0 && (
                <button
                  onClick={downloadUpdated}
                  disabled={downloading}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md hover:opacity-90 transition-all duration-200 active:scale-95 disabled:opacity-60 w-full sm:w-auto"
                >
                  {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  Updated Excel Download करा
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {status === 'done' && consolidated.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">

          {/* Results Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex items-center gap-3">
            <CheckCircle2 size={22} className="text-white" />
            <div>
              <h2 className="text-white font-bold text-lg">Consolidated Results</h2>
              <p className="text-emerald-100 text-xs mt-0.5">एकत्रित केलेला डेटा</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 md:p-6 pb-3">
            <StatCard
              icon={<BarChart3 size={20} className="text-violet-500" />}
              label="एकूण Rows (Original)"
              value={rawRows.length}
              bg="bg-violet-50 dark:bg-violet-900/20"
            />
            <StatCard
              icon={<Layers size={20} className="text-indigo-500" />}
              label="Unique Records"
              value={consolidated.length}
              bg="bg-indigo-50 dark:bg-indigo-900/20"
            />
            <StatCard
              icon={<CheckCircle2 size={20} className="text-emerald-500" />}
              label="Duplicates काढले"
              value={totalDuplicates}
              bg="bg-emerald-50 dark:bg-emerald-900/20"
            />
            <StatCard
              icon={<BarChart3 size={20} className="text-amber-500" />}
              label="Grand Total K+L"
              value={'₹' + fmtNum(grandK + grandL)}
              bg="bg-amber-50 dark:bg-amber-900/20"
              isText
            />
          </div>

          {/* Consolidated Table */}
          <div className="px-6 pb-6">
            <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Col A</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Col B</th>
                    <th className="px-4 py-3 text-left font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">{colCName}</th>
                    <th className="px-4 py-3 text-left font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">{colDName}</th>
                    <th className="px-4 py-3 text-left font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">{colEName}</th>
                    <th className="px-4 py-3 text-left font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">{colFName}</th>
                    <th className="px-4 py-3 text-right font-semibold text-violet-600 dark:text-violet-400 whitespace-nowrap">{colKName} बेरीज</th>
                    <th className="px-4 py-3 text-right font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{colLName} बेरीज</th>
                    <th className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">एकूण (K+L)</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidated.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors
                        ${row.count > 1 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                    >
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">{row.colA}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.colB}</td>
                      <td className="px-4 py-3 text-sky-700 dark:text-sky-300 text-sm">{row.colC}</td>
                      <td className="px-4 py-3 text-sky-700 dark:text-sky-300 text-sm">{row.colD}</td>
                      <td className="px-4 py-3 text-sky-700 dark:text-sky-300 text-sm">{row.colE}</td>
                      <td className="px-4 py-3 text-sky-700 dark:text-sky-300 text-sm">{row.colF}</td>
                      <td className="px-4 py-3 text-right text-violet-700 dark:text-violet-300 font-medium">{fmtNum(row.totalK)}</td>
                      <td className="px-4 py-3 text-right text-indigo-700 dark:text-indigo-300 font-medium">{fmtNum(row.totalL)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmtNum(row.totalK + row.totalL)}</td>
                      <td className="px-4 py-3 text-center">
                        {row.count > 1 ? (
                          <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                            {row.count} merged
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">1</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Grand Total Footer */}
                <tfoot className="bg-slate-100 dark:bg-slate-700 border-t-2 border-slate-300 dark:border-slate-500">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 text-right">
                      Grand Total →
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-violet-700 dark:text-violet-300">{fmtNum(grandK)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700 dark:text-indigo-300">{fmtNum(grandL)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400 text-base">{fmtNum(grandK + grandL)}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">{rawRows.length} rows</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* ════ Two-File Merger Card ════ */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">

        {/* Card Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Layers size={22} className="text-white/90" />
            <div>
              <h2 className="text-white font-bold text-lg">Two-File Merger</h2>
              <p className="text-rose-100 text-xs mt-0.5">
                दोन Excel Files — Col A-F key ने match करा, G+ columns एकत्र करा
              </p>
            </div>
          </div>
          {(mFile1 || mFile2) && (
            <button onClick={resetMerger} className="text-white/70 hover:text-white transition text-xs flex items-center gap-1">
              <X size={14} /> Reset
            </button>
          )}
        </div>

        <div className="p-3 md:p-6 space-y-4">

          {/* Info */}
          <div className="flex gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 md:p-4">
            <Info size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-rose-800 dark:text-rose-300 space-y-1">
              <p className="font-semibold text-sm">हे Tool काय करते?</p>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700 dark:text-rose-400">
                <li>दोन Excel files upload करा</li>
                <li>निवडलेल्या columns (A-F) ने rows match करतो</li>
                <li>उरलेले columns (G+) दोन्ही files मधून एकत्र करतो</li>
                <li>Matched → एकाच row मध्ये सर्व माहिती</li>
                <li>Unmatched → blank columns सह येतो</li>
              </ul>
            </div>
          </div>

          {/* Key Column Count Selector */}
          <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <span className="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold px-2 py-0.5 rounded-full">Key</span>
              Matching साठी किती columns वापरायचे?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setKeyColCount(n)}
                  className={`py-2 px-3 rounded-lg text-sm font-semibold border transition-all text-center ${
                    keyColCount === n
                      ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-rose-400'
                  }`}
                >
                  {n === 1 ? 'A only' : n === 2 ? 'A + B' : n === 3 ? 'A+B+C' : n === 4 ? 'A → D' : n === 5 ? 'A → E' : 'A → F'}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              सध्या: पहिले <strong className="text-rose-500">{keyColCount}</strong> column{keyColCount > 1 ? 's' : ''} (
              {['A', 'A & B', 'A, B & C', 'A ते D', 'A ते E', 'A ते F'][keyColCount - 1]}) key म्हणून वापरले जातील.
              बाकीचे columns दोन्ही files मधून एकत्र केले जातील.
            </p>
          </div>

          {/* Two Upload Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* File 1 */}
            <div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2">
                <span className="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold px-2 py-0.5 rounded-full">File 1</span>
                पहिली Excel File
              </p>
              {!mFile1 ? (
                <div
                  onClick={() => fileInput1Ref.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all"
                >
                  <Upload size={24} className="text-slate-400" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Browse करा</p>
                  <p className="text-xs text-slate-400">.xlsx, .xls, .csv</p>
                  <input ref={fileInput1Ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={e => handleMergeFile(e.target.files?.[0] ?? null, 1)} />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 rounded-xl p-3">
                  <FileSpreadsheet size={22} className="text-rose-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{mFile1.name}</p>
                    <p className="text-xs text-slate-500">{mRows1.length} rows · {mHeaders1.slice(keyColCount).length} extra cols</p>
                  </div>
                  <button onClick={() => { setMFile1(null); setMRows1([]); setMHeaders1([]); if (fileInput1Ref.current) fileInput1Ref.current.value = ''; }}
                    className="text-slate-400 hover:text-red-500 transition"><X size={16} /></button>
                </div>
              )}
            </div>

            {/* File 2 */}
            <div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2">
                <span className="bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400 text-xs font-bold px-2 py-0.5 rounded-full">File 2</span>
                दुसरी Excel File
              </p>
              {!mFile2 ? (
                <div
                  onClick={() => fileInput2Ref.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/10 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all"
                >
                  <Upload size={24} className="text-slate-400" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Browse करा</p>
                  <p className="text-xs text-slate-400">.xlsx, .xls, .csv</p>
                  <input ref={fileInput2Ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={e => handleMergeFile(e.target.files?.[0] ?? null, 2)} />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-700 rounded-xl p-3">
                  <FileSpreadsheet size={22} className="text-pink-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{mFile2.name}</p>
                    <p className="text-xs text-slate-500">{mRows2.length} rows · {mHeaders2.slice(keyColCount).length} extra cols</p>
                  </div>
                  <button onClick={() => { setMFile2(null); setMRows2([]); setMHeaders2([]); if (fileInput2Ref.current) fileInput2Ref.current.value = ''; }}
                    className="text-slate-400 hover:text-red-500 transition"><X size={16} /></button>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          {(mergeStatus === 'reading1' || mergeStatus === 'reading2') && (
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4">
              <Loader2 size={20} className="animate-spin shrink-0" />
              <span className="text-sm font-medium">File {mergeStatus === 'reading1' ? '1' : '2'} वाचत आहे...</span>
            </div>
          )}
          {mergeStatus === 'error' && (
            <div className="flex items-center gap-3 text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <AlertCircle size={20} className="shrink-0" /><span className="text-sm">{mergeError}</span>
            </div>
          )}

          {/* Action Buttons */}
          {mRows1.length > 0 && mRows2.length > 0 && mergeStatus !== 'reading1' && mergeStatus !== 'reading2' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={mergeFiles}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md hover:opacity-90 transition-all active:scale-95 w-full sm:w-auto">
                <Play size={18} /> Files Merge करा
              </button>
              {mergedRows.length > 0 && (
                <button onClick={downloadMerged} disabled={mergeDownloading}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md hover:opacity-90 transition-all active:scale-95 disabled:opacity-60 w-full sm:w-auto">
                  {mergeDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  Merged Excel Download करा
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Merge Results */}
      {mergeStatus === 'done' && mergedRows.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex items-center gap-3">
            <CheckCircle2 size={22} className="text-white" />
            <div>
              <h2 className="text-white font-bold text-lg">Merged Results</h2>
              <p className="text-emerald-100 text-xs mt-0.5">
                {mergedRows.length} rows merged · {mergedHeaders.length} columns
              </p>
            </div>
          </div>
          <div className="p-3 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <StatCard icon={<BarChart3 size={20} className="text-rose-500" />} label="File 1 Rows" value={mRows1.length} bg="bg-rose-50 dark:bg-rose-900/20" />
              <StatCard icon={<BarChart3 size={20} className="text-pink-500" />} label="File 2 Rows" value={mRows2.length} bg="bg-pink-50 dark:bg-pink-900/20" />
              <StatCard icon={<CheckCircle2 size={20} className="text-emerald-500" />} label="Total Merged Rows" value={mergedRows.length} bg="bg-emerald-50 dark:bg-emerald-900/20" />
            </div>
            <div className="overflow-auto max-h-80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">#</th>
                    {mergedHeaders.map((h, i) => (
                      <th key={i} className={`px-3 py-2 text-left font-semibold whitespace-nowrap
                        ${i < keyColCount ? 'text-slate-600 dark:text-slate-300' :
                          h.includes('(File1)') || (!h.includes('(File2)') && i < keyColCount + mHeaders1.slice(keyColCount).length)
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-pink-600 dark:text-pink-400'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.slice(0, 30).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                      {row.map((cell: any, j: number) => (
                        <td key={j} className={`px-3 py-1.5 whitespace-nowrap
                          ${j < keyColCount ? 'font-medium text-slate-800 dark:text-white' :
                            j < keyColCount + mHeaders1.slice(keyColCount).length
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-pink-700 dark:text-pink-300'}`}>
                          {String(cell ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {mergedRows.length > 30 && (
                    <tr><td colSpan={mergedHeaders.length + 1} className="px-3 py-2 text-center text-slate-400 italic">... आणखी {mergedRows.length - 30} rows (Download करा)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Stat Card Sub-Component ────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bg: string;
  isText?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, bg, isText }) => (
  <div className={`${bg} rounded-xl p-4 flex flex-col gap-2`}>
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight">{label}</span>
    </div>
    <p className={`font-bold text-slate-800 dark:text-white ${isText ? 'text-base' : 'text-2xl'}`}>
      {isText ? value : value.toLocaleString('en-IN')}
    </p>
  </div>
);

export default Tools;
