ALTER TABLE public.partenaires
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_defini_at timestamptz,
  ADD COLUMN IF NOT EXISTS dernier_acces_at timestamptz;

CREATE TABLE IF NOT EXISTS public.partenaire_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partenaire_id uuid NOT NULL REFERENCES public.partenaires(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partenaire_sessions_partenaire_idx ON public.partenaire_sessions(partenaire_id);

GRANT SELECT, DELETE ON public.partenaire_sessions TO authenticated;
GRANT ALL ON public.partenaire_sessions TO service_role;

ALTER TABLE public.partenaire_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe consulte les sessions partenaires" ON public.partenaire_sessions;
CREATE POLICY "Equipe consulte les sessions partenaires"
  ON public.partenaire_sessions FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Equipe revoque les sessions partenaires" ON public.partenaire_sessions;
CREATE POLICY "Equipe revoque les sessions partenaires"
  ON public.partenaire_sessions FOR DELETE TO authenticated
  USING (public.is_staff());