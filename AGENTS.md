# AGENTS.md

## Project Overview
Kelola Tugas adalah aplikasi React + Supabase untuk manajemen tugas staf.

Modul tambahan: **Modul Anggaran**
Tujuan: kontrol penyerapan anggaran (bukan sistem keuangan penuh).

---

## Core Architecture Rules (CRITICAL)

Agent WAJIB mengikuti aturan ini:

- Modul anggaran TIDAK terhubung langsung ke task
- Integrasi hanya pada level **Sub Kegiatan**
- **Sub Kegiatan adalah pusat data anggaran**
- Nilai anggaran hanya boleh di **Belanja Level 5 (leaf)**
- Tidak boleh ada nilai di level lain
- RAK:
  - berbasis versi
  - immutable (tidak overwrite)
- Monitoring berbasis **bulanan**

Jika melanggar → STOP dan beri warning.

---

## RAK Version Workflow

RAK menggunakan versioning immutable.

Status:
- DRAFT
- ACTIVE
- ARCHIVED

Rules:
- Hanya DRAFT yang bisa diedit
- ACTIVE dan ARCHIVED read-only
- Activate hanya dari DRAFT
- Saat activate:
  - ACTIVE lama → ARCHIVED
  - DRAFT → ACTIVE
- Tidak boleh ARCHIVED → ACTIVE langsung
- Rollback dilakukan dengan:
  ARCHIVED → clone → DRAFT → activate
- Clone hanya dari:
  - ACTIVE
  - ARCHIVED
- Tidak boleh clone dari DRAFT

## Development Scope

Fitur modul anggaran:
- Master Data
- RAK (versioning)
- Realisasi
- Saldo
- Tracking
- Dashboard

Pengembangan dilakukan bertahap.

## RAK UI Structure

RAK dibagi menjadi:

1. RAK List
   - hanya menampilkan versi
   - tidak menampilkan item
   - tidak boleh edit

2. RAK Detail (BudgetPlanPage)
   - menampilkan isi 1 versi
   - read-only jika ACTIVE/ARCHIVED
   - editable jika DRAFT

3. RAK Draft Editor
   - hanya aktif jika status DRAFT
   - edit dilakukan per row
   - tidak ada autosave

## Current Development Status

Master Data (Anggaran) telah selesai dan siap digunakan, dengan komponen:

- Akun Belanja
- Status Item (RAK)
- Tahun Anggaran

Komponen yang tidak memiliki UI karena bersifat internal:
- Level Akun
- Status Realisasi
- Status Perubahan (BARU/BERUBAH/dll)

## Master Data Design Principles

1. Hanya data operasional yang memiliki UI
2. Data referensi internal tidak dibuatkan halaman
3. Tidak boleh ada master ganda untuk konsep yang sama (contoh: Tahun Anggaran hanya menggunakan fiscal_years)
4. Struktur yang bersifat sistem (seperti akun berbasis kode) tidak boleh diubah manual
5. Master digunakan sebagai sumber default, bukan sebagai kontrol visibilitas global

## Fiscal Year Behavior

- fiscal_years digunakan sebagai satu-satunya sumber Tahun Anggaran
- hanya satu tahun boleh aktif
- status aktif digunakan sebagai default context, bukan sebagai saklar tampil/tidak tampil data
- data anggaran tetap ditentukan oleh RAK dan relasi lainnya

## Budget Item Status

Status Item digunakan untuk workflow manual:
- DRAFT
- APPROVED
- REJECTED

Styling harus mengikuti status Task yang sudah ada (reuse UI component).
Tidak boleh membuat sistem styling baru.

## RAK Version Workflow

RAK version status berbeda dari Budget Item Status.

RAK Version Status:
- DRAFT
- ACTIVE
- ARCHIVED

Rules:
- Hanya satu DRAFT aktif per fiscal year/workflow
- Clone revisi hanya dari versi ACTIVE
- Activate hanya dari versi DRAFT
- Saat DRAFT di-activate, versi ACTIVE sebelumnya menjadi ARCHIVED
- Versi ACTIVE/ARCHIVED tidak boleh dioverwrite
- Perubahan setelah ACTIVE harus melalui clone/revisi versi baru

Budget Item Status tetap:
- DRAFT
- APPROVED
- REJECTED

Jangan mencampur RAK Version Status dengan Budget Item Status.

## UI Cleanup

Tab berikut telah dihapus dari UI karena tidak diperlukan:
- Level Akun
- Status Realisasi

Namun struktur database tetap dipertahankan jika masih digunakan oleh sistem.

## Next Development Scope

Pengembangan selanjutnya akan berfokus pada:
- RAK (Rencana Anggaran Kegiatan)
- Realisasi Anggaran
- Tracking dan Dashboard

Master Data dianggap cukup dan hanya akan diperbaiki jika ditemukan bug atau kebutuhan baru.

## Budget Tracking Rules

Tracking menggunakan view existing:

- fin_v_tracking_budget_progress
- fin_v_tracking_budget_warnings
- fin_v_tracking_budget_deviations

Rules:
- Jangan membuat query baru jika view sudah tersedia
- Tracking hanya membaca data (read-only)
- Fokus pada:
  - plan vs realization
  - deviasi
  - warning
- Jangan mengubah data RAK melalui tracking module

## Budget Realization Rules

Realisasi Anggaran menggunakan UI berbasis agregat bulanan.

Database raw:
- fin_budget_realizations bersifat transactional
- Satu akun + satu bulan bisa memiliki banyak row transaksi di database

UI v1:
- User mengelola angka agregat bulanan
- Bukan transaksi individual
- Save per row akan mengganti data bulan tersebut menjadi satu row agregat

Rules:
- Realisasi tidak boleh terhubung langsung ke task
- Realisasi tetap melekat pada Sub Kegiatan + Akun Belanja level 5
- Write hanya ke fin_budget_realizations
- Read menggunakan view existing:
  - fin_v_budget_balance_summary
  - fin_v_budget_balance_unpivot
- rak_version_id_snapshot wajib diisi saat input realisasi
- Jangan mengubah data RAK dari modul realisasi
- Jangan membuat UI transaksi individual pada v1
- Jangan buat bulk import, approval, attachment, atau export pada v1

## Current RAK Implementation Scope

RAK List v1:
- pilih fiscal year
- tampilkan daftar versi RAK
- tampilkan status versi
- action: lihat detail, clone revisi, activate draft
- tidak menampilkan item detail

RAK Detail v1:
- read-only
- menampilkan isi satu versi RAK
- menggunakan rakVersionId yang dipilih
- tidak otomatis override ke active version jika versi sudah dipaksa dari list
- belum mencakup edit/input item

---

## Database Conventions

Naming:
- tabel: fin_*
- view: fin_v_*
- function: fin_*

Rules:
- budget_account harus:
  - active
  - leaf
  - level 5
- unique (rak_sub_activity_id, budget_account_id)
- rak_version_id konsisten via sub_activity

---

## Coding Guidelines

React:
- functional components
- hooks
- pisahkan UI dan data logic

Supabase:
- gunakan view
- hindari duplikasi SQL di frontend

General:
- TypeScript
- simple > complex

---

## Agent Workflow

1. Baca konteks
2. Analisa struktur
3. Validasi terhadap rules
4. Identifikasi gap
5. Perbaikan minimal
6. Implementasi

---

## Output Format

1. Pemahaman
2. Asumsi
3. Analisis
4. Solusi
5. Kode
6. Risiko

---

## Forbidden

- Hubungkan task ke anggaran
- Simpan nilai selain level 5
- Hapus histori
- Hilangkan versioning
- Overengineering

---

## Preferred Approach

- Minimal change
- Gunakan constraint DB
- Konsistensi

---

## Testing

- gunakan transaction
- buat smoke test:
  - valid → sukses
  - invalid → gagal

---

## Notes

- Repo sudah ada struktur
- Jangan redesign
- Tanya jika ragu
