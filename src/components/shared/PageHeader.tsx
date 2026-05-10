import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * compact=true → text-base font-semibold, cocok untuk sticky header dashboard.
   * compact=false (default) → text-xl font-bold, untuk halaman full-width.
   */
  compact?: boolean;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, compact = false, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col lg:flex-row lg:items-start gap-2 justify-between", className)}>
      <div className="min-w-0">
        {compact ? (
          <p className="text-base font-semibold text-foreground leading-tight">{title}</p>
        ) : (
          <h1 className="text-xl font-bold text-foreground leading-tight tracking-tight">{title}</h1>
        )}
        {subtitle && (
          <p className={cn("text-muted-foreground mt-0.5 leading-relaxed font-medium", compact ? "text-xs" : "text-sm")}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0 self-start lg:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
