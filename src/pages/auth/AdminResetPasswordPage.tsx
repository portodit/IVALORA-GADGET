import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoFull from "@/assets/logo-full.svg";

const schema = z.object({
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Harus mengandung huruf kapital")
    .regex(/[0-9]/, "Harus mengandung angka"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Password tidak cocok",
  path: ["confirm"],
});
type FormData = z.infer<typeof schema>;

export default function AdminResetPasswordPage() {
  const navigate = useNavigate();
  const [isRecovery, setIsRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const passwordValue = watch("password", "");
  const rules = [
    { label: "Minimal 8 karakter", ok: passwordValue.length >= 8 },
    { label: "Mengandung huruf kapital", ok: /[A-Z]/.test(passwordValue) },
    { label: "Mengandung angka", ok: /[0-9]/.test(passwordValue) },
  ];

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setIsRecovery(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) { setServerError(error.message); return; }
    setDone(true);
    setTimeout(() => navigate("/admin/login"), 3000);
  };

  // Invalid / expired link
  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Link tidak valid</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Link reset password ini tidak valid atau sudah kedaluwarsa. Silakan minta link baru.
            </p>
          </div>
          <Link
            to="/admin/forgot-password"
            className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Minta Link Baru
          </Link>
          <Link to="/admin/login" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
            Kembali ke login
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Password berhasil diperbarui!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Password akun Anda telah berhasil diubah. Anda akan diarahkan ke halaman login dalam beberapa detik.
            </p>
          </div>
          <Link
            to="/admin/login"
            className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Masuk Sekarang
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img src={logoFull} alt="Ivalora Gadget" className="h-7 invert" />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Buat password baru</h2>
          <p className="text-sm text-muted-foreground">
            Masukkan password baru untuk akun admin Anda.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Password Baru
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 karakter, huruf kapital & angka"
                {...register("password")}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}

            {/* Password strength indicators */}
            {passwordValue.length > 0 && (
              <div className="space-y-1 pt-1">
                {rules.map((rule) => (
                  <div key={rule.label} className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${rule.ok ? "bg-primary/20" : "bg-muted"}`}>
                      {rule.ok && (
                        <svg className="w-2 h-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs ${rule.ok ? "text-primary" : "text-muted-foreground"}`}>{rule.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Konfirmasi Password
            </Label>
            <div className="relative">
              <Input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Ulangi password baru Anda"
                {...register("confirm")}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>

          {serverError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              "Simpan Password Baru"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground/50">
          Ivalora Gadget RMS · Admin Panel
        </p>
      </div>
    </div>
  );
}
