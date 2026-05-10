import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

type TextProps<T extends keyof JSX.IntrinsicElements> = {
  as?: T;
  className?: string;
  children: React.ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "as">;

/* ── Display ──────────────────────────────────────────────────────────── */

export function DisplayXl({ as: Tag = "h1", className, children, ...props }: TextProps<"h1" | "h2" | "p" | "span">) {
  return <Tag className={cn("ds-display-xl", className)} {...props}>{children}</Tag>;
}

export function DisplayLg({ as: Tag = "h2", className, children, ...props }: TextProps<"h1" | "h2" | "p" | "span">) {
  return <Tag className={cn("ds-display-lg", className)} {...props}>{children}</Tag>;
}

/* ── Headings ─────────────────────────────────────────────────────────── */

export function H1({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("ds-h1", className)} {...props}>{children}</h1>;
}

export function H2({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("ds-h2", className)} {...props}>{children}</h2>;
}

export function H3({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("ds-h3", className)} {...props}>{children}</h3>;
}

export function H4({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h4 className={cn("ds-h4", className)} {...props}>{children}</h4>;
}

export function H5({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("ds-h5", className)} {...props}>{children}</h5>;
}

export function H6({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h6 className={cn("ds-h6", className)} {...props}>{children}</h6>;
}

/* ── Body & Paragraph ─────────────────────────────────────────────────── */

export function Lead({ as: Tag = "p", className, children, ...props }: TextProps<"p" | "span">) {
  return <Tag className={cn("ds-lead", className)} {...props}>{children}</Tag>;
}

export function BodyLg({ as: Tag = "p", className, children, ...props }: TextProps<"p" | "span" | "div">) {
  return <Tag className={cn("ds-body-lg", className)} {...props}>{children}</Tag>;
}

export function BodyMd({ as: Tag = "p", className, children, ...props }: TextProps<"p" | "span" | "div">) {
  return <Tag className={cn("ds-body-md", className)} {...props}>{children}</Tag>;
}

export function BodySm({ as: Tag = "p", className, children, ...props }: TextProps<"p" | "span" | "div">) {
  return <Tag className={cn("ds-body-sm", className)} {...props}>{children}</Tag>;
}

export function Paragraph({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ds-paragraph", className)} {...props}>{children}</p>;
}

/* ── Label, Caption, Micro ────────────────────────────────────────────── */

export function Caption({ as: Tag = "p", className, children, ...props }: TextProps<"p" | "span" | "time">) {
  return <Tag className={cn("ds-caption", className)} {...props}>{children}</Tag>;
}

export function Label({ as: Tag = "p", className, children, ...props }: TextProps<"p" | "span" | "label"> & { htmlFor?: string }) {
  return <Tag className={cn("ds-label", className)} {...props}>{children}</Tag>;
}

export function Micro({ as: Tag = "span", className, children, ...props }: TextProps<"p" | "span">) {
  return <Tag className={cn("ds-micro", className)} {...props}>{children}</Tag>;
}
