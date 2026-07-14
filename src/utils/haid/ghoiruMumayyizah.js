// src/utils/haid/ghoiruMumayyizah.js
import { MAX_HAID_JAM, MIN_SUCI_JAM, MIN_HAID_JAM } from './constants';
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
          isTaqothuActive = false; // Reset Taqothu' jika suci sudah mencapai target
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
          isTaqothuActive = false;
        }

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
        
        // --- EVALUASI AWAL KD (TARGET & TAKMIL/TAQOTHU') ---
        if (p.type === 'KD' && haidAcc === 0 && windowTime === 0) {
          const { totalContinuousKD, isFirstRealKD, nextB, hasNextKD } = scanContinuousKD(spanPeriods, idx, pLeft);
          
          if (!isNormalQoul1) {
            if (!hasNextKD && totalContinuousKD <= MAX_HAID_JAM) {
              targetHaid = totalContinuousKD;
            }
            else if (isFirstRealKD && effectiveStatus === 'mutadah' && totalContinuousKD > cycleAdatHaid && totalContinuousKD <= MAX_HAID_JAM) {
              
              // 🚩 PERBAIKAN KRUNSIAL 1: TAKMIL HANYA BISA DI AWAL (TIDAK BISA SETELAH TAQOTHU')
              // Jika isTaqothuActive = true (berarti jeda bersih sebelumnya < 15 hari), 
              // maka HARAM membentuk Adat Baru (Takmil). Wajib pertahankan Adat Lama.
              if (isTaqothuActive) {
                targetHaid = applyTaqothuPertahankanAdat(cycleAdatHaid).targetHaid;
              } else {
                // Jika bukan Taqothu', baru cek apakah memenuhi syarat Takmil (KD + B >= 15)
                if (isTaqothuBukanTakmil(totalContinuousKD, nextB)) {
                  targetHaid = applyTaqothuPertahankanAdat(cycleAdatHaid).targetHaid;
                } else {
                  const hasil = applyTakmilAdatBaru(totalContinuousKD);
                  targetHaid = hasil.targetHaid; 
                  cycleAdatSuci = hasil.cycleAdatSuci;
                }
              }
            }
            else {
              targetHaid = cycleAdatHaid;
            }
          } else {
            targetHaid = baseHaid;
          }

          const currentTarget = targetHaid;

          // Logika Dam Muthatorrif (Haid Mundur)
          if (p.hours < MIN_HAID_JAM) {
            const { hasKDAfter, timeToNextKD } = scanUntilNextKD(spanPeriods, idx);
            if (hasKDAfter) {
              let nextKdIdx = idx + 1;
              while(nextKdIdx < spanPeriods.length && spanPeriods[nextKdIdx].type !== 'KD') nextKdIdx++;
              const nextKdHours = spanPeriods[nextKdIdx].hours;
              
              const kd1PlusB = p.hours + timeToNextKD;
              const canNyaplok = kd1PlusB < currentTarget; 
              const isValidNextKD = nextKdHours >= MIN_HAID_JAM && nextKdHours <= MAX_HAID_JAM;

              if (!canNyaplok && isValidNextKD) {
                isMundurGap = true;
                loopState = 'SUCI';
                suciAcc = 0;
                haidAcc = 0;
                continue;
              }
              
              if (!canNyaplok && !isValidNextKD) {
                loopState = 'SUCI';
                suciAcc = 0;
                haidAcc = 0;
                continue;
              }
            } else {
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
        
        // --- LOGIKA JEDA B (QOUL SAHBI) ---
        else if (p.type === 'B') {
          const { hasKDAfter } = scanUntilNextKD(spanPeriods, idx);
          
          // Cari durasi pasti dari KD selanjutnya
          let nextKDHours = 0;
          if (hasKDAfter) {
            let nextIdx = idx + 1;
            while(nextIdx < spanPeriods.length && spanPeriods[nextIdx].type !== 'KD') nextIdx++;
            if (nextIdx < spanPeriods.length) nextKDHours = spanPeriods[nextIdx].hours;
          }

          // 🚩 PERBAIKAN KRUSIAL 2: SYARAT SAH QOUL SAHBI
          // Sahbi HANYA sah jika B benar-benar "diapit" oleh 2 darah yang membentuk 
          // satu kesatuan Haid (Total: HaidAcc + B + KD Berikutnya <= 15 hari).
          // Jika melebihi 15 hari, atau target haid sudah tercapai sebelum B, maka B = SUCI.
          const totalPotential = haidAcc + pLeft + nextKDHours;
          const isSandwichedValid = hasKDAfter && totalPotential <= MAX_HAID_JAM && haidAcc < currentTarget;

          if (isSandwichedValid) {
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
            // Tidak memenuhi syarat Sahbi. Akhiri state HAID, sisa B akan diproses sebagai SUCI.
            lastHaidDuration = haidAcc;
            loopState = 'SUCI';
            suciAcc = 0;
            if (!isNormalQoul1) cycleAdatHaid = haidAcc;
            targetSuci = getTaqothuSuciTarget(cycleAdatSuci);
            continue;
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
