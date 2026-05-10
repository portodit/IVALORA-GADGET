import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface AdminTabItem<T extends string = string> {
  key: T;
  label: string;
  icon: LucideIcon;
}

interface AdminTabGroupProps<T extends string> {
  tabs: AdminTabItem<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function AdminTabGroup<T extends string>({ tabs, active, onChange }: AdminTabGroupProps<T>) {
  return (
    <div className="flex items-center gap-1 border-2 border-zinc-300 rounded-xl p-1 w-fit bg-white">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
            active === tab.key
              ? "bg-zinc-900 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
          )}
        >
          <tab.icon className="w-4 h-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
