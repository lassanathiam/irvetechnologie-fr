CREATE TABLE public.cri_total (
  rendezvous_id uuid PRIMARY KEY REFERENCES public.rendezvous(id) ON DELETE CASCADE,
  valeurs jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_technicien text,
  signature_client text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cri_total TO authenticated;
GRANT ALL ON public.cri_total TO service_role;
ALTER TABLE public.cri_total ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gère les CRI Total" ON public.cri_total FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());