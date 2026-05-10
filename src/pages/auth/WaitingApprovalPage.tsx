import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Mail, CheckCircle2, Shield, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/admin/AuthContext";
import { cn } from "@/lib/utils";
import logoFull from "@/assets/logo-full.svg";

export default function WaitingApprovalPage() {
  const { user, status, signOut, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [emailVerified, setEmailVerified] = useState(false);
  const [adminApproved, setAdminApproved] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Compute current verification state from auth user
  const checkState = useCallback(async () => {
    if (!user) return;
    const { data: { user: refreshed } } = await supabase.auth.getUser();
    const isEmailConfirmed = !!refreshed?.email_confirmed_at;
    setEmailVerified(isEmailConfirmed);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("status, last_resend_at")
      .eq("id", user.id)
      .single();

    if (profile?.status === "active") {
      setAdminApproved(true);
      await refreshUserData();
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    // Compute resend cooldown from last_resend_at
    if (profile?.last_resend_at) {
      const last = new Date(profile.last_resend_at).getTime();
      const elapsed = Math.floor((Date.now() - last) / 1000);
      // Cooldown doubles each resend: 15min base
      // For simplicity, track from DB. We use 15min (900s) fixed for first, etc.
      // We'll just check if less than 15 min has passed
      const cooldownSec = Math.max(0, 900 - elapsed);
      setResendCooldown(cooldownSec);
    }
  }, [user, navigate, refreshUserData]);

  // Poll every 10s
  useEffect(() => {
    checkState();
    const interval = setInterval(checkState, 10000);
    return () => clearInterval(interval);
  }, [checkState]);

  // Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatCooldown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleResendEmail = async () => {
    if (!user?.email || resendCooldown > 0 || resending) return;
    setResending(true);
    setResendError(null);
    setResendSuccess(false);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: { emailRedirectTo: `${window.location.origin}/admin/login` },
      });
      if (error) throw error;

      // Record resend time in DB to enforce cooldown
      await supabase
        .from("user_profiles")
        .update({ last_resend_at: new Date().toISOString() })
        .eq("id", user.id);

      setResendCooldown(900); // 15 min
      setResendSuccess(true);
    } catch (e: unknown) {
      setResendError((e as Error).message ?? "Gagal mengirim ulang email.");
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const steps: { label: string; desc: string; done: boolean; active: boolean }[] = [
    {
      label: "Verifikasi Email",
      desc: emailVerified
        ? "Email Anda sudah terverifikasi ✓"
        : "Cek inbox dan klik link verifikasi yang dikirim ke email Anda.",
      done: emailVerified,
      active: !emailVerified,
    },
    {
      label: "Persetujuan Admin",
      desc: adminApproved
        ? "Akun Anda telah disetujui ✓"
        : "Menunggu Super Admin / Admin Cabang menyetujui akun Anda.",
      done: adminApproved,
      active: emailVerified && !adminApproved,
    },
    {
      label: "Akses Dashboard",
      desc: "Setelah disetujui, Anda dapat mengakses dashboard.",
      done: adminApproved,
      active: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <img src={logoFull} alt="Ivalora Gadget" className="h-7 invert" />
        </div>

        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Verifikasi Akun</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
              Selesaikan 2 tahap verifikasi berikut untuk mengaktifkan akun Anda.
            </p>
          </div>
        </div>

        {user?.email && (
          <div className="rounded-xl border border-border bg-muted/30 px-6 py-4 flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">{user.email}</span>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3 text-left rounded-xl border border-border p-5">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-4">Status Verifikasi</p>
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={cn(
                "mt-0.5 w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold transition-all",
                step.done
                  ? "bg-foreground text-background"
                  : step.active
                    ? "border-2 border-foreground text-foreground"
                    : "border border-border text-muted-foreground"
              )}>
                {step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold", step.done ? "text-foreground" : step.active ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Resend email section — only if email not verified */}
        {!emailVerified && (
          <div className="rounded-xl border border-border p-5 space-y-3 text-left">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4" /> Tidak menerima email?
            </p>
            <p className="text-xs text-muted-foreground">
              Periksa folder spam Anda. Jika masih belum ada, klik tombol di bawah untuk mengirim ulang.
            </p>
            {resendSuccess && (
              <p className="text-xs text-[hsl(var(--status-available-fg))] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Email verifikasi berhasil dikirim ulang.
              </p>
            )}
            {resendError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {resendError}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleResendEmail}
              disabled={resendCooldown > 0 || resending}
            >
              {resending ? (
                <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {resendCooldown > 0
                ? `Kirim ulang dalam ${formatCooldown(resendCooldown)}`
                : "Kirim Ulang Email Verifikasi"}
            </Button>
          </div>
        )}

        {/* Admin approved but need to go to dashboard */}
        {emailVerified && adminApproved && (
          <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" /> Akun telah aktif!
            </p>
            <Button className="w-full h-11" onClick={() => navigate("/admin/dashboard", { replace: true })}>
              Masuk ke Dashboard
            </Button>
          </div>
        )}

        <Button variant="outline" className="w-full h-11" onClick={handleSignOut}>
          Keluar dari akun ini
        </Button>
      </div>
    </div>
  );
}
