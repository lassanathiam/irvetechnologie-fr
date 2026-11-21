import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { listDoublonsSite } from "@/lib/doublons-site.functions";

/** Bandeau discret sur une page : « N doublons possibles », avec lien vers la page Doublons. */
export function BandeauDoublons({ type, className = "" }: { type: "chantier" | "facture" | "devis" | "fiche"; className?: string }) {
  const q = useQuery({ queryKey: ["doublons-site"], queryFn: useServerFn(listDoublonsSite), staleTime: 60_000 });
  const d = q.data;
  const n = !d ? 0 : type === "chantier" ? d.chantiers.length : type === "facture" ? d.factures.length : type === "devis" ? d.devis.length : d.clients.length + d.partenaires.length;
  if (!n) return null;
  return <Link to="/doublons" search={{ type }} className={`flex items-center gap-2 rounded-md border-2 border-destructive/50 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive hover:underline ${className}`}>
    <AlertTriangle className="h-4 w-4 shrink-0" />{n} doublon(s) possible(s) — voir et supprimer
  </Link>;
}
