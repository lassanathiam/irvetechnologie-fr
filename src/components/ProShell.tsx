import { Link } from "@tanstack/react-router";
import { CalendarClock, ClipboardCheck, FileText, Images, Inbox, LayoutDashboard, LogOut, Receipt, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LINKS = [
  { to: "/espace", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/planning", label: "Planning", icon: CalendarClock },
  { to: "/demandes", label: "Demandes", icon: Inbox },
  { to: "/devis", label: "Devis", icon: FileText },
  { to: "/factures", label: "Factures", icon: Receipt },
  { to: "/rapports", label: "Rapports", icon: ClipboardCheck },
  { to: "/realisations", label: "Photos", icon: Images },
] as const;


export function ProShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="hero-grad text-primary-foreground p-1.5 rounded-sm">
              <Zap className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="hidden sm:block leading-tight">
              <span className="block font-semibold tracking-tight text-sm">
                Borne<span className="text-muted-foreground"> de l'Ouest</span>
              </span>
              <span className="block text-[10px] text-mono text-muted-foreground">
                IRVE Technologie · Espace pro
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="text-mono text-xs px-3 py-2 rounded-sm text-muted-foreground hover:text-primary hover:bg-muted/60 inline-flex items-center gap-1.5 whitespace-nowrap"
                activeProps={{ className: "text-primary bg-muted" }}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="text-mono text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1.5 shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" /> Quitter
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
