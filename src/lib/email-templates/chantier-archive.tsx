import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { COMPANY } from "@/lib/company";

export type ChantierArchiveData = {
  client_nom: string;
  adresse?: string | null;
  objet?: string | null;
  partenaire?: string | null;
  date_debut?: string | null;
  demarre_at?: string | null;
  termine_at?: string | null;
  duree_min?: number | null;
  metrage_m?: number | null;
  puissance_borne?: string | null;
  phase_installation?: string | null;
  type_pose?: string | null;
  /** Montant HT — transmis uniquement au donneur d'ordre. */
  montant_ht?: number | null;
  photos?: string[];
  /** « client » ou « partenaire » : adapte le texte d'introduction. */
  destinataire?: "client" | "partenaire";
};

const dateFr = (v?: string | null) => (v ? new Date(v).toLocaleString("fr-FR") : null);

const dureeFr = (min?: number | null) => {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
};

const euros = (n?: number | null) =>
  typeof n === "number" && n > 0
    ? n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
    : null;

function Ligne({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur) return null;
  return (
    <Text style={{ fontSize: 14, margin: "6px 0", color: "#223" }}>
      <strong>{label} :</strong> {valeur}
    </Text>
  );
}

function ChantierArchiveEmail(data: ChantierArchiveData) {
  const photos = (data.photos ?? []).slice(0, 6);
  const pro = data.destinataire === "partenaire";
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Bilan de chantier — ${data.client_nom}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container
          style={{ maxWidth: 600, margin: "24px auto", background: "#ffffff", padding: 24 }}
        >
          <Heading style={{ fontSize: 20, margin: "0 0 8px" }}>Bilan de chantier</Heading>
          <Text style={{ fontSize: 14, color: "#334", margin: "0 0 16px" }}>
            {pro
              ? `Le chantier chez ${data.client_nom} est clôturé. Voici le bilan complet et les photos de l'intervention.`
              : `Votre installation est terminée et le dossier est clôturé. Merci de votre confiance ! Voici le bilan de l'intervention et les photos.`}
          </Text>
          <Hr />
          <Section>
            <Ligne label="Client" valeur={data.client_nom} />
            <Ligne label="Objet" valeur={data.objet} />
            <Ligne label="Adresse" valeur={data.adresse} />
            {pro ? <Ligne label="Donneur d'ordre" valeur={data.partenaire} /> : null}
            <Ligne label="Rendez-vous" valeur={dateFr(data.date_debut)} />
            <Ligne label="Début des travaux" valeur={dateFr(data.demarre_at)} />
            <Ligne label="Fin des travaux" valeur={dateFr(data.termine_at)} />
            <Ligne label="Durée sur site" valeur={dureeFr(data.duree_min)} />
            <Ligne
              label="Métrage"
              valeur={data.metrage_m ? `${data.metrage_m} m` : null}
            />
            <Ligne label="Puissance de la borne" valeur={data.puissance_borne} />
            <Ligne label="Alimentation" valeur={data.phase_installation} />
            <Ligne label="Type de pose" valeur={data.type_pose} />
            {pro ? <Ligne label="Montant HT" valeur={euros(data.montant_ht)} /> : null}
          </Section>
          {photos.length ? (
            <>
              <Hr />
              <Text style={{ fontSize: 14, margin: "12px 0 8px", fontWeight: "bold" }}>
                Photos du chantier
              </Text>
              <Section>
                {photos.map((url, i) => (
                  <Img
                    key={i}
                    src={url}
                    alt={`Photo de chantier ${i + 1}`}
                    width="536"
                    style={{
                      width: "100%",
                      maxWidth: 536,
                      borderRadius: 8,
                      margin: "0 0 10px",
                      display: "block",
                    }}
                  />
                ))}
              </Section>
              <Text style={{ fontSize: 12, color: "#667", margin: "0 0 8px" }}>
                Les photos restent accessibles pendant 7 jours. Pensez à les enregistrer.
              </Text>
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
            Quelqu&apos;un de votre entourage a besoin d&apos;installer ou d&apos;entretenir sa borne
            de recharge ? Merci de partager notre lien : {COMPANY.siteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ChantierArchiveEmail,
  subject: (data: Record<string, any>) => `Bilan de chantier — ${data['client_nom'] ?? "client"}`,
  displayName: "Bilan de chantier (archivage)",
  previewData: {
    client_nom: "Cindy JAVAUT",
    adresse: "12 rue des Lilas, 44000 Nantes",
    objet: "Pose borne 7,4 kW",
    partenaire: "Pure Énergie",
    date_debut: new Date().toISOString(),
    demarre_at: new Date().toISOString(),
    termine_at: new Date().toISOString(),
    duree_min: 145,
    metrage_m: 18,
    puissance_borne: "7,4 kW",
    phase_installation: "Monophasé",
    type_pose: "Murale extérieure",
    montant_ht: 1290,
    photos: [],
    destinataire: "client",
  },
} satisfies TemplateEntry;
