import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Label satuan item, e.g. "SKU", "produk", "data" */
  itemLabel?: string;
  /** Offset kiri untuk sidebar layout (md:left-[72px]) */
  sidebarOffset?: boolean;
  className?: string;
}

export function TablePagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions = [15, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemLabel = "data",
  sidebarOffset = true,
  className,
}: TablePaginationProps) {
  const paginationRange = useMemo(() => {
    const delta = 1;
    const range: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= page - delta && i <= page + delta)
      ) {
        range.push(i);
      } else if (range[range.length - 1] !== "...") {
        range.push("...");
      }
    }
    return range;
  }, [page, totalPages]);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg",
        sidebarOffset && "md:left-[72px]",
        className,
      )}
    >
      <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        {/* Left: total count + page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {totalCount} {itemLabel}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">Tampilkan</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((s) => (
                <SelectItem key={s} value={s.toString()}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground hidden sm:inline">per halaman</span>
        </div>

        {/* Mobile: simple page indicator */}
        <span className="text-xs text-muted-foreground sm:hidden">
          {page}/{totalPages}
        </span>

        {/* Right: prev / page numbers / next */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="hidden sm:flex items-center gap-1">
            {paginationRange.map((item, idx) =>
              item === "..." ? (
                <span
                  key={`dots-${idx}`}
                  className="w-8 text-center text-xs text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={page === item ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0 text-xs",
                    page === item && "pointer-events-none",
                  )}
                  onClick={() => onPageChange(item as number)}
                >
                  {item}
                </Button>
              ),
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
