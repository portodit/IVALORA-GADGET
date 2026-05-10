import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
} from "@/components/ui/table";

interface AdminDataTableProps {
  filterBarHeight: number;
  infoBar?: React.ReactNode;
  headerRow: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AdminDataTable({
  filterBarHeight,
  infoBar,
  headerRow,
  children,
  className,
}: AdminDataTableProps) {
  const infoBarRef = useRef<HTMLDivElement>(null);
  const [infoBarHeight, setInfoBarHeight] = useState(0);

  useEffect(() => {
    const el = infoBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInfoBarHeight(el.offsetHeight));
    ro.observe(el);
    setInfoBarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const tableHeaderTop = filterBarHeight + (infoBar ? infoBarHeight : 0) + 64;

  return (
    <div className={cn("rounded-xl border border-border bg-card [overflow:clip]", className)}>
      {infoBar && (
        <div
          ref={infoBarRef}
          className="flex items-center gap-1.5 text-xs text-muted-foreground px-4 py-2.5 border-b border-border flex-wrap bg-card"
          style={{ position: "sticky", top: filterBarHeight + 64, zIndex: 9 }}
        >
          {infoBar}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow
            className="border-b border-border bg-muted"
            style={{ position: "sticky", top: tableHeaderTop, zIndex: 10 }}
          >
            {headerRow}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}
