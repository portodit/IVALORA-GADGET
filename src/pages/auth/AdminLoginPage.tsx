import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Clock, ShieldCheck, Mail, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { FormAlert } from "@/components/ui/form-alert";
import { ResendButton } from "@/components/ui/resend-button";
import { AuthLayout } from "@/components/shared/AuthLayout";
import { AuthHeroPanel } from "@/components/shared/AuthHeroPanel";
import { AuthFooter } from "@/components/shared/AuthFooter";
import { Label, Caption, H2, BodySm, BodyMd } from "@/components/shared";
import { useRecaptcha } from "@/hooks/shared/use-recaptcha";
import { logActivity } from "@/lib/admin/laporan/activity-log";
import logoFull from "@/assets/logo-full.svg";
import storeFront from "@/assets/ruko.jpg";

/* ── Schema ───────────────────────────────────────────────────────────── */
const schema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});
type FormData = z.infer<typeof schema>;

/* ── OTP session helpers ──────────────────────────────────────────────── */
const OTP_VERIFIED_KEY  = "ivalora_otp_verified";
const OTP_STEP_KEY      = "ivalora_otp_step";
const OTP_EXPIRY_MS     = 7 * 24 * 60 * 60 * 1000;
const OTP_STEP_EXPIRY   = 5 * 60 * 1000; // 5 menit — sesuai masa berlaku kode

function saveOtpStep(userId: string, email: string) {
  localStorage.setItem(OTP_STEP_KEY, JSON.stringify({ userId, email, ts: Date.now() }));
}

function clearOtpStep() {
  localStorage.removeItem(OTP_STEP_KEY);
}

function isOtpStillValid(): boolean {
  const stored = localStorage.getItem(OTP_VERIFIED_KEY);
  if (!stored) return false;
  try {
    const { timestamp } = JSON.parse(stored);
    return Date.now() - timestamp < OTP_EXPIRY_MS;
  } catch {
    return false;
  }
}

function markOtpVerified(userId: string) {
  localStorage.setItem(OTP_VERIFIED_KEY, JSON.stringify({ userId, timestamp: Date.now() }));
}

function getStoredOtpUserId(): string | null {
  const stored = localStorage.getItem(OTP_VERIFIED_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored).userId;
  } catch {
    return null;
  }
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function AdminLoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { getToken, verifyToken } = useRecaptcha();

  const [showPassword, setShowPassword]   = useState(false);
  const [serverError,  setServerError]    = useState<string | null>(null);

  // OTP state
  const [otpStep,        setOtpStep]        = useState(false);
  const [otpDigits,      setOtpDigits]      = useState(Array(6).fill(""));
  const [otpUserId,      setOtpUserId]      = useState<string | null>(null);
  const [otpEmail,       setOtpEmail]       = useState<string | null>(null);
  const [otpLoading,     setOtpLoading]     = useState(false);
  const [otpError,       setOtpError]       = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [magicSent,      setMagicSent]      = useState(false);
  const [magicLoading,   setMagicLoading]   = useState(false);

  const state = location.state as { blocked?: boolean; status?: string } | null;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  /* ── Handle magic link redirect (hash contains access_token) ───────────── */
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      markOtpVerified(user.id);
      clearOtpStep();
      window.history.replaceState(null, "", window.location.pathname);
      await proceedAfterOtp(user.id, user.email ?? "");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Restore OTP step from localStorage (persists across browser close) ── */
  useEffect(() => {
    const stored = localStorage.getItem(OTP_STEP_KEY);
    if (!stored) return;
    try {
      const { userId, email, ts } = JSON.parse(stored);
      if (Date.now() - ts < OTP_STEP_EXPIRY) {
        setOtpUserId(userId);
        setOtpEmail(email);
        setOtpStep(true);
        const elapsed = Math.floor((Date.now() - ts) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        if (remaining > 0) setResendCooldown(remaining);
      } else {
        clearOtpStep();
      }
    } catch {
      clearOtpStep();
    }
  }, []);

  /* ── Cooldown timer ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  /* ── Login submit ───────────────────────────────────────────────────── */
  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const rcToken = await getToken("login");
    if (rcToken) await verifyToken(rcToken, "login");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError?.message.includes("Email not confirmed")) {
      const { data: profileByEmail } = await supabase
        .from("user_profiles")
        .select("id, status")
        .eq("email", data.email)
        .maybeSingle();

      if (profileByEmail) {
        if (profileByEmail.status === "pending") {
          navigate("/admin/waiting-approval", { replace: true });
          return;
        }
        const { data: roleCheck } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profileByEmail.id)
          .maybeSingle();

        const allowedRoles = ["super_admin", "admin_branch", "employee", "web_admin"];
        if (roleCheck && allowedRoles.includes(roleCheck.role)) {
          navigate("/admin/waiting-approval", { replace: true });
          return;
        }
      }
      setServerError("Email belum diverifikasi. Periksa inbox Anda.");
      return;
    }

    if (authError) {
      setServerError(
        authError.message.includes("Invalid login credentials")
          ? "Email atau password salah."
          : authError.message,
      );
      return;
    }

    if (!authData?.user) return;

    if (isOtpStillValid() && getStoredOtpUserId() === authData.user.id) {
      await proceedAfterOtp(authData.user.id, authData.user.email || data.email);
      return;
    }

    setOtpUserId(authData.user.id);
    setOtpEmail(authData.user.email || data.email);
    await sendOtpCode(authData.user.id, authData.user.email || data.email);
    saveOtpStep(authData.user.id, authData.user.email || data.email);
    setOtpStep(true);
  };

  /* ── OTP helpers ────────────────────────────────────────────────────── */
  const sendOtpCode = async (userId: string, email: string) => {
    setOtpError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("send-login-otp", {
        body: { user_id: userId, email },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setResendCooldown(60);
    } catch (err: any) {
      setOtpError("Gagal mengirim kode verifikasi: " + (err.message || "Unknown error"));
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !otpUserId || !otpEmail) return;
    setOtpDigits(Array(6).fill(""));
    await sendOtpCode(otpUserId, otpEmail);
  };

  const handleSendMagicLink = async () => {
    if (!otpEmail || magicLoading) return;
    setMagicLoading(true);
    setOtpError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (err: any) {
      setOtpError("Gagal kirim link: " + (err.message || "Unknown error"));
    } finally {
      setMagicLoading(false);
    }
  };

  const verifyOtp = async () => {
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setOtpError("Masukkan 6 digit kode verifikasi");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-login-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ user_id: otpUserId, code }),
        },
      );
      const fnData = await response.json();
      if (!response.ok || fnData?.error) {
        setOtpError(fnData?.error || "Verifikasi gagal");
        setOtpLoading(false);
        return;
      }
      markOtpVerified(otpUserId!);
      await proceedAfterOtp(otpUserId!, otpEmail!);
    } catch (err: any) {
      setOtpError(err.message || "Verifikasi gagal");
    } finally {
      setOtpLoading(false);
    }
  };

  const proceedAfterOtp = async (userId: string, email: string) => {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("status")
      .eq("id", userId)
      .single();

    const status = profile?.status;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const allowedRoles = ["super_admin", "admin_branch", "employee", "web_admin"];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      if (status === "pending") {
        navigate("/admin/waiting-approval", { replace: true });
        return;
      }
      await supabase.auth.signOut();
      setServerError("Akun ini tidak memiliki akses ke panel admin.");
      return;
    }

    await logActivity({
      action: "admin_login",
      actor_id: userId,
      actor_email: email,
      metadata: { status },
    });

    if (status === "pending") {
      navigate("/admin/waiting-approval", { replace: true });
    } else if (status === "suspended") {
      await supabase.auth.signOut();
      setServerError("Akun Anda telah disuspend. Hubungi administrator.");
    } else if (status === "rejected") {
      await supabase.auth.signOut();
      setServerError("Akun Anda ditolak. Hubungi administrator.");
    } else {
      clearOtpStep();
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/admin/dashboard";
      navigate(from, { replace: true });
    }
  };

  /* ── Hero panel — Login ──────────────────────────────────────────────── */
  const loginHero = (
    <AuthHeroPanel
      image={storeFront}
      logo={logoFull}
      tag="Dashboard Admin"
      title={<>Pusat Jual Beli<br />iPhone Surabaya</>}
      subtitle="Kelola penjualan, stok IMEI, dan laporan dalam satu platform."
    />
  );

  /* ── Hero panel — OTP (sama dengan login, pakai storefront) ─────────── */
  const otpHero = (
    <AuthHeroPanel
      image={storeFront}
      logo={logoFull}
      tag="Verifikasi Login"
      title={<>Keamanan<br />Akun Anda</>}
      subtitle="Kode OTP dikirim ke email terdaftar."
    />
  );

  /* ── OTP view ────────────────────────────────────────────────────────── */
  if (otpStep) {
    return (
      <AuthLayout hero={otpHero}>
        {/* Mobile logo */}
        <div className="lg:hidden flex justify-center mb-6">
          <img src={logoFull} alt="IVALORA Gadget" className="h-7 invert" />
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md space-y-6">

            {/* Shield icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-foreground flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-10 h-10 text-background" strokeWidth={1.5} />
              </div>
            </div>

            {/* Header */}
            <div className="space-y-1 text-center">
              <Label>Verifikasi OTP</Label>
              <H2 className="tracking-tight whitespace-nowrap">Masukkan kode konfirmasi</H2>
              <BodySm className="text-muted-foreground">
                Kode 6 digit telah dikirim ke{" "}
                <BodyMd as="span" className="font-bold text-foreground">{otpEmail}</BodyMd>
              </BodySm>
            </div>

            {/* OTP input */}
            <OtpInput
              value={otpDigits}
              onChange={setOtpDigits}
              onEnter={() => { if (otpDigits.join("").length === 6) verifyOtp(); }}
              hasError={!!otpError}
              disabled={otpLoading}
            />

            {otpError && <FormAlert variant="error">{otpError}</FormAlert>}

            {/* Verify button */}
            <Button
              onClick={verifyOtp}
              className="w-full h-11 gap-2 font-semibold"
              disabled={otpLoading || otpDigits.join("").length !== 6}
              loading={otpLoading}
            >
              Verifikasi <ArrowRight className="w-4 h-4" />
            </Button>

            {/* Resend */}
            <ResendButton
              cooldown={resendCooldown}
              onResend={handleResendOtp}
            />

            {/* Info section */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                <BodySm className="text-muted-foreground">
                  Kode OTP berlaku selama{" "}
                  <span className="font-semibold text-foreground">5 menit</span>.
                  Jika habis, klik <span className="font-medium text-foreground">Kirim Ulang</span>.
                </BodySm>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                <BodySm className="text-muted-foreground">
                  Sebagai alternatif, gunakan{" "}
                  <span className="font-semibold text-foreground">link verifikasi</span>{" "}
                  yang tidak terbatas waktu — klik tombol di bawah.
                </BodySm>
              </div>
            </div>

            {/* Magic link */}
            {magicSent ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                <BodySm className="text-green-700">
                  Link verifikasi dikirim ke <span className="font-semibold">{otpEmail}</span>.
                  Buka email & klik link tersebut — tidak ada batas waktu.
                </BodySm>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 gap-2 text-sm"
                onClick={handleSendMagicLink}
                loading={magicLoading}
                disabled={magicLoading}
              >
                <Mail className="w-4 h-4" />
                Kirim link verifikasi ke email
              </Button>
            )}

            {/* Back — text button */}
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  clearOtpStep();
                  setOtpStep(false);
                  setOtpDigits(Array(6).fill(""));
                  setMagicSent(false);
                  supabase.auth.signOut();
                }}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ← Kembali ke Login
              </Button>
            </div>

          </div>
        </div>

        <AuthFooter />
      </AuthLayout>
    );
  }

  /* ── Login view ──────────────────────────────────────────────────────── */
  return (
    <AuthLayout hero={loginHero}>
      {/* Mobile logo */}
      <div className="lg:hidden flex justify-center mb-6">
        <img src={logoFull} alt="IVALORA Gadget" className="h-7 invert" />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-8">
          {/* Header */}
          <div className="space-y-1">
            <Label>Panel Admin</Label>
            <H2 className="tracking-tight">Masuk ke akun admin</H2>
            <BodySm className="text-muted-foreground">Gunakan email dan password yang terdaftar</BodySm>
          </div>

          {/* Blocked alert */}
          {state?.blocked && (
            <FormAlert variant="error">
              {state.status === "suspended"
                ? "Akun Anda telah disuspend."
                : "Akun Anda ditolak oleh administrator."}
            </FormAlert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label as="label" htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email admin"
                autoComplete="email"
                className="h-11 bg-background"
                {...register("email")}
              />
              {errors.email && (
                <Caption className="text-destructive">{errors.email.message}</Caption>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label as="label" htmlFor="password">Password</Label>
                <Link
                  to="/admin/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Lupa password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password Anda"
                  autoComplete="current-password"
                  className="h-11 pr-10 bg-background"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <Caption className="text-destructive">{errors.password.message}</Caption>
              )}
            </div>

            {serverError && <FormAlert variant="error">{serverError}</FormAlert>}

            <Button
              type="submit"
              className="w-full h-11 gap-2 font-semibold"
              loading={isSubmitting}
            >
              Masuk <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <BodySm className="text-center text-muted-foreground">
            Belum punya akun?{" "}
            <Link to="/admin/register" className="font-semibold text-foreground hover:underline underline-offset-4">
              Daftar sebagai Admin
            </Link>
          </BodySm>
        </div>
      </div>

      <AuthFooter />
    </AuthLayout>
  );
}
