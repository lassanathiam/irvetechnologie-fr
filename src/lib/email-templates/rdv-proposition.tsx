import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

export type RdvPropositionData = {
  client_nom: string;
  date_debut: string;
  duree_min?: number | null;
  adresse?: string | null;
  cp_ville?: string | null;
  objet?: string | null;
  lien: string;
};

function RdvPropositionEmail(data: RdvPropositionData) {
  const date = new Date(data.date_debut).toLocaleString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const adresse = [data.adresse, data.cp_ville].filter(Boolean).join(", ");
  const duree = data.duree_min ? `${Math.round(data.duree_min / 60)} h environ` : null;

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{`Proposition de rendez-vous — ${date}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "24px auto", padding: "24px 25px" }}>
          <Heading style={{ fontSize: 20, margin: "0 0 8px", color: "#101a33" }}>
            Proposition de rendez-vous
          </Heading>
          <Text style={{ fontSize: 14, color: "#333", margin: "0 0 16px" }}>
            Bonjour {data.client_nom}, voici la date que nous vous proposons pour votre
            intervention. Merci de la confirmer en un clic.
          </Text>
          <Hr />
          <Section>
            {data.objet ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>Intervention : {data.objet}</Text>
            ) : null}
            <Text style={{ fontSize: 15, margin: "8px 0", fontWeight: "bold" }}>{date}</Text>
            {duree ? <Text style={{ fontSize: 14, margin: "8px 0" }}>Durée : {duree}</Text> : null}
            {adresse ? <Text style={{ fontSize: 14, margin: "8px 0" }}>Adresse : {adresse}</Text> : null}
          </Section>
          <Section style={{ margin: "20px 0" }}>
            <Button
              href={data.lien}
              style={{
                backgroundColor: "#1d4ed8",
                color: "#ffffff",
                borderRadius: 8,
                padding: "12px 20px",
                fontSize: 15,
                fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              Confirmer ou modifier ce rendez-vous
            </Button>
          </Section>
          <Text style={{ fontSize: 13, color: "#555", margin: "8px 0 0" }}>
            Si le créneau ne vous convient pas, la même page vous permet de nous indiquer vos
            disponibilités.
          </Text>
          <Hr />
          <Text style={{ fontSize: 13, color: "#333", margin: "12px 0 0" }}>
            Une question ? {COMPANY.telephone} · {COMPANY.telephone2}
          </Text>
          <Text style={{ fontSize: 12, color: "#666", margin: "8px 0 0" }}>
            Borne de l&apos;Ouest — marque de {COMPANY.raisonSociale} · {COMPANY.adresse},{" "}
            {COMPANY.cpVille} · {COMPANY.site}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: RdvPropositionEmail,
  displayName: "Proposition de rendez-vous",
  subject: (data) => `Proposition de rendez-vous — ${data["client_nom"] ?? "votre installation"}`,
  previewData: {
    client_nom: "Emilie Gaillard",
    date_debut: new Date().toISOString(),
    duree_min: 240,
    adresse: "8 la Plumante",
    cp_ville: "44660 Rougé",
    objet: "Installation borne 7,4 kW",
    lien: "https://www.irvetechnologie.fr/rdv/exemple",
  },
};
