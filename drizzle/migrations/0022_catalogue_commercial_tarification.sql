CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

CREATE TABLE public.catalogue_produits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marque text NOT NULL,
  nom_commercial text NOT NULL,
  reference_constructeur text,
  sku text,
  reference_verifiee boolean NOT NULL DEFAULT false,
  puissance_kw numeric NOT NULL DEFAULT 7.4,
  phase text NOT NULL DEFAULT 'mono',
  nb_phases integer NOT NULL DEFAULT 1,
  connecteur text NOT NULL DEFAULT 'prise_t2',
  connectivite text[] NOT NULL DEFAULT '{}',
  gestion_dynamique boolean,
  compatible_tic boolean,
  rfid boolean,
  mid boolean,
  autres_fonctions text,
  garantie_ans numeric,
  fiche_technique_url text,
  site_officiel_url text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  prix_public_ttc numeric,
  notes text,
  actif boolean NOT NULL DEFAULT true,
  ordre integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_produits TO authenticated;
GRANT ALL ON public.catalogue_produits TO service_role;
ALTER TABLE public.catalogue_produits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lit le catalogue commercial" ON public.catalogue_produits FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Admin gere le catalogue commercial" ON public.catalogue_produits FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_catalogue_produits_updated BEFORE UPDATE ON public.catalogue_produits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.catalogue_prix_achat (
  produit_id uuid PRIMARY KEY REFERENCES public.catalogue_produits(id) ON DELETE CASCADE,
  fournisseur text,
  reference_fournisseur text,
  prix_achat_ht numeric,
  tva_achat_pct numeric NOT NULL DEFAULT 20,
  remise_pct numeric NOT NULL DEFAULT 0,
  frais_livraison_ht numeric NOT NULL DEFAULT 0,
  disponibilite text,
  justificatif_path text,
  actualise_le date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_prix_achat TO authenticated;
GRANT ALL ON public.catalogue_prix_achat TO service_role;
ALTER TABLE public.catalogue_prix_achat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin seul voit les prix d achat" ON public.catalogue_prix_achat FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_catalogue_prix_achat_updated BEFORE UPDATE ON public.catalogue_prix_achat FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.catalogue_forfaits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES public.catalogue_produits(id) ON DELETE CASCADE,
  palier_m integer NOT NULL,
  prix_ttc numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produit_id, palier_m),
  CONSTRAINT catalogue_forfaits_palier_ck CHECK (palier_m IN (5, 10, 15, 20)),
  CONSTRAINT catalogue_forfaits_prix_ck CHECK (prix_ttc >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_forfaits TO authenticated;
GRANT ALL ON public.catalogue_forfaits TO service_role;
ALTER TABLE public.catalogue_forfaits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lit les forfaits" ON public.catalogue_forfaits FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Admin gere les forfaits" ON public.catalogue_forfaits FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_catalogue_forfaits_updated BEFORE UPDATE ON public.catalogue_forfaits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.catalogue_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  description text,
  prix_ttc numeric,
  actif boolean NOT NULL DEFAULT true,
  ordre integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_options TO authenticated;
GRANT ALL ON public.catalogue_options TO service_role;
ALTER TABLE public.catalogue_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lit les options" ON public.catalogue_options FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Admin gere les options" ON public.catalogue_options FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_catalogue_options_updated BEFORE UPDATE ON public.catalogue_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.catalogue_options_couts (
  option_id uuid PRIMARY KEY REFERENCES public.catalogue_options(id) ON DELETE CASCADE,
  cout_ht numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_options_couts TO authenticated;
GRANT ALL ON public.catalogue_options_couts TO service_role;
ALTER TABLE public.catalogue_options_couts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin seul voit les couts options" ON public.catalogue_options_couts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.tarification_couts (
  id integer PRIMARY KEY DEFAULT 1,
  valeurs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarification_couts_unique CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarification_couts TO authenticated;
GRANT ALL ON public.tarification_couts TO service_role;
ALTER TABLE public.tarification_couts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin seul voit les couts de reference" ON public.tarification_couts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.devis_marges (
  devis_id uuid PRIMARY KEY REFERENCES public.devis(id) ON DELETE CASCADE,
  produit_id uuid REFERENCES public.catalogue_produits(id) ON DELETE SET NULL,
  produit_libelle text NOT NULL,
  palier_m integer,
  distance_m numeric,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  prix_vente_ht numeric NOT NULL,
  cout_revient_ht numeric NOT NULL,
  marge_ht numeric NOT NULL,
  couts_complets boolean NOT NULL DEFAULT false,
  derogation_motif text,
  derogation_par uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis_marges TO authenticated;
GRANT ALL ON public.devis_marges TO service_role;
ALTER TABLE public.devis_marges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin seul voit les marges des devis" ON public.devis_marges FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin lit justificatifs achats" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'achats-fournisseurs' AND public.is_admin());
CREATE POLICY "Admin ajoute justificatifs achats" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'achats-fournisseurs' AND public.is_admin());
CREATE POLICY "Admin modifie justificatifs achats" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'achats-fournisseurs' AND public.is_admin());
CREATE POLICY "Admin supprime justificatifs achats" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'achats-fournisseurs' AND public.is_admin());