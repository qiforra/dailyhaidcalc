// src/utils/haid/ghoiruMumayyizah.js
import { MAX_HAID_JAM, MIN_SUCI_JAM, MIN_HAID_JAM } from './constants'; // Pastikan MIN_HAID_JAM di-import
import { pushDetail, buildPeriodLabel, scanContinuousKD, scanUntilNextKD } from './helpers';
import { isSuciTakmil, getTakmilSuciTarget, applyTakmilAdatBaru } from './takmil';
import { getTaqothuSuciTarget, applyTaqothuPertahankanAdat, isTaqothuBukanTakmil } from './taqothu';

export const resolveGhoiruMumayyizah = (spanPeriods, ctx) => {
  let { cycleAdatHaid, cycleAdatSuci, baseHaid, effectiveStatus, isNormalQoul1 } = ctx;
  const breakdownItems = [];
  let hasTakmil = false;
  
  let loopState = 'HAID';
  let targetHaid = cycleAdatHaid;
  let targetSuci = getTaqothuSuciTarget(cycleAdatSuci);
  let haidAcc = 0;
  let suciAcc = 0;
  let windowTime = 0;
  let lastHaidDuration = 0;
  let isTaqothuActive = false;
  
  // 🚩 FLAG KHUSUS: Menandai bahwa kita sedang dalam jeda bersih kasus "Haid Mundur"
  let isMundurGap = false; 

  spanPeriods.forEach((p, idx) => {
    let pLeft = p.hours;
    const detailsArr = [];

    while (pLeft > 0.01) {
      
      // ==========================================
      // STATE: SUCI
      // ==========================================
      if (loopState === 'SUCI') {
        if (p.type === 'KD') {
          const takmilTerpenuhi = isSuciTakmil(lastHaidDuration, suciAcc, isTaqothuActive);
          if (takmilTerpenuhi) {
            targetSuci = getTakmilSuciTarget();
          } else {
            targetSuci = getTaqothuSuciTarget(cycleAdatSuci);
          }
        }

        if (suciAcc >= targetSuci && p.type === 'KD') {
          loopState = 'HAID';
          windowTime = 0;
          haidAcc = 0;
          cycleAdatSuci = suciAcc;
          continue; 
        }

        const limit = p.type === 'B' ? pLeft : Math.max(0, targetSuci - suciAcc);
        const consume = Math.min(pLeft, limit);

        if (consume > 0) {
          const label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
          if (p.type === 'KD') {
            isTaqothuActive = true;
            if (suciAcc < MIN_SUCI_JAM) hasTakmil = true;
          }
          pushDetail(detailsArr, consume, label);
          suciAcc += consume;
          pLeft -= consume;

          if (p.type === 'B' && suciAcc >= MIN_SUCI_JAM) {
              isTaqothuActive = false;
          }
        }

        if (suciAcc >= targetSuci && pLeft > 0 && p.type === 'KD') {
          loopState = 'HAID';
          windowTime = 0;
          haidAcc = 0;
          cycleAdatSuci = suciAcc;
        }

        // 🚩 LOGIKA TRANSISI MUNDUR: Jika jeda B pada kasus Mundur selesai, 
        // paksa masuk ke state HAID untuk KD berikutnya.
        if (p.type === 'B' && isMundurGap && pLeft <= 0.01) {
          loopState = 'HAID';
          haidAcc = 0;
          isMundurGap = false;
        }
      }

      // ==========================================
      // STATE: HAID
      // ==========================================
      if (loopState === 'HAID') {
        
        // --- EVALUASI AWAL KD (TARGET & DAM MUTHATORRIF) ---
        if (p.type === 'KD' && haidAcc === 0 && windowTime === 0) {
          const { totalContinuousKD, isFirstRealKD, nextB, hasNextKD } = scanContinuousKD(spanPeriods, idx, pLeft);
          
          if (!isNormalQoul1) {
            if (!hasNextKD && totalContinuousKD <= MAX_HAID_JAM) {
              targetHaid = totalContinuousKD;
            }
            else if (isFirstRealKD && effectiveStatus === 'mutadah' && totalContinuousKD > cycleAdatHaid && totalContinuousKD <= MAX_HAID_JAM) {
              if (isTaqothuBukanTakmil(totalContinuousKD, nextB)) {
                targetHaid = applyTaqothuPertahankanAdat(cycleAdatHaid).targetHaid;
              } else {
                const hasil = applyTakmilAdatBaru(totalContinuousKD);
                targetHaid = hasil.targetHaid; 
                cycleAdatSuci = hasil.cycleAdatSuci;
              }
            }
            else {
              targetHaid = cycleAdatHaid;
            }
          } else {
            targetHaid = baseHaid;
          }

          const currentTarget = targetHaid;

          // 🚩 LOGIKA DAM MUTHATORRIF (LOOKAHEAD)
          // Jika darah pertama < 24 jam, cek apakah bisa nyaplok atau harus mundur
          if (p.hours < MIN_HAID_JAM) {
            const { hasKDAfter, timeToNextKD } = scanUntilNextKD(spanPeriods, idx);
            if (hasKDAfter) {
              let nextKdIdx = idx + 1;
              while(nextKdIdx < spanPeriods.length && spanPeriods[nextKdIdx].type !== 'KD') nextKdIdx++;
              const nextKdHours = spanPeriods[nextKdIdx].hours;
              
              // KUNCI UTAMA: KD1 bisa nyaplok HANYA JIKA (KD1 + B) < targetHaid.
              // Jika (KD1 + B) >= targetHaid, berarti jeda bersih sudah melebihi adat.
              const kd1PlusB = p.hours + timeToNextKD;
              const canNyaplok = kd1PlusB < currentTarget; 
              const isValidNextKD = nextKdHours >= MIN_HAID_JAM && nextKdHours <= MAX_HAID_JAM;

              // KASUS MUNDUR: KD1 tidak bisa nyaplok, TAPI KD2 sah jadi haid.
              if (!canNyaplok && isValidNextKD) {
                isMundurGap = true;
                loopState = 'SUCI';
                suciAcc = 0;
                haidAcc = 0;
                continue; // KD1 akan diproses ulang di state SUCI -> otomatis jadi Istihadhoh
              }
              
              // Jika tidak bisa nyaplok DAN KD2 juga tidak valid, KD1 otomatis jadi Isti
              if (!canNyaplok && !isValidNextKD) {
                loopState = 'SUCI';
                suciAcc = 0;
                haidAcc = 0;
                continue;
              }
            } else {
              // Tidak ada KD berikutnya. KD < 24 jam sendirian haram jadi Haid.
              loopState = 'SUCI';
              suciAcc = 0;
              haidAcc = 0;
              continue;
            }
          }
        }

        const currentTarget = targetHaid;
        const consume = Math.min(pLeft, currentTarget - haidAcc);

        if (p.type === 'KD') {
          if (consume > 0) {
            const label = isNormalQoul1 ? ' (Adat Asal)' : '';
            pushDetail(detailsArr, consume, `Haid${label}`);
            haidAcc += consume;
            pLeft -= consume;
          }
          if (haidAcc >= currentTarget) {
            lastHaidDuration = haidAcc;
            loopState = 'SUCI';
            suciAcc = 0;
            if (!isNormalQoul1) cycleAdatHaid = currentTarget;
            targetSuci = getTaqothuSuciTarget(cycleAdatSuci);
          }
        } 
        
        // --- LOGIKA JEDA B (QOUL SAHBI / NYAPLOK) ---
        else if (p.type === 'B') {
          const { hasKDAfter } = scanUntilNextKD(spanPeriods, idx);
          
          // 🚩 PERBAIKAN LOGIKA NYAPLOK: 
          // Selama masih ada KD setelahnya DAN kita belum mencapai target haid, 
          // maka B WAJIB dikonsumsi sebagai Haid (Sahbi) untuk menyambung darah.
          if (hasKDAfter && haidAcc < currentTarget) {
            const needed = currentTarget - haidAcc;
            const bConsume = Math.min(pLeft, needed);
            
            if (bConsume > 0) {
              pushDetail(detailsArr, bConsume, 'Haid (Qoul Sahbi)');
              haidAcc += bConsume;
              pLeft -= bConsume;
            }
            if (haidAcc >= currentTarget) {
              lastHaidDuration = haidAcc;
              loopState = 'SUCI';
              suciAcc = 0;
              if (!isNormalQoul1) cycleAdatHaid = currentTarget;
              targetSuci = getTaqothuSuciTarget(cycleAdatSuci);
            }
          } else {
            // Tidak bisa nyaplok (tidak ada KD setelahnya) atau target sudah tercapai.
            lastHaidDuration = haidAcc;
            loopState = 'SUCI';
            suciAcc = 0;
            if (!isNormalQoul1) cycleAdatHaid = haidAcc;
            targetSuci = getTaqothuSuciTarget(cycleAdatSuci);
            // Sisa pLeft akan otomatis diproses di iterasi while berikutnya sebagai SUCI
          }
        }
      }
    }
    breakdownItems.push({ label: buildPeriodLabel(p), details: detailsArr });
  });

  return {
    breakdownItems,
    cycleAdatHaid,
    cycleAdatSuci,
    isTaqothuActive,
    hasTakmil,
  };
};
