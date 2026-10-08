import { Body, Container, Head, Html, Text, Preview } from "@react-email/components";
import type { TemplateEntry } from "./registry";

function Notification({ document, nom }: { document?: string; nom?: string }) {
  return <Html lang="fr"><Head /><Preview>Document ENSIO transmis pour signature</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}><Container style={{ padding: "24px" }}>
      <Text>Borne de l’Ouest — IRVE Technologie</Text>
      <Text>Le document « {document ?? "Document ENSIO"} » a été transmis à {nom || "son signataire"} pour signature.</Text>
      <Text>Vous recevez cette copie pour le suivi ENSIO. Le lien individuel de signature reste réservé au signataire.</Text>
    </Container></Body></Html>;
}
export const template = { component: Notification, subject: "ENSIO — document transmis pour signature", displayName: "Copie ENSIO — suivi de signature" } satisfies TemplateEntry;