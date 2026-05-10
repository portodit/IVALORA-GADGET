import { ProductCategory } from "@/lib/admin/produk/master-products";
import { cn } from "@/lib/utils";
import {
  Smartphone,
  Tablet,
  Laptop,
  Watch,
  Headphones,
  ShoppingBag,
  Package,
} from "lucide-react";

const CATEGORY_ICONS: Record<ProductCategory, React.ElementType> = {
  iphone: Smartphone,
  ipad: Tablet,
  macbook: Laptop,
  watch: Watch,
  airpods: Headphones,
  accessory: ShoppingBag,
};

interface CategoryImagePlaceholderProps {
  category?: ProductCategory | string;
  className?: string;
  iconClassName?: string;
}

export function CategoryImagePlaceholder({
  category,
  className = "w-full h-full",
  iconClassName = "w-10 h-10",
}: CategoryImagePlaceholderProps) {
  const Icon = category
    ? (CATEGORY_ICONS[category as ProductCategory] || ShoppingBag)
    : Package;

  return (
    <div
      className={cn(
        "bg-muted/60 flex items-center justify-center",
        className
      )}
    >
      <Icon className={cn("text-muted-foreground/40", iconClassName)} />
    </div>
  );
}

// Helper untuk get icon dari category
export function getCategoryIcon(category: ProductCategory | string) {
  return CATEGORY_ICONS[category as ProductCategory] || ShoppingBag;
}