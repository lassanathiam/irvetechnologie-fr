CREATE TABLE public.realisations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  lieu TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  photo_path TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  publie BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.realisations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.realisations TO authenticated;
GRANT ALL ON public.realisations TO service_role;

ALTER TABLE public.realisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Realisations publiees visibles par tous"
  ON public.realisations FOR SELECT TO anon, authenticated
  USING (publie = true OR auth.uid() IS NOT NULL);

CREATE POLICY "Utilisateurs connectes gerent les realisations"
  ON public.realisations FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_realisations_updated_at
  BEFORE UPDATE ON public.realisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Photos projets lecture connectee"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'projet-photos');

CREATE POLICY "Photos projets ajout connecte"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'projet-photos');

CREATE POLICY "Photos projets modif connectee"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'projet-photos');

CREATE POLICY "Photos projets suppression connectee"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'projet-photos');