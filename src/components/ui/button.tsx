import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        secondary:
          "rounded-lg border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        tertiary:
          "rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        outline:
          "rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        destructive:
          "rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        ghost:
          "rounded-lg hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        link:
          "rounded-none text-primary underline-offset-4 hover:underline p-0 h-auto",
        success:
          "rounded-lg bg-success text-success-foreground hover:bg-success/90 active:bg-success/80",
        warning:
          "rounded-lg bg-warning text-warning-foreground hover:bg-warning/90 active:bg-warning/80",
      },
      size: {
        xs:        "h-6 px-2 text-[10px] gap-1 [&_svg]:size-3 rounded-md",
        sm:        "h-8 px-3 text-xs gap-1 [&_svg]:size-3.5",
        default:   "h-9 px-3.5 text-sm [&_svg]:size-4",
        lg:        "h-10 px-4 text-sm [&_svg]:size-4",
        xl:        "h-12 px-6 text-base [&_svg]:size-5",
        "icon-xs": "h-6 w-6 [&_svg]:size-3 rounded-md",
        "icon-sm": "h-8 w-8 [&_svg]:size-3.5",
        icon:      "h-9 w-9 [&_svg]:size-4",
        "icon-lg": "h-10 w-10 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
