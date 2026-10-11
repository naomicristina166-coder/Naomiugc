/* ============================================================
   ABA DESEMPENHO (UGC Tech Canvas · Content Intelligence)
   Etapa 1: perfis, painel de desempenho e estrutura de métricas.

   Regras deste módulo:
   - Só mostra números que estão no banco. Nada de exemplo fingindo ser real.
   - Toda métrica vem de uma "fotografia" (metricas_snapshots) com data e origem.
   - Comparações entre vídeos usam idades parecidas (não compara 2 horas com 2 meses).
   - Vídeo novo não é chamado de "ruim": só entra no ranking depois de 3 dias.

   Este arquivo é carregado antes do script principal do painel e usa as
   ferramentas dele (esc, ic, S, abrirForm, inserir...) só na hora de rodar.
   ============================================================ */
(function(){
  var PLAT = [['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube Shorts']];
  var PERIODOS = [['7','Últimos 7 dias'],['30','Últimos 30 dias'],['90','Últimos 90 dias'],['365','Último ano'],['tudo','Desde o começo']];
  var TABELAS = ['perfis','perfis_snapshots','publicacoes','metricas_snapshots'];
  var MIN_HORAS_RANKING = 72;   /* antes disso o vídeo ainda está "nascendo" */
  var MIN_COMPARAVEIS = 3;      /* quantos vídeos parecidos precisam existir para comparar */
  var FATOR_ALERTA = 2;         /* alerta quando passa de 2x o normal do perfil na mesma idade */
  var F = {perfil:'', marca:'', plat:'', periodo:'30'};

  /* ---------- cálculos (puros, testáveis) ---------- */
  var H = 36e5;
  function ms(d){ return d ? new Date(d).getTime() : NaN; }
  function mediana(l){
    l = l.filter(function(x){ return typeof x === 'number' && isFinite(x); }).sort(function(a, b){ return a - b; });
    if(!l.length) return null;
    var m = Math.floor(l.length / 2);
    return l.length % 2 ? l[m] : (l[m - 1] + l[m]) / 2;
  }
  function nomePlat(p){ var x = PLAT.find(function(o){ return o[0] === p; }); return x ? x[1] : (p || ''); }

  /* Agrupa as fotografias por publicação, da mais antiga para a mais nova */
  function indexarSnaps(snaps){
    var por = {};
    snaps.forEach(function(s){ (por[s.publicacao_id] = por[s.publicacao_id] || []).push(s); });
    Object.keys(por).forEach(function(k){ por[k].sort(function(a, b){ return ms(a.coletado_em) - ms(b.coletado_em); }); });
    return por;
  }
  function idadeH(pub, snap){
    var a = ms(pub.publicado_em), b = ms(snap.coletado_em);
    return isFinite(a) && isFinite(b) ? (b - a) / H : null;
  }
  function ultimo(por, pub){ var l = por[pub.id]; return l && l.length ? l[l.length - 1] : null; }

  /* Views do vídeo na idade mais próxima de "horas" (aceita de 50% a 150% dessa idade) */
  function viewsNaIdade(por, pub, horas){
    var l = por[pub.id] || [], melhor = null, dist = Infinity;
    l.forEach(function(s){
      var i = idadeH(pub, s);
      if(i === null || s.views == null || i < horas * 0.5 || i > horas * 1.5) return;
      var d = Math.abs(i - horas); if(d < dist){ dist = d; melhor = s; }
    });
    return melhor ? Number(melhor.views) : null;
  }
  function engajamento(s){
    if(!s || !Number(s.views)) return null;
    var soma = 0, tem = false;
    ['curtidas','comentarios','compartilhamentos','salvamentos'].forEach(function(k){ if(s[k] != null){ soma += Number(s[k]); tem = true; } });
    return tem ? soma / Number(s.views) : null;
  }

  /* Compara um vídeo com os outros do mesmo perfil, na mesma idade */
  function relativo(pub, pubs, por, horas){
    var v = viewsNaIdade(por, pub, horas); if(v === null) return null;
    var outros = pubs.filter(function(o){ return o.id !== pub.id && o.perfil_id === pub.perfil_id; })
      .map(function(o){ return viewsNaIdade(por, o, horas); }).filter(function(x){ return x !== null; });
    if(outros.length < MIN_COMPARAVEIS) return null;
    var base = mediana(outros);
    return {views:v, base:base, n:outros.length, horas:horas, razao: base > 0 ? v / base : null};
  }

  function calcular(dados, filtro, agora){
    agora = agora || Date.now();
    var perfis = dados.perfis || [], pubsTodas = dados.publicacoes || [], snaps = dados.metricas_snapshots || [];
    var porId = {}; perfis.forEach(function(p){ porId[p.id] = p; });
    var por = indexarSnaps(snaps);
    var desde = filtro.periodo === 'tudo' ? -Infinity : agora - Number(filtro.periodo) * 24 * H;

    var noFiltroPerfil = function(pub){
      var p = porId[pub.perfil_id]; if(!p) return false;
      if(filtro.perfil && p.id !== filtro.perfil) return false;
      if(filtro.plat && p.plataforma !== filtro.plat) return false;
      if(filtro.marca && p.marca_id !== filtro.marca) return false;
      return true;
    };
    var doPerfil = pubsTodas.filter(noFiltroPerfil);                 /* base de comparação: todo o histórico */
    var pubs = doPerfil.filter(function(p){ var t = ms(p.publicado_em); return isFinite(t) ? t >= desde : filtro.periodo === 'tudo'; });

    var comSnap = pubs.map(function(p){ return {pub:p, s:ultimo(por, p)}; });
    var medidos = comSnap.filter(function(x){ return x.s && x.s.views != null; });
    var engs = medidos.map(function(x){ return engajamento(x.s); }).filter(function(x){ return x !== null; });

    /* Ranking relativo: só vídeos com 3+ dias, comparados na mesma idade (até 7 dias) */
    var ranking = [];
    medidos.forEach(function(x){
      var i = idadeH(x.pub, x.s); if(i === null || i < MIN_HORAS_RANKING) return;
      var r = relativo(x.pub, doPerfil, por, Math.min(i, 168));
      if(r && r.razao !== null) ranking.push({pub:x.pub, r:r});
    });
    ranking.sort(function(a, b){ return b.r.razao - a.r.razao; });

    /* Alertas: vídeos com menos de 7 dias muito acima do normal na mesma idade */
    var alertas = [];
    medidos.forEach(function(x){
      var i = idadeH(x.pub, x.s); if(i === null || i <= 0 || i > 168) return;
      var r = relativo(x.pub, doPerfil, por, i);
      if(r && r.razao !== null && r.razao >= FATOR_ALERTA) alertas.push({pub:x.pub, r:r, idade:i});
    });
    alertas.sort(function(a, b){ return b.r.razao - a.r.razao; });

    /* Views atuais agrupadas pela semana de publicação */
    var semanas = {};
    medidos.forEach(function(x){
      var d = new Date(x.pub.publicado_em); if(isNaN(d)) return;
      var seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      var k = seg.getFullYear() + '-' + String(seg.getMonth() + 1).padStart(2, '0') + '-' + String(seg.getDate()).padStart(2, '0');
      semanas[k] = (semanas[k] || 0) + Number(x.s.views);
    });

    /* Por perfil */
    var segs = dados.perfis_snapshots || [];
    var linhasPerfil = perfis.filter(function(p){
      return (!filtro.perfil || p.id === filtro.perfil) && (!filtro.plat || p.plataforma === filtro.plat) && (!filtro.marca || p.marca_id === filtro.marca);
    }).map(function(p){
      var mine = medidos.filter(function(x){ return x.pub.perfil_id === p.id; });
      var hs = segs.filter(function(s){ return s.perfil_id === p.id && s.seguidores != null; }).sort(function(a, b){ return ms(a.coletado_em) - ms(b.coletado_em); });
      var atual = hs.length ? hs[hs.length - 1] : null, antes = null;
      if(atual){ var lim = ms(atual.coletado_em) - 30 * 24 * H; hs.forEach(function(s){ if(ms(s.coletado_em) <= lim) antes = s; }); }
      var ult = null;
      pubs.filter(function(x){ return x.perfil_id === p.id; }).forEach(function(pb){ (por[pb.id] || []).forEach(function(s){ if(!ult || ms(s.coletado_em) > ms(ult)) ult = s.coletado_em; }); });
      if(atual && (!ult || ms(atual.coletado_em) > ms(ult))) ult = atual.coletado_em;
      return {
        perfil:p,
        videos: pubs.filter(function(x){ return x.perfil_id === p.id; }).length,
        views: mine.reduce(function(t, x){ return t + Number(x.s.views); }, 0),
        mediana: mediana(mine.map(function(x){ return Number(x.s.views); })),
        seguidores: atual ? Number(atual.seguidores) : null,
        delta30: atual && antes ? Number(atual.seguidores) - Number(antes.seguidores) : null,
        historicoSeg: hs.length,
        atualizado: ult
      };
    });

    /* Origem e data da última atualização */
    var ultimaAtualizacao = null, origens = {};
    pubs.forEach(function(p){ (por[p.id] || []).forEach(function(s){
      origens[s.origem] = (origens[s.origem] || 0) + 1;
      if(!ultimaAtualizacao || ms(s.coletado_em) > ms(ultimaAtualizacao)) ultimaAtualizacao = s.coletado_em;
    }); });

    return {
      pubs:pubs, medidos:medidos, semMetricas: pubs.length - medidos.length,
      views: medidos.reduce(function(t, x){ return t + Number(x.s.views); }, 0),
      engMedio: engs.length ? engs.reduce(function(a, b){ return a + b; }, 0) / engs.length : null,
      engN: engs.length,
      ranking:ranking, alertas:alertas, semanas:semanas, linhasPerfil:linhasPerfil,
      ultimaAtualizacao:ultimaAtualizacao, origens:origens,
      recentes: comSnap.slice().sort(function(a, b){ return (ms(b.pub.publicado_em) || 0) - (ms(a.pub.publicado_em) || 0); }).slice(0, 8),
      por:por, porId:porId
    };
  }

  /* ---------- carregar do banco (em páginas de 1000, para não cortar dados) ---------- */
  async function carregarTabela(t){
    try{
      var tudo = [], de = 0, passo = 1000;
      for(;;){
        var r = await window.db.from(t).select('*').order('criado_em', {ascending:true}).range(de, de + passo - 1);
        if(r.error) throw r.error;
        tudo = tudo.concat(r.data || []);
        if(!r.data || r.data.length < passo) break;
        de += passo;
      }
      S[t] = tudo; delete falta[t];
    }catch(e){ S[t] = []; falta[t] = msgErro(e); }
  }
  function carregar(){ return Promise.all(TABELAS.map(carregarTabela).concat(window.ModRadar ? [window.ModRadar.carregar()] : [])); }

  /* ---------- formatação ---------- */
  function n(x){ return x == null ? '—' : Number(x).toLocaleString('pt-BR'); }
  function curto(x){
    if(x == null) return '—'; x = Number(x);
    if(x >= 1e6) return (x / 1e6).toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' mi';
    if(x >= 1e3) return (x / 1e3).toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' mil';
    return x.toLocaleString('pt-BR');
  }
  function dataHora(d){ if(!d) return '—'; var x = new Date(d); return x.toLocaleDateString('pt-BR') + ' ' + x.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); }
  function idadeTxt(h){ if(h == null) return '—'; if(h < 48) return Math.round(h) + 'h'; return Math.round(h / 24) + ' dias'; }
  function rotOrigem(o){ return o === 'api' ? 'automático' : o === 'importacao' ? 'importado' : 'manual'; }
  function pctTxt(x){ return x == null ? '—' : (x * 100).toLocaleString('pt-BR', {maximumFractionDigits:1}) + '%'; }
  function nomeMarca(id){ var m = id && S.marcas.find(function(x){ return x.id === id; }); return m ? m.nome : ''; }
  function nomePerfil(p){ return p ? p.nome + ' · ' + nomePlat(p.plataforma) : ''; }
  function localAgora(){ var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }

  /* ---------- tela ---------- */
  function filtros(){
    var marcasUsadas = S.marcas.filter(function(m){ return !m.exemplo && S.perfis.some(function(p){ return p.marca_id === m.id; }); });
    var sel = function(id, rot, ops, val){ return '<select id="' + id + '" aria-label="' + rot + '"><option value="">' + rot + '</option>' + ops.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    return '<div class="barra">' +
      sel('c-f-perfil', 'Todos os perfis', S.perfis.map(function(p){ return [p.id, nomePerfil(p)]; }), F.perfil) +
      sel('c-f-marca', 'Todas as marcas', marcasUsadas.map(function(m){ return [m.id, m.nome]; }), F.marca) +
      sel('c-f-plat', 'Todas as plataformas', PLAT, F.plat) +
      '<select id="c-f-periodo" aria-label="Período">' + PERIODOS.map(function(o){ return '<option value="' + o[0] + '"' + (F.periodo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<span class="espaco"></span><button class="btn cheio" data-acao="perfil-novo">' + ic('mais') + 'Adicionar perfil</button></div>';
  }

  function linhaVideo(x, extra){
    var p = x.porId[x.pub.perfil_id];
    var t = esc(x.pub.titulo || x.pub.gancho || 'Sem título');
    var link = seguro(x.pub.url);
    return '<div class="atras"><span class="t"><b>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + t + '</a>' : t) + '</b> <span class="muted">' + esc(nomePerfil(p)) + '</span></span>' + (extra || '') + '</div>';
  }

  function vDesempenho(){
    var h = avisoFalta(TABELAS);
    h += '<p class="muted" style="margin-bottom:12px;font-size:.85rem">Seus perfis do UGC Tech Canvas. Os números vêm só do que está registrado no banco, com data e origem.</p>';
    h += filtros();

    if(!S.perfis.length){
      return h + '<div class="vazio"><b>Comece cadastrando os perfis que você administra.</b><br>Um perfil por plataforma (ex.: @marca no Instagram e @marca no TikTok). Depois, registre os vídeos e as views na aba <b>Vídeos publicados</b>.</div>';
    }

    var c = calcular(S, F);
    c.ranking.forEach(function(x){ x.porId = c.porId; }); c.alertas.forEach(function(x){ x.porId = c.porId; });

    var PLU = {manual:'manuais', api:'automáticos', importacao:'importados'};
    var orig = Object.keys(c.origens).map(function(o){ return plural(c.origens[o], 'registro ' + rotOrigem(o), 'registros ' + (PLU[o] || o)); }).join(', ');
    h += '<p style="margin:0 0 14px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);font-size:.85rem"><strong>Última atualização dos dados:</strong> ' + (c.ultimaAtualizacao ? dataHora(c.ultimaAtualizacao) : 'nenhuma métrica registrada ainda') + (orig ? ' · <strong>Origem:</strong> ' + esc(orig) : '') + '</p>';

    h += '<div class="faixa-num">' +
      '<div class="num"><small>Vídeos publicados</small><b>' + c.pubs.length + '</b><span>' + (c.semMetricas ? c.semMetricas + ' sem métricas' : 'no período') + '</span></div>' +
      '<div class="num"><small>Views somadas</small><b>' + curto(c.medidos.length ? c.views : null) + '</b><span>' + plural(c.medidos.length, 'vídeo medido', 'vídeos medidos') + '</span></div>' +
      '<div class="num"><small>Engajamento médio</small><b>' + pctTxt(c.engMedio) + '</b><span>' + (c.engN ? 'interações ÷ views' : 'sem dados') + '</span></div>' +
      '<div class="num"><small>Perfis</small><b>' + c.linhasPerfil.length + '</b><span>' + S.perfis.filter(function(p){ return p.ativo; }).length + ' ativos</span></div>' +
      '<div class="num"><small>Crescendo acima do normal</small><b>' + c.alertas.length + '</b><span>vídeos com até 7 dias</span></div></div>';
    if(window.ModPublicacoes) h += window.ModPublicacoes.painelPendencias();

    /* Alertas */
    if(c.alertas.length){
      h += '<div class="painel"><h2>Crescendo acima do padrão do perfil</h2>' + c.alertas.slice(0, 5).map(function(x){
        return linhaVideo(x, '<span class="pilula s-cliente">' + x.r.razao.toLocaleString('pt-BR', {maximumFractionDigits:1}) + 'x o normal com ' + idadeTxt(x.idade) + '</span>');
      }).join('') + '<p class="muted" style="margin-top:8px;font-size:.8rem">Comparado com a mediana de outros vídeos do mesmo perfil na mesma idade. É um sinal para observar, não uma garantia.</p></div>';
    }

    /* Evolução por semana */
    var ks = Object.keys(c.semanas).sort().slice(-12), max = Math.max.apply(null, ks.map(function(k){ return c.semanas[k]; }).concat([1]));
    var graf = ks.length
      ? '<div class="barras" role="img" aria-label="Views por semana de publicação">' + ks.map(function(k){
          var v = c.semanas[k];
          return '<div class="bcol" title="' + esc('Semana de ' + br(k) + ': ' + n(v) + ' views') + '"><span class="bn">' + curto(v) + '</span><div class="bar" style="height:' + Math.round(v / max * 80) + '%"></div><span class="bl">' + k.slice(8) + '/' + k.slice(5, 7) + '</span></div>';
        }).join('') + '</div><p class="muted" style="margin-top:6px;font-size:.8rem">Views mais recentes de cada vídeo, somadas pela semana em que ele foi publicado.</p>'
      : '<div class="vazio">Quando você registrar views dos vídeos, aqui aparece a evolução por semana.</div>';

    /* Ranking relativo */
    var rk;
    if(c.ranking.length < 2){
      rk = '<div class="vazio">Ainda não dá para comparar. Cada vídeo precisa ter pelo menos 3 dias e o perfil precisa de mais ' + MIN_COMPARAVEIS + ' vídeos com views registradas na mesma idade.</div>';
    } else {
      var top = c.ranking.filter(function(x){ return x.r.razao >= 1; }).slice(0, 3), fim = c.ranking.filter(function(x){ return x.r.razao < 1; }).slice(-3).reverse();
      var tag = function(x){ return '<span class="pilula ' + (x.r.razao >= 1 ? 's-cliente' : 's-parada') + '">' + x.r.razao.toLocaleString('pt-BR', {maximumFractionDigits:1}) + 'x a mediana (' + idadeTxt(x.r.horas) + ')</span>'; };
      rk = (top.length ? '<h3 style="font-size:.85rem;margin:4px 0 6px">Acima do normal</h3>' + top.map(function(x){ return linhaVideo(x, tag(x)); }).join('') : '') +
        (fim.length ? '<h3 style="font-size:.85rem;margin:12px 0 6px">Abaixo do normal</h3>' + fim.map(function(x){ return linhaVideo(x, tag(x)); }).join('') : '') +
        '<p class="muted" style="margin-top:8px;font-size:.8rem">Só vídeos com 3 dias ou mais, comparados com outros do mesmo perfil na mesma idade.</p>';
    }
    h += '<div class="duas iguais"><div class="painel"><h2>Views por semana de publicação</h2>' + graf + '</div><div class="painel"><h2>Desempenho relativo</h2>' + rk + '</div></div>';

    /* Perfis */
    h += '<div class="painel"><h2>Perfis</h2><div class="rolagem"><table><thead><tr><th>Perfil</th><th>Plataforma</th><th>Marca</th><th>Vídeos</th><th>Views</th><th>Mediana por vídeo</th><th>Seguidores</th><th>30 dias</th><th>Atualizado</th><th></th></tr></thead><tbody>' +
      c.linhasPerfil.map(function(l){
        var p = l.perfil, link = seguro(p.url);
        return '<tr><td><b>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(p.nome) + '</a>' : esc(p.nome)) + '</b>' + (p.ativo ? '' : ' <span class="ex">Pausado</span>') + '</td>' +
          '<td>' + esc(nomePlat(p.plataforma)) + '</td><td>' + esc(nomeMarca(p.marca_id)) + '</td><td>' + l.videos + '</td><td>' + curto(l.views || null) + '</td><td>' + curto(l.mediana) + '</td>' +
          '<td>' + curto(l.seguidores) + '</td><td>' + (l.delta30 == null ? '<span class="muted" title="Precisa de registros com 30 dias de diferença">—</span>' : (l.delta30 >= 0 ? '+' : '') + n(l.delta30)) + '</td>' +
          '<td>' + (l.atualizado ? dataHora(l.atualizado) : '—') + '</td>' +
          '<td><div class="acoes"><button class="btn mini" data-acao="perfil-seg" data-id="' + esc(p.id) + '">Seguidores</button><button class="ic-btn" data-acao="perfil-editar" data-id="' + esc(p.id) + '" aria-label="Editar perfil">' + ic('editar') + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div><p class="muted" style="margin-top:8px;font-size:.8rem">"Seguidores" registra quantos seguidores o perfil tem hoje. Com registros ao longo do tempo, aparece o crescimento de 30 dias.</p></div>';

    /* Últimos vídeos */
    h += '<div class="painel"><h2>Últimos vídeos publicados</h2>' + (c.recentes.length ? c.recentes.map(function(x){
      x.porId = c.porId;
      var s = x.s, i = s ? idadeH(x.pub, s) : null;
      var pubTxt = x.pub.publicado_em ? 'publicado ' + new Date(x.pub.publicado_em).toLocaleDateString('pt-BR') : 'sem data';
      return linhaVideo(x, s ? '<span class="muted" style="white-space:nowrap">' + pubTxt + ' · ' + curto(s.views) + ' views medidas com ' + idadeTxt(i) + ' · ' + rotOrigem(s.origem) + '</span>' : '<span class="muted">' + pubTxt + ' · sem métricas</span>');
    }).join('') : '<div class="vazio">Nenhum vídeo registrado neste filtro. Cadastre na aba Vídeos publicados.</div>') + '</div>';

    return h;
  }

  /* ---------- formulários ---------- */
  function formPerfil(id){
    var p = id ? achar('perfis', id) : null;
    abrirForm({
      titulo: p ? 'Editar perfil' : 'Adicionar perfil',
      valores: p || {ativo:true, plataforma:'instagram'},
      campos: [
        {k:'nome', rot:'Nome ou @ do perfil', req:true, dica:'Ex: @appdamarca'},
        {k:'plataforma', rot:'Plataforma', tipo:'select', req:true, op:PLAT},
        {k:'marca_id', rot:'Marca', tipo:'select', op:[['', 'Sem marca']].concat(S.marcas.filter(function(m){ return !m.exemplo; }).map(function(m){ return [m.id, m.nome]; })), dica:'As marcas vêm da aba Marcas.'},
        {k:'url', rot:'Link do perfil', tipo:'url', cheio:true},
        {k:'obs', rot:'Observação', tipo:'textarea', cheio:true},
        {k:'ativo', rot:'Perfil ativo', tipo:'checkbox', cheio:true}
      ],
      onSalvar: async function(o){
        if(o.url && !/^https?:\/\//i.test(o.url)){ toast('O link precisa começar com https://', 'erro'); return false; }
        return p ? !!(await atualizar('perfis', id, o)) : !!(await inserir('perfis', o));
      },
      onApagar: p ? async function(){
        if(!confirm('Apagar o perfil apaga também os vídeos e métricas registrados nele. Continuar?')) return false;
        var ok = await apagar('perfis', id); if(ok) await carregar(); return ok;
      } : null
    });
  }
  function formSeguidores(id){
    var p = achar('perfis', id); if(!p) return;
    abrirForm({
      titulo: 'Seguidores de ' + p.nome,
      valores: {coletado_em: localAgora()},
      campos: [
        {k:'seguidores', rot:'Seguidores', tipo:'number', req:true, passo:'1'},
        {k:'coletado_em', rot:'Data e hora da contagem', tipo:'datetime-local', req:true}
      ],
      onSalvar: async function(o){
        if(o.seguidores < 0){ toast('O número não pode ser negativo', 'erro'); return false; }
        var d = new Date(o.coletado_em); if(isNaN(d)){ toast('Data inválida', 'erro'); return false; }
        var ok = !!(await inserir('perfis_snapshots', {perfil_id:id, seguidores:Math.round(o.seguidores), coletado_em:d.toISOString(), origem:'manual'}));
        if(ok) toast('Seguidores registrados');
        return ok;
      }
    });
  }

  /* ---------- liga no painel ---------- */
  function registrar(){
    ICONES.desempenho = '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>';
    ABAS.desempenho = {t:'Desempenho', v:vDesempenho};
    ACOES['perfil-novo'] = function(){ formPerfil(); };
    ACOES['perfil-editar'] = function(b){ formPerfil(b.dataset.id); };
    ACOES['perfil-seg'] = function(b){ formSeguidores(b.dataset.id); };
    if(window.ModPublicacoes) window.ModPublicacoes.registrar();
    if(window.ModRadar) window.ModRadar.registrar();
    document.addEventListener('change', function(e){
      var id = e.target.id; if(!id || id.indexOf('c-f-') !== 0) return;
      F[id.slice(4)] = e.target.value; renderizar();
    });
  }

  window.ModConteudo = {
    registrar:registrar, carregar:carregar, F:F, PLAT:PLAT, PERIODOS:PERIODOS, MIN_COMPARAVEIS:MIN_COMPARAVEIS,
    _calc:{calcular:calcular, mediana:mediana, viewsNaIdade:viewsNaIdade, indexarSnaps:indexarSnaps, idadeH:idadeH, ultimo:ultimo, engajamento:engajamento, relativo:relativo},
    util:{n:n, curto:curto, dataHora:dataHora, idadeTxt:idadeTxt, rotOrigem:rotOrigem, pctTxt:pctTxt, nomePerfil:nomePerfil, nomePlat:nomePlat, localAgora:localAgora, nomeMarca:nomeMarca}
  };
})();
