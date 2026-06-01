import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

export function SiteNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="hero-grad text-primary-foreground p-1.5 rounded-sm">
            <Zap className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="font-semibold tracking-tight">IRVE<span className="text-muted-foreground">.Technologie</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-mono text-muted-foreground">
          <a href="/#services" className="hover:text-foreground transition">Services</a>
          <a href="/#parcours" className="hover:text-foreground transition">Parcours</a>
          <a href="/#zones" className="hover:text-foreground transition">Zones</a>
          <a href="/#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>
        <Link
          to="/demande"
          className="hero-grad text-primary-foreground text-mono px-4 py-2.5 rounded-sm hover:opacity-90 transition"
        >
          Demande
        </Link>
      </div>
    </header>
  );
}
