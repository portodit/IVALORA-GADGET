import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

/* ── Tab Variant Context ───────────────────────────────────────────────── */
type TabVariant = "default" | "underline" | "pill";

const TabVariantContext = React.createContext<TabVariant>("default");

/* ── Root ──────────────────────────────────────────────────────────────── */
const Tabs = TabsPrimitive.Root;

/* ── List ──────────────────────────────────────────────────────────────── */
interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabVariant;
}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const listClass = {
      default:   "inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      underline: "inline-flex items-center gap-1 border-b border-border w-full",
      pill:      "inline-flex items-center gap-1 rounded-full bg-muted p-1 text-muted-foreground",
    }[variant];

    return (
      <TabVariantContext.Provider value={variant}>
        <TabsPrimitive.List
          ref={ref}
          className={cn(listClass, className)}
          {...props}
        />
      </TabVariantContext.Provider>
    );
  },
);
TabsList.displayName = TabsPrimitive.List.displayName;

/* ── Trigger ───────────────────────────────────────────────────────────── */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabVariantContext);

  const triggerClass = {
    default: cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-muted-foreground/70",
      "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold data-[state=active]:border data-[state=active]:border-border",
    ),
    underline: cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-all border-b-2 border-transparent -mb-px",
      "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
      "text-muted-foreground hover:text-foreground hover:border-border",
      "data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold",
    ),
    pill: cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-muted-foreground hover:text-foreground",
      "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",
    ),
  }[variant];

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(triggerClass, className)}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/* ── Content ───────────────────────────────────────────────────────────── */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabVariant };
