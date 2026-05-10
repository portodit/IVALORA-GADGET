import { useState } from "react";
import { X, Plus, Pencil, Trash2, GripVertical, Shield } from "lucide-react";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

const supabase = supabaseClient as any;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/shared/use-toast";
import type { StatusLabel } from "@/lib/admin/produk/stock-units";
import { getStatusStyles } from "@/lib/admin/produk/stock-units";

interface Props {
  open: boolean;
  onClose: () => void;
  statusLabels: StatusLabel[];
  onRefresh: () => void;
}

export function StatusLabelManager({ open, onClose, statusLabels, onRefresh }: Props) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editHue, setEditHue] = useState(200);
  const [editSat, setEditSat] = useState(60);
  const [editLight, setEditLight] = useState(50);
  const [saving, setSaving] = useState(false);

  // Add new
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newHue, setNewHue] = useState(200);
  const [newSat, setNewSat] = useState(60);
  const [newLight, setNewLight] = useState(50);

  if (!open) return null;

  const startEdit = (s: StatusLabel) => {
    setEditingId(s.id);
    setEditLabel(s.label);
    setEditKey(s.key);
    setEditHue(s.color_hue);
    setEditSat(s.color_saturation);
    setEditLight(s.color_lightness);
  };

  const handleSaveEdit = async (oldKey: string) => {
    if (!editLabel.trim()) return;
    if (isHueTooClose(editHue, editingId!)) {
      toast({ title: "Warna terlalu mirip", description: "Pilih warna yang berbeda dari label status lain.", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Update the label
    const { error } = await supabase
      .from("stock_status_labels")
      .update({ label: editLabel.trim(), color_hue: editHue, color_saturation: editSat, color_lightness: editLight } as never)
      .eq("id", editingId!);

    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // If key changed, update all stock_units with old key
    if (editKey.trim() && editKey.trim() !== oldKey) {
      const newKeyVal = editKey.trim().toLowerCase().replace(/\s+/g, "_");
      await supabase
        .from("stock_status_labels")
        .update({ key: newKeyVal } as never)
        .eq("id", editingId!);
      await supabase
        .from("stock_units")
        .update({ stock_status: newKeyVal } as never)
        .eq("stock_status", oldKey);
    }

    setSaving(false);
    setEditingId(null);
    toast({ title: "Label berhasil diperbarui" });
    onRefresh();
  };

  const handleDelete = async (s: StatusLabel) => {
    if (s.is_system) {
      toast({ title: "Tidak bisa dihapus", description: "Status sistem tidak dapat dihapus.", variant: "destructive" });
      return;
    }
    // Set all units with this status to null/empty
    await supabase
      .from("stock_units")
      .update({ stock_status: "available" } as never)
      .eq("stock_status", s.key);

    const { error } = await supabase
      .from("stock_status_labels")
      .delete()
      .eq("id", s.id);

    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Status "${s.label}" berhasil dihapus` });
    onRefresh();
  };

  // Check if a hue is too close to existing ones (within 15 degrees)
  const isHueTooClose = (hue: number, excludeId?: string) => {
    return statusLabels.some(s => {
      if (excludeId && s.id === excludeId) return false;
      const diff = Math.abs(s.color_hue - hue);
      const circularDiff = Math.min(diff, 360 - diff);
      return circularDiff < 15;
    });
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newLabel.trim()) {
      toast({ title: "Key dan label wajib diisi", variant: "destructive" });
      return;
    }
    if (isHueTooClose(newHue)) {
      toast({ title: "Warna terlalu mirip", description: "Pilih warna yang berbeda dari label status lain.", variant: "destructive" });
      return;
    }
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    setSaving(true);
    const maxSort = Math.max(...statusLabels.map(s => s.sort_order), 0);
    const { error } = await supabase
      .from("stock_status_labels")
      .insert({
        key,
        label: newLabel.trim(),
        color_hue: newHue,
        color_saturation: newSat,
        color_lightness: newLight,
        sort_order: maxSort + 1,
        is_system: false,
      } as never);

    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Key sudah ada", description: "Gunakan key yang berbeda.", variant: "destructive" });
      } else {
        toast({ title: "Gagal menambahkan", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({ title: `Status "${newLabel.trim()}" berhasil ditambahkan` });
    setNewKey(""); setNewLabel(""); setShowAdd(false);
    setNewHue(200); setNewSat(60); setNewLight(50);
    onRefresh();
  };

  const previewColor = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Kelola Label Status</h2>
            <p className="text-xs text-muted-foreground">Tambah, ubah, atau hapus label status stok</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {statusLabels.map((s) => {
            const styles = getStatusStyles(s);
            const isEditing = editingId === s.id;

            if (isEditing) {
              return (
                <div key={s.id} className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Key (internal)</Label>
                      <Input value={editKey} onChange={(e) => setEditKey(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Label (tampilan)</Label>
                      <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Warna (Hue: {editHue}°)</Label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={360} value={editHue} onChange={(e) => setEditHue(Number(e.target.value))} className="flex-1 h-2 accent-primary" />
                      <div className="w-6 h-6 rounded-full border border-border shrink-0" style={{ backgroundColor: previewColor(editHue, editSat, editLight) }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setEditingId(null)}>Batal</Button>
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleSaveEdit(s.key)} disabled={saving}>
                      {saving ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border hover:bg-accent/30 transition-colors group">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: styles.dot }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.key}</p>
                </div>
                {s.is_system && (
                  <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(s)} className="p-1 rounded hover:bg-accent transition-colors">
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </button>
                  {!s.is_system && (
                    <button onClick={() => handleDelete(s)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          {showAdd ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Key (internal)</Label>
                  <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="repair" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Label (tampilan)</Label>
                  <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Repair" className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Warna (Hue: {newHue}°)</Label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={360} value={newHue} onChange={(e) => setNewHue(Number(e.target.value))} className="flex-1 h-2 accent-primary" />
                  <div className="w-6 h-6 rounded-full border border-border shrink-0" style={{ backgroundColor: previewColor(newHue, newSat, newLight) }} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowAdd(false)}>Batal</Button>
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAdd} disabled={saving}>
                  {saving ? "Menambahkan..." : "Tambah"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="w-3 h-3" /> Tambah Status Baru
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
