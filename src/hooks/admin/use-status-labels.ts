import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StatusLabel } from "@/lib/admin/produk/stock-units";

export function useStatusLabels() {
  const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("stock_status_labels")
      .select("*")
      .order("sort_order");
    setStatusLabels((data as StatusLabel[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { statusLabels, loading, refetch: fetch };
}
