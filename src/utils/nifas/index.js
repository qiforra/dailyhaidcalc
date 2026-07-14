// src/utils/nifas/index.js
import { checkMustahadhah, checkTamyiz } from './helpers';
import { runStateMachine } from './stateMachine';
import { 
    processMubtadiahGhoiruMumayyizah, 
    processMutadahGhoiruMumayyizah, 
    processTamyiz 
} from './cases';

export const analyzeNifasPeriods = (periods, userConfig) => {
    const { userStatus, lupaAdat } = userConfig;
    const effectiveStatus = (userStatus === 'mutadah' && !lupaAdat) ? 'mutadah' : 'mubtadiah';
    
    const { normalNifasHours, isMustahadhah } = checkMustahadhah(periods);

    if (!isMustahadhah) {
        return runStateMachine(periods, userConfig, normalNifasHours, "Nifas Normal (Berhenti Sebelum 60 Hari)", false);
    }

    const tamyizResult = checkTamyiz(periods);

    if (tamyizResult.isValid) {
        return processTamyiz(periods, userConfig, tamyizResult, effectiveStatus);
    } else {
        if (effectiveStatus === 'mutadah') {
            return processMutadahGhoiruMumayyizah(periods, userConfig);
        } else {
            return processMubtadiahGhoiruMumayyizah(periods, userConfig);
        }
    }
};
