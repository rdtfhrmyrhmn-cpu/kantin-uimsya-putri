# Panduan Setup — Kantin Uimsya Putri

## 1. Struktur file

Salin file berikut ke root project Netlify:

- `index.html` — halaman login milik Anda.
- `supabase.js` — koneksi Supabase milik Anda.
- `app.html`
- `app.js`
- `style.css`
- `home.js`
- `netlify.toml`
- folder `assets/` berisi `logo.png`

Project ini tidak membutuhkan npm, framework, atau proses build. Netlify cukup menerbitkan folder root sebagai publish directory. Netlify memang hanya menerbitkan file yang berada di publish directory.

## 2. Supabase: buat project

1. Buka Supabase.
2. Buat project baru.
3. Catat `Project URL` dan `anon/public key`.
4. Masukkan kedua nilai tersebut di `supabase.js`.
5. Jangan pernah memasukkan `service_role key` ke frontend.

Contoh `supabase.js` yang kompatibel dengan project ini:

```js
const SUPABASE_URL = 'https://PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

Bila file Anda memakai nama variabel lain, buat alias global:

```js
window.supabaseClient = supabaseClient;
```

> `app.js` mencoba memakai `window.supabaseClient` terlebih dahulu, lalu `window.supabase`.

## 3. Supabase Auth untuk login username + password

Untuk keamanan, aplikasi ini memakai **Supabase Auth** sebagai pemilik password dan sesi. Tabel `kantin_users` berfungsi sebagai tabel profil/metadata username, bukan tempat menyimpan password asli.

Login username diubah menjadi email internal deterministik:

```text
username -> username@kantin-uimsya.local
```

Ini membuat form login Anda tetap memakai username + password tanpa menyimpan password sendiri di database.

Di Supabase Dashboard:

1. Buka **Authentication → Users**.
2. Tambahkan user secara manual.
3. Gunakan email internal seperti `admin@kantin-uimsya.local`.
4. Masukkan password awal.
5. Nonaktifkan kebutuhan konfirmasi email untuk skenario internal ini, sesuai pengaturan Auth project Anda.

> Jika halaman login Anda yang sekarang sudah menggunakan Supabase Auth, cukup pastikan email yang dipakai saat `signInWithPassword()` dibentuk dari username dengan pola yang sama.

## 4. SQL tabel utama

Jalankan SQL berikut di **SQL Editor**:

```sql
create extension if not exists pgcrypto;

create table if not exists public.kantin_data (
  id uuid default gen_random_uuid() primary key,
  record_id text unique not null,
  tipe text not null check (tipe in ('harian','pengeluaran','penarikan')),
  tgl text not null,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.kantin_users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create index if not exists idx_kantin_data_tipe_tgl on public.kantin_data(tipe,tgl);
```

### Isi awal tabel `kantin_users`

Karena password dikelola Supabase Auth, Anda dapat mengisi kolom hash dengan penanda:

```sql
insert into public.kantin_users (username, password_hash)
values ('admin', 'SUPABASE_AUTH')
on conflict (username) do nothing;
```

## 5. RLS yang disarankan

Karena `app.js` memakai Supabase Auth, aktifkan RLS:

```sql
alter table public.kantin_data enable row level security;
alter table public.kantin_users enable row level security;

create policy "auth users can read kantin data"
on public.kantin_data for select
to authenticated
using (true);

create policy "auth users can insert kantin data"
on public.kantin_data for insert
to authenticated
with check (true);

create policy "auth users can update kantin data"
on public.kantin_data for update
to authenticated
using (true)
with check (true);

create policy "auth users can delete kantin data"
on public.kantin_data for delete
to authenticated
using (true);

create policy "auth users can read usernames"
on public.kantin_users for select
to authenticated
using (true);
```

Kebijakan di atas cocok untuk aplikasi internal satu tim yang seluruh akun Auth-nya memang boleh melihat data kantin. Bila nanti ada beberapa unit dengan hak akses berbeda, tambahkan kolom `owner_id`/`unit_id` dan ubah policy agar setiap user hanya melihat datanya sendiri.

## 6. Sesuaikan halaman login yang sudah ada

Halaman `index.html` Anda harus melakukan login Supabase Auth. Pola dasarnya:

```js
const username = document.querySelector('#username').value.trim();
const password = document.querySelector('#password').value;
const email = `${username.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@kantin-uimsya.local`;

const { error } = await supabaseClient.auth.signInWithPassword({
  email,
  password
});

if (error) throw error;
location.href = 'app.html';
```

Setelah login berhasil, Supabase menyimpan sesi di browser. `app.js` memeriksa sesi tersebut sebelum membuka aplikasi.

## 7. Data yang disimpan

### Laporan harian

`tipe = 'harian'`

```json
{
  "pend1": 100000,
  "pend2": 50000,
  "titip1": 10000,
  "titip2": 5000,
  "titip3": 0,
  "tabungan": 20000
}
```

Rumus:

```text
Total = (Pend.I + Pend.II) - Titipan I - Titipan II - Titipan III - Tabungan
```

### Pengeluaran

`tipe = 'pengeluaran'`

```json
{
  "nominal": 25000,
  "keterangan": "Belanja bahan baku"
}
```

### Penarikan tabungan

`tipe = 'penarikan'`

```json
{
  "nominal": 100000,
  "keterangan": "Penarikan kas"
}
```

## 8. Aturan Jumat

Aplikasi menganggap Jumat sebagai hari libur otomatis berdasarkan `Date.getDay() === 5`.

Pada Jumat:

- form laporan harian dinonaktifkan;
- pengeluaran dinonaktifkan;
- penarikan tabungan dinonaktifkan;
- tombol simpan menolak transaksi;
- dashboard tetap dapat melihat data Jumat lama bila memang ada.

## 9. Cetak B5

Tombol **Cetak B5** memanggil `window.print()`. CSS sudah menyertakan:

```css
@page { size: B5 portrait; margin: 10mm; }
```

Saat print, elemen navigasi dan kontrol aplikasi disembunyikan sehingga halaman laporan lebih bersih.

## 10. Ekspor CSV

Halaman Ekspor menyediakan:

- Semua data
- Laporan harian
- Pengeluaran
- Penarikan

File CSV memakai UTF-8 BOM agar karakter Indonesia lebih aman dibuka di Excel.

## 11. Dashboard

Pilihan periode:

- 1 bulan
- 3 bulan
- 6 bulan
- 1 tahun
- 2 tahun

Dashboard menghitung pendapatan, titipan, tabungan, pengeluaran, penarikan, dan arus bersih per bulan langsung dari data Supabase.

## 12. Deploy ke Netlify

### Cara paling mudah: GitHub

1. Buat repository GitHub baru.
2. Upload seluruh isi project.
3. Masuk Netlify.
4. Pilih **Add new site → Import an existing project**.
5. Pilih repository GitHub.
6. Karena project ini vanilla static, build command dapat dikosongkan dan publish directory adalah `.`.
7. Deploy.

`netlify.toml` sudah menyediakan publish directory dan redirect `/app` → `app.html`. Netlify mendukung konfigurasi redirect melalui `netlify.toml`.

### Deploy manual

Anda juga dapat drag-and-drop folder project ke Netlify. Pastikan file `index.html`, `app.html`, `supabase.js`, `app.js`, `home.js`, `style.css`, `netlify.toml`, dan `assets/logo.png` ikut ter-upload.

## 13. Pengaturan keamanan Netlify

Supabase URL dan anon key boleh berada di frontend karena memang public client credential. Jangan menyimpan:

- `service_role key`
- password database PostgreSQL
- token admin
- credential API rahasia

Netlify menyarankan environment variable rahasia disimpan di UI/konfigurasi environment, bukan dimasukkan ke repository.

## 14. Checklist setelah deploy

- [ ] `index.html` membuka tanpa 404.
- [ ] Login username/password berhasil.
- [ ] Setelah login diarahkan ke `app.html`.
- [ ] Data laporan dapat disimpan.
- [ ] Pengeluaran dapat disimpan.
- [ ] Penarikan dapat disimpan.
- [ ] Dashboard menampilkan ringkasan.
- [ ] Ekspor CSV terunduh.
- [ ] Cetak menghasilkan ukuran B5.
- [ ] Jumat menolak transaksi baru.
- [ ] Tombol Keluar menghapus sesi dan kembali ke login.

## 15. Catatan penting untuk pengembangan berikutnya

Implementasi ini sengaja dibuat sebagai aplikasi satu unit internal: semua user Auth yang lolos RLS dapat mengakses tabel `kantin_data`. Untuk aplikasi multi-unit atau hak akses kasir/admin, tambahkan `auth_user_id` atau `unit_id` ke `kantin_data` dan gunakan RLS berbasis `auth.uid()`.

Netlify tidak memerlukan server Node untuk project ini. `netlify.toml` hanya mengatur publish directory dan routing.
