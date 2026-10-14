/* ============================================================
   RELATÓRIO MENSAL POR MARCA (Etapa 8)
   - Números calculados a partir das métricas registradas (manuais ou
     automáticas), sempre com a data da medição e a origem.
   - Comparação com o mês anterior usando a MESMA idade dos vídeos
     (mediana com 7 dias), para não comparar vídeo novo com vídeo velho.
   - Observações automáticas só com fatos; os aprendizados, oportunidades
     e o plano do próximo mês são escritos por você e ficam salvos.
   - Exporta uma versão limpa para imprimir ou salvar em PDF,
     em português ou inglês (para as marcas gringas).
   ============================================================ */
(function(){
  var R = {marca:'', mes:'', idioma:'pt'};
  var H = 36e5;

  var T = {
    pt:{titulo:'Relatório mensal', periodo:'Período', perfis:'Perfis', gerado:'Gerado em', fonte:'Fonte dos dados', ultima:'Última medição',
      resumo:'Resumo do mês', videos:'Vídeos publicados', views:'Views (medição mais recente)', med7:'Mediana de views com 7 dias', eng:'Engajamento médio', seg:'Seguidores',
      antes:'mês anterior', semDados:'sem dados', destaques:'Conteúdos que mais se destacaram', video:'Vídeo', perfil:'Perfil', publicado:'Publicado', v7:'Views com 7 dias', vsNormal:'vs. normal do perfil',
      formatos:'Formatos testados', formato:'Formato', qtd:'Vídeos', ganchos:'Ganchos testados', gancho:'Gancho', obs:'Observações dos dados', aprend:'Aprendizados do período', oport:'Oportunidades de melhoria', plano:'Plano para o próximo mês',
      metodo:'Como ler: "views com 7 dias" compara vídeos na mesma idade. Resultados com menos de 3 vídeos são pistas, não padrões.', manual:'manual', api:'automático', importacao:'importado', nenhum:'Nenhum vídeo registrado neste mês.'},
    en:{titulo:'Monthly report', periodo:'Period', perfis:'Profiles', gerado:'Generated on', fonte:'Data source', ultima:'Latest measurement',
      resumo:'Month overview', videos:'Videos published', views:'Views (latest measurement)', med7:'Median views at 7 days', eng:'Average engagement', seg:'Followers',
      antes:'previous month', semDados:'no data', destaques:'Top performing content', video:'Video', perfil:'Profile', publicado:'Published', v7:'Views at 7 days', vsNormal:'vs. profile baseline',
      formatos:'Formats tested', formato:'Format', qtd:'Videos', ganchos:'Hooks tested', gancho:'Hook', obs:'Data observations', aprend:'Key learnings', oport:'Opportunities', plano:'Next month plan',
      metodo:'How to read: "views at 7 days" compares videos at the same age. Results based on fewer than 3 videos are signals, not patterns.', manual:'manual', api:'automatic', importacao:'imported', nenhum:'No videos recorded this month.'}
  };

  var C = function(){ return window.ModConteudo._calc; };
  var U = function(){ return window.ModConteudo.util; };
  function loc(l){ return l === 'en' ? 'en-US' : 'pt-BR'; }
  function num(x, l){ return x == null ? '—' : Math.round(x).toLocaleString(loc(l)); }
  function pct(x, l){ return x == null ? '—' : (x * 100).toLocaleString(loc(l), {maximumFractionDigits:1}) + '%'; }
  function vez(x, l){ return x == null ? '—' : x.toLocaleString(loc(l), {maximumFractionDigits:1}) + 'x'; }
  function dt(d, l){ return d ? new Date(d).toLocaleDateString(loc(l)) : '—'; }
  function mesAnterior(m){ var p = m.split('-').map(Number); var d = new Date(p[0], p[1] - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function nomeMes(m, l){ var p = m.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString(loc(l), {month:'long', year:'numeric'}); }
  function mesAtual(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

  /* ---------- cálculo (puro) ---------- */
  function resumoMes(dados, perfisIds, mes, agora){
    var c = C(), por = c.indexarSnaps(dados.metricas_snapshots || []);
    var p = mes.split('-').map(Number), ini = new Date(p[0], p[1] - 1, 1).getTime(), fim = new Date(p[0], p[1], 1).getTime();
    var todas = (dados.publicacoes || []).filter(function(x){ return perfisIds[x.perfil_id]; });
    var pubs = todas.filter(function(x){ var t = new Date(x.publicado_em).getTime(); return t >= ini && t < fim; });
    var linhas = pubs.map(function(x){
      var s = c.ultimo(por, x), idade = s ? c.idadeH(x, s) : null;
      var r = idade !== null && idade >= 72 ? c.relativo(x, todas, por, Math.min(idade, 168)) : null;
      return {pub:x, ult:s, v7:c.viewsNaIdade(por, x, 168), eng:c.engajamento(s), razao: r && r.razao !== null ? r.razao : null, nRel: r ? r.n : 0};
    });
    var medidos = linhas.filter(function(l){ return l.ult && l.ult.views != null; });
    var engs = linhas.map(function(l){ return l.eng; }).filter(function(x){ return x !== null; });
    var origens = {}, ultima = null;
    pubs.forEach(function(x){ (por[x.id] || []).forEach(function(s){ origens[s.origem] = (origens[s.origem] || 0) + 1; if(!ultima || new Date(s.coletado_em) > new Date(ultima)) ultima = s.coletado_em; }); });
    var v7s = linhas.map(function(l){ return l.v7; }).filter(function(x){ return x !== null; });
    return {
      mes:mes, ini:ini, fim:fim, pubs:pubs, linhas:linhas,
      views: medidos.length ? medidos.reduce(function(t, l){ return t + Number(l.ult.views); }, 0) : null,
      nMedidos: medidos.length, med7: c.mediana(v7s), n7: v7s.length,
      eng: engs.length ? engs.reduce(function(a, b){ return a + b; }, 0) / engs.length : null,
      origens:origens, ultima:ultima
    };
  }
  function seguidoresMes(dados, perfisIds, ini, fim){
    var antes = 0, depois = 0, temA = false, temD = false;
    Object.keys(perfisIds).forEach(function(pid){
      var l = (dados.perfis_snapshots || []).filter(function(s){ return s.perfil_id === pid && s.seguidores != null; }).sort(function(a, b){ return new Date(a.coletado_em) - new Date(b.coletado_em); });
      var a = null, d = null;
      l.forEach(function(s){ var t = new Date(s.coletado_em).getTime(); if(t < ini) a = s; if(t < fim) d = s; });
      if(!a){ var dentro = l.find(function(s){ var t = new Date(s.coletado_em).getTime(); return t >= ini && t < fim; }); if(dentro && d && dentro !== d) a = dentro; }
      if(a && d){ antes += Number(a.seguidores); depois += Number(d.seguidores); temA = temD = true; }
      else if(d){ depois += Number(d.seguidores); temD = true; }
    });
    return {atual: temD ? depois : null, delta: temA ? depois - antes : null};
  }
  function calcular(dados, marcaId, mes){
    var perfis = (dados.perfis || []).filter(function(p){ return p.marca_id === marcaId; });
    var ids = {}; perfis.forEach(function(p){ ids[p.id] = true; });
    var atual = resumoMes(dados, ids, mes), anterior = resumoMes(dados, ids, mesAnterior(mes));
    var seg = seguidoresMes(dados, ids, atual.ini, atual.fim);
    var dest = atual.linhas.filter(function(l){ return l.v7 !== null || (l.ult && l.ult.views != null); })
      .sort(function(a, b){ return (b.razao || 0) - (a.razao || 0) || ((b.v7 || 0) - (a.v7 || 0)); }).slice(0, 3);
    var fm = {};
    atual.linhas.forEach(function(l){ var f = l.pub.formato || '—'; (fm[f] = fm[f] || []).push(l); });
    var formatos = Object.keys(fm).map(function(f){
      var v = fm[f].map(function(l){ return l.v7; }).filter(function(x){ return x !== null; });
      return {formato:f, n:fm[f].length, med7:C().mediana(v), n7:v.length};
    }).sort(function(a, b){ return (b.med7 || 0) - (a.med7 || 0); });
    var ganchos = atual.linhas.filter(function(l){ return l.pub.gancho; }).map(function(l){ return {texto:l.pub.gancho, v7:l.v7, razao:l.razao}; });
    return {perfis:perfis, atual:atual, anterior:anterior, seg:seg, destaques:dest, formatos:formatos, ganchos:ganchos};
  }

  /* Observações automáticas: só fatos, com o tamanho da amostra */
  function observacoes(r, l){
    var o = [], a = r.atual, b = r.anterior, en = l === 'en';
    o.push(en ? a.pubs.length + ' videos published (previous month: ' + b.pubs.length + ').' : a.pubs.length + ' vídeos publicados (mês anterior: ' + b.pubs.length + ').');
    if(a.med7 !== null && b.med7 !== null){
      var d = b.med7 > 0 ? (a.med7 - b.med7) / b.med7 : null;
      o.push(en ? 'Median views at 7 days: ' + num(a.med7, l) + ' (' + a.n7 + ' videos) vs ' + num(b.med7, l) + ' (' + b.n7 + ' videos) last month' + (d !== null ? ' (' + (d >= 0 ? '+' : '') + pct(d, l) + ')' : '') + '.'
        : 'Mediana de views com 7 dias: ' + num(a.med7, l) + ' (' + a.n7 + ' vídeos) contra ' + num(b.med7, l) + ' (' + b.n7 + ' vídeos) no mês anterior' + (d !== null ? ' (' + (d >= 0 ? '+' : '') + pct(d, l) + ')' : '') + '.');
    } else if(a.med7 === null){
      o.push(en ? 'Not enough 7-day measurements this month to compare with the previous month.' : 'Ainda não há medições com 7 dias suficientes neste mês para comparar com o anterior.');
    }
    var fs = r.formatos.filter(function(f){ return f.med7 !== null && f.formato !== '—'; });
    if(fs.length >= 2){
      var f = fs[0], aviso = f.n7 < 3 ? (en ? ' Based on fewer than 3 videos: treat it as a signal.' : ' Com menos de 3 vídeos: trate como pista.') : '';
      o.push(en ? 'Format with the highest 7-day median: "' + f.formato + '" (' + num(f.med7, l) + ', ' + f.n7 + (f.n7 === 1 ? ' video' : ' videos') + ').' + aviso : 'Formato com a maior mediana com 7 dias: "' + f.formato + '" (' + num(f.med7, l) + ', ' + f.n7 + (f.n7 === 1 ? ' vídeo' : ' vídeos') + ').' + aviso);
    }
    if(r.seg.delta !== null) o.push(en ? 'Follower change in the month: ' + (r.seg.delta >= 0 ? '+' : '') + num(r.seg.delta, l) + '.' : 'Variação de seguidores no mês: ' + (r.seg.delta >= 0 ? '+' : '') + num(r.seg.delta, l) + '.');
    return o;
  }

  /* ---------- HTML do relatório (o mesmo para a tela e para imprimir) ---------- */
  function htmlRelatorio(r, marca, mes, l, textos){
    var t = T[l], a = r.atual, b = r.anterior;
    var orig = Object.keys(a.origens).map(function(o){ return a.origens[o] + ' ' + (t[o] || o); }).join(', ') || t.semDados;
    var kpi = function(rot, v, ant){ return '<div class="rk"><small>' + rot + '</small><b>' + v + '</b>' + (ant !== undefined ? '<span>' + t.antes + ': ' + ant + '</span>' : '') + '</div>'; };
    var h = '<header class="rh"><div><div class="rt">' + esc(t.titulo) + '</div><h1>' + esc(marca) + '</h1><div class="rm">' + esc(t.periodo) + ': ' + esc(nomeMes(mes, l)) + ' · ' + esc(t.perfis) + ': ' + esc(r.perfis.map(function(p){ return p.nome + ' (' + U().nomePlat(p.plataforma) + ')'; }).join(', ')) + '</div></div>' +
      '<div class="rm" style="text-align:right">' + esc(t.gerado) + ' ' + dt(Date.now(), l) + '<br>' + esc(t.fonte) + ': ' + esc(orig) + '<br>' + esc(t.ultima) + ': ' + dt(a.ultima, l) + '</div></header>';
    h += '<h2>' + esc(t.resumo) + '</h2><div class="rks">' +
      kpi(t.videos, num(a.pubs.length, l), num(b.pubs.length, l)) +
      kpi(t.views, num(a.views, l), num(b.views, l)) +
      kpi(t.med7, num(a.med7, l), num(b.med7, l)) +
      kpi(t.eng, pct(a.eng, l), pct(b.eng, l)) +
      kpi(t.seg, num(r.seg.atual, l) + (r.seg.delta !== null ? ' <em>(' + (r.seg.delta >= 0 ? '+' : '') + num(r.seg.delta, l) + ')</em>' : '')) + '</div>';
    if(!a.pubs.length) h += '<p class="rv">' + esc(t.nenhum) + '</p>';
    if(r.destaques.length){
      h += '<h2>' + esc(t.destaques) + '</h2><table><thead><tr><th>' + t.video + '</th><th>' + t.perfil + '</th><th>' + t.publicado + '</th><th>' + t.v7 + '</th><th>' + t.vsNormal + '</th></tr></thead><tbody>' +
        r.destaques.map(function(d){
          var p = r.perfis.find(function(x){ return x.id === d.pub.perfil_id; }), link = seguro(d.pub.url), tt = esc(d.pub.titulo || d.pub.gancho || '—');
          return '<tr><td>' + (link ? '<a href="' + esc(link) + '">' + tt + '</a>' : tt) + '</td><td>' + esc(p ? p.nome : '') + '</td><td>' + dt(d.pub.publicado_em, l) + '</td><td>' + num(d.v7, l) + '</td><td>' + (d.razao !== null ? vez(d.razao, l) : '—') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if(r.formatos.length && a.pubs.length){
      h += '<h2>' + esc(t.formatos) + '</h2><table><thead><tr><th>' + t.formato + '</th><th>' + t.qtd + '</th><th>' + t.med7 + '</th></tr></thead><tbody>' +
        r.formatos.map(function(f){ return '<tr><td>' + esc(f.formato) + '</td><td>' + f.n + '</td><td>' + num(f.med7, l) + (f.n7 ? ' <span class="rm">(' + f.n7 + ')</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    if(r.ganchos.length){
      h += '<h2>' + esc(t.ganchos) + '</h2><table><thead><tr><th>' + t.gancho + '</th><th>' + t.v7 + '</th><th>' + t.vsNormal + '</th></tr></thead><tbody>' +
        r.ganchos.map(function(g){ return '<tr><td>' + esc(g.texto) + '</td><td>' + num(g.v7, l) + '</td><td>' + (g.razao !== null ? vez(g.razao, l) : '—') + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    h += '<h2>' + esc(t.obs) + '</h2><ul>' + observacoes(r, l).map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    [['aprend', textos.aprendizados], ['oport', textos.oportunidades], ['plano', textos.plano]].forEach(function(x){
      if(x[1] && x[1].trim()) h += '<h2>' + esc(t[x[0]]) + '</h2><p class="rtx">' + esc(x[1]) + '</p>';
    });
    h += '<p class="rm" style="margin-top:18px">' + esc(t.metodo) + '</p>';
    return h;
  }
  var CSS_REL = '.rel{color:#2b2118;font-size:14px;line-height:1.5}.rel h1{margin:2px 0 4px;font-size:1.5rem;color:#c8101a}.rel h2{font-size:1rem;margin:20px 0 8px;color:#654321;border-bottom:1px solid #e1d6b5;padding-bottom:4px}' +
    '.rel .rh{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:3px solid #654321;padding-bottom:10px}.rel .rt{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:#654321}' +
    '.rel .rm{font-size:.8rem;color:#6d5a44}.rel .rks{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.rel .rk{border:1px solid #e1d6b5;border-radius:8px;padding:10px 12px;background:#fbf8ee}' +
    '.rel .rk small{display:block;font-size:.72rem;color:#6d5a44}.rel .rk b{display:block;font-size:1.25rem;color:#2b2118}.rel .rk em{font-style:normal;font-size:.8rem;color:#1c5a2c}.rel .rk span{font-size:.72rem;color:#8a775f}' +
    '.rel table{width:100%;border-collapse:collapse;font-size:.85rem;min-width:0}.rel th,.rel td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee3c6;vertical-align:top}.rel th{font-size:.72rem;text-transform:uppercase;color:#6d5a44}' +
    '.rel ul{margin:0;padding-left:18px}.rel .rtx{white-space:pre-wrap;margin:0}.rel .rv{padding:12px;border:1px dashed #e1d6b5;border-radius:8px}.rel a{color:#c8101a}';

  /* ---------- tela ---------- */
  function marcasComPerfil(){ return S.marcas.filter(function(m){ return !m.exemplo && S.perfis.some(function(p){ return p.marca_id === m.id; }); }); }
  function textosSalvos(){ return (S.relatorios || []).find(function(x){ return x.marca_id === R.marca && x.mes === R.mes; }) || {}; }

  function vRelatorios(){
    var h = avisoFalta(['relatorios', 'perfis', 'publicacoes', 'metricas_snapshots']);
    var ms = marcasComPerfil();
    if(!R.mes) R.mes = mesAtual();
    if(!ms.length) return h + '<div class="vazio">Para gerar um relatório, ligue pelo menos um perfil a uma marca. Vá em <button class="link-b" data-acao="ir" data-aba="desempenho">Desempenho</button>, edite o perfil e escolha a marca (as marcas vêm da aba Marcas).</div>';
    if(!R.marca || !ms.some(function(m){ return m.id === R.marca; })) R.marca = ms[0].id;
    var marca = ms.find(function(m){ return m.id === R.marca; });
    var r = calcular(S, R.marca, R.mes), tx = textosSalvos();
    h += '<div class="barra"><select id="rl-marca" aria-label="Marca">' + ms.map(function(m){ return '<option value="' + esc(m.id) + '"' + (m.id === R.marca ? ' selected' : '') + '>' + esc(m.nome) + '</option>'; }).join('') + '</select>' +
      '<input type="month" id="rl-mes" aria-label="Mês" value="' + esc(R.mes) + '" max="' + mesAtual() + '">' +
      '<select id="rl-idioma" aria-label="Idioma do relatório"><option value="pt"' + (R.idioma === 'pt' ? ' selected' : '') + '>Português</option><option value="en"' + (R.idioma === 'en' ? ' selected' : '') + '>English</option></select>' +
      '<span class="espaco"></span><button class="btn cheio" data-acao="rel-imprimir">' + ic('baixar') + 'Imprimir / salvar PDF</button></div>';
    h += '<div class="painel"><style>' + CSS_REL + '</style><div class="rel">' + htmlRelatorio(r, marca.nome, R.mes, R.idioma, tx) + '</div></div>';
    h += '<div class="painel"><h2>Seus textos deste relatório</h2><p class="muted" style="font-size:.82rem;margin-bottom:10px">Escreva ' + (R.idioma === 'en' ? '<b>em inglês</b> (o relatório está em English)' : 'em português') + '. Eles aparecem no relatório e ficam salvos para ' + esc(marca.nome) + ' em ' + esc(nomeMes(R.mes, 'pt')) + '.</p>' +
      '<form id="rl-form" class="grade-f">' +
      '<div class="cp cheio"><label for="rl-aprend">Aprendizados do período</label><textarea id="rl-aprend" name="aprendizados" rows="3" maxlength="4000">' + esc(tx.aprendizados || '') + '</textarea><small>O que você observou nos dados. Use as observações acima como base.</small></div>' +
      '<div class="cp cheio"><label for="rl-oport">Oportunidades de melhoria</label><textarea id="rl-oport" name="oportunidades" rows="3" maxlength="4000">' + esc(tx.oportunidades || '') + '</textarea></div>' +
      '<div class="cp cheio"><label for="rl-plano">Plano para o próximo mês</label><textarea id="rl-plano" name="plano" rows="3" maxlength="4000">' + esc(tx.plano || '') + '</textarea><small>Ex.: formatos e ganchos que vai testar, quantidade de vídeos, hipóteses.</small></div>' +
      '<div class="m-acoes cheio"><span class="espaco"></span><button type="submit" class="btn cheio">Salvar textos</button></div></form></div>';
    return h;
  }

  async function salvarTextos(f){
    var o = {marca_id:R.marca, mes:R.mes, idioma:R.idioma, atualizado_em:new Date().toISOString()};
    ['aprendizados', 'oportunidades', 'plano'].forEach(function(k){ var v = f.elements[k].value.trim(); o[k] = v ? v.slice(0, 4000) : null; });
    var r = await window.db.from('relatorios').upsert(o, {onConflict:'marca_id,mes'}).select().single();
    if(r.error){ toast('Não consegui salvar: ' + msgErro(r.error), 'erro'); return; }
    S.relatorios = (S.relatorios || []).filter(function(x){ return !(x.marca_id === R.marca && x.mes === R.mes); }).concat([r.data]);
    toast('Textos salvos'); renderizar();
  }

  function imprimir(){
    var marca = S.marcas.find(function(m){ return m.id === R.marca; }); if(!marca) return;
    var r = calcular(S, R.marca, R.mes), html = htmlRelatorio(r, marca.nome, R.mes, R.idioma, textosSalvos());
    var w = window.open('', '_blank');
    if(!w){ toast('O navegador bloqueou a janela. Libere pop-ups para este site e tente de novo.', 'erro'); return; }
    w.document.open();
    w.document.write('<!doctype html><html lang="' + (R.idioma === 'en' ? 'en' : 'pt-BR') + '"><head><meta charset="utf-8"><title>' + esc(T[R.idioma].titulo + ' · ' + marca.nome + ' · ' + R.mes) + '</title>' +
      '<style>body{margin:0;padding:28px;font-family:Archivo,system-ui,-apple-system,"Segoe UI",sans-serif;background:#fff}@page{margin:14mm}@media print{body{padding:0}a{color:inherit;text-decoration:none}}' + CSS_REL + '</style></head><body><div class="rel">' + html + '</div></body></html>');
    w.document.close();
    setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 300);
  }

  async function carregar(){
    try{ var r = await window.db.from('relatorios').select('*'); if(r.error) throw r.error; S.relatorios = r.data || []; delete falta.relatorios; }
    catch(e){ S.relatorios = []; falta.relatorios = msgErro(e); }
  }

  function registrar(){
    ICONES.relatorio = '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>';
    ABAS.relatorios = {t:'Relatório mensal', v:vRelatorios};
    ACOES['rel-imprimir'] = imprimir;
    document.addEventListener('change', function(e){
      var id = e.target.id;
      if(id === 'rl-marca'){ R.marca = e.target.value; renderizar(); }
      if(id === 'rl-mes' && /^\d{4}-\d{2}$/.test(e.target.value)){ R.mes = e.target.value; renderizar(); }
      if(id === 'rl-idioma'){ R.idioma = e.target.value; renderizar(); }
    });
    document.addEventListener('submit', function(e){
      if(e.target.id === 'rl-form'){ e.preventDefault(); salvarTextos(e.target); }
    });
  }

  window.ModRelatorios = {registrar:registrar, carregar:carregar, _t:{calcular:calcular, observacoes:observacoes, mesAnterior:mesAnterior}};
})();
