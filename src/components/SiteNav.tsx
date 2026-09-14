import { Link } from "@tanstack/react-router";
import { Lock, PhoneCall } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 text-premium-foreground">
      <div className="backdrop-blur-xl bg-premium-night/80 border-b border-premium-foreground/10">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <BrandLogo className="h-10 w-10" />
          <span className="leading-tight">
            <span className="block font-extrabold tracking-tight">
              Borne<span className="text-premium-foreground/65"> de l'Ouest</span>
            </span>
            <span className="block text-[10px] font-semibold text-premium-blue uppercase">
              IRVE Technologie
            </span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-premium-foreground/65">
          <Link to="/" hash="services" className="hover:text-premium-energy transition">Services</Link>
          <Link to="/" hash="realisations" className="hover:text-premium-energy transition">Réalisations</Link>
          <Link to="/" hash="maintenance" className="hover:text-premium-energy transition">Maintenance</Link>
          <Link to="/" hash="zones" className="hover:text-premium-energy transition">Zones</Link>
          <Link to="/a-propos" className="hover:text-premium-energy transition">À propos</Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle className="h-10 w-10 border-premium-foreground/25 bg-premium-night/70 text-premium-foreground hover:border-premium-energy hover:text-premium-energy" />
          <Link
            to="/espace"
            aria-label="Espace pro"
            className="inline-flex min-h-10 items-center gap-1.5 border border-premium-foreground/20 px-2.5 py-2 text-xs text-premium-foreground/70 transition hover:text-premium-energy"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">Espace pro</span>
          </Link>
          <a
            href="tel:+33768084367"
            className="hidden sm:inline-flex items-center gap-2 text-xs font-semibold text-premium-foreground border border-premium-foreground/25 px-3 py-2.5 hover:border-premium-blue transition"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Besoin d&apos;infos ? Appelez-nous
          </a>

          <Link
            to="/demande"
          className="bg-premium-energy text-premium-night text-xs font-bold uppercase px-4 py-2.5 hover:bg-premium-blue transition animate-cta-attention"
          >
            Demande
          </Link>
        </div>
      </div>
      </div>
    </header>
  );
}
