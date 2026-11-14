CREATE TABLE public.blog_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorank_article_id text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  meta_description text NOT NULL DEFAULT '',
  content_html text NOT NULL DEFAULT '',
  featured_image_url text,
  featured_image_alt text,
  language text NOT NULL DEFAULT 'fr-FR',
  revision integer NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blog_articles_published_at_idx ON public.blog_articles (published_at DESC);
GRANT SELECT ON public.blog_articles TO anon, authenticated;
GRANT ALL ON public.blog_articles TO service_role;
ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles du blog lisibles par tous" ON public.blog_articles FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.seo_page_overrides (
  path text PRIMARY KEY,
  title text,
  h1 text,
  meta_description text,
  content_html text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  json_ld jsonb,
  json_ld_mode text NOT NULL DEFAULT 'default' CHECK (json_ld_mode IN ('default','replace','remove')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seo_page_overrides TO anon, authenticated;
GRANT ALL ON public.seo_page_overrides TO service_role;
ALTER TABLE public.seo_page_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Corrections SEO lisibles par tous" ON public.seo_page_overrides FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.seo_page_override_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  idempotency_key text,
  before jsonb,
  after jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seo_page_override_history_path_idx ON public.seo_page_override_history (path, created_at DESC);
GRANT ALL ON public.seo_page_override_history TO service_role;
ALTER TABLE public.seo_page_override_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sorank_webhook_deliveries (
  idempotency_key text PRIMARY KEY,
  event text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sorank_webhook_deliveries TO service_role;
ALTER TABLE public.sorank_webhook_deliveries ENABLE ROW LEVEL SECURITY;