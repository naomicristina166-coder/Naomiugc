// ============================================================
// Edge Function "instagram" — conecta perfis e coleta métricas.
//
// POST { acao: "conectar", perfil_id, token }  → só a dona (login do painel)
// POST { acao: "sync" }                         → coleta todas as contas ativas
//                                                 (agendada pelo pg_cron; quem
//                                                 chamar só dispara uma coleta,
//                                                 nunca recebe dados nem tokens)
//
// Os tokens ficam em integracoes_tokens, que o navegador não consegue ler.
// Usa a API do Instagram com login do Instagram (graph.instagram.com).
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const DONA = "naomicristina166@gmail.com";
const GRAPH = "https://graph.instagram.com";
const VERSAO = "v24.0";
const ORIGEM_SITE = "https://naomicristina166-coder.github.io";
const DIAS_METRICAS = 30;            // coleta métricas de vídeos com até 30 dias
const MIN_ENTRE_COLETAS_MIN = 10;    // evita coletas repetidas em sequência
const METRICAS = ["views", "reach", "likes", "comments", "shares", "saved", "ig_reels_avg_watch_time"];

// Cliente com acesso de servidor (ignora RLS). Vem do withSupabase a cada pedido.
// deno-lint-ignore no-explicit-any
let adm: any;

const CORS = {
  "Access-Control-Allow-Origin": ORIGEM_SITE,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class ErroIG extends Error {
  code?: number;
  constructor(msg: string, code?: number) { super(msg); this.code = code; }
}

async function ig(caminho: string, params: Record<string, string>) {
  const u = new URL(caminho.startsWith("http") ? caminho : `${GRAPH}/${VERSAO}/${caminho}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new ErroIG(j.error?.message || `HTTP ${r.status}`, j.error?.code);
  return j;
}

// deno-lint-ignore no-explicit-any
function ehDona(ctx: any) {
  return ctx.authMode === "user" && ctx.userClaims?.email === DONA;
}

async function log(integracao_id: string | null, nivel: "info" | "aviso" | "erro", mensagem: string, detalhes?: unknown) {
  await adm.from("logs_coleta").insert({ integracao_id, plataforma: "instagram", nivel, mensagem, detalhes: detalhes ?? null });
}

/* Renova o token (só funciona depois de 24h de vida; dura mais 60 dias) */
async function renovar(token: string) {
  const j = await ig(`${GRAPH}/refresh_access_token`, { grant_type: "ig_refresh_token", access_token: token });
  return { token: j.access_token as string, expira: new Date(Date.now() + (Number(j.expires_in) || 60 * 86400) * 1000).toISOString() };
}

function valor(item: any): number | null {
  const v = item?.values?.[0]?.value ?? item?.total_value?.value;
  return typeof v === "number" ? v : null;
}

/* Pede as métricas; se a API recusar alguma, descobre qual e guarda como indisponível */
async function insights(mediaId: string, token: string, indisponiveis: Set<string>) {
  const pedir = METRICAS.filter((m) => !indisponiveis.has(m));
  const out: Record<string, number | null> = {};
  try {
    const j = await ig(`${mediaId}/insights`, { metric: pedir.join(","), access_token: token });
    for (const it of j.data || []) out[it.name] = valor(it);
    return out;
  } catch (e) {
    if ((e as ErroIG).code === 190) throw e;
  }
  for (const m of pedir) {
    try {
      const j = await ig(`${mediaId}/insights`, { metric: m, access_token: token });
      out[m] = valor((j.data || [])[0]);
    } catch (e) {
      if ((e as ErroIG).code === 190) throw e;
      if ((e as ErroIG).code === 100) indisponiveis.add(m);
    }
  }
  return out;
}

async function coletar(integ: any, forcar = false) {
  const res = { usuario: integ.usuario, novos: 0, medidos: 0, avisos: [] as string[] };
  if (!forcar && integ.ultimo_sync && Date.now() - new Date(integ.ultimo_sync).getTime() < MIN_ENTRE_COLETAS_MIN * 60e3) {
    res.avisos.push("coletado há poucos minutos, pulei");
    return res;
  }
  const { data: tk } = await adm.from("integracoes_tokens").select("access_token, obtido_em").eq("integracao_id", integ.id).single();
  if (!tk) {
    await adm.from("integracoes").update({ status: "reconectar", ultimo_erro: "Chave não encontrada", atualizado_em: new Date().toISOString() }).eq("id", integ.id);
    return res;
  }
  let token = tk.access_token as string;
  const indisp = new Set<string>(integ.metricas_indisponiveis || []);
  try {
    // 1) renova a chave quando faltam menos de 15 dias
    const expira = integ.token_expira_em ? new Date(integ.token_expira_em).getTime() : 0;
    if (expira - Date.now() < 15 * 86400e3 && Date.now() - new Date(tk.obtido_em).getTime() > 86400e3) {
      try {
        const n = await renovar(token);
        token = n.token;
        await adm.from("integracoes_tokens").update({ access_token: token, obtido_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq("integracao_id", integ.id);
        await adm.from("integracoes").update({ token_expira_em: n.expira }).eq("id", integ.id);
        await log(integ.id, "info", "Chave renovada");
      } catch (e) {
        if ((e as ErroIG).code === 190) throw e;
        await log(integ.id, "aviso", "Não consegui renovar a chave: " + (e as Error).message);
      }
    }

    // 2) seguidores (no máximo 1 registro automático a cada 20h)
    const { data: ultSeg } = await adm.from("perfis_snapshots").select("coletado_em").eq("perfil_id", integ.perfil_id).eq("origem", "api").order("coletado_em", { ascending: false }).limit(1);
    if (!ultSeg?.length || Date.now() - new Date(ultSeg[0].coletado_em).getTime() > 20 * 3600e3) {
      try {
        const me = await ig("me", { fields: "followers_count", access_token: token });
        if (typeof me.followers_count === "number") await adm.from("perfis_snapshots").insert({ perfil_id: integ.perfil_id, seguidores: me.followers_count, origem: "api" });
      } catch (e) {
        if ((e as ErroIG).code === 190) throw e;
        res.avisos.push("seguidores indisponíveis");
      }
    }

    // 3) vídeos recentes
    const limite = Date.now() - 45 * 86400e3;
    let pagina: any = await ig("me/media", { fields: "id,caption,media_type,media_product_type,permalink,timestamp", limit: "50", access_token: token });
    const midias: any[] = [];
    for (let i = 0; i < 4 && pagina; i++) {
      const lote = pagina.data || [];
      midias.push(...lote);
      const ultima = lote[lote.length - 1];
      if (!pagina.paging?.next || !ultima || new Date(ultima.timestamp).getTime() < limite) break;
      pagina = await ig(pagina.paging.next, {});
    }
    const videos = midias.filter((m) => m.media_product_type === "REELS" || m.media_type === "VIDEO");

    const { data: existentes } = await adm.from("publicacoes").select("id, id_externo").eq("perfil_id", integ.perfil_id).not("id_externo", "is", null);
    const porExt = new Map((existentes || []).map((p: any) => [p.id_externo, p.id]));

    for (const m of videos) {
      let pubId = porExt.get(m.id);
      if (!pubId) {
        const legenda = String(m.caption || "").split("\n")[0].trim();
        const { data: nova, error } = await adm.from("publicacoes").insert({
          perfil_id: integ.perfil_id, id_externo: m.id, url: m.permalink || null,
          titulo: legenda ? legenda.slice(0, 80) : "Reel " + new Date(m.timestamp).toLocaleDateString("pt-BR"),
          publicado_em: m.timestamp, origem: "api",
        }).select("id").single();
        if (error) { res.avisos.push("não salvei um vídeo: " + error.message); continue; }
        pubId = nova.id; res.novos++;
      }
      if (Date.now() - new Date(m.timestamp).getTime() > DIAS_METRICAS * 86400e3) continue;
      const v = await insights(m.id, token, indisp);
      const ms = v.ig_reels_avg_watch_time;
      const { error } = await adm.from("metricas_snapshots").insert({
        publicacao_id: pubId, origem: "api",
        views: v.views ?? null, alcance: v.reach ?? null, curtidas: v.likes ?? null, comentarios: v.comments ?? null,
        compartilhamentos: v.shares ?? null, salvamentos: v.saved ?? null,
        tempo_medio_seg: typeof ms === "number" ? Math.round(ms / 100) / 10 : null,
      });
      if (error) res.avisos.push("não salvei métricas: " + error.message); else res.medidos++;
    }

    await adm.from("integracoes").update({
      status: "ativa", ultimo_sync: new Date().toISOString(), ultimo_erro: null,
      metricas_indisponiveis: [...indisp], atualizado_em: new Date().toISOString(),
    }).eq("id", integ.id);
    await log(integ.id, res.avisos.length ? "aviso" : "info", `Coleta: ${res.novos} vídeos novos, ${res.medidos} medidos`, { avisos: res.avisos, indisponiveis: [...indisp] });
  } catch (e) {
    const err = e as ErroIG;
    const reconectar = err.code === 190;
    const limite = [4, 17, 32, 613].includes(err.code ?? 0);
    await adm.from("integracoes").update({
      status: reconectar ? "reconectar" : "erro",
      ultimo_erro: reconectar ? "A chave venceu ou foi revogada. Gere uma nova e conecte de novo." : limite ? "Limite de pedidos do Instagram. Tento de novo na próxima coleta." : err.message,
      atualizado_em: new Date().toISOString(),
    }).eq("id", integ.id);
    await log(integ.id, "erro", err.message, { code: err.code ?? null });
    res.avisos.push(err.message);
  }
  return res;
}

async function conectar(perfil_id: string, token: string) {
  if (!perfil_id || typeof token !== "string" || token.trim().length < 20) return resposta({ erro: "Cole a chave inteira." }, 400);
  token = token.trim();
  const { data: perfil } = await adm.from("perfis").select("id, plataforma, nome").eq("id", perfil_id).single();
  if (!perfil) return resposta({ erro: "Perfil não encontrado." }, 404);
  if (perfil.plataforma !== "instagram") return resposta({ erro: "Este perfil não é do Instagram." }, 400);

  let me: any;
  try { me = await ig("me", { fields: "user_id,username,account_type", access_token: token }); }
  catch (e) { return resposta({ erro: "O Instagram recusou essa chave: " + (e as Error).message }, 400); }
  if (me.account_type && !["BUSINESS", "MEDIA_CREATOR"].includes(me.account_type)) {
    return resposta({ erro: `@${me.username} não é conta profissional. Mude para conta Empresa ou Criador de conteúdo no Instagram e tente de novo.` }, 400);
  }

  let expira = new Date(Date.now() + 60 * 86400e3).toISOString();
  try { const n = await renovar(token); token = n.token; expira = n.expira; } catch (_) { /* chave nova demais para renovar: renovo depois */ }

  const { data: integ, error } = await adm.from("integracoes").upsert({
    perfil_id, plataforma: "instagram", conta_externa_id: String(me.user_id ?? me.id ?? ""), usuario: me.username,
    status: "ativa", token_expira_em: expira, ultimo_erro: null, ultimo_sync: null, atualizado_em: new Date().toISOString(),
  }, { onConflict: "perfil_id" }).select("*").single();
  if (error) return resposta({ erro: "Não consegui salvar: " + error.message }, 500);
  const { error: e2 } = await adm.from("integracoes_tokens").upsert({ integracao_id: integ.id, access_token: token, obtido_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });
  if (e2) return resposta({ erro: "Não consegui guardar a chave: " + e2.message }, 500);
  await log(integ.id, "info", `Conectado como @${me.username}`);

  const r = await coletar(integ, true);
  return resposta({ ok: true, usuario: me.username, coleta: r });
}

// "user": pedido do painel com o login da dona. "none": coleta agendada (pg_cron),
// que só dispara a coleta e não recebe dados.
export default {
  fetch: withSupabase({ auth: ["user", "none"] }, async (req: Request, ctx: any) => {
  adm = ctx.supabaseAdmin;
  if (req.method !== "POST") return resposta({ erro: "Use POST" }, 405);
  let corpo: any = {};
  try { corpo = await req.json(); } catch (_) { /* vazio */ }

  if (corpo.acao === "conectar") {
    if (!ehDona(ctx)) return resposta({ erro: "Sem permissão" }, 401);
    return await conectar(corpo.perfil_id, corpo.token);
  }

  if (corpo.acao === "sync") {
    const dona = ehDona(ctx);
    let q = adm.from("integracoes").select("*").eq("plataforma", "instagram").in("status", ["ativa", "erro"]);
    if (dona && corpo.perfil_id) q = q.eq("perfil_id", corpo.perfil_id);
    const { data: lista } = await q;
    const resultados = [];
    for (const integ of lista || []) resultados.push(await coletar(integ, false));
    // quem não é a dona só fica sabendo quantas contas foram processadas
    return resposta(dona ? { ok: true, resultados } : { ok: true, contas: resultados.length });
  }

  return resposta({ erro: "Ação desconhecida" }, 400);
  }),
};
