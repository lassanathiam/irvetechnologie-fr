-- Devis: champs de conformité et facturation
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS conditions_paiement text,
  ADD COLUMN IF NOT EXISTS acompte_pct numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS total_remise numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ht_brut numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS facture_id uuid;

UPDATE public.devis
SET total_ht_brut = CASE WHEN remise_pct > 0 THEN round(total_ht / (1 - remise_pct/100.0), 2) ELSE total_ht END,
    total_remise = CASE WHEN remise_pct > 0 THEN round(total_ht / (1 - remise_pct/100.0), 2) - total_ht ELSE 0 END
WHERE total_ht_brut = 0;

CREATE TABLE IF NOT EXISTS public.factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  numero text NOT NULL UNIQUE,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date NOT NULL DEFAULT (CURRENT_DATE + 30),
  client_nom text NOT NULL,
  client_email text,
  client_telephone text,
  client_adresse text,
  client_cp_ville text,
  objet text,
  remise_pct numeric NOT NULL DEFAULT 0,
  acompte_pct numeric NOT NULL DEFAULT 0,
  conditions_paiement text,
  notes text,
  statut text NOT NULL DEFAULT 'brouillon',
  total_ht_brut numeric NOT NULL DEFAULT 0,
  total_remise numeric NOT NULL DEFAULT 0,
  total_ht numeric NOT NULL DEFAULT 0,
  total_tva numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.facture_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  description text,
  quantite numeric NOT NULL DEFAULT 1,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  tva numeric NOT NULL DEFAULT 20,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factures TO authenticated;
GRANT ALL ON public.factures TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facture_items TO authenticated;
GRANT ALL ON public.facture_items TO service_role;

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facture_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage factures" ON public.factures;
CREATE POLICY "Authenticated manage factures" ON public.factures
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated manage facture_items" ON public.facture_items;
CREATE POLICY "Authenticated manage facture_items" ON public.facture_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS factures_created_at_idx ON public.factures (created_at DESC);
CREATE INDEX IF NOT EXISTS facture_items_facture_idx ON public.facture_items (facture_id);

DROP TRIGGER IF EXISTS update_factures_updated_at ON public.factures;
CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();