import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/shared/use-toast";
import { Key, Plus, Trash2, AlertTriangle, Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface ApiKeyRow {
  id: string;
  label: string;
  api_key: string;
  priority: number;
  is_active: boolean;
  last_rate_limited_at: string | null;
  created_at: string;
}

export function RajaOngkirKeysManager() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // New key form
  const [newLabel, setNewLabel] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from("rajaongkir_api_keys")
      .select("*")
      .order("priority", { ascending: true });
    if (error) {
      toast({ title: "Gagal memuat API keys", variant: "destructive" });
    }
    setKeys(data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleAdd() {
    if (!newApiKey.trim()) {
      toast({ title: "API Key tidak boleh kosong", variant: "destructive" });
      return;
    }
    if (keys.length >= 5) {
      toast({ title: "Maksimal 5 API key", variant: "destructive" });
      return;
    }
    setAdding(true);
    const nextPriority = keys.length > 0 ? Math.max(...keys.map(k => k.priority)) + 1 : 1;
    const { error } = await db.from("rajaongkir_api_keys").insert({
      label: newLabel.trim() || `API Key ${nextPriority}`,
      api_key: newApiKey.trim(),
      priority: nextPriority,
    });
    setAdding(false);
    if (error) {
      toast({ title: "Gagal menambah API key", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "API key ditambahkan" });
    setNewLabel("");
    setNewApiKey("");
    fetchKeys();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus API key ini?")) return;
    const { error } = await db.from("rajaongkir_api_keys").delete().eq("id", id);
    if (error) {
      toast({ title: "Gagal menghapus", variant: "destructive" });
      return;
    }
    toast({ title: "API key dihapus" });
    fetchKeys();
  }

  async function handleToggleActive(key: ApiKeyRow) {
    const { error } = await db
      .from("rajaongkir_api_keys")
      .update({ is_active: !key.is_active })
      .eq("id", key.id);
    if (error) {
      toast({ title: "Gagal mengubah status", variant: "destructive" });
      return;
    }
    fetchKeys();
  }

  function maskKey(k: string) {
    if (k.length <= 8) return "••••••••";
    return k.substring(0, 4) + "••••" + k.substring(k.length - 4);
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
          <Key className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">API Key RajaOngkir</h3>
          <p className="text-xs text-muted-foreground">
            Maks. 5 key. Jika key pertama kena limit (429), otomatis beralih ke key berikutnya.
          </p>
        </div>
      </div>

      {/* Existing keys */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k, idx) => (
            <div
              key={k.id}
              className={cn(
                "flex items-center gap-3 p-3 border rounded-xl transition-colors",
                k.is_active ? "border-border bg-background" : "border-border/50 bg-muted/30 opacity-60"
              )}
            >
              <Badge variant="outline" className="shrink-0 text-[10px] font-bold">
                #{idx + 1}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{k.label}</p>
                <div className="flex items-center gap-1.5">
                  <code className="text-[11px] text-muted-foreground font-mono">
                    {showKey[k.id] ? k.api_key : maskKey(k.api_key)}
                  </code>
                  <button
                    onClick={() => setShowKey(prev => ({ ...prev, [k.id]: !prev[k.id] }))}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey[k.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                {k.last_rate_limited_at && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] text-amber-600">
                      Rate limited: {new Date(k.last_rate_limited_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleToggleActive(k)}
                  title={k.is_active ? "Nonaktifkan" : "Aktifkan"}
                >
                  <Check className={cn("w-3.5 h-3.5", k.is_active ? "text-emerald-500" : "text-muted-foreground")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(k.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {keys.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              Belum ada API key. Tambahkan minimal 1 key untuk fitur ongkir.
            </p>
          )}
        </div>
      )}

      {/* Add new key */}
      {keys.length < 5 && (
        <div className="border border-dashed border-border rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tambah API Key Baru</p>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Label (opsional)"
              className="flex-1 h-8 text-xs"
            />
            <Input
              value={newApiKey}
              onChange={e => setNewApiKey(e.target.value)}
              placeholder="API Key"
              className="flex-[2] h-8 text-xs font-mono"
            />
            <Button size="sm" onClick={handleAdd} disabled={adding} className="h-8 px-3">
              <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
