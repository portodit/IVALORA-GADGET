import { useToast } from "@/hooks/shared/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

const TOAST_DURATION = 2000;

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={TOAST_DURATION}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const parts: string[] = [];
        if (title)       parts.push(`[${String(title)}]`);
        if (description) parts.push(String(description));
        const detail = parts.length > 0 ? parts.join("\n") : undefined;

        return (
          <Toast
            key={id}
            detail={detail}
            duration={TOAST_DURATION}
            {...props}
          >
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
