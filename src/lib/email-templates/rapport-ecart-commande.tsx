import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import type { RapportEcart } from "../commande-ecart";
import { COMPANY, euro } from "../company";

function Rapport({ rapport }: { rapport: RapportEcart }) {
  return <Html lang="fr"><Head /><Preview>Écart commande {rapport.numero} / attachement {rapport.attachement}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}><Container style={{ padding: "24px" }}>
      <Text>{COMPANY.raisonSociale} — Borne de l’Ouest<br />{COMPANY.qualifications}</Text>
      <Heading as="h1">Rapport d’écart — {rapport.numero}</Heading>
      <Text>{rapport.date} · {rapport.donneur}<br />Attachement : {rapport.attachement} · Ticket : {rapport.ticket}<br />Chantier / objet : {rapport.client}</Text>
      <Text>Commande : {euro(rapport.commandeHt)} HT<br />Attachement : {euro(rapport.attachementHt)} HT<br /><strong>Écart (attachement − commande) : {euro(rapport.ecartHt)} HT</strong></Text>
      <Heading as="h2">Prestations de l’attachement</Heading>
      {rapport.lignes.map((l, i) => <Text key={i}><strong>{l.libelle}</strong><br />{l.description}<br />{l.quantite} × {euro(l.prixUnitaire)} = {euro(l.totalHt)} HT</Text>)}
      <Heading as="h2">Constat / demande de régularisation</Heading>
      <Text style={{ whiteSpace: "pre-wrap" }}>{rapport.commentaire || "Merci de vérifier cet écart et de confirmer le montant à retenir avant facturation."}</Text>
      <Text>Seul le total HT de la commande est comparé ; ses lignes n’ont pas été rapprochées automatiquement.</Text>
      <Text>{COMPANY.email} · {COMPANY.telephone}</Text>
    </Container></Body>
  </Html>;
}
export const template = { component: Rapport, subject: (data) => `Rapport d’écart — ${data.rapport.numero} / ${data.rapport.attachement}`, displayName: "Rapport d’écart de commande" } satisfies TemplateEntry;