
# 🩸 DailyHaid & Nifas Engine

Aplikasi berbasis React untuk menghitung, menganalisis, dan memecahkan kasus siklus Haid serta Nifas secara otomatis. Algoritma (Engine) di balik aplikasi ini dirancang secara ketat untuk mematuhi kaidah **Fiqih Mazhab Syafi'i (Qoul Mu'tamad)**.

Aplikasi ini tidak sekadar menghitung durasi, melainkan mampu menganalisis kasus-kasus kompleks seperti perpaduan adat, perbedaan warna darah, hingga pendarahan yang terputus-putus.

## ✨ Fitur Utama

* **Mode Kalkulasi Fleksibel:** Mendukung analisis khusus untuk siklus **Haid** dan siklus **Nifas**.
* **Konteks Keadatan (Status Wanita):**
* **Mubtadi'ah:** Pemula yang belum memiliki adat (kebiasaan).
* **Mu'tadah:** Wanita yang sudah memiliki adat (AH, AS, AN), termasuk opsi *Mutahayyirah* (Lupa Adat).


* **Mesin Tamyiz Presisi:** Mampu mendeteksi dan memisahkan darah kuat (*Qawiy*) dan darah lemah (*Dha'if* / *Adh'af*) dengan mematuhi syarat-syarat Tamyiz (seperti Fashil 15 hari).
* **Penyelesaian Kasus Fiqih Kompleks:**
* **Ghoiru Mumayyizah:** Penyelesaian dengan Adat Asal atau Adat Terakhir.
* **Taqothu' & Takmil:** Logika cerdas untuk darah yang terputus-putus dan penyempurnaan masa suci minimal (15 hari).
* **Qoul Sahbi (Laqthi):** Pengecekan jeda bersih (suci) yang diapit oleh darah haid.
* **Haid Mundur (Dam Muthatorrif):** Kalkulasi akurat saat darah keluar kurang dari batas minimal 24 jam.
* **Lahzatu Kamalis Sittin:** Pengawalan batas mutlak 60 hari pada masa nifas.


* **Handoff Nifas ke Haid:** Mesin secara otomatis mendelegasikan sisa pendarahan pasca-nifas (setelah 60 hari atau masa nifas selesai) ke dalam hukum Haid.
* **Ekspor Data:** Tombol praktis untuk menyalin rincian soal (input) dan hasil jawaban analisis.

---

## 🛠️ Tech Stack

| Teknologi | Deskripsi |
| --- | --- |
| **React (Vite)** | Core UI framework untuk render yang cepat dan responsif. |
| **Tailwind CSS** | Styling modern yang simpel, bersih (*clean*), dan mudah dikustomisasi. |
| **Lucide React** | Ikon vektor minimalis dan tajam. |
| **Vanilla JavaScript** | Logika inti (*State Machine*) untuk kalkulasi fiqih tanpa dependensi eksternal. |

---

## 📂 Struktur Mesin Logika (Engine Architecture)

Kode inti Fiqih dipisah menjadi sistem modular agar mudah dikembangkan dan di- *debug*.

* `src/utils/haid/`
* `engine.js`: Pengendali utama alur analisis Haid.
* `ghoiruMumayyizah.js`: Mesin pemecah kasus darah tanpa pembedaan warna (Taqothu', Takmil, Qoul Sahbi).
* `tamyiz.js`: Algoritma deteksi syarat-syarat Tamyiz (darah kuat, lemah, dan pemisah suci).
* `mutadahMumayyizah.js`: Logika khusus (*Interceptor*) untuk perpaduan Adat dan Tamyiz.


* `src/utils/nifas/`
* `index.js`: Titik masuk analisis Nifas.
* `stateMachine.js`: Mesin penghitung durasi Nifas dan *handoff* (delegasi) ke mesin Haid.
* `tamyiz.js`: Aturan khusus Tamyiz dalam lingkup Nifas (batas 60 hari sejak kelahiran).


* `src/utils/textParser.js`: Modul *Natural Language* sederhana untuk membaca input cepat (contoh: `kd 10 b 15 kd 5`).

---

## 🚀 Instalasi & Menjalankan Aplikasi

Pastikan Anda sudah menginstal Node.js di komputer Anda.

**1. Clone repositori ini**

```bash
git clone https://github.com/username/dailyhaid-engine.git
cd dailyhaid-engine

```

**2. Instal dependensi**

```bash
npm install

```

**3. Jalankan *development server***

```bash
npm run dev

```

Buka `http://localhost:5173` di browser Anda untuk mulai menggunakan aplikasi.

---

## 📝 Cara Penggunaan (Input Cepat)

Anda dapat memasukkan data secara manual lewat kalender, atau menggunakan mode **Input Cepat** dengan format teks sederhana.

**Panduan Format:**

* `AH: [angka]` = Adat Haid
* `AS: [angka]` = Adat Suci
* `AN: [angka]` = Adat Nifas
* `KD: [angka]` = Keluar Darah (bisa ditambahkan warna seperti Hitam, Merah, Kuning, Keruh).
* `B: [angka]` = Bersih / Jeda

**Contoh Input Kasus Tamyiz:**

```text
AH: 7
AS: 20
KD 5 (Keruh)
KD 10 (Hitam)
KD 3 (Merah)
KD 10 (Kuning)

```

---

## ⚠️ Disklaimer

Aplikasi ini dirancang berdasarkan literatur dan literasi Fiqih Mazhab Syafi'i tingkat lanjut. Namun, karena kompleksitas hukum biologi dan syariat, hasil dari kalkulator ini sebaiknya diposisikan sebagai **alat bantu dan pembanding**. Untuk keputusan final ibadah, sangat disarankan untuk tetap berkonsultasi ( *tashih* ) kepada Ustadz, Ning, atau lembaga *Bahtsul Masail* terdekat.
