import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Smartphone,
  Tablet,
  Laptop,
  Watch,
  Headphones,
  ShoppingBag,
  Package,
  Tv,
  Radio,
  Music,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  iphone: Smartphone,
  ipad: Tablet,
  macbook: Laptop,
  watch: Watch,
  apple_watch: Watch,
  airpods: Headphones,
  accessory: ShoppingBag,
  aksesori: ShoppingBag,
  accessories: ShoppingBag,
  imac: Tv,
  mac_mini: Radio,
  mac_pro: Laptop,
  ipod: Music,
  apple_tv: Tv,
};

const CATEGORY_LABELS: Record<string, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  macbook: "MacBook",
  watch: "Apple Watch",
  apple_watch: "Apple Watch",
  airpods: "AirPods",
  accessory: "Aksesoris",
  aksesori: "Aksesoris",
  accessories: "Aksesoris",
  imac: "iMac",
  mac_mini: "Mac Mini",
  mac_pro: "Mac Pro",
  ipod: "iPod",
  apple_tv: "Apple TV",
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat.toLowerCase()] ?? cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ");
}

function categoryIcon(cat: string): React.ElementType {
  return CATEGORY_ICONS[cat.toLowerCase()] ?? Package;
}

interface Props {
  allCategories: string[];
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  categoryUnitCounts: Record<string, number>;
  loading: boolean;
}

export function POSCategoryCards({
  allCategories,
  filterCategory,
  setFilterCategory,
  categoryUnitCounts,
  loading,
}: Props) {
  const totalCards = allCategories.length + 1;

  if (loading) {
    return (
      <div
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      >
        {Array.from({ length: Math.max(totalCards, 2) }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-[50px] min-w-[80px] rounded-xl border border-border bg-card shrink-0"
          >
            <Skeleton className="w-full h-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
    >
      <POSCategoryCard
        icon={Package}
        label="Semua"
        isActive={filterCategory === "all"}
        disabled={false}
        onClick={() => setFilterCategory("all")}
      />
      {[...allCategories]
        .sort((a, b) => {
          // iPhone comes first
          if (a.toLowerCase() === "iphone") return -1;
          if (b.toLowerCase() === "iphone") return 1;
          // Then by count (products with stock first)
          const aCount = categoryUnitCounts[a.toLowerCase()] ?? 0;
          const bCount = categoryUnitCounts[b.toLowerCase()] ?? 0;
          if (aCount > 0 && bCount === 0) return -1;
          if (aCount === 0 && bCount > 0) return 1;
          return 0;
        })
        .map((cat) => {
          const count = categoryUnitCounts[cat.toLowerCase()] ?? 0;
          return (
            <POSCategoryCard
              key={cat}
              icon={categoryIcon(cat)}
              label={categoryLabel(cat)}
              isActive={filterCategory === cat}
              disabled={count === 0}
              onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
            />
          );
        })}
    </div>
  );
}

interface CardProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
}

function POSCategoryCard({ icon: Icon, label, isActive, disabled, onClick }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-0.5 h-[50px] rounded-xl border transition-all shrink-0 min-w-[80px] px-2",
        disabled
          ? "opacity-40 cursor-not-allowed pointer-events-none border-border bg-card"
          : isActive
          ? "border-primary bg-primary/5 ring-2 ring-primary/20 cursor-pointer"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/50 cursor-pointer"
      )}
    >
      <Icon
        className={cn(
          "w-4 h-4",
          disabled
            ? "text-muted-foreground"
            : isActive
            ? "text-primary"
            : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap leading-tight",
          disabled
            ? "text-muted-foreground"
            : isActive
            ? "text-primary"
            : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </button>
  );
}
