import * as React from "react";
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

export type ChantierEchecData = {
  client_nom: string;
  adresse?: string | null;
  partenaire?: string | null;
  motif: string;
  message: string;
  date: string;
  nb_photos?: number | null;
  zip_url?: string | null;
};

function ChantierEchecEmail(data: ChantierEchecData) {
  const date = new Date(data.date).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Chantier non réalisé — ${data.client_nom} — ${data.motif}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "24px auto", background: "#ffffff", padding: 24 }}>
          <Heading style={{ fontSize: 20, margin: "0 0 8px", color: "#b91c1c" }}>Chantier non réalisé</Heading>
          <Text style={{ fontSize: 14, color: "#334", margin: "0 0 16px" }}>
            L&apos;intervention chez <strong>{data.client_nom}</strong> n&apos;a pas pu être réalisée.
          </Text>
          <Hr />
          <Section>
            <Text style={{ fontSize: 14, margin: "8px 0" }}><strong>Motif : {data.motif}</strong></Text>
            {data.adresse ? <Text style={{ fontSize: 14, margin: "8px 0" }}>Adresse : {data.adresse}</Text> : null}
            {data.partenaire ? <Text style={{ fontSize: 14, margin: "8px 0" }}>Donneur d&apos;ordre : {data.partenaire}</Text> : null}
            <Text style={{ fontSize: 14, margin: "8px 0" }}>Constat du : {date}</Text>
            <Text style={{ fontSize: 14, margin: "12px 0", whiteSpace: "pre-line", background: "#fef2f2", padding: 12, borderRadius: 6 }}>{data.message}</Text>
          </Section>
          {data.zip_url ? (
            <Section style={{ margin: "16px 0" }}>
              <Link href={data.zip_url} style={{ display: "inline-block", backgroundColor: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "12px 20px", fontSize: 15, fontWeight: "bold", textDecoration: "none" }}>
                Voir les photos du chantier{data.nb_photos ? ` (${data.nb_photos})` : ""}
              </Link>
              <Text style={{ fontSize: 12, color: "#667", margin: "10px 0 0" }}>Dossier photos en un seul fichier. Lien valable 30 jours.</Text>
            </Section>
          ) : null}
          <Text style={{ fontSize: 14, color: "#334", margin: "12px 0" }}>
            Dès que la situation est régularisée, nous reprogrammons l&apos;intervention.
          </Text>
          <Hr />
          <Text style={{ fontSize: 13, color: "#334", margin: "12px 0 0" }}>Une question ? {COMPANY.telephone} · {COMPANY.telephone2}</Text>
          <Text style={{ fontSize: 12, color: "#667", margin: "8px 0 0" }}>{COMPANY.raisonSociale} — Qualifications IRVE P1 · P2 · P3 — {COMPANY.siteUrl}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: ChantierEchecEmail,
  displayName: "Chantier non réalisé — donneur d'ordre",
  subject: (data) => `Chantier non réalisé — ${data["client_nom"]} — ${data["motif"]}`,
  previewData: {
    client_nom: "M. BORNIER",
    adresse: "12 rue des Lilas, 44000 Nantes",
    partenaire: "ENSIO",
    motif: "Installation pas aux normes",
    message: "Installation existante non conforme, mise en conformité nécessaire.",
    date: new Date().toISOString(),
    nb_photos: 4,
    zip_url: "https://www.irvetechnologie.fr/api/public/retour/exemple.zip",
  },
};
