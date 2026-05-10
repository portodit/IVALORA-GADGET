import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, ChevronDown, ChevronUp, X, AlertCircle, Barcode, Trash2, Check, Loader2, Upload, FileText, ShoppingCart, Store } from "lucide-react";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useToast } from "@/hooks/shared/use-toast";
import { logActivity } from "@/lib/admin/laporan/activity-log";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MasterProduct, WARRANTY_LABELS, CATEGORY_LABELS, STORAGE_OPTIONS, FIXED_RESMI_CATEGORIES, HAS_STORAGE_CATEGORIES, HAS_COLOR_CATEGORIES, type WarrantyType, type ProductCategory } from "@/lib/admin/produk/master-products";
import { getTrackingType, TAMBAH_STOK_CHANNELS, ECOMMERCE_CHANNELS, type SoldChannel } from "@/lib/admin/produk/stock-units";
import { useStatusLabels } from "@/hooks/admin/use-status-labels";
import { cn } from "@/lib/utils";

type InputType = "single" | "bulk";
type EntryMode = "same_all" | "diff_condition" | "diff_price" | "diff_all";

interface ParsedIMEI {
  imei: string;
  condition: "no_minus" | "minus";
  minusDesc?: string;
  sellingPrice?: string;
  costPrice?: string;
  isDuplicate?: boolean;
  existsInDb?: boolean;
  validated?: boolean;
}

interface Branch {
  id: string;
  name: string;
  city: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

const getProductLabel = (p: MasterProduct) => {
  const wLabel = p.warranty_type ? (WARRANTY_LABELS[p.warranty_type as WarrantyType] ?? p.warranty_type) : "";
  const storageLabel = p.storage_gb ? (p.storage_gb >= 1024 ? `${p.storage_gb / 1024} TB` : `${p.storage_gb} GB`) : "";
  return `${p.series}${storageLabel ? " - " + storageLabel : ""}${p.color ? " " + p.color : ""}${wLabel ? " " + wLabel : ""}`;
};

export default function TambahStokPage() {
  const navigate = useNavigate();
  const { role, activeBranch, user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = role === "super_admin";
  const isMobile = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { statusLabels } = useStatusLabels();

  // Product selection
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
  const productRef = useRef<HTMLDivElement>(null);

  // Inline SKU creation
  const [showSkuForm, setShowSkuForm] = useState(false);
  const [skuCategory, setSkuCategory] = useState<ProductCategory>("iphone");
  const [skuSeries, setSkuSeries] = useState("");
  const [skuStorage, setSkuStorage] = useState(128);
  const [skuColor, setSkuColor] = useState("");
  const [skuWarranty, setSkuWarranty] = useState<WarrantyType>("resmi_bc");
  const [skuCreating, setSkuCreating] = useState(false);

  // Auto-set warranty to 'resmi' for categories like MacBook, iPad, etc.
  useEffect(() => {
    if (FIXED_RESMI_CATEGORIES.includes(skuCategory)) {
      setSkuWarranty("resmi");
    } else if (skuWarranty === "resmi") {
      // If switching back to iPhone but warranty was 'resmi', set to default 'resmi_bc'
      setSkuWarranty("resmi_bc");
    }
  }, [skuCategory]);

  // Branch
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(isSuperAdmin ? "" : (activeBranch?.id ?? ""));

  // Supplier
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  // Category filter for product dropdown
  const [filterCategory, setFilterCategory] = useState<ProductCategory | "all">("all");

  // Tracking type derived from selected product
  const trackingType = selectedProduct ? getTrackingType(selectedProduct.category) : null;

  // Serial number (for serial-tracked categories)
  const [serialNumber, setSerialNumber] = useState("");

  // Qty (for accessory/qty-tracked categories)
  const [qtyAvailable, setQtyAvailable] = useState("");
  const [costPricePerUnit, setCostPricePerUnit] = useState("");

  // Input type: single or bulk
  const [inputType, setInputType] = useState<InputType>("single");

  // Accordion open states for mobile auto-collapse
  const [inputTypeAccVal, setInputTypeAccVal] = useState<string>("input-type");
  const [entryModeAccVal, setEntryModeAccVal] = useState<string>("entry-mode");
  const [settingsAccVal, setSettingsAccVal] = useState<string>("settings");

  // Entry mode & shared fields
  const [entryMode, setEntryMode] = useState<EntryMode>("same_all");

  // Single IMEI
  const [singleImei, setSingleImei] = useState("");
  const [sharedCondition, setSharedCondition] = useState<"no_minus" | "minus">("no_minus");
  const [sharedMinusDesc, setSharedMinusDesc] = useState("");
  const [sharedSellingPrice, setSharedSellingPrice] = useState("");
  const [sharedCostPrice, setSharedCostPrice] = useState("");
  const [sharedStatus, setSharedStatus] = useState<string>("available");
  const [soldChannel, setSoldChannel] = useState<SoldChannel | null>(null);
  const [nomorFaktur, setNomorFaktur] = useState("");
  const [dokumenFakturFile, setDokumenFakturFile] = useState<File | null>(null);
  const dokumenFakturRef = useRef<HTMLInputElement>(null);
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split("T")[0]);
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [batchCodeError, setBatchCodeError] = useState<string | null>(null);
  const [checkingBatch, setCheckingBatch] = useState(false);
  const [notes, setNotes] = useState("");

  // IMEI list
  const [imeiText, setImeiText] = useState("");
  const [parsedIMEIs, setParsedIMEIs] = useState<ParsedIMEI[]>([]);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bulkValidated, setBulkValidated] = useState(false);

  // Load data — realtime subscription for products
  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from("master_products").select("*").eq("is_active", true).is("deleted_at", null).order("series");
    setProducts((data as MasterProduct[]) ?? []);
  }, []);

  useEffect(() => {
    Promise.all([
      fetchProducts(),
      supabase.from("branches").select("id, name, city").eq("is_active", true).order("name").then(({ data }) => setBranches((data as Branch[]) ?? [])),
      supabase.from("suppliers").select("*").order("name").then(({ data }) => setSuppliers((data as Supplier[]) ?? [])),
    ]);
  }, [fetchProducts]);

  // Subscribe to master_products changes for dynamic product list
  useEffect(() => {
    const channel = supabase
      .channel("master_products_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "master_products" }, () => {
        fetchProducts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProducts]);

  // Close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) setProductDropdownOpen(false);
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setSupplierDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Batch code duplicate check
  useEffect(() => {
    if (!batchCode.trim()) { setBatchCodeError(null); return; }
    const timer = setTimeout(async () => {
      setCheckingBatch(true);
      const { data } = await supabase.from("stock_units").select("id").eq("batch_code", batchCode.trim()).limit(1);
      if (data && data.length > 0) {
        setBatchCodeError(`Kode batch "${batchCode.trim()}" sudah digunakan`);
      } else {
        setBatchCodeError(null);
      }
      setCheckingBatch(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [batchCode]);

  // On mobile: auto-collapse settings card once all required fields are filled
  const settingsRequiredFilled = useMemo(() =>
    !!(branchId || sharedStatus !== "available") && !!receivedAt,
    [branchId, sharedStatus, receivedAt]
  );
  useEffect(() => {
    if (isMobile && settingsRequiredFilled) setSettingsAccVal("");
  }, [isMobile, settingsRequiredFilled]);

  const filteredProducts = products.filter(p => {
    const matchSearch = getProductLabel(p).toLowerCase().includes(productSearch.toLowerCase());
    const matchCat = filterCategory === "all" || p.category === filterCategory;
    return matchSearch && matchCat;
  });
  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));

  const handleSelectProduct = (product: MasterProduct) => {
    setSelectedProduct(product);
    setProductSearch(getProductLabel(product));
    setProductDropdownOpen(false);
    // Reset identifier fields when product changes
    setSerialNumber("");
    setQtyAvailable("");
    setCostPricePerUnit("");
    setSingleImei("");
    setImeiText("");
    setParsedIMEIs([]);
    setBulkValidated(false);
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierSearch(supplier.name);
    setSupplierDropdownOpen(false);
  };

  const handleCreateSupplierInline = async () => {
    const name = newSupplierName.trim();
    if (!name) return;
    setCreatingSupplier(true);
    const { data, error } = await supabase.from("suppliers").insert({ name } as never).select().single();
    setCreatingSupplier(false);
    if (error) { toast({ title: "Gagal membuat supplier", description: error.message, variant: "destructive" }); return; }
    const newSupplier = data as Supplier;
    setSuppliers(prev => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)));
    handleSelectSupplier(newSupplier);
    setShowNewSupplierInput(false);
    setNewSupplierName("");
    toast({ title: `Supplier "${newSupplier.name}" berhasil ditambahkan` });
  };

  const handleCreateSupplierFromDropdown = async () => {
    if (!supplierSearch.trim()) return;
    setCreatingSupplier(true);
    const { data, error } = await supabase.from("suppliers").insert({ name: supplierSearch.trim() } as never).select().single();
    setCreatingSupplier(false);
    if (error) { toast({ title: "Gagal membuat supplier", description: error.message, variant: "destructive" }); return; }
    const newSupplier = data as Supplier;
    setSuppliers(prev => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)));
    handleSelectSupplier(newSupplier);
    toast({ title: `Supplier "${newSupplier.name}" berhasil ditambahkan` });
  };

  const handleCreateSku = async () => {
    const isColorRequired = HAS_COLOR_CATEGORIES.includes(skuCategory);
    if (!skuSeries.trim() || (isColorRequired && !skuColor.trim())) {
      toast({ title: isColorRequired ? "Seri dan Warna wajib diisi" : "Nama Produk wajib diisi", variant: "destructive" });
      return;
    }
    setSkuCreating(true);
    const { data, error } = await supabase.from("master_products").insert({
      category: skuCategory,
      series: skuSeries.trim(),
      storage_gb: HAS_STORAGE_CATEGORIES.includes(skuCategory) ? skuStorage : null,
      color: HAS_COLOR_CATEGORIES.includes(skuCategory) ? skuColor.trim() : null,
      warranty_type: skuCategory === "accessory" ? null : skuWarranty,
    } as never).select().single();
    setSkuCreating(false);
    if (error) {
      toast({ title: error.code === "23505" ? "SKU sudah terdaftar" : "Gagal membuat SKU", description: error.message, variant: "destructive" });
      return;
    }
    const newProduct = data as MasterProduct;
    setProducts(prev => [...prev, newProduct].sort((a, b) => a.series.localeCompare(b.series)));
    handleSelectProduct(newProduct);
    setShowSkuForm(false);
    setSkuSeries(""); setSkuColor("");
    toast({ title: `SKU "${getProductLabel(newProduct)}" berhasil dibuat` });
  };

  // Parse IMEI from textarea — for bulk modes that need per-IMEI editing,
  // we parse but DON'T apply shared values yet
  const parseIMEIs = useCallback(() => {
    const lines = imeiText.split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length >= 14 && l.length <= 17 && /^\d+$/.test(l));
    const seen = new Set<string>();
    const parsed: ParsedIMEI[] = lines.map(imei => {
      const isDuplicate = seen.has(imei);
      seen.add(imei);
      return {
        imei,
        condition: sharedCondition,
        minusDesc: sharedCondition === "minus" ? sharedMinusDesc : undefined,
        sellingPrice: sharedSellingPrice,
        costPrice: sharedCostPrice,
        isDuplicate,
        validated: false,
      };
    });
    setParsedIMEIs(parsed);
    return parsed;
  }, [imeiText, sharedCondition, sharedMinusDesc, sharedSellingPrice, sharedCostPrice]);

  // Check duplicates in DB
  const checkDuplicates = useCallback(async (parsed: ParsedIMEI[]) => {
    if (parsed.length === 0) return parsed;
    setChecking(true);
    const imeis = parsed.map(p => p.imei);
    const { data } = await supabase.from("stock_units").select("imei").in("imei", imeis);
    const existingSet = new Set((data ?? []).map((d: { imei: string }) => d.imei));
    const updated = parsed.map(p => ({ ...p, existsInDb: existingSet.has(p.imei), validated: true }));
    setParsedIMEIs(updated);
    setChecking(false);
    setBulkValidated(true);
    return updated;
  }, []);

  const handleParseAndCheck = async () => {
    const parsed = parseIMEIs();
    if (parsed.length === 0) {
      toast({ title: "Tidak ada IMEI valid", description: "Pastikan IMEI 14-17 digit, satu per baris.", variant: "destructive" });
      return;
    }
    await checkDuplicates(parsed);
  };

  const removeIMEI = (idx: number) => {
    setParsedIMEIs(prev => prev.filter((_, i) => i !== idx));
  };

  const updateIMEIField = (idx: number, field: keyof ParsedIMEI, value: string) => {
    setParsedIMEIs(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const validIMEIs = parsedIMEIs.filter(p => !p.isDuplicate && !p.existsInDb);

  // Should show per-IMEI cards after validation?
  const needsPerImeiCards = inputType === "bulk" && (entryMode === "diff_condition" || entryMode === "diff_price" || entryMode === "diff_all");

  const uploadFakturDoc = async (): Promise<string | null> => {
    if (!dokumenFakturFile) return null;
    try {
      const { uploadFile } = await import("@/lib/upload");
      const result = await uploadFile(dokumenFakturFile, "documents");
      return result.url;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!selectedProduct) { toast({ title: "Pilih produk terlebih dahulu", variant: "destructive" }); return; }
    if (!branchId) { toast({ title: "Cabang wajib diisi", description: "Pilih cabang tempat stok ini berada sebelum menyimpan.", variant: "destructive" }); return; }
    if (sharedStatus === "sold" && !soldChannel) { toast({ title: "Pilih channel penjualan", description: "Wajib pilih Tokopedia, Shopee, atau Offline Tanpa POS.", variant: "destructive" }); return; }
    if (sharedStatus === "sold" && soldChannel && ECOMMERCE_CHANNELS.includes(soldChannel) && !nomorFaktur.trim()) { toast({ title: "Nomor faktur wajib diisi", description: "Penjualan via E-Commerce membutuhkan nomor faktur / nomor pesanan.", variant: "destructive" }); return; }

    const currentTrackingType = trackingType ?? getTrackingType(selectedProduct.category);

    // ── Serial Number Mode ─────────────────────────────────────────────────
    if (currentTrackingType === "serial_number") {
      const sn = serialNumber.trim();
      if (!sn) { toast({ title: "Serial Number wajib diisi", variant: "destructive" }); return; }
      const { data: existing } = await supabase.from("stock_units").select("id").eq("imei", sn).limit(1);
      if (existing && existing.length > 0) {
        toast({ title: "Serial Number sudah terdaftar", description: `SN ${sn} sudah ada di database.`, variant: "destructive" }); return;
      }
      setSubmitting(true);
      const fakturUrl = await uploadFakturDoc();
      const fakturNotes = fakturUrl ? `[Faktur Doc: ${fakturUrl}]\n${notes || ""}`.trim() : (notes || null);
      const row = {
        product_id: selectedProduct.id,
        imei: sn,
        branch_id: branchId || null,
        condition_status: sharedCondition,
        minus_severity: null,
        minus_description: sharedCondition === "minus" ? sharedMinusDesc || null : null,
        selling_price: sharedSellingPrice ? parseFloat(sharedSellingPrice.replace(/\D/g, "")) : null,
        cost_price: sharedCostPrice ? parseFloat(sharedCostPrice.replace(/\D/g, "")) : null,
        stock_status: sharedStatus,
        sold_channel: sharedStatus === "sold" ? soldChannel : null,
        sold_reference_id: sharedStatus === "sold" && soldChannel && ECOMMERCE_CHANNELS.includes(soldChannel) ? (nomorFaktur.trim() || null) : null,
        received_at: receivedAt,
        estimated_arrival_at: sharedStatus === "coming_soon" && estimatedArrival ? estimatedArrival : null,
        supplier_id: selectedSupplier?.id || null,
        supplier: selectedSupplier?.name || null,
        notes: fakturNotes || null,
      };
      const { error } = await supabase.from("stock_units").insert(row as never);
      setSubmitting(false);
      if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); return; }
      logActivity({ action: "create_stock_unit", actor_id: user?.id, actor_email: user?.email, actor_role: role, metadata: { serial_number: sn, product_id: selectedProduct.id } });
      toast({ title: `Unit ${sn} berhasil ditambahkan!` });
      navigate("/admin/stok-produk");
      return;
    }

    // ── Qty Mode (Aksesoris) ───────────────────────────────────────────────
    if (currentTrackingType === "qty") {
      const qty = parseInt(qtyAvailable) || 0;
      if (qty <= 0) { toast({ title: "Jumlah stok harus lebih dari 0", variant: "destructive" }); return; }
      setSubmitting(true);
      const fakturUrl = await uploadFakturDoc();
      const fakturNotes = fakturUrl ? `[Faktur Doc: ${fakturUrl}]\n${notes || ""}`.trim() : (notes || null);
      const row = {
        master_product_id: selectedProduct.id,
        qty: qty,
        unit_price: costPricePerUnit ? parseFloat(costPricePerUnit.replace(/\D/g, "")) : null,
        movement_type: "purchase",
        transaction_date: receivedAt || new Date().toISOString(),
        supplier_id: selectedSupplier?.id || null,
        notes: fakturNotes || null,
      };
      const { error } = await supabase.from("accessory_stock_ledger").insert(row as never);
      setSubmitting(false);
      if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); return; }
      logActivity({ action: "create_stock_unit", actor_id: user?.id, actor_email: user?.email, actor_role: role, metadata: { qty, product_id: selectedProduct.id, type: "accessory" } });
      toast({ title: `Stok ${qty} unit aksesoris berhasil ditambahkan!` });
      navigate("/admin/stok-produk");
      return;
    }

    // ── IMEI Mode (iPhone) ────────────────────────────────────────────────
    if (inputType === "single") {
      const imei = singleImei.trim();
      if (!imei || imei.length < 14 || imei.length > 17 || !/^\d+$/.test(imei)) {
        toast({ title: "IMEI tidak valid", description: "Pastikan IMEI 14-17 digit angka.", variant: "destructive" }); return;
      }
      const { data: existing } = await supabase.from("stock_units").select("imei").eq("imei", imei);
      if (existing && existing.length > 0) {
        toast({ title: "IMEI sudah terdaftar", description: `IMEI ${imei} sudah ada di database.`, variant: "destructive" }); return;
      }
      setSubmitting(true);
      const fakturUrl = await uploadFakturDoc();
      const fakturNotes = fakturUrl ? `[Faktur Doc: ${fakturUrl}]\n${notes || ""}`.trim() : (notes || null);
      const row = {
        product_id: selectedProduct.id,
        imei,
        branch_id: branchId || null,
        condition_status: sharedCondition,
        minus_severity: null,
        minus_description: sharedCondition === "minus" ? sharedMinusDesc || null : null,
        selling_price: sharedSellingPrice ? parseFloat(sharedSellingPrice.replace(/\D/g, "")) : null,
        cost_price: sharedCostPrice ? parseFloat(sharedCostPrice.replace(/\D/g, "")) : null,
        stock_status: sharedStatus,
        sold_channel: sharedStatus === "sold" ? soldChannel : null,
        sold_reference_id: sharedStatus === "sold" && soldChannel && ECOMMERCE_CHANNELS.includes(soldChannel) ? (nomorFaktur.trim() || null) : null,
        received_at: receivedAt,
        estimated_arrival_at: sharedStatus === "coming_soon" && estimatedArrival ? estimatedArrival : null,
        supplier_id: selectedSupplier?.id || null,
        supplier: selectedSupplier?.name || null,
        notes: fakturNotes || null,
      };
      const { error } = await supabase.from("stock_units").insert(row as never);
      setSubmitting(false);
      if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); return; }
      logActivity({ action: "create_stock_unit", actor_id: user?.id, actor_email: user?.email, actor_role: role, metadata: { imei, product_id: selectedProduct.id } });
      toast({ title: `Unit ${imei} berhasil ditambahkan!` });
      navigate("/admin/stok-produk");
      return;
    }

    // IMEI Bulk submit
    if (validIMEIs.length === 0) { toast({ title: "Tidak ada IMEI valid untuk disimpan", variant: "destructive" }); return; }

    setSubmitting(true);
    const fakturUrl = await uploadFakturDoc();
    const fakturNotes = fakturUrl ? `[Faktur Doc: ${fakturUrl}]\n${notes || ""}`.trim() : (notes || null);
    const rows = validIMEIs.map(p => ({
      product_id: selectedProduct.id,
      imei: p.imei,
      branch_id: branchId || null,
      condition_status: entryMode === "same_all" || entryMode === "diff_price" ? sharedCondition : p.condition,
      minus_severity: null,
      minus_description: (entryMode === "same_all" || entryMode === "diff_price" ? sharedCondition : p.condition) === "minus"
        ? (entryMode === "same_all" || entryMode === "diff_price" ? sharedMinusDesc : p.minusDesc) || null : null,
      selling_price: (entryMode === "same_all" || entryMode === "diff_condition")
        ? (sharedSellingPrice ? parseFloat(sharedSellingPrice.replace(/\D/g, "")) : null)
        : (p.sellingPrice ? parseFloat(p.sellingPrice.replace(/\D/g, "")) : null),
      cost_price: (entryMode === "same_all" || entryMode === "diff_condition")
        ? (sharedCostPrice ? parseFloat(sharedCostPrice.replace(/\D/g, "")) : null)
        : (p.costPrice ? parseFloat(p.costPrice.replace(/\D/g, "")) : null),
      stock_status: sharedStatus,
      sold_channel: sharedStatus === "sold" ? soldChannel : null,
      sold_reference_id: sharedStatus === "sold" && soldChannel && ECOMMERCE_CHANNELS.includes(soldChannel) ? (nomorFaktur.trim() || null) : null,
      received_at: receivedAt,
      estimated_arrival_at: sharedStatus === "coming_soon" && estimatedArrival ? estimatedArrival : null,
      supplier_id: selectedSupplier?.id || null,
      supplier: selectedSupplier?.name || null,
      notes: fakturNotes || null,
    }));

    const { error } = await supabase.from("stock_units").insert(rows as never[]);
    setSubmitting(false);
    if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); return; }
    logActivity({ action: "bulk_create_stock_units", actor_id: user?.id, actor_email: user?.email, actor_role: role, metadata: { count: rows.length, product_id: selectedProduct.id } });
    toast({ title: `${rows.length} unit berhasil ditambahkan!` });
    navigate("/admin/stok-produk");
  };

  const modeLabels: Record<EntryMode, { title: string; desc: string }> = {
    same_all: { title: "Semua Sama", desc: "Kondisi & harga sama untuk semua IMEI" },
    diff_all: { title: "Beda Semua", desc: "Kondisi & harga beda per unit" },
    diff_condition: { title: "Beda Kondisi", desc: "Kondisi beda, harga sama" },
    diff_price: { title: "Beda Harga", desc: "Harga beda, kondisi sama" },
  };
  
  // Define order for rendering buttons
  const entryModeOrder: EntryMode[] = ["same_all", "diff_all", "diff_condition", "diff_price"];

  const renderSettingsContent = () => (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cabang {sharedStatus === "available" && <span className="text-destructive">*</span>}</Label>
        <Select value={branchId} onValueChange={setBranchId} disabled={!isSuperAdmin && !!activeBranch?.id}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Pilih cabang..." /></SelectTrigger>
          <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}{b.city ? ` (${b.city})` : ""}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Supplier</Label>
        {!showNewSupplierInput ? (
          <div ref={supplierRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); if (!e.target.value) setSelectedSupplier(null); }}
                onFocus={() => setSupplierDropdownOpen(true)} placeholder="Cari supplier..." className="h-10 pl-9" />
              {supplierDropdownOpen && supplierSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                  {filteredSuppliers.map(s => (
                    <button key={s.id} type="button" onClick={() => handleSelectSupplier(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors">{s.name}</button>
                  ))}
                  {!filteredSuppliers.some(s => s.name.toLowerCase() === supplierSearch.toLowerCase()) && (
                    <button type="button" onClick={handleCreateSupplierFromDropdown} disabled={creatingSupplier}
                      className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-1.5 border-t border-border">
                      <Plus className="w-3 h-3" /> {creatingSupplier ? "Menambahkan..." : `Tambah "${supplierSearch.trim()}"`}
                    </button>
                  )}
                </div>
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-1.5 h-7 text-xs text-primary gap-1 px-2" onClick={() => setShowNewSupplierInput(true)}>
              <Plus className="w-3 h-3" /> Tambah Supplier Baru
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-foreground">Tambah Supplier Baru</p>
            <Input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="Nama supplier..." className="h-9 text-sm" autoFocus />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setShowNewSupplierInput(false); setNewSupplierName(""); }}>Batal</Button>
              <Button type="button" size="sm" className="flex-1 h-8 text-xs gap-1" onClick={handleCreateSupplierInline} disabled={creatingSupplier || !newSupplierName.trim()}>
                {creatingSupplier ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Simpan
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</Label>
        <Select value={sharedStatus} onValueChange={v => { setSharedStatus(v); if (v !== "sold") { setSoldChannel(null); setNomorFaktur(""); setDokumenFakturFile(null); if (dokumenFakturRef.current) dokumenFakturRef.current.value = ""; } }}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusLabels.filter(s => s.is_active).map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sharedStatus === "sold" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-3 space-y-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-widest">Channel Penjualan <span className="text-destructive">*</span></p>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 -mt-1">Status Terjual via form ini hanya untuk E-Commerce & Offline tanpa POS. Transaksi melalui POS atau Website dikelola terpisah.</p>
          <div className="grid grid-cols-1 gap-2">
            {([
              { key: "ecommerce_tokopedia" as SoldChannel, label: "Tokopedia", sublabel: "E-Commerce", icon: ShoppingCart, requiresFaktur: true },
              { key: "ecommerce_shopee" as SoldChannel, label: "Shopee", sublabel: "E-Commerce", icon: ShoppingCart, requiresFaktur: true },
              { key: "offline_non_pos" as SoldChannel, label: "Offline Tanpa POS", sublabel: "Penjualan langsung tanpa sistem kasir", icon: Store, requiresFaktur: false },
            ] as const).map(({ key, label, sublabel, icon: Icon }) => (
              <button key={key} type="button" onClick={() => { setSoldChannel(key); setNomorFaktur(""); setDokumenFakturFile(null); if (dokumenFakturRef.current) dokumenFakturRef.current.value = ""; }}
                className={cn("flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                  soldChannel === key
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:bg-accent bg-background")}>
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  soldChannel === key ? "bg-primary/10" : "bg-muted")}>
                  <Icon className={cn("w-4 h-4", soldChannel === key ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold", soldChannel === key ? "text-primary" : "text-foreground")}>{label}</p>
                  <p className="text-[11px] text-muted-foreground">{sublabel}</p>
                </div>
                {soldChannel === key && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>

          {soldChannel && ECOMMERCE_CHANNELS.includes(soldChannel) && (
            <div className="space-y-2.5 pt-1 border-t border-amber-200 dark:border-amber-900/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nomor Faktur / Nomor Pesanan <span className="text-destructive">*</span></Label>
                <Input value={nomorFaktur} onChange={e => setNomorFaktur(e.target.value)}
                  placeholder="Contoh: INV-2024-00123 atau TKP-123456789"
                  className="h-10 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dokumen Faktur</Label>
                <div
                  onClick={() => dokumenFakturRef.current?.click()}
                  className={cn("flex items-center gap-3 rounded-lg border-2 border-dashed px-3 py-2.5 cursor-pointer transition-colors",
                    dokumenFakturFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent")}>
                  <input ref={dokumenFakturRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                    onChange={e => setDokumenFakturFile(e.target.files?.[0] ?? null)} />
                  {dokumenFakturFile ? (
                    <>
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{dokumenFakturFile.name}</p>
                        <p className="text-[11px] text-muted-foreground">{(dokumenFakturFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button type="button" onClick={e => { e.stopPropagation(); setDokumenFakturFile(null); if (dokumenFakturRef.current) dokumenFakturRef.current.value = ""; }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm text-foreground">Upload dokumen faktur</p>
                        <p className="text-[11px] text-muted-foreground">PDF, JPG, atau PNG — maks. 5 MB</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {sharedStatus === "coming_soon" ? "Estimasi Kedatangan" : "Tanggal Masuk"}
        </Label>
        {sharedStatus === "coming_soon" ? (
          <Input type="date" value={estimatedArrival} onChange={e => setEstimatedArrival(e.target.value)} className="h-10" />
        ) : (
          <Input type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} className="h-10" />
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Catatan</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan..." className="resize-none h-16 text-sm" />
      </div>
    </>
  );

  const renderInputTypeContent = () => (
    <div className="grid grid-cols-2 gap-2">
      {([
        { key: "single" as InputType, title: "Satuan", desc: "Input 1 IMEI per entry" },
        { key: "bulk" as InputType, title: "Bulk", desc: "Input banyak IMEI sekaligus" },
      ] as const).map(({ key, title, desc }) => (
        <button key={key} type="button" onClick={() => {
          setInputType(key); setParsedIMEIs([]); setBulkValidated(false);
          if (isMobile) setInputTypeAccVal("");
        }}
          className={cn("rounded-lg border p-3 text-left transition-all", inputType === key ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-accent")}>
          <p className={cn("text-xs sm:text-sm font-semibold", inputType === key ? "text-primary" : "text-foreground")}>{title}</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">{desc}</p>
        </button>
      ))}
    </div>
  );

  const renderEntryModeContent = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {entryModeOrder.map((key) => {
        const val = modeLabels[key];
        return (
          <button key={key} type="button" onClick={() => {
            setEntryMode(key); setParsedIMEIs([]); setBulkValidated(false);
            if (isMobile) setEntryModeAccVal("");
          }}
            className={cn("rounded-lg border p-3 text-left transition-all", entryMode === key ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-accent")}>
            <p className={cn("text-[11px] sm:text-xs font-semibold", entryMode === key ? "text-primary" : "text-foreground")}>{val.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{val.desc}</p>
          </button>
        );
      })}
    </div>
  );

  return (
    <DashboardLayout pageTitle="Tambah Unit Stok">
      <div className="max-w-6xl mx-auto pb-20 space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate("/admin/stok-produk")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Tambah Stok Produk</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              {!trackingType ? "Pilih produk untuk melihat jenis input yang sesuai" :
               trackingType === "imei" ? (inputType === "single" ? "Input satu unit IMEI" : "Masukkan beberapa IMEI sekaligus — optimal untuk barcode scanner") :
               trackingType === "serial_number" ? "Input Serial Number unit" :
               "Input jumlah stok aksesoris"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* ── Left Column: Product & Settings ── */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4 sm:space-y-5">
            {/* Produk */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Produk (SKU)</p>
              {/* Category filter for product list */}
              <Select value={filterCategory} onValueChange={(v) => {
                setFilterCategory(v as ProductCategory | "all");
                setSelectedProduct(null);
                setProductSearch("");
              }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Filter Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div ref={productRef} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setProductDropdownOpen(true); if (!e.target.value) setSelectedProduct(null); }}
                  onFocus={() => setProductDropdownOpen(true)}
                  placeholder="Cari produk..."
                  className="h-10 pl-9 pr-8 text-sm"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                {productDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto">
                    {filteredProducts.length > 0 ? filteredProducts.slice(0, 80).map(p => (
                      <button key={p.id} type="button" onClick={() => handleSelectProduct(p)}
                        className={cn("w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors", selectedProduct?.id === p.id && "bg-accent font-medium")}>
                        <span className="font-medium">{p.series}</span>
                        <span className="text-muted-foreground"> — {p.storage_gb ? (p.storage_gb >= 1024 ? `${p.storage_gb / 1024} TB` : `${p.storage_gb} GB`) : ""} {p.color ?? ""} </span>
                        <span className="text-xs text-primary">{WARRANTY_LABELS[p.warranty_type as WarrantyType] ?? p.warranty_type}</span>
                        <span className="text-[10px] text-muted-foreground/60 ml-1">({CATEGORY_LABELS[p.category as ProductCategory] ?? p.category})</span>
                      </button>
                    )) : <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ditemukan</p>}
                    <button type="button" onClick={() => { 
                        if (filterCategory !== "all") {
                          setSkuCategory(filterCategory as ProductCategory);
                        }
                        setShowSkuForm(true); 
                        setProductDropdownOpen(false); 
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-1.5 border-t border-border sticky bottom-0 bg-card">
                      <Plus className="w-3 h-3" /> Tambah SKU Produk Baru
                    </button>
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs text-primary font-medium truncate">{getProductLabel(selectedProduct)}</span>
                  <button type="button" onClick={() => { setSelectedProduct(null); setProductSearch(""); }} className="ml-auto p-0.5 rounded hover:bg-accent">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              )}

              {showSkuForm && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Buat SKU Baru</p>
                    <button type="button" onClick={() => setShowSkuForm(false)} className="p-1 rounded hover:bg-accent"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  </div>
                  <div className={cn("grid gap-2", HAS_STORAGE_CATEGORIES.includes(skuCategory) ? "grid-cols-2" : "grid-cols-1")}>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Kategori</Label>
                      <Select value={skuCategory} onValueChange={v => setSkuCategory(v as ProductCategory)} disabled={filterCategory !== "all"}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {HAS_STORAGE_CATEGORIES.includes(skuCategory) && (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Storage</Label>
                        <Select value={String(skuStorage)} onValueChange={v => setSkuStorage(parseInt(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{STORAGE_OPTIONS.map(s => <SelectItem key={s} value={String(s)}>{s >= 1024 ? `${s / 1024} TB` : `${s} GB`}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <Input 
                    value={skuSeries} 
                    onChange={e => setSkuSeries(e.target.value)} 
                    placeholder={
                      skuCategory === "macbook" ? "Seri (misal: MacBook Pro M3 14\")" :
                      skuCategory === "ipad" ? "Seri (misal: iPad Air 5)" :
                      skuCategory === "watch" ? "Seri (misal: Apple Watch Series 9)" :
                      skuCategory === "airpods" ? "Seri (misal: AirPods Pro 2nd Gen)" :
                      skuCategory === "accessory" ? "Nama Produk (misal: Charger 20W)" :
                      "Seri (misal: iPhone 15 Pro Max)"
                    } 
                    className="h-8 text-xs" 
                  />
                  <div className={cn("grid gap-2", (HAS_COLOR_CATEGORIES.includes(skuCategory) && skuCategory !== "accessory") ? "grid-cols-2" : "grid-cols-1")}>
                    {HAS_COLOR_CATEGORIES.includes(skuCategory) && (
                      <Input value={skuColor} onChange={e => setSkuColor(e.target.value)} placeholder="Warna" className="h-8 text-xs" />
                    )}
                    {skuCategory !== "accessory" && (
                      <Select value={skuWarranty} onValueChange={v => setSkuWarranty(v as WarrantyType)} disabled={FIXED_RESMI_CATEGORIES.includes(skuCategory)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIXED_RESMI_CATEGORIES.includes(skuCategory) ? (
                            <SelectItem value="resmi">Resmi</SelectItem>
                          ) : (
                            (Object.entries(WARRANTY_LABELS) as [WarrantyType, string][]).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button type="button" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleCreateSku} disabled={skuCreating}>
                    {skuCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3" /> Buat SKU</>}
                  </Button>
                </div>
              )}
            </div>

            {/* Cabang & Supplier & Batch — Accordion on mobile, always open on desktop */}
            {isMobile ? (
              <Accordion type="single" collapsible value={settingsAccVal} onValueChange={v => setSettingsAccVal(v ?? "")}>
                <AccordionItem value="settings" className="rounded-xl border border-border bg-card overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">Pengaturan Unit</span>
                      {settingsRequiredFilled && settingsAccVal !== "settings" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">✓ Lengkap</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-4">
                    {renderSettingsContent()}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-4">
                  <p className="text-sm font-semibold text-foreground mb-4">Pengaturan Unit</p>
                  <div className="space-y-4">
                    {renderSettingsContent()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column: Adaptive Input Panel ── */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4 sm:space-y-5">
            {/* Placeholder: no product selected */}
            {!selectedProduct && (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Pilih produk terlebih dahulu</p>
                <p className="text-xs text-muted-foreground/60">Form input akan muncul sesuai tipe tracking produk yang dipilih.</p>
              </div>
            )}

            {/* ─── Serial Number Mode ──────────────────────────────────────── */}
            {selectedProduct && trackingType === "serial_number" && (
              <>
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Serial Number</p>
                  </div>
                  <Input
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="Masukkan Serial Number (SN)"
                    className="h-12 font-mono text-base"
                    autoFocus
                  />
                  {serialNumber.trim().length > 0 && serialNumber.trim().length < 8 && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Serial Number terlalu pendek</p>
                  )}
                </div>
                {/* Kondisi */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Kondisi</p>
                  <div className="flex gap-2">
                    {(["no_minus", "minus"] as const).map(c => (
                      <button key={c} type="button" onClick={() => setSharedCondition(c)}
                        className={cn("flex-1 h-10 rounded-lg border text-sm font-medium transition-all",
                          sharedCondition === c
                            ? c === "no_minus" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-sm" : "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-sm"
                            : "border-border text-muted-foreground hover:bg-accent"
                        )}>
                        {c === "no_minus" ? "No Minus" : "Minus"}
                      </button>
                    ))}
                  </div>
                  {sharedCondition === "minus" && (
                    <Textarea value={sharedMinusDesc} onChange={e => setSharedMinusDesc(e.target.value)} placeholder="Deskripsi minus..." className="resize-none h-20 text-sm" />
                  )}
                </div>
                {/* Harga */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Harga</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Harga Jual</Label>
                      <Input value={sharedSellingPrice} onChange={e => setSharedSellingPrice(e.target.value)} placeholder="Rp..." className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Harga Modal</Label>
                      <Input value={sharedCostPrice} onChange={e => setSharedCostPrice(e.target.value)} placeholder="Rp..." className="h-10" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── Qty Mode (Aksesoris) ───────────────────────────────────── */}
            {selectedProduct && trackingType === "qty" && (
              <>
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Stok Masuk</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Jumlah Unit</Label>
                    <Input
                      type="number"
                      min="1"
                      value={qtyAvailable}
                      onChange={e => setQtyAvailable(e.target.value)}
                      placeholder="Jumlah stok masuk..."
                      className="h-12 text-base"
                      autoFocus
                    />
                  </div>
                </div>
                {/* Harga */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Harga</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Harga Jual / pcs</Label>
                      <Input value={sharedSellingPrice} onChange={e => setSharedSellingPrice(e.target.value)} placeholder="Rp..." className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Harga Modal / pcs</Label>
                      <Input value={costPricePerUnit} onChange={e => setCostPricePerUnit(e.target.value)} placeholder="Rp..." className="h-10" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── IMEI Mode (iPhone) ─────────────────────────────────────── */}
            {selectedProduct && trackingType === "imei" && (
              isMobile ? (
                <Accordion type="single" collapsible value={inputTypeAccVal} onValueChange={v => setInputTypeAccVal(v ?? "")}>
                  <AccordionItem value="input-type" className="rounded-xl border border-border bg-card overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Jenis Input</span>
                        {inputTypeAccVal !== "input-type" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {inputType === "single" ? "Satuan" : "Bulk"}
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {renderInputTypeContent()}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Jenis Input</p>
                  {renderInputTypeContent()}
                </div>
              )
            )}

            {/* Bulk Entry Mode — Accordion on mobile */}
            {trackingType === "imei" && inputType === "bulk" && (
              isMobile ? (
                <Accordion type="single" collapsible value={entryModeAccVal} onValueChange={v => setEntryModeAccVal(v ?? "")}>
                  <AccordionItem value="entry-mode" className="rounded-xl border border-border bg-card overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Mode Input Bulk</span>
                        {entryModeAccVal !== "entry-mode" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {modeLabels[entryMode].title}
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {renderEntryModeContent()}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Mode Input Bulk</p>
                  {renderEntryModeContent()}
                </div>
              )
            )}

            {/* Condition section — shown for IMEI single or bulk same_all/diff_price */}
            {trackingType === "imei" && (inputType === "single" || (inputType === "bulk" && (entryMode === "same_all" || entryMode === "diff_price"))) && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">{inputType === "single" ? "Kondisi" : "Kondisi (Semua Unit)"}</p>
                <div className="flex gap-2">
                  {(["no_minus", "minus"] as const).map(c => (
                    <button key={c} type="button" onClick={() => setSharedCondition(c)}
                      className={cn("flex-1 h-10 rounded-lg border text-sm font-medium transition-all",
                        sharedCondition === c
                          ? c === "no_minus" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-sm" : "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-sm"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}>
                      {c === "no_minus" ? "No Minus" : "Minus"}
                    </button>
                  ))}
                </div>
                {sharedCondition === "minus" && (
                  <Textarea value={sharedMinusDesc} onChange={e => setSharedMinusDesc(e.target.value)} placeholder="Deskripsi minus (misal: lecet pemakaian, baret ringan, ganti baterai)" className="resize-none h-20 text-sm" />
                )}
              </div>
            )}

            {/* Price section — shown for IMEI single or bulk same_all/diff_condition */}
            {trackingType === "imei" && (inputType === "single" || (inputType === "bulk" && (entryMode === "same_all" || entryMode === "diff_condition"))) && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">{inputType === "single" ? "Harga" : "Harga (Semua Unit)"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Harga Jual</Label>
                    <Input value={sharedSellingPrice} onChange={e => setSharedSellingPrice(e.target.value)} placeholder="5000000" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Harga Modal</Label>
                    <Input value={sharedCostPrice} onChange={e => setSharedCostPrice(e.target.value)} placeholder="4000000" className="h-10" />
                  </div>
                </div>
              </div>
            )}

            {/* IMEI Input — only for IMEI tracking type */}
            {trackingType === "imei" && (inputType === "single" ? (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">IMEI</p>
                </div>
                <Input
                  value={singleImei}
                  onChange={e => setSingleImei(e.target.value.replace(/\D/g, ""))}
                  placeholder="Masukkan nomor IMEI (14-17 digit)"
                  className="h-12 font-mono text-base"
                  maxLength={17}
                  autoFocus
                />
                {singleImei && (singleImei.length < 14 || singleImei.length > 17) && (
                  <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> IMEI harus 14-17 digit</p>
                )}
              </div>
            ) : (
              <>
                {/* Scan/Input IMEI area */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Barcode className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        {needsPerImeiCards ? "Langkah 1: Scan IMEI" : "Input IMEI"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {imeiText.split(/[\n,;]+/).filter(l => l.trim().length >= 14).length} IMEI terdeteksi
                    </span>
                  </div>
                  {needsPerImeiCards && (
                    <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      Scan semua IMEI terlebih dahulu, lalu klik "Validasi IMEI". Setelah validasi berhasil, Anda bisa mengatur {entryMode === "diff_condition" ? "kondisi" : entryMode === "diff_price" ? "harga" : "kondisi & harga"} per unit di bawah.
                    </p>
                  )}
                  <Textarea
                    ref={textareaRef}
                    value={imeiText}
                    onChange={e => { setImeiText(e.target.value); setParsedIMEIs([]); setBulkValidated(false); }}
                    placeholder={"Masukkan IMEI, satu per baris.\nBarcode scanner akan otomatis menambah baris baru.\n\nContoh:\n356789012345678\n356789012345679"}
                    className="resize-none h-32 sm:h-40 font-mono text-sm"
                    autoFocus
                  />
                  <Button type="button" onClick={handleParseAndCheck} disabled={checking || !imeiText.trim()} className="w-full gap-2">
                    {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Validasi IMEI
                  </Button>
                </div>

                {/* Parsed Results */}
                {parsedIMEIs.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {needsPerImeiCards ? "Langkah 2: Hasil Validasi & Atur Per Unit" : "Hasil Validasi"}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-600">✓ {validIMEIs.length} valid</span>
                        {parsedIMEIs.filter(p => p.isDuplicate).length > 0 && <span className="text-amber-600">⚠ {parsedIMEIs.filter(p => p.isDuplicate).length} duplikat</span>}
                        {parsedIMEIs.filter(p => p.existsInDb).length > 0 && <span className="text-destructive">✕ {parsedIMEIs.filter(p => p.existsInDb).length} sudah ada</span>}
                      </div>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto space-y-2">
                      {parsedIMEIs.map((p, i) => {
                        const isInvalid = p.isDuplicate || p.existsInDb;
                        const showConditionField = needsPerImeiCards && !isInvalid && (entryMode === "diff_condition" || entryMode === "diff_all");
                        const showPriceField = needsPerImeiCards && !isInvalid && (entryMode === "diff_price" || entryMode === "diff_all");

                        if (!needsPerImeiCards || isInvalid) {
                          // Simple row
                          return (
                            <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-sm font-mono",
                              p.isDuplicate ? "bg-amber-500/10 text-amber-700" : p.existsInDb ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground"
                            )}>
                              <div className="flex items-center gap-2 min-w-0">
                                {p.isDuplicate && <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                {p.existsInDb && <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                                {!isInvalid && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                <span className="truncate">{p.imei}</span>
                                {p.isDuplicate && <span className="text-[10px] font-sans font-medium shrink-0">Duplikat</span>}
                                {p.existsInDb && <span className="text-[10px] font-sans font-medium shrink-0">Sudah ada</span>}
                              </div>
                              <button type="button" onClick={() => removeIMEI(i)} className="p-1 rounded hover:bg-accent shrink-0">
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          );
                        }

                        // Per-IMEI card for diff modes
                        return (
                          <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="font-mono text-sm font-medium">{p.imei}</span>
                              </div>
                              <button type="button" onClick={() => removeIMEI(i)} className="p-1 rounded hover:bg-accent">
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {showConditionField && (
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kondisi</Label>
                                  <div className="flex gap-1.5">
                                    {(["no_minus", "minus"] as const).map(c => (
                                      <button key={c} type="button" onClick={() => updateIMEIField(i, "condition", c)}
                                        className={cn("flex-1 h-8 rounded-md border text-xs font-medium transition-all",
                                          p.condition === c
                                            ? c === "no_minus" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-amber-500 bg-amber-500/10 text-amber-700"
                                            : "border-border text-muted-foreground hover:bg-accent"
                                        )}>
                                        {c === "no_minus" ? "No Minus" : "Minus"}
                                      </button>
                                    ))}
                                  </div>
                                  {p.condition === "minus" && (
                                    <Input value={p.minusDesc ?? ""} onChange={e => updateIMEIField(i, "minusDesc", e.target.value)}
                                      placeholder="Deskripsi minus..." className="h-8 text-xs mt-1" />
                                  )}
                                </div>
                              )}

                              {showPriceField && (
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Harga</Label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input value={p.sellingPrice ?? ""} onChange={e => updateIMEIField(i, "sellingPrice", e.target.value)}
                                      placeholder="Harga Jual" className="h-8 text-xs" />
                                    <Input value={p.costPrice ?? ""} onChange={e => updateIMEIField(i, "costPrice", e.target.value)}
                                      placeholder="Harga Modal" className="h-8 text-xs" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ))}

            {/* Submit */}
            {selectedProduct && (
              <div className="flex gap-3 sticky bottom-4 z-10">
                <Button variant="outline" className="flex-1 bg-card" onClick={() => navigate("/admin/stok-produk")}>Batal</Button>
                <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={
                  submitting || !selectedProduct ||
                  (trackingType === "serial_number" ? !serialNumber.trim() :
                   trackingType === "qty" ? !qtyAvailable || parseInt(qtyAvailable) <= 0 :
                   // IMEI:
                   inputType === "single" ? !singleImei || singleImei.length < 14 : validIMEIs.length === 0 || !bulkValidated)
                }>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {trackingType === "serial_number" ? "Simpan 1 Unit" :
                   trackingType === "qty" ? `Simpan Stok (${parseInt(qtyAvailable) || 0} unit)` :
                   inputType === "single" ? "Simpan 1 Unit" : `Simpan ${validIMEIs.length} Unit`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
