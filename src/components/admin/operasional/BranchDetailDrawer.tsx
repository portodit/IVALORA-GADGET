import { useState, useEffect, useCallback } from "react";
import { X, Building2, MapPin, Phone, Users, Edit2, ToggleLeft, ToggleRight, UserCheck, Navigation, ExternalLink, Hash, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/shared/use-toast";
import { BranchFormModal } from "@/components/admin/operasional/BranchFormModal";
import type { Branch } from "@/pages/admin/operasional/ManajemenCabangPage";

interface StaffMember {
  user_id: string;
  is_default: boolean;
  user_profiles: {
    email: string;
    full_name: string | null;
    status: string;
  } | null;
  user_roles: {
    role: string;
  }[] | null;
}

interface Props {
  branch: Branch | null;
  onClose: () => void;
  onUpdate: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  admin_branch: "Admin Cabang",
  employee: "Karyawan",
  super_admin: "Super Admin",
};

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border/60 mx-4" />;
}

export function BranchDetailDrawer({ branch, onClose, onUpdate }: Props) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchStaff = useCallback(async () => {
    if (!branch) return;
    setStaffLoading(true);
    
    // Query user_branches without join (no FK to user_profiles)
    const { data: branchUsers } = await supabase
      .from("user_branches")
      .select("user_id, is_default")
      .eq("branch_id", branch.id);

    if (branchUsers && branchUsers.length > 0) {
      const staffWithDetails = await Promise.all(
        branchUsers.map(async (ub: any) => {
          const [{ data: profile }, { data: roles }] = await Promise.all([
            supabase.from("user_profiles").select("email, full_name, status").eq("id", ub.user_id).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", ub.user_id),
          ]);
          return {
            user_id: ub.user_id,
            is_default: ub.is_default,
            user_profiles: profile ?? null,
            user_roles: roles ?? [],
          };
        })
      );
      setStaff(staffWithDetails as StaffMember[]);
    } else {
      setStaff([]);
    }
    setStaffLoading(false);
  }, [branch]);

  useEffect(() => {
    if (branch) fetchStaff();
  }, [branch, fetchStaff]);

  const handleToggleStatus = async () => {
    if (!branch) return;
    setToggling(true);
    const { error } = await supabase
      .from("branches")
      .update({ is_active: !branch.is_active })
      .eq("id", branch.id);
    setToggling(false);
    if (error) {
      toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Cabang berhasil di${branch.is_active ? "nonaktifkan" : "aktifkan"}` });
    onUpdate();
    onClose();
  };

  if (!branch) return null;

  const hasLocation = branch.full_address || branch.city || branch.province || branch.village || branch.district || branch.phone;
  const hasCoordinates = !!(branch.latitude && branch.longitude);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`
    : null;

  const wilayahParts = [
    branch.village ? `Kel. ${branch.village}` : null,
    branch.district ? `Kec. ${branch.district}` : null,
    branch.city || null,
    branch.province || null,
  ].filter(Boolean);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm leading-tight">{branch.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                  {branch.code}
                </span>
                <Badge
                  variant={branch.is_active ? "default" : "secondary"}
                  className="text-[10px] h-4 px-1.5"
                >
                  {branch.is_active ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Location card */}
          {hasLocation || hasCoordinates ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 pt-3 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Informasi Lokasi
                </p>
              </div>
              <Divider />

              {/* Full address */}
              {branch.full_address && (
                <>
                  <InfoRow
                    icon={<MapPin className="w-3.5 h-3.5 text-muted-foreground" />}
                    label="Alamat Lengkap"
                  >
                    <p className="text-sm text-foreground leading-relaxed">{branch.full_address}</p>
                  </InfoRow>
                  <Divider />
                </>
              )}

              {/* Wilayah grid */}
              {wilayahParts.length > 0 && (
                <>
                  <InfoRow
                    icon={<Hash className="w-3.5 h-3.5 text-muted-foreground" />}
                    label="Wilayah"
                  >
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-0.5">
                      {branch.village && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Kelurahan</p>
                          <p className="text-sm text-foreground font-medium truncate">{branch.village}</p>
                        </div>
                      )}
                      {branch.district && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Kecamatan</p>
                          <p className="text-sm text-foreground font-medium truncate">{branch.district}</p>
                        </div>
                      )}
                      {branch.city && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Kota / Kab.</p>
                          <p className="text-sm text-foreground font-medium truncate">{branch.city}</p>
                        </div>
                      )}
                      {branch.province && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Provinsi</p>
                          <p className="text-sm text-foreground font-medium truncate">{branch.province}</p>
                        </div>
                      )}
                      {branch.postal_code && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Kode Pos</p>
                          <p className="text-sm text-foreground font-medium">{branch.postal_code}</p>
                        </div>
                      )}
                    </div>
                  </InfoRow>
                  <Divider />
                </>
              )}

              {/* Phone */}
              {branch.phone && (
                <>
                  <InfoRow
                    icon={<Phone className="w-3.5 h-3.5 text-muted-foreground" />}
                    label="Telepon"
                  >
                    <a
                      href={`tel:${branch.phone}`}
                      className="text-sm text-foreground hover:text-primary transition-colors"
                    >
                      {branch.phone}
                    </a>
                  </InfoRow>
                  <Divider />
                </>
              )}

              {/* Email */}
              {(branch as any).email && (
                <>
                  <InfoRow
                    icon={<Mail className="w-3.5 h-3.5 text-muted-foreground" />}
                    label="Email"
                  >
                    <a
                      href={`mailto:${(branch as any).email}`}
                      className="text-sm text-foreground hover:text-primary transition-colors"
                    >
                      {(branch as any).email}
                    </a>
                  </InfoRow>
                  {hasCoordinates && <Divider />}
                </>
              )}
              {/* GPS & Maps */}
              {hasCoordinates && (
                <InfoRow
                  icon={<Navigation className="w-3.5 h-3.5 text-muted-foreground" />}
                  label="Koordinat GPS"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-mono text-muted-foreground">
                      {branch.latitude!.toFixed(6)}, {branch.longitude!.toFixed(6)}
                    </p>
                    <a
                      href={mapsUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Buka Google Maps
                    </a>
                  </div>
                </InfoRow>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <MapPin className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Belum ada data lokasi</p>
            </div>
          )}

          {/* Meta info */}
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Info</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Dibuat</span>
              <span>{new Date(branch.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
              <span>Diperbarui</span>
              <span>{new Date(branch.updated_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
          </div>

          {/* Staff */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Tim Cabang
              </p>
              {!staffLoading && (
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
                  {staff.length} orang
                </span>
              )}
            </div>
            <Divider />

            {staffLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-11 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : staff.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center mx-auto">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Belum ada tim</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Tambahkan admin atau karyawan melalui halaman Manajemen Admin.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {staff.map((s) => {
                  const role = s.user_roles?.[0]?.role;
                  const profile = s.user_profiles;
                  return (
                    <div key={s.user_id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {profile?.full_name || "—"}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{profile?.email}</span>
                        </div>
                      </div>
                      {role && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {ROLE_LABEL[role] ?? role}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border space-y-2 shrink-0">
          <Button
            variant="outline"
            className="w-full h-10 gap-2 text-sm"
            onClick={() => setEditOpen(true)}
          >
            <Edit2 className="w-4 h-4" />
            Edit Data Cabang
          </Button>
          <Button
            variant={branch.is_active ? "destructive" : "default"}
            className="w-full h-10 gap-2 text-sm"
            disabled={toggling}
            onClick={handleToggleStatus}
          >
            {branch.is_active ? (
              <><ToggleLeft className="w-4 h-4" /> Nonaktifkan Cabang</>
            ) : (
              <><ToggleRight className="w-4 h-4" /> Aktifkan Cabang</>
            )}
          </Button>
        </div>
      </div>

      <BranchFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => { onUpdate(); onClose(); }}
        branch={branch}
      />
    </>
  );
}
