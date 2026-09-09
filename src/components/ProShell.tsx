import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarClock, ClipboardCheck, Download, FileText, Handshake, Images, Inbox, LayoutDashboard, LogOut, Menu, Receipt, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { COMPANY } from "@/lib/company";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/espace", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/planning", label: "Planning", icon: CalendarClock },
  { to: "/demandes", label: "Demandes", icon: Inbox },
  { to: "/devis", label: "Devis", icon: FileText },
  { to: "/factures", label: "Factures", icon: Receipt },
  { to: "/rapports", label: "Rapports", icon: ClipboardCheck },
  { to: "/partenaires", label: "Partenaires", icon: Handshake },
  { to: "/realisations", label: "Photos", icon: Images },
] as const;



export function ProShell({ children }: { children: React.ReactNode }) {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <div className="pro-shell min-h-screen bg-background text-foreground">
      <header className="pro-header sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <BrandLogo className="h-9 w-9" />
            <span className="hidden sm:block leading-tight">
              <span className="block font-extrabold tracking-tight text-sm">
                Borne<span className="text-muted-foreground"> de l'Ouest</span>
              </span>
              <span className="block text-[10px] text-mono font-semibold text-primary uppercase tracking-[0.14em]">
                IRVE Technologie · Espace pro
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/installer"
              aria-label="Installer l'application"
              title="Installer l'application"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <Download className="h-4 w-4" />
            </Link>
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={menuOuvert}
              onClick={() => setMenuOuvert((ouvert) => !ouvert)}
            >
              {menuOuvert ? <X /> : <Menu />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="hidden md:inline-flex text-mono text-xs text-muted-foreground hover:text-destructive"
            >
              <LogOut /> Quitter
            </Button>
          </div>
        </div>

        <nav className="mx-auto hidden min-h-12 max-w-7xl items-stretch gap-1 overflow-x-auto px-4 md:flex sm:px-6" aria-label="Navigation de l'espace professionnel">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="pro-nav-link inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-primary"
              activeProps={{ className: "border-primary bg-muted text-primary" }}
            >
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </Link>
          ))}
        </nav>

        {menuOuvert && (
          <nav className="grid grid-cols-2 gap-2 border-t border-border bg-card px-4 py-3 md:hidden" aria-label="Navigation mobile de l'espace professionnel">
            {LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOuvert(false)}
                className="min-h-11 rounded-sm border border-border px-3 py-2 text-sm font-semibold text-foreground inline-flex items-center gap-2"
                activeProps={{ className: "border-primary bg-muted text-primary" }}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
            <Link
              to="/installer"
              onClick={() => setMenuOuvert(false)}
              className="col-span-2 min-h-11 rounded-sm border border-border px-3 py-2 text-sm font-semibold text-foreground inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Installer sur ce téléphone
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="col-span-2 justify-start text-destructive"
            >
              <LogOut /> Quitter
            </Button>
          </nav>
        )}
      </header>
      <div className="pro-qualifications border-b border-border bg-muted/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6">
          <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-mono text-xs font-bold text-primary">{COMPANY.qualifications}</span>
          <span className="text-xs text-muted-foreground">{COMPANY.qualificationsDetail}</span>
        </div>
      </div>
      <main className="pro-main mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
