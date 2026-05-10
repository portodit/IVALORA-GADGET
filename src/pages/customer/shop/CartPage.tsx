import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, ShoppingBag, Tag, ArrowLeft, Shield, ChevronDown, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/shared/LocaleContext";
import { supabaseCustomer } from "@/integrations/supabase/customer-client";

const USD_RATE = 15500;

export interface CartItem {
  unitId: string;
  productName: string;
  color: string;
  storageGb: number;
  warrantyType: string;
  conditionStatus: "no_minus" | "minus";
  minusDescription: string | null;
  sellingPrice: number;
  originalPrice?: number; // before sale discount
  saleLabel?: string | null; // e.g. "Diskon Sale", "Flash Sale"
  saleDiscountLabel?: string | null; // e.g. "-Rp500.000"
  imeiCensored: string;
  thumbnailUrl: string | null;
  slug: string | null;
  branchId: string | null;
  // Shipping info
  weightGram?: number;
  shippingDiscountType?: string; // 'none' | 'percentage' | 'fixed'
  shippingDiscountValue?: number;
  freeShipping?: boolean; // from flash sale or catalog
  // Bonus items from catalog
  bonusItems?: { name: string; description: string }[];
}

// Simple localStorage-based cart
const CART_KEY = "ivalora_cart";

export function getCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch { return []; }
}

export function addToCart(item: CartItem) {
  const cart = getCart();
  if (cart.some(c => c.unitId === item.unitId)) return false;
  cart.push(item);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-update"));
  return true;
}

export function removeFromCart(unitId: string) {
  const cart = getCart().filter(c => c.unitId !== unitId);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-update"));
}

export function clearCart() {
  localStorage.setItem(CART_KEY, JSON.stringify([]));
  window.dispatchEvent(new Event("cart-update"));
}

function useFormatPrice() {
  const { currency } = useLocale();
  return (n: number | null | undefined) => {
    if (!n) return "—";
    if (currency === "USD") {
      const usd = n / USD_RATE;
      return "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return "Rp" + n.toLocaleString("id-ID");
  };
}

const WARRANTY_SHORT: Record<string, string> = {
  resmi_bc: "Resmi BC",
  ibox: "Resmi iBox",
  inter: "Inter",
  whitelist: "Whitelist",
  digimap: "Digimap",
};

// ── Bonus Accordion Component ─────────────────────────────────────────────────
function BonusAccordion({ bonusItems }: { bonusItems: { name: string; description: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800 flex-1">
          🎁 {bonusItems.length} Bonus Produk
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {bonusItems.map((b, i) => (
            <div key={i} className="flex items-start gap-2 pl-5">
              <span className="text-[10px] mt-0.5 text-amber-500">●</span>
              <div>
                <p className="text-xs font-medium text-foreground">{b.name}</p>
                {b.description && <p className="text-[10px] text-muted-foreground">{b.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CartPage() {
  const navigate = useNavigate();
  const formatPrice = useFormatPrice();
  const [items, setItems] = useState<CartItem[]>(getCart());
  const [discountCode, setDiscountCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{ code: string; amount: number } | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([]);
  const [showDiscountList, setShowDiscountList] = useState(false);

  useEffect(() => {
    async function loadDiscounts() {
      const now = new Date().toISOString();
      const { data } = await supabaseCustomer
        .from("discount_codes")
        .select("code, name, description, discount_type, discount_percent, discount_amount, min_purchase_amount, valid_until, is_stackable, max_discount_cap")
        .eq("is_active", true)
        .eq("applies_to_all", true)
        .lte("valid_from", now)
        .order("created_at", { ascending: false })
        .limit(10);
      const valid = (data ?? []).filter((d: any) => !d.valid_until || new Date(d.valid_until) > new Date());
      setAvailableDiscounts(valid);
    }
    loadDiscounts();
  }, []);

  useEffect(() => {
    function sync() { setItems(getCart()); }
    window.addEventListener("cart-update", sync);
    return () => window.removeEventListener("cart-update", sync);
  }, []);

  function handleRemove(unitId: string) {
    removeFromCart(unitId);
    setItems(getCart());
  }

  const subtotal = items.reduce((sum, i) => sum + i.sellingPrice, 0);
  const discount = discountApplied?.amount ?? 0;
  const total = Math.max(0, subtotal - discount);

  function handleApplyDiscount() {
    setDiscountError("");
    if (!discountCode.trim()) return;
    // Block discount codes for sale items
    const saleItems = items.filter(i => i.saleLabel);
    if (saleItems.length > 0) {
      setDiscountError(`Maaf, kode diskon tidak dapat digunakan untuk produk yang sudah berlabel ${saleItems[0].saleLabel}. Diskon tidak bisa digabung.`);
      return;
    }
    setDiscountError("Kode diskon tidak valid atau sudah kedaluwarsa.");
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-4">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Keranjang Belanja</h1>
              <p className="text-xs text-muted-foreground">{items.length} item</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingBag className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-base font-semibold text-foreground">Keranjang masih kosong</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Jelajahi katalog untuk menambahkan produk.</p>
              <Button variant="outline" onClick={() => navigate("/katalog")}>
                Lihat Katalog
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              {/* Items list */}
              <div className="space-y-3">
                {items.map(item => {
                  const hasBonus = item.bonusItems && item.bonusItems.length > 0;
                  return (
                  <div key={item.unitId} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-4 flex gap-4">
                    {/* Thumbnail */}
                    <Link
                      to={item.slug ? `/produk/${item.slug}` : "#"}
                      className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-muted/40 overflow-hidden shrink-0 block"
                    >
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </Link>
                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Link
                        to={item.slug ? `/produk/${item.slug}` : "#"}
                        className="text-sm font-semibold text-foreground hover:underline line-clamp-2"
                      >
                        {item.productName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.color} · {item.storageGb}GB · {WARRANTY_SHORT[item.warrantyType] ?? item.warrantyType}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-mono">IMEI: {item.imeiCensored}</span>
                        {item.saleLabel && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: item.saleLabel === "Flash Sale" ? "hsl(0 72% 50%)" : "hsl(160 60% 45%)" }}>
                            {item.saleLabel}
                          </span>
                        )}
                      </div>
                      {/* QC badge */}
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-green-600 shrink-0" />
                        <span className="text-[10px] text-muted-foreground">QC 30+ checkpoint</span>
                      </div>
                      {/* Price - mobile */}
                      <div className="md:hidden">
                        {item.originalPrice ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground line-through">{formatPrice(item.originalPrice)}</span>
                              {item.saleDiscountLabel && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1 py-0.5 rounded">{item.saleDiscountLabel}</span>}
                            </div>
                            <p className="text-base font-bold text-destructive">{formatPrice(item.sellingPrice)}</p>
                          </div>
                        ) : (
                          <p className="text-base font-bold text-foreground">{formatPrice(item.sellingPrice)}</p>
                        )}
                      </div>
                    </div>
                    {/* Price + remove - desktop */}
                    <div className="hidden md:flex flex-col items-end justify-between shrink-0">
                      <button
                        onClick={() => handleRemove(item.unitId)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {item.originalPrice ? (
                        <div className="text-right space-y-0.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-xs text-muted-foreground line-through">{formatPrice(item.originalPrice)}</span>
                            {item.saleDiscountLabel && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1 py-0.5 rounded">{item.saleDiscountLabel}</span>}
                          </div>
                          <p className="text-base font-bold text-destructive">{formatPrice(item.sellingPrice)}</p>
                        </div>
                      ) : (
                        <p className="text-base font-bold text-foreground">{formatPrice(item.sellingPrice)}</p>
                      )}
                    </div>
                    {/* Remove button - mobile */}
                    <button
                      onClick={() => handleRemove(item.unitId)}
                      className="md:hidden p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors self-start shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                    {/* Bonus accordion — only if bonus items exist */}
                    {hasBonus && <BonusAccordion bonusItems={item.bonusItems!} />}
                  </div>
                  );
                })}
              </div>

              {/* Summary sidebar */}
              <div className="lg:self-start">
                <div className="bg-card border border-border rounded-xl p-5 space-y-4 sticky top-20">
                  <p className="text-sm font-semibold text-foreground">Ringkasan Belanja</p>

                  {/* Available discounts notification */}
                  <div className="space-y-2">
                    {availableDiscounts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDiscountList(!showDiscountList)}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-left transition-colors hover:bg-amber-100"
                      >
                        <Tag className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-medium text-amber-800 flex-1">
                          Ada {availableDiscounts.length} kode diskon tersedia!
                        </span>
                        <ChevronDown className={cn("w-4 h-4 text-amber-600 transition-transform", showDiscountList && "rotate-180")} />
                      </button>
                    )}
                    {showDiscountList && availableDiscounts.length > 0 && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {availableDiscounts.map((dc: any) => (
                          <div key={dc.code} className="p-2 rounded-lg border border-border bg-muted/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-foreground">{dc.code}</span>
                              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5"
                                onClick={() => { setDiscountCode(dc.code); setShowDiscountList(false); }}>Pakai</Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{dc.name}</p>
                            <div className="flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                              {dc.discount_percent && <span className="bg-muted px-1 py-0.5 rounded">{dc.discount_percent}%</span>}
                              {dc.discount_amount && <span className="bg-muted px-1 py-0.5 rounded">Rp{Number(dc.discount_amount).toLocaleString("id-ID")}</span>}
                              {dc.max_discount_cap && <span className="bg-muted px-1 py-0.5 rounded">Maks Rp{Number(dc.max_discount_cap).toLocaleString("id-ID")}</span>}
                              {dc.is_stackable ? <span className="bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded">Bisa digabung</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">Kode Diskon / Promo</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={discountCode}
                          onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountError(""); }}
                          placeholder="Masukkan kode"
                          className="pl-9 h-9 text-sm uppercase"
                        />
                      </div>
                      <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleApplyDiscount}>
                        Terapkan
                      </Button>
                    </div>
                    {discountError && <p className="text-[11px] text-destructive">{discountError}</p>}
                    {discountApplied && (
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-green-50 border border-green-200">
                        <span className="text-green-700 font-medium">✓ {discountApplied.code}</span>
                        <span className="text-green-700 font-bold">-{formatPrice(discountApplied.amount)}</span>
                      </div>
                    )}
                  </div>

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
                    <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-border">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground">{formatPrice(total)}</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-11 font-semibold" 
                    disabled={items.length === 0}
                    onClick={() => navigate("/checkout")}
                  >
                    Checkout
                  </Button>

                  <p className="text-[10px] text-muted-foreground text-center">
                    Setiap item di keranjang adalah unit spesifik (bukan SKU). Pastikan Anda memilih unit yang sesuai.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
