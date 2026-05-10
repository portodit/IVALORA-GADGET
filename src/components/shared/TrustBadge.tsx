import { Shield, Truck, CheckCheck, Phone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustItem {
  icon: LucideIcon;
  label: string;
  sub: string;
}

const DEFAULT_ITEMS: TrustItem[] = [
  { icon: Shield,     label: "Garansi Resmi",   sub: "1 Tahun" },
  { icon: Truck,      label: "Pengiriman Aman", sub: "Asuransi Penuh" },
  { icon: CheckCheck, label: "Produk Original", sub: "100% Asli" },
  { icon: Phone,      label: "CS Siap Bantu",   sub: "Senin–Sabtu" },
];

interface TrustBadgeProps {
  items?: TrustItem[];
  className?: string;
}

export function TrustBadge({ items = DEFAULT_ITEMS, className }: TrustBadgeProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-4 py-2.5"
          >
            <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="ds-caption text-muted-foreground">{item.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
