import { CheckCheck, Package, Truck, MapPin, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStep {
  icon: LucideIcon;
  label: string;
}

const DEFAULT_STEPS: TimelineStep[] = [
  { icon: CheckCheck, label: "Pesanan Dibuat" },
  { icon: Package,    label: "Diproses" },
  { icon: Truck,      label: "Dikirim" },
  { icon: MapPin,     label: "Diterima" },
];

interface OrderTimelineProps {
  currentStep: number;
  steps?: TimelineStep[];
  className?: string;
}

export function OrderTimeline({ currentStep, steps = DEFAULT_STEPS, className }: OrderTimelineProps) {
  return (
    <div className={cn("flex items-start", className)}>
      {steps.map((step, i) => {
        const Icon = step.icon;
        const done   = i < currentStep;
        const active = i === currentStep;

        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            {/* Connector + circle */}
            <div className="flex items-center w-full">
              {i > 0 && (
                <div className={cn("flex-1 h-0.5 transition-colors", done ? "bg-success" : "bg-border")} />
              )}
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors shrink-0",
                  done   && "bg-success border-success text-success-foreground",
                  active && "bg-primary border-primary text-primary-foreground",
                  !done && !active && "bg-background border-border text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {i < steps.length - 1 && (
                <div className={cn("flex-1 h-0.5 transition-colors", done ? "bg-success" : "bg-border")} />
              )}
            </div>
            {/* Label */}
            <p className="ds-caption text-center mt-1 leading-tight px-1">{step.label}</p>
          </div>
        );
      })}
    </div>
  );
}
