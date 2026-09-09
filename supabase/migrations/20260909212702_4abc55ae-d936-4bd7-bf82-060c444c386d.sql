ALTER TABLE public.demande_photos
  DROP CONSTRAINT demande_photos_demande_id_fkey,
  ADD CONSTRAINT demande_photos_demande_id_fkey
    FOREIGN KEY (demande_id) REFERENCES public.demande_requests(id) ON DELETE CASCADE;

CREATE POLICY "Staff can delete demandes"
ON public.demande_requests FOR DELETE TO authenticated
USING (true);

CREATE POLICY "Staff can delete demande photos"
ON public.demande_photos FOR DELETE TO authenticated
USING (true);