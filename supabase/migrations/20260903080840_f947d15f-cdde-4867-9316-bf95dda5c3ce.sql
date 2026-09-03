ALTER TABLE public.rapports ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.rapports ADD COLUMN IF NOT EXISTS declaration_acceptee boolean NOT NULL DEFAULT true;