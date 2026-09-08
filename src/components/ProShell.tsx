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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
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

          <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
            {LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="text-mono text-xs font-semibold px-3 py-2 rounded-sm text-muted-foreground hover:text-primary hover:bg-muted/60 inline-flex items-center gap-1.5 whitespace-nowrap"
                activeProps={{ className: "text-primary bg-muted font-bold" }}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </Link>
            ))}
          </nav>

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

        {menuOuvert && (
          <nav className="md:hidden border-t border-border bg-card px-4 py-3 grid grid-cols-2 gap-2">
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
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-mono text-xs font-bold text-primary">{COMPANY.qualifications}</span>
          <span className="text-xs text-muted-foreground">{COMPANY.qualificationsDetail}</span>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
