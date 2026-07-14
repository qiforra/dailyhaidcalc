// src/utils/nifas/cases.js
import { runStateMachine } from './stateMachine';

// Kasus 1: Mubtadiah Ghoiru Mumayyizah
export const processMubtadiahGhoiruMumayyizah = (periods, userConfig) => {
    // PERBAIKAN: Menurut Qoul Mu'tamad (Ashoh), Mubtadi'ah Nifas yang Mustahadhah
    // dikembalikan ke Nifas minimal yaitu Majjatul Dam (Lahnzah / Setetes).
    // Kita gunakan 0.01 jam agar State Machine mencatatnya sebagai durasi terkecil.
    const activeTargetNifas = 0.01; 
    const caseStatus = "Nifas Mubtada'ah Ghoiru Mumayyizah (Qoul Mu'tamad: Nifas Setetes)";
    
    return runStateMachine(periods, userConfig, activeTargetNifas, caseStatus, false);
};

// Kasus 2: Mu'tadah Ghoiru Mumayyizah
export const processMutadahGhoiruMumayyizah = (periods, userConfig) => {
    // Untuk Mu'tadah, dikembalikan ke kebiasaan (Adat Nifas) sebelumnya
    const { adatNifas } = userConfig;
    const activeTargetNifas = Math.min((Number.isNaN(adatNifas) ? 40 : adatNifas) * 24, 60 * 24);
    const caseStatus = "Nifas Mu'tadah Ghoiru Mumayyizah";

    return runStateMachine(periods, userConfig, activeTargetNifas, caseStatus, false);
};

// Kasus 3 & 4: Tamyiz (Mumayyizah)
export const processTamyiz = (periods, userConfig, tamyizResult, effectiveStatus) => {
    // Dikembalikan ke durasi darah kuat (Tamyiz)
    const activeTargetNifas = tamyizResult.strongBloodHours; 
    const caseStatus = `Nifas ${effectiveStatus === 'mutadah' ? "Mu'tadah" : "Mubtada'ah"} Mumayyizah (Tamyiz)`;

    return runStateMachine(periods, userConfig, activeTargetNifas, caseStatus, true);
};
