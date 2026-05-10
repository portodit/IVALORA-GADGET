import { cn } from "@/lib/utils";

interface AuthFooterProps {
  className?: string;
  fixed?: boolean;
}

export function AuthFooter({ className, fixed = false }: AuthFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t border-border px-6 pt-4 pb-5 flex items-center justify-center",
        fixed && "fixed bottom-0 left-0 right-0 z-50 bg-background",
        className
      )}
    >
      <p className="text-[10px] sm:text-xs font-semibold text-foreground text-center">
        © {year} · IVALORA RMS · Made with ❤️ by{" "}
        <a
          href="mailto:ivaloraitdev@gmail.com"
          className="hover:text-primary transition-colors underline decoration-dotted underline-offset-2"
        >
          IVALORA IT DEV
        </a>
      </p>
    </footer>
  );
}
