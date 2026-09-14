import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

export type ChantierTermineData = {
  client_nom: string;
  adresse?: string | null;
  objet?: string | null;
  partenaire?: string | null;
  termine_at: string;
  duree_min?: number | null;
  metrage_inclus_m?: number | null;
  metrage_reel_m?: number | null;
  supplement_m?: number | null;
  observations?: string | null;
  delestage?: boolean | null;
  photos?: { url: string; libelle: string }[] | null;
  /** Lien de téléchargement du dossier photos complet (ZIP). */
  zip_url?: string | null;
};

const dureeFr = (min?: number | null) => {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
};

function ChantierTermineEmail(data: ChantierTermineData) {
  const date = new Date(data.termine_at).toLocaleString("fr-FR");
  const duree = dureeFr(data.duree_min);
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Chantier terminé — ${data.client_nom}`}</Preview>
      <Body style={{ backgroundColor: "#f5f7f6", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container
          style={{ maxWidth: 560, margin: "24px auto", background: "#ffffff", padding: 24 }}
        >
          <Heading style={{ fontSize: 20, margin: "0 0 8px" }}>Chantier terminé ✅</Heading>
          <Text style={{ fontSize: 14, color: "#334", margin: "0 0 16px" }}>
            L&apos;intervention chez <strong>{data.client_nom}</strong> est terminée.
          </Text>
          <Hr />
          <Section>
            {data.objet ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>Objet : {data.objet}</Text>
            ) : null}
            {data.adresse ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>Adresse : {data.adresse}</Text>
            ) : null}
            {data.partenaire ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>
                Donneur d&apos;ordre : {data.partenaire}
              </Text>
            ) : null}
            <Text style={{ fontSize: 14, margin: "8px 0" }}>Fin de chantier : {date}</Text>
            {duree ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>Durée sur site : {duree}</Text>
            ) : null}
            {data.metrage_reel_m != null ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>
                Câble posé : {data.metrage_reel_m} m (inclus : {data.metrage_inclus_m ?? 5} m)
                {data.supplement_m ? ` — soit ${data.supplement_m} m en plus` : ""}
              </Text>
            ) : null}
            {data.delestage ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>Délestage mis en place : oui</Text>
            ) : null}
            {data.observations ? (
              <Text style={{ fontSize: 14, margin: "8px 0" }}>Observations : {data.observations}</Text>
            ) : null}
          </Section>
          {data.zip_url ? (
            <>
              <Hr />
              <Section style={{ margin: "16px 0" }}>
                <Text style={{ fontSize: 14, fontWeight: "bold", margin: "8px 0" }}>
                  Photos de fin d&apos;intervention
                </Text>
                <Link
                  href={data.zip_url}
                  style={{
                    display: "inline-block",
                    backgroundColor: "#1d4ed8",
                    color: "#ffffff",
                    borderRadius: 8,
                    padding: "12px 20px",
                    fontSize: 15,
                    fontWeight: "bold",
                    textDecoration: "none",
                  }}
                >
                  Télécharger le dossier photos (ZIP)
                </Link>
                <Text style={{ fontSize: 12, color: "#667", margin: "10px 0 0" }}>
                  Un seul fichier contenant toutes les photos du chantier. Lien valable 30 jours.
                </Text>
              </Section>
            </>
          ) : null}

          <Hr />
          <Text style={{ fontSize: 13, color: "#334", margin: "12px 0 0" }}>
            Une question ? {COMPANY.telephone} · {COMPANY.telephone2}
          </Text>
          <Text style={{ fontSize: 12, color: "#667", margin: "8px 0 0" }}>
            {COMPANY.raisonSociale} — Qualifications IRVE P1 · P2 · P3 — {COMPANY.siteUrl}
          </Text>
          <Text style={{ fontSize: 12, color: "#667", margin: "8px 0 0" }}>
            Quelqu&apos;un de votre entourage a besoin d&apos;installer ou d&apos;entretenir sa
            borne de recharge ? Merci de partager notre lien : {COMPANY.siteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template: TemplateEntry = {
  component: ChantierTermineEmail,
  displayName: "Chantier terminé — client / partenaire",
  subject: (data) => `Chantier terminé — ${data['client_nom']}`,
  previewData: {
    client_nom: "Cindy JAVAUT",
    adresse: "12 rue des Lilas, 44000 Nantes",
    objet: "Pose borne 7,4 kW",
    partenaire: "Pure Énergies",
    termine_at: new Date().toISOString(),
    duree_min: 185,
    metrage_inclus_m: 5,
    metrage_reel_m: 13,
    supplement_m: 8,
    observations: "Délestage paramétré, essais conformes.",
    delestage: true,
    photos: [{ url: "https://example.com/photo.jpg", libelle: "Borne posée" }],
    zip_url: "https://www.irvetechnologie.fr/api/public/retour/exemple.zip",
  },
};
