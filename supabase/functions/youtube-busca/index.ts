// ============================================================
// Edge Function "youtube-busca" — pesquisa Shorts públicos no YouTube
// pela API oficial (YouTube Data API v3) para o Viral Radar.
//
// POST { q, dias?: 7|30|90|365, idioma?: "pt"|"en"|"", ordem?: "viewCount"|"relevance"|"date" }
// Só a dona (login do painel) pode usar. A chave do YouTube fica no
// segredo YOUTUBE_API_KEY do Supabase e nunca vai para o navegador.
// Cota grátis: ~100 pesquisas por dia (cada pesquisa gasta ~101 unidades de 10.000).
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const DONA = "naomicristina166@gmail.com";
const API = "https://www.googleapis.com/youtube/v3";
const CORS = {
  "Access-Control-Allow-Origin": "https://naomicristina166-coder.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function segundos(iso: string) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : null;
}

async function yt(caminho: string, params: Record<string, string>, chave: string) {
  const u = new URL(`${API}/${caminho}`);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  u.searchParams.set("key", chave);
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const motivo = j.error?.errors?.[0]?.reason || "";
    const e = new Error(motivo === "quotaExceeded" ? "Acabou a cota grátis de pesquisas de hoje. Volta amanhã." :
      (motivo === "keyInvalid" || r.status === 400 && /API key/i.test(j.error?.message || "")) ? "A chave do YouTube é inválida. Confira o segredo YOUTUBE_API_KEY." :
      (j.error?.message || `Erro ${r.status} do YouTube`));
    throw e;
  }
  return j;
}

export default {
  fetch: withSupabase({ auth: ["user"] }, async (req: Request, ctx: any) => {
    if (req.method !== "POST") return resposta({ erro: "Use POST" }, 405);
    if (ctx.userClaims?.email !== DONA) return resposta({ erro: "Sem permissão" }, 401);
    const chave = Deno.env.get("YOUTUBE_API_KEY");
    if (!chave) return resposta({ erro: "sem_chave" }, 400);

    let corpo: any = {};
    try { corpo = await req.json(); } catch (_) { /* vazio */ }
    const q = String(corpo.q || "").trim().slice(0, 120);
    if (q.length < 2) return resposta({ erro: "Digite o que você quer pesquisar." }, 400);
    const dias = [7, 30, 90, 365].includes(Number(corpo.dias)) ? Number(corpo.dias) : 30;
    const idioma = ["pt", "en"].includes(corpo.idioma) ? corpo.idioma : "";
    const ordem = ["viewCount", "relevance", "date"].includes(corpo.ordem) ? corpo.ordem : "viewCount";

    try {
      const busca = await yt("search", {
        part: "snippet", type: "video", videoDuration: "short", maxResults: "25", q, order: ordem,
        publishedAfter: new Date(Date.now() - dias * 86400e3).toISOString(),
        relevanceLanguage: idioma, regionCode: idioma === "pt" ? "BR" : idioma === "en" ? "US" : "",
        safeSearch: "moderate",
      }, chave);
      const ids = (busca.items || []).map((i: any) => i.id?.videoId).filter(Boolean);
      if (!ids.length) return resposta({ ok: true, itens: [] });
      const det = await yt("videos", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, chave);
      const agora = Date.now();
      const itens = (det.items || []).map((v: any) => {
        const pub = new Date(v.snippet?.publishedAt).getTime();
        const views = Number(v.statistics?.viewCount ?? NaN);
        const dias = Math.max(1, (agora - pub) / 86400e3);
        return {
          id: v.id,
          url: `https://www.youtube.com/shorts/${v.id}`,
          titulo: v.snippet?.title || "",
          canal: v.snippet?.channelTitle || "",
          publicado_em: v.snippet?.publishedAt || null,
          descricao: String(v.snippet?.description || "").slice(0, 600),
          capa: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || null,
          duracao_seg: segundos(v.contentDetails?.duration),
          views: isFinite(views) ? views : null,
          curtidas: v.statistics?.likeCount != null ? Number(v.statistics.likeCount) : null,
          comentarios: v.statistics?.commentCount != null ? Number(v.statistics.commentCount) : null,
          views_dia: isFinite(views) ? Math.round(views / dias) : null,
        };
      });
      return resposta({ ok: true, consultado_em: new Date().toISOString(), itens });
    } catch (e) {
      return resposta({ erro: (e as Error).message }, 502);
    }
  }),
};
