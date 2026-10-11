/* ============================================================
   ABA VÍDEOS PUBLICADOS (UGC Tech Canvas · Etapa 2)
   Registro de publicações e do histórico de métricas.

   - Cada medição é uma "fotografia" com data, idade do vídeo e origem.
   - Marcos de medição (24h, 72h, 7 dias...) são configuráveis.
   - Comparações só entre vídeos do mesmo perfil, na mesma idade,
     e (quando pedido) do mesmo formato.
   - Vídeo com poucas horas nunca é chamado de "abaixo do normal".

   Usa as ferramentas do painel e do módulo Desempenho (ModConteudo).
   ============================================================ */
(function(){
  var FORMATOS = ['Demonstração de app','Tutorial','Descoberta de funcionalidade','Problema e solução','Comparação','Antes e depois','Reação','Review','História curta','Lista / top'];
  var CHAVE_MARCOS = 'ugc_marcos_horas';
  var PADRAO_MARCOS = [24, 72, 168];
  var FP = {formato:''};
  var H = 36e5;

  var C = function(){ return window.ModConteudo._calc; };
  var U = function(){ return window.ModConteudo.util; };

  /* ---------- marcos de medição (preferência deste navegador) ---------- */
  function marcos(){
    try{
      var v = JSON.parse(localStorage.getItem(CHAVE_MARCOS) || 'null');
      if(Array.isArray(v) && v.length && v.every(function(x){ return typeof x === 'number' && x > 0; })) return v.slice().sort(function(a, b){ return a - b; });
    }catch(e){}
    return PADRAO_MARCOS.slice();
  }
  function salvarMarcos(l){ try{ localStorage.setItem(CHAVE_MARCOS, JSON.stringify(l)); return true; }catch(e){ return false; } }
  function rotMarco(h){ return h < 48 ? h + 'h' : (h % 24 === 0 ? (h / 24) + 'd' : h + 'h'); }

  /* Situação de cada marco: feito, agora (está na janela), passou (janela perdida) ou futuro.
     Janela aceita: de 75% a 150% da idade do marco. */
  function situacaoMarcos(pub, snapsDoVideo, agora){
    agora = agora || Date.now();
    var pubMs = new Date(pub.publicado_em).getTime();
    if(!isFinite(pubMs)) return [];
    var idade = (agora - pubMs) / H;
    var idades = (snapsDoVideo || []).map(function(s){ return (new Date(s.coletado_em).getTime() - pubMs) / H; });
    return marcos().map(function(m){
      var ini = m * 0.75, fim = m * 1.5;
      var feito = idades.some(function(i){ return i >= ini && i <= fim; });
      var st = feito ? 'feito' : idade < ini ? 'futuro' : idade <= fim ? 'agora' : 'passou';
      return {marco:m, st:st, ini:ini, fim:fim, idade:idade};
    });
  }

  /* ---------- dados auxiliares ---------- */
  function perfisFiltrados(){
    var F = window.ModConteudo.F;
    return S.perfis.filter(function(p){
      return (!F.perfil || p.id === F.perfil) && (!F.plat || p.plataforma === F.plat) && (!F.marca || p.marca_id === F.marca);
    });
  }
  function pubsFiltradas(){
    var F = window.ModConteudo.F, ids = {};
    perfisFiltrados().forEach(function(p){ ids[p.id] = true; });
    var desde = F.periodo === 'tudo' ? -Infinity : Date.now() - Number(F.periodo) * 24 * H;
    return S.publicacoes.filter(function(p){
      if(!ids[p.perfil_id]) return false;
      if(FP.formato && (p.formato || '') !== FP.formato) return false;
      var t = new Date(p.publicado_em).getTime();
      return isFinite(t) ? t >= desde : F.periodo === 'tudo';
    }).sort(function(a, b){ return (new Date(b.publicado_em).getTime() || 0) - (new Date(a.publicado_em).getTime() || 0); });
  }
  function isoParaLocal(iso){
    if(!iso) return '';
    var d = new Date(iso); if(isNaN(d)) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16);
  }
  function formatosUsados(){
    var s = {}; S.publicacoes.forEach(function(p){ if(p.formato) s[p.formato] = true; });
    return Object.keys(s).sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); });
  }
  function tituloPub(p){ return p.titulo || p.gancho || 'Sem título'; }

  /* Compara com vídeos do mesmo perfil (e do mesmo formato, se pedir) na mesma idade */
  function comparar(pub, horas, mesmoFormato){
    var c = C(), por = c.indexarSnaps(S.metricas_snapshots);
    var v = c.viewsNaIdade(por, pub, horas);
    var outros = S.publicacoes.filter(function(o){
      return o.id !== pub.id && o.perfil_id === pub.perfil_id && (!mesmoFormato || (o.formato || '') === (pub.formato || ''));
    }).map(function(o){ return {pub:o, views:c.viewsNaIdade(por, o, horas)}; }).filter(function(x){ return x.views !== null; });
    var base = c.mediana(outros.map(function(x){ return x.views; }));
    return {views:v, outros:outros, base:base, razao: v !== null && base > 0 && outros.length >= window.ModConteudo.MIN_COMPARAVEIS ? v / base : null};
  }

  /* ---------- painel de pendências (aparece também no Desempenho) ---------- */
  function pendencias(){
    var c = C(), por = c.indexarSnaps(S.metricas_snapshots), ativos = {};
    S.perfis.forEach(function(p){ if(p.ativo) ativos[p.id] = true; });
    var l = [];
    S.publicacoes.forEach(function(p){
      if(!ativos[p.perfil_id]) return;
      situacaoMarcos(p, por[p.id]).forEach(function(m){ if(m.st === 'agora') l.push({pub:p, m:m}); });
    });
    return l.sort(function(a, b){ return (a.m.fim - a.m.idade) - (b.m.fim - b.m.idade); });
  }
  function painelPendencias(){
    var l = pendencias();
    if(!l.length) return '';
    var u = U(), porId = {}; S.perfis.forEach(function(p){ porId[p.id] = p; });
    return '<div class="painel"><h2>Medições para fazer agora</h2>' + l.slice(0, 8).map(function(x){
      var resta = x.m.fim - x.m.idade;
      return '<div class="atras"><span class="pilula s-lead">Marco ' + rotMarco(x.m.marco) + '</span><span class="t"><b>' + esc(tituloPub(x.pub)) + '</b> <span class="muted">' + esc(u.nomePerfil(porId[x.pub.perfil_id])) + ' · tem ' + u.idadeTxt(x.m.idade) + ' · janela fecha em ' + u.idadeTxt(resta) + '</span></span>' +
        '<button class="btn mini" data-acao="pub-metricas" data-id="' + esc(x.pub.id) + '">Registrar</button></div>';
    }).join('') + (l.length > 8 ? '<p class="muted" style="margin-top:6px;font-size:.8rem">E mais ' + (l.length - 8) + ' na aba Vídeos publicados.</p>' : '') +
    '<p class="muted" style="margin-top:8px;font-size:.8rem">Medir sempre nos mesmos marcos é o que permite comparar vídeos de forma justa.</p></div>';
  }

  /* ---------- tela ---------- */
  function barraFiltros(){
    var F = window.ModConteudo.F, u = U();
    var marcasUsadas = S.marcas.filter(function(m){ return !m.exemplo && S.perfis.some(function(p){ return p.marca_id === m.id; }); });
    var sel = function(id, rot, ops, val){ return '<select id="' + id + '" aria-label="' + rot + '"><option value="">' + rot + '</option>' + ops.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    return '<div class="barra">' +
      sel('c-f-perfil', 'Todos os perfis', S.perfis.map(function(p){ return [p.id, u.nomePerfil(p)]; }), F.perfil) +
      sel('c-f-marca', 'Todas as marcas', marcasUsadas.map(function(m){ return [m.id, m.nome]; }), F.marca) +
      sel('c-f-plat', 'Todas as plataformas', window.ModConteudo.PLAT, F.plat) +
      sel('pv-formato', 'Todos os formatos', formatosUsados().map(function(f){ return [f, f]; }), FP.formato) +
      '<select id="c-f-periodo" aria-label="Período">' + window.ModConteudo.PERIODOS.map(function(o){ return '<option value="' + o[0] + '"' + (F.periodo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<span class="espaco"></span><button class="btn" data-acao="marcos-config">Marcos: ' + marcos().map(rotMarco).join(', ') + '</button>' +
      '<button class="btn cheio" data-acao="pub-novo">' + ic('mais') + 'Adicionar vídeo</button></div>';
  }

  function chipsMarcos(sit){
    var cor = {feito:'s-cliente', agora:'s-lead', passou:'s-parada', futuro:''};
    var txt = {feito:'feito', agora:'medir agora', passou:'janela passou', futuro:'ainda não'};
    return sit.map(function(m){
      return '<span class="pilula ' + cor[m.st] + '" title="Marco ' + rotMarco(m.marco) + ': ' + txt[m.st] + '" style="margin:1px 2px 1px 0;' + (m.st === 'futuro' ? 'background:transparent;border:1px dashed var(--line)' : '') + '">' + rotMarco(m.marco) + (m.st === 'feito' ? ' ✓' : m.st === 'agora' ? ' !' : '') + '</span>';
    }).join('');
  }

  function vPublicacoes(){
    var h = avisoFalta(['perfis', 'publicacoes', 'metricas_snapshots']);
    if(!S.perfis.length) return h + '<div class="vazio">Primeiro cadastre um perfil na aba <button class="link-b" data-acao="ir" data-aba="desempenho">Desempenho</button>. Depois os vídeos de cada perfil entram aqui.</div>';
    h += barraFiltros();

    var c = C(), u = U(), por = c.indexarSnaps(S.metricas_snapshots), porId = {};
    S.perfis.forEach(function(p){ porId[p.id] = p; });
    var lista = pubsFiltradas();

    if(!lista.length){
      h += '<div class="vazio">' + (S.publicacoes.length ? 'Nenhum vídeo neste filtro. Tente "Desde o começo" no período.' : 'Nenhum vídeo ainda. Clique em "Adicionar vídeo" e depois registre as views nos marcos de medição.') + '</div>';
    } else {
      h += '<div class="rolagem"><table style="min-width:1050px"><thead><tr><th>Vídeo</th><th>Perfil</th><th>Publicado</th><th>Formato</th><th>Views</th><th>Engaj.</th><th>Vs. normal do perfil</th><th>Marcos</th><th></th></tr></thead><tbody>' +
        lista.map(function(p){
          var s = c.ultimo(por, p), idade = s ? c.idadeH(p, s) : null, link = seguro(p.url), rel = '';
          if(!s) rel = '<span class="muted">sem métricas</span>';
          else if(idade === null || idade < 72) rel = '<span class="muted" title="Só comparamos depois de 3 dias">cedo para dizer</span>';
          else {
            var r = c.relativo(p, S.publicacoes, por, Math.min(idade, 168));
            rel = r && r.razao !== null
              ? '<span class="pilula ' + (r.razao >= 1 ? 's-cliente' : 's-parada') + '" title="Mediana de ' + r.n + ' vídeos do perfil com ' + u.idadeTxt(r.horas) + ': ' + u.n(Math.round(r.base)) + ' views">' + r.razao.toLocaleString('pt-BR', {maximumFractionDigits:1}) + 'x</span>'
              : '<span class="muted" title="Precisa de mais vídeos do perfil medidos na mesma idade">poucos dados</span>';
          }
          var t = esc(tituloPub(p));
          return '<tr><td><b>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + t + '</a>' : t) + '</b>' +
              (p.gancho && p.titulo ? '<div class="muted" style="font-size:.78rem;max-width:260px">Gancho: ' + esc(p.gancho) + '</div>' : '') + '</td>' +
            '<td>' + esc(u.nomePerfil(porId[p.perfil_id])) + '</td>' +
            '<td>' + (p.publicado_em ? u.dataHora(p.publicado_em) : '—') + '</td>' +
            '<td>' + esc(p.formato || '') + (p.duracao_seg ? '<div class="muted" style="font-size:.78rem">' + Math.round(p.duracao_seg) + 's</div>' : '') + '</td>' +
            '<td>' + (s ? '<b>' + u.curto(s.views) + '</b><div class="muted" style="font-size:.78rem">com ' + u.idadeTxt(idade) + ' · ' + u.rotOrigem(s.origem) + '</div>' : '—') + '</td>' +
            '<td>' + u.pctTxt(c.engajamento(s)) + '</td><td>' + rel + '</td>' +
            '<td>' + chipsMarcos(situacaoMarcos(p, por[p.id])) + '</td>' +
            '<td><div class="acoes"><button class="btn mini" data-acao="pub-metricas" data-id="' + esc(p.id) + '">+ Métricas</button>' +
              '<button class="btn mini" data-acao="pub-hist" data-id="' + esc(p.id) + '">Histórico</button>' +
              '<button class="ic-btn" data-acao="pub-editar" data-id="' + esc(p.id) + '" aria-label="Editar vídeo">' + ic('editar') + '</button></div></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="muted" style="margin:8px 0 16px;font-size:.8rem">"Vs. normal do perfil" compara com a mediana dos outros vídeos do mesmo perfil na mesma idade (até 7 dias). Antes de 3 dias o vídeo ainda está crescendo e não é comparado.</p>';
    }

    h += painelFormatos(lista, por);
    return h;
  }

  /* Comparação por formato: mediana de views em 72h e 7 dias, com a quantidade de vídeos */
  function painelFormatos(lista, por){
    var c = C(), u = U(), g = {};
    lista.forEach(function(p){ var f = p.formato || 'Sem formato'; (g[f] = g[f] || []).push(p); });
    var ks = Object.keys(g);
    if(!ks.length) return '';
    var linhas = ks.map(function(f){
      var v72 = g[f].map(function(p){ return c.viewsNaIdade(por, p, 72); }).filter(function(x){ return x !== null; });
      var v7d = g[f].map(function(p){ return c.viewsNaIdade(por, p, 168); }).filter(function(x){ return x !== null; });
      var eng = g[f].map(function(p){ return c.engajamento(c.ultimo(por, p)); }).filter(function(x){ return x !== null; });
      return {f:f, n:g[f].length, m72:c.mediana(v72), n72:v72.length, m7:c.mediana(v7d), n7:v7d.length, eng:c.mediana(eng)};
    }).sort(function(a, b){ return (b.m7 || b.m72 || 0) - (a.m7 || a.m72 || 0); });
    var cel = function(m, nn){ return m === null ? '<span class="muted">—</span>' : u.curto(Math.round(m)) + ' <span class="muted" style="font-size:.78rem">(' + nn + ')</span>'; };
    return '<div class="painel"><h2>Comparação por formato</h2><div class="rolagem"><table><thead><tr><th>Formato</th><th>Vídeos</th><th>Mediana com 3 dias</th><th>Mediana com 7 dias</th><th>Engajamento mediano</th></tr></thead><tbody>' +
      linhas.map(function(l){
        return '<tr><td><b>' + esc(l.f) + '</b>' + (Math.max(l.n72, l.n7) < 3 ? ' <span class="ex">Poucos dados</span>' : '') + '</td><td>' + l.n + '</td><td>' + cel(l.m72, l.n72) + '</td><td>' + cel(l.m7, l.n7) + '</td><td>' + u.pctTxt(l.eng) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="muted" style="margin-top:8px;font-size:.8rem">Entre parênteses: quantos vídeos têm medição naquela idade. Com menos de 3, é só uma pista, não um padrão. Considera os filtros acima (inclusive perfis diferentes).</p></div>';
  }

  /* ---------- formulários ---------- */
  function formPub(id){
    var p = id ? achar('publicacoes', id) : null, u = U(), F = window.ModConteudo.F;
    var v = p ? Object.assign({}, p, {publicado_em:isoParaLocal(p.publicado_em)}) : {perfil_id:F.perfil || (S.perfis.length === 1 ? S.perfis[0].id : ''), publicado_em:u.localAgora()};
    var camps = S.campanhas.filter(function(c){ return !c.exemplo; });
    abrirForm({
      titulo: p ? 'Editar vídeo' : 'Adicionar vídeo publicado',
      valores: v,
      campos: [
        {k:'perfil_id', rot:'Perfil', tipo:'select', req:true, op:[['', 'Escolha o perfil']].concat(S.perfis.map(function(x){ return [x.id, u.nomePerfil(x)]; }))},
        {k:'publicado_em', rot:'Data e hora da publicação', tipo:'datetime-local', req:true, dica:'A hora certa importa: é com ela que calculamos a idade do vídeo.'},
        {k:'titulo', rot:'Título (para você reconhecer)', cheio:true},
        {k:'url', rot:'Link do vídeo', tipo:'url', cheio:true},
        {k:'gancho', rot:'Gancho (primeira frase ou cena)', tipo:'textarea', linhas:2, cheio:true},
        {k:'gancho_id', rot:'Gancho da biblioteca (opcional)', tipo:'select', cheio:true, op:[['', 'Nenhum']].concat((S.ganchos || []).map(function(g){ return [g.id, (g.tipo === 'visual' ? '[visual] ' : '') + (g.texto.length > 70 ? g.texto.slice(0, 70) + '…' : g.texto)]; })), dica:'Liga o vídeo ao gancho para medir o resultado dele na Biblioteca de ganchos.'},
        {k:'formato', rot:'Formato', lista:FORMATOS.concat(formatosUsados().filter(function(f){ return FORMATOS.indexOf(f) < 0; }))},
        {k:'duracao_seg', rot:'Duração (segundos)', tipo:'number', passo:'1'},
        {k:'campanha_id', rot:'Campanha (opcional)', tipo:'select', op:[['', 'Nenhuma']].concat(camps.map(function(c){ return [c.id, c.campanha + (c.cliente ? ' · ' + c.cliente : '')]; }))},
        {k:'obs', rot:'Observação', tipo:'textarea', linhas:2, cheio:true}
      ],
      onSalvar: async function(o){
        var d = new Date(o.publicado_em); if(isNaN(d)){ toast('Data de publicação inválida', 'erro'); return false; }
        if(d.getTime() > Date.now() + 5 * 60e3){ toast('A data de publicação está no futuro', 'erro'); return false; }
        if(o.url && !/^https?:\/\//i.test(o.url)){ toast('O link precisa começar com https://', 'erro'); return false; }
        if(o.duracao_seg !== null && o.duracao_seg < 0){ toast('A duração não pode ser negativa', 'erro'); return false; }
        if(!o.titulo && !o.gancho && !o.url){ toast('Preencha pelo menos o título, o gancho ou o link', 'erro'); return false; }
        o.publicado_em = d.toISOString();
        if(o.gancho_id && !o.gancho){ var gg = achar('ganchos', o.gancho_id); if(gg && gg.tipo === 'verbal') o.gancho = gg.texto; }
        if(p) return !!(await atualizar('publicacoes', id, o));
        o.origem = 'manual';
        var r = await inserir('publicacoes', o);
        if(r) toast('Vídeo salvo. Agora registre as views nos marcos.');
        return !!r;
      },
      onApagar: p ? async function(){
        var ok = await apagar('publicacoes', id);
        if(ok) S.metricas_snapshots = S.metricas_snapshots.filter(function(s){ return s.publicacao_id !== id; });
        return ok;
      } : null
    });
  }

  function formMetricas(id){
    var p = achar('publicacoes', id); if(!p) return;
    var u = U(), idadeAgora = (Date.now() - new Date(p.publicado_em).getTime()) / H;
    var numero = function(k, rot, dica, passo){ return {k:k, rot:rot, tipo:'number', passo:passo || '1', dica:dica}; };
    abrirForm({
      titulo: 'Métricas: ' + tituloPub(p),
      valores: {coletado_em: u.localAgora()},
      campos: [
        {k:'coletado_em', rot:'Data e hora em que você olhou os números', tipo:'datetime-local', req:true, cheio:true, dica:'Agora o vídeo tem ' + u.idadeTxt(idadeAgora) + '. Se anotou os números antes, coloque a hora em que anotou.'},
        {k:'views', rot:'Visualizações', tipo:'number', passo:'1', req:true},
        numero('curtidas', 'Curtidas'), numero('comentarios', 'Comentários'),
        numero('compartilhamentos', 'Compartilhamentos'), numero('salvamentos', 'Salvamentos', 'Deixe vazio se a plataforma não mostra.'),
        numero('alcance', 'Alcance / contas alcançadas', 'Opcional.'),
        numero('tempo_medio_seg', 'Tempo médio assistido (s)', 'Opcional, se a plataforma mostra.', '0.1'),
        numero('retencao_pct', 'Retenção (%)', 'Opcional. Ex.: % que assistiu até o fim.', '0.1'),
        numero('cliques', 'Cliques', 'Opcional.'), numero('conversoes', 'Conversões', 'Opcional.'),
        {k:'obs', rot:'Observação', tipo:'textarea', linhas:2, cheio:true}
      ],
      onSalvar: async function(o){
        var d = new Date(o.coletado_em); if(isNaN(d)){ toast('Data inválida', 'erro'); return false; }
        if(d.getTime() < new Date(p.publicado_em).getTime()){ toast('A medição não pode ser antes da publicação', 'erro'); return false; }
        if(d.getTime() > Date.now() + 5 * 60e3){ toast('A data da medição está no futuro', 'erro'); return false; }
        var nums = ['views','curtidas','comentarios','compartilhamentos','salvamentos','alcance','tempo_medio_seg','retencao_pct','cliques','conversoes'];
        for(var i = 0; i < nums.length; i++){ if(o[nums[i]] !== null && (o[nums[i]] < 0 || !isFinite(o[nums[i]]))){ toast('Os números não podem ser negativos', 'erro'); return false; } }
        if(o.retencao_pct !== null && o.retencao_pct > 100){ toast('Retenção vai de 0 a 100%', 'erro'); return false; }
        ['views','curtidas','comentarios','compartilhamentos','salvamentos','alcance','cliques','conversoes'].forEach(function(k){ if(o[k] !== null) o[k] = Math.round(o[k]); });
        o.coletado_em = d.toISOString(); o.publicacao_id = id; o.origem = 'manual';
        var r = await inserir('metricas_snapshots', o);
        if(r) toast('Métricas registradas (vídeo com ' + u.idadeTxt((d.getTime() - new Date(p.publicado_em).getTime()) / H) + ')');
        return !!r;
      }
    });
  }

  function abrirHistorico(id){
    var p = achar('publicacoes', id); if(!p) return;
    var c = C(), u = U();
    var snaps = S.metricas_snapshots.filter(function(s){ return s.publicacao_id === id; }).sort(function(a, b){ return new Date(b.coletado_em) - new Date(a.coletado_em); });
    var corpo = '';
    if(!snaps.length) corpo += '<div class="vazio">Nenhuma medição ainda.</div>';
    else corpo += '<div class="rolagem"><table style="min-width:900px"><thead><tr><th>Medido em</th><th>Idade</th><th>Views</th><th>Curt.</th><th>Coment.</th><th>Compart.</th><th>Salv.</th><th>Alcance</th><th>Tempo médio</th><th>Retenção</th><th>Origem</th><th></th></tr></thead><tbody>' +
      snaps.map(function(s){
        return '<tr><td>' + u.dataHora(s.coletado_em) + '</td><td>' + u.idadeTxt(c.idadeH(p, s)) + '</td><td><b>' + u.n(s.views) + '</b></td><td>' + u.n(s.curtidas) + '</td><td>' + u.n(s.comentarios) + '</td><td>' + u.n(s.compartilhamentos) + '</td><td>' + u.n(s.salvamentos) + '</td><td>' + u.n(s.alcance) + '</td>' +
          '<td>' + (s.tempo_medio_seg == null ? '—' : String(s.tempo_medio_seg).replace('.', ',') + 's') + '</td><td>' + (s.retencao_pct == null ? '—' : String(s.retencao_pct).replace('.', ',') + '%') + '</td><td>' + u.rotOrigem(s.origem) + '</td>' +
          '<td>' + (s.origem === 'manual' ? '<button class="ic-btn perigo" data-acao="snap-apagar" data-id="' + esc(s.id) + '" data-pub="' + esc(id) + '" aria-label="Apagar medição">' + ic('lixo') + '</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    /* Comparação com vídeos parecidos, na idade da última medição */
    if(snaps.length){
      var idade = c.idadeH(p, snaps[0]);
      if(idade !== null && idade > 0){
        var h = Math.min(idade, 168);
        var blocos = [['Mesmo perfil', comparar(p, h, false)]];
        if(p.formato) blocos.push(['Mesmo perfil e formato (' + p.formato + ')', comparar(p, h, true)]);
        corpo += '<h3 style="font-size:.9rem;margin:16px 0 6px">Comparação com vídeos parecidos, com ' + u.idadeTxt(h) + '</h3>';
        corpo += blocos.map(function(b){
          var r = b[1];
          if(r.views === null) return '<p class="muted" style="font-size:.85rem"><b>' + esc(b[0]) + ':</b> este vídeo não tem medição perto dessa idade.</p>';
          if(r.outros.length < window.ModConteudo.MIN_COMPARAVEIS) return '<p class="muted" style="font-size:.85rem"><b>' + esc(b[0]) + ':</b> só ' + r.outros.length + ' vídeo(s) medidos nessa idade. Precisa de pelo menos ' + window.ModConteudo.MIN_COMPARAVEIS + ' para comparar.</p>';
          var tx = idade < 72 ? ' <span class="muted">(ainda é cedo: o vídeo tem menos de 3 dias)</span>' : '';
          return '<p style="font-size:.85rem"><b>' + esc(b[0]) + ':</b> ' + u.n(r.views) + ' views contra mediana de ' + u.n(Math.round(r.base)) + ' em ' + r.outros.length + ' vídeos → <b>' + r.razao.toLocaleString('pt-BR', {maximumFractionDigits:1}) + 'x</b>' + tx + '</p>';
        }).join('');
      }
    }
    corpo += '<div class="m-acoes"><span class="espaco"></span><button class="btn" data-acao="fechar">Fechar</button><button class="btn cheio" data-acao="pub-metricas" data-id="' + esc(id) + '">+ Registrar métricas</button></div>';
    modal('Histórico: ' + tituloPub(p), corpo, true);
  }

  function formMarcos(){
    abrirForm({
      titulo: 'Marcos de medição',
      valores: {horas: marcos().join(', ')},
      campos: [{k:'horas', rot:'Em quantas horas de vida você mede cada vídeo', req:true, cheio:true, dica:'Separe por vírgula. Ex.: 24, 72, 168 (7 dias), 720 (30 dias). Fica salvo neste navegador.'}],
      onSalvar: async function(o){
        var l = String(o.horas).split(/[,;\s]+/).filter(Boolean).map(Number);
        if(!l.length || l.some(function(x){ return !isFinite(x) || x <= 0 || x > 8760 || Math.round(x) !== x; })){ toast('Use números inteiros de horas, entre 1 e 8760', 'erro'); return false; }
        l = l.filter(function(x, i){ return l.indexOf(x) === i; }).sort(function(a, b){ return a - b; });
        if(!salvarMarcos(l)) toast('Não consegui salvar neste navegador; vale só até recarregar.', 'erro');
        PADRAO_MARCOS = l; return true;
      }
    });
  }

  /* ---------- liga no painel ---------- */
  function registrar(){
    ICONES.videosugc = '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3"/>';
    ABAS.publicacoes = {t:'Vídeos publicados', v:vPublicacoes};
    ACOES['pub-novo'] = function(){ formPub(); };
    ACOES['pub-editar'] = function(b){ formPub(b.dataset.id); };
    ACOES['pub-metricas'] = function(b){ fecharModal(); formMetricas(b.dataset.id); };
    ACOES['pub-hist'] = function(b){ abrirHistorico(b.dataset.id); };
    ACOES['marcos-config'] = function(){ formMarcos(); };
    ACOES['snap-apagar'] = async function(b){
      if(!confirm('Apagar esta medição? Isso não pode ser desfeito.')) return;
      if(await apagar('metricas_snapshots', b.dataset.id)){ toast('Medição apagada'); renderizar(); abrirHistorico(b.dataset.pub); }
    };
    document.addEventListener('change', function(e){
      if(e.target.id === 'pv-formato'){ FP.formato = e.target.value; renderizar(); }
    });
  }

  window.ModPublicacoes = {registrar:registrar, painelPendencias:painelPendencias, _t:{situacaoMarcos:situacaoMarcos, marcos:marcos}};
})();
