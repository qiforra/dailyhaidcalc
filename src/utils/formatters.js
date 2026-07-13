// src/utils/formatters.js
export const msToHours = (ms) => ms / (1000 * 60 * 60);

export const formatDuration = (hours) => {
  if (!hours || hours <= 0) return '0 jam';
  
  // Konversi semuanya ke menit dasar agar akurat
  const totalMinutes = Math.round(hours * 60);
  
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const remainingMinutes = totalMinutes % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days} hari`);
  if (remainingHours > 0) parts.push(`${remainingHours} jam`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} menit`);
  
  return parts.join(' ') || '0 jam';
};

export const getColorLabel = (color) => {
  switch (color) {
    case 1: return 'Hitam (Kuat)';
    case 2: return 'Merah';
    case 3: return 'Coklat';
    case 4: return 'Kuning';
    case 5: return 'Keruh (Lemah)';
    default: return 'Tidak Spesifik';
  }
};

export const getBadgeStyle = (detail) => {
  const lower = detail.toLowerCase();
  if (lower.includes('haid')) return 'bg-red-100 text-red-700 border border-red-200';
  if (lower.includes('suci') || lower.includes('istihadhoh') || lower.includes('jeda')) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (lower.includes('fasad')) return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
};