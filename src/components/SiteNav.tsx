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
  "group relative inline-flex shrink-0 items-center rounded-full px-3.5 py-2 text-[13px] font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900";
const underline =
  "pointer-events-none absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-emerald-500 transition-transform duration-300 group-hover:scale-x-100";

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {ITEMS.map((it, i) => (
        <Link
          key={it.label}
          to={it.to}
          hash={it.hash}
          className={`${pill} ${mobile ? "border border-slate-200 bg-white animate-fade-in" : ""}`}
          style={mobile ? { animationDelay: `${i * 40}ms`, animationFillMode: "both" } : undefined}
          activeOptions={{ exact: true, includeHash: true }}
          activeProps={{ className: "bg-emerald-50 text-emerald-700" }}
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
    <header className="fixed inset-x-0 top-0 z-40 text-slate-800">
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-1.5 px-2.5 sm:gap-3 sm:px-5">
          <Link to="/" aria-label="Borne de l'Ouest, marque de la société IRVE Technologie" className="group flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm transition duration-300 group-hover:scale-105">
              <BrandLogo className="h-full w-full" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-[13px] font-bold text-slate-900 sm:text-lg">
                Borne de l&apos;Ouest
              </span>
              <span className="block truncate text-[9px] font-semibold text-slate-500 sm:text-[11px]">
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
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-3"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Espace pro</span>
            </Link>
            <a
              href="tel:+33768084367"
              className="hidden items-center gap-2 rounded-full border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 2xl:inline-flex"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Appelez-nous
            </a>
            <Link
              to="/demande"
              className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-3 py-2.5 text-[11px] font-bold text-white shadow-sm transition duration-200 hover:bg-emerald-700 sm:px-4 sm:text-xs"
            >
              Demande de devis
            </Link>
          </div>
        </div>

        <nav
          className="flex gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] relative after:absolute after:right-0 after:top-0 after:h-full after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent after:pointer-events-none lg:hidden [&::-webkit-scrollbar]:hidden"
          aria-label="Menu principal mobile"
        >
          <NavLinks mobile />
        </nav>
      </div>
    </header>
  );
}
