import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, RefreshCw, LogIn, Mail } from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.svg";
import { useAuth } from "@/contexts/admin/AuthContext";
import { AuthFooter as AppFooter } from "@/components/shared/AuthFooter";

type ErrorCategory = "client" | "server" | "network" | "auth";

interface ErrorConfig {
  code: number;
  category: ErrorCategory;
  title: string;
  description: string;
  suggestion: string;
  retryable: boolean;
  extraCTA?: {
    label: string;
    action: "login" | "contact_admin" | "reload" | "go_home";
    icon: "LogIn" | "Mail" | "RefreshCw" | "Home";
  };
}

const ERROR_REGISTRY: Record<string, ErrorConfig> = {
  "400": {
    code: 400, category: "client", retryable: false,
    title: "Permintaan Tidak Valid",
    description: "Format atau parameter permintaan tidak sesuai. Biasanya karena URL yang rusak atau data formulir tidak lengkap.",
    suggestion: "Periksa kembali URL yang Anda masukkan atau muat ulang halaman dari awal.",
  },
  "401": {
    code: 401, category: "auth", retryable: false,
    title: "Sesi Berakhir",
    description: "Anda perlu masuk terlebih dahulu untuk mengakses halaman ini. Sesi Anda mungkin sudah berakhir secara otomatis.",
    suggestion: "Silakan masuk kembali menggunakan akun Anda.",
    extraCTA: { label: "Masuk ke Akun", action: "login", icon: "LogIn" },
  },
  "403": {
    code: 403, category: "auth", retryable: false,
    title: "Akses Ditolak",
    description: "Akun Anda tidak memiliki izin untuk mengakses halaman ini.",
    suggestion: "Hubungi Super Admin untuk memverifikasi peran dan hak akses akun Anda.",
    extraCTA: { label: "Hubungi Administrator", action: "contact_admin", icon: "Mail" },
  },
  "404": {
    code: 404, category: "client", retryable: false,
    title: "Halaman Tidak Ditemukan",
    description: "Halaman yang Anda cari tidak ada atau sudah tidak tersedia. Ini bisa terjadi karena URL yang salah ketik, halaman yang sudah dipindahkan, atau tautan yang sudah kedaluarsa.",
    suggestion: "Gunakan navigasi sidebar untuk menemukan halaman yang Anda tuju, atau gunakan tombol Kembali untuk kembali ke halaman sebelumnya.",
  },
  "408": {
    code: 408, category: "network", retryable: true,
    title: "Permintaan Habis Waktu",
    description: "Server tidak mendapat respons dalam batas waktu yang ditentukan. Biasanya karena koneksi lambat atau server sibuk.",
    suggestion: "Periksa koneksi internet Anda, lalu coba muat ulang halaman.",
  },
  "409": {
    code: 409, category: "client", retryable: false,
    title: "Terjadi Konflik Data",
    description: "Permintaan tidak dapat diproses karena konflik dengan data yang sudah ada di sistem.",
    suggestion: "Kembali dan periksa apakah data yang Anda masukkan sudah terdaftar di sistem.",
  },
  "410": {
    code: 410, category: "client", retryable: false,
    title: "Halaman Sudah Dihapus",
    description: "Halaman ini sebelumnya ada, tetapi sekarang sudah dihapus secara permanen dari sistem.",
    suggestion: "Hapus bookmark ke halaman ini karena tautan sudah tidak berlaku.",
  },
  "422": {
    code: 422, category: "client", retryable: false,
    title: "Data Tidak Dapat Diproses",
    description: "Server tidak dapat memproses data yang dikirimkan karena terdapat kesalahan validasi.",
    suggestion: "Kembali ke formulir dan periksa kembali setiap isian.",
  },
  "429": {
    code: 429, category: "client", retryable: true,
    title: "Terlalu Banyak Permintaan",
    description: "Akun atau perangkat Anda telah mengirim terlalu banyak permintaan dalam waktu singkat.",
    suggestion: "Tunggu beberapa saat sebelum mencoba kembali.",
  },
  "500": {
    code: 500, category: "server", retryable: true,
    title: "Terjadi Kesalahan Sistem",
    description: "Server mengalami kondisi yang tidak terduga. Ini bukan kesalahan dari sisi Anda.",
    suggestion: "Coba muat ulang halaman. Jika masalah berlanjut, laporkan ke administrator sistem.",
  },
  "502": {
    code: 502, category: "server", retryable: true,
    title: "Gateway Tidak Merespons",
    description: "Server menerima respons tidak valid dari server lain di jaringan. Biasanya masalah sementara.",
    suggestion: "Tunggu 1–2 menit lalu coba muat ulang halaman.",
  },
  "503": {
    code: 503, category: "server", retryable: true,
    title: "Layanan Tidak Tersedia",
    description: "Server sedang tidak dapat melayani permintaan saat ini karena pemeliharaan atau lonjakan trafik.",
    suggestion: "Tunggu 5–10 menit lalu coba kembali.",
  },
  "504": {
    code: 504, category: "server", retryable: true,
    title: "Server Tidak Merespons Tepat Waktu",
    description: "Server tidak menerima respons tepat waktu dari layanan upstream. Kondisi ini biasanya bersifat sementara.",
    suggestion: "Muat ulang halaman setelah beberapa saat.",
  },
  "520": {
    code: 520, category: "network", retryable: true,
    title: "Koneksi ke Server Terputus",
    description: "Terjadi kesalahan tidak dikenali antara jaringan dan server IVALORA RMS.",
    suggestion: "Muat ulang halaman atau coba bersihkan cache browser.",
  },
  "521": {
    code: 521, category: "network", retryable: true,
    title: "Server Sedang Offline",
    description: "Server IVALORA RMS saat ini tidak aktif dan tidak dapat menerima koneksi apapun.",
    suggestion: "Tunggu 5–10 menit lalu coba kembali. Jika berlanjut, informasikan ke administrator.",
  },
  "522": {
    code: 522, category: "network", retryable: true,
    title: "Koneksi Habis Waktu",
    description: "Koneksi ke server tidak berhasil terbentuk dalam batas waktu. Server mungkin sedang sangat sibuk.",
    suggestion: "Periksa koneksi internet Anda, lalu coba muat ulang halaman.",
  },
  "524": {
    code: 524, category: "network", retryable: true,
    title: "Proses Memakan Waktu Terlalu Lama",
    description: "Server tidak mengirimkan respons apapun dalam batas waktu maksimum yang diizinkan.",
    suggestion: "Jika sedang memproses data besar, kemungkinan prosesnya tetap berjalan. Cek hasilnya setelah beberapa menit.",
  },
};

const CATEGORY_GRADIENT: Record<ErrorCategory, string> = {
  client:  "from-amber-400/25 via-amber-300/10 to-transparent",
  auth:    "from-orange-400/25 via-orange-300/10 to-transparent",
  server:  "from-red-400/25 via-red-300/10 to-transparent",
  network: "from-slate-400/25 via-slate-300/10 to-transparent",
};

const CATEGORY_ACCENT: Record<ErrorCategory, string> = {
  client:  "text-amber-600 dark:text-amber-400",
  auth:    "text-orange-600 dark:text-orange-400",
  server:  "text-red-600 dark:text-red-400",
  network: "text-slate-600 dark:text-slate-400",
};

const CATEGORY_BADGE: Record<ErrorCategory, string> = {
  client:  "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  auth:    "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  server:  "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  network: "bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  client:  "Client Error",
  auth:    "Auth Error",
  server:  "Server Error",
  network: "Network Error",
};

const DEFAULT_ERROR = ERROR_REGISTRY["404"];

const ExtraCTAIcon = ({ icon }: { icon: string }) => {
  if (icon === "LogIn") return <LogIn className="w-4 h-4" />;
  if (icon === "Mail") return <Mail className="w-4 h-4" />;
  if (icon === "RefreshCw") return <RefreshCw className="w-4 h-4" />;
  return <Home className="w-4 h-4" />;
};

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  const dashboardPath = role && role !== null ? "/admin/dashboard" : "/";

  const pathSegment = location.pathname.replace(/^\//, "");
  const errorInfo: ErrorConfig = ERROR_REGISTRY[pathSegment] ?? DEFAULT_ERROR;
  const errorCode = ERROR_REGISTRY[pathSegment] ? pathSegment : "404";
  const gradient = CATEGORY_GRADIENT[errorInfo.category];

  useEffect(() => {
    console.error(
      `[${errorInfo.category.toUpperCase()}] Error ${errorCode}: ${errorInfo.title} — ${location.pathname}`
    );
  }, [location.pathname]);

  const handleExtraCTA = (action: NonNullable<ErrorConfig["extraCTA"]>["action"]) => {
    switch (action) {
      case "login":         navigate("/admin/login"); break;
      case "contact_admin": break;
      case "reload":        window.location.reload(); break;
      case "go_home":       navigate("/"); break;
    }
  };

  const showDashboardBtn = errorInfo.extraCTA?.action !== "login";

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 pb-20">

        {/* Logo */}
        <div className="mb-5">
          <img
            src={logoHorizontal}
            alt="Ivalora Gadget"
            className="h-6 object-contain invert dark:invert-0 opacity-70"
          />
        </div>

        {/* Main error block */}
        <div className="max-w-[63rem] w-full text-center">

          {/* Category badge */}
          <div className="flex justify-center mb-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${CATEGORY_BADGE[errorInfo.category]}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {CATEGORY_LABEL[errorInfo.category]}
            </span>
          </div>

          {/* Big error number */}
          <div className="relative select-none -mb-2" aria-hidden="true">
            <p
              className="text-[100px] sm:text-[130px] lg:text-[160px] font-black leading-none tracking-tighter text-black/15 dark:text-white/10 pointer-events-none"
            >
              {errorCode}
            </p>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2">
            {errorInfo.title}
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto mb-4">
            {errorInfo.description}
          </p>

          {/* Suggestion box */}
          <div className="text-left max-w-xl mx-auto p-3.5 rounded-xl border border-border bg-accent/30 mb-5">
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${CATEGORY_ACCENT[errorInfo.category]}`}>
              Yang bisa Anda lakukan
            </p>
            <p className="text-sm text-foreground/75 leading-relaxed">
              {errorInfo.suggestion}
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 max-w-sm mx-auto mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-widest">
              IVALORA RMS
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center flex-wrap">
            {errorInfo.extraCTA && (
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  className="gap-2 h-10 px-5 text-sm font-semibold"
                  onClick={() => handleExtraCTA(errorInfo.extraCTA!.action)}
                >
                  <ExtraCTAIcon icon={errorInfo.extraCTA.icon} />
                  {errorInfo.extraCTA.label}
                </Button>
                {errorInfo.extraCTA.action === "contact_admin" && (
                  <p className="text-[11px] text-muted-foreground/50">
                    Laporkan ke Super Admin di sistem Anda
                  </p>
                )}
              </div>
            )}

            {errorInfo.retryable && (
              <Button
                variant="outline"
                className="gap-2 h-10 px-5 text-sm font-semibold"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-4 h-4" />
                Coba Lagi
              </Button>
            )}

            <Button
              variant="outline"
              className="gap-2 h-10 px-5 text-sm font-semibold"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Button>

            {showDashboardBtn && (
              <Button
                className="gap-2 h-10 px-5 text-sm font-semibold"
                onClick={() => navigate(dashboardPath)}
              >
                <Home className="w-4 h-4" />
                Ke Dashboard
              </Button>
            )}
          </div>

          {/* Error ID */}
          <p className="text-[10px] text-muted-foreground/40 pt-5 font-mono">
            Error {errorCode} · {location.pathname}
          </p>
        </div>
      </div>

      <AppFooter fixed />
    </div>
  );
};

export default NotFound;
