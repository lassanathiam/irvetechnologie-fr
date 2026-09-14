ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rdv_propose_at timestamptz,
  ADD COLUMN IF NOT EXISTS rdv_confirme_at timestamptz,
  ADD COLUMN IF NOT EXISTS rdv_refuse_at timestamptz,
  ADD COLUMN IF NOT EXISTS rdv_client_message text,
  ADD COLUMN IF NOT EXISTS photos_zip_downloaded_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS rendezvous_public_token_key ON public.rendezvous (public_token);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  titre text NOT NULL,
  message text,
  lien text,
  montant numeric,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  lu_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe gere les notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cle text NOT NULL UNIQUE,
  valeur text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe gere les reglages"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();