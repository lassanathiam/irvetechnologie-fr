import logo from "@/assets/logo-irve.png.asset.json";

/** Logo officiel IRVE Technologie (marque Borne de l'Ouest). */
export function BrandLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="IRVE Technologie — Borne de l'Ouest"
      className={`${className} object-contain`}
      loading="eager"
      decoding="async"
    />
  );
}

export const BRAND_LOGO_URL = logo.url;
