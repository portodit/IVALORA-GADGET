import { useState, useEffect, useRef } from "react";
import {
  Plus, Pencil, Trash2, Building2, Wallet, Banknote, CreditCard,
  GripVertical, ChevronDown, X, Image as ImageIcon, MapPin, Zap, Landmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/admin/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/shared/use-toast";
import { SectionCard } from "@/components/shared/SectionCard";
import { AdminFooter } from "@/components/shared/AdminFooter";
import { SearchableDropdown } from "@/components/shared/SearchableDropdown";
import { cn } from "@/lib/utils";
import DokuChannelSettings from "@/components/admin/DokuChannelSettings";

interface PaymentMethod {
  id: string;
  branch_id: string;
  name: string;
  type: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  is_active: boolean;
  sort_order: number;
  qris_image_url: string | null;
}
interface BranchOption {
  id: string;
  name: string;
  code: string;
}
interface MethodFormData {
  bank_name: string;
  type: string;
  account_number: string;
  account_name: string;
}

const PAYMENT_TYPES = [
  { value: "cash",          label: "Tunai (Cash)",       icon: Banknote },
  { value: "bank_transfer", label: "Transfer Bank",       icon: Building2 },
  { value: "ewallet",       label: "E-Wallet",            icon: Wallet },
  { value: "other",         label: "Lainnya (QRIS, dll)", icon: CreditCard },
];

const TYPE_ICON: Record<string, React.ElementType> = {
  cash: Banknote, bank_transfer: Building2, ewallet: Wallet, other: CreditCard,
};
const TYPE_LABEL: Record<string, string> = {
  cash: "Tunai", bank_transfer: "Transfer Bank", ewallet: "E-Wallet", other: "Lainnya",
};
const TYPE_COLOR: Record<string, string> = {
  cash:          "bg-emerald-100 text-emerald-700",
  bank_transfer: "bg-blue-100 text-blue-700",
  ewallet:       "bg-violet-100 text-violet-700",
  other:         "bg-zinc-100 text-zinc-700",
};

const DEFAULT_FORM: MethodFormData = { bank_name: "", type: "bank_transfer", account_number: "", account_name: "" };

type TabKey = "doku" | "manual";

export default function KanalPembayaranPage() {
  const { activeBranch, userBranches, role } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("doku");
  const [methods, setMethods]         = useState<PaymentMethod[]>([]);
  const [loading, setLoading]         = useState(true);
  const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<BranchOption | null>(null);

  const [modalOpen, setModalOpen]       = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [form, setForm]                 = useState<MethodFormData>(DEFAULT_FORM);
  const [saving, setSaving]             = useState(false);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const [qrisFile, setQrisFile]         = useState<File | null>(null);
  const [qrisPreview, setQrisPreview]   = useState<string | null>(null);
  const [existingQrisUrl, setExistingQrisUrl] = useState<string | null>(null);
  const [uploadingQris, setUploadingQris]     = useState(false);
  const [qrisDragOver, setQrisDragOver]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const branchId = selectedBranch?.id ?? null;

  useEffect(() => {
    if (role === "super_admin") {
      supabase.from("branches").select("id, name, code").eq("is_active", true).order("name")
        .then(({ data }) => {
          const bs = (data as BranchOption[]) ?? [];
          setAllBranches(bs);
          if (!selectedBranch && bs.length > 0) {
            setSelectedBranch(bs.find(b => b.id === activeBranch?.id) ?? bs[0]);
          }
        });
    } else {
      const branches = (userBranches ?? []).map(b => ({ id: b.id, name: b.name, code: (b as BranchOption).code ?? "" }));
      setAllBranches(branches);
      if (!selectedBranch && branches.length > 0) {
        setSelectedBranch(branches.find(b => b.id === activeBranch?.id) ?? branches[0]);
      }
    }
  }, [role, activeBranch, userBranches]);


  const fetchMethods = async (bid: string) => {
    setLoading(true);
    const { data } = await supabase.from("payment_methods").select("*").eq("branch_id", bid).order("sort_order");
    setMethods((data as unknown as PaymentMethod[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { if (branchId) fetchMethods(branchId); else setLoading(false); }, [branchId]);

  const openCreate = () => {
    setEditingId(null); setForm(DEFAULT_FORM);
    setQrisFile(null); setQrisPreview(null); setExistingQrisUrl(null);
    setModalOpen(true);
  };
  const openEdit = (m: PaymentMethod) => {
    setEditingId(m.id);
    setForm({ bank_name: m.bank_name ?? m.name ?? "", type: m.type, account_number: m.account_number ?? "", account_name: m.account_name ?? "" });
    setQrisFile(null); setQrisPreview(null); setExistingQrisUrl(m.qris_image_url ?? null);
    setModalOpen(true);
  };

  function deriveName(type: string, bank_name: string): string {
    if (type === "cash") return "Tunai";
    if (type === "other") return bank_name.trim() || "QRIS / Lainnya";
    return bank_name.trim() || (type === "ewallet" ? "E-Wallet" : "Transfer Bank");
  }

  const handleQrisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrisFile(file);
    const reader = new FileReader();
    reader.onload = () => setQrisPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadQrisImage = async (_paymentMethodId: string): Promise<string | null> => {
    if (!qrisFile) return existingQrisUrl;
    setUploadingQris(true);
    try {
      const { uploadFile } = await import("@/lib/upload");
      const result = await uploadFile(qrisFile, "products");
      return result.url;
    } catch (err: any) {
      toast({ title: "Gagal upload gambar QRIS", description: err.message, variant: "destructive" });
      return existingQrisUrl;
    } finally {
      setUploadingQris(false);
    }
  };

  const handleSave = async () => {
    if (!branchId) return;
    if ((form.type === "bank_transfer" || form.type === "ewallet") && !form.bank_name.trim()) {
      toast({ title: "Nama bank/e-wallet wajib diisi", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      branch_id: branchId, name: deriveName(form.type, form.bank_name),
      type: form.type, bank_name: form.bank_name.trim() || null,
      account_number: form.account_number.trim() || null, account_name: form.account_name.trim() || null,
    };
    if (editingId) {
      if (form.type === "other") { payload.qris_image_url = await uploadQrisImage(editingId); } else { payload.qris_image_url = null; }
      const { error } = await supabase.from("payment_methods").update(payload as never).eq("id", editingId);
      if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Metode pembayaran diperbarui" }); setModalOpen(false); fetchMethods(branchId); }
    } else {
      const { data: insertData, error } = await supabase.from("payment_methods").insert({ ...payload, sort_order: methods.length } as never).select("id").single();
      if (error || !insertData) { toast({ title: "Gagal menambahkan", description: error?.message, variant: "destructive" }); }
      else {
        if (form.type === "other" && qrisFile) {
          const url = await uploadQrisImage((insertData as { id: string }).id);
          if (url) await supabase.from("payment_methods").update({ qris_image_url: url } as never).eq("id", (insertData as { id: string }).id);
        }
        toast({ title: "Metode pembayaran ditambahkan" }); setModalOpen(false); fetchMethods(branchId);
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId || !branchId) return;
    setDeleting(true);
    const { error } = await supabase.from("payment_methods").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) { toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Metode pembayaran dihapus" }); setDeleteId(null); fetchMethods(branchId); }
  };

  const toggleActive = async (m: PaymentMethod) => {
    if (!branchId) return;
    await supabase.from("payment_methods").update({ is_active: !m.is_active } as never).eq("id", m.id);
    fetchMethods(branchId);
  };

  const selectedTypeInfo = PAYMENT_TYPES.find(t => t.value === form.type);
  const grouped = PAYMENT_TYPES.map(pt => ({ ...pt, items: methods.filter(m => m.type === pt.value) })).filter(g => g.items.length > 0);

  const TABS: { key: TabKey; label: string; icon: React.ElementType; desc: string }[] = [
    { key: "doku", label: "DOKU Gateway", icon: Zap, desc: "VA, E-Wallet, PayLater otomatis" },
    { key: "manual", label: "Manual", icon: Landmark, desc: "Transfer langsung, tunai, QRIS" },
  ];

  return (
    <DashboardLayout pageTitle="Kanal Pembayaran">
      <div className="space-y-5 pb-16">

        <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight">Kanal Pembayaran</h1>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">
              Kelola metode pembayaran yang tersedia di POS.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SearchableDropdown
              options={allBranches}
              value={selectedBranch?.id ?? null}
              onChange={(id) => setSelectedBranch(allBranches.find(b => b.id === id) ?? null)}
              placeholder="Pilih Cabang"
              searchPlaceholder="Cari cabang..."
              align="right"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 border border-border rounded-lg p-0.5 bg-muted/40 w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Deskripsi tab Manual saja — DOKU sudah ada penjelasannya di dalam komponen */}
        {activeTab === "manual" && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-zinc-50 border border-zinc-200 text-zinc-600">
            <Landmark className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-500" />
            <span>
              <span className="font-bold">Pembayaran Manual</span> — Metode offline per cabang: transfer bank langsung, tunai, QRIS merchant.
              Tidak melalui payment gateway — admin mengkonfirmasi pembayaran secara manual setelah dana diterima.
            </span>
          </div>
        )}

        {activeTab === "doku" ? (
          <DokuChannelSettings />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center">
                    <Landmark className="w-4 h-4 text-white" />
                  </div>
                  Pembayaran Manual
                </h2>
                <p className="text-xs text-muted-foreground mt-1 ml-10">
                  Transfer bank langsung, tunai, QRIS merchant, dan metode lainnya.
                </p>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={openCreate}>
                <Plus className="w-3.5 h-3.5" /> Tambah
              </Button>
            </div>

            {!branchId ? (
              <SectionCard>
                <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                  <MapPin className="w-10 h-10 text-zinc-300" />
                  <p className="text-sm font-bold text-zinc-700">Tidak ada cabang aktif</p>
                  <p className="text-sm font-medium text-zinc-400">Pilih cabang terlebih dahulu.</p>
                </div>
              </SectionCard>
            ) : loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-zinc-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : methods.length === 0 ? (
              <SectionCard>
                <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
                    <CreditCard className="w-7 h-7 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-800">Belum ada metode pembayaran manual</p>
                    <p className="text-sm font-medium text-zinc-400 mt-0.5">Tambahkan metode pertama untuk mulai menggunakan POS</p>
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={openCreate}>
                    <Plus className="w-3.5 h-3.5" /> Tambah Metode
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <div className="space-y-6">
                {grouped.map(group => {
                  const GroupIcon = group.icon;
                  const colorCls = TYPE_COLOR[group.value] ?? "bg-zinc-100 text-zinc-700";
                  return (
                    <div key={group.value} className="space-y-2">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", colorCls)}>
                          <GroupIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{group.label}</p>
                          <p className="text-xs font-medium text-zinc-400">{group.items.length} metode</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {group.items.map(m => {
                          const Icon = TYPE_ICON[m.type] ?? CreditCard;
                          const iconColor = TYPE_COLOR[m.type] ?? "bg-zinc-100 text-zinc-700";
                          return (
                            <div
                              key={m.id}
                              className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border-2 bg-white transition-all",
                                m.is_active ? "border-zinc-200 hover:border-zinc-400" : "border-zinc-100 opacity-60"
                              )}
                            >
                              <GripVertical className="w-4 h-4 text-zinc-300 shrink-0 cursor-grab" />

                              {m.type === "other" && m.qris_image_url ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-zinc-200">
                                  <img src={m.qris_image_url} alt="QRIS" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconColor)}>
                                  <Icon className="w-4.5 h-4.5" />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-zinc-900 truncate">
                                    {m.bank_name ?? m.name}
                                  </p>
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                                    m.is_active
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-zinc-100 text-zinc-500"
                                  )}>
                                    {m.is_active ? "Aktif" : "Nonaktif"}
                                  </span>
                                </div>
                                {m.account_number && (
                                  <p className="text-xs font-mono text-zinc-500 mt-0.5">
                                    {m.account_number}{m.account_name ? ` · ${m.account_name}` : ""}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => toggleActive(m)}
                                  className="h-8 px-3 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
                                >
                                  {m.is_active ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                                <button
                                  onClick={() => openEdit(m)}
                                  className="w-8 h-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteId(m.id)}
                                  className="w-8 h-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <AdminFooter />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
              <h3 className="text-base font-bold text-zinc-900">
                {editingId ? "Edit Metode Pembayaran" : "Tambah Metode Pembayaran"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Tipe Pembayaran *</label>
                <div className="relative">
                  <button
                    onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:border-zinc-400 transition-colors"
                  >
                    {selectedTypeInfo && <selectedTypeInfo.icon className="w-4 h-4 text-zinc-500 shrink-0" />}
                    <span className="flex-1 text-left">{selectedTypeInfo?.label ?? "Pilih tipe"}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  {typeDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      {PAYMENT_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => { setForm(f => ({ ...f, type: t.value, bank_name: "" })); setTypeDropdownOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-3 text-sm font-semibold transition-colors text-left",
                            form.type === t.value
                              ? "bg-zinc-900 text-white"
                              : "text-zinc-700 hover:bg-zinc-50"
                          )}
                        >
                          <t.icon className="w-4 h-4 opacity-70" />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {form.type !== "cash" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                    {form.type === "bank_transfer" ? "Nama Bank *" : form.type === "ewallet" ? "Nama E-Wallet *" : "Label (opsional)"}
                  </label>
                  <Input
                    value={form.bank_name}
                    onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                    placeholder={
                      form.type === "bank_transfer" ? "Contoh: BCA, Mandiri, BNI, SeaBank" :
                      form.type === "ewallet" ? "Contoh: GoPay, OVO, Dana" : "Contoh: QRIS Merchant"
                    }
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {(form.type === "bank_transfer" || form.type === "ewallet") && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Nomor Rekening / No. HP</label>
                    <Input
                      value={form.account_number}
                      onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                      placeholder="Contoh: 1234567890"
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Nama Pemilik Rekening</label>
                    <Input
                      value={form.account_name}
                      onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                      placeholder="Contoh: Ivalora Gadget Surabaya"
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}

              {form.type === "other" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Gambar QRIS (opsional)</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleQrisFileChange} className="hidden" />
                  {(qrisPreview || existingQrisUrl) ? (
                    <div className="relative rounded-xl border-2 border-zinc-200 overflow-hidden">
                      <img src={qrisPreview || existingQrisUrl!} alt="QRIS" className="w-full max-h-48 object-contain" />
                      <div className="absolute bottom-2 right-2 flex gap-1.5">
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-white/90 border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                          Ganti
                        </button>
                        <button type="button" onClick={() => { setQrisFile(null); setQrisPreview(null); setExistingQrisUrl(null); }}
                          className="px-2.5 py-1 rounded-lg bg-white/90 border border-zinc-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
                          Hapus
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDrop={e => { e.preventDefault(); setQrisDragOver(false); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) { setQrisFile(f); setQrisPreview(URL.createObjectURL(f)); } }}
                      onDragOver={e => { e.preventDefault(); setQrisDragOver(true); }}
                      onDragLeave={e => { e.preventDefault(); setQrisDragOver(false); }}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
                        qrisDragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 hover:border-zinc-500 hover:bg-zinc-50"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-zinc-700">{qrisDragOver ? "Lepas untuk upload" : "Seret atau klik untuk upload QRIS"}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">JPG, PNG, atau WebP</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Tampil di POS sebagai</p>
                <p className="text-sm font-bold text-zinc-900 mt-1">
                  {TYPE_LABEL[form.type] ?? form.type} · {form.type === "cash" ? "Tunai" : (form.bank_name.trim() || "—")}
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2 shrink-0 border-t border-zinc-100 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)} disabled={saving || uploadingQris}>Batal</Button>
              <Button className="flex-1 gap-2" onClick={handleSave}
                disabled={saving || uploadingQris || (form.type !== "cash" && form.type !== "other" && !form.bank_name.trim())}>
                {saving || uploadingQris ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Hapus Metode Pembayaran?</h3>
                <p className="text-xs font-medium text-zinc-500 mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)} disabled={deleting}>Batal</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Menghapus..." : "Hapus"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
