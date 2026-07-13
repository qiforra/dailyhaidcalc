// src/utils/haid/taqothu.js
// RUMUS TAQOTHU' (darah yang terputus-putus / tidak bersambung) untuk kasus
// Ghoiru Mumayyizah (gagal tamyiz). Di sini adat lama (cycleAdatHaid/cycleAdatSuci)
// dipertahankan sebagai acuan, KECUALI ada pola yang justru memenuhi syarat Takmil
// (lihat takmil.js) sehingga membentuk adat baru.
//
// Ada 2 tempat "Taqothu'" dipakai dalam mesin ini:
//  1) Saat menentukan target SUCI: jika belum genap 15 hari suci (belum takmil),
//     target suci kembali mengacu ke adat suci siklus (cycleAdatSuci), minimal 15 hari.
//  2) Saat menentukan target HAID pada rangkaian KD baru (Aturan B): jika KD+B berikutnya
//     BELUM cukup 15 hari, maka KD ini tidak boleh mematahkan adat -> target haid tetap
//     mengikuti adat lama (cycleAdatHaid).

import { MIN_SUCI_JAM } from './constants';

// (1) Target suci ketika kondisi Taqothu' (bukan Takmil): kembali ke adat suci siklus,
// tapi tidak boleh kurang dari 15 hari (batas minimal suci).
export const getTaqothuSuciTarget = (cycleAdatSuci) => {
  return cycleAdatSuci < MIN_SUCI_JAM ? MIN_SUCI_JAM : cycleAdatSuci;
};

// (2) Aturan B - cabang Taqothu': KD+suci berikutnya belum cukup 15 hari, sehingga
// haram mematahkan adat -> target haid tetap ikut adat lama.
export const applyTaqothuPertahankanAdat = (cycleAdatHaid) => {
  return { targetHaid: cycleAdatHaid };
};

// Mengecek apakah kombinasi totalContinuousKD + nextB sudah cukup untuk Takmil (>=15 hari)
// atau belum (berarti Taqothu'). Dipakai bersama takmil.applyTakmilAdatBaru /
// taqothu.applyTaqothuPertahankanAdat di dalam engine.js (Aturan B).
export const isTaqothuBukanTakmil = (totalContinuousKD, nextB) => {
  return (totalContinuousKD + nextB) < MIN_SUCI_JAM;
};
