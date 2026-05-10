import { useState, useRef, useEffect } from "react";
import { MapPin, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutocompleteDropdownOption {
  id: string;
  name: string;
  code?: string;
}

interface AutocompleteDropdownProps {
  options: AutocompleteDropdownOption[];
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
 * AutocompleteDropdown — Local component for POS.
 * Autocomplete single-select dropdown (Combobox).
 */
export function AutocompleteDropdown({
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
}: AutocompleteDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAll = value === "all";
  const selectedOption = isAll ? null : options.find(o => o.id === value);
  const displayLabel = isAll ? allLabel : (selectedOption?.name ?? "");

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync internal search state with the selected value when closed
  useEffect(() => {
    if (!open) {
      setSearch(displayLabel);
    }
  }, [open, displayLabel]);

  // If the current search text exactly matches the selected label, 
  // treat it as an empty filter (show all) so the user can see options when they click.
  const activeSearch = search !== displayLabel ? search : "";
  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
    (o.code ?? "").toLowerCase().includes(activeSearch.toLowerCase())
  );

  const hasSelection = isAll || !!selectedOption;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <div
        className={cn(
          "flex items-center gap-2 transition-colors cursor-text",
          compact
            ? cn(
                "h-9 px-3 rounded-lg border border-zinc-200 bg-background focus-within:border-zinc-400 text-sm font-medium",
                hasSelection && value !== "all" ? "border-primary text-primary" : "text-foreground",
              )
            : "px-3 py-2 rounded-xl border-2 border-zinc-300 focus-within:border-zinc-800 bg-white text-sm font-semibold text-zinc-800 min-w-[160px] max-w-[220px]",
          triggerClassName,
        )}
        onClick={() => {
          if (!open) setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", compact ? "text-muted-foreground" : "text-zinc-400")} />
        
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
            // Optional: clear value if input is totally cleared
            if (e.target.value === "" && value) {
              onChange("");
            }
          }}
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            "flex-1 truncate outline-none bg-transparent w-full min-w-0",
            compact ? "placeholder:text-muted-foreground" : "placeholder:text-zinc-400",
          )}
        />

        {/* Clear button if there's a selection and it's hovered/focused */}
        {hasSelection && (
          <button
            type="button"
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setSearch("");
              inputRef.current?.focus();
              setOpen(true);
            }}
          >
            <X className="w-3 h-3 shrink-0" />
          </button>
        )}

        <ChevronDown className={cn(
          "w-3.5 h-3.5 shrink-0 transition-transform cursor-pointer",
          compact ? "text-muted-foreground" : "text-zinc-400",
          open && "rotate-180",
        )} />
      </div>

      {open && options.length > 0 && (
        <div
          className={cn(
            "absolute top-full mt-1.5 w-full min-w-[240px] bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {/* Option list */}
          <div className="max-h-56 overflow-y-auto p-1">
            {/* "All" option */}
            {showAllOption && (
              <button
                type="button"
                onClick={() => { onChange("all"); setOpen(false); }}
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
                onClick={() => { onChange(o.id); setOpen(false); }}
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