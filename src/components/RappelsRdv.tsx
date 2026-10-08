import { estLivraisonDirecte, NOTE_LIVRAISON_DKV } from "@/lib/reseau-client";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlarmClock } from "lucide-react";
import { listRappelsRdv } from "@/lib/rappels-rdv.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const jourParis = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
const heure = (v: string) =>
  new Date(v).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

function useRappels() {
  const charger = useServerFn(listRappelsRdv);
  const q = useQuery({ queryKey: ["rappels-rdv"], queryFn: () => charger(), refetchInterval: 300_000 });
  return useMemo(() => {
    const auj = jourParis(new Date());
    const dem = jourParis(new Date(Date.now() + 86400_000));
    const rows = q.data ?? [];
    return {
      aujourdhui: rows.filter((r) => jourParis(new Date(r.date_debut)) === auj),
      demain: rows.filter((r) => jourParis(new Date(r.date_debut)) === dem),
    };
  }, [q.data]);
}

type Rdv = ReturnType<typeof useRappels>["demain"][number];

function Liste({ titre, items }: { titre: string; items: Rdv[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-sm font-bold">{titre} ({items.length})</p>
      <ul className="space-y-1 text-sm">
        {items.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-card px-3 py-2">
            <span className="font-semibold">{heure(r.date_debut)}</span> — {r.client_nom}
            {r.cp_ville ? <span className="text-muted-foreground"> · {r.cp_ville}</span> : null}
            {r.technicien ? <span className="text-muted-foreground"> · {r.technicien}</span> : null}
            {r.date_a_confirmer ? <span className="text-destructive"> · date à confirmer</span> : null}
            {estLivraisonDirecte(r.reseau_client) ? <span className="mt-1 block font-semibold text-primary">DKV : {NOTE_LIVRAISON_DKV}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Fenêtre de rappel affichée une fois par jour à l'ouverture de l'espace pro. */
export function RappelsRdvPopup() {
  const { aujourdhui, demain } = useRappels();
  const [ouvert, setOuvert] = useState(false);
  const total = aujourdhui.length + demain.length;
  useEffect(() => {
    if (!total) return;
    const cle = `irve-rappel-rdv-${jourParis(new Date())}-${new Date().getHours() >= 17 ? "soir" : "jour"}`;
    if (!window.localStorage.getItem(cle)) {
      window.localStorage.setItem(cle, "1");
      setOuvert(true);
    }
  }, [total]);
  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-primary" /> Rappel de rendez-vous
          </DialogTitle>
          <DialogDescription>Ne rien oublier : voici les rendez-vous à venir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Liste titre="Aujourd'hui" items={aujourdhui} />
          <Liste titre="Demain" items={demain} />
        </div>
        <DialogFooter>
          <Button asChild variant="outline">
            <Link to="/planning" onClick={() => setOuvert(false)}>Voir le planning</Link>
          </Button>
          <Button onClick={() => setOuvert(false)}>J'ai noté</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bandeau du tableau de bord. */
export function RappelsRdvBandeau() {
  const { aujourdhui, demain } = useRappels();
  if (!aujourdhui.length && !demain.length) return null;
  return (
    <div className="rounded-2xl border-2 border-destructive/60 bg-destructive/10 p-4">
      <p className="mb-3 flex items-center gap-2 font-bold text-destructive">
        <AlarmClock className="h-5 w-5" /> Rendez-vous à ne pas oublier
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Liste titre="Aujourd'hui" items={aujourdhui} />
        <Liste titre="Demain" items={demain} />
      </div>
    </div>
  );
}
