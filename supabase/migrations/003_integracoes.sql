/* ============================================================
   003 · Integrações com as redes (começando pelo Instagram)

   - integracoes: status de cada conta conectada (o painel pode ler).
   - integracoes_tokens: as chaves de acesso. NINGUÉM lê pelo navegador:
     não tem regra de acesso para o site, só o servidor (Edge Functions,
     com a chave de serviço) consegue ler e escrever.
   - logs_coleta: registro de cada coleta, com erros e avisos.

   Pode rodar de novo sem estragar nada.
   ============================================================ */

create table if not exists public.integracoes (
  id                uuid primary key default gen_random_uuid(),
  perfil_id         uuid not null unique references public.perfis(id) on delete cascade,
  plataforma        text not null check (plataforma in ('instagram','tiktok','youtube')),
  conta_externa_id  text,
  usuario           text,
  status            text not null default 'ativa' check (status in ('ativa','reconectar','erro','pausada')),
  token_expira_em   timestamptz,
  ultimo_sync       timestamptz,
  ultimo_erro       text,
  metricas_indisponiveis text[],
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create table if not exists public.integracoes_tokens (
  integracao_id     uuid primary key references public.integracoes(id) on delete cascade,
  access_token      text not null,
  obtido_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create table if not exists public.logs_coleta (
  id            uuid primary key default gen_random_uuid(),
  integracao_id uuid references public.integracoes(id) on delete set null,
  plataforma    text,
  nivel         text not null default 'info' check (nivel in ('info','aviso','erro')),
  mensagem      text not null,
  detalhes      jsonb,
  criado_em     timestamptz not null default now()
);
create index if not exists logs_coleta_data_idx on public.logs_coleta (criado_em desc);

alter table public.integracoes         enable row level security;
alter table public.integracoes_tokens  enable row level security;
alter table public.logs_coleta         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['integracoes','logs_coleta'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='so_a_dona_'||t) then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using ((select auth.jwt() ->> ''email'') = ''naomicristina166@gmail.com'')
           with check ((select auth.jwt() ->> ''email'') = ''naomicristina166@gmail.com'')',
        'so_a_dona_'||t, t);
    end if;
  end loop;
end $$;

-- Tokens: sem nenhuma regra para o site. Só o servidor (service_role) acessa.
revoke all on public.integracoes_tokens from anon, authenticated;
revoke all on public.integracoes, public.logs_coleta from anon;

-- Coleta automática: liga as extensões de agendamento e de chamadas web
create extension if not exists pg_cron;
create extension if not exists pg_net;
