ALTER TABLE public.partenaires ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.rendezvous ADD COLUMN IF NOT EXISTS notif_archive_at timestamptz;