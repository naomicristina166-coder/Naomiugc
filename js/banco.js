/* ============================================================
   Conexão com o Supabase. Fica num lugar só e é usada por todas
   as páginas (portfólio, login e admin).

   A chave abaixo é a chave PÚBLICA (publishable). Ela pode ficar
   neste arquivo. Quem protege os seus dados é a tranca (RLS) do
   banco, criada pelo arquivo banco.sql.

   NUNCA coloque aqui a chave secreta (secret / service_role).

   Este arquivo precisa vir DEPOIS do script do Supabase (CDN).
   ============================================================ */
window.SUPABASE_URL = "https://jyimhzrsroouelujecyq.supabase.co";
window.SUPABASE_CHAVE = "sb_publishable_PTo7rRU_bsS0clRf7r0GFA_vez_TnHc";

/* Se o CDN do Supabase não carregar (sem internet, por exemplo), o db fica null
   e cada página trata isso sem quebrar. */
window.db = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_CHAVE)
  : null;
