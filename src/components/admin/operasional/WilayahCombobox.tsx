import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface WilayahItem {
  code: string;
  name: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: WilayahItem[];
  loading: boolean;
  disabled: boolean;
  placeholder: string;
}

export function WilayahCombobox({ label, value, onChange, options, loading, disabled, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find((o) => o.name === value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open && !disabled} onOpenChange={(v) => { if (!disabled) setOpen(v); }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled || loading}
            className={cn(
              "w-full h-10 justify-between font-normal text-sm",
              !value && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {loading
                ? "Memuat..."
                : disabled
                  ? `Pilih ${label.toLowerCase()} dulu`
                  : selected?.name || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 bg-popover border border-border shadow-lg z-[200]"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          align="start"
          sideOffset={4}
        >
          {/* Search input */}
          <div className="flex items-center border-b border-border px-3 py-2 gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={`Cari ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {loading ? "Memuat..." : "Tidak ditemukan."}
              </p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onChange(item.name);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                    value === item.name && "bg-accent/50"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      value === item.name ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  {item.name}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
