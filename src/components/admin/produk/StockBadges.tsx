import { cn } from "@/lib/utils";
import { CONDITION_LABELS, CONDITION_STYLES, type ConditionStatus, type StatusLabel, getStatusStyles, getStatusLabel } from "@/lib/admin/produk/stock-units";

export function StockStatusBadge({ status, statusLabels, className }: { status: string; statusLabels?: StatusLabel[]; className?: string }) {
  const label = statusLabels?.find(s => s.key === status);
  
  if (label) {
    const styles = getStatusStyles(label);
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", className)}
        style={{ backgroundColor: styles.bg, color: styles.text }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: styles.dot }} />
        {label.label}
      </span>
    );
  }

  // Fallback for unknown statuses
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground", className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
      {status}
    </span>
  );
}

export function ConditionBadge({ condition, className }: { condition: ConditionStatus | null | undefined; className?: string }) {
  // Safe check for null/undefined condition
  if (!condition || !CONDITION_STYLES[condition]) {
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground", className)}>
        Normal
      </span>
    );
  }

  const s = CONDITION_STYLES[condition];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", s.bg, s.text, className)}>
      {CONDITION_LABELS[condition] || condition}
    </span>
  );
}
