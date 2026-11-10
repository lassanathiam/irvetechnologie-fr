import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";
import { ouvrirReglagesConsentement, VERSION_NOTICE_CONSENTEMENT } from "@/lib/consentement";

const URL = "https://irvetechnologie.fr/confidentialite";
const TITRE = "Confidentialité et cookies | Borne de l'Ouest";
const DESC =
  "Comment Borne de l'Ouest (IRVE Technologie) utilise vos données : demandes de devis, mesure d'audience Google Analytics et mesure des publicités Google Ads, avec votre accord.";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    links: [{ rel: "canonical", href: URL }],
    meta: [
      { title: TITRE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITRE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Confidentialite,
});

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-medium">{titre}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

function Confidentialite() {
  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28">
        <article className="mx-auto max-w-3xl px-6 py-14">
          <p className="text-primary font-medium">Vos données</p>
          <h1 className="mt-4 text-4xl md:text-5xl font-medium tracking-tight">Confidentialité et cookies</h1>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            Le site Borne de l&apos;Ouest est édité par {COMPANY.raisonSociale} ({COMPANY.forme}), {COMPANY.adresse},{" "}
            {COMPANY.cpVille.replace(", FR", "")}, SIRET 989 533 724 00013. Contact :{" "}
            <a className="text-primary" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
          </p>

          <Bloc titre="Vos demandes de devis">
            <p>
              Quand vous remplissez le formulaire de demande, nous enregistrons vos coordonnées, l&apos;adresse du
              projet, les informations sur votre installation et les photos envoyées. Elles servent uniquement à
              étudier votre projet, vous répondre et, si vous acceptez notre devis, réaliser l&apos;installation.
            </p>
            <p>
              Nous notons aussi d&apos;où vient votre visite (recherche Google, publicité Google, réseau social ou
              accès direct) pour savoir quels moyens nous font connaître. Ces données ne sont ni vendues ni cédées.
            </p>
          </Bloc>

          <Bloc titre="Mesure d'audience et publicité, avec votre accord">
            <p>Ces outils ne s&apos;activent que si vous les acceptez dans le bandeau :</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">Mesure d&apos;audience (Google Analytics)</span> : pages
                consultées, durée de visite, type d&apos;appareil, ville approximative et envoi d&apos;une demande de
                devis. Destinataire : Google Ireland Limited.
              </li>
              <li>
                <span className="font-medium text-foreground">Publicité (Google Ads)</span> : savoir si votre visite et
                votre demande de devis viennent d&apos;une de nos annonces, pour mesurer leurs résultats et permettre à
                Google d&apos;optimiser leur diffusion vers des personnes susceptibles d&apos;être intéressées.
                Destinataire : Google Ireland Limited. Aucune coordonnée (nom, email, téléphone) n&apos;est transmise à
                Google.
              </li>
            </ul>
            <p>
              Sans accord, aucun de ces outils n&apos;est chargé. Le signal « Global Privacy Control » de votre
              navigateur est respecté : il désactive la partie publicité. Les cookies Google ont une durée maximale de
              13 mois ; votre choix est conservé sur votre appareil et redemandé si cette notice change (version du{" "}
              {VERSION_NOTICE_CONSENTEMENT.split("-").reverse().join("/")}).
            </p>
            <p>
              Notre espace professionnel et les liens personnels envoyés aux clients (devis, factures, rapports) ne
              sont jamais mesurés.
            </p>
            <p>
              Fonctionnement des services Google :{" "}
              <a className="text-primary" href="https://business.safety.google/privacy/" target="_blank" rel="noreferrer">
                business.safety.google/privacy
              </a>
              .
            </p>
            <div className="pt-2">
              <Button type="button" variant="outline" onClick={ouvrirReglagesConsentement}>
                Modifier mes choix de cookies
              </Button>
            </div>
          </Bloc>

          <Bloc titre="Durée de conservation">
            <p>
              Les demandes sans suite sont conservées au maximum 3 ans après le dernier contact. Les dossiers clients
              et documents de facturation sont conservés pendant les durées prévues par la loi (10 ans pour les
              pièces comptables).
            </p>
          </Bloc>

          <Bloc titre="Vos droits">
            <p>
              Vous pouvez demander l&apos;accès, la rectification, l&apos;effacement ou la limitation de vos données,
              et vous opposer à leur utilisation, en écrivant à{" "}
              <a className="text-primary" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Vous pouvez aussi
              saisir la CNIL (www.cnil.fr).
            </p>
          </Bloc>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
