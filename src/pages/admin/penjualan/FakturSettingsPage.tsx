import { useEffect, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Upload, Trash2, Plus, X, Eye, Code, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/shared/use-toast";
import { useAuth } from "@/contexts/admin/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InvoiceDocumentA4, DEFAULT_FONT_SETTINGS, FONT_FAMILIES, type InvoiceFontSettings, type LogoType, type FontFamily } from "@/components/admin/penjualan/InvoiceDocumentA4";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { cn } from "@/lib/utils";
import logoIconSrc from "@/assets/logo-icon.svg";
import logoFullSrc from "@/assets/logo-horizontal.png";

const FULL_TERMS_HTML = `<h2>Syarat dan Ketentuan</h2>
<h2>Rincian Garansi iPhone – Ivalora Gadget</h2>

<p>Dokumen ini menjelaskan ketentuan garansi untuk setiap unit iPhone yang dibeli di Ivalora Gadget. Dengan melakukan pembelian, pelanggan dianggap telah membaca, memahami, dan menyetujui seluruh ketentuan berikut.</p>

<h3>1. Garansi IMEI / Fungsi Sinyal</h3>
<ul>
  <li>iPhone Resmi Indonesia, iPhone Bea Cukai, dan iPhone Whitelist mendapatkan garansi keabsahan IMEI dan fungsi sinyal selama perangkat digunakan secara normal.</li>
  <li>Garansi ini berlaku sepanjang tidak terdapat perubahan kebijakan pemerintah, pemblokiran dari otoritas berwenang, gangguan dari operator seluler, atau penyebab lain di luar kendali Ivalora Gadget.</li>
  <li>Garansi sinyal tidak mencakup gangguan jaringan yang disebabkan oleh operator, pengaturan jaringan manual, pergantian SIM/eSIM yang tidak wajar, penggunaan profil/operator yang tidak kompatibel, atau perubahan sistem/perangkat lunak yang dilakukan pengguna.</li>
</ul>

<h3>2. Garansi Unit Terbatas (1 Bulan)</h3>

<div style="background:#fff8e1; border:1px solid #f0c36d; padding:12px 16px; margin:12px 0; border-radius:8px;">
  <strong>Periode Garansi Unit</strong><br>
  Garansi unit berlaku sejak pertama kali invoice dibuat pada tanggal <strong>[Tanggal Pembelian]</strong> sampai dengan tanggal <strong>[Tanggal Berakhir Garansi]</strong>.
</div>

<p>Garansi unit berlaku selama <strong>1 (satu) bulan</strong> sejak tanggal pembelian dan mencakup kendala fungsi <strong>non-human error</strong> atau cacat bawaan pada unit yang bukan disebabkan oleh benturan, cairan, modifikasi, atau kesalahan penggunaan.</p>

<ul>
  <li><strong>Baterai:</strong> Garansi baterai berlaku apabila kesehatan baterai mengalami penurunan sebesar <strong>20% atau lebih</strong> dalam 1 (satu) bulan pertama sejak tanggal pembelian, dengan acuan kondisi battery health saat serah terima. Penanganan klaim baterai dilakukan dalam bentuk perbaikan atau penggantian baterai. Pengembalian dana hanya dapat dipertimbangkan apabila perbaikan atau penggantian tidak dapat dilakukan.</li>

  <li><strong>Layar (LCD/OLED):</strong> Garansi mencakup gangguan tampilan yang bukan disebabkan oleh kerusakan fisik, seperti dead pixel, garis tampilan, green screen, atau gangguan visual lain yang terindikasi sebagai defect bawaan. Tompel, bercak, shadow, kerusakan akibat tekanan, benturan, jatuh, atau pecah tidak termasuk dalam garansi.</li>

  <li><strong>Komponen internal:</strong> Garansi mencakup kerusakan fungsi speaker, microphone, Wi-Fi, Bluetooth, kamera, atau komponen internal lainnya yang berdasarkan hasil pemeriksaan terbukti bukan disebabkan oleh human error atau modifikasi perangkat.</li>

  <li><strong>Software:</strong> Garansi mencakup gangguan software bawaan pada perangkat sepanjang tidak disebabkan oleh jailbreak, reset/restore yang tidak sesuai prosedur, update sistem yang gagal akibat tindakan pengguna, instalasi profil/aplikasi tertentu, atau modifikasi software pihak ketiga.</li>
</ul>

<h3>3. Pengecualian Garansi (Tidak Ditanggung)</h3>
<ul>
  <li>Kerusakan fisik seperti layar retak, pecah, penyok, rangka bengkok, lecet berat, atau kerusakan akibat benturan, jatuh, tekanan, dan penggunaan tidak wajar.</li>
  <li>Kerusakan akibat cairan, kelembapan berlebih, korosi, atau indikator cairan aktif.</li>
  <li>Kerusakan akibat panas ekstrem, arus listrik tidak stabil, atau pola pemakaian yang tidak normal.</li>
  <li>Kerusakan akibat penggunaan charger, kabel, adaptor, baterai, atau aksesori non-original / tidak kompatibel.</li>
  <li>Penurunan performa baterai yang terjadi setelah melewati masa garansi 1 (satu) bulan.</li>
  <li>Gangguan software akibat jailbreak, modifikasi sistem, beta profile, reset/restore, flashing, update tidak resmi, atau aplikasi pihak ketiga.</li>
  <li>Kerusakan yang timbul setelah perangkat diperiksa, dibuka, diperbaiki, atau dimodifikasi oleh pihak selain Ivalora Gadget.</li>
</ul>

<h3>4. Stiker Void / Segel Garansi</h3>
<ul>
  <li>Setiap unit iPhone second dilengkapi <strong>stiker void / segel garansi Ivalora Gadget</strong> sebagai penanda keamanan unit.</li>
  <li>Stiker atau segel tersebut wajib dalam kondisi utuh saat klaim garansi diajukan.</li>
  <li>Segel ini digunakan untuk membantu memastikan bahwa unit belum pernah dibuka, diperbaiki, atau dimodifikasi tanpa pemeriksaan dan arahan dari Ivalora Gadget.</li>
</ul>

<h3>5. Prosedur Klaim Garansi</h3>
<ul>
  <li><strong>Sangat disarankan</strong> untuk terlebih dahulu menghubungi admin toko Ivalora Gadget melalui WhatsApp sebelum datang ke toko atau mengirimkan unit klaim.</li>
  <li>Admin dapat dihubungi melalui nomor WhatsApp:
    <strong>
      <a
        href="https://wa.me/6285890024760?text=Halo%20Admin%20Ivalora%20Gadget%2C%20saya%20ingin%20mengajukan%20klaim%20garansi.%0A%0ANomor%20Invoice%3A%20%5BNO_INVOICE%5D%0AUnit%3A%20%5BNAMA_UNIT%5D%0AIMEI%3A%20%5BIMEI%5D%0AKendala%3A%20%5BKENDALA%5D%0A%0AMohon%20dibantu%20pengecekannya.%20Terima%20kasih."
        target="_blank"
        rel="noopener noreferrer"
      >Hubungi Admin Ivalora Gadget via WhatsApp</a>
    </strong>
  </li>
  <li>Saat mengajukan klaim, pelanggan <strong>wajib menyertakan nota pembelian asli</strong> atau bukti transaksi yang sah.</li>
  <li>Agar proses pengecekan lebih cepat, pelanggan disarankan menyampaikan data utama seperti:
    <ul>
      <li><strong>Nomor Invoice</strong></li>
      <li><strong>Unit / Tipe iPhone</strong></li>
      <li><strong>IMEI</strong></li>
      <li><strong>Kendala yang dihadapi</strong></li>
    </ul>
  </li>
  <li>Setelah unit diterima, perangkat akan diperiksa dan diverifikasi terlebih dahulu oleh <strong>tim toko Ivalora Gadget</strong> dengan estimasi <strong>3–5 hari kerja</strong>, tergantung kondisi unit dan antrean pemeriksaan.</li>
  <li>Hasil pemeriksaan menjadi dasar untuk menentukan apakah kendala yang dialami termasuk dalam cakupan garansi atau tidak.</li>
  <li>Apabila klaim disetujui dan kendala termasuk dalam cakupan garansi, Ivalora Gadget akan menentukan bentuk penanganan berupa perbaikan, penggantian komponen, atau penggantian unit sesuai hasil pemeriksaan dan ketersediaan.</li>
  <li>Apabila kendala berada di luar cakupan garansi, Ivalora Gadget dapat memberikan subsidi biaya perbaikan sebesar <strong>50%–100%</strong> sebagai bentuk kebijakan layanan, sesuai hasil pemeriksaan dan pertimbangan internal.</li>
</ul>

<h3>6. Garansi Tidak Berlaku / Klaim Tidak Dapat Diproses</h3>
<ul>
  <li>Perangkat telah dibuka, diperbaiki, atau dimodifikasi oleh pihak selain Ivalora Gadget.</li>
  <li><strong>Stiker void / segel Ivalora Gadget rusak, dilepas, dipindahkan, atau tidak lagi utuh</strong>, sehingga tidak dapat dipastikan bahwa unit masih dalam kondisi sesuai saat serah terima.</li>
  <li>Pelanggan merusak atau membuka segel sendiri tanpa arahan dari Ivalora Gadget, sehingga klaim tidak dapat digunakan sebagai dasar bahwa kendala yang terjadi merupakan kerusakan bawaan atau non-human error.</li>
  <li>Terdapat indikasi manipulasi unit, penggantian komponen, atau penyalahgunaan klaim garansi.</li>
  <li>Nomor IMEI, serial number, atau identitas perangkat tidak sesuai dengan data pembelian.</li>
  <li>Perangkat hilang atau dicuri.</li>
  <li>Garansi tidak dapat dipindahtangankan tanpa persetujuan tertulis dari Ivalora Gadget.</li>
</ul>

<h3>7. Catatan Tambahan</h3>
<ul>
  <li>Garansi ini <strong>bukan asuransi</strong> atas segala jenis kerusakan.</li>
  <li>Kerusakan akibat kelalaian, kesalahan penggunaan, atau faktor eksternal tidak termasuk dalam tanggungan garansi.</li>
  <li>Untuk iPhone second, dimungkinkan terdapat perbedaan kondisi fisik minor dibandingkan unit baru. Karena itu, pembeli disarankan melakukan pemeriksaan fisik saat serah terima unit.</li>
  <li>Dengan melakukan pembelian, pelanggan dianggap telah memahami dan menyetujui seluruh ketentuan garansi yang berlaku di Ivalora Gadget.</li>
</ul>`;

const DEFAULT_ADDITIONAL_NOTES = [
  "Belum punya akun? Daftarkan diri Anda di ivaloragadget.id untuk mendapatkan info promo terkini dari iPhone resmi dan second berkualitas.",
  "Garansi berlaku sesuai dengan ketentuan yang tertera pada dokumen Syarat dan Ketentuan.",
  "Simpan faktur ini sebagai bukti pembelian yang sah.",
  "Follow instagram & tiktok kami: [@ivalora_gadget](https://www.instagram.com/ivalora_gadget)",
];

const DEFAULT_WA_TEMPLATE = `Selamat {greeting} kak {customer_name},

Terima kasih telah berbelanja di Ivalora Gadget! 🙏

Berikut rincian pesanan Anda:
{items_list}

Total pembelian: {total}
{discount_info}

Metode pembayaran: {payment_method}
No. Faktur: {invoice_number}
Tanggal: {invoice_date}
Cabang: {branch_name}
Dilayani oleh: {handled_by}

Adapun dokumen faktur pesanan Anda dapat diakses melalui link berikut:
{invoice_link}

Terima kasih atas kepercayaan Anda. 🙏
— Ivalora Gadget Indonesia`;

const WA_VARIABLES = [
  { key: "{greeting}", desc: "Sapaan waktu (pagi/siang/sore/malam)" },
  { key: "{customer_name}", desc: "Nama pelanggan" },
  { key: "{items_list}", desc: "Daftar item lengkap (nama, IMEI, harga)" },
  { key: "{total}", desc: "Total pembelian" },
  { key: "{discount_info}", desc: "Info diskon (jika ada)" },
  { key: "{invoice_link}", desc: "Link akses faktur publik" },
  { key: "{invoice_number}", desc: "Nomor faktur" },
  { key: "{invoice_date}", desc: "Tanggal faktur" },
  { key: "{payment_method}", desc: "Metode pembayaran" },
  { key: "{branch_name}", desc: "Nama cabang" },
  { key: "{handled_by}", desc: "Nama petugas yang melayani" },
  { key: "{customer_phone}", desc: "Nomor telepon pelanggan" },
  { key: "{subtotal}", desc: "Subtotal sebelum diskon" },
  { key: "{shipping_cost}", desc: "Biaya ongkir" },
  { key: "{balance_due}", desc: "Saldo jatuh tempo" },
];

interface InvoiceSettings {
  id?: string;
  branch_id: string;
  company_name: string;
  logo_url: string | null;
  footer_text: string;
  terms_json: any;
  number_prefix: string;
  number_format: "branch_code" | "custom" | "none";
  custom_code: string;
  sequence_reset: string;
  sequence_start: number;
  use_date_reset: boolean;
  default_due_days: number;
  font_title_size: number;
  font_invoice_id_size: number;
  font_company_name_size: number;
  font_branch_info_size: number;
  font_transaction_code_size: number;
  font_address_size: number;
  font_served_by_size: number;
  font_terms_size: number;
  signature_url: string | null;
  signature_type: "system" | "custom";
  wa_template: string;
  pdf_name_format: string;
  additional_notes: string[];
  logo_type: LogoType;
  custom_logo_url: string | null;
  font_family: FontFamily;
  stamp_text: string;
  stamp_sub_text: string;
  document_link_base: string;
  header_tagline: string;
  header_tagline_align: "left" | "center" | "right";
}

function FontSizeRow({ label, value, onChange, min = 8, max = 60 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="w-20 h-8 text-sm font-mono text-center"
        />
        <span className="text-xs text-muted-foreground">px</span>
      </div>
    </div>
  );
}

function makeSampleInvoice(settings: InvoiceSettings) {
  return {
    invoice_number: `${settings.number_prefix}-EP-202602-000001`,
    status: "published",
    customer_name: "Ahmad Fauzi",
    customer_email: "ahmad@email.com",
    customer_phone: "081234567890",
    customer_address: null,
    shipping_address: "Jl. Raya Darmo No. 123, Surabaya, Jawa Timur",
    subtotal: 15500000,
    discount_amount: 500000,
    discount_code: "PROMO50",
    shipping_cost: 25000,
    shipping_discount: 10000,
    packing_kayu_cost: 50000,
    total: 15065000,
    amount_paid: 15065000,
    balance_due: 0,
    payment_method_name: "Transfer BCA",
    payment_reference: "TRX-20260222-001",
    payment_status: "paid",
    items_snapshot: [
      { product_label: "iPhone 13 Pro 256GB Gold Resmi BC", imei: "352345678901234", qty: 1, selling_price: 8500000 },
      { product_label: "iPhone 11 128GB Black iBox", imei: "352345678901235", qty: 1, selling_price: 7000000 },
    ],
    invoice_date: new Date().toISOString(),
    due_date: null,
    paid_at: new Date().toISOString(),
    handled_by_name: "Adhitya (Super admin)",
    channel: "pos",
    notes: null,
    terms_snapshot: settings.terms_json,
    additional_notes: settings.additional_notes?.length ? settings.additional_notes : undefined,
    public_token: "sample-token-preview",
    branches: { name: "Eastern Park", code: "EP", full_address: "Ruko Eastern Park B16, Sukolilo, Surabaya\nSurabaya Jawa Timur 60111", phone: "085890024760", email: "ivaloragadget@gmail.com", city: "Surabaya", province: "Jawa Timur", postal_code: "60111", google_maps_url: "https://maps.google.com/?q=Ruko+Eastern+Park+B16+Sukolilo+Surabaya" },
    transactions: { transaction_code: "TRX-EP-20260222-000001" },
  };
}

export default function FakturSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeBranch } = useAuth();
  const isMobile = useIsMobile();

  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"identity" | "numbering" | "fonts" | "whatsapp" | "terms">("identity");
  const [waEditorMode, setWaEditorMode] = useState<"text" | "preview">("text");
  const [termsEditorMode, setTermsEditorMode] = useState<"html" | "preview">("html");
  const [previewPage, setPreviewPage] = useState(0);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [globalBranchId, setGlobalBranchId] = useState("");

  useEffect(() => {
    const bid = activeBranch?.id;
    if (bid) {
      setGlobalBranchId(bid);
    } else {
      supabase.from("branches").select("id").eq("is_active", true).limit(1).then(({ data }) => {
        if (data && data.length > 0) setGlobalBranchId((data[0] as any).id);
      });
    }
  }, [activeBranch]);

  const fetchSettings = useCallback(async () => {
    if (!globalBranchId) return;
    setLoading(true);
    const { data } = await supabase
      .from("invoice_settings" as never)
      .select("*")
      .limit(1)
      .maybeSingle() as { data: any | null };

    if (data) {
      const termsVal = data.terms_json;
      setSettings({
        ...data,
        terms_json: typeof termsVal === "string" && termsVal.trim().length > 0 ? termsVal : (Array.isArray(termsVal) && termsVal.length > 0 ? termsVal : FULL_TERMS_HTML),
        number_format: data.number_format ?? "branch_code",
        custom_code: data.custom_code ?? "",
        font_title_size: data.font_title_size ?? 42,
        font_invoice_id_size: data.font_invoice_id_size ?? 24,
        font_company_name_size: data.font_company_name_size ?? 32,
        font_branch_info_size: data.font_branch_info_size ?? 11,
        font_transaction_code_size: data.font_transaction_code_size ?? 20,
        font_address_size: data.font_address_size ?? 11,
        font_served_by_size: data.font_served_by_size ?? 11,
        font_terms_size: data.font_terms_size ?? 11,
        signature_url: data.signature_url ?? null,
        signature_type: data.signature_type ?? "system",
        wa_template: data.wa_template ?? DEFAULT_WA_TEMPLATE,
        pdf_name_format: data.pdf_name_format ?? "{customer}_{date}",
        additional_notes: data.additional_notes?.length ? data.additional_notes : DEFAULT_ADDITIONAL_NOTES,
        logo_type: data.logo_type ?? "icon",
        custom_logo_url: data.logo_url ?? null,
        font_family: data.font_family ?? "Poppins",
        stamp_text: data.stamp_text ?? "IVALORA GADGET",
        stamp_sub_text: data.stamp_sub_text ?? "",
        document_link_base: data.document_link_base ?? window.location.origin,
        header_tagline: data.header_tagline ?? "IVALORA GADGET - PUSAT JUAL BELI IPHONE RESMI SURABAYA",
        header_tagline_align: data.header_tagline_align ?? "center",
        sequence_start: data.sequence_start ?? 1,
        use_date_reset: data.use_date_reset ?? true,
      });
    } else {
      setSettings({
        branch_id: globalBranchId,
        company_name: "IVALORA GADGET",
        logo_url: null,
        footer_text: "Dokumen ini dibuat secara otomatis oleh Ivalora Gadget RMS",
        terms_json: FULL_TERMS_HTML,
        number_prefix: "INV",
        number_format: "branch_code",
        custom_code: "",
        sequence_reset: "monthly",
        sequence_start: 1,
        use_date_reset: true,
        default_due_days: 0,
        ...DEFAULT_FONT_SETTINGS,
        signature_url: null,
        signature_type: "system",
        wa_template: DEFAULT_WA_TEMPLATE,
        pdf_name_format: "{customer}_{date}",
        additional_notes: DEFAULT_ADDITIONAL_NOTES,
        logo_type: "icon",
        custom_logo_url: null,
        font_family: "Poppins",
        stamp_text: "IVALORA GADGET",
        stamp_sub_text: "",
        document_link_base: window.location.origin,
        header_tagline: "IVALORA GADGET - PUSAT JUAL BELI IPHONE RESMI SURABAYA",
        header_tagline_align: "center",
      });
    }
    setLoading(false);
  }, [globalBranchId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings || !globalBranchId) return;
    setSaving(true);
    const payload: any = {
      branch_id: globalBranchId,
      company_name: settings.company_name,
      logo_url: settings.custom_logo_url,
      footer_text: settings.footer_text,
      terms_json: settings.terms_json,
      number_prefix: settings.number_prefix,
      number_format: settings.number_format,
      custom_code: settings.custom_code,
      sequence_reset: settings.sequence_reset,
      default_due_days: settings.default_due_days,
      font_title_size: settings.font_title_size,
      font_invoice_id_size: settings.font_invoice_id_size,
      font_company_name_size: settings.font_company_name_size,
      font_branch_info_size: settings.font_branch_info_size,
      font_transaction_code_size: settings.font_transaction_code_size,
      font_address_size: settings.font_address_size,
      font_served_by_size: settings.font_served_by_size,
      font_terms_size: settings.font_terms_size,
      signature_url: settings.signature_url,
      signature_type: settings.signature_type,
      wa_template: settings.wa_template,
      pdf_name_format: settings.pdf_name_format,
      additional_notes: settings.additional_notes?.length ? settings.additional_notes : null,
      logo_type: settings.logo_type,
      font_family: settings.font_family,
      stamp_text: settings.stamp_text,
      stamp_sub_text: settings.stamp_sub_text,
      document_link_base: settings.document_link_base,
      header_tagline: settings.header_tagline,
      header_tagline_align: settings.header_tagline_align,
      sequence_start: settings.sequence_start,
      use_date_reset: settings.use_date_reset,
    };

    if (settings.id) {
      const { error } = await supabase.from("invoice_settings" as never).update(payload as never).eq("id", settings.id);
      if (error) toast({ title: "Gagal menyimpan", variant: "destructive" });
      else toast({ title: "Pengaturan faktur disimpan" });
    } else {
      const { error } = await supabase.from("invoice_settings" as never).insert(payload as never);
      if (error) toast({ title: "Gagal menyimpan", variant: "destructive" });
      else { toast({ title: "Pengaturan faktur disimpan" }); fetchSettings(); }
    }
    setSaving(false);
  };

  const handleUploadSignature = async (file: File) => {
    try {
      const { uploadFile } = await import("@/lib/upload");
      const result = await uploadFile(file, "documents");
      setSettings(s => s ? { ...s, signature_url: result.url, signature_type: "custom" } : s);
      toast({ title: "Tanda tangan berhasil diupload" });
    } catch {
      toast({ title: "Gagal upload tanda tangan", variant: "destructive" });
    }
  };

  const handleUploadLogo = async (file: File) => {
    try {
      const { uploadFile } = await import("@/lib/upload");
      const result = await uploadFile(file, "documents");
      setSettings(s => s ? { ...s, custom_logo_url: result.url, logo_type: "custom" as LogoType } : s);
      toast({ title: "Logo berhasil diupload" });
    } catch {
      toast({ title: "Gagal upload logo", variant: "destructive" });
    }
  };

  const set = (partial: Partial<InvoiceSettings>) => setSettings(s => s ? { ...s, ...partial } : s);

  if (loading || !settings) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
        </div>
      </DashboardLayout>
    );
  }

  const codePreview = settings.number_format === "none" ? "" : (settings.number_format === "custom" && settings.custom_code ? settings.custom_code.toUpperCase() : "EP");
  const datePart = settings.use_date_reset 
    ? (settings.sequence_reset === "daily" ? "20260222-" : settings.sequence_reset === "yearly" ? "2026-" : "202602-")
    : "";
  const previewNumber = `${settings.number_prefix}${codePreview ? "-" + codePreview : ""}-${datePart}${String(settings.sequence_start).padStart(6, "0")}`;

  const fontSettings: InvoiceFontSettings = {
    font_title_size: settings.font_title_size,
    font_invoice_id_size: settings.font_invoice_id_size,
    font_company_name_size: settings.font_company_name_size,
    font_branch_info_size: settings.font_branch_info_size,
    font_transaction_code_size: settings.font_transaction_code_size,
    font_address_size: settings.font_address_size,
    font_served_by_size: settings.font_served_by_size,
    font_terms_size: settings.font_terms_size,
  };

  const sampleInvoice = makeSampleInvoice(settings);

  const waPreview = settings.wa_template
    .replace("{greeting}", "siang")
    .replace("{customer_name}", "Ahmad Fauzi")
    .replace("{items_list}", "1. iPhone 13 Pro 256GB Gold Resmi BC — Rp 8.500.000\n2. iPhone 11 128GB Black iBox — Rp 7.000.000")
    .replace("{total}", "Rp 15.065.000")
    .replace("{subtotal}", "Rp 15.500.000")
    .replace("{discount_info}", "Diskon: Rp 500.000 (PROMO50)")
    .replace("{invoice_link}", `${settings.document_link_base}/faktur/view/abc123`)
    .replace("{invoice_number}", previewNumber)
    .replace("{invoice_date}", "22 Februari 2026")
    .replace("{payment_method}", "Transfer BCA")
    .replace("{branch_name}", "Eastern Park")
    .replace("{handled_by}", "Adhitya (Super admin)")
    .replace("{customer_phone}", "081234567890")
    .replace("{shipping_cost}", "Rp 25.000")
    .replace("{balance_due}", "Rp 0");

  const totalPages = sampleInvoice.terms_snapshot ? 2 : 1;

  // Logo preview source
  const getLogoPreviewSrc = (type: LogoType) => {
    if (type === "icon") return logoIconSrc;
    if (type === "full") return logoFullSrc;
    if (type === "custom" && settings.custom_logo_url) return settings.custom_logo_url;
    return null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Sticky Header + Tab Bar */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-border">
          {/* Row 1: title + action buttons */}
          <div className="flex items-center justify-between gap-2 pt-3 pb-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin/penjualan/faktur")} className="h-8 w-8 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground leading-tight">Pengaturan Faktur</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Konfigurasi global dokumen faktur</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-1.5 h-8 text-xs">
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{showPreview ? "Tutup Preview" : "Preview"}</span>
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8 text-xs">
                <Save className="w-3.5 h-3.5" />
                {saving ? "..." : "Simpan"}
              </Button>
            </div>
          </div>
          {/* Row 2: tab group */}
          <div className="overflow-x-auto pb-3 pt-2">
            <div className="inline-flex items-center gap-1 border border-border rounded-xl p-1 bg-muted/40">
              {([
                { key: "identity", label: "Identitas" },
                { key: "numbering", label: "Penomoran & TTD" },
                { key: "fonts", label: "Font & Logo" },
                { key: "whatsapp", label: "WhatsApp" },
                { key: "terms", label: "S&K" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                    activeTab === key
                      ? "bg-foreground text-background shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`grid gap-4 sm:gap-6 ${showPreview ? "grid-cols-1 xl:grid-cols-[1fr_520px]" : "grid-cols-1"}`}>
          {/* Settings Panel */}
          <div>
            <div className="space-y-3 sm:space-y-4">

              {/* Identity */}
              {activeTab === "identity" && <div>
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm sm:text-base">Identitas Dokumen</CardTitle>
                    <CardDescription className="text-xs">Informasi header faktur, catatan tambahan, dan link dokumen</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Nama Perusahaan</Label>
                        <Input value={settings.company_name} onChange={(e) => set({ company_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Footer Text</Label>
                        <Input value={settings.footer_text} onChange={(e) => set({ footer_text: e.target.value })} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Default Jatuh Tempo (hari)</Label>
                        <Input type="number" min={0} value={settings.default_due_days} onChange={(e) => set({ default_due_days: parseInt(e.target.value) || 0 })} />
                        <p className="text-[10px] text-muted-foreground">0 = jatuh tempo sama dengan tanggal faktur</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Format Nama File PDF</Label>
                        <Input value={settings.pdf_name_format} onChange={(e) => set({ pdf_name_format: e.target.value })} placeholder="{customer}_{date}" />
                        <p className="text-[10px] text-muted-foreground">
                          Variabel: <code className="text-[10px] bg-muted px-1 rounded">{"{customer}"}</code> <code className="text-[10px] bg-muted px-1 rounded">{"{date}"}</code> <code className="text-[10px] bg-muted px-1 rounded">{"{invoice_number}"}</code>
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Header Tagline */}
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Header Tagline Dokumen</Label>
                      <Input value={settings.header_tagline} onChange={(e) => set({ header_tagline: e.target.value })} placeholder="IVALORA GADGET - PUSAT JUAL BELI IPHONE RESMI SURABAYA" />
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">Posisi:</span>
                        {(["left", "center", "right"] as const).map(a => (
                          <Button key={a} variant={settings.header_tagline_align === a ? "default" : "outline"} size="sm" className="h-6 text-[10px] px-2" onClick={() => set({ header_tagline_align: a })}>
                            {a === "left" ? "Kiri" : a === "center" ? "Tengah" : "Kanan"}
                          </Button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Teks ini tampil di bagian atas dokumen faktur sebelum logo. Kosongkan jika tidak ingin menampilkan.</p>
                    </div>

                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs sm:text-sm">Base URL Link Dokumen Faktur</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 gap-1.5"
                          onClick={() => {
                            set({ document_link_base: window.location.origin });
                            toast({ title: "Tersinkronisasi", description: `URL diubah ke ${window.location.origin}` });
                          }}
                        >
                          <RefreshCw className="w-3 h-3" /> Auto Sync
                        </Button>
                      </div>
                      <Input value={settings.document_link_base} onChange={(e) => set({ document_link_base: e.target.value })} placeholder="http://localhost:8080" />
                      <p className="text-[10px] text-muted-foreground">URL ini digunakan sebagai basis link publik faktur dan QR Code. Contoh: <code className="bg-muted px-1 rounded">{settings.document_link_base}/faktur/view/token</code></p>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Label className="text-xs sm:text-sm">Catatan Tambahan (bullet points)</Label>
                      <p className="text-[10px] text-muted-foreground">Catatan ini tampil di dokumen faktur. Kosongkan jika tidak ingin menampilkan.</p>
                      {settings.additional_notes?.map((note, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-muted-foreground mt-2.5 text-xs">•</span>
                          <Input value={note} onChange={(e) => {
                            const arr = [...(settings.additional_notes ?? [])];
                            arr[i] = e.target.value;
                            set({ additional_notes: arr });
                          }} className="flex-1 text-xs sm:text-sm" />
                          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                            const arr = [...(settings.additional_notes ?? [])];
                            arr.splice(i, 1);
                            set({ additional_notes: arr });
                          }}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => set({ additional_notes: [...(settings.additional_notes ?? []), ""] })} className="gap-1.5 text-xs">
                        <Plus className="w-3.5 h-3.5" /> Tambah Catatan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>}

              {/* Numbering & Signature */}
              {activeTab === "numbering" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm sm:text-base">Format Penomoran</CardTitle>
                    <CardDescription className="text-xs">Atur prefix, kode, dan reset sequence faktur</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Prefix</Label>
                      <Input value={settings.number_prefix} onChange={(e) => set({ number_prefix: e.target.value.toUpperCase() })} maxLength={10} className="max-w-[200px]" />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-xs sm:text-sm">Kode Cabang / Entitas</Label>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="numFmt" checked={settings.number_format === "branch_code"} onChange={() => set({ number_format: "branch_code" })} className="accent-primary" />
                          <span className="text-xs sm:text-sm">Otomatis cabang</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="numFmt" checked={settings.number_format === "custom"} onChange={() => set({ number_format: "custom" })} className="accent-primary" />
                          <span className="text-xs sm:text-sm">Kustom</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="numFmt" checked={settings.number_format === "none"} onChange={() => set({ number_format: "none" })} className="accent-primary" />
                          <span className="text-xs sm:text-sm">Tanpa kode</span>
                        </label>
                      </div>
                      {settings.number_format === "custom" && (
                        <Input value={settings.custom_code} onChange={(e) => set({ custom_code: e.target.value.toUpperCase() })} placeholder="Contoh: HQ, MAIN" maxLength={10} className="max-w-[200px]" />
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Reset Sequence & Tanggal</Label>
                      <Select value={settings.sequence_reset} onValueChange={(v) => set({ sequence_reset: v })}>
                        <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Harian</SelectItem>
                          <SelectItem value="monthly">Bulanan</SelectItem>
                          <SelectItem value="yearly">Tahunan</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input 
                          type="checkbox" 
                          checked={settings.use_date_reset} 
                          onChange={(e) => set({ use_date_reset: e.target.checked })}
                          className="accent-primary h-4 w-4" 
                        />
                        <span className="text-xs sm:text-sm">Sertakan tanggal dalam nomor faktur</span>
                      </label>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Mulai Nomor Dari (Sequence)</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        value={settings.sequence_start} 
                        onChange={(e) => set({ sequence_start: parseInt(e.target.value) || 1 })} 
                        className="max-w-[200px]"
                      />
                      <p className="text-[10px] text-muted-foreground">Ubah jika ingin memulai nomor faktur baru dari angka tertentu.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-[10px] text-muted-foreground mb-1">Preview nomor faktur:</p>
                      <p className="font-mono text-xs sm:text-sm font-bold text-foreground">{previewNumber}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Signature / Stamp */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm sm:text-base">Tanda Tangan / Stempel</CardTitle>
                    <CardDescription className="text-xs">Upload tanda tangan kustom atau gunakan stempel otomatis</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={settings.signature_type === "system"} onChange={() => set({ signature_type: "system" })} className="accent-primary" />
                        <span className="text-xs sm:text-sm">Stempel Sistem</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={settings.signature_type === "custom"} onChange={() => set({ signature_type: "custom" })} className="accent-primary" />
                        <span className="text-xs sm:text-sm">Upload Tanda Tangan</span>
                      </label>
                    </div>

                    {settings.signature_type === "custom" && (
                      <div className="space-y-3">
                        {settings.signature_url ? (
                          <div className="flex items-center gap-4">
                            <img src={settings.signature_url} alt="Tanda Tangan" className="h-20 object-contain border border-border rounded p-2 bg-white" />
                            <Button variant="outline" size="sm" onClick={() => set({ signature_url: null })} className="gap-1.5 text-destructive text-xs">
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <input ref={sigInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadSignature(f);
                            }} />
                            <Button variant="outline" size="sm" onClick={() => sigInputRef.current?.click()} className="gap-1.5 text-xs">
                              <Upload className="w-3.5 h-3.5" /> Upload Gambar TTD
                            </Button>
                            <p className="text-[10px] text-muted-foreground mt-1">Format: PNG, JPG. Latar transparan disarankan.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {settings.signature_type === "system" && (
                      <div className="space-y-4">
                        <div className="p-6 border border-border rounded-lg bg-muted/30 flex items-center justify-center">
                          <div style={{
                            border: "3px solid #7c3aed", borderRadius: "8px",
                            padding: `10px ${Math.max(12, 28 - settings.stamp_text.length)}px`,
                            display: "inline-block", textAlign: "center", transform: "rotate(-5deg)",
                          }}>
                            <p style={{ fontSize: "14px", fontWeight: "800", color: "#7c3aed", margin: 0, letterSpacing: "2px", lineHeight: "1.2", whiteSpace: "nowrap" }}>{settings.stamp_text}</p>
                            <p style={{ fontSize: "9px", fontWeight: "600", color: "#a78bfa", margin: "2px 0 0 0", letterSpacing: "3px", whiteSpace: "nowrap" }}>{settings.stamp_sub_text}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Teks Utama Stempel</Label>
                            <Input value={settings.stamp_text} onChange={(e) => set({ stamp_text: e.target.value.toUpperCase() })} placeholder="IVALORA GADGET" className="text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Teks Sub Stempel</Label>
                            <Input value={settings.stamp_sub_text} onChange={(e) => set({ stamp_sub_text: e.target.value.toUpperCase() })} placeholder="INDONESIA" className="text-xs" />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>}

              {/* Font & Logo Settings - improved 2-column layout */}
              {activeTab === "fonts" && <div>
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm sm:text-base">Font & Logo</CardTitle>
                    <CardDescription className="text-xs">Pilih tipe font, ukuran, dan logo untuk dokumen faktur</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Left column: Logo */}
                      <div className="space-y-4">
                        <Label className="text-xs sm:text-sm font-semibold">Tipe Logo</Label>
                        <div className="space-y-3">
                          {/* Icon option */}
                          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${settings.logo_type === "icon" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                            <input type="radio" checked={settings.logo_type === "icon"} onChange={() => set({ logo_type: "icon" })} className="accent-primary" />
                            <img src={logoIconSrc} alt="Icon Logo" className="h-8 object-contain" />
                            <span className="text-xs">Logo Ikon</span>
                          </label>
                          {/* Full option */}
                          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${settings.logo_type === "full" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                            <input type="radio" checked={settings.logo_type === "full"} onChange={() => set({ logo_type: "full" })} className="accent-primary" />
                            <img src={logoFullSrc} alt="Full Logo" className="h-8 object-contain" />
                            <span className="text-xs">Logo Full</span>
                          </label>
                          {/* Custom option */}
                          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${settings.logo_type === "custom" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                            <input type="radio" checked={settings.logo_type === "custom"} onChange={() => set({ logo_type: "custom" })} className="accent-primary" />
                            {settings.custom_logo_url ? (
                              <img src={settings.custom_logo_url} alt="Custom Logo" className="h-8 object-contain" />
                            ) : (
                              <div className="h-8 w-12 rounded bg-muted flex items-center justify-center">
                                <Upload className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-xs">Logo Kustom</span>
                          </label>
                        </div>
                        {settings.logo_type === "custom" && (
                          <div className="pl-2">
                            {settings.custom_logo_url ? (
                              <Button variant="outline" size="sm" onClick={() => set({ custom_logo_url: null })} className="gap-1.5 text-destructive text-xs">
                                <Trash2 className="w-3.5 h-3.5" /> Hapus Logo
                              </Button>
                            ) : (
                              <div>
                                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadLogo(f);
                                }} />
                                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="gap-1.5 text-xs">
                                  <Upload className="w-3.5 h-3.5" /> Upload Logo
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right column: Font type + sizes */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm font-semibold">Tipe Font</Label>
                          <Select value={settings.font_family} onValueChange={(v) => set({ font_family: v as FontFamily })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FONT_FAMILIES.map(f => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Separator />
                        <p className="text-xs font-semibold text-foreground">Ukuran Font</p>
                        <div className="space-y-2">
                          <FontSizeRow label="Judul 'Faktur Penjualan'" value={settings.font_title_size} onChange={(v) => set({ font_title_size: v })} min={24} max={60} />
                          <FontSizeRow label="Nomor Faktur (ID)" value={settings.font_invoice_id_size} onChange={(v) => set({ font_invoice_id_size: v })} min={12} max={36} />
                          <FontSizeRow label="Nama Perusahaan" value={settings.font_company_name_size} onChange={(v) => set({ font_company_name_size: v })} min={16} max={48} />
                          <FontSizeRow label="Info Cabang" value={settings.font_branch_info_size} onChange={(v) => set({ font_branch_info_size: v })} />
                          <FontSizeRow label="Kode Transaksi" value={settings.font_transaction_code_size} onChange={(v) => set({ font_transaction_code_size: v })} min={10} max={30} />
                          <FontSizeRow label="Alamat" value={settings.font_address_size} onChange={(v) => set({ font_address_size: v })} />
                          <FontSizeRow label="Dilayani Oleh" value={settings.font_served_by_size} onChange={(v) => set({ font_served_by_size: v })} />
                          <FontSizeRow label="S&K" value={settings.font_terms_size} onChange={(v) => set({ font_terms_size: v })} />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => set({ ...DEFAULT_FONT_SETTINGS })} className="text-xs">
                          Reset ke Default
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>}

              {/* WhatsApp Template */}
              {activeTab === "whatsapp" && <div>
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm sm:text-base">Template Pesan WhatsApp</CardTitle>
                    <CardDescription className="text-xs">Format pesan yang dikirim saat share faktur via WhatsApp</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 sm:p-6 pt-0 sm:pt-0">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-2">Klik variabel untuk menyalin:</p>
                      <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3">
                        {WA_VARIABLES.map((v) => (
                          <TooltipProvider key={v.key} delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] cursor-pointer hover:bg-accent transition-colors"
                                  onClick={() => {
                                    navigator.clipboard.writeText(v.key);
                                    toast({ title: `${v.key} disalin` });
                                  }}
                                >
                                  {v.key}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs max-w-[200px]">{v.desc}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-1 mb-2">
                      <Button variant={waEditorMode === "text" ? "default" : "outline"} size="sm" onClick={() => setWaEditorMode("text")} className="gap-1 h-7 text-[10px]">
                        <Code className="w-3 h-3" /> Editor
                      </Button>
                      <Button variant={waEditorMode === "preview" ? "default" : "outline"} size="sm" onClick={() => setWaEditorMode("preview")} className="gap-1 h-7 text-[10px]">
                        <Eye className="w-3 h-3" /> Preview
                      </Button>
                    </div>

                    {waEditorMode === "text" ? (
                      <Textarea
                        value={settings.wa_template}
                        onChange={(e) => set({ wa_template: e.target.value })}
                        rows={16}
                        className="font-mono text-xs"
                        placeholder="Tulis template pesan WhatsApp..."
                      />
                    ) : (
                      <div className="p-3 sm:p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 min-h-[250px]">
                        <p className="text-[10px] text-muted-foreground mb-2 font-semibold">Preview dengan data contoh:</p>
                        <pre className="whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed">{waPreview}</pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>}

              {/* Terms - Dual mode: HTML editor + Preview */}
              {activeTab === "terms" && <div>
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm sm:text-base">Syarat dan Ketentuan</CardTitle>
                    <CardDescription className="text-xs">Konten S&K yang tampil di halaman terpisah pada dokumen faktur</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="flex gap-1 mb-2">
                      <Button variant={termsEditorMode === "html" ? "default" : "outline"} size="sm" onClick={() => setTermsEditorMode("html")} className="gap-1 h-7 text-[10px]">
                        <Code className="w-3 h-3" /> Editor HTML
                      </Button>
                      <Button variant={termsEditorMode === "preview" ? "default" : "outline"} size="sm" onClick={() => setTermsEditorMode("preview")} className="gap-1 h-7 text-[10px]">
                        <Eye className="w-3 h-3" /> Preview
                      </Button>
                    </div>

                    {termsEditorMode === "html" ? (
                      <>
                        <Textarea
                          value={typeof settings.terms_json === "string" ? settings.terms_json : ""}
                          onChange={(e) => set({ terms_json: e.target.value })}
                          rows={24}
                          className="font-mono text-xs leading-relaxed"
                          placeholder="Tulis syarat dan ketentuan dalam format HTML..."
                        />
                        <p className="text-[10px] text-muted-foreground">Gunakan tag HTML: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt; untuk formatting. Konten ini akan di-snapshot ke setiap faktur yang diterbitkan.</p>
                      </>
                    ) : (
                      <div className="p-4 sm:p-6 rounded-lg border border-border bg-white dark:bg-card min-h-[400px] max-h-[600px] overflow-y-auto">
                        {(() => {
                          const raw = typeof settings.terms_json === "string" ? settings.terms_json : "";
                          const isHtml = /<[a-z][\s\S]*>/i.test(raw);
                          if (isHtml) {
                            return (
                              <div
                                dangerouslySetInnerHTML={{ __html: raw }}
                                className="invoice-terms-content prose prose-sm max-w-none"
                                style={{ fontSize: `${settings.font_terms_size}px`, color: "#374151", lineHeight: "1.7" }}
                              />
                            );
                          }
                          return (
                            <div className="invoice-terms-content prose prose-sm max-w-none">
                              <ReactMarkdown
                                components={{
                                  h1: ({ children }) => <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111827", margin: "20px 0 8px 0" }}>{children}</h2>,
                                  h2: ({ children }) => <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111827", margin: "20px 0 8px 0" }}>{children}</h2>,
                                  h3: ({ children }) => <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", margin: "16px 0 6px 0" }}>{children}</h3>,
                                  p: ({ children }) => <p style={{ fontSize: `${settings.font_terms_size}px`, color: "#374151", margin: "0 0 8px 0", lineHeight: "1.7" }}>{children}</p>,
                                  ul: ({ children }) => <ul style={{ margin: "0 0 12px 20px", padding: 0 }}>{children}</ul>,
                                  ol: ({ children }) => <ol style={{ margin: "0 0 12px 20px", padding: 0 }}>{children}</ol>,
                                  li: ({ children }) => <li style={{ fontSize: `${settings.font_terms_size}px`, color: "#374151", marginBottom: "4px", lineHeight: "1.7" }}>{children}</li>,
                                  strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#111827" }}>{children}</strong>,
                                  hr: () => <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />,
                                  blockquote: ({ children }) => <blockquote style={{ borderLeft: "3px solid #7c3aed", paddingLeft: "12px", margin: "8px 0", color: "#4b5563", fontStyle: "italic" }}>{children}</blockquote>,
                                }}
                              >
                                {raw}
                              </ReactMarkdown>
                            </div>
                          );
                        })()}
                        <style>{`
                          .invoice-terms-content h2 { font-size: 16px; font-weight: 700; color: #111827; margin: 20px 0 8px 0; }
                          .invoice-terms-content h3 { font-size: 14px; font-weight: 700; color: #111827; margin: 16px 0 6px 0; }
                          .invoice-terms-content p { margin: 0 0 8px 0; line-height: 1.7; }
                          .invoice-terms-content ul { margin: 0 0 12px 20px; padding: 0; }
                          .invoice-terms-content li { margin-bottom: 4px; line-height: 1.7; }
                          .invoice-terms-content strong { font-weight: 700; color: #111827; }
                        `}</style>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>}
            </div>
          </div>

          {/* Live Preview Panel - 2 Pages Side by Side */}
          {showPreview && (
            <div className="sticky top-20 h-fit">
              <Card className="overflow-hidden">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs">Preview Dokumen Faktur</CardTitle>
                  <CardDescription className="text-[10px]">Halaman 1 (Invoice) & Halaman 2 (S&K)</CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="flex gap-2 overflow-x-auto">
                    {/* Page 1 */}
                    <div className="border border-border rounded bg-white shadow-sm overflow-hidden flex-shrink-0" style={{ width: "240px", height: "340px" }}>
                      <div style={{ transform: "scale(0.302)", transformOrigin: "top left", width: "794px", minWidth: "794px" }}>
                        <InvoiceDocumentA4
                          invoice={sampleInvoice}
                          fontSettings={fontSettings}
                          signatureUrl={settings.signature_url}
                          signatureType={settings.signature_type}
                          companyNameOverride={settings.company_name}
                          footerTextOverride={settings.footer_text}
                          logoType={settings.logo_type}
                          customLogoUrl={settings.custom_logo_url}
                          fontFamily={settings.font_family}
                          stampText={settings.stamp_text}
                          stampSubText={settings.stamp_sub_text}
                          documentLinkOverride={`${settings.document_link_base}/faktur/view/sample-token-preview`}
                          headerTagline={settings.header_tagline}
                          headerTaglineAlign={settings.header_tagline_align}
                          renderPage={1}
                        />
                      </div>
                    </div>
                    {/* Page 2 - S&K */}
                    {totalPages > 1 && (
                      <div className="border border-border rounded bg-white shadow-sm overflow-hidden flex-shrink-0" style={{ width: "240px", height: "340px" }}>
                        <div style={{ transform: "scale(0.302)", transformOrigin: "top left", width: "794px", minWidth: "794px" }}>
                          <InvoiceDocumentA4
                            invoice={sampleInvoice}
                            fontSettings={fontSettings}
                            signatureUrl={settings.signature_url}
                            signatureType={settings.signature_type}
                            companyNameOverride={settings.company_name}
                            footerTextOverride={settings.footer_text}
                            logoType={settings.logo_type}
                            customLogoUrl={settings.custom_logo_url}
                            fontFamily={settings.font_family}
                            stampText={settings.stamp_text}
                            stampSubText={settings.stamp_sub_text}
                            documentLinkOverride={`${settings.document_link_base}/faktur/view/sample-token-preview`}
                            headerTagline={settings.header_tagline}
                            headerTaglineAlign={settings.header_tagline_align}
                            renderPage={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    <span className="text-[10px] text-muted-foreground">Halaman 1</span>
                    {totalPages > 1 && <span className="text-[10px] text-muted-foreground">Halaman 2</span>}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
