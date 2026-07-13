// src/utils/textParser.js
export const parseHaidText = (inputText) => {
  // 1. Ekstrak Adat (Ditambahkan AN / Adat Nifas)
  const ahMatch = inputText.match(/AH\s*[:=]?\s*(\d+)\s*(hari|jam)?/i);
  const asMatch = inputText.match(/AS\s*[:=]?\s*(\d+)\s*(hari|jam)?/i);
  const anMatch = inputText.match(/AN\s*[:=]?\s*(\d+)\s*(hari|jam)?/i);

  const adatHaid = ahMatch ? parseInt(ahMatch[1], 10) : NaN;
  const adatSuci = asMatch ? parseInt(asMatch[1], 10) : NaN;
  const adatNifas = anMatch ? parseInt(anMatch[1], 10) : NaN;

  const userStatus = (!Number.isNaN(adatHaid) && !Number.isNaN(adatSuci)) 
    ? 'mutadah' 
    : 'mubtadiah';

  // 2. Mapping Teks Warna ke Angka Kekuatan
  const mapColorToNumber = (colorText) => {
    if (!colorText) return null;
    const str = colorText.toLowerCase();
    if (str.includes('hitam')) return 1;
    if (str.includes('merah')) return 2;
    if (str.includes('coklat') || str.includes('asyqor')) return 3;
    if (str.includes('kuning')) return 4;
    if (str.includes('keruh')) return 5;
    return null;
  };

  const periods = [];
  let match;
  let hasValidDateMatch = false; // Diganti nama agar lebih jelas

  // 3. PARSER RENTANG TANGGAL (DIPERTAJAM: HANYA TERIMA NAMA BULAN ASLI)
  // Regex ini sekarang TIDAK AKAN tertipu oleh kata "kd" atau "b" sebagai bulan.
  const monthNames = "januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|may|jun|jul|agu|ags|sep|sept|okt|nov|des";
  const dateRegex = new RegExp(`(KD|B)\\s*(?:tgl)?\\s*(\\d{1,2})\\s+(${monthNames})(?:\\s*[-–]\\s*(\\d{1,2})\\s+(${monthNames}))?\\s*(?:\\(\\s*([a-zA-Z]+)\\s*\\)|\\b(hitam|merah|coklat|kuning|keruh|asyqor)\\b)?`, 'gi');
  
  while ((match = dateRegex.exec(inputText)) !== null) {
    const type = match[1].toUpperCase();
    const startDay = parseInt(match[2], 10);
    const startMonthStr = match[3].toLowerCase();
    const endDay = match[4] ? parseInt(match[4], 10) : null;
    const endMonthStr = match[5] ? match[5].toLowerCase() : null;
    const colorString = match[6] || match[7]; 

    const MONTH_MAP = {
      'januari': 0, 'jan': 0, 'februari': 1, 'feb': 1, 'maret': 2, 'mar': 2,
      'april': 3, 'apr': 3, 'mei': 4, 'may': 4, 'juni': 5, 'jun': 5,
      'juli': 6, 'jul': 6, 'agustus': 7, 'agu': 7, 'ags': 7, 'september': 8,
      'sep': 8, 'sept': 8, 'oktober': 9, 'okt': 9, 'november': 10, 'nov': 10,
      'desember': 11, 'des': 11
    };

    const startMonth = MONTH_MAP[startMonthStr];

    if (startMonth !== undefined) {
      hasValidDateMatch = true; // HANYA DISET TRUE JIKA BULAN VALID
      const currentYear = new Date().getFullYear();
      let startDate = new Date(currentYear, startMonth, startDay);
      startDate.setHours(0, 0, 0, 0);
      let endDate;

      if (endDay !== null && endMonthStr !== null && MONTH_MAP[endMonthStr] !== undefined) {
        endDate = new Date(currentYear, MONTH_MAP[endMonthStr], endDay);
        endDate.setHours(0, 0, 0, 0);
        if (endDate < startDate) endDate.setFullYear(currentYear + 1);
      } else {
        endDate = new Date(); 
        if (endDate < startDate) startDate.setFullYear(currentYear - 1); 
      }

      const diffMs = endDate - startDate;
      const hours = diffMs / (1000 * 60 * 60);

      if (hours > 0) {
        const periodObj = { type, hours, parsedStartDate: startDate.toISOString() };
        const colorNumber = mapColorToNumber(colorString);
        if (colorNumber !== null) periodObj.color = colorNumber;
        periods.push(periodObj);
      }
    }
  }

  // 4. PARSER CERDAS UNTUK FORMAT DURASI (Jam, Menit, Hari, & "Kurang")
  // Sekarang akan berjalan dengan sempurna jika hasValidDateMatch masih false
  if (!hasValidDateMatch) {
    const blockRegex = /\b(KD|B)\b\s*[:=]?\s*([\s\S]*?)(?=\b(?:KD|B|AH|AS|AN)\b|$)/gi;
    
    while ((match = blockRegex.exec(inputText)) !== null) {
      const type = match[1].toUpperCase();
      const rawContent = match[2];
      
      let colorNumber = null;
      const colorMatch = rawContent.match(/\b(hitam|merah|coklat|kuning|keruh|asyqor)\b/i);
      if (colorMatch) colorNumber = mapColorToNumber(colorMatch[1]);
      
      let timeText = rawContent
        .replace(/\b(hitam|merah|coklat|kuning|keruh|asyqor)\b/gi, '')
        .replace(/sedikit|mungkin|sekitar|kurang\s+lebih|\(|\)/gi, ' ')
        .trim();
          
      const parseTimePart = (str) => {
        let h = 0;
        let foundUnit = false;
        
        const dMatch = str.match(/(\d+)\s*(hari|hr)/i);
        const hMatch = str.match(/(\d+)\s*(jam)/i);
        const mMatch = str.match(/(\d+)\s*(menit|mnt)/i);
        
        if (dMatch) { h += parseInt(dMatch[1], 10) * 24; foundUnit = true; }
        if (hMatch) { h += parseInt(hMatch[1], 10); foundUnit = true; }
        if (mMatch) { h += parseInt(mMatch[1], 10) / 60; foundUnit = true; }
        
        // Fallback: Jika angka doang tanpa satuan (Cth: "b 10"), asumsikan "Hari"
        if (!foundUnit) {
          const numMatch = str.match(/(\d+)/);
          if (numMatch) h += parseInt(numMatch[1], 10) * 24;
        }
        
        return h;
      };

      let hours = 0;
      if (timeText.toLowerCase().includes('kurang')) {
        const parts = timeText.toLowerCase().split('kurang');
        hours = parseTimePart(parts[0]) - parseTimePart(parts[1]);
      } else {
        hours = parseTimePart(timeText);
      }
      
      if (hours > 0) {
        const periodObj = { type, hours };
        if (colorNumber !== null) periodObj.color = colorNumber;
        periods.push(periodObj);
      }
    }
  }

  return {
    userConfig: { userStatus, lupaAdat: false, adatHaid, adatSuci, adatNifas },
    periods
  };
};