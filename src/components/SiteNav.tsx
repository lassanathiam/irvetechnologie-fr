import { Link } from "@tanstack/react-router";
import { Lock, PhoneCall } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

type Item = { label: string; to: string; hash?: string };
const ITEMS: Item[] = [
  { label: "Services", to: "/", hash: "services" },
  { label: "Nos bornes", to: "/bornes" },
  { label: "Calculateur", to: "/calculateur-irve" },
  { label: "Réalisations", to: "/", hash: "realisations" },
  { label: "Maintenance", to: "/", hash: "maintenance" },
  { label: "Zones", to: "/", hash: "zones" },
  { label: "Avis", to: "/", hash: "avis" },
  { label: "À propos", to: "/a-propos" },
];

const pill =
  "group relative inline-flex shrink-0 items-center rounded-full px-3.5 py-2 text-[13px] font-semibold text-premium-foreground/90 transition-all duration-300 hover:-translate-y-0.5 hover:bg-premium-foreground/10 hover:text-premium-foreground";
const underline =
  "pointer-events-none absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-premium-blue transition-transform duration-300 group-hover:scale-x-100";

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {ITEMS.map((it, i) => (
        <Link
          key={it.label}
          to={it.to}
          hash={it.hash}
          className={`${pill} ${mobile ? "border border-premium-foreground/15 bg-premium-foreground/5 animate-fade-in" : ""}`}
          style={mobile ? { animationDelay: `${i * 40}ms`, animationFillMode: "both" } : undefined}
          activeOptions={{ exact: true, includeHash: true }}
          activeProps={{ className: "bg-premium-foreground/10 text-premium-foreground" }}
        >
          {it.label}
          {!mobile && <span className={underline} />}
        </Link>
      ))}
    </>
  );
}

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 text-premium-foreground">
      <div className="border-b border-premium-foreground/10 bg-premium-night/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-3 px-3 sm:px-5">
          <Link to="/" aria-label="Borne de l'Ouest, marque de la société IRVE Technologie" className="group flex shrink-0 items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-premium-foreground p-1 shadow-sm transition duration-300 group-hover:scale-105">
              <BrandLogo className="h-full w-full" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block font-display text-base font-bold text-premium-foreground sm:text-lg">
                Borne de l&apos;Ouest
              </span>
              <span className="block text-[11px] font-semibold text-premium-foreground/75">
                IRVE Technologie · P1 · P2 · P3
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Menu principal">
            <NavLinks />
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/espace"
              aria-label="Espace pro"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-premium-foreground/25 px-3 py-2 text-xs font-semibold text-premium-foreground/90 transition hover:bg-premium-foreground/10"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Espace pro</span>
            </Link>
            <a
              href="tel:+33768084367"
              className="hidden items-center gap-2 rounded-full border border-premium-foreground/25 px-3 py-2.5 text-xs font-semibold text-premium-foreground transition hover:bg-premium-foreground/10 2xl:inline-flex"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Appelez-nous
            </a>
            <Link
              to="/demande"
              className="rounded-full bg-premium-blue px-4 py-2.5 text-xs font-bold text-premium-foreground shadow-md transition duration-300 hover:-translate-y-0.5 hover:brightness-110"
            >
              Demande de devis
            </Link>
          </div>
        </div>

        <nav
          className="flex gap-2 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
          aria-label="Menu principal mobile"
        >
          <NavLinks mobile />
        </nav>
      </div>
    </header>
  );
}
