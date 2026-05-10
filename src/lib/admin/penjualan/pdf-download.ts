import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const PAGE_WIDTH = 794;
const PAGE_MARGIN = 56; // ~1.5cm

export async function downloadInvoicePDF(elementId: string, fileName: string) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Element not found");

  const originalStyle = el.getAttribute("style") || "";
  el.style.width = `${PAGE_WIDTH}px`;
  el.style.minHeight = "auto";
  el.style.position = "relative";
  el.style.overflow = "visible";

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfWidth = 210;
  const pdfHeight = 297;

  const addCanvasToPdf = (canvas: HTMLCanvasElement, pageIndex: number) => {
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    if (pageIndex > 0) pdf.addPage();
    const h = (canvas.height / canvas.width) * pdfWidth;
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, Math.min(h, pdfHeight));
  };

  try {
    // Wait for fonts/images
    await new Promise((r) => setTimeout(r, 300));

    const pageEls = Array.from(el.querySelectorAll<HTMLElement>(".invoice-page"));

    if (pageEls.length > 0) {
      for (let i = 0; i < pageEls.length; i++) {
        const pageEl = pageEls[i];
        const width = Math.round(pageEl.getBoundingClientRect().width) || 794;

        const pageCanvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          width,
          windowWidth: width,
        });

        addCanvasToPdf(pageCanvas, i);
      }
    } else {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 794,
        windowWidth: 794,
      });

      const pageCanvasHeight = Math.round((pdfHeight / pdfWidth) * canvas.width);
      let remainingHeight = canvas.height;
      let position = 0;
      let pageIndex = 0;

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
        if (sliceHeight <= 0) break;

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, position, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        addCanvasToPdf(pageCanvas, pageIndex);

        remainingHeight -= sliceHeight;
        position += sliceHeight;
        pageIndex += 1;
      }
    }

    pdf.save(fileName);
  } finally {
    el.setAttribute("style", originalStyle);
  }
}
