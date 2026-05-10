import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResendButtonProps {
  cooldown: number;
  onResend: () => void;
  loading?: boolean;
  className?: string;
}

export function ResendButton({ cooldown, onResend, loading = false, className }: ResendButtonProps) {
  const canResend = cooldown <= 0 && !loading;

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={onResend}
        disabled={!canResend}
        loading={loading}
        className="w-full h-11 gap-2 font-semibold"
      >
        <RotateCw className="w-4 h-4" />
        Kirim Ulang Kode
      </Button>

      {cooldown > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Tunggu <span className="font-bold tabular-nums text-foreground">{cooldown}s</span> lagi untuk kirim ulang
        </p>
      )}
    </div>
  );
}
