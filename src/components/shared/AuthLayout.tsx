import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface AuthLayoutProps {
  hero: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AuthLayout({ hero, children, className }: AuthLayoutProps) {
  return (
    <div className={cn("min-h-screen flex bg-background", className)}>
      {/* Left hero panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative overflow-hidden">
        {hero}
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col min-h-screen px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        {children}
      </div>
    </div>
  );
}
