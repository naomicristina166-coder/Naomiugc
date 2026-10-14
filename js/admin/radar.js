/* ============================================================
   VIRAL RADAR e BIBLIOTECA DE GANCHOS (UGC Tech Canvas · Etapa 4)

   Viral Radar
   - Referências de outras contas, registradas à mão, só com o que é público.
   - Cada "observação" guarda as views numa data. Com 2 ou mais, dá para
     saber se o vídeo está crescendo AGORA ou se só acumulou views com o tempo.
   - Com uma observação só, o painel avisa que não dá para confirmar.

   Biblioteca de ganchos
   - Ganchos verbais e visuais, dos seus vídeos, das referências ou ideias.
   - Cada gancho mostra os vídeos em que foi usado e o resultado comparado
     com o normal do perfil, com o nível de evidência (1 vídeo não prova nada).
   ============================================================ */
(function(){
  var CAT_GANCHO = ['Curiosidade','Problema e solução','Demonstração de aplicativo','Reação','Tutorial','Descoberta de funcionalidade','Comparação','Antes e depois','Benefício principal','Surpresa','Pergunta','História curta'];
  var CAT_RADAR = ['Aplicativos','Ferramentas de IA','Produtividade','Gadgets','Tutorial de tecnologia','Demonstração de funcionalidade','Finanças e apps','Educação e apps','Outros'];
  var FORMATOS = ['Demonstração de app','Tutorial','Descoberta de funcionalidade','Problema e solução','Comparação','Antes e depois','Reação','Review','História curta','Lista / top'];
  var PLAT_R = [['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube'],['outra','Outra']];
  var TABELAS = ['referencias','referencias_snapshots','ganchos'];
  var DIA = 864e5;
  var R = {busca:'', cat:'', fmt:'', plat:'', per:'tudo', vel:'', ord:'recente', fav:false};
  var G = {busca:'', cat:'', tipo:'', orig:'', fav:false};

  var U = function(){ return window.ModConteudo.util; };
  var C = function(){ return window.ModConteudo._calc; };
  function n(x){ return x == null ? '—' : Number(x).toLocaleString('pt-BR'); }
  function curto(x){ return U().curto(x); }
  function dataBr(d){ return d ? new Date(d).toLocaleDateString('pt-BR') : '—'; }
  function soData(d){ return d ? (String(d).length === 10 ? new Date(d + 'T12:00:00') : new Date(d)) : null; }
  function nomePlatR(p){ var x = PLAT_R.find(function(o){ return o[0] === p; }); return x ? x[1] : ''; }
  function vezes(x){ return x.toLocaleString('pt-BR', {maximumFractionDigits:1}) + 'x'; }
  function porDia(x){ return curto(Math.round(x)) + '/dia'; }

  /* ---------- velocidade de uma referência ---------- */
  function obsDe(id){
    return S.referencias_snapshots.filter(function(s){ return s.referencia_id === id && s.views != null; })
      .sort(function(a, b){ return new Date(a.observado_em) - new Date(b.observado_em); });
  }
  function velocidade(ref, obs, agora){
    agora = agora || Date.now();
    obs = obs || obsDe(ref.id);
    var pub = soData(ref.publicado_em), pubMs = pub ? pub.getTime() : NaN;
    if(!obs.length) return {st:'sem', rot:'Sem views', txt:'Nenhuma observação de views ainda.', recente:null, views:null};
    var ult = obs[obs.length - 1], tUlt = new Date(ult.observado_em).getTime(), views = Number(ult.views);
    var velha = (agora - tUlt) / DIA > 14 ? ' Última observação há ' + Math.round((agora - tUlt) / DIA) + ' dias: pode ter mudado.' : '';
    if(obs.length === 1){
      var media = isFinite(pubMs) && tUlt > pubMs ? views / Math.max(1, (tUlt - pubMs) / DIA) : null;
      return {st:'unica', rot:'Sem histórico', views:views, recente:null, media:media,
        txt:'Só 1 observação' + (media !== null ? ': média de ' + porDia(media) + ' desde a publicação' : '') + '. Não dá para confirmar se está crescendo agora. Registre de novo em 1 a 3 dias.' + velha};
    }
    var ant = obs[obs.length - 2], tAnt = new Date(ant.observado_em).getTime();
    var dias = Math.max(1 / 24, (tUlt - tAnt) / DIA);
    var recente = Math.max(0, (views - Number(ant.views)) / dias);
    var antes = null;
    if(isFinite(pubMs) && tAnt > pubMs) antes = Number(ant.views) / Math.max(1, (tAnt - pubMs) / DIA);
    else if(obs.length >= 3){ var a2 = obs[obs.length - 3]; antes = Math.max(0, (Number(ant.views) - Number(a2.views)) / Math.max(1 / 24, (tAnt - new Date(a2.observado_em).getTime()) / DIA)); }
    var base = porDia(recente) + ' entre ' + dataBr(ant.observado_em) + ' e ' + dataBr(ult.observado_em);
    if(antes === null || antes <= 0) return {st:'medido', rot:'Medido', views:views, recente:recente, txt:base + '. Sem data de publicação para comparar com o ritmo anterior.' + velha};
    var r = recente / antes;
    if(r >= 1.2) return {st:'acelerando', rot:'Crescendo agora', views:views, recente:recente, razao:r, txt:base + ', ' + vezes(r) + ' o ritmo anterior (' + porDia(antes) + ').' + velha};
    if(r >= 0.5) return {st:'estavel', rot:'Ritmo estável', views:views, recente:recente, razao:r, txt:base + ', parecido com o ritmo anterior (' + porDia(antes) + ').' + velha};
    return {st:'acumulado', rot:'Desacelerando', views:views, recente:recente, razao:r, txt:base + ', bem abaixo do ritmo anterior (' + porDia(antes) + '). As views são mais acúmulo do que crescimento atual.' + velha};
  }
  var COR_VEL = {acelerando:'s-cliente', estavel:'s-conversando', acumulado:'s-parada', unica:'s-lead', medido:'s-conversando', sem:''};

  /* ---------- evidência de um gancho ---------- */
  function evidencia(g){
    var c = C(), por = c.indexarSnaps(S.metricas_snapshots);
    var vids = S.publicacoes.filter(function(p){ return p.gancho_id === g.id; });
    var razoes = [];
    vids.forEach(function(p){
      var s = c.ultimo(por, p), i = s ? c.idadeH(p, s) : null;
      if(i === null || i < 72) return;
      var r = c.relativo(p, S.publicacoes, por, Math.min(i, 168));
      if(r && r.razao !== null) razoes.push(r.razao);
    });
    var med = c.mediana(razoes), k = razoes.length;
    var res = {vids:vids, n:k, mediana:med};
    if(!vids.length){ res.nivel = 'nao'; res.txt = 'Ainda não usado nos seus vídeos.'; }
    else if(!k){ res.nivel = 'sem'; res.txt = 'Usado em ' + vids.length + ' vídeo(s), ainda sem comparação (precisa de 3 dias e de outros vídeos do perfil medidos).'; }
    else if(k === 1){ res.nivel = 'um'; res.txt = '1 vídeo comparado: ' + vezes(med) + ' o normal do perfil. Uma observação só não permite concluir.'; }
    else if(k < 4){ res.nivel = 'pista'; res.txt = 'Pista com ' + k + ' vídeos: mediana de ' + vezes(med) + ' o normal do perfil.'; }
    else {
      var acima = razoes.filter(function(x){ return x >= 1; }).length, frac = Math.max(acima, k - acima) / k;
      if(frac >= 0.75){ res.nivel = 'padrao'; res.txt = 'Padrão observado em ' + k + ' vídeos: mediana de ' + vezes(med) + ' o normal (' + acima + ' de ' + k + ' acima).'; }
      else { res.nivel = 'misto'; res.txt = 'Resultados mistos em ' + k + ' vídeos (' + acima + ' acima, ' + (k - acima) + ' abaixo do normal).'; }
    }
    return res;
  }
  var COR_EV = {nao:'', sem:'', um:'s-lead', pista:'s-conversando', padrao:'s-cliente', misto:'s-parada'};
  var ROT_EV = {nao:'Não testado', sem:'Sem comparação', um:'1 observação', pista:'Pista', padrao:'Padrão observado', misto:'Misto'};

  /* ---------- carregar ---------- */
  async function carregarTabela(t){
    try{
      var tudo = [], de = 0;
      for(;;){
        var r = await window.db.from(t).select('*').order('criado_em', {ascending:true}).range(de, de + 999);
        if(r.error) throw r.error;
        tudo = tudo.concat(r.data || []);
        if(!r.data || r.data.length < 1000) break; de += 1000;
      }
      S[t] = tudo; delete falta[t];
    }catch(e){ S[t] = []; falta[t] = msgErro(e); }
  }
  function carregar(){ return Promise.all(TABELAS.map(carregarTabela)); }

  /* ---------- helpers de tela ---------- */
  function sel(id, rot, ops, val){
    return '<select id="' + id + '" aria-label="' + rot + '"><option value="">' + rot + '</option>' + ops.map(function(o){ o = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function usados(lista, k, base){
    var s = {}; (base || []).forEach(function(x){ s[x] = true; }); lista.forEach(function(x){ if(x[k]) s[x[k]] = true; });
    return Object.keys(s).sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); });
  }
  function estrela(on, acao, id){
    return '<button class="ic-btn" data-acao="' + acao + '" data-id="' + esc(id) + '" aria-label="' + (on ? 'Tirar dos favoritos' : 'Favoritar') + '" title="' + (on ? 'Favorito' : 'Favoritar') + '" style="' + (on ? 'color:var(--red)' : '') + '"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="' + (on ? 'fill:currentColor' : '') + '"><polygon points="12 2 15 9 22 9.3 16.5 14 18.2 21 12 17 5.8 21 7.5 14 2 9.3 9 9"/></svg></button>';
  }

  /* ============================================================
     VIRAL RADAR
     ============================================================ */
  function refsFiltradas(){
    var b = R.busca.trim().toLowerCase(), agora = Date.now();
    var l = S.referencias.map(function(r){ return {r:r, v:velocidade(r, null, agora)}; }).filter(function(x){
      var r = x.r;
      if(R.fav && !r.favorito) return false;
      if(R.cat && r.categoria !== R.cat) return false;
      if(R.fmt && r.formato !== R.fmt) return false;
      if(R.plat && r.plataforma !== R.plat) return false;
      if(R.vel && x.v.st !== R.vel) return false;
      if(R.per !== 'tudo'){ var d = soData(r.publicado_em); if(!d || agora - d.getTime() > Number(R.per) * DIA) return false; }
      if(b && ![r.titulo, r.tema, r.perfil, r.gancho_verbal, r.gancho_visual, r.categoria, r.hipoteses].some(function(x){ return String(x || '').toLowerCase().indexOf(b) > -1; })) return false;
      return true;
    });
    var num = function(x){ return x == null ? -1 : x; };
    if(R.ord === 'velocidade') l.sort(function(a, b){ return num(b.v.recente) - num(a.v.recente); });
    else if(R.ord === 'views') l.sort(function(a, b){ return num(b.v.views) - num(a.v.views); });
    else l.sort(function(a, b){ return new Date(b.r.criado_em) - new Date(a.r.criado_em); });
    return l;
  }

  function vRadar(){
    var h = avisoFalta(TABELAS);
    if(window.ModPesquisa) h += window.ModPesquisa.painel();
    h += '<p class="muted" style="margin-bottom:12px;font-size:.85rem">Referências do nicho Tech UGC para inspirar seus próximos vídeos. Registre só o que é público. Para saber se um vídeo está crescendo <b>agora</b>, registre as views em pelo menos 2 dias diferentes.</p>';
    h += '<div class="barra"><input type="search" id="rd-busca" style="flex:1 1 220px;min-width:180px" placeholder="Buscar por tema, @, gancho..." aria-label="Buscar referências" value="' + esc(R.busca) + '">' +
      sel('rd-cat', 'Todas as categorias', usados(S.referencias, 'categoria', CAT_RADAR), R.cat) +
      sel('rd-fmt', 'Todos os formatos', usados(S.referencias, 'formato', FORMATOS), R.fmt) +
      sel('rd-plat', 'Todas as plataformas', PLAT_R, R.plat) +
      '<select id="rd-per" aria-label="Publicado em"><option value="tudo"' + (R.per === 'tudo' ? ' selected' : '') + '>Qualquer data</option>' + [['7','Publicado em 7 dias'],['30','Publicado em 30 dias'],['90','Publicado em 90 dias']].map(function(o){ return '<option value="' + o[0] + '"' + (R.per === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      sel('rd-vel', 'Qualquer desempenho', [['acelerando','Crescendo agora'],['estavel','Ritmo estável'],['acumulado','Desacelerando'],['unica','Sem histórico'],['sem','Sem views']], R.vel) +
      '<select id="rd-ord" aria-label="Ordenar"><option value="recente"' + (R.ord === 'recente' ? ' selected' : '') + '>Mais recentes</option><option value="velocidade"' + (R.ord === 'velocidade' ? ' selected' : '') + '>Mais rápidas agora</option><option value="views"' + (R.ord === 'views' ? ' selected' : '') + '>Mais views</option></select>' +
      '<label class="chk"><input type="checkbox" id="rd-fav"' + (R.fav ? ' checked' : '') + '> Só favoritas</label>' +
      '<span class="espaco"></span><button class="btn cheio" data-acao="radar-nova">' + ic('mais') + 'Adicionar referência</button></div><div id="rd-lista"></div>';
    return h;
  }
  function pintarRadar(){
    var alvo = $('#rd-lista'); if(!alvo) return;
    var l = refsFiltradas();
    if(!l.length){ alvo.innerHTML = '<div class="vazio">' + (S.referencias.length ? 'Nenhuma referência com esses filtros.' : 'Nenhuma referência ainda. Achou um vídeo do nicho que chamou atenção? Clique em "Adicionar referência", cole o link e anote o gancho, o formato e as views de hoje.') + '</div>'; return; }
    alvo.innerHTML = '<div class="rolagem"><table style="min-width:980px"><thead><tr><th></th><th>Referência</th><th>Categoria / formato</th><th>Publicado</th><th>Views</th><th>Desempenho</th><th>Gancho</th><th></th></tr></thead><tbody>' +
      l.map(function(x){
        var r = x.r, v = x.v, link = seguro(r.url), obs = obsDe(r.id), ult = obs[obs.length - 1];
        return '<tr><td>' + estrela(r.favorito, 'radar-fav', r.id) + '</td>' +
          '<td><b>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(r.titulo || r.tema || 'Ver vídeo') + '</a>' : esc(r.titulo || r.tema || '')) + '</b><div class="muted" style="font-size:.78rem">' + esc([r.perfil, nomePlatR(r.plataforma)].filter(Boolean).join(' · ')) + '</div></td>' +
          '<td>' + esc(r.categoria || '') + (r.formato ? '<div class="muted" style="font-size:.78rem">' + esc(r.formato) + '</div>' : '') + '</td>' +
          '<td>' + dataBr(soData(r.publicado_em)) + '</td>' +
          '<td>' + (ult ? '<b>' + curto(ult.views) + '</b><div class="muted" style="font-size:.78rem">em ' + dataBr(ult.observado_em) + '</div>' : '—') + '</td>' +
          '<td><span class="pilula ' + COR_VEL[v.st] + '" title="' + esc(v.txt) + '">' + v.rot + '</span>' + (v.recente != null ? '<div class="muted" style="font-size:.78rem">' + porDia(v.recente) + '</div>' : '') + '</td>' +
          '<td style="max-width:240px;font-size:.85rem">' + esc(r.gancho_verbal || r.gancho_visual || '') + '</td>' +
          '<td><div class="acoes"><button class="btn mini" data-acao="radar-obs" data-id="' + esc(r.id) + '">+ Views</button><button class="btn mini" data-acao="radar-ficha" data-id="' + esc(r.id) + '">Ficha</button></div></td></tr>';
      }).join('') + '</tbody></table></div><p class="muted" style="margin-top:8px;font-size:.8rem">"Crescendo agora" compara o ritmo entre as duas últimas observações com o ritmo de antes. Passe o mouse no selo para ver a conta. Views muito altas não significam que o vídeo ainda está crescendo.</p>';
  }

  function formRef(id){
    var r = id ? achar('referencias', id) : null;
    var campos = [
      {k:'url', rot:'Link do vídeo', tipo:'url', req:true, cheio:true},
      {k:'plataforma', rot:'Plataforma', tipo:'select', op:[['', 'Escolha']].concat(PLAT_R)},
      {k:'perfil', rot:'Perfil (@)'},
      {k:'titulo', rot:'Título curto (para você reconhecer)', cheio:true},
      {k:'publicado_em', rot:'Data de publicação', tipo:'date', dica:'Se não souber, deixe vazio.'},
      {k:'categoria', rot:'Categoria', lista:usados(S.referencias, 'categoria', CAT_RADAR)},
      {k:'tema', rot:'Tema principal', cheio:true},
      {k:'formato', rot:'Formato', lista:usados(S.referencias, 'formato', FORMATOS)},
      {k:'ritmo_edicao', rot:'Ritmo de edição', lista:['Cortes muito rápidos (menos de 1s)','Rápido (1 a 2s)','Médio (2 a 4s)','Lento / plano contínuo']},
      {k:'gancho_verbal', rot:'Gancho verbal (primeira frase)', tipo:'textarea', linhas:2, cheio:true},
      {k:'gancho_visual', rot:'Gancho visual (o que aparece nos primeiros segundos)', tipo:'textarea', linhas:2, cheio:true},
      {k:'introducao', rot:'Estrutura da introdução', tipo:'textarea', linhas:2, cheio:true, dica:'Ex.: em quanto tempo mostra o app e o benefício.'},
      {k:'formato_narrativo', rot:'Formato narrativo', tipo:'textarea', linhas:2, cheio:true},
      {k:'texto_tela', rot:'Texto na tela', tipo:'textarea', linhas:2, cheio:true},
      {k:'demo_app', rot:'Como o app é demonstrado', tipo:'textarea', linhas:2, cheio:true},
      {k:'cta', rot:'Chamada para ação', tipo:'textarea', linhas:2, cheio:true},
      {k:'transcricao', rot:'Transcrição (o que é falado)', tipo:'textarea', linhas:4, cheio:true, dica:'Cole aqui a transcrição ou a legenda automática do vídeo (YouTube: "Mostrar transcrição"; TikTok/Instagram: legendas).'},
      {k:'hipoteses', rot:'Hipóteses: por que pode ter funcionado', tipo:'textarea', linhas:3, cheio:true, dica:'São hipóteses, não certezas. Ex.: "mostra o resultado antes de explicar".'},
      {k:'obs', rot:'Observação', tipo:'textarea', linhas:2, cheio:true},
      {k:'favorito', rot:'Favorita', tipo:'checkbox', cheio:true}
    ];
    if(!r) campos.splice(5, 0, {k:'views_agora', rot:'Views agora (opcional)', tipo:'number', passo:'1', dica:'Vira a primeira observação, com a data de hoje.'});
    abrirForm({
      titulo: r ? 'Editar referência' : 'Adicionar referência',
      valores: r || {favorito:false},
      campos: campos,
      onSalvar: async function(o){
        if(!/^https?:\/\//i.test(o.url || '')){ toast('O link precisa começar com https://', 'erro'); return false; }
        var va = o.views_agora; delete o.views_agora;
        if(va !== undefined && va !== null && (va < 0 || !isFinite(va))){ toast('As views não podem ser negativas', 'erro'); return false; }
        if(o.publicado_em && new Date(o.publicado_em + 'T00:00:00').getTime() > Date.now()){ toast('A data de publicação está no futuro', 'erro'); return false; }
        if(r) return !!(await atualizar('referencias', id, o));
        var nova = await inserir('referencias', o); if(!nova) return false;
        if(va !== undefined && va !== null) await inserir('referencias_snapshots', {referencia_id:nova.id, views:Math.round(va), origem:'manual'});
        toast('Referência salva'); return true;
      },
      onApagar: r ? async function(){
        var ok = await apagar('referencias', id);
        if(ok){ S.referencias_snapshots = S.referencias_snapshots.filter(function(s){ return s.referencia_id !== id; }); S.ganchos.forEach(function(g){ if(g.referencia_id === id) g.referencia_id = null; }); }
        return ok;
      } : null
    });
  }

  function formObs(id){
    var r = achar('referencias', id); if(!r) return;
    abrirForm({
      titulo: 'Views de hoje: ' + (r.titulo || r.perfil || 'referência'),
      valores: {observado_em: U().localAgora()},
      campos: [
        {k:'views', rot:'Visualizações', tipo:'number', passo:'1', req:true},
        {k:'observado_em', rot:'Data e hora em que você olhou', tipo:'datetime-local', req:true},
        {k:'curtidas', rot:'Curtidas', tipo:'number', passo:'1'},
        {k:'comentarios', rot:'Comentários', tipo:'number', passo:'1'},
        {k:'compartilhamentos', rot:'Compartilhamentos', tipo:'number', passo:'1', dica:'Só se aparecer publicamente.'}
      ],
      onSalvar: async function(o){
        var d = new Date(o.observado_em); if(isNaN(d) || d.getTime() > Date.now() + 5 * 60e3){ toast('Data inválida', 'erro'); return false; }
        if(['views','curtidas','comentarios','compartilhamentos'].some(function(k){ return o[k] !== null && (o[k] < 0 || !isFinite(o[k])); })){ toast('Os números não podem ser negativos', 'erro'); return false; }
        ['views','curtidas','comentarios','compartilhamentos'].forEach(function(k){ if(o[k] !== null) o[k] = Math.round(o[k]); });
        o.observado_em = d.toISOString(); o.referencia_id = id; o.origem = 'manual';
        var ok = !!(await inserir('referencias_snapshots', o));
        if(ok) toast('Views registradas'); return ok;
      }
    });
  }

  function ficha(id){
    var r = achar('referencias', id); if(!r) return;
    var v = velocidade(r), obs = obsDe(r.id).slice().reverse(), link = seguro(r.url);
    var campo = function(rot, val){ return val ? '<div style="margin-bottom:10px"><div class="muted" style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em">' + rot + '</div><div style="white-space:pre-wrap">' + esc(val) + '</div></div>' : ''; };
    var partes = [r.perfil, nomePlatR(r.plataforma), r.categoria, r.formato, r.publicado_em ? 'publicado em ' + dataBr(soData(r.publicado_em)) : ''].filter(Boolean).map(esc);
    if(link) partes.unshift('<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Abrir o vídeo</a>');
    var corpo = '<p style="margin-bottom:12px">' + partes.join(' · ') + '</p>' +
      '<div class="painel" style="margin-bottom:12px"><span class="pilula ' + COR_VEL[v.st] + '">' + v.rot + '</span> <span style="font-size:.88rem">' + esc(v.txt) + '</span></div>' +
      campo('Tema', r.tema) + campo('Gancho verbal', r.gancho_verbal) + campo('Gancho visual', r.gancho_visual) + campo('Introdução', r.introducao) +
      campo('Formato narrativo', r.formato_narrativo) + campo('Ritmo de edição', r.ritmo_edicao) + campo('Texto na tela', r.texto_tela) +
      campo('Demonstração do app', r.demo_app) + campo('Chamada para ação', r.cta) + campo('Hipóteses (não confirmadas)', r.hipoteses) + campo('Transcrição', r.transcricao) + campo('Observação', r.obs);
    corpo += '<h3 style="font-size:.9rem;margin:14px 0 6px">Observações de views</h3>' + (obs.length
      ? '<div class="rolagem"><table style="min-width:520px"><thead><tr><th>Data</th><th>Views</th><th>Curtidas</th><th>Coment.</th><th>Compart.</th><th></th></tr></thead><tbody>' + obs.map(function(s){
          return '<tr><td>' + U().dataHora(s.observado_em) + '</td><td><b>' + n(s.views) + '</b></td><td>' + n(s.curtidas) + '</td><td>' + n(s.comentarios) + '</td><td>' + n(s.compartilhamentos) + '</td><td><button class="ic-btn perigo" data-acao="radar-obs-apagar" data-id="' + esc(s.id) + '" data-ref="' + esc(r.id) + '" aria-label="Apagar observação">' + ic('lixo') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="vazio">Nenhuma observação ainda.</div>');
    corpo += '<div class="m-acoes"><button class="btn" data-acao="radar-analisar" data-id="' + esc(r.id) + '">Analisar com o Claude</button><button class="btn" data-acao="radar-gancho" data-id="' + esc(r.id) + '"' + (r.gancho_verbal || r.gancho_visual ? '' : ' disabled title="Preencha o gancho na ficha antes"') + '>Salvar gancho na biblioteca</button><span class="espaco"></span>' +
      '<button class="btn" data-acao="radar-editar" data-id="' + esc(r.id) + '">Editar ficha</button><button class="btn cheio" data-acao="radar-obs" data-id="' + esc(r.id) + '">+ Views de hoje</button></div>';
    modal(r.titulo || r.tema || 'Referência', corpo, true);
  }

  async function refParaGancho(id){
    var r = achar('referencias', id); if(!r) return;
    var feitos = 0;
    var itens = [['verbal', r.gancho_verbal], ['visual', r.gancho_visual]].filter(function(x){ return x[1] && x[1].trim(); });
    for(var i = 0; i < itens.length; i++){
      var txt = itens[i][1].trim();
      var ja = S.ganchos.some(function(g){ return g.tipo === itens[i][0] && g.texto.trim().toLowerCase() === txt.toLowerCase(); });
      if(ja) continue;
      if(await inserir('ganchos', {texto:txt.slice(0, 1000), tipo:itens[i][0], origem:'referencia', referencia_id:r.id})) feitos++;
    }
    toast(feitos ? plural(feitos, 'gancho salvo', 'ganchos salvos') + ' na biblioteca. Classifique a categoria lá.' : 'Esses ganchos já estão na biblioteca.');
  }

  /* ============================================================
     BIBLIOTECA DE GANCHOS
     ============================================================ */
  function ganchosFiltrados(){
    var b = G.busca.trim().toLowerCase();
    return S.ganchos.filter(function(g){
      if(G.fav && !g.favorito) return false;
      if(G.cat === '__sem' ? g.categoria : (G.cat && g.categoria !== G.cat)) return false;
      if(G.tipo && g.tipo !== G.tipo) return false;
      if(G.orig && g.origem !== G.orig) return false;
      return !b || [g.texto, g.categoria, g.obs].some(function(x){ return String(x || '').toLowerCase().indexOf(b) > -1; });
    }).sort(function(a, b){ return (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0) || new Date(b.criado_em) - new Date(a.criado_em); });
  }
  function vGanchos(){
    var h = avisoFalta(TABELAS.concat(['publicacoes']));
    var semLigar = S.publicacoes.filter(function(p){ return p.gancho && !p.gancho_id; }).length;
    h += '<p class="muted" style="margin-bottom:12px;font-size:.85rem">Seus ganchos e os das referências, organizados por tipo. O resultado de cada um vem dos vídeos em que você usou, comparados com o normal do perfil.</p>';
    h += '<div class="barra"><input type="search" id="gc-busca" style="flex:1 1 220px;min-width:180px" placeholder="Buscar gancho" aria-label="Buscar ganchos" value="' + esc(G.busca) + '">' +
      sel('gc-cat', 'Todas as categorias', [['__sem','Sem categoria']].concat(usados(S.ganchos, 'categoria', CAT_GANCHO).map(function(x){ return [x, x]; })), G.cat) +
      sel('gc-tipo', 'Verbal e visual', [['verbal','Verbal'],['visual','Visual']], G.tipo) +
      sel('gc-orig', 'Todas as origens', [['meu','Meus vídeos'],['referencia','Referências'],['ideia','Ideias']], G.orig) +
      '<label class="chk"><input type="checkbox" id="gc-fav"' + (G.fav ? ' checked' : '') + '> Só favoritos</label><span class="espaco"></span>' +
      (semLigar ? '<button class="btn" data-acao="ganchos-importar">Trazer ' + plural(semLigar, 'gancho', 'ganchos') + ' dos meus vídeos</button>' : '') +
      '<button class="btn cheio" data-acao="gancho-novo">' + ic('mais') + 'Adicionar gancho</button></div><div id="gc-lista"></div>';
    return h;
  }
  function pintarGanchos(){
    var alvo = $('#gc-lista'); if(!alvo) return;
    var l = ganchosFiltrados();
    if(!l.length){ alvo.innerHTML = '<div class="vazio">' + (S.ganchos.length ? 'Nenhum gancho com esses filtros.' : 'Nenhum gancho ainda. Adicione os seus, salve os das referências pelo Viral Radar, ou traga os que já estão nos seus vídeos.') + '</div>'; return; }
    var u = U(), porPerfil = {}; S.perfis.forEach(function(p){ porPerfil[p.id] = p; });
    alvo.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">' + l.map(function(g){
      var ev = evidencia(g), ref = g.referencia_id ? achar('referencias', g.referencia_id) : null;
      return '<div class="painel" style="margin:0;display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;gap:6px;align-items:flex-start"><div style="flex:1;font-weight:600;white-space:pre-wrap">' + esc(g.texto) + '</div>' + estrela(g.favorito, 'gancho-fav', g.id) + '</div>' +
        '<div class="chips"><span class="pilula s-conversando">' + (g.tipo === 'visual' ? 'Visual' : 'Verbal') + '</span>' + (g.categoria ? '<span class="pilula s-parada">' + esc(g.categoria) + '</span>' : '<span class="pilula" style="border:1px dashed var(--line)">Sem categoria</span>') +
          '<span class="pilula ' + COR_EV[ev.nivel] + '">' + ROT_EV[ev.nivel] + '</span></div>' +
        '<div class="muted" style="font-size:.8rem">' + esc(ev.txt) + '</div>' +
        (ev.vids.length ? '<div style="font-size:.8rem">' + ev.vids.slice(0, 3).map(function(p){ return '• ' + esc(p.titulo || 'vídeo') + ' <span class="muted">(' + esc(u.nomePerfil(porPerfil[p.perfil_id])) + ')</span>'; }).join('<br>') + (ev.vids.length > 3 ? '<br><span class="muted">e mais ' + (ev.vids.length - 3) + '</span>' : '') + '</div>' : '') +
        (ref ? '<div class="muted" style="font-size:.8rem">Da referência: <button class="link-b" data-acao="radar-ficha" data-id="' + esc(ref.id) + '">' + esc(ref.titulo || ref.perfil || 'ver ficha') + '</button></div>' : '') +
        '<div class="acoes" style="margin-top:auto"><button class="btn mini" data-acao="gancho-copiar" data-id="' + esc(g.id) + '">Copiar</button><button class="ic-btn" data-acao="gancho-editar" data-id="' + esc(g.id) + '" aria-label="Editar gancho">' + ic('editar') + '</button></div></div>';
    }).join('') + '</div><p class="muted" style="margin-top:10px;font-size:.8rem">Níveis: <b>1 observação</b> não permite concluir · <b>Pista</b> = 2 a 3 vídeos · <b>Padrão observado</b> = 4+ vídeos indo no mesmo sentido. Sempre comparado com o normal do mesmo perfil na mesma idade.</p>';
  }

  function formGancho(id){
    var g = id ? achar('ganchos', id) : null;
    abrirForm({
      titulo: g ? 'Editar gancho' : 'Adicionar gancho',
      valores: g || {tipo:'verbal', origem:'ideia'},
      campos: [
        {k:'texto', rot:'Gancho', tipo:'textarea', linhas:3, req:true, cheio:true, dica:'Verbal: a primeira frase. Visual: descreva a cena de abertura.'},
        {k:'tipo', rot:'Tipo', tipo:'select', op:[['verbal','Verbal (fala)'],['visual','Visual (imagem)']]},
        {k:'categoria', rot:'Categoria', tipo:'select', op:[['', 'Sem categoria']].concat(CAT_GANCHO.map(function(x){ return [x, x]; }))},
        {k:'origem', rot:'De onde veio', tipo:'select', op:[['meu','Dos meus vídeos'],['referencia','De uma referência'],['ideia','Ideia para testar']]},
        {k:'obs', rot:'Observação', tipo:'textarea', linhas:2, cheio:true},
        {k:'favorito', rot:'Favorito', tipo:'checkbox', cheio:true}
      ],
      onSalvar: async function(o){
        if(o.texto && o.texto.length > 1000){ toast('Gancho muito longo (máx. 1000 letras)', 'erro'); return false; }
        return g ? !!(await atualizar('ganchos', id, o)) : !!(await inserir('ganchos', o));
      },
      onApagar: g ? async function(){
        var ok = await apagar('ganchos', id);
        if(ok) S.publicacoes.forEach(function(p){ if(p.gancho_id === id) p.gancho_id = null; });
        return ok;
      } : null
    });
  }

  async function importarDosVideos(){
    var l = S.publicacoes.filter(function(p){ return p.gancho && !p.gancho_id; });
    if(!l.length) return;
    if(!confirm('Criar ganchos na biblioteca a partir de ' + plural(l.length, 'vídeo', 'vídeos') + ' e ligar cada vídeo ao seu gancho? Ganchos com o mesmo texto viram um só.')) return;
    var criados = 0, ligados = 0;
    for(var i = 0; i < l.length; i++){
      var txt = l[i].gancho.trim().slice(0, 1000);
      var g = S.ganchos.find(function(x){ return x.tipo === 'verbal' && x.texto.trim().toLowerCase() === txt.toLowerCase(); });
      if(!g){ g = await inserir('ganchos', {texto:txt, tipo:'verbal', origem:'meu'}); if(g) criados++; }
      if(g && await atualizar('publicacoes', l[i].id, {gancho_id:g.id})) ligados++;
    }
    toast(plural(criados, 'gancho criado', 'ganchos criados') + ', ' + plural(ligados, 'vídeo ligado', 'vídeos ligados'));
    renderizar();
  }

  /* ---------- liga no painel ---------- */
  function registrar(){
    ICONES.radar = '<circle cx="12" cy="12" r="9"/><path d="M12 12l6-6"/><circle cx="12" cy="12" r="4"/>';
    ICONES.ganchos = '<path d="M7 4v9a5 5 0 0 0 10 0v-2"/><path d="M14 9l3-3 3 3"/>';
    ABAS.radar = {t:'Viral Radar', v:vRadar, depois:pintarRadar};
    ABAS.ganchos = {t:'Biblioteca de ganchos', v:vGanchos, depois:pintarGanchos};
    ACOES['radar-nova'] = function(){ formRef(); };
    ACOES['radar-editar'] = function(b){ formRef(b.dataset.id); };
    ACOES['radar-obs'] = function(b){ formObs(b.dataset.id); };
    ACOES['radar-ficha'] = function(b){ ficha(b.dataset.id); };
    ACOES['radar-gancho'] = async function(b){ await refParaGancho(b.dataset.id); };
    ACOES['radar-fav'] = async function(b){ var r = achar('referencias', b.dataset.id); if(r && await atualizar('referencias', r.id, {favorito:!r.favorito})) pintarRadar(); };
    ACOES['radar-obs-apagar'] = async function(b){
      if(!confirm('Apagar esta observação?')) return;
      if(await apagar('referencias_snapshots', b.dataset.id)){ toast('Observação apagada'); renderizar(); ficha(b.dataset.ref); }
    };
    ACOES['gancho-novo'] = function(){ formGancho(); };
    ACOES['gancho-editar'] = function(b){ formGancho(b.dataset.id); };
    ACOES['gancho-fav'] = async function(b){ var g = achar('ganchos', b.dataset.id); if(g && await atualizar('ganchos', g.id, {favorito:!g.favorito})) pintarGanchos(); };
    ACOES['gancho-copiar'] = function(b){
      var g = achar('ganchos', b.dataset.id); if(!g) return;
      try{ navigator.clipboard.writeText(g.texto).then(function(){ toast('Gancho copiado'); }, function(){ toast('Não consegui copiar', 'erro'); }); }catch(e){ toast('Não consegui copiar', 'erro'); }
    };
    ACOES['ganchos-importar'] = importarDosVideos;

    document.addEventListener('input', function(e){
      if(e.target.id === 'rd-busca'){ R.busca = e.target.value; pintarRadar(); }
      if(e.target.id === 'gc-busca'){ G.busca = e.target.value; pintarGanchos(); }
    });
    document.addEventListener('change', function(e){
      var id = e.target.id; if(!id) return;
      if(id.indexOf('rd-') === 0 && id !== 'rd-busca'){ R[id.slice(3)] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; pintarRadar(); }
      if(id.indexOf('gc-') === 0 && id !== 'gc-busca'){ G[id.slice(3)] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; pintarGanchos(); }
    });
  }

  window.ModRadar = {registrar:registrar, carregar:carregar, CAT_GANCHO:CAT_GANCHO, _t:{velocidade:velocidade, evidencia:evidencia}};
})();
