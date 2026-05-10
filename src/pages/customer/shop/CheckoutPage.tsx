import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ArrowRight, ShoppingBag, Tag, User, MapPin, Truck,
  CreditCard, CheckCircle2, AlertCircle, Shield, LogIn, UserPlus,
  Loader2, Package, ChevronDown, Building2, QrCode, Wallet, Landmark,
  ShoppingCart, BadgePercent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/shared/LocaleContext";
import { useCustomerAuth } from "@/contexts/customer/CustomerAuthContext";
import { supabaseCustomer } from "@/integrations/supabase/customer-client";
import { getCart, clearCart, type CartItem } from "@/pages/customer/shop/CartPage";
import { useToast } from "@/hooks/shared/use-toast";
import { useProvinces, useRegencies, useDistricts, useVillages } from "@/hooks/admin/use-wilayah";
import { z } from "zod";

const USD_RATE = 15500;

function useFormatPrice() {
  const { currency } = useLocale();
  return (n: number | null | undefined) => {
    if (!n && n !== 0) return "—";
    if (currency === "USD") {
      return "$" + (n / USD_RATE).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return "Rp" + n.toLocaleString("id-ID");
  };
}

const WARRANTY_SHORT: Record<string, string> = {
  resmi_bc: "Resmi BC", ibox: "Resmi iBox", inter: "Inter", whitelist: "Whitelist", digimap: "Digimap",
};

const STEPS = [
  { key: "info", label: "Informasi Pemesanan", icon: User },
  { key: "shipping", label: "Pengiriman", icon: Truck },
  { key: "payment", label: "Pembayaran", icon: CreditCard },
] as const;

type Step = typeof STEPS[number]["key"];

// ── Payment categories for Xendit ─────────────────────────────────────────────
const PAYMENT_CATEGORIES = [
  {
    key: "va",
    label: "Virtual Account",
    description: "BCA, BNI, BRI, Mandiri, Permata, BSI, CIMB & lainnya",
    icon: Building2,
    xenditMethods: ["BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "BSI", "BJB", "BNC", "CIMB", "SAHABAT_SAMPOERNA"],
  },
  {
    key: "qris",
    label: "QRIS",
    description: "Scan QR dari semua aplikasi (GoPay, OVO, DANA, ShopeePay, dll)",
    icon: QrCode,
    xenditMethods: ["QRIS"],
  },
  {
    key: "ewallet",
    label: "E-Wallet",
    description: "OVO, DANA, ShopeePay, LinkAja, AstraPay & lainnya",
    icon: Wallet,
    xenditMethods: ["OVO", "DANA", "SHOPEEPAY", "LINKAJA", "ASTRAPAY", "JENIUSPAY", "NEXCASH"],
  },
  {
    key: "cards",
    label: "Kartu Kredit / Debit",
    description: "Visa, Mastercard, JCB",
    icon: CreditCard,
    xenditMethods: ["CREDIT_CARD"],
  },
  {
    key: "otc",
    label: "Retail / Minimarket",
    description: "Alfamart, Indomaret",
    icon: ShoppingCart,
    xenditMethods: ["ALFAMART", "INDOMARET"],
  },
  {
    key: "paylater",
    label: "PayLater / Cicilan",
    description: "Kredivo, Akulaku, Atome, Indodana",
    icon: BadgePercent,
    xenditMethods: ["KREDIVO", "AKULAKU", "ATOME", "INDODANA"],
  },
] as const;

// ── Validation schemas ────────────────────────────────────────────────────────
const customerInfoSchema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().email("Email tidak valid"),
  phone: z.string().min(10, "Nomor telepon minimal 10 digit").max(15),
});

// ── Main Checkout Page ────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate();
  const formatPrice = useFormatPrice();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useCustomerAuth();
  const [items] = useState<CartItem[]>(() => getCart());
  const [step, setStep] = useState<Step>("info");
  const [discountCode, setDiscountCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{ code: string; amount: number; shippingDiscount: number; coverPackingKayu: boolean } | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([]);
  const [showDiscountList, setShowDiscountList] = useState(false);

  // Restore cached checkout data from localStorage
  const cached = useMemo(() => {
    try {
      const raw = localStorage.getItem("checkout_cache");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  // Step 1: Info
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [fullName, setFullName] = useState(cached?.fullName ?? "");
  const [email, setEmail] = useState(cached?.email ?? "");
  const [phone, setPhone] = useState(cached?.phone ?? "");
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});

  // Address
  const [province, setProvince] = useState<string | null>(cached?.province ?? null);
  const [provinceName, setProvinceName] = useState(cached?.provinceName ?? "");
  const [regency, setRegency] = useState<string | null>(cached?.regency ?? null);
  const [regencyName, setRegencyName] = useState(cached?.regencyName ?? "");
  const [district, setDistrict] = useState<string | null>(cached?.district ?? null);
  const [districtName, setDistrictName] = useState(cached?.districtName ?? "");
  const [village, setVillage] = useState<string | null>(cached?.village ?? null);
  const [villageName, setVillageName] = useState(cached?.villageName ?? "");
  const [fullAddress, setFullAddress] = useState(cached?.fullAddress ?? "");
  const [postalCode, setPostalCode] = useState(cached?.postalCode ?? "");

  // Step 2: Shipping
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>(() => {
    try {
      const raw = localStorage.getItem("checkout_shipping_cache");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      // Only restore if address hasn't changed
      if (parsed.addressKey === `${cached?.district ?? ""}|${cached?.regency ?? ""}`) {
        return parsed.options ?? [];
      }
      return [];
    } catch { return []; }
  });
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  // Step 3: Payment
  const [selectedPaymentCategory, setSelectedPaymentCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [packingKayu, setPackingKayu] = useState(false);
  const PACKING_KAYU_COST = 25000;

  // Wilayah hooks
  const { data: provinces, loading: provLoading } = useProvinces();
  const { data: regencies, loading: regLoading } = useRegencies(province);
  const { data: districts, loading: distLoading } = useDistricts(regency);
  const { data: villages, loading: vilLoading } = useVillages(district);

  // Save checkout form data to localStorage whenever it changes
  useEffect(() => {
    const data = {
      fullName, email, phone, province, provinceName, regency, regencyName,
      district, districtName, village, villageName, fullAddress, postalCode,
    };
    localStorage.setItem("checkout_cache", JSON.stringify(data));
  }, [fullName, email, phone, province, provinceName, regency, regencyName, district, districtName, village, villageName, fullAddress, postalCode]);

  // Auto-fill user data AND saved address
  useEffect(() => {
    if (user && !authLoading) {
      setEmail(user.email || "");
      setFullName(user.user_metadata?.full_name || "");
      setAuthMode(null);

      // Load saved address
      supabaseCustomer
        .from("customer_addresses")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .limit(1)
        .then(({ data: addresses }) => {
          if (addresses && addresses.length > 0) {
            const addr = addresses[0] as any;
            setFullName(addr.full_name || user.user_metadata?.full_name || "");
            setPhone(addr.phone || "");
            setProvince(addr.province_code || null);
            setProvinceName(addr.province_name || "");
            setRegency(addr.regency_code || null);
            setRegencyName(addr.regency_name || "");
            setDistrict(addr.district_code || null);
            setDistrictName(addr.district_name || "");
            setVillage(addr.village_code || null);
            setVillageName(addr.village_name || "");
            setFullAddress(addr.full_address || "");
            setPostalCode(addr.postal_code || "");
          }
        });
    }
  }, [user, authLoading]);

  // Fetch available discount codes
  useEffect(() => {
    async function loadDiscounts() {
      const now = new Date().toISOString();
      const { data } = await supabaseCustomer
        .from("discount_codes")
        .select("code, name, description, discount_type, discount_percent, discount_amount, min_purchase_amount, valid_until, is_stackable, max_discount_cap, shipping_subsidy_amount, shipping_subsidy_unlimited, cover_packing_kayu")
        .eq("is_active", true)
        .eq("applies_to_all", true)
        .lte("valid_from", now)
        .order("created_at", { ascending: false })
        .limit(10);
      // Filter out expired ones client-side
      const valid = (data ?? []).filter((d: any) => !d.valid_until || new Date(d.valid_until) > new Date());
      setAvailableDiscounts(valid);
    }
    loadDiscounts();
  }, []);

  // Redirect if cart empty
  useEffect(() => {
    if (items.length === 0) navigate("/keranjang", { replace: true });
  }, [items, navigate]);

  // Xendit handles payment channel selection on their hosted page - no need to fetch channels

  // Calculations
  const subtotal = items.reduce((sum, i) => sum + i.sellingPrice, 0);
  const discount = discountApplied?.amount ?? 0;
  const shippingCost = selectedShipping?.cost ?? 0;
  // Calculate shipping discount from catalog products
  const catalogShippingDiscount = useMemo(() => {
    if (shippingCost <= 0) return 0;
    const hasFreeShipping = items.some(i => i.freeShipping);
    if (hasFreeShipping) return shippingCost;
    
    let totalDiscount = 0;
    for (const item of items) {
      const type = item.shippingDiscountType ?? "none";
      const value = item.shippingDiscountValue ?? 0;
      if (type === "percentage" && value > 0) {
        totalDiscount += Math.round((shippingCost / items.length) * Math.min(value, 100) / 100);
      } else if (type === "fixed" && value > 0) {
        totalDiscount += Math.min(value, shippingCost / items.length);
      }
    }
    return Math.min(totalDiscount, shippingCost);
  }, [items, shippingCost]);
  // Combine catalog shipping discount + discount code shipping discount
  const codeShippingDiscount = discountApplied?.shippingDiscount ?? 0;
  const shippingDiscount = Math.min(catalogShippingDiscount + codeShippingDiscount, shippingCost);
  const packingCost = packingKayu ? PACKING_KAYU_COST : 0;
  const coverPackingKayu = discountApplied?.coverPackingKayu ?? false;
  const effectivePackingCost = (packingKayu && coverPackingKayu) ? 0 : packingCost;
  const finalShippingCost = Math.max(0, shippingCost - shippingDiscount) + effectivePackingCost;
  const total = Math.max(0, subtotal - discount + finalShippingCost);

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const progressValue = ((stepIndex + 1) / STEPS.length) * 100;

  // ── Step 1 validation ───────────────────────────────────────────────────────
  function validateInfo(): boolean {
    const result = customerInfoSchema.safeParse({ fullName, email, phone });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(i => { errs[i.path[0] as string] = i.message; });
      setInfoErrors(errs);
      return false;
    }
    if (!province || !regency || !district || !fullAddress.trim()) {
      setInfoErrors({ address: "Lengkapi semua data alamat pengiriman" });
      return false;
    }
    setInfoErrors({});
    return true;
  }

  async function handleNextFromInfo() {
    if (!user && !authMode) {
      toast({ title: "Pilih metode", description: "Pilih apakah sudah punya akun atau belum", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Login diperlukan", description: "Silakan login atau daftar terlebih dahulu", variant: "destructive" });
      return;
    }
    if (!validateInfo()) return;

    // Save/update customer address
    try {
      const { data: existing } = await supabaseCustomer
        .from("customer_addresses")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .limit(1);

      const addressData = {
        user_id: user.id,
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
        is_default: true,
      };

      if (existing && existing.length > 0) {
        await supabaseCustomer.from("customer_addresses").update(addressData as any).eq("id", (existing[0] as any).id);
      } else {
        await supabaseCustomer.from("customer_addresses").insert(addressData as any);
      }
    } catch (e) {
      console.error("Failed to save address:", e);
    }

    // Use cached shipping if address hasn't changed
    const cacheKey = `${district}|${regency}`;
    try {
      const raw = localStorage.getItem("checkout_shipping_cache");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.addressKey === cacheKey && Array.isArray(parsed.options) && parsed.options.length > 0) {
          setShippingOptions(parsed.options);
          setStep("shipping");
          return;
        }
      }
    } catch { /* ignore */ }

    fetchShippingOptions();
    setStep("shipping");
  }

  // ── Step 2: Fetch shipping ──────────────────────────────────────────────────
  async function resolveRajaOngkirId(keyword: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
    // Strip common prefixes for better matching
    const cleanKeyword = keyword.replace(/^(Kota|Kabupaten|Kab\.?)\s+/i, "").trim();
    const attempts = [cleanKeyword, keyword];
    for (const kw of attempts) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/rajaongkir-proxy?action=search-destination&keyword=${encodeURIComponent(kw)}`, {
          headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey },
        });
        const json = await res.json();
        if (json.data?.length > 0) {
          return json.data[0]?.id?.toString() || null;
        }
      } catch { /* ignore */ }
    }
    return null;
  }

  async function fetchShippingOptions() {
    setShippingLoading(true);
    setShippingOptions([]);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Calculate total weight from all items
      const totalWeight = items.reduce((sum, i) => sum + (i.weightGram ?? 200), 0);
      
      // Determine origin from the first item's branch
      let originId: string | null = null;
      const branchId = items[0]?.branchId;
      if (branchId) {
        const { data: branchData } = await supabaseCustomer.from("branches").select("city, district").eq("id", branchId).single();
        if (branchData?.city) {
          originId = await resolveRajaOngkirId(branchData.city, supabaseUrl, supabaseKey);
        }
        if (!originId && branchData?.district) {
          originId = await resolveRajaOngkirId(branchData.district, supabaseUrl, supabaseKey);
        }
      }
      if (!originId) originId = "3578"; // fallback Surabaya

      // Resolve destination - use village name first (most specific), then district, then regency
      let destinationId: string | null = null;
      if (villageName && districtName) {
        destinationId = await resolveRajaOngkirId(`${villageName} ${districtName}`, supabaseUrl, supabaseKey);
      }
      if (!destinationId && districtName && regencyName) {
        const cleanRegency = regencyName.replace(/^(Kota|Kabupaten|Kab\.?)\s+/i, "").trim();
        destinationId = await resolveRajaOngkirId(`${districtName} ${cleanRegency}`, supabaseUrl, supabaseKey);
      }
      if (!destinationId && districtName) {
        destinationId = await resolveRajaOngkirId(districtName, supabaseUrl, supabaseKey);
      }
      if (!destinationId && regencyName) {
        destinationId = await resolveRajaOngkirId(regencyName, supabaseUrl, supabaseKey);
      }
      if (!destinationId) {
        console.error("Could not resolve destination for:", { villageName, districtName, regencyName });
        setShippingLoading(false);
        return;
      }

      // Fetch shipping from multiple couriers in parallel (individual calls for reliability)
      const courierList = ["jne", "jnt", "sicepat", "ninja", "lion", "pos", "tiki", "anteraja", "ide", "sap"];
      const allOptions: ShippingOption[] = [];

      const fetchCourier = async (courier: string) => {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/rajaongkir-proxy?action=cost`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
            },
            body: JSON.stringify({
              origin: originId,
              destination: destinationId,
              weight: totalWeight,
              courier,
            }),
          });
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            for (const item of json.data) {
              if (item.cost != null && item.cost > 0) {
                allOptions.push({
                  courier: item.code?.toUpperCase() || courier.toUpperCase(),
                  courierName: item.name || courier.toUpperCase(),
                  service: item.service || "",
                  description: item.description || "",
                  cost: item.cost,
                  etd: item.etd || "-",
                });
              }
            }
          }
        } catch { /* skip failed courier */ }
      };

      await Promise.all(courierList.map(fetchCourier));

      // Filter out expensive options (> 500k) and keep only 5 cheapest
      const MAX_COST = 500000;
      const filtered = allOptions
        .filter(o => o.cost <= MAX_COST)
        .sort((a, b) => a.cost - b.cost);

      // Deduplicate: keep cheapest per courier
      const seen = new Map<string, ShippingOption>();
      for (const opt of filtered) {
        const key = opt.courier;
        if (!seen.has(key) || seen.get(key)!.cost > opt.cost) {
          seen.set(key, opt);
        }
      }

      const deduped = Array.from(seen.values()).sort((a, b) => a.cost - b.cost).slice(0, 5);
      setShippingOptions(deduped);
      // Cache shipping options with address key
      localStorage.setItem("checkout_shipping_cache", JSON.stringify({
        addressKey: `${district}|${regency}`,
        options: deduped,
      }));
    } catch (err) {
      console.error("Failed to fetch shipping:", err);
    } finally {
      setShippingLoading(false);
    }
  }

  // ── Step 3: Create transaction ──────────────────────────────────────────────
  async function handleSubmitOrder() {
    if (!user) return;
    if (!selectedPaymentCategory) {
      toast({ title: "Pilih metode pembayaran", description: "Silakan pilih salah satu metode pembayaran", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = (await supabaseCustomer.auth.getSession()).data.session;
      if (!session) throw new Error("Not authenticated");

      // Use the branch from the cart items
      let finalBranchId = items[0]?.branchId;
      if (!finalBranchId) {
        const { data: branchesData } = await supabaseCustomer.from("branches").select("id").eq("is_active", true).limit(1);
        if (!branchesData?.[0]?.id) throw new Error("No active branch found");
        finalBranchId = branchesData[0].id;
      }

      const catLabel = PAYMENT_CATEGORIES.find(c => c.key === selectedPaymentCategory)?.label ?? "Online";

      // ── SERVER-SIDE VERIFIED CHECKOUT ──
      // All price calculation happens on the backend to prevent manipulation
      const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          unitIds: items.map(i => i.unitId),
          discountCode: discountApplied?.code || null,
          shippingCost: selectedShipping?.cost ?? 0,
          packingKayu,
          branchId: finalBranchId,
          customerName: fullName,
          customerEmail: email,
          customerPhone: phone,
          shippingAddress: fullAddress,
          shippingCity: regencyName,
          shippingProvince: provinceName,
          shippingDistrict: districtName,
          shippingVillage: villageName,
          shippingPostalCode: postalCode,
          shippingCourier: selectedShipping?.courier || null,
          shippingService: selectedShipping?.service || null,
          shippingEtd: selectedShipping?.etd || null,
          paymentMethodName: `Xendit - ${catLabel}`,
          paymentMethods: PAYMENT_CATEGORIES.find(c => c.key === selectedPaymentCategory)?.xenditMethods ?? undefined,
          successRedirectUrl: `${window.location.origin}/riwayat/PLACEHOLDER`,
          failureRedirectUrl: `${window.location.origin}/riwayat/PLACEHOLDER`,
        }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        throw new Error(verifyData.error || "Checkout verification failed");
      }

      // Clear cart after successful server-verified order
      clearCart();
      localStorage.removeItem("checkout_cache");
      localStorage.removeItem("checkout_shipping_cache");

      // Redirect to Xendit hosted payment page
      const paymentUrl = verifyData.data?.invoiceUrl;
      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        navigate(`/riwayat/${verifyData.data?.transactionId}`);
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast({ title: "Gagal membuat pesanan", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyDiscount() {
    setDiscountError("");
    if (!discountCode.trim()) return;
    
    // Check if any cart item has a sale/flash sale label — block discount code usage
    const saleItems = items.filter(i => i.saleLabel);
    if (saleItems.length > 0) {
      setDiscountError(`Maaf, kode diskon tidak dapat digunakan untuk produk yang sudah berlabel ${saleItems[0].saleLabel}. Diskon tidak bisa digabung agar harga makin murah.`);
      return;
    }
    
    try {
      const code = discountCode.trim().toUpperCase();
      const { data: dc, error } = await supabaseCustomer
        .from("discount_codes")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .limit(1)
        .single();
      
      if (error || !dc) {
        setDiscountError("Kode diskon tidak valid atau sudah kedaluwarsa.");
        return;
      }

      // Check validity period
      const now = new Date();
      if (dc.valid_from && new Date(dc.valid_from) > now) {
        setDiscountError("Kode diskon belum aktif.");
        return;
      }
      if (dc.valid_until && new Date(dc.valid_until) < now) {
        setDiscountError("Kode diskon sudah kedaluwarsa.");
        return;
      }

      // Check max uses
      if (dc.max_uses && dc.used_count >= dc.max_uses) {
        setDiscountError("Kode diskon sudah mencapai batas penggunaan.");
        return;
      }

      // Check min purchase
      if (dc.min_purchase_amount && subtotal < Number(dc.min_purchase_amount)) {
        setDiscountError(`Minimum pembelian Rp${Number(dc.min_purchase_amount).toLocaleString("id-ID")} untuk kode ini.`);
        return;
      }

      // Calculate discount amount
      let discountAmt = 0;
      let shippingDiscAmt = 0;
      let coverPacking = false;
      
      if (dc.discount_type === "percentage" && dc.discount_percent) {
        discountAmt = Math.round(subtotal * Number(dc.discount_percent) / 100);
      } else if (dc.discount_type === "fixed_amount" && dc.discount_amount) {
        discountAmt = Number(dc.discount_amount);
      } else if (dc.discount_type === "min_purchase") {
        if (dc.discount_percent) {
          discountAmt = Math.round(subtotal * Number(dc.discount_percent) / 100);
        } else if (dc.discount_amount) {
          discountAmt = Number(dc.discount_amount);
        }
      } else if (dc.discount_type === "shipping_subsidy") {
        // Shipping subsidy discount
        const currentShipping = selectedShipping?.cost ?? 0;
        if (dc.shipping_subsidy_unlimited) {
          shippingDiscAmt = currentShipping; // 100% free
        } else if (dc.shipping_subsidy_amount && Number(dc.shipping_subsidy_amount) > 0) {
          shippingDiscAmt = Math.min(Number(dc.shipping_subsidy_amount), currentShipping);
        } else if (dc.discount_percent) {
          shippingDiscAmt = Math.round(currentShipping * Number(dc.discount_percent) / 100);
        }
        coverPacking = dc.cover_packing_kayu === true;
      }

      // Apply max discount cap if set
      if (dc.max_discount_cap && discountAmt > Number(dc.max_discount_cap)) {
        discountAmt = Number(dc.max_discount_cap);
      }

      discountAmt = Math.min(discountAmt, subtotal);

      setDiscountApplied({ code, amount: discountAmt, shippingDiscount: shippingDiscAmt, coverPackingKayu: coverPacking });
      setDiscountError("");
    } catch {
      setDiscountError("Kode diskon tidak valid atau sudah kedaluwarsa.");
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-4">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => step === "info" ? navigate("/keranjang") : setStep(step === "payment" ? "shipping" : "info")} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Checkout</h1>
              <p className="text-xs text-muted-foreground">{items.length} item</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* LEFT — Steps */}
            <div className="space-y-6">
              {/* Progress bar */}
              <div className="space-y-3">
                <Progress value={progressValue} className="h-2" />
                <div className="flex justify-between">
                  {STEPS.map((s, i) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        if (i < stepIndex) setStep(s.key);
                      }}
                      disabled={i > stepIndex}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium transition-colors",
                        i <= stepIndex ? "text-foreground" : "text-muted-foreground/50",
                        i < stepIndex && "cursor-pointer hover:text-foreground/80",
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                        i < stepIndex ? "bg-foreground text-background" :
                        i === stepIndex ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                      )}>
                        {i < stepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 1: Info */}
              {step === "info" && (
                <div className="space-y-6">
                  {/* Auth toggle */}
                  {!user && !authLoading && (
                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-foreground">Apakah Anda sudah punya akun?</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setAuthMode("login")}
                          className={cn(
                            "p-4 rounded-xl border-2 text-center transition-all",
                            authMode === "login"
                              ? "border-foreground bg-foreground/5"
                              : "border-border hover:border-foreground/40"
                          )}
                        >
                          <LogIn className="w-5 h-5 mx-auto mb-2 text-foreground" />
                          <p className="text-sm font-semibold text-foreground">Sudah punya akun</p>
                          <p className="text-xs text-muted-foreground mt-1">Login ke akun Anda</p>
                        </button>
                        <button
                          onClick={() => setAuthMode("register")}
                          className={cn(
                            "p-4 rounded-xl border-2 text-center transition-all",
                            authMode === "register"
                              ? "border-foreground bg-foreground/5"
                              : "border-border hover:border-foreground/40"
                          )}
                        >
                          <UserPlus className="w-5 h-5 mx-auto mb-2 text-foreground" />
                          <p className="text-sm font-semibold text-foreground">Belum punya akun</p>
                          <p className="text-xs text-muted-foreground mt-1">Daftar sekarang</p>
                        </button>
                      </div>

                      {authMode === "login" && (
                        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                          <p className="text-sm font-medium text-foreground">Login untuk melanjutkan</p>
                          <p className="text-xs text-muted-foreground">Data keranjang Anda tetap tersimpan.</p>
                          <Button onClick={() => navigate("/login?redirect=/checkout")} className="w-full gap-2">
                            <LogIn className="w-4 h-4" /> Masuk ke Akun
                          </Button>
                        </div>
                      )}

                      {authMode === "register" && (
                        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                          <p className="text-sm font-medium text-foreground">Buat akun baru</p>
                          <p className="text-xs text-muted-foreground">Daftar untuk melanjutkan checkout. Data keranjang tetap aman.</p>
                          <Button onClick={() => navigate("/register?redirect=/checkout")} className="w-full gap-2">
                            <UserPlus className="w-4 h-4" /> Daftar Sekarang
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* User info form (shown when logged in) */}
                  {user && (
                    <div className="space-y-6">
                      <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{fullName || user.email}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
                      </div>

                      {/* Contact info */}
                      <div className="space-y-4">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <User className="w-4 h-4" /> Data Pemesan
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Nama Lengkap *</Label>
                            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama lengkap" className="h-10" />
                            {infoErrors.fullName && <p className="text-xs text-destructive">{infoErrors.fullName}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Email *</Label>
                            <Input value={email} readOnly className="h-10 bg-muted/50" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Nomor Telepon *</Label>
                          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="h-10" />
                          {infoErrors.phone && <p className="text-xs text-destructive">{infoErrors.phone}</p>}
                        </div>
                      </div>

                      {/* Address */}
                      <div className="space-y-4">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <MapPin className="w-4 h-4" /> Alamat Pengiriman
                        </p>
                        {infoErrors.address && <p className="text-xs text-destructive">{infoErrors.address}</p>}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Province */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Provinsi *</Label>
                            <div className="relative">
                              <select
                                value={province || ""}
                                onChange={e => {
                                  const code = e.target.value;
                                  setProvince(code);
                                  setProvinceName(provinces.find(p => p.code === code)?.name || "");
                                  setRegency(null); setDistrict(null); setVillage(null);
                                }}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm appearance-none"
                              >
                                <option value="">Pilih provinsi</option>
                                {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </div>

                          {/* Regency */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Kota/Kabupaten *</Label>
                            <div className="relative">
                              <select
                                value={regency || ""}
                                onChange={e => {
                                  const code = e.target.value;
                                  setRegency(code);
                                  setRegencyName(regencies.find(r => r.code === code)?.name || "");
                                  setDistrict(null); setVillage(null);
                                }}
                                disabled={!province}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm appearance-none disabled:opacity-50"
                              >
                                <option value="">Pilih kota/kab</option>
                                {regencies.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </div>

                          {/* District */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Kecamatan *</Label>
                            <div className="relative">
                              <select
                                value={district || ""}
                                onChange={e => {
                                  const code = e.target.value;
                                  setDistrict(code);
                                  setDistrictName(districts.find(d => d.code === code)?.name || "");
                                  setVillage(null);
                                }}
                                disabled={!regency}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm appearance-none disabled:opacity-50"
                              >
                                <option value="">Pilih kecamatan</option>
                                {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </div>

                          {/* Village */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Kelurahan</Label>
                            <div className="relative">
                              <select
                                value={village || ""}
                                onChange={e => {
                                  const code = e.target.value;
                                  setVillage(code);
                                  setVillageName(villages.find(v => v.code === code)?.name || "");
                                }}
                                disabled={!district}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm appearance-none disabled:opacity-50"
                              >
                                <option value="">Pilih kelurahan</option>
                                {villages.map(v => <option key={v.code} value={v.code}>{v.name}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Alamat Lengkap *</Label>
                          <Input value={fullAddress} onChange={e => setFullAddress(e.target.value)} placeholder="Jl. Contoh No. 123, RT/RW..." className="h-10" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Kode Pos</Label>
                          <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="60xxx" className="h-10 w-32" />
                        </div>
                      </div>

                      <Button onClick={handleNextFromInfo} className="w-full h-11 gap-2 font-semibold">
                        Lanjut ke Pengiriman <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Shipping */}
              {step === "shipping" && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Pilih Layanan Pengiriman
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pengiriman ke: {districtName && `${districtName}, `}{regencyName && `${regencyName}, `}{provinceName}
                  </p>

                  {shippingLoading ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Memuat opsi pengiriman...</span>
                    </div>
                  ) : shippingOptions.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Tidak ada opsi pengiriman tersedia</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={fetchShippingOptions}>Coba Lagi</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {shippingOptions.map((opt, i) => (
                        <button
                          key={`${opt.courier}-${opt.service}-${i}`}
                          onClick={() => setSelectedShipping(opt)}
                          className={cn(
                            "w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4",
                            selectedShipping === opt
                              ? "border-foreground bg-foreground/5"
                              : "border-border hover:border-foreground/40"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {opt.courierName} — {opt.service}
                            </p>
                            {opt.description && <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>}
                            <p className="text-xs text-muted-foreground mt-1">Estimasi: {opt.etd} hari</p>
                          </div>
                          <div className="text-right shrink-0">
                            {shippingDiscount >= opt.cost ? (
                              <div>
                                <p className="text-xs text-muted-foreground line-through">{formatPrice(opt.cost)}</p>
                                <p className="text-sm font-bold text-emerald-600">Gratis</p>
                              </div>
                            ) : shippingDiscount > 0 ? (
                              <div>
                                <p className="text-xs text-muted-foreground line-through">{formatPrice(opt.cost)}</p>
                                <p className="text-sm font-bold text-foreground">{formatPrice(Math.max(0, opt.cost - shippingDiscount))}</p>
                              </div>
                            ) : (
                              <p className="text-sm font-bold text-foreground">{formatPrice(opt.cost)}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Packing Kayu Option */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Packing Kayu</p>
                        <p className="text-xs text-muted-foreground">Proteksi ekstra untuk pengiriman (+{formatPrice(PACKING_KAYU_COST)})</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setPackingKayu(!packingKayu)}
                      className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0",
                        packingKayu ? "bg-foreground" : "bg-muted-foreground/30")}>
                      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                        packingKayu && "translate-x-5")} />
                    </button>
                  </div>

                  {shippingDiscount > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-xs text-emerald-700 font-medium">
                        {shippingDiscount >= shippingCost ? "Gratis ongkir! Semua biaya pengiriman ditanggung toko." : `Subsidi ongkir ${formatPrice(shippingDiscount)} dari toko`}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      if (!selectedShipping) {
                        toast({ title: "Pilih pengiriman", description: "Pilih layanan pengiriman terlebih dahulu", variant: "destructive" });
                        return;
                      }
                      setStep("payment");
                    }}
                    disabled={!selectedShipping}
                    className="w-full h-11 gap-2 font-semibold"
                  >
                    Lanjut ke Pembayaran <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* STEP 3: Payment */}
              {step === "payment" && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Pilih Metode Pembayaran
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PAYMENT_CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      const isSelected = selectedPaymentCategory === cat.key;
                      // Xendit channel limits
                      const CHANNEL_LIMITS: Record<string, number> = {
                        qris: 10_000_000,
                        otc: 5_000_000,
                      };
                      const limit = CHANNEL_LIMITS[cat.key];
                      const isOverLimit = limit ? total > limit : false;
                      return (
                        <button
                          key={cat.key}
                          onClick={() => !isOverLimit && setSelectedPaymentCategory(cat.key)}
                          disabled={isOverLimit}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            isOverLimit
                              ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                              : isSelected
                                ? "border-foreground bg-foreground/5"
                                : "border-border hover:border-foreground/30"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                              isOverLimit ? "bg-muted text-muted-foreground" :
                              isSelected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                            )}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">{cat.label}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{cat.description}</p>
                              {isOverLimit && (
                                <p className="text-[10px] text-destructive mt-1 font-medium">
                                  <AlertCircle className="w-3 h-3 inline mr-0.5" />
                                  Maks. Rp{limit!.toLocaleString("id-ID")} per transaksi
                                </p>
                              )}
                            </div>
                            {isSelected && !isOverLimit && (
                              <CheckCircle2 className="w-5 h-5 text-foreground shrink-0 mt-0.5" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-2">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Anda akan diarahkan ke halaman pembayaran Xendit yang aman untuk menyelesaikan pembayaran.</span>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — Order Summary */}
            <div className="lg:self-start">
              <div className="bg-card border border-border rounded-xl p-5 space-y-4 sticky top-20">
                <p className="text-sm font-semibold text-foreground">Ringkasan Pesanan</p>

                {/* Items */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.unitId} className="flex gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted/40 overflow-hidden shrink-0">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground line-clamp-1">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.color} · {item.storageGb}GB · {WARRANTY_SHORT[item.warrantyType] ?? item.warrantyType}</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{formatPrice(item.sellingPrice)}</p>
                        {item.bonusItems && item.bonusItems.length > 0 && (
                          <p className="text-[10px] text-amber-700 mt-0.5">🎁 {item.bonusItems.length} bonus</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Available discounts notification */}
                <div className="space-y-2 border-t border-border pt-3">
                  {availableDiscounts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDiscountList(!showDiscountList)}
                      className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-left transition-colors hover:bg-amber-100"
                    >
                      <Tag className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-medium text-amber-800 flex-1">
                        Ada {availableDiscounts.length} kode diskon tersedia! Klik untuk lihat detail.
                      </span>
                      <ChevronDown className={cn("w-4 h-4 text-amber-600 transition-transform", showDiscountList && "rotate-180")} />
                    </button>
                  )}
                  {showDiscountList && availableDiscounts.length > 0 && (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {availableDiscounts.map((dc: any) => {
                        // Determine icon & benefit label
                        const isShipping = dc.discount_type === "shipping_subsidy";
                        const isPercentage = dc.discount_type === "percentage";
                        const benefitLabel = isShipping
                          ? (dc.shipping_subsidy_unlimited ? "Gratis Ongkir 100%" : dc.shipping_subsidy_amount ? `Subsidi Ongkir Rp${Number(dc.shipping_subsidy_amount).toLocaleString("id-ID")}` : "Subsidi Ongkir")
                          : isPercentage && dc.discount_percent
                            ? `Diskon ${dc.discount_percent}%`
                            : dc.discount_amount
                              ? `Potongan Rp${Number(dc.discount_amount).toLocaleString("id-ID")}`
                              : dc.name;
                        return (
                          <div key={dc.code} className="rounded-lg border border-border overflow-hidden">
                            {/* Top: benefit banner */}
                            <div className={cn(
                              "px-3 py-2 flex items-center justify-between",
                              isShipping ? "bg-blue-50 border-b border-blue-100" : "bg-emerald-50 border-b border-emerald-100"
                            )}>
                              <div className="flex items-center gap-2">
                                {isShipping ? (
                                  <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                                ) : (
                                  <BadgePercent className="w-4 h-4 text-emerald-600 shrink-0" />
                                )}
                                <span className={cn("text-xs font-bold", isShipping ? "text-blue-700" : "text-emerald-700")}>
                                  {benefitLabel}
                                </span>
                              </div>
                              <Button
                                variant="ghost" size="sm" className="h-6 text-[10px] px-2 font-semibold"
                                onClick={() => { setDiscountCode(dc.code); setShowDiscountList(false); }}
                              >
                                Pakai
                              </Button>
                            </div>
                            {/* Bottom: code & details */}
                            <div className="px-3 py-2 space-y-1.5">
                              <p className="font-mono text-xs font-bold text-foreground tracking-wide">{dc.code}</p>
                              {dc.description && <p className="text-[10px] text-muted-foreground leading-relaxed">{dc.description}</p>}
                              <div className="flex flex-wrap gap-1 text-[9px]">
                                {dc.min_purchase_amount && (
                                  <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Min Rp{Number(dc.min_purchase_amount).toLocaleString("id-ID")}</span>
                                )}
                                {dc.valid_until && (
                                  <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded">s/d {new Date(dc.valid_until).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                                )}
                                {!dc.is_stackable && (
                                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Tidak bisa digabung</span>
                                )}
                                {dc.cover_packing_kayu && (
                                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Termasuk packing kayu</span>
                                )}
                                {dc.max_discount_cap && (
                                  <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Maks Rp{Number(dc.max_discount_cap).toLocaleString("id-ID")}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">Kode Diskon / Promo</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={discountCode}
                        onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountError(""); }}
                        placeholder="Kode promo"
                        className="pl-9 h-9 text-sm uppercase"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleApplyDiscount}>
                      Pakai
                    </Button>
                  </div>
                  {discountError && <p className="text-[11px] text-destructive">{discountError}</p>}
                  {discountApplied && (
                    <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-green-50 border border-green-200">
                      <span className="text-green-700 font-medium">✓ {discountApplied.code}</span>
                      <span className="text-green-700 font-bold">
                        {discountApplied.amount > 0 ? `-${formatPrice(discountApplied.amount)}` :
                         discountApplied.shippingDiscount > 0 ? "Gratis Ongkir" : "-Rp0"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({items.length} item)</span>
                    <span className="font-medium text-foreground">{formatPrice(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Diskon</span>
                      <span className="font-medium text-green-600">-{formatPrice(discount)}</span>
                    </div>
                  )}
                  {selectedShipping && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ongkir ({selectedShipping.courier})</span>
                      {shippingDiscount > 0 ? (
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground line-through mr-1">{formatPrice(shippingCost)}</span>
                          <span className="font-medium text-emerald-600">{shippingDiscount >= shippingCost ? "Gratis" : formatPrice(finalShippingCost)}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-foreground">{formatPrice(finalShippingCost)}</span>
                      )}
                    </div>
                  )}
                  {packingKayu && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Packing Kayu</span>
                      {coverPackingKayu ? (
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground line-through mr-1">{formatPrice(PACKING_KAYU_COST)}</span>
                          <span className="font-medium text-emerald-600">Gratis</span>
                        </div>
                      ) : (
                        <span className="font-medium text-foreground">{formatPrice(PACKING_KAYU_COST)}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-border">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Pay button — only on payment step */}
                {step === "payment" && (
                  <Button
                    onClick={handleSubmitOrder}
                    disabled={submitting}
                    className="w-full h-12 gap-2 font-semibold text-base"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Bayar Pesanan <ArrowRight className="w-4 h-4" /></>
                    )}
                  </Button>
                )}

                {/* Security badge */}
                <div className="flex items-center gap-2 pt-1">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground">Pembayaran aman diproses oleh Xendit</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShippingOption {
  courier: string;
  courierName: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}
