/* ============================================================
   BANCO DE IDEIAS
   - Anote rápido qualquer ideia de vídeo, gancho ou roteiro.
   - "Desenvolver com o Claude": copia um pedido pronto com a ideia e o
     contexto dos seus dados (marca, perfil, ganchos e formatos que
     funcionaram). Você cola no chat do Claude e depois guarda a versão
     desenvolvida no campo "Desenvolvimento".
   - Status: nova → desenvolvendo → pronta → gravada (ou descartada).
   ============================================================ */
(function(){
  var TIPOS = [['video','Vídeo'],['gancho','Gancho'],['roteiro','Roteiro'],['outro','Outro']];
  var STATUS = [['nova','Nova'],['desenvolvendo','Desenvolvendo'],['pronta','Pronta pra gravar'],['gravada','Gravada'],['descartada','Descartada']];
  var COR = {nova:'s-lead', desenvolvendo:'s-conversando', pronta:'s-cliente', gravada:'s-parada', descartada:''};
  var F = {status:'ativas', tipo:'', marca:'', busca:'', fav:false};

  function rot(lista, v){ var x = lista.find(function(o){ return o[0] === v; }); return x ? x[1] : v; }
  function dataCurta(d){ return d ? new Date(d).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : ''; }

  async function carregar(){
    try{
      var r = await window.db.from('ideias').select('*').order('criado_em', {ascending:false}).limit(2000);
      if(r.error) throw r.error;
      S.ideias = r.data || []; delete falta.ideias;
    }catch(e){ S.ideias = []; falta.ideias = msgErro(e); }
  }

  function filtradas(){
    var b = F.busca.trim().toLowerCase();
    return (S.ideias || []).filter(function(i){
      if(F.status === 'ativas' && (i.status === 'gravada' || i.status === 'descartada')) return false;
      if(F.status && F.status !== 'ativas' && i.status !== F.status) return false;
      if(F.tipo && i.tipo !== F.tipo) return false;
      if(F.marca && i.marca_id !== F.marca) return false;
      if(F.fav && !i.favorito) return false;
      return !b || [i.texto, i.notas, i.desenvolvimento].some(function(x){ return String(x || '').toLowerCase().indexOf(b) > -1; });
    }).sort(function(a, b){ return (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0) || new Date(b.criado_em) - new Date(a.criado_em); });
  }

  /* ---------- tela ---------- */
  function vIdeias(){
    var h = avisoFalta(['ideias']);
    var marcas = S.marcas.filter(function(m){ return !m.exemplo; });
    var cont = {}; (S.ideias || []).forEach(function(i){ cont[i.status] = (cont[i.status] || 0) + 1; });
    h += '<div class="painel"><h2>Anotar uma ideia</h2>' +
      '<textarea id="id-nova" rows="3" maxlength="4000" placeholder="Ex.: mostrar o app resolvendo a lição de casa em 10 segundos, começando com &quot;minha mãe achou que eu tava colando&quot;..." aria-label="Nova ideia" style="width:100%;margin-bottom:8px"></textarea>' +
      '<div class="barra" style="margin:0"><select id="id-nova-tipo" aria-label="Tipo">' + TIPOS.map(function(t){ return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select>' +
      '<select id="id-nova-marca" aria-label="Marca"><option value="">Sem marca</option>' + marcas.map(function(m){ return '<option value="' + esc(m.id) + '">' + esc(m.nome) + '</option>'; }).join('') + '</select>' +
      '<span class="muted" style="font-size:.78rem">Ctrl + Enter salva</span><span class="espaco"></span><button class="btn cheio" data-acao="ideia-salvar-rapida">' + ic('mais') + 'Salvar ideia</button></div></div>';
    h += '<div class="barra"><input type="search" id="id-busca" placeholder="Buscar nas ideias" aria-label="Buscar ideias" value="' + esc(F.busca) + '" style="flex:1 1 200px;min-width:160px">' +
      '<select id="id-f-status" aria-label="Status"><option value="ativas"' + (F.status === 'ativas' ? ' selected' : '') + '>Em aberto (' + ((cont.nova || 0) + (cont.desenvolvendo || 0) + (cont.pronta || 0)) + ')</option><option value=""' + (F.status === '' ? ' selected' : '') + '>Todas</option>' +
        STATUS.map(function(s){ return '<option value="' + s[0] + '"' + (F.status === s[0] ? ' selected' : '') + '>' + s[1] + ' (' + (cont[s[0]] || 0) + ')</option>'; }).join('') + '</select>' +
      '<select id="id-f-tipo" aria-label="Tipo"><option value="">Todos os tipos</option>' + TIPOS.map(function(t){ return '<option value="' + t[0] + '"' + (F.tipo === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
      '<select id="id-f-marca" aria-label="Marca"><option value="">Todas as marcas</option>' + marcas.map(function(m){ return '<option value="' + esc(m.id) + '"' + (F.marca === m.id ? ' selected' : '') + '>' + esc(m.nome) + '</option>'; }).join('') + '</select>' +
      '<label class="chk"><input type="checkbox" id="id-f-fav"' + (F.fav ? ' checked' : '') + '> Só favoritas</label></div><div id="id-lista"></div>';
    return h;
  }

  function pintar(){
    var alvo = $('#id-lista'); if(!alvo) return;
    var l = filtradas();
    if(!l.length){ alvo.innerHTML = '<div class="vazio">' + ((S.ideias || []).length ? 'Nenhuma ideia com esses filtros.' : 'Nenhuma ideia ainda. Escreva a primeira ali em cima, do jeito que vier na cabeça. Depois a gente desenvolve.') + '</div>'; return; }
    var U = window.ModConteudo.util;
    alvo.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">' + l.map(function(i){
      var p = i.perfil_id ? achar('perfis', i.perfil_id) : null;
      return '<div class="painel" style="margin:0;display:flex;flex-direction:column;gap:8px' + (i.status === 'descartada' ? ';opacity:.6' : '') + '">' +
        '<div style="display:flex;gap:6px;align-items:flex-start"><div style="flex:1;white-space:pre-wrap;font-weight:600">' + esc(i.texto) + '</div>' +
          '<button class="ic-btn" data-acao="ideia-fav" data-id="' + esc(i.id) + '" aria-label="' + (i.favorito ? 'Tirar dos favoritos' : 'Favoritar') + '" style="' + (i.favorito ? 'color:var(--red)' : '') + '"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="' + (i.favorito ? 'fill:currentColor' : '') + '"><polygon points="12 2 15 9 22 9.3 16.5 14 18.2 21 12 17 5.8 21 7.5 14 2 9.3 9 9"/></svg></button></div>' +
        '<div class="chips"><span class="pilula s-conversando">' + rot(TIPOS, i.tipo) + '</span><span class="pilula ' + COR[i.status] + '"' + (i.status === 'descartada' ? ' style="border:1px dashed var(--line)"' : '') + '>' + rot(STATUS, i.status) + '</span>' +
          (i.marca_id ? '<span class="pilula s-parada">' + esc(U.nomeMarca(i.marca_id)) + '</span>' : '') + (p ? '<span class="pilula" style="border:1px solid var(--line)">' + esc(U.nomePerfil(p)) + '</span>' : '') + '</div>' +
        (i.notas ? '<div class="muted" style="font-size:.82rem;white-space:pre-wrap">' + esc(i.notas.length > 220 ? i.notas.slice(0, 220) + '…' : i.notas) + '</div>' : '') +
        (i.desenvolvimento ? '<div style="font-size:.8rem;border-left:3px solid var(--line);padding-left:8px">✓ Desenvolvida <button class="link-b" data-acao="ideia-ver" data-id="' + esc(i.id) + '">ver</button></div>' : '') +
        '<div class="muted" style="font-size:.75rem">Anotada em ' + dataCurta(i.criado_em) + '</div>' +
        '<div class="acoes" style="margin-top:auto;flex-wrap:wrap"><button class="btn mini cheio" data-acao="ideia-claude" data-id="' + esc(i.id) + '">Desenvolver com o Claude</button>' +
          '<button class="btn mini" data-acao="ideia-editar" data-id="' + esc(i.id) + '">Abrir</button>' +
          (i.tipo === 'gancho' ? '<button class="btn mini" data-acao="ideia-gancho" data-id="' + esc(i.id) + '">Pra biblioteca</button>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- pedido para o Claude, com contexto dos seus dados ---------- */
  function contexto(i){
    var linhas = [], c = window.ModConteudo._calc, U = window.ModConteudo.util;
    var perfisAlvo = S.perfis.filter(function(p){ return i.perfil_id ? p.id === i.perfil_id : (i.marca_id ? p.marca_id === i.marca_id : true); });
    var ids = {}; perfisAlvo.forEach(function(p){ ids[p.id] = true; });
    if(perfisAlvo.length) linhas.push('Perfis: ' + perfisAlvo.map(function(p){ return U.nomePerfil(p); }).join(', '));
    var por = c.indexarSnaps(S.metricas_snapshots || []), desde = Date.now() - 90 * 864e5;
    var pubs = (S.publicacoes || []).filter(function(p){ return ids[p.perfil_id] && new Date(p.publicado_em).getTime() >= desde; });
    var fm = {};
    pubs.forEach(function(p){ var v = c.viewsNaIdade(por, p, 168); if(v !== null && p.formato) (fm[p.formato] = fm[p.formato] || []).push(v); });
    var fs = Object.keys(fm).map(function(f){ return {f:f, m:c.mediana(fm[f]), n:fm[f].length}; }).sort(function(a, b){ return b.m - a.m; }).slice(0, 4);
    if(fs.length) linhas.push('Formatos nos últimos 90 dias (mediana de views com 7 dias): ' + fs.map(function(x){ return x.f + ' = ' + Math.round(x.m) + ' (' + x.n + ' vídeo' + (x.n > 1 ? 's' : '') + ')'; }).join('; '));
    var top = pubs.map(function(p){ var s = c.ultimo(por, p), idade = s ? c.idadeH(p, s) : null; var r = idade !== null && idade >= 72 ? c.relativo(p, S.publicacoes, por, Math.min(idade, 168)) : null; return {p:p, r:r && r.razao}; })
      .filter(function(x){ return x.r && x.p.gancho; }).sort(function(a, b){ return b.r - a.r; }).slice(0, 3);
    if(top.length) linhas.push('Ganchos que foram acima do normal do perfil: ' + top.map(function(x){ return '"' + x.p.gancho + '" (' + x.r.toFixed(1) + 'x)'; }).join('; '));
    var favs = (S.ganchos || []).filter(function(g){ return g.favorito; }).slice(0, 5);
    if(favs.length) linhas.push('Ganchos favoritos da minha biblioteca: ' + favs.map(function(g){ return '"' + g.texto + '"'; }).join('; '));
    return linhas;
  }
  function pedido(i){
    var U = window.ModConteudo.util, marca = i.marca_id ? U.nomeMarca(i.marca_id) : '';
    var ctx = contexto(i);
    return 'Me ajuda a desenvolver esta ideia de ' + rot(TIPOS, i.tipo).toLowerCase() + ' para o UGC Tech Canvas' + (marca ? ' (marca: ' + marca + ')' : '') + ':\n\n' +
      '"' + i.texto + '"\n' + (i.notas ? '\nMinhas notas: ' + i.notas + '\n' : '') +
      (ctx.length ? '\nContexto dos meus dados (pode ser pouca amostra, trate como pista):\n- ' + ctx.join('\n- ') + '\n' : '') +
      '\nQuero de volta:\n1. 3 opções de gancho verbal (primeira frase)\n2. Gancho visual (o que aparece nos primeiros 2 segundos)\n3. Roteiro cena a cena com fala e texto na tela\n4. Qual funcionalidade do app mostrar e em que segundo\n5. Chamada para ação\n6. Duração ideal\n7. Hipótese que esse vídeo vai testar e qual métrica olhar\n\nSem prometer viralização, e me diga quais sugestões vêm dos meus dados e quais são só ideias.';
  }
  function copiarPedido(id){
    var i = achar('ideias', id); if(!i) return;
    var txt = pedido(i);
    var ok = function(){
      toast('Pedido copiado! Cole no chat do Claude. Depois guarde a resposta em "Abrir → Desenvolvimento".');
      if(i.status === 'nova') atualizar('ideias', i.id, {status:'desenvolvendo', atualizado_em:new Date().toISOString()}).then(function(){ pintar(); });
    };
    try{ navigator.clipboard.writeText(txt).then(ok, function(){ mostrarPedido(txt); }); }catch(e){ mostrarPedido(txt); }
  }
  function mostrarPedido(txt){
    var m = modal('Copie este pedido', '<p class="muted" style="font-size:.85rem;margin-bottom:8px">Não consegui copiar sozinha. Selecione tudo (Ctrl + A) e copie (Ctrl + C):</p><textarea rows="14" style="width:100%" readonly>' + esc(txt) + '</textarea>', true);
    var t = m.querySelector('textarea'); if(t){ t.focus(); t.select(); }
  }

  /* ---------- formulários ---------- */
  function formIdeia(id){
    var i = id ? achar('ideias', id) : null, U = window.ModConteudo.util;
    abrirForm({
      titulo: i ? 'Ideia' : 'Nova ideia',
      valores: i || {tipo:'video', status:'nova'},
      campos: [
        {k:'texto', rot:'Ideia', tipo:'textarea', linhas:3, req:true, cheio:true},
        {k:'tipo', rot:'Tipo', tipo:'select', op:TIPOS},
        {k:'status', rot:'Status', tipo:'select', op:STATUS},
        {k:'marca_id', rot:'Marca', tipo:'select', op:[['', 'Sem marca']].concat(S.marcas.filter(function(m){ return !m.exemplo; }).map(function(m){ return [m.id, m.nome]; }))},
        {k:'perfil_id', rot:'Perfil', tipo:'select', op:[['', 'Qualquer perfil']].concat(S.perfis.map(function(p){ return [p.id, U.nomePerfil(p)]; }))},
        {k:'notas', rot:'Notas (referências, cenário, o que quer mostrar)', tipo:'textarea', linhas:3, cheio:true},
        {k:'desenvolvimento', rot:'Desenvolvimento (cole aqui o roteiro que vocês fizeram)', tipo:'textarea', linhas:8, cheio:true},
        {k:'favorito', rot:'Favorita', tipo:'checkbox', cheio:true}
      ],
      onSalvar: async function(o){
        if(o.texto && o.texto.length > 4000){ toast('Ideia muito longa (máx. 4000 letras)', 'erro'); return false; }
        o.atualizado_em = new Date().toISOString();
        if(o.desenvolvimento && i && i.status === 'nova' && o.status === 'nova') o.status = 'desenvolvendo';
        return i ? !!(await atualizar('ideias', id, o)) : !!(await inserir('ideias', o));
      },
      onApagar: i ? function(){ return apagar('ideias', id); } : null
    });
  }
  function verDesenvolvimento(id){
    var i = achar('ideias', id); if(!i) return;
    modal('Desenvolvimento', '<p style="font-weight:600;margin-bottom:10px;white-space:pre-wrap">' + esc(i.texto) + '</p><div style="white-space:pre-wrap;font-size:.9rem">' + esc(i.desenvolvimento || '') + '</div>' +
      '<div class="m-acoes"><span class="espaco"></span><button class="btn" data-acao="fechar">Fechar</button><button class="btn cheio" data-acao="ideia-editar" data-id="' + esc(i.id) + '">Editar</button></div>', true);
  }

  async function salvarRapida(){
    var t = $('#id-nova'); if(!t) return;
    var txt = t.value.trim(); if(!txt){ t.focus(); toast('Escreva a ideia primeiro', 'erro'); return; }
    var r = await inserir('ideias', {texto:txt.slice(0, 4000), tipo:($('#id-nova-tipo') || {}).value || 'video', marca_id:($('#id-nova-marca') || {}).value || null});
    if(r){ toast('Ideia guardada'); renderizar(); var n = $('#id-nova'); if(n) n.focus(); }
  }
  async function paraBiblioteca(id){
    var i = achar('ideias', id); if(!i) return;
    var ja = (S.ganchos || []).some(function(g){ return g.texto.trim().toLowerCase() === i.texto.trim().toLowerCase(); });
    if(ja){ toast('Esse gancho já está na biblioteca'); return; }
    if(await inserir('ganchos', {texto:i.texto.slice(0, 1000), tipo:'verbal', origem:'ideia'})) toast('Gancho salvo na biblioteca. Classifique a categoria lá.');
  }

  function registrar(){
    ICONES.ideias = '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>';
    ABAS.ideias = {t:'Ideias', v:vIdeias, depois:pintar};
    ACOES['ideia-salvar-rapida'] = salvarRapida;
    ACOES['ideia-editar'] = function(b){ fecharModal(); formIdeia(b.dataset.id); };
    ACOES['ideia-ver'] = function(b){ verDesenvolvimento(b.dataset.id); };
    ACOES['ideia-claude'] = function(b){ copiarPedido(b.dataset.id); };
    ACOES['ideia-gancho'] = function(b){ paraBiblioteca(b.dataset.id); };
    ACOES['ideia-fav'] = async function(b){ var i = achar('ideias', b.dataset.id); if(i && await atualizar('ideias', i.id, {favorito:!i.favorito})) pintar(); };
    document.addEventListener('input', function(e){ if(e.target.id === 'id-busca'){ F.busca = e.target.value; pintar(); } });
    document.addEventListener('change', function(e){
      var id = e.target.id; if(!id || id.indexOf('id-f-') !== 0) return;
      F[id.slice(5)] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; renderizar();
    });
    document.addEventListener('keydown', function(e){
      if(e.target.id === 'id-nova' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); salvarRapida(); }
    });
  }

  window.ModIdeias = {registrar:registrar, carregar:carregar, _t:{pedido:pedido, contexto:contexto}};
})();
