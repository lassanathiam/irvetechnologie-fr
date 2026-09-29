import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-slate-200 bg-white text-slate-500">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-12 text-sm leading-relaxed">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="max-w-sm">
            <div className="font-display text-base font-bold text-slate-900">Borne de l&apos;Ouest</div>
            <p className="mt-2">
              Installation et maintenance de bornes de recharge pour particuliers,
              copropriétés et professionnels, dans tout le Grand Ouest.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <a href="mailto:contacts@irvetechnologie.fr" className="font-medium text-slate-700 transition hover:text-emerald-600">contacts@irvetechnologie.fr</a>
              <a href="tel:+33633657840" className="font-medium text-slate-700 transition hover:text-emerald-600">06 33 65 78 40</a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/a-propos" className="transition hover:text-emerald-600">À propos</Link>
              <Link to="/calculateur-irve" className="transition hover:text-emerald-600">Calculateur IRVE</Link>
              <Link to="/demande" className="transition hover:text-emerald-600">Demande de devis</Link>
            </div>
            <div>Nantes · Grand Ouest élargi · jusqu&apos;à ~250 km (selon projet)</div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-slate-200 pt-6 text-xs md:grid-cols-2">
          <div>
            <div className="font-semibold text-slate-700">IRVE Technologie</div>
            <div>Siège social : 60 rue François Ier, 75008 Paris</div>
          </div>
          <div className="md:text-right">
            <div>SIRET 989 533 724 00013</div>
            <div>TVA intracom. FR89 989533724</div>
            <div className="font-semibold text-emerald-700">Qualifications IRVE P1 · P2 · P3</div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 text-xs">
          © {new Date().getFullYear()} Borne de l&apos;Ouest · Tous droits réservés
        </div>
      </div>
    </footer>
  );
}
