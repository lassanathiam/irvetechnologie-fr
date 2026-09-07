ALTER TABLE public.rendezvous
  ADD COLUMN IF NOT EXISTS metrage_m numeric,
  ADD COLUMN IF NOT EXISTS puissance_borne text,
  ADD COLUMN IF NOT EXISTS phase_installation text,
  ADD COLUMN IF NOT EXISTS type_pose text;

COMMENT ON COLUMN public.rendezvous.metrage_m IS 'Longueur estimée du cheminement en mètres';
COMMENT ON COLUMN public.rendezvous.puissance_borne IS 'Puissance de la borne prévue, par exemple 7,4 kW';
COMMENT ON COLUMN public.rendezvous.phase_installation IS 'Alimentation monophasée ou triphasée';
COMMENT ON COLUMN public.rendezvous.type_pose IS 'Type ou environnement de pose, par exemple intérieur, extérieur ou sur pied';