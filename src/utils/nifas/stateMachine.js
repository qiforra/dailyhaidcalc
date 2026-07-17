// src/utils/nifas/stateMachine.js
import { formatDuration, getColorLabel } from '../formatters';
import { analyzeHaidPeriods } from '../haid/engine'; 

export const runStateMachine = (periods, userConfig, activeTargetNifas, caseStatus, isTamyizValid) => {
    let breakdown = [];
    let meta = { isTamyizValid, fallbackReason: "", caseStatus };

    // 🚩 PINTU TOL: Syarat Wujud Nifas
    // Jika jeda wiladah (bersih) mencapai 15 hari atau lebih, NIFAS GUGUR.
    // Seluruh pendarahan otomatis dihukumi sebagai siklus Haid/Istihadhoh biasa.
    if (periods.length > 0 && periods[0].type === 'B' && periods[0].hours >= 15 * 24) {
        const haidConfig = {
            ...userConfig,
            userStatus: (userConfig.adatHaid > 0 && userConfig.adatSuci > 0) ? 'mutadah' : userConfig.userStatus
        };
        
        // Lempar array utuh langsung ke mesin Haid
        const haidResult = analyzeHaidPeriods(periods, 'QOUL_2', haidConfig);
        
        // Modifikasi sedikit label baris pertama agar user tahu ini adalah Jeda Wiladah
        if (haidResult.breakdown.length > 0 && haidResult.breakdown[0].label.startsWith('B')) {
            haidResult.breakdown[0].details = [`${formatDuration(periods[0].hours)} Suci (Jeda Wiladah / Tidak Ada Nifas)`];
        }

        breakdown.push(...haidResult.breakdown);
        meta.caseStatus = `Bukan Nifas (Beralih ke: ${haidResult.meta.caseStatus})`;
        return { breakdown, meta };
    }

    const { userStatus, lupaAdat, adatHaid, adatSuci } = userConfig;
    let cycleAdatSuci = (!Number.isNaN(adatSuci) && adatSuci > 0) ? adatSuci * 24 : (29 * 24); 
    
    let loopState = 'NIFAS';
    let targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
    let suciAcc = 0;
    let nifasAcc = 0;
    let globalTimeAcc = 0;
    let hasHandedOff = false;

    const pushDetail = (arr, hours, label) => {
        if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
    };

    periods.forEach((p, idx) => {
        if (hasHandedOff) return;

        let pLeft = p.hours;
        let detailsArr = [];

        // Penanganan Jeda Wiladah < 15 hari
        if (idx === 0 && p.type === 'B') {
            pushDetail(detailsArr, p.hours, "Suci (Jeda Wiladah)");
            globalTimeAcc += p.hours;
            loopState = 'SUCI'; // Masuk ke fase suci nifas sementara
            suciAcc = p.hours;
            pLeft = 0;
        }

        while (pLeft > 0.01) {
            let consume = 0;
            
            // ==========================================
            // 1. FASE NIFAS
            // ==========================================
            if (loopState === 'NIFAS') {
                let limit;
                if (p.type === 'KD') {
                    limit = Math.min(activeTargetNifas - nifasAcc, (60 * 24) - globalTimeAcc);
                } else {
                    limit = (60 * 24) - globalTimeAcc;
                }

                consume = Math.min(pLeft, limit);

                if (consume > 0) {
                    let label = p.type === 'KD' ? 'Nifas' : "Suci (Jeda Nifas)";
                    pushDetail(detailsArr, consume, label);
                    
                    if (p.type === 'KD') nifasAcc += consume; 
                    pLeft -= consume; 
                    globalTimeAcc += consume;
                }
                
                if ((p.type === 'KD' && nifasAcc >= activeTargetNifas) || globalTimeAcc >= 60 * 24 - 0.01) {
                    loopState = 'SUCI'; 
                    suciAcc = 0; 
                    targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
                }
            }
            // ==========================================
            // 2. FASE SUCI PASCA-NIFAS (TRANSISI KE HAID)
            // ==========================================
            else if (loopState === 'SUCI') {
                let limit = (p.type === 'B') ? pLeft : Math.max(0, targetSuci - suciAcc);
                consume = Math.min(pLeft, limit);
                
                if (consume > 0) {
                    let label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
                    pushDetail(detailsArr, consume, label);
                    suciAcc += consume; 
                    pLeft -= consume; 
                    globalTimeAcc += consume;
                }
                
                // Jika suci sudah genap dan muncul darah, langsung lempar ke Mesin Haid
                if (suciAcc >= targetSuci - 0.1 && pLeft > 0 && p.type === 'KD') {
                    let remainingPeriods = [];
                    remainingPeriods.push({ id: p.id || Date.now(), type: 'KD', hours: pLeft, color: p.color });
                    
                    for (let i = idx + 1; i < periods.length; i++) {
                        remainingPeriods.push(periods[i]);
                    }
                    
                    const haidConfig = {
                        ...userConfig,
                        userStatus: (userConfig.adatHaid > 0 && userConfig.adatSuci > 0) ? 'mutadah' : userConfig.userStatus
                    };
                    
                    const haidResult = analyzeHaidPeriods(remainingPeriods, 'QOUL_2', haidConfig);
                    
                    if (detailsArr.length > 0) {
                        breakdown.push({ 
                            label: `${p.type} ${formatDuration(p.hours - pLeft)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, 
                            details: [...detailsArr] 
                        });
                        detailsArr = [];
                    }
                    
                    breakdown.push(...haidResult.breakdown);
                    meta.caseStatus += ` (Beralih ke: ${haidResult.meta.caseStatus})`;
                    
                    hasHandedOff = true;
                    pLeft = 0; 
                    break;
                }
            }
        }
        
        if (detailsArr.length > 0 && !hasHandedOff) {
          breakdown.push({ 
              label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, 
              details: detailsArr 
          });
        }
    });

    return { breakdown, meta };
};
