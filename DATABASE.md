# Panduan Setup Database Supabase (PENSaku Backend)

## 🎯 Konteks & Tujuan

File ini berisikan instruksi spesifik untuk membangun jembatan koneksi antara proyek Express.js (TypeScript) dengan layanan Supabase (PostgreSQL). Mengingat proyek ini berfungsi sebagai *backend* (Node.js) murni yang menjembatani klien React Native, kita wajib menggunakan **Service Role Key**, bukan *Anon/Public Key*, agar *backend* memiliki hak akses administratif yang tidak dibatasi oleh *Row Level Security* (RLS) di Supabase.

## 🛠️ INSTRUKSI

*Baca file markdown `AGENTS.md` terlebih dahulu secara menyeluruh, teliti, dan detail. Setelah itu, baca dan jalankan langkah-langkah di bawah ini secara teliti untuk membangun konektor database.*

### Langkah 1: Persiapan Dependencies

1. Pengecekan SDK: Proyek ini membutuhkan SDK resmi Supabase. Jika `@supabase/supabase-js` belum ada di `package.json`, siapkan perintah instalasinya untuk saya.

2. Manajemen Environment: Pastikan variabel environment dapat dibaca oleh Node.js. Jika perlu, sarankan saya untuk menginstal `dotenv` (beserta `@types/dotenv`) untuk memuat nilai dari file `.env`.

### Langkah 2: Konfigurasi Environment Variables

Sistem membutuhkan dua data rahasia untuk dapat melakukan inisialisasi, yaitu URL proyek dan Service Role Key. Anda (AI) **bebas menggunakan nama variabel `.env` apa saja** untuk menyimpan kedua data ini (misalnya `SUPABASE_URL`, `DATABASE_KEY`, dsb), asalkan penamaannya deskriptif dan masuk akal.

**ATURAN KETAT:** Jangan pernah menuliskan kredensial secara *hardcode* di dalam kode. Selalu panggil variabel yang telah Anda tentukan tersebut melalui `process.env`.

### Langkah 3: Pembuatan File Konektor (`src/config/supabase.ts`)

Tuliskan kode untuk file `src/config/supabase.ts` dengan mematuhi spesifikasi berikut:

1. **ESM Imports:** Jika ada *import* file lokal lainnya, ingat untuk selalu menggunakan ekstensi `.js` (meskipun untuk file ini kemungkinan besar Anda hanya akan mengimpor modul eksternal dari `node_modules`).

2. **Validasi Kredensial:** Buat blok validasi. Jika salah satu atau kedua variabel environment yang Anda pilih di Langkah 2 berstatus `undefined`, lemparkan error (`throw new Error(...)`) yang menghentikan sistem dengan pesan log yang jelas bahwa kredensial belum diatur.

3. **Inisialisasi Client:** Gunakan fungsi `createClient` dari `@supabase/supabase-js` dan masukkan variabel environment tersebut.

4. **Export:** Ekspor instance client Supabase tersebut sebagai default (atau named export) agar kelak bisa diimpor secara bersih oleh layer `services/`.

### Langkah 4: Penyampaian "Action Items" kepada Saya

Setelah Anda selesai menulis atau mengonfigurasi kode `src/config/supabase.ts`, Anda WAJIB memberikan panduan langkah nyata (*Action Items*) kepada saya yang mencakup:

1. Perintah terminal untuk menginstal *package* yang dibutuhkan di Langkah 1.

2. Panduan navigasi dashboard Supabase (Masuk ke **Project Settings > API**).

3. Peringatan tegas untuk menyalin **Service Role Key** (berlabel rahasia/secret), bukan *anon key*.

4. Format penulisan variabel ke dalam file `.env` (sesuai dengan nama variabel yang Anda tentukan di Langkah 2).