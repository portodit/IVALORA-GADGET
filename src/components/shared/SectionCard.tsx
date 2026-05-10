import { cn } from "@/lib/utils";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  border?: boolean;
}

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function SectionCard({
  children,
  className,
  padding = "md",
  border = true,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card",
        border && "border border-border",
        PADDING[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
