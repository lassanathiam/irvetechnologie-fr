ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS etiquettes text[] NOT NULL DEFAULT '{}'::text[];