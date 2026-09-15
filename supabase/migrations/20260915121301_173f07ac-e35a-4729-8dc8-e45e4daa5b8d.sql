CREATE TABLE public.attachements_travaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  activite text NOT NULL DEFAULT 'fibre' CHECK (activite = 'fibre'),
  rendezvous_id uuid REFERENCES public.rendezvous(id) ON DELETE SET NULL,
  facture_id uuid REFERENCES public.factures(id) ON DELETE SET NULL,
  client_nom text NOT NULL,
  client_email text,
  client_telephone text,
  client_adresse text,
  client_cp_ville text,
  numero_ticket text NOT NULL,
  numero_affaire text,
  bon_commande text,
  objet text,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date NOT NULL DEFAULT (CURRENT_DATE + 30),
  autoliquidation boolean NOT NULL DEFAULT false,
  validation_requise boolean NOT NULL DEFAULT true,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','envoye','accepte','refuse','facture')),
  notes text,
  total_ht numeric NOT NULL DEFAULT 0,
  total_tva numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  public_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  sent_at timestamptz,
  viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  refused_at timestamptz,
  signataire_nom text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachements_travaux TO authenticated;
GRANT ALL ON public.attachements_travaux TO service_role;
ALTER TABLE public.attachements_travaux ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage attachements travaux" ON public.attachements_travaux FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE public.attachement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachement_id uuid NOT NULL REFERENCES public.attachements_travaux(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  description text,
  quantite numeric NOT NULL DEFAULT 1,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachement_items TO authenticated;
GRANT ALL ON public.attachement_items TO service_role;
ALTER TABLE public.attachement_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage attachement items" ON public.attachement_items FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS attachement_id uuid REFERENCES public.attachements_travaux(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activite text NOT NULL DEFAULT 'irve',
  ADD COLUMN IF NOT EXISTS numero_ticket text,
  ADD COLUMN IF NOT EXISTS numero_affaire text,
  ADD COLUMN IF NOT EXISTS bon_commande text,
  ADD COLUMN IF NOT EXISTS autoliquidation boolean NOT NULL DEFAULT false;

CREATE INDEX attachements_travaux_created_at_idx ON public.attachements_travaux(created_at DESC);
CREATE INDEX attachements_travaux_ticket_idx ON public.attachements_travaux(numero_ticket);
CREATE INDEX attachement_items_parent_idx ON public.attachement_items(attachement_id, ordre);
CREATE INDEX factures_attachement_idx ON public.factures(attachement_id);

CREATE TRIGGER update_attachements_travaux_updated_at BEFORE UPDATE ON public.attachements_travaux FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();