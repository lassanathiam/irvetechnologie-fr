import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export function SiteNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
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
          <a href="/#services" className="hover:text-foreground transition">Services</a>
          <a href="/#realisations" className="hover:text-foreground transition">Réalisations</a>
          <a href="/#maintenance" className="hover:text-foreground transition">Maintenance</a>
          <a href="/#zones" className="hover:text-foreground transition">Zones</a>
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

          <Link
            to="/demande"
          className="hero-grad text-primary-foreground text-mono px-4 py-2.5 rounded-sm hover:opacity-90 transition"
          >
            Demande
          </Link>
        </div>
      </div>
    </header>
  );
}
