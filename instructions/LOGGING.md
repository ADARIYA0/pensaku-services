# Panduan Setup Logging System (PENSaku Backend)

## 🎯 Konteks & Tujuan

File ini berisikan instruksi spesifik untuk mengimplementasikan sistem logging yang terstruktur (*structured logging*), berkinerja tinggi, dan aman untuk backend **PENSaku** (Express.js + TypeScript). 

Mengingat backend ini melayani klien mobile Android (React Native) dan berjalan di lingkungan Docker, sistem logging harus memenuhi standar *best-practice*:
1. **Performa Tinggi & Non-blocking:** Menggunakan library modern berstandar industri (seperti **Winston** atau **Pino**) dengan *overhead* I/O seminimal mungkin.
2. **Format Terstruktur:** Menghasilkan output berformat **JSON** di lingkungan *production* (ramah untuk log aggregator, Docker stdout, dan Supabase Log Drains), serta format teks berwarna yang mudah dibaca (*pretty-printed*) pada lingkungan *development*.
3. **HTTP Request Logging:** Otomatis mencatat setiap request HTTP yang masuk (metode HTTP, URL endpoint, status code respon, response time, dan IP client).
4. **Data Masking / Keamanan:** Wajib menyaring (*redact/mask*) informasi sensitif seperti password, kredensial, dan token `Authorization: Bearer` agar tidak bocor ke dalam log.
5. **Layer-Friendly:** Menyediakan logger terpusat yang dapat diimpor dan digunakan secara bersih di seluruh layer (`controllers/`, `services/`, `middlewares/`).

---

## 🛠️ INSTRUKSI

*Baca file markdown `AGENTS.md` terlebih dahulu secara menyeluruh, teliti, dan detail. Setelah itu, baca dan jalankan langkah-langkah di bawah ini secara teliti untuk mengimplementasikan sistem logging.*

Jangan lupa untuk selalu mematuhi pendekatan `best-practice`, ESM Imports (`.js` extension), dan *type-safety*.

---

### Langkah 1: Persiapan Dependencies

1. **Pengecekan Library Logger:** 
   Pilih salah satu library logger modern yang sesuai dengan arsitektur Express ESM:
   - **Opsi Direkomendasikan (Pino):** `pino`, `pino-http`, dan `pino-pretty` (sebagai devDependency).
   - **Opsi Alternatif (Winston):** `winston`, `morgan`, beserta `@types/morgan`.
   Periksa `package.json`. Jika library belum ada, siapkan perintah instalasinya untuk saya.

2. **Manajemen Log Level:**
   Pastikan log level dapat dikonfigurasi melalui environment variable (misal: `LOG_LEVEL=info` atau `LOG_LEVEL=debug`).

---

### Langkah 2: Konfigurasi Environment Variables

Tambahkan variabel lingkungan baru yang relevan ke file `.env.example` dan `.env`:
- `LOG_LEVEL`: Tingkat kedalaman log (`debug` | `info` | `warn` | `error`), dengan nilai *fallback/default* `info`.

---

### Langkah 3: Pembuatan Core Logger Utility (`src/utils/logger.ts`)

Tuliskan kode untuk inisialisasi logger utama di `src/utils/logger.ts` dengan ketentuan:
1. **ESM Imports:** Pastikan semua import file lokal (jika ada) menggunakan ekstensi `.js`.
2. **Environment Awareness:** 
   - Pada mode `development`: Gunakan format yang mudah dibaca manusia (*pretty-print* dengan warna dan timestamp yang jelas).
   - Pada mode `production`: Gunakan output JSON standar ke `stdout` untuk kompatibilitas container Docker.
3. **Log Levels:** Mendukung level `debug`, `info`, `warn`, dan `error`.
4. **Sanitisasi / Masking:** Konfigurasikan penyaringan otomatis untuk properti sensitif (misal: `password`, `token`, `authorization`, `cookie`, `secret`).
5. **Export:** Ekspor instance logger sebagai default dan named export.

---

### Langkah 4: Pembuatan HTTP Request Logger Middleware (`src/middlewares/logger.middleware.ts`)

Tuliskan middleware untuk mencatat request HTTP yang masuk:
1. **Pencatatan Metadata Request:**
   - HTTP Method (GET, POST, PUT, DELETE, dll.)
   - URL / Path yang diakses
   - Status code HTTP dari respon
   - Waktu respons (*latency/response time* dalam milidetik)
   - User-Agent (mengidentifikasi klien React Native)
2. **Filter Endpoint Tertentu:**
   - Berikan opsi untuk tidak mencatat atau menurunkan log level pada endpoint health-check (`/health`) agar log tidak dipenuhi oleh polling health-check internal.

---

### Langkah 5: Pemasangan Middleware pada `src/app.ts`

Pasang middleware logger yang telah dibuat ke dalam instance Express pada file `src/app.ts` sebelum definisi route lainnya, sehingga setiap request HTTP yang masuk tercatat dengan baik.

---

### Langkah 6: Penyampaian "Action Items" kepada Saya

Setelah selesai membuat atau mengonfigurasi kode, Anda WAJIB memberikan panduan langkah nyata (*Action Items*) kepada saya yang mencakup:
1. Perintah terminal untuk menginstal *package* yang dibutuhkan di Langkah 1.
2. Format penulisan variabel baru ke dalam file `.env`.
3. Panduan singkat cara mengimpor dan menggunakan logger di layer `services/` atau `controllers/`.
4. Perintah untuk menguji sistem logging (misal menjalankan `npm run dev` dan memanggil endpoint `/health`).
