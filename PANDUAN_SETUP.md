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
