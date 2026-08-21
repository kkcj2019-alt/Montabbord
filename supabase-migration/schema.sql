-- ============================================================
-- MONTABBORD - Schéma Supabase (PostgreSQL)
-- À coller dans : Supabase Dashboard > SQL Editor > New query
-- Ce schéma reproduit fidèlement la structure Firestore actuelle.
-- Les données métier (mdb_*) sont stockées en JSONB : aucune perte.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLE PRINCIPALE : enterprises
--    Équivalent de la collection Firestore 'enterprises'
--    Une ligne = une entreprise. Toutes les données métier
--    (mdb_clients, mdb_factures, mdb_bc, mdb_employes, ...)
--    vont dans la colonne JSONB 'data'.
-- ------------------------------------------------------------
create table if not exists public.enterprises (
  id          text primary key,                 -- uid de l'entreprise (ex: cred.user.uid)
  identifiant text unique,                      -- identifiant de connexion entreprise
  email       text,
  nom         text,
  data        jsonb not null default '{}'::jsonb, -- tous les champs mdb_* + formeJuridique, siret...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.enterprises.data is
  'Contenu du document Firestore : mdb_clients, mdb_nomenclature, mdb_caisses, mdb_stocks, mdb_bc, mdb_factures, mdb_reglements, mdb_employes, mdb_comptabilite, subscription, etc.';

-- ------------------------------------------------------------
-- 2. INDEX ENTREPRISES
--    Équivalent de 'enterpriseIndex' : retrouve l'uid
--    d'une entreprise à partir de son identifiant.
-- ------------------------------------------------------------
create table if not exists public.enterprise_index (
  identifiant text primary key,
  uid         text not null,
  email       text,
  nom         text
);

-- ------------------------------------------------------------
-- 3. SESSIONS (sous-collection enterprises/{uid}/sessions)
--    Verrouille une session par utilisateur (un seul appareil).
-- ------------------------------------------------------------
create table if not exists public.sessions (
  enterprise_id text not null references public.enterprises(id) on delete cascade,
  user_id       text not null,
  token         text,
  updated_at    timestamptz not null default now(),
  primary key (enterprise_id, user_id)
);

-- ------------------------------------------------------------
-- 4. SAUVEGARDES (sous-collection enterprises/{uid}/backups)
-- ------------------------------------------------------------
create table if not exists public.backups (
  enterprise_id text not null references public.enterprises(id) on delete cascade,
  ts            bigint not null,                -- timestamp JS (Date.now())
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  primary key (enterprise_id, ts)
);

-- ------------------------------------------------------------
-- 5. CLÉS DE LICENCE (collection 'licenseKeys')
-- ------------------------------------------------------------
create table if not exists public.license_keys (
  code    text primary key,
  used    boolean not null default false,
  used_by text,
  used_at date
);

-- ------------------------------------------------------------
-- 6. CODES DE RÉINITIALISATION (collection 'resetCodes')
-- ------------------------------------------------------------
create table if not exists public.reset_codes (
  email_key text primary key,                   -- email avec '.' remplacé par '_'
  code      text,
  expiry    bigint,
  email     text
);

-- ------------------------------------------------------------
-- 7. CONFIG SUPER ADMIN (collection 'superAdmin', doc 'config')
-- ------------------------------------------------------------
create table if not exists public.super_admin_config (
  id       int primary key default 1 check (id = 1),
  login    text,
  password text,
  nom      text
);

-- ============================================================
-- INDEX DE PERFORMANCE
-- ============================================================
create index if not exists idx_enterprises_email on public.enterprises(email);
create index if not exists idx_sessions_token    on public.sessions(token);
create index if not exists idx_backups_ent       on public.backups(enterprise_id, ts desc);

-- ============================================================
-- SÉCURITÉ : Row Level Security (RLS)
-- Même comportement que firestore.rules actuelles (permissives),
-- mais avec une base saine pour renforcer la sécurité plus tard.
-- ============================================================
alter table public.enterprises        enable row level security;
alter table public.enterprise_index   enable row level security;
alter table public.sessions           enable row level security;
alter table public.backups            enable row level security;
alter table public.license_keys       enable row level security;
alter table public.reset_codes        enable row level security;
alter table public.super_admin_config enable row level security;

-- Politiques transitoires (= règles Firestore actuelles, ouvertes).
-- ⚠️ À renforcer après la migration (voir plan-migration.md) :
--    remplacer par des politiques basées sur auth.uid().
create policy "enterprises_public_access" on public.enterprises
  for all using (true) with check (true);

create policy "enterprise_index_read_public" on public.enterprise_index
  for select using (true);
create policy "enterprise_index_write_auth" on public.enterprise_index
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "sessions_public_access" on public.sessions
  for all using (true) with check (true);

create policy "backups_public_access" on public.backups
  for all using (true) with check (true);

create policy "license_keys_read_public" on public.license_keys
  for select using (true);
create policy "license_keys_write_auth" on public.license_keys
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "reset_codes_auth_access" on public.reset_codes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "super_admin_public_access" on public.super_admin_config
  for all using (true) with check (true);

-- ============================================================
-- TEMPS RÉEL (remplace onSnapshot de Firestore)
-- ============================================================
alter publication supabase_realtime add table public.enterprises;
alter publication supabase_realtime add table public.sessions;

-- ============================================================
-- MISE À JOUR AUTOMATIQUE de updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enterprises_updated_at on public.enterprises;
create trigger trg_enterprises_updated_at
  before update on public.enterprises
  for each row execute function public.set_updated_at();
