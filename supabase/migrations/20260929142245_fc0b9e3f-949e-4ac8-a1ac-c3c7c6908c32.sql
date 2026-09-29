CREATE OR REPLACE FUNCTION public.get_public_site_tarifs()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT valeur FROM public.app_settings WHERE cle = 'tarifs_site_public' LIMIT 1),
    '{"installation_ttc":1290,"maintenance_ttc":149,"depannage_ttc":150}'
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_site_tarifs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_tarifs() TO anon, authenticated, service_role;

INSERT INTO public.app_settings (cle, valeur)
VALUES ('tarifs_site_public', '{"installation_ttc":1290,"maintenance_ttc":149,"depannage_ttc":150}')
ON CONFLICT (cle) DO NOTHING;