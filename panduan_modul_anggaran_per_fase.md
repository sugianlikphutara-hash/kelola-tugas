# Panduan Implementasi Modul Anggaran per Fase

## Tujuan
Panduan ini membagi pembangunan modul anggaran menjadi beberapa fase kerja agar mudah diikuti tanpa banyak memikirkan ulang urutan langkah.

---

# Hari 1 — Finalisasi Fondasi Database

## Target hari ini
- Semua tabel inti modul anggaran sudah tersedia
- Semua view inti sudah tersedia
- Function clone dan aktivasi RAK sudah tersedia
- Struktur nama tabel `fin_` dan view `fin_v_` sudah konsisten

## Checklist
- [ ] Tabel `fin_budget_levels` tersedia
- [ ] Tabel `fin_budget_accounts` tersedia
- [ ] Tabel `fin_sub_activity_rak_statuses` tersedia
- [ ] Tabel `fin_budget_item_change_statuses` tersedia
- [ ] Tabel `fin_budget_realization_statuses` tersedia
- [ ] Tabel `fin_rak_versions` tersedia
- [ ] Tabel `fin_rak_sub_activities` tersedia
- [ ] Tabel `fin_rak_budget_items` tersedia
- [ ] Tabel `fin_rak_budget_item_details` tersedia
- [ ] Tabel `fin_budget_realizations` tersedia

## Checklist view
- [ ] `fin_v_active_rak_versions`
- [ ] `fin_v_rak_sub_activity_summary`
- [ ] `fin_v_rak_budget_item_summary`
- [ ] `fin_v_budget_realization_summary`
- [ ] `fin_v_budget_balance_summary`
- [ ] `fin_v_tracking_rak_changes`
- [ ] `fin_v_tracking_budget_deviations`
- [ ] `fin_v_tracking_budget_warnings`
- [ ] `fin_v_tracking_budget_progress`
- [ ] `fin_v_budget_balance_unpivot`

## Checklist function
- [ ] `fin_clone_rak_version`
- [ ] `fin_activate_rak_version`

## Hasil akhir hari 1
Database inti siap dipakai.

---

# Hari 2 — Master Data dan Baseline RAK

## Target hari ini
- Akun belanja lv1–lv5 sudah masuk
- Tahun fiskal 2026 sudah ada
- Versi awal RAK 2026 sudah ada
- Sub kegiatan utama sudah terhubung ke RAK awal

## Langkah kerja
1. Pastikan `fiscal_years` berisi tahun 2026
2. Masukkan akun belanja ke `fin_budget_accounts`
3. Pastikan nama pendek boleh dipakai di `name`, nama lengkap di `full_name`
4. Buat 1 versi awal:
   - code: `RAK-20260102`
   - version_number: 1
   - status: `ACTIVE`
   - is_active: `true`
5. Hubungkan sub kegiatan ke RAK awal

## Mapping sub kegiatan yang sudah dipakai
- `SUB-01` → Penyusunan Rencana Pengelolaan KPH
- `SUB-02` → Koordinasi & Sinkronisasi Pengendalian PBPH
- `SUB-03` → Pembinaan & Pengawasan PBPHH
- `SUB-04` → Pembangunan Sumber Benih

## Hasil akhir hari 2
Baseline RAK global tahun 2026 sudah terbentuk.

---

# Hari 3 — Input Data RAK Awal

## Target hari ini
- Semua item lv5 untuk SUB-01 s.d. SUB-04 sudah masuk
- Nilai tahunan dan nilai bulanan sudah konsisten
- Total per sub kegiatan sudah sesuai dokumen

## Aturan penting
- Hanya level 5 yang masuk ke `fin_rak_budget_items`
- `annual_amount` harus sama dengan total Januari–Desember
- Satu kombinasi `(rak_sub_activity_id, budget_account_id)` hanya boleh satu kali

## Sub kegiatan yang sudah berhasil diinput
- [ ] SUB-01 = 62.645.200
- [ ] SUB-02 = 50.000.000
- [ ] SUB-03 = 3.900.000
- [ ] SUB-04 = 25.632.000

## Total global RAK awal
- [ ] Total = 142.177.200

## Hasil akhir hari 3
RAK awal 2026 sudah lengkap dan valid.

---

# Hari 4 — Uji Halaman Rencana

## Target hari ini
- Tabel utama Rencana tampil
- Detail lv5 per sub kegiatan tampil
- Nilai bulanan tampil

## Struktur UI yang dipakai
### Tabel utama
- Kode Sub Kegiatan
- Nama Sub Kegiatan
- Total Anggaran

### Detail saat klik sub kegiatan
- Kode Belanja lv5
- Nama Belanja
- Total Tahunan
- Jan–Des

## View utama yang dipakai
- `fin_v_rak_sub_activity_summary`
- `fin_v_rak_budget_item_summary`

## Hasil akhir hari 4
Tab Rencana siap dipakai di UI.

---

# Hari 5 — Input Realisasi dan Uji Tab Realisasi

## Target hari ini
- Minimal satu realisasi masuk
- View saldo dan realisasi berubah otomatis
- Progress serapan mulai terlihat

## Langkah kerja
1. Input transaksi realisasi ke `fin_budget_realizations`
2. Isi:
   - fiscal_year_id
   - sub_activity_id
   - budget_account_id
   - rak_version_id_snapshot
   - realization_date
   - period_month
   - amount
3. Cek perubahan pada:
   - `fin_v_budget_balance_summary`
   - `fin_v_budget_realization_summary`

## Struktur UI tab Realisasi
### Tabel utama
- Sub Kegiatan
- Plan
- Realisasi
- Saldo

### Detail
- Belanja lv5
- Plan bulanan
- Realisasi bulanan
- Saldo bulanan

## Hasil akhir hari 5
Tab Realisasi berjalan end-to-end.

---

# Hari 6 — Uji Tab Saldo

## Target hari ini
- Saldo tahunan dan bulanan tampil benar
- Deviasi negatif bisa terbaca
- Sisa anggaran jelas terlihat

## Yang harus dicek
- Jika realisasi > plan bulan tertentu → balance negatif
- Jika realisasi < plan → balance positif
- Jika belum ada realisasi → annual_balance = annual_plan

## View utama
- `fin_v_budget_balance_summary`

## Hasil akhir hari 6
Tab Saldo siap dipakai.

---

# Hari 7 — Bangun Tab Tracking Deviasi

## Target hari ini
- Bisa melihat deviasi per bulan
- Bisa membedakan overspend vs underspend

## View utama
- `fin_v_budget_balance_unpivot`

## Logika status
- `OVERSPEND` → realization > plan
- `UNDERSPEND` → realization < plan
- `ON_TRACK` → realization = plan

## Struktur UI tab Deviasi
- Sub Kegiatan
- Belanja
- Bulan
- Plan
- Realisasi
- Selisih
- Status

## Hasil akhir hari 7
Tracking deviasi bulanan siap.

---

# Hari 8 — Bangun Tab Tracking Warning

## Target hari ini
- Item dengan `NO_REALIZATION` terlihat
- Warning tahunan bisa dipakai sebagai daftar perhatian

## View utama
- `fin_v_tracking_budget_warnings`

## Catatan
Pada tahap awal, hasil warning bisa sangat banyak. Ini normal jika transaksi realisasi masih sedikit.

## Struktur UI
- Sub Kegiatan
- Belanja
- Plan
- Realisasi
- Saldo
- Warning Type

## Hasil akhir hari 8
Tracking warning siap.

---

# Hari 9 — Bangun Tab Tracking Progress

## Target hari ini
- Persentase serapan tampil
- Status progres tampil

## View utama
- `fin_v_tracking_budget_progress`

## Struktur UI
- Sub Kegiatan
- Belanja
- Plan
- Realisasi
- Progress %
- Status

## Hasil akhir hari 9
Tracking progress siap.

---

# Hari 10 — Dashboard

## Target hari ini
- Ringkasan total anggaran tampil
- Grafik serapan bisa dibuat
- Perbandingan antar sub kegiatan bisa dibuat

## Komponen dashboard yang disarankan
- Total anggaran
- Total realisasi
- Total saldo
- Progress %
- Grafik realisasi per sub kegiatan
- Grafik realisasi per bulan
- Top item overspend
- Top item no realization

## Sumber data
- `fin_v_budget_balance_summary`
- `fin_v_budget_balance_unpivot`
- `fin_v_tracking_budget_warnings`
- `fin_v_tracking_budget_progress`

## Hasil akhir hari 10
Dashboard modul anggaran siap.

---

# Hari 11 — Workflow Revisi RAK

## Target hari ini
- Bisa clone RAK lama ke versi baru
- Bisa edit versi baru
- Bisa aktivasi versi baru

## Urutan kerja
1. Jalankan `fin_clone_rak_version`
2. Edit hasil clone:
   - tambah sub kegiatan baru
   - ubah status sub kegiatan
   - ubah item lv5
   - sesuaikan nilai bulan
3. Jalankan `fin_activate_rak_version`

## Catatan
- Jangan mengubah RAK lama
- Semua revisi harus menjadi versi baru

## Hasil akhir hari 11
Workflow revisi RAK siap.

---

# Hari 12 — Integrasi Frontend

## Target hari ini
- View dipakai oleh halaman UI
- Form realisasi tersambung ke database
- Filter bulan, versi RAK, dan sub kegiatan berfungsi

## Mapping halaman ke view/tabel
### Halaman Rencana
- utama: `fin_v_rak_sub_activity_summary`
- detail: `fin_v_rak_budget_item_summary`

### Halaman Realisasi
- utama/detail: `fin_v_budget_balance_summary`
- insert: `fin_budget_realizations`

### Halaman Tracking
- deviasi: `fin_v_budget_balance_unpivot`
- warning: `fin_v_tracking_budget_warnings`
- progress: `fin_v_tracking_budget_progress`
- perubahan: `fin_v_tracking_rak_changes` (setelah ada revisi)

### Dashboard
- `fin_v_budget_balance_summary`
- `fin_v_budget_balance_unpivot`
- `fin_v_tracking_budget_warnings`
- `fin_v_tracking_budget_progress`

## Hasil akhir hari 12
Frontend tersambung ke backend anggaran.

---

# Ringkasan Keputusan Penting

## Struktur utama
- Pusat data = Sub Kegiatan
- Nilai anggaran hanya di belanja level 5
- Task tidak terhubung langsung ke belanja
- Halaman anggaran berdiri sendiri

## RAK
- Global per tahun
- Banyak versi
- Snapshot penuh
- Revisi tidak overwrite

## Realisasi
- Data faktual
- Dibandingkan dengan RAK aktif/terbaru

## Tracking
- Fokus utama: deviasi bulanan
- Warning dan progress menyusul
- Perubahan RAK aktif jika sudah ada revisi

---

# Checklist Akhir Modul

## Database
- [ ] Semua tabel `fin_` ada
- [ ] Semua view `fin_v_` ada
- [ ] Function clone & activate ada

## Data
- [ ] Akun belanja sudah masuk
- [ ] RAK awal sudah masuk
- [ ] Sub kegiatan sudah terhubung
- [ ] Item lv5 sudah masuk
- [ ] Total sudah valid

## Operasional
- [ ] Realisasi bisa diinput
- [ ] Saldo otomatis berubah
- [ ] Progress otomatis berubah
- [ ] Deviasi bulanan bisa dideteksi

## UI
- [ ] Rencana siap
- [ ] Realisasi siap
- [ ] Saldo siap
- [ ] Tracking siap
- [ ] Dashboard siap

---

# Penutup
Urutan di atas dibuat agar implementasi berjalan bertahap, tidak lompat-lompat, dan tidak membingungkan. Ikuti dari Hari 1 sampai Hari 12 secara berurutan. Jika satu hari belum selesai, jangan lanjut ke fase berikutnya.
