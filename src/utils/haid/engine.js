// src/utils/haid/engine.js
import { formatDuration } from '../formatters';
import { MAX_HAID_JAM, MIN_SUCI_JAM, DEFAULT_ADAT_SUCI_JAM } from './constants';
import { splitIntoSpans, pushDetail, buildPeriodLabel } from './helpers';
import { evaluateTamyiz } from './tamyiz';
import { formatTamyizResult } from './tamyizFormatter';
import { resolveGhoiruMumayyizah } from './ghoiruMumayyizah';

export const analyzeHaidPeriods = (periods, qoulMode, userConfig) => {
  const { userStatus, lupaAdat, adatHaid, adatSuci } = userConfig;
  const breakdown = [];
  const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
  const baseHaid = effectiveStatus === 'mutadah' ? (Number.isNaN(adatHaid) ? 0 : adatHaid * 24) : 24;
  const baseSuci = effectiveStatus === 'mutadah' ? (Number.isNaN(adatSuci) ? 0 : adatSuci * 24) : DEFAULT_ADAT_SUCI_JAM;
  const isNormalQoul1 = qoulMode === 'QOUL_1';

  let cycleAdatHaid = baseHaid;
  let cycleAdatSuci = baseSuci;
  const spans = splitIntoSpans(periods);

  const meta = {
    isTamyizValid: false, fallbackReason: '', effectiveStatus,
    adatUpdates: [], hasTakmil: false, caseStatus: '',
  };

  spans.forEach((span) => {
    // --- 1. PEMISAH BERSIH (JEDA >= 15 HARI) ---
    if (span.isGap) {
      breakdown.push({ label: `B ${formatDuration(span.period.hours)}`, details: [`${formatDuration(span.period.hours)} Suci`] });
      cycleAdatSuci = span.period.hours;
      return;
    }

    // --- 2. HAID NORMAL (TOTAL < 15 HARI) ---
    const isMustahadhah = span.duration > MAX_HAID_JAM;
    if (!isMustahadhah) {
      span.periods.forEach((p) => {
        const detailsArr = [];
        if (p.type === 'KD') pushDetail(detailsArr, p.hours, 'Haid');
        else pushDetail(detailsArr, p.hours, 'Haid (Qoul Sahbi)');
        breakdown.push({ label: buildPeriodLabel(p), details: detailsArr });
      });
      cycleAdatHaid = span.duration;
      meta.caseStatus = 'Haid Normal (Di Bawah 15 Hari)';
      return;
    }

    // --- 3. MUSTHADDHAH (> 15 HARI) ---
    let kd1Hours = 0, b1Hours = 0;
    const firstKdIdx = span.periods.findIndex(p => p.type === 'KD');
    if (firstKdIdx !== -1) {
      kd1Hours = span.periods[firstKdIdx].hours;
      if (span.periods[firstKdIdx + 1]?.type === 'B') b1Hours = span.periods[firstKdIdx + 1].hours;
    }
    const isTakmilDirect = (kd1Hours + b1Hours) >= MIN_SUCI_JAM;

    let tamyizValid = false, tamyizSpansResult = [];
    if (isTakmilDirect) {
      meta.isTamyizValid = false;
      meta.fallbackReason = 'Bypass Tamyiz: Rangkaian KD1 + B1 >= 15 hari langsung diarahkan ke rumus Takmil.';
    } else {
      const { isTamyizValid, fallbackReason, tamyizSpans } = evaluateTamyiz(span.periods);
      meta.isTamyizValid = isTamyizValid;
      meta.fallbackReason = fallbackReason;
      tamyizValid = isTamyizValid;
      tamyizSpansResult = tamyizSpans;
    }

    // --- CABANG A: TAMYIZ BERHASIL (MUMAYYIZAH) ---
    if (tamyizValid) {
      const { breakdownItems, cycleAdatHaid: newCycleAdatHaid } = formatTamyizResult(
        span.periods,
        tamyizSpansResult,
        cycleAdatHaid
      );
      
      breakdown.push(...breakdownItems);
      cycleAdatHaid = newCycleAdatHaid;
      meta.caseStatus = userStatus === 'mutadah' ? "Mu'tadah Mumayyizah" : "Mubtada'ah Mumayyizah";
      
      return; // PENTING: Stop di sini, jangan lanjut ke Ghoiru Mumayyizah!
    }

    // --- CABANG B: TAMYIZ GAGAL (GHOIRU MUMAYYIZAH) ---
    const result = resolveGhoiruMumayyizah(span.periods, { 
      cycleAdatHaid, 
      cycleAdatSuci, 
      baseHaid, 
      effectiveStatus, 
      isNormalQoul1 
    });

    breakdown.push(...result.breakdownItems);
    cycleAdatHaid = result.cycleAdatHaid;
    cycleAdatSuci = result.cycleAdatSuci;
    meta.hasTakmil = meta.hasTakmil || result.hasTakmil;

    if (result.isTaqothuActive) {
      meta.caseStatus = userStatus === 'mutadah' ? "Taqothu' Mu'tadah Ghoiru Mumayyizah" : "Taqothu' Mubtada'ah Ghoiru Mumayyizah";
    } else {
      meta.caseStatus = 'Takmilatut Thuhri';
    }
  });

  return { breakdown, meta };
};