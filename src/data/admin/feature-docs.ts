/**
 * IVALORA RMS — Dokumentasi Fitur Lengkap
 * ────────────────────────────────────────
 * Setiap fitur didokumentasikan dengan:
 * - Definisi dan scope
 * - Use cases terstruktur (kode UC, aktor, prasyarat, deskripsi, hasil)
 * - Batasan akses per role
 * - Tingkat kompleksitas
 * - Struktur file proyek (frontend & backend)
 */

export type ComplexityLevel = "rendah" | "sedang" | "tinggi" | "sangat_tinggi";
export type RoleName = "super_admin" | "admin_branch" | "employee" | "web_admin" | "customer" | "publik";

export interface RoleAccess {
  role: RoleName;
  access: "penuh" | "terbatas" | "baca_saja" | "tidak_ada";
  detail?: string;
}

export interface UseCase {
  id: string;
  title: string;
  actor: string;
  prerequisite: string;
  description: string;
  result: string;
}

export interface SubFeature {
  name: string;
  description?: string;
}

export interface SourceFile {
  path: string;
  type: "frontend" | "backend" | "config" | "data";
  description: string;
}

export type FeatureStatus = "stable" | "beta" | "deprecated" | "wip";

export interface RevisionEntry {
  version: string;
  date: string;
  description: string;
  author?: string;
}

export interface ExternalIntegration {
  name: string;
  type: "payment_gateway" | "shipping_api" | "ai_service" | "email" | "storage" | "database" | "other";
  description: string;
  docsUrl?: string;
}

export interface FeatureDoc {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  scope: string[];
  useCases: UseCase[];
  roleAccess: RoleAccess[];
  complexity: ComplexityLevel;
  subFeatures?: SubFeature[];
  notes?: string;
  sourceFiles?: SourceFile[];
  introducedIn?: string;
  status?: FeatureStatus;
  relatedFeatures?: string[];
  externalIntegrations?: ExternalIntegration[];
  revisionHistory?: RevisionEntry[];
}

export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin: "Super Admin",
  admin_branch: "Admin Cabang",
  employee: "Employee",
  web_admin: "Web Admin",
  customer: "Customer",
  publik: "Publik",
};

export const COMPLEXITY_CONFIG: Record<ComplexityLevel, { label: string; gradient: string; bg: string; text: string; dots: number }> = {
  rendah: { label: "Rendah", gradient: "from-emerald-600 to-teal-600", bg: "bg-emerald-50", text: "text-emerald-700", dots: 1 },
  sedang: { label: "Sedang", gradient: "from-blue-600 to-indigo-600", bg: "bg-blue-50", text: "text-blue-700", dots: 2 },
  tinggi: { label: "Tinggi", gradient: "from-orange-600 to-orange-700", bg: "bg-orange-50", text: "text-orange-700", dots: 3 },
  sangat_tinggi: { label: "Sangat Tinggi", gradient: "from-red-700 to-rose-700", bg: "bg-red-50", text: "text-red-700", dots: 4 },
};

export const ACCESS_COLORS: Record<string, string> = {
  penuh: "bg-emerald-100 text-emerald-800",
  terbatas: "bg-amber-100 text-amber-800",
  baca_saja: "bg-blue-100 text-blue-800",
  tidak_ada: "bg-gray-100 text-gray-500",
};

export const ACCESS_LABELS: Record<string, string> = {
  penuh: "✅ Penuh",
  terbatas: "⚠️ Terbatas",
  baca_saja: "👁 Baca Saja",
  tidak_ada: "— Tidak Ada",
};

export const FEATURE_STATUS_CONFIG: Record<FeatureStatus, {
  label: string;
  badge: string;
  description: string;
}> = {
  stable: {
    label: "Stable",
    badge: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    description: "Fitur sudah stabil dan siap produksi",
  },
  beta: {
    label: "Beta",
    badge: "bg-blue-100 text-blue-800 border border-blue-200",
    description: "Fitur tersedia tapi masih dalam pengujian aktif",
  },
  deprecated: {
    label: "Deprecated",
    badge: "bg-red-100 text-red-800 border border-red-200",
    description: "Fitur dijadwalkan untuk dihapus di versi mendatang",
  },
  wip: {
    label: "In Development",
    badge: "bg-amber-100 text-amber-800 border border-amber-200",
    description: "Fitur sedang dalam pengembangan aktif",
  },
};

export const FEATURE_CATEGORIES = [
  "Autentikasi & Otorisasi",
  "Dashboard & Overview",
  "Manajemen Akun",
  "Operasional Cabang",
  "Produk & Inventory",
  "Penjualan & Transaksi",
  "Marketing & Promosi",
  "Katalog & Website",
  "Laporan & Analitika",
  "Pengaturan Sistem",
  "Customer-Facing",
];

export const FEATURES: FeatureDoc[] = [
  // ═══ AUTENTIKASI & OTORISASI ═══
  {
    id: "auth-multi-role",
    name: "Autentikasi Multi-Role (RBAC)",
    category: "Autentikasi & Otorisasi",
    icon: "ShieldCheck",
    description:
      "Sistem autentikasi berbasis Role-Based Access Control (RBAC) yang membedakan hak akses pengguna berdasarkan peran. Setiap pengguna admin harus mendaftar dan menunggu persetujuan Super Admin sebelum dapat mengakses dashboard. Sistem mendukung 4 role admin dan 1 role customer dengan batasan akses yang berbeda di setiap fitur.",
    scope: [
      "Registrasi admin dengan verifikasi email wajib",
      "Login terpisah untuk admin (/admin/login) dan customer (/login)",
      "Sistem approval: akun baru berstatus 'pending' hingga disetujui",
      "4 role admin: Super Admin, Admin Cabang, Employee, Web Admin",
      "1 role customer terpisah dengan autentikasi independen",
      "Proteksi route berdasarkan role — akses ditolak jika role tidak sesuai",
      "Lupa password dan reset password via email",
      "Status akun: pending, active, suspended, rejected",
    ],
    useCases: [
      {
        id: "UC-AUTH-01",
        title: "Registrasi Akun Admin Baru",
        actor: "Pengguna baru (guest)",
        prerequisite: "Belum memiliki akun; mengakses halaman registrasi admin.",
        description: "Pengguna mengisi formulir registrasi admin (nama, email, password). Sistem memvalidasi input (email unik, password confirmed), memverifikasi reCAPTCHA v3, dan membuat akun dengan status 'pending'. Email verifikasi dikirim otomatis.",
        result: "Akun admin tercatat dengan status 'pending'. Pengguna diarahkan ke halaman Waiting Approval. Super Admin menerima notifikasi untuk review.",
      },
      {
        id: "UC-AUTH-02",
        title: "Login Admin ke Dashboard",
        actor: "Admin terdaftar (active)",
        prerequisite: "Memiliki akun aktif (sudah disetujui Super Admin); email terverifikasi.",
        description: "Admin mengisi email dan password di halaman login admin. Sistem memvalidasi kredensial, memeriksa status akun (active), dan mengarahkan ke dashboard sesuai cabang yang ditugaskan.",
        result: "Admin berhasil login dan diarahkan ke dashboard cabang. Session aktif tersimpan.",
      },
      {
        id: "UC-AUTH-03",
        title: "Registrasi Akun Customer",
        actor: "Pengunjung website (guest)",
        prerequisite: "Belum memiliki akun customer; mengakses halaman registrasi customer.",
        description: "Customer mengisi formulir registrasi (nama, email, password, nomor telepon). Sistem memvalidasi input dan membuat akun. Email verifikasi dikirim.",
        result: "Akun customer tercatat. Customer dapat login setelah verifikasi email dan mengakses fitur toko online (keranjang, checkout, riwayat).",
      },
      {
        id: "UC-AUTH-04",
        title: "Lupa & Reset Password",
        actor: "Admin atau Customer",
        prerequisite: "Memiliki akun terdaftar; lupa password.",
        description: "Pengguna mengakses halaman lupa password, memasukkan email terdaftar. Sistem mengirim link reset password via email. Pengguna klik link, memasukkan password baru.",
        result: "Password berhasil diperbarui. Pengguna dapat login dengan password baru.",
      },
      {
        id: "UC-AUTH-05",
        title: "Approval Akun Admin oleh Super Admin",
        actor: "Super Admin",
        prerequisite: "Terdapat akun admin berstatus 'pending'.",
        description: "Super Admin membuka daftar akun pending di Manajemen Admin. Mereview profil pendaftar, lalu memilih Approve (dengan assign role & cabang) atau Reject.",
        result: "Jika disetujui: akun berubah ke status 'active', admin bisa login. Jika ditolak: akun berstatus 'rejected'.",
      },
      {
        id: "UC-AUTH-06",
        title: "Proteksi Route Berdasarkan Role",
        actor: "Sistem (otomatis)",
        prerequisite: "Pengguna sudah login.",
        description: "Saat pengguna mengakses halaman tertentu, sistem memeriksa role pengguna terhadap daftar role yang diizinkan. Jika tidak sesuai, akses ditolak.",
        result: "Pengguna yang tidak berwenang diarahkan ke halaman unauthorized atau dashboard default.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Mengelola semua akun, menyetujui/menolak pendaftaran, mengubah role" },
      { role: "admin_branch", access: "terbatas", detail: "Mengelola staff dan customer di cabang sendiri" },
      { role: "employee", access: "tidak_ada", detail: "Tidak dapat mengelola akun lain" },
      { role: "web_admin", access: "tidak_ada", detail: "Tidak dapat mengelola akun" },
      { role: "customer", access: "tidak_ada", detail: "Hanya bisa mengelola akun sendiri" },
    ],
    complexity: "sangat_tinggi",
    subFeatures: [
      { name: "Login & Registrasi Admin", description: "Formulir login dan registrasi khusus admin dengan validasi dan reCAPTCHA" },
      { name: "Login & Registrasi Customer", description: "Formulir login dan registrasi untuk pelanggan toko online" },
      { name: "Waiting Approval Page", description: "Halaman tunggu untuk admin baru yang belum disetujui Super Admin" },
      { name: "Lupa & Reset Password", description: "Alur pemulihan password via email untuk admin dan customer" },
      { name: "Row Level Security (RLS)", description: "Proteksi data pada level database — setiap query dibatasi berdasarkan role dan cabang" },
    ],
    sourceFiles: [
      { path: "src/contexts/admin/AuthContext.tsx", type: "frontend", description: "Context provider autentikasi admin (state, login, logout, role)" },
      { path: "src/contexts/customer/CustomerAuthContext.tsx", type: "frontend", description: "Context provider autentikasi customer terpisah" },
      { path: "src/components/auth/ProtectedRoute.tsx", type: "frontend", description: "HOC proteksi route berdasarkan role" },
      { path: "src/pages/auth/AdminLoginPage.tsx", type: "frontend", description: "Halaman login admin" },
      { path: "src/pages/auth/AdminRegisterPage.tsx", type: "frontend", description: "Halaman registrasi admin" },
      { path: "src/pages/auth/CustomerLoginPage.tsx", type: "frontend", description: "Halaman login customer" },
      { path: "src/pages/auth/CustomerRegisterPage.tsx", type: "frontend", description: "Halaman registrasi customer" },
      { path: "src/pages/auth/WaitingApprovalPage.tsx", type: "frontend", description: "Halaman tunggu approval admin baru" },
      { path: "src/pages/auth/AdminForgotPasswordPage.tsx", type: "frontend", description: "Halaman lupa password admin" },
      { path: "src/pages/auth/AdminResetPasswordPage.tsx", type: "frontend", description: "Halaman reset password admin" },
      { path: "supabase/functions/approve-admin/index.ts", type: "backend", description: "Edge function untuk approve/reject akun admin" },
      { path: "supabase/functions/create-admin-account/index.ts", type: "backend", description: "Edge function pembuatan akun admin" },
      { path: "supabase/functions/verify-recaptcha/index.ts", type: "backend", description: "Edge function verifikasi reCAPTCHA v3" },
      { path: "supabase/functions/get-recaptcha-sitekey/index.ts", type: "backend", description: "Edge function ambil sitekey reCAPTCHA" },
      { path: "src/hooks/shared/use-recaptcha.ts", type: "frontend", description: "Hook integrasi reCAPTCHA v3" },
    ],
    notes: "Menggunakan Row Level Security (RLS) pada database sehingga data hanya bisa diakses oleh pengguna yang berwenang, bahkan pada level query database.",
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["manage-admin", "manage-customer", "branch-management"],
    revisionHistory: [
      { version: "1.0.0", date: "2026-01-15", description: "Rilis awal: login admin, registrasi, approval Super Admin, proteksi route." },
      { version: "1.1.0", date: "2026-03-10", description: "Ditambahkan autentikasi customer terpisah dengan alur registrasi dan OTP email." },
      { version: "1.2.0", date: "2026-06-20", description: "Integrasi reCAPTCHA v3 pada form login & registrasi admin untuk mencegah bot." },
      { version: "1.4.0", date: "2026-10-05", description: "Perbaikan alur reset password: token kadaluarsa dalam 1 jam, validasi lebih ketat." },
    ],
  },

  // ═══ DASHBOARD & OVERVIEW ═══
  {
    id: "dashboard",
    name: "Dashboard Admin",
    category: "Dashboard & Overview",
    icon: "LayoutDashboard",
    description:
      "Halaman utama setelah login yang menampilkan ringkasan statistik bisnis secara real-time. Dashboard menampilkan data sesuai cabang aktif pengguna, sehingga setiap cabang hanya melihat data miliknya sendiri (kecuali Super Admin yang bisa melihat semua).",
    scope: [
      "Ringkasan total produk, stok tersedia, dan stok terjual",
      "Statistik transaksi harian/bulanan",
      "Grafik tren penjualan",
      "Overview stok per kategori produk",
      "Data real-time sesuai cabang aktif",
    ],
    useCases: [
      {
        id: "UC-DASH-01",
        title: "Lihat Ringkasan Dashboard",
        actor: "Admin (semua role)",
        prerequisite: "Sudah login; memiliki cabang yang ditugaskan.",
        description: "Admin login dan otomatis diarahkan ke dashboard. Sistem menampilkan ringkasan statistik (total produk, stok, transaksi) sesuai cabang aktif.",
        result: "Dashboard menampilkan data statistik cabang aktif secara real-time.",
      },
      {
        id: "UC-DASH-02",
        title: "Switch Cabang di Dashboard",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin; terdapat lebih dari satu cabang.",
        description: "Super Admin memilih cabang lain dari dropdown di navbar. Seluruh data dashboard berubah sesuai cabang yang dipilih.",
        result: "Dashboard menampilkan data cabang yang dipilih.",
      },
      {
        id: "UC-DASH-03",
        title: "Cek Tren Penjualan",
        actor: "Admin Cabang / Super Admin",
        prerequisite: "Sudah login; terdapat data transaksi.",
        description: "Admin melihat grafik tren penjualan di dashboard. Grafik menampilkan data harian atau bulanan yang bisa di-toggle.",
        result: "Grafik tren penjualan ditampilkan dengan data terkini.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Melihat data seluruh cabang, bisa switch cabang" },
      { role: "admin_branch", access: "terbatas", detail: "Hanya melihat data cabang sendiri" },
      { role: "employee", access: "baca_saja", detail: "Melihat ringkasan cabang tempat bekerja" },
      { role: "web_admin", access: "baca_saja", detail: "Melihat statistik katalog website" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/admin/DashboardPage.tsx", type: "frontend", description: "Halaman utama dashboard admin" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["reports", "branch-management", "activity-log"],
  },

  // ═══ MANAJEMEN AKUN ═══
  {
    id: "manage-admin",
    name: "Manajemen Akun Admin",
    category: "Manajemen Akun",
    icon: "Users",
    description:
      "Mengelola seluruh akun admin dalam sistem termasuk menyetujui pendaftaran baru, mengubah role, mengaktifkan/menonaktifkan akun, dan menugaskan admin ke cabang tertentu.",
    scope: [
      "Daftar seluruh admin dengan filter status dan role",
      "Approve/reject pendaftaran admin baru",
      "Ubah role admin (Super Admin, Admin Cabang, Employee, Web Admin)",
      "Assign/unassign admin ke cabang",
      "Suspend atau aktifkan kembali akun admin",
      "Tab navigasi: Daftar Admin, Pending Approval",
    ],
    useCases: [
      {
        id: "UC-ADM-01",
        title: "Lihat Daftar Admin",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Buka halaman Manajemen Admin. Sistem menampilkan tabel seluruh admin dengan informasi nama, email, role, cabang, dan status. Dapat difilter berdasarkan role atau status.",
        result: "Daftar admin ditampilkan dengan filter aktif.",
      },
      {
        id: "UC-ADM-02",
        title: "Approve Pendaftaran Admin Baru",
        actor: "Super Admin",
        prerequisite: "Terdapat admin berstatus 'pending'.",
        description: "Buka tab Pending Approval. Review profil pendaftar. Klik Approve, pilih role dan cabang yang akan ditugaskan. Konfirmasi.",
        result: "Akun admin berubah ke status 'active' dengan role dan cabang yang ditentukan. Admin baru bisa login.",
      },
      {
        id: "UC-ADM-03",
        title: "Ubah Role Admin",
        actor: "Super Admin",
        prerequisite: "Admin target sudah berstatus active.",
        description: "Pilih admin dari daftar. Klik ubah role. Pilih role baru dari pilihan yang tersedia. Simpan perubahan.",
        result: "Role admin berubah. Hak akses menyesuaikan role baru secara otomatis.",
      },
      {
        id: "UC-ADM-04",
        title: "Suspend Akun Admin",
        actor: "Super Admin",
        prerequisite: "Admin target berstatus active.",
        description: "Pilih admin dari daftar. Klik Suspend. Konfirmasi tindakan. Akun dinonaktifkan.",
        result: "Admin tidak bisa login. Data dan riwayat aktivitas tetap tersimpan.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Kelola semua admin di semua cabang" },
      { role: "admin_branch", access: "terbatas", detail: "Hanya mengelola staff di cabang sendiri" },
      { role: "employee", access: "tidak_ada" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "tinggi",
    sourceFiles: [
      { path: "src/pages/admin/pengguna/ManajemenAdminPage.tsx", type: "frontend", description: "Halaman manajemen akun admin" },
      { path: "supabase/functions/approve-admin/index.ts", type: "backend", description: "Edge function approve/reject admin" },
      { path: "supabase/functions/create-admin-account/index.ts", type: "backend", description: "Edge function buat akun admin" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["auth-multi-role", "manage-customer", "branch-management"],
  },
  {
    id: "manage-customer",
    name: "Manajemen Akun Customer",
    category: "Manajemen Akun",
    icon: "UserCheck",
    description:
      "Mengelola akun pelanggan yang mendaftar melalui website toko online. Termasuk melihat profil, riwayat belanja, dan status akun customer.",
    scope: [
      "Daftar customer dengan pencarian dan filter",
      "Lihat detail profil dan alamat customer",
      "Aktivasi/deaktivasi akun customer",
      "Lihat riwayat transaksi per customer",
    ],
    useCases: [
      {
        id: "UC-CUS-01",
        title: "Lihat Daftar Customer",
        actor: "Super Admin / Admin Cabang",
        prerequisite: "Login sebagai admin.",
        description: "Buka halaman Manajemen Customer. Cari berdasarkan nama atau email. Lihat daftar customer yang terdaftar.",
        result: "Daftar customer ditampilkan dengan informasi profil dasar.",
      },
      {
        id: "UC-CUS-02",
        title: "Deaktivasi Akun Customer",
        actor: "Super Admin",
        prerequisite: "Customer target berstatus active.",
        description: "Pilih customer dari daftar. Klik Nonaktifkan. Konfirmasi tindakan.",
        result: "Customer tidak bisa login. Riwayat transaksi tetap tersimpan.",
      },
      {
        id: "UC-CUS-03",
        title: "Lihat Riwayat Transaksi Customer",
        actor: "Super Admin / Admin Cabang",
        prerequisite: "Customer memiliki riwayat transaksi.",
        description: "Buka detail customer. Navigasi ke tab riwayat transaksi. Lihat daftar pesanan customer.",
        result: "Riwayat transaksi customer ditampilkan kronologis.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Kelola semua customer" },
      { role: "admin_branch", access: "terbatas", detail: "Lihat customer yang bertransaksi di cabangnya" },
      { role: "employee", access: "tidak_ada" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/admin/pengguna/ManajemenCustomerPage.tsx", type: "frontend", description: "Halaman manajemen customer" },
      { path: "supabase/functions/manage-customer/index.ts", type: "backend", description: "Edge function kelola akun customer" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["auth-multi-role", "manage-admin", "online-shop", "reviews"],
  },

  // ═══ OPERASIONAL CABANG ═══
  {
    id: "branch-management",
    name: "Manajemen Cabang",
    category: "Operasional Cabang",
    icon: "Building2",
    description:
      "Mengelola data cabang/toko fisik yang terdaftar dalam sistem. Setiap cabang memiliki kode unik, alamat lengkap dengan integrasi wilayah Indonesia, dan koordinat GPS untuk Google Maps.",
    scope: [
      "Tambah, edit, dan nonaktifkan cabang",
      "Input alamat dengan autocomplete wilayah Indonesia",
      "Integrasi Google Maps (koordinat & URL)",
      "Kode cabang unik untuk identifikasi",
      "Status aktif/nonaktif cabang",
      "Nomor telepon cabang",
    ],
    useCases: [
      {
        id: "UC-BRN-01",
        title: "Tambah Cabang Baru",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Klik Tambah Cabang. Isi nama cabang, kode unik, nomor telepon. Pilih wilayah (provinsi → kota → kecamatan → kelurahan) via autocomplete. Input alamat lengkap dan koordinat GPS. Simpan.",
        result: "Cabang baru terdaftar. Dapat dipilih saat assign admin atau input stok.",
      },
      {
        id: "UC-BRN-02",
        title: "Edit Data Cabang",
        actor: "Super Admin",
        prerequisite: "Cabang sudah terdaftar.",
        description: "Pilih cabang dari daftar. Klik Edit. Ubah data yang diperlukan (nama, alamat, telepon, koordinat). Simpan.",
        result: "Data cabang diperbarui di seluruh sistem.",
      },
      {
        id: "UC-BRN-03",
        title: "Nonaktifkan Cabang",
        actor: "Super Admin",
        prerequisite: "Cabang berstatus aktif.",
        description: "Pilih cabang. Toggle status ke nonaktif. Konfirmasi tindakan.",
        result: "Cabang tidak aktif. Data historis tetap ada. Cabang tidak muncul di dropdown pilihan.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "CRUD cabang tanpa batasan" },
      { role: "admin_branch", access: "baca_saja", detail: "Hanya melihat info cabang sendiri" },
      { role: "employee", access: "tidak_ada" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "tinggi",
    sourceFiles: [
      { path: "src/pages/admin/operasional/ManajemenCabangPage.tsx", type: "frontend", description: "Halaman manajemen cabang" },
      { path: "src/components/admin/operasional/BranchFormModal.tsx", type: "frontend", description: "Modal form tambah/edit cabang" },
      { path: "src/components/admin/operasional/BranchDetailDrawer.tsx", type: "frontend", description: "Drawer detail cabang" },
      { path: "src/components/admin/operasional/WilayahCombobox.tsx", type: "frontend", description: "Combobox autocomplete wilayah Indonesia" },
      { path: "src/hooks/admin/use-wilayah.ts", type: "frontend", description: "Hook data wilayah Indonesia (provinsi, kota, kecamatan, kelurahan)" },
      { path: "supabase/functions/wilayah-proxy/index.ts", type: "backend", description: "Proxy API wilayah Indonesia" },
    ],
    notes: "Cabang adalah unit utama pemisahan data — semua data stok, transaksi, dan faktur terikat ke cabang.",
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["manage-admin", "dashboard", "stock-products"],
    externalIntegrations: [
      {
        name: "API Wilayah Indonesia",
        type: "other",
        description: "API publik untuk data wilayah Indonesia (provinsi, kota, kecamatan, kelurahan) saat input alamat cabang.",
        docsUrl: "https://github.com/cahyadsn/wilayah",
      },
    ],
  },

  // ═══ PRODUK & INVENTORY ═══
  {
    id: "master-products",
    name: "Master Produk",
    category: "Produk & Inventory",
    icon: "Database",
    description:
      "Database induk semua varian produk yang dijual. Setiap SKU (Stock Keeping Unit) didefinisikan oleh kombinasi unik atribut produk sesuai kategorinya — misalnya iPhone menggunakan Seri + Storage + Warna + Tipe Garansi, sedangkan Apple Watch menggunakan Seri + Ukuran Case (mm) + Warna. Master produk menjadi referensi pusat untuk input stok IMEI, katalog online, dan seluruh transaksi. Sejak v1.6.0, sistem mendukung enam kategori: iPhone, iPad, MacBook, Apple Watch, AirPods, dan Aksesori — dengan form dan tampilan tabel yang menyesuaikan diri otomatis per kategori.",
    scope: [
      "6 kategori produk: iPhone, iPad, MacBook, Apple Watch, AirPods, Aksesori",
      "Atribut adaptif per kategori: storage (GB), warna, ukuran case (mm), tipe garansi",
      "Identitas SKU unik berdasarkan kombinasi atribut yang relevan per kategori",
      "Apple Watch: atribut ukuran case wajib (40mm, 41mm, 44mm, 45mm, 49mm); garansi dikunci ke Resmi",
      "AirPods: tidak memiliki atribut storage/warna/ukuran; garansi dikunci ke Resmi",
      "Aksesori: storage dan warna bersifat opsional (muncul hanya jika relevan); tanpa garansi",
      "Harga dasar per varian (opsional, untuk referensi)",
      "Berat produk (gram) untuk kalkulasi ongkos kirim",
      "Status aktif/nonaktif per varian SKU",
      "Soft delete — data tidak hilang permanen dari database",
      "Overview card per kategori dengan hitungan SKU aktif/nonaktif",
      "Toggle status kategori massal (aktifkan/nonaktifkan semua SKU satu kategori sekaligus)",
      "Tabel kolom dinamis: kolom Storage, Ukuran, Warna, Garansi tampil/sembunyi otomatis sesuai filter kategori aktif",
    ],
    useCases: [
      {
        id: "UC-MPR-01",
        title: "Tambah SKU iPhone / iPad / MacBook",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Klik Tambah Produk. Pilih kategori (iPhone, iPad, atau MacBook). Form menampilkan field Storage, Warna, dan Tipe Garansi. Isi Seri (misal: iPhone 16 Pro Max), pilih kapasitas storage dari dropdown, masukkan warna, dan pilih tipe garansi (Resmi BC, Inter, Non-Active, dll). Simpan.",
        result: "SKU baru terdaftar dengan kombinasi unik. Tersedia sebagai referensi saat input stok IMEI dan katalog online.",
      },
      {
        id: "UC-MPR-02",
        title: "Tambah SKU Apple Watch",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Pilih kategori Apple Watch. Form menampilkan field Ukuran Case (dropdown: 40mm, 41mm, 44mm, 45mm, 49mm) dan Warna. Field Storage tidak muncul karena tidak relevan. Tipe garansi otomatis dikunci ke 'Resmi' — tidak bisa diubah. Isi Seri (misal: Apple Watch Series 9), pilih ukuran, masukkan warna (misal: Midnight). Simpan.",
        result: "SKU Watch terdaftar dengan atribut ukuran case. Kombinasi Seri + Ukuran + Warna menjadi identitas unik SKU.",
      },
      {
        id: "UC-MPR-03",
        title: "Tambah SKU AirPods",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Pilih kategori AirPods. Form menampilkan hanya field Seri — tidak ada storage, warna, atau ukuran karena tidak relevan untuk produk ini. Garansi otomatis dikunci ke 'Resmi'. Isi nama seri (misal: AirPods Pro 2nd Gen). Simpan.",
        result: "SKU AirPods terdaftar. Form ringkas mencegah pengisian atribut yang tidak berlaku untuk kategori ini.",
      },
      {
        id: "UC-MPR-04",
        title: "Tambah SKU Aksesori",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Pilih kategori Aksesori. Form menampilkan nama produk/seri dan dua checkbox opsional: 'Produk ini memiliki variasi Storage' dan 'Produk ini memiliki variasi Warna'. Centang hanya jika aksesori tersebut punya varian (misal: kabel USB-C tidak punya warna, tapi case iPhone punya warna). Tidak ada field garansi untuk aksesori.",
        result: "SKU aksesori terdaftar dengan fleksibilitas atribut opsional. Produk tanpa varian storage/warna memiliki SKU tunggal per nama.",
      },
      {
        id: "UC-MPR-05",
        title: "Filter Tabel per Kategori & Kolom Dinamis",
        actor: "Semua admin",
        prerequisite: "Terdapat data produk di sistem.",
        description: "Pilih filter kategori (misal: Apple Watch). Tabel otomatis menyesuaikan kolom yang ditampilkan: kolom Storage disembunyikan (tidak relevan untuk Watch), kolom Ukuran dimunculkan. Saat memilih filter AirPods, hanya kolom Tipe Garansi yang tampil karena AirPods tidak punya storage/ukuran/warna. Filter 'Semua' menampilkan semua kolom. Kolom Kategori disembunyikan saat filter spesifik aktif (sudah jelas dari konteks).",
        result: "Tabel lebih ringkas dan relevan per kategori, tanpa kolom kosong yang mengganggu fokus.",
      },
      {
        id: "UC-MPR-06",
        title: "Nonaktifkan & Aktifkan Kategori Massal",
        actor: "Super Admin",
        prerequisite: "Terdapat kategori dengan produk aktif.",
        description: "Klik Kelola Status Kategori. Pilih tab Nonaktifkan. Centang kategori target (misal: iPad). Konfirmasi. Semua SKU iPad menjadi nonaktif sekaligus — tidak muncul saat input stok baru maupun di katalog. Untuk membalik, buka tab Aktifkan dan ulangi proses.",
        result: "Status seluruh SKU dalam kategori berubah massal. Efisien saat musim tertentu produk tidak tersedia stok.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Tambah, edit, nonaktifkan, hapus produk; kelola status kategori massal" },
      { role: "admin_branch", access: "baca_saja", detail: "Lihat daftar produk dan detail SKU" },
      { role: "employee", access: "baca_saja", detail: "Lihat daftar produk untuk referensi input stok" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "tinggi",
    subFeatures: [
      { name: "CRUD SKU Produk", description: "Tambah, edit, nonaktifkan, dan soft-delete varian produk (SKU)" },
      { name: "Form Adaptif per Kategori", description: "Form tambah/edit menampilkan field yang relevan saja: iPhone/iPad/MacBook punya Storage+Warna, Watch punya Ukuran Case, AirPods hanya Seri, Aksesori dengan atribut opsional" },
      { name: "Tabel Kolom Dinamis", description: "Kolom Storage, Ukuran, Warna, dan Tipe Garansi tampil/sembunyi otomatis sesuai filter kategori aktif — tidak ada kolom kosong yang mengganggu" },
      { name: "Overview Kategori", description: "Card ringkasan hitungan SKU aktif/nonaktif per kategori dengan akses cepat ke filter" },
      { name: "Toggle Status Kategori Massal", description: "Aktifkan atau nonaktifkan seluruh SKU dalam satu kategori sekaligus — berguna saat stok kategori tertentu kosong sepenuhnya" },
      { name: "Label Garansi", description: "Cetak label garansi fisik untuk unit produk" },
      { name: "Pencarian & Filter Multi-Kolom", description: "Filter bersamaan: kategori, series, kondisi stok, garansi, cabang, status katalog, range tanggal" },
    ],
    notes:
      "Sejak v1.6.0, SKU unik ditentukan oleh constraint NULLS NOT DISTINCT di PostgreSQL 17 — artinya dua SKU dengan atribut NULL yang sama (misal dua AirPods Pro tanpa warna) dianggap duplikat dan tidak bisa ditambahkan dua kali.",
    sourceFiles: [
      { path: "src/pages/admin/produk/MasterProductsPage.tsx", type: "frontend", description: "Halaman utama master produk dengan tabel kolom dinamis" },
      { path: "src/components/admin/produk/ProductFormModal.tsx", type: "frontend", description: "Modal form adaptif tambah/edit produk — field menyesuaikan kategori" },
      { path: "src/components/admin/produk/ProductDetailDrawer.tsx", type: "frontend", description: "Drawer detail SKU termasuk ringkasan stok available/sold" },
      { path: "src/components/admin/produk/CategoryStatsCards.tsx", type: "frontend", description: "Card overview per kategori" },
      { path: "src/components/admin/produk/BulkDeactivateModal.tsx", type: "frontend", description: "Modal kelola status kategori massal" },
      { path: "src/components/admin/produk/WarrantyLabelModal.tsx", type: "frontend", description: "Modal cetak label garansi" },
      { path: "src/lib/admin/produk/master-products.ts", type: "data", description: "Konstanta kategori, helper formatStorage/formatSize, daftar ukuran Watch, dan logika kolom per kategori" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["stock-products", "catalog", "pos"],
    revisionHistory: [
      { version: "1.0.0", date: "2026-01-15", description: "Rilis awal: CRUD varian produk, filter kategori iPhone/iPad/MacBook." },
      { version: "1.1.0", date: "2026-02-01", description: "Ditambahkan fitur toggle status kategori massal dan cetak label garansi." },
      { version: "1.3.0", date: "2026-02-20", description: "Overview card per kategori dengan hitungan SKU aktif/nonaktif." },
      { version: "1.6.0", date: "2026-03-28", description: "Master Produk v2: dukungan Apple Watch (dengan ukuran case mm), AirPods, dan Aksesori. Form adaptif per kategori. Tabel kolom dinamis sesuai filter aktif. Database: storage_gb/color/warranty_type dibuat nullable, kolom size_mm ditambahkan, unique constraint diperbarui ke NULLS NOT DISTINCT (PostgreSQL 17).", author: "Tim IVALORA" },
    ],
  },
  {
    id: "stock-products",
    name: "Manajemen Stok Produk",
    category: "Produk & Inventory",
    icon: "Package",
    description:
      "Manajemen stok multi-tipe: IMEI-tracked (iPhone), Serial-tracked (iPad/MacBook/Watch/AirPods), dan Qty-tracked (Aksesoris). Setiap unit fisik dilacak dengan identifier adaptif, status, kondisi, harga, supplier, dan riwayat perubahan. Mendukung import massal via CSV per tipe dengan AI-assisted mapping.",
    scope: [
      "Tiga tipe tracking: IMEI (iPhone), Serial Number (iPad/MacBook/Watch/AirPods), Qty (Aksesoris)",
      "Identifier adaptif per kategori: IMEI unik, Serial Number unik, atau jumlah stok",
      "Status penjualan dinamis (available, sold, reserved, dll)",
      "Kondisi unit: Fullset, No Fullset, Minus (tersembunyi untuk aksesoris)",
      "Tingkat minus: ringan, sedang, berat",
      "Harga beli (cost) dan harga jual (selling) per unit",
      "Supplier tracking per unit",
      "Foto unit individual (multi-foto)",
      "Tanggal diterima & tanggal terjual",
      "Kanal penjualan (POS, Website, Marketplace)",
      "Cycle Time: durasi diterima hingga terjual",
      "Import CSV adaptif per tipe (IMEI/SN/Qty) dengan AI-assisted mapping",
      "Deteksi IMEI/SN duplikat saat import",
      "Filter kategori, status, kondisi, supplier, cabang, dan rentang tanggal",
      "Export CSV adaptif per tipe",
    ],
    useCases: [
      {
        id: "UC-STK-01",
        title: "Tambah Unit Stok Manual",
        actor: "Admin Cabang / Super Admin / Employee",
        prerequisite: "Produk sudah terdaftar di Master Produk.",
        description: "Klik Tambah Unit. Pilih kategori produk (iPhone/iPad/MacBook/Watch/AirPods/Aksesoris). Pilih produk dari dropdown. Input identifier sesuai tipe: IMEI (iPhone), Serial Number (iPad/MacBook/Watch/AirPods), atau Qty (Aksesoris). Set harga beli dan harga jual. Pilih kondisi (khusus IMEI/SN). Simpan.",
        result: "Unit baru terdaftar dengan status 'available'. Muncul di daftar stok cabang dengan identifier yang sesuai.",
      },
      {
        id: "UC-STK-02",
        title: "Import Stok via CSV",
        actor: "Admin Cabang / Super Admin",
        prerequisite: "Memiliki file CSV dengan data stok.",
        description: "Klik Import. Pilih tipe import (IMEI/Serial Number/Qty). Download template CSV sesuai tipe. Upload file CSV. Sistem melakukan AI mapping kolom otomatis. Konfirmasi import.",
        result: "Unit-unit baru terdaftar dari CSV. Duplikat identifier otomatis di-update dengan laporan. Log import tersimpan.",
      },
      {
        id: "UC-STK-03",
        title: "Edit Detail Unit",
        actor: "Admin Cabang / Super Admin",
        prerequisite: "Unit sudah terdaftar.",
        description: "Klik unit dari tabel. Buka detail. Ubah identifier (IMEI/SN), harga, kondisi, catatan, atau foto. Simpan perubahan.",
        result: "Data unit diperbarui. Riwayat perubahan (log) tercatat otomatis dengan field yang diubah, nilai lama, dan nilai baru.",
      },
      {
        id: "UC-STK-04",
        title: "Klaim Garansi Unit",
        actor: "Admin Cabang / Super Admin",
        prerequisite: "Unit berstatus 'available' atau 'sold' dan masih dalam masa garansi.",
        description: "Pilih unit. Klik Klaim Garansi. Isi detail klaim (jenis kerusakan, vendor service). Cari unit pengganti via IMEI atau Serial Number sesuai tipe. Konfirmasi.",
        result: "Klaim garansi tercatat dengan status 'Menunggu'. Update progress dari halaman detail unit.",
      },
      {
        id: "UC-STK-05",
        title: "Lapor Unit Hilang/Rusak",
        actor: "Admin Cabang / Super Admin",
        prerequisite: "Unit berstatus 'available'.",
        description: "Pilih unit. Klik Report/Lapor. Pilih jenis laporan sesuai tipe unit. Isi keterangan. Konfirmasi.",
        result: "Status unit berubah sesuai laporan. Unit tidak lagi dihitung sebagai stok tersedia.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "CRUD semua unit di semua cabang" },
      { role: "admin_branch", access: "terbatas", detail: "Kelola unit di cabang sendiri" },
      { role: "employee", access: "terbatas", detail: "Lihat dan input stok di cabang sendiri" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "sangat_tinggi",
    subFeatures: [
      { name: "Tambah Unit Manual (Adaptif)", description: "Form input unit stok adaptif: IMEI, Serial Number, atau Qty tergantung kategori produk" },
      { name: "Import CSV + AI Mapping (Multi-tipe)", description: "Import massal dari CSV dengan selector tipe (IMEI/SN/Qty), template per tipe, dan AI column mapping" },
      { name: "Edit Unit Detail", description: "Ubah identifier (IMEI/SN), harga, kondisi, catatan, dan foto unit" },
      { name: "Riwayat Perubahan (Log)", description: "Audit trail setiap perubahan pada unit: field, nilai lama, nilai baru, waktu, aktor" },
      { name: "Overview Cards Dinamis", description: "Ringkasan jumlah unit per status dan tipe tracking (IMEI/SN/Qty)" },
      { name: "Pencarian & Filter Adaptif", description: "Cari unit berdasarkan IMEI, SN, atau nama produk. Filter kategori, status, kondisi, cabang" },
      { name: "Klaim Garansi (Adaptif)", description: "Proses klaim garansi adaptif: IMEI warranty, SN warranty, atau unit warranty" },
      { name: "Cycle Time Tracking", description: "Perhitungan otomatis durasi unit dari diterima hingga terjual" },
      { name: "Export CSV Adaptif", description: "Export tabel stok ke CSV dengan kolom sesuai tipe tracking yang aktif" },
    ],
    sourceFiles: [
      { path: "src/pages/admin/produk/StockProductsPage.tsx", type: "frontend", description: "Halaman utama manajemen stok produk (multi-tipe)" },
      { path: "src/pages/admin/produk/TambahStokPage.tsx", type: "frontend", description: "Halaman tambah stok adaptif (IMEI/SN/Qty)" },
      { path: "src/components/admin/produk/EditUnitModal.tsx", type: "frontend", description: "Modal edit unit dengan identifier adaptif" },
      { path: "src/components/admin/produk/UnitDetailDrawer.tsx", type: "frontend", description: "Drawer detail unit dengan tab adaptif per tipe" },
      { path: "src/components/admin/produk/ImportStockModal.tsx", type: "frontend", description: "Modal import CSV multi-tipe dengan template per tipe" },
      { path: "src/components/admin/produk/WarrantyClaimModal.tsx", type: "frontend", description: "Modal klaim garansi adaptif (IMEI/SN/Unit)" },
      { path: "src/components/admin/produk/ReportUnitModal.tsx", type: "frontend", description: "Modal lapor unit dengan tipe laporan adaptif" },
      { path: "src/components/admin/produk/StatusLabelManager.tsx", type: "frontend", description: "Kelola label status kustom" },
      { path: "src/lib/admin/produk/stock-units.ts", type: "frontend", description: "Helper & konstanta: getTrackingType, getUnitIdentifier, formatters" },
      { path: "src/lib/admin/produk/master-products.ts", type: "frontend", description: "Konstanta kategori produk dan helper tracking type" },
      { path: "supabase/functions/ai-import-stock/index.ts", type: "backend", description: "Edge function AI mapping kolom CSV dengan dukungan import_type" },
    ],
    introducedIn: "1.1.0",
    status: "stable",
    relatedFeatures: ["master-products", "pos", "stock-opname", "transactions", "catalog"],
    externalIntegrations: [
      {
        name: "OpenAI (via Edge Function)",
        type: "ai_service",
        description: "Digunakan oleh edge function ai-import-stock untuk memetakan kolom CSV secara cerdas ke field sistem.",
        docsUrl: "https://platform.openai.com/docs",
      },
    ],
    revisionHistory: [
      { version: "1.1.0", date: "2026-03-01", description: "Rilis awal: CRUD unit IMEI, status, kondisi, harga, foto unit." },
      { version: "1.2.0", date: "2026-05-15", description: "Ditambahkan import CSV dengan AI mapping otomatis dan deteksi IMEI duplikat." },
      { version: "1.3.0", date: "2026-08-20", description: "Fitur klaim garansi, lapor unit hilang, dan cycle time tracking." },
      { version: "1.5.0", date: "2026-12-01", description: "Riwayat perubahan per unit (audit trail lengkap dengan field lama & baru)." },
    ],
  },
  {
    id: "stock-opname",
    name: "Stok Opname",
    category: "Produk & Inventory",
    icon: "ClipboardList",
    description:
      "Sistem audit stok fisik berkala menggunakan pemindaian barcode/IMEI. Membandingkan stok tercatat di sistem dengan stok fisik untuk mendeteksi selisih. Mendukung penjadwalan otomatis dan notifikasi pengingat.",
    scope: [
      "Buat sesi opname (full/partial)",
      "Snapshot otomatis seluruh stok saat sesi dimulai",
      "Scan IMEI via kamera atau input manual",
      "Hasil scan: match, missing, unregistered",
      "Assign petugas opname ke sesi",
      "Lock & approve hasil opname",
      "Penjadwalan opname berkala",
      "Notifikasi pengingat opname",
      "Rekonsiliasi otomatis",
    ],
    useCases: [
      {
        id: "UC-OPN-01",
        title: "Buat Sesi Opname Baru",
        actor: "Super Admin / Admin Cabang",
        prerequisite: "Terdapat stok di cabang.",
        description: "Klik Buat Sesi. Pilih tipe (full scan seluruh stok / partial kategori tertentu). Pilih cabang (jika Super Admin). Sistem otomatis membuat snapshot seluruh stok saat ini.",
        result: "Sesi opname aktif. Snapshot stok tersimpan. Petugas bisa mulai scan.",
      },
      {
        id: "UC-OPN-02",
        title: "Scan IMEI Saat Opname",
        actor: "Employee / Admin Cabang (petugas opname)",
        prerequisite: "Sesi opname aktif; petugas sudah di-assign.",
        description: "Buka sesi aktif. Scan barcode IMEI via kamera atau input manual. Sistem mencocokkan dengan snapshot: match (cocok), missing (ada di sistem tapi tidak ditemukan), unregistered (ada fisik tapi tidak di sistem).",
        result: "Setiap scan tercatat. Counter match/missing/unregistered terupdate real-time.",
      },
      {
        id: "UC-OPN-03",
        title: "Lock & Approve Hasil Opname",
        actor: "Super Admin",
        prerequisite: "Sesi opname selesai (semua item sudah di-scan atau dinyatakan selesai).",
        description: "Klik Lock untuk mengunci hasil. Review ringkasan: total match, missing, unregistered. Klik Approve untuk mengesahkan hasil.",
        result: "Hasil opname terkunci dan tidak bisa diubah. Status sesi berubah ke 'approved'. Data rekonsiliasi tersimpan.",
      },
      {
        id: "UC-OPN-04",
        title: "Jadwalkan Opname Berkala",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Buka pengaturan jadwal opname. Set hari dan jam pelaksanaan (misal: setiap Senin pukul 09:00). Aktifkan jadwal.",
        result: "Notifikasi pengingat terkirim otomatis ke admin cabang sesuai jadwal yang ditentukan.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Kelola semua sesi opname, approve, jadwal" },
      { role: "admin_branch", access: "terbatas", detail: "Buat & kelola opname di cabang sendiri" },
      { role: "employee", access: "terbatas", detail: "Scan dan update hasil opname jika di-assign" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "sangat_tinggi",
    subFeatures: [
      { name: "Pembuatan Sesi Opname", description: "Buat sesi baru dengan snapshot stok otomatis" },
      { name: "Pemindaian Barcode/IMEI", description: "Scan via kamera atau input manual dengan pencocokan real-time" },
      { name: "Snapshot Stok Otomatis", description: "Duplikasi data stok saat sesi dimulai sebagai baseline pembanding" },
      { name: "Assignment Petugas", description: "Tugaskan admin/employee ke sesi opname tertentu" },
      { name: "Lock & Approval", description: "Kunci dan sahkan hasil opname oleh Super Admin" },
      { name: "Penjadwalan Berkala", description: "Jadwal otomatis dengan notifikasi pengingat" },
      { name: "Notifikasi Pengingat", description: "Notifikasi in-app untuk pengingat jadwal opname" },
    ],
    sourceFiles: [
      { path: "src/pages/admin/produk/StokOpnamePage.tsx", type: "frontend", description: "Halaman utama stok opname" },
      { path: "src/lib/admin/produk/opname.ts", type: "frontend", description: "Helper & logika stok opname" },
      { path: "src/hooks/admin/use-barcode-scanner.ts", type: "frontend", description: "Hook pemindaian barcode via kamera" },
      { path: "supabase/functions/opname-notify/index.ts", type: "backend", description: "Edge function notifikasi opname" },
      { path: "supabase/functions/opname-reminder/index.ts", type: "backend", description: "Edge function pengingat jadwal opname" },
    ],
    introducedIn: "1.2.0",
    status: "stable",
    relatedFeatures: ["stock-products", "notifications"],
  },

  // ═══ PENJUALAN & TRANSAKSI ═══
  {
    id: "pos",
    name: "Point of Sale (POS)",
    category: "Penjualan & Transaksi",
    icon: "Monitor",
    description:
      "Sistem kasir digital untuk mencatat penjualan langsung di toko. Mendukung pemindaian IMEI, pemilihan metode pembayaran, dan pencetakan faktur. Stok otomatis berubah status menjadi 'sold' setelah transaksi.",
    scope: [
      "Scan IMEI untuk menambahkan item ke keranjang",
      "Pencarian produk manual",
      "Pilih metode pembayaran (tunai, transfer, QRIS)",
      "Input data customer (opsional)",
      "Diskon per item atau total",
      "Kode diskon / voucher",
      "Generate faktur otomatis setelah transaksi",
      "Stok unit otomatis berubah ke 'sold'",
    ],
    useCases: [
      {
        id: "UC-POS-01",
        title: "Proses Transaksi POS",
        actor: "Admin Cabang / Employee",
        prerequisite: "Login; terdapat stok available di cabang.",
        description: "Buka halaman POS. Scan IMEI produk (atau cari manual). Item masuk keranjang dengan harga otomatis. Input data customer (opsional). Terapkan diskon jika ada. Pilih metode pembayaran. Proses transaksi.",
        result: "Transaksi tercatat. Stok unit berubah ke 'sold'. Faktur tergenerate otomatis. Data customer (jika diisi) tersimpan.",
      },
      {
        id: "UC-POS-02",
        title: "Terapkan Kode Diskon di POS",
        actor: "Admin Cabang / Employee",
        prerequisite: "Transaksi dalam proses; kode diskon valid tersedia.",
        description: "Setelah item masuk keranjang, input kode diskon. Sistem validasi (periode berlaku, batas penggunaan, minimum pembelian). Jika valid, diskon diterapkan pada total.",
        result: "Total transaksi berkurang sesuai nilai diskon. Kode diskon tercatat di transaksi.",
      },
      {
        id: "UC-POS-03",
        title: "Batalkan Item dari Keranjang",
        actor: "Admin Cabang / Employee",
        prerequisite: "Terdapat item di keranjang POS.",
        description: "Klik hapus pada item di keranjang. Item dihapus dari daftar belanja.",
        result: "Item keluar dari keranjang. Unit tetap berstatus 'available'.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Akses POS di semua cabang" },
      { role: "admin_branch", access: "terbatas", detail: "POS hanya di cabang sendiri" },
      { role: "employee", access: "terbatas", detail: "POS di cabang tempat bekerja" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "sangat_tinggi",
    subFeatures: [
      { name: "Scan IMEI", description: "Pemindaian barcode/IMEI untuk menambahkan produk ke keranjang" },
      { name: "Keranjang POS", description: "Daftar item belanja dengan harga dan diskon" },
      { name: "Metode Pembayaran", description: "Pilihan pembayaran: tunai, transfer, QRIS, e-wallet" },
      { name: "Data Customer", description: "Input informasi pelanggan opsional" },
      { name: "Generate Faktur", description: "Faktur otomatis setelah transaksi selesai" },
    ],
    sourceFiles: [
      { path: "src/pages/admin/transaksi/POSPage.tsx", type: "frontend", description: "Halaman POS utama" },
      { path: "src/hooks/admin/use-barcode-scanner.ts", type: "frontend", description: "Hook pemindaian barcode" },
    ],
    introducedIn: "1.1.0",
    status: "stable",
    relatedFeatures: ["stock-products", "invoices", "transactions", "discount-codes", "payment-methods"],
    revisionHistory: [
      { version: "1.1.0", date: "2026-03-01", description: "Rilis awal: kasir digital, scan IMEI, pilih pembayaran, generate faktur." },
      { version: "1.2.0", date: "2026-06-10", description: "Ditambahkan input kode voucher diskon saat checkout POS." },
      { version: "1.4.0", date: "2026-11-05", description: "Integrasi data customer opsional: nama, telepon langsung dari form POS." },
    ],
  },
  {
    id: "transactions",
    name: "Riwayat Transaksi",
    category: "Penjualan & Transaksi",
    icon: "Receipt",
    description:
      "Daftar lengkap seluruh transaksi dari POS maupun toko online. Setiap transaksi dapat dilihat detailnya termasuk item, pembayaran, dan status.",
    scope: [
      "Daftar transaksi dengan filter tanggal, status, kanal",
      "Detail transaksi: item, harga, diskon, total",
      "Status pembayaran: pending, paid, cancelled",
      "Kanal: POS, Website, Marketplace",
      "Link ke faktur terkait",
    ],
    useCases: [
      {
        id: "UC-TRX-01",
        title: "Lihat Riwayat Transaksi",
        actor: "Admin (semua role kecuali Web Admin)",
        prerequisite: "Terdapat data transaksi.",
        description: "Buka halaman Riwayat Transaksi. Filter berdasarkan tanggal, kanal penjualan, atau status pembayaran. Lihat daftar transaksi.",
        result: "Daftar transaksi ditampilkan sesuai filter. Informasi ringkasan (total, status) terlihat.",
      },
      {
        id: "UC-TRX-02",
        title: "Lihat Detail Transaksi",
        actor: "Admin (semua role kecuali Web Admin)",
        prerequisite: "Transaksi sudah ada.",
        description: "Klik transaksi dari daftar. Lihat detail lengkap: daftar item (IMEI, harga), diskon, metode pembayaran, total, dan data customer.",
        result: "Detail transaksi ditampilkan. Link ke faktur tersedia jika sudah digenerate.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Lihat semua transaksi semua cabang" },
      { role: "admin_branch", access: "terbatas", detail: "Transaksi cabang sendiri" },
      { role: "employee", access: "baca_saja", detail: "Lihat transaksi cabang sendiri" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/admin/transaksi/RiwayatTransaksiPage.tsx", type: "frontend", description: "Halaman riwayat transaksi" },
      { path: "src/pages/admin/transaksi/TransaksiDetailPage.tsx", type: "frontend", description: "Halaman detail transaksi" },
    ],
    introducedIn: "1.1.0",
    status: "stable",
    relatedFeatures: ["pos", "invoices", "online-shop"],
  },
  {
    id: "invoices",
    name: "Faktur (Invoice)",
    category: "Penjualan & Transaksi",
    icon: "FileText",
    description:
      "Sistem faktur profesional format A4 yang dapat dikustomisasi. Mendukung template dengan logo, stempel, tanda tangan, syarat & ketentuan, dan QR code. Faktur dapat diakses publik via link unik.",
    scope: [
      "Generate faktur otomatis dari transaksi",
      "Template A4 dengan logo, stempel, tanda tangan kustom",
      "Nomor faktur berurutan (reset harian/bulanan/tahunan)",
      "Syarat & ketentuan kustom",
      "QR code link ke faktur publik",
      "Link publik untuk customer (tanpa login)",
      "Download PDF",
      "Kirim via WhatsApp (template pesan kustom)",
      "Kirim via email",
      "Pengaturan font, ukuran, dan layout",
    ],
    useCases: [
      {
        id: "UC-INV-01",
        title: "Generate Faktur dari Transaksi",
        actor: "Sistem (otomatis) / Admin",
        prerequisite: "Transaksi selesai diproses.",
        description: "Setelah transaksi selesai di POS atau checkout, sistem otomatis men-generate nomor faktur berurutan dan menyimpan data faktur (item, harga, diskon, total).",
        result: "Faktur tersimpan dengan nomor unik. Dapat diakses dari halaman Daftar Faktur.",
      },
      {
        id: "UC-INV-02",
        title: "Download PDF Faktur",
        actor: "Admin (semua role)",
        prerequisite: "Faktur sudah digenerate.",
        description: "Buka detail faktur. Klik Download PDF. Sistem merender template A4 dan mengunduh file PDF.",
        result: "File PDF faktur terdownload sesuai template yang dikonfigurasi.",
      },
      {
        id: "UC-INV-03",
        title: "Kirim Faktur via WhatsApp",
        actor: "Admin Cabang / Employee",
        prerequisite: "Faktur sudah digenerate; data customer (telepon) tersedia.",
        description: "Buka detail faktur. Klik Kirim WhatsApp. Sistem membuat link WA dengan template pesan yang sudah dikonfigurasi. Browser membuka WhatsApp.",
        result: "Pesan WhatsApp dengan link faktur publik siap dikirim ke customer.",
      },
      {
        id: "UC-INV-04",
        title: "Kustomisasi Template Faktur",
        actor: "Super Admin / Admin Cabang",
        prerequisite: "Login; akses halaman Pengaturan Faktur.",
        description: "Buka Pengaturan Faktur. Upload logo dan stempel. Set tanda tangan. Tulis syarat & ketentuan. Atur format nomor faktur (prefix, reset period). Konfigurasi font dan ukuran. Simpan.",
        result: "Semua faktur baru menggunakan template yang diperbarui. Template lama tetap tersimpan di faktur yang sudah digenerate.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "CRUD faktur, kustomisasi template" },
      { role: "admin_branch", access: "terbatas", detail: "Generate & kirim faktur cabang sendiri" },
      { role: "employee", access: "terbatas", detail: "Lihat dan kirim faktur" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "sangat_tinggi",
    subFeatures: [
      { name: "Generate Faktur Otomatis", description: "Faktur ter-generate otomatis setelah transaksi selesai" },
      { name: "Template A4 Kustom", description: "Kustomisasi logo, stempel, tanda tangan, S&K" },
      { name: "Download PDF", description: "Render dan download faktur sebagai file PDF" },
      { name: "Kirim via WhatsApp", description: "Template pesan WA dengan link faktur publik" },
      { name: "Kirim via Email", description: "Kirim faktur langsung ke email customer" },
      { name: "Halaman Faktur Publik", description: "Faktur dapat diakses publik tanpa login via token unik" },
      { name: "Pengaturan Font & Layout", description: "Konfigurasi font family, ukuran, dan posisi elemen faktur" },
    ],
    sourceFiles: [
      { path: "src/pages/admin/penjualan/FakturListPage.tsx", type: "frontend", description: "Halaman daftar faktur" },
      { path: "src/pages/admin/penjualan/FakturDetailPage.tsx", type: "frontend", description: "Halaman detail faktur" },
      { path: "src/pages/admin/penjualan/FakturSettingsPage.tsx", type: "frontend", description: "Halaman pengaturan template faktur" },
      { path: "src/components/admin/penjualan/InvoiceDocumentA4.tsx", type: "frontend", description: "Komponen template faktur A4" },
      { path: "src/pages/public/PublicInvoicePage.tsx", type: "frontend", description: "Halaman faktur publik (tanpa login)" },
      { path: "src/lib/admin/penjualan/pdf-download.ts", type: "frontend", description: "Helper download PDF" },
      { path: "supabase/functions/send-invoice-email/index.ts", type: "backend", description: "Edge function kirim email faktur" },
    ],
    introducedIn: "1.2.0",
    status: "stable",
    relatedFeatures: ["pos", "transactions", "online-shop"],
    externalIntegrations: [
      {
        name: "Gmail SMTP (Nodemailer)",
        type: "email",
        description: "Digunakan oleh edge function send-invoice-email untuk mengirim faktur langsung ke email customer.",
        docsUrl: "https://nodemailer.com/",
      },
    ],
    revisionHistory: [
      { version: "1.2.0", date: "2026-05-01", description: "Rilis awal: generate faktur otomatis, template A4, download PDF, kirim WhatsApp." },
      { version: "1.3.0", date: "2026-07-15", description: "Ditambahkan kustomisasi font, ukuran, dan layout faktur per cabang." },
      { version: "1.4.0", date: "2026-10-20", description: "Kirim faktur via email menggunakan Gmail SMTP. QR code link publik di faktur." },
    ],
  },
  {
    id: "payment-methods",
    name: "Kanal Pembayaran",
    category: "Penjualan & Transaksi",
    icon: "CreditCard",
    description:
      "Mengelola metode pembayaran yang tersedia untuk transaksi POS dan checkout website. Setiap cabang bisa memiliki konfigurasi metode pembayaran sendiri.",
    scope: [
      "Tambah metode pembayaran: tunai, transfer bank, QRIS, e-wallet",
      "Konfigurasi per cabang",
      "Upload gambar QRIS",
      "Urutan prioritas metode",
      "Aktifkan/nonaktifkan metode",
    ],
    useCases: [
      {
        id: "UC-PAY-01",
        title: "Tambah Metode Pembayaran Baru",
        actor: "Super Admin / Admin Cabang",
        prerequisite: "Login; akses halaman Kanal Pembayaran.",
        description: "Klik Tambah. Pilih tipe (tunai/transfer/QRIS/e-wallet). Isi nama, nomor rekening (jika transfer). Upload gambar QRIS (jika QRIS). Set urutan prioritas. Simpan.",
        result: "Metode pembayaran baru tersedia di POS dan checkout cabang terkait.",
      },
      {
        id: "UC-PAY-02",
        title: "Nonaktifkan Metode Pembayaran",
        actor: "Super Admin / Admin Cabang",
        prerequisite: "Metode pembayaran aktif.",
        description: "Pilih metode. Toggle status ke nonaktif.",
        result: "Metode tidak muncul di POS dan checkout. Riwayat transaksi sebelumnya tetap ada.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Kelola metode pembayaran semua cabang" },
      { role: "admin_branch", access: "terbatas", detail: "Kelola metode pembayaran cabang sendiri" },
      { role: "employee", access: "tidak_ada" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/admin/transaksi/KanalPembayaranPage.tsx", type: "frontend", description: "Halaman kelola kanal pembayaran" },
    ],
    introducedIn: "1.1.0",
    status: "stable",
    relatedFeatures: ["pos", "online-shop"],
  },
  {
    id: "reviews",
    name: "Manajemen Ulasan",
    category: "Penjualan & Transaksi",
    icon: "MessageSquareText",
    description:
      "Mengelola ulasan/review dari pelanggan. Ulasan yang di-approve tampil di landing page dan halaman produk.",
    scope: [
      "Daftar ulasan dengan filter rating dan status",
      "Approve/reject ulasan",
      "Tandai ulasan sebagai featured",
      "Kategori ulasan",
      "Foto lampiran dari customer",
      "Sumber: website, manual, marketplace",
    ],
    useCases: [
      {
        id: "UC-REV-01",
        title: "Approve Ulasan Customer",
        actor: "Super Admin / Web Admin",
        prerequisite: "Terdapat ulasan berstatus pending.",
        description: "Buka halaman Manajemen Ulasan. Filter ulasan pending. Review konten dan rating. Klik Approve untuk mempublikasikan.",
        result: "Ulasan tampil di halaman produk dan/atau landing page website.",
      },
      {
        id: "UC-REV-02",
        title: "Tandai Ulasan Featured",
        actor: "Super Admin / Web Admin",
        prerequisite: "Ulasan sudah di-approve.",
        description: "Pilih ulasan. Toggle status Featured.",
        result: "Ulasan ditampilkan di bagian testimonial di landing page.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Kelola semua ulasan" },
      { role: "web_admin", access: "penuh", detail: "Kelola ulasan untuk website" },
      { role: "admin_branch", access: "tidak_ada" },
      { role: "employee", access: "tidak_ada" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/admin/marketing/UlasanPage.tsx", type: "frontend", description: "Halaman kelola ulasan" },
    ],
    introducedIn: "1.2.0",
    status: "stable",
    relatedFeatures: ["manage-customer", "online-shop", "landing-page", "catalog"],
  },

  // ═══ MARKETING & PROMOSI ═══
  {
    id: "flash-sale",
    name: "Flash Sale",
    category: "Marketing & Promosi",
    icon: "Zap",
    description:
      "Event penjualan kilat dengan durasi terbatas. Saat aktif, produk di katalog website otomatis menampilkan harga diskon flash sale.",
    scope: [
      "Aktifkan/nonaktifkan flash sale",
      "Set waktu mulai dan durasi (jam)",
      "Nama event kustom",
      "Warna gradient banner kustom",
      "Diskon default (persentase atau nominal)",
      "Subsidi ongkir selama flash sale",
      "Override diskon per produk katalog",
    ],
    useCases: [
      {
        id: "UC-FLS-01",
        title: "Buat Event Flash Sale",
        actor: "Super Admin / Web Admin",
        prerequisite: "Tidak ada flash sale aktif.",
        description: "Buka halaman Flash Sale. Isi nama event, waktu mulai, durasi (jam). Pilih warna gradient banner. Set diskon default (tipe & nilai). Atur subsidi ongkir jika ada. Aktifkan.",
        result: "Flash sale aktif. Banner countdown tampil di website. Harga produk katalog otomatis menerapkan diskon flash sale.",
      },
      {
        id: "UC-FLS-02",
        title: "Override Diskon Per Produk",
        actor: "Super Admin / Web Admin",
        prerequisite: "Flash sale aktif.",
        description: "Buka produk katalog tertentu. Set diskon flash sale khusus yang berbeda dari default. Simpan.",
        result: "Produk menampilkan harga diskon khusus, bukan diskon default flash sale.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Kelola flash sale" },
      { role: "web_admin", access: "penuh", detail: "Kelola flash sale untuk website" },
      { role: "admin_branch", access: "tidak_ada" },
      { role: "employee", access: "tidak_ada" },
    ],
    complexity: "tinggi",
    sourceFiles: [
      { path: "src/pages/admin/marketing/FlashSalePage.tsx", type: "frontend", description: "Halaman kelola flash sale" },
    ],
    introducedIn: "1.3.0",
    status: "stable",
    relatedFeatures: ["catalog", "online-shop", "discount-sale"],
  },
  {
    id: "discount-sale",
    name: "Diskon Sale (Kampanye)",
    category: "Marketing & Promosi",
    icon: "Percent",
    description:
      "Kampanye diskon berbasis periode yang bisa ditargetkan ke series, storage, dan tipe garansi tertentu. Berbeda dengan flash sale, kampanye ini lebih panjang dan bisa memiliki banner/popup kustom.",
    scope: [
      "Buat kampanye diskon dengan periode mulai-selesai",
      "Target per kombinasi series + storage + garansi",
      "Tipe diskon: nominal tetap atau persentase",
      "Banner kampanye (upload gambar)",
      "Popup kampanye di website",
      "Gradient warna kustom",
      "Deskripsi dan subtitle kampanye",
    ],
    useCases: [
      {
        id: "UC-DSL-01",
        title: "Buat Kampanye Diskon",
        actor: "Super Admin / Web Admin",
        prerequisite: "Login dengan akses marketing.",
        description: "Klik Tambah Kampanye. Isi nama, deskripsi, subtitle. Set periode mulai dan selesai. Upload banner. Tambah item target: pilih series, storage, tipe garansi, dan nilai diskon. Aktifkan.",
        result: "Kampanye aktif. Produk yang sesuai target otomatis menampilkan harga diskon di website.",
      },
      {
        id: "UC-DSL-02",
        title: "Aktifkan Popup Kampanye",
        actor: "Super Admin / Web Admin",
        prerequisite: "Kampanye sudah dibuat dan aktif.",
        description: "Buka detail kampanye. Toggle 'Show Popup' ke aktif.",
        result: "Customer melihat popup promo saat pertama kali mengunjungi website selama periode kampanye.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Kelola semua kampanye" },
      { role: "web_admin", access: "penuh", detail: "Kelola kampanye website" },
      { role: "admin_branch", access: "tidak_ada" },
      { role: "employee", access: "tidak_ada" },
    ],
    complexity: "tinggi",
    sourceFiles: [
      { path: "src/pages/admin/marketing/DiskonSalePage.tsx", type: "frontend", description: "Halaman kelola kampanye diskon" },
    ],
    introducedIn: "1.3.0",
    status: "stable",
    relatedFeatures: ["catalog", "discount-codes", "online-shop", "flash-sale"],
  },
  {
    id: "discount-codes",
    name: "Kode Diskon (Voucher)",
    category: "Marketing & Promosi",
    icon: "Tag",
    description:
      "Sistem kode voucher diskon yang bisa digunakan customer saat checkout. Mendukung berbagai tipe diskon termasuk persentase, nominal, subsidi ongkir, dan buy X get Y.",
    scope: [
      "Buat kode diskon unik",
      "Tipe: persentase, nominal, ongkir, buy X get Y",
      "Periode berlaku (dari-sampai)",
      "Batas penggunaan total dan per user",
      "Minimum pembelian",
      "Batas maksimum diskon (cap)",
      "Terapkan ke semua produk atau produk tertentu",
      "Stackable dengan diskon lain (opsional)",
      "Cover packing kayu (opsional)",
    ],
    useCases: [
      {
        id: "UC-VCR-01",
        title: "Buat Kode Voucher Baru",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Klik Tambah. Isi kode unik. Pilih tipe diskon (persentase/nominal/ongkir/buy X get Y). Set nilai diskon. Tentukan batas penggunaan (total & per user). Set minimum pembelian dan cap diskon. Tentukan periode berlaku. Pilih produk yang berlaku (semua atau spesifik). Simpan.",
        result: "Kode voucher aktif. Customer bisa menggunakan kode saat checkout.",
      },
      {
        id: "UC-VCR-02",
        title: "Nonaktifkan Voucher",
        actor: "Super Admin",
        prerequisite: "Voucher aktif.",
        description: "Pilih voucher. Toggle status ke nonaktif.",
        result: "Kode tidak bisa digunakan customer. Riwayat penggunaan sebelumnya tetap tersimpan.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "CRUD kode diskon" },
      { role: "web_admin", access: "tidak_ada" },
      { role: "admin_branch", access: "tidak_ada" },
      { role: "employee", access: "tidak_ada" },
    ],
    complexity: "tinggi",
    sourceFiles: [
      { path: "src/pages/admin/katalog/DiscountCodesPage.tsx", type: "frontend", description: "Halaman kelola kode diskon" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["online-shop", "pos", "discount-sale"],
  },

  // ═══ KATALOG & WEBSITE ═══
  {
    id: "catalog",
    name: "Katalog Produk (Website)",
    category: "Katalog & Website",
    icon: "BookOpen",
    description:
      "Mengelola produk yang ditampilkan di toko online. Setiap produk katalog terhubung ke master produk dan menampilkan harga berdasarkan stok unit yang tersedia.",
    scope: [
      "Publikasi produk ke website, POS, dan marketplace",
      "Strategi harga: terendah, tertinggi, atau manual override",
      "Galeri foto produk (thumbnail + gallery)",
      "Deskripsi pendek dan panjang",
      "Spesifikasi detail",
      "Promo badge dan label",
      "Link ke Tokopedia dan Shopee",
      "Slug URL otomatis",
      "Status: draft, published, archived",
      "Highlight produk",
      "Breakdown kondisi stok",
      "Bonus items per produk",
      "Diskon per produk dengan periode",
      "Subsidi ongkir per produk",
    ],
    useCases: [
      {
        id: "UC-KAT-01",
        title: "Tambah Produk Katalog",
        actor: "Super Admin / Web Admin",
        prerequisite: "Produk sudah ada di Master Produk.",
        description: "Klik Tambah. Pilih master produk. Isi display name dan slug. Upload thumbnail & galeri. Tulis deskripsi pendek dan panjang. Isi spesifikasi. Pilih strategi harga. Tentukan channel publikasi (website/POS/marketplace). Simpan sebagai draft.",
        result: "Produk katalog tersimpan sebagai draft. Belum tampil di website hingga di-publish.",
      },
      {
        id: "UC-KAT-02",
        title: "Publish Produk ke Website",
        actor: "Super Admin / Web Admin",
        prerequisite: "Produk katalog berstatus draft.",
        description: "Buka produk katalog. Review kelengkapan data. Ubah status ke 'Published'.",
        result: "Produk tampil di halaman katalog website dan dapat dilihat pengunjung.",
      },
      {
        id: "UC-KAT-03",
        title: "Atur Bonus Item Produk",
        actor: "Super Admin / Web Admin",
        prerequisite: "Produk katalog sudah ada.",
        description: "Buka form edit katalog. Navigasi ke bagian Bonus. Tambah bonus item dari daftar bonus produk. Simpan.",
        result: "Produk menampilkan daftar bonus di halaman detail website.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "CRUD katalog, pengaturan lengkap" },
      { role: "web_admin", access: "terbatas", detail: "Edit katalog, tidak bisa hapus" },
      { role: "admin_branch", access: "baca_saja", detail: "Lihat katalog cabang sendiri" },
      { role: "employee", access: "tidak_ada" },
    ],
    complexity: "sangat_tinggi",
    subFeatures: [
      { name: "Daftar Produk Katalog", description: "Tabel seluruh produk katalog dengan filter dan status" },
      { name: "Form Tambah/Edit Katalog", description: "Formulir lengkap untuk mengelola data produk katalog" },
      { name: "Manajemen Bonus Items", description: "Kelola bonus tambahan per produk (case, charger, dll)" },
      { name: "Pengaturan Ekspedisi", description: "Konfigurasi ongkir dan layanan pengiriman" },
      { name: "Preview di Website", description: "Lihat tampilan produk di website sebelum publish" },
    ],
    sourceFiles: [
      { path: "src/pages/admin/katalog/KatalogPage.tsx", type: "frontend", description: "Halaman daftar katalog" },
      { path: "src/pages/admin/katalog/KatalogFormPage.tsx", type: "frontend", description: "Halaman form tambah/edit katalog" },
      { path: "src/pages/admin/katalog/BonusProductsPage.tsx", type: "frontend", description: "Halaman kelola bonus produk" },
      { path: "src/pages/admin/katalog/EkspedisiPage.tsx", type: "frontend", description: "Halaman pengaturan ekspedisi" },
      { path: "supabase/functions/rajaongkir-proxy/index.ts", type: "backend", description: "Proxy API RajaOngkir untuk cek ongkir" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["master-products", "online-shop", "flash-sale", "discount-sale"],
    externalIntegrations: [
      {
        name: "RajaOngkir",
        type: "shipping_api",
        description: "API layanan cek ongkos kirim yang didukung oleh Supabase Edge Function. Digunakan saat customer checkout online untuk kalkulasi biaya ekspedisi.",
        docsUrl: "https://rajaongkir.com/dokumentasi",
      },
    ],
    revisionHistory: [
      { version: "1.0.0", date: "2026-01-15", description: "Rilis awal: CRUD katalog, upload foto, strategi harga, status draft/published." },
      { version: "1.2.0", date: "2026-05-10", description: "Ditambahkan manajemen bonus item per produk dan breakdown kondisi stok." },
      { version: "1.3.0", date: "2026-08-01", description: "Integrasi subsidi ongkir per produk dan link Tokopedia/Shopee." },
      { version: "1.5.0", date: "2026-12-15", description: "Highlight produk, pengaturan ekspedisi per katalog, dan pengaturan font." },
    ],
  },

  // ═══ LAPORAN & ANALITIKA ═══
  {
    id: "reports",
    name: "Laporan & Analitika",
    category: "Laporan & Analitika",
    icon: "BarChart3",
    description:
      "Laporan statistik penjualan, stok, dan performa bisnis. Menampilkan data dalam bentuk tabel dan grafik.",
    scope: [
      "Laporan penjualan per periode",
      "Laporan stok per kategori dan status",
      "Grafik tren penjualan",
      "Export data ke CSV",
      "Filter per cabang dan periode",
    ],
    useCases: [
      {
        id: "UC-RPT-01",
        title: "Lihat Laporan Penjualan",
        actor: "Super Admin / Admin Cabang",
        prerequisite: "Terdapat data transaksi.",
        description: "Buka halaman Laporan. Pilih periode (harian/mingguan/bulanan). Lihat grafik tren dan tabel ringkasan.",
        result: "Laporan penjualan ditampilkan dengan visualisasi grafik dan tabel data.",
      },
      {
        id: "UC-RPT-02",
        title: "Export Data ke CSV",
        actor: "Super Admin / Admin Cabang",
        prerequisite: "Data laporan tersedia.",
        description: "Pilih jenis laporan. Klik Export CSV. Pilih periode dan filter. File CSV terdownload.",
        result: "File CSV terdownload berisi data laporan sesuai filter yang dipilih.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Akses semua laporan semua cabang" },
      { role: "admin_branch", access: "terbatas", detail: "Laporan cabang sendiri" },
      { role: "employee", access: "baca_saja", detail: "Lihat laporan cabang sendiri" },
      { role: "web_admin", access: "baca_saja", detail: "Lihat statistik katalog" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/admin/laporan/LaporanPage.tsx", type: "frontend", description: "Halaman utama laporan" },
      { path: "supabase/functions/export-database/index.ts", type: "backend", description: "Edge function export database" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["dashboard", "transactions", "stock-products", "activity-log"],
  },
  {
    id: "activity-log",
    name: "Log Aktivitas",
    category: "Laporan & Analitika",
    icon: "Activity",
    description:
      "Catatan audit trail seluruh aktivitas penting dalam sistem. Merekam siapa melakukan apa, kapan, dan di cabang mana.",
    scope: [
      "Log otomatis untuk perubahan data penting",
      "Informasi: aktor, aksi, target, waktu, cabang",
      "Filter berdasarkan aksi, aktor, tanggal",
      "Metadata tambahan per log entry",
    ],
    useCases: [
      {
        id: "UC-LOG-01",
        title: "Audit Keamanan",
        actor: "Super Admin",
        prerequisite: "Terdapat log aktivitas.",
        description: "Buka halaman Log Aktivitas. Filter berdasarkan aksi (delete, update). Review siapa yang melakukan perubahan, kapan, dan apa yang diubah.",
        result: "Log aktivitas ditampilkan dengan detail aktor, aksi, target, dan metadata.",
      },
      {
        id: "UC-LOG-02",
        title: "Tracking Perubahan Data",
        actor: "Super Admin",
        prerequisite: "Terdapat log aktivitas.",
        description: "Filter berdasarkan target (misalnya: stok unit tertentu). Lihat kronologis semua perubahan pada data tersebut.",
        result: "Riwayat perubahan data ditampilkan secara kronologis.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Lihat semua log aktivitas" },
      { role: "admin_branch", access: "tidak_ada" },
      { role: "employee", access: "tidak_ada" },
      { role: "web_admin", access: "tidak_ada" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/admin/laporan/ActivityLogPage.tsx", type: "frontend", description: "Halaman log aktivitas" },
      { path: "src/lib/admin/laporan/activity-log.ts", type: "frontend", description: "Helper pencatatan log aktivitas" },
    ],
    notes: "Hanya Super Admin yang dapat mengakses log aktivitas untuk menjaga keamanan data audit.",
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["reports", "manage-admin", "stock-products"],
  },

  // ═══ PENGATURAN SISTEM ═══
  {
    id: "profile-settings",
    name: "Profil & Pengaturan",
    category: "Pengaturan Sistem",
    icon: "Settings",
    description:
      "Pengaturan akun personal dan preferensi sistem. Setiap pengguna bisa mengubah nama, foto profil, dan password.",
    scope: [
      "Edit nama lengkap",
      "Upload/ganti foto profil (avatar)",
      "Ubah password",
      "Lihat role dan cabang yang ditugaskan",
    ],
    useCases: [
      {
        id: "UC-PRF-01",
        title: "Edit Profil Pengguna",
        actor: "Semua admin",
        prerequisite: "Sudah login.",
        description: "Buka halaman Profil. Ubah nama. Upload atau ganti foto profil. Simpan.",
        result: "Data profil diperbarui. Avatar baru muncul di navbar dan sidebar.",
      },
      {
        id: "UC-PRF-02",
        title: "Ganti Password",
        actor: "Semua admin",
        prerequisite: "Sudah login.",
        description: "Buka Pengaturan. Input password lama. Input password baru (dengan konfirmasi). Simpan.",
        result: "Password berhasil diubah. Session tetap aktif.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Edit profil + pengaturan sistem" },
      { role: "admin_branch", access: "terbatas", detail: "Edit profil sendiri" },
      { role: "employee", access: "terbatas", detail: "Edit profil sendiri" },
      { role: "web_admin", access: "terbatas", detail: "Edit profil sendiri" },
    ],
    complexity: "rendah",
    sourceFiles: [
      { path: "src/pages/admin/ProfilPage.tsx", type: "frontend", description: "Halaman profil pengguna" },
      { path: "src/pages/admin/PengaturanPage.tsx", type: "frontend", description: "Halaman pengaturan sistem" },
      { path: "src/hooks/admin/use-avatar.ts", type: "frontend", description: "Hook upload & ambil avatar" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["auth-multi-role", "notifications"],
  },
  {
    id: "notifications",
    name: "Notifikasi In-App",
    category: "Pengaturan Sistem",
    icon: "Bell",
    description:
      "Sistem notifikasi real-time dalam aplikasi untuk event penting seperti pengingat opname, transaksi baru, dan persetujuan akun.",
    scope: [
      "Notifikasi bell icon di navbar",
      "Badge jumlah notifikasi belum dibaca",
      "Tandai sudah dibaca",
      "Link langsung ke halaman terkait",
      "Tipe: opname reminder, approval, transaksi",
    ],
    useCases: [
      {
        id: "UC-NTF-01",
        title: "Terima & Baca Notifikasi",
        actor: "Semua admin",
        prerequisite: "Terdapat notifikasi baru.",
        description: "Bell icon di navbar menampilkan badge jumlah notifikasi baru. Klik bell icon. Lihat daftar notifikasi. Klik notifikasi untuk membuka halaman terkait.",
        result: "Notifikasi ditandai sudah dibaca. Badge berkurang. Halaman terkait terbuka.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Menerima semua notifikasi sistem" },
      { role: "admin_branch", access: "terbatas", detail: "Notifikasi terkait cabang sendiri" },
      { role: "employee", access: "terbatas", detail: "Notifikasi terkait tugas yang di-assign" },
      { role: "web_admin", access: "terbatas", detail: "Notifikasi terkait katalog" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/components/layout/NotificationBell.tsx", type: "frontend", description: "Komponen bell notifikasi di navbar" },
      { path: "src/hooks/admin/use-notifications.ts", type: "frontend", description: "Hook data notifikasi real-time" },
    ],
    introducedIn: "1.2.0",
    status: "stable",
    relatedFeatures: ["profile-settings", "stock-opname", "manage-admin"],
  },
  {
    id: "release-notes",
    name: "Release Notes / Changelog",
    category: "Pengaturan Sistem",
    icon: "ScrollText",
    description:
      "Halaman dokumentasi riwayat perubahan sistem dan panduan fitur lengkap. Mendukung generate changelog otomatis dengan AI.",
    scope: [
      "Riwayat versi dengan timeline visual",
      "Kategori perubahan: ditambahkan, diubah, diperbaiki, dihapus, ditingkatkan, keamanan",
      "Detail before/after per perubahan",
      "Generate changelog dengan AI (otomatis)",
      "Dokumentasi fitur lengkap dengan use cases terstruktur",
    ],
    useCases: [
      {
        id: "UC-RLS-01",
        title: "Lihat Release Notes",
        actor: "Semua admin",
        prerequisite: "Sudah login.",
        description: "Buka halaman Release Notes. Lihat timeline rilis. Expand versi untuk melihat detail perubahan.",
        result: "Detail perubahan per versi ditampilkan dengan kategori dan before/after.",
      },
      {
        id: "UC-RLS-02",
        title: "Generate Changelog dengan AI",
        actor: "Super Admin",
        prerequisite: "Login sebagai Super Admin.",
        description: "Klik tombol Generate AI. Sistem otomatis menganalisis perubahan yang belum didokumentasikan dan menentukan versi yang tepat. AI generate entry changelog dalam format terstruktur. Salin hasil ke kode.",
        result: "Entry changelog baru tersedia untuk ditambahkan ke sistem. Versi increment ditentukan otomatis.",
      },
    ],
    roleAccess: [
      { role: "super_admin", access: "penuh", detail: "Akses & generate changelog" },
      { role: "admin_branch", access: "baca_saja", detail: "Lihat release notes" },
      { role: "employee", access: "baca_saja", detail: "Lihat release notes" },
      { role: "web_admin", access: "baca_saja", detail: "Lihat release notes" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/admin/ChangelogPage.tsx", type: "frontend", description: "Halaman Release Notes & Dokumentasi Fitur" },
      { path: "src/data/changelog.ts", type: "data", description: "Data riwayat versi (RELEASES array)" },
      { path: "src/data/feature-docs.ts", type: "data", description: "Data dokumentasi fitur lengkap" },
      { path: "supabase/functions/generate-changelog/index.ts", type: "backend", description: "Edge function generate changelog dengan AI" },
    ],
    introducedIn: "1.3.0",
    status: "stable",
    relatedFeatures: ["profile-settings", "notifications"],
    externalIntegrations: [
      {
        name: "OpenAI (Generate Changelog)",
        type: "ai_service",
        description: "Digunakan oleh edge function generate-changelog untuk menganalisis perubahan dan menyusun entry changelog secara otomatis.",
        docsUrl: "https://platform.openai.com/docs",
      },
    ],
    revisionHistory: [
      { version: "1.3.0", date: "2026-08-10", description: "Rilis awal: tab Release Notes dengan timeline visual dan AI generate changelog." },
      { version: "1.4.0", date: "2026-10-30", description: "Ditambahkan tab Dokumentasi Fitur dengan sidebar navigasi, use cases, dan RBAC table." },
      { version: "1.5.0", date: "2025-01-20", description: "Peningkatan dokumentasi: scroll-spy TOC, complexity filter, metadata bar, riwayat revisi, fitur terkait." },
    ],
  },

  // ═══ CUSTOMER-FACING ═══
  {
    id: "landing-page",
    name: "Landing Page",
    category: "Customer-Facing",
    icon: "Globe",
    description:
      "Halaman utama website toko online yang menampilkan produk unggulan, promo aktif, ulasan pelanggan, dan informasi toko.",
    scope: [
      "Hero banner dengan promo aktif",
      "Produk highlight / unggulan",
      "Flash sale countdown (jika aktif)",
      "Ulasan pelanggan featured",
      "Link ke marketplace (Tokopedia, Shopee)",
      "Unique Value Proposition (UVP) section",
      "Informasi toko dan kontak",
    ],
    useCases: [
      {
        id: "UC-LND-01",
        title: "Kunjungi Landing Page",
        actor: "Pengunjung (publik)",
        prerequisite: "Tidak perlu login.",
        description: "Pengunjung membuka URL website. Melihat hero banner, produk unggulan, countdown flash sale (jika aktif), ulasan, dan informasi toko. Klik produk untuk ke detail.",
        result: "Pengunjung dapat melihat seluruh informasi toko dan produk. Navigasi ke katalog atau detail produk.",
      },
    ],
    roleAccess: [
      { role: "publik", access: "baca_saja", detail: "Semua pengunjung bisa melihat" },
      { role: "customer", access: "baca_saja", detail: "Lihat + interaksi (keranjang, dll)" },
    ],
    complexity: "sedang",
    sourceFiles: [
      { path: "src/pages/customer/LandingPage.tsx", type: "frontend", description: "Halaman utama landing page" },
      { path: "src/components/layout/PublicNavbar.tsx", type: "frontend", description: "Navbar publik untuk website customer" },
      { path: "src/components/layout/PromoAnnouncementBar.tsx", type: "frontend", description: "Bar pengumuman promo di atas navbar" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["catalog", "online-shop", "flash-sale", "reviews"],
  },
  {
    id: "online-shop",
    name: "Toko Online (Shop)",
    category: "Customer-Facing",
    icon: "ShoppingBag",
    description:
      "Halaman katalog produk untuk customer: browsing, keranjang, dan checkout. Menampilkan harga real-time berdasarkan stok tersedia.",
    scope: [
      "Browse produk dengan filter dan pencarian",
      "Halaman detail produk dengan galeri dan spesifikasi",
      "Keranjang belanja (cart)",
      "Checkout dengan alamat, ekspedisi, dan pembayaran",
      "Kode diskon saat checkout",
      "Riwayat pesanan customer",
      "Halaman profil dan alamat customer",
      "Ulasan pembelian",
    ],
    useCases: [
      {
        id: "UC-SHP-01",
        title: "Browse & Tambah ke Keranjang",
        actor: "Customer (login) / Pengunjung (publik, hanya browse)",
        prerequisite: "Terdapat produk published di katalog.",
        description: "Buka halaman Katalog. Filter kategori atau cari produk. Klik produk untuk detail. Lihat galeri, spesifikasi, dan harga. Klik Tambah Keranjang.",
        result: "Item masuk ke keranjang belanja. Badge keranjang terupdate.",
      },
      {
        id: "UC-SHP-02",
        title: "Checkout Pesanan",
        actor: "Customer (login)",
        prerequisite: "Terdapat item di keranjang; sudah login.",
        description: "Buka keranjang. Review item. Pilih alamat pengiriman (atau tambah baru). Pilih layanan ekspedisi. Input kode diskon (opsional). Pilih metode pembayaran. Konfirmasi pesanan.",
        result: "Pesanan tercatat di sistem. Status: pending payment. Customer diarahkan ke halaman pembayaran atau konfirmasi.",
      },
      {
        id: "UC-SHP-03",
        title: "Tulis Ulasan Pembelian",
        actor: "Customer (login)",
        prerequisite: "Pesanan berstatus selesai/delivered.",
        description: "Buka riwayat pesanan. Pilih pesanan selesai. Klik Tulis Ulasan. Pilih rating (1-5 bintang). Tulis komentar. Upload foto (opsional). Kirim.",
        result: "Ulasan tersimpan sebagai pending review. Ditampilkan setelah admin approve.",
      },
      {
        id: "UC-SHP-04",
        title: "Kelola Alamat Pengiriman",
        actor: "Customer (login)",
        prerequisite: "Sudah login sebagai customer.",
        description: "Buka halaman Alamat. Klik Tambah Alamat. Isi nama penerima, telepon, alamat lengkap. Pilih wilayah (provinsi → kota → kecamatan → kelurahan). Set sebagai default jika diinginkan. Simpan.",
        result: "Alamat baru tersimpan. Tersedia saat checkout.",
      },
    ],
    roleAccess: [
      { role: "publik", access: "baca_saja", detail: "Browse produk tanpa login" },
      { role: "customer", access: "penuh", detail: "Keranjang, checkout, riwayat, ulasan" },
    ],
    complexity: "sangat_tinggi",
    subFeatures: [
      { name: "Katalog Produk", description: "Halaman browse produk dengan filter dan pencarian" },
      { name: "Detail Produk", description: "Halaman detail dengan galeri, spesifikasi, dan harga" },
      { name: "Keranjang Belanja", description: "Daftar item belanja sebelum checkout" },
      { name: "Checkout & Pembayaran", description: "Proses pemesanan dengan alamat, ekspedisi, dan pembayaran" },
      { name: "Riwayat Pesanan", description: "Daftar pesanan customer dengan status tracking" },
      { name: "Profil & Alamat", description: "Kelola informasi personal dan alamat pengiriman" },
      { name: "Ulasan Pembelian", description: "Tulis review dan rating setelah pembelian selesai" },
    ],
    sourceFiles: [
      { path: "src/pages/customer/shop/ShopPage.tsx", type: "frontend", description: "Halaman browse katalog customer" },
      { path: "src/pages/customer/shop/ProductDetailPage.tsx", type: "frontend", description: "Halaman detail produk" },
      { path: "src/pages/customer/shop/CartPage.tsx", type: "frontend", description: "Halaman keranjang belanja" },
      { path: "src/pages/customer/shop/CheckoutPage.tsx", type: "frontend", description: "Halaman checkout" },
      { path: "src/pages/customer/transaksi/CustomerTransaksiPage.tsx", type: "frontend", description: "Halaman riwayat pesanan customer" },
      { path: "src/pages/customer/transaksi/CustomerTransaksiDetailPage.tsx", type: "frontend", description: "Halaman detail pesanan customer" },
      { path: "src/pages/customer/account/CustomerProfilePage.tsx", type: "frontend", description: "Halaman profil customer" },
      { path: "src/pages/customer/account/CustomerAddressPage.tsx", type: "frontend", description: "Halaman kelola alamat customer" },
      { path: "src/pages/customer/ulasan/UlasanPage.tsx", type: "frontend", description: "Halaman ulasan pembelian customer" },
      { path: "supabase/functions/verify-checkout/index.ts", type: "backend", description: "Edge function verifikasi checkout" },
      { path: "supabase/functions/xendit-create-invoice/index.ts", type: "backend", description: "Edge function buat invoice Xendit" },
      { path: "supabase/functions/xendit-callback/index.ts", type: "backend", description: "Edge function callback pembayaran Xendit" },
      { path: "supabase/functions/send-payment-notification/index.ts", type: "backend", description: "Edge function notifikasi pembayaran" },
    ],
    introducedIn: "1.0.0",
    status: "stable",
    relatedFeatures: ["catalog", "invoices", "discount-codes", "payment-methods", "manage-customer", "reviews"],
    externalIntegrations: [
      {
        name: "Xendit (Payment Gateway)",
        type: "payment_gateway",
        description: "Gateway pembayaran untuk pemrosesan transaksi online. Mendukung transfer bank, QRIS, e-wallet (OVO, Dana, Gopay, dll).",
        docsUrl: "https://developers.xendit.co/",
      },
      {
        name: "RajaOngkir",
        type: "shipping_api",
        description: "API cek ongkos kirim yang digunakan saat customer memilih layanan ekspedisi di halaman checkout.",
        docsUrl: "https://rajaongkir.com/dokumentasi",
      },
    ],
    revisionHistory: [
      { version: "1.0.0", date: "2026-01-15", description: "Rilis awal: browse produk, detail produk, keranjang, checkout, riwayat pesanan." },
      { version: "1.1.0", date: "2026-03-20", description: "Integrasi Xendit sebagai payment gateway. Pemrosesan pembayaran online end-to-end." },
      { version: "1.2.0", date: "2026-06-01", description: "Fitur ulasan pembelian: rating, komentar, foto lampiran dari customer." },
      { version: "1.4.0", date: "2026-11-10", description: "Halaman profil & alamat customer. Kode diskon saat checkout. Cek ongkir via RajaOngkir." },
    ],
  },
  {
    id: "public-invoice",
    name: "Faktur Publik",
    category: "Customer-Facing",
    icon: "ExternalLink",
    description:
      "Halaman faktur yang bisa diakses via link unik (token) tanpa login. Customer menerima link via WhatsApp atau email setelah transaksi.",
    scope: [
      "Akses via URL unik dengan token",
      "Tampilan faktur lengkap tanpa login",
      "Detail item, harga, diskon, total",
      "Informasi toko dan cabang",
      "QR code untuk verifikasi",
    ],
    useCases: [
      {
        id: "UC-PUB-01",
        title: "Lihat Faktur Publik",
        actor: "Customer / Publik",
        prerequisite: "Memiliki link faktur unik.",
        description: "Customer menerima link faktur via WhatsApp atau email. Klik link. Halaman faktur terbuka di browser tanpa perlu login. Lihat detail pembelian lengkap.",
        result: "Faktur ditampilkan dengan detail lengkap. QR code tersedia untuk verifikasi keaslian.",
      },
    ],
    roleAccess: [
      { role: "publik", access: "baca_saja", detail: "Siapa saja dengan link bisa melihat" },
    ],
    complexity: "rendah",
    sourceFiles: [
      { path: "src/pages/public/PublicInvoicePage.tsx", type: "frontend", description: "Halaman faktur publik" },
    ],
    introducedIn: "1.2.0",
    status: "stable",
    relatedFeatures: ["invoices", "online-shop", "pos"],
  },
];
