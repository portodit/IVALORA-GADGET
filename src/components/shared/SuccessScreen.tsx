import { Check } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { H2, BodySm } from "@/components/shared";

interface SuccessScreenProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function SuccessScreen({ title, description, action, className }: SuccessScreenProps) {
  return (
    <div className={cn("min-h-screen flex items-center justify-center p-6 sm:p-8 bg-background", className)}>
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-foreground flex items-center justify-center mx-auto">
          <Check className="w-7 h-7 text-background" strokeWidth={2.5} />
        </div>
        <div className="space-y-2">
          <H2>{title}</H2>
          <BodySm className="text-muted-foreground leading-relaxed">{description}</BodySm>
        </div>
        {action}
      </div>
    </div>
  );
}
