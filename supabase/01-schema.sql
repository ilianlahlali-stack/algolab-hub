-- AlgoLab hub : schéma complet de la base (Postgres / Supabase).
-- À coller dans Supabase > SQL Editor, puis Run. Peut être relancé sans risque (idempotent).
--
-- Sécurité : la Row Level Security (RLS) est activée sur toutes les tables. Seuls les comptes dont l'e-mail
-- se termine par le domaine autorisé (public.is_member) peuvent lire ou écrire. Pour un autre domaine que
-- sciencespo.fr, modifie la fonction is_member ci-dessous ET la variable ALLOWED_EMAIL_DOMAIN de l'app.

------------------------------------------------------------------------------------------------
-- Fonctions utilitaires
------------------------------------------------------------------------------------------------
create or replace function public.is_member() returns boolean
language sql stable as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@sciencespo.fr', false)
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

------------------------------------------------------------------------------------------------
-- Deadlines (rendus) et leurs tâches (« breakdown »)
------------------------------------------------------------------------------------------------
create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due date not null,
  details text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner text,
  due date,
  done boolean not null default false,
  deadline_id uuid references public.deadlines(id) on delete set null,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------------------------
-- Calendrier : séances, rendez-vous, autres événements
------------------------------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  title text not null,
  details text,
  kind text not null default 'seance',          -- seance | rdv | autre
  start_time time,
  end_time time,
  created_at timestamptz not null default now()
);

------------------------------------------------------------------------------------------------
-- Mur : publications du groupe et réponses (une réponse a un parent_id)
------------------------------------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  author text default (auth.jwt() ->> 'email'),
  parent_id uuid references public.notes(id) on delete cascade,
  tag text check (tag is null or tag in ('impression', 'idee', 'question', 'decision')),
  created_at timestamptz not null default now()
);
create index if not exists notes_parent_idx on public.notes (parent_id);

------------------------------------------------------------------------------------------------
-- Documents : Google Docs liés au Drive (gdoc), notes de l'app (note) ou liens (link)
------------------------------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Informations',
  kind text not null default 'note' check (kind in ('gdoc', 'note', 'link')),
  url text check (url is null or url ~* '^https?://'),
  body text not null default '',               -- gdoc : copie du Google Doc ; note : texte de l'app
  summary text,
  drive_file_id text,
  drive_modified_time timestamptz,
  drive_error text,
  position int not null default 100,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_by text default (auth.jwt() ->> 'email'),
  updated_at timestamptz not null default now()
);
drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
create unique index if not exists documents_drive_file_idx on public.documents (drive_file_id) where drive_file_id is not null;
create index if not exists documents_category_idx on public.documents (category);

-- Catégorie choisie à la main pour un fichier du Drive (prioritaire sur le classement automatique)
create table if not exists public.file_categories (
  file_id text primary key,
  category text not null,
  updated_by text default (auth.jwt() ->> 'email'),
  updated_at timestamptz not null default now()
);

------------------------------------------------------------------------------------------------
-- Personnes
------------------------------------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Groupe',
  role text,
  email text,
  linkedin text check (linkedin is null or linkedin ~* '^https?://'),
  note text,
  position int not null default 100,
  created_at timestamptz not null default now()
);

------------------------------------------------------------------------------------------------
-- Synchro Drive : dossiers surveillés, état connu des fichiers, journal des changements
------------------------------------------------------------------------------------------------
create table if not exists public.drive_folders (
  id text primary key,                          -- identifiant du dossier Google Drive
  label text not null,
  last_synced_at timestamptz
);

create table if not exists public.drive_files (
  root_id text not null references public.drive_folders(id) on delete cascade,
  id text not null,
  name text not null,
  mime_type text,
  parent_name text,
  web_view_link text,
  modified_time timestamptz,
  last_modifying_user text,
  trashed boolean not null default false,
  first_seen timestamptz not null default now(),
  primary key (root_id, id)
);

create table if not exists public.drive_events (
  id bigserial primary key,
  root_id text,
  file_id text not null,
  name text not null,
  kind text not null check (kind in ('added', 'modified', 'removed')),
  folder_label text,
  parent_name text,
  web_view_link text,
  actor text,
  happened_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists drive_events_created_idx on public.drive_events (created_at desc);

------------------------------------------------------------------------------------------------
-- Row Level Security : tout est réservé aux membres
------------------------------------------------------------------------------------------------
alter table public.deadlines enable row level security;
alter table public.tasks enable row level security;
alter table public.sessions enable row level security;
alter table public.notes enable row level security;
alter table public.documents enable row level security;
alter table public.file_categories enable row level security;
alter table public.people enable row level security;
alter table public.drive_folders enable row level security;
alter table public.drive_files enable row level security;
alter table public.drive_events enable row level security;

do $$
declare t text;
begin
  -- Lecture et écriture libres pour les membres
  foreach t in array array['deadlines', 'tasks', 'sessions', 'documents', 'file_categories', 'people', 'drive_folders'] loop
    execute format('drop policy if exists "membres : tout" on public.%I', t);
    execute format('create policy "membres : tout" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

-- Mur : tout le monde publie et lit, chacun ne supprime que ses propres messages
drop policy if exists "membres : lecture" on public.notes;
drop policy if exists "membres : écriture" on public.notes;
drop policy if exists "auteur : suppression" on public.notes;
create policy "membres : lecture" on public.notes for select to authenticated using (public.is_member());
create policy "membres : écriture" on public.notes for insert to authenticated with check (public.is_member());
create policy "auteur : suppression" on public.notes for delete to authenticated
  using (public.is_member() and author = auth.jwt() ->> 'email');

-- Fichiers et événements du Drive : lecture seule pour les membres (écrits uniquement par la synchro, côté serveur)
drop policy if exists "membres : lecture" on public.drive_files;
drop policy if exists "membres : lecture" on public.drive_events;
create policy "membres : lecture" on public.drive_files for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.drive_events for select to authenticated using (public.is_member());

------------------------------------------------------------------------------------------------
-- Droits d'accès des rôles de l'API
-- Les projets Supabase récents n'ouvrent plus automatiquement les tables du schéma public : sans ces GRANT,
-- l'app reçoit « permission denied for table … ». La RLS ci-dessus reste le vrai garde-fou.
------------------------------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
