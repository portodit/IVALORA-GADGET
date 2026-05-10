import { useEffect, useRef } from "react";

/**
 * Detects USB barcode/IMEI scanner input via rapid keystrokes ending with Enter.
 * When scanner fires and user is NOT in a focused input, redirects the scan
 * value to the given ref input (sets value + dispatches Enter) so existing
 * onChange/onKeyDown handlers process it normally.
 *
 * Scanner heuristic:
 * - Chars arrive < 50ms apart
 * - Sequence ends with Enter or Tab
 * - Total accumulated length >= 5 chars
 * - User is NOT actively typing in a focused input
 */
export function useBarcodeScanner(
  ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  options: { enabled: boolean }
) {
  const enabledRef = useRef(options.enabled);
  enabledRef.current = options.enabled;

  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const SCANNER_MAX_INTERVAL_MS = 50;
    const MIN_SCAN_LENGTH = 5;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      const active = document.activeElement;
      const isInInput =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable);

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      const currentBuf = bufferRef.current ?? "";

      if (elapsed > 200 && currentBuf.length > 0) {
        bufferRef.current = "";
      }

      if (e.key === "Enter" || e.key === "Tab") {
        const buf = bufferRef.current ?? "";
        if (
          buf.length >= MIN_SCAN_LENGTH &&
          elapsed < SCANNER_MAX_INTERVAL_MS &&
          !isInInput &&
          ref.current
        ) {
          e.preventDefault();
          const el = ref.current;
          const nativeSetter = Object.getOwnPropertyDescriptor(
            el instanceof HTMLInputElement
              ? window.HTMLInputElement.prototype
              : window.HTMLTextAreaElement.prototype,
            "value"
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(el, buf);
          } else {
            el.value = buf;
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          el.focus();
        }
        bufferRef.current = "";
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current = (bufferRef.current ?? "") + e.key;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [ref]);
}
