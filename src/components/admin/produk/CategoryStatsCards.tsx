import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABELS, ProductCategory } from "@/lib/admin/produk/master-products";
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
  ChevronDown
} from "lucide-react";

const CATEGORY_ICONS: Record<ProductCategory, React.ElementType> = {
  iphone: Smartphone,
  ipad: Tablet,
  macbook: Laptop,
  watch: Watch,
  airpods: Headphones,
  accessory: ShoppingBag,
};

interface CategoryCount {
  category: ProductCategory;
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
}

interface Props {
  filterCategory: string;
  setFilterCategory: (val: string) => void;
}

export function CategoryStatsCards({ filterCategory, setFilterCategory }: Props) {
  const [counts, setCounts] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalActive, setTotalActive] = useState(0);
  const [totalInactive, setTotalInactive] = useState(0);
  const [showOverview, setShowOverview] = useState(true);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const categories = Object.keys(CATEGORY_LABELS) as ProductCategory[];
      const results: CategoryCount[] = [];
      let tActive = 0;
      let tInactive = 0;

      await Promise.all(
        categories.map(async (cat) => {
          const [{ count: active }, { count: inactive }] = await Promise.all([
            supabase
              .from("master_products")
              .select("id", { count: "exact", head: true })
              .eq("category", cat)
              .is("deleted_at", null)
              .eq("is_active", true),
            supabase
              .from("master_products")
              .select("id", { count: "exact", head: true })
              .eq("category", cat)
              .is("deleted_at", null)
              .eq("is_active", false),
          ]);
          
          const a = active ?? 0;
          const i = inactive ?? 0;
          results.push({ category: cat, activeCount: a, inactiveCount: i, totalCount: a + i });
          tActive += a;
          tInactive += i;
        })
      );

      setCounts(results);
      setTotalActive(tActive);
      setTotalInactive(tInactive);
    } catch (err) {
      console.error("Failed to fetch category counts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const visibleCategories = counts
    .filter((c) => c.totalCount > 0)
    .sort((a, b) => {
      // iPhone comes first, then the rest in original order
      if (a.category === "iphone") return -1;
      if (b.category === "iphone") return 1;
      return 0;
    });
  const totalCards = visibleCategories.length + 1; // +1 for "Semua"
  const grandTotal = totalActive + totalInactive;

  if (loading) {
    return (
      <div className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide lg:grid lg:gap-2" style={{ gridTemplateColumns: `repeat(${7}, minmax(0, 1fr))` }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[68px] min-w-[100px] lg:min-w-0 rounded-xl border border-border bg-card shrink-0">
              <Skeleton className="w-full h-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Overview</span>
        <button
          onClick={() => setShowOverview(v => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showOverview ? "Sembunyikan" : "Tampilkan"}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", showOverview ? "rotate-180" : "rotate-0")} />
        </button>
      </div>

      <div className={cn(
        "overflow-hidden transition-all duration-300",
        showOverview ? "max-h-[120px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
      )}>
        <div
          className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide lg:grid lg:overflow-visible"
          style={{ gridTemplateColumns: `repeat(${totalCards}, minmax(0, 1fr))` }}
        >
          <CategoryCard
            icon={Package}
            activeCount={totalActive}
            inactiveCount={totalInactive}
            label="Semua"
            isActive={filterCategory === "all"}
            onClick={() => setFilterCategory("all")}
          />
          {visibleCategories.map((item) => (
            <CategoryCard
              key={item.category}
              icon={CATEGORY_ICONS[item.category] || ShoppingBag}
              activeCount={item.activeCount}
              inactiveCount={item.inactiveCount}
              label={CATEGORY_LABELS[item.category]}
              isActive={filterCategory === item.category}
              onClick={() => setFilterCategory(item.category)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CategoryCardProps {
  icon: React.ElementType;
  activeCount: number;
  inactiveCount: number;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function CategoryCard({ icon: Icon, activeCount, inactiveCount, label, isActive, onClick }: CategoryCardProps) {
  const total = activeCount + inactiveCount;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 h-[68px] rounded-xl border transition-all shrink-0 min-w-[100px] lg:min-w-0 px-3 lg:px-2 lg:w-full",
        isActive
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn(
          "w-4.5 h-4.5",
          isActive ? "text-primary" : "text-muted-foreground"
        )} />
        <span className={cn(
          "text-xl font-bold leading-none",
          isActive ? "text-primary" : "text-foreground"
        )}>
          {total}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className={cn(
          "text-[10px] font-semibold uppercase tracking-wider text-center",
          isActive ? "text-primary/80" : "text-muted-foreground"
        )}>
          {label}
        </span>
        {inactiveCount > 0 && (
          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
            ({inactiveCount} off)
          </span>
        )}
      </div>
    </button>
  );
}
