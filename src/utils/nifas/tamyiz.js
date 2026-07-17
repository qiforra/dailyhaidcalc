// src/utils/nifas/tamyiz.js
import { formatDuration, getColorLabel } from '../formatters';
import { analyzeHaidPeriods } from '../haid/engine';

export const processTamyizNifas = (periods, userConfig, effectiveStatus) => {
    // 1. Cari warna darah paling kuat secara mutlak
    let strongestColor = 5;
    let hasKD = false;
    periods.forEach(p => { 
        if (p.type === 'KD') {
            hasKD = true;
            if ((p.color || 5) < strongestColor) strongestColor = (p.color || 5); 
        }
    });
    
    if (!hasKD) return null;

    // 2. Cari blok darah kuat pertama & hitung darah lemah/jeda sebelumnya
    let firstStrongIdx = -1;
    let strongBloodTotal = 0;
    let weakBeforeTotal = 0;
    
    for(let i = 0; i < periods.length; i++) {
        if (periods[i].type === 'KD' && (periods[i].color || 5) === strongestColor) {
            if (firstStrongIdx === -1) firstStrongIdx = i;
            strongBloodTotal += periods[i].hours;
        } else {
            if (firstStrongIdx === -1) {
                weakBeforeTotal += periods[i].hours;
            }
        }
    }

    if (firstStrongIdx === -1) return null;

    // Syarat Tamyiz Nifas: Total darah kuat tidak boleh melebihi 60 hari
    if (strongBloodTotal > 60 * 24) return null;

    let breakdown = [];
    let remainingPeriods = [];
    let nifasPhase = true;
    let globalTime = 0;
    
    // 🚩 PERBAIKAN: Syarat mutlak darah lemah sebelum kuat menjadi Nifas -> Harus >= 15 hari
    const isWeakBeforeValidNifas = weakBeforeTotal >= 15 * 24;

    // 3. Ekstrak Fase Nifas
    for (let i = 0; i < periods.length; i++) {
        let p = periods[i];
        
        if (nifasPhase) {
            if (i < firstStrongIdx) {
                if (isWeakBeforeValidNifas) {
                    // Darah lemah/jeda sebelum darah kuat ikut Nifas (karena >= 15 hari)
                    let nifasTime = Math.min(p.hours, (60 * 24) - globalTime);
                    if (nifasTime > 0) {
                        let label = p.type === 'KD' ? `KD ${formatDuration(p.hours)} (${getColorLabel(p.color).split(' ')[0]})` : `B ${formatDuration(p.hours)}`;
                        let detail = p.type === 'KD' ? 'Nifas' : 'Suci (Jeda Nifas)';
                        breakdown.push({
                            label: label,
                            details: [`${formatDuration(nifasTime)} ${detail}`]
                        });
                        globalTime += nifasTime;
                        if (p.hours > nifasTime) {
                            remainingPeriods.push({ ...p, hours: p.hours - nifasTime });
                            nifasPhase = false;
                        }
                    } else {
                        remainingPeriods.push(p);
                        nifasPhase = false;
                    }
                } else {
                    // Darah lemah/jeda < 15 hari -> Mutlak Istihadhoh / Suci
                    let label = p.type === 'KD' ? `KD ${formatDuration(p.hours)} (${getColorLabel(p.color).split(' ')[0]})` : `B ${formatDuration(p.hours)}`;
                    let detail = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
                    breakdown.push({
                        label: label,
                        details: [`${formatDuration(p.hours)} ${detail}`]
                    });
                    globalTime += p.hours;
                }
            } else if (i === firstStrongIdx || (p.type === 'KD' && (p.color || 5) === strongestColor)) {
                // Blok darah kuat mutlak Nifas
                let nifasTime = Math.min(p.hours, (60 * 24) - globalTime);
                if (nifasTime > 0) {
                    breakdown.push({
                        label: `KD ${formatDuration(p.hours)} (${getColorLabel(p.color).split(' ')[0]})`,
                        details: [`${formatDuration(nifasTime)} Nifas`]
                    });
                    globalTime += nifasTime;
                    if (p.hours > nifasTime) {
                        remainingPeriods.push({ ...p, hours: p.hours - nifasTime });
                        nifasPhase = false;
                    }
                } else {
                    remainingPeriods.push(p);
                    nifasPhase = false;
                }
            } else {
                // Ketemu darah lemah / jeda suci SETELAH darah kuat -> Fase Nifas Berakhir
                nifasPhase = false;
                remainingPeriods.push(p);
            }
        } else {
            remainingPeriods.push(p);
        }
    }

    // 4. Evaluasi Sisa Periode & Transisi Lahzatu Kamalis Sittin (60 Hari)
    let postNifasPeriodsForHaidEngine = [];
    let crossed60 = false;

    for (let j = 0; j < remainingPeriods.length; j++) {
        let rp = remainingPeriods[j];
        let rpStart = globalTime;
        let rpEnd = globalTime + rp.hours;
        
        let detailStr = rp.type === 'KD' ? 'Istihadhoh' : 'Suci';

        if (rpStart <= 60 * 24 && !crossed60) {
            if (rpEnd <= 60 * 24) {
                const lbl = rp.type === 'KD' ? `KD ${formatDuration(rp.hours)}${rp.color ? ` (${getColorLabel(rp.color).split(' ')[0]})` : ''}` : `B ${formatDuration(rp.hours)}`;
                breakdown.push({
                    label: lbl,
                    details: [`${formatDuration(rp.hours)} ${detailStr}`]
                });
                globalTime += rp.hours;
            } else {
                const lbl = rp.type === 'KD' ? `KD ${formatDuration(rp.hours)}${rp.color ? ` (${getColorLabel(rp.color).split(' ')[0]})` : ''}` : `B ${formatDuration(rp.hours)}`;
                breakdown.push({
                    label: lbl,
                    details: [`${formatDuration(rp.hours)} ${detailStr}`]
                });
                globalTime += rp.hours;
                crossed60 = true; 
            }
        } else {
            postNifasPeriodsForHaidEngine.push(rp);
        }
    }

    const caseStatus = `Nifas ${effectiveStatus === 'mutadah' ? "Mu'tadah" : "Mubtada'ah"} Mumayyizah (Tamyiz)`;

    // 5. Handoff ke Mesin Haid
    if (postNifasPeriodsForHaidEngine.length > 0) {
        const haidConfig = {
            ...userConfig,
            userStatus: (userConfig.adatHaid > 0 && userConfig.adatSuci > 0) ? 'mutadah' : userConfig.userStatus
        };

        const haidResult = analyzeHaidPeriods(postNifasPeriodsForHaidEngine, 'QOUL_2', haidConfig);
        breakdown.push(...haidResult.breakdown);
        return {
            breakdown,
            meta: {
                isTamyizValid: true,
                fallbackReason: "",
                caseStatus: `${caseStatus} (Beralih ke: ${haidResult.meta.caseStatus})`
            }
        };
    }

    return {
        breakdown,
        meta: {
            isTamyizValid: true,
            fallbackReason: "",
            caseStatus
        }
    };
};
