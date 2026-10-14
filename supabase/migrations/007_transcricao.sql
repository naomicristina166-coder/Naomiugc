/* 007 · Campo de transcrição nas referências do Viral Radar */
alter table public.referencias add column if not exists transcricao text;
select count(*) as referencias_ok from public.referencias;
