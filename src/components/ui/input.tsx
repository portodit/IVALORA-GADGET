import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-lg border border-input bg-background ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
  {
    variants: {
      inputSize: {
        xs:      "h-7 px-2 text-[10px]",
        sm:      "h-8 px-2.5 text-xs",
        default: "h-9 px-3 text-sm",
        lg:      "h-10 px-3.5 text-sm",
        xl:      "h-11 px-4 text-base",
      },
      state: {
        default: "",
        error:   "border-destructive focus-visible:ring-destructive/40",
        success: "border-success focus-visible:ring-success/40",
      },
    },
    defaultVariants: {
      inputSize: "default",
      state: "default",
    },
  },
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {
  inputSize?: "xs" | "sm" | "default" | "lg" | "xl";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputSize, state, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ inputSize, state }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
