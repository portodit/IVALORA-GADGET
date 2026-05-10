export function LoadingScreen() {
  return (
    <div className="loading-bg fixed inset-0 z-50 flex flex-col items-center justify-center bg-white overflow-hidden">

      {/* === LOADING ASSET: ring + logo === */}
      <div className="relative flex items-center justify-center">
        {/* Track — tipis */}
        <div className="loading-ring absolute w-36 h-36 rounded-full border-2 border-zinc-100" />
        {/* Spinning arc — tebal */}
        <div
          className="loading-ring loading-ring-spin absolute w-36 h-36 rounded-full"
          style={{
            border: "5px solid transparent",
            borderTopColor: "rgba(0,0,0,0.85)",
            borderRightColor: "rgba(0,0,0,0.08)",
          }}
        />
        {/* Logo */}
        <div className="loading-logo relative z-10 w-16 h-16">
          <svg viewBox="0 0 451 233" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path
              d="M291.325 88.5156C173.033 117.574 109.189 140.799 0 195.335C107.764 176.759 158.905 168.416 215.132 161.347L174.048 232.684C259.197 210.017 325.081 181.093 450.433 111.299L262.939 165.829L291.325 88.5156Z"
              fill="black"
            />
            <circle cx="271.903" cy="37.3494" r="37.3494" fill="black" />
          </svg>
        </div>
      </div>

      {/* === TEKS — di bawah loading asset, jarak aman === */}
      <div className="loading-tagline mt-10 text-center space-y-1">
        <p className="text-2xl font-bold text-zinc-900 tracking-[0.18em] uppercase">IVALORA GADGET</p>
        <p className="text-sm font-semibold text-zinc-600 tracking-[0.3em] uppercase">Pusat Jual Beli iPhone Resmi Surabaya</p>
      </div>

      {/* Dots */}
      <div className="loading-tagline mt-5 flex gap-2 items-center">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-zinc-300"
            style={{ animation: `loading-dot 1.2s ease-in-out ${i * 0.18}s infinite alternate` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes loading-dot {
          from { opacity: 0.2; transform: translateY(0px); }
          to   { opacity: 1;   transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
