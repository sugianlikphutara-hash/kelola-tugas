## Rencana Implementasi - Dua Mode Perataan Judul Tabel Global
- Tujuannya adalah untuk menyediakan cara yang konsisten untuk beralih antara dua mode perataan judul tabel di seluruh aplikasi.

## Perubahan yang Diusulkan
1. controlStyles.js [MODIFY]
   - Memperbarui getTableHeaderCellStyle untuk menerima parameter baru: alignMode (1 atau 2) dan label.
   - Implementasi logika:
     - Mode 1: Paksa textAlign: "left" untuk semua kolom.
     - Mode 2: textAlign: "center", kecuali jika label adalah "TASK" maka textAlign: "left".
     - Memastikan textTransform: "uppercase" selalu aktif untuk kedua mode.

2. TaskPage.jsx [MODIFY]
   - Memperbarui cara pemanggilan getTableHeaderCellStyle. Karena mode 2 membutuhkan label per kolom, pemanggilan gaya akan dipindahkan ke dalam iterasi .map judul kolom.

3. Halaman Lain (Dashboard, Tracking, Reporting, dsb.) [MODIFY]
   - Menyesuaikan pemanggilan gaya tabel agar mendukung parameter baru sesuai kebutuhan.

## Penerapan
- Mode 1 : Mode Default  
- Mode 2 : Mode Kedua

## Rencana Verifikasi
- Memeriksa tampilan di browser untuk Mode 1 (semua kiri).
- Memeriksa tampilan di browser untuk Mode 2 (center, kecuali TASK di kiri).
- Memastikan semua teks judul tabel adalah huruf kapital.