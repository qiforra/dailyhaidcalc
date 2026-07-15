// src/utils/nifas/stateMachine.js
import { formatDuration, getColorLabel } from '../formatters';

export const runStateMachine = (periods, userConfig, activeTargetNifas, caseStatus, isTamyizValid) => {
    const { userStatus, lupaAdat, adatHaid, adatSuci } = userConfig;
    const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';

    const baseHaid = (!Number.isNaN(adatHaid) && adatHaid > 0) ? adatHaid * 24 : 24; 
    const baseSuci = (!Number.isNaN(adatSuci) && adatSuci > 0) ? adatSuci * 24 : (29 * 24); 

    let breakdown = [];
    let meta = { isTamyizValid, fallbackReason: "", effectiveStatus, caseStatus };

    let loopState = 'NIFAS';
    let cycleAdatHaid = baseHaid;
    let cycleAdatSuci = baseSuci;
    
    let targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
    let targetHaid = cycleAdatHaid;
    
    let suciAcc = 0;
    let haidAcc = 0;
    let nifasAcc = 0;
    let globalTimeAcc = 0;
    let hasUsedNifasSeparator = false;
    let nifasSuciBypassAvailable = false; 

    const pushDetail = (arr, hours, label) => {
        if (hours > 0) arr.push(`${formatDuration(hours)} ${label}`);
    };

    periods.forEach((p, idx) => {
        let pLeft = p.hours;
        let detailsArr = [];

        if (idx === 0 && p.type === 'B') {
            if (p.hours >= 15 * 24) {
                pushDetail(detailsArr, p.hours, "Suci (Jeda Wiladah / Nifas 'Adadan)");
                globalTimeAcc += p.hours;
                loopState = 'SUCI';
                suciAcc = p.hours;
                activeTargetNifas = 0; 
                pLeft = 0;
            }
        }

        while (pLeft > 0.01) {
            let consume = 0;
            
            if (loopState === 'NIFAS') {
                consume = Math.min(pLeft, activeTargetNifas - nifasAcc);
                if (consume > 0) {
                    let label = p.type === 'KD' ? 'Nifas' : "Suci (Jeda Wiladah / Nifas 'Adadan)";
                    pushDetail(detailsArr, consume, label);
                    nifasAcc += consume; 
                    pLeft -= consume; 
                    globalTimeAcc += consume;
                }
                if (nifasAcc >= activeTargetNifas) {
                    loopState = 'SUCI'; 
                    suciAcc = 0; 
                    targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
                }
            }
            else if (loopState === 'SUCI') {
                let isNormalKDAfter15B = false;
                if (p.type === 'KD' && suciAcc >= (15 * 24 - 0.1) && suciAcc < targetSuci) {
                    let totalContinuousKD = pLeft;
                    for (let k = idx + 1; k < periods.length; k++) {
                        if (periods[k].type === 'KD') totalContinuousKD += periods[k].hours;
                        else break;
                    }
                    if (totalContinuousKD <= 15 * 24) {
                        isNormalKDAfter15B = true;
                    }
                }

                if ((suciAcc >= targetSuci - 0.1 && p.type === 'KD') || 
                    (nifasSuciBypassAvailable && p.type === 'KD') || 
                    isNormalKDAfter15B) {
                    loopState = 'HAID'; 
                    haidAcc = 0;
                    cycleAdatSuci = suciAcc; 
                    targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
                    targetHaid = cycleAdatHaid; 
                    nifasSuciBypassAvailable = false; 
                    hasUsedNifasSeparator = true;     
                    continue; 
                }
                
                let limit = (p.type === 'B') ? pLeft : Math.max(0, targetSuci - suciAcc);
                consume = Math.min(pLeft, limit);
                if (!hasUsedNifasSeparator && p.type === 'B' && (globalTimeAcc + consume) >= 60 * 24 - 0.01) {
                    nifasSuciBypassAvailable = true;
                }
                if (consume > 0) {
                    let label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
                    pushDetail(detailsArr, consume, label);
                    suciAcc += consume; 
                    pLeft -= consume; 
                    globalTimeAcc += consume;
                }
                
                if (suciAcc >= targetSuci - 0.1 && pLeft > 0 && p.type === 'KD') {
                     loopState = 'HAID'; 
                     haidAcc = 0;
                     cycleAdatSuci = suciAcc; 
                     targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci;
                     targetHaid = cycleAdatHaid; 
                     hasUsedNifasSeparator = true;
                }
            }
            else if (loopState === 'HAID') {
                
                // 🚩 PERBAIKAN: Lookahead untuk merestui sisa darah Nifas sebagai Haid penuh
                if (haidAcc === 0 && p.type === 'KD') {
                    let remainingTime = pLeft;
                    for (let i = idx + 1; i < periods.length; i++) {
                        if (periods[i].type === 'B' && periods[i].hours >= 15 * 24) break;
                        remainingTime += periods[i].hours;
                    }
                    if (remainingTime <= 15 * 24) {
                        targetHaid = 15 * 24;
                    } else {
                        targetHaid = cycleAdatHaid;
                    }
                }

                consume = Math.min(pLeft, targetHaid - haidAcc);
                if (p.type === 'KD') {
                    if (consume > 0) {
                        pushDetail(detailsArr, consume, 'Haid');
                        haidAcc += consume; 
                        pLeft -= consume; 
                        globalTimeAcc += consume;
                    }
                    if (haidAcc >= targetHaid) { 
                        loopState = 'SUCI'; 
                        suciAcc = 0; 
                        cycleAdatHaid = targetHaid; 
                        targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci; 
                    }
                } else {
                    cycleAdatHaid = haidAcc; 
                    targetSuci = cycleAdatSuci < 15 * 24 ? 15 * 24 : cycleAdatSuci; 
                    loopState = 'SUCI'; 
                    suciAcc = 0; 
                }
            }
        }
        
        if (detailsArr.length > 0) {
          breakdown.push({ 
              label: `${p.type} ${formatDuration(p.hours)}${p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : ''}`, 
              details: detailsArr 
          });
        }
    });

    return { breakdown, meta };
};
