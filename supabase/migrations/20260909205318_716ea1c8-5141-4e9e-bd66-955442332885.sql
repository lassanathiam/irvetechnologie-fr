ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS rendezvous_archive_idx ON public.rendezvous (archive, date_debut DESC);