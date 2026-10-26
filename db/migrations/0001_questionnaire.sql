-- Questionnaire « Étude Carburants Réunion 2026 » : réponses, coordonnées et analyses IA.
-- La base n'est jamais exposée au navigateur : seules les routes serveur du site y accèdent,
-- avec DATABASE_URL.

create table if not exists reponses (
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
create index if not exists reponses_cree_le_idx on reponses (cree_le desc);
create index if not exists reponses_ip_idx on reponses (ip_hash, cree_le desc);
create index if not exists reponses_public_idx on reponses (public);

create table if not exists contacts (
  reponse_id uuid primary key references reponses (id) on delete cascade,
  nom text,
  structure text,
  email text,
  consentement boolean not null default false,
  cree_le timestamptz not null default now()
);

create table if not exists analyses_ia (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  auteur text not null,
  filtres jsonb not null default '{}'::jsonb,
  modele text not null,
  nb_reponses integer not null,
  resultat text not null
);
create index if not exists analyses_ia_cree_le_idx on analyses_ia (cree_le desc);
