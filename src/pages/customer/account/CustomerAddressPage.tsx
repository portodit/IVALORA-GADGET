import { useState, useEffect, useCallback } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Edit3, Trash2, Loader2, Save, Star, ChevronDown } from "lucide-react";
import { useCustomerAuth } from "@/contexts/customer/CustomerAuthContext";
import { supabaseCustomer } from "@/integrations/supabase/customer-client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useProvinces, useRegencies, useDistricts, useVillages } from "@/hooks/admin/use-wilayah";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Address {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  province_name: string;
  regency_name: string;
  district_name: string;
  village_name: string;
  full_address: string;
  postal_code: string;
  is_default: boolean;
  province_code: string;
  regency_code: string;
  district_code: string;
  village_code: string;
}

export default function CustomerAddressPage() {
  const { user, isLoading: authLoading } = useCustomerAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAddr, setEditAddr] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [label, setLabel] = useState("Utama");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState<string | null>(null);
  const [provinceName, setProvinceName] = useState("");
  const [regency, setRegency] = useState<string | null>(null);
  const [regencyName, setRegencyName] = useState("");
  const [district, setDistrict] = useState<string | null>(null);
  const [districtName, setDistrictName] = useState("");
  const [village, setVillage] = useState<string | null>(null);
  const [villageName, setVillageName] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const { data: provinces, loading: provLoading } = useProvinces();
  const { data: regencies, loading: regLoading } = useRegencies(province);
  const { data: districts, loading: distLoading } = useDistricts(regency);
  const { data: villages, loading: vilLoading } = useVillages(district);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login", { replace: true }); return; }
    if (user) fetchAddresses();
  }, [user, authLoading]);

  const fetchAddresses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabaseCustomer
      .from("customer_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    setAddresses((data as any as Address[]) ?? []);
    setLoading(false);
  }, [user]);

  function resetForm() {
    setLabel("Utama"); setFullName(""); setPhone("");
    setProvince(null); setProvinceName(""); setRegency(null); setRegencyName("");
    setDistrict(null); setDistrictName(""); setVillage(null); setVillageName("");
    setFullAddress(""); setPostalCode(""); setEditAddr(null);
  }

  function openAdd() { resetForm(); setModalOpen(true); }
  function openEdit(addr: Address) {
    setEditAddr(addr);
    setLabel(addr.label || "Utama");
    setFullName(addr.full_name);
    setPhone(addr.phone);
    setProvince(addr.province_code);
    setProvinceName(addr.province_name);
    setRegency(addr.regency_code);
    setRegencyName(addr.regency_name);
    setDistrict(addr.district_code);
    setDistrictName(addr.district_name);
    setVillage(addr.village_code);
    setVillageName(addr.village_name);
    setFullAddress(addr.full_address);
    setPostalCode(addr.postal_code);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!user) return;
    if (!fullName.trim() || !phone.trim() || !fullAddress.trim()) {
      toast.error("Nama, telepon, dan alamat wajib diisi");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      label,
      full_name: fullName,
      phone,
      province_code: province,
      province_name: provinceName,
      regency_code: regency,
      regency_name: regencyName,
      district_code: district,
      district_name: districtName,
      village_code: village,
      village_name: villageName,
      full_address: fullAddress,
      postal_code: postalCode,
      is_default: addresses.length === 0, // First address is default
    };

    let error;
    if (editAddr) {
      ({ error } = await supabaseCustomer.from("customer_addresses").update(payload as any).eq("id", editAddr.id));
    } else {
      ({ error } = await supabaseCustomer.from("customer_addresses").insert(payload as any));
    }
    setSaving(false);
    if (error) { toast.error("Gagal menyimpan: " + error.message); return; }
    toast.success(editAddr ? "Alamat diperbarui" : "Alamat berhasil ditambahkan");
    setModalOpen(false);
    resetForm();
    fetchAddresses();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus alamat ini?")) return;
    const { error } = await supabaseCustomer.from("customer_addresses").delete().eq("id", id);
    if (error) { toast.error("Gagal menghapus"); return; }
    toast.success("Alamat dihapus");
    fetchAddresses();
  }

  async function setDefault(id: string) {
    if (!user) return;
    // Unset all defaults first
    await supabaseCustomer.from("customer_addresses").update({ is_default: false } as any).eq("user_id", user.id);
    await supabaseCustomer.from("customer_addresses").update({ is_default: true } as any).eq("id", id);
    toast.success("Alamat utama diubah");
    fetchAddresses();
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-4">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Alamat Saya</h1>
              <p className="text-sm text-muted-foreground">Kelola alamat pengiriman Anda.</p>
            </div>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" /> Tambah Alamat
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse h-28" />
              ))}
            </div>
          ) : addresses.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
              <MapPin className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Belum ada alamat tersimpan</p>
              <p className="text-xs text-muted-foreground">Tambahkan alamat pengiriman untuk mempermudah checkout.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map(addr => (
                <div key={addr.id} className={cn(
                  "bg-card border rounded-2xl p-5 transition-all",
                  addr.is_default ? "border-foreground/30 shadow-sm" : "border-border"
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground">{addr.full_name}</span>
                        {addr.is_default && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" /> Utama
                          </span>
                        )}
                        {addr.label && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{addr.label}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{addr.phone}</p>
                      <p className="text-sm text-foreground mt-1">{addr.full_address}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[addr.village_name, addr.district_name, addr.regency_name, addr.province_name, addr.postal_code].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!addr.is_default && (
                        <Button variant="ghost" size="sm" onClick={() => setDefault(addr.id)} className="text-xs h-8">
                          Jadikan Utama
                        </Button>
                      )}
                      <button onClick={() => openEdit(addr)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(addr.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Address Modal */}
      <Dialog open={modalOpen} onOpenChange={v => { if (!v) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAddr ? "Edit Alamat" : "Tambah Alamat Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Label</Label>
                <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Rumah / Kantor" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nama Lengkap</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama penerima" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telepon</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>

            {/* Wilayah selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Provinsi</Label>
                <select
                  value={province || ""}
                  onChange={e => {
                    const code = e.target.value;
                    const prov = provinces.find((p: any) => p.code === code);
                    setProvince(code || null);
                    setProvinceName(prov?.name || "");
                    setRegency(null); setRegencyName(""); setDistrict(null); setDistrictName(""); setVillage(null); setVillageName("");
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Pilih Provinsi</option>
                  {provinces.map((p: any) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kota/Kabupaten</Label>
                <select
                  value={regency || ""}
                  onChange={e => {
                    const code = e.target.value;
                    const reg = regencies.find((r: any) => r.code === code);
                    setRegency(code || null);
                    setRegencyName(reg?.name || "");
                    setDistrict(null); setDistrictName(""); setVillage(null); setVillageName("");
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  disabled={!province}
                >
                  <option value="">Pilih Kota</option>
                  {regencies.map((r: any) => (
                    <option key={r.code} value={r.code}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kecamatan</Label>
                <select
                  value={district || ""}
                  onChange={e => {
                    const code = e.target.value;
                    const dist = districts.find((d: any) => d.code === code);
                    setDistrict(code || null);
                    setDistrictName(dist?.name || "");
                    setVillage(null); setVillageName("");
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  disabled={!regency}
                >
                  <option value="">Pilih Kecamatan</option>
                  {districts.map((d: any) => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kelurahan</Label>
                <select
                  value={village || ""}
                  onChange={e => {
                    const code = e.target.value;
                    const vil = villages.find((v: any) => v.code === code);
                    setVillage(code || null);
                    setVillageName(vil?.name || "");
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  disabled={!district}
                >
                  <option value="">Pilih Kelurahan</option>
                  {villages.map((v: any) => (
                    <option key={v.code} value={v.code}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alamat Lengkap</Label>
              <Input value={fullAddress} onChange={e => setFullAddress(e.target.value)} placeholder="Jl. Contoh No. 123, RT 01/RW 02" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kode Pos</Label>
              <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="60123" className="max-w-[140px]" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Batal</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editAddr ? "Perbarui" : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
