DROP FUNCTION IF EXISTS public.get_public_site_tarifs();

GRANT SELECT ON public.app_settings TO anon;

CREATE POLICY "Public can read site tariffs only"
ON public.app_settings
FOR SELECT
TO anon
USING (cle = 'tarifs_site_public');