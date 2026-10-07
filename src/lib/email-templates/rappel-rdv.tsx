import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

type Ligne = { heure: string; client: string; lieu: string; technicien: string };

function RappelRdvEmail(data: { date: string; lignes: Ligne[] }) {
  const lignes = data.lignes ?? [];
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`${lignes.length} rendez-vous demain`}</Preview>
      <Body style={{ backgroundColor: "#f5f7f6", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "24px auto", background: "#ffffff", padding: 24 }}>
          <Heading style={{ fontSize: 20, margin: "0 0 8px" }}>Rendez-vous de demain — {data.date}</Heading>
          {lignes.map((l, i) => (
            <Text key={i} style={{ fontSize: 14, margin: "6px 0" }}>
              <strong>{l.heure}</strong> — {l.client}
              {l.lieu ? ` · ${l.lieu}` : ""}
              {l.technicien ? ` · ${l.technicien}` : ""}
            </Text>
          ))}
          <Text style={{ fontSize: 12, color: "#667", margin: "16px 0 0" }}>
            {COMPANY.raisonSociale} — rappel automatique
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: RappelRdvEmail,
  displayName: "Rappel des rendez-vous du lendemain",
  subject: (d) => `Rappel : ${(d["lignes"] ?? []).length} rendez-vous demain (${d["date"]})`,
  previewData: { date: "jeudi 8 octobre", lignes: [{ heure: "09:00", client: "Dupont", lieu: "Rennes", technicien: "Altaj" }] },
};
