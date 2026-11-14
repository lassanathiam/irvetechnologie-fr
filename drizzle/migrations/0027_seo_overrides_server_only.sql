DROP POLICY IF EXISTS "Corrections SEO lisibles par tous" ON public.seo_page_overrides;
REVOKE SELECT ON public.seo_page_overrides FROM anon, authenticated;