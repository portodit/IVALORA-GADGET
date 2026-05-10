import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Loader2,
  Plus,
  Pencil,
  Tag,
  Trash2,
  GripVertical,
  AlertTriangle,
  Package,
  BookOpen,
} from "lucide-react";

export interface WarrantyLabel {
  id: string;
  key: string;
  label: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Schema ─────────────────────────────────────────────────────────────────
const schema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "Key minimal 2 karakter")
    .max(60, "Key maksimal 60 karakter")
    .regex(/^[a-z0-9_]+$/, "Key hanya boleh huruf kecil, angka, dan underscore"),
  label: z.string().trim().min(2, "Label wajib diisi").max(100, "Label maksimal 100 karakter"),
  description: z.string().trim().max(255, "Deskripsi maksimal 255 karakter").optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Sub-component: AddEditForm ─────────────────────────────────────────────
function AddEditForm({
  editItem,
  existingKeys,
  existingLabels,
  onSuccess,
  onCancel,
}: {
  editItem: WarrantyLabel | null;
  existingKeys: string[];
  existingLabels: { key: string; label: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const isEdit = !!editItem;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      key: editItem?.key ?? "",
      label: editItem?.label ?? "",
      description: editItem?.description ?? "",
    },
  });

  useEffect(() => {
    reset({
      key: editItem?.key ?? "",
      label: editItem?.label ?? "",
      description: editItem?.description ?? "",
    });
    setDuplicateError(null);
  }, [editItem, reset]);

  const onSubmit = async (data: FormData) => {
    setDuplicateError(null);

    if (!isEdit && existingKeys.includes(data.key)) {
      setDuplicateError(`Key "${data.key}" sudah digunakan. Gunakan key yang berbeda.`);
      return;
    }

    const labelLower = data.label.toLowerCase();
    const duplicateLabel = existingLabels.find(
      (l) => l.label.toLowerCase() === labelLower && l.key !== (editItem?.key ?? "")
    );
    if (duplicateLabel) {
      setDuplicateError(`Label "${data.label}" sudah ada (key: ${duplicateLabel.key}).`);
      return;
    }

    try {
      if (isEdit && editItem) {
        const { error } = await supabase
          .from("warranty_labels")
          .update({ label: data.label, description: data.description || null })
          .eq("id", editItem.id);
        if (error) throw error;
        toast({ title: "Tipe berhasil diperbarui" });
      } else {
        const { error } = await supabase.from("warranty_labels").insert({
          key: data.key,
          label: data.label,
          description: data.description || null,
          sort_order: existingKeys.length + 1,
        });
        if (error) {
          if (error.code === "23505") {
            setDuplicateError(`Key "${data.key}" sudah digunakan.`);
            return;
          }
          throw error;
        }
        toast({ title: "Tipe berhasil ditambahkan" });
      }
      onSuccess();
    } catch (err: unknown) {
      toast({
        title: "Gagal menyimpan",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 p-3 sm:p-4 rounded-xl border border-border bg-muted/30">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {isEdit ? "Edit Tipe" : "Tambah Tipe Baru"}
      </p>

      {duplicateError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{duplicateError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Key (ID Sistem)
          </Label>
          <Input
            placeholder="Contoh: resmi_bc"
            {...register("key")}
            readOnly={isEdit}
            className={isEdit ? "bg-muted text-muted-foreground" : ""}
          />
          {errors.key && <p className="text-xs text-destructive">{errors.key.message}</p>}
          {!isEdit && (
            <p className="text-[10px] text-muted-foreground">Huruf kecil, angka, underscore saja.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nama Label
          </Label>
          <Input placeholder="Contoh: Resmi iBox Indonesia" {...register("label")} />
          {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Deskripsi <span className="normal-case font-normal">(Opsional)</span>
        </Label>
        <Textarea
          placeholder="Masukkan deskripsi singkat tipe ini"
          rows={2}
          className="resize-none"
          {...register("description")}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Batal
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEdit ? "Simpan Perubahan" : "Tambah Tipe"}
        </Button>
      </div>
    </form>
  );
}

// ── Delete confirmation info ───────────────────────────────────────────────
interface DeleteInfo {
  item: WarrantyLabel;
  masterCount: number;
  stockCount: number;
  catalogCount: number;
  loading: boolean;
}

// ── Main modal ─────────────────────────────────────────────────────────────
export function WarrantyLabelModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const [labels, setLabels] = useState<WarrantyLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<WarrantyLabel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null);

  const fetchLabels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("warranty_labels")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (!error) setLabels((data as WarrantyLabel[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchLabels();
  }, [open]);

  // Open delete confirmation and fetch dependency info
  const handleDeleteClick = async (item: WarrantyLabel) => {
    setDeleteInfo({ item, masterCount: 0, stockCount: 0, catalogCount: 0, loading: true });

    // Fetch master products using this warranty_type key
    const { count: masterCount } = await supabase
      .from("master_products")
      .select("id", { count: "exact", head: true })
      .eq("warranty_type", item.key as any)
      .is("deleted_at", null);

    // Fetch stock units linked to master products with this warranty_type
    // First get the product IDs
    const { data: masterIds } = await supabase
      .from("master_products")
      .select("id")
      .eq("warranty_type", item.key as any)
      .is("deleted_at", null);

    let stockCount = 0;
    let catalogCount = 0;

    if (masterIds && masterIds.length > 0) {
      const ids = masterIds.map((m) => m.id);
      const [stockRes, catalogRes] = await Promise.all([
        supabase.from("stock_units").select("id", { count: "exact", head: true }).in("product_id", ids),
        supabase.from("catalog_products").select("id", { count: "exact", head: true }).in("product_id", ids),
      ]);
      stockCount = stockRes.count ?? 0;
      catalogCount = catalogRes.count ?? 0;
    }

    setDeleteInfo({
      item,
      masterCount: masterCount ?? 0,
      stockCount,
      catalogCount,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteInfo) return;
    setDeletingId(deleteInfo.item.id);
    try {
      const { error } = await supabase
        .from("warranty_labels")
        .delete()
        .eq("id", deleteInfo.item.id);
      if (error) throw error;
      toast({ title: `Tipe "${deleteInfo.item.label}" berhasil dihapus` });
      setDeleteInfo(null);
      fetchLabels();
    } catch (err: unknown) {
      toast({
        title: "Gagal menghapus",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditItem(null);
    fetchLabels();
  };

  const handleEdit = (item: WarrantyLabel) => {
    setEditItem(item);
    setShowForm(true);
  };

  const existingKeys = labels.map((l) => l.key);
  const existingLabelsForValidation = labels.map((l) => ({ key: l.key, label: l.label }));

  const hasRelations = deleteInfo && !deleteInfo.loading && (deleteInfo.masterCount > 0 || deleteInfo.stockCount > 0 || deleteInfo.catalogCount > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-xl w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[85vh] flex flex-col overflow-hidden rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Tag className="w-4 h-4" />
              Kelola Tipe
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tambah atau kelola tipe yang tersedia untuk produk.
            </DialogDescription>
          </DialogHeader>

          {/* Add form toggle */}
          {!showForm ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 self-start shrink-0"
              onClick={() => { setEditItem(null); setShowForm(true); }}
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Tipe Baru
            </Button>
          ) : (
            <AddEditForm
              editItem={editItem}
              existingKeys={existingKeys}
              existingLabels={existingLabelsForValidation}
              onSuccess={handleFormSuccess}
              onCancel={() => { setShowForm(false); setEditItem(null); }}
            />
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="flex-1 h-4" />
                  <Skeleton className="w-16 h-5 rounded-full" />
                  <Skeleton className="w-8 h-8 rounded" />
                </div>
              ))
            ) : labels.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Tag className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="text-sm">Belum ada tipe</p>
              </div>
            ) : (
              labels.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 sm:gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5 hidden sm:block" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-sm font-medium">{item.label}</span>
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                        {item.key}
                      </code>
                      <Badge
                        variant={item.is_active ? "default" : "secondary"}
                        className="text-[10px] h-4 px-1.5"
                      >
                        {item.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 sm:w-7 sm:h-7"
                      title="Edit"
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 sm:w-7 sm:h-7 text-destructive hover:text-destructive"
                      title="Hapus"
                      disabled={deletingId === item.id}
                      onClick={() => handleDeleteClick(item)}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 sm:w-3 sm:h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-border shrink-0">
            <Button variant="outline" size="sm" onClick={onClose}>
              Selesai
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteInfo} onOpenChange={(v) => !v && setDeleteInfo(null)}>
        <AlertDialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Hapus Tipe "{deleteInfo?.item.label}"?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteInfo?.loading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Memeriksa data terkait...</span>
                  </div>
                ) : deleteInfo ? (
                  <>
                    {hasRelations ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 space-y-2">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          Tipe ini sedang digunakan
                        </p>
                        <div className="space-y-1.5 text-sm">
                          {deleteInfo.masterCount > 0 && (
                            <div className="flex items-center gap-2 text-foreground">
                              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span><strong>{deleteInfo.masterCount}</strong> master produk (SKU)</span>
                            </div>
                          )}
                          {deleteInfo.stockCount > 0 && (
                            <div className="flex items-center gap-2 text-foreground">
                              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span><strong>{deleteInfo.stockCount}</strong> unit stok IMEI</span>
                            </div>
                          )}
                          {deleteInfo.catalogCount > 0 && (
                            <div className="flex items-center gap-2 text-foreground">
                              <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span><strong>{deleteInfo.catalogCount}</strong> katalog produk</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                          Menghapus tipe ini <strong>tidak akan menghapus</strong> data SKU, stok, atau katalog.
                          Label tipe pada data terkait akan ditampilkan sebagai <strong>"Belum diatur"</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          Tipe ini tidak digunakan oleh data manapun. Aman untuk dihapus.
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Tindakan ini tidak dapat dibatalkan.
                    </p>
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteInfo?.loading || deletingId !== null}
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Hapus Tipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
