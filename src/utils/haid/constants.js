// src/utils/haid/constants.js
// Semua "angka ajaib" (magic numbers) fiqih haid dikumpulkan di sini
// supaya kalau ada revisi rumus (mis. batas hari), cukup ubah di satu tempat.

export const JAM_PER_HARI = 24;

// Batas maksimal haid = 15 hari
export const MAX_HAID_JAM = 15 * JAM_PER_HARI;

// Batas minimal suci yang memisahkan dua masa haid = 15 hari
export const MIN_SUCI_JAM = 15 * JAM_PER_HARI;

// Batas minimal 1 masa haid yang sah = 1 hari (24 jam)
export const MIN_HAID_JAM = 1 * JAM_PER_HARI;

// Default adat suci bila belum punya adat (mubtada'ah) = 29 hari
export const DEFAULT_ADAT_SUCI_JAM = 29 * JAM_PER_HARI;

// Kode warna "lemah" default kalau tidak diketahui, dipakai di logika tamyiz
export const DEFAULT_WEAK_COLOR = 5;
