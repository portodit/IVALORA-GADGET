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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import {
  CATEGORY_LABELS,
  STORAGE_OPTIONS,
  WATCH_SIZE_OPTIONS,
  FIXED_RESMI_CATEGORIES,
  HAS_STORAGE_CATEGORIES,
  HAS_COLOR_CATEGORIES,
  HAS_SIZE_CATEGORIES,
  MasterProduct,
  ProductCategory,
  WarrantyType,
  WARRANTY_LABELS,
} from "@/lib/admin/produk/master-products";
import type { WarrantyLabel } from "@/components/admin/produk/WarrantyLabelModal";

const schema = z.object({
  category: z.enum(["iphone", "ipad", "accessory", "macbook", "watch", "airpods"] as const),
  series: z.string().trim().min(1, "Seri wajib diisi").max(100),
  storage_gb: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  color: z.string().trim().max(50).optional().nullable(),
  size_mm: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  warranty_type: z.string().optional().nullable(),
  hasStorage: z.boolean().optional(),
  hasColor: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProduct?: MasterProduct | null;
  isUsedInStock?: boolean;
  warrantyLabels?: WarrantyLabel[];
}

export function ProductFormModal({ open, onClose, onSuccess, editProduct, isUsedInStock, warrantyLabels = [] }: Props) {
  const { toast } = useToast();
  const [duplicateError, setDuplicateError] = useState(false);
  const isEdit = !!editProduct;
  const coreFieldsReadOnly = isEdit && isUsedInStock;

  const activeWarrantyLabels = warrantyLabels.filter((w) => w.is_active);
  const hasWarrantyOptions = activeWarrantyLabels.length > 0;
  const warrantyOptions = hasWarrantyOptions
    ? activeWarrantyLabels
    : Object.entries(WARRANTY_LABELS)
        .filter(([key]) => key !== "resmi_bc" && key !== "ibox" && key !== "inter" && key !== "whitelist" && key !== "digimap")
        .concat(Object.entries(WARRANTY_LABELS).filter(([key]) => ["resmi_bc", "ibox", "inter", "whitelist", "digimap"].includes(key)))
        .map(([key, label], idx) => ({
          id: key,
          key,
          label,
          description: null,
          is_active: true,
          sort_order: idx,
          created_at: "",
          updated_at: "",
        }));

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "iphone",
      series: "",
      storage_gb: 128,
      color: "",
      size_mm: null,
      warranty_type: "resmi_bc",
      hasStorage: false,
      hasColor: false,
    },
  });

  useEffect(() => {
    if (editProduct && open) {
      reset({
        category: editProduct.category,
        series: editProduct.series,
        storage_gb: editProduct.storage_gb,
        color: editProduct.color ?? "",
        size_mm: editProduct.size_mm,
        warranty_type: editProduct.warranty_type ?? "",
        hasStorage: editProduct.storage_gb !== null,
        hasColor: editProduct.color !== null && editProduct.color !== "",
      });
    } else if (!open) {
      reset({
        category: "iphone",
        series: "",
        storage_gb: 128,
        color: "",
        size_mm: null,
        warranty_type: "resmi_bc",
        hasStorage: false,
        hasColor: false,
      });
      setDuplicateError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editProduct, open, reset]);

  const watchedCategory = watch("category") as ProductCategory;
  const watchedStorage = watch("storage_gb");
  const watchedWarranty = watch("warranty_type");
  const watchedSize = watch("size_mm");
  const hasStorage = watch("hasStorage");
  const hasColor = watch("hasColor");

  const isFixedResmi = FIXED_RESMI_CATEGORIES.includes(watchedCategory);
  const showStorage = HAS_STORAGE_CATEGORIES.includes(watchedCategory);
  const showColor = HAS_COLOR_CATEGORIES.includes(watchedCategory);
  const showSize = HAS_SIZE_CATEGORIES.includes(watchedCategory);
  const isAccessory = watchedCategory === "accessory";

  // Auto-set warranty to "resmi" for fixed-resmi categories
  useEffect(() => {
    if (isFixedResmi && !coreFieldsReadOnly) {
      setValue("warranty_type", "resmi");
    } else if (!isFixedResmi && !coreFieldsReadOnly && (watchedWarranty === "resmi")) {
      setValue("warranty_type", "resmi_bc");
    }
  }, [watchedCategory, isFixedResmi, coreFieldsReadOnly, setValue]);

  const onSubmit = async (data: FormData) => {
    setDuplicateError(false);
    try {
      // Build the actual values based on category
      const category = data.category as ProductCategory;
      
      let storage_gb: number | null = null;
      let color: string | null = null;
      let size_mm: number | null = null;
      let warranty_type: string | null = null;

      if (HAS_STORAGE_CATEGORIES.includes(category)) {
        storage_gb = data.storage_gb ?? null;
      } else if (isAccessory && data.hasStorage) {
        storage_gb = data.storage_gb ?? null;
      }

      if (HAS_COLOR_CATEGORIES.includes(category)) {
        color = data.color?.trim() || null;
      } else if (isAccessory && data.hasColor) {
        color = data.color?.trim() || null;
      }

      if (HAS_SIZE_CATEGORIES.includes(category)) {
        size_mm = data.size_mm ?? null;
      }

      if (FIXED_RESMI_CATEGORIES.includes(category)) {
        warranty_type = "resmi";
      } else if (!isAccessory) {
        warranty_type = data.warranty_type || null;
      }
      // Accessories: no warranty

      if (isEdit && editProduct) {
        const updatePayload: Record<string, unknown> = {};
        if (!coreFieldsReadOnly) {
          updatePayload.category = category;
          updatePayload.series = data.series;
          updatePayload.storage_gb = storage_gb;
          updatePayload.color = color;
          updatePayload.size_mm = size_mm;
          updatePayload.warranty_type = warranty_type;
        }
        const { error } = await supabase
          .from("master_products")
          .update(updatePayload)
          .eq("id", editProduct.id);
        if (error) throw error;
        toast({ title: "Produk berhasil diperbarui" });
      } else {
        const insertPayload = {
          category: category as any,
          series: data.series,
          storage_gb,
          color,
          size_mm,
          warranty_type: warranty_type as any,
        };
        const { error } = await supabase.from("master_products").insert(insertPayload);
        if (error) {
          if (error.code === "23505") {
            setDuplicateError(true);
            return;
          }
          throw error;
        }
        toast({ title: "Produk berhasil ditambahkan" });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast({ title: "Gagal menyimpan", description: msg, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full mx-auto max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isEdit ? "Edit Master Produk" : "Tambah Master Produk"}
          </DialogTitle>
        </DialogHeader>

        {coreFieldsReadOnly && (
          <Alert className="border-border bg-muted">
            <AlertCircle className="h-4 w-4 text-foreground/60" />
            <AlertDescription className="text-muted-foreground text-xs">
              SKU ini sudah digunakan di stok. Atribut inti tidak dapat diubah untuk menjaga integritas histori.
            </AlertDescription>
          </Alert>
        )}

        {duplicateError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Kombinasi SKU ini sudah terdaftar. Setiap kombinasi Kategori + Seri + Storage + Warna + Ukuran + Tipe harus unik.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Kategori</Label>
            {coreFieldsReadOnly ? (
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm">
                {CATEGORY_LABELS[editProduct!.category]}
              </div>
            ) : (
              <Select value={watchedCategory} onValueChange={(v) => setValue("category", v as ProductCategory)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>

          {/* Series */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {isAccessory ? "Nama Produk / Seri" : "Seri / Model"}
            </Label>
            <Input
              placeholder={
                isAccessory ? "Contoh: Charger Apple 20W USB-C" :
                watchedCategory === "macbook" ? "Contoh: MacBook Pro M3 14\"" :
                watchedCategory === "ipad" ? "Contoh: iPad Air 5" :
                watchedCategory === "watch" ? "Contoh: Apple Watch SE 2nd Gen" :
                watchedCategory === "airpods" ? "Contoh: AirPods Pro 2nd Gen" :
                "Contoh: iPhone 15 Pro Max"
              }
              {...register("series")}
              readOnly={coreFieldsReadOnly}
              className={coreFieldsReadOnly ? "bg-muted" : ""}
            />
            {errors.series && <p className="text-xs text-destructive">{errors.series.message}</p>}
          </div>

          {/* Storage — only for iPhone/iPad/MacBook, or accessory with checkbox */}
          {showStorage && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Storage</Label>
              {coreFieldsReadOnly ? (
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm">
                  {editProduct!.storage_gb ? (editProduct!.storage_gb >= 1024 ? `${editProduct!.storage_gb / 1024} TB` : `${editProduct!.storage_gb} GB`) : "—"}
                </div>
              ) : (
                <Select value={String(watchedStorage ?? 128)} onValueChange={(v) => setValue("storage_gb", parseInt(v))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STORAGE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s >= 1024 ? `${s / 1024} TB` : `${s} GB`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.storage_gb && <p className="text-xs text-destructive">{errors.storage_gb.message}</p>}
            </div>
          )}

          {/* Accessory: optional Storage via checkbox */}
          {isAccessory && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!hasStorage}
                  onChange={(e) => {
                    setValue("hasStorage", e.target.checked);
                    if (!e.target.checked) setValue("storage_gb", null);
                  }}
                  className="w-4 h-4 rounded border-border accent-foreground"
                />
                <span className="text-sm text-foreground group-hover:text-foreground/80">Produk ini memiliki variasi Storage</span>
              </label>
              {hasStorage && (
                <Select value={String(watchedStorage ?? 128)} onValueChange={(v) => setValue("storage_gb", parseInt(v))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STORAGE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s >= 1024 ? `${s / 1024} TB` : `${s} GB`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Size (Apple Watch only) */}
          {showSize && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ukuran Case</Label>
              {coreFieldsReadOnly ? (
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm">
                  {editProduct!.size_mm ? `${editProduct!.size_mm}mm` : "—"}
                </div>
              ) : (
                <Select value={String(watchedSize ?? "")} onValueChange={(v) => setValue("size_mm", parseInt(v))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih ukuran" />
                  </SelectTrigger>
                  <SelectContent>
                    {WATCH_SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}mm</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.size_mm && <p className="text-xs text-destructive">{errors.size_mm.message}</p>}
            </div>
          )}

          {/* Color — for iPhone/iPad/MacBook/Watch, or accessory with checkbox */}
          {showColor && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Warna</Label>
              <Input
                placeholder={watchedCategory === "watch" ? "Contoh: Starlight, Midnight" : "Contoh: Desert Titanium, Natural Titanium"}
                {...register("color")}
                readOnly={coreFieldsReadOnly}
                className={coreFieldsReadOnly ? "bg-muted" : ""}
              />
              {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
            </div>
          )}

          {/* Accessory: optional Color via checkbox */}
          {isAccessory && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!hasColor}
                  onChange={(e) => {
                    setValue("hasColor", e.target.checked);
                    if (!e.target.checked) setValue("color", null);
                  }}
                  className="w-4 h-4 rounded border-border accent-foreground"
                />
                <span className="text-sm text-foreground group-hover:text-foreground/80">Produk ini memiliki variasi Warna</span>
              </label>
              {hasColor && (
                <Input
                  placeholder="Contoh: Putih, Hitam"
                  {...register("color")}
                  className=""
                />
              )}
            </div>
          )}

          {/* Warranty / Tipe */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tipe Garansi</Label>
            {isAccessory ? (
              <div className="h-10 flex items-center gap-2 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Tidak berlaku untuk aksesoris
              </div>
            ) : coreFieldsReadOnly ? (
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm">
                {warrantyOptions.find((w) => w.key === editProduct!.warranty_type)?.label ?? WARRANTY_LABELS[editProduct!.warranty_type as WarrantyType] ?? editProduct!.warranty_type ?? "—"}
              </div>
            ) : isFixedResmi ? (
              <div className="h-10 flex items-center gap-2 px-3 rounded-md border bg-muted text-sm">
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium">Resmi</span>
                <span className="text-xs text-muted-foreground ml-auto">tidak bisa diubah</span>
              </div>
            ) : (
              <Select value={watchedWarranty || undefined} onValueChange={(v) => setValue("warranty_type", v as WarrantyType)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  {warrantyOptions
                    .filter((w) => w.key !== "resmi")
                    .map((w) => (
                      <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {errors.warranty_type && <p className="text-xs text-destructive">{errors.warranty_type.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? "Simpan Perubahan" : "Tambah Produk"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
