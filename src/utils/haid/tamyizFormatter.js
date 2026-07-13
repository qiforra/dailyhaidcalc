// src/utils/haid/tamyizFormatter.js
// FORMATTER untuk hasil Tamyiz. 
// Tugasnya hanya memetakan hasil vonis dari tamyiz.js ke format UI (breakdown) 
// dan menghitung Adat Haid baru. TIDAK ADA logika fiqih di sini.
import { pushDetail, buildPeriodLabel } from './helpers';

export const formatTamyizResult = (spanPeriods, tamyizSpans, fallbackCycleAdatHaid) => {
  const breakdownItems = [];

  // 1. Petakan hasil Tamyiz ke breakdown untuk ditampilkan di tabel
  spanPeriods.forEach((p, idx) => {
    const tsMatch = tamyizSpans.filter((ts) => ts.id === idx);
    const detailsArr = [];
    
    tsMatch.forEach((ts) => {
      // Jika Tamyiz bilang HAID, maka HAID. Jika ISTIHADHOH, maka ISTIHADHOH.
      const label = ts.type === 'HAID' ? 'Haid (Tamyiz)' : 'Istihadhoh';
      pushDetail(detailsArr, ts.hours, label);
    });

    // Jika tidak ada match (misal periode B / jeda bersih), tetap tampilkan sebagai Suci
    if (tsMatch.length === 0 && p.type === 'B') {
      pushDetail(detailsArr, p.hours, 'Suci');
    }

    breakdownItems.push({ label: buildPeriodLabel(p), details: detailsArr });
  });

  // 2. Hitung Adat Haid baru dari total durasi Haid yang ditemukan Tamyiz
  const totalHaidHours = tamyizSpans
    .filter((ts) => ts.type === 'HAID')
    .reduce((acc, ts) => acc + ts.hours, 0);
  
  const newCycleAdatHaid = totalHaidHours > 0 ? totalHaidHours : fallbackCycleAdatHaid;

  return { breakdownItems, cycleAdatHaid: newCycleAdatHaid };
};