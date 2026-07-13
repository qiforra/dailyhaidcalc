// src/utils/haid/takmil.js
// RUMUS TAKMIL (menyempurnakan / membentuk ADAT BARU) untuk kasus Ghoiru Mumayyizah
// (tidak bisa dibedakan lewat warna darah) yang mengalami Taqothu' (darah terputus-putus).
//
// Ada 2 tempat "Takmil" dipakai dalam mesin ini:
//  1) Saat menentukan target SUCI: jika (haid terakhir + suci berjalan) sudah >= 15 hari,
//     maka suci itu dianggap "sempurna" (takmil) sehingga target suci = 15 hari genap.
//  2) Saat menentukan target HAID pada rangkaian KD baru (Aturan B): jika KD+B berikutnya
//     mencapai >= 15 hari, KD ini dianggap sah membentuk ADAT BARU (takmil adat),
//     sehingga adat suci ikut di-set ulang jadi 15 hari.

import { MIN_SUCI_JAM } from './constants';

// (1) Menentukan apakah kondisi saat ini memenuhi syarat Takmil untuk target SUCI.
// lastHaidDuration : durasi haid sebelumnya (jam)
// suciAcc          : akumulasi suci yang sudah berjalan pada masa ini (jam)
// isTaqothuActive  : true jika rangkaian ini sudah pernah tercatat taqothu' sebelumnya
export const isSuciTakmil = (lastHaidDuration, suciAcc, isTaqothuActive) => {
  return (lastHaidDuration + suciAcc) >= MIN_SUCI_JAM && !isTaqothuActive;
};

// Target suci ketika Takmil terpenuhi: selalu digenapkan 15 hari.
export const getTakmilSuciTarget = () => MIN_SUCI_JAM;

// (2) Aturan B - cabang Takmil: KD yang menyambung (totalContinuousKD) + suci (nextB)
// berikutnya sudah cukup (>= 15 hari), sehingga sah membentuk Adat Haid & Adat Suci baru.
// Mengembalikan { targetHaid, cycleAdatSuci } yang baru.
export const applyTakmilAdatBaru = (totalContinuousKD) => {
  return {
    targetHaid: totalContinuousKD,
    cycleAdatSuci: MIN_SUCI_JAM,
  };
};
