import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Search, Trash2, Download, Edit, Info, AlertTriangle,
  CheckCircle, XCircle, Star, ShoppingCart, Heart, Package,
  Truck, CheckCheck, MapPin, ChevronRight, Minus, Shield,
  Zap, Clock, Phone, MessageCircle, ArrowRight,
} from "lucide-react";

/* ── Helpers ─────────────────────────────────────────────────────────── */
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="ds-label text-muted-foreground">{title}</p>
        {subtitle && <p className="ds-caption text-muted-foreground mt-0.5">{subtitle}</p>}
        <Separator className="mt-2" />
      </div>
      {children}
    </div>
  );
}

function PageSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="h-6 w-1 rounded-full bg-primary" />
        <h2 className="ds-h1">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs text-muted-foreground font-medium">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Swatch({ label, bg }: { label: string; bg: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-12 h-12 rounded-lg border border-border ${bg}`} />
      <span className="text-[10px] text-center leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

/* ── Rating Stars ─────────────────────────────────────────────────────── */
function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < Math.floor(value) ? "fill-[hsl(var(--star))] text-[hsl(var(--star))]" : "fill-muted text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

/* ── Product Card ─────────────────────────────────────────────────────── */
function ProductCard({
  name, series, price, originalPrice, badge, stock, isFlashSale
}: {
  name: string; series: string; price: string; originalPrice?: string;
  badge?: string; stock: number; isFlashSale?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all group cursor-pointer w-48">
      {/* Image placeholder */}
      <div className="relative h-40 bg-neutral-100 flex items-center justify-center">
        <Phone className="h-14 w-14 text-neutral-300" />
        {badge && (
          <div className="absolute top-2 left-2">
            <Badge variant={isFlashSale ? "warning" : "soft-info"} size="xs">
              {isFlashSale && <Zap className="h-2.5 w-2.5" />}
              {badge}
            </Badge>
          </div>
        )}
        <button className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="h-3 w-3 text-muted-foreground" />
        </button>
        {stock === 0 && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl">
            <Badge variant="soft-neutral" size="sm">Habis</Badge>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="ds-caption text-muted-foreground">{series}</p>
        <p className="text-sm font-semibold leading-snug line-clamp-2">{name}</p>
        <div>
          <p className="text-sm font-bold text-foreground">{price}</p>
          {originalPrice && (
            <p className="text-xs text-muted-foreground line-through">{originalPrice}</p>
          )}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <p className="ds-caption text-muted-foreground">{stock} unit</p>
          <StarRating value={4.5} />
        </div>
      </div>
    </div>
  );
}

/* ── Cart Item ────────────────────────────────────────────────────────── */
function CartItem() {
  const [qty, setQty] = useState(1);
  return (
    <div className="flex gap-3 p-3 bg-card rounded-xl border border-border">
      <div className="h-16 w-16 bg-neutral-100 rounded-lg flex items-center justify-center shrink-0">
        <Phone className="h-8 w-8 text-neutral-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">iPhone 15 Pro Max 256GB Black</p>
        <p className="ds-caption text-muted-foreground">Garansi Resmi 1 Tahun</p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm font-bold">Rp 19.999.000</p>
          <div className="flex items-center gap-1.5">
            <Button size="icon-xs" variant="outline" onClick={() => setQty(Math.max(1, qty - 1))}><Minus /></Button>
            <span className="text-sm font-medium w-4 text-center">{qty}</span>
            <Button size="icon-xs" variant="outline" onClick={() => setQty(qty + 1)}><Plus /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Order Status Timeline ────────────────────────────────────────────── */
function OrderTimeline({ currentStep }: { currentStep: number }) {
  const steps = [
    { icon: CheckCheck, label: "Pesanan Dibuat" },
    { icon: Package, label: "Diproses" },
    { icon: Truck, label: "Dikirim" },
    { icon: MapPin, label: "Diterima" },
  ];
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              {i > 0 && <div className={`flex-1 h-0.5 ${done ? "bg-success" : "bg-border"}`} />}
              <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                done ? "bg-success border-success text-success-foreground" :
                active ? "bg-primary border-primary text-primary-foreground" :
                "bg-background border-border text-muted-foreground"
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${done ? "bg-success" : "bg-border"}`} />}
            </div>
            <p className="ds-caption text-center mt-1 leading-tight px-1">{step.label}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Price Display ────────────────────────────────────────────────────── */
function PriceDisplay({ price, original, discount }: { price: string; original?: string; discount?: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="ds-h2 text-foreground">{price}</span>
      {original && <span className="ds-body-sm text-muted-foreground line-through">{original}</span>}
      {discount && <Badge variant="soft-warning" size="sm">{discount}</Badge>}
    </div>
  );
}

/* ── Nav Breadcrumb ───────────────────────────────────────────────────── */
function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center gap-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
          <span className={`text-xs ${i === items.length - 1 ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground cursor-pointer"}`}>
            {item}
          </span>
        </div>
      ))}
    </nav>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function DesignSystemPage() {
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [activeNav, setActiveNav] = useState<string>("foundation");

  const navItems = [
    { id: "foundation", label: "Foundation" },
    { id: "motion", label: "Motion" },
    { id: "components", label: "Components" },
    { id: "admin-ui", label: "Admin UI" },
    { id: "customer-ui", label: "Customer UI" },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top nav ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">IVALORA</span>
            <span className="ds-caption text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Design System</span>
            <Badge variant="soft-info" size="xs">v1.0</Badge>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActiveNav(item.id)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  activeNav === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-16">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="ds-label text-muted-foreground">IVALORA GADGET</p>
          <h1 className="ds-display-lg">Design System</h1>
          <p className="ds-body-lg text-muted-foreground max-w-xl">
            Token, komponen, dan panduan visual untuk seluruh produk — admin panel dan customer storefront.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="soft-success" dot>Global — berlaku untuk admin &amp; customer</Badge>
            <Badge variant="soft-neutral">Poppins font</Badge>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SECTION 1 — FOUNDATION                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        <PageSection id="foundation" title="Foundation">

          <Section title="COLOR — NEUTRAL SCALE (50–900)" subtitle="bg-neutral-{n} / text-neutral-{n}">
            <Row label="Light → Dark">
              {[50,100,200,300,400,500,600,700,800,900].map(n => (
                <Swatch key={n} label={`${n}`} bg={`bg-neutral-${n}`} />
              ))}
            </Row>
          </Section>

          <Section title="COLOR — SEMANTIC" subtitle="Token yang dipakai di seluruh komponen">
            <Row label="Surface">
              <Swatch label="background" bg="bg-background" />
              <Swatch label="card" bg="bg-card" />
              <Swatch label="muted" bg="bg-muted" />
              <Swatch label="accent" bg="bg-accent" />
              <Swatch label="border" bg="bg-border" />
            </Row>
            <Row label="Brand">
              <Swatch label="primary" bg="bg-primary" />
              <Swatch label="secondary" bg="bg-secondary" />
              <Swatch label="destructive" bg="bg-destructive" />
            </Row>
            <Row label="Feedback">
              <Swatch label="success" bg="bg-success" />
              <Swatch label="success-bg" bg="bg-success-bg" />
              <Swatch label="warning" bg="bg-warning" />
              <Swatch label="warning-bg" bg="bg-warning-bg" />
              <Swatch label="info" bg="bg-info" />
              <Swatch label="info-bg" bg="bg-info-bg" />
              <Swatch label="error" bg="bg-error" />
              <Swatch label="error-bg" bg="bg-error-bg" />
            </Row>
            <Row label="Status (Admin + Customer)">
              <Swatch label="available" bg="bg-[hsl(var(--status-available-bg))]" />
              <Swatch label="reserved" bg="bg-[hsl(var(--status-reserved-bg))]" />
              <Swatch label="sold" bg="bg-[hsl(var(--status-sold-bg))]" />
              <Swatch label="service" bg="bg-[hsl(var(--status-service-bg))]" />
              <Swatch label="return" bg="bg-[hsl(var(--status-return-bg))]" />
              <Swatch label="lost" bg="bg-[hsl(var(--status-lost-bg))]" />
              <Swatch label="coming-soon" bg="bg-[hsl(var(--status-coming-soon-bg))]" />
            </Row>
          </Section>

          <Section title="TYPOGRAPHY SCALE" subtitle="Poppins · Responsive (mobile → iPad → desktop) · class: ds-display-xl / ds-h1 / ds-body-md / ds-label / dll">
            <div className="space-y-4 bg-card rounded-xl border p-6">
              {/* Display */}
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-display-xl">Display XL</p>
                <span className="ds-caption">36 → 48 → 64px · 800 ExtraBold · hero landing</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-display-lg">Display LG</p>
                <span className="ds-caption">30 → 40 → 48px · 700 Bold · judul besar</span>
              </div>
              <Separator />
              {/* Headings */}
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-h1">Heading 1</p>
                <span className="ds-caption">28 → 32 → 40px · 700 Bold · section utama</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-h2">Heading 2</p>
                <span className="ds-caption">24 → 28 → 32px · 700 Bold · sub-section</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-h3">Heading 3</p>
                <span className="ds-caption">20 → 22 → 24px · 600 SemiBold · card title</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-h4">Heading 4</p>
                <span className="ds-caption">18 → 18 → 20px · 600 SemiBold · label grup</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-h5">Heading 5</p>
                <span className="ds-caption">15 → 16 → 16px · 600 SemiBold · sub-label</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-h6">Heading 6</p>
                <span className="ds-caption">14px all · 600 SemiBold · keterangan kolom</span>
              </div>
              <Separator />
              {/* Lead & Body */}
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-lead">Lead — intro paragraph di atas konten utama</p>
                <span className="ds-caption">16 → 18 → 20px · 500 Medium · lh 1.65</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-body-lg">Body Large — paragraf panjang, deskripsi produk</p>
                <span className="ds-caption">16 → 16 → 18px · 400 Regular · lh 1.65</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-body-md">Body Medium — teks default tabel dan form</p>
                <span className="ds-caption">14 → 15 → 16px · 400 Regular · lh 1.65</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-body-sm">Body Small — keterangan secondary, hint</p>
                <span className="ds-caption">13 → 13 → 14px · 400 Regular · lh 1.55</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-paragraph">Paragraph — long-form content, artikel, deskripsi panjang dengan line-height lebih longgar.</p>
                <span className="ds-caption">14 → 15 → 16px · 400 · lh 1.75</span>
              </div>
              <Separator />
              {/* Micro */}
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-caption">Caption — timestamp, label field kecil</p>
                <span className="ds-caption">11 → 12px · 400 Regular</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-label">Label — section header tabel</p>
                <span className="ds-caption">11px · 600 SemiBold · UPPERCASE · tracking-wide</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <p className="ds-micro">Micro — badge chip status kecil</p>
                <span className="ds-caption">10px · 500 Medium</span>
              </div>
            </div>
          </Section>

          <Section title="SHADOW SCALE">
            <Row>
              {(["xs","sm","md","lg","xl","2xl"] as const).map(s => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-xl bg-card border border-border/50 shadow-${s}`} />
                  <span className="ds-caption">{s}</span>
                </div>
              ))}
            </Row>
          </Section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <Section title="RADIUS SCALE">
              <Row>
                {[
                  { label: "sm", cl: "rounded-sm" },
                  { label: "md", cl: "rounded-md" },
                  { label: "lg", cl: "rounded-lg" },
                  { label: "xl", cl: "rounded-xl" },
                  { label: "2xl", cl: "rounded-2xl" },
                  { label: "full", cl: "rounded-full" },
                ].map(r => (
                  <div key={r.label} className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 bg-muted border border-border ${r.cl}`} />
                    <span className="ds-caption">{r.label}</span>
                  </div>
                ))}
              </Row>
            </Section>

            <Section title="Z-INDEX SCALE">
              <div className="space-y-1.5">
                {[
                  { name: "base / 0", desc: "Konten normal" },
                  { name: "raised / 10", desc: "Sticky table header" },
                  { name: "dropdown / 20", desc: "Dropdown, filter panel" },
                  { name: "sticky / 30", desc: "Navbar, sticky bar" },
                  { name: "overlay / 40", desc: "Modal backdrop" },
                  { name: "modal / 50", desc: "Dialog, drawer" },
                  { name: "toast / 60", desc: "Notifikasi toast" },
                ].map(z => (
                  <div key={z.name} className="flex items-center gap-3">
                    <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground min-w-[88px]">{z.name}</code>
                    <span className="ds-caption">{z.desc}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <Section title="BREAKPOINTS" subtitle="Mobile-first — base → md (768px) → lg (1024px) → xl (1280px)">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 ds-label text-muted-foreground">Token</th>
                    <th className="text-left pb-2 ds-label text-muted-foreground">Prefix</th>
                    <th className="text-left pb-2 ds-label text-muted-foreground">Min-width</th>
                    <th className="text-left pb-2 ds-label text-muted-foreground">Device</th>
                    <th className="text-left pb-2 ds-label text-muted-foreground">Layout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { token: "mobile", prefix: "base", px: "0px", device: "Handphone portrait", layout: "Single column, stack semua" },
                    { token: "sm", prefix: "sm:", px: "640px", device: "Handphone landscape", layout: "2 col untuk grid kecil" },
                    { token: "tablet", prefix: "md:", px: "768px", device: "iPad portrait", layout: "2–3 col, sidebar collapsible" },
                    { token: "desktop-sm", prefix: "lg:", px: "1024px", device: "iPad landscape / laptop kecil", layout: "Sidebar permanent, 3–4 col" },
                    { token: "desktop", prefix: "xl:", px: "1280px", device: "Desktop standard", layout: "Full layout, max-w-5xl" },
                  ].map(b => (
                    <tr key={b.token} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-4"><code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">{b.token}</code></td>
                      <td className="py-2.5 pr-4"><code className="text-[11px] font-mono text-info">{b.prefix}</code></td>
                      <td className="py-2.5 pr-4 ds-body-sm font-semibold">{b.px}</td>
                      <td className="py-2.5 pr-4 ds-caption text-muted-foreground">{b.device}</td>
                      <td className="py-2.5 ds-caption text-muted-foreground">{b.layout}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="GRID & LAYOUT SYSTEM" subtitle="Pola container dan grid yang dipakai di seluruh halaman">
            <div className="space-y-6">
              {/* Container widths */}
              <div className="space-y-2">
                <p className="ds-label text-muted-foreground">Container widths</p>
                <div className="space-y-1.5">
                  {[
                    { cls: "max-w-sm  (336px)", use: "Form login, modal kecil, kartu sempit" },
                    { cls: "max-w-md  (448px)", use: "Form register, dialog medium" },
                    { cls: "max-w-lg  (512px)", use: "Dialog besar, panel detail" },
                    { cls: "max-w-2xl (672px)", use: "Konten artikel, invoice publik" },
                    { cls: "max-w-5xl (1024px)", use: "Halaman admin & design system (main content)" },
                    { cls: "max-w-7xl (1280px)", use: "Landing page customer full-width" },
                  ].map(c => (
                    <div key={c.cls} className="flex items-center gap-3">
                      <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground min-w-[180px] shrink-0">{c.cls}</code>
                      <span className="ds-caption">{c.use}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid patterns */}
              <div className="space-y-2">
                <p className="ds-label text-muted-foreground">Grid patterns (responsive)</p>
                <div className="space-y-3">
                  <div>
                    <p className="ds-caption text-muted-foreground mb-1">grid-cols-1 md:grid-cols-2 lg:grid-cols-4 — Stat cards dashboard</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-lg bg-muted border border-border flex items-center justify-center ds-caption text-muted-foreground">card {i}</div>)}
                    </div>
                  </div>
                  <div>
                    <p className="ds-caption text-muted-foreground mb-1">grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 — Product catalog grid</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted border border-border flex items-center justify-center ds-caption text-muted-foreground">produk {i}</div>)}
                    </div>
                  </div>
                  <div>
                    <p className="ds-caption text-muted-foreground mb-1">grid-cols-1 lg:grid-cols-[1fr_320px] — Content + sidebar (detail produk, checkout)</p>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-2">
                      <div className="h-14 rounded-lg bg-muted border border-border flex items-center justify-center ds-caption text-muted-foreground">main content</div>
                      <div className="h-14 rounded-lg bg-accent border border-border flex items-center justify-center ds-caption text-muted-foreground">sidebar</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spacing scale reference */}
              <div className="space-y-2">
                <p className="ds-label text-muted-foreground">Spacing scale yang paling sering dipakai</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { val: "1", px: "4px", use: "Icon gap, badge padding" },
                    { val: "1.5", px: "6px", use: "Tight list gap" },
                    { val: "2", px: "8px", use: "Default flex gap, compact padding" },
                    { val: "3", px: "12px", use: "Button padding, medium gap" },
                    { val: "4", px: "16px", use: "Card padding, section gap" },
                    { val: "6", px: "24px", use: "Page padding, large gap" },
                    { val: "8", px: "32px", use: "Section spacing" },
                    { val: "16", px: "64px", use: "Between major sections" },
                  ].map(s => (
                    <div key={s.val} className="flex flex-col items-center gap-1 bg-card border border-border rounded-lg px-3 py-2">
                      <code className="text-[11px] font-mono font-bold">{s.val}</code>
                      <span className="ds-micro text-muted-foreground">{s.px}</span>
                      <span className="ds-micro text-muted-foreground/70 text-center">{s.use}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </PageSection>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SECTION — MOTION & ANIMATION                            */}
        {/* ══════════════════════════════════════════════════════════ */}
        <PageSection id="motion" title="Motion & Animation">

          <Section title="DURATION SCALE" subtitle="Token: --duration-{name} — pakai di transition dan animation">
            <div className="flex flex-wrap gap-3">
              {[
                { name: "instant", val: "0ms",   use: "Toggle visibility instan (no-animation)" },
                { name: "fast",    val: "100ms",  use: "Micro-interaction: press, scale" },
                { name: "normal",  val: "200ms",  use: "Default: hover, color change, fade" },
                { name: "slow",    val: "300ms",  use: "Entrance: slide-up, modal open" },
                { name: "slower",  val: "500ms",  use: "Page transition, kompleks sequence" },
              ].map(d => (
                <div key={d.name} className="flex-1 min-w-[160px] bg-card border border-border rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <code className="text-[11px] font-mono font-semibold">{d.name}</code>
                    <span className="ds-caption font-semibold text-primary">{d.val}</span>
                  </div>
                  <p className="ds-caption text-muted-foreground">{d.use}</p>
                  <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full ds-hover-lift"
                      style={{ width: `${Math.min(100, (parseInt(d.val) / 500) * 100 || 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="EASING CURVES" subtitle="Token: --ease-{name}">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { name: "default", curve: "cubic-bezier(0.4, 0, 0.2, 1)", use: "Standard — hampir semua kasus", color: "bg-primary" },
                { name: "in",      curve: "cubic-bezier(0.4, 0, 1, 1)",   use: "Accelerate — exit animations", color: "bg-info" },
                { name: "out",     curve: "cubic-bezier(0, 0, 0.2, 1)",   use: "Decelerate — entrance animations", color: "bg-success" },
                { name: "spring",  curve: "cubic-bezier(0.34, 1.56, 0.64, 1)", use: "Overshoot — tombol klik, badge pop", color: "bg-warning" },
              ].map(e => (
                <div key={e.name} className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${e.color}`} />
                    <code className="text-[11px] font-mono font-semibold">{e.name}</code>
                  </div>
                  <p className="ds-caption text-muted-foreground">{e.use}</p>
                  <code className="ds-micro text-muted-foreground/70 break-all">{e.curve}</code>
                </div>
              ))}
            </div>
          </Section>

          <Section title="TRANSITION PRESETS" subtitle="Class utility: ds-transition / ds-transition-colors / ds-hover-lift / ds-press">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { cls: "ds-transition",          desc: "transition: all · 200ms · ease-default", example: "Dipakai di card, panel, general state change" },
                { cls: "ds-transition-colors",    desc: "transition: color, bg, border · 200ms", example: "Dipakai di button, link, badge hover" },
                { cls: "ds-transition-opacity",   desc: "transition: opacity · 200ms", example: "Dipakai di overlay, tooltip appear" },
                { cls: "ds-transition-transform", desc: "transition: transform · 200ms · ease-out", example: "Dipakai di drawer slide, modal scale" },
              ].map(t => (
                <div key={t.cls} className="bg-card border border-border rounded-xl p-3 space-y-1">
                  <code className="text-[11px] font-mono font-semibold text-primary">.{t.cls}</code>
                  <p className="ds-caption text-foreground">{t.desc}</p>
                  <p className="ds-caption text-muted-foreground">{t.example}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="bg-card border border-border rounded-xl p-3 space-y-1">
                <code className="text-[11px] font-mono font-semibold text-primary">.ds-hover-lift</code>
                <p className="ds-caption text-foreground">translateY(-2px) + shadow-md saat hover</p>
                <p className="ds-caption text-muted-foreground">Dipakai di product card, stat card — elemen yang bisa diklik</p>
                <div className="mt-2">
                  <div className="ds-hover-lift inline-flex items-center gap-1.5 bg-muted rounded-lg px-3 py-2 cursor-pointer ds-caption border border-border">
                    Hover saya
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 space-y-1">
                <code className="text-[11px] font-mono font-semibold text-primary">.ds-press</code>
                <p className="ds-caption text-foreground">scale(0.97) saat :active (klik)</p>
                <p className="ds-caption text-muted-foreground">Dipakai di tombol icon, chip filter, elemen kecil interaktif</p>
                <div className="mt-2">
                  <div className="ds-press inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 cursor-pointer ds-caption select-none">
                    Klik saya
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="ENTRANCE ANIMATIONS" subtitle="Class utility: ds-fade-in / ds-slide-up / ds-slide-down / ds-scale-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { cls: "ds-fade-in",    desc: "Opacity 0→1", use: "Toast, tooltip, overlay" },
                { cls: "ds-slide-up",   desc: "Y(8px)→0 + fade", use: "Modal, dropdown, card masuk" },
                { cls: "ds-slide-down", desc: "Y(-8px)→0 + fade", use: "Navbar dropdown, banner" },
                { cls: "ds-scale-in",   desc: "scale(0.95)→1 + fade", use: "Badge pop, dialog open" },
              ].map(a => (
                <div key={a.cls} className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                  <code className="text-[11px] font-mono font-semibold text-primary">.{a.cls}</code>
                  <p className="ds-caption text-foreground">{a.desc}</p>
                  <p className="ds-caption text-muted-foreground">{a.use}</p>
                  <div className="mt-2 h-8 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                    <div key={Math.random()} className={`${a.cls} ds-caption text-muted-foreground`}>preview</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </PageSection>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SECTION 2 — COMPONENTS                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        <PageSection id="components" title="Components">

          <Section title="BUTTON — VARIANTS">
            <Row label="Variant">
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="tertiary">Tertiary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="success">Success</Button>
              <Button variant="warning">Warning</Button>
              <Button variant="link">Link</Button>
            </Row>
            <Row label="Size">
              <Button size="xs">XSmall</Button>
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button size="xl">XLarge</Button>
            </Row>
            <Row label="With Icon">
              <Button size="xs"><Plus />XSmall</Button>
              <Button size="sm"><Plus />Small</Button>
              <Button><Plus />Default</Button>
              <Button size="lg"><Plus />Large</Button>
              <Button size="xl"><Plus />XLarge</Button>
            </Row>
            <Row label="Icon Only">
              <Button size="icon-xs" variant="ghost"><Search /></Button>
              <Button size="icon-sm" variant="ghost"><Edit /></Button>
              <Button size="icon" variant="ghost"><Trash2 /></Button>
              <Button size="icon-lg" variant="ghost"><Download /></Button>
            </Row>
            <Row label="States">
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
              <Button loading variant="outline">Loading Outline</Button>
              <Button
                onClick={() => { setLoadingBtn(true); setTimeout(() => setLoadingBtn(false), 2000); }}
                loading={loadingBtn}
              >
                {loadingBtn ? "Menyimpan..." : "Klik untuk simulasi"}
              </Button>
            </Row>
          </Section>

          <Section title="BADGE — VARIANTS">
            <Row label="Solid">
              {(["default","secondary","destructive","success","warning","info"] as const).map(v => (
                <Badge key={v} variant={v}>{v}</Badge>
              ))}
            </Row>
            <Row label="Soft">
              {(["soft-default","soft-success","soft-warning","soft-destructive","soft-info","soft-neutral"] as const).map(v => (
                <Badge key={v} variant={v}>{v.replace("soft-","")}</Badge>
              ))}
            </Row>
            <Row label="Outline">
              {(["outline","outline-success","outline-warning","outline-destructive","outline-info"] as const).map(v => (
                <Badge key={v} variant={v}>{v.replace("outline-","") || "default"}</Badge>
              ))}
            </Row>
            <Row label="Dot Indicator">
              <Badge variant="soft-success" dot>Tersedia</Badge>
              <Badge variant="soft-warning" dot>Dipesan</Badge>
              <Badge variant="soft-destructive" dot>Hilang</Badge>
              <Badge variant="soft-neutral" dot>Terjual</Badge>
              <Badge variant="soft-info" dot>Coming Soon</Badge>
            </Row>
            <Row label="Sizes">
              <Badge variant="soft-success" size="xs">xs</Badge>
              <Badge variant="soft-success" size="sm">sm</Badge>
              <Badge variant="soft-success" size="md">md</Badge>
              <Badge variant="soft-success" size="lg">lg</Badge>
            </Row>
          </Section>

          <Section title="TABS — VARIANTS">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Default (Box) — pakai di modal, filter dalam card</p>
                <Tabs defaultValue="a">
                  <TabsList variant="default">
                    <TabsTrigger value="a">Overview</TabsTrigger>
                    <TabsTrigger value="b">Analytics</TabsTrigger>
                    <TabsTrigger value="c">Settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="a"><div className="rounded-lg border p-4 ds-body-md text-muted-foreground mt-2">Konten Overview</div></TabsContent>
                  <TabsContent value="b"><div className="rounded-lg border p-4 ds-body-md text-muted-foreground mt-2">Konten Analytics</div></TabsContent>
                  <TabsContent value="c"><div className="rounded-lg border p-4 ds-body-md text-muted-foreground mt-2">Konten Settings</div></TabsContent>
                </Tabs>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Underline — pakai di drawer detail, halaman utama</p>
                <Tabs defaultValue="a">
                  <TabsList variant="underline">
                    <TabsTrigger value="a">Semua Unit</TabsTrigger>
                    <TabsTrigger value="b">Riwayat</TabsTrigger>
                    <TabsTrigger value="c">Garansi</TabsTrigger>
                  </TabsList>
                  <TabsContent value="a"><div className="pt-3 ds-body-md text-muted-foreground">Konten Unit</div></TabsContent>
                  <TabsContent value="b"><div className="pt-3 ds-body-md text-muted-foreground">Konten Riwayat</div></TabsContent>
                  <TabsContent value="c"><div className="pt-3 ds-body-md text-muted-foreground">Konten Garansi</div></TabsContent>
                </Tabs>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Pill — pakai di filter toggle, customer category nav</p>
                <Tabs defaultValue="a">
                  <TabsList variant="pill">
                    <TabsTrigger value="a">Semua</TabsTrigger>
                    <TabsTrigger value="b">Aktif</TabsTrigger>
                    <TabsTrigger value="c">Non-Aktif</TabsTrigger>
                  </TabsList>
                  <TabsContent value="a"><div className="pt-3 ds-body-md text-muted-foreground">Konten Semua</div></TabsContent>
                  <TabsContent value="b"><div className="pt-3 ds-body-md text-muted-foreground">Konten Aktif</div></TabsContent>
                  <TabsContent value="c"><div className="pt-3 ds-body-md text-muted-foreground">Konten Non-Aktif</div></TabsContent>
                </Tabs>
              </div>
            </div>
          </Section>

          <Section title="INPUT — SIZES &amp; STATES">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Sizes</p>
                <div className="space-y-2">
                  <Input inputSize="xs" placeholder="xs — h-7 — filter compact" />
                  <Input inputSize="sm" placeholder="sm — h-8 — toolbar search" />
                  <Input placeholder="default — h-9 — form utama" />
                  <Input inputSize="lg" placeholder="lg — h-10 — CTA form" />
                  <Input inputSize="xl" placeholder="xl — h-11 — hero search" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">States</p>
                <div className="space-y-2">
                  <Input placeholder="Default state" />
                  <div>
                    <Input state="error" defaultValue="358abc" />
                    <p className="text-xs text-destructive mt-1">Format IMEI tidak valid</p>
                  </div>
                  <div>
                    <Input state="success" defaultValue="358971089756412" />
                    <p className="text-xs text-success mt-1">IMEI valid</p>
                  </div>
                  <Input disabled placeholder="Disabled" />
                  <Textarea placeholder="Textarea..." rows={2} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="FEEDBACK STATES">
            <div className="space-y-3 max-w-lg">
              <div className="flex items-start gap-3 rounded-lg bg-success-bg border border-[hsl(var(--success))/20] p-3">
                <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--success))]">Berhasil disimpan</p>
                  <p className="ds-caption mt-0.5">Data unit telah diperbarui.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-warning-bg border border-warning/20 p-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-warning-foreground">Stok hampir habis</p>
                  <p className="ds-caption mt-0.5">Tersisa 2 unit. Segera lakukan restok.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-info-bg border border-[hsl(var(--info))/20] p-3">
                <Info className="h-4 w-4 text-[hsl(var(--info))] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--info))]">Informasi</p>
                  <p className="ds-caption mt-0.5">Perubahan hanya berlaku untuk unit belum terjual.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-error-bg border border-destructive/20 p-3">
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Gagal memperbarui</p>
                  <p className="ds-caption mt-0.5">Koneksi terputus. Coba lagi.</p>
                </div>
              </div>
            </div>
          </Section>
        </PageSection>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SECTION 3 — ADMIN UI                                    */}
        {/* ══════════════════════════════════════════════════════════ */}
        <PageSection id="admin-ui" title="Admin UI Patterns">

          <Section title="TABLE — HEADER &amp; ROW" subtitle="sticky top / dense mode / hover highlight">
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="text-left ds-label px-4 py-2.5">UNIT</th>
                    <th className="text-left ds-label px-4 py-2.5">STATUS</th>
                    <th className="text-right ds-label px-4 py-2.5">HARGA JUAL</th>
                    <th className="text-left ds-label px-4 py-2.5">KONDISI</th>
                    <th className="ds-label px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { name: "iPhone 15 Pro 256GB", status: "available", price: "Rp 18.500.000", kondisi: "No Minus" },
                    { name: "iPhone 14 128GB Black", status: "reserved", price: "Rp 13.200.000", kondisi: "Minus Baret" },
                    { name: "iPhone 13 256GB Blue", status: "sold", price: "Rp 10.800.000", kondisi: "No Minus" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-accent/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-sm">{row.name}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={row.status === "available" ? "soft-success" : row.status === "reserved" ? "soft-warning" : "soft-neutral"}
                          dot
                          size="sm"
                        >
                          {row.status === "available" ? "Tersedia" : row.status === "reserved" ? "Dipesan" : "Terjual"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-sm">{row.price}</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.kondisi === "No Minus" ? "soft-success" : "soft-warning"} size="xs">{row.kondisi}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon-xs" variant="ghost"><Edit /></Button>
                          <Button size="icon-xs" variant="ghost"><Trash2 /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="STAT CARDS — DASHBOARD">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Stok", value: "248", sub: "Unit aktif", color: "text-[hsl(var(--info))]" },
                { label: "Terjual Hari Ini", value: "12", sub: "Unit", color: "text-success" },
                { label: "Pendapatan", value: "Rp 210jt", sub: "Bulan ini", color: "text-foreground" },
                { label: "Dalam Servis", value: "5", sub: "Unit", color: "text-[hsl(var(--warning))]" },
              ].map(s => (
                <Card key={s.label} className="p-4">
                  <CardContent className="p-0 space-y-1">
                    <p className="ds-label text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="ds-caption text-muted-foreground">{s.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>

          <Section title="FILTER BAR PATTERN">
            <div className="flex flex-wrap gap-2 p-3 bg-card rounded-xl border">
              <Input inputSize="sm" placeholder="Cari IMEI / nama..." className="max-w-[180px]" />
              <Button size="sm" variant="outline">
                <Search className="h-3.5 w-3.5" />
                Filter Status
              </Button>
              {["Tersedia","Dipesan","Terjual"].map(s => (
                <Button key={s} size="xs" variant="tertiary">{s}</Button>
              ))}
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="outline"><Download />Export</Button>
                <Button size="sm"><Plus />Tambah Unit</Button>
              </div>
            </div>
          </Section>
        </PageSection>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SECTION 4 — CUSTOMER UI                                 */}
        {/* ══════════════════════════════════════════════════════════ */}
        <PageSection id="customer-ui" title="Customer UI Patterns">

          <Section title="PRODUCT CARD" subtitle="Grid card & horizontal card — pakai di /katalog dan /">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3">Grid Card Variants</p>
                <div className="flex flex-wrap gap-4">
                  <ProductCard
                    name="iPhone 15 Pro Max 256GB Natural Titanium"
                    series="iPhone 15 Series"
                    price="Rp 21.999.000"
                    badge="Tersedia"
                    stock={8}
                  />
                  <ProductCard
                    name="iPhone 15 128GB Black"
                    series="iPhone 15 Series"
                    price="Rp 14.500.000"
                    originalPrice="Rp 16.200.000"
                    badge="Flash Sale"
                    stock={3}
                    isFlashSale
                  />
                  <ProductCard
                    name="iPhone 14 256GB Blue"
                    series="iPhone 14 Series"
                    price="Rp 12.800.000"
                    badge="Coming Soon"
                    stock={0}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3">Horizontal Card — pakai di halaman search / riwayat</p>
                <div className="max-w-lg space-y-2">
                  {[
                    { name: "iPhone 15 Pro 256GB", price: "Rp 18.500.000", badge: "soft-success" as const, badgeLabel: "Tersedia" },
                    { name: "iPhone 13 128GB", price: "Rp 9.800.000", badge: "soft-warning" as const, badgeLabel: "Dipesan" },
                  ].map(item => (
                    <div key={item.name} className="flex gap-3 p-3 bg-card rounded-xl border border-border hover:shadow-sm transition-all cursor-pointer">
                      <div className="h-14 w-14 bg-neutral-100 rounded-lg flex items-center justify-center shrink-0">
                        <Phone className="h-7 w-7 text-neutral-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          <Badge variant={item.badge} dot size="xs">{item.badgeLabel}</Badge>
                        </div>
                        <p className="text-sm font-bold mt-1">{item.price}</p>
                        <div className="flex items-center justify-between mt-1">
                          <StarRating value={4} />
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="PRICE DISPLAY" subtitle="Harga normal, diskon, flash sale">
            <div className="space-y-4 bg-card rounded-xl border p-5 max-w-sm">
              <div className="space-y-1">
                <p className="ds-caption text-muted-foreground">Harga Normal</p>
                <PriceDisplay price="Rp 18.500.000" />
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="ds-caption text-muted-foreground">Dengan Diskon</p>
                <PriceDisplay price="Rp 15.200.000" original="Rp 18.500.000" discount="-18%" />
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="ds-caption text-muted-foreground">Flash Sale (terbatas)</p>
                <div className="flex items-center gap-2">
                  <Badge variant="warning" size="sm"><Zap className="h-3 w-3" />Flash Sale</Badge>
                  <div className="flex items-center gap-1 bg-destructive/10 px-2 py-0.5 rounded-md">
                    <Clock className="h-3 w-3 text-destructive" />
                    <span className="text-xs font-bold text-destructive">02:14:38</span>
                  </div>
                </div>
                <PriceDisplay price="Rp 12.999.000" original="Rp 16.500.000" discount="-21%" />
              </div>
            </div>
          </Section>

          <Section title="RATING &amp; ULASAN" subtitle="Star rating component — pakai di product detail dan ulasan page">
            <div className="space-y-3 max-w-lg">
              <Row label="Rating Display">
                <StarRating value={5} /><span className="text-sm font-medium">5.0</span>
                <StarRating value={4} /><span className="text-sm font-medium">4.0</span>
                <StarRating value={3} /><span className="text-sm font-medium">3.0</span>
                <StarRating value={1} /><span className="text-sm font-medium">1.0</span>
              </Row>
              <div className="p-4 bg-card rounded-xl border space-y-2">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold">A</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Ahmad R.</p>
                      <span className="ds-caption text-muted-foreground">2 hari lalu</span>
                    </div>
                    <StarRating value={5} />
                    <p className="ds-body-sm mt-1">Produk sesuai deskripsi, kondisi mulus. Pengiriman cepat, packing aman. Recommended!</p>
                    <Badge variant="soft-success" size="xs" className="mt-1">Pembelian Terverifikasi</Badge>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="CATEGORY FILTER CHIPS" subtitle="Pakai di /katalog — filter seri iPhone">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="default">Semua</Button>
                <Button size="sm" variant="tertiary">iPhone 15 Series</Button>
                <Button size="sm" variant="tertiary">iPhone 14 Series</Button>
                <Button size="sm" variant="tertiary">iPhone 13 Series</Button>
                <Button size="sm" variant="tertiary">iPhone 12 Series</Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="soft-neutral" size="md" className="cursor-pointer">128GB</Badge>
                <Badge variant="default" size="md" className="cursor-pointer">256GB</Badge>
                <Badge variant="soft-neutral" size="md" className="cursor-pointer">512GB</Badge>
                <Badge variant="soft-neutral" size="md" className="cursor-pointer">1TB</Badge>
              </div>
            </div>
          </Section>

          <Section title="CART ITEM" subtitle="Pakai di /keranjang">
            <div className="max-w-md">
              <CartItem />
            </div>
          </Section>

          <Section title="ORDER STATUS TIMELINE" subtitle="Pakai di /riwayat/:id — customer tracking">
            <div className="max-w-md space-y-4">
              {[1, 2, 3, 4].map(step => (
                <div key={step} className="space-y-1">
                  <p className="ds-caption text-muted-foreground">Step {step} aktif</p>
                  <div className="bg-card border rounded-xl p-4">
                    <OrderTimeline currentStep={step - 1} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="BREADCRUMB NAVIGATION" subtitle="Pakai di product detail, checkout">
            <div className="space-y-2">
              <Breadcrumb items={["Beranda", "Katalog", "iPhone 15 Series", "iPhone 15 Pro Max 256GB"]} />
              <Breadcrumb items={["Beranda", "Keranjang", "Checkout"]} />
            </div>
          </Section>

          <Section title="CUSTOMER SEARCH BAR" subtitle="Pakai di navbar customer">
            <div className="max-w-md">
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 h-10 border border-transparent focus-within:border-ring focus-within:bg-background transition-all">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                  placeholder="Cari iPhone, iPad, MacBook..."
                />
              </div>
            </div>
          </Section>

          <Section title="CUSTOMER CONTACT / CTA STRIP" subtitle="Pakai di landing page — WhatsApp CTA">
            <div className="max-w-lg bg-primary text-primary-foreground rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Ada pertanyaan? Hubungi kami</p>
                <p className="text-xs text-primary-foreground/70">Senin–Sabtu, 09.00–21.00 WIB</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                  <MessageCircle className="h-3.5 w-3.5" />WA
                </Button>
                <Button size="sm" className="bg-white text-black hover:bg-white/90">
                  Lihat Produk<ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Section>

          <Section title="TRUST BADGES" subtitle="Pakai di landing page, product detail, checkout">
            <div className="flex flex-wrap gap-3">
              {[
                { icon: Shield, label: "Garansi Resmi", sub: "1 Tahun" },
                { icon: Truck, label: "Pengiriman Aman", sub: "Asuransi Penuh" },
                { icon: CheckCheck, label: "Produk Original", sub: "100% Asli" },
                { icon: Phone, label: "CS Siap Bantu", sub: "Senin–Sabtu" },
              ].map(b => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-4 py-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{b.label}</p>
                      <p className="ds-caption text-muted-foreground">{b.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </PageSection>

        {/* Footer */}
        <div className="border-t border-border pt-8 pb-10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="ds-caption text-muted-foreground">IVALORA Design System v1.0 — {new Date().getFullYear()}</p>
            <div className="flex items-center gap-2">
              <Badge variant="soft-neutral" size="xs">Global — Admin &amp; Customer</Badge>
              <Badge variant="soft-success" size="xs">Poppins</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
