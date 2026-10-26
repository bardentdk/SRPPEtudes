-- Questionnaire « Étude Carburants Réunion 2026 » : réponses, coordonnées et analyses IA.
-- RLS activé sans aucune politique : ni le rôle anon ni le rôle authenticated n'ont accès aux tables.
-- Le site lit et écrit uniquement côté serveur, avec la clé service_role (qui contourne la RLS).

create table public.reponses (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  public text not null check (public in ('part', 'pro', 'club', 'station', 'filiere')),
  profil text not null,
  commune_code text,
  donnees jsonb not null,            -- réponses, sans aucune coordonnée
  version_schema smallint not null,
  ip_hash text not null,             -- empreinte salée de l'adresse IP, pour limiter les envois
  sheet_sync boolean not null default false
);
create index reponses_cree_le_idx on public.reponses (cree_le desc);
create index reponses_ip_idx on public.reponses (ip_hash, cree_le desc);
create index reponses_public_idx on public.reponses (public);

create table public.contacts (
  reponse_id uuid primary key references public.reponses (id) on delete cascade,
  nom text,
  structure text,
  email text,
  consentement boolean not null default false,
  cree_le timestamptz not null default now()
);

create table public.analyses_ia (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  auteur text not null,
  filtres jsonb not null default '{}'::jsonb,
  modele text not null,
  nb_reponses integer not null,
  resultat text not null
);
create index analyses_ia_cree_le_idx on public.analyses_ia (cree_le desc);

alter table public.reponses enable row level security;
alter table public.contacts enable row level security;
alter table public.analyses_ia enable row level security;
