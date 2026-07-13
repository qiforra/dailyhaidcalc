// src/utils/engineNifas.js
import { formatDuration, getColorLabel } from './formatters';

export const analyzeNifasPeriods = (periods, userConfig) => {
  const { userStatus, lupaAdat, adatHaid, adatSuci, adatNifas } = userConfig;

  let breakdown = [];
  const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
  
  const baseHaid = (!Number.isNaN(adatHaid) && adatHaid > 0) ? adatHaid * 24 : 24; 
  const baseSuci = (!Number.isNaN(adatSuci) && adatSuci > 0) ? adatSuci * 24 : (29 * 24); 
  
  // Nifas 'Adadan: Maksimal 60 hari dari kelahiran, atau mengikuti Adat Nifas jika lebih pendek
  const targetNifas = effectiveStatus === 'mutadah' 
    ? Math.min((Number.isNaN(adatNifas) ? 40 : adatNifas) * 24, 60 * 24)
    : 0.01;

  let meta = { isTamyizValid: false, fallbackReason: "", effectiveStatus, caseStatus: "" };
  
  const pushDetail = (arr, hours, label) => {
      if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
  };

  // ==========================================
  // STATE MACHINE 3 FASE
  // ==========================================
  // FASE 1: NIFAS             → Mengisi kuota 'Adadan (max 60 hari)
  // FASE 2: POST_NIFAS_SUCI   → Khusus Mu'tadah. Semua waktu dihukumi Suci/Istihadhah sampai AS terpenuhi
  // FASE 3: CYCLE             → Siklus Haid (AH) ↔ Suci (AS) bergantian
  // ==========================================
  
  let phase = 'NIFAS'; 
  let cycleState = 'HAID'; // 'HAID' | 'SUCI' (aktif saat fase CYCLE)
  
  let nifasAcc = 0;
  let postNifasSuciAcc = 0;
  let cycleHaidAcc = 0;
  let cycleSuciAcc = 0;
  let globalTimeAcc = 0;

  periods.forEach((p, idx) => {
      let pLeft = p.hours;
      let detailsArr = [];

      // ==========================================
      // FASE 1: NIFAS (Mengisi Kuota 'Adadan)
      // ==========================================
      if (phase === 'NIFAS') {
          // Kasus Jeda Wiladah >= 15 Hari di awal → Nifas Gugur Mutlak
          if (nifasAcc === 0 && p.type === 'B' && p.hours >= 15 * 24) {
              pushDetail(detailsArr, p.hours, 'Suci (Jeda Wiladah ≥15 Hari, Nifas Gugur)');
              globalTimeAcc += p.hours;
              phase = 'CYCLE';
              cycleState = 'HAID';
              pLeft = 0;
          } else {
              let remainingNifas = targetNifas - nifasAcc;
              let consume = Math.min(pLeft, remainingNifas);

              if (consume > 0) {
                  if (p.type === 'KD') {
                      pushDetail(detailsArr, consume, 'Nifas');
                  } else {
                      // Jeda B di awal/tengah tetap memotong kuota 'adadan
                      pushDetail(detailsArr, consume, 'Suci (Jeda Wiladah / Nifas \'Adadan)');
                  }
                  nifasAcc += consume;
                  pLeft -= consume;
                  globalTimeAcc += consume;
              }

              // Jika kuota nifas habis → Masuk fase pelunasan Suci (KHUSUS MU'TADAH)
              if (nifasAcc >= targetNifas - 0.01) {
                  if (effectiveStatus === 'mutadah') {
                      phase = 'POST_NIFAS_SUCI';
                      postNifasSuciAcc = 0;
                  } else {
                      phase = 'CYCLE';
                      cycleState = 'HAID';
                      cycleHaidAcc = 0;
                  }
              }
          }
      }

      // ==========================================
      // FASE 2: POST_NIFAS_SUCI (Khusus Mu'tadah)
      // ==========================================
      if (phase === 'POST_NIFAS_SUCI' && pLeft > 0.01) {
          let remainingSuci = baseSuci - postNifasSuciAcc;
          let consume = Math.min(pLeft, remainingSuci);

          // Baik B maupun KD di fase ini dihukumi Suci/Istihadhah sampai AS terpenuhi
          if (consume > 0) {
              pushDetail(detailsArr, consume, 'Suci (Melengkapi Adat Suci)');
              postNifasSuciAcc += consume;
              pLeft -= consume;
              globalTimeAcc += consume;
          }

          // Jika AS sudah lunas → Masuk ke Siklus Normal
          if (postNifasSuciAcc >= baseSuci - 0.01) {
              phase = 'CYCLE';
              cycleState = 'HAID';
              cycleHaidAcc = 0;
              cycleSuciAcc = 0;
          }
      }

      // ==========================================
      // FASE 3: CYCLE (Siklus Haid & Suci Bergantian)
      // ==========================================
      // PERBAIKAN: Gunakan while loop agar satu block KD bisa terpecah ke beberapa fase
      while (phase === 'CYCLE' && pLeft > 0.01) {
          if (cycleState === 'HAID') {
              let needed = baseHaid - cycleHaidAcc;
              let consume = Math.min(pLeft, needed);
              if (consume > 0) {
                  if (p.type === 'KD') {
                      pushDetail(detailsArr, consume, 'Haid');
                  } else {
                      // Jeda B di tengah siklus haid → tetap dihukumi Haid (Tamyiz/Qoul Sahbi)
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

      // Sisa waktu yang tidak masuk pola (Istihadhah murni)
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
    ? `Siklus Mu'tadah (AH ${adatHaid} / AS ${adatSuci})` 
    : phase === 'POST_NIFAS_SUCI'
    ? `Melunasi Adat Suci (${formatDuration(postNifasSuciAcc)} / ${formatDuration(baseSuci)})`
    : 'Perhitungan Nifas';
    
  return { breakdown, meta };
};