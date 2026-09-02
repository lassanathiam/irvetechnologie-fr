CREATE TABLE public.prestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL,
  description text,
  prix_unitaire numeric(10,2) NOT NULL DEFAULT 0,
  tva numeric(5,2) NOT NULL DEFAULT 20,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestations TO authenticated;
GRANT ALL ON public.prestations TO service_role;
ALTER TABLE public.prestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read prestations" ON public.prestations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert prestations" ON public.prestations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update prestations" ON public.prestations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete prestations" ON public.prestations FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_prestations_updated_at BEFORE UPDATE ON public.prestations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  date_emission date NOT NULL DEFAULT current_date,
  date_expiration date NOT NULL DEFAULT (current_date + 30),
  client_nom text NOT NULL,
  client_email text,
  client_telephone text,
  client_adresse text,
  client_cp_ville text,
  objet text,
  remise_pct numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  statut text NOT NULL DEFAULT 'brouillon',
  total_ht numeric(10,2) NOT NULL DEFAULT 0,
  total_tva numeric(10,2) NOT NULL DEFAULT 0,
  total_ttc numeric(10,2) NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis TO authenticated;
GRANT ALL ON public.devis TO service_role;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read devis" ON public.devis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert devis" ON public.devis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update devis" ON public.devis FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete devis" ON public.devis FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.devis_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  description text,
  quantite numeric(10,2) NOT NULL DEFAULT 1,
  prix_unitaire numeric(10,2) NOT NULL DEFAULT 0,
  tva numeric(5,2) NOT NULL DEFAULT 20,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX devis_items_devis_id_idx ON public.devis_items(devis_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis_items TO authenticated;
GRANT ALL ON public.devis_items TO service_role;
ALTER TABLE public.devis_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read devis_items" ON public.devis_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert devis_items" ON public.devis_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update devis_items" ON public.devis_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete devis_items" ON public.devis_items FOR DELETE TO authenticated USING (true);

INSERT INTO public.prestations (libelle, description, prix_unitaire, tva, ordre) VALUES
('Préparation et paramétrage de la borne', 'Vérification des caractéristiques, configuration initiale, réglage des paramètres', 55.00, 20, 1),
('Pose et fixation de la borne de recharge', 'Implantation, positionnement, fixation mécanique et préparation du raccordement', 54.17, 20, 2),
('Raccordement électrique de la borne', 'Raccordement de la borne au circuit d''alimentation, vérification des connexions et contrôle du serrage', 66.67, 20, 3),
('Raccordement au tableau électrique', 'Raccordement du circuit dédié au tableau, raccordement des protections fournies par le client et vérification des connexions', 83.33, 20, 4),
('Contrôles, essais et mise en service', 'Vérification électrique, essais de fonctionnement et validation de la charge', 33.33, 20, 5);