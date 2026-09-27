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
  backgroundColor: "#1d4ed8",
  color: "#ffffff",
  borderRadius: 8,
  padding: "12px 20px",
  fontSize: 15,
  fontWeight: "bold",
  textDecoration: "none",
  margin: "6px 0",
} as const;

function RapportDonneurEmail(data: Data) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`${data.modele_nom} signé — ${data.client_nom ?? ""}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
        <Container style={{ padding: "24px", maxWidth: 560 }}>
          <Heading style={{ fontSize: 20 }}>{data.modele_nom} signé</Heading>
          <Section>
            {data.client_nom ? <Text style={{ fontSize: 14, margin: "6px 0" }}>Client : {data.client_nom}</Text> : null}
            {data.adresse ? <Text style={{ fontSize: 14, margin: "6px 0" }}>Adresse : {data.adresse}</Text> : null}
            {data.donneur_ordre ? <Text style={{ fontSize: 14, margin: "6px 0" }}>Donneur d&apos;ordre : {data.donneur_ordre}</Text> : null}
          </Section>
          <Hr />
          <Section>
            <Link href={data.rapport_url} style={btn}>Consulter et imprimer le rapport</Link>
            <br />
            {data.zip_url ? <Link href={data.zip_url} style={btn}>Télécharger les photos (ZIP)</Link> : null}
          </Section>
          <Hr />
          <Text style={{ fontSize: 12, color: "#667" }}>
            Intervention réalisée par {COMPANY.raisonSociale} — {COMPANY.telephone}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: RapportDonneurEmail,
  displayName: "Rapport donneur d'ordre signé",
  subject: (d) => `${d["modele_nom"]} signé — ${d["client_nom"] ?? ""}`,
  previewData: {
    modele_nom: "Rapport d'intervention TotalEnergies",
    donneur_ordre: "TotalEnergies",
    client_nom: "Jean Martin",
    adresse: "12 rue des Lilas, 44000 Nantes",
    rapport_url: "https://www.irvetechnologie.fr/rapport-donneur/xxx",
    zip_url: "https://www.irvetechnologie.fr/api/public/retour/xxx.zip",
  },
};
