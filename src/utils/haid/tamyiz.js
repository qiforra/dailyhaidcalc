// src/utils/haid/tamyiz.js
import { MAX_HAID_JAM, MIN_HAID_JAM, MIN_SUCI_JAM, DEFAULT_WEAK_COLOR } from './constants';

export const hasDistinctColors = (spanPeriods) => {
  const kdColors = spanPeriods.filter((p) => p.type === 'KD').map((p) => p.color);
  const uniqueColors = new Set(kdColors.filter((c) => c !== null));
  return uniqueColors.size >= 2;
};

export const evaluateTamyiz = (spanPeriods) => {
  if (!hasDistinctColors(spanPeriods)) {
    return { isTamyizValid: false, fallbackReason: 'Ghoiru Mumayyizah: Tidak ada pembedaan sifat darah.', tamyizSpans: [] };
  }

  // Cari warna darah paling kuat secara mutlak (angka paling kecil)
  const allKdColors = spanPeriods.filter((p) => p.type === 'KD').map((p) => p.color || DEFAULT_WEAK_COLOR);
  const absoluteStrongestColor = Math.min(...allKdColors);
  const tamyizSpans = [];

  let currentHaidAcc = 0;
  let currentWeakAcc = 0;
  let isSearchingHaid = true;
  let foundStrongest = false;

  spanPeriods.forEach((p, idx) => {
    if (isSearchingHaid) {
      if (p.type === 'KD') {
        const pColor = p.color || DEFAULT_WEAK_COLOR;
        
        if (!foundStrongest) {
          if (pColor === absoluteStrongestColor) {
            foundStrongest = true;
            if (p.hours > MAX_HAID_JAM) {
              tamyizSpans.push({ id: idx, type: 'HAID', hours: MAX_HAID_JAM, color: pColor });
              tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours - MAX_HAID_JAM, color: pColor });
              currentHaidAcc = MAX_HAID_JAM;
              isSearchingHaid = false;
              currentWeakAcc = p.hours - MAX_HAID_JAM;
            } else {
              currentHaidAcc = p.hours;
              tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
            }
          } else {
            tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
          }
        } else {
          // Hanya warna yang SETARA dengan yang terkuat yang bisa terus menyambung sebagai Haid
          if (pColor === absoluteStrongestColor) {
            if (currentHaidAcc + p.hours <= MAX_HAID_JAM) {
              currentHaidAcc += p.hours;
              tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
            } else {
              const allowed = MAX_HAID_JAM - currentHaidAcc;
              if (allowed > 0) tamyizSpans.push({ id: idx, type: 'HAID', hours: allowed, color: pColor });
              const excess = p.hours - allowed;
              isSearchingHaid = false;
              currentWeakAcc = excess;
              tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: excess, color: pColor });
            }
          } else {
            // Jika warna darah LEBIH LEMAH dari yang terkuat, hentikan pencarian Haid dan mulai susun darah lemah (Istihadhoh)
            isSearchingHaid = false;
            currentWeakAcc = p.hours;
            tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
          }
        }
      } else if (p.type === 'B') {
        let nextKDHours = 0;
        let nextKDColor = DEFAULT_WEAK_COLOR;
        let lookAheadIdx = idx + 1;
        while (lookAheadIdx < spanPeriods.length && spanPeriods[lookAheadIdx].type === 'B') lookAheadIdx++;
        
        if (lookAheadIdx < spanPeriods.length && spanPeriods[lookAheadIdx].type === 'KD') {
          nextKDHours = spanPeriods[lookAheadIdx].hours;
          nextKDColor = spanPeriods[lookAheadIdx].color || DEFAULT_WEAK_COLOR;
        }

        const isSandwiched = (currentHaidAcc > 0) && (nextKDHours > 0) && (nextKDColor === absoluteStrongestColor) && (currentHaidAcc + p.hours + nextKDHours <= MAX_HAID_JAM);
        
        if (isSandwiched) {
          currentHaidAcc += p.hours;
          tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours });
        } else {
          isSearchingHaid = false;
          currentWeakAcc = p.hours;
          tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours });
        }
      }
    } else {
      // STATE: MENCARI PEMISAH 15 HARI
      if (p.type === 'B') {
        currentWeakAcc += p.hours;
        tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours });
      } else if (p.type === 'KD') {
        const pColor = p.color || DEFAULT_WEAK_COLOR;
        
        // Cek apakah akumulasi darah lemah/jeda bersih sudah genap 15 hari
        if (currentWeakAcc >= MIN_SUCI_JAM) {
          if (pColor === absoluteStrongestColor) {
            // Darah kuat datang LAGI setelah dipisah 15 hari -> HAID BARU DIMULAI
            isSearchingHaid = true;
            foundStrongest = true;
            currentWeakAcc = 0;
            if (p.hours > MAX_HAID_JAM) {
              tamyizSpans.push({ id: idx, type: 'HAID', hours: MAX_HAID_JAM, color: pColor });
              tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours - MAX_HAID_JAM, color: pColor });
              currentHaidAcc = MAX_HAID_JAM;
              isSearchingHaid = false;
              currentWeakAcc = p.hours - MAX_HAID_JAM;
            } else {
              currentHaidAcc = p.hours;
              tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
            }
          } else {
            currentWeakAcc += p.hours;
            tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
          }
        } else {
          // Jika darah kuat datang sebelum 15 hari pemisah genap, ia HANCUR statusnya jadi Istihadhoh
          currentWeakAcc += p.hours;
          tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
        }
      }
    }
  });

  // Grouping hasil
  const groupedTamyiz = [];
  tamyizSpans.forEach((ts) => {
    const last = groupedTamyiz[groupedTamyiz.length - 1];
    if (last && last.type === ts.type) last.hours += ts.hours;
    else groupedTamyiz.push({ type: ts.type, hours: ts.hours });
  });

  const hasValidHaid = groupedTamyiz.some((ts) => ts.type === 'HAID' && ts.hours >= MIN_HAID_JAM && ts.hours <= MAX_HAID_JAM);
  const hasValidSuci = groupedTamyiz.some((ts) => ts.type === 'ISTIHADHOH' && ts.hours >= MIN_SUCI_JAM);
  const endsWithIstihadhoh = groupedTamyiz.length > 0 && groupedTamyiz[groupedTamyiz.length - 1].type === 'ISTIHADHOH';
  
  const isTamyizValid = hasValidHaid && (hasValidSuci || endsWithIstihadhoh);
  const fallbackReason = isTamyizValid ? '' : 'Gagal memenuhi syarat Tamyiz.';

  return { isTamyizValid, fallbackReason, tamyizSpans };
};
