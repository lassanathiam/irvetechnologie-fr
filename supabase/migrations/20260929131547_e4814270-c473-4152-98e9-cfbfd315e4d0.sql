CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier text NOT NULL DEFAULT 'autres',
  nom text NOT NULL,
  storage_path text NOT NULL,
  original_path text,
  mime text,
  taille bigint,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','envoye','consulte','signe','refuse')),
  zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  signataires jsonb NOT NULL DEFAULT '[]'::jsonb,
  public_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sent_at timestamptz,
  sent_to text,
  viewed_at timestamptz,
  view_count int NOT NULL DEFAULT 0,
  signed_at timestamptz,
  refused_at timestamptz,
  refus_motif text,
  hash text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gere les documents" ON public.documents FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff lit documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND public.is_staff());
CREATE POLICY "Staff ajoute documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND public.is_staff());
CREATE POLICY "Staff modifie documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND public.is_staff());
CREATE POLICY "Staff supprime documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND public.is_staff());