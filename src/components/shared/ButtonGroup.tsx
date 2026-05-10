import { cn } from "@/lib/utils";

export interface ButtonGroupOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ElementType;
  badge?: string | number;
  disabled?: boolean;
}

interface ButtonGroupProps<T extends string = string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "xs" | "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
}

const SIZE: Record<string, string> = {
  xs: "px-2.5 py-1 text-xs gap-1",
  sm: "px-3.5 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-1.5",
  lg: "px-5 py-2.5 text-base gap-2",
};

const ICON_SIZE: Record<string, string> = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-4.5 h-4.5",
};

export function ButtonGroup<T extends string = string>({
  options,
  value,
  onChange,
  size = "sm",
  fullWidth = false,
  className,
}: ButtonGroupProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl gap-0.5",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={cn(
              "relative inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150 select-none",
              SIZE[size],
              fullWidth && "flex-1",
              isActive
                ? "bg-black text-white shadow-sm dark:bg-white dark:text-black"
                : "bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-700",
              opt.disabled && "opacity-40 cursor-not-allowed pointer-events-none",
            )}
          >
            {Icon && <Icon className={cn(ICON_SIZE[size], "shrink-0")} />}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none min-w-[18px]",
                  isActive
                    ? "bg-white/20 text-white dark:bg-black/20 dark:text-black"
                    : "bg-zinc-300/60 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300",
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
