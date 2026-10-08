ALTER TABLE public.devis_items ADD COLUMN IF NOT EXISTS unite text NOT NULL DEFAULT 'u';
ALTER TABLE public.facture_items ADD COLUMN IF NOT EXISTS unite text NOT NULL DEFAULT 'u';