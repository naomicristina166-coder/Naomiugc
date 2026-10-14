/* ============================================================
   006 · Banco de ideias (vídeos, ganchos, roteiros)
   ============================================================ */
create table if not exists public.ideias (
  id               uuid primary key default gen_random_uuid(),
  texto            text not null check (char_length(texto) between 1 and 4000),
  tipo             text not null default 'video' check (tipo in ('video','gancho','roteiro','outro')),
  status           text not null default 'nova' check (status in ('nova','desenvolvendo','pronta','gravada','descartada')),
  marca_id         uuid references public.marcas(id) on delete set null,
  perfil_id        uuid references public.perfis(id) on delete set null,
  notas            text,
  desenvolvimento  text,
  favorito         boolean not null default false,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists ideias_status_idx on public.ideias (status, criado_em desc);

alter table public.ideias enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ideias' and policyname='so_a_dona_ideias') then
    create policy so_a_dona_ideias on public.ideias for all to authenticated
      using ((select auth.jwt() ->> 'email') = 'naomicristina166@gmail.com')
      with check ((select auth.jwt() ->> 'email') = 'naomicristina166@gmail.com');
  end if;
end $$;
revoke all on public.ideias from anon;
select count(*) as ideias_ok from public.ideias;
