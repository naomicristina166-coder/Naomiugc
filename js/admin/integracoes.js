/* ============================================================
   INTEGRAÇÕES (Etapa 7 · começando pelo Instagram)
   - Mostra o status de cada perfil conectado.
   - "Conectar": você cola a chave do Instagram; ela vai direto para o
     servidor (Edge Function "instagram") e o navegador nunca mais a vê.
   - "Atualizar agora": pede uma coleta na hora.
   - Avisos quando uma conta precisa ser reconectada.
   ============================================================ */
(function(){
  var FUNCAO = 'instagram';
  var ROT = {ativa:'Conectado', reconectar:'Reconectar', erro:'Com erro', pausada:'Pausado'};
  var COR = {ativa:'s-cliente', reconectar:'s-lead', erro:'s-lead', pausada:'s-parada'};
  var NOME_METRICA = {views:'views', reach:'alcance', likes:'curtidas', comments:'comentários', shares:'compartilhamentos', saved:'salvamentos', ig_reels_avg_watch_time:'tempo médio assistido'};

  async function carregar(){
    try{
      var r = await window.db.from('integracoes').select('*');
      if(r.error) throw r.error;
      S.integracoes = r.data || []; delete falta.integracoes;
    }catch(e){ S.integracoes = []; falta.integracoes = msgErro(e); }
    try{
      var l = await window.db.from('logs_coleta').select('*').order('criado_em', {ascending:false}).limit(30);
      if(l.error) throw l.error;
      S.logs_coleta = l.data || []; delete falta.logs_coleta;
    }catch(e){ S.logs_coleta = []; falta.logs_coleta = msgErro(e); }
  }
  function daPerfil(id){ return (S.integracoes || []).find(function(i){ return i.perfil_id === id; }); }
  function quando(d){ return d ? new Date(d).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'nunca'; }

  /* Célula "Conexão" na tabela de perfis */
  function celula(p){
    if(p.plataforma !== 'instagram') return '<span class="muted" style="font-size:.8rem">em breve</span>';
    var i = daPerfil(p.id);
    if(!i) return '<button class="btn mini" data-acao="integ-conectar" data-id="' + esc(p.id) + '">Conectar</button>';
    var dias = i.token_expira_em ? Math.round((new Date(i.token_expira_em) - Date.now()) / 864e5) : null;
    return '<span class="pilula ' + COR[i.status] + '" title="' + esc(i.ultimo_erro || ('Última coleta: ' + quando(i.ultimo_sync))) + '">' + ROT[i.status] + '</span>' +
      '<div class="muted" style="font-size:.75rem;margin-top:2px">@' + esc(i.usuario || '') + ' · coleta ' + quando(i.ultimo_sync) + (dias !== null && dias < 15 ? ' · chave vence em ' + dias + 'd' : '') + '</div>' +
      '<div class="acoes" style="margin-top:4px">' + (i.status === 'ativa' || i.status === 'erro' ? '<button class="btn mini" data-acao="integ-sync" data-id="' + esc(p.id) + '">Atualizar agora</button>' : '') +
      '<button class="btn mini" data-acao="integ-conectar" data-id="' + esc(p.id) + '">' + (i.status === 'reconectar' ? 'Reconectar' : 'Trocar chave') + '</button></div>';
  }

  /* Alertas no topo do Desempenho */
  function alertas(){
    var ruins = (S.integracoes || []).filter(function(i){ return i.status === 'reconectar' || i.status === 'erro'; });
    var vencendo = (S.integracoes || []).filter(function(i){ return i.status === 'ativa' && i.token_expira_em && new Date(i.token_expira_em) - Date.now() < 7 * 864e5; });
    var semMetricas = {};
    (S.integracoes || []).forEach(function(i){ (i.metricas_indisponiveis || []).forEach(function(m){ semMetricas[NOME_METRICA[m] || m] = true; }); });
    var h = '';
    if(ruins.length || vencendo.length){
      h += '<div class="aviso" role="alert"><b>Conexões que precisam de atenção</b>' +
        ruins.map(function(i){ return '@' + esc(i.usuario || '') + ': ' + esc(i.ultimo_erro || ROT[i.status]); }).join('<br>') +
        (ruins.length && vencendo.length ? '<br>' : '') +
        vencendo.map(function(i){ return '@' + esc(i.usuario || '') + ': a chave vence em ' + quando(i.token_expira_em) + ' e não consegui renovar. Gere uma nova e clique em "Trocar chave".'; }).join('<br>') + '</div>';
    }
    var ks = Object.keys(semMetricas);
    if(ks.length) h += '<p class="muted" style="margin:-6px 0 14px;font-size:.8rem">O Instagram não está entregando: ' + esc(ks.join(', ')) + '. Esses campos ficam vazios na coleta automática (você pode completar à mão).</p>';
    return h;
  }

  function painelLogs(){
    var l = (S.logs_coleta || []).slice(0, 8);
    if(!l.length) return '';
    var porInteg = {}; (S.integracoes || []).forEach(function(i){ porInteg[i.id] = i; });
    var cor = {info:'', aviso:'s-lead', erro:'s-lead'};
    return '<div class="painel"><h2>Registro das coletas automáticas</h2>' + l.map(function(x){
      var i = porInteg[x.integracao_id];
      return '<div class="atras"><span class="pilula ' + cor[x.nivel] + '" style="' + (x.nivel === 'info' ? 'border:1px solid var(--line)' : '') + '">' + (x.nivel === 'info' ? 'ok' : x.nivel) + '</span><span class="t">' + esc(x.mensagem) + (i ? ' <span class="muted">@' + esc(i.usuario || '') + '</span>' : '') + '</span><span class="muted" style="white-space:nowrap">' + quando(x.criado_em) + '</span></div>';
    }).join('') + '</div>';
  }

  async function chamar(corpo){
    var r = await window.db.functions.invoke(FUNCAO, {body:corpo});
    if(r.error){
      var msg = r.error.message || 'erro';
      try{ var j = await r.error.context.json(); if(j && j.erro) msg = j.erro; }catch(e){}
      throw new Error(msg);
    }
    return r.data;
  }

  function formConectar(perfilId){
    var p = achar('perfis', perfilId); if(!p) return;
    var m = modal('Conectar ' + p.nome + ' (Instagram)',
      '<ol style="margin:0 0 12px 18px;padding:0;font-size:.88rem;line-height:1.6">' +
        '<li>No painel de desenvolvedora da Meta, abra o seu app → <b>Instagram</b> → <b>Configuração da API com login do Instagram</b>.</li>' +
        '<li>Em <b>Gerar tokens de acesso</b>, clique em <b>Gerar token</b> ao lado desta conta.</li>' +
        '<li>Copie a chave e cole aqui embaixo.</li></ol>' +
      '<form id="f-integ" novalidate><div class="cp cheio"><label for="integ-token">Chave de acesso (token)</label>' +
        '<input id="integ-token" name="token" type="password" autocomplete="off" spellcheck="false" required>' +
        '<small>A chave vai direto para o servidor e fica guardada de forma que o navegador não consegue ler de volta.</small></div>' +
        '<div class="m-acoes"><span class="espaco"></span><button type="button" class="btn" data-acao="fechar">Cancelar</button><button type="submit" class="btn cheio">Conectar</button></div></form>');
    var f = m.querySelector('form');
    f.addEventListener('submit', async function(e){
      e.preventDefault();
      var inp = f.elements.token, t = inp.value.trim();
      if(t.length < 20){ toast('Cole a chave inteira', 'erro'); inp.focus(); return; }
      var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Conectando e coletando...';
      try{
        var d = await chamar({acao:'conectar', perfil_id:perfilId, token:t});
        inp.value = '';
        fecharModal();
        var c = d.coleta || {};
        toast('Conectado como @' + d.usuario + '. ' + (c.novos || 0) + ' vídeos novos, ' + (c.medidos || 0) + ' medidos.');
        await window.ModConteudo.carregar(); renderizar();
      }catch(err){
        toast('Não conectou: ' + err.message, 'erro');
        b.disabled = false; b.textContent = 'Conectar';
      }
    });
  }

  async function atualizarAgora(perfilId, botao){
    if(botao){ botao.disabled = true; botao.textContent = 'Coletando...'; }
    try{
      var d = await chamar({acao:'sync', perfil_id:perfilId});
      var r = (d.resultados || [])[0] || {};
      toast((r.avisos && r.avisos.length && !r.medidos ? r.avisos[0] : (r.novos || 0) + ' vídeos novos, ' + (r.medidos || 0) + ' medidos'));
      await window.ModConteudo.carregar(); renderizar();
    }catch(err){
      toast('Não consegui coletar: ' + err.message, 'erro');
      if(botao){ botao.disabled = false; botao.textContent = 'Atualizar agora'; }
    }
  }

  function registrar(){
    ACOES['integ-conectar'] = function(b){ formConectar(b.dataset.id); };
    ACOES['integ-sync'] = function(b){ atualizarAgora(b.dataset.id, b); };
  }

  window.ModInteg = {registrar:registrar, carregar:carregar, celula:celula, alertas:alertas, painelLogs:painelLogs};
})();
