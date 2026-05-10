import { useState, useEffect, useCallback } from "react";
import { X, Building2, MapPin, Phone, Hash, Navigation, ExternalLink, Mail, Link } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/shared/use-toast";
import { useProvinces, useRegencies, useDistricts, useVillages } from "@/hooks/admin/use-wilayah";
import { WilayahCombobox } from "@/components/admin/operasional/WilayahCombobox";
import type { Branch } from "@/pages/admin/operasional/ManajemenCabangPage";

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const schema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  code: z.string().min(2, "Kode minimal 2 karakter").max(10, "Kode maks. 10 karakter"),
  province: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  village: z.string().optional(),
  full_address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  google_maps_url: z.string().optional(),
  postal_code: z.string().optional(),
  is_active: z.boolean().default(true),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branch?: Branch | null;
}

interface WilayahState {
  provinceCode: string | null;
  regencyCode: string | null;
  districtCode: string | null;
}

// --- Map click handler component ---
function MapClickHandler({ onLocation }: { onLocation: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocation(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// --- Draggable Marker ---
function DraggableMarker({
  position,
  onDragEnd,
}: {
  position: [number, number];
  onDragEnd: (lat: number, lng: number) => void;
}) {
  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(e) {
          const latlng = e.target.getLatLng();
          onDragEnd(latlng.lat, latlng.lng);
        },
      }}
    />
  );
}

export function BranchFormModal({ open, onClose, onSuccess, branch }: Props) {
  const { toast } = useToast();
  const isEdit = !!branch;

  const [wilayah, setWilayah] = useState<WilayahState>({
    provinceCode: null,
    regencyCode: null,
    districtCode: null,
  });
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-7.2575, 112.7521]);

  const { data: provinces, loading: loadingProvinces } = useProvinces();
  const { data: regencies, loading: loadingRegencies } = useRegencies(wilayah.provinceCode);
  const { data: districts, loading: loadingDistricts } = useDistricts(wilayah.regencyCode);
  const { data: villages, loading: loadingVillages } = useVillages(wilayah.districtCode);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_active: true },
  });

  const latValue = watch("latitude");
  const lngValue = watch("longitude");
  const provinceValue = watch("province") ?? "";
  const cityValue = watch("city") ?? "";
  const districtValue = watch("district") ?? "";
  const villageValue = watch("village") ?? "";

  useEffect(() => {
    if (open) {
      if (branch) {
        reset({
          name: branch.name,
          code: branch.code,
          province: branch.province ?? "",
          city: branch.city ?? "",
          district: branch.district ?? "",
          village: branch.village ?? "",
          full_address: branch.full_address ?? "",
          phone: branch.phone ?? "",
          email: (branch as any).email ?? "",
          google_maps_url: (branch as any).google_maps_url ?? "",
          postal_code: branch.postal_code ?? "",
          is_active: branch.is_active,
          latitude: (branch as any).latitude ?? null,
          longitude: (branch as any).longitude ?? null,
        });
        if ((branch as any).latitude && (branch as any).longitude) {
          setMapCenter([(branch as any).latitude, (branch as any).longitude]);
        }
      } else {
        reset({
          is_active: true,
          name: "", code: "", province: "", city: "", district: "",
          village: "", full_address: "", phone: "", email: "", google_maps_url: "",
          postal_code: "", latitude: null, longitude: null,
        });
        setMapCenter([-7.2575, 112.7521]);
      }
      setWilayah({ provinceCode: null, regencyCode: null, districtCode: null });
      setShowMap(false);
    }
  }, [open, branch, reset]);

  // Auto-resolve province code from saved name when provinces load (edit mode)
  useEffect(() => {
    if (!isEdit || !open || provinces.length === 0 || wilayah.provinceCode) return;
    const saved = branch?.province;
    if (!saved) return;
    const found = provinces.find((p) => p.name === saved);
    if (found) {
      setWilayah((prev) => ({ ...prev, provinceCode: found.code }));
    }
  }, [provinces, isEdit, open, branch?.province, wilayah.provinceCode]);

  // Auto-resolve regency code from saved name when regencies load (edit mode)
  useEffect(() => {
    if (!isEdit || !open || regencies.length === 0 || wilayah.regencyCode) return;
    const saved = branch?.city;
    if (!saved) return;
    const found = regencies.find((r) => r.name === saved);
    if (found) {
      setWilayah((prev) => ({ ...prev, regencyCode: found.code }));
    }
  }, [regencies, isEdit, open, branch?.city, wilayah.regencyCode]);

  // Auto-resolve district code from saved name when districts load (edit mode)
  useEffect(() => {
    if (!isEdit || !open || districts.length === 0 || wilayah.districtCode) return;
    const saved = branch?.district;
    if (!saved) return;
    const found = districts.find((d) => d.name === saved);
    if (found) {
      setWilayah((prev) => ({ ...prev, districtCode: found.code }));
    }
  }, [districts, isEdit, open, branch?.district, wilayah.districtCode]);

  const handleProvinceChange = useCallback((name: string) => {
    setValue("province", name);
    setValue("city", "");
    setValue("district", "");
    setValue("village", "");
    const found = provinces.find((p) => p.name === name);
    setWilayah({ provinceCode: found?.code ?? null, regencyCode: null, districtCode: null });
  }, [provinces, setValue]);

  const handleRegencyChange = useCallback((name: string) => {
    setValue("city", name);
    setValue("district", "");
    setValue("village", "");
    const found = regencies.find((r) => r.name === name);
    setWilayah((prev) => ({ ...prev, regencyCode: found?.code ?? null, districtCode: null }));
  }, [regencies, setValue]);

  const handleDistrictChange = useCallback((name: string) => {
    setValue("district", name);
    setValue("village", "");
    const found = districts.find((d) => d.name === name);
    setWilayah((prev) => ({ ...prev, districtCode: found?.code ?? null }));
  }, [districts, setValue]);

  const handleVillageChange = useCallback((name: string) => {
    setValue("village", name);
  }, [setValue]);

  const handleMapLocation = useCallback((lat: number, lng: number) => {
    const roundedLat = parseFloat(lat.toFixed(6));
    const roundedLng = parseFloat(lng.toFixed(6));
    setValue("latitude", roundedLat);
    setValue("longitude", roundedLng);
    setMapCenter([lat, lng]);
  }, [setValue]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      handleMapLocation(pos.coords.latitude, pos.coords.longitude);
      setShowMap(true);
    });
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      code: data.code.toUpperCase(),
      city: data.city || null,
      district: data.district || null,
      province: data.province || null,
      village: data.village || null,
      full_address: data.full_address || null,
      phone: data.phone || null,
      email: data.email || null,
      google_maps_url: data.google_maps_url || null,
      postal_code: data.postal_code || null,
      is_active: data.is_active,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    };

    let error;
    if (isEdit && branch) {
      ({ error } = await supabase.from("branches").update(payload).eq("id", branch.id));
    } else {
      ({ error } = await supabase.from("branches").insert(payload));
    }

    if (error) {
      toast({ title: isEdit ? "Gagal memperbarui cabang" : "Gagal menambah cabang", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: isEdit ? "Cabang berhasil diperbarui" : "Cabang berhasil ditambahkan" });
    onSuccess();
    onClose();
  };

  if (!open) return null;

  const markerPos: [number, number] | null =
    latValue && lngValue ? [latValue, lngValue] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? "Edit Cabang" : "Tambah Cabang Baru"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
          {/* Name & Code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Nama Cabang *
              </Label>
              <Input placeholder="cth. Eastern Park" {...register("name")} className="h-10" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Kode Cabang *
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="cth. EP" {...register("code")} className="h-10 pl-9 uppercase" />
              </div>
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
          </div>

          {/* Location section - searchable comboboxes */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Lokasi Wilayah
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <WilayahCombobox
                  label="Provinsi"
                  value={provinceValue}
                  onChange={handleProvinceChange}
                  options={provinces}
                  loading={loadingProvinces}
                  disabled={false}
                  placeholder="Pilih Provinsi"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <WilayahCombobox
                  label="Kota / Kabupaten"
                  value={cityValue}
                  onChange={handleRegencyChange}
                  options={regencies}
                  loading={loadingRegencies}
                  disabled={!wilayah.provinceCode && !cityValue}
                  placeholder="Pilih Kota/Kabupaten"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <WilayahCombobox
                  label="Kecamatan"
                  value={districtValue}
                  onChange={handleDistrictChange}
                  options={districts}
                  loading={loadingDistricts}
                  disabled={!wilayah.regencyCode && !districtValue}
                  placeholder="Pilih Kecamatan"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <WilayahCombobox
                  label="Kelurahan / Desa"
                  value={villageValue}
                  onChange={handleVillageChange}
                  options={villages}
                  loading={loadingVillages}
                  disabled={!wilayah.districtCode && !villageValue}
                  placeholder="Pilih Kelurahan/Desa"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Kode Pos</Label>
                <Input placeholder="cth. 60111" {...register("postal_code")} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> No. Telepon
                </Label>
                <Input placeholder="cth. 031-5678901" {...register("phone")} className="h-10" />
              </div>
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email Cabang
                </Label>
                <Input placeholder="cth. cabang@ivaloragadget.com" {...register("email")} className="h-10" type="email" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link className="w-3 h-3" /> Link Google Maps
                </Label>
                <Input placeholder="cth. https://maps.google.com/?q=..." {...register("google_maps_url")} className="h-10" />
              </div>
            </div>

            {/* Full address */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Alamat Lengkap</Label>
              <p className="text-[10px] text-muted-foreground">
                Cantumkan nama jalan, gang, no. rumah/gedung, RT/RW
              </p>
              <textarea
                {...register("full_address")}
                placeholder="cth. Jl. Keputih No. 12, Gang Mawar, RT 03/RW 02"
                className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Map / Coordinates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" /> Koordinat GPS
              </p>
              <div className="flex gap-1.5 flex-wrap items-center">
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3" /> Deteksi Lokasi
                </button>
                <span className="text-muted-foreground text-[10px]">·</span>
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="text-[10px] text-primary hover:underline"
                >
                  {showMap ? "Sembunyikan Peta" : "Tampilkan Peta"}
                </button>
                {latValue && lngValue && (
                  <>
                    <span className="text-muted-foreground text-[10px]">·</span>
                    <a
                      href={`https://www.google.com/maps?q=${latValue},${lngValue}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Google Maps
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Latitude</Label>
                <Controller
                  control={control}
                  name="latitude"
                  render={({ field }) => (
                    <Input
                      placeholder="cth. -7.293900"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const v = e.target.value ? parseFloat(e.target.value) : null;
                        field.onChange(v);
                        if (v && lngValue) setMapCenter([v, lngValue]);
                      }}
                      className="h-10 font-mono text-sm"
                      type="number"
                      step="0.000001"
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Longitude</Label>
                <Controller
                  control={control}
                  name="longitude"
                  render={({ field }) => (
                    <Input
                      placeholder="cth. 112.800600"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const v = e.target.value ? parseFloat(e.target.value) : null;
                        field.onChange(v);
                        if (latValue && v) setMapCenter([latValue, v]);
                      }}
                      className="h-10 font-mono text-sm"
                      type="number"
                      step="0.000001"
                    />
                  )}
                />
              </div>
            </div>

            {showMap && (
              <div className="rounded-xl overflow-hidden border border-border">
                <div style={{ height: 260 }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={15}
                    style={{ height: "100%", width: "100%" }}
                    key={`map-${showMap}`}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onLocation={handleMapLocation} />
                    {markerPos && (
                      <DraggableMarker
                        position={markerPos}
                        onDragEnd={handleMapLocation}
                      />
                    )}
                  </MapContainer>
                </div>
                <p className="text-[10px] text-muted-foreground text-center py-1.5 bg-muted/50">
                  Klik pada peta untuk menentukan lokasi · Seret pin untuk menyesuaikan posisi
                </p>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              id="is_active"
              {...register("is_active")}
              className="w-4 h-4 rounded border-input accent-primary"
            />
            <Label htmlFor="is_active" className="text-sm cursor-pointer">
              Cabang aktif (tersedia untuk operasional)
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" className="flex-1 h-10" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" className="flex-1 h-10 font-semibold" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : isEdit ? "Simpan Perubahan" : "Tambah Cabang"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
