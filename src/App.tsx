import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/admin/AuthContext";
import { CustomerAuthProvider } from "@/contexts/customer/CustomerAuthContext";
import { LocaleProvider } from "@/contexts/shared/LocaleContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import NotFound from "./pages/NotFound";
import PublicInvoicePage from "./pages/public/PublicInvoicePage";

// Customer pages
import LandingPage from "./pages/customer/LandingPage";
import ShopPage from "./pages/customer/shop/ShopPage";
import ProductDetailPage from "./pages/customer/shop/ProductDetailPage";
import CartPage from "./pages/customer/shop/CartPage";
import CheckoutPage from "./pages/customer/shop/CheckoutPage";
import CustomerTransaksiPage from "./pages/customer/transaksi/CustomerTransaksiPage";
import CustomerTransaksiDetailPage from "./pages/customer/transaksi/CustomerTransaksiDetailPage";
import CustomerProfilePage from "./pages/customer/account/CustomerProfilePage";
import CustomerAddressPage from "./pages/customer/account/CustomerAddressPage";
import CustomerUlasanPage from "./pages/customer/ulasan/UlasanPage";

// Customer auth
import CustomerLoginPage from "@/pages/auth/CustomerLoginPage";
import CustomerRegisterPage from "@/pages/auth/CustomerRegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

// Admin auth pages
import AdminLoginPage from "./pages/auth/AdminLoginPage";
import AdminRegisterPage from "./pages/auth/AdminRegisterPage";
import AdminForgotPasswordPage from "./pages/auth/AdminForgotPasswordPage";
import AdminResetPasswordPage from "./pages/auth/AdminResetPasswordPage";
import WaitingApprovalPage from "./pages/auth/WaitingApprovalPage";

// Admin dashboard pages (protected)
import DashboardPage from "./pages/admin/DashboardPage";
import ProfilPage from "./pages/admin/ProfilPage";
import PengaturanPage from "./pages/admin/PengaturanPage";
import MasterProductsPage from "./pages/admin/produk/MasterProductsPage";
import StockProductsPage from "./pages/admin/produk/StockProductsPage";
import AksesorisDetailPage from "./pages/admin/produk/AksesorisDetailPage";
import TambahStokPage from "./pages/admin/produk/TambahStokPage";
import StokOpnamePage from "./pages/admin/produk/StokOpnamePage";
import RiwayatTransaksiPage from "./pages/admin/transaksi/RiwayatTransaksiPage";
import TransaksiDetailPage from "./pages/admin/transaksi/TransaksiDetailPage";
import POSPage from "./pages/admin/transaksi/POSPage";
import { VerifikasiUnitMasukPage } from "./pages/admin/transaksi/VerifikasiUnitMasukPage";
import InvoicePage from "./pages/admin/transaksi/InvoicePage";
import FakturListPage from "./pages/admin/penjualan/FakturListPage";
import FakturDetailPage from "./pages/admin/penjualan/FakturDetailPage";
import FakturSettingsPage from "./pages/admin/penjualan/FakturSettingsPage";
import KanalPembayaranPage from "./pages/admin/transaksi/KanalPembayaranPage";
import KatalogPage from "./pages/admin/katalog/KatalogPage";
import KatalogFormPage from "./pages/admin/katalog/KatalogFormPage";
import BonusProductsPage from "./pages/admin/katalog/BonusProductsPage";
import EditPengaturanBonusPage from "./pages/admin/katalog/EditPengaturanBonusPage";
import EkspedisiPage from "./pages/admin/katalog/EkspedisiPage";
import DiscountCodesPage from "./pages/admin/katalog/DiscountCodesPage";
import FlashSalePage from "./pages/admin/marketing/FlashSalePage";
import DiskonSalePage from "./pages/admin/marketing/DiskonSalePage";
import AdminUlasanPage from "./pages/admin/marketing/UlasanPage";
import ManajemenAdminPage from "./pages/admin/pengguna/ManajemenAdminPage";
import ManajemenCustomerPage from "./pages/admin/pengguna/ManajemenCustomerPage";
import ManajemenCabangPage from "./pages/admin/operasional/ManajemenCabangPage";
import LaporanPage from "./pages/admin/laporan/LaporanPage";
import ActivityLogPage from "./pages/admin/laporan/ActivityLogPage";
import ChangelogPage from "./pages/admin/ChangelogPage";
import DesignSystemPage from "./pages/admin/DesignSystemPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="bottom-center" />
      <BrowserRouter>
        <LocaleProvider>
          <CustomerAuthProvider>
          <AuthProvider>

          <Routes>
            {/* ── Public / Landing ──────────────────────────────── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/katalog" element={<ShopPage />} />
            <Route path="/produk/:slug" element={<ProductDetailPage />} />
            <Route path="/keranjang" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/profil" element={<CustomerProfilePage />} />
            <Route path="/alamat" element={<CustomerAddressPage />} />
            <Route path="/riwayat" element={<CustomerTransaksiPage />} />
            <Route path="/riwayat/:id" element={<CustomerTransaksiDetailPage />} />
            <Route path="/ulasan" element={<CustomerUlasanPage />} />

            {/* ── Customer auth routes ───────────────────────────── */}
            <Route path="/login" element={<CustomerLoginPage />} />
            <Route path="/register" element={<CustomerRegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* ── Admin auth routes (/admin/...) ─────────────────── */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/register" element={<AdminRegisterPage />} />
            <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
            <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
            <Route path="/admin/waiting-approval" element={<WaitingApprovalPage />} />

            {/* ── Protected dashboard routes (/admin/...) ────── */}
            <Route path="/admin/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/admin/master-produk" element={<ProtectedRoute><MasterProductsPage /></ProtectedRoute>} />
            {/* Redirect URL lama ke URL baru */}
            <Route path="/admin/stok-imei" element={<Navigate to="/admin/stok-produk" replace />} />
            <Route path="/admin/stok-imei/tambah" element={<Navigate to="/admin/stok-produk/tambah" replace />} />
            {/* URL baru */}
            <Route path="/admin/stok-produk" element={<ProtectedRoute><StockProductsPage /></ProtectedRoute>} />
            <Route path="/admin/stok-produk/tambah" element={<ProtectedRoute><TambahStokPage /></ProtectedRoute>} />
            <Route path="/admin/stok-produk/aksesoris/:id" element={<ProtectedRoute><AksesorisDetailPage /></ProtectedRoute>} />
            <Route path="/admin/stok-opname" element={<ProtectedRoute><StokOpnamePage /></ProtectedRoute>} />
            <Route path="/admin/manajemen-customer" element={<ProtectedRoute allowRoles={["super_admin", "admin_branch"]}><ManajemenCustomerPage /></ProtectedRoute>} />
            <Route path="/admin/manajemen-admin" element={<ProtectedRoute allowRoles={["super_admin", "admin_branch"]}><ManajemenAdminPage /></ProtectedRoute>} />
            <Route path="/admin/manajemen-admin/:tab" element={<ProtectedRoute allowRoles={["super_admin", "admin_branch"]}><ManajemenAdminPage /></ProtectedRoute>} />
            <Route path="/admin/laporan" element={<ProtectedRoute><LaporanPage /></ProtectedRoute>} />
            <Route path="/admin/profil" element={<ProtectedRoute><ProfilPage /></ProtectedRoute>} />
            <Route path="/admin/pengaturan" element={<ProtectedRoute><PengaturanPage /></ProtectedRoute>} />
            <Route path="/admin/log-aktivitas" element={<ProtectedRoute requireRole="super_admin"><ActivityLogPage /></ProtectedRoute>} />
            {/* Katalog & Flash Sale: web_admin + super_admin only */}
            <Route path="/admin/katalog" element={<ProtectedRoute allowRoles={["super_admin", "web_admin"]}><KatalogPage /></ProtectedRoute>} />
            <Route path="/admin/katalog/tambah" element={<ProtectedRoute allowRoles={["super_admin", "web_admin"]}><KatalogFormPage /></ProtectedRoute>} />
            <Route path="/admin/katalog/edit/:id" element={<ProtectedRoute allowRoles={["super_admin", "web_admin"]}><KatalogFormPage /></ProtectedRoute>} />
            <Route path="/admin/katalog/bonus" element={<ProtectedRoute requireRole="super_admin"><BonusProductsPage /></ProtectedRoute>} />
            <Route path="/admin/katalog/bonus/pengaturan/:category" element={<ProtectedRoute requireRole="super_admin"><EditPengaturanBonusPage /></ProtectedRoute>} />
            <Route path="/admin/katalog/ekspedisi" element={<ProtectedRoute requireRole="super_admin"><EkspedisiPage /></ProtectedRoute>} />
            <Route path="/admin/katalog/diskon" element={<ProtectedRoute requireRole="super_admin"><DiscountCodesPage /></ProtectedRoute>} />
            <Route path="/admin/flash-sale" element={<ProtectedRoute allowRoles={["super_admin", "web_admin"]}><FlashSalePage /></ProtectedRoute>} />
            <Route path="/admin/diskon-sale" element={<ProtectedRoute allowRoles={["super_admin", "web_admin"]}><DiskonSalePage /></ProtectedRoute>} />
            <Route path="/admin/cabang" element={<ProtectedRoute requireRole="super_admin"><ManajemenCabangPage /></ProtectedRoute>} />
            <Route path="/admin/pos" element={<ProtectedRoute><POSPage /></ProtectedRoute>} />
            <Route path="/admin/verifikasi-unit-masuk" element={<ProtectedRoute allowRoles={["super_admin", "admin_branch"]}><VerifikasiUnitMasukPage /></ProtectedRoute>} />
            <Route path="/admin/transaksi" element={<ProtectedRoute><RiwayatTransaksiPage /></ProtectedRoute>} />
            <Route path="/admin/transaksi/:id" element={<ProtectedRoute><TransaksiDetailPage /></ProtectedRoute>} />
            <Route path="/admin/transaksi/:id/invoice" element={<ProtectedRoute><InvoicePage /></ProtectedRoute>} />
            <Route path="/admin/penjualan/kanal-pembayaran" element={<ProtectedRoute allowRoles={["super_admin", "admin_branch"]}><KanalPembayaranPage /></ProtectedRoute>} />
            <Route path="/admin/penjualan/faktur" element={<ProtectedRoute><FakturListPage /></ProtectedRoute>} />
            <Route path="/admin/penjualan/faktur/pengaturan" element={<ProtectedRoute allowRoles={["super_admin", "admin_branch"]}><FakturSettingsPage /></ProtectedRoute>} />
            <Route path="/admin/penjualan/faktur/:id" element={<ProtectedRoute><FakturDetailPage /></ProtectedRoute>} />
            <Route path="/admin/ulasan" element={<ProtectedRoute allowRoles={["super_admin", "web_admin"]}><AdminUlasanPage /></ProtectedRoute>} />
            <Route path="/admin/release-notes" element={<ProtectedRoute><ChangelogPage /></ProtectedRoute>} />
            <Route path="/admin/design-system" element={<ProtectedRoute requireRole="super_admin"><DesignSystemPage /></ProtectedRoute>} />

            {/* Public design system — no auth required */}
            <Route path="/design-system" element={<DesignSystemPage />} />

            {/* Public invoice view (no auth required) */}
            <Route path="/faktur/view/:token" element={<PublicInvoicePage />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AuthProvider>
          </CustomerAuthProvider>
        </LocaleProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
