// src/utils/nifas/cases.js
import { runStateMachine } from './stateMachine';

// Kasus 1: Mubtadiah Ghoiru Mumayyizah
export const processMubtadiahGhoiruMumayyizah = (periods, userConfig) => {
    const activeTargetNifas = 60 * 24; 
    const caseStatus = "Nifas Mubtada'ah Ghoiru Mumayyizah";
    
    return runStateMachine(periods, userConfig, activeTargetNifas, caseStatus, false);
};

// Kasus 2: Mu'tadah Ghoiru Mumayyizah
export const processMutadahGhoiruMumayyizah = (periods, userConfig) => {
    const { adatNifas } = userConfig;
    const activeTargetNifas = Math.min((Number.isNaN(adatNifas) ? 40 : adatNifas) * 24, 60 * 24);
    const caseStatus = "Nifas Mu'tadah Ghoiru Mumayyizah";

    return runStateMachine(periods, userConfig, activeTargetNifas, caseStatus, false);
};

// Kasus 3 & 4: Tamyiz (Mumayyizah)
export const processTamyiz = (periods, userConfig, tamyizResult, effectiveStatus) => {
    const activeTargetNifas = tamyizResult.strongBloodHours; 
    const caseStatus = `Nifas ${effectiveStatus === 'mutadah' ? "Mu'tadah" : "Mubtada'ah"} Mumayyizah (Tamyiz)`;

    return runStateMachine(periods, userConfig, activeTargetNifas, caseStatus, true);
};
