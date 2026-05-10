import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Monitor,
  Receipt,
  FileText,
  Package,
  Database,
  Barcode,
  ClipboardList,
  BookOpen,
  BarChart3,
  ChevronRight,
  X,
  Users,
  UserCheck,
  Activity,
  Zap,
  Building2,
  CreditCard,
  Tag,
  Percent,
  MessageSquareText,
  Palette,
  Gift,
  Truck,
  PackageCheck,
} from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.png";
import logoIcon from "@/assets/logo-icon.svg";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/admin/AuthContext";

type NavChild = { title: string; url: string; icon: React.ElementType };
type NavItem =
  | { title: string; url: string; icon: React.ElementType; children?: never }
  | { title: string; icon: React.ElementType; url?: never; children: NavChild[] };

// ── Nav items per role ─────────────────────────────────────────────────────────
const superAdminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  {
    title: "Manajemen Akun",
    icon: Users,
    children: [
      { title: "Akun Customer", url: "/admin/manajemen-customer", icon: UserCheck },
      { title: "Akun Admin", url: "/admin/manajemen-admin/daftar", icon: Users },
    ],
  },
  {
    title: "Cabang",
    url: "/admin/cabang",
    icon: Building2,
  },
  {
    title: "Produk & Inventory",
    icon: Package,
    children: [
      { title: "Master Produk", url: "/admin/master-produk", icon: Database },
      { title: "Stok Produk", url: "/admin/stok-produk", icon: Barcode },
      { title: "Stok Opname", url: "/admin/stok-opname", icon: ClipboardList },
      { title: "Kelola Bonus", url: "/admin/katalog/bonus", icon: Gift },
      { title: "Kelola Ekspedisi", url: "/admin/katalog/ekspedisi", icon: Truck },
      { title: "Katalog", url: "/admin/katalog", icon: BookOpen },
      { title: "Flash Sale", url: "/admin/flash-sale", icon: Zap },
      { title: "Discount Sale", url: "/admin/diskon-sale", icon: Percent },
      { title: "Kode Diskon", url: "/admin/katalog/diskon", icon: Tag },
    ],
  },
  {
    title: "Penjualan",
    icon: ShoppingCart,
    children: [
      { title: "POS", url: "/admin/pos", icon: Monitor },
      { title: "Transaksi", url: "/admin/transaksi", icon: Receipt },
      { title: "Faktur", url: "/admin/penjualan/faktur", icon: FileText },
      { title: "Kanal Pembayaran", url: "/admin/penjualan/kanal-pembayaran", icon: CreditCard },
      { title: "Verifikasi Unit Masuk", url: "/admin/verifikasi-unit-masuk", icon: PackageCheck },
      { title: "Ulasan", url: "/admin/ulasan", icon: MessageSquareText },
    ],
  },
  { title: "Laporan & Analitika", url: "/admin/laporan", icon: BarChart3 },
  { title: "Log Aktivitas", url: "/admin/log-aktivitas", icon: Activity },
];

const adminBranchNavItems: NavItem[] = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  {
    title: "Manajemen Akun",
    icon: Users,
    children: [
      { title: "Staff Cabang", url: "/admin/manajemen-admin/daftar", icon: Users },
      { title: "Customer Cabang", url: "/admin/manajemen-customer", icon: UserCheck },
    ],
  },
  {
    title: "Produk & Inventory",
    icon: Package,
    children: [
      { title: "Master Produk", url: "/admin/master-produk", icon: Database },
      { title: "Stok Produk", url: "/admin/stok-produk", icon: Barcode },
      { title: "Stok Opname", url: "/admin/stok-opname", icon: ClipboardList },
    ],
  },
  {
    title: "Penjualan",
    icon: ShoppingCart,
    children: [
      { title: "POS", url: "/admin/pos", icon: Monitor },
      { title: "Transaksi", url: "/admin/transaksi", icon: Receipt },
      { title: "Faktur", url: "/admin/penjualan/faktur", icon: FileText },
      { title: "Kanal Pembayaran", url: "/admin/penjualan/kanal-pembayaran", icon: CreditCard },
      { title: "Verifikasi Unit Masuk", url: "/admin/verifikasi-unit-masuk", icon: PackageCheck },
    ],
  },
  { title: "Laporan & Analitika", url: "/admin/laporan", icon: BarChart3 },
];

const employeeNavItems: NavItem[] = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  {
    title: "Produk & Inventory",
    icon: Package,
    children: [
      { title: "Stok Produk", url: "/admin/stok-produk", icon: Barcode },
      { title: "Stok Opname", url: "/admin/stok-opname", icon: ClipboardList },
    ],
  },
  {
    title: "Penjualan",
    icon: ShoppingCart,
    children: [
      { title: "POS", url: "/admin/pos", icon: Monitor },
      { title: "Transaksi", url: "/admin/transaksi", icon: Receipt },
      { title: "Faktur", url: "/admin/penjualan/faktur", icon: FileText },
    ],
  },
  { title: "Laporan & Analitika", url: "/admin/laporan", icon: BarChart3 },
];

// web_admin: manages website catalog, no branch-specific inventory, NO stok opname
const webAdminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  {
    title: "Website & Katalog",
    icon: BookOpen,
    children: [
      { title: "Katalog Produk", url: "/admin/katalog", icon: BookOpen },
      { title: "Flash Sale", url: "/admin/flash-sale", icon: Zap },
      { title: "Discount Sale", url: "/admin/diskon-sale", icon: Percent },
      { title: "Ulasan", url: "/admin/ulasan", icon: MessageSquareText },
    ],
  },
  { title: "Laporan & Analitika", url: "/admin/laporan", icon: BarChart3 },
];

interface AppSidebarProps {
  mobileSidebarOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileSidebarOpen = false, onMobileClose }: AppSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const { role, user } = useAuth();

  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null;
  const fullName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "U";
  const initials = fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const navItems =
    role === "super_admin" ? superAdminNavItems :
    role === "admin_branch" ? adminBranchNavItems :
    role === "web_admin" ? webAdminNavItems :
    employeeNavItems;

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) =>
      prev.includes(title) ? prev.filter((g) => g !== title) : [...prev, title]
    );
  };

  const location = useLocation();

  const isGroupActive = (children: NavChild[]) =>
    children.some((c) => location.pathname === c.url || location.pathname.startsWith(c.url + "/"));

  // Auto-open groups containing the active page
  useEffect(() => {
    const activeGroups = navItems
      .filter((item) => item.children && isGroupActive(item.children))
      .map((item) => item.title);
    setOpenGroups((prev) => {
      const merged = Array.from(new Set([...prev, ...activeGroups]));
      return merged;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo area */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0 overflow-hidden">
        <img
          src={isMobile ? logoHorizontal : isExpanded ? logoHorizontal : logoIcon}
          alt="Ivalora Gadget"
          className={`object-contain transition-all duration-300 dark:brightness-0 dark:invert ${
            isMobile ? "h-9 w-full" : isExpanded ? "h-9 w-full" : "w-8 h-8"
          }`}
        />
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 px-2">
        {navItems.map((item) => {
          if (!item.children) {
            return (
              <NavLink
                key={item.title}
                to={item.url}
                end
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 overflow-hidden group",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-semibold",
                )}
                onClick={isMobile ? onMobileClose : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span
                  className="text-sm font-semibold whitespace-nowrap transition-all duration-300 overflow-hidden"
                  style={{
                    opacity: isMobile || isExpanded ? 1 : 0,
                    maxWidth: isMobile || isExpanded ? "200px" : "0px",
                  }}
                >
                  {item.title}
                </span>
              </NavLink>
            );
          }

          const isOpen = openGroups.includes(item.title);
          const showExpanded = isMobile || isExpanded;
          const groupActive = isGroupActive(item.children);

          return (
            <div key={item.title}>
              <button
                onClick={() => showExpanded && toggleGroup(item.title)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 overflow-hidden",
                  groupActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span
                  className={cn(
                    "text-sm whitespace-nowrap flex-1 text-left transition-all duration-300 overflow-hidden",
                    groupActive ? "font-bold" : "font-semibold",
                  )}
                  style={{
                    opacity: showExpanded ? 1 : 0,
                    maxWidth: showExpanded ? "160px" : "0px",
                  }}
                >
                  {item.title}
                </span>
                <ChevronRight
                  className="w-4 h-4 shrink-0 transition-all duration-200"
                  style={{
                    opacity: showExpanded ? 1 : 0,
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                />
              </button>

              {/* Children */}
              <div
                className="overflow-hidden transition-all duration-300"
                style={{
                  maxHeight: showExpanded && isOpen ? `${item.children.length * 44}px` : "0px",
                  opacity: showExpanded && isOpen ? 1 : 0,
                }}
              >
                <div className="ml-4 mt-0.5 mb-1 border-l border-sidebar-border pl-3 space-y-0.5">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.title}
                      to={child.url}
                      end
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 whitespace-nowrap",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-semibold",
                      )}
                      onClick={isMobile ? onMobileClose : undefined}
                    >
                      <child.icon className="w-4 h-4 shrink-0" />
                      <span>{child.title}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

    </>
  );

  return (
    <>
      {/* Desktop sidebar — sticky push layout (shifts content right) */}
      <aside
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className="hidden md:flex sticky top-0 h-screen z-40 flex-col flex-none overflow-hidden bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out shadow-sm"
        style={{ width: isExpanded ? "260px" : "72px" }}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile sidebar — slide in from left */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-screen z-50 flex flex-col w-[280px] bg-sidebar border-r border-sidebar-border shadow-xl transition-transform duration-300 ease-in-out ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent(true)}
      </aside>
    </>
  );
}
