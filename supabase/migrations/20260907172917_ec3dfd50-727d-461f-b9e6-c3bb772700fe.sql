ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_client text,
  ADD COLUMN IF NOT EXISTS signataire_nom text;

CREATE UNIQUE INDEX IF NOT EXISTS devis_public_token_key ON public.devis (public_token);

CREATE TABLE IF NOT EXISTS public.devis_envois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  destinataire text NOT NULL,
  message text,
  resultat text NOT NULL DEFAULT 'envoye',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.devis_envois TO authenticated;
GRANT ALL ON public.devis_envois TO service_role;

ALTER TABLE public.devis_envois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read devis_envois" ON public.devis_envois
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert devis_envois" ON public.devis_envois
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS devis_envois_devis_id_idx ON public.devis_envois (devis_id, created_at DESC);