// src/utils/nifas/index.js
import { checkMustahadhah } from './helpers';
import { runStateMachine } from './stateMachine';
import { 
    processMubtadiahGhoiruMumayyizah, 
    processMutadahGhoiruMumayyizah 
} from './cases';

// Impor Interceptor Tamyiz Spesifik Nifas
import { processTamyizNifas } from './tamyiz';

export const analyzeNifasPeriods = (periods, userConfig) => {
    const { userStatus, lupaAdat } = userConfig;
    const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
    
    const { normalNifasHours, isMustahadhah } = checkMustahadhah(periods);

    if (!isMustahadhah) {
        return runStateMachine(periods, userConfig, normalNifasHours, "Nifas Normal (Berhenti Tepat/Sebelum 60 Hari)", false);
    }

    // PENCEGAT TAMYIZ FIN NIFAS
    const specialTamyizCase = processTamyizNifas(periods, userConfig, effectiveStatus);
    
    if (specialTamyizCase) {
        return specialTamyizCase;
    } 
    
    // Fallback ke Ghoiru Mumayyizah jika Tamyiz gugur
    if (effectiveStatus === 'mutadah') {
        return processMutadahGhoiruMumayyizah(periods, userConfig);
    } else {
        return processMubtadiahGhoiruMumayyizah(periods, userConfig);
    }
};
