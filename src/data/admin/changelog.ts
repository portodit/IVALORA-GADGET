/**
 * IVALORA RMS — Release Notes / Changelog
 * ─────────────────────────────────────────
 * Setiap perubahan yang dilakukan pada sistem harus dicatat di sini.
 * Format: tambahkan entry baru di PALING ATAS array `RELEASES`.
 *
 * ┌─ Panduan pengisian ────────────────────────────────────────────┐
 * │  version   : Semantic version (major.minor.patch)              │
 * │  date      : Tanggal rilis (YYYY-MM-DD)                       │
 * │  title     : Judul singkat rilis                               │
 * │  summary   : Deskripsi 1-2 kalimat tentang fokus rilis         │
 * │  sections  : Array of change groups (added/changed/fixed/etc)  │
 * │  breaking  : (opsional) Array perubahan yang breaking          │
 * └────────────────────────────────────────────────────────────────┘
 */

export type ChangeType = "added" | "changed" | "fixed" | "removed" | "improved" | "security";

export interface ChangeItem {
  description: string;
  /** Detail before/after jika relevan */
  before?: string;
  after?: string;
  /** Modul / area yang terdampak */
  scope?: string;
}

export interface ChangeSection {
  type: ChangeType;
  items: ChangeItem[];
}

export interface Release {
  version: string;
  date: string;
  title: string;
  summary: string;
  sections: ChangeSection[];
  breaking?: string[];
}

export const CURRENT_VERSION = "1.6.0";

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: "Ditambahkan",
  changed: "Diubah",
  fixed: "Diperbaiki",
  removed: "Dihapus",
  improved: "Ditingkatkan",
  security: "Keamanan",
};

export const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
  added: "bg-emerald-100 text-emerald-800 border-emerald-200",
  changed: "bg-blue-100 text-blue-800 border-blue-200",
  fixed: "bg-amber-100 text-amber-800 border-amber-200",
  removed: "bg-red-100 text-red-800 border-red-200",
  improved: "bg-violet-100 text-violet-800 border-violet-200",
  security: "bg-rose-100 text-rose-800 border-rose-200",
};

export const RELEASES: Release[] = [
  {
    version: "1.6.0",
    date: "2026-03-28",
    title: "Master Produk v2 — Apple Watch, AirPods & Aksesoris",
    summary:
      "Perluasan besar pada Master Produk: mendukung Apple Watch, AirPods, dan Aksesoris; menambah field ukuran case (size_mm) untuk Apple Watch; form kondisional per kategori; dan constraint unik berbasis NULLS NOT DISTINCT.",
    sections: [
      {
        type: "added",
        items: [
          {
            description: "Dukungan kategori Apple Watch dengan field size_mm (ukuran case: 40mm, 41mm, 44mm, 45mm, 49mm) — form otomatis menampilkan selector ukuran khusus Watch.",
            scope: "Master Produk",
            before: "Apple Watch hanya bisa diinput tanpa atribut ukuran",
            after: "Apple Watch SE 2nd Gen, Series 9, Ultra 2 tersedia dengan pilihan ukuran 40–49mm",
          },
          {
            description: "Dukungan kategori AirPods — form sederhana tanpa storage/warna karena tidak relevan.",
            scope: "Master Produk",
          },
          {
            description: "Dukungan kategori Aksesoris — form fleksibel dengan checkbox opsional untuk storage dan warna; tanpa garansi.",
            scope: "Master Produk",
          },
          {
            description: "Kolom 'Ukuran' baru di tabel Master Produk — tampil khusus untuk kategori Watch.",
            scope: "Master Produk",
          },
          {
            description: "Seed data awal untuk Apple Watch (11 SKU), AirPods (4 SKU), dan Aksesoris charger/kabel Apple (5 SKU).",
            scope: "Database",
          },
        ],
      },
      {
        type: "removed",
        items: [
          {
            description: "Enum product_category diperbarui — hanya: iphone, ipad, accessory, macbook, watch, airpods.",
            scope: "Database / Master Produk",
            after: "Enum hanya: iphone, ipad, accessory, macbook, watch, airpods",
          },
        ],
      },
      {
        type: "changed",
        items: [
          {
            description: "Form Master Produk kini kondisional per kategori — field Storage, Warna, Ukuran, dan Garansi tampil/sembunyi sesuai kategori produk.",
            scope: "Master Produk",
          },
          {
            description: "Kategori Watch & AirPods kini dikunci ke tipe garansi 'Resmi' — tidak bisa diubah ke tipe lain.",
            scope: "Master Produk",
          },
          {
            description: "Field storage_gb, color, dan warranty_type di database diubah menjadi nullable (NULL) untuk mendukung produk yang tidak memiliki atribut tersebut.",
            scope: "Database",
          },
          {
            description: "Unique index SKU diperbarui menggunakan NULLS NOT DISTINCT (PostgreSQL 17) untuk mencakup field size_mm, menggantikan index lama yang tidak mendukung NULL.",
            scope: "Database",
          },
        ],
      },
    ],
    breaking: [
      "Kolom storage_gb, color, dan warranty_type pada tabel master_products kini bisa NULL — pastikan query yang menggunakan kolom ini sudah menangani nilai null.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-03-09",
    title: "Changelog & Manajemen Kategori",
    summary:
      "Menambahkan halaman Release Notes profesional, perbaikan manajemen status kategori produk, dan pembaruan branding navbar.",
    sections: [
      {
        type: "added",
        items: [
          {
            description:
              "Halaman Release Notes / Changelog untuk mendokumentasikan seluruh perubahan sistem secara rinci.",
            scope: "Sistem",
          },
          {
            description:
              "Label versi di navbar kini dapat diklik untuk langsung menuju halaman Release Notes.",
            scope: "Navigasi",
          },
          {
            description:
              "Kategori produk pada Master Produk kini tampil di overview dan formulir secara konsisten.",
            scope: "Produk",
          },
          {
            description:
              "Fitur toggle status kategori dua arah (Nonaktifkan ↔ Aktifkan) pada modal Kelola Status Kategori.",
            scope: "Produk",
            before: "Hanya bisa menonaktifkan kategori secara massal",
            after: "Bisa mengaktifkan kembali kategori yang sebelumnya dinonaktifkan via tab Aktifkan",
          },
        ],
      },
      {
        type: "changed",
        items: [
          {
            description:
              "Branding top navbar diganti dari judul halaman dinamis menjadi 'IVALORA RMS' dengan subtitle versi.",
            scope: "Navigasi",
            before: "Menampilkan nama halaman aktif (contoh: 'Katalog Produk')",
            after: "Menampilkan 'IVALORA RMS' + 'Retail Management System v1.5.0'",
          },
          {
            description:
              "Tombol 'Nonaktifkan per Kategori' diubah menjadi 'Kelola Status Kategori' untuk mencerminkan fungsionalitas dua arah.",
            scope: "Produk",
          },
          {
            description:
              "Overview kategori kini menampilkan semua produk termasuk yang nonaktif, dengan indikator jumlah unit nonaktif.",
            scope: "Produk",
            before: "Hanya menghitung produk aktif di overview card",
            after: "Menampilkan total produk + badge jumlah nonaktif per kategori",
          },
        ],
      },
      {
        type: "removed",
        items: [
          {
            description:
              "Tombol 'API Ongkir' dan komponen RajaOngkirKeysManager dihapus dari halaman Katalog karena redundan dengan fitur Ekspedisi.",
            scope: "Katalog",
            before: "Terdapat dua sub-fitur serupa: API Ongkir dan Ekspedisi",
            after: "Hanya fitur Ekspedisi yang tersedia (konsolidasi)",
          },
        ],
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-03-01",
    title: "Diskon Sale & Penyempurnaan Katalog",
    summary:
      "Penambahan fitur kampanye diskon sale, perbaikan UI katalog, dan peningkatan performa query produk.",
    sections: [
      {
        type: "added",
        items: [
          {
            description: "Halaman Diskon Sale untuk membuat dan mengelola kampanye diskon berbasis periode.",
            scope: "Marketing",
          },
          {
            description: "Dukungan item kampanye per series, storage, dan tipe garansi.",
            scope: "Marketing",
          },
          {
            description: "Banner dan popup kampanye dengan gradient kustom.",
            scope: "Marketing",
          },
        ],
      },
      {
        type: "improved",
        items: [
          {
            description: "Performa loading katalog ditingkatkan dengan optimasi query dan pagination.",
            scope: "Katalog",
          },
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-02-15",
    title: "Stok Opname & Notifikasi",
    summary:
      "Sistem stok opname lengkap dengan pemindaian barcode, jadwal otomatis, dan notifikasi real-time.",
    sections: [
      {
        type: "added",
        items: [
          {
            description: "Modul Stok Opname dengan pemindaian IMEI/barcode dan rekonsiliasi stok otomatis.",
            scope: "Operasional",
          },
          {
            description: "Penjadwalan opname berkala dengan notifikasi pengingat.",
            scope: "Operasional",
          },
          {
            description: "Sistem notifikasi in-app real-time untuk seluruh pengguna admin.",
            scope: "Sistem",
          },
        ],
      },
      {
        type: "fixed",
        items: [
          {
            description: "Perbaikan kalkulasi total pada transaksi dengan diskon bertumpuk.",
            scope: "Transaksi",
          },
        ],
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-02-01",
    title: "Multi-Cabang & Faktur",
    summary:
      "Dukungan multi-cabang penuh dengan manajemen admin per cabang dan sistem faktur yang dapat dikustomisasi.",
    sections: [
      {
        type: "added",
        items: [
          {
            description: "Manajemen multi-cabang dengan pengaturan cabang aktif di navbar.",
            scope: "Operasional",
          },
          {
            description: "Sistem faktur A4 dengan template, logo, tanda tangan, dan stempel kustom.",
            scope: "Penjualan",
          },
          {
            description: "Halaman faktur publik yang dapat diakses pelanggan via link unik.",
            scope: "Penjualan",
          },
        ],
      },
      {
        type: "security",
        items: [
          {
            description: "Implementasi RLS (Row Level Security) pada seluruh tabel terkait cabang.",
            scope: "Database",
          },
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-01-15",
    title: "POS & Manajemen Stok IMEI",
    summary:
      "Point of Sale (POS) terintegrasi dengan pemindaian IMEI dan manajemen stok unit individual.",
    sections: [
      {
        type: "added",
        items: [
          {
            description: "Modul Point of Sale (POS) dengan pemindaian barcode/IMEI.",
            scope: "Transaksi",
          },
          {
            description: "Manajemen stok berbasis IMEI dengan pelacakan kondisi dan harga per unit.",
            scope: "Produk",
          },
          {
            description: "Label status stok kustom dengan warna yang dapat dikonfigurasi.",
            scope: "Produk",
          },
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-01",
    title: "Rilis Awal",
    summary:
      "Rilis pertama IVALORA RMS — fondasi sistem manajemen retail mencakup master produk, autentikasi, dan toko online.",
    sections: [
      {
        type: "added",
        items: [
          {
            description: "Master Produk dengan kategori iPhone, iPad, MacBook, Apple Watch, AirPods, dan Aksesori.",
            scope: "Produk",
          },
          {
            description: "Autentikasi admin multi-role: Super Admin, Admin Cabang, Web Admin, Employee.",
            scope: "Sistem",
          },
          {
            description: "Toko online dengan katalog produk, keranjang belanja, dan checkout.",
            scope: "Customer",
          },
          {
            description: "Landing page dengan promo, ulasan, dan integrasi marketplace.",
            scope: "Customer",
          },
          {
            description: "Dashboard admin dengan ringkasan statistik dan navigasi sidebar.",
            scope: "Sistem",
          },
        ],
      },
    ],
  },
];
