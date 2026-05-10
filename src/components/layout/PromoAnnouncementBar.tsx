import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FlashSaleInfo {
  is_active: boolean;
  start_time: string;
  duration_hours: number;
  event_name?: string | null;
}

interface SaleCampaignInfo {
  campaign_name: string;
  gradient_start: string;
  gradient_end: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

function usePromoCountdown(endTime: Date | null) {
  const calc = () => {
    if (!endTime) return { h: 0, m: 0, s: 0, expired: true };
    const diff = endTime.getTime() - Date.now();
    if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true };
    return {
      h: Math.floor(diff / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
      expired: false,
    };
  };
  const [t, setT] = useState(calc());
  useEffect(() => {
    const i = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(i);
  }, [endTime]);
  return t;
}

export function usePromoBar() {
  const [flashSale, setFlashSale] = useState<FlashSaleInfo | null>(null);
  const [flashEndTime, setFlashEndTime] = useState<Date | null>(null);
  const [saleCampaign, setSaleCampaign] = useState<SaleCampaignInfo | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem("promo-bar-dismissed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    (async () => {
      const { data: fsRows } = await supabase.rpc("get_active_flash_sale_info") as { data: any[] | null };
      if (fsRows && fsRows.length > 0) {
        const fs = fsRows[0];
        setFlashSale({ is_active: fs.is_active, start_time: fs.start_time, duration_hours: fs.duration_hours, event_name: fs.event_name ?? null });
        if (fs.is_active) {
          const end = new Date(new Date(fs.start_time).getTime() + fs.duration_hours * 3600000);
          if (end.getTime() > Date.now()) setFlashEndTime(end);
        }
      }
      const { data: scData } = await (supabase as any).from("sale_campaigns").select("campaign_name, gradient_start, gradient_end, start_time, end_time, is_active").eq("is_active", true).limit(1).single();
      if (scData) {
        const now = Date.now();
        if (new Date(scData.start_time).getTime() <= now && new Date(scData.end_time).getTime() > now) {
          setSaleCampaign(scData as SaleCampaignInfo);
        }
      }
    })();
  }, []);

  const flashStarted = flashSale ? new Date(flashSale.start_time).getTime() <= Date.now() : false;
  const { h, m, s, expired } = usePromoCountdown(flashEndTime);
  const flashActive = flashSale?.is_active && !expired && flashStarted;
  const saleActive = saleCampaign?.is_active && saleCampaign && new Date(saleCampaign.start_time).getTime() <= Date.now() && new Date(saleCampaign.end_time).getTime() > Date.now();

  const visible = !dismissed && (flashActive || saleActive);
  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem("promo-bar-dismissed", "1"); } catch {}
  };

  return { visible, flashActive, saleActive, flashSale, saleCampaign, h, m, s, dismiss };
}

export function PromoAnnouncementBar() {
  const { visible, flashActive, saleActive, saleCampaign, h, m, s, dismiss } = usePromoBar();

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-transform duration-300"
        style={{
          background: flashActive
            ? "linear-gradient(90deg, hsl(15 90% 50%), hsl(0 72% 50%), hsl(15 90% 50%))"
            : `linear-gradient(90deg, ${saleCampaign?.gradient_start || 'hsl(142 71% 40%)'}, ${saleCampaign?.gradient_end || 'hsl(160 60% 45%)'}, ${saleCampaign?.gradient_start || 'hsl(142 71% 40%)'})`,
          backgroundSize: "200% 100%",
          animation: "promoShimmer 3s linear infinite",
        }}
      >
        {flashActive ? (
          <>
            <span className="truncate">⚡ Flash Sale — {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
            <Link to="/katalog?filter=flash_sale" className="underline underline-offset-2 text-white/90 hover:text-white text-xs shrink-0">
              Lihat →
            </Link>
          </>
        ) : (
          <>
            <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">🏷️ {saleCampaign?.campaign_name}</span>
            <Link to="/katalog" className="underline underline-offset-2 text-white/90 hover:text-white text-xs shrink-0">
              Lihat →
            </Link>
          </>
        )}
        <button
          onClick={dismiss}
          className="ml-1 sm:ml-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/20 transition shrink-0"
          aria-label="Tutup"
        >
          ✕
        </button>
      </div>
      <style>{`@keyframes promoShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }`}</style>
    </>
  );
}
