CREATE TABLE public.rendezvous_fiches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rendezvous_id uuid NOT NULL REFERENCES public.rendezvous(id) ON DELETE CASCADE,
  nom text NOT NULL,
  path text NOT NULL,
  mime text,
  resume text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rendezvous_fiches TO authenticated;
GRANT ALL ON public.rendezvous_fiches TO service_role;
ALTER TABLE public.rendezvous_fiches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gere fiches techniques" ON public.rendezvous_fiches FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE INDEX rendezvous_fiches_rdv_idx ON public.rendezvous_fiches(rendezvous_id);