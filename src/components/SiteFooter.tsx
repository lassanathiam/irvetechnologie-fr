import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-premium-foreground/10 bg-premium-night text-premium-foreground">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-10 text-mono text-premium-foreground/60">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>© {new Date().getFullYear()} Borne de l'Ouest · Tous droits réservés</div>
          <div className="flex flex-wrap gap-6">
            <a href="mailto:contacts@irvetechnologie.fr" className="hover:text-premium-blue">contacts@irvetechnologie.fr</a>
            <a href="tel:+33633657840" className="hover:text-premium-blue">06 33 65 78 40</a>
            <Link to="/a-propos" className="hover:text-premium-blue">À propos</Link>
            <span>Nantes · Grand Ouest élargi · jusqu&apos;à ~250 km (selon projet)</span>
          </div>
        </div>
        <div className="grid gap-2 border-t border-premium-foreground/10 pt-6 text-xs leading-relaxed md:grid-cols-2">
          <div>
            <div className="text-premium-foreground">IRVE Technologie</div>
            <div>Siège social : 60 rue François Ier, 75008 Paris</div>
          </div>
          <div className="md:text-right">
            <div>SIRET 989 533 724 00013</div>
            <div>TVA intracom. FR89 989533724</div>
            <div className="text-premium-blue">Qualifications IRVE P1 · P2 · P3</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
