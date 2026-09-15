import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

type Item = {
  libelle: string;
  description?: string | null;
  quantite: number;
  prix_unitaire: number;
  tva: number;
};

export type DevisEmailData = {
  type: "devis" | "facture";
  numero: string;
  client_nom: string;
  objet?: string | null;
  date_emission: string;
  date_limite: string;
  message?: string | null;
  /** Lien sécurisé de consultation / téléchargement / signature en ligne. */
  lien?: string | null;
  remise_pct: number;
  total_ht_brut: number;
  total_remise: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  acompte_pct: number;
  conditions_paiement?: string | null;
  numero_ticket?: string | null;
  numero_affaire?: string | null;
  bon_commande?: string | null;
  autoliquidation?: boolean;
  items: Item[];
};

const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);
const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );

const ink = "#0f1a17";
const muted = "#5d6d68";
const accent = "#00a86b";

export function DevisClientEmail(data: DevisEmailData) {
  const isFacture = data.type === "facture";
  const titre = isFacture ? "Facture" : "Devis";
  const items = data.items ?? [];
  const acompte = Math.round(data.total_ttc * ((data.acompte_pct || 0) / 100) * 100) / 100;

  return (
    <Html lang="fr">
      <Head />
      <Preview>{`${titre} ${data.numero} — ${euro(data.total_ttc)} TTC`}</Preview>
      <Body style={{ backgroundColor: "#f2f5f4", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", maxWidth: 620, margin: "0 auto", borderRadius: 4, overflow: "hidden", border: "1px solid #dfe6e3" }}>
          <Section style={{ backgroundColor: ink, padding: "24px 32px" }}>
            <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              Borne de l&apos;Ouest
            </Text>
            <Text style={{ color: accent, fontSize: 11, margin: "4px 0 0", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {COMPANY.raisonSociale} · {titre} {data.numero}
            </Text>
          </Section>

          <Section style={{ padding: "28px 32px 8px" }}>
            <Heading as="h1" style={{ color: ink, fontSize: 22, margin: "0 0 8px" }}>
              Bonjour {data.client_nom},
            </Heading>
            <Text style={{ color: muted, fontSize: 14, lineHeight: "22px", margin: 0 }}>
              {data.message
                ? data.message
                : isFacture
                  ? `Veuillez trouver ci-dessous le détail de votre facture ${data.numero}, à régler avant le ${dateFr(data.date_limite)}.`
                  : `Voici le détail de votre devis ${data.numero}${data.objet ? ` — ${data.objet}` : ""}. Il est valable jusqu'au ${dateFr(data.date_limite)}.`}
            </Text>
          </Section>

          {data.lien && (
            <Section style={{ padding: "20px 32px 4px", textAlign: "center" as const }}>
              <a
                href={data.lien}
                style={{
                  display: "inline-block",
                  backgroundColor: accent,
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  padding: "13px 26px",
                  borderRadius: 4,
                }}
              >
                {isFacture ? "Voir et télécharger la facture" : "Voir et accepter le devis"}
              </a>
              <Text style={{ color: muted, fontSize: 11, margin: "10px 0 0" }}>
                Lien personnel — consultation, téléchargement PDF et acceptation en ligne.
              </Text>
            </Section>
          )}

          <Section style={{ padding: "16px 32px" }}>
            {(data.numero_ticket || data.numero_affaire || data.bon_commande) && (
              <Text style={{ color: ink, fontSize: 12, lineHeight: "20px", margin: "0 0 12px" }}>
                {data.numero_ticket ? `Ticket : ${data.numero_ticket}\n` : ""}
                {data.numero_affaire ? `Affaire : ${data.numero_affaire}\n` : ""}
                {data.bon_commande ? `Bon de commande : ${data.bon_commande}` : ""}
              </Text>
            )}
            {items.map((item, i) => (
              <Row key={i} style={{ borderBottom: "1px solid #eef2f1" }}>
                <Column style={{ padding: "10px 0" }}>
                  <Text style={{ color: ink, fontSize: 13, fontWeight: 600, margin: 0 }}>{item.libelle}</Text>
                  <Text style={{ color: muted, fontSize: 11, margin: "2px 0 0" }}>
                    {item.quantite} × {euro(item.prix_unitaire)} — TVA {item.tva} %
                  </Text>
                </Column>
                <Column align="right" style={{ padding: "10px 0", whiteSpace: "nowrap" }}>
                  <Text style={{ color: ink, fontSize: 13, margin: 0 }}>
                    {euro(item.quantite * item.prix_unitaire)}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Section style={{ padding: "0 32px 8px" }}>
            <Line label="Total HT" value={euro(data.total_ht_brut)} />
            {data.remise_pct > 0 && (
              <Line label={`Remise ${data.remise_pct} %`} value={`- ${euro(data.total_remise)}`} />
            )}
            <Line label="Total HT net" value={euro(data.total_ht)} />
            <Line label="TVA" value={euro(data.total_tva)} />
            {data.autoliquidation && (
              <Text style={{ color: ink, fontSize: 11, fontWeight: 700, lineHeight: "18px" }}>
                Autoliquidation — TVA due par le preneur (article 283-2 nonies du CGI).
              </Text>
            )}
            <Hr style={{ borderColor: "#dfe6e3", margin: "12px 0" }} />
            <Row>
              <Column>
                <Text style={{ color: ink, fontSize: 15, fontWeight: 700, margin: 0 }}>Total TTC</Text>
              </Column>
              <Column align="right">
                <Text style={{ color: accent, fontSize: 20, fontWeight: 700, margin: 0 }}>
                  {euro(data.total_ttc)}
                </Text>
              </Column>
            </Row>
            {acompte > 0 && (
              <Text style={{ color: muted, fontSize: 12, margin: "10px 0 0" }}>
                Acompte à la commande ({data.acompte_pct} %) : <strong>{euro(acompte)}</strong>
              </Text>
            )}
          </Section>

          {data.conditions_paiement && (
            <Section style={{ padding: "8px 32px 0" }}>
              <Text style={{ color: muted, fontSize: 11, lineHeight: "18px", margin: 0 }}>
                {data.conditions_paiement}
              </Text>
            </Section>
          )}

          <Section style={{ padding: "24px 32px", backgroundColor: "#f7faf9", marginTop: 20 }}>
            <Text style={{ color: muted, fontSize: 11, lineHeight: "18px", margin: 0 }}>
              {COMPANY.raisonSociale} ({COMPANY.forme}) · {COMPANY.adresse}, {COMPANY.cpVille}
              <br />
              {COMPANY.email} · {COMPANY.telephone} · {COMPANY.telephone2} · SIRET {COMPANY.siret} · TVA {COMPANY.tva}
              <br />
              {COMPANY.qualifications}
              <br />
              Émis le {dateFr(data.date_emission)}.
            </Text>
            <Text style={{ color: muted, fontSize: 11, lineHeight: "18px", margin: "12px 0 0" }}>
              Si quelqu'un de votre entourage a besoin d'installer ou d'entretenir sa borne de recharge,
              partagez notre lien : {COMPANY.siteUrl}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Row>
      <Column>
        <Text style={{ color: muted, fontSize: 12, margin: "4px 0" }}>{label}</Text>
      </Column>
      <Column align="right">
        <Text style={{ color: ink, fontSize: 12, margin: "4px 0" }}>{value}</Text>
      </Column>
    </Row>
  );
}

export const template: TemplateEntry = {
  component: DevisClientEmail,
  displayName: "Devis / Facture client",
  subject: (data) =>
    data['type'] === "facture"
      ? `Facture ${data['numero']} — Borne de l'Ouest`
      : `Votre devis ${data['numero']} — Borne de l'Ouest`,
  previewData: {
    type: "devis",
    numero: "D-2026-0279",
    client_nom: "Martin Dupont",
    objet: "Installation borne de recharge 7,4 kW",
    date_emission: new Date().toISOString().slice(0, 10),
    date_limite: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    remise_pct: 10,
    total_ht_brut: 292.5,
    total_remise: 29.25,
    total_ht: 263.25,
    total_tva: 52.65,
    total_ttc: 315.9,
    acompte_pct: 30,
    conditions_paiement: "Acompte de 30 % à la commande, solde à la fin des travaux.",
    items: [
      { libelle: "Installation borne 7,4 kW", quantite: 1, prix_unitaire: 250, tva: 20 },
      { libelle: "Câble RO2V 3G6 (ml)", quantite: 5, prix_unitaire: 8.5, tva: 20 },
    ],
  },
};
