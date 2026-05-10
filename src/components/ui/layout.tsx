import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

/* ── Container ────────────────────────────────────────────────────────── */

type ContainerSize = "sm" | "md" | "lg" | "2xl" | "5xl" | "7xl";

const containerSizes: Record<ContainerSize, string> = {
  sm:   "max-w-sm",
  md:   "max-w-md",
  lg:   "max-w-lg",
  "2xl": "max-w-2xl",
  "5xl": "max-w-5xl",
  "7xl": "max-w-7xl",
};

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
}

export function Container({ size = "5xl", className, children, ...props }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 md:px-6", containerSizes[size], className)} {...props}>
      {children}
    </div>
  );
}

/* ── Stack (flex column) ──────────────────────────────────────────────── */

type GapSize = "0" | "1" | "1.5" | "2" | "3" | "4" | "6" | "8" | "16";

const gaps: Record<GapSize, string> = {
  "0":   "gap-0",
  "1":   "gap-1",
  "1.5": "gap-1.5",
  "2":   "gap-2",
  "3":   "gap-3",
  "4":   "gap-4",
  "6":   "gap-6",
  "8":   "gap-8",
  "16":  "gap-16",
};

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: GapSize;
}

export function Stack({ gap = "4", className, children, ...props }: StackProps) {
  return (
    <div className={cn("flex flex-col", gaps[gap], className)} {...props}>
      {children}
    </div>
  );
}

/* ── Row (flex row) ───────────────────────────────────────────────────── */

interface RowProps extends HTMLAttributes<HTMLDivElement> {
  gap?: GapSize;
  wrap?: boolean;
  align?: "start" | "center" | "end" | "baseline" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
}

const aligns: Record<NonNullable<RowProps["align"]>, string> = {
  start:    "items-start",
  center:   "items-center",
  end:      "items-end",
  baseline: "items-baseline",
  stretch:  "items-stretch",
};

const justifies: Record<NonNullable<RowProps["justify"]>, string> = {
  start:   "justify-start",
  center:  "justify-center",
  end:     "justify-end",
  between: "justify-between",
  around:  "justify-around",
};

export function Row({ gap = "2", wrap = false, align = "center", justify = "start", className, children, ...props }: RowProps) {
  return (
    <div
      className={cn(
        "flex",
        gaps[gap],
        wrap && "flex-wrap",
        aligns[align],
        justifies[justify],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── Grid ─────────────────────────────────────────────────────────────── */

type GridCols = "1" | "2" | "3" | "4";

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: GridCols;
  colsMd?: GridCols;
  colsLg?: GridCols;
  gap?: GapSize;
}

const colsMap: Record<GridCols, string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-2",
  "3": "grid-cols-3",
  "4": "grid-cols-4",
};

const colsMdMap: Record<GridCols, string> = {
  "1": "md:grid-cols-1",
  "2": "md:grid-cols-2",
  "3": "md:grid-cols-3",
  "4": "md:grid-cols-4",
};

const colsLgMap: Record<GridCols, string> = {
  "1": "lg:grid-cols-1",
  "2": "lg:grid-cols-2",
  "3": "lg:grid-cols-3",
  "4": "lg:grid-cols-4",
};

export function Grid({ cols = "1", colsMd, colsLg, gap = "4", className, children, ...props }: GridProps) {
  return (
    <div
      className={cn(
        "grid",
        colsMap[cols],
        colsMd && colsMdMap[colsMd],
        colsLg && colsLgMap[colsLg],
        gaps[gap],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── PageWrapper ──────────────────────────────────────────────────────── */

export function PageWrapper({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("min-h-screen bg-background", className)} {...props}>
      {children}
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────────────────── */

export function Section({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("py-8 md:py-12 lg:py-16", className)} {...props}>
      {children}
    </section>
  );
}

/* ── Divider ──────────────────────────────────────────────────────────── */

export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn("border-t border-border", className)} {...props} />;
}
