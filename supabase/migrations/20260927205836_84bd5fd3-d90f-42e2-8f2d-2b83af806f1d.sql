UPDATE public.rendezvous
SET termine_at = COALESCE(termine_at, '2026-09-27T20:47:32.630652+00'::timestamptz),
    statut = 'termine',
    chantier_valide = true,
    chantier_valide_at = COALESCE(chantier_valide_at, '2026-09-27T20:47:32.630652+00'::timestamptz),
    updated_at = now()
WHERE id = 'b1dd9f61-0a03-44e2-aa7f-09083a8e4d9a'
  AND client_nom = 'Mr PORHEL';