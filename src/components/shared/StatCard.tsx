import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardColor = "default" | "success" | "warning" | "info" | "destructive";

const colorMap: Record<StatCardColor, string> = {
  default:     "text-foreground",
  success:     "text-success",
  warning:     "text-warning",
  info:        "text-info",
  destructive: "text-destructive",
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  color?: StatCardColor;
  className?: string;
}

export function StatCard({ label, value, sub, icon: Icon, color = "default", className }: StatCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <CardContent className="p-0 space-y-1">
        <div className="flex items-center justify-between">
          <p className="ds-label text-muted-foreground">{label}</p>
          {Icon && (
            <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className={cn("text-2xl font-bold", colorMap[color])}>{value}</p>
        {sub && <p className="ds-caption text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
