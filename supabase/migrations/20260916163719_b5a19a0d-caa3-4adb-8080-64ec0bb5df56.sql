create table public.bordereau_prestations (
  id uuid primary key default gen_random_uuid(),
  donneur_ordre text not null default 'axians',
  categorie text not null,
  section text,
  reference text,
  libelle text not null,
  unite text not null default 'u',
  prix_unitaire numeric not null default 0,
  ordre integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.bordereau_prestations to authenticated;
grant all on public.bordereau_prestations to service_role;
alter table public.bordereau_prestations enable row level security;
create policy "Staff manage bordereau" on public.bordereau_prestations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create index bordereau_prestations_ordre_idx on public.bordereau_prestations (donneur_ordre, ordre);
create trigger bordereau_prestations_updated_at before update on public.bordereau_prestations for each row execute function public.update_updated_at_column();

create table public.donneurs_ordre (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  raison_sociale text,
  adresse text,
  cp_ville text,
  pays text not null default 'France',
  siret text,
  tva_intracom text,
  numero_fournisseur text,
  adresse_livraison text,
  charge_affaires_nom text,
  charge_affaires_email text,
  charge_affaires_telephone text,
  delai_paiement_jours integer not null default 60,
  autoliquidation boolean not null default true,
  notes text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.donneurs_ordre to authenticated;
grant all on public.donneurs_ordre to service_role;
alter table public.donneurs_ordre enable row level security;
create policy "Staff manage donneurs" on public.donneurs_ordre for all to authenticated using (public.is_staff()) with check (public.is_staff());
create trigger donneurs_ordre_updated_at before update on public.donneurs_ordre for each row execute function public.update_updated_at_column();