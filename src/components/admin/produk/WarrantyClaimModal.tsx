import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useToast } from "@/hooks/shared/use-toast";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from "@/components/ui/drawer";
import { Loader2, ShieldCheck, RefreshCw, Banknote, Package, Wrench, Search, Plus, X } from "lucide-react";
import type { StockUnit } from "@/lib/admin/produk/stock-units";
import { getTrackingType, getUnitIdentifier } from "@/lib/admin/produk/stock-units";
import type { ProductCategory } from "@/lib/admin/produk/master-products";

interface ServiceVendor {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

interface WarrantyClaimModalProps {
  unit: StockUnit | null;
  claimType: "unit_warranty" | "imei_warranty";
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function WarrantyClaimModal({ unit, claimType, open, onClose, onSuccess }: WarrantyClaimModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split("T")[0]);
  const [resolutionType, setResolutionType] = useState<"repair" | "refund" | "replace_unit">(
    claimType === "unit_warranty" ? "repair" : "refund"
  );
  const [replacementIdentifier, setReplacementIdentifier] = useState("");
  const [replacementUnit, setReplacementUnit] = useState<StockUnit | null>(null);
  const [searchingReplacement, setSearchingReplacement] = useState(false);
  const [notes, setNotes] = useState("");

  // Service vendor
  const [vendors, setVendors] = useState<ServiceVendor[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [selectedVendorName, setSelectedVendorName] = useState("");
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [addingVendor, setAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");

  useEffect(() => {
    if (open) {
      supabase.from("service_vendors").select("id, name, phone, address").eq("is_active", true).order("name")
        .then(({ data }) => setVendors((data as ServiceVendor[]) ?? []));
      setDescription("");
      setRepairCost("");
      setClaimDate(new Date().toISOString().split("T")[0]);
      setResolutionType(claimType === "unit_warranty" ? "repair" : "refund");
      setReplacementIdentifier("");
      setReplacementUnit(null);
      setNotes("");
      setSelectedVendorName("");
      setVendorSearch("");
      setShowVendorDropdown(false);
      setAddingVendor(false);
      setNewVendorName("");
      setNewVendorPhone("");
    }
  }, [open, claimType]);

  const filteredVendors = vendors.filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()));

  const handleAddVendor = async () => {
    if (!newVendorName.trim()) return;
    const { data, error } = await supabase.from("service_vendors")
      .insert({ name: newVendorName.trim(), phone: newVendorPhone.trim() || null } as never)
      .select("id, name, phone, address")
      .single();
    if (error) {
      toast({ title: "Gagal menambah vendor", description: error.message, variant: "destructive" });
      return;
    }
    const newVendor = data as ServiceVendor;
    setVendors(prev => [...prev, newVendor].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedVendorName(newVendor.name);
    setAddingVendor(false);
    setNewVendorName("");
    setNewVendorPhone("");
    setShowVendorDropdown(false);
    toast({ title: "Vendor berhasil ditambahkan" });
  };

  const handleSearchReplacementUnit = async (trackingType: string) => {
    const identifier = replacementIdentifier.trim();
    if (!identifier || (trackingType === "imei" && identifier.length < 14)) return;
    setSearchingReplacement(true);
    const col = trackingType === "serial_number" ? "serial_number" : "imei";
    const { data, error } = await supabase
      .from("stock_units")
      .select("*, master_products(series, storage_gb, color, warranty_type, category)")
      .eq(col as never, identifier)
      .eq("stock_status", "available")
      .single();
    setSearchingReplacement(false);
    if (error || !data) {
      const label = trackingType === "serial_number" ? "Serial Number" : "IMEI";
      toast({ title: "Unit tidak ditemukan", description: `Pastikan ${label} benar dan unit berstatus 'Tersedia'`, variant: "destructive" });
      setReplacementUnit(null);
      return;
    }
    setReplacementUnit(data as unknown as StockUnit);
  };

  const handleSubmit = async () => {
    if (!unit) return;
    if (!description.trim()) {
      toast({ title: "Deskripsi kerusakan wajib diisi", variant: "destructive" });
      return;
    }
    if ((resolutionType === "repair" || resolutionType === "replace_unit") && !selectedVendorName.trim()) {
      toast({ title: "Pilih atau tambah vendor service", variant: "destructive" });
      return;
    }
    if (resolutionType === "replace_unit" && !replacementUnit) {
      toast({ title: "Pilih unit pengganti", variant: "destructive" });
      return;
    }

    setSaving(true);

    const claimData = {
      unit_id: unit.id,
      claim_type: claimType,
      description: description.trim(),
      repair_branch_id: null,
      repair_cost: repairCost ? parseFloat(repairCost.replace(/\D/g, "")) : 0,
      claim_date: claimDate,
      resolution_type: resolutionType,
      replacement_unit_id: replacementUnit?.id || null,
      is_imei_warranty_claimed: claimType === "imei_warranty",
      notes: notes.trim() || null,
      created_by: user?.id || null,
      claim_status: "pending",
      service_vendor_name: selectedVendorName.trim() || null,
    };

    const { error: claimError } = await supabase.from("warranty_claims").insert(claimData as never);
    if (claimError) {
      setSaving(false);
      toast({ title: "Gagal menyimpan klaim", description: claimError.message, variant: "destructive" });
      return;
    }

    if (resolutionType === "replace_unit" && replacementUnit) {
      await supabase.from("stock_units").update({ stock_status: "return" } as never).eq("id", unit.id);
      await supabase.from("stock_units").update({
        stock_status: "sold",
        sold_at: new Date().toISOString(),
        sold_channel: "pos",
        sold_reference_id: `WARRANTY_REPLACE_${unit.imei ?? unit.serial_number}`,
        notes: `Pengganti garansi ${claimType === "imei_warranty" ? "IMEI" : "Unit"} dari ${unit.imei ?? unit.serial_number}`,
      } as never).eq("id", replacementUnit.id);
    }

    setSaving(false);
    toast({ title: "Klaim garansi berhasil dicatat", description: "Status: Menunggu proses" });
    onSuccess();
    onClose();
  };

  if (!unit) return null;

  const isImeiClaim = claimType === "imei_warranty";
  const trackingType = getTrackingType((unit.master_products?.category ?? "smartphone") as ProductCategory);
  const isSerialTracked = trackingType === "serial_number";
  const unitIdentifier = getUnitIdentifier(unit);
  const identifierLabel = isSerialTracked ? "SN" : "IMEI";
  const replacementLabel = isSerialTracked ? "Serial Number" : "IMEI";

  const warrantyTitle = isImeiClaim
    ? "Klaim Garansi IMEI"
    : isSerialTracked
      ? "Klaim Garansi Serial Number"
      : "Klaim Garansi Unit";

  const warrantyDesc = isImeiClaim
    ? "Garansi seumur hidup (1x klaim: refund atau ganti unit)"
    : isSerialTracked
      ? "Garansi Serial Number (perbaikan atau tukar unit)"
      : "Garansi 1 bulan (perbaikan atau tukar unit)";

  const formContent = (
    <div className="space-y-4 py-2">
      {/* Unit Info */}
      <div className="rounded-lg bg-accent/50 p-3">
        <p className="text-xs text-muted-foreground">Unit</p>
        <p className="text-sm font-semibold">{unit.master_products?.series}{unit.master_products?.storage_gb ? ` ${unit.master_products.storage_gb}GB` : ""} {unit.master_products?.color}</p>
        <p className="text-sm font-mono text-muted-foreground">{identifierLabel}: {unitIdentifier}</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Tanggal Klaim</Label>
        <Input type="date" value={claimDate} onChange={e => setClaimDate(e.target.value)} className="h-10" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Deskripsi Kerusakan <span className="text-destructive">*</span></Label>
        <Textarea 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          placeholder="Jelaskan kerusakan yang dialami..."
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Jenis Resolusi</Label>
        <RadioGroup value={resolutionType} onValueChange={v => setResolutionType(v as typeof resolutionType)}>
          {!isImeiClaim && (
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="repair" id="repair" />
              <Label htmlFor="repair" className="text-sm flex items-center gap-1.5 cursor-pointer">
                <Wrench className="w-4 h-4" /> Perbaikan
              </Label>
            </div>
          )}
          {isImeiClaim && (
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="refund" id="refund" />
              <Label htmlFor="refund" className="text-sm flex items-center gap-1.5 cursor-pointer">
                <Banknote className="w-4 h-4" /> Refund Uang
              </Label>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="replace_unit" id="replace" />
            <Label htmlFor="replace" className="text-sm flex items-center gap-1.5 cursor-pointer">
              <RefreshCw className="w-4 h-4" /> Ganti Unit
            </Label>
          </div>
        </RadioGroup>
      </div>

      {resolutionType === "replace_unit" && (
        <div className="space-y-2 p-3 rounded-lg border border-dashed border-border bg-muted/30">
          <Label className="text-sm font-medium">Unit Pengganti</Label>
          <div className="flex gap-2">
            <Input 
              value={replacementIdentifier}
              onChange={e => setReplacementIdentifier(isSerialTracked ? e.target.value : e.target.value.replace(/\D/g, ""))}
              placeholder={`Masukkan ${replacementLabel} unit pengganti...`}
              className="h-10 font-mono flex-1"
              maxLength={isSerialTracked ? 30 : 17}
            />
            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              className="h-10" 
              onClick={() => handleSearchReplacementUnit(trackingType)}
              disabled={searchingReplacement || (trackingType === "imei" ? replacementIdentifier.length < 14 : replacementIdentifier.length < 4)}
            >
              {searchingReplacement ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cari"}
            </Button>
          </div>
          {replacementUnit && (
            <div className="flex items-center gap-2 mt-2 p-2.5 rounded bg-primary/5 border border-primary/20">
              <Package className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary truncate">
                  {replacementUnit.master_products?.series} {replacementUnit.master_products?.storage_gb}GB
                </p>
                <p className="text-xs text-muted-foreground">{replacementUnit.master_products?.color}</p>
              </div>
              <Badge variant="secondary" className="text-xs">Tersedia</Badge>
            </div>
          )}
        </div>
      )}

      {/* Service Vendor (instead of branch) */}
      {(resolutionType === "repair" || resolutionType === "replace_unit") && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Vendor Service <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            {selectedVendorName ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                <span className="flex-1 text-sm truncate">{selectedVendorName}</span>
                <button onClick={() => { setSelectedVendorName(""); setVendorSearch(""); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={vendorSearch}
                  onChange={e => { setVendorSearch(e.target.value); setShowVendorDropdown(true); }}
                  onFocus={() => setShowVendorDropdown(true)}
                  placeholder="Cari vendor service..."
                  className="h-10 pl-9"
                />
              </div>
            )}
            {showVendorDropdown && !selectedVendorName && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredVendors.map(v => (
                  <button key={v.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => { setSelectedVendorName(v.name); setShowVendorDropdown(false); }}
                  >
                    <span className="font-medium">{v.name}</span>
                    {v.phone && <span className="text-xs text-muted-foreground ml-2">{v.phone}</span>}
                  </button>
                ))}
                {filteredVendors.length === 0 && !addingVendor && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ditemukan</p>
                )}
                <button type="button"
                  className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-1.5 border-t border-border"
                  onClick={() => { setAddingVendor(true); setNewVendorName(vendorSearch); }}
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah vendor baru
                </button>
              </div>
            )}
          </div>
          {addingVendor && (
            <div className="p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-2">
              <p className="text-xs font-medium text-primary">Tambah Vendor Baru</p>
              <Input value={newVendorName} onChange={e => setNewVendorName(e.target.value)} placeholder="Nama vendor..." className="h-9 text-sm" />
              <Input value={newVendorPhone} onChange={e => setNewVendorPhone(e.target.value)} placeholder="No. telp (opsional)..." className="h-9 text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setAddingVendor(false)}>Batal</Button>
                <Button size="sm" className="flex-1 h-8" onClick={handleAddVendor} disabled={!newVendorName.trim()}>Simpan</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Biaya Perbaikan</Label>
        <Input 
          value={repairCost}
          onChange={e => setRepairCost(e.target.value)}
          placeholder="0"
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Catatan Tambahan</Label>
        <Input 
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Opsional..."
          className="h-10"
        />
      </div>

      {/* Status info */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
          ℹ️ Klaim akan dibuat dengan status <strong>"Menunggu"</strong>. Update progress perbaikan dari halaman detail unit.
        </p>
      </div>
    </div>
  );

  const footerButtons = (
    <>
      <Button variant="outline" onClick={onClose}>Batal</Button>
      <Button onClick={handleSubmit} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
        Simpan Klaim
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              {warrantyTitle}
            </DrawerTitle>
            <DrawerDescription>{warrantyDesc}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto flex-1">
            {formContent}
          </div>
          <DrawerFooter className="flex-row justify-end gap-2">
            {footerButtons}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {warrantyTitle}
          </DialogTitle>
          <DialogDescription>{warrantyDesc}</DialogDescription>
        </DialogHeader>
        {formContent}
        <DialogFooter>
          {footerButtons}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
