// src/utils/engineNifas.js
import { formatDuration, getColorLabel } from './formatters';

export const analyzeNifasPeriods = (periods, userConfig) => {
  const { userStatus, lupaAdat, adatHaid, adatSuci, adatNifas } = userConfig;

  let breakdown = [];
  const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
  
  const baseHaid = (!Number.isNaN(adatHaid) && adatHaid > 0) ? adatHaid * 24 : 24; 
  const baseSuci = (!Number.isNaN(adatSuci) && adatSuci > 0) ? adatSuci * 24 : (29 * 24); 
  
  // PERBAIKAN: Untuk Mubtadiah, target nifas = 60 hari (bukan 0.01)
  const targetNifas = effectiveStatus === 'mutadah' 
    ? Math.min((Number.isNaN(adatNifas) ? 40 : adatNifas) * 24, 60 * 24)
    : 60 * 24; // Mubtadiah = 60 hari maksimal

  let meta = { isTamyizValid: false, fallbackReason: "", effectiveStatus, caseStatus: "" };
  
  const pushDetail = (arr, hours, label) => {
      if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
  };

  // Deteksi apakah ada jeda >= 15 hari yang memisahkan nifas
  let isMustahadhah = false;
  let normalNifasHours = 0;
  let currentAcc = 0;
  
  for (let p of periods) {
      if (p.type === 'B' && p.hours >= 15 * 24) { 
          normalNifasHours = currentAcc; 
          break; 
      }
      if (currentAcc + p.hours > 60 * 24) {
          if (p.type === 'KD') isMustahadhah = true; 
          else normalNifasHours = currentAcc; 
          break;
      }
      currentAcc += p.hours;
  }
  
  if (currentAcc > 0 && currentAcc < 60 * 24 && !isMustahadhah) {
      normalNifasHours = currentAcc;
  }

  // Untuk kasus sederhana (tanpa jeda >= 15 hari), semua KD < 60 hari = Nifas
  let activeTargetNifas = targetNifas;
  let nifasLabel = 'Nifas';

  if (!isMustahadhah) {
      activeTargetNifas = normalNifasHours;
      meta.isTamyizValid = false;
      meta.caseStatus = "Nifas Normal (Berhenti Sebelum 60 Hari)";
  } else {
      activeTargetNifas = targetNifas;
      meta.caseStatus = effectiveStatus === 'mutadah' 
        ? "Nifas Mu'tadah Ghoiru Mumayyizah" 
        : "Nifas Mubtada'ah Ghoiru Mumayyizah";
      nifasLabel = 'Nifas';
  }

  // State Machine
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
  let nifasSuciBypassAvailable = false; 

  periods.forEach((p, idx) => {
      let pLeft = p.hours;
      let detailsArr = [];

      // Penanganan Jeda Wiladah >= 15 Hari
      if (idx === 0 && p.type === 'B') {
          if (p.hours >= 15 * 24) {
              pushDetail(detailsArr, p.hours, 'Suci (Jeda Wiladah / Nifas \'Adadan)');
              globalTimeAcc += p.hours;
              loopState = 'SUCI';
              suciAcc = p.hours;
              activeTargetNifas = 0; 
              pLeft = 0;
          }
      }

      while (pLeft > 0.01) {
          let consume = 0;
          
          if (loopState === 'NIFAS') {
              consume = Math.min(pLeft, activeTargetNifas - nifasAcc);
              if (consume > 0) {
                  let label = p.type === 'KD' ? 'Nifas' : 'Suci (Jeda Wiladah / Nifas \'Adadan)';
                  pushDetail(detailsArr, consume, label);
                  nifasAcc += consume; 
                  pLeft -= consume; 
                  globalTimeAcc += consume;
              }
              if (nifasAcc >= activeTargetNifas) {
                  loopState = 'SUCI'; 
                  suciAcc = 0; 
                  targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
              }
          }
          else if (loopState === 'SUCI') {
              let isNormalKDAfter15B = false;
              if (p.type === 'KD' && suciAcc >= (15 * 24 - 0.1) && suciAcc < targetSuci) {
                  let totalContinuousKD = pLeft;
                  for (let k = idx + 1; k < periods.length; k++) {
                      if (periods[k].type === 'KD') totalContinuousKD += periods[k].hours;
                      else break;
                  }
                  if (totalContinuousKD <= 15 * 24) {
                      isNormalKDAfter15B = true;
                  }
              }

              if ((suciAcc >= targetSuci - 0.1 && p.type === 'KD') || 
                  (nifasSuciBypassAvailable && p.type === 'KD') || 
                  isNormalKDAfter15B) {
                  loopState = 'HAID'; 
                  haidAcc = 0;
                  cycleAdatSuci = suciAcc; 
                  targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
                  targetHaid = cycleAdatHaid; 
                  nifasSuciBypassAvailable = false; 
                  hasUsedNifasSeparator = true;     
                  continue; 
              }
              
              let limit = (p.type === 'B') ? pLeft : Math.max(0, targetSuci - suciAcc);
              consume = Math.min(pLeft, limit);
              if (!hasUsedNifasSeparator && p.type === 'B' && (globalTimeAcc + consume) >= 60 * 24 - 0.01) {
                  nifasSuciBypassAvailable = true;
              }
              if (consume > 0) {
                  let label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
                  pushDetail(detailsArr, consume, label);
                  suciAcc += consume; 
                  pLeft -= consume; 
                  globalTimeAcc += consume;
              }
              
              if (suciAcc >= targetSuci - 0.1 && pLeft > 0 && p.type === 'KD') {
                   loopState = 'HAID'; 
                   haidAcc = 0;
                   cycleAdatSuci = suciAcc; 
                   targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
                   targetHaid = cycleAdatHaid; 
                   hasUsedNifasSeparator = true;
              }
          }
          else if (loopState === 'HAID') {
              consume = Math.min(pLeft, targetHaid - haidAcc);
              if (p.type === 'KD') {
                  if (consume > 0) {
                      pushDetail(detailsArr, consume, 'Haid');
                      haidAcc += consume; 
                      pLeft -= consume; 
                      globalTimeAcc += consume;
                  }
                  if (haidAcc >= targetHaid) { 
                      loopState = 'SUCI'; 
                      suciAcc = 0; 
                      cycleAdatHaid = targetHaid; 
                      targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci; 
                  }
              } else {
                  cycleAdatHaid = haidAcc; 
                  targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci; 
                  loopState = 'SUCI'; 
                  suciAcc = 0; 
              }
          }
      }
      
      if (detailsArr.length > 0) {
        breakdown.push({ 
            label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, 
            details: detailsArr 
        });
      }
  });

  return { breakdown, meta };
};
