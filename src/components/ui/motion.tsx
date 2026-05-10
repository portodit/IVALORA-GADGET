import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

/* ── Entrance Animations ──────────────────────────────────────────────── */

export function FadeIn({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ds-fade-in", className)} {...props}>{children}</div>;
}

export function SlideUp({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ds-slide-up", className)} {...props}>{children}</div>;
}

export function SlideDown({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ds-slide-down", className)} {...props}>{children}</div>;
}

export function ScaleIn({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ds-scale-in", className)} {...props}>{children}</div>;
}

/* ── Interaction ──────────────────────────────────────────────────────── */

export function HoverLift({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ds-hover-lift", className)} {...props}>{children}</div>;
}

export function Press({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ds-press", className)} {...props}>{children}</div>;
}
