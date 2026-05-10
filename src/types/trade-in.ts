import type { MasterProduct } from "@/lib/admin/produk/master-products";

export type TransactionType = "beli" | "tukar_tambah" | "jual_putus";

export type TradeInStatus = "pending" | "approved" | "rejected";

export interface UnitMasukForm {
  product_id: string;
  imei: string;
  serial_number: string;
  condition_status: "no_minus" | "minus";
  minus_severity: "minor" | "mayor" | null;
  minus_description: string;
  harga_sepakat: number;
  notes: string;
}

export interface TradeInUnit {
  id: string;
  product_id: string;
  imei: string | null;
  serial_number: string | null;
  condition_status: "no_minus" | "minus";
  minus_severity: "minor" | "mayor" | null;
  minus_description: string | null;
  cost_price: number;
  selling_price: number | null;
  stock_status: string;
  branch_id: string | null;
  received_at: string;
  notes: string | null;
  created_at: string;
  master_products: MasterProduct | null;
  branches?: { name: string; city: string | null };
  transaction_code?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
}
