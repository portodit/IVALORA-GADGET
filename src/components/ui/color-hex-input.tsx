import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useState } from "react";

function hslStringToHex(hsl: string): string {
  try {
    const match = hsl.match(/hsl\((\d+)\s+(\d+)%?\s+(\d+)%?\)/);
    if (!match) {
      if (/^#[0-9a-fA-F]{6}$/.test(hsl)) return hsl;
      return "#22c55e";
    }
    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch { return "#22c55e"; }
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

interface ColorHexInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorHexInput({ label, value, onChange }: ColorHexInputProps) {
  const [hex, setHex] = useState(() => hslStringToHex(value));

  useEffect(() => {
    setHex(hslStringToHex(value));
  }, [value]);

  const handleHexChange = useCallback((newHex: string) => {
    setHex(newHex);
    if (/^#[0-9a-fA-F]{6}$/.test(newHex)) {
      onChange(newHex);
    }
  }, [onChange]);

  const handlePickerChange = useCallback((newHex: string) => {
    setHex(newHex);
    onChange(newHex);
  }, [onChange]);

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={e => handlePickerChange(e.target.value)}
          className="w-9 h-9 rounded-md border border-border cursor-pointer p-0.5 bg-transparent"
        />
        <Input
          value={hex}
          onChange={e => handleHexChange(e.target.value)}
          placeholder="#22c55e"
          className="h-9 text-xs font-mono flex-1"
        />
      </div>
    </div>
  );
}
