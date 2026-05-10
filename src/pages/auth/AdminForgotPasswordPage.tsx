import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoFull from "@/assets/logo-full.svg";

const schema = z.object({
  email: z.string().email("Email tidak valid"),
});
type FormData = z.infer<typeof schema>;

export default function AdminForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Cek email Anda</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Link reset password telah dikirim ke{" "}
                <span className="font-medium text-foreground">{getValues("email")}</span>.
                <br />Berlaku selama <span className="font-medium">1 jam</span>.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground text-left space-y-1">
            <p className="font-medium text-foreground">Tidak menerima email?</p>
            <p>Periksa folder spam atau junk mail Anda. Jika masih tidak ada, coba kirim ulang dari halaman sebelumnya.</p>
          </div>
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke halaman login
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
        <div className="space-y-2 text-center sm:text-left">
          <div className="flex justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Lupa password?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Masukkan alamat email akun admin Anda dan kami akan mengirimkan link untuk membuat password baru.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Email Admin
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Masukkan alamat email Anda"
              {...register("email")}
              className="h-11"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
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
              "Kirim Link Reset Password"
            )}
          </Button>
        </form>

        <Link
          to="/admin/login"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke halaman login
        </Link>

        <p className="text-center text-xs text-muted-foreground/50">
          Ivalora Gadget RMS · Admin Panel
        </p>
      </div>
    </div>
  );
}
