import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  warning: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  danger: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  info: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  neutral: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
};

const DOT_CLASSES: Record<Variant, string> = {
  default: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-zinc-400",
};

interface StatusBadgeProps {
  label: string;
  variant?: Variant;
  dot?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

export function StatusBadge({
  label,
  variant = "neutral",
  dot = false,
  size = "xs",
  className,
}: StatusBadgeProps) {
  const textSize = size === "xs" ? "text-[11px]" : "text-xs";
  const px = size === "xs" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        textSize,
        px,
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT_CLASSES[variant])} />
      )}
      {label}
    </span>
  );
}
