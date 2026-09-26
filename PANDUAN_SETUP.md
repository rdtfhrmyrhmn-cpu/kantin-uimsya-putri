# PANDUAN SETUP — Kantin Uimsya Putri v2 (Sistem Role)

## Apa yang baru di v2?

- **Sistem Role**: Admin dan Kasir dengan hak akses berbeda
- **Manajemen Pengguna dari dalam aplikasi**: Admin bisa buat, aktifkan/nonaktifkan, dan ubah role pengguna tanpa masuk ke Supabase
- **Kasir tidak bisa hapus data**: Tombol Hapus tersembunyi untuk Kasir
- **Keamanan database**: Hanya Admin yang dapat menghapus data di level database (RLS)

---

## 1. Isi folder

- `index.html`, `app.html`, `app.js`, `home.js`, `style.css`, `supabase.js`, `netlify.toml`, `database.sql`, `assets/logo.png`

Tidak ada framework dan tidak ada build command.

---

## 2. Supabase — Setup Database

Buka **Supabase > SQL Editor**, jalankan seluruh isi `database.sql`.

Ini akan membuat:
- Tabel `kantin_data` (data transaksi)
- Tabel `kantin_user_roles` (**BARU**: peta user → role)
- Fungsi `auth_is_admin()` untuk RLS
- Policy RLS yang membatasi delete hanya untuk Admin

---

## 3. Supabase — Nonaktifkan Konfirmasi Email

**Wajib** agar pembuatan akun dari dalam aplikasi berhasil.

1. Buka **Supabase > Authentication > Providers > Email**
2. Matikan **"Enable email confirmations"**
3. Simpan

Ini diperlukan karena alamat email internal `@kantin-uimsya.local` tidak nyata dan tidak bisa menerima email konfirmasi.

---

## 4. Buat Akun Admin Pertama

### Opsi A: Via Supabase (Cara Lama)

1. Buka **Supabase > Authentication > Users > Add user**
2. Email: `admin@kantin-uimsya.local`
3. Password: pilih password kuat
4. Login ke aplikasi dengan username `admin`
5. Karena belum ada role sama sekali, aplikasi **otomatis menjadikan pengguna pertama sebagai Admin**

### Opsi B: Via Supabase SQL (lebih cepat)

```sql
-- Buat user di auth (ganti password)
SELECT supabase.auth.create_user(
  '{"email": "admin@kantin-uimsya.local", "password": "passwordkuat123", "email_confirm": true}'
);
```

---

## 5. Membuat Pengguna Kasir (dari dalam aplikasi)

Setelah login sebagai Admin:

1. Klik menu **👥 Pengguna** di sidebar
2. Klik tombol **"Buat Pengguna"**
3. Isi form:
   - **Username**: huruf kecil, angka, underscore (contoh: `kasir1`)
   - **Password**: minimal 8 karakter
   - **Role**: Kasir (terbatas) atau Admin (penuh)
   - **Password Admin Anda**: konfirmasi identitas admin
4. Klik Simpan

Akun baru langsung bisa digunakan.

---

## 6. Perbedaan Role

| Fitur | 👑 Admin | 👤 Kasir |
|-------|----------|---------|
| Lihat semua data | ✅ | ✅ |
| Tambah transaksi | ✅ | ✅ |
| Edit data | ✅ | ✅ |
| Input laporan harian | ✅ | ✅ |
| Tandai libur | ✅ | ✅ |
| **Hapus data** | ✅ | ❌ |
| **Ubah status libur** | ✅ | ❌ |
| **Reset semua data** | ✅ | ❌ |
| **Ubah saldo awal** | ✅ | ❌ |
| **Kelola pengguna** | ✅ | ❌ |

---

## 7. supabase.js

Sudah dikonfigurasi untuk project ini. Untuk project berbeda, ubah:

```js
const SUPABASE_URL = 'https://PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

Gunakan **Publishable/anon key**, bukan service_role.

---

## 8. Deploy Netlify / Cloudflare Pages

- Build command: kosong
- Publish directory: `.` (root)
- Tidak ada framework

---

## 9. Catatan Keamanan

- **service_role key** tidak boleh ada di frontend
- Hapus data dibatasi di level database (RLS policy `auth_is_admin()`)
- Akun nonaktif diblokir di level aplikasi (untuk block total, hapus akun di Supabase Auth)
- Kasir yang mencoba akses API langsung tetap dibatasi oleh RLS untuk operasi DELETE

---

## 10. Troubleshooting

**"Gagal membuat akun: ...email_already_used"**
→ Username sudah dipakai di Supabase Auth. Pilih username lain.

**"Gagal membuat akun: ...Email confirmation required"**
→ Nonaktifkan konfirmasi email di Supabase (lihat langkah 3).

**"Akun Anda belum memiliki akses"**
→ User ada di Supabase Auth tapi belum punya role. Admin harus membuat role di tabel `kantin_user_roles` secara manual atau via menu Pengguna.

**"Akun dibuat tapi gagal masuk kembali sebagai admin"**
→ Password konfirmasi admin salah. Akun baru tetap terbuat. Login manual ke Supabase Auth untuk verifikasi.
