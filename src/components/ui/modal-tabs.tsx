import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: ReactNode;
}

interface ModalTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function ModalTabs({ tabs, active, onChange, className }: ModalTabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border",
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150",
            active === tab.key
              ? "bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900"
              : "text-muted-foreground hover:text-foreground hover:bg-background/60",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface PageTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function PageTabs({ tabs, active, onChange, className }: PageTabsProps) {
  return (
    <div className={cn("flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/40", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all",
            active === tab.key
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
