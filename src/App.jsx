import React, { useState } from 'react';
import { Calendar, Droplets, CheckCircle2, ChevronRight, Activity, BookOpen, Trash2, Scale, Baby, Keyboard, AlertCircle, Copy } from 'lucide-react';
import { msToHours, formatDuration, getColorLabel, parseQuickTextInput, createAnalysisResult, buildCopyTextFromAnalysis } from './lib/analysis.js';

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
  const [showTextInput, setShowTextInput] = useState(false);

  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeTab, setActiveTab] = useState('QOUL_2'); 
  const [copied, setCopied] = useState(false);

  const handleAppModeChange = (mode) => {
    setAppMode(mode);
    setAnalysisResult(null);
    setLogs([]); 
  };

  const parseTextInput = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const result = parseQuickTextInput(textInput, appMode, inputWiladah, { baseTime: new Date() });
    if (result.logs.length === 0) {
      alert("Format tidak dikenali! Gunakan format: KD [angka] [warna] B [angka]");
      return;
    }

    if (result.overrides.adatNifas != null) {
      setAdatNifas(result.overrides.adatNifas);
      setUserStatus('mutadah');
      setLupaAdat(false);
    }
    if (result.overrides.adatHaid != null) {
      setAdatHaid(result.overrides.adatHaid);
      setUserStatus('mutadah');
      setLupaAdat(false);
    }
    if (result.overrides.adatSuci != null) {
      setAdatSuci(result.overrides.adatSuci);
      setUserStatus('mutadah');
      setLupaAdat(false);
    }

    if (result.logs.length > 0 && appMode === 'NIFAS' && !inputWiladah) {
      setInputWiladah(result.firstLogStart);
    }

    if (analysisResult !== null) {
      setLogs(result.logs);
    } else {
      setLogs([...logs, ...result.logs].sort((a, b) => new Date(a.start) - new Date(b.start)));
    }

    setTextInput('');
    setShowTextInput(false);
    setAnalysisResult(null);
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

  const removeLog = (id) => { setLogs(logs.filter(log => log.id !== id)); setAnalysisResult(null); };

  const runAnalysisEngine = () => {
    if (logs.length === 0) return setAnalysisResult({ error: "Silakan masukkan log pendarahan terlebih dahulu." });

    const result = createAnalysisResult(appMode, logs, { userStatus, lupaAdat, adatHaid, adatSuci, adatNifas });
    setAnalysisResult(result);
    setActiveTab('QOUL_2');
  };

  const getBadgeStyle = (text) => {
    if (text.includes("Fasad")) return "bg-gray-600 text-white shadow-sm font-bold";
    if (text.includes("Tamyiz")) return "bg-blue-600 text-white font-bold shadow-sm ring-1 ring-blue-300";
    if (text.includes("Nifas")) return "bg-rose-600 text-white font-bold shadow-sm ring-1 ring-rose-300";
    if (text.includes("Adat")) return "bg-red-700 text-white font-bold shadow-sm";
    if (text.includes("Haid")) return "bg-red-500 text-white font-bold shadow-sm";
    if (text.includes("Istihadhoh")) return "bg-orange-400 text-white shadow-sm";
    if (text.includes("Suci")) return "bg-emerald-500 text-white shadow-sm";
    if (text.includes("Baru")) return "bg-rose-700 text-white shadow-md font-bold";
    return "bg-slate-500 text-white";
  };

  let activeBreakdown = [];
  if (analysisResult) {
      activeBreakdown = activeTab === 'QOUL_1' ? analysisResult.qoul1 : analysisResult.qoul2;
  }

  const handleCopyResult = () => {
    if (!analysisResult) return;

    const textToCopy = buildCopyTextFromAnalysis(analysisResult, appMode, {
      userStatus,
      lupaAdat,
      adatNifas,
      adatHaid,
      adatSuci,
      activeTab,
    });

    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <Scale size={36} className="text-amber-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-black">Kalkulator Fikih Wanita</h1>
              <p className="text-slate-400 text-sm font-medium mt-1">Engine v42: Nifas Bypass Precision</p>
            </div>
          </div>
          
          <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 w-full md:w-auto">
            <button onClick={() => handleAppModeChange('HAID')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${appMode === 'HAID' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Droplets size={16}/> Siklus Haid</button>
            <button onClick={() => handleAppModeChange('NIFAS')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${appMode === 'NIFAS' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Baby size={16}/> Kasus Nifas</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-white rounded-2xl p-5 border-2 shadow-sm border-slate-200">
              <h2 className="text-md font-bold mb-4 flex items-center gap-2"><Activity size={18} className="text-emerald-600"/> Konteks Fikih</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Status Keadatan Profil</label>
                  <select value={userStatus} onChange={(e) => {setUserStatus(e.target.value); setLupaAdat(false);}} className="w-full rounded-xl border-slate-300 p-3 border bg-slate-50 font-bold focus:ring-emerald-500">
                    <option value="mubtadiah">Mubtadi'ah (Pemula)</option>
                    <option value="mutadah">Mu'tadah (Punya Adat)</option>
                  </select>
                </div>

                {userStatus === 'mutadah' && (
                   <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={lupaAdat} onChange={(e) => setLupaAdat(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"/>
                        <span className="text-sm font-bold text-amber-900">Saya lupa Adat (Mutahayyirah)</span>
                      </label>
                   </div>
                )}
                
                {userStatus === 'mutadah' && !lupaAdat && (
                  <div className={`grid grid-cols-2 ${appMode === 'NIFAS' ? 'md:grid-cols-3' : ''} gap-3 pt-2`}>
                    {appMode === 'NIFAS' && (
                       <div><label className="block text-xs font-bold text-slate-600 mb-1">Adat Nifas</label><input type="number" value={Number.isNaN(adatNifas) ? '' : adatNifas} onChange={(e) => setAdatNifas(parseInt(e.target.value))} className="w-full rounded-xl border p-3 text-center font-bold bg-slate-50" /></div>
                    )}
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Adat Haid</label><input type="number" value={Number.isNaN(adatHaid) ? '' : adatHaid} onChange={(e) => setAdatHaid(parseInt(e.target.value))} className="w-full rounded-xl border p-3 text-center font-bold bg-slate-50" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Adat Suci</label><input type="number" value={Number.isNaN(adatSuci) ? '' : adatSuci} onChange={(e) => setAdatSuci(parseInt(e.target.value))} className="w-full rounded-xl border p-3 text-center font-bold bg-slate-50" /></div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-md font-bold flex items-center gap-2"><Droplets size={18} className="text-red-500"/> Input Darah</h2>
                <button onClick={() => setShowTextInput(!showTextInput)} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-200"><Keyboard size={14}/> {showTextInput ? 'Manual' : 'Teks Cepat'}</button>
              </div>

              {showTextInput ? (
                <form onSubmit={parseTextInput} className="space-y-3 animate-in fade-in">
                  <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder={appMode === 'NIFAS' ? "Cth:\nAN: 50\nAH: 7\nAS: 20\nKD 65 hari\nB 9 hari\nKD 5 hari" : "Cth: \nAH: 8\nAS: 17\nKD 2 hari\nB 2 hari\nKD 6 hari"} className="w-full rounded-xl p-3 border bg-slate-50 min-h-[140px] text-sm font-mono"></textarea>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Parsing Teks Cepat</button>
                </form>
              ) : (
                <form onSubmit={handleAddLog} className="space-y-4 text-sm animate-in fade-in">
                  <div><label className="block text-xs font-bold mb-1">Mulai Keluar</label><input type="datetime-local" required value={inputStart} onChange={(e) => setInputStart(e.target.value)} className="w-full rounded-xl p-3 border bg-slate-50" /></div>
                  <div><label className="block text-xs font-bold mb-1">Berhenti / Jeda</label><input type="datetime-local" required value={inputEnd} onChange={(e) => setInputEnd(e.target.value)} className="w-full rounded-xl p-3 border bg-slate-50" /></div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Warna Darah (Opsional)</label>
                    <select value={inputColor} onChange={(e) => setInputColor(e.target.value)} className="w-full rounded-xl p-3 border bg-slate-50">
                      <option value="">- Tidak Spesifik / Lupa -</option>
                      <option value="1">Hitam (Paling Kuat)</option>
                      <option value="2">Merah</option>
                      <option value="3">Coklat</option>
                      <option value="4">Kuning</option>
                      <option value="5">Keruh (Paling Lemah)</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl">+ Catat</button>
                </form>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="overflow-auto border rounded-xl max-h-60 mb-4 bg-slate-50 custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white sticky top-0 shadow-sm text-xs uppercase text-slate-500 font-bold z-10">
                    <tr><th className="p-4">Mulai</th><th className="p-4">Selesai</th><th className="p-4">Durasi</th><th className="p-4">Warna</th><th className="p-4 text-center">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => {
                      const rows = [];
                      rows.push(
                        <tr key={log.id} className="border-b bg-white">
                          <td className="p-4">{new Date(log.start).toLocaleString('id-ID', {day: '2-digit', month: 'short', hour: '2-digit'})}</td>
                          <td className="p-4">{new Date(log.end).toLocaleString('id-ID', {day: '2-digit', month: 'short', hour: '2-digit'})}</td>
                          <td className="p-4 font-black text-red-600">{formatDuration(log.durationHours)}</td>
                          <td className="p-4">{getColorLabel(log.color)}</td>
                          <td className="p-4 text-center"><button onClick={() => removeLog(log.id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} className="mx-auto"/></button></td>
                        </tr>
                      );

                      if (index < logs.length - 1) {
                        const endCurrent = new Date(log.end);
                        const startNext = new Date(logs[index + 1].start);
                        const gapHours = msToHours(startNext - endCurrent);
                        if (gapHours > 0) {
                          rows.push(
                            <tr key={`gap-${log.id}`} className="border-b bg-emerald-50/70">
                              <td className="p-4 text-emerald-700/60 text-xs">{endCurrent.toLocaleString('id-ID', {day: '2-digit', month: 'short', hour: '2-digit'})}</td>
                              <td className="p-4 text-emerald-700/60 text-xs">{startNext.toLocaleString('id-ID', {day: '2-digit', month: 'short', hour: '2-digit'})}</td>
                              <td className="p-4 font-black text-emerald-600">{formatDuration(gapHours)}</td>
                              <td className="p-4 font-bold text-emerald-700 text-xs uppercase tracking-widest" colSpan="2">Jeda Bersih (B)</td>
                            </tr>
                          );
                        }
                      }
                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
              <button onClick={runAnalysisEngine} className="w-full text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all shadow-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">Eksekusi Fikih <ChevronRight size={20}/></button>
            </div>

            {analysisResult && !analysisResult.error && (
              <div className="rounded-2xl border-2 shadow-inner overflow-hidden bg-indigo-50 border-indigo-200">
                <div className="p-6 border-b bg-indigo-100/50 border-indigo-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider mb-1 block opacity-70">{analysisResult.engine}</span>
                    <h3 className="text-2xl font-black text-slate-800">{analysisResult.status}</h3>
                  </div>
                  <button onClick={handleCopyResult} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-sm transition-all active:scale-95">
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {copied ? 'Tersalin!' : 'Salin Jawaban'}
                  </button>
                </div>

                {analysisResult.hasKhilaf ? (
                  <div className="flex border-b border-indigo-200 bg-white">
                    <button onClick={() => setActiveTab('QOUL_1')} className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'QOUL_1' ? 'bg-slate-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Qoul 1: Kembali Ke Adat Asal</button>
                    <button onClick={() => setActiveTab('QOUL_2')} className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'QOUL_2' ? 'bg-indigo-600 text-white shadow-inner' : 'text-indigo-600 hover:bg-indigo-50'}`}>Qoul 2 (Mu'tamad): Pakai Adat Terakhir</button>
                  </div>
                ) : null}

                <div className="p-6 space-y-3">
                  {activeBreakdown.map((item, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center gap-4 border-indigo-100 hover:border-indigo-300 transition-colors">
                      <div className="font-mono text-sm font-bold text-slate-600 w-32 shrink-0 border-b md:border-b-0 md:border-r pb-2 md:pb-0 md:pr-4">{item.label}</div>
                      <div className="flex flex-wrap gap-2">
                        {item.details.map((detail, i) => (
                          <span key={i} className={`px-3 py-1.5 rounded-lg text-xs tracking-wide shadow-sm ${getBadgeStyle(detail)}`}>{detail}</span>
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
    </div>
  );
};

export default App;