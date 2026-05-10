import React from "react";
import { QRCodeSVG } from "qrcode.react";
import ReactMarkdown from "react-markdown";
import logoFullSrc from "@/assets/logo-horizontal.png";
import logoIconSrc from "@/assets/logo-icon.svg";
import { formatCurrency } from "@/lib/admin/produk/stock-units";

interface InvoiceItem {
  product_label: string;
  imei: string;
  qty?: number;
  selling_price: number;
}

export interface InvoiceFontSettings {
  font_title_size: number;
  font_invoice_id_size: number;
  font_company_name_size: number;
  font_branch_info_size: number;
  font_transaction_code_size: number;
  font_address_size: number;
  font_served_by_size: number;
  font_terms_size: number;
}

export const DEFAULT_FONT_SETTINGS: InvoiceFontSettings = {
  font_title_size: 42,
  font_invoice_id_size: 24,
  font_company_name_size: 32,
  font_branch_info_size: 11,
  font_transaction_code_size: 20,
  font_address_size: 11,
  font_served_by_size: 11,
  font_terms_size: 11,
};

export type LogoType = "icon" | "full" | "custom";
export type FontFamily = "Poppins" | "Montserrat" | "Inter" | "Roboto" | "Open Sans" | "Lato";

export const FONT_FAMILIES: { value: FontFamily; label: string }[] = [
  { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
];

interface InvoiceProps {
  invoice: {
    invoice_number: string;
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
    items_snapshot: InvoiceItem[];
    invoice_date: string;
    due_date: string | null;
    paid_at: string | null;
    handled_by_name: string | null;
    channel: string | null;
    notes: string | null;
    terms_snapshot: any;
    additional_notes?: string[] | null;
    branches?: { name: string; code: string; full_address: string | null; phone: string | null; email?: string | null; city?: string | null; province?: string | null; postal_code?: string | null; google_maps_url?: string | null } | null;
    transactions?: { transaction_code: string | null } | null;
    public_token?: string | null;
  };
  fontSettings?: Partial<InvoiceFontSettings>;
  signatureUrl?: string | null;
  signatureType?: "system" | "custom";
  companyNameOverride?: string;
  footerTextOverride?: string;
  logoType?: LogoType;
  customLogoUrl?: string | null;
  fontFamily?: FontFamily;
  publicBaseUrl?: string;
  stampText?: string;
  stampSubText?: string;
  documentLinkOverride?: string | null;
  headerTagline?: string;
  headerTaglineAlign?: "left" | "center" | "right";
  /** Render only a specific page: 1 = main invoice, 2 = terms. undefined = all (for print/PDF) */
  renderPage?: 1 | 2;
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTimeLong(iso: string) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const timePart = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  return `${datePart}, ${timePart} WIB`;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPrintTime() {
  return new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

function channelLabel(ch: string | null) {
  if (!ch) return "—";
  const map: Record<string, string> = { pos: "Offline Store via POS", website: "Website / Online", marketplace: "Marketplace" };
  return map[ch] ?? ch;
}

function renderTerms(terms: any, fontSize: number = 11, invoiceDate?: string) {
  if (!terms) return null;
  let finalTerms = terms;

  // Handle dynamic placeholders
  if (typeof finalTerms === "string" && invoiceDate) {
    const purchaseDate = new Date(invoiceDate);
    const warrantyEndDate = new Date(invoiceDate);
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + 1);

    const purchaseDateStr = purchaseDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const warrantyEndDateStr = warrantyEndDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    finalTerms = finalTerms
      .replace(/\[Tanggal Pembelian\]/g, purchaseDateStr)
      .replace(/\[Tanggal Berakhir Garansi\]/g, warrantyEndDateStr);
  }

  if (typeof finalTerms === "string" && finalTerms.trim().length > 0) {
    const isHtml = /<[a-z][\s\S]*>/i.test(finalTerms);
    if (isHtml) {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: finalTerms }}
          style={{ fontSize: `${fontSize}px`, color: "#374151", lineHeight: "1.7" }}
          className="invoice-terms-content"
        />
      );
    }
    return (
      <div className="invoice-terms-content">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h2 style={{ fontSize: `${fontSize + 1}px`, fontWeight: 700, color: "#111827", margin: "3px 0 1px 0", lineHeight: "1.2" }}>{children}</h2>,
            h2: ({ children }) => <h2 style={{ fontSize: `${fontSize + 1}px`, fontWeight: 700, color: "#111827", margin: "3px 0 1px 0", lineHeight: "1.2" }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ fontSize: `${fontSize}px`, fontWeight: 700, color: "#111827", margin: "2px 0 1px 0", lineHeight: "1.2" }}>{children}</h3>,
            p: ({ children }) => <p style={{ fontSize: `${fontSize}px`, color: "#374151", margin: "0 0 5px 0", lineHeight: "1.5" }}>{children}</p>,
            ul: ({ children }) => <ul style={{ margin: "2px 0 4px 18px", padding: 0 }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ margin: "2px 0 4px 18px", padding: 0 }}>{children}</ol>,
            li: ({ children, ...props }) => <li style={{ fontSize: `${fontSize}px`, color: "#374151", lineHeight: "1.5", marginBottom: "2px", paddingLeft: "4px" }} {...(props as any)}>{children}</li>,
            strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#111827" }}>{children}</strong>,
            hr: () => <hr style={{ margin: "3px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />,
            blockquote: ({ children }) => <blockquote style={{ borderLeft: "2px solid #7c3aed", paddingLeft: "8px", margin: "2px 0", color: "#4b5563", fontStyle: "italic" }}>{children}</blockquote>,
          }}
        >
          {finalTerms}
        </ReactMarkdown>
      </div>
    );
  }
  if (Array.isArray(finalTerms) && finalTerms.length > 0) {
    return (
      <div className="invoice-terms-content">
        {finalTerms.map((block: any, idx: number) => {
          if (block.type === "heading") return <p key={idx} style={{ fontSize: `${fontSize + 1}px`, fontWeight: "700", color: "#111827", margin: "3px 0 1px 0", lineHeight: "1.2" }}>{block.text}</p>;
          if (block.type === "paragraph") return <p key={idx} style={{ fontSize: `${fontSize}px`, color: "#374151", margin: "0 0 1px 0", lineHeight: "1.4" }}>{block.text}</p>;
          if (block.type === "list") {
            return (
              <ul key={idx} style={{ margin: "1px 0 2px 14px", padding: 0 }}>
                {(block.items ?? []).map((item: string, li: number) => (
                  <li key={li} style={{ fontSize: `${fontSize}px`, color: "#374151", lineHeight: "1.4", listStyleType: "disc", marginBottom: "1px" }}>{item}</li>
                ))}
              </ul>
            );
          }
          return null;
        })}
      </div>
    );
  }
  return null;
}

function termsToBlocks(terms: any): string[] {
  if (!terms) return [];

  if (typeof terms === "string") {
    return terms
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  if (Array.isArray(terms)) {
    return terms
      .flatMap((block: any) => {
        if (!block) return [];
        if (typeof block === "string") return [block.trim()];
        if (block.type === "heading") return [`## ${block.text ?? ""}`.trim()];
        if (block.type === "paragraph") return [(block.text ?? "").trim()];
        if (block.type === "list") {
          const items = (block.items ?? [])
            .map((item: string) => `- ${item}`)
            .join("\n");
          return items ? [items] : [];
        }
        return [];
      })
      .filter(Boolean);
  }

  return [];
}

function estimateBlockPx(block: string, fontSize: number): number {
  const trimmed = block.trim();
  const contentWidth = A4_PAGE_WIDTH_PX - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT;
  const charsPerLine = Math.max(15, Math.floor(contentWidth / (fontSize * 0.62)));

  if (/^#{1,6}\s/.test(trimmed)) {
    const headSize = fontSize + 1;
    const text = trimmed.replace(/^#+\s+/, "");
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    return Math.round(lines * headSize * 1.2) + 4; // 3px top + 1px bottom margin
  }

  if (trimmed.startsWith("- ")) {
    const items = trimmed.split("\n").filter((l) => l.trimStart().startsWith("- "));
    let h = 7; // ul: 2px margin-top + 4px margin-bottom
    for (const item of items) {
      const text = item.replace(/^-\s+/, "");
      const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
      h += Math.round(lines * fontSize * 1.5) + 2;
    }
    return h;
  }

  const lines = Math.max(1, Math.ceil(trimmed.length / charsPerLine));
  return Math.round(lines * fontSize * 1.5) + 5;
}

function paginateTermsByPx(blocks: string[], pageHeightPx: number, fontSize: number): string[] {
  if (!blocks.length) return [];

  const pages: string[] = [];
  let current: string[] = [];
  let currentPx = 0;
  const isHeading = (b: string) => /^(#{1,6}\s+|bab\s+\d+)/i.test(b.trim());

  for (const block of blocks) {
    const blockPx = estimateBlockPx(block, fontSize);
    const gapPx = current.length > 0 ? 4 : 0;
    const orphanHeading = current.length === 1 && isHeading(current[0]);

    if (currentPx + gapPx + blockPx > pageHeightPx && current.length > 0 && !orphanHeading) {
      pages.push(current.join("\n\n"));
      current = [block];
      currentPx = blockPx;
      continue;
    }

    current.push(block);
    currentPx += gapPx + blockPx;
  }

  if (current.length > 0) pages.push(current.join("\n\n"));
  return pages;
}

function SystemStamp({ text, subText }: { text?: string; subText?: string }) {
  const mainText = text || "IVALORA GADGET";
  const sub = subText ?? "";
  return (
    <div style={{
      border: "3px solid #7c3aed",
      borderRadius: "8px",
      padding: "8px 20px",
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      transform: "rotate(-5deg)",
      gap: "3px",
    }}>
      <img
        src={logoIconSrc}
        alt=""
        style={{ height: "20px", objectFit: "contain", filter: "brightness(0) saturate(100%) invert(28%) sepia(80%) saturate(1500%) hue-rotate(245deg) brightness(0.85)" }}
      />
      <p style={{ fontSize: "14px", fontWeight: "800", color: "#7c3aed", margin: 0, letterSpacing: "2px", lineHeight: "1.2", whiteSpace: "nowrap" }}>{mainText}</p>
      {sub && <p style={{ fontSize: "9px", fontWeight: "600", color: "#a78bfa", margin: 0, letterSpacing: "3px", whiteSpace: "nowrap" }}>{sub}</p>}
    </div>
  );
}

const A4_PAGE_WIDTH_PX = 794;
const A4_PAGE_HEIGHT_PX = 1122;
const PAGE_MARGIN_TOP = 86;     // ~2.4cm — header starts lower
const PAGE_MARGIN_BOTTOM = 126; // ~3.5cm — footer sits lower
const PAGE_MARGIN_LEFT = 76;    // 2cm
const PAGE_MARGIN_RIGHT = 76;   // 2cm
const PAGE_HEADER_HEIGHT_PX = 76;
const PAGE_FOOTER_HEIGHT_PX = 34;

function InvoicePageHeader({
  logoSrc,
  companyName,
  branchName,
  fs,
  taglineText,
  taglineAlign,
  invoiceNumber,
  pageLabel,
  transactionCode,
  handledByName,
}: {
  logoSrc: string;
  companyName: string;
  branchName: string;
  fs: InvoiceFontSettings;
  taglineText: string;
  taglineAlign: "left" | "center" | "right";
  invoiceNumber: string;
  pageLabel?: string;
  transactionCode?: string | null;
  handledByName?: string | null;
}) {
  const titleSize = Math.min(fs.font_title_size, 30);
  const invoiceIdSize = fs.font_invoice_id_size;
  const trxSize = Math.min(fs.font_transaction_code_size, 12);

  return (
    <div style={{ height: `${PAGE_HEADER_HEIGHT_PX}px`, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <img src={logoSrc} alt="Logo" style={{ height: "24px", objectFit: "contain" }} />
          </div>
          <p style={{ fontSize: "13px", fontWeight: "700", color: "#111827", margin: "0 0 1px 0", lineHeight: "1.1" }}>{companyName}</p>
          <p style={{ fontSize: "10px", color: "#4b5563", lineHeight: "1.4", margin: 0 }}>
            Cabang <span style={{ fontWeight: "700", color: "#111827", fontSize: "12px" }}>{branchName}</span>
          </p>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <h1 style={{ fontSize: `${titleSize}px`, fontWeight: "800", letterSpacing: "-0.5px", margin: 0, color: "#111827", textTransform: "uppercase", lineHeight: "1.05" }}>Faktur Penjualan</h1>
          <p style={{ fontSize: `${invoiceIdSize}px`, fontWeight: "700", color: "#111827", margin: "2px 0 0 0", fontFamily: "monospace" }}>#{invoiceNumber}</p>
          {transactionCode && (
            <p style={{ fontSize: "9px", color: "#6b7280", margin: "1px 0 0 0" }}>
              Kode Transaksi: <span style={{ fontWeight: "600", color: "#111827", fontFamily: "monospace", fontSize: `${trxSize}px` }}>{transactionCode}</span>
            </p>
          )}
          {handledByName && (
            <p style={{ fontSize: "9px", color: "#6b7280", margin: "1px 0 0 0" }}>
              Petugas: <span style={{ fontWeight: "600", color: "#111827" }}>{handledByName}</span>
            </p>
          )}
          {pageLabel && <p style={{ fontSize: "8px", color: "#9ca3af", margin: "1px 0 0 0", fontWeight: "600" }}>{pageLabel}</p>}
        </div>
      </div>

      {taglineText ? (
        <div style={{ textAlign: taglineAlign, paddingBottom: "3px", borderBottom: "2px solid #111827" }}>
          <p style={{ fontSize: "8px", fontWeight: "700", color: "#111827", margin: 0, letterSpacing: "1px", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{taglineText}</p>
        </div>
      ) : (
        <div style={{ height: "2px", background: "#111827", borderRadius: "1px" }} />
      )}
    </div>
  );
}

function InvoiceFooter({ footerText, branchName, branchCode, publicLink, pageNum, totalPages }: { footerText: string; branchName: string; branchCode: string; publicLink: string | null; pageNum?: number; totalPages?: number }) {
  return (
    <div style={{
      height: `${PAGE_FOOTER_HEIGHT_PX}px`,
      flexShrink: 0,
      borderTop: "1px solid #d1d5db",
      paddingTop: "6px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      boxSizing: "border-box",
      overflow: "hidden",
    }}>
      <div style={{ minWidth: 0, maxWidth: "70%" }}>
        <p style={{ fontSize: "9px", color: "#111827", margin: "0 0 2px 0", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{footerText}</p>
        <p style={{ fontSize: "9px", color: "#4b5563", margin: 0, fontWeight: "500" }}>Cabang {branchName} ({branchCode})</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {pageNum && totalPages && <p style={{ fontSize: "9px", color: "#111827", margin: "0 0 2px 0", fontWeight: "600" }}>Halaman {pageNum} / {totalPages}</p>}
        <p style={{ fontSize: "9px", color: "#4b5563", margin: 0, fontWeight: "500" }}>{formatPrintTime()}</p>
        {publicLink && <p style={{ fontSize: "7px", color: "#9ca3af", margin: "1px 0 0 0", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{publicLink}</p>}
      </div>
    </div>
  );
}

function getFontUrl(family: FontFamily) {
  const slug = family.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${slug}:wght@300;400;500;600;700;800&display=swap`;
}

const termsStyles = `
  .invoice-terms-content { text-align: justify; }
  .invoice-terms-content h2 { font-size: 14px; font-weight: 800; color: #111827; margin: 5px 0 2px 0; line-height: 1.2; text-transform: uppercase; }
  .invoice-terms-content h3 { font-size: 13px; font-weight: 700; color: #111827; margin: 4px 0 1px 0; line-height: 1.2; }
  .invoice-terms-content p { color: #1f2937; margin: 0 0 5px 0; line-height: 1.5; }
  .invoice-terms-content ul, .invoice-terms-content ol { margin: 2px 0 4px 18px; padding: 0; }
  .invoice-terms-content ul li { color: #1f2937; line-height: 1.5; margin-bottom: 2px; list-style-type: disc; list-style-position: outside; }
  .invoice-terms-content ol li { color: #1f2937; line-height: 1.5; margin-bottom: 2px; list-style-type: decimal; list-style-position: outside; }
  .invoice-terms-content li > p { margin-bottom: 1px; }
  .invoice-terms-content strong { font-weight: 700; color: #111827; }
  .invoice-terms-content > * { break-inside: avoid; }
`;

function parseNoteLinks(text: string): React.ReactNode[] {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>{match[1]}</a>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

export function InvoiceDocumentA4({ invoice, fontSettings, signatureUrl, signatureType = "system", companyNameOverride, footerTextOverride, logoType = "icon", customLogoUrl, fontFamily = "Poppins", publicBaseUrl, stampText, stampSubText, documentLinkOverride, headerTagline, headerTaglineAlign = "center", renderPage }: InvoiceProps) {
  const fs = { ...DEFAULT_FONT_SETTINGS, ...fontSettings };
  const items = invoice.items_snapshot ?? [];
  const br = invoice.branches;

  const companyName = companyNameOverride ?? "IVALORA GADGET";
  const footerText = footerTextOverride ?? "Dokumen ini dibuat secara otomatis oleh Ivalora Gadget RMS";

  const addressLine1 = br?.full_address ?? "";
  const cityProvince = [br?.city, br?.province].filter(Boolean).join(", ");
  const postalCode = br?.postal_code ?? "";
  const shippingParts = invoice.shipping_address?.split(",").map(s => s.trim()) ?? [];
  const additionalNotes = invoice.additional_notes && invoice.additional_notes.length > 0 ? invoice.additional_notes : null;

  const hasTerms = invoice.terms_snapshot && (
    (typeof invoice.terms_snapshot === "string" && invoice.terms_snapshot.trim().length > 0) ||
    (Array.isArray(invoice.terms_snapshot) && invoice.terms_snapshot.length > 0)
  );

  const termsBlocks = hasTerms ? termsToBlocks(invoice.terms_snapshot) : [];
  // pixel budget: inner page height minus mini-header (~30px) and footer, with safety buffer
  const TERMS_CONTENT_PX = A4_PAGE_HEIGHT_PX - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM - PAGE_FOOTER_HEIGHT_PX - 54;
  const paginatedTerms = hasTerms ? paginateTermsByPx(termsBlocks, TERMS_CONTENT_PX, fs.font_terms_size) : [];
  const termsPages = hasTerms
    ? (paginatedTerms.length > 0 ? paginatedTerms : [typeof invoice.terms_snapshot === "string" ? invoice.terms_snapshot : JSON.stringify(invoice.terms_snapshot)])
    : [];

  const font = `'${fontFamily}', 'Segoe UI', system-ui, sans-serif`;
  const logoSrc = logoType === "custom" && customLogoUrl ? customLogoUrl : logoType === "full" ? logoFullSrc : logoIconSrc;
  const logoHeight = logoType === "icon" ? "32px" : "38px";

  const resolvedBase = publicBaseUrl || (typeof window !== "undefined" ? window.location.origin : "https://ivaloragadget.com");
  const publicLink = documentLinkOverride
    ? documentLinkOverride
    : invoice.public_token
      ? `${resolvedBase}/faktur/view/${invoice.public_token}`
      : null;

  const branchName = br?.name ?? "—";
  const branchCode = br?.code ? br.code.toUpperCase() : "—";

  const showPage1 = !renderPage || renderPage === 1;
  const showTermsPages = !renderPage || renderPage === 2;
  const termsPagesToRender = renderPage === 2 ? termsPages.slice(0, 1) : termsPages;

  const totalDocPages = 1 + termsPages.length;

  const taglineText = headerTagline ?? "";
  const taglineAlignMap = { left: "left" as const, center: "center" as const, right: "right" as const };
  const taglineAlign = taglineAlignMap[headerTaglineAlign] ?? "center";

  const titleFontSize = Math.min(fs.font_title_size, 30);
  const invoiceIdFontSize = fs.font_invoice_id_size;
  const companyNameFontSize = fs.font_company_name_size;
  const transactionCodeFontSize = Math.min(fs.font_transaction_code_size, 12);

  const pageStyle = {
    width: `${A4_PAGE_WIDTH_PX}px`,
    minHeight: `${A4_PAGE_HEIGHT_PX}px`,
    paddingTop: `${PAGE_MARGIN_TOP}px`,
    paddingBottom: `${PAGE_MARGIN_BOTTOM}px`,
    paddingLeft: `${PAGE_MARGIN_LEFT}px`,
    paddingRight: `${PAGE_MARGIN_RIGHT}px`,
    boxSizing: "border-box" as const,
    display: "flex",
    flexDirection: "column" as const,
    background: "#ffffff",
    position: "relative" as const,
  };

  const contentAreaStyle = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column" as const,
    marginBottom: "8px",
  };

  return (
    <div id="invoice-print-area" style={{ fontFamily: font, background: "#ffffff", color: "#1a1a1a", width: `${A4_PAGE_WIDTH_PX}px`, margin: "0 auto", boxSizing: "border-box", position: "relative", fontSize: "12px", lineHeight: "1.6" }}>

      <link href={getFontUrl(fontFamily)} rel="stylesheet" />
      <style>{termsStyles}</style>

      {/* ══════ PAGE 1: MAIN INVOICE ══════ */}
      {showPage1 && (
        <div className="invoice-page" style={{ ...pageStyle, pageBreakAfter: hasTerms && !renderPage ? "always" : undefined }}>
          <div style={contentAreaStyle}>
            {/* HEADER */}
            <div style={{ height: `${PAGE_HEADER_HEIGHT_PX}px`, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={logoSrc} alt="Logo" style={{ height: logoHeight === "32px" ? "42px" : "48px", objectFit: "contain", flexShrink: 0 }} />
                    <p style={{ fontSize: `${companyNameFontSize}px`, fontWeight: "800", color: "#111827", margin: 0, lineHeight: "1.1" }}>{companyName}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <h1 style={{ fontSize: `${titleFontSize}px`, fontWeight: "800", letterSpacing: "-0.5px", margin: 0, color: "#111827", textTransform: "uppercase", lineHeight: "1.05" }}>Faktur Penjualan</h1>
                  <p style={{ fontSize: `${invoiceIdFontSize}px`, fontWeight: "700", color: "#111827", margin: "2px 0 0 0", fontFamily: "monospace" }}>#{invoice.invoice_number}</p>
                </div>
              </div>
              <div style={{ height: "2px", background: "#111827", borderRadius: "1px" }} />
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              {/* BILL TO + DETAILS */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", gap: "24px" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#000000", margin: "0 0 2px 0" }}>Cabang {branchName}</p>
                  <div style={{ marginBottom: "12px" }}>
                    {addressLine1 && br?.google_maps_url ? (
                      <a href={br.google_maps_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: "#2563eb", fontWeight: "500", lineHeight: "1.4", margin: "0 0 3px 0", maxWidth: "300px", display: "block", textDecoration: "underline" }}>
                        {addressLine1.split("\n").map((line, i) => <span key={i} style={{ display: "block" }}>{line}</span>)}
                      </a>
                    ) : addressLine1 ? (
                      <p style={{ fontSize: "10px", color: "#000000", fontWeight: "500", lineHeight: "1.4", margin: "0 0 3px 0", maxWidth: "300px" }}>
                        {addressLine1.split("\n").map((line, i) => <span key={i} style={{ display: "block" }}>{line}</span>)}
                      </p>
                    ) : null}
                    {br?.phone && <p style={{ fontSize: "10px", color: "#374151", fontWeight: "500", margin: "0 0 1px 0" }}>Telp: {br.phone}</p>}
                    {br?.email && <p style={{ fontSize: "10px", color: "#374151", fontWeight: "500", margin: 0 }}>Email: {br.email}</p>}
                  </div>
                  
                  <div style={{ borderTop: "1px solid #d1d5db", paddingTop: "8px", marginBottom: "6px" }}>
                    <p style={{ fontSize: "10px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0" }}>Ditagihkan Kepada</p>
                  </div>
                  <p style={{ fontSize: "16px", fontWeight: "800", margin: "0 0 4px 0", color: "#111827" }}>{invoice.customer_name ?? "—"}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                    {invoice.customer_phone && <p style={{ fontSize: "13px", color: "#374151", fontWeight: "600", margin: "0" }}>Telp: {invoice.customer_phone}</p>}
                    {invoice.customer_email && <p style={{ fontSize: "13px", color: "#374151", fontWeight: "600", margin: "0" }}>Email: {invoice.customer_email}</p>}
                  </div>
                  {invoice.shipping_address && (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ fontSize: "10px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px 0" }}>Alamat Pengiriman:</p>
                      {shippingParts.map((part, i) => (
                        <p key={i} style={{ fontSize: "11px", color: "#6b7280", margin: "0", lineHeight: "1.4" }}>{part}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ minWidth: "280px" }}>
                  <div style={{ paddingTop: "2px", marginBottom: "8px" }}>
                    <p style={{ fontSize: "13px", fontWeight: "800", color: "#111827", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0", textAlign: "right" }}>Rincian Faktur</p>
                  </div>
                  <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse", border: "1px solid #e5e7eb" }}>
                    <tbody>
                      {[
                        ...(invoice.transactions?.transaction_code ? [["Kode Transaksi", invoice.transactions.transaction_code]] : []),
                        ...(invoice.handled_by_name ? [["Petugas", invoice.handled_by_name]] : []),
                        ["Tanggal Faktur", formatDateTimeLong(invoice.invoice_date)],
                        ["Ketentuan", invoice.due_date ? "Jatuh Tempo di Kuitansi" : "Langsung"],
                        ...(invoice.due_date ? [["Jatuh Tempo", formatShortDate(invoice.due_date)]] : []),
                        ["Kanal Pembayaran", channelLabel(invoice.channel)],
                        ["Metode Pembayaran", invoice.payment_method_name ?? "—"],
                        ...(invoice.payment_reference ? [["No. Pembayaran", invoice.payment_reference]] : []),
                      ].map(([label, value], i) => (
                        <tr key={i}>
                          <td style={{ padding: "4px 8px", color: "#374151", fontWeight: "700", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap", width: "130px" }}>{label}</td>
                          <td style={{ padding: "4px 8px", fontWeight: "600", color: "#111827", background: "#ffffff", borderBottom: "1px solid #e5e7eb", ...(label === "No. Pembayaran" ? { fontFamily: "monospace", fontSize: "10px" } : {}) }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VOID */}
              {invoice.status === "void" && (
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  <span style={{ display: "inline-block", padding: "4px 18px", borderRadius: "4px", border: "3px solid #dc2626", color: "#dc2626", fontSize: "18px", fontWeight: "800", letterSpacing: "4px", textTransform: "uppercase", transform: "rotate(-5deg)" }}>VOID</span>
                </div>
              )}

              {/* ITEMS TABLE */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
                <thead>
                  <tr style={{ borderTop: "2px solid #111827", borderBottom: "2px solid #111827" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#111827", width: "36px" }}>No</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#111827" }}>Produk</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#111827" }}>IMEI</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#111827", width: "44px" }}>Unit</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#111827" }}>Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: InvoiceItem, idx: number) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "6px 10px", fontSize: "11px", color: "#6b7280" }}>{idx + 1}</td>
                      <td style={{ padding: "6px 10px", fontSize: "12px", color: "#111827", fontWeight: "600" }}>{item.product_label}</td>
                      <td style={{ padding: "6px 10px", fontSize: "11px", color: "#6b7280", fontFamily: "monospace" }}>{item.imei}</td>
                      <td style={{ padding: "6px 10px", fontSize: "11px", color: "#6b7280", textAlign: "center" }}>{item.qty ?? 1}</td>
                      <td style={{ padding: "6px 10px", fontSize: "12px", color: "#111827", fontWeight: "600", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.selling_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* SUMMARY with QR */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                  {publicLink && (
                    <>
                      <QRCodeSVG value={publicLink} size={80} level="M" />
                      <p style={{ fontSize: "10px", color: "#111827", maxWidth: "80px", wordBreak: "break-all", lineHeight: "1.2", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>SCAN FAKTUR</p>
                    </>
                  )}
                </div>
                <div style={{ width: "320px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <span style={{ fontSize: "12px", color: "#374151" }}>Subtotal:</span>
                    <span style={{ fontSize: "12px", color: "#111827", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.discount_amount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: "12px", color: "#374151" }}>Diskon{invoice.discount_code ? ` (${invoice.discount_code})` : ""}:</span>
                      <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>(-) {formatCurrency(invoice.discount_amount)}</span>
                    </div>
                  )}
                  {invoice.shipping_cost > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: "12px", color: "#374151" }}>Ongkir:</span>
                      <span style={{ fontSize: "12px", color: "#111827", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(invoice.shipping_cost)}</span>
                    </div>
                  )}
                  {invoice.shipping_discount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: "12px", color: "#374151" }}>Diskon Ongkir:</span>
                      <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>(-) {formatCurrency(invoice.shipping_discount)}</span>
                    </div>
                  )}
                  {invoice.packing_kayu_cost > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: "12px", color: "#374151" }}>Biaya Packing Kayu:</span>
                      <span style={{ fontSize: "12px", color: "#111827", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(invoice.packing_kayu_cost)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "2px solid #111827", marginTop: "2px" }}>
                    <span style={{ fontSize: "13px", color: "#111827", fontWeight: "800" }}>Total:</span>
                    <span style={{ fontSize: "14px", color: "#111827", fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(invoice.total)}</span>
                  </div>
                  <div style={{ marginTop: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>Pembayaran diterima:</span>
                      <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>(-) {formatCurrency(invoice.amount_paid)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: invoice.balance_due > 0 ? "#dc2626" : "#111827" }}>Saldo jatuh tempo:</span>
                      <span style={{ fontSize: "13px", fontWeight: "800", color: invoice.balance_due > 0 ? "#dc2626" : "#111827", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(invoice.balance_due)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SIGNATURE */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                <div style={{ textAlign: "center" }}>
                  {signatureType === "custom" && signatureUrl ? (
                    <img src={signatureUrl} alt="Tanda Tangan" style={{ maxHeight: "60px", objectFit: "contain", marginBottom: "4px" }} />
                  ) : (
                    <div style={{ marginBottom: "4px" }}><SystemStamp text={stampText} subText={stampSubText} /></div>
                  )}
                </div>
              </div>

              {/* CATATAN TAMBAHAN */}
              {additionalNotes && additionalNotes.length > 0 && (
                <div style={{ marginBottom: "0", padding: "12px 16px", background: "#fafafa", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                  <p style={{ fontSize: "12px", fontWeight: "700", color: "#111827", margin: "0 0 4px 0" }}>Catatan Tambahan</p>
                  <ul style={{ margin: "0 0 0 14px", padding: 0 }}>
                    {additionalNotes.map((note, i) => (
                      <li key={i} style={{ fontSize: "11px", color: "#374151", lineHeight: "1.5", listStyleType: "disc", marginBottom: "2px" }}>{parseNoteLinks(note)}</li>
                    ))}
                  </ul>
                  {invoice.notes && !invoice.notes.startsWith("{") && <p style={{ fontSize: "11px", color: "#374151", marginTop: "6px", lineHeight: "1.5", fontStyle: "italic" }}>Catatan: {invoice.notes}</p>}
                </div>
              )}
            </div>
          </div>

          {/* FOOTER PAGE 1 */}
          <InvoiceFooter footerText={footerText} branchName={branchName} branchCode={branchCode} publicLink={publicLink} pageNum={1} totalPages={totalDocPages} />
        </div>
      )}

      {/* ══════ TERMS PAGES (2,3,...) ══════ */}
      {showTermsPages && termsPagesToRender.map((termsContent, index) => {
        const pageNum = 2 + index;
        const isFirstTermsPage = index === 0;

        return (
          <div
            key={`terms-page-${pageNum}`}
            className="invoice-page"
            style={{ ...pageStyle, pageBreakBefore: renderPage ? undefined : "always" }}
          >
            {/* Minimal header for terms pages — no logo, no "FAKTUR PENJUALAN" */}
            <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: "4px", borderBottom: "2px solid #111827", marginBottom: "8px" }}>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "#111827", margin: 0, fontFamily: "monospace" }}>#{invoice.invoice_number}</p>
              <p style={{ fontSize: "9px", color: "#6b7280", margin: 0, fontWeight: "600" }}>Halaman {pageNum} / {totalDocPages}</p>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              {renderTerms(termsContent, fs.font_terms_size, invoice.invoice_date)}
            </div>

            <InvoiceFooter footerText={footerText} branchName={branchName} branchCode={branchCode} publicLink={publicLink} pageNum={pageNum} totalPages={totalDocPages} />
          </div>
        );
      })}
    </div>
  );
}
