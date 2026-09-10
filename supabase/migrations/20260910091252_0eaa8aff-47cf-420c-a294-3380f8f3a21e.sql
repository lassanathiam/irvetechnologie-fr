DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','staff','user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','staff')
  )
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'contacts@irvetechnologie.fr'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'staff'::public.app_role FROM auth.users WHERE email = 'contacts@irvetechnologie.fr'
ON CONFLICT DO NOTHING;

-- devis
DROP POLICY IF EXISTS "Authenticated can read devis" ON public.devis;
DROP POLICY IF EXISTS "Authenticated can insert devis" ON public.devis;
DROP POLICY IF EXISTS "Authenticated can update devis" ON public.devis;
DROP POLICY IF EXISTS "Authenticated can delete devis" ON public.devis;
CREATE POLICY "Staff manage devis" ON public.devis FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- devis_items
DROP POLICY IF EXISTS "Authenticated can read devis_items" ON public.devis_items;
DROP POLICY IF EXISTS "Authenticated can insert devis_items" ON public.devis_items;
DROP POLICY IF EXISTS "Authenticated can update devis_items" ON public.devis_items;
DROP POLICY IF EXISTS "Authenticated can delete devis_items" ON public.devis_items;
CREATE POLICY "Staff manage devis_items" ON public.devis_items FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- devis_envois
DROP POLICY IF EXISTS "Staff read devis_envois" ON public.devis_envois;
DROP POLICY IF EXISTS "Staff insert devis_envois" ON public.devis_envois;
CREATE POLICY "Staff read devis_envois" ON public.devis_envois FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "Staff insert devis_envois" ON public.devis_envois FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

-- factures
DROP POLICY IF EXISTS "Authenticated manage factures" ON public.factures;
CREATE POLICY "Staff manage factures" ON public.factures FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Authenticated manage facture_items" ON public.facture_items;
CREATE POLICY "Staff manage facture_items" ON public.facture_items FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- rapports
DROP POLICY IF EXISTS "Staff manage rapports" ON public.rapports;
CREATE POLICY "Staff manage rapports" ON public.rapports FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- rendezvous
DROP POLICY IF EXISTS "Staff manage rendezvous" ON public.rendezvous;
CREATE POLICY "Staff manage rendezvous" ON public.rendezvous FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff manage rendezvous photos" ON public.rendezvous_photos;
CREATE POLICY "Staff manage rendezvous photos" ON public.rendezvous_photos FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- partenaires
DROP POLICY IF EXISTS "Staff manage partenaires" ON public.partenaires;
CREATE POLICY "Staff manage partenaires" ON public.partenaires FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- voirie
DROP POLICY IF EXISTS "Staff manage voirie" ON public.voirie_autorisations;
CREATE POLICY "Staff manage voirie" ON public.voirie_autorisations FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- prestations : lecture pour connectés, écriture équipe seulement
DROP POLICY IF EXISTS "Authenticated can insert prestations" ON public.prestations;
DROP POLICY IF EXISTS "Authenticated can update prestations" ON public.prestations;
DROP POLICY IF EXISTS "Authenticated can delete prestations" ON public.prestations;
CREATE POLICY "Staff insert prestations" ON public.prestations FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
CREATE POLICY "Staff update prestations" ON public.prestations FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff delete prestations" ON public.prestations FOR DELETE TO authenticated
  USING (public.is_staff());

-- Fichiers privés : équipe uniquement
DROP POLICY IF EXISTS "Photos projets lecture connectee" ON storage.objects;
DROP POLICY IF EXISTS "Photos projets ajout connecte" ON storage.objects;
DROP POLICY IF EXISTS "Photos projets modif connectee" ON storage.objects;
DROP POLICY IF EXISTS "Photos projets suppression connectee" ON storage.objects;
DROP POLICY IF EXISTS "Staff read voirie docs" ON storage.objects;
DROP POLICY IF EXISTS "Staff insert voirie docs" ON storage.objects;
DROP POLICY IF EXISTS "Staff update voirie docs" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete voirie docs" ON storage.objects;
DROP POLICY IF EXISTS "Staff read chantier photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff insert chantier photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete chantier photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read demande photo files" ON storage.objects;

CREATE POLICY "Staff read private files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('projet-photos','chantier-photos','voirie-docs','demande-photos','rapport-photos') AND public.is_staff());
CREATE POLICY "Staff insert private files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('projet-photos','chantier-photos','voirie-docs','demande-photos','rapport-photos') AND public.is_staff());
CREATE POLICY "Staff update private files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('projet-photos','chantier-photos','voirie-docs','demande-photos','rapport-photos') AND public.is_staff())
  WITH CHECK (bucket_id IN ('projet-photos','chantier-photos','voirie-docs','demande-photos','rapport-photos') AND public.is_staff());
CREATE POLICY "Staff delete private files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('projet-photos','chantier-photos','voirie-docs','demande-photos','rapport-photos') AND public.is_staff());