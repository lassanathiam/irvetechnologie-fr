CREATE TABLE public.bornes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  nom text NOT NULL,
  puissance text NOT NULL DEFAULT '7,4 kW',
  phase text NOT NULL DEFAULT 'Monophasé',
  atout text NOT NULL DEFAULT '',
  usage text NOT NULL DEFAULT '',
  badge text,
  vedette boolean NOT NULL DEFAULT false,
  photo_path text,
  prix_ttc numeric,
  ordre integer NOT NULL DEFAULT 100,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bornes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bornes TO authenticated;
GRANT ALL ON public.bornes TO service_role;
ALTER TABLE public.bornes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active bornes" ON public.bornes FOR SELECT TO anon USING (actif = true);
CREATE POLICY "Staff can manage bornes" ON public.bornes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_bornes_updated_at BEFORE UPDATE ON public.bornes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.bornes (slug, nom, puissance, phase, atout, usage, badge, vedette, photo_path, ordre) VALUES
  ('schneider-charge', 'Schneider Charge', '7,4 kW', 'Monophasé', 'Évolutive, pilotage Linky', 'Maison individuelle', 'Le plus choisi', true, 'catalogue/schneider-charge.png', 1),
  ('hager-witty', 'Hager Witty', '7,4 kW', 'Monophasé', 'Écran et contrôle d''accès', 'Maison, garage fermé', NULL, true, 'catalogue/hager-witty.png', 2),
  ('legrand-greenup', 'Legrand Green''up Premium', '7,4 kW', 'Monophasé', 'Fabrication française', 'Maison individuelle', NULL, true, 'catalogue/legrand-greenup.png', 3),
  ('wallbox-pulsar', 'Wallbox Pulsar Plus', '11 kW', 'Triphasé', 'Compacte, câble intégré', 'Maison, application mobile', NULL, true, 'catalogue/wallbox-pulsar.png', 4),
  ('tesla-wall-connector', 'Tesla Wall Connector', '11 kW', 'Triphasé', 'Câble intégré 7 m', 'Véhicules Tesla et autres marques', NULL, true, 'catalogue/tesla-wall-connector.png', 5),
  ('evbox-elvi', 'EVBox Elvi', '22 kW', 'Triphasé', 'Modulable, usage extérieur', 'Maison, petite entreprise', NULL, true, 'catalogue/evbox-elvi.png', 6),
  ('schneider-evlink-pro', 'Schneider EVlink Pro', '22 kW', 'Triphasé', 'Robuste, badge RFID', 'Entreprise, flotte', NULL, false, 'catalogue/schneider-evlink-pro.png', 7),
  ('hager-witty-park', 'Hager Witty Park', '22 kW', 'Triphasé', 'Deux véhicules par borne', 'Copropriété, parking', NULL, false, 'catalogue/borne-pedestal.png', 8),
  ('borne-sur-pied-double', 'Borne sur pied double', '22 kW', 'Triphasé', 'Sans mur porteur', 'Parking extérieur', NULL, false, 'catalogue/borne-pedestal.png', 9),
  ('zaptec-go', 'Zaptec Go', '7,4 kW', 'Monophasé', 'Très compacte et discrète', 'Maison, petit garage', NULL, false, 'catalogue/zaptec-go.png', 10),
  ('alfen-eve', 'Alfen Eve Single', '22 kW', 'Triphasé', 'Comptage certifié MID', 'Entreprise, refacturation', NULL, false, 'catalogue/alfen-eve.png', 11),
  ('prise-renforcee', 'Prise renforcée Green''up', '3,7 kW', 'Monophasé', 'Solution la plus économique', 'Petits rouleurs, dépannage', NULL, false, 'catalogue/legrand-greenup.png', 12);

CREATE POLICY "Staff can upload borne photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'borne-photos');
CREATE POLICY "Staff can update borne photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'borne-photos');
CREATE POLICY "Staff can delete borne photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'borne-photos');
CREATE POLICY "Staff can read borne photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'borne-photos');