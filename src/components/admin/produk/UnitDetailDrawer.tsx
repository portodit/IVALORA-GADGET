import { useState, useEffect, useMemo } from "react";
import { X, Package, Clock, ShieldCheck, AlertTriangle, Trash2, Pencil, Flag, MapPin, Timer, Wrench, CalendarDays, ArrowRight, ShieldOff, History, Info, CheckCircle2, Loader2, ArrowDownToLine, Barcode, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StockUnit, StockUnitLog, SOLD_CHANNEL_SHORT, formatCurrency, formatDate, SoldChannel, getStatusLabel, getTrackingType, getUnitIdentifier } from "@/lib/admin/produk/stock-units";
import { StockStatusBadge, ConditionBadge } from "./StockBadges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/shared/use-toast";
import { useAuth } from "@/contexts/admin/AuthContext";
import { EditUnitModal } from "./EditUnitModal";
import { ReportUnitModal } from "./ReportUnitModal";
import { WarrantyClaimModal } from "./WarrantyClaimModal";
import { useStatusLabels } from "@/hooks/admin/use-status-labels";
import { differenceInDays, differenceInHours, addMonths, isAfter, isValid, parseISO } from "date-fns";

interface UnitDetailDrawerProps {
  unit: StockUnit | null;
  onClose: () => void;
  onUpdate: () => void;
}

interface Branch { id: string; name: string; city: string | null; }

interface WarrantyClaim {
  id: string;
  claim_type: "unit_warranty" | "imei_warranty";
  description: string;
  repair_branch_id: string | null;
  repair_cost: number;
  claim_date: string;
  resolution_type: "repair" | "refund" | "replace_unit";
  replacement_unit_id: string | null;
  is_imei_warranty_claimed: boolean;
  notes: string | null;
  created_at: string;
  claim_status: string;
  service_vendor_name: string | null;
  completed_at: string | null;
  branches?: { name: string; city: string | null } | null;
}

export function UnitDetailDrawer({ unit, onClose, onUpdate }: UnitDetailDrawerProps) {
  const { toast } = useToast();
  const { role } = useAuth();
  const { statusLabels } = useStatusLabels();
  const [logs, setLogs] = useState<StockUnitLog[]>([]);
  const [warrantyClaims, setWarrantyClaims] = useState<WarrantyClaim[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [warrantyClaimOpen, setWarrantyClaimOpen] = useState(false);
  const [warrantyClaimType, setWarrantyClaimType] = useState<"unit_warranty" | "imei_warranty">("unit_warranty");
  const [branch, setBranch] = useState<Branch | null>(null);
  const [invoicePaidAt, setInvoicePaidAt] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("info");
  const [noTxAlert, setNoTxAlert] = useState(false);
  
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin_branch";
  const isEmployee = role === "employee";
  const canEdit = isSuperAdmin || isAdmin || isEmployee;
  const canDelete = isSuperAdmin || isAdmin;
  const canClaimWarranty = isSuperAdmin || isAdmin || isEmployee;

  useEffect(() => {
    if (!unit) return;
    setConfirmDelete(false); setBranch(null); setInvoicePaidAt(null); 
    setWarrantyClaims([]); setActiveTab("info");
    
    supabase.from("stock_unit_logs").select("*").eq("unit_id", unit.id)
      .order("changed_at", { ascending: true }).limit(50)
      .then(({ data }) => setLogs((data as StockUnitLog[]) ?? []));

    if (unit.branch_id) {
      supabase.from("branches").select("id, name, city").eq("id", unit.branch_id).single()
        .then(({ data }) => setBranch(data as Branch | null));
    }

    supabase.from("warranty_claims").select("*, branches:repair_branch_id(name, city)")
      .eq("unit_id", unit.id).order("created_at", { ascending: false })
      .then(({ data }) => setWarrantyClaims((data as WarrantyClaim[]) ?? []));

    if (unit.sold_reference_id && !unit.sold_reference_id.startsWith("WARRANTY_REPLACE_")) {
      supabase.from("invoices").select("paid_at").eq("transaction_id", unit.sold_reference_id).maybeSingle()
        .then(({ data }) => { if (data?.paid_at) setInvoicePaidAt(data.paid_at); });
    }
  }, [unit]);

  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    if (!isValid(date)) return "—";
    return new Intl.DateTimeFormat("id-ID", { 
      day: "numeric", 
      month: "short", 
      year: "numeric", 
      hour: "2-digit", 
      minute: "2-digit",
      timeZone: "Asia/Jakarta" 
    }).format(date) + " WIB";
  };

  const stockMetrics = useMemo(() => {
    if (!unit) return null;
    const receivedDate = new Date(unit.received_at);
    const now = new Date();
    if (!isValid(receivedDate)) return null;

    if (unit.stock_status === "sold" && unit.sold_at) {
      const soldDate = new Date(unit.sold_at);
      if (!isValid(soldDate)) return null;
      const days = differenceInDays(soldDate, receivedDate);
      const hours = differenceInHours(soldDate, receivedDate) % 24;
      return { type: "cycle_time" as const, label: days === 0 ? `${hours} jam` : `${days} hari`, days };
    } else {
      const days = differenceInDays(now, receivedDate);
      const hours = differenceInHours(now, receivedDate) % 24;
      return { type: "days_in_stock" as const, label: days === 0 ? `${hours} jam` : `${days} hari`, days };
    }
  }, [unit]);

  const hasRepairHistory = useMemo(() => {
    return logs.some(log => log.field_changed === "stock_status" && (log.old_value === "service" || log.new_value === "service"));
  }, [logs]);

  const warrantyStatus = useMemo(() => {
    if (!unit || unit.stock_status !== "sold") return null;
    const baseDate = invoicePaidAt ? new Date(invoicePaidAt) : (unit.sold_at ? new Date(unit.sold_at) : null);
    if (!baseDate || !isValid(baseDate)) return null;
    const unitWarrantyExpiry = addMonths(baseDate, 1);
    const isUnitWarrantyActive = isAfter(unitWarrantyExpiry, new Date());
    const daysLeft = isUnitWarrantyActive ? differenceInDays(unitWarrantyExpiry, new Date()) : 0;
    const isWarrantyReplacement = unit.sold_reference_id?.startsWith("WARRANTY_REPLACE_");
    const hasImeiClaim = warrantyClaims.some(c => c.claim_type === "imei_warranty" && c.is_imei_warranty_claimed);
    return {
      unitWarranty: { active: isUnitWarrantyActive, daysLeft, claimsCount: warrantyClaims.filter(c => c.claim_type === "unit_warranty").length },
      imeiWarranty: { active: !isWarrantyReplacement && !hasImeiClaim, claimed: hasImeiClaim, isReplacement: isWarrantyReplacement },
    };
  }, [unit, invoicePaidAt, warrantyClaims]);

  if (!unit) return null;

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("stock_units").delete().eq("id", unit.id);
    setDeleting(false);
    if (error) { toast({ title: "Gagal menghapus unit", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Unit berhasil dihapus" }); onUpdate(); onClose();
  };

  const openWarrantyClaim = (type: "unit_warranty" | "imei_warranty") => {
    setWarrantyClaimType(type); setWarrantyClaimOpen(true);
  };

  const fieldLabel: Record<string, string> = {
    stock_status: "Status Stok", selling_price: "Harga Jual", condition_status: "Kondisi", minus_severity: "Tingkat Minus",
  };

  const getLogValueDisplay = (field: string, value: string | null): string => {
    if (!value) return "—";
    if (field === "stock_status") return getStatusLabel(value, statusLabels);
    if (field === "condition_status") return value === "no_minus" ? "No Minus" : "Minus";
    if (field === "selling_price") return formatCurrency(parseFloat(value));
    return value;
  };

  const isSold = unit.stock_status === "sold";
  const trackingType = getTrackingType(unit.master_products?.category as never);
  const isAccessory = trackingType === "qty";
  const unitIdentifier = getUnitIdentifier(unit);
  const identifierLabel = trackingType === "imei" ? "IMEI" : trackingType === "serial_number" ? "SN" : "Stok";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl overflow-hidden max-sm:max-w-full">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0 bg-gradient-to-r from-card to-accent/30">
          <div className="flex items-center justify-between mb-3">
            <div />
            <div className="flex items-center gap-1">
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} title="Edit Unit">
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
              {isEmployee && !isSuperAdmin && !isAdmin && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReportOpen(true)} title="Laporkan Koreksi">
                  <Flag className="w-4 h-4" />
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)} title="Hapus Unit">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="mb-3 rounded-xl bg-destructive/5 border border-destructive/20 p-3 space-y-2">
              <p className="text-sm text-destructive font-medium">Yakin ingin menghapus unit ini?</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setConfirmDelete(false)}>Batal</Button>
                <Button variant="destructive" size="sm" className="flex-1 h-8" disabled={deleting} onClick={handleDelete}>
                  {deleting ? <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" /> : "Hapus"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground truncate leading-tight">
                {unit.master_products?.series}{unit.master_products?.storage_gb ? ` — ${unit.master_products.storage_gb}GB` : ""}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {[
                  unit.master_products?.color && unit.master_products.color !== "—" && unit.master_products.color !== "-" ? unit.master_products.color : null,
                  unit.master_products?.warranty_type ? `Garansi ${unit.master_products.warranty_type.replace(/_/g, " ")}` : null,
                ].filter(Boolean).join(" · ")}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <StockStatusBadge status={unit.stock_status} statusLabels={statusLabels} />
                {!isAccessory && <ConditionBadge condition={unit.condition_status} />}
                {hasRepairHistory && (
                  <Badge variant="outline" className="text-[11px] gap-1 h-5 border-amber-300 text-amber-600 bg-amber-50">
                    <Wrench className="w-2.5 h-2.5" /> Service
                  </Badge>
                )}
                {isAccessory ? (
                  <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stok</span>
                    <span className="text-xs font-bold text-foreground">{unit.qty_available ?? 0} unit</span>
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 cursor-pointer group"
                    onClick={() => { navigator.clipboard.writeText(unitIdentifier); toast({ title: `${identifierLabel} disalin`, description: unitIdentifier }); }}
                    title={`Klik untuk menyalin ${identifierLabel}`}
                  >
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{identifierLabel}</span>
                    <span className="font-mono text-xs font-medium text-foreground group-hover:text-primary transition-colors">{unitIdentifier}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border flex px-1">
            {([
              { id: "info", label: "Info", icon: <Info className="w-4 h-4" /> },
              ...(isSold && !isAccessory ? [{ id: "garansi", label: "Garansi", icon: <ShieldCheck className="w-4 h-4" /> }] : []),
              { id: "riwayat", label: "Riwayat", icon: <Clock className="w-4 h-4" /> },
            ] as { id: string; label: string; icon: React.ReactNode }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-150",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                )}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Info */}
          {activeTab === "info" && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                {branch && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-accent/60 border border-border/50 w-full">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground leading-none">Cabang</p>
                      <p className="text-sm font-semibold text-foreground">{branch.name}{branch.city ? ` (${branch.city})` : ""}</p>
                    </div>
                  </div>
                )}
                {stockMetrics && (
                  <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border/50 w-full ${
                    stockMetrics.type === "cycle_time" ? "bg-primary/5" : stockMetrics.days > 30 ? "bg-destructive/5" : "bg-accent/60"
                  }`}>
                    {stockMetrics.type === "cycle_time" 
                      ? <Timer className="w-4 h-4 text-primary shrink-0" />
                      : <CalendarDays className={`w-4 h-4 shrink-0 ${stockMetrics.days > 30 ? "text-destructive" : "text-muted-foreground"}`} />
                    }
                    <div>
                      <p className="text-[11px] text-muted-foreground leading-none">
                        {stockMetrics.type === "cycle_time" ? "Cycle Time" : "Lama di Etalase"}
                      </p>
                      <p className={`text-sm font-bold ${
                        stockMetrics.type === "cycle_time" ? "text-primary" : stockMetrics.days > 30 ? "text-destructive" : "text-foreground"
                      }`}>{stockMetrics.label}</p>
                    </div>
                  </div>
                )}
                
                {/* Sold Details as Cards */}
                {unit.stock_status === "sold" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/20 w-full">
                      <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground leading-none">Channel</p>
                        <p className="text-sm font-bold text-foreground truncate">
                          {unit.sold_channel ? SOLD_CHANNEL_SHORT[unit.sold_channel as SoldChannel] : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/20 w-full">
                      <Barcode className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground leading-none">ID Ref</p>
                        <p className="text-sm font-bold text-foreground truncate font-mono" title={unit.sold_reference_id || ""}>
                          {unit.sold_reference_id || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <dl className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                <div className="flex items-center px-4 py-2.5 bg-card">
                  <dt className="text-xs font-bold text-foreground/70 w-36 shrink-0 uppercase tracking-tight">Harga Jual</dt>
                  <dd className="text-sm font-extrabold text-foreground">{formatCurrency(unit.selling_price)}</dd>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center px-4 py-2.5 bg-card">
                    <dt className="text-xs font-bold text-foreground/70 w-36 shrink-0 uppercase tracking-tight">Harga Modal</dt>
                    <dd className="text-sm font-extrabold text-foreground">{formatCurrency(unit.cost_price)}</dd>
                  </div>
                )}
                <div className="flex items-center px-4 py-2.5 bg-muted/30">
                  <dt className="text-xs font-bold text-foreground/70 w-36 shrink-0 uppercase tracking-tight">Tanggal Masuk</dt>
                  <dd className="text-sm font-semibold text-foreground">{formatDate(unit.received_at)}</dd>
                </div>
                {unit.estimated_arrival_at && (
                  <div className="flex items-center px-4 py-2.5 bg-card">
                    <dt className="text-xs font-bold text-foreground/70 w-36 shrink-0 uppercase tracking-tight">Est. Kedatangan</dt>
                    <dd className="text-sm font-semibold text-foreground">{formatDate(unit.estimated_arrival_at)}</dd>
                  </div>
                )}
                <div className="flex items-center px-4 py-2.5 bg-muted/30">
                  <dt className="text-xs font-bold text-foreground/70 w-36 shrink-0 uppercase tracking-tight">Status Update</dt>
                  <dd className="text-sm font-semibold text-foreground">{formatDate(unit.status_changed_at)}</dd>
                </div>
                {unit.supplier && (
                  <div className="flex items-center px-4 py-2.5 bg-card">
                    <dt className="text-xs font-bold text-foreground/70 w-36 shrink-0 uppercase tracking-tight">Supplier</dt>
                    <dd className="text-sm font-semibold text-foreground">{unit.supplier}</dd>
                  </div>
                )}
              </dl>

              {unit.stock_status === "sold" && (
                <>
                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-white font-bold gap-2 transition-all shadow-sm"
                    onClick={() => {
                      if (!unit.sold_reference_id || unit.sold_reference_id.startsWith("WARRANTY_REPLACE_")) {
                        setNoTxAlert(true);
                      } else {
                        window.location.href = `/admin/transaksi/${unit.sold_reference_id}`;
                      }
                    }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    Lihat Detail Transaksi
                  </Button>
                  {noTxAlert && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive space-y-1">
                      <p className="font-semibold">Data transaksi belum tersedia</p>
                      <p className="text-xs leading-relaxed text-foreground/70">Unit ini belum memiliki data transaksi lengkap. Tentukan channel penjualan (Tokopedia / Shopee) terlebih dahulu melalui daftar stok.</p>
                      <button className="text-xs underline text-destructive mt-1" onClick={() => setNoTxAlert(false)}>Tutup</button>
                    </div>
                  )}
                </>
              )}

              {unit.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Catatan</p>
                  <p className="text-sm text-foreground">{unit.notes}</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Tab: Garansi */}
          {activeTab === "garansi" && isSold && !isAccessory && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">
                {warrantyStatus ? (
                  <>
                    <div className={`rounded-xl p-4 ${warrantyStatus.unitWarranty.active ? "bg-primary/5 border border-primary/20" : "bg-muted/40 border border-border"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${warrantyStatus.unitWarranty.active ? "bg-primary/10" : "bg-muted"}`}>
                          {warrantyStatus.unitWarranty.active ? <ShieldCheck className="w-5 h-5 text-primary" /> : <ShieldOff className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-bold text-foreground">Garansi Unit (1 Bulan)</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {warrantyStatus.unitWarranty.active ? `Aktif — sisa ${warrantyStatus.unitWarranty.daysLeft} hari` : "Sudah berakhir"}
                          </p>
                        </div>
                      </div>
                      {warrantyStatus.unitWarranty.active && canClaimWarranty && (
                        <Button variant="outline" size="sm" className="w-full mt-3 h-9 text-sm gap-2" onClick={() => openWarrantyClaim("unit_warranty")}>
                          <Wrench className="w-4 h-4" /> Klaim Garansi Unit
                        </Button>
                      )}
                    </div>

                    <div className={`rounded-xl p-4 ${warrantyStatus.imeiWarranty.active ? "bg-primary/5 border border-primary/20" : "bg-muted/40 border border-border"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${warrantyStatus.imeiWarranty.active ? "bg-primary/10" : "bg-muted"}`}>
                          {warrantyStatus.imeiWarranty.active ? <ShieldCheck className="w-5 h-5 text-primary" /> : <ShieldOff className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-bold text-foreground">
                            {trackingType === "serial_number" ? "Garansi Serial Number" : "Garansi IMEI"}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {warrantyStatus.imeiWarranty.isReplacement ? "Unit pengganti" : warrantyStatus.imeiWarranty.claimed ? "Sudah diklaim" : "Aktif — Seumur Hidup"}
                          </p>
                        </div>
                      </div>
                      {warrantyStatus.imeiWarranty.active && canClaimWarranty && (
                        <Button variant="outline" size="sm" className="w-full mt-3 h-9 text-sm gap-2" onClick={() => openWarrantyClaim("imei_warranty")}>
                          <ShieldCheck className="w-4 h-4" /> {trackingType === "serial_number" ? "Klaim Garansi SN" : "Klaim IMEI"}
                        </Button>
                      )}
                    </div>
                  </>
                ) : <p className="text-sm text-muted-foreground">Data garansi tidak tersedia.</p>}
              </div>
            </div>
          )}

          {/* Tab: Riwayat */}
          {activeTab === "riwayat" && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Riwayat Unit</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Perubahan data sejak unit masuk stok.</p>
                </div>

                <div className="relative">
                  <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />
                  <div className="space-y-0">
                    {[...logs].reverse().map((log) => (
                      <div key={log.id} className="relative flex gap-4 pb-5">
                        <div className="relative z-10 flex-shrink-0 w-[31px] flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-background border-2 border-primary/60 ring-4 ring-background" />
                        </div>
                        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 h-auto shrink-0">
                              {fieldLabel[log.field_changed] ?? log.field_changed}
                            </Badge>
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 shrink-0 leading-tight text-right">
                              <CalendarDays className="w-3.5 h-3.5 text-foreground" />
                              {safeFormatDate(log.changed_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="text-muted-foreground line-through">{getLogValueDisplay(log.field_changed, log.old_value)}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                            <span className="font-semibold text-foreground">{getLogValueDisplay(log.field_changed, log.new_value)}</span>
                            
                            {/* Metadata Details */}
                            {log.field_changed === "stock_status" && log.new_value === "sold" && customerName && (
                              <div className="w-full mt-1.5 flex items-center gap-1.5 text-[11px] bg-primary/5 text-primary border border-primary/10 px-2 py-1 rounded-md">
                                <User className="w-3 h-3" />
                                <span>Customer: <span className="font-bold">{customerName}</span></span>
                              </div>
                            )}
                            {log.field_changed === "stock_status" && log.new_value === "service" && warrantyClaims.length > 0 && (
                              <div className="w-full mt-1.5 flex items-center gap-1.5 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-md">
                                <Wrench className="w-3 h-3" />
                                <span>Vendor: <span className="font-bold">{warrantyClaims[0].service_vendor_name || "Internal"}</span></span>
                              </div>
                            )}
                            {log.field_changed === "stock_status" && (log.new_value === "returned" || log.new_value === "warranty_claim") && unit.supplier && (
                              <div className="w-full mt-1.5 flex items-center gap-1.5 text-[11px] bg-muted text-muted-foreground border border-border px-2 py-1 rounded-md">
                                <User className="w-3 h-3" />
                                <span>Supplier: <span className="font-bold">{unit.supplier}</span></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="relative flex gap-4">
                      <div className="relative z-10 flex-shrink-0 w-[31px] flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-primary ring-4 ring-background flex items-center justify-center">
                          <ArrowDownToLine className="w-2 h-2 text-primary-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Unit Masuk Stok</span>
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5 shrink-0 leading-tight text-right">
                            <CalendarDays className="w-3.5 h-3.5 text-foreground" />
                            {safeFormatDate(unit.received_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StockStatusBadge status={logs.find(l => l.field_changed === "stock_status")?.old_value || unit.stock_status} statusLabels={statusLabels} />
                          {unit.supplier && (
                            <Badge variant="outline" className="text-xs font-bold py-0.5 h-auto bg-background text-foreground border-border px-2">
                              Supplier: {unit.supplier}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {logs.length === 0 && <p className="text-xs text-muted-foreground italic pl-10 mt-3">Belum ada perubahan data sejak masuk stok.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <EditUnitModal unit={unit} open={editOpen} onClose={() => setEditOpen(false)} onSuccess={() => { onUpdate(); onClose(); }} />
      <ReportUnitModal unit={unit} open={reportOpen} onClose={() => setReportOpen(false)} />
      <WarrantyClaimModal unit={unit} claimType={warrantyClaimType} open={warrantyClaimOpen} onClose={() => setWarrantyClaimOpen(false)} onSuccess={onUpdate} />
    </div>
  );
}
