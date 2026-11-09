# Panduan Setup Database Supabase & Prisma ORM (PENSaku Backend)

## 🎯 Konteks & Tujuan

File ini berisikan instruksi spesifik untuk membangun jembatan koneksi antara proyek Express.js (TypeScript) dengan database PostgreSQL di layanan Supabase. 

Mengingat proyek ini membutuhkan koneksi database langsung yang kuat, aman, dan memiliki *type-safety* tinggi untuk *backend* (Node.js), kita akan menggunakan **Prisma ORM** sebagai alat utama untuk berinteraksi dengan database PostgreSQL, dan tetap menggunakan **Supabase SDK** (dengan Service Role Key) khusus untuk keperluan administratif Auth/Storage jika diperlukan.

## 🛠️ INSTRUKSI

*Baca file markdown `AGENTS.md` terlebih dahulu secara menyeluruh, teliti, dan detail. Setelah itu, baca dan jalankan langkah-langkah di bawah ini secara teliti untuk membangun konektor database.*

### Langkah 1: Persiapan Dependencies (Prisma & Supabase)

1. Pengecekan SDK & ORM: Proyek ini membutuhkan Prisma ORM dan SDK resmi Supabase. Jika `prisma` (sebagai devDependency), `@prisma/client`, dan `@supabase/supabase-js` belum ada di `package.json`, siapkan perintah instalasinya untuk saya.

2. Manajemen Environment: Pastikan variabel environment dapat dibaca oleh Node.js.

### Langkah 2: Konfigurasi Environment Variables

Sistem membutuhkan **TIGA (3)** data rahasia untuk dapat melakukan inisialisasi:
1. Connection String PostgreSQL Langsung (URI format: `postgresql://...` atau `postgres://...` dengan parameter *connection pooling* Supabase jika ada).
2. URL Proyek Supabase.
3. Service Role Key Supabase.

Anda (AI) **bebas menggunakan nama variabel `.env` apa saja** untuk menyimpan ketiga data ini, asalkan penamaannya deskriptif (misalnya `DATABASE_URL` untuk Prisma, `SUPABASE_URL`, dsb).

**ATURAN KETAT:** Jangan pernah menuliskan kredensial secara *hardcode* di dalam kode. Selalu panggil variabel yang telah Anda tentukan tersebut melalui `process.env`.

### Langkah 3: Pembuatan File Konektor (`src/config/database.ts` atau sejenisnya)

Tuliskan kode untuk inisialisasi koneksi (misal di `src/config/prisma.ts` atau `src/config/supabase.ts`) dengan mematuhi spesifikasi berikut:

1. **ESM Imports:** Jika ada *import* file lokal lainnya, ingat untuk selalu menggunakan ekstensi `.js`.
2. **Inisialisasi Prisma Client:** Buat instance dari `PrismaClient` yang diimpor dari `@prisma/client`.
3. **Inisialisasi Supabase Client:** Gunakan fungsi `createClient` dari `@supabase/supabase-js` menggunakan variabel environment URL dan Service Role Key.
4. **Validasi Kredensial:** Pastikan ada mekanisme error yang jelas jika variabel environment tidak ditemukan.
5. **Export:** Ekspor instance Prisma (sebagai koneksi database utama) dan instance Supabase agar kelak bisa diimpor secara bersih oleh layer `services/`.

### Langkah 4: Penyampaian "Action Items" kepada Saya

Setelah Anda selesai menulis atau mengonfigurasi kode konektor, Anda WAJIB memberikan panduan langkah nyata (*Action Items*) kepada saya yang mencakup:

1. Perintah terminal untuk menginstal *package* yang dibutuhkan di Langkah 1.
2. Perintah inisialisasi Prisma (misal: `npx prisma init`).
3. Panduan navigasi dashboard Supabase untuk mendapatkan **Connection string URI** (Masuk ke **Project Settings > Database > Connection string > URI**). Beritahu saya untuk menyalin *Transaction URL* (Connection Pooler) jika disarankan oleh Prisma.
4. Panduan mendapatkan **Service Role Key** (Masuk ke **Project Settings > API**).
5. Format penulisan variabel ke dalam file `.env`.
6. Instruksi selanjutnya untuk saya menarik skema database dari Supabase ke Prisma (misal: `npx prisma db pull` dan `npx prisma generate`).