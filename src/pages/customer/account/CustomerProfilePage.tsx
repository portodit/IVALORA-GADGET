import { useState, useEffect } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, Loader2, Mail, Phone, Edit3 } from "lucide-react";
import { useCustomerAuth } from "@/contexts/customer/CustomerAuthContext";
import { supabaseCustomer } from "@/integrations/supabase/customer-client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function CustomerProfilePage() {
  const { user, isLoading: authLoading } = useCustomerAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setEmail(user.email || "");
      // Load phone from saved address
      supabaseCustomer
        .from("customer_addresses")
        .select("phone")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) setPhone((data[0] as any).phone || "");
        });
    }
  }, [user, authLoading, navigate]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabaseCustomer.auth.updateUser({
        data: { full_name: fullName },
      });
      if (error) throw error;

      // Update phone in default address if exists
      if (phone) {
        const { data: existing } = await supabaseCustomer
          .from("customer_addresses")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_default", true)
          .limit(1);
        if (existing?.[0]) {
          await supabaseCustomer
            .from("customer_addresses")
            .update({ phone, full_name: fullName } as any)
            .eq("id", (existing[0] as any).id);
        }
      }

      toast.success("Profil berhasil diperbarui");
      setEditing(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
          <h1 className="text-2xl font-bold text-foreground mb-1">Profil Saya</h1>
          <p className="text-sm text-muted-foreground mb-8">Kelola informasi akun Anda.</p>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-8 flex items-center gap-5 border-b border-border bg-muted/20">
              <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center text-background text-2xl font-bold shrink-0">
                {initials || <User className="w-8 h-8" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-foreground truncate">{fullName || "Pengguna"}</p>
                <p className="text-sm text-muted-foreground truncate">{email}</p>
              </div>
              {!editing && (
                <Button variant="outline" onClick={() => setEditing(true)} className="gap-2 shrink-0">
                  <Edit3 className="w-4 h-4" /> Edit Profil
                </Button>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Nama Lengkap
                </Label>
                {editing ? (
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama lengkap" className="max-w-md" />
                ) : (
                  <p className="text-sm text-foreground">{fullName || "—"}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> Email
                </Label>
                <p className="text-sm text-foreground">{email}</p>
                <p className="text-[10px] text-muted-foreground">Email tidak dapat diubah.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> Nomor Telepon
                </Label>
                {editing ? (
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="max-w-md" />
                ) : (
                  <p className="text-sm text-foreground">{phone || "—"}</p>
                )}
              </div>

              {editing && (
                <div className="flex items-center gap-3 pt-3">
                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Simpan
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Batal</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
