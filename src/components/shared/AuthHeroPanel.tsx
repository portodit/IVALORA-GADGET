import { type ReactNode } from "react";

interface AuthHeroPanelProps {
  image: string;
  logo: string;
  tag?: string;
  title: ReactNode;
  subtitle?: string;
  extra?: ReactNode;
  bottomPosition?: string;
}

export function AuthHeroPanel({
  image, logo, tag, title, subtitle, extra,
  bottomPosition = "bottom-10",
}: AuthHeroPanelProps) {
  return (
    <>
      <img
        src={image}
        alt="IVALORA Store"
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Logo */}
      <div className="absolute top-8 left-8">
        <img src={logo} alt="IVALORA Gadget" className="h-6 brightness-0 invert" />
      </div>

      {/* Hero text */}
      <div className={`absolute ${bottomPosition} left-8 right-8 space-y-4`}>
        <div className="space-y-2">
          {tag && (
            <p className="text-white/60 text-xs uppercase tracking-[0.2em] font-medium">{tag}</p>
          )}
          <h2 className="text-white text-3xl xl:text-4xl font-bold leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-white/50 text-sm">{subtitle}</p>
          )}
        </div>
        {extra}
      </div>
    </>
  );
}
