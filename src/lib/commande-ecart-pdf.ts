import type { RapportEcart } from "./commande-ecart";
import { COMPANY, euro } from "./company";
import { enregistrerPdfAttachements } from "./pdf-attachements";
import { blocsRapportLot, type CouleursRapport } from "./commande-ecart-lot";

export async function telechargerRapportEcartLot(rapports: RapportEcart[], commentaire: string, couleurs: CouleursRapport) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  for (const bloc of blocsRapportLot(rapports, commentaire)) {
    pdf.setFont("helvetica", bloc.gras ? "bold" : "normal");
    pdf.setFontSize(bloc.titre ? 12 : 10);
    pdf.setTextColor(couleurs[bloc.couleur ?? "texte"]);
    const texte = bloc.texte.replace(/[\u00a0\u202f]/g, " ").replace(/−/g, "-");
    const morceaux = pdf.splitTextToSize(texte, 176) as string[];
    const hauteur = morceaux.length * (bloc.titre ? 6 : 5) + (bloc.titre ? 4 : 2);
    if (y + (bloc.titre ? Math.max(hauteur, 18) : hauteur) > 275 && hauteur < 240) { pdf.addPage(); y = 18; }
    for (const morceau of morceaux) {
      if (y > 275) { pdf.addPage(); y = 18; }
      pdf.text(morceau, 17, y); y += bloc.titre ? 6 : 5;
    }
    y += bloc.titre ? 4 : 2;
  }
  enregistrerPdfAttachements(pdf.output("blob"), `Rapport-ecart-groupe_${rapports.length}-commandes.pdf`);
}

export async function telechargerRapportEcart(rapport: RapportEcart) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  const ligne = (texte: string, gras = false) => {
    pdf.setFont("helvetica", gras ? "bold" : "normal");
    pdf.setFontSize(10);
    for (const morceau of pdf.splitTextToSize(texte, 176) as string[]) {
      if (y > 275) { pdf.addPage(); y = 18; }
      pdf.text(morceau, 17, y); y += 5;
    }
    y += 2;
  };
  ligne(`${COMPANY.raisonSociale} — Borne de l’Ouest`, true);
  ligne(COMPANY.qualifications);
  ligne(`Rapport d’écart — ${rapport.numero}`, true);
  ligne(`Date : ${rapport.date} | Donneur d’ordre : ${rapport.donneur}`);
  ligne(`Attachement : ${rapport.attachement} | Ticket : ${rapport.ticket}`);
  ligne(`Chantier / objet : ${rapport.client}`);
  ligne(`Commande : ${euro(rapport.commandeHt)} HT`);
  ligne(`Attachement : ${euro(rapport.attachementHt)} HT`);
  ligne(`Écart (attachement - commande) : ${euro(rapport.ecartHt)} HT`, true);
  ligne("Détail des prestations de l’attachement", true);
  for (const item of rapport.lignes) {
    ligne(`${item.libelle} — ${item.quantite} × ${euro(item.prixUnitaire)} = ${euro(item.totalHt)} HT`, true);
    if (item.description) ligne(item.description);
  }
  ligne("Constat / demande de régularisation", true);
  ligne(rapport.commentaire || "Merci de vérifier cet écart et de confirmer le montant à retenir avant facturation.");
  ligne("Le détail des lignes de la commande n’a pas été rapproché automatiquement : seul son total HT est comparé.");
  ligne(`${COMPANY.email} | ${COMPANY.telephone}`);
  enregistrerPdfAttachements(pdf.output("blob"), `Rapport-ecart_${rapport.numero.replace(/[^\p{L}\d_-]+/gu, "-")}.pdf`);
}