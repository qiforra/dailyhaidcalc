// src/utils/engineNifas.js
import { formatDuration, getColorLabel } from './formatters';

export const analyzeNifasPeriods = (periods, userConfig) => {
  const { userStatus, lupaAdat, adatHaid, adatSuci, adatNifas } = userConfig;

  let breakdown = [];
  const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
  
  const baseHaid = (!Number.isNaN(adatHaid) && adatHaid > 0) ? adatHaid * 24 : 24; 
  const baseSuci = (!Number.isNaN(adatSuci) && adatSuci > 0) ? adatSuci * 24 : (29 * 24); 
  
  // Nifas 'Adadan: Maksimal 60 hari dari kelahiran
  const targetNifas = effectiveStatus === 'mutadah' 
    ? Math.min((Number.isNaN(adatNifas) ? 40 : adatNifas) * 24, 60 * 24)
    : 0.01; // Mubtadi'ah = setetes

  let meta = { isTamyizValid: false, fallbackReason: "", effectiveStatus, caseStatus: "" };
  
  const pushDetail = (arr, hours, label) => {
      if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
  };

  // ==========================================
  // STATE MACHINE 3 FASE
  // ==========================================
  // FASE 1: NIFAS             → Mengisi kuota 'Adadan (max 60 hari)
  // FASE 2: POST_NIFAS_SUCI   → WAJIB untuk semua! Melunasi Adat Suci sbg Istihadhah
  // FASE 3: CYCLE             → Siklus Haid (AH) ↔ Suci (AS) bergantian
  // ==========================================
  
  let phase = 'NIFAS'; 
  let cycleState = 'HAID';
  
  let nifasAcc = 0;
  let postNifasSuciAcc = 0;
  let cycleHaidAcc = 0;
  let cycleSuciAcc = 0;
  let globalTimeAcc = 0;

  periods.forEach((p, idx) => {
      let pLeft = p.hours;
      let detailsArr = [];

      // ==========================================
      // FASE 1: NIFAS
      // ==========================================
      if (phase === 'NIFAS') {
          // Jeda Wiladah >= 15 Hari → Nifas Gugur
          if (nifasAcc === 0 && p.type === 'B' && p.hours >= 15 * 24) {
              pushDetail(detailsArr, p.hours, 'Suci (Jeda Wiladah ≥15 Hari, Nifas Gugur)');
              globalTimeAcc += p.hours;
              phase = 'POST_NIFAS_SUCI'; // Langsung ke pelunasan AS
              postNifasSuciAcc = 0;
              pLeft = 0;
          } else {
              let remainingNifas = targetNifas - nifasAcc;
              let consume = Math.min(pLeft, remainingNifas);

              if (consume > 0) {
                  if (p.type === 'KD') {
                      pushDetail(detailsArr, consume, 'Nifas');
                  } else {
                      pushDetail(detailsArr, consume, 'Suci (Jeda Wiladah / Nifas \'Adadan)');
                  }
                  nifasAcc += consume;
                  pLeft -= consume;
                  globalTimeAcc += consume;
              }

              // Jika kuota nifas habis → WAJIB masuk fase POST_NIFAS_SUCI
              if (nifasAcc >= targetNifas - 0.01 && pLeft > 0.01) {
                  phase = 'POST_NIFAS_SUCI';
                  postNifasSuciAcc = 0;
              } else if (nifasAcc >= targetNifas - 0.01 && pLeft <= 0.01) {
                  phase = 'POST_NIFAS_SUCI';
                  postNifasSuciAcc = 0;
              }
          }
      }

      // ==========================================
      // FASE 2: POST_NIFAS_SUCI (WAJIB UNTUK SEMUA)
      // ==========================================
      if (phase === 'POST_NIFAS_SUCI' && pLeft > 0.01) {
          let remainingSuci = baseSuci - postNifasSuciAcc;
          let consume = Math.min(pLeft, remainingSuci);

          if (consume > 0) {
              // Semua waktu di fase ini adalah Istihadhah/Suci untuk melunasi AS
              pushDetail(detailsArr, consume, 'Istihadhah (Melengkapi Adat Suci)');
              postNifasSuciAcc += consume;
              pLeft -= consume;
              globalTimeAcc += consume;
          }

          // Jika AS sudah lunas → Baru masuk Siklus Haid
          if (postNifasSuciAcc >= baseSuci - 0.01) {
              phase = 'CYCLE';
              cycleState = 'HAID';
              cycleHaidAcc = 0;
              cycleSuciAcc = 0;
          }
      }

      // ==========================================
      // FASE 3: CYCLE
      // ==========================================
      while (phase === 'CYCLE' && pLeft > 0.01) {
          if (cycleState === 'HAID') {
              let needed = baseHaid - cycleHaidAcc;
              let consume = Math.min(pLeft, needed);
              if (consume > 0) {
                  if (p.type === 'KD') {
                      pushDetail(detailsArr, consume, 'Haid');
                  } else {
                      pushDetail(detailsArr, consume, 'Haid (Jeda < 15 Hari)');
                  }
                  cycleHaidAcc += consume;
                  pLeft -= consume;
                  globalTimeAcc += consume;
              }
              if (cycleHaidAcc >= baseHaid - 0.01) {
                  cycleState = 'SUCI';
                  cycleSuciAcc = 0;
              }
          } else if (cycleState === 'SUCI') {
              let needed = baseSuci - cycleSuciAcc;
              let consume = Math.min(pLeft, needed);
              if (consume > 0) {
                  if (p.type === 'B') {
                      pushDetail(detailsArr, consume, 'Suci');
                  } else {
                      pushDetail(detailsArr, consume, 'Istihadhah');
                  }
                  cycleSuciAcc += consume;
                  pLeft -= consume;
                  globalTimeAcc += consume;
              }
              if (cycleSuciAcc >= baseSuci - 0.01) {
                  cycleState = 'HAID';
                  cycleHaidAcc = 0;
              }
          }
      }

      // Sisa waktu di luar pola
      if (pLeft > 0.01) {
          pushDetail(detailsArr, pLeft, 'Istihadhah');
          globalTimeAcc += pLeft;
      }

      if (detailsArr.length > 0) {
          breakdown.push({ 
              label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, 
              details: detailsArr 
          });
      }
  });

  meta.caseStatus = phase === 'CYCLE' 
    ? `Siklus Haid (AH ${adatHaid} / AS ${adatSuci})` 
    : phase === 'POST_NIFAS_SUCI'
    ? `Melunasi Adat Suci (${formatDuration(postNifasSuciAcc)} / ${formatDuration(baseSuci)})`
    : 'Perhitungan Nifas';
    
  return { breakdown, meta };
};
