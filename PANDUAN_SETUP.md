# PANDUAN SETUP — Kantin Uimsya Putri Profesional

Versi ini mengembangkan aplikasi menjadi sistem keuangan kantin yang lebih umum, sambil mempertahankan modul khusus kantin.

## 1. Isi folder

Pastikan root repository berisi:

- `index.html`
- `app.html`
- `app.js`
- `home.js`
- `style.css`
- `supabase.js`
- `netlify.toml`
- `database.sql`
- `assets/logo.png`

Tidak ada framework dan tidak ada build command.

## 2. Supabase

Buka Supabase > SQL Editor lalu jalankan seluruh isi `database.sql`.

Tabel utama tetap `kantin_data`. Aplikasi menggunakan `tipe` berikut:

- `harian`
- `pemasukan`
- `pengeluaran`
- `transfer`
- `setoran_tabungan`
- `penarikan`
- `piutang`
- `pembayaran_piutang`
- `hutang`
- `pembayaran_hutang`
- `persediaan`
- `pemasok`

Semua detail transaksi disimpan pada kolom `data` (jsonb).

## 3. Auth user pertama

Supabase > Authentication > Users > Add user.

Untuk username `admin`, buat email internal:

`admin@kantin-uimsya.local`

Pengguna pada halaman login cukup mengetik username `admin`; email internal tersebut dibuat otomatis oleh `index.html`.

Jangan masukkan service-role key ke frontend.

## 4. supabase.js

File sudah diisi dengan Project URL dan Publishable key yang diberikan untuk project ini. Bila project berbeda, ubah dua konstanta:

```js
const SUPABASE_URL = 'https://PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

Gunakan Publishable/anon key, bukan service_role.

## 5. Login

Buka root site, bukan `/app.html` langsung.

Alur:

`index.html -> Supabase Auth -> app.html`

Jika tidak ada session, `app.html` akan mengembalikan pengguna ke `index.html`.

## 6. Fitur keuangan yang ditambahkan

- Dashboard 1 bulan, 3 bulan, 6 bulan, 1 tahun, 2 tahun
- Transaksi kas: pemasukan, pengeluaran, transfer, setoran tabungan, penarikan
- Buku kas dengan saldo awal dan saldo akhir
- Laba rugi operasional
- Piutang dan pembayaran piutang
- Hutang dan pembayaran hutang
- Persediaan/stok
- Master pemasok
- Tabungan + penarikan
- Laporan harian khusus kantin
- CSV
- Cetak B5
- Ganti password
- Reset seluruh data (gunakan hati-hati)

## 7. Laporan harian kantin

Rumus:

`Total = (Pend.I + Pend.II) - Titipan I - Titipan II - Titipan III - Tabungan`

Jumat otomatis libur pada modul operasional laporan harian, pengeluaran, dan penarikan.

## 8. Buku kas

Saldo awal dapat diisi pada halaman Buku Kas. Nilai saldo awal disimpan di browser untuk perangkat tersebut.

Arus harian berasal dari `harian` sebagai net harian, kemudian ditambah pemasukan lain, dikurangi pengeluaran dan setoran tabungan, serta ditambah penarikan tabungan.

## 9. Deploy Netlify

GitHub repository harus memiliki `index.html` di root.

Di Netlify:

- Import project dari GitHub
- Branch: `main`
- Build command: kosong
- Publish directory: `.`

Setelah deploy, gunakan URL `https://....netlify.app/`.

## 10. Update aplikasi

Edit file di komputer -> upload/commit ke GitHub -> Netlify otomatis deploy ulang.

## 11. Catatan keamanan

`supabase.js` berada di frontend sehingga hanya boleh berisi Publishable/anon key. Service-role key tidak boleh di-upload ke GitHub atau dimasukkan ke browser.

Tabel `kantin_users` dipertahankan untuk kompatibilitas; password ditangani oleh Supabase Auth.


## Deploy tanpa kredit Netlify

Jika Netlify menampilkan pesan bahwa **operational credits habis** dan production deploy/Agent Runner dijeda, file web tetap bisa dipakai tanpa mengubah database Supabase.

**Opsi 1 — Deploy manual ke Cloudflare Pages**
1. Pastikan folder project ini di-upload ke GitHub.
2. Di Cloudflare Pages, buat project dari repository tersebut.
3. Karena project ini adalah HTML/CSS/JS statis, tidak perlu build command.
4. Publish directory: folder `kantin-uimsya-profesional` (atau root repository jika isinya sudah berada di root).
5. Konfigurasi Supabase tetap memakai `supabase.js` yang sudah ada.

**Opsi 2 — Jalankan lokal**
- Buka project melalui local web server (jangan mengandalkan `file://` bila browser memblokir module/request).
- Contoh: gunakan extension Live Server di VS Code.

**Opsi 3 — Tetap Netlify**
- Tunggu reset billing cycle atau upgrade paket sesuai kebutuhan Netlify.
- Tidak perlu membuat ulang database Supabase; deploy ulang project yang sama setelah akses production deploy kembali tersedia.

### Perubahan format print
- Format cetak diubah menjadi **A4 profesional**.
- Ada header identitas Kantin Uimsya Putri, judul laporan, waktu cetak, ringkasan angka, tabel zebra, dan footer dokumen.
- Tabel diusahakan tidak terpotong antar halaman dan header tabel diulang ketika tabel melewati halaman.
- Laporan harian menggunakan layout tabel yang lebih padat agar lebih cocok untuk cetak.


## Urutan data
Data bertanggal ditampilkan kronologis dari tanggal paling awal di atas sampai tanggal paling akhir di bawah, termasuk laporan cetak.
