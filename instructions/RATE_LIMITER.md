# Panduan Setup Rate Limiting System (PENSaku Backend)

## 🎯 Konteks & Tujuan

File ini berisikan instruksi spesifik untuk mengimplementasikan sistem pembatasan laju permintaan (*Rate Limiting*) pada backend **PENSaku** (Express.js + TypeScript).

Mengingat backend ini berfungsi sebagai jembatan sinkronisasi data akademik kampus (ETHOL) untuk klien mobile React Native (Android) dan terhubung dengan PostgreSQL di Supabase, sistem pembatasan laju permintaan sangat krusial untuk:
1. **Mencegah Serangan Brute-Force & Credential Stuffing:** Melindungi endpoint autentikasi dari upaya percobaan login massal yang dapat menyebabkan akun kampus mahasiswa terkunci.
2. **Melindungi Akun & IP Server dari Pemblokiran Kampus:** Proses scraping ke server ETHOL kampus harus dibatasi agar server kampus tidak memblokir IP backend atau menandai aktivitas sebagai serangan DoS.
3. **Mencegah Resource Exhaustion (DoS):** Menjaga performa server Express dan kuota koneksi Supabase PostgreSQL dari lonjakan request berlebihan.
4. **Respon Standar untuk Klien React Native:** Memberikan respon error HTTP 429 (*Too Many Requests*) dengan format JSON konsisten yang mudah ditangani oleh aplikasi mobile React Native, lengkap dengan informasi waktu tunggu (*Retry-After* header).

---

## 🛠️ INSTRUKSI

*Baca file markdown `AGENTS.md` terlebih dahulu secara menyeluruh, teliti, dan detail. Setelah itu, baca dan jalankan langkah-langkah di bawah ini secara teliti untuk mengimplementasikan sistem rate limiter.*

Jangan lupa untuk selalu mematuhi pendekatan `best-practice`, ESM Imports (`.js` extension), dan *type-safety* (tanpa `any`).

---

### Langkah 1: Persiapan Dependencies

1. **Pengecekan Library Rate Limiter:**
   Gunakan library standar industri yang ringan, aman, dan kompatibel penuh dengan TypeScript ESM:
   - **`express-rate-limit`**: Library rate limiting resmi dan paling banyak digunakan untuk Express.
   Periksa `package.json`. Jika library belum ada, siapkan perintah instalasinya untuk saya.

2. **Dukungan Reverse Proxy & Docker:**
   Pastikan konfigurasi Express memperhitungkan lingkungan container Docker dan reverse proxy (pengaturan `app.set('trust proxy', 1)` di Express) agar alamat IP klien React Native terbaca dengan benar.

---

### Langkah 2: Konfigurasi Environment Variables

Sistem membutuhkan variabel lingkungan untuk mengatur toleransi rate limiting secara fleksibel antara mode *development* dan *production*:
- `RATE_LIMIT_WINDOW_MINUTES`: Jendela waktu pemantauan dalam satuan menit (default: `15`).
- `RATE_LIMIT_MAX_REQUESTS`: Batas maksimal request umum per IP dalam jendela waktu tersebut (default: `100`).
- `RATE_LIMIT_AUTH_MAX_REQUESTS`: Batas maksimal request khusus untuk endpoint sensitif seperti autentikasi atau sinkronisasi kampus (default: `5` atau `10`).

Tambahkan variabel-variabel tersebut ke file `.env.example` dan `.env`.

---

### Langkah 3: Pembuatan Middleware Rate Limiter (`src/middlewares/rateLimiter.middleware.ts`)

Tuliskan kode middleware di `src/middlewares/rateLimiter.middleware.ts` dengan ketentuan arsitektur berikut:

1. **ESM Imports:** Pastikan semua import file lokal menggunakan ekstensi `.js`.
2. **Kustomisasi Respon JSON (Sesuai Aturan AGENTS.md):**
   Saat batas terlampaui, kembalikan HTTP status `429 Too Many Requests` dengan format JSON yang konsisten:
   ```json
   {
     "status": "error",
     "message": "Too many requests from this IP, please try again later.",
     "data": null
   }
   ```
3. **Standar HTTP Headers:**
   Aktifkan *standard headers* (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` via opsi `standardHeaders: 'draft-8'` atau `'draft-7'`) dan nonaktifkan legacy headers (`legacyHeaders: false`).
4. **Pengecualian (*Skip Function*):**
   Jangan batasi request ke endpoint internal health check (`/health`) agar monitoring server tidak terganggu.
5. **Pemisahan Tingkat Pembatasan (*Tiering*):**
   - **`globalRateLimiter`**: Pembatas umum untuk seluruh endpoint API publik.
   - **`authRateLimiter`**: Pembatas ketat khusus untuk endpoint autentikasi, verifikasi kredensial, dan pemicu sinkronisasi kampus (scraping).
6. **Export:** Ekspor kedua middleware tersebut secara terpisah (*named export*).

---

### Langkah 4: Pemasangan Middleware pada `src/app.ts` & Layer Routes

1. Pasang `globalRateLimiter` di dalam `src/app.ts` sebelum route lainnya didaftarkan.
2. Siapkan `authRateLimiter` agar siap dipasang pada file route spesifik di `src/routes/` (misal route auth atau sync) saat route tersebut dibuat.

---

### Langkah 5: Penyampaian "Action Items" kepada Saya

Setelah selesai membuat atau mengonfigurasi kode, Anda WAJIB memberikan panduan langkah nyata (*Action Items*) kepada saya yang mencakup:
1. Perintah terminal untuk menginstal *package* yang dibutuhkan di Langkah 1.
2. Format penulisan variabel baru ke dalam file `.env`.
3. Panduan singkat cara menguji pembatasan laju request (misal menggunakan cURL, Postman, atau loop request cepat di terminal untuk memicu status 429).
