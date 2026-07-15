// src/utils/haid/mutadahMumayyizah.js
import { formatDuration, getColorLabel } from '../formatters';

export const processMutadahMumayyizahSpecialCase = (spanPeriods, userConfig) => {
    const { adatHaid } = userConfig;
    const baseHaid = (!Number.isNaN(adatHaid) && adatHaid > 0) ? adatHaid * 24 : 24;

    // Pastikan minimal ada 2 periode untuk membandingkan warna
    if (spanPeriods.length < 2) return null;

    const first = spanPeriods[0];
    const second = spanPeriods[1];

    const firstColor = first.color || 5; // Default lemah jika tak ada warna
    const secondColor = second.color || 5;

    // Cek jika KD pertama lemah dan KD kedua lebih kuat (angka warna lebih kecil = lebih kuat)
    if (first.type === 'KD' && second.type === 'KD' && (firstColor > secondColor)) {
        
        // Syarat: Darah lemah harus mencukupi Adat Haid + Batas Minimal Suci (15 hari)
        const minWeakDuration = baseHaid + (15 * 24); 

        if (first.hours >= minWeakDuration) {
            let breakdown = [];
            
            // 1. Pecah darah lemah menjadi Haid (Adat) dan Istihadhoh (Suci)
            const haidAdatHours = baseHaid;
            const istihadhohSuciHours = first.hours - haidAdatHours;
            
            breakdown.push({
                label: `KD ${formatDuration(first.hours)} (${getColorLabel(firstColor).split(' ')[0]})`,
                details: [
                    `${formatDuration(haidAdatHours)} Haid (Adat)`,
                    `${formatDuration(istihadhohSuciHours)} Istihadhoh (Suci)`
                ]
            });

            // 2. Darah kuat yang datang setelahnya dihukumi Haid (Tamyiz)
            const haidTamyizHours = Math.min(second.hours, 15 * 24);
            const sisaTamyiz = second.hours - haidTamyizHours;
            
            let secondDetails = [`${formatDuration(haidTamyizHours)} Haid (Tamyiz)`];
            if (sisaTamyiz > 0) secondDetails.push(`${formatDuration(sisaTamyiz)} Istihadhoh`);

            breakdown.push({
                label: `KD ${formatDuration(second.hours)} (${getColorLabel(secondColor).split(' ')[0]})`,
                details: secondDetails
            });

            // 3. Tangani sisa rentang waktu (misal KD ke-3 atau Jeda B) sebagai Istihadhoh/Suci
            for (let i = 2; i < spanPeriods.length; i++) {
                const p = spanPeriods[i];
                const label = p.type === 'KD' ? 'Istihadhoh' : 'Suci';
                const colorSuffix = p.color ? ` (${getColorLabel(p.color).split(' ')[0]})` : '';
                breakdown.push({
                     label: `${p.type} ${formatDuration(p.hours)}${colorSuffix}`,
                     details: [`${formatDuration(p.hours)} ${label}`]
                });
            }

            return {
                breakdown,
                meta: { 
                    caseStatus: "Mu'tadah Mumayyizah (Kombinasi Adat & Tamyiz)", 
                    cycleAdatHaid: haidTamyizHours // Adat haid baru otomatis terbentuk dari Tamyiz
                }
            };
        }
    }

    // Jika syarat tidak terpenuhi, kembalikan null agar mesin melanjutkan ke flow normal
    return null; 
};
