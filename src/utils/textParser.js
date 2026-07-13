// src/utils/textParser.js
export const parseHaidText = (inputText) => {
  // 1. Ekstrak Adat Haid (AH) dan Adat Suci (AS) / (AN)
  const ahMatch = inputText.match(/AH\s*[:=]?\s*(\d+)\s*(hari|jam)?/i);
  const asMatch = inputText.match(/AS\s*[:=]?\s*(\d+)\s*(hari|jam)?/i);

  const adatHaid = ahMatch ? parseInt(ahMatch[1], 10) : NaN;
  const adatSuci = asMatch ? parseInt(asMatch[1], 10) : NaN;

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
  let hasDateMatch = false;

  // 3. COBA PARSE FORMAT RENTANG TANGGAL
  const dateRegex = /(KD|B)\s*(?:tgl)?\s*(\d{1,2})\s+([a-zA-Z]+)\s*[-–]\s*(\d{1,2})\s+([a-zA-Z]+)\s*(?:\(\s*([a-zA-Z]+)\s*\)|\b(hitam|merah|coklat|kuning|keruh|asyqor)\b)?/gi;
  
  while ((match = dateRegex.exec(inputText)) !== null) {
    hasDateMatch = true;
    const type = match[1].toUpperCase();
    const startDay = parseInt(match[2], 10);
    const startMonthStr = match[3].toLowerCase();
    const endDay = parseInt(match[4], 10);
    const endMonthStr = match[5].toLowerCase();
    const colorString = match[6] || match[7]; 

    const MONTH_MAP = {
      'januari': 0, 'jan': 0, 'februari': 1, 'feb': 1, 'maret': 2, 'mar': 2,
      'april': 3, 'apr': 3, 'mei': 4, 'may': 4, 'juni': 5, 'jun': 5,
      'juli': 6, 'jul': 6, 'agustus': 7, 'agu': 7, 'ags': 7, 'september': 8,
      'sep': 8, 'sept': 8, 'oktober': 9, 'okt': 9, 'november': 10, 'nov': 10,
      'desember': 11, 'des': 11
    };

    const startMonth = MONTH_MAP[startMonthStr];
    const endMonth = MONTH_MAP[endMonthStr];

    if (startMonth !== undefined && endMonth !== undefined) {
      const currentYear = new Date().getFullYear();
      let startDate = new Date(currentYear, startMonth, startDay);
      let endDate = new Date(currentYear, endMonth, endDay);

      if (endDate < startDate) endDate.setFullYear(currentYear + 1);

      const diffMs = endDate - startDate;
      const hours = diffMs / (1000 * 60 * 60);

      if (hours > 0) {
        const periodObj = { type, hours };
        const colorNumber = mapColorToNumber(colorString);
        if (colorNumber !== null) periodObj.color = colorNumber;
        periods.push(periodObj);
      }
    }
  }

  // 4. PARSER CERDAS UNTUK FORMAT DURASI (Jam, Menit, Hari, & "Kurang")
  if (!hasDateMatch) {
    // Regex ini menangkap "KD/B" lalu memakan seluruh kata setelahnya HINGGA bertemu KD/B yang baru.
    const blockRegex = /\b(KD|B)\b\s*[:=]?\s*([\s\S]*?)(?=\b(?:KD|B|AH|AS|AN)\b|$)/gi;
    
    while ((match = blockRegex.exec(inputText)) !== null) {
      const type = match[1].toUpperCase();
      const rawContent = match[2];
      
      // Ambil warna darah
      let colorNumber = null;
      const colorMatch = rawContent.match(/\b(hitam|merah|coklat|kuning|keruh|asyqor)\b/i);
      if (colorMatch) colorNumber = mapColorToNumber(colorMatch[1]);
      
      // Bersihkan teks dari kata pengganggu dan warna
      let timeText = rawContent
        .replace(/\b(hitam|merah|coklat|kuning|keruh|asyqor)\b/gi, '')
        .replace(/sedikit|mungkin|sekitar|kurang\s+lebih|\(|\)/gi, ' ')
        .trim();
          
      // Fungsi pelacak angka di dalam teks
      const parseTimePart = (str) => {
        let h = 0;
        let foundUnit = false;
        
        const dMatch = str.match(/(\d+)\s*(hari|hr)/i);
        const hMatch = str.match(/(\d+)\s*(jam)/i);
        const mMatch = str.match(/(\d+)\s*(menit|mnt|menit)/i);
        
        if (dMatch) { h += parseInt(dMatch[1], 10) * 24; foundUnit = true; }
        if (hMatch) { h += parseInt(hMatch[1], 10); foundUnit = true; }
        if (mMatch) { h += parseInt(mMatch[1], 10) / 60; foundUnit = true; } // menit konversi ke jam desimal
        
        // Fallback: Jika dia ketik angka doang tanpa satuan (Cth: KD: 7), asumsikan "Hari"
        if (!foundUnit) {
          const numMatch = str.match(/(\d+)/);
          if (numMatch) h += parseInt(numMatch[1], 10) * 24;
        }
        
        return h;
      };

      let hours = 0;
      // Jika ada kata "kurang", belah teks jadi dua lalu kurangkan nilainya
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
    userConfig: { userStatus, lupaAdat: false, adatHaid, adatSuci },
    periods
  };
};