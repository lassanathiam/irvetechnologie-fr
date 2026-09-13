import { Link } from "@tanstack/react-router";
import { Lock, PhoneCall } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export function SiteNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-40">
      <div className="backdrop-blur-md bg-background/70 border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <BrandLogo className="h-10 w-10" />
          <span className="leading-tight">
            <span className="block font-extrabold tracking-tight">
              Borne<span className="text-muted-foreground"> de l'Ouest</span>
            </span>
            <span className="block text-mono text-[10px] font-semibold text-primary uppercase tracking-[0.16em]">
              IRVE Technologie
            </span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-mono text-muted-foreground">
          <Link to="/" hash="services" className="hover:text-foreground transition">Services</Link>
          <Link to="/" hash="realisations" className="hover:text-foreground transition">Réalisations</Link>
          <Link to="/" hash="maintenance" className="hover:text-foreground transition">Maintenance</Link>
          <Link to="/" hash="zones" className="hover:text-foreground transition">Zones</Link>
          <Link to="/a-propos" className="hover:text-foreground transition">À propos</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/espace"
            aria-label="Espace pro"
            className="inline-flex items-center gap-1.5 text-mono text-xs text-muted-foreground hover:text-primary border border-border/70 rounded-sm px-2.5 py-2"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">Espace pro</span>
          </Link>
          <a
            href="tel:+33768084367"
            className="hidden sm:inline-flex items-center gap-2 text-mono text-xs font-semibold bg-primary/10 text-primary border border-primary/30 rounded-sm px-3 py-2.5 hover:bg-primary/15 hover:border-primary/45 transition animate-cta-attention"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Besoin d&apos;infos ? Appelez-nous
          </a>

          <Link
            to="/demande"
          className="hero-grad text-primary-foreground text-mono px-4 py-2.5 rounded-sm hover:opacity-90 transition animate-cta-attention"
          >
            Demande
          </Link>
        </div>
      </div>
      </div>
    </header>
  );
}
