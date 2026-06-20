export const msToHours = (ms) => ms / (1000 * 60 * 60);

export const mapColorNameToValue = (colorName) => {
  switch (colorName) {
    case 'hitam': return 1;
    case 'merah': return 2;
    case 'coklat': return 3;
    case 'kuning': return 4;
    case 'keruh': return 5;
    default: return null;
  }
};

export const getEffectiveStatus = (userStatus, lupaAdat) => (userStatus === 'mutadah' && !lupaAdat ? 'mutadah' : 'mubtadiah');

export const getBaseHaidSuci = (effectiveStatus, adatHaid, adatSuci) => ({
  baseHaid: effectiveStatus === 'mutadah' ? (Number.isNaN(adatHaid) ? 0 : adatHaid * 24) : 24,
  baseSuci: effectiveStatus === 'mutadah' ? (Number.isNaN(adatSuci) ? 0 : adatSuci * 24) : 29 * 24,
});

export const getTargetNifas = (effectiveStatus, adatNifas) => (
  effectiveStatus === 'mutadah' ? (Number.isNaN(adatNifas) ? 40 : adatNifas) * 24 : 0.01
);

export const parseQuickTextInput = (textInput, appMode = 'HAID', inputWiladah = '', options = {}) => {
  const text = textInput.toLowerCase();
  const overrides = {};

  const anMatch = text.match(/an\s*[:=]?\s*(\d+)/);
  const ahMatch = text.match(/ah\s*[:=]?\s*(\d+)/);
  const asMatch = text.match(/as\s*[:=]?\s*(\d+)/);

  if (anMatch) overrides.adatNifas = parseInt(anMatch[1], 10);
  if (ahMatch) overrides.adatHaid = parseInt(ahMatch[1], 10);
  if (asMatch) overrides.adatSuci = parseInt(asMatch[1], 10);

  let currentStart = options.baseTime ? new Date(options.baseTime) : new Date();
  if (appMode === 'NIFAS' && inputWiladah) currentStart = new Date(inputWiladah);

  const logPattern = /(kd|b)\s*(hitam|merah|coklat|kuning|keruh)?\s*([\d.]+)\s*(hari|jam)?\s*(hitam|merah|coklat|kuning|keruh)?/g;
  const tokens = text.match(logPattern) || [];
  const logs = [];

  tokens.forEach((token) => {
    const match = token.match(/(kd|b)\s*(hitam|merah|coklat|kuning|keruh)?\s*([\d.]+)\s*(hari|jam)?\s*(hitam|merah|coklat|kuning|keruh)?/);
    if (!match) return;

    const type = match[1];
    const colorBefore = match[2];
    const value = parseFloat(match[3]);
    const unit = match[4];
    const colorAfter = match[5];
    const colorName = colorBefore || colorAfter;
    const days = unit === 'jam' ? value / 24 : value;
    const durationMs = days * 24 * 60 * 60 * 1000;
    const currentEnd = new Date(currentStart.getTime() + durationMs);

    const colorVal = mapColorNameToValue(colorName);

    if (type === 'kd') {
      logs.push({
        id: Date.now() + Math.random(),
        start: currentStart.toISOString().slice(0, 16),
        end: currentEnd.toISOString().slice(0, 16),
        durationHours: days * 24,
        color: colorVal,
      });
      currentStart = currentEnd;
    } else {
      currentStart = currentEnd;
    }
  });

  return {
    logs: logs.sort((a, b) => new Date(a.start) - new Date(b.start)),
    overrides,
    firstLogStart: logs.length > 0 ? logs[0].start : null,
  };
};

export const formatDuration = (hours) => {
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (d > 0 && h > 0) return `${d} Hari ${h} Jam`;
  if (d > 0) return `${d} Hari`;
  return `${h} Jam`;
};

export const getColorLabel = (val) => {
  switch (val) {
    case 1:
      return 'Hitam (1)';
    case 2:
      return 'Merah (2)';
    case 3:
      return 'Coklat (3)';
    case 4:
      return 'Kuning (4)';
    case 5:
      return 'Keruh (5)';
    default:
      return '-';
  }
};

export const buildPeriodsFromLogs = (logs) => {
  const periods = [];
  for (let i = 0; i < logs.length; i += 1) {
    periods.push({
      id: `kd-${i}`,
      type: 'KD',
      hours: Math.round(logs[i].durationHours * 100) / 100,
      color: logs[i].color,
    });

    if (i < logs.length - 1) {
      const gapHours = Math.round(msToHours(new Date(logs[i + 1].start) - new Date(logs[i].end)) * 100) / 100;
      if (gapHours > 0) {
        periods.push({ id: `b-${i}`, type: 'B', hours: gapHours });
      }
    }
  }
  return periods;
};

export const analyzeHaidPeriods = (periods, qoulMode, { userStatus, lupaAdat, adatHaid, adatSuci }) => {
  const breakdown = [];
  const effectiveStatus = getEffectiveStatus(userStatus, lupaAdat);
  const { baseHaid, baseSuci } = getBaseHaidSuci(effectiveStatus, adatHaid, adatSuci);

  const isSahbi = qoulMode === 'LAQTHI_SAHBI';
  const isNormalQoul1 = qoulMode === 'QOUL_1';

  let cycleAdatHaid = baseHaid;
  let cycleAdatSuci = baseSuci;

  const spans = [];
  let currentSpan = { duration: 0, periods: [] };

  periods.forEach((p) => {
    if (p.type === 'B' && p.hours >= 15 * 24) {
      if (currentSpan.periods.length > 0) spans.push(currentSpan);
      spans.push({ isGap: true, period: p });
      currentSpan = { duration: 0, periods: [] };
    } else {
      currentSpan.duration += p.hours;
      currentSpan.periods.push(p);
    }
  });

  if (currentSpan.periods.length > 0) spans.push(currentSpan);

  const meta = {
    isTamyizValid: false,
    fallbackReason: '',
    effectiveStatus,
    adatUpdates: [],
    hasTakmil: false,
  };

  const pushDetail = (arr, hours, label) => {
    if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
  };

  spans.forEach((span) => {
    if (span.isGap) {
      breakdown.push({
        label: `B ${formatDuration(span.period.hours)}`,
        details: [`${formatDuration(span.period.hours)} Suci`],
      });
      cycleAdatSuci = span.period.hours;
      return;
    }

    const isMustahadhah = span.duration > 15 * 24;

    if (!isMustahadhah) {
      span.periods.forEach((p) => {
        const detailsArr = [];
        if (p.type === 'KD') pushDetail(detailsArr, p.hours, 'Haid');
        else pushDetail(detailsArr, p.hours, 'Haid (Qoul Sahbi)');
        breakdown.push({
          label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`,
          details: detailsArr,
        });
      });
      cycleAdatHaid = span.duration;
    } else {
      let isTamyizValid = false;
      let fallbackReason = '';
      const tamyizSpans = [];

      const kdColors = span.periods.filter((p) => p.type === 'KD').map((p) => p.color);
      const uniqueColors = new Set(kdColors.filter((c) => c !== null));

      if (uniqueColors.size < 2) {
        fallbackReason = 'Ghoiru Mumayyizah: Tidak ada pembedaan sifat darah (Warna seragam / Tidak diinput).';
      } else {
        let currentStrongColor = null;
        let currentHaidAcc = 0;
        let currentWeakAcc = 0;
        let isSearchingHaid = true;
        let lastWeakColor = 5;

        span.periods.forEach((p, idx) => {
          if (isSearchingHaid) {
            if (p.type === 'KD') {
              const pColor = p.color || 5;

              if (currentStrongColor === null) {
                currentStrongColor = pColor;
                currentHaidAcc = p.hours;
                tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
              } else if (pColor === currentStrongColor) {
                currentHaidAcc += p.hours;
                tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
              } else if (pColor > currentStrongColor) {
                if (currentHaidAcc >= 24 && currentHaidAcc <= 15 * 24) {
                  isSearchingHaid = false;
                  currentWeakAcc = p.hours;
                  lastWeakColor = pColor;
                  tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
                } else {
                  currentHaidAcc += p.hours;
                  tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
                }
              } else {
                currentStrongColor = pColor;
                currentHaidAcc += p.hours;
                tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
              }
            } else if (p.type === 'B') {
              if (currentHaidAcc >= 24 && currentHaidAcc <= 15 * 24) {
                isSearchingHaid = false;
                currentWeakAcc = p.hours;
                tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours });
              } else {
                currentHaidAcc += p.hours;
                tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours });
              }
            }
          } else {
            if (p.type === 'B') {
              currentWeakAcc += p.hours;
              tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours });
            } else if (p.type === 'KD') {
              const pColor = p.color || 5;
              if (currentWeakAcc >= 15 * 24) {
                if (pColor < lastWeakColor) {
                  isSearchingHaid = true;
                  currentStrongColor = pColor;
                  currentHaidAcc = p.hours;
                  currentWeakAcc = 0;
                  tamyizSpans.push({ id: idx, type: 'HAID', hours: p.hours, color: pColor });
                } else {
                  currentWeakAcc += p.hours;
                  lastWeakColor = pColor;
                  tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
                }
              } else {
                currentWeakAcc += p.hours;
                lastWeakColor = pColor;
                tamyizSpans.push({ id: idx, type: 'ISTIHADHOH', hours: p.hours, color: pColor });
              }
            }
          }
        });

        const groupedTamyiz = [];
        tamyizSpans.forEach((ts) => {
          if (groupedTamyiz.length > 0 && groupedTamyiz[groupedTamyiz.length - 1].type === ts.type) {
            groupedTamyiz[groupedTamyiz.length - 1].hours += ts.hours;
          } else {
            groupedTamyiz.push({ type: ts.type, hours: ts.hours });
          }
        });

        const hasValidHaid = groupedTamyiz.some((ts) => ts.type === 'HAID' && ts.hours >= 24 && ts.hours <= 15 * 24);
        const hasValidSuci = groupedTamyiz.some((ts) => ts.type === 'ISTIHADHOH' && ts.hours >= 15 * 24);

        if (hasValidHaid && (hasValidSuci || groupedTamyiz[groupedTamyiz.length - 1].type === 'ISTIHADHOH')) {
          isTamyizValid = true;
        } else {
          fallbackReason = 'Gagal memenuhi syarat Tamyiz: Kurang 24 jam / Lebih 15 Hari / Tidak ada jeda lemah 15 hari.';
        }
      }

      meta.isTamyizValid = isTamyizValid;
      meta.fallbackReason = fallbackReason;

      if (isTamyizValid) {
        span.periods.forEach((p, idx) => {
          const tsMatch = tamyizSpans.filter((ts) => ts.id === idx);
          const detailsArr = [];
          tsMatch.forEach((ts) => {
            pushDetail(detailsArr, ts.hours, ts.type === 'HAID' ? 'Haid (Tamyiz)' : (p.type === 'B' ? 'Suci' : 'Istihadhoh (Lemah)'));
          });
          breakdown.push({
            label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`,
            details: detailsArr,
          });
        });
        cycleAdatHaid = tamyizSpans.find((ts) => ts.type === 'HAID')?.hours || cycleAdatHaid;
      } else {
        let loopState = 'HAID';
        let targetHaid = cycleAdatHaid;
        let targetSuci = cycleAdatSuci;
        if (targetSuci < 15 * 24) targetSuci = 15 * 24;
        let haidAcc = 0;
        let suciAcc = 0;
        let windowTime = 0;

        span.periods.forEach((p, idx) => {
          let pLeft = p.hours;
          const detailsArr = [];

          if (idx === 0 && p.type === 'KD' && p.hours < 24) {
            pushDetail(detailsArr, p.hours, 'Fasad (Batal Haid)');
            pLeft = 0;
            loopState = 'SUCI';
            suciAcc = 0;
          }

          while (pLeft > 0.01) {
            if (loopState === 'SUCI') {
              if (suciAcc >= targetSuci && p.type === 'KD') {
                loopState = 'HAID';
                windowTime = 0;
                haidAcc = 0;
                cycleAdatSuci = suciAcc;
                targetSuci = cycleAdatSuci;
                if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                targetHaid = cycleAdatHaid;
                continue;
              }

              const limit = p.type === 'B' ? pLeft : Math.max(0, targetSuci - suciAcc);
              const consume = Math.min(pLeft, limit);

              if (consume > 0) {
                const label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
                if (p.type === 'KD' && suciAcc < 15 * 24) {
                  meta.hasTakmil = true;
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
                targetSuci = cycleAdatSuci;
                if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                targetHaid = cycleAdatHaid;
              }
            }

            if (loopState === 'HAID') {
              if (p.type === 'KD' && !isNormalQoul1 && haidAcc === 0 && windowTime === 0) {
                let totalRemainingToLastKD = 0;
                let lastRemainingKDIdx = idx;

                for (let i = idx; i < span.periods.length; i += 1) {
                  if (span.periods[i].type === 'KD') lastRemainingKDIdx = i;
                }

                for (let i = idx; i <= lastRemainingKDIdx; i += 1) {
                  totalRemainingToLastKD += span.periods[i].hours;
                }

                if (totalRemainingToLastKD > targetHaid && totalRemainingToLastKD <= 15 * 24) {
                  targetHaid = totalRemainingToLastKD;
                  cycleAdatHaid = targetHaid;
                }
              }

              const currentTarget = isNormalQoul1 && !isSahbi ? baseHaid : targetHaid;
              const consume = Math.min(pLeft, currentTarget - haidAcc);

              if (p.type === 'KD') {
                if (consume > 0) {
                  const label = isNormalQoul1 ? ' (Adat Asal)' : (isSahbi ? '' : '');
                  pushDetail(detailsArr, consume, `Haid${label}`);
                  haidAcc += consume;
                  pLeft -= consume;
                }
                if (haidAcc >= currentTarget) {
                  loopState = 'SUCI';
                  suciAcc = 0;
                  if (!isNormalQoul1) cycleAdatHaid = currentTarget;
                  targetSuci = cycleAdatSuci;
                  if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                }
              } else {
                let nextKDStart = haidAcc + pLeft;
                let nextKDDuration = 0;
                for (let i = idx + 1; i < span.periods.length; i += 1) {
                  if (span.periods[i].type === 'KD') {
                    nextKDDuration = span.periods[i].hours;
                    break;
                  }
                  nextKDStart += span.periods[i].hours;
                }

                if (nextKDDuration > 0 && nextKDStart < currentTarget) {
                  pushDetail(detailsArr, pLeft, 'Haid (Qoul Sahbi)');
                  haidAcc += pLeft;
                  pLeft = 0;
                } else {
                  if (!isNormalQoul1) cycleAdatHaid = haidAcc;
                  targetSuci = cycleAdatSuci;
                  if (targetSuci < 15 * 24) targetSuci = 15 * 24;
                  loopState = 'SUCI';
                  suciAcc = 0;
                }
              }
            }
          }

          breakdown.push({
            label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`,
            details: detailsArr,
          });
        });
      }
    }
  });

  return { breakdown, meta };
};

export const analyzeNifasPeriods = (periods, { userStatus, lupaAdat, adatHaid, adatSuci, adatNifas }) => {
  const breakdown = [];
  const effectiveStatus = getEffectiveStatus(userStatus, lupaAdat);
  const { baseHaid, baseSuci } = getBaseHaidSuci(effectiveStatus, adatHaid, adatSuci);
  const targetNifas = getTargetNifas(effectiveStatus, adatNifas);

  const meta = {
    isTamyizValid: false,
    fallbackReason: '',
    effectiveStatus,
  };

  const pushDetail = (arr, hours, label) => {
    if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
  };

  let isMustahadhah = false;
  let normalNifasHours = 0;
  let currentAcc = 0;

  for (const p of periods) {
    if (p.type === 'B' && p.hours >= 15 * 24) {
      normalNifasHours = currentAcc;
      break;
    }
    if (currentAcc + p.hours > 60 * 24) {
      if (p.type === 'KD') isMustahadhah = true;
      else normalNifasHours = currentAcc;
      break;
    }
    if (currentAcc + p.hours === 60 * 24) {
      if (p.type === 'KD') normalNifasHours = 60 * 24;
      else normalNifasHours = currentAcc;
      break;
    }
    currentAcc += p.hours;
  }

  if (currentAcc > 0 && currentAcc < 60 * 24 && !isMustahadhah) normalNifasHours = currentAcc;

  let isTamyizNifas = false;
  let tamyizNifasHours = 0;
  let hasColors = false;

  if (isMustahadhah) {
    const kdBlocks = [];
    let currentBlock = null;
    let tempAcc = 0;

    for (const p of periods) {
      if (tempAcc > 60 * 24) break;
      if (p.type === 'KD') {
        if (p.color !== null) hasColors = true;
        if (!currentBlock || currentBlock.color !== p.color) {
          if (currentBlock) kdBlocks.push(currentBlock);
          currentBlock = { color: p.color, hours: p.hours };
        } else {
          currentBlock.hours += p.hours;
        }
        tempAcc += p.hours;
      } else {
        if (p.hours >= 15 * 24) break;
        if (currentBlock) kdBlocks.push(currentBlock);
        currentBlock = null;
        tempAcc += p.hours;
      }
    }

    if (currentBlock) kdBlocks.push(currentBlock);

    if (hasColors) {
      const validKdBlocks = kdBlocks.filter((b) => b.color !== null);
      const distinctNifasColors = new Set(validKdBlocks.map((b) => b.color));
      if (distinctNifasColors.size > 1) {
        const strongColor = Math.min(...validKdBlocks.map((b) => b.color));
        const firstKuatIdx = validKdBlocks.findIndex((b) => b.color === strongColor);
        if (firstKuatIdx !== -1) {
          const kuat1 = validKdBlocks[firstKuatIdx];
          if (kuat1.hours <= 60 * 24) {
            isTamyizNifas = true;
            tamyizNifasHours = kuat1.hours;
          }
        }
      }
    }
  }

  let activeTargetNifas = targetNifas;
  let nifasLabel = 'Nifas';

  if (!isMustahadhah) {
    activeTargetNifas = normalNifasHours;
    meta.isTamyizValid = false;
    meta.fallbackReason = 'Normal (Darah berhenti sebelum 60 Hari)';
  } else {
    if (isTamyizNifas) {
      activeTargetNifas = tamyizNifasHours;
      meta.isTamyizValid = true;
      nifasLabel = 'Nifas (Tamyiz)';
    } else {
      activeTargetNifas = targetNifas;
      meta.fallbackReason = 'Ghoiru Mumayyizah / Melebihi 60 Hari';
      nifasLabel = targetNifas <= 0.01 ? 'Nifas (Setetes / Lahdhoh)' : 'Nifas (Adat)';
    }
  }

  let loopState = 'NIFAS';
  let cycleAdatHaid = baseHaid;
  let cycleAdatSuci = baseSuci;
  let targetSuci = cycleAdatSuci;
  if (targetSuci < 15 * 24) targetSuci = 15 * 24;
  let targetHaid = cycleAdatHaid;

  let suciAcc = 0;
  let haidAcc = 0;
  let nifasAcc = 0;
  let globalTimeAcc = 0;
  let hasUsedNifasSeparator = false;
  let nifasSuciBypassAvailable = false;

  periods.forEach((p, idx) => {
    let pLeft = p.hours;
    const detailsArr = [];

    if (idx === 0 && p.type === 'KD' && loopState === 'NIFAS' && activeTargetNifas <= 0.01) {
      pushDetail(detailsArr, 0.01, 'Nifas (Setetes / Lahdhoh)');
      pLeft -= 0.01;
      globalTimeAcc += 0.01;
      loopState = 'SUCI';
      suciAcc = 0;
      targetSuci = cycleAdatSuci;
      if (targetSuci < 15 * 24) targetSuci = 15 * 24;
    }

    while (pLeft > 0.01) {
      let consume = 0;

      if (loopState === 'NIFAS') {
        consume = Math.min(pLeft, activeTargetNifas - nifasAcc);
        if (consume > 0) {
          const label = p.type === 'KD' ? (!isMustahadhah ? 'Nifas' : nifasLabel) : 'Nifas (Naqa\')';
          pushDetail(detailsArr, consume, label);
          nifasAcc += consume;
          pLeft -= consume;
          globalTimeAcc += consume;
        }
        if (nifasAcc >= activeTargetNifas) {
          loopState = 'SUCI';
          suciAcc = 0;
          targetSuci = cycleAdatSuci;
          if (targetSuci < 15 * 24) targetSuci = 15 * 24;
        }
      } else if (loopState === 'SUCI') {
        if ((suciAcc >= targetSuci && p.type === 'KD') || (nifasSuciBypassAvailable && p.type === 'KD')) {
          loopState = 'HAID';
          haidAcc = 0;
          cycleAdatSuci = suciAcc;
          targetSuci = cycleAdatSuci;
          if (targetSuci < 15 * 24) targetSuci = 15 * 24;
          targetHaid = cycleAdatHaid;
          nifasSuciBypassAvailable = false;
          hasUsedNifasSeparator = true;
          continue;
        }

        const limit = p.type === 'B' ? pLeft : Math.max(0, targetSuci - suciAcc);
        consume = Math.min(pLeft, limit);

        if (!hasUsedNifasSeparator && p.type === 'B' && globalTimeAcc + consume >= 60 * 24 - 0.01) {
          nifasSuciBypassAvailable = true;
        }

        if (consume > 0) {
          const label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
          pushDetail(detailsArr, consume, label);
          suciAcc += consume;
          pLeft -= consume;
          globalTimeAcc += consume;
        }

        if (suciAcc >= targetSuci && pLeft > 0 && p.type === 'KD') {
          loopState = 'HAID';
          haidAcc = 0;
          cycleAdatSuci = suciAcc;
          targetSuci = cycleAdatSuci;
          if (targetSuci < 15 * 24) targetSuci = 15 * 24;
          targetHaid = cycleAdatHaid;
          hasUsedNifasSeparator = true;
        }
      } else if (loopState === 'HAID') {
        if (p.type === 'KD' && haidAcc === 0) {
          let totalRemainingToLastKD = 0;
          let lastRemainingKDIdx = idx;
          for (let i = idx; i < periods.length; i += 1) {
            if (periods[i].type === 'KD') lastRemainingKDIdx = i;
          }
          for (let i = idx; i <= lastRemainingKDIdx; i += 1) {
            totalRemainingToLastKD += periods[i].hours;
          }
          if (totalRemainingToLastKD > targetHaid && totalRemainingToLastKD <= 15 * 24) {
            targetHaid = totalRemainingToLastKD;
            cycleAdatHaid = targetHaid;
          }
        }

        consume = Math.min(pLeft, targetHaid - haidAcc);
        if (p.type === 'KD') {
          if (consume > 0) {
            let label = 'Haid';
            if (targetHaid !== baseHaid && targetHaid === cycleAdatHaid) label = 'Haid (Adat Dinamis)';
            pushDetail(detailsArr, consume, label);
            haidAcc += consume;
            pLeft -= consume;
            globalTimeAcc += consume;
          }
          if (haidAcc >= targetHaid) {
            loopState = 'SUCI';
            suciAcc = 0;
            cycleAdatHaid = targetHaid;
            targetSuci = cycleAdatSuci;
            if (targetSuci < 15 * 24) targetSuci = 15 * 24;
          }
        } else {
          let nextKDStart = haidAcc + pLeft;
          let nextKDDuration = 0;
          for (let i = idx + 1; i < periods.length; i += 1) {
            if (periods[i].type === 'KD') {
              nextKDDuration = periods[i].hours;
              break;
            }
            nextKDStart += periods[i].hours;
          }
          if (nextKDDuration > 0 && nextKDStart < targetHaid) {
            pushDetail(detailsArr, pLeft, 'Haid (Qoul Sahbi)');
            haidAcc += pLeft;
            pLeft = 0;
            globalTimeAcc += pLeft;
          } else {
            cycleAdatHaid = haidAcc;
            targetSuci = cycleAdatSuci;
            if (targetSuci < 15 * 24) targetSuci = 15 * 24;
            loopState = 'SUCI';
            suciAcc = 0;
          }
        }
      }
    }
    breakdown.push({
      label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`,
      details: detailsArr,
    });
  });

  return { breakdown, meta };
};

export const createAnalysisResult = (appMode, logs, options = {}) => {
  const periods = buildPeriodsFromLogs(logs);

  if (appMode === 'HAID') {
    const baseResult = analyzeHaidPeriods(periods, 'QOUL_2', options);
    const isMustahadhahTaqothu = baseResult.meta.isTamyizValid === false && periods.some((p) => p.type === 'B') && periods.reduce((acc, p) => acc + p.hours, 0) > 15 * 24;

    if (isMustahadhahTaqothu) {
      const sahbi = analyzeHaidPeriods(periods, 'LAQTHI_SAHBI', options);
      return {
        mode: 'HAID',
        engine: 'Engine v42: Nifas Bypass Precision',
        status: 'MUSTAHADHAH (QOUL SAHBI)',
        hasKhilaf: false,
        hasLaqthi: false,
        qoul2: sahbi.breakdown,
        meta: sahbi.meta,
      };
    }

    const q1Result = analyzeHaidPeriods(periods, 'QOUL_1', options);
    const isKhilaf = baseResult.meta.hasTakmil;

    return {
      mode: 'HAID',
      engine: 'Engine v42: Nifas Bypass Precision',
      status: isKhilaf ? "ISTIHADHOH (ADA KHILAF TAQOTHU')" : 'TAKHRIJ FIKIH',
      hasKhilaf: isKhilaf,
      hasLaqthi: false,
      qoul1: q1Result.breakdown,
      qoul2: baseResult.breakdown,
      meta: baseResult.meta,
    };
  }

  const nifasResult = analyzeNifasPeriods(periods, options);
  return {
    mode: 'NIFAS',
    engine: 'Engine v42: Nifas Bypass Precision',
    status: nifasResult.meta.isTamyizValid ? 'NIFAS (TAMYIZ MEMENUHI SYARAT)' : (nifasResult.meta.fallbackReason.includes('Normal') ? 'NIFAS (NORMAL)' : 'NIFAS (KEMBALI KE ADAT / LAHDHOH)'),
    hasKhilaf: false,
    hasLaqthi: false,
    qoul2: nifasResult.breakdown,
    meta: nifasResult.meta,
  };
};

const normalizeCopyLabel = (label) => label.replace('KD', 'Kd').replace('Jeda Bersih', 'B');
const normalizeDetailText = (text) => {
  const lower = text.toLowerCase();
  return lower.replace(/^(\d+\s+hari\s+\d+\s+jam|\d+\s+hari|\d+\s+jam)\s+/i, '');
};

export const buildCopyTextFromAnalysis = (analysisResult, appMode, profile = {}) => {
  const lines = [];

  if (!analysisResult) return '';

  if (appMode === 'NIFAS' && profile.userStatus === 'mutadah' && !profile.lupaAdat) {
    lines.push(`An ${profile.adatNifas} Ah ${profile.adatHaid} As ${profile.adatSuci}`);
    lines.push('');
  } else if (appMode === 'HAID' && profile.userStatus === 'mutadah' && !profile.lupaAdat) {
    lines.push(`Ah ${profile.adatHaid} As ${profile.adatSuci}`);
    lines.push('');
  }

  const activeBreakdown = analysisResult.qoul1 && profile.activeTab === 'QOUL_1' ? analysisResult.qoul1 : analysisResult.qoul2;

  activeBreakdown.forEach((item) => {
    const labelStr = normalizeCopyLabel(item.label);

    if (item.details.length === 1) {
      lines.push(`${labelStr} ${normalizeDetailText(item.details[0])}`);
    } else if (item.details.length > 1) {
      lines.push(`${labelStr} (${item.details.map((detail) => detail.toLowerCase()).join(', ')})`);
    } else {
      lines.push(labelStr);
    }
  });

  return lines.join('\n').trim();
};
