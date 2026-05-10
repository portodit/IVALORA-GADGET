import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-[380px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-2xl shadow-xl transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:     "bg-indigo-600 text-white",
        destructive: "bg-red-600 text-white",
        success:     "bg-emerald-600 text-white",
        warning:     "bg-amber-500 text-white",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type VariantKey = "default" | "destructive" | "success" | "warning";

const variantConfig: Record<VariantKey, {
  icon: React.ElementType;
  iconCls: string;
  bar: string;
  barBg: string;
}> = {
  default:     { icon: Info,          iconCls: "text-white/90", bar: "bg-white/60", barBg: "bg-black/20" },
  destructive: { icon: AlertCircle,   iconCls: "text-white/90", bar: "bg-white/60", barBg: "bg-black/20" },
  success:     { icon: CheckCircle2,  iconCls: "text-white/90", bar: "bg-white/60", barBg: "bg-black/20" },
  warning:     { icon: AlertTriangle, iconCls: "text-white/90", bar: "bg-white/60", barBg: "bg-black/20" },
};

export type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> & {
    detail?: string;
    duration?: number;
  };

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant, children, detail, duration = 2000, ...props }, ref) => {
  const vk = (variant ?? "default") as VariantKey;
  const cfg = variantConfig[vk] ?? variantConfig.default;
  const IconComp = cfg.icon;

  const [copied, setCopied] = React.useState(false);
  const clickCount = React.useRef(0);
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const doCopy = React.useCallback(() => {
    const text = detail ?? "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [detail]);

  const handleClick = () => {
    clickCount.current += 1;
    if (clickCount.current === 1) {
      clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 350);
    } else if (clickCount.current >= 2) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickCount.current = 0;
      doCopy();
    }
  };

  return (
    <ToastPrimitives.Root
      ref={ref}
      duration={duration}
      className={cn(toastVariants({ variant }), className)}
      onClick={handleClick}
      title={detail ? "Klik 2× untuk copy detail" : undefined}
      {...props}
    >
      {/* Main body */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 pr-10">
        <div className={cn("mt-0.5 shrink-0", cfg.iconCls)}>
          <IconComp className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          {children}
        </div>
        {/* Copy feedback badge */}
        {detail && (
          <div className={cn(
            "shrink-0 flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all duration-200 mt-0.5",
            copied
              ? "bg-white/30 text-white scale-105"
              : "bg-white/15 text-white/70"
          )}>
            {copied
              ? <><Check className="w-3 h-3" />Disalin</>
              : <><Copy className="w-3 h-3" />2×</>
            }
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className={cn("h-1 w-full overflow-hidden", cfg.barBg)}>
        <div
          className={cn("h-full w-full origin-left", cfg.bar)}
          style={{ animation: `toast-shrink ${duration}ms linear forwards` }}
        />
      </div>
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/20 px-3 text-xs font-medium text-white transition-colors hover:bg-white/30 focus:outline-none disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-white/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white focus:opacity-100 focus:outline-none",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-tight text-white", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs text-white/80 mt-0.5 leading-relaxed", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
