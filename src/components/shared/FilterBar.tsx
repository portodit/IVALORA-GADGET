import { Search, Download, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface FilterChip {
  label: string;
  value: string;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  chips?: FilterChip[];
  activeChip?: string;
  onChipChange?: (value: string) => void;
  onExport?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  extraActions?: ReactNode;
  className?: string;
}

export function FilterBar({
  searchPlaceholder = "Cari...",
  searchValue,
  onSearchChange,
  chips = [],
  activeChip,
  onChipChange,
  onExport,
  onAdd,
  addLabel = "Tambah",
  extraActions,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 p-3 bg-card rounded-xl border border-border", className)}>
      {/* Search */}
      <div className="relative max-w-[200px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          inputSize="sm"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange?.(e.target.value)}
          className="pl-7"
        />
      </div>

      {/* Filter chips */}
      {chips.map(chip => (
        <Button
          key={chip.value}
          size="xs"
          variant={activeChip === chip.value ? "default" : "tertiary"}
          onClick={() => onChipChange?.(chip.value)}
        >
          {chip.label}
        </Button>
      ))}

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1.5">
        {extraActions}
        {onExport && (
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        )}
        {onAdd && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
