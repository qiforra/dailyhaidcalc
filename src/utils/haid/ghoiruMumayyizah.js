// src/utils/haid/ghoiruMumayyizah.js
// Menangani kasus Mustahadhah GHOIRU MUMAYYIZAH (gagal Tamyiz).
// PERBAIKAN: Menghapus blok "Fasad kaku" di awal. Darah < 24 jam di awal 
// tetap dihukumi Haid jika memenuhi syarat Qoul Sahbi.
import { MAX_HAID_JAM, MIN_SUCI_JAM } from './constants';
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

  spanPeriods.forEach((p, idx) => {
    let pLeft = p.hours;
    const detailsArr = [];

    // [DIHAPUS] Blok Fasad kaku yang salah:
    // if (idx === 0 && p.type === 'KD' && p.hours < 24) { ... }
    // Kita biarkan state-machine memprosesnya secara natural.

    while (pLeft > 0.01) {
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
        }

        if (suciAcc >= targetSuci && pLeft > 0 && p.type === 'KD') {
          loopState = 'HAID';
          windowTime = 0;
          haidAcc = 0;
          cycleAdatSuci = suciAcc;
        }
      }

      if (loopState === 'HAID') {
        if (p.type === 'KD' && haidAcc === 0 && windowTime === 0) {
          const { totalContinuousKD, isFirstRealKD, nextB, hasNextKD } = scanContinuousKD(spanPeriods, idx, pLeft);

          if (!isNormalQoul1) {
            // === ATURAN A: AKHIR SIKLUS PANTAS JADI HAID SEMUA ===
            if (!hasNextKD && totalContinuousKD <= MAX_HAID_JAM) {
              targetHaid = totalContinuousKD;
            }
            // === ATURAN B: PELACAK KD + B (TAQOTHU vs TAKMIL) ===
            else if (isFirstRealKD && effectiveStatus === 'mutadah' && totalContinuousKD > cycleAdatHaid && totalContinuousKD <= MAX_HAID_JAM) {
              if (isTaqothuBukanTakmil(totalContinuousKD, nextB)) {
                targetHaid = applyTaqothuPertahankanAdat(cycleAdatHaid).targetHaid;
              } else {
                const hasil = applyTakmilAdatBaru(totalContinuousKD);
                targetHaid = hasil.targetHaid; 
                cycleAdatSuci = hasil.cycleAdatSuci;
              }
            }
            // === DEFAULT KEMBALI KE ADAT ===
            else {
              targetHaid = cycleAdatHaid;
            }
          } else {
            targetHaid = baseHaid;
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
        } else {
          // === LOGIKA QOUL SAHBI (Jeda di tengah Haid) ===
          const { hasKDAfter, timeToNextKD } = scanUntilNextKD(spanPeriods, idx);
          const nextKDStart = haidAcc + pLeft + timeToNextKD;

          if (hasKDAfter && nextKDStart < currentTarget) {
            if (consume > 0) {
              pushDetail(detailsArr, consume, 'Haid (Qoul Sahbi)');
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
          } else {
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