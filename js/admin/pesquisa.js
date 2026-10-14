/* ============================================================
   PESQUISAR REFERÊNCIAS (dentro do Viral Radar)
   - YouTube Shorts: resultados de verdade pela API oficial (Edge Function
     "youtube-busca"), com views, views por dia e sinais de desempenho.
   - TikTok e Instagram: não têm pesquisa oficial para criadores, então
     viram atalhos que abrem a pesquisa do tema direto na rede.
   - "Sinais" são pistas calculadas comparando os resultados entre si.
     Não são certezas sobre o motivo do sucesso.
   - "Analisar com o Claude": copia um pedido completo (dados + transcrição)
     para colar no chat.
   ============================================================ */
(function(){
  var P = {q:'', dias:'30', idioma:'pt', ordem:'viewCount', carregando:false, itens:null, erro:'', consultado:null, ordenar:'views_dia'};

  function n(x){ return x == null ? '—' : window.ModConteudo.util.curto(x); }
  function mediana(l){ return window.ModConteudo._calc.mediana(l); }
  function dur(s){ if(s == null) return '—'; return s < 60 ? s + 's' : Math.floor(s / 60) + 'min' + (s % 60 ? ' ' + (s % 60) + 's' : ''); }
  function idadeDias(d){ return Math.max(0, (Date.now() - new Date(d).getTime()) / 864e5); }
  function eng(i){ return i.views ? ((i.curtidas || 0) + (i.comentarios || 0)) / i.views : null; }

  /* Sinais comparando com os outros resultados da mesma pesquisa */
  function sinais(i, todos){
    var s = [], mv = mediana(todos.map(function(x){ return x.views_dia; }).filter(function(x){ return x != null; }));
    var me = mediana(todos.map(eng).filter(function(x){ return x != null; }));
    if(i.views_dia != null && mv && i.views_dia >= 2 * mv) s.push(['forte', 'Views/dia ' + (i.views_dia / mv).toFixed(1) + 'x a mediana da busca']);
    var e = eng(i);
    if(e != null && me && e >= 1.5 * me) s.push(['forte', 'Engajamento alto (' + (e * 100).toFixed(1) + '%)']);
    if(i.publicado_em && idadeDias(i.publicado_em) <= 7) s.push(['', 'Recente (até 7 dias)']);
    if(i.duracao_seg != null && i.duracao_seg <= 20) s.push(['', 'Curto (até 20s)']);
    var t = i.titulo || '';
    if(/\?/.test(t)) s.push(['', 'Título com pergunta']);
    if(/\d/.test(t)) s.push(['', 'Título com número']);
    if(/\b(como|segredo|ningu[eé]m|pare|nunca|melhor|pior|truque|hack|how|secret|nobody|stop|never|best|worst|trick)\b/i.test(t)) s.push(['', 'Título com promessa/curiosidade']);
    return s;
  }

  function links(q){
    var e = encodeURIComponent(q), tag = encodeURIComponent(q.toLowerCase().replace(/[^a-z0-9à-ú]/gi, ''));
    return '<a class="btn mini" href="https://www.tiktok.com/search/video?q=' + e + '" target="_blank" rel="noopener noreferrer">Ver no TikTok ↗</a>' +
      '<a class="btn mini" href="https://www.instagram.com/explore/tags/' + tag + '/" target="_blank" rel="noopener noreferrer">Ver no Instagram (#' + esc(decodeURIComponent(tag)) + ') ↗</a>' +
      '<a class="btn mini" href="https://www.youtube.com/results?search_query=' + e + '&sp=EgIYAQ%253D%253D" target="_blank" rel="noopener noreferrer">Ver no YouTube ↗</a>';
  }

  function painel(){
    var h = '<div class="painel"><h2>Pesquisar referências</h2>' +
      '<form id="pq-form" class="barra" style="margin-bottom:8px"><input type="search" id="pq-q" placeholder="Ex.: app de estudos, IA para provas, organizar a rotina" aria-label="O que pesquisar" value="' + esc(P.q) + '" style="flex:1 1 240px;min-width:180px" maxlength="120">' +
      '<select id="pq-dias" aria-label="Publicados nos últimos"><option value="7"' + (P.dias === '7' ? ' selected' : '') + '>Últimos 7 dias</option><option value="30"' + (P.dias === '30' ? ' selected' : '') + '>Últimos 30 dias</option><option value="90"' + (P.dias === '90' ? ' selected' : '') + '>Últimos 90 dias</option><option value="365"' + (P.dias === '365' ? ' selected' : '') + '>Último ano</option></select>' +
      '<select id="pq-idioma" aria-label="Idioma"><option value="pt"' + (P.idioma === 'pt' ? ' selected' : '') + '>Português</option><option value="en"' + (P.idioma === 'en' ? ' selected' : '') + '>Inglês</option><option value=""' + (P.idioma === '' ? ' selected' : '') + '>Qualquer idioma</option></select>' +
      '<button type="submit" class="btn cheio"' + (P.carregando ? ' disabled' : '') + '>' + (P.carregando ? 'Pesquisando...' : 'Pesquisar') + '</button></form>';
    if(P.q) h += '<div class="acoes" style="flex-wrap:wrap;margin-bottom:10px">' + links(P.q) + '</div>';

    if(P.erro === 'sem_chave'){
      h += '<div class="aviso"><b>Falta a chave do YouTube para mostrar os resultados aqui.</b>Os botões acima já abrem a pesquisa no TikTok, no Instagram e no YouTube. Para ver os Shorts direto no painel, crie a chave grátis (o Claude te guia) e salve no Supabase como <b>YOUTUBE_API_KEY</b>.</div>';
    } else if(P.erro){
      h += '<div class="aviso" role="alert">' + esc(P.erro) + '</div>';
    } else if(P.itens){
      if(!P.itens.length) h += '<div class="vazio">Nenhum Short encontrado com esse tema nesse período. Tente palavras mais simples ou um período maior.</div>';
      else h += resultados();
    } else {
      h += '<p class="muted" style="font-size:.82rem">YouTube Shorts aparecem aqui com views e sinais de desempenho. TikTok e Instagram não liberam pesquisa oficial, então abrem direto na rede para você escolher e colar o link no Radar.</p>';
    }
    return h + '</div>';
  }

  function ordenados(){
    var l = P.itens.slice(), k = P.ordenar;
    if(k === 'eng') l.sort(function(a, b){ return (eng(b) || 0) - (eng(a) || 0); });
    else if(k === 'recente') l.sort(function(a, b){ return new Date(b.publicado_em) - new Date(a.publicado_em); });
    else l.sort(function(a, b){ return (b[k] || 0) - (a[k] || 0); });
    return l;
  }
  function resultados(){
    var salvos = {}; (S.referencias || []).forEach(function(r){ salvos[r.url] = true; });
    var h = '<div class="barra" style="margin-bottom:8px"><span class="muted" style="font-size:.8rem">' + P.itens.length + ' Shorts do YouTube · consultado em ' + window.ModConteudo.util.dataHora(P.consultado) + '</span><span class="espaco"></span>' +
      '<select id="pq-ordenar" aria-label="Ordenar"><option value="views_dia"' + (P.ordenar === 'views_dia' ? ' selected' : '') + '>Mais views por dia</option><option value="views"' + (P.ordenar === 'views' ? ' selected' : '') + '>Mais views</option><option value="eng"' + (P.ordenar === 'eng' ? ' selected' : '') + '>Mais engajamento</option><option value="recente"' + (P.ordenar === 'recente' ? ' selected' : '') + '>Mais recentes</option></select></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">' + ordenados().map(function(i){
      var sn = sinais(i, P.itens), e = eng(i);
      return '<div style="border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--card);display:flex;flex-direction:column">' +
        (i.capa ? '<a href="' + esc(seguro(i.url)) + '" target="_blank" rel="noopener noreferrer"><img src="' + esc(seguro(i.capa)) + '" alt="" loading="lazy" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block"></a>' : '') +
        '<div style="padding:10px;display:flex;flex-direction:column;gap:6px;flex:1">' +
          '<a href="' + esc(seguro(i.url)) + '" target="_blank" rel="noopener noreferrer" style="font-weight:600;color:inherit">' + esc(i.titulo) + '</a>' +
          '<div class="muted" style="font-size:.78rem">' + esc(i.canal) + ' · ' + (i.publicado_em ? new Date(i.publicado_em).toLocaleDateString('pt-BR') : '') + ' · ' + dur(i.duracao_seg) + '</div>' +
          '<div style="font-size:.85rem"><b>' + n(i.views) + '</b> views · <b>' + n(i.views_dia) + '</b>/dia' + (e != null ? ' · ' + (e * 100).toFixed(1) + '% eng.' : '') + '</div>' +
          (sn.length ? '<div class="chips">' + sn.map(function(x){ return '<span class="pilula ' + (x[0] === 'forte' ? 's-cliente' : 's-parada') + '" style="font-size:.68rem">' + esc(x[1]) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="acoes" style="margin-top:auto;flex-wrap:wrap">' + (salvos[i.url] ? '<span class="pilula s-cliente">No Radar ✓</span>' : '<button class="btn mini cheio" data-acao="pq-salvar" data-id="' + esc(i.id) + '">Salvar no Radar</button>') +
          '<button class="btn mini" data-acao="pq-analisar" data-id="' + esc(i.id) + '">Analisar com o Claude</button></div></div></div>';
    }).join('') + '</div><p class="muted" style="margin-top:8px;font-size:.78rem">Views por dia = média desde a publicação (não confirma se está crescendo agora; para isso, salve no Radar e registre as views de novo em outro dia). Os sinais comparam os vídeos desta busca entre si e são pistas, não certezas.</p>';
    return h;
  }

  async function pesquisar(){
    if(P.q.trim().length < 2){ toast('Digite o que você quer pesquisar', 'erro'); return; }
    P.carregando = true; P.erro = ''; renderizar();
    try{
      var r = await window.db.functions.invoke('youtube-busca', {body:{q:P.q.trim(), dias:Number(P.dias), idioma:P.idioma, ordem:'viewCount'}});
      if(r.error){
        var msg = r.error.message || 'erro';
        try{ var j = await r.error.context.json(); if(j && j.erro) msg = j.erro; }catch(e){}
        if(/not found|404/i.test(msg)) msg = 'A pesquisa do YouTube ainda não foi instalada no servidor.';
        throw new Error(msg);
      }
      P.itens = r.data.itens || []; P.consultado = r.data.consultado_em || new Date().toISOString();
    }catch(e){ P.itens = null; P.erro = e.message; }
    P.carregando = false; renderizar();
  }

  async function salvar(id){
    var i = (P.itens || []).find(function(x){ return x.id === id; }); if(!i) return;
    var nova = await inserir('referencias', {
      url:i.url, plataforma:'youtube', perfil:i.canal ? i.canal.slice(0, 120) : null, titulo:(i.titulo || '').slice(0, 200),
      publicado_em:i.publicado_em ? i.publicado_em.slice(0, 10) : null, tema:P.q.slice(0, 200), obs:i.descricao ? 'Descrição: ' + i.descricao : null
    });
    if(!nova) return;
    await inserir('referencias_snapshots', {referencia_id:nova.id, views:i.views, curtidas:i.curtidas, comentarios:i.comentarios, origem:'api'});
    toast('Salvo no Radar. Abra a ficha para colar a transcrição e anotar o gancho.');
    renderizar();
  }

  /* ---------- pedidos para o Claude ---------- */
  function pedidoBusca(i){
    var e = eng(i), sn = sinais(i, P.itens || []).map(function(x){ return x[1]; });
    return 'Analisa essa referência do nicho Tech UGC e me diz por que ela pode ter performado (como hipóteses, não certezas):\n\n' +
      'Link: ' + i.url + '\nTítulo: ' + i.titulo + '\nCanal: ' + i.canal + '\nPublicado em: ' + (i.publicado_em ? new Date(i.publicado_em).toLocaleDateString('pt-BR') : '?') +
      '\nDuração: ' + dur(i.duracao_seg) + '\nViews: ' + (i.views ?? '?') + ' (média de ' + (i.views_dia ?? '?') + ' por dia desde a publicação)' +
      '\nCurtidas: ' + (i.curtidas ?? '?') + ' · Comentários: ' + (i.comentarios ?? '?') + (e != null ? ' · Engajamento: ' + (e * 100).toFixed(1) + '%' : '') +
      (sn.length ? '\nSinais comparando com outros resultados da busca "' + P.q + '": ' + sn.join('; ') : '') +
      (i.descricao ? '\nDescrição: ' + i.descricao : '') +
      '\n\nTranscrição: (cole aqui se tiver)\n\nAbre o vídeo no meu navegador se precisar ver as cenas. Quero:\n1. Gancho verbal e visual\n2. Estrutura (introdução, desenvolvimento, encerramento) com os segundos\n3. Ritmo de edição e texto na tela\n4. Como o app/produto é demonstrado\n5. CTA\n6. Hipóteses de por que performou (separando o que os dados mostram do que é palpite)\n7. Como eu adaptaria isso para as minhas marcas sem copiar';
  }
  function pedidoRef(r){
    var obs = S.referencias_snapshots.filter(function(s){ return s.referencia_id === r.id && s.views != null; }).sort(function(a, b){ return new Date(a.observado_em) - new Date(b.observado_em); });
    var v = window.ModRadar._t.velocidade(r);
    var f = function(rot, x){ return x ? '\n' + rot + ': ' + x : ''; };
    return 'Analisa essa referência do meu Viral Radar e me diz por que ela pode ter performado (como hipóteses, não certezas):\n\n' +
      'Link: ' + r.url + f('Perfil', r.perfil) + f('Título', r.titulo) + f('Publicado em', r.publicado_em) + f('Categoria', r.categoria) + f('Formato', r.formato) +
      '\nViews observadas: ' + (obs.length ? obs.map(function(s){ return new Date(s.observado_em).toLocaleDateString('pt-BR') + ' = ' + s.views; }).join('; ') : 'nenhuma') +
      '\nDesempenho calculado: ' + v.rot + ' (' + v.txt + ')' +
      f('Gancho verbal', r.gancho_verbal) + f('Gancho visual', r.gancho_visual) + f('Introdução', r.introducao) + f('Formato narrativo', r.formato_narrativo) +
      f('Ritmo de edição', r.ritmo_edicao) + f('Texto na tela', r.texto_tela) + f('Demonstração do app', r.demo_app) + f('CTA', r.cta) + f('Minhas hipóteses', r.hipoteses) + f('Observação', r.obs) +
      '\n\nTranscrição:\n' + (r.transcricao || '(não tenho)') +
      '\n\nAbre o vídeo no meu navegador se precisar ver as cenas. Quero: estrutura com os segundos, gancho verbal e visual, ritmo, demonstração do app, CTA, hipóteses de por que performou (separando dados de palpite) e como adaptar para as minhas marcas sem copiar.';
  }
  function copiar(txt){
    var ok = function(){ toast('Copiado! Cole no chat do Claude.'); };
    var falha = function(){
      var m = modal('Copie este pedido', '<p class="muted" style="font-size:.85rem;margin-bottom:8px">Selecione tudo (Ctrl + A) e copie (Ctrl + C):</p><textarea rows="14" style="width:100%" readonly>' + esc(txt) + '</textarea>', true);
      var t = m.querySelector('textarea'); if(t){ t.focus(); t.select(); }
    };
    try{ navigator.clipboard.writeText(txt).then(ok, falha); }catch(e){ falha(); }
  }

  function registrar(){
    ACOES['pq-salvar'] = function(b){ salvar(b.dataset.id); };
    ACOES['pq-analisar'] = function(b){ var i = (P.itens || []).find(function(x){ return x.id === b.dataset.id; }); if(i) copiar(pedidoBusca(i)); };
    ACOES['radar-analisar'] = function(b){ var r = achar('referencias', b.dataset.id); if(r) copiar(pedidoRef(r)); };
    document.addEventListener('submit', function(e){ if(e.target.id === 'pq-form'){ e.preventDefault(); P.q = ($('#pq-q') || {}).value || ''; pesquisar(); } });
    document.addEventListener('input', function(e){ if(e.target.id === 'pq-q') P.q = e.target.value; });
    document.addEventListener('change', function(e){
      var id = e.target.id;
      if(id === 'pq-dias') P.dias = e.target.value;
      else if(id === 'pq-idioma') P.idioma = e.target.value;
      else if(id === 'pq-ordenar'){ P.ordenar = e.target.value; renderizar(); }
    });
  }

  window.ModPesquisa = {registrar:registrar, painel:painel, _t:{sinais:sinais, pedidoBusca:pedidoBusca}};
})();
