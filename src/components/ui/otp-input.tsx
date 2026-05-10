import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string[];
  onChange: (digits: string[]) => void;
  onEnter?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  className?: string;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onEnter,
  disabled = false,
  autoFocus = true,
  hasError = false,
  className,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, raw: string) => {
    if (!/^\d*$/.test(raw)) return;
    const next = [...value];
    next[index] = raw.slice(-1);
    onChange(next);
    if (raw && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && onEnter) {
      onEnter();
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted.length === length) {
      onChange(pasted.split(""));
      refs.current[length - 1]?.focus();
    }
  };

  return (
    <div className={cn("flex justify-center gap-2.5", className)} onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className={cn(
            "w-12 h-14 text-center text-2xl font-extrabold rounded-xl border-2 bg-background text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasError ? "border-destructive focus:ring-destructive" : "border-input",
          )}
        />
      ))}
    </div>
  );
}
