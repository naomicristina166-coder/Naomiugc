/* ============================================================
   005 · Relatórios mensais por marca
   Guarda os textos que a Naomi escreve em cada relatório
   (aprendizados, oportunidades e plano do próximo mês).
   Os números são calculados na hora a partir das métricas.
   ============================================================ */
create table if not exists public.relatorios (
  id             uuid primary key default gen_random_uuid(),
  marca_id       uuid not null references public.marcas(id) on delete cascade,
  mes            text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  idioma         text not null default 'pt' check (idioma in ('pt','en')),
  aprendizados   text,
  oportunidades  text,
  plano          text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (marca_id, mes)
);

alter table public.relatorios enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='relatorios' and policyname='so_a_dona_relatorios') then
    create policy so_a_dona_relatorios on public.relatorios for all to authenticated
      using ((select auth.jwt() ->> 'email') = 'naomicristina166@gmail.com')
      with check ((select auth.jwt() ->> 'email') = 'naomicristina166@gmail.com');
  end if;
end $$;
revoke all on public.relatorios from anon;
