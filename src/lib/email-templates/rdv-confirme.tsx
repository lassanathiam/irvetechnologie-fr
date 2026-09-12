import * as React from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

export type RendezVousConfirmeData = {
  client_nom: string;
  date_debut: string;
  adresse?: string | null;
  cp_ville?: string | null;
  objet?: string | null;
};

function RendezVousConfirmeEmail(data: RendezVousConfirmeData) {
  const date = new Date(data.date_debut).toLocaleString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const objet = data.objet || "Intervention IRVE";
  const adresse = [data.adresse, data.cp_ville].filter(Boolean).join(", ");

  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Rendez-vous confirmé — ${data.client_nom}`}</Preview>
      <Body style={{ backgroundColor: "#f5f7f6", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container
          style={{ maxWidth: 560, margin: "24px auto", background: "#ffffff", padding: 24 }}
        >
          <Heading style={{ fontSize: 20, margin: "0 0 8px" }}>Rendez-vous confirmé ✅</Heading>
          <Text style={{ fontSize: 14, color: "#334", margin: "0 0 16px" }}>
            Bonjour <strong>{data.client_nom}</strong>, votre rendez-vous est bien confirmé.
          </Text>
          <Hr />
          <Section>
            <Text style={{ fontSize: 14, margin: "8px 0" }}>Intervention : {objet}</Text>
            <Text style={{ fontSize: 14, margin: "8px 0" }}>Date et heure : {date}</Text>
            {adresse ? <Text style={{ fontSize: 14, margin: "8px 0" }}>Adresse : {adresse}</Text> : null}
          </Section>
          <Hr />
          <Text style={{ fontSize: 13, color: "#334", margin: "12px 0 0" }}>
            Besoin de nous joindre ? {COMPANY.telephone} · {COMPANY.telephone2}
          </Text>
          <Text style={{ fontSize: 12, color: "#667", margin: "8px 0 0" }}>
            {COMPANY.raisonSociale} — {COMPANY.siteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: RendezVousConfirmeEmail,
  displayName: "Confirmation de rendez-vous",
  subject: (data) => `Rendez-vous confirmé — ${data["client_nom"]}`,
  previewData: {
    client_nom: "Emilie Gaillard",
    date_debut: new Date().toISOString(),
    adresse: "8 la Plumante",
    cp_ville: "44660 Rougé",
    objet: "Installation borne Schneider Charge 7,4 kW",
  },
};
