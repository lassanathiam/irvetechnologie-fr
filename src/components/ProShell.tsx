import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Handshake,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ShieldCheck,
  X,
} from "lucide-react";
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
  const [reduit, setReduit] = useState(false);

  const quitter = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="pro-shell flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={`pro-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-line bg-sidebar text-sidebar-foreground transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          menuOuvert ? "translate-x-0" : "-translate-x-full"
        } ${reduit ? "md:w-[4.5rem]" : "md:w-64"}`}
      >
        <div className="flex h-20 items-center justify-between gap-2 border-b border-sidebar-line px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3" onClick={() => setMenuOuvert(false)}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
              <BrandLogo className="h-8 w-8" />
            </span>
            {!reduit && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-display text-base font-bold text-sidebar-title">Borne de l’Ouest</span>
                <span className="block truncate text-[9px] font-bold uppercase text-sidebar-accent">IRVE Technologie</span>
              </span>
            )}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-title md:hidden"
            aria-label="Fermer le menu"
            onClick={() => setMenuOuvert(false)}
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6" aria-label="Navigation de l’espace professionnel">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOuvert(false)}
              title={reduit ? label : undefined}
              className={`flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-sidebar-title ${reduit ? "justify-center" : "gap-3"}`}
              activeProps={{ className: "bg-sidebar-active text-sidebar-title" }}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!reduit && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-line p-3">
          {!reduit && (
            <div className="mb-3 rounded-md bg-sidebar-hover p-3">
              <div className="flex items-center gap-2 text-sidebar-accent">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="text-xs font-bold">{COMPANY.qualifications}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-sidebar-muted">Installateur qualifié IRVE</p>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={quitter}
            className={`w-full text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-title ${reduit ? "px-0" : "justify-start"}`}
            aria-label="Se déconnecter"
            title={reduit ? "Se déconnecter" : undefined}
          >
            <LogOut className="h-4 w-4" /> {!reduit && "Se déconnecter"}
          </Button>
        </div>
      </aside>

      {menuOuvert && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-overlay md:hidden"
          onClick={() => setMenuOuvert(false)}
        />
      )}

      <div className="min-w-0 flex-1">
        <header className="pro-header sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Ouvrir le menu"
              onClick={() => setMenuOuvert(true)}
            >
              <Menu />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              aria-label={reduit ? "Déplier le menu" : "Réduire le menu"}
              title={reduit ? "Déplier le menu" : "Réduire le menu"}
              onClick={() => setReduit((valeur) => !valeur)}
            >
              {reduit ? <ChevronRight /> : <ChevronLeft />}
            </Button>
            <span className="hidden text-sm font-semibold text-muted-foreground sm:block">Espace professionnel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              to="/installer"
              aria-label="Installer l’application"
              title="Installer l’application"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <Download className="h-4 w-4" />
            </Link>
            <ThemeToggle />
            <span className="hidden border-l border-border pl-4 text-right sm:block">
              <span className="block text-xs font-bold text-foreground">IRVE Technologie</span>
              <span className="block text-[11px] text-muted-foreground">Administrateur</span>
            </span>
          </div>
        </header>
        <main className="pro-main p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}