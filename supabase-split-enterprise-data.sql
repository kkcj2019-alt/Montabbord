/* ============================================================================
   MONTABBORD — Découpage du dossier entreprise (anti timeouts 57014)
   ----------------------------------------------------------------------------
   Contexte : tout le dossier (2,5 Mo) vivait dans UNE seule ligne
   enterprises.data. Chaque lecture/ecriture faisait timeouter Postgres
   (statement timeout, erreur 500) a 4 postes.

   Apres ce script : 1 ligne par rubrique dans enterprise_data.
   Chaque ecriture/lecture ne touche que des Ko -> requetes en millisecondes.

   MODE D'EMPLOI (a executer UNE fois dans Supabase Dashboard > SQL Editor) :
   1. Copier tout ce fichier, coller, cliquer Run.
   2. Verifier : Database > Publications > supabase_realtime doit afficher
      une table de plus (enterprise_data).
   3. L'application migre les donnees existantes TOUTE SEULE au premier
      chargement (l'ancienne colonne enterprises.data reste intacte en
      secours, rien n'est efface).

   Le script est rejouable sans risque (IF NOT EXISTS / DROP IF EXISTS).
   ============================================================================ */

-- 1) Table des rubriques : 1 ligne = 1 rubrique d'1 entreprise.
create table if not exists public.enterprise_data (
  enterprise_id text not null,
  cle text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (enterprise_id, cle)
);

-- 2) Droits : meme modele ouvert que le reste de l'application
--    (cle anon, comme enterprises aujourd'hui).
grant select, insert, update, delete on public.enterprise_data to anon, authenticated;

alter table public.enterprise_data enable row level security;

drop policy if exists "lecture libre" on public.enterprise_data;
create policy "lecture libre"
  on public.enterprise_data for select
  using (true);

drop policy if exists "ecriture libre" on public.enterprise_data;
create policy "ecriture libre"
  on public.enterprise_data for insert
  with check (true);

drop policy if exists "modif libre" on public.enterprise_data;
create policy "modif libre"
  on public.enterprise_data for update
  using (true)
  with check (true);

drop policy if exists "suppression libre" on public.enterprise_data;
create policy "suppression libre"
  on public.enterprise_data for delete
  using (true);

-- 3) Temps reel : ne rediffuser que la rubrique modifiee (des Ko),
--    au lieu du dossier entier (des Mo).
alter publication supabase_realtime add table public.enterprise_data;

-- 4) Verification (doit afficher 1 ligne : enterprise_data).
select tablename as table_ok
from pg_tables
where schemaname = 'public' and tablename = 'enterprise_data';
