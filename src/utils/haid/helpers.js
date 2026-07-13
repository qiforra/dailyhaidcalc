// src/utils/haid/helpers.js
import { formatDuration, getColorLabel } from '../formatters';
import { MIN_SUCI_JAM } from './constants';

export const pushDetail = (arr, hours, label) => {
  if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
};

export const buildPeriodLabel = (p) => {
  const colorSuffix = p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : '';
  return `${p.type} ${formatDuration(p.hours)}${colorSuffix}`;
};

export const splitIntoSpans = (periods) => {
  const spans = [];
  let currentSpan = { duration: 0, periods: [] };
  periods.forEach((p) => {
    if (p.type === 'B' && p.hours >= MIN_SUCI_JAM) {
      if (currentSpan.periods.length > 0) spans.push(currentSpan);
      spans.push({ isGap: true, period: p });
      currentSpan = { duration: 0, periods: [] };
    } else {
      currentSpan.duration += p.hours;
      currentSpan.periods.push(p);
    }
  });
  if (currentSpan.periods.length > 0) spans.push(currentSpan);
  return spans;
};

export const scanContinuousKD = (periods, idx, pLeftAtIdx) => {
  let totalContinuousKD = pLeftAtIdx;
  let isFirstRealKD = true;
  for (let j = 0; j < idx; j++) {
    if (periods[j].type === 'KD') { isFirstRealKD = false; break; }
  }
  let idxAfterContinuous = idx + 1;
  while (idxAfterContinuous < periods.length && periods[idxAfterContinuous].type === 'KD') {
    totalContinuousKD += periods[idxAfterContinuous].hours;
    idxAfterContinuous++;
  }
  let nextB = 0;
  if (idxAfterContinuous < periods.length && periods[idxAfterContinuous].type === 'B') {
    nextB = periods[idxAfterContinuous].hours;
  }
  let hasNextKD = false;
  for (let i = idxAfterContinuous; i < periods.length; i++) {
    if (periods[i].type === 'KD') { hasNextKD = true; break; }
  }
  return { totalContinuousKD, isFirstRealKD, nextB, hasNextKD };
};

export const scanUntilNextKD = (periods, idx) => {
  let hasKDAfter = false;
  let timeToNextKD = 0;
  for (let i = idx + 1; i < periods.length; i++) {
    if (periods[i].type === 'KD') { hasKDAfter = true; break; }
    timeToNextKD += periods[i].hours;
  }
  return { hasKDAfter, timeToNextKD };
};