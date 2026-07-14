// src/utils/nifas/helpers.js

// Mendeteksi Istihadhoh (Apakah darah melewati batas maksimal nifas 60 hari?)
export const checkMustahadhah = (periods) => {
    let isMustahadhah = false;
    let normalNifasHours = 0;
    let currentAcc = 0;
    
    for (let p of periods) {
        if (p.type === 'B' && p.hours >= 15 * 24) { 
            normalNifasHours = currentAcc; 
            break; 
        }
        if (currentAcc + p.hours > 60 * 24) {
            if (p.type === 'KD') isMustahadhah = true; 
            else normalNifasHours = currentAcc; 
            break;
        }
        currentAcc += p.hours;
    }
    
    if (currentAcc > 0 && currentAcc < 60 * 24 && !isMustahadhah) {
        normalNifasHours = currentAcc;
    }

    return { normalNifasHours, isMustahadhah };
};

// Logika untuk mendeteksi darah kuat & lemah
export const checkTamyiz = (periods) => {
    let isValid = false;
    let strongBloodHours = 0;
    
    // TODO: Implementasi logika Tamyiz yang memeriksa p.color.
    // Contoh kondisi valid: darah kuat <= 60 hari && darah lemah >= 15 hari.
    
    return { isValid, strongBloodHours };
};
