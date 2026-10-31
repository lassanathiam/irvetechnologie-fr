ALTER TABLE public.attachements_travaux ADD COLUMN attachement_initial_id uuid REFERENCES public.attachements_travaux(id), ADD COLUMN attachement_initial_numero text;
CREATE INDEX attachements_ts_initial_idx ON public.attachements_travaux(attachement_initial_id);
CREATE OR REPLACE FUNCTION public.creer_attachement_ts(_initial_id uuid, _document_id uuid, _lignes jsonb, _bon_commande text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE source public.attachements_travaux%ROWTYPE; cible uuid; prefixe text; sequence_num integer; ht numeric; tva numeric; jour date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Accès réservé à l’équipe.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('attachements-travaux-numero'));
  SELECT id INTO cible FROM public.attachements_travaux WHERE id = _document_id AND attachement_initial_id = _initial_id;
  IF cible IS NOT NULL THEN RETURN cible; END IF;
  SELECT * INTO source FROM public.attachements_travaux WHERE id = _initial_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attachement initial introuvable.'; END IF;
  IF source.attachement_initial_id IS NOT NULL OR source.statut = 'annule' THEN RAISE EXCEPTION 'Choisissez un attachement initial non annulé.'; END IF;
  IF jsonb_typeof(_lignes) IS DISTINCT FROM 'array' OR jsonb_array_length(_lignes) < 1 OR jsonb_array_length(_lignes) > 100 THEN RAISE EXCEPTION 'Ajoutez au moins une ligne de travaux supplémentaires.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_lignes) l WHERE nullif(trim(l->>'libelle'), '') IS NULL OR length(l->>'libelle') > 200 OR length(coalesce(l->>'description','')) > 1000 OR (l->>'quantite') IS NULL OR (l->>'prix_unitaire') IS NULL OR (l->>'quantite')::numeric <= 0 OR (l->>'quantite')::numeric > 100000 OR (l->>'prix_unitaire')::numeric < 0 OR (l->>'prix_unitaire')::numeric > 1000000) THEN RAISE EXCEPTION 'Vérifiez les travaux, quantités et prix.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_lignes) l WHERE nullif(l->>'rendezvous_id','') IS NOT NULL AND NOT (source.rendezvous_id = (l->>'rendezvous_id')::uuid OR EXISTS (SELECT 1 FROM public.attachement_items i WHERE i.attachement_id = source.id AND i.rendezvous_id = (l->>'rendezvous_id')::uuid))) THEN RAISE EXCEPTION 'Le chantier doit appartenir à l’attachement initial.'; END IF;
  SELECT round(sum((l->>'quantite')::numeric * (l->>'prix_unitaire')::numeric),2) INTO ht FROM jsonb_array_elements(_lignes) l;
  tva := CASE WHEN source.autoliquidation THEN 0 ELSE round(ht * 0.20,2) END;
  prefixe := 'AT-' || extract(year FROM jour)::text || '-';
  SELECT coalesce(max(substring(numero FROM length(prefixe)+1)::integer),0)+1 INTO sequence_num FROM public.attachements_travaux WHERE numero LIKE prefixe || '%' AND substring(numero FROM length(prefixe)+1) ~ '^[0-9]+$';
  INSERT INTO public.attachements_travaux(id,numero,client_nom,client_email,client_telephone,client_adresse,client_cp_ville,numero_ticket,numero_affaire,bon_commande,objet,date_emission,date_echeance,autoliquidation,validation_requise,proposition_autorisee,rendezvous_id,activite,total_ht,total_tva,total_ttc,created_by,attachement_initial_id,attachement_initial_numero)
  VALUES (_document_id,prefixe || lpad(sequence_num::text,4,'0'),source.client_nom,source.client_email,source.client_telephone,source.client_adresse,source.client_cp_ville,source.numero_ticket,source.numero_affaire,nullif(trim(_bon_commande),''),left('TS · Travaux supplémentaires — ' || source.numero || coalesce(' — ' || source.objet,''),240),jour,jour+greatest(source.date_echeance-source.date_emission,0),source.autoliquidation,true,source.proposition_autorisee,source.rendezvous_id,source.activite,ht,tva,ht+tva,auth.uid(),source.id,source.numero);
  INSERT INTO public.attachement_items(attachement_id,libelle,description,quantite,prix_unitaire,rendezvous_id,tes,ordre)
  SELECT _document_id,trim(l->>'libelle'),nullif(trim(l->>'description'),''),(l->>'quantite')::numeric,(l->>'prix_unitaire')::numeric,nullif(l->>'rendezvous_id','')::uuid,true,position::integer FROM jsonb_array_elements(_lignes) WITH ORDINALITY AS lignes(l,position);
  RETURN _document_id;
END;
$$;
REVOKE ALL ON FUNCTION public.creer_attachement_ts(uuid,uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_attachement_ts(uuid,uuid,jsonb,text) TO authenticated, service_role;