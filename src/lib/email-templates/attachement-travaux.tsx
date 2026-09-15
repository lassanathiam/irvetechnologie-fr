import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

type Props = {
  client_nom: string;
  numero: string;
  numero_ticket: string;
  numero_affaire?: string | null;
  bon_commande?: string | null;
  objet?: string | null;
  total_ht: number;
  autoliquidation: boolean;
  validation_requise: boolean;
  message?: string | null;
  lien: string;
};

const euro = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);

export function AttachementTravauxEmail(data: Props) {
  return <Html lang="fr"><Head /><Preview>{`Attachement de travaux — Ticket ${data.numero_ticket}`}</Preview>
    <Body style={{ backgroundColor: "#eef3f2", fontFamily: "Arial, sans-serif", margin: 0, padding: "32px 0" }}>
      <Container style={{ backgroundColor: "#ffffff", maxWidth: 620, margin: "0 auto", border: "1px solid #d9e2df" }}>
        <Section style={{ backgroundColor: "#071827", padding: "24px 32px" }}>
          <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: 0 }}>IRVE Technologie</Text>
          <Text style={{ color: "#55d6b0", fontSize: 12, margin: "5px 0 0" }}>{COMPANY.qualifications}</Text>
        </Section>
        <Section style={{ padding: "28px 32px" }}>
          <Heading as="h1" style={{ color: "#10231f", fontSize: 22, margin: "0 0 14px" }}>Attachement de travaux</Heading>
          <Text style={{ color: "#10231f", fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Ticket intervention : {data.numero_ticket}</Text>
          <Text style={{ color: "#5d6d68", fontSize: 14, lineHeight: "22px" }}>Bonjour {data.client_nom},<br />{data.message || `Vous trouverez ci-joint notre attachement de travaux ${data.numero}.`}</Text>
          <Text style={{ color: "#5d6d68", fontSize: 13, lineHeight: "21px" }}>
            {data.objet ? `Objet : ${data.objet}\n` : ""}{data.numero_affaire ? `Affaire : ${data.numero_affaire}\n` : ""}{data.bon_commande ? `Bon de commande : ${data.bon_commande}\n` : ""}Montant : {euro(data.total_ht)} HT{data.autoliquidation ? " — TVA autoliquidée" : ""}
          </Text>
          <Section style={{ textAlign: "center", padding: "18px 0" }}>
            <a href={data.lien} style={{ backgroundColor: "#00a86b", color: "#ffffff", fontWeight: 700, padding: "13px 24px", textDecoration: "none", display: "inline-block" }}>
              {data.validation_requise ? "Consulter et valider l’attachement" : "Consulter l’attachement"}
            </a>
          </Section>
          <Text style={{ color: "#5d6d68", fontSize: 11, lineHeight: "18px" }}>{COMPANY.raisonSociale} · {COMPANY.adresse}, {COMPANY.cpVille}<br />{COMPANY.email} · {COMPANY.telephone} · {COMPANY.telephone2}</Text>
        </Section>
      </Container>
    </Body>
  </Html>;
}

export const template: TemplateEntry = {
  component: AttachementTravauxEmail,
  displayName: "Attachement de travaux fibre",
  subject: (data) => `IRVE Technologie — Attachement de travaux — Ticket ${data["numero_ticket"]}`,
};
