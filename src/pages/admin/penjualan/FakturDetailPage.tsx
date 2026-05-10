import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Download, Printer, Ban, Mail, MessageCircle, Link2, Copy,
  Plus, X, AlertCircle, RefreshCcw,
} from "lucide-react";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/shared/use-toast";
import { useAuth } from "@/contexts/admin/AuthContext";
import { InvoiceDocumentA4 } from "@/components/admin/penjualan/InvoiceDocumentA4";
import { downloadInvoicePDF } from "@/lib/admin/penjualan/pdf-download";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface InvoiceData {
  id: string;
  invoice_number: string;
  transaction_id: string;
  branch_id: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  shipping_address: string | null;
  subtotal: number;
  discount_amount: number;
  discount_code: string | null;
  shipping_cost: number;
  shipping_discount: number;
  packing_kayu_cost: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_method_name: string | null;
  payment_reference: string | null;
  payment_status: string;
  items_snapshot: any[];
  invoice_date: string;
  due_date: string | null;
  paid_at: string | null;
  created_by: string | null;
  handled_by_name: string | null;
  channel: string | null;
  notes: string | null;
  terms_snapshot: any;
  additional_notes?: string[] | null;
  public_token?: string | null;
  branches?: { name: string; code: string; full_address: string | null; phone: string | null; email?: string | null; city: string | null; province: string | null; postal_code: string | null; google_maps_url: string | null } | null;
  transactions?: { transaction_code: string | null } | null;
}

export default function FakturDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();
  const [searchParams] = useSearchParams();

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [waInput, setWaInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [templateOutdated, setTemplateOutdated] = useState(false);
  const [templateUpdatedAt, setTemplateUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const isMobile = useIsMobile();

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("invoices" as never)
      .select("*, branches(name, code, full_address, phone, email, city, province, postal_code, google_maps_url), transactions(transaction_code)")
      .eq("id", id)
      .single() as { data: InvoiceData | null };

    // Fetch global invoice settings
    const { data: settingsData } = await supabase
      .from("invoice_settings" as never)
      .select("*")
      .limit(1)
      .maybeSingle() as { data: any | null };

    if (settingsData) {
      setInvoiceSettings(settingsData);
      setTemplateUpdatedAt(settingsData.template_updated_at);
      if (data) {
        // Try to parse snapshot from notes if it looks like JSON
        let snapshotUpdatedAt: string | null = null;
        if (data.notes && data.notes.startsWith("{") && data.notes.includes("terms_snapshot")) {
          try {
            const snapshot = JSON.parse(data.notes);
            data.additional_notes = snapshot.additional_notes;
            data.terms_snapshot = snapshot.terms_snapshot;
            snapshotUpdatedAt = snapshot.updated_at ?? null;
          } catch (e) {
            console.error("Failed to parse invoice snapshot from notes", e);
          }
        }

        if (settingsData.additional_notes && !data.additional_notes) {
          (data as any).additional_notes = settingsData.additional_notes;
        }
        if (!data.terms_snapshot && settingsData.terms_json) {
          (data as any).terms_snapshot = settingsData.terms_json;
        }

        // Use snapshot.updated_at (set by "Update Sekarang") if available, else fall back to invoice_date
        if (settingsData.template_updated_at) {
          const comparisonTime = snapshotUpdatedAt
            ? new Date(snapshotUpdatedAt).getTime()
            : new Date(data.invoice_date).getTime();
          setTemplateOutdated(comparisonTime < new Date(settingsData.template_updated_at).getTime());
        }
      }
    }

    // Generate public_token if not present
    if (data && !(data as any).public_token) {
      const token = crypto.randomUUID();
      await supabase.from("invoices" as never).update({ public_token: token } as never).eq("id", id);
      (data as any).public_token = token;
    }

    setInvoice(data);
    setLoading(false);

    if (data && searchParams.get("print") === "1") {
      setTimeout(() => window.print(), 500);
    }
  }, [id, searchParams]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  const handleRefreshInvoice = async () => {
    if (!id || !invoiceSettings) return;
    setRefreshing(true);
    try {
      // Create a snapshot object to store in the notes column as JSON
      const snapshot = {
        additional_notes: invoiceSettings.additional_notes,
        terms_snapshot: invoiceSettings.terms_json,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("invoices" as never)
        .update({
          notes: JSON.stringify(snapshot),
        } as never)
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Faktur berhasil diperbarui dengan pengaturan terbaru" });
      fetchInvoice();
    } catch (err) {
      console.error(err);
      toast({ title: "Gagal memperbarui faktur", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleVoid = async () => {
    if (!id) return;
    const { error } = await supabase
      .from("invoices" as never)
      .update({ status: "void" } as never)
      .eq("id", id);
    if (error) {
      toast({ title: "Gagal void faktur", variant: "destructive" });
    } else {
      toast({ title: "Faktur berhasil di-void" });
      fetchInvoice();
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      await downloadInvoicePDF("invoice-print-area", `${invoice.invoice_number}.pdf`);
      toast({ title: "PDF berhasil diunduh" });
    } catch (err) {
      console.error(err);
      toast({ title: "Gagal mengunduh PDF", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice) return;
    const email = invoice.customer_email || emailInput;
    if (!email) { toast({ title: "Email pelanggan belum diisi", variant: "destructive" }); return; }
    if (!email.includes("@")) { toast({ title: "Format email tidak valid", variant: "destructive" }); return; }
    setSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-email`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ invoiceId: invoice.id, recipientEmail: email }) }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({ title: "Email faktur berhasil dikirim" });
      setEmailDialogOpen(false);
      setEmailInput("");
    } catch (err: any) {
      toast({ title: err.message || "Gagal mengirim email", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const openEmailDialog = () => {
    if (!invoice?.customer_email) setEmailDialogOpen(true);
    else handleSendEmail();
  };

  const handleShareWA = () => {
    if (!invoice) return;
    const phone = invoice.customer_phone || waInput;
    if (!phone) { toast({ title: "Nomor telepon belum diisi", variant: "destructive" }); return; }
    let formatted = phone.replace(/\D/g, "");
    if (formatted.startsWith("0")) formatted = "62" + formatted.slice(1);
    if (!formatted.startsWith("62")) formatted = "62" + formatted;

    const hour = new Date().getHours();
    const greeting = hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 18 ? "sore" : "malam";

    const items = (invoice.items_snapshot ?? []).map((it: any, i: number) =>
      `${i + 1}. ${it.product_label} — Rp ${Number(it.selling_price).toLocaleString("id-ID")}`
    ).join("\n");

    const discountInfo = invoice.discount_amount > 0
      ? `Diskon: Rp ${Number(invoice.discount_amount).toLocaleString("id-ID")}${invoice.discount_code ? ` (${invoice.discount_code})` : ""}`
      : "";

    const publicToken = (invoice as any).public_token;
    const baseUrl = invoiceSettings?.document_link_base || "https://ivaloragadget.com";
    const invoiceLink = publicToken
      ? `${baseUrl}/faktur/view/${publicToken}`
      : `${window.location.origin}/faktur/view/${invoice.id}`;

    const template = invoiceSettings?.wa_template || `Selamat {greeting} kak {customer_name},\n\nTerima kasih telah berbelanja di Ivalora Gadget! 🙏\n\nBerikut rincian pesanan Anda:\n{items_list}\n\nTotal pembelian: {total}\n{discount_info}\n\nAdapun dokumen faktur pesanan Anda dapat diakses melalui link berikut:\n{invoice_link}\n\nTerima kasih atas kepercayaan Anda. 🙏\n— Ivalora Gadget Indonesia`;

    const msg = template
      .replace("{greeting}", greeting)
      .replace("{customer_name}", invoice.customer_name ?? "—")
      .replace("{items_list}", items)
      .replace("{total}", `Rp ${Number(invoice.total).toLocaleString("id-ID")}`)
      .replace("{discount_info}", discountInfo)
      .replace("{invoice_link}", invoiceLink)
      .replace("{invoice_number}", invoice.invoice_number)
      .replace("{invoice_date}", new Date(invoice.invoice_date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }))
      .replace("{payment_method}", invoice.payment_method_name ?? "—")
      .replace("{branch_name}", invoice.branches?.name ?? "—")
      .replace("{handled_by}", invoice.handled_by_name ?? "—")
      .replace("{customer_phone}", invoice.customer_phone ?? "—")
      .replace("{subtotal}", `Rp ${Number(invoice.subtotal).toLocaleString("id-ID")}`)
      .replace("{shipping_cost}", `Rp ${Number(invoice.shipping_cost).toLocaleString("id-ID")}`)
      .replace("{balance_due}", `Rp ${Number(invoice.balance_due).toLocaleString("id-ID")}`);

    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, "_blank");
    setWaDialogOpen(false);
    setWaInput("");
  };

  const openWaDialog = () => {
    if (!invoice?.customer_phone) {
      setWaDialogOpen(true);
    } else {
      setWaInput(invoice.customer_phone);
      setTimeout(() => handleShareWA(), 0);
    }
  };

  const publicBaseUrl = (invoiceSettings?.document_link_base && !invoiceSettings.document_link_base.includes("localhost")) ? invoiceSettings.document_link_base : window.location.origin;
  const publicLink = invoice?.public_token
    ? `${publicBaseUrl}/faktur/view/${invoice.public_token}`
    : null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-3 p-8">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Faktur tidak ditemukan.</p>
            <Button variant="outline" onClick={() => navigate("/admin/penjualan/faktur")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; margin: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      <DashboardLayout>
        <div className="no-print space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin/penjualan/faktur")} className="h-8 w-8 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-bold text-foreground truncate">{invoice.invoice_number}</span>
              <Badge variant={invoice.status === "void" ? "destructive" : invoice.status === "draft" ? "secondary" : "default"}>
                {invoice.status === "void" ? "Void" : invoice.status === "draft" ? "Draft" : "Terbit"}
              </Badge>
            </div>
            {/* Desktop action buttons */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              {invoice.status !== "void" && (role === "super_admin" || role === "admin_branch") && (
                <Button variant="outline" size="sm" onClick={handleVoid} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
                  <Ban className="w-4 h-4" />Void
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={openWaDialog} className="gap-1.5 text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950">
                <MessageCircle className="w-4 h-4" />WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={openEmailDialog} className="gap-1.5">
                <Mail className="w-4 h-4" />Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                <Printer className="w-4 h-4" />Print
              </Button>
              <Button size="sm" onClick={handleDownloadPDF} disabled={downloading} className="gap-1.5">
                <Download className="w-4 h-4" />{downloading ? "..." : "PDF"}
              </Button>
            </div>
          </div>

          {/* Public link info */}
          {publicLink && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 text-xs">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Link publik:</span>
              <a href={publicLink} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{publicLink}</a>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                navigator.clipboard.writeText(publicLink);
                toast({ title: "Link disalin!" });
              }}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Template outdated banner */}
          {templateOutdated && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 text-xs shadow-sm">
              <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-full shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                  Isi faktur ini mungkin belum diperbarui
                </p>
                <p className="text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                  Terdapat pembaruan pada pengaturan template faktur (S&K / Catatan) pada {templateUpdatedAt ? new Date(templateUpdatedAt).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "waktu dekat"}. Faktur ini terakhir disimpan pada {new Date(invoice.invoice_date).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.
                </p>
              </div>
              <Button 
                size="sm" 
                onClick={handleRefreshInvoice} 
                disabled={refreshing}
                className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-md shrink-0 gap-2 h-9 px-4"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Memperbarui..." : "Update Sekarang"}
              </Button>
            </div>
          )}

          <div className="overflow-x-auto pb-4">
            <div className="shadow-2xl rounded-xl overflow-hidden border border-border mx-auto" style={{ width: "794px", minWidth: "794px" }}>
              <InvoiceDocumentA4
                invoice={invoice}
                fontSettings={invoiceSettings ? {
                  font_title_size: invoiceSettings.font_title_size ?? 42,
                  font_invoice_id_size: invoiceSettings.font_invoice_id_size ?? 24,
                  font_company_name_size: invoiceSettings.font_company_name_size ?? 32,
                  font_branch_info_size: invoiceSettings.font_branch_info_size ?? 11,
                  font_transaction_code_size: invoiceSettings.font_transaction_code_size ?? 20,
                  font_address_size: invoiceSettings.font_address_size ?? 11,
                  font_served_by_size: invoiceSettings.font_served_by_size ?? 11,
                  font_terms_size: invoiceSettings.font_terms_size ?? 11,
                } : undefined}
                signatureUrl={invoiceSettings?.signature_url}
                signatureType={invoiceSettings?.signature_type ?? "system"}
                companyNameOverride={invoiceSettings?.company_name}
                footerTextOverride={invoiceSettings?.footer_text}
                logoType={invoiceSettings?.logo_type ?? "icon"}
                customLogoUrl={invoiceSettings?.logo_url}
                fontFamily={invoiceSettings?.font_family ?? "Poppins"}
                publicBaseUrl={invoiceSettings?.document_link_base || window.location.origin}
                stampText={invoiceSettings?.stamp_text}
                stampSubText={invoiceSettings?.stamp_sub_text}
                headerTagline={invoiceSettings?.header_tagline}
                headerTaglineAlign={invoiceSettings?.header_tagline_align}
              />
            </div>
          </div>
        </div>
      </DashboardLayout>

      <div className="hidden print:block">
        <InvoiceDocumentA4
          invoice={invoice}
          fontSettings={invoiceSettings ? {
            font_title_size: invoiceSettings.font_title_size ?? 42,
            font_invoice_id_size: invoiceSettings.font_invoice_id_size ?? 24,
            font_company_name_size: invoiceSettings.font_company_name_size ?? 32,
            font_branch_info_size: invoiceSettings.font_branch_info_size ?? 11,
            font_transaction_code_size: invoiceSettings.font_transaction_code_size ?? 20,
            font_address_size: invoiceSettings.font_address_size ?? 11,
            font_served_by_size: invoiceSettings.font_served_by_size ?? 11,
            font_terms_size: invoiceSettings.font_terms_size ?? 11,
          } : undefined}
          signatureUrl={invoiceSettings?.signature_url}
          signatureType={invoiceSettings?.signature_type ?? "system"}
          companyNameOverride={invoiceSettings?.company_name}
          footerTextOverride={invoiceSettings?.footer_text}
          logoType={invoiceSettings?.logo_type ?? "icon"}
          customLogoUrl={invoiceSettings?.logo_url}
          fontFamily={invoiceSettings?.font_family ?? "Poppins"}
          publicBaseUrl={invoiceSettings?.document_link_base || window.location.origin}
          stampText={invoiceSettings?.stamp_text}
          stampSubText={invoiceSettings?.stamp_sub_text}
          headerTagline={invoiceSettings?.header_tagline}
          headerTaglineAlign={invoiceSettings?.header_tagline_align}
        />
      </div>

      {/* Mobile Floating Action Button */}
      {isMobile && invoice && (
        <div className="fixed bottom-6 right-6 z-50 sm:hidden no-print">
          {fabOpen && (
            <div className="absolute bottom-16 right-0 flex flex-col gap-2 items-end animate-in fade-in slide-in-from-bottom-2 duration-200">
              <Button size="sm" onClick={() => { handleDownloadPDF(); setFabOpen(false); }} disabled={downloading} className="gap-2 rounded-full shadow-lg px-4">
                <Download className="w-4 h-4" />{downloading ? "..." : "PDF"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { window.print(); setFabOpen(false); }} className="gap-2 rounded-full shadow-lg px-4 bg-card">
                <Printer className="w-4 h-4" />Print
              </Button>
              <Button size="sm" variant="outline" onClick={() => { openEmailDialog(); setFabOpen(false); }} className="gap-2 rounded-full shadow-lg px-4 bg-card">
                <Mail className="w-4 h-4" />Email
              </Button>
              <Button size="sm" variant="outline" onClick={() => { openWaDialog(); setFabOpen(false); }} className="gap-2 rounded-full shadow-lg px-4 bg-card text-green-600 border-green-300">
                <MessageCircle className="w-4 h-4" />WhatsApp
              </Button>
              {invoice.status !== "void" && (role === "super_admin" || role === "admin_branch") && (
                <Button size="sm" variant="outline" onClick={() => { handleVoid(); setFabOpen(false); }} className="gap-2 rounded-full shadow-lg px-4 bg-card text-destructive border-destructive/30">
                  <Ban className="w-4 h-4" />Void
                </Button>
              )}
            </div>
          )}
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-xl"
            onClick={() => setFabOpen(f => !f)}
          >
            {fabOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
          </Button>
        </div>
      )}

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Kirim Faktur via Email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pelanggan <strong className="text-foreground">{invoice?.customer_name ?? "—"}</strong> belum memiliki email yang tercatat.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Alamat Email</Label>
              <Input type="email" placeholder="customer@gmail.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(false)}>Batal</Button>
            <Button size="sm" onClick={handleSendEmail} disabled={sendingEmail || !emailInput.trim()} className="gap-1.5">
              <Mail className="w-4 h-4" />{sendingEmail ? "Mengirim..." : "Kirim Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Dialog */}
      <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Bagikan Faktur via WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pelanggan <strong className="text-foreground">{invoice?.customer_name ?? "—"}</strong> belum memiliki nomor telepon yang tercatat.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Nomor WhatsApp</Label>
              <Input type="tel" placeholder="08123456789" value={waInput} onChange={(e) => setWaInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setWaDialogOpen(false)}>Batal</Button>
            <Button size="sm" onClick={handleShareWA} disabled={!waInput.trim()} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
              <MessageCircle className="w-4 h-4" />Kirim via WA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
