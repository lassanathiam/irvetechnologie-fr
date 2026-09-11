export type DossierPartenaireBucketInput = {
  demarre_at?: string | null;
  termine_at?: string | null;
  statut?: string | null;
  statut_facturation?: string | null;
  date_a_confirmer?: boolean | null;
};

export type DossierLifecycleBuckets<T> = {
  aPlanifier: T[];
  planifies: T[];
  enCours: T[];
  terminesAFacturer: T[];
  factures: T[];
};

export function isDossierFacture(dossier: DossierPartenaireBucketInput): boolean {
  return dossier.statut_facturation === "facture" || dossier.statut_facturation === "paye";
}

export function isDossierTermine(dossier: DossierPartenaireBucketInput): boolean {
  return Boolean(dossier.termine_at) || dossier.statut === "termine" || dossier.statut === "realise";
}

export function isDossierEnCours(dossier: DossierPartenaireBucketInput): boolean {
  return Boolean(dossier.demarre_at) && !isDossierTermine(dossier);
}

export function isDossierNouveau(dossier: DossierPartenaireBucketInput): boolean {
  return !isDossierEnCours(dossier) && !isDossierTermine(dossier) && !isDossierFacture(dossier);
}

export function isDossierAPlanifier(dossier: DossierPartenaireBucketInput): boolean {
  return isDossierNouveau(dossier) && Boolean(dossier.date_a_confirmer);
}

export function isDossierPlanifie(dossier: DossierPartenaireBucketInput): boolean {
  return isDossierNouveau(dossier) && !Boolean(dossier.date_a_confirmer);
}

export function splitDossiersByLifecycle<T extends DossierPartenaireBucketInput>(
  dossiers: T[],
): DossierLifecycleBuckets<T> {
  return {
    aPlanifier: dossiers.filter(isDossierAPlanifier),
    planifies: dossiers.filter(isDossierPlanifie),
    enCours: dossiers.filter(isDossierEnCours),
    terminesAFacturer: dossiers.filter((d) => isDossierTermine(d) && !isDossierFacture(d)),
    factures: dossiers.filter(isDossierFacture),
  };
}
