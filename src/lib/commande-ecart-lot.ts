import type { RapportEcart } from "./commande-ecart";
import { COMPANY, euro } from "./company";

export type CouleursRapport = { texte: string; deplacement: string; supplement: string; ecart: string };
export function categorieLigneRapport(ligne: RapportEcart["lignes"][number]) {
  const texte = `${ligne.libelle} ${ligne.description ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/deplacement|trajet|transport|kilometr|\bkm\b|peage/.test(texte)) return "deplacement";
  if (/supplement|hors forfait|au.dela du forfait|plus.value|ajustement|majoration/.test(texte)) return "supplement";
  return "texte";
}
export function totauxRapports(rapports: RapportEcart[]) {
  const somme = (cle: "commandeHt" | "attachementHt") => Math.round(rapports.reduce((total, rapport) => total + Math.round(rapport[cle] * 100), 0)) / 100;
  const commandeHt = somme("commandeHt"), attachementHt = somme("attachementHt");
  return { commandeHt, attachementHt, ecartHt: Math.round(attachementHt * 100 - commandeHt * 100) / 100 };
}
export function blocsRapportLot(rapports: RapportEcart[], commentaire: string) {
  const total = totauxRapports(rapports);
  const blocs: { texte: string; gras?: boolean; couleur?: keyof CouleursRapport; titre?: boolean }[] = [
    { texte: `${COMPANY.raisonSociale} — Borne de l’Ouest`, gras: true },
    { texte: COMPANY.qualifications },
    { texte: `Rapport d’écart groupé — ${rapports.length} commande(s)`, titre: true, gras: true },
    { texte: `Donneur(s) d’ordre : ${[...new Set(rapports.map((r) => r.donneur))].join(" · ")}` },
    { texte: `Commandes : ${euro(total.commandeHt)} HT | Attachements : ${euro(total.attachementHt)} HT` },
    { texte: `Écart total (attachements − commandes) : ${euro(total.ecartHt)} HT`, couleur: "ecart", gras: true },
  ];
  for (const [i, rapport] of rapports.entries()) {
    blocs.push(
      { texte: `${i + 1}. ${rapport.client || rapport.attachement} — ${rapport.numero}`, titre: true, gras: true },
      { texte: `${rapport.donneur} | ${rapport.date} | Attachement : ${rapport.attachement} | Ticket : ${rapport.ticket || "—"}` },
      { texte: `Commande : ${euro(rapport.commandeHt)} HT | Attachement : ${euro(rapport.attachementHt)} HT` },
      { texte: `Écart : ${euro(rapport.ecartHt)} HT`, couleur: "ecart", gras: true },
    );
    for (const item of rapport.lignes) {
      const couleur = categorieLigneRapport(item);
      const repere = couleur === "deplacement" ? "[DÉPLACEMENT / FRAIS] " : couleur === "supplement" ? "[COMPLÉMENT] " : "";
      blocs.push({ texte: `${repere}${item.libelle} — ${item.quantite} × ${euro(item.prixUnitaire)} = ${euro(item.totalHt)} HT`, gras: true, couleur });
      if (item.description) blocs.push({ texte: item.description, couleur });
    }
    if (rapport.commentaire) blocs.push({ texte: rapport.commentaire });
  }
  blocs.push({ texte: "Constat / demande de régularisation", titre: true, gras: true },
    { texte: commentaire || "Merci de vérifier ces écarts et de confirmer les montants à retenir avant facturation." },
    { texte: "Les totaux HT des commandes sont comparés aux attachements ; les prestations détaillées ci-dessus proviennent des attachements, sans rapprochement automatique des lignes de commande." },
    { texte: `${COMPANY.email} | ${COMPANY.telephone}` });
  return blocs;
}
export function contenuRapportLot(rapports: RapportEcart[], commentaire: string, couleurs: CouleursRapport) {
  const blocs = blocsRapportLot(rapports, commentaire);
  const echapper = (texte: string) => texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return {
    texte: blocs.map((b) => b.texte).join("\n\n"),
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:${couleurs.texte}">${blocs.map((b) => `<${b.titre ? "h2" : "p"} style="color:${couleurs[b.couleur ?? "texte"]};font-size:${b.titre ? "18" : "14"}px;white-space:pre-wrap;${b.gras ? "font-weight:bold;" : ""}">${echapper(b.texte)}</${b.titre ? "h2" : "p"}>`).join("")}</div>`,
  };
}