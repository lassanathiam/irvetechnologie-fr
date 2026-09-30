import * as React from "react";
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

type Data = {
  modele_nom: string;
  donneur_ordre?: string;
  client_nom?: string;
  adresse?: string;
  rapport_url: string;
  zip_url?: string | null;
};

const btn = {
  display: "inline-block",
  backgroundColor: "#00a86b",
  color: "#ffffff",
  borderRadius: 8,
  padding: "12px 20px",
  fontSize: 15,
  fontWeight: "bold",
  textDecoration: "none",
  margin: "6px 0",
} as const;

function RapportDonneurEmail(data: Data) {
  const ligne = (label: string, v?: string | null) =>
    v ? <Text style={{ fontSize: 14, margin: "4px 0" }}><strong>{label} :</strong> {v}</Text> : null;
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Retour de travaux — ${data.client_nom ?? ""} — rapport signé disponible`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
        <Container style={{ padding: "24px", maxWidth: 580 }}>
          <Text style={{ fontSize: 13, color: "#00a86b", fontWeight: "bold", margin: 0 }}>Borne de l&apos;Ouest — {COMPANY.raisonSociale}</Text>
          <Heading style={{ fontSize: 20, margin: "8px 0 16px" }}>Retour de travaux : intervention terminée</Heading>
          <Text style={{ fontSize: 14, lineHeight: "22px" }}>Bonjour,</Text>
          <Text style={{ fontSize: 14, lineHeight: "22px" }}>
            Nous vous informons que l&apos;intervention ci-dessous a été réalisée. Le rapport ({data.modele_nom}) a été signé par le client et par notre technicien.
          </Text>
          <Section style={{ backgroundColor: "#f7faf9", border: "1px solid #dfe6e3", borderRadius: 6, padding: "12px 16px" }}>
            {ligne("Client final", data.client_nom)}
            {ligne("Adresse du chantier", data.adresse)}
            {ligne("Document", data.modele_nom)}
          </Section>
          <Section style={{ padding: "16px 0" }}>
            <Link href={data.rapport_url} style={btn}>Consulter et imprimer le rapport signé</Link>
            <br />
            {data.zip_url ? <Link href={data.zip_url} style={{ ...btn, backgroundColor: "#0f1a17" }}>Télécharger toutes les photos (ZIP)</Link> : null}
          </Section>
          <Text style={{ fontSize: 14, lineHeight: "22px" }}>
            Nous restons à votre disposition pour tout complément d&apos;information.
          </Text>
          <Text style={{ fontSize: 14, lineHeight: "22px" }}>Cordialement,<br />L&apos;équipe Borne de l&apos;Ouest</Text>
          <Hr />
          <Text style={{ fontSize: 11, color: "#667", lineHeight: "17px" }}>
            {COMPANY.raisonSociale} · {COMPANY.adresse}, {COMPANY.cpVille} · {COMPANY.telephone} · {COMPANY.email}<br />
            {COMPANY.qualifications}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: RapportDonneurEmail,
  displayName: "Rapport donneur d'ordre signé",
  subject: (d) => `Retour de travaux — ${d["client_nom"] ?? ""} — ${d["adresse"] ?? ""}`,
  previewData: {
    modele_nom: "Rapport d'intervention TotalEnergies",
    donneur_ordre: "TotalEnergies",
    client_nom: "Jean Martin",
    adresse: "12 rue des Lilas, 44000 Nantes",
    rapport_url: "https://www.irvetechnologie.fr/rapport-donneur/xxx",
    zip_url: "https://www.irvetechnologie.fr/api/public/retour/xxx.zip",
  },
};
