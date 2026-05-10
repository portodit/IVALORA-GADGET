import { cn } from "@/lib/utils";

/**
 * AdminFooter — fixed bottom bar untuk semua halaman admin.
 * Posisi dan style mengikuti TablePagination (md:left-[72px]).
 *
 * Design system: tambahkan <AdminFooter /> di dalam DashboardLayout page
 * dan beri pb-12 pada konten agar tidak tertutup footer.
 */
export function AdminFooter({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:left-[72px]",
        "bg-background border-t border-border",
        className,
      )}
    >
      <div className="px-4 sm:px-6 py-2 flex items-center justify-center">
        <p className="text-[10px] sm:text-[11px] font-semibold text-foreground text-center">
          © 2026 · IVALORA RMS · Made with ❤️ by{" "}
          <a
            href="mailto:ivaloraitdev@gmail.com"
            className="hover:text-primary transition-colors underline decoration-dotted underline-offset-2"
          >
            IVALORA IT DEV
          </a>
        </p>
      </div>
    </div>
  );
}
