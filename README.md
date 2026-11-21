# 🏭 Sistem Manajemen Gudang & Logistik Terintegrasi (WMS)

Platform Warehouse Management System (WMS) modern untuk pengelolaan stok fisik gudang, pelacakan inventaris multi-lokasi, pemindaian barcode, verifikasi penerimaan barang fisik Purchase Order (PO) dengan bukti foto, dan pengajuan restock (Purchase Requisition - PR) yang terhubung langsung secara *real-time* ke sistem Purchasing.

---

## 🌟 Fitur Utama

### 1. 📦 Verifikasi Kedatangan Barang PO (Proof of Delivery)
- Penerimaan barang fisik dari Purchase Order (PO) yang diterbitkan tim Purchasing (Port 3001).
- Perekaman nama penerima, timestamp kedatangan, dan catatan kondisi barang.
- **Upload Bukti Foto Penerimaan Barang**: Foto bukti kedatangan dan surat jalan otomatis tersinkronisasi ke sistem Purchasing agar tim pengadaan dapat memvalidasi faktur.

### 2. 📢 Pengajuan Restock Gudang (Purchase Requisition - PR)
- Pembuatan permohonan pengadaan barang darurat (*Urgent*) atau berkala (*Routine*) saat stok mendekati batas minimum (*safety stock*).
- Status pengajuan langsung muncul sebagai notifikasi prioritas di dashboard tim Purchasing untuk segera diterbitkan PO resminya.

### 3. 🏢 Manajemen Multi-Gudang & Lokasi Rak
- Pemetaan stok fisik per gudang (Gudang Utama Jakarta, Gudang Cabang Surabaya, dsb).
- Peringatan dini barang menipis (*Low Stock Warning*) dengan indikator visual otomatis.

### 4. ⚡ Integrasi Real-Time Dua Arah
- Sinkronisasi REST API live ke sistem **Purchasing** di port `3001`.
- Perubahan kuantitas stok gudang langsung terbaca saat tim Purchasing memilih supplier atau membuat pesanan baru.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Language**: TypeScript & React 19
- **Database & ORM**: SQLite & Prisma ORM
- **Styling**: Tailwind CSS & Lucide Icons
- **Integrasi**: REST API Real-time antar-port (Port 3000 Gudang <-> Port 3001 Purchasing)
- **Package Manager**: pnpm

---

## 🚀 Panduan Menjalankan

### 1. Salin File Konfigurasi Environment
```bash
cp .env.example .env
```

### 2. Pasang Dependensi
```bash
pnpm install
```

### 3. Sinkronisasi Database Prisma
```bash
pnpm prisma generate
pnpm prisma db push
```

### 4. Jalankan Server Development
```bash
pnpm dev
```
Aplikasi Gudang siap diakses di: **[http://localhost:3000](http://localhost:3000)**

---

## 📱 Integrasi Notifikasi Telegram ID Card

Setiap karyawan dan staf gudang dapat menghubungkan nomor ID Card mereka (misal: `WH-001`, `WH-002`, `WH-003`, `BJ-001`, `BJ-002`) ke akun Telegram masing-masing untuk menerima notifikasi real-time:
- 📦 **Barang Masuk Gudang**: Konfirmasi penerimaan fisik barang PO beserta pencatatan mutasi stok dan foto bukti.
- 📋 **Pengajuan Restock (PR)**: Konfirmasi pengajuan kebutuhan barang ke Purchasing.
- ⚠️ **Peringatan Stok Kritis**: Alert otomatis saat stok barang di bawah batas minimum (*Low Stock Alert*).

### Cara Menghubungkan ID Card ke Telegram:
1. Buka dashboard Gudang di `http://localhost:3000` dan masuk dengan nomor ID Card Anda.
2. Klik tombol **📱 Hubungkan Telegram** di bilah atas (atau melalui menu profil ID Card).
3. Buka Telegram dan cari bot `@userinfobot` untuk mendapatkan **Chat ID** Anda.
4. Masukkan Chat ID pada modal integrasi, aktifkan centang notifikasi, lalu klik **Simpan Pengaturan ID Card**.
5. Gunakan tombol **Kirim Pesan Uji Coba** untuk memastikan pesan pengujian masuk ke akun Anda.

---

## 🔗 Ekosistem Terintegrasi

| Aplikasi | Port | Repository GitHub | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Gudang Web (WMS)** | `3000` | [chandra343/Gudang](https://github.com/chandra343/Gudang) | Manajemen Stok Fisik & Penerimaan Barang |
| **Purchasing Web** | `3001` | [chandra343/Purchasing](https://github.com/chandra343/Purchasing) | Platform Pengadaan, Komparasi Vendor & PO |
