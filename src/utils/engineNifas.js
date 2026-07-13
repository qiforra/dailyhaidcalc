// src/utils/engineNifas.js
import { formatDuration, getColorLabel } from './formatters';

export const analyzeNifasPeriods = (periods, userConfig) => {
  const { userStatus, lupaAdat, adatHaid, adatSuci, adatNifas } = userConfig;

  let breakdown = [];
  const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
  
  const baseHaid = (!Number.isNaN(adatHaid) && adatHaid > 0) ? adatHaid * 24 : 24; 
  const baseSuci = (!Number.isNaN(adatSuci) && adatSuci > 0) ? adatSuci * 24 : (29 * 24); 
  
  const targetNifas = effectiveStatus === 'mutadah' ? (Number.isNaN(adatNifas) ? 40 : adatNifas) * 24 : 0.01;

  let meta = { isTamyizValid: false, fallbackReason: "", effectiveStatus, caseStatus: "" };
  
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
      meta.caseStatus = "Nifas Normal (Berhenti Sebelum 60 Hari)";
  } else {
      if (isTamyizNifas) {
          activeTargetNifas = tamyizNifasHours;
          meta.isTamyizValid = true;
          meta.caseStatus = userStatus === 'mutadah' ? "Nifas Mu'tadah Mumayyizah" : "Nifas Mubtada'ah Mumayyizah";
          nifasLabel = 'Nifas (Tamyiz)';
      } else {
          activeTargetNifas = targetNifas;
          meta.caseStatus = userStatus === 'mutadah' ? "Nifas Mu'tadah Ghoiru Mumayyizah" : "Nifas Mubtada'ah Ghoiru Mumayyizah";
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
  let nifasSuciBypassAvailable = false; 

  periods.forEach((p, idx) => {
      let pLeft = p.hours;
      let detailsArr = [];

      // PENANGANAN JEDA WILADAH >= 15 HARI
      // Sesuai Contoh Kasus 3: Jika Jeda Wiladah >= 15 hari, Nifas Gugur Mutlak
      if (idx === 0 && p.type === 'B') {
          if (p.hours >= 15 * 24) {
              pushDetail(detailsArr, p.hours, 'Suci (Jeda Wiladah)');
              globalTimeAcc += p.hours;
              loopState = 'SUCI';
              suciAcc = p.hours;
              activeTargetNifas = 0; // Nifas gugur
              pLeft = 0;
          }
      }

      if (idx === 0 && p.type === 'KD' && loopState === 'NIFAS' && activeTargetNifas <= 0.01) {
          pushDetail(detailsArr, 0.01, 'Nifas (Setetes / Lahdhoh)');
          pLeft -= 0.01; globalTimeAcc += 0.01;
          loopState = 'SUCI'; suciAcc = 0;
          targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
      }

      while (pLeft > 0.01) {
          let consume = 0;
          if (loopState === 'NIFAS') {
              // PERBAIKAN: Hitungan sisa kuota (Adadan) dikurangi nifasAcc yang terus berjalan
              consume = Math.min(pLeft, activeTargetNifas - nifasAcc);
              if (consume > 0) {
                  let label = '';
                  if (p.type === 'KD') {
                      label = !isMustahadhah ? 'Nifas' : nifasLabel;
                  } else {
                      // Jika B berada di awal dan Nifas belum mulai, ini Jeda Wiladah
                      // Jika B di tengah, ini adalah Masa Naqa'
                      label = (nifasAcc === 0) ? 'Suci (Jeda Wiladah)' : 'Nifas (Naqa\')';
                  }
                  pushDetail(detailsArr, consume, label);
                  nifasAcc += consume; // ARGO NIFAS ADADAN TERUS BERJALAN MESKI MASA SUCI
                  pLeft -= consume; 
                  globalTimeAcc += consume;
              }
              // Jika kuota (Adadan) habis, berpindah ke siklus Suci
              if (nifasAcc >= activeTargetNifas) {
                  loopState = 'SUCI'; suciAcc = 0; 
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

              if ((suciAcc >= targetSuci - 0.1 && p.type === 'KD') || (nifasSuciBypassAvailable && p.type === 'KD') || isNormalKDAfter15B) {
                  loopState = 'HAID'; haidAcc = 0;
                  cycleAdatSuci = suciAcc; targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
                  targetHaid = cycleAdatHaid; nifasSuciBypassAvailable = false; hasUsedNifasSeparator = true;     
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
                  suciAcc += consume; pLeft -= consume; globalTimeAcc += consume;
              }
              
              if (suciAcc >= targetSuci - 0.1 && pLeft > 0 && p.type === 'KD') {
                   loopState = 'HAID'; haidAcc = 0;
                   cycleAdatSuci = suciAcc; targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
                   targetHaid = cycleAdatHaid; hasUsedNifasSeparator = true;
              }
          }
          else if (loopState === 'HAID') {
              if (p.type === 'KD' && haidAcc === 0) {
                  let totalRemainingToLastKD = 0;
                  let lastRemainingKDIdx = idx;
                  for (let i = idx; i < periods.length; i++) { if (periods[i].type === 'KD') lastRemainingKDIdx = i; }
                  for (let i = idx; i <= lastRemainingKDIdx; i++) { totalRemainingToLastKD += periods[i].hours; }
                  
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
                      haidAcc += consume; pLeft -= consume; globalTimeAcc += consume;
                  }
                  if (haidAcc >= targetHaid) { 
                      loopState = 'SUCI'; suciAcc = 0; cycleAdatHaid = targetHaid; 
                      targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci; 
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
                      haidAcc += pLeft; globalTimeAcc += pLeft; pLeft = 0; 
                  } else {
                      cycleAdatHaid = haidAcc; targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci; 
                      loopState = 'SUCI'; suciAcc = 0; 
                  }
              }
          }
      }
      
      if (detailsArr.length > 0) {
        breakdown.push({ label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, details: detailsArr });
      }
  });

  return { breakdown, meta };
};