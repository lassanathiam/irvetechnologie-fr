export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-32">
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-6 text-mono text-muted-foreground">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>© {new Date().getFullYear()} Borne de l'Ouest · Tous droits réservés</div>
          <div className="flex flex-wrap gap-6">
            <a href="tel:0768084367" className="hover:text-foreground">07 68 08 43 67</a>
            <span>Grand Ouest · Bretagne &amp; Pays de la Loire</span>
          </div>
        </div>
        <div className="pt-6 border-t border-border/40 grid gap-2 md:grid-cols-2 text-xs leading-relaxed">
          <div>
            <div className="text-foreground/80">IRVE Technologie</div>
            <div>Siège social : 60 rue François Ier, 75008 Paris</div>
          </div>
          <div className="md:text-right">
            <div>SIRET 989 533 724 00013</div>
            <div>TVA intracom. FR89 989533724</div>
            <div className="text-foreground/80">Qualifications IRVE P1 · P2 · P3</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
