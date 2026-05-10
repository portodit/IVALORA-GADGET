import { useState, useRef, useEffect, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles, Trash2, Building2, Tag, Download, Copy, Cpu, Layers, Hash } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/shared/use-toast";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { analyzeCSVForImport, importStockFromCSV } from "@/lib/admin/produk/ai-import";

interface ImportStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ImportState = "idle" | "select_sheet" | "analyzing" | "confirm_labels" | "uploading" | "processing" | "done" | "error";
type ImportType = "imei" | "serial_number" | "qty";

interface DuplicateDB {
  imei: string;
  csv_status: string;
  db_status: string;
  product_label: string;
}

interface DuplicateCSV {
  imei: string;
  status: string;
  count: number;
}

interface ImportResult {
  total_rows: number;
  imported: number;
  new_products_created: number;
  duplicates_merged: number;
  errors: string[];
  ai_warnings: string[];
  new_labels_created?: string[];
  duplicate_imeis_db?: DuplicateDB[];
  duplicate_imeis_csv?: DuplicateCSV[];
}

interface NewLabelInfo {
  key: string;
  count: number;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
  city: string | null;
}

export function ImportStockModal({ open, onOpenChange, onSuccess }: ImportStockModalProps) {
  const { activeBranch, role, userBranches } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importType, setImportType] = useState<ImportType>("imei");
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [state, setState] = useState<ImportState>("idle");

  // Excel sheet picker
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // New labels detection
  const [newLabels, setNewLabels] = useState<NewLabelInfo[]>([]);
  const [createNewLabels, setCreateNewLabels] = useState(true);

  // Branch selection fallback
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (role === "super_admin") {
      // Super admin bisa pilih cabang mana saja
      supabase.from("branches").select("id, name, code, city").eq("is_active", true).order("name").then(({ data }) => {
        setBranches(data ?? []);
        // Default ke activeBranch kalau ada, kalau tidak ke cabang pertama
        setSelectedBranchId(prev => prev || activeBranch?.id || data?.[0]?.id || "");
      });
    } else if (userBranches.length > 1) {
      // Admin dengan beberapa cabang — tampilkan pilihannya
      setBranches(userBranches.map(b => ({ id: b.id, name: b.name, code: b.code ?? "", city: null })));
      setSelectedBranchId(prev => prev || activeBranch?.id || userBranches[0]?.id || "");
    } else {
      // Satu cabang — langsung auto-select
      const id = activeBranch?.id ?? userBranches[0]?.id ?? "";
      setSelectedBranchId(id);
      if (id) {
        setBranches([{ id, name: activeBranch?.name ?? userBranches[0]?.name ?? "", code: "", city: null }]);
      }
    }
  }, [open, role, activeBranch, userBranches]);

  const branchId = selectedBranchId;

  const applySheetAsCSV = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    setCsvText(csv);
    const lines = csv.trim().split("\n");
    setRowCount(Math.max(0, lines.length - 1));
    setCsvPreview(lines.slice(0, 4).join("\n"));
    setState("idle");
  };

  const handleFileSelect = (f: File) => {
    setFile(f);
    setResult(null);
    setState("idle");
    setErrorMsg("");
    setNewLabels([]);
    setCsvText("");
    setCsvPreview("");
    setRowCount(0);

    const isExcel = f.name.endsWith(".xlsx") || f.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        workbookRef.current = wb;
        if (wb.SheetNames.length === 1) {
          applySheetAsCSV(wb, wb.SheetNames[0]);
        } else {
          setExcelSheets(wb.SheetNames);
          setState("select_sheet");
        }
      };
      reader.readAsArrayBuffer(f);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvText(text);
        const lines = text.trim().split("\n");
        setRowCount(Math.max(0, lines.length - 1));
        setCsvPreview(lines.slice(0, 4).join("\n"));
      };
      reader.readAsText(f);
    }
  };

  const handleSheetSelect = (sheetName: string) => {
    if (workbookRef.current) applySheetAsCSV(workbookRef.current, sheetName);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.type === "text/csv")) handleFileSelect(f);
  };

  // Phase 1: Analyze CSV for new labels
  const handleAnalyze = async () => {
    if (!file || !csvText) return;
    if (!branchId) {
      toast({ title: "Pilih cabang terlebih dahulu", variant: "destructive" });
      return;
    }

    setState("analyzing");
    setProgress(10);

    try {
      const result = await analyzeCSVForImport(csvText);
      setProgress(100);

      if (result.new_labels.length > 0) {
        setNewLabels(result.new_labels);
        setState("confirm_labels");
      } else {
        await doImport(false);
      }
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message || "Terjadi kesalahan saat menganalisis CSV");
      toast({ title: "Analisis gagal", description: err.message, variant: "destructive" });
    }
  };

  // Phase 2: Actual import
  const doImport = async (createLabels: boolean) => {
    setState("processing");
    setProgress(15);

    try {
      const data = await importStockFromCSV({
        csv: csvText,
        branch_id: branchId,
        import_type: importType,
        delete_existing: deleteExisting,
        create_new_labels: createLabels,
        onProgress: (pct) => setProgress(pct),
      });

      setProgress(100);
      setState("done");
      setResult(data);

      toast({
        title: `✅ Import selesai: ${data.imported} unit`,
        description: data.new_products_created > 0
          ? `${data.new_products_created} produk baru dibuat otomatis`
          : undefined,
      });

      onSuccess();
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message || "Terjadi kesalahan saat import");
      toast({ title: "Import gagal", description: err.message, variant: "destructive" });
    }
  };

  const handleConfirmLabels = () => {
    doImport(createNewLabels);
  };

  const reset = () => {
    setFile(null);
    setCsvText("");
    setCsvPreview("");
    setRowCount(0);
    setDeleteExisting(false);
    setState("idle");
    setProgress(0);
    setResult(null);
    setErrorMsg("");
    setNewLabels([]);
    setCreateNewLabels(true);
    setExcelSheets([]);
    workbookRef.current = null;
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const isProcessing = state === "uploading" || state === "processing" || state === "analyzing";
  const isExcelFile = !!file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"));

  const IMPORT_TYPE_OPTIONS: { value: ImportType; label: string; desc: string; icon: ReactNode }[] = [
    { value: "imei", label: "IMEI", desc: "iPhone", icon: <Cpu className="w-4 h-4" /> },
    { value: "serial_number", label: "Serial Number", desc: "iPad, MacBook, Watch, AirPods", icon: <Layers className="w-4 h-4" /> },
    { value: "qty", label: "Qty", desc: "Aksesoris", icon: <Hash className="w-4 h-4" /> },
  ];

  const TEMPLATES: Record<ImportType, { filename: string; csv: string }> = {
    imei: {
      filename: "template-import-imei.csv",
      csv: "Seri,Penyimpanan (GB),Warna,Tipe Garansi,IMEI,Status,Catatan\niPhone 15,128,Black Titanium,ibox,353045678901234,available,\niPhone 15,256,Natural Titanium,ibox,353045678901235,available,",
    },
    serial_number: {
      filename: "template-import-sn.csv",
      csv: "Seri,Penyimpanan (GB),Warna,Tipe Garansi,Serial Number,Kondisi,Status,Catatan\niPad Air M2,128,Blue,ibox,DMPH4A1XMD,fullset,available,\nMacBook Air M2,256,Midnight,ibox,C02X1234JGHF,fullset,available,",
    },
    qty: {
      filename: "template-import-qty.csv",
      csv: "Nama Produk,Kategori,Qty,Harga Beli,Status,Catatan\nCase iPhone 15,aksesoris,10,50000,available,\nTempered Glass iPhone 15,aksesoris,20,25000,available,",
    },
  };

  const handleDownloadTemplate = (type: ImportType) => {
    const { filename, csv } = TEMPLATES[type];
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
        <Sparkles className="w-5 h-5 text-primary" />
        Import Stok
      </div>
      <p className="text-sm text-muted-foreground">
        Upload file CSV atau Excel (.xlsx). AI Gemini akan membantu menormalisasi data secara otomatis.
      </p>
    </>
  );

  const bodyContent = (
    <div className="space-y-4">
      {/* Import type selector */}
      {state === "idle" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Tipe Import</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground"
              onClick={() => handleDownloadTemplate(importType)}
            >
              <Download className="w-3 h-3" />
              Template CSV
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {IMPORT_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setImportType(opt.value); setFile(null); setCsvText(""); setCsvPreview(""); setRowCount(0); }}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-colors ${
                  importType === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {opt.icon}
                <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                <span className="text-[10px] leading-tight">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Branch selector — selalu tampil */}
      {branches.length > 0 && state === "idle" && (
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Cabang Tujuan <span className="text-destructive">*</span>
          </label>
          {branches.length === 1 ? (
            // Satu cabang — tampilkan sebagai info (tidak perlu dropdown)
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm font-medium">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              {branches[0].name}
            </div>
          ) : (
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className={!selectedBranchId ? "border-destructive" : ""}>
                <SelectValue placeholder="Pilih cabang tujuan import..." />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : b.code ? ` (${b.code})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Upload area */}
      {state === "idle" && !file && (
        <div
          className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Pilih atau seret file CSV / Excel</p>
          <p className="text-xs text-muted-foreground mt-1">
            {importType === "imei"
              ? "Format: Seri, Penyimpanan, Warna, Garansi, IMEI, Status"
              : importType === "serial_number"
                ? "Format: Seri, Penyimpanan, Warna, Garansi, Serial Number, Kondisi, Status"
                : "Format: Nama Produk, Qty, Harga Jual"}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">.csv / .xlsx didukung • Multi-sheet akan ditanyakan</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </div>
      )}

      {/* File preview */}
      {file && state === "idle" && (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 border border-border p-3">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{rowCount} baris data • {(file.size / 1024).toFixed(1)} KB{isExcelFile && excelSheets.length > 1 ? " • Excel multi-sheet" : ""}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} className="text-xs shrink-0">Ganti</Button>
            </div>
            {csvPreview && (
              <pre className="text-[10px] text-muted-foreground bg-background rounded-lg p-2 overflow-hidden border max-h-16 whitespace-pre-wrap break-all leading-relaxed">
                {csvPreview}
              </pre>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
            <Checkbox
              id="delete-existing"
              checked={deleteExisting}
              onCheckedChange={(v) => setDeleteExisting(!!v)}
            />
            <label htmlFor="delete-existing" className="text-sm cursor-pointer">
              <span className="font-semibold text-destructive flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Hapus data stok sebelumnya
              </span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                Semua unit stok di cabang ini akan dihapus sebelum import data baru.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Sheet picker — muncul saat file Excel punya >1 sheet */}
      {state === "select_sheet" && excelSheets.length > 0 && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
            <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">File Excel punya {excelSheets.length} sheet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pilih sheet yang ingin diimport:</p>
            </div>
          </div>
          <div className="space-y-2">
            {excelSheets.map((sheet) => (
              <button
                key={sheet}
                type="button"
                onClick={() => handleSheetSelect(sheet)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-border bg-muted/20 hover:border-primary hover:bg-primary/5 transition-all text-sm font-semibold text-left group"
              >
                <span>{sheet}</span>
                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">Pilih sheet ini →</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Ganti file
          </button>
        </div>
      )}

      {/* New labels confirmation step */}
      {state === "confirm_labels" && newLabels.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
            <Tag className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-700">
                Label Status Baru Ditemukan
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV mengandung {newLabels.length} label status yang belum ada di sistem. Apakah ingin dibuatkan otomatis?
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {newLabels.map((nl) => (
              <div key={nl.key} className="flex items-center justify-between rounded-lg bg-muted/40 border border-border px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                    {nl.key}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{nl.count} unit</span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-muted/40 border border-border p-3">
            <Checkbox
              id="create-labels"
              checked={createNewLabels}
              onCheckedChange={(v) => setCreateNewLabels(!!v)}
            />
            <label htmlFor="create-labels" className="text-sm cursor-pointer">
              <span className="font-semibold text-foreground">Buat label baru otomatis</span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                {createNewLabels
                  ? "Label baru akan dibuat dan unit akan diimpor dengan status tersebut."
                  : "Label tidak akan dibuat. Unit dengan status tidak dikenal akan diubah ke \"Available\"."}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {state === "analyzing" ? "Menganalisis CSV..." : state === "uploading" ? "Mengunggah CSV..." : "AI sedang memproses data..."}
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {state === "analyzing"
                ? "Memeriksa label status dan format data..."
                : state === "processing"
                  ? "Menormalisasi seri, warna, garansi, dan membuat produk baru jika diperlukan."
                  : "Membaca file CSV..."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Progress value={progress} className="h-2.5" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}%</span>
              <span>{state === "analyzing" ? "~5 detik" : "~10-60 detik"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Success state */}
      {state === "done" && result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-bold">Import Berhasil!</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                const lines: string[] = [];
                const now = new Date().toLocaleString("id-ID");
                lines.push(`IVALORA Import Log — ${now}`);
                lines.push("=".repeat(52));
                lines.push(`Total baris CSV  : ${result.total_rows}`);
                lines.push(`Berhasil diimpor : ${result.imported} unit`);
                lines.push(`Produk baru      : ${result.new_products_created}`);
                lines.push("");
                if (result.duplicate_imeis_csv?.length) {
                  lines.push(`=== IMEI DUPLIKAT DALAM FILE (${result.duplicate_imeis_csv.length}) ===`);
                  for (const d of result.duplicate_imeis_csv)
                    lines.push(`  ${d.imei}  —  muncul ${d.count}x  —  status: ${d.status}`);
                  lines.push("");
                }
                if (result.duplicate_imeis_db?.length) {
                  lines.push(`=== IMEI SUDAH ADA DI DATABASE (${result.duplicate_imeis_db.length}) ===`);
                  for (const d of result.duplicate_imeis_db)
                    lines.push(`  ${d.imei}  —  ${d.product_label}  —  DB: ${d.db_status} → CSV: ${d.csv_status}`);
                  lines.push("");
                }
                if (result.errors.length) {
                  lines.push(`=== ERROR / PERINGATAN (${result.errors.length}) ===`);
                  for (const e of result.errors) lines.push(`  ${e}`);
                  lines.push("");
                }
                if (!result.duplicate_imeis_csv?.length && !result.duplicate_imeis_db?.length && !result.errors.length)
                  lines.push("Tidak ada kendala — semua data berhasil diimpor.");
                const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `import-log-${new Date().toISOString().slice(0, 10)}.txt`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3 h-3" />
              Download Log
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-xl font-bold text-foreground">{result.imported}</p>
              <p className="text-xs text-muted-foreground">Unit diimpor</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-xl font-bold text-foreground">{result.new_products_created}</p>
              <p className="text-xs text-muted-foreground">Produk baru</p>
            </div>
          </div>
          {result.new_labels_created && result.new_labels_created.length > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs font-semibold text-primary mb-1">Label baru dibuat:</p>
              <div className="flex flex-wrap gap-1.5">
                {result.new_labels_created.map((l, i) => (
                  <span key={i} className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Duplicate IMEIs found in DB (overwritten) */}
          {result.duplicate_imeis_db && result.duplicate_imeis_db.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  {result.duplicate_imeis_db.length} IMEI sudah ada di database (di-update)
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-amber-700 hover:text-amber-800"
                  onClick={() => {
                    const header = "IMEI,Produk,Status CSV,Status DB\n";
                    const rows = result.duplicate_imeis_db!.map(d =>
                      `${d.imei},${d.product_label},${d.csv_status},${d.db_status}`
                    ).join("\n");
                    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `duplikat-imei-${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="w-3 h-3" />
                  Download
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {result.duplicate_imeis_db.slice(0, 20).map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] rounded bg-background/60 px-2 py-1.5 border border-amber-200/40">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-semibold text-foreground">{d.imei}</span>
                      <span className="text-muted-foreground ml-1.5">({d.product_label})</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-muted-foreground">DB: <span className="font-medium text-foreground">{d.db_status}</span></span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-primary">{d.csv_status}</span>
                    </div>
                  </div>
                ))}
                {result.duplicate_imeis_db.length > 20 && (
                  <p className="text-[10px] text-muted-foreground text-center">...dan {result.duplicate_imeis_db.length - 20} lainnya</p>
                )}
              </div>
            </div>
          )}
          {/* CSV-internal duplicates */}
          {result.duplicate_imeis_csv && result.duplicate_imeis_csv.length > 0 && (
            <div className="rounded-lg bg-muted/60 border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  {result.duplicate_imeis_csv.length} IMEI duplikat dalam file (dilewati)
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const header = "IMEI,Jumlah Muncul,Status\n";
                    const rows = result.duplicate_imeis_csv!.map(d => `${d.imei},${d.count},${d.status}`).join("\n");
                    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `duplikat-csv-${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="w-3 h-3" />
                  Download
                </Button>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {result.duplicate_imeis_csv.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] rounded bg-background/60 px-2 py-1.5 border border-border/60">
                    <span className="font-mono font-semibold text-foreground">{d.imei}</span>
                    <div className="flex items-center gap-2 text-muted-foreground shrink-0 ml-2">
                      <span>muncul <span className="font-semibold text-foreground">{d.count}x</span></span>
                      <span className="font-medium text-primary">{d.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-xs font-semibold text-destructive mb-1">{result.errors.length} peringatan:</p>
              <ul className="text-[11px] text-destructive/80 space-y-0.5 max-h-20 overflow-y-auto">
                {result.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
                {result.errors.length > 10 && <li>...dan {result.errors.length - 10} lainnya</li>}
              </ul>
            </div>
          )}
          {result.ai_warnings && result.ai_warnings.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">AI Warnings:</p>
              <ul className="text-[11px] text-amber-600 space-y-0.5">
                {result.ai_warnings.map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {state === "error" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-destructive">Import Gagal</p>
              <p className="text-xs text-destructive/80 mt-1 break-words">{errorMsg}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setState("idle"); setProgress(0); }}>
            Coba Lagi
          </Button>
        </div>
      )}
    </div>
  );

  const footerContent = (
    <>
      {state === "idle" && file && (
        <Button onClick={handleAnalyze} disabled={!branchId} className="gap-2 w-full">
          <Sparkles className="w-4 h-4" />
          Mulai Import ({rowCount} baris)
        </Button>
      )}
      {state === "confirm_labels" && (
        <div className="flex gap-2 w-full">
          <Button variant="outline" onClick={() => { setState("idle"); setNewLabels([]); }} className="flex-1">
            Batal
          </Button>
          <Button onClick={handleConfirmLabels} className="flex-1 gap-2">
            <Sparkles className="w-4 h-4" />
            Lanjutkan Import
          </Button>
        </div>
      )}
      {(state === "done" || state === "error") && (
        <Button variant="outline" onClick={() => handleClose(false)} className="w-full sm:w-auto">Tutup</Button>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            {headerContent}
          </DrawerHeader>
          <div className="px-4 overflow-y-auto flex-1">
            {bodyContent}
          </div>
          <DrawerFooter>
            {footerContent}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {headerContent}
        </DialogHeader>
        {bodyContent}
        <DialogFooter>
          {footerContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
