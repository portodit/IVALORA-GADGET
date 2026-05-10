import { useState, useEffect } from "react";

interface WilayahItem {
  code: string;
  name: string;
}

async function fetchWilayah(path: string): Promise<WilayahItem[]> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch(
      `${supabaseUrl}/functions/v1/wilayah-proxy?path=${encodeURIComponent(path)}`,
      {
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export function useProvinces() {
  const [data, setData] = useState<WilayahItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchWilayah("provinces.json")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

export function useRegencies(provinceCode: string | null) {
  const [data, setData] = useState<WilayahItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provinceCode) { setData([]); return; }
    setLoading(true);
    fetchWilayah(`regencies/${provinceCode}.json`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [provinceCode]);

  return { data, loading };
}

export function useDistricts(regencyCode: string | null) {
  const [data, setData] = useState<WilayahItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regencyCode) { setData([]); return; }
    setLoading(true);
    fetchWilayah(`districts/${regencyCode}.json`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [regencyCode]);

  return { data, loading };
}

export function useVillages(districtCode: string | null) {
  const [data, setData] = useState<WilayahItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!districtCode) { setData([]); return; }
    setLoading(true);
    fetchWilayah(`villages/${districtCode}.json`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [districtCode]);

  return { data, loading };
}
