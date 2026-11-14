import { Link } from "@tanstack/react-router";
import { ouvrirReglagesConsentement } from "@/lib/consentement";
import { COMPANY_CONFIG, operatingBaseLine, headOfficeLine } from "@/config/company";
import { VILLES_ZONE } from "@/lib/zones-intervention";

const bretons = VILLES_ZONE.filter((v) => v.region === "Bretagne");
const ligeriens = VILLES_ZONE.filter((v) => v.region === "Pays de la Loire");

function LienVille({ slug, nom }: { slug: string; nom: string }) {
  return (
    <Link
      to="/installation-borne-recharge/$ville"
      params={{ ville: slug }}
      className="transition hover:text-emerald-600"
    >
      Borne à {nom}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 sm:mt-32 border-t border-slate-200 bg-white text-slate-500">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-12 text-sm leading-relaxed">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="max-w-sm">
            <div className="font-display text-base font-bold text-slate-900">Borne de l&apos;Ouest</div>
            <p className="mt-2">
              Installation et maintenance de bornes de recharge pour particuliers,
              copropriétés et professionnels, dans tout le Grand Ouest.
            </p>
            <p className="mt-3 text-slate-600">{COMPANY_CONFIG.openingHoursDisplay}</p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <a href={`mailto:${COMPANY_CONFIG.email}`} className="font-medium text-slate-700 transition hover:text-emerald-600">{COMPANY_CONFIG.email}</a>
              <a href={COMPANY_CONFIG.phoneHref} className="font-medium text-slate-700 transition hover:text-emerald-600">{COMPANY_CONFIG.phoneDisplay}</a>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link to="/a-propos" className="transition hover:text-emerald-600">À propos</Link>
              <Link to="/installation-borne-recharge-nantes" className="transition hover:text-emerald-600">Borne à Nantes</Link>
              <Link to="/zones-intervention" className="transition hover:text-emerald-600">Zones d&apos;intervention</Link>
              <Link to="/borne-recharge-professionnels" className="transition hover:text-emerald-600">Professionnels</Link>
              <Link to="/calculateur-irve" className="transition hover:text-emerald-600">Calculateur IRVE</Link>
              <Link to="/demande" className="transition hover:text-emerald-600">Demande de devis</Link>
            </div>
            <div>Nantes · Grand Ouest élargi · jusqu&apos;à ~250 km (selon projet)</div>
          </div>
        </div>

        <nav aria-label="Pages d'installation par ville" className="grid gap-6 border-t border-slate-200 pt-6 text-xs md:grid-cols-2">
          <div>
            <div className="font-semibold text-slate-700">Bretagne</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Link to="/installation-borne-recharge-nantes" className="transition hover:text-emerald-600">Borne à Nantes</Link>
              {bretons.map((v) => (
                <LienVille key={v.slug} slug={v.slug} nom={v.nom} />
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold text-slate-700">Pays de la Loire</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {ligeriens.map((v) => (
                <LienVille key={v.slug} slug={v.slug} nom={v.nom} />
              ))}
            </div>
          </div>
        </nav>

        <div className="grid gap-3 border-t border-slate-200 pt-6 text-xs md:grid-cols-2">
          <div>
            <div className="font-semibold text-slate-700">IRVE Technologie</div>
            <div>Siège social : {headOfficeLine}</div>
            <div>Établissement et base opérationnelle : {operatingBaseLine}</div>
          </div>
          <div className="md:text-right">
            <div>SIRET 989 533 724 00013</div>
            <div>TVA intracom. FR89 989533724</div>
            <div className="font-semibold text-emerald-700">Qualifications IRVE P1 · P2 · P3</div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 text-xs">
          © {new Date().getFullYear()} Borne de l&apos;Ouest · Tous droits réservés ·{" "}
          <Link to="/confidentialite" className="transition hover:text-emerald-600">Confidentialité et cookies</Link> ·{" "}
          <button type="button" onClick={ouvrirReglagesConsentement} className="underline-offset-2 transition hover:text-emerald-600 hover:underline">
            Gérer les cookies
          </button>
        </div>
      </div>
    </footer>
  );
}
