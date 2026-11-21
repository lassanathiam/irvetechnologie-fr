import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY, euro } from "../company";

type Ligne = { client: string; ville: string | null; date: string | null; attNumero: string | null; montantHt: number; commande: string | null; factureNumero: string | null; envoyeLe: string | null; lien: string | null };
type Props = { donneur: string; date: string; message?: string; commandes: Ligne[]; receptions: Ligne[]; totalCommandes: number; totalReceptions: number };

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—");
const cellule = { border: "1px solid #d0d5dd", padding: "6px", fontSize: "12px", textAlign: "left" as const };

function RappelClient({ donneur, message, commandes = [], receptions = [], totalCommandes, totalReceptions }: Props) {
  return <Html lang="fr"><Head /><Preview>Rappel — chantiers en attente — {donneur}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#101828" }}><Container style={{ padding: "24px", maxWidth: "720px" }}>
      <Text>{COMPANY.raisonSociale} — Borne de l’Ouest<br />{COMPANY.qualifications}</Text>
      <Heading as="h1" style={{ fontSize: "20px" }}>Rappel — chantiers en attente</Heading>
      <Text>Bonjour {donneur},</Text>
      <Text>Sauf erreur de notre part, les chantiers ci-dessous, terminés, sont toujours en attente de votre part.</Text>
      {message ? <Text style={{ whiteSpace: "pre-wrap" }}>{message}</Text> : null}
      {commandes.length ? <Section>
        <Heading as="h2" style={{ fontSize: "15px", marginTop: "22px" }}>Commande attendue — {commandes.length} chantier(s) · {euro(totalCommandes)} HT</Heading>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={cellule}>Chantier</th><th style={cellule}>Date</th><th style={cellule}>Attachement</th><th style={cellule}>Envoyé le</th><th style={cellule}>Montant HT</th></tr></thead>
          <tbody>{commandes.map((l, i) => <tr key={i}>
            <td style={cellule}><strong>{l.client}</strong>{l.ville ? `, ${l.ville}` : ""}</td>
            <td style={cellule}>{dateFr(l.date)}</td>
            <td style={cellule}>{l.lien ? <a href={l.lien} style={{ color: "#00a86b", fontWeight: 700 }}>{l.attNumero}</a> : l.attNumero}</td>
            <td style={cellule}>{dateFr(l.envoyeLe)}</td>
            <td style={cellule}>{euro(l.montantHt)}</td>
          </tr>)}</tbody>
        </table>
        <Text>Merci de nous transmettre le bon de commande de chacun de ces chantiers.</Text>
      </Section> : null}
      {receptions.length ? <Section>
        <Heading as="h2" style={{ fontSize: "15px", marginTop: "22px" }}>Réception attendue — {receptions.length} chantier(s) · {euro(totalReceptions)} HT</Heading>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={cellule}>Chantier</th><th style={cellule}>Date</th><th style={cellule}>Commande</th><th style={cellule}>Facture</th><th style={cellule}>Montant HT</th></tr></thead>
          <tbody>{receptions.map((l, i) => <tr key={i}>
            <td style={cellule}><strong>{l.client}</strong>{l.ville ? `, ${l.ville}` : ""}</td>
            <td style={cellule}>{dateFr(l.date)}</td>
            <td style={cellule}>{l.commande || "—"}</td>
            <td style={cellule}>{l.factureNumero || "—"}</td>
            <td style={cellule}>{euro(l.montantHt)}</td>
          </tr>)}</tbody>
        </table>
        <Text>Merci de procéder à la réception de ces chantiers.</Text>
      </Section> : null}
      <Text style={{ marginTop: "22px" }}>Nous restons à votre disposition pour toute question.</Text>
      <Text>{COMPANY.email} · {COMPANY.telephone}</Text>
    </Container></Body>
  </Html>;
}
export const template = { component: RappelClient, subject: (data) => `Rappel — chantiers en attente — ${data["donneur"]} — ${data["date"]}`, displayName: "Rappel client (commandes / réceptions attendues)" } satisfies TemplateEntry;
