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
        // Jika total darah LEBIH dari 60 hari (bahkan walau cuma 0.01 jam), baru statusnya Mustahadhah
        if (currentAcc + p.hours > 60 * 24) {
            if (p.type === 'KD') isMustahadhah = true; 
            else normalNifasHours = currentAcc; 
            break;
        }
        currentAcc += p.hours;
    }
    
    // PERBAIKAN: Menggunakan <= (kurang dari sama dengan) agar tepat 60 hari tetap dihitung Nifas
    if (currentAcc > 0 && currentAcc <= 60 * 24 && !isMustahadhah) {
        normalNifasHours = currentAcc;
    }

    return { normalNifasHours, isMustahadhah };
};

// Logika untuk mendeteksi darah kuat & lemah
export const checkTamyiz = (periods) => {
    let isValid = false;
    let strongBloodHours = 0;
    
    // TODO: Implementasi logika Tamyiz yang memeriksa p.color.
    
    return { isValid, strongBloodHours };
};
