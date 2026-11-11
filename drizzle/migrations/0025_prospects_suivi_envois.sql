ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS nb_envois integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dernier_canal text CHECK (dernier_canal IS NULL OR dernier_canal IN ('mail','formulaire','telephone')),
  ADD COLUMN IF NOT EXISTS mail_ouvert_le timestamptz;
UPDATE public.prospects SET nb_envois = 1, dernier_canal = 'mail' WHERE envoye_le IS NOT NULL AND nb_envois = 0;