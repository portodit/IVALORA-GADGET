import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InvoiceDocumentA4 } from "@/components/admin/penjualan/InvoiceDocumentA4";
import { downloadInvoicePDF } from "@/lib/admin/penjualan/pdf-download";

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase
        .from("invoices" as never)
        .select("*, branches(name, code, full_address, phone, city, province, postal_code, google_maps_url), transactions(transaction_code)")
        .eq("public_token", token)
        .maybeSingle() as { data: any };

      if (data) {
        // Fetch settings for font/signature
        const { data: s } = await supabase
          .from("invoice_settings" as never)
          .select("*")
          .limit(1)
          .maybeSingle() as { data: any };
        setSettings(s);

        if (s?.additional_notes) {
          data.additional_notes = s.additional_notes;
        }
      }

      setInvoice(data);
      setLoading(false);
    })();
  }, [token]);

  const handleDownload = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      const fileName = settings?.pdf_name_format
        ? formatPdfName(settings.pdf_name_format, invoice)
        : `${invoice.invoice_number}.pdf`;
      await downloadInvoicePDF("invoice-print-area", fileName);
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="space-y-3 w-full max-w-2xl p-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold text-gray-700">Faktur tidak ditemukan</p>
          <p className="text-sm text-gray-500">Link faktur tidak valid atau sudah kedaluwarsa.</p>
        </div>
      </div>
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

      <div className="no-print sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-semibold text-gray-800 truncate">
            Faktur {invoice.invoice_number}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 h-8">
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={downloading} className="gap-1.5 h-8">
              <Download className="w-4 h-4" />
              {downloading ? "..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="no-print min-h-screen bg-gray-100 py-8 px-4 overflow-x-auto">
        <div className="shadow-2xl rounded-xl overflow-hidden border border-gray-200 mx-auto" style={{ width: "794px", minWidth: "794px" }}>
          <InvoiceDocumentA4
            invoice={invoice}
            fontSettings={settings ? {
              font_title_size: settings.font_title_size ?? 42,
              font_invoice_id_size: settings.font_invoice_id_size ?? 24,
              font_company_name_size: settings.font_company_name_size ?? 32,
              font_branch_info_size: settings.font_branch_info_size ?? 11,
              font_transaction_code_size: settings.font_transaction_code_size ?? 20,
              font_address_size: settings.font_address_size ?? 11,
              font_served_by_size: settings.font_served_by_size ?? 11,
              font_terms_size: settings.font_terms_size ?? 11,
            } : undefined}
            signatureUrl={settings?.signature_url}
            signatureType={settings?.signature_type ?? "system"}
            companyNameOverride={settings?.company_name}
            footerTextOverride={settings?.footer_text}
            logoType={settings?.logo_type ?? "icon"}
            customLogoUrl={settings?.logo_url}
            fontFamily={settings?.font_family ?? "Poppins"}
            publicBaseUrl={settings?.document_link_base || "https://ivaloragadget.com"}
            stampText={settings?.stamp_text}
            stampSubText={settings?.stamp_sub_text}
            headerTagline={settings?.header_tagline}
            headerTaglineAlign={settings?.header_tagline_align}
          />
        </div>
      </div>

      <div className="hidden print:block">
        <InvoiceDocumentA4
            invoice={invoice}
            fontSettings={settings ? {
              font_title_size: settings.font_title_size ?? 42,
              font_invoice_id_size: settings.font_invoice_id_size ?? 24,
              font_company_name_size: settings.font_company_name_size ?? 32,
              font_branch_info_size: settings.font_branch_info_size ?? 11,
              font_transaction_code_size: settings.font_transaction_code_size ?? 20,
              font_address_size: settings.font_address_size ?? 11,
              font_served_by_size: settings.font_served_by_size ?? 11,
              font_terms_size: settings.font_terms_size ?? 11,
            } : undefined}
            signatureUrl={settings?.signature_url}
            signatureType={settings?.signature_type ?? "system"}
            companyNameOverride={settings?.company_name}
            footerTextOverride={settings?.footer_text}
            logoType={settings?.logo_type ?? "icon"}
            customLogoUrl={settings?.logo_url}
            fontFamily={settings?.font_family ?? "Poppins"}
            publicBaseUrl={settings?.document_link_base || "https://ivaloragadget.com"}
            stampText={settings?.stamp_text}
            stampSubText={settings?.stamp_sub_text}
            headerTagline={settings?.header_tagline}
            headerTaglineAlign={settings?.header_tagline_align}
          />
      </div>
    </>
  );
}

function formatPdfName(format: string, invoice: any): string {
  const date = new Date(invoice.invoice_date);
  const dateStr = `${date.getDate().toString().padStart(2, "0")}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getFullYear()}`;
  const customer = (invoice.customer_name ?? "customer").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  return format
    .replace("{customer}", customer)
    .replace("{date}", dateStr)
    .replace("{invoice_number}", invoice.invoice_number)
    + ".pdf";
}
