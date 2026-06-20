import { describe, it, expect } from 'vitest';
import { formatDuration, buildPeriodsFromLogs, parseQuickTextInput, analyzeHaidPeriods, analyzeNifasPeriods, createAnalysisResult, buildCopyTextFromAnalysis, getEffectiveStatus, getBaseHaidSuci, getTargetNifas } from './analysis.js';

describe('analysis helpers', () => {
  it('formats hours into days and hours', () => {
    expect(formatDuration(1)).toBe('1 Jam');
    expect(formatDuration(24)).toBe('1 Hari');
    expect(formatDuration(25)).toBe('1 Hari 1 Jam');
    expect(formatDuration(48)).toBe('2 Hari');
  });

  it('builds periods from logs with gaps', () => {
    const logs = [
      { id: 1, start: '2026-01-01T00:00', end: '2026-01-02T00:00', durationHours: 24, color: 1 },
      { id: 2, start: '2026-01-03T00:00', end: '2026-01-04T00:00', durationHours: 24, color: 2 }
    ];

    const periods = buildPeriodsFromLogs(logs);
    expect(periods).toHaveLength(3);
    expect(periods[0]).toEqual({ id: 'kd-0', type: 'KD', hours: 24, color: 1 });
    expect(periods[1]).toEqual({ id: 'b-0', type: 'B', hours: 24 });
    expect(periods[2]).toEqual({ id: 'kd-1', type: 'KD', hours: 24, color: 2 });
  });

  it('parses quick text input into logs and overrides', () => {
    const text = 'AN: 50\nAH: 7\nAS: 20\nKD 2 hari\nB 1 hari\nKD 3 hari';
    const result = parseQuickTextInput(text, 'NIFAS', '2026-01-01T00:00');

    expect(result.overrides).toEqual({ adatNifas: 50, adatHaid: 7, adatSuci: 20 });
    expect(result.logs).toHaveLength(2);
    expect(result.logs[0]).toMatchObject({ durationHours: 48, color: null });
    expect(result.logs[1]).toMatchObject({ durationHours: 72, color: null });
  });

  it('analyzes haid periods with QOUL_1 and returns breakdown', () => {
    const periods = [
      { id: 'kd-0', type: 'KD', hours: 48, color: 2 },
      { id: 'b-0', type: 'B', hours: 24 },
      { id: 'kd-1', type: 'KD', hours: 24, color: 1 }
    ];

    const result = analyzeHaidPeriods(periods, 'QOUL_1', { userStatus: 'mutadah', lupaAdat: false, adatHaid: 7, adatSuci: 20 });

    expect(result.meta.effectiveStatus).toBe('mutadah');
    expect(result.breakdown).toContainEqual(expect.objectContaining({ label: expect.stringContaining('KD 2 Hari') }));
  });

  it('analyzes nifas periods and marks normal fallback when blood stops early', () => {
    const periods = [
      { id: 'kd-0', type: 'KD', hours: 48, color: 2 }
    ];

    const result = analyzeNifasPeriods(periods, { userStatus: 'mutadah', lupaAdat: false, adatHaid: 7, adatSuci: 20, adatNifas: 40 });

    expect(result.meta.isTamyizValid).toBe(false);
    expect(result.meta.fallbackReason).toContain('Normal');
  });

  it('returns the correct effective status and base values for mutadah', () => {
    expect(getEffectiveStatus('mutadah', false)).toBe('mutadah');
    expect(getBaseHaidSuci('mutadah', 7, 20)).toEqual({ baseHaid: 168, baseSuci: 480 });
    expect(getTargetNifas('mutadah', 40)).toBe(960);
  });

  it('returns mubtadiah status and fixed base values', () => {
    expect(getEffectiveStatus('mubtadiah', true)).toBe('mubtadiah');
    expect(getBaseHaidSuci('mubtadiah', 7, 20)).toEqual({ baseHaid: 24, baseSuci: 696 });
    expect(getTargetNifas('mubtadiah', 40)).toBe(0.01);
  });

  it('returns the final analysis result for HAID mode', () => {
    const logs = [
      { id: 1, start: '2026-01-01T00:00', end: '2026-01-03T00:00', durationHours: 48, color: 2 },
      { id: 2, start: '2026-01-04T00:00', end: '2026-01-05T00:00', durationHours: 24, color: 1 }
    ];

    const result = createAnalysisResult('HAID', logs, { userStatus: 'mutadah', lupaAdat: false, adatHaid: 7, adatSuci: 20, adatNifas: 40 });

    expect(result.mode).toBe('HAID');
    expect(result.engine).toContain('Engine v42');
    expect(result.qoul2).toBeDefined();
  });

  it('returns the final analysis result for NIFAS mode', () => {
    const logs = [
      { id: 1, start: '2026-01-01T00:00', end: '2026-01-03T00:00', durationHours: 48, color: 2 }
    ];

    const result = createAnalysisResult('NIFAS', logs, { userStatus: 'mutadah', lupaAdat: false, adatHaid: 7, adatSuci: 20, adatNifas: 40 });

    expect(result.mode).toBe('NIFAS');
    expect(result.status).toContain('NIFAS');
  });

  it('builds a copy-friendly result text from analysis', () => {
    const analysisResult = {
      qoul2: [
        { label: 'KD 2 Hari', details: ['2 Hari Haid'] },
        { label: 'B 1 Hari', details: ['1 Hari Suci'] }
      ]
    };

    const text = buildCopyTextFromAnalysis(analysisResult, 'HAID', { userStatus: 'mutadah', lupaAdat: false, adatNifas: 40, adatHaid: 7, adatSuci: 20, activeTab: 'QOUL_2' });

    expect(text).toContain('Ah 7 As 20');
    expect(text).toContain('Kd 2 Hari haid');
    expect(text).toContain('B 1 Hari suci');
  });
});
