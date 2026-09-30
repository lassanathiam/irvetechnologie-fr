ALTER TABLE public.partenaires ADD COLUMN IF NOT EXISTS email_copie text;

COMMENT ON COLUMN public.partenaires.email_copie IS 'Adresse recevant systématiquement une copie des retours de chantier du donneur d ordre.';