import { useState } from "react";
import { Phone, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CartItemProps {
  name: string;
  description?: string;
  price: string;
  imageUrl?: string;
  quantity?: number;
  minQty?: number;
  maxQty?: number;
  onQuantityChange?: (qty: number) => void;
  onRemove?: () => void;
  className?: string;
}

export function CartItem({
  name,
  description,
  price,
  imageUrl,
  quantity = 1,
  minQty = 1,
  maxQty = 99,
  onQuantityChange,
  onRemove,
  className,
}: CartItemProps) {
  const [qty, setQty] = useState(quantity);

  const handleChange = (next: number) => {
    const clamped = Math.min(maxQty, Math.max(minQty, next));
    setQty(clamped);
    onQuantityChange?.(clamped);
  };

  return (
    <div className={cn("flex gap-3 p-3 bg-card rounded-xl border border-border", className)}>
      {/* Thumbnail */}
      <div className="h-16 w-16 bg-neutral-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
        {imageUrl
          ? <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          : <Phone className="h-8 w-8 text-neutral-300" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        {description && (
          <p className="ds-caption text-muted-foreground">{description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm font-bold">{price}</p>
          <div className="flex items-center gap-1">
            {onRemove && (
              <Button size="icon-xs" variant="ghost" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="flex items-center gap-1.5">
              <Button size="icon-xs" variant="outline" onClick={() => handleChange(qty - 1)} disabled={qty <= minQty}>
                <Minus />
              </Button>
              <span className="text-sm font-medium w-5 text-center">{qty}</span>
              <Button size="icon-xs" variant="outline" onClick={() => handleChange(qty + 1)} disabled={qty >= maxQty}>
                <Plus />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
