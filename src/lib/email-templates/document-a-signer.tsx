import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

function DocumentASignerEmail(data: { nom?: string; document: string; lien: string }) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Document à signer : ${data.document}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "24px auto", padding: 24 }}>
          <Heading style={{ fontSize: 20, margin: "0 0 12px", color: "#0f172a" }}>Document à signer</Heading>
          <Text style={{ fontSize: 14, color: "#334155" }}>Bonjour {data.nom || ""},</Text>
          <Text style={{ fontSize: 14, color: "#334155" }}>
            {COMPANY.raisonSociale} vous invite à consulter et signer en ligne le document « {data.document} ».
          </Text>
          <Button href={data.lien} style={{ background: "#1d4ed8", color: "#ffffff", padding: "12px 20px", borderRadius: 6, fontSize: 14 }}>
            Consulter et signer
          </Button>
          <Text style={{ fontSize: 12, color: "#64748b", marginTop: 24 }}>
            {COMPANY.raisonSociale} — {COMPANY.siteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: DocumentASignerEmail,
  displayName: "Document à signer (client)",
  subject: (d) => `Document à signer : ${d["document"]}`,
  previewData: { nom: "Jean Dupont", document: "Contrat d'entretien", lien: "https://www.irvetechnologie.fr/signer/x" },
};
