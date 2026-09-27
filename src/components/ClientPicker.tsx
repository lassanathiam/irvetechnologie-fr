import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listClientsEnregistres, type ClientEnregistre } from "@/lib/clients.functions";

/** Liste déroulante des partenaires et sociétés enregistrés, pour préremplir le client. */
export function ClientPicker({ onPick }: { onPick: (c: ClientEnregistre) => void }) {
  const fetchFn = useServerFn(listClientsEnregistres);
  const q = useQuery({ queryKey: ["clients-enregistres"], queryFn: () => fetchFn() });
  const list = q.data ?? [];
  return (
    <label className="block text-xs text-muted-foreground">
      Client enregistré (partenaire ou société)
      <select
        className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm text-foreground"
        value=""
        onChange={(e) => {
          const c = list.find((x) => x.cle === e.target.value);
          if (c) onPick(c);
        }}
      >
        <option value="">{q.isLoading ? "Chargement…" : list.length ? "— Choisir pour remplir automatiquement —" : "Aucun client enregistré"}</option>
        {list.map((c) => (
          <option key={c.cle} value={c.cle}>
            {c.nom} {c.source === "partenaire" ? "· partenaire" : "· société"}{c.tva_intracom ? ` · TVA ${c.tva_intracom}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Mentions légales du client (SIRET / TVA) à reporter dans les notes du document. */
export function mentionsClient(c: ClientEnregistre) {
  return [c.siret && `SIRET client : ${c.siret}`, c.tva_intracom && `TVA intracom. client : ${c.tva_intracom}`].filter(Boolean).join(" · ");
}
