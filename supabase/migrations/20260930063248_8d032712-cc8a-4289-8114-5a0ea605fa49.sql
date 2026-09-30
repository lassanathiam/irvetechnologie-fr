CREATE TABLE public.stock_bons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donneur_ordre text NOT NULL,
  numero text,
  date_bon date NOT NULL DEFAULT current_date,
  photo_path text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stock_bon_chantiers (
  bon_id uuid NOT NULL REFERENCES public.stock_bons(id) ON DELETE CASCADE,
  rendezvous_id uuid NOT NULL REFERENCES public.rendezvous(id) ON DELETE CASCADE,
  PRIMARY KEY (bon_id, rendezvous_id)
);
CREATE TABLE public.stock_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bon_id uuid NOT NULL REFERENCES public.stock_bons(id) ON DELETE CASCADE,
  article text NOT NULL,
  reference text,
  unite text NOT NULL DEFAULT 'u',
  quantite numeric NOT NULL DEFAULT 0,
  prix_unitaire numeric,
  rendezvous_id uuid REFERENCES public.rendezvous(id) ON DELETE SET NULL,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stock_sorties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ligne_id uuid NOT NULL REFERENCES public.stock_lignes(id) ON DELETE CASCADE,
  rendezvous_id uuid NOT NULL REFERENCES public.rendezvous(id) ON DELETE CASCADE,
  quantite numeric NOT NULL,
  par text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_bons, public.stock_bon_chantiers, public.stock_lignes, public.stock_sorties TO authenticated;
GRANT ALL ON public.stock_bons, public.stock_bon_chantiers, public.stock_lignes, public.stock_sorties TO service_role;
ALTER TABLE public.stock_bons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_bon_chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_sorties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gère les bons" ON public.stock_bons FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff gère les chantiers du bon" ON public.stock_bon_chantiers FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff gère les lignes" ON public.stock_lignes FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff gère les sorties" ON public.stock_sorties FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE INDEX ON public.stock_lignes(bon_id);
CREATE INDEX ON public.stock_sorties(ligne_id);
CREATE INDEX ON public.stock_sorties(rendezvous_id);
CREATE TRIGGER update_stock_bons_updated_at BEFORE UPDATE ON public.stock_bons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();