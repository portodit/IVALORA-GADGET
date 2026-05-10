import { useState } from "react";
import { Heart, Phone, Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ── Star Rating ──────────────────────────────────────────────────────── */
function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < Math.floor(value)
              ? "fill-[hsl(var(--star))] text-[hsl(var(--star))]"
              : "fill-muted text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

/* ── Grid Card ────────────────────────────────────────────────────────── */
interface ProductCardProps {
  name: string;
  series: string;
  price: string;
  originalPrice?: string;
  badge?: string;
  stock: number;
  rating?: number;
  isFlashSale?: boolean;
  imageUrl?: string;
  onWishlist?: () => void;
  onClick?: () => void;
  className?: string;
}

export function ProductCard({
  name, series, price, originalPrice, badge, stock, rating = 4.5,
  isFlashSale, imageUrl, onWishlist, onClick, className,
}: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWishlisted(w => !w);
    onWishlist?.();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl border border-border overflow-hidden",
        "hover:shadow-md transition-all group cursor-pointer w-48",
        className,
      )}
    >
      {/* Image */}
      <div className="relative h-40 bg-neutral-100 flex items-center justify-center">
        {imageUrl
          ? <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          : <Phone className="h-14 w-14 text-neutral-300" />
        }

        {badge && (
          <div className="absolute top-2 left-2">
            <Badge variant={isFlashSale ? "warning" : "soft-info"} size="xs">
              {isFlashSale && <Zap className="h-2.5 w-2.5" />}
              {badge}
            </Badge>
          </div>
        )}

        <button
          onClick={handleWishlist}
          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Heart className={cn("h-3 w-3", wishlisted ? "fill-destructive text-destructive" : "text-muted-foreground")} />
        </button>

        {stock === 0 && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <Badge variant="soft-neutral" size="sm">Habis</Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="ds-caption text-muted-foreground">{series}</p>
        <p className="text-sm font-semibold leading-snug line-clamp-2">{name}</p>
        <div>
          <p className="text-sm font-bold text-foreground">{price}</p>
          {originalPrice && (
            <p className="text-xs text-muted-foreground line-through">{originalPrice}</p>
          )}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <p className="ds-caption text-muted-foreground">{stock > 0 ? `${stock} unit` : "Habis"}</p>
          <StarRating value={rating} />
        </div>
      </div>
    </div>
  );
}

/* ── Horizontal Card ──────────────────────────────────────────────────── */
interface ProductCardHorizontalProps {
  name: string;
  price: string;
  series?: string;
  imageUrl?: string;
  badgeVariant?: "soft-success" | "soft-warning" | "soft-neutral" | "soft-info";
  badgeLabel?: string;
  onClick?: () => void;
  className?: string;
}

export function ProductCardHorizontal({
  name, price, series, imageUrl, badgeVariant = "soft-neutral", badgeLabel, onClick, className,
}: ProductCardHorizontalProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-3 p-3 bg-card rounded-xl border border-border",
        "hover:shadow-sm transition-all cursor-pointer",
        className,
      )}
    >
      <div className="h-14 w-14 bg-neutral-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
        {imageUrl
          ? <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          : <Phone className="h-7 w-7 text-neutral-300" />
        }
      </div>
      <div className="flex-1 min-w-0">
        {series && <p className="ds-caption text-muted-foreground">{series}</p>}
        <p className="text-sm font-semibold truncate">{name}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm font-bold">{price}</p>
          {badgeLabel && (
            <Badge variant={badgeVariant} size="xs">{badgeLabel}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
