CREATE TABLE public.rendezvous_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rendezvous_id uuid NOT NULL REFERENCES public.rendezvous(id) ON DELETE CASCADE,
  path text NOT NULL,
  source text NOT NULL DEFAULT 'equipe',
  legende text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rendezvous_photos TO authenticated;
GRANT ALL ON public.rendezvous_photos TO service_role;

ALTER TABLE public.rendezvous_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage rendezvous photos"
ON public.rendezvous_photos FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_rendezvous_photos_rdv ON public.rendezvous_photos (rendezvous_id, created_at DESC);
CREATE INDEX idx_rendezvous_statut_date ON public.rendezvous (statut, date_debut DESC);