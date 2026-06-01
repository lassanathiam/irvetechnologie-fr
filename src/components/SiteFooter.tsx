export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-32">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row justify-between gap-4 text-mono text-muted-foreground">
        <div>© {new Date().getFullYear()} IRVE Technologie · Tous droits réservés</div>
        <div className="flex gap-6">
          <a href="tel:0768084367" className="hover:text-foreground">07 68 08 43 67</a>
          <span>Couverture FR · 7 départements</span>
        </div>
      </div>
    </footer>
  );
}
