# PENSaku Backend - AI Agent Instructions

## Konteks Proyek
Proyek ini adalah backend dari aplikasi **PENSaku** (Asisten Akademik Mahasiswa PENS). Backend ini bertugas untuk menyinkronkan data tugas, jadwal, dan presensi dari platform akademik kampus (ETHOL), serta mengelola manajemen *To-Do List* dan *Reminder* (notifikasi).

**Penting (Konteks Ekosistem):** Klien utama dari sistem backend ini adalah **Aplikasi Mobile Android** yang dibangun SEPENUHNYA menggunakan framework **React Native**. Semua perancangan *endpoint* API, sistem autentikasi, efisiensi *payload* data, dan pengiriman notifikasi harus dioptimalkan untuk komunikasi antar-server ke perangkat *mobile* berbasis React Native.

**Tech Stack & Arsitektur:**
- Frontend / Klien Mobile: **React Native (Android Only)**
- Backend Framework: Express.js
- Arsitektur API: **RESTful API**
- Bahasa Backend: TypeScript (ESM / NodeNext)
- Database & Auth: Supabase (PostgreSQL via Prisma ORM & Supabase SDK)
- Logging: **Pino** & **Pino-HTTP** (Structured JSON logging, dev pretty-print, auto data-redaction)
- Keamanan & Pembatasan Request: **express-rate-limit** (Tiered rate limiting: global API limiter & strict auth/sync limiter)
- Struktur Folder Backend (Monolith): Layer-based (`routes/`, `controllers/`, `services/`, `middlewares/`, `utils/`, `types/`)

## Aturan Ketat untuk AI (BACA SEBELUM MENULIS KODE)
1. **Pahami Struktur Proyek:** Sebelum menulis, memberikan, atau menyarankan kode apa pun, periksa dan baca terlebih dahulu struktur folder serta isi file proyek saat ini (terutama `package.json`, `app.ts`, `server.ts`). Jangan berasumsi mengenai library yang sudah ada.
2. **Berikan "Action Items" untuk saya:** Setiap kali Anda selesai memberikan kode untuk suatu fase, atau jika Anda memerlukan instalasi package baru/kredensial API, Anda WAJIB memberikan daftar langkah nyata (*Action Items*) yang jelas dan detail tentang apa yang harus dilakukan oleh saya (misal: "Jalankan command X", "Buat file Y", "Tambahkan token Z di .env").
3. **ESM Imports:** Proyek ini menggunakan `"module": "nodenext"`. Setiap *relative import* file lokal HARUS menggunakan ekstensi `.js` (contoh: `import { syncEthol } from './services/ethol.service.js';`). JANGAN gunakan `.ts` atau tanpa ekstensi.
4. **Layered Architecture:** 
   - `controllers/`: Hanya menangani eksekusi *Request/Response* HTTP.
   - `services/`: Berisi logika bisnis inti (Scraping, manipulasi data).
   - `routes/`: Hanya untuk mendefinisikan *endpoint* API.
   - `middlewares/`: Penanganan middleware (Autentikasi, Logging, Rate Limiting, Validasi request).
   - `utils/`: Utilitas pembantu terpusat (Logger, Helper).
5. **Standar RESTful & Modular Routing (PENTING):** Sistem ini wajib mematuhi standar RESTful API. **JANGAN PERNAH** menaruh kode definisi *endpoint* (logika bisnis HTTP) secara langsung di dalam file `app.ts` (kecuali untuk *route* global sederhana seperti `/health`). Semua *endpoint* harus dipecah berdasarkan fiturnya ke dalam folder `routes/` (misal: `routes/task.routes.ts`), lalu diimpor dan dipasang (*mounted*) di dalam `app.ts`.
6. **Optimasi Khusus Klien React Native (Android):** 
   - Autentikasi sepenuhnya wajib berbasis token via *header* `Authorization: Bearer` (React Native akan menyimpan token ini menggunakan AsyncStorage atau secure storage, jadi backend tidak boleh mengandalkan Cookie HttpOnly).
   - Pastikan *payload* response JSON seringkas mungkin dan buang properti database yang tidak dirender di UI React Native untuk menghemat transfer data perangkat *mobile*.
7. **Type Safety & Error Handling:** Selalu definisikan tipe/interface di `types/`. Jangan gunakan `any`. Gunakan pola `try-catch` di *controller* dengan format JSON konsisten: `{ status: 'success' | 'error', message: '...', data: ... }`.
8. **Logging Terstruktur (Pino):** Selalu gunakan logger terpusat (`src/utils/logger.ts`) untuk mencatat proses penting, lifecycle, atau error di layer `services/` dan `controllers/`. **JANGAN PERNAH** menggunakan `console.log()` secara langsung. Pastikan data sensitif (password, secret, token) tidak dicatat ke dalam log.
9. **Rate Limiting & Proteksi Endpoint:** Endpoint yang sensitif (seperti autentikasi login, verifikasi kredensial, dan pemicu *scraping*/sinkronisasi ke ETHOL kampus) **WAJIB** diproteksi dengan `authRateLimiter` dari `src/middlewares/rateLimiter.middleware.ts` untuk mencegah serangan *brute-force* dan melindungi IP server dari pemblokiran oleh server kampus.
10. JANGAN LUPA UNTUK SELALU MENGGUNAKAN PENDEKATAN `best-practice` DARI SEGI MANAPUN. JUGA UNTUK SELALU MENGGUNAKAN VERSI PALING TERBARU DARI PACKAGE, LIBRARY, DEPENDENCY, DSB..
11. Dari tiap package, library, dependency, dsb., selalu untuk menggunakan pendekatan yang sesuai dengan dokumentasi resmi paling terbaru dari tiap package, library, dependency, dsb..
