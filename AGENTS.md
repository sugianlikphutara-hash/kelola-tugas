# AGENTS.md

## Project Overview

Kelola Tugas adalah aplikasi React + Supabase untuk:

* Manajemen Tugas
* Monitoring Tugas
* Kanban
* Pelaporan
* Timeline
* Modul Anggaran
* Master Data

Modul Anggaran digunakan untuk kontrol penyerapan anggaran, bukan sistem keuangan penuh.

---

## Absolute Rules

Jika aturan berikut berpotensi dilanggar, STOP dan beri warning:

* Jangan hubungkan Task langsung ke Anggaran
* Integrasi Task/Anggaran hanya boleh melalui Sub Kegiatan
* Sub Kegiatan adalah pusat relasi anggaran
* Nilai anggaran hanya boleh di Akun Belanja Level 5 / leaf
* Jangan simpan nilai anggaran di parent account
* RAK bersifat versioned dan immutable
* Jangan overwrite RAK ACTIVE atau ARCHIVED
* Jangan hapus histori/audit trail
* Backend/RPC/RLS adalah source of truth
* Frontend hanya untuk UX, bukan security
* Jangan mengandalkan localStorage untuk permission/security
* Jangan ubah schema tanpa kebutuhan kuat
* Jangan overengineering

---

## Navigation Standard

Navigasi utama:

Dashboard
Tugas
Monitoring Tugas
Kanban
Pelaporan
Timeline
Anggaran
Master Data

Submenu Anggaran:

Anggaran
├─ Ringkasan
├─ Versi RAK
├─ Rencana
├─ Realisasi
└─ Monitoring

Rules:

* Menu singkat
* Header halaman boleh lebih lengkap
* Jangan gunakan istilah ambigu seperti “Tracking” tanpa konteks
* Gunakan “Monitoring” untuk analisis/pemantauan data

---

## Budget Module Rules

### Core Principles

* Modul Anggaran tidak terhubung langsung ke Task
* Relasi hanya melalui Sub Kegiatan
* Sub Kegiatan adalah pusat data anggaran
* Akun anggaran wajib Level 5 / leaf untuk menyimpan nilai
* Monitoring berbasis bulanan

---

## RAK Rules

RAK menggunakan versioning immutable.

Status versi:

DRAFT
ACTIVE
ARCHIVED

Rules:

* Hanya DRAFT yang bisa diedit
* ACTIVE dan ARCHIVED read-only
* Activate hanya dari DRAFT
* Saat activate:

  * ACTIVE lama menjadi ARCHIVED
  * DRAFT menjadi ACTIVE
* Tidak boleh ARCHIVED langsung menjadi ACTIVE
* Rollback dilakukan dengan:

  * ARCHIVED → clone → DRAFT → activate
* Perubahan setelah ACTIVE harus melalui versi baru
* Tidak boleh overwrite versi lama

---

## RAK UI Structure

RAK dibagi menjadi:

1. Versi RAK

   * daftar versi
   * tidak menampilkan item
   * action: lihat detail, clone, activate

2. Rencana

   * detail isi versi RAK
   * editable hanya jika DRAFT dan role diizinkan
   * ACTIVE/ARCHIVED read-only

---

## Realisasi Anggaran Rules

Realisasi menggunakan model input agregat bulanan.

Database tetap transactional.

Rules:

* UI mengelola nilai agregat per bulan
* Save realisasi wajib lewat RPC
* Save mengganti data bulan tersebut secara atomic
* Realisasi melekat pada:

  * fiscal_year_id
  * sub_activity_id
  * budget_account_id
  * rak_version_id_snapshot
  * period_month
* Tidak boleh mengubah data RAK dari modul Realisasi
* Tidak membuat UI transaksi individual pada v1

---

## Budget Security Rules

Modul Anggaran sudah menggunakan:

* RLS
* RPC
* backend role check
* audit trail
* period lock

Rules:

* Write langsung ke tabel sensitif harus ditolak
* Write penting harus lewat RPC
* Lock/unlock periode hanya ADMIN
* Audit trail tidak boleh diedit langsung
* Role diambil dari database melalui auth.uid()

---

## Budget Role Matrix

ADMIN:

* full access anggaran
* manage RAK version
* edit RAK draft
* input realisasi
* lock/unlock periode

KASI / KASUBAG:

* edit RAK draft
* input realisasi
* tidak clone/activate RAK
* tidak lock/unlock periode

STAF:

* input realisasi
* tidak edit RAK
* tidak manage versi
* tidak lock/unlock

PIMPINAN / VIEWER:

* read-only

---

## Budget Reporting Rules

Gunakan data existing:

* fin_v_tracking_budget_progress
* fin_v_tracking_budget_warnings
* fin_v_tracking_budget_deviations
* fin_v_budget_balance_summary
* fin_v_budget_balance_unpivot

Rules:

* Read-only
* Jangan buat RPC baru jika view sudah cukup
* Jangan duplikasi query jika service existing tersedia
* Export boleh read-only

---

## Task Module Security Status

Task module sedang dalam proses hardening.

Status saat ini:

* RLS Task sudah mulai diterapkan
* Create Task sudah lewat RPC
* Update Task dasar sudah lewat RPC
* Beberapa flow lain masih perlu RPC bertahap

Masih perlu perhatian:

* progress report
* evidence
* approval/reject
* follow-up
* kanban move
* delete task

Rules:

* Jangan menganggap Task sudah sepenuhnya aman sebelum semua write flow pindah ke RPC
* Jangan membuka direct write policy untuk tabel Task
* Jangan mematikan RLS
* Jangan rely pada localStorage role
* Semua write penting harus dipindahkan bertahap ke RPC

---

## Task Role Matrix

ADMIN:

* full access task

KASI / KASUBAG:

* create task
* edit task
* approve/reject
* manage progress/evidence/follow-up
* kanban move

STAF:

* create task
* update task miliknya sesuai aturan
* progress/evidence task miliknya
* kanban move terbatas

PIMPINAN / VIEWER:

* read-only

---

## Database Conventions

Naming:

* tabel anggaran: fin_*
* view anggaran: fin_v_*
* function anggaran: fin_*

General:

* gunakan UUID primary key
* gunakan constraint DB untuk rule penting
* jangan duplikasi master data
* fiscal_years adalah satu-satunya sumber Tahun Anggaran

---

## Coding Guidelines

React:

* functional components
* hooks
* pisahkan UI dan data logic
* gunakan helper style global jika tersedia
* jangan buat style lokal jika global style sudah ada

Supabase:

* gunakan service layer
* gunakan view jika tersedia
* jangan tulis SQL kompleks langsung di frontend
* write penting harus lewat RPC

General:

* minimal change
* simple > complex
* jangan refactor besar tanpa kebutuhan
* jangan ubah nama file/route tanpa instruksi eksplisit

---

## Agent Workflow

1. Pahami konteks
2. Cek aturan AGENTS.md
3. Identifikasi scope
4. Jika ada risiko melanggar aturan → STOP
5. Buat solusi minimal
6. Implement hanya sesuai scope
7. Jalankan verifikasi
8. Laporkan file berubah, hasil test, dan risiko

---

## Output Format Agent

Gunakan format:

Pemahaman
Asumsi
Solusi
File Berubah
Verifikasi
Risiko Sisa

---

## Forbidden

Dilarang:

* menghubungkan Task langsung ke Anggaran
* menyimpan nilai anggaran selain di Level 5
* overwrite RAK ACTIVE/ARCHIVED
* menghapus audit trail
* membuat master data ganda
* mengandalkan frontend untuk security
* membuka direct write policy untuk tabel sensitif
* melakukan refactor besar tanpa instruksi
* menambah fitur di luar scope

---

## Testing Rules

Minimal:

* valid case → sukses
* invalid case → gagal
* role unauthorized → ditolak
* RLS tidak boleh bisa dibypass
* lint/build harus sukses jika menyentuh kode frontend

---

## Current Priority

Prioritas teknis saat ini:

Hardening Task Module bertahap sampai setara dengan Budget Module.

Urutan:

1. RLS Task tables
2. RPC create task
3. RPC update task
4. RPC progress/evidence/follow-up/approval/kanban
5. Role-aware UI refinement
6. Dokumentasi final

---

## Final Note

Jangan redesign sistem.

Ikuti struktur yang ada.

Jika ragu, tanya dulu.
