import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// This page now redirects to FakturDetailPage if an invoice exists for this transaction
export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: inv } = await supabase
        .from("invoices" as never)
        .select("id")
        .eq("transaction_id", id)
        .limit(1)
        .maybeSingle() as { data: { id: string } | null };

      if (inv) {
        navigate(`/admin/penjualan/faktur/${inv.id}`, { replace: true });
      } else {
        // No invoice yet, go back to transaction detail
        navigate(`/admin/transaksi/${id}`, { replace: true });
      }
      setChecked(true);
    })();
  }, [id, navigate]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return null;
}
