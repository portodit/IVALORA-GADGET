import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/admin/laporan/activity-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormAlert } from "@/components/ui/form-alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthLayout } from "@/components/shared/AuthLayout";
import { AuthHeroPanel } from "@/components/shared/AuthHeroPanel";
import { AuthFooter } from "@/components/shared/AuthFooter";
import { SuccessScreen } from "@/components/shared/SuccessScreen";
import { Label, Caption, H2, BodySm } from "@/components/shared";
import { useRecaptcha } from "@/hooks/shared/use-recaptcha";
import logoFull from "@/assets/logo-full.svg";
import storeFront from "@/assets/ruko.jpg";

/* ── Schema ───────────────────────────────────────────────────────────── */
const schema = z.object({
  full_name: z.string().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().email("Email tidak valid").max(255),
  role: z.enum(["admin_branch", "employee", "web_admin"], { required_error: "Pilih role" }),
  branch_id: z.string().optional(),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Harus mengandung huruf kapital")
    .regex(/[0-9]/, "Harus mengandung angka"),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: "Password tidak cocok",
  path: ["confirm_password"],
}).refine(d => {
  if (d.role !== "web_admin") return d.branch_id && d.branch_id.length > 0;
  return true;
}, {
  message: "Pilih cabang",
  path: ["branch_id"],
});

type FormData = z.infer<typeof schema>;

interface BranchOption { id: string; name: string; city: string | null; }

const ROLE_OPTIONS = [
  { value: "admin_branch", label: "Admin Cabang",  desc: "Kelola operasional cabang, stok, dan tim",          needsBranch: true  },
  { value: "employee",     label: "Karyawan Cabang", desc: "Akses operasional terbatas di cabang tertentu",   needsBranch: true  },
  { value: "web_admin",    label: "Admin Website",  desc: "Kelola katalog produk dan konten website",         needsBranch: false },
] as const;

/* ── Registration Steps (hero panel extra) ────────────────────────────── */
function RegistrationSteps({ steps }: { steps: string[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border border-white/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] text-white/50 font-semibold">{i + 1}</span>
          </div>
          <span className="text-white/60 text-sm">{step}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function AdminRegisterPage() {
  const { getToken, verifyToken } = useRecaptcha();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone]               = useState(false);
  const [branches, setBranches]       = useState<BranchOption[]>([]);

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "admin_branch", branch_id: "" },
  });

  const selectedRole = watch("role");
  const needsBranch  = selectedRole !== "web_admin";

  const steps = selectedRole === "employee"
    ? ["Verifikasi email", "Review oleh Admin Cabang / Super Admin", "Akses penuh dashboard"]
    : ["Verifikasi email", "Review oleh Super Admin", "Akses penuh dashboard"];

  useEffect(() => {
    supabase
      .from("branches")
      .select("id, name, city")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const rcToken = await getToken("register");
    if (rcToken) await verifyToken(rcToken, "register");

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin/login`,
        data: {
          full_name: data.full_name,
          requested_role: data.role,
          requested_branch_id: needsBranch ? data.branch_id : null,
        },
      },
    });

    if (error) {
      setServerError(
        error.message.includes("already registered")
          ? "Email ini sudah terdaftar."
          : error.message,
      );
      return;
    }

    await logActivity({
      action: "register",
      actor_email: data.email,
      metadata: { full_name: data.full_name, role: data.role, branch_id: needsBranch ? data.branch_id : null },
    });
    setDone(true);
  };

  /* ── Success screen ───────────────────────────────────────────────── */
  if (done) {
    return (
      <SuccessScreen
        title="Cek email Anda"
        description="Link verifikasi telah dikirim ke email Anda. Klik link tersebut, lalu tunggu persetujuan admin untuk mengaktifkan akun."
        action={
          <Link
            to="/admin/login"
            className="block text-sm font-semibold text-foreground hover:underline underline-offset-4"
          >
            Kembali ke halaman login
          </Link>
        }
      />
    );
  }

  /* ── Hero panel ───────────────────────────────────────────────────── */
  const hero = (
    <AuthHeroPanel
      image={storeFront}
      logo={logoFull}
      tag="Registrasi Admin"
      title={<>Pusat Jual Beli<br />iPhone Surabaya</>}
      bottomPosition="bottom-1/4"
      extra={<RegistrationSteps steps={steps} />}
    />
  );

  /* ── Register form ────────────────────────────────────────────────── */
  return (
    <AuthLayout hero={hero}>
      {/* Mobile logo */}
      <div className="lg:hidden flex justify-center mb-6">
        <img src={logoFull} alt="IVALORA Gadget" className="h-7 invert" />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-7">
          {/* Header */}
          <div className="space-y-1">
            <H2 className="tracking-tight">Daftar Akun Admin</H2>
            <BodySm className="text-muted-foreground">Pilih role Anda, lalu isi data untuk mendaftar</BodySm>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Role */}
            <div className="space-y-1.5">
              <Label as="label">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-11 bg-background">
                      <SelectValue placeholder="Pilih role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          <span className="font-medium">{r.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {r.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <Caption className="text-destructive">{errors.role.message}</Caption>}
            </div>

            {/* Branch — conditional */}
            {needsBranch && (
              <div className="space-y-1.5">
                <Label as="label">Cabang</Label>
                <Controller
                  control={control}
                  name="branch_id"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className="h-11 bg-background">
                        <SelectValue placeholder="Pilih cabang" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}{b.city ? ` (${b.city})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.branch_id && <Caption className="text-destructive">{errors.branch_id.message}</Caption>}
              </div>
            )}

            {/* Full name */}
            <div className="space-y-1.5">
              <Label as="label" htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                placeholder="Masukkan nama lengkap Anda"
                className="h-11 bg-background"
                {...register("full_name")}
              />
              {errors.full_name && <Caption className="text-destructive">{errors.full_name.message}</Caption>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label as="label" htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Masukkan alamat email Anda"
                className="h-11 bg-background"
                {...register("email")}
              />
              {errors.email && <Caption className="text-destructive">{errors.email.message}</Caption>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label as="label" htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="Min. 8 karakter, huruf kapital & angka"
                className="h-11 bg-background"
                {...register("password")}
              />
              {errors.password && <Caption className="text-destructive">{errors.password.message}</Caption>}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label as="label" htmlFor="confirm_password">Konfirmasi Password</Label>
              <PasswordInput
                id="confirm_password"
                placeholder="Ulangi password Anda"
                className="h-11 bg-background"
                {...register("confirm_password")}
              />
              {errors.confirm_password && <Caption className="text-destructive">{errors.confirm_password.message}</Caption>}
            </div>

            {serverError && <FormAlert variant="error">{serverError}</FormAlert>}

            <Button
              type="submit"
              className="w-full h-11 gap-2 font-semibold mt-1"
              loading={isSubmitting}
            >
              Daftar <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <BodySm className="text-center text-muted-foreground">
            Sudah punya akun?{" "}
            <Link to="/admin/login" className="font-semibold text-foreground hover:underline underline-offset-4">
              Masuk
            </Link>
          </BodySm>
        </div>
      </div>

      <AuthFooter />
    </AuthLayout>
  );
}
