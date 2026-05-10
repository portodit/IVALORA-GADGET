import { useState, useRef, useEffect } from "react";
import { MapPin, ChevronDown, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableDropdownOption {
  id: string;
  name: string;
  code?: string;
}

interface SearchableDropdownProps {
  options: SearchableDropdownOption[];
  /** Selected option id, "all" for the all-option, or null/undefined for unset */
  value: string | null | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Which side the dropdown panel opens toward (default: right) */
  align?: "left" | "right";
  className?: string;
  /** Override trigger button classes (merged with defaults) */
  triggerClassName?: string;
  /** Icon shown in trigger and list rows (default: MapPin) */
  icon?: React.ElementType;
  /** Label for the "all" option row */
  allLabel?: string;
  /** Show "all" option at top of list (for filter dropdowns) */
  showAllOption?: boolean;
  /** Compact style — matches h-9 filter bar height (default: false) */
  compact?: boolean;
}

/**
 * SearchableDropdown — design system component.
 * Searchable single-select dropdown. No external deps.
 *
 * Usage (branch selector):
 *   <SearchableDropdown
 *     options={allBranches}
 *     value={selectedBranch?.id}
 *     onChange={(id) => setSelectedBranch(allBranches.find(b => b.id === id) ?? null)}
 *   />
 *
 * Usage (filter with "all" option):
 *   <SearchableDropdown
 *     compact
 *     showAllOption
 *     allLabel="Semua Cabang"
 *     options={branches}
 *     value={branchFilter}
 *     onChange={setBranchFilter}
 *   />
 */
export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  align = "right",
  className,
  triggerClassName,
  icon: Icon = MapPin,
  allLabel = "Semua",
  showAllOption = false,
  compact = false,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAll = value === "all";
  const selectedOption = isAll ? null : options.find(o => o.id === value);
  const displayLabel = isAll ? allLabel : (selectedOption?.name ?? placeholder);

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const hasSelection = isAll || !!selectedOption;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => options.length > 0 && setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2 transition-colors cursor-pointer",
          compact
            ? cn(
                "h-9 px-3 rounded-lg border border-zinc-200 bg-background hover:border-zinc-400 text-sm font-medium text-foreground min-w-[120px]",
                hasSelection && value !== "all" && "border-primary text-primary",
              )
            : "px-3 py-2 rounded-xl border-2 border-zinc-300 hover:border-zinc-800 bg-white text-sm font-semibold text-zinc-800 min-w-[160px] max-w-[220px]",
          triggerClassName,
        )}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", compact ? "text-muted-foreground" : "text-zinc-400")} />
        <span className="flex-1 truncate text-left">{displayLabel}</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 shrink-0 transition-transform",
          compact ? "text-muted-foreground" : "text-zinc-400",
          open && "rotate-180",
        )} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full mt-1.5 w-64 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-100">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent text-zinc-800 placeholder:text-zinc-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Option list */}
          <div className="max-h-56 overflow-y-auto p-1">
            {/* "All" option */}
            {showAllOption && (
              <button
                type="button"
                onClick={() => { onChange("all"); setOpen(false); setSearch(""); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                  isAll
                    ? "bg-zinc-900 text-white font-semibold"
                    : "text-zinc-700 hover:bg-zinc-50 font-medium",
                )}
              >
                <span className="flex-1 truncate">{allLabel}</span>
                {isAll && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            )}

            {/* Option rows */}
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false); setSearch(""); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                  value === o.id
                    ? "bg-zinc-900 text-white font-semibold"
                    : "text-zinc-700 hover:bg-zinc-50 font-medium",
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className="flex-1 truncate">{o.name}</span>
                {o.code && <span className="text-[10px] font-mono opacity-50">{o.code}</span>}
                {value === o.id && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}

            {/* Empty state */}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-zinc-400 py-5">Tidak ditemukan</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
