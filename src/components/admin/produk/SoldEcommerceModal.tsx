import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ShoppingBag, Check } from "lucide-react";
import type { StockUnit, SoldChannel } from "@/lib/admin/produk/stock-units";
import { cn } from "@/lib/utils";

interface SoldEcommerceModalProps {
  unit: StockUnit | null;
  open: boolean;
  /** Dipanggil saat batal — EditUnitModal akan revert status ke semula */
  onClose: () => void;
  /** Dipanggil setelah berhasil save — tutup semua modal */
  onSuccess: () => void;
  /** Data update lain dari EditUnitModal (SKU, cabang, kondisi, dll) yang akan disave bersamaan */
  baseUpdateData: Record<string, unknown>;
}

const ECOMMERCE_OPTIONS: { value: SoldChannel; label: string; color: string }[] = [
  { value: "ecommerce_tokopedia", label: "Tokopedia", color: "bg-green-500" },
  { value: "ecommerce_shopee", label: "Shopee", color: "bg-orange-500" },
];

export function SoldEcommerceModal({
  unit,
  open,
  onClose,
  onSuccess,
  baseUpdateData,
}: SoldEcommerceModalProps) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<SoldChannel>("ecommerce_tokopedia");
  const [referenceId, setReferenceId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!unit) return;
    setSaving(true);
    const { error } = await supabase
      .from("stock_units")
      .update({
        ...baseUpdateData,
        sold_channel: channel,
        sold_reference_id: referenceId.trim() || null,
        sold_at: new Date().toISOString(),
      } as never)
      .eq("id", unit.id);
    setSaving(false);

    if (error) {
      toast({ title: "Gagal mencatat penjualan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Unit berhasil ditandai terjual via Ecommerce" });
    setReferenceId("");
    setChannel("ecommerce_tokopedia");
    onSuccess();
  }

  function handleClose() {
    setReferenceId("");
    setChannel("ecommerce_tokopedia");
    onClose();
  }

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-sm p-0">
        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Terjual via Ecommerce
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Proses cepat untuk menandai unit terjual di platform luar.
            </p>
          </DialogHeader>

          {/* Platform Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">Platform</label>
            <div className="flex gap-2">
              {ECOMMERCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border-2 transition-all font-semibold text-sm",
                    channel === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-300 dark:border-zinc-600 bg-muted/20 text-muted-foreground hover:border-gray-400 dark:hover:border-zinc-400"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", channel === opt.value ? opt.color : "bg-muted-foreground/30")} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nomor Order */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">
              Nomor Order / Referensi
            </label>
            <Input
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="Contoh: INV-2024-..."
              className="h-11 bg-muted/30 border-gray-300 dark:border-zinc-600 focus:bg-background rounded-xl font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={saving}
            className="h-11 flex-1 rounded-xl font-semibold"
          >
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="h-11 flex-1 rounded-xl font-bold gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Konfirmasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
