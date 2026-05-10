import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: string;
  original?: string;
  discount?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { price: "text-base font-bold", original: "text-xs", },
  md: { price: "ds-h2",               original: "ds-body-sm", },
  lg: { price: "ds-h1",               original: "ds-body-md", },
};

export function PriceDisplay({ price, original, discount, size = "md", className }: PriceDisplayProps) {
  const s = sizeMap[size];
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className={cn(s.price, "text-foreground")}>{price}</span>
      {original && (
        <span className={cn(s.original, "text-muted-foreground line-through")}>{original}</span>
      )}
      {discount && (
        <Badge variant="soft-warning" size="sm">{discount}</Badge>
      )}
    </div>
  );
}
