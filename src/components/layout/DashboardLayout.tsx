import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";
import { AuthFooter as AppFooter } from "@/components/shared/AuthFooter";

interface DashboardLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function DashboardLayout({ children, pageTitle }: DashboardLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-row">
      {/* Desktop sidebar — part of flex row so it pushes content */}
      <AppSidebar
        mobileSidebarOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Right column: topnav (fixed) + content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          pageTitle={pageTitle}
          onMobileMenuToggle={() => setMobileSidebarOpen((v) => !v)}
        />

        {/* Main content — natural scroll container */}
        <main className="flex-1">
          <div className="p-4 sm:p-5 md:p-6 lg:px-12 xl:px-16 xl:py-8">
            {children}
          </div>

          <AppFooter className="mt-8" />
        </main>
      </div>
    </div>
  );
}
