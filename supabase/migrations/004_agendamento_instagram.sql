/* ============================================================
   004 · Coleta automática do Instagram a cada 6 horas
   Chama a Edge Function "instagram" com { acao: "sync" }.
   Usa só a chave pública (a mesma do site): a função não devolve
   dados para quem não é a dona, só dispara a coleta.
   Para pausar:  select cron.unschedule('instagram-coleta');
   ============================================================ */
select cron.schedule(
  'instagram-coleta',
  '23 */6 * * *',
  $$
  select net.http_post(
    url := 'https://jyimhzrsroouelujecyq.supabase.co/functions/v1/instagram',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_PTo7rRU_bsS0clRf7r0GFA_vez_TnHc"}'::jsonb,
    body := '{"acao":"sync"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Conferência
select jobname, schedule, active from cron.job where jobname = 'instagram-coleta';
