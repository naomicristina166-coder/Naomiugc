/* ============================================================
   001 · Base do Content Intelligence
   Perfis que a Naomi administra, publicações e o histórico de métricas.

   Segurança: mesmo padrão das outras tabelas (só a dona, pelo e-mail
   do login, lê e escreve). Nada aqui é público.

   Pode rodar mais de uma vez sem estragar nada (if not exists).
   ============================================================ */

-- Perfis/contas (um por plataforma)
create table if not exists public.perfis (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) between 1 and 120),
  plataforma  text not null check (plataforma in ('instagram','tiktok','youtube')),
  marca_id    uuid references public.marcas(id) on delete set null,
  url         text check (url is null or url ~* '^https?://'),
  ativo       boolean not null default true,
  obs         text,
  criado_em   timestamptz not null default now()
);

-- Histórico de seguidores de cada perfil
create table if not exists public.perfis_snapshots (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references public.perfis(id) on delete cascade,
  coletado_em  timestamptz not null default now(),
  seguidores   bigint check (seguidores is null or seguidores >= 0),
  origem       text not null default 'manual' check (origem in ('manual','api','importacao')),
  criado_em    timestamptz not null default now()
);
create index if not exists perfis_snapshots_perfil_idx on public.perfis_snapshots (perfil_id, coletado_em desc);

-- Publicações (cada vídeo postado num perfil)
create table if not exists public.publicacoes (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  campanha_id   uuid references public.campanhas(id) on delete set null,
  id_externo    text,
  url           text check (url is null or url ~* '^https?://'),
  titulo        text,
  publicado_em  timestamptz,
  formato       text,
  gancho        text,
  duracao_seg   numeric check (duracao_seg is null or duracao_seg >= 0),
  origem        text not null default 'manual' check (origem in ('manual','api','importacao')),
  obs           text,
  criado_em     timestamptz not null default now(),
  unique (perfil_id, id_externo)
);
create index if not exists publicacoes_perfil_idx on public.publicacoes (perfil_id, publicado_em desc);

-- Fotografias das métricas ao longo do tempo (24h, 72h, 7 dias...)
create table if not exists public.metricas_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  publicacao_id      uuid not null references public.publicacoes(id) on delete cascade,
  coletado_em        timestamptz not null default now(),
  views              bigint check (views is null or views >= 0),
  curtidas           bigint check (curtidas is null or curtidas >= 0),
  comentarios        bigint check (comentarios is null or comentarios >= 0),
  compartilhamentos  bigint check (compartilhamentos is null or compartilhamentos >= 0),
  salvamentos        bigint check (salvamentos is null or salvamentos >= 0),
  alcance            bigint check (alcance is null or alcance >= 0),
  tempo_medio_seg    numeric check (tempo_medio_seg is null or tempo_medio_seg >= 0),
  retencao_pct       numeric check (retencao_pct is null or retencao_pct between 0 and 100),
  cliques            bigint check (cliques is null or cliques >= 0),
  conversoes         bigint check (conversoes is null or conversoes >= 0),
  origem             text not null default 'manual' check (origem in ('manual','api','importacao')),
  obs                text,
  criado_em          timestamptz not null default now()
);
create index if not exists metricas_snapshots_pub_idx on public.metricas_snapshots (publicacao_id, coletado_em desc);

-- Segurança: só a dona
alter table public.perfis              enable row level security;
alter table public.perfis_snapshots    enable row level security;
alter table public.publicacoes         enable row level security;
alter table public.metricas_snapshots  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['perfis','perfis_snapshots','publicacoes','metricas_snapshots'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='so_a_dona_'||t) then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using ((select auth.jwt() ->> ''email'') = ''naomicristina166@gmail.com'')
           with check ((select auth.jwt() ->> ''email'') = ''naomicristina166@gmail.com'')',
        'so_a_dona_'||t, t);
    end if;
  end loop;
end $$;

-- Visitantes do site não têm nenhum acesso a estas tabelas
revoke all on public.perfis, public.perfis_snapshots, public.publicacoes, public.metricas_snapshots from anon;
