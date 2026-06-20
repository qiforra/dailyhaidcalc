import React, { useState } from 'react';
import { Calendar, Droplets, CheckCircle2, ChevronRight, Activity, BookOpen, Trash2, Scale, Baby, Keyboard, AlertCircle, Copy } from 'lucide-react';

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

  const msToHours = (ms) => ms / (1000 * 60 * 60);
  
  const formatDuration = (hours) => {
    const d = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    if (d > 0 && h > 0) return `${d} Hari ${h} Jam`;
    if (d > 0) return `${d} Hari`;
    return `${h} Jam`;
  };

  const handleAppModeChange = (mode) => {
    setAppMode(mode);
    setAnalysisResult(null);
    setLogs([]); 
  };

  const parseTextInput = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const text = textInput.toLowerCase();

    // SCANNER ADAT OVERRIDE
    const anMatch = text.match(/an\s*[:=]?\s*(\d+)/);
    const ahMatch = text.match(/ah\s*[:=]?\s*(\d+)/);
    const asMatch = text.match(/as\s*[:=]?\s*(\d+)/);

    if (anMatch) { setAdatNifas(parseInt(anMatch[1])); setUserStatus('mutadah'); setLupaAdat(false); }
    if (ahMatch) { setAdatHaid(parseInt(ahMatch[1])); setUserStatus('mutadah'); setLupaAdat(false); }
    if (asMatch) { setAdatSuci(parseInt(asMatch[1])); setUserStatus('mutadah'); setLupaAdat(false); }

    let baseTime = new Date();
    if (appMode === 'NIFAS' && inputWiladah) baseTime = new Date(inputWiladah);

    const logPattern = /(kd|b)\s*(hitam|merah|coklat|kuning|keruh)?\s*([\d.]+)\s*(hari|jam)?\s*(hitam|merah|coklat|kuning|keruh)?/g;
    const tokens = text.match(logPattern);

    if (!tokens) { 
        alert("Format tidak dikenali! Gunakan format: KD [angka] [warna] B [angka]"); 
        return; 
    }

    let currentStart = new Date(baseTime);
    let newLogs = [];

    tokens.forEach(token => {
      const match = token.match(/(kd|b)\s*(hitam|merah|coklat|kuning|keruh)?\s*([\d.]+)\s*(hari|jam)?\s*(hitam|merah|coklat|kuning|keruh)?/);
      if (match) {
        const type = match[1];
        const colorBefore = match[2];
        const value = parseFloat(match[3]);
        const unit = match[4];
        const colorAfter = match[5]; 

        const colorName = colorBefore || colorAfter; 
        const days = unit === 'jam' ? (value / 24) : value; 

        const durationMs = days * 24 * 60 * 60 * 1000;
        const currentEnd = new Date(currentStart.getTime() + durationMs);

        let colorVal = null;
        if (colorName === 'hitam') colorVal = 1;
        else if (colorName === 'merah') colorVal = 2;
        else if (colorName === 'coklat') colorVal = 3;
        else if (colorName === 'kuning') colorVal = 4;
        else if (colorName === 'keruh') colorVal = 5;

        if (type === 'kd') {
          newLogs.push({
            id: Date.now() + Math.random(), start: currentStart.toISOString().slice(0, 16),
            end: currentEnd.toISOString().slice(0, 16), durationHours: days * 24, color: colorVal
          });
        } else if (type === 'b') {
           currentStart = new Date(currentStart.getTime() + durationMs);
           return;
        }
        currentStart = currentEnd;
      }
    });

    if (newLogs.length > 0 && appMode === 'NIFAS' && !inputWiladah) setInputWiladah(newLogs[0].start);
    
    if (analysisResult !== null) setLogs(newLogs.sort((a, b) => new Date(a.start) - new Date(b.start)));
    else setLogs([...logs, ...newLogs].sort((a, b) => new Date(a.start) - new Date(b.start)));
    
    setTextInput(''); setShowTextInput(false); setAnalysisResult(null);
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

  const getColorLabel = (val) => {
    switch(val) {
      case 1: return 'Hitam (1)'; case 2: return 'Merah (2)';
      case 3: return 'Coklat (3)'; case 4: return 'Kuning (4)';
      case 5: return 'Keruh (5)'; default: return '-';
    }
  };

  // ==========================================
  // ENGINE 1: HAID (Taqothu' Murni Tanpa Sisa)
  // ==========================================
  const analyzeHaidPeriods = (periods, qoulMode) => {
    let breakdown = [];
    const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
    const baseHaid = effectiveStatus === 'mutadah' ? (Number.isNaN(adatHaid) ? 0 : adatHaid * 24) : 24; 
    const baseSuci = effectiveStatus === 'mutadah' ? (Number.isNaN(adatSuci) ? 0 : adatSuci * 24) : (29 * 24); 

    let isSahbi = qoulMode === 'LAQTHI_SAHBI';
    let isNormalQoul1 = qoulMode === 'QOUL_1';

    let cycleAdatHaid = baseHaid;
    let cycleAdatSuci = baseSuci;

    let spans = [];
    let currentSpan = { duration: 0, periods: [] };
    periods.forEach(p => {
        if (p.type === 'B' && p.hours >= 15 * 24) {
            if (currentSpan.periods.length > 0) spans.push(currentSpan);
            spans.push({ isGap: true, period: p });
            currentSpan = { duration: 0, periods: [] };
        } else {
            currentSpan.duration += p.hours;
            currentSpan.periods.push(p);
        }
    });
    if (currentSpan.periods.length > 0) spans.push(currentSpan);

    let meta = { isTamyizValid: false, fallbackReason: "", effectiveStatus, adatUpdates: [], hasTakmil: false };

    const pushDetail = (arr, hours, label) => {
        if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
    };

    spans.forEach(span => {
        if (span.isGap) {
            breakdown.push({ label: `B ${formatDuration(span.period.hours)}`, details: [`${formatDuration(span.period.hours)} Suci`] });
            cycleAdatSuci = span.period.hours; 
            return;
        }

        let isMustahadhah = span.duration > 15 * 24;

        if (!isMustahadhah) {
            span.periods.forEach(p => {
                let detailsArr = [];
                if (p.type === 'KD') pushDetail(detailsArr, p.hours, 'Haid');
                else pushDetail(detailsArr, p.hours, 'Haid (Qoul Sahbi)');
                breakdown.push({ label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, details: detailsArr });
            });
            cycleAdatHaid = span.duration; 
        } else {
            let isTamyizValid = false;
            let fallbackReason = "";
            let tamyizSpans = [];

            let kdColors = span.periods.filter(p => p.type === 'KD').map(p => p.color);
            let uniqueColors = new Set(kdColors.filter(c => c !== null));

            if (uniqueColors.size < 2) {
                fallbackReason = "Ghoiru Mumayyizah: Tidak ada pembedaan sifat darah (Warna seragam / Tidak diinput).";
            } else {
                let currentStrongColor = null;
                let currentHaidAcc = 0;
                let currentWeakAcc = 0;
                let isSearchingHaid = true;
                let lastWeakColor = 5; 

                span.periods.forEach((p, idx) => {
                    if (isSearchingHaid) {
                        if (p.type === 'KD') {
                            let pColor = p.color || 5;
                            if (currentStrongColor === null) {
                                currentStrongColor = pColor;
                                currentHaidAcc = p.hours;
                                tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
                            } else if (pColor === currentStrongColor) {
                                currentHaidAcc += p.hours;
                                tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
                            } else if (pColor > currentStrongColor) { 
                                if (currentHaidAcc >= 24 && currentHaidAcc <= 15 * 24) {
                                    isSearchingHaid = false;
                                    currentWeakAcc = p.hours;
                                    lastWeakColor = pColor;
                                    tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
                                } else {
                                    currentHaidAcc += p.hours; 
                                    tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
                                }
                            } else { 
                                currentStrongColor = pColor;
                                currentHaidAcc += p.hours; 
                                tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
                            }
                        } else if (p.type === 'B') {
                            if (currentHaidAcc >= 24 && currentHaidAcc <= 15 * 24) {
                                isSearchingHaid = false;
                                currentWeakAcc = p.hours;
                                tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours });
                            } else {
                                currentHaidAcc += p.hours;
                                tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours });
                            }
                        }
                    } else { 
                        if (p.type === 'B') {
                            currentWeakAcc += p.hours;
                            tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours });
                        } else if (p.type === 'KD') {
                            let pColor = p.color || 5;
                            if (currentWeakAcc >= 15 * 24) { 
                                if (pColor < lastWeakColor) { 
                                    isSearchingHaid = true;
                                    currentStrongColor = pColor;
                                    currentHaidAcc = p.hours;
                                    currentWeakAcc = 0;
                                    tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
                                } else {
                                    currentWeakAcc += p.hours;
                                    lastWeakColor = pColor;
                                    tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
                                }
                            } else {
                                currentWeakAcc += p.hours;
                                lastWeakColor = pColor;
                                tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
                            }
                        }
                    }
                });

                let groupedTamyiz = [];
                tamyizSpans.forEach(ts => {
                    if (groupedTamyiz.length > 0 && groupedTamyiz[groupedTamyiz.length - 1].type === ts.type) {
                        groupedTamyiz[groupedTamyiz.length - 1].hours += ts.hours;
                    } else {
                        groupedTamyiz.push({ type: ts.type, hours: ts.hours });
                    }
                });

                let hasValidHaid = groupedTamyiz.some(ts => ts.type === 'HAID' && ts.hours >= 24 && ts.hours <= 15 * 24);
                let hasValidSuci = groupedTamyiz.some(ts => ts.type === 'ISTIHADHOH' && ts.hours >= 15 * 24);
                
                if (hasValidHaid && (hasValidSuci || groupedTamyiz[groupedTamyiz.length-1].type === 'ISTIHADHOH')) {
                    isTamyizValid = true;
                } else {
                    fallbackReason = "Gagal memenuhi syarat Tamyiz: Kurang 24 jam / Lebih 15 Hari / Tidak ada jeda lemah 15 hari.";
                }
            } 
            
            meta.isTamyizValid = isTamyizValid;
            meta.fallbackReason = fallbackReason;

            if (isTamyizValid) {
                span.periods.forEach((p, idx) => {
                    let tsMatch = tamyizSpans.filter(ts => ts.id === idx);
                    let detailsArr = [];
                    tsMatch.forEach(ts => {
                        pushDetail(detailsArr, ts.hours, ts.type === 'HAID' ? 'Haid (Tamyiz)' : (p.type === 'B' ? 'Suci' : 'Istihadhoh (Lemah)'));
                    });
                    breakdown.push({ label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, details: detailsArr });
                });
                cycleAdatHaid = tamyizSpans.find(ts => ts.type === 'HAID')?.hours || cycleAdatHaid; 
            } else {

                let loopState = 'HAID';
                
                let targetHaid = cycleAdatHaid;
                let targetSuci = cycleAdatSuci;
                if (targetSuci < 15 * 24) targetSuci = 15 * 24; 
                
                let haidAcc = 0;
                let suciAcc = 0;
                let windowTime = 0;

                span.periods.forEach((p, idx) => {
                    let pLeft = p.hours;
                    let detailsArr = [];

                    if (idx === 0 && p.type === 'KD' && p.hours < 24) {
                        pushDetail(detailsArr, p.hours, 'Fasad (Batal Haid)');
                        pLeft = 0; loopState = 'SUCI'; suciAcc = 0;
                    }

                    while (pLeft > 0.01) {
                        if (loopState === 'SUCI') {
                            if (suciAcc >= targetSuci && p.type === 'KD') {
                                loopState = 'HAID';
                                windowTime = 0; haidAcc = 0;
                                cycleAdatSuci = suciAcc; 
                                targetSuci = cycleAdatSuci;
                                if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                                targetHaid = cycleAdatHaid; 
                                continue; 
                            }

                            let limit = (p.type === 'B') ? pLeft : Math.max(0, targetSuci - suciAcc);
                            let consume = Math.min(pLeft, limit);
                            
                            if (consume > 0) {
                                let label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
                                if (p.type === 'KD' && suciAcc < 15 * 24) {
                                    meta.hasTakmil = true;
                                }
                                pushDetail(detailsArr, consume, label);
                                suciAcc += consume; pLeft -= consume;
                            }

                            if (suciAcc >= targetSuci && pLeft > 0 && p.type === 'KD') {
                                loopState = 'HAID';
                                windowTime = 0; haidAcc = 0;
                                cycleAdatSuci = suciAcc; 
                                targetSuci = cycleAdatSuci;
                                if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                                targetHaid = cycleAdatHaid; 
                            }
                        }

                        if (loopState === 'HAID') {
                            if (p.type === 'KD' && !isNormalQoul1 && haidAcc === 0 && windowTime === 0) {
                                let totalRemainingToLastKD = 0;
                                let lastRemainingKDIdx = idx;
                                
                                for (let i = idx; i < span.periods.length; i++) {
                                    if (span.periods[i].type === 'KD') lastRemainingKDIdx = i;
                                }
                                
                                for (let i = idx; i <= lastRemainingKDIdx; i++) {
                                    totalRemainingToLastKD += span.periods[i].hours;
                                }

                                if (totalRemainingToLastKD > targetHaid && totalRemainingToLastKD <= 15 * 24) {
                                    targetHaid = totalRemainingToLastKD;
                                    cycleAdatHaid = targetHaid;
                                }
                            }

                            let currentTarget = (isNormalQoul1 && !isSahbi) ? baseHaid : targetHaid;
                            let consume = Math.min(pLeft, currentTarget - haidAcc);

                            if (p.type === 'KD') {
                                if (consume > 0) {
                                    let label = isNormalQoul1 ? ' (Adat Asal)' : (isSahbi ? '' : '');
                                    pushDetail(detailsArr, consume, `Haid${label}`);
                                    haidAcc += consume; pLeft -= consume;
                                }
                                if (haidAcc >= currentTarget) { 
                                    loopState = 'SUCI'; suciAcc = 0; 
                                    if (!isNormalQoul1) cycleAdatHaid = currentTarget;
                                    targetSuci = cycleAdatSuci; 
                                    if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                                }
                            } else {
                                let nextKDStart = haidAcc + pLeft;
                                let nextKDDuration = 0;
                                for (let i = idx + 1; i < span.periods.length; i++) {
                                    if (span.periods[i].type === 'KD') { nextKDDuration = span.periods[i].hours; break; }
                                    nextKDStart += span.periods[i].hours;
                                }

                                if (nextKDDuration > 0 && nextKDStart < currentTarget) {
                                    pushDetail(detailsArr, pLeft, 'Haid (Qoul Sahbi)');
                                    haidAcc += pLeft; pLeft = 0;
                                } else {
                                    if (!isNormalQoul1) cycleAdatHaid = haidAcc;
                                    targetSuci = cycleAdatSuci;
                                    if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                                    loopState = 'SUCI'; suciAcc = 0; 
                                }
                            }
                        }
                    }
                    breakdown.push({ label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, details: detailsArr });
                });
            }
        }
    });
    return { breakdown, meta };
  };

  // ==========================================
  // ENGINE 2: NIFAS (River Flow Logic to Haid/Suci)
  // ==========================================
  const analyzeNifasPeriods = (periods) => {
    let breakdown = [];
    const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
    const baseHaid = effectiveStatus === 'mutadah' ? (Number.isNaN(adatHaid) ? 0 : adatHaid * 24) : 24; 
    const baseSuci = effectiveStatus === 'mutadah' ? (Number.isNaN(adatSuci) ? 0 : adatSuci * 24) : (29 * 24); 
    const targetNifas = effectiveStatus === 'mutadah' ? (Number.isNaN(adatNifas) ? 40 : adatNifas) * 24 : 0.01;

    let meta = { isTamyizValid: false, fallbackReason: "", effectiveStatus };
    
    const pushDetail = (arr, hours, label) => {
        if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
    };

    let isMustahadhah = false;
    let normalNifasHours = 0;
    let currentAcc = 0;
    
    for (let p of periods) {
        if (p.type === 'B' && p.hours >= 15 * 24) { normalNifasHours = currentAcc; break; }
        if (currentAcc + p.hours > 60 * 24) {
            if (p.type === 'KD') isMustahadhah = true; 
            else normalNifasHours = currentAcc; 
            break;
        }
        if (currentAcc + p.hours === 60 * 24) {
            if (p.type === 'KD') normalNifasHours = 60 * 24;
            else normalNifasHours = currentAcc;
            break;
        }
        currentAcc += p.hours;
    }
    
    if (currentAcc > 0 && currentAcc < 60 * 24 && !isMustahadhah) normalNifasHours = currentAcc;

    let isTamyizNifas = false;
    let tamyizNifasHours = 0;
    let hasColors = false;

    if (isMustahadhah) {
        let kdBlocks = [];
        let currentBlock = null;
        let tempAcc = 0;
        for (let p of periods) {
            if (tempAcc > 60 * 24) break;
            if (p.type === 'KD') {
                if (p.color !== null) hasColors = true;
                if (!currentBlock || currentBlock.color !== p.color) {
                    if (currentBlock) kdBlocks.push(currentBlock);
                    currentBlock = { color: p.color, hours: p.hours };
                } else currentBlock.hours += p.hours;
                tempAcc += p.hours;
            } else {
                if (p.hours >= 15 * 24) break; 
                if (currentBlock) kdBlocks.push(currentBlock);
                currentBlock = null;
                tempAcc += p.hours;
            }
        }
        if (currentBlock) kdBlocks.push(currentBlock);

        if (hasColors) {
            const validKdBlocks = kdBlocks.filter(b => b.color !== null);
            const distinctNifasColors = new Set(validKdBlocks.map(b => b.color));
            if (distinctNifasColors.size > 1) {
                let strongColor = Math.min(...validKdBlocks.map(b => b.color));
                let firstKuatIdx = validKdBlocks.findIndex(b => b.color === strongColor);
                if (firstKuatIdx !== -1) {
                    let kuat1 = validKdBlocks[firstKuatIdx];
                    if (kuat1.hours <= 60 * 24) {
                        isTamyizNifas = true;
                        tamyizNifasHours = kuat1.hours;
                    }
                }
            }
        }
    }

    let activeTargetNifas = targetNifas;
    let nifasLabel = 'Nifas';

    if (!isMustahadhah) {
        activeTargetNifas = normalNifasHours;
        meta.isTamyizValid = false;
        meta.fallbackReason = "Normal (Darah berhenti sebelum 60 Hari)";
    } else {
        if (isTamyizNifas) {
            activeTargetNifas = tamyizNifasHours;
            meta.isTamyizValid = true;
            nifasLabel = 'Nifas (Tamyiz)';
        } else {
            activeTargetNifas = targetNifas;
            meta.fallbackReason = "Ghoiru Mumayyizah / Melebihi 60 Hari";
            nifasLabel = targetNifas <= 0.01 ? 'Nifas (Setetes / Lahdhoh)' : 'Nifas (Adat)';
        }
    }

    let loopState = 'NIFAS';
    let cycleAdatHaid = baseHaid;
    let cycleAdatSuci = baseSuci;
    
    let targetSuci = cycleAdatSuci;
    if (targetSuci < 15 * 24) targetSuci = 15 * 24;
    let targetHaid = cycleAdatHaid;
    
    let suciAcc = 0;
    let haidAcc = 0;
    let nifasAcc = 0;

    let globalTimeAcc = 0;
    let hasUsedNifasSeparator = false;
    let nifasSuciBypassAvailable = false; // ALARM BYPASS 60 HARI!

    periods.forEach((p, idx) => {
        let pLeft = p.hours;
        let detailsArr = [];

        if (idx === 0 && p.type === 'KD' && loopState === 'NIFAS' && activeTargetNifas <= 0.01) {
            pushDetail(detailsArr, 0.01, 'Nifas (Setetes / Lahdhoh)');
            pLeft -= 0.01;
            globalTimeAcc += 0.01;
            loopState = 'SUCI';
            suciAcc = 0;
            targetSuci = cycleAdatSuci;
            if (targetSuci < 15 * 24) targetSuci = 15 * 24;
        }

        while (pLeft > 0.01) {
            let consume = 0;

            if (loopState === 'NIFAS') {
                consume = Math.min(pLeft, activeTargetNifas - nifasAcc);
                if (consume > 0) {
                    let label = p.type === 'KD' ? (!isMustahadhah ? 'Nifas' : nifasLabel) : 'Nifas (Naqa\')';
                    pushDetail(detailsArr, consume, label);
                    nifasAcc += consume; pLeft -= consume;
                    globalTimeAcc += consume;
                }
                if (nifasAcc >= activeTargetNifas) {
                    loopState = 'SUCI'; suciAcc = 0; 
                    targetSuci = cycleAdatSuci;
                    if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                }
            }

            else if (loopState === 'SUCI') {
                // CEK ALARM BYPASS UNTUK DARAH SELANJUTNYA
                if ((suciAcc >= targetSuci && p.type === 'KD') || (nifasSuciBypassAvailable && p.type === 'KD')) {
                    loopState = 'HAID';
                    haidAcc = 0;
                    cycleAdatSuci = suciAcc; 
                    targetSuci = cycleAdatSuci;
                    if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                    targetHaid = cycleAdatHaid; 
                    nifasSuciBypassAvailable = false; // Matikan alarm
                    hasUsedNifasSeparator = true;     // Kunci bypass agar tidak dipakai ulang
                    continue; 
                }

                let limit = (p.type === 'B') ? pLeft : Math.max(0, targetSuci - suciAcc);
                consume = Math.min(pLeft, limit);

                // PENYALAN ALARM BYPASS (Jika Jeda Bersih menabrak 60 hari)
                if (!hasUsedNifasSeparator && p.type === 'B' && (globalTimeAcc + consume) >= 60 * 24 - 0.01) {
                    nifasSuciBypassAvailable = true;
                }

                if (consume > 0) {
                    let label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
                    pushDetail(detailsArr, consume, label);
                    suciAcc += consume; pLeft -= consume;
                    globalTimeAcc += consume;
                }

                if (suciAcc >= targetSuci && pLeft > 0 && p.type === 'KD') {
                     loopState = 'HAID';
                     haidAcc = 0;
                     cycleAdatSuci = suciAcc; 
                     targetSuci = cycleAdatSuci;
                     if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                     targetHaid = cycleAdatHaid; 
                     hasUsedNifasSeparator = true;
                }
            }

            else if (loopState === 'HAID') {
                if (p.type === 'KD' && haidAcc === 0) {
                    let totalRemainingToLastKD = 0;
                    let lastRemainingKDIdx = idx;
                    for (let i = idx; i < periods.length; i++) {
                        if (periods[i].type === 'KD') lastRemainingKDIdx = i;
                    }
                    for (let i = idx; i <= lastRemainingKDIdx; i++) {
                        totalRemainingToLastKD += periods[i].hours;
                    }

                    if (totalRemainingToLastKD > targetHaid && totalRemainingToLastKD <= 15 * 24) {
                        targetHaid = totalRemainingToLastKD;
                        cycleAdatHaid = targetHaid;
                    }
                }

                consume = Math.min(pLeft, targetHaid - haidAcc);
                if (p.type === 'KD') {
                    if (consume > 0) {
                        let label = 'Haid';
                        if (targetHaid !== baseHaid && targetHaid === cycleAdatHaid) label = 'Haid (Adat Dinamis)';
                        pushDetail(detailsArr, consume, label);
                        haidAcc += consume; pLeft -= consume;
                        globalTimeAcc += consume;
                    }
                    if (haidAcc >= targetHaid) { 
                        loopState = 'SUCI'; suciAcc = 0; 
                        cycleAdatHaid = targetHaid; 
                        targetSuci = cycleAdatSuci; 
                        if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                    }
                } else {
                    let nextKDStart = haidAcc + pLeft;
                    let nextKDDuration = 0;
                    for (let i = idx + 1; i < periods.length; i++) {
                        if (periods[i].type === 'KD') { nextKDDuration = periods[i].hours; break; }
                        nextKDStart += periods[i].hours;
                    }

                    if (nextKDDuration > 0 && nextKDStart < targetHaid) {
                        pushDetail(detailsArr, pLeft, 'Haid (Qoul Sahbi)');
                        haidAcc += pLeft; pLeft = 0;
                        globalTimeAcc += pLeft;
                    } else {
                        cycleAdatHaid = haidAcc; 
                        targetSuci = cycleAdatSuci; 
                        if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                        loopState = 'SUCI'; suciAcc = 0; 
                    }
                }
            }
        }
        breakdown.push({ label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, details: detailsArr });
    });

    return { breakdown, meta };
  };

  const runAnalysisEngine = () => {
    if (logs.length === 0) return setAnalysisResult({ error: "Silakan masukkan log pendarahan terlebih dahulu." });

    const periods = [];
    for (let i = 0; i < logs.length; i++) {
      periods.push({ id: `kd-${i}`, type: 'KD', hours: Math.round(logs[i].durationHours * 100) / 100, color: logs[i].color });
      if (i < logs.length - 1) {
        const gapHours = Math.round(msToHours(new Date(logs[i + 1].start) - new Date(logs[i].end)) * 100) / 100;
        if (gapHours > 0) periods.push({ id: `b-${i}`, type: 'B', hours: gapHours });
      }
    }

    if (appMode === 'HAID') {
      const baseResult = analyzeHaidPeriods(periods, 'QOUL_2');
      const isMustahadhahTaqothu = baseResult.meta.isTamyizValid === false && periods.some(p => p.type === 'B') && periods.reduce((acc,p)=>acc+p.hours, 0) > 15*24;

      if (isMustahadhahTaqothu) {
          const sahbi = analyzeHaidPeriods(periods, 'LAQTHI_SAHBI');

          setAnalysisResult({
            mode: 'HAID', engine: "Engine v42: Nifas Bypass Precision",
            status: "MUSTAHADHAH (QOUL SAHBI)",
            hasKhilaf: false,
            hasLaqthi: false,
            qoul2: sahbi.breakdown,
            meta: sahbi.meta 
          });
          setActiveTab('QOUL_2'); 
      } else {
          const q1Result = analyzeHaidPeriods(periods, 'QOUL_1');
          const isKhilaf = baseResult.meta.hasTakmil;

          setAnalysisResult({
            mode: 'HAID', engine: "Engine v42: Nifas Bypass Precision",
            status: isKhilaf ? "ISTIHADHOH (ADA KHILAF TAQOTHU')" : "TAKHRIJ FIKIH",
            hasKhilaf: isKhilaf,
            hasLaqthi: false,
            qoul1: q1Result.breakdown, qoul2: baseResult.breakdown, meta: baseResult.meta 
          });
          setActiveTab('QOUL_2'); 
      }
    } else {
        const nifasResult = analyzeNifasPeriods(periods);
        setAnalysisResult({
            mode: 'NIFAS', engine: "Engine v42: Nifas Bypass Precision",
            status: nifasResult.meta.isTamyizValid ? "NIFAS (TAMYIZ MEMENUHI SYARAT)" : (nifasResult.meta.fallbackReason.includes('Normal') ? "NIFAS (NORMAL)" : "NIFAS (KEMBALI KE ADAT / LAHDHOH)"),
            hasKhilaf: false, hasLaqthi: false,
            qoul2: nifasResult.breakdown, meta: nifasResult.meta
        });
        setActiveTab('QOUL_2');
    }
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
    
    let textToCopy = '';
    
    if (appMode === 'NIFAS' && userStatus === 'mutadah' && !lupaAdat) {
        textToCopy += `An ${adatNifas} Ah ${adatHaid} As ${adatSuci}\n\n`;
    } else if (appMode === 'HAID' && userStatus === 'mutadah' && !lupaAdat) {
        textToCopy += `Ah ${adatHaid} As ${adatSuci}\n\n`;
    }

    activeBreakdown.forEach(item => {
      let labelStr = item.label.replace('KD', 'Kd').replace('Jeda Bersih', 'B');
      
      if (item.details.length === 1) {
        let detailStr = item.details[0].toLowerCase();
        detailStr = detailStr.replace(new RegExp("^(\\d+\\s+hari\\s+\\d+\\s+jam|\\d+\\s+hari|\\d+\\s+jam)\\s+", "i"), '');
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