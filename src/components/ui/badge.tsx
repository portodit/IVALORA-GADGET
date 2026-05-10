import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        /* Solid — opaque background */
        default:
          "border border-transparent bg-primary text-primary-foreground",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground",
        success:
          "border border-transparent bg-success text-success-foreground",
        warning:
          "border border-transparent bg-warning text-warning-foreground",
        info:
          "border border-transparent bg-info text-info-foreground",

        /* Soft — muted bg, dark text (most common for status) */
        "soft-default":
          "border border-transparent bg-secondary text-secondary-foreground",
        "soft-success":
          "border border-transparent bg-success-bg text-[hsl(var(--success))]",
        "soft-warning":
          "border border-transparent bg-warning-bg text-warning-foreground",
        "soft-destructive":
          "border border-transparent bg-error-bg text-destructive",
        "soft-info":
          "border border-transparent bg-info-bg text-[hsl(var(--info))]",
        "soft-neutral":
          "border border-transparent bg-neutral-100 text-neutral-600",

        /* Outline — border only, no fill */
        outline:
          "border border-border bg-transparent text-foreground",
        "outline-success":
          "border border-[hsl(var(--success))] bg-transparent text-[hsl(var(--success))]",
        "outline-warning":
          "border border-warning bg-transparent text-warning-foreground",
        "outline-destructive":
          "border border-destructive bg-transparent text-destructive",
        "outline-info":
          "border border-[hsl(var(--info))] bg-transparent text-[hsl(var(--info))]",
      },
      size: {
        xs: "h-4 px-1.5 text-[9px] rounded-sm",
        sm: "h-5 px-2 text-[10px] rounded-md",
        md: "h-6 px-2.5 text-xs rounded-md",
        lg: "h-7 px-3 text-sm rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="rounded-full shrink-0 bg-current opacity-80"
          style={{ width: "6px", height: "6px" }}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
