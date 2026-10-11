/* ============================================================
   002 · Viral Radar e Biblioteca de Ganchos
   - referencias: vídeos de outras contas que servem de inspiração
     (só informações públicas, registradas à mão).
   - referencias_snapshots: views observadas em datas diferentes,
     para saber se o vídeo está crescendo AGORA ou só acumulou views.
   - ganchos: biblioteca de ganchos verbais e visuais.
   - publicacoes.gancho_id: liga o vídeo ao gancho usado.

   Segurança: só a dona lê e escreve. Pode rodar de novo sem estragar.
   ============================================================ */

create table if not exists public.referencias (
  id                 uuid primary key default gen_random_uuid(),
  url                text not null check (url ~* '^https?://'),
  plataforma         text check (plataforma is null or plataforma in ('instagram','tiktok','youtube','outra')),
  perfil             text,
  titulo             text,
  publicado_em       date,
  categoria          text,
  tema               text,
  formato            text,
  gancho_verbal      text,
  gancho_visual      text,
  introducao         text,
  formato_narrativo  text,
  ritmo_edicao       text,
  texto_tela         text,
  demo_app           text,
  cta                text,
  hipoteses          text,
  obs                text,
  favorito           boolean not null default false,
  criado_em          timestamptz not null default now()
);

create table if not exists public.referencias_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  referencia_id      uuid not null references public.referencias(id) on delete cascade,
  observado_em       timestamptz not null default now(),
  views              bigint check (views is null or views >= 0),
  curtidas           bigint check (curtidas is null or curtidas >= 0),
  comentarios        bigint check (comentarios is null or comentarios >= 0),
  compartilhamentos  bigint check (compartilhamentos is null or compartilhamentos >= 0),
  origem             text not null default 'manual' check (origem in ('manual','api','importacao')),
  criado_em          timestamptz not null default now()
);
create index if not exists referencias_snapshots_ref_idx on public.referencias_snapshots (referencia_id, observado_em desc);

create table if not exists public.ganchos (
  id             uuid primary key default gen_random_uuid(),
  texto          text not null check (char_length(texto) between 1 and 1000),
  tipo           text not null default 'verbal' check (tipo in ('verbal','visual')),
  categoria      text,
  origem         text not null default 'meu' check (origem in ('meu','referencia','ideia')),
  referencia_id  uuid references public.referencias(id) on delete set null,
  favorito       boolean not null default false,
  obs            text,
  criado_em      timestamptz not null default now()
);

alter table public.publicacoes add column if not exists gancho_id uuid references public.ganchos(id) on delete set null;
create index if not exists publicacoes_gancho_idx on public.publicacoes (gancho_id);

alter table public.referencias            enable row level security;
alter table public.referencias_snapshots  enable row level security;
alter table public.ganchos                enable row level security;

do $$
declare t text;
begin
  foreach t in array array['referencias','referencias_snapshots','ganchos'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='so_a_dona_'||t) then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using ((select auth.jwt() ->> ''email'') = ''naomicristina166@gmail.com'')
           with check ((select auth.jwt() ->> ''email'') = ''naomicristina166@gmail.com'')',
        'so_a_dona_'||t, t);
    end if;
  end loop;
end $$;

revoke all on public.referencias, public.referencias_snapshots, public.ganchos from anon;
