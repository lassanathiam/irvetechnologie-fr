import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

type Ligne = { client: string; numero: string; total_ht: number; lien: string };
type Props = { destinataire: string; semaine: string; message: string; lignes: Ligne[]; total_ht: number };

const euro = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);

export function AttachementsSemaineEmail(data: Props) {
  return <Html lang="fr"><Head /><Preview>{`Attachements de travaux — ${data.semaine}`}</Preview>
    <Body style={{ backgroundColor: "#eef3f2", fontFamily: "Arial, sans-serif", margin: 0, padding: "32px 0" }}>
      <Container style={{ backgroundColor: "#ffffff", maxWidth: 620, margin: "0 auto", border: "1px solid #d9e2df" }}>
        <Section style={{ backgroundColor: "#071827", padding: "24px 32px" }}>
          <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: 0 }}>IRVE Technologie</Text>
          <Text style={{ color: "#55d6b0", fontSize: 12, margin: "5px 0 0" }}>{COMPANY.qualifications}</Text>
        </Section>
        <Section style={{ padding: "28px 32px" }}>
          <Heading as="h1" style={{ color: "#10231f", fontSize: 22, margin: "0 0 14px" }}>Attachements de travaux — {data.semaine}</Heading>
          <Text style={{ color: "#5d6d68", fontSize: 14, lineHeight: "22px" }}>Bonjour {data.destinataire},<br />{data.message}</Text>
          {(data.lignes ?? []).map((l) => <Section key={l.numero} style={{ borderTop: "1px solid #e3e9e7", padding: "10px 0" }}>
            <Text style={{ color: "#10231f", fontSize: 14, fontWeight: 700, margin: 0 }}>{l.client} — {euro(l.total_ht)} HT</Text>
            <Text style={{ fontSize: 13, margin: "4px 0 0" }}><a href={l.lien} style={{ color: "#00a86b", fontWeight: 700 }}>Consulter et valider l’attachement {l.numero} — {l.client}</a></Text>
          </Section>)}
          <Text style={{ color: "#10231f", fontSize: 14, fontWeight: 700, borderTop: "1px solid #e3e9e7", paddingTop: 10 }}>Total de la semaine : {euro(data.total_ht)} HT</Text>
          <Text style={{ color: "#5d6d68", fontSize: 11, lineHeight: "18px" }}>{COMPANY.raisonSociale} · {COMPANY.adresse}, {COMPANY.cpVille}<br />{COMPANY.email} · {COMPANY.telephone}</Text>
        </Section>
      </Container>
    </Body>
  </Html>;
}

export const template: TemplateEntry = {
  component: AttachementsSemaineEmail,
  displayName: "Attachements de la semaine",
  subject: (data) => `IRVE Technologie — Attachements de travaux — ${data["semaine"]}`,
};
