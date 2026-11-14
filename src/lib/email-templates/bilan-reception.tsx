import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { CATEGORIES_BILAN, categorieBilan, type LigneBilan, type ResumeBilan } from "../bilan-reception";
import { COMPANY, euro } from "../company";

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—");
const cellule = { border: "1px solid #d0d5dd", padding: "6px", fontSize: "12px", textAlign: "left" as const };

function Bilan({ donneur, date, lignes, resume, message }: { donneur: string; date: string; lignes: LigneBilan[]; resume: ResumeBilan; message?: string }) {
  return <Html lang="fr"><Head /><Preview>Bilan des chantiers — {donneur}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#101828" }}><Container style={{ padding: "24px", maxWidth: "720px" }}>
      <Text>{COMPANY.raisonSociale} — Borne de l’Ouest<br />{COMPANY.qualifications}</Text>
      <Heading as="h1" style={{ fontSize: "20px" }}>Bilan des chantiers — {donneur}</Heading>
      <Text>Arrêté au {date}.</Text>
      {message ? <Text style={{ whiteSpace: "pre-wrap" }}>{message}</Text> : null}
      <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
        <tr><td style={cellule}>Attachements</td><td style={cellule}><strong>{resume.attachements}</strong> · {euro(resume.totalHt)} HT</td></tr>
        <tr><td style={cellule}>Chantiers</td><td style={cellule}><strong>{resume.chantiers}</strong></td></tr>
        <tr><td style={cellule}>Chantiers réceptionnés</td><td style={cellule}><strong>{resume.receptionnes}</strong></td></tr>
        <tr><td style={cellule}>Chantiers non réceptionnés</td><td style={cellule}><strong>{resume.nonReceptionnes}</strong></td></tr>
        <tr><td style={cellule}>Commandes reçues</td><td style={cellule}><strong>{resume.commandesRecues}</strong></td></tr>
        <tr><td style={cellule}>Commandes manquantes</td><td style={cellule}><strong>{resume.commandesManquantes}</strong></td></tr>
      </tbody></table>
      {CATEGORIES_BILAN.map((cat) => {
        const rs = lignes.filter((l) => categorieBilan(l) === cat.cle);
        if (!rs.length) return null;
        return <div key={cat.cle}>
          <Heading as="h2" style={{ fontSize: "15px", marginTop: "22px" }}>{cat.label} — {rs.length} · {euro(resume.parCategorie[cat.cle].ht)} HT</Heading>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={cellule}>Attachement</th><th style={cellule}>Chantier</th><th style={cellule}>Date</th><th style={cellule}>Montant HT</th><th style={cellule}>Commande</th><th style={cellule}>Réceptionné</th></tr></thead>
            <tbody>{rs.map((l) => <tr key={l.id}>
              <td style={cellule}>{l.numero}</td>
              <td style={cellule}>{l.chantiers.map((c) => [c.nom, c.ville].filter(Boolean).join(", ")).join(" / ") || l.objet || "—"}</td>
              <td style={cellule}>{l.chantiers.map((c) => dateFr(c.date)).join(" / ") || "—"}</td>
              <td style={cellule}>{euro(l.totalHt)}</td>
              <td style={cellule}>{l.commande || "—"}</td>
              <td style={cellule}>{l.chantiers.map((c) => dateFr(c.receptionneLe)).join(" / ") || "—"}</td>
            </tr>)}</tbody>
          </table>
        </div>;
      })}
      <Text style={{ marginTop: "22px" }}>Merci de nous retourner les commandes manquantes et de confirmer la réception des chantiers en attente.</Text>
      <Text>{COMPANY.email} · {COMPANY.telephone}</Text>
    </Container></Body>
  </Html>;
}
export const template = { component: Bilan, subject: (data) => `Bilan des chantiers — ${data.donneur} — ${data.date}`, displayName: "Bilan de réception des chantiers" } satisfies TemplateEntry;
