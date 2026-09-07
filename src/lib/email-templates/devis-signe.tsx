import * as React from "react";
import {
  Body,
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

export type DevisSigneData = {
  numero: string;
  client_nom: string;
  signataire_nom: string;
  signed_at: string;
  total_ttc?: number | null;
  objet?: string | null;
};

function DevisSigneEmail(data: DevisSigneData) {
  const date = new Date(data.signed_at).toLocaleString("fr-FR");
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Devis ${data.numero} accepté et signé par ${data.client_nom}`}</Preview>
      <Body style={{ backgroundColor: "#f5f7f6", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "24px auto", background: "#ffffff", padding: 24 }}>
          <Heading style={{ fontSize: 20, margin: "0 0 8px" }}>Devis accepté ✅</Heading>
          <Text style={{ fontSize: 14, color: "#334", margin: "0 0 16px" }}>
            Le devis <strong>{data.numero}</strong> vient d&apos;être signé en ligne.
          </Text>
          <Hr />
          <Section>
            <Text style={{ fontSize: 14, margin: "8px 0" }}>Client : <strong>{data.client_nom}</strong></Text>
            {data.objet ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>Objet : {data.objet}</Text>
            ) : null}
            <Text style={{ fontSize: 14, margin: "8px 0" }}>Signataire : {data.signataire_nom}</Text>
            <Text style={{ fontSize: 14, margin: "8px 0" }}>Date de signature : {date}</Text>
            {data.total_ttc ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>
                Montant : <strong>{Number(data.total_ttc).toFixed(2)} € TTC</strong>
              </Text>
            ) : null}
          </Section>
          <Hr />
          <Text style={{ fontSize: 12, color: "#667", margin: "12px 0 0" }}>
            {COMPANY.raisonSociale} — {COMPANY.siteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: DevisSigneEmail,
  displayName: "Notification interne — devis signé",
  to: COMPANY.email,
  subject: (data) => `Devis ${data['numero']} accepté et signé`,
  previewData: {
    numero: "D-2026-0278",
    client_nom: "Bruno GOHIN",
    signataire_nom: "Bruno Gohin",
    signed_at: new Date().toISOString(),
    total_ttc: 298.36,
    objet: "Installation borne de recharge",
  },
};
