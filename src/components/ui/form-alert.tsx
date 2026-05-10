import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type FormAlertVariant = "error" | "warning" | "success" | "info";

const variantStyles: Record<FormAlertVariant, string> = {
  error:   "border-destructive/20 bg-destructive/5 text-destructive",
  warning: "border-warning/20 bg-warning-bg text-warning-foreground",
  success: "border-success/20 bg-success-bg text-success-foreground",
  info:    "border-info/20 bg-info-bg text-info-foreground",
};

interface FormAlertProps {
  variant?: FormAlertVariant;
  children: ReactNode;
  className?: string;
}

export function FormAlert({ variant = "error", children, className }: FormAlertProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm font-medium",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
