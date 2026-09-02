import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Espace pro — IRVE Technologie" },
      {
        name: "description",
        content: "Connexion à l'espace privé IRVE Technologie pour créer et envoyer des devis.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/devis" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/devis" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        setInfo("Compte créé. Vous pouvez maintenant vous connecter.");
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <section className="pt-40 pb-24">
        <div className="mx-auto max-w-md px-6">
          <div className="inline-flex items-center gap-2 text-mono text-primary mb-6">
            <Lock className="h-4 w-4" /> Espace pro
          </div>
          <h1 className="text-3xl font-medium tracking-tight">
            {mode === "signin" ? "Connexion" : "Créer un accès"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Réservé à l'équipe IRVE Technologie — création et envoi des devis.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-mono text-muted-foreground">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-mono text-muted-foreground">Mot de passe</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary"
              />
            </label>

            {error && (
              <p className="text-mono text-destructive" role="alert">
                {error}
              </p>
            )}
            {info && <p className="text-mono text-primary">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full hero-grad text-primary-foreground text-mono px-6 py-3.5 rounded-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Se connecter" : "Créer le compte"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="mt-6 text-mono text-muted-foreground hover:text-primary transition"
          >
            {mode === "signin" ? "Pas encore d'accès ? Créer un compte" : "J'ai déjà un accès"}
          </button>
        </div>
      </section>
    </div>
  );
}
