import { Link } from "@tanstack/react-router";
import { Lock, PhoneCall } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 text-premium-foreground">
      <div className="border-b border-premium-foreground/10 bg-premium-night/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-3 px-3 sm:px-5">
        <Link to="/" aria-label="Borne de l'Ouest, marque de la société IRVE Technologie" className="group flex shrink-0 items-center gap-2.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-premium-foreground p-1 shadow-sm ring-1 ring-premium-blue/35 transition group-hover:ring-premium-blue">
            <BrandLogo className="h-full w-full" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-sm font-bold sm:text-base">
              Borne de l&apos;Ouest
            </span>
            <span className="hidden text-[9px] font-semibold uppercase text-premium-blue sm:block">
              Société IRVE Technologie
            </span>
            <span className="mt-0.5 block text-[9px] font-bold text-premium-foreground/65 sm:hidden">
              IRVE Technologie · P1 · P2 · P3
            </span>
          </span>
        </Link>
        <div className="hidden shrink-0 items-center gap-1.5 lg:flex" aria-label="Qualifications de la société">
          <span className="mr-1 text-[9px] font-semibold uppercase text-premium-foreground/45">Qualifications</span>
          {['P1', 'P2', 'P3'].map((qualification) => (
            <span key={qualification} className="rounded-sm border border-premium-blue/35 bg-premium-foreground/5 px-2 py-1 text-[10px] font-bold text-premium-blue">
              IRVE <span className="text-premium-foreground">{qualification}</span>
            </span>
          ))}
        </div>
        <nav className="hidden items-center gap-5 text-xs font-semibold text-premium-foreground/65 xl:flex">
          <Link to="/" hash="services" className="hover:text-premium-blue transition">Services</Link>
          <Link to="/bornes" className="hover:text-premium-blue transition">Nos bornes</Link>
          <Link to="/" hash="realisations" className="hover:text-premium-blue transition">Réalisations</Link>
          <Link to="/" hash="maintenance" className="hover:text-premium-blue transition">Maintenance</Link>
          <Link to="/" hash="zones" className="hover:text-premium-blue transition">Zones</Link>
          <Link to="/" hash="avis" className="hover:text-premium-blue transition">Avis</Link>
          <Link to="/a-propos" className="hover:text-premium-blue transition">À propos</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/espace"
            aria-label="Espace pro"
             className="inline-flex min-h-10 items-center gap-1.5 border border-premium-foreground/20 px-2.5 py-2 text-xs text-premium-foreground/70 transition hover:text-premium-blue"
          >
            <Lock className="h-3.5 w-3.5" />
             <span className="hidden sm:inline">Espace pro</span>
          </Link>
          <a
            href="tel:+33768084367"
            className="hidden items-center gap-2 border border-premium-foreground/25 px-3 py-2.5 text-xs font-semibold text-premium-foreground transition hover:border-premium-blue 2xl:inline-flex"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Besoin d&apos;infos ? Appelez-nous
          </a>

          <Link
            to="/demande"
          className="hero-grad text-premium-foreground text-xs font-bold uppercase px-4 py-2.5 hover:brightness-110 transition animate-cta-attention"
          >
            Demande
          </Link>
        </div>
      </div>
      </div>
    </header>
  );
}
