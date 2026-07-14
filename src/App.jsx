```jsx
// src/App.jsx
import React, { useState } from 'react';
import {
  Droplets, CheckCircle2, ChevronRight, Activity, Trash2,
  Baby, Copy, ChevronDown, ChevronUp, Calendar, PenLine,
  HelpCircle, X, RotateCcw
} from 'lucide-react';

import { parseHaidText } from './utils/textParser';
import { msToHours, formatDuration, getColorLabel, getBadgeStyle } from './utils/formatters';
import { analyzeHaidPeriods } from './utils/haid/engine';
import { analyzeNifasPeriods } from './utils/engineNifas';

// HELPER: Mengamankan zona waktu lokal
const toLocalISOString = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const App = () => {
  const [appMode, setAppMode] = useState('HAID');
  const [userStatus, setUserStatus] = useState('mutadah');
  const [lupaAdat, setLupaAdat] = useState(false);
  const [adatNifas, setAdatNifas] = useState(40);
  const [adatHaid, setAdatHaid] = useState(7);
  const [adatSuci, setAdatSuci] = useState(20);
  const [inputWiladah, setInputWiladah] = useState('');
  const [logs, setLogs] = useState([]);
  const [inputStart, setInputStart] = useState('');
  const [inputEnd, setInputEnd] = useState('');
  const [inputColor, setInputColor] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeInputMode, setActiveInputMode] = useState('none');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeTab, setActiveTab] = useState('QOUL_2');
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  
  const [trailingBHours, setTrailingBHours] = useState(0);

  const handleAppModeChange = (mode) => {
    setAppMode(mode); 
    setAnalysisResult(null); 
    setLogs([]); 
    setTrailingBHours(0);
    setInputWiladah('');
  };

  const parseTextInput = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const { userConfig, periods } = parseHaidText(textInput);

    if (periods.length === 0) {
      alert("Format tidak dikenali! Pastikan Anda memasukkan data KD/B dengan format durasi atau rentang tanggal.");
      return; 
    }

    if (!Number.isNaN(userConfig.adatHaid)) setAdatHaid(userConfig.adatHaid);
    if (!Number.isNaN(userConfig.adatSuci)) setAdatSuci(userConfig.adatSuci);

    if (appMode === 'HAID') {
      if (userConfig.userStatus === 'mutadah') {
        setUserStatus('mutadah');
        setLupaAdat(false);
      }
    } else if (appMode === 'NIFAS') {
      const anMatch = textInput.match(/AN\s*[:=]?\s*(\d+)\s*(hari|jam)?/i);
      if (anMatch) {
        setAdatNifas(parseInt(anMatch[1], 10));
        setUserStatus('mutadah');
        setLupaAdat(false);
      }
    }

    let currentTime = new Date();
    
    // PERBAIKAN: Jika ada tanggal spesifik (misal: 20 april), set currentTime dari situ!
    if (periods.length > 0 && periods[0].parsedStartDate) {
      currentTime = new Date(periods[0].parsedStartDate);
    }

    if (appMode === 'NIFAS') {
      if (!inputWiladah) {
        const localISO = toLocalISOString(currentTime);
        setInputWiladah(localISO);
        currentTime = new Date(localISO); 
      } else {
        currentTime = new Date(inputWiladah);
      }
    }

    const newLogs = [];
    periods.forEach((p) => {
      // Jika rentang tanggal, sinkronkan ulang jamnya ke tanggal persis yang dibaca Parser
      if (p.parsedStartDate) {
        currentTime = new Date(p.parsedStartDate);
      }

      const durationMs = Math.round(p.hours * 60) * 60 * 1000;
      const startTime = new Date(currentTime.getTime());
      const endTime = new Date(currentTime.getTime() + durationMs);

      if (p.type === 'KD') {
        newLogs.push({
          id: Date.now() + Math.random(),
          start: toLocalISOString(startTime),
          end: toLocalISOString(endTime),
          durationHours: p.hours,
          color: p.color || null,
        });
      }
      currentTime = endTime;
    });

    const lastPeriod = periods[periods.length - 1];
    if (lastPeriod && lastPeriod.type === 'B') {
      setTrailingBHours(lastPeriod.hours);
    } else {
      setTrailingBHours(0);
    }

    if (analysisResult !== null) {
      setLogs(newLogs.sort((a, b) => new Date(a.start) - new Date(b.start)));
    } else {
      setLogs([...logs, ...newLogs].sort((a, b) => new Date(a.start) - new Date(b.start)));
    }

    setTextInput(''); setAnalysisResult(null); setActiveInputMode('none');
  };

  const handleAddLog = (e) => {
    e.preventDefault();
    if (!inputStart || !inputEnd) return;
    const start = new Date(inputStart); 
    const end = new Date(inputEnd);
    if (end <= start) { alert("Waktu berhenti harus setelah waktu mulai!"); return; }
    
    const newLog = {
      id: Date.now(), start: inputStart, end: inputEnd,
      durationHours: msToHours(end - start), color: parseInt(inputColor) || null 
    };

    if (logs.length === 0 && appMode === 'NIFAS' && !inputWiladah) setInputWiladah(inputStart);
    if (analysisResult !== null) setLogs([newLog]);
    else setLogs([...logs, newLog].sort((a, b) => new Date(a.start) - new Date(b.start)));

    setInputStart(''); setInputEnd(''); setAnalysisResult(null); 
  };

  const removeLog = (id) => { 
    const newLogs = logs.filter(log => log.id !== id);
    setLogs(newLogs); 
    if (newLogs.length === 0) {
      setTrailingBHours(0);
      setInputWiladah('');
    }
    setAnalysisResult(null); 
  };

  const runAnalysisEngine = () => {
    if (logs.length === 0 && trailingBHours === 0) return setAnalysisResult({ error: "Silakan masukkan log pendarahan terlebih dahulu." });
    
    const periods = [];
    
    if (appMode === 'NIFAS' && inputWiladah && logs.length > 0) {
      const wiladahTime = new Date(inputWiladah);
      const firstLogTime = new Date(logs[0].start);
      const initialGap = Math.round(msToHours(firstLogTime - wiladahTime) * 100) / 100;
      if (initialGap > 0) {
        periods.push({ id: 'b-wiladah', type: 'B', hours: initialGap });
      }
    }

    for (let i = 0; i < logs.length; i++) {
      periods.push({ id: `kd-${i}`, type: 'KD', hours: Math.round(logs[i].durationHours * 100) / 100, color: logs[i].color });
      if (i < logs.length - 1) {
        const gapHours = Math.round(msToHours(new Date(logs[i + 1].start) - new Date(logs[i].end)) * 100) / 100;
        if (gapHours > 0) periods.push({ id: `b-${i}`, type: 'B', hours: gapHours });
      }
    }

    if (trailingBHours > 0) {
      periods.push({ id: 'b-trailing', type: 'B', hours: trailingBHours });
    }

    const userConfig = { userStatus, lupaAdat, adatHaid, adatSuci, adatNifas };

    if (appMode === 'HAID') {
      const baseResult = analyzeHaidPeriods(periods, 'QOUL_2', userConfig);
      const isMustahadhahTaqothu = baseResult.meta.isTamyizValid === false && periods.some(p => p.type === 'B') && periods.reduce((acc,p) => acc+p.hours, 0) > 15*24;

      if (isMustahadhahTaqothu) {
          const sahbi = analyzeHaidPeriods(periods, 'LAQTHI_SAHBI', userConfig);
          setAnalysisResult({ mode: 'HAID', hasKhilaf: false, hasLaqthi: false, qoul2: sahbi.breakdown, meta: sahbi.meta });
      } else {
          const q1Result = analyzeHaidPeriods(periods, 'QOUL_1', userConfig);
          const isKhilaf = baseResult.meta.hasTakmil;
          setAnalysisResult({ mode: 'HAID', hasKhilaf: isKhilaf, hasLaqthi: false, qoul1: q1Result.breakdown, qoul2: baseResult.breakdown, meta: baseResult.meta });
      }
    } else {
        const nifasResult = analyzeNifasPeriods(periods, userConfig);
        setAnalysisResult({ mode: 'NIFAS', hasKhilaf: false, hasLaqthi: false, qoul2: nifasResult.breakdown, meta: nifasResult.meta });
    }
    setActiveTab('QOUL_2');
  };

  let activeBreakdown = [];
  if (analysisResult) {
    activeBreakdown = activeTab === 'QOUL_1' ? analysisResult.qoul1 : analysisResult.qoul2;
  }

  const handleCopyResult = () => {
    if (!analysisResult) return;
    let textToCopy = '';
    if (appMode === 'NIFAS' && userStatus === 'mutadah' && !lupaAdat) textToCopy += `An ${adatNifas} Ah ${adatHaid} As ${adatSuci}\n\n`;
    else if (appMode === 'HAID' && userStatus === 'mutadah' && !lupaAdat) textToCopy += `Ah ${adatHaid} As ${adatSuci}\n\n`;

    activeBreakdown.forEach(item => {
      let labelStr = item.label.replace('KD', 'Kd').replace('Jeda Bersih', 'B');
      if (item.details.length === 1) {
        let detailStr = item.details[0].toLowerCase();
        detailStr = detailStr.replace(new RegExp("^(\\d+\\s+hari\\s+\\d+\\s+jam|\\d+\\s+hari|\\d+\\s+jam|\\d+\\s+menit)\\s+", "i"), '');
        textToCopy += `${labelStr} ${detailStr}\n`;
      } else if (item.details.length > 1) {
        let detailsStr = item.details.map(d => d.toLowerCase()).join(', ');
        textToCopy += `${labelStr} (${detailsStr})\n`;
      } else {
        textToCopy += `${labelStr}\n`;
      }
    });

    const textArea = document.createElement("textarea");
    textArea.value = textToCopy.trim();
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-8 font-sans text-slate-800 relative">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        
        <div className="bg-slate-900 text-white rounded-xl px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="w-full flex justify-center md:justify-start">
            <img 
              src="/logo.png" 
              alt="DailyHaid Logo" 
              className="h-12 md:h-14 lg:h-16 object-contain"
            />
          </div>
          <div className="flex bg-slate-800 p-1 rounded-lg w-full md:w-auto shrink-0 border border-slate-700">
            <button onClick={() => handleAppModeChange('HAID')} className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded text-xs md:text-sm font-bold transition-colors ${appMode === 'HAID' ? 'bg-red-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}> <Droplets size={16}/> Siklus Haid </button>
            <button onClick={() => handleAppModeChange('NIFAS')} className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded text-xs md:text-sm font-bold transition-colors ${appMode === 'NIFAS' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}> <Baby size={16}/> Kasus Nifas </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          <div className="lg:col-span-4 space-y-4 md:space-y-6">
            
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="w-full flex items-center justify-between p-4 md:p-5 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded text-emerald-700"><Activity size={18}/></div>
                  <div className="text-left">
                    <h2 className="text-sm md:text-base font-bold text-slate-800">Konteks Fikih</h2>
                    <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">
                      {isSettingsOpen ? "Sesuaikan profil keadatan Anda" : `${userStatus === 'mutadah' ? (lupaAdat ? 'Lupa Adat (Mutahayyirah)' : `Mu'tadah`) : 'Mubtadi\'ah (Pemula)'}`}
                    </p>
                  </div>
                </div>
                {isSettingsOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
              </button>
              
              {isSettingsOpen && (
                <div className="p-4 md:p-5 border-t border-slate-100 space-y-4 md:space-y-5">
                  <div>
                    <label className="block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status Keadatan</label>
                    <select value={userStatus} onChange={(e) => {setUserStatus(e.target.value); setLupaAdat(false);}} className="w-full rounded border-slate-200 p-3 bg-slate-50 text-sm md:text-base font-bold outline-none focus:border-slate-400 border">
                      <option value="mubtadiah">Mubtadi'ah (Pemula)</option>
                      <option value="mutadah">Mu'tadah (Punya Adat)</option>
                    </select>
                  </div>
                  {userStatus === 'mutadah' && (
                    <div className="bg-amber-50 p-3 rounded border border-amber-200">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={lupaAdat} onChange={(e) => setLupaAdat(e.target.checked)} className="w-4 h-4 text-amber-600 rounded-sm border-gray-300"/>
                        <span className="text-xs md:text-sm font-bold text-amber-900">Saya lupa Adat (Mutahayyirah)</span>
                      </label>
                    </div>
                  )}

                  {(!lupaAdat && (userStatus === 'mutadah' || appMode === 'NIFAS')) && (
                    <div className={`grid grid-cols-2 ${appMode === 'NIFAS' && userStatus === 'mutadah' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3 md:gap-4`}>
                      {appMode === 'NIFAS' && userStatus === 'mutadah' && (
                        <div> <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1.5">Adat Nifas</label> <input type="number" value={Number.isNaN(adatNifas) ? '' : adatNifas} onChange={(e) => setAdatNifas(parseInt(e.target.value))} className="w-full rounded border border-slate-200 p-3 text-center text-sm md:text-base font-bold bg-slate-50 outline-none focus:border-slate-400"/> </div>
                      )}
                      <div> <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1.5">Adat Haid</label> <input type="number" value={Number.isNaN(adatHaid) ? '' : adatHaid} onChange={(e) => setAdatHaid(parseInt(e.target.value))} className="w-full rounded border border-slate-200 p-3 text-center text-sm md:text-base font-bold bg-slate-50 outline-none focus:border-slate-400"/> </div>
                      <div> <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1.5">Adat Suci</label> <input type="number" value={Number.isNaN(adatSuci) ? '' : adatSuci} onChange={(e) => setAdatSuci(parseInt(e.target.value))} className="w-full rounded border border-slate-200 p-3 text-center text-sm md:text-base font-bold bg-slate-50 outline-none focus:border-slate-400"/> </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200">
              <div className="flex flex-col gap-4 mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded text-red-600"><Droplets size={18}/></div>
                    <h2 className="text-sm md:text-base font-bold text-slate-800">Input Catatan</h2>
                  </div>
                  <button onClick={() => setShowGuide(true)} className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-2 py-1.5 rounded border border-indigo-100">
                    <HelpCircle size={14}/> PANDUAN
                  </button>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setActiveInputMode(activeInputMode === 'manual' ? 'none' : 'manual')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-xs md:text-sm font-bold transition-colors ${activeInputMode === 'manual' ? 'bg-white text-indigo-600 border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}> <Calendar size={16}/> Manual </button>
                  <button onClick={() => setActiveInputMode(activeInputMode === 'cepat' ? 'none' : 'cepat')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-xs md:text-sm font-bold transition-colors ${activeInputMode === 'cepat' ? 'bg-white text-indigo-600 border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}> <PenLine size={16}/> Input Cepat </button>
                </div>
              </div>
              
              {activeInputMode === 'cepat' && (
                <form onSubmit={parseTextInput} className="space-y-3 mt-4">
                  <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder={appMode === 'NIFAS' ? "Cth:\nAN: 50 (Jika Mutadah Nifas)\nAH: 7\nAS: 20\nKD: 65\nB: 9\nKD: 5" : "Cth 1 (Durasi):\nAH: 7 hari\nAS: 20 hari\nKD: 6 (Hitam)\nB: 14\nKD: 9 (Merah)\n\nCth 2 (Tanggal):\nKD 1 mei - 7 mei (Hitam)\nB 7 mei - 20 mei\nKD 20 mei - 29 mei"} className="w-full rounded p-4 border border-slate-200 bg-slate-50 min-h-[160px] text-xs md:text-sm font-mono focus:border-slate-400 outline-none"></textarea>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded text-sm transition-colors">Proses Teks</button>
                </form>
              )}
              
              {activeInputMode === 'manual' && (
                <form onSubmit={handleAddLog} className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 gap-3 md:gap-4">
                    <div> <label className="block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Mulai Keluar</label> <input type="datetime-local" required value={inputStart} onChange={(e) => setInputStart(e.target.value)} className="w-full rounded p-3 border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:border-slate-400"/> </div>
                    <div> <label className="block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Berhenti / Jeda</label> <input type="datetime-local" required value={inputEnd} onChange={(e) => setInputEnd(e.target.value)} className="w-full rounded p-3 border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:border-slate-400"/> </div>
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Warna Darah (Opsional)</label>
                    <select value={inputColor} onChange={(e) => setInputColor(e.target.value)} className="w-full rounded p-3 border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:border-slate-400">
                      <option value="">- Tidak Spesifik -</option>
                      <option value="1">Hitam (Paling Kuat)</option>
                      <option value="2">Merah</option>
                      <option value="3">Coklat</option>
                      <option value="4">Kuning</option>
                      <option value="5">Keruh (Paling Lemah)</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded text-sm transition-colors">+ Tambah Catatan</button>
                </form>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4 md:space-y-6">
            <div className="bg-white rounded-xl p-3 md:p-5 border border-slate-200 flex flex-col justify-end">
              {(logs.length > 0 || trailingBHours > 0) && (
                <div className="overflow-auto rounded-lg max-h-72 mb-4 bg-white border border-slate-200 custom-scrollbar">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead className="bg-slate-100 sticky top-0 text-[10px] uppercase text-slate-600 font-bold z-10 border-b border-slate-200">
                      <tr>
                        <th className="px-2 py-3 border border-slate-200">Mulai</th>
                        <th className="px-2 py-3 border border-slate-200">Selesai</th>
                        <th className="px-2 py-3 border border-slate-200">Durasi</th>
                        <th className="px-2 py-3 border border-slate-200">Warna</th>
                        <th className="px-1 py-3 border border-slate-200">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      
                      {appMode === 'NIFAS' && inputWiladah && logs.length > 0 && msToHours(new Date(logs[0].start) - new Date(inputWiladah)) > 0 && (
                        <tr className="bg-emerald-50">
                          <td className="px-2 py-2 align-middle border border-emerald-100"><div className="flex flex-col items-center xl:flex-row xl:justify-center xl:gap-1"><span className="font-bold text-emerald-800 whitespace-nowrap">{new Date(inputWiladah).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</span><span className="text-xs text-emerald-600 font-medium whitespace-nowrap">{new Date(inputWiladah).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</span></div></td>
                          <td className="px-2 py-2 align-middle border border-emerald-100"><div className="flex flex-col items-center xl:flex-row xl:justify-center xl:gap-1"><span className="font-bold text-emerald-800 whitespace-nowrap">{new Date(logs[0].start).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</span><span className="text-xs text-emerald-600 font-medium whitespace-nowrap">{new Date(logs[0].start).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</span></div></td>
                          <td className="px-2 py-2 font-bold text-emerald-600 whitespace-nowrap text-center text-xs border border-emerald-100">{formatDuration(msToHours(new Date(logs[0].start) - new Date(inputWiladah)))}</td>
                          <td className="px-2 py-2 font-bold text-emerald-700 text-[10px] uppercase tracking-wide text-center border border-emerald-100" colSpan="2">Jeda Awal (Melahirkan)</td>
                        </tr>
                      )}

                      {logs.map((log, index) => {
                        const rows = [];
                        const startD = new Date(log.start);
                        const endD = new Date(log.end);
                        rows.push( <tr key={log.id} className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="px-2 py-3 align-middle border border-slate-200"><div className="flex flex-col items-center xl:flex-row xl:justify-center xl:gap-1"><span className="font-bold text-slate-700 whitespace-nowrap">{startD.toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</span><span className="text-xs text-slate-500 font-medium whitespace-nowrap">{startD.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</span></div></td>
                            <td className="px-2 py-3 align-middle border border-slate-200"><div className="flex flex-col items-center xl:flex-row xl:justify-center xl:gap-1"><span className="font-bold text-slate-700 whitespace-nowrap">{endD.toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</span><span className="text-xs text-slate-500 font-medium whitespace-nowrap">{endD.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</span></div></td>
                            <td className="px-2 py-3 font-bold text-red-600 whitespace-nowrap text-center text-xs border border-slate-200">{formatDuration(log.durationHours)}</td>
                            <td className="px-2 py-3 text-xs font-bold text-slate-600 text-center whitespace-nowrap border border-slate-200">{getColorLabel(log.color)}</td>
                            <td className="px-1 py-3 text-center border border-slate-200"> <button onClick={() => removeLog(log.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"> <Trash2 size={16} className="mx-auto"/> </button> </td>
                          </tr>
                        );
                        if (index < logs.length - 1) {
                          const gapStart = new Date(log.end);
                          const gapEnd = new Date(logs[index + 1].start);
                          const gapHours = msToHours(gapEnd - gapStart);
                          if (gapHours > 0) {
                            rows.push(
                               <tr key={`gap-${log.id}`} className="bg-emerald-50">
                                 <td className="px-2 py-2 align-middle border border-emerald-100"><div className="flex flex-col items-center xl:flex-row xl:justify-center xl:gap-1"><span className="font-bold text-emerald-800 whitespace-nowrap">{gapStart.toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</span><span className="text-xs text-emerald-600 font-medium whitespace-nowrap">{gapStart.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</span></div></td>
                                 <td className="px-2 py-2 align-middle border border-emerald-100"><div className="flex flex-col items-center xl:flex-row xl:justify-center xl:gap-1"><span className="font-bold text-emerald-800 whitespace-nowrap">{gapEnd.toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</span><span className="text-xs text-emerald-600 font-medium whitespace-nowrap">{gapEnd.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</span></div></td>
                                 <td className="px-2 py-2 font-bold text-emerald-600 whitespace-nowrap text-center text-xs border border-emerald-100">{formatDuration(gapHours)}</td>
                                 <td className="px-2 py-2 font-bold text-emerald-700 text-[10px] uppercase tracking-wide text-center border border-emerald-100" colSpan="2">Jeda Bersih</td>
                               </tr>
                            );
                          }
                        }
                        return rows;
                      })}

                      {trailingBHours > 0 && (
                        <tr className="bg-emerald-50">
                          <td className="px-2 py-2 align-middle border border-emerald-100" colSpan="2">
                              <div className="flex flex-col items-center"><span className="font-bold text-emerald-800 whitespace-nowrap italic">Hingga saat ini...</span></div>
                          </td>
                          <td className="px-2 py-2 font-bold text-emerald-600 whitespace-nowrap text-center text-xs border border-emerald-100">{formatDuration(trailingBHours)}</td>
                          <td className="px-2 py-2 font-bold text-emerald-700 text-[10px] uppercase tracking-wide text-center border border-emerald-100" colSpan="2">Jeda Bersih Akhir</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {logs.length === 0 && trailingBHours === 0 && (
                <div className="flex-1 flex items-center justify-center text-slate-500 italic text-sm py-10 md:py-20 border border-dashed border-slate-300 rounded-lg mb-4 bg-slate-50">Data pendarahan akan muncul di sini...</div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3">
                {(logs.length > 0 || trailingBHours > 0 || analysisResult) && (
                  <button
                    onClick={() => { setLogs([]); setAnalysisResult(null); setTrailingBHours(0); setInputWiladah(''); }}
                    className="flex items-center justify-center gap-2 px-5 py-4 rounded text-sm md:text-base font-bold transition-colors bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                  >
                    <RotateCcw size={18}/> Reset Data
                  </button>
                )}
                <button onClick={runAnalysisEngine} className="flex-1 w-full text-white font-bold py-4 rounded flex justify-center items-center gap-2 transition-colors bg-emerald-600 hover:bg-emerald-700 text-sm md:text-base tracking-wide">
                  HITUNG SEKARANG <ChevronRight size={18}/>
                </button>
              </div>
            </div>

            {analysisResult && !analysisResult.error && (
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="p-4 md:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-base md:text-lg font-bold text-slate-800">Hasil Analisis Kasus</h3>
                  <button onClick={handleCopyResult} className="bg-slate-900 text-white px-5 py-2.5 rounded text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                    {copied ? <CheckCircle2 size={14}/> : <Copy size={14}/>}
                    {copied ? 'Tersalin!' : 'Salin Jawaban'}
                  </button>
                </div>
                {analysisResult.hasKhilaf ? (
                  <div className="flex border-b border-slate-200 bg-white">
                    <button onClick={() => setActiveTab('QOUL_1')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'QOUL_1' ? 'bg-slate-100 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>Adat Asal</button>
                    <button onClick={() => setActiveTab('QOUL_2')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'QOUL_2' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>Adat Terakhir</button>
                  </div>
                ) : null}
                <div className="p-4 md:p-5 space-y-3">
                  {activeBreakdown.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col md:flex-row md:items-center gap-3 transition-colors hover:bg-slate-100">
                      <div className="font-mono text-xs md:text-sm font-bold text-slate-600 w-full md:w-32 shrink-0 md:border-r border-slate-300 pb-2 md:pb-0 md:pr-4">{item.label}</div>
                      <div className="flex flex-wrap gap-2">
                        {item.details.map((detail, i) => (
                          <span key={i} className={`px-3 py-1.5 rounded text-[10px] md:text-xs font-bold uppercase ${getBadgeStyle(detail)}`}>{detail}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <h3 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2">
                <HelpCircle size={20} className="text-indigo-600"/> Panduan Input Data
              </h3>
              <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 md:p-5 overflow-y-auto space-y-6">
              <div>
                <h4 className="font-bold text-slate-800 mb-3 text-sm md:text-base border-b border-slate-100 pb-2">📌 Arti Singkatan Fiqih</h4>
                <div className="grid grid-cols-1 gap-2 text-xs md:text-sm text-slate-600">
                  <div className="flex gap-2"><span className="font-black text-indigo-600 w-8">AH</span> <span>Adat Haid (Kebiasaan durasi haid lama)</span></div>
                  <div className="flex gap-2"><span className="font-black text-indigo-600 w-8">AS</span> <span>Adat Suci (Kebiasaan durasi suci lama)</span></div>
                  <div className="flex gap-2"><span className="font-black text-indigo-600 w-8">AN</span> <span>Adat Nifas (Kebiasaan durasi nifas lama)</span></div>
                  <div className="flex gap-2"><span className="font-black text-red-600 w-8">KD</span> <span>Keluar Darah (Durasi/waktu pendarahan)</span></div>
                  <div className="flex gap-2"><span className="font-black text-emerald-600 w-8">B</span> <span>Bersih (Jeda suci di antara darah)</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-3 text-sm md:text-base border-b border-slate-100 pb-2">📝 Aturan Penulisan Cepat</h4>
                <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-1.5">
                  <li>Sistem membaca format secara berurutan, bisa menyamping kiri ke kanan (cth: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">kd 7 b 20 kd 5</code>) atau atas ke bawah.</li>
                  <li>Huruf besar atau kecil tidak masalah (AH atau ah sama saja).</li>
                  <li>Warna darah <b>opsional</b>. Jika tidak ditulis, mesin menganggap kasus sebagai <b>Ghoiru Mumayyizah</b>.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm md:text-base border-b border-slate-100 pb-2">💡 Contoh Kasus yang Valid</h4>
                
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Contoh 1: Memasukkan Durasi (Haid)</span>
                  <div className="font-mono text-xs text-slate-700 space-y-0.5">
                    <div>AH: 7</div>
                    <div>AS: 20</div>
                    <div>KD: 5 (Hitam)</div>
                    <div>B: 14</div>
                    <div>KD: 7 (Merah)</div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Contoh 2: Memasukkan Rentang Tanggal (Nifas)</span>
                  <div className="font-mono text-xs text-slate-700 space-y-0.5">
                    <div>AN: 40</div>
                    <div>KD 1 mei - 15 mei</div>
                    <div>B 15 mei - 20 mei</div>
                    <div>KD 20 mei - 1 juli</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-5 border-t border-slate-100">
              <button onClick={() => setShowGuide(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded text-sm transition-colors">
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;

```
