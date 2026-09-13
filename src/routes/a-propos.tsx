import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ShieldCheck, Users, Wrench } from "lucide-react";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos | Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Découvrez Borne de l'Ouest : spécialiste IRVE pour particuliers, copropriétés et professionnels, avec une zone d'intervention flexible autour de Nantes.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="dark min-h-screen bg-background text-foreground pt-28">
      <section className="border-b border-border bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
          <p className="text-mono text-primary">À propos</p>
          <h1 className="mt-4 text-4xl md:text-6xl font-medium tracking-tight">
            Un partenaire IRVE fiable,{" "}
            <span className="text-muted-foreground/70">du premier contact à la maintenance.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-muted-foreground leading-relaxed">
            Borne de l&apos;Ouest accompagne les particuliers, copropriétés et entreprises pour des
            installations de bornes conformes, lisibles et durables. Notre centre opérationnel est
            autour de Nantes, avec une logique d&apos;intervention flexible selon la nature et la
            rentabilité des projets.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Conformité & sécurité",
              body: "Applications des règles IRVE, traçabilité des interventions et remise d'un dossier clair.",
            },
            {
              icon: Wrench,
              title: "Exécution terrain",
              body: "Étude, pose, mise en service et maintenance avec une méthode simple à suivre.",
            },
            {
              icon: Users,
              title: "Accompagnement client",
              body: "Un interlocuteur technique et commercial pour garder des décisions rapides.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-xl border border-border bg-card/60 p-6">
              <item.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-xl font-medium">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-b border-border bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16 grid gap-8 lg:grid-cols-2">
          <article className="rounded-xl border border-border bg-card/60 p-6 sm:p-8">
            <h2 className="text-2xl font-medium">Notre manière de travailler</h2>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
              {[
                "Étude technique et chiffrage transparent.",
                "Planification réaliste selon votre site et vos contraintes.",
                "Installation soignée avec mise en service et vérifications.",
                "Suivi après chantier avec options de maintenance.",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card/60 p-6 sm:p-8">
            <h2 className="text-2xl font-medium">Cadre légal & société</h2>
            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <p>IRVE Technologie — SIRET 989 533 724 00013 — TVA FR89 989533724.</p>
              <p>Qualifications IRVE P1 · P2 · P3.</p>
              <p>Siège social : 60 rue François Ier, 75008 Paris.</p>
              <p>
                Intervention principale dans le Grand Ouest, avec extension autour de Nantes selon
                distance, temps de trajet, montant du chantier et faisabilité économique.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight">Parlons de votre projet.</h2>
          <p className="mt-4 text-muted-foreground">
            Nous analysons la faisabilité, les délais et les aides possibles avant de lancer le chantier.
          </p>
          <Link
            to="/demande"
            className="mt-8 inline-flex items-center gap-2 rounded-sm px-5 py-3 text-mono hero-grad text-primary-foreground hover:opacity-90 transition"
          >
            Démarrer ma demande <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
