CREATE TABLE public.commandes_importees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nom text NOT NULL,
 empreinte text NOT NULL UNIQUE,
 original_path text NOT NULL,
 signe_path text,
 saisie jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commandes_importees TO authenticated;
GRANT ALL ON public.commandes_importees TO service_role;
ALTER TABLE public.commandes_importees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage imported orders" ON public.commandes_importees FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER commandes_importees_updated BEFORE UPDATE ON public.commandes_importees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();