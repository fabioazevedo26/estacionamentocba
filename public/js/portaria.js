/* Tela da portaria: busca em tempo real, card do veículo, entrada/saída e cadastro rápido */
(function () {
  'use strict';

  const { esc, getJSON, iniciar, agoraInput, agoraServidor, fuso } = window.CBA;

  const busca = document.getElementById('busca');
  const resultados = document.getElementById('resultados');
  const semResultado = document.getElementById('sem-resultado');
  const painel = document.getElementById('painel-veiculo');
  const painelRapido = document.getElementById('painel-rapido');
  const formRapido = document.getElementById('form-rapido');

  let lista = [];
  let ativo = -1;
  let ultimaBusca = null;
  let timer;
  let consulta = 0;

  // ---------- Busca ----------

  function marcar() {
    resultados.querySelectorAll('.resultado').forEach((b, i) => b.classList.toggle('active', i === ativo));
  }

  function badgeSituacao(v) {
    if (v.status === 'BLOQUEADO') return '<span class="chip chip-solido-bloq"><i class="bi bi-lock-fill" aria-hidden="true"></i>BLOQUEADO</span>';
    if (v.dentro) return '<span class="chip chip-info"><i class="bi bi-p-circle-fill" aria-hidden="true"></i>No pátio</span>';
    return '<span class="chip chip-neutro"><i class="bi bi-sign-turn-right" aria-hidden="true"></i>Fora</span>';
  }

  function renderResultados(dados) {
    lista = dados.resultados;
    ativo = lista.length ? 0 : -1;
    resultados.innerHTML = lista.map((v, i) => {
      const detalhes = [v.tipo, v.marca_modelo, v.cor].filter(Boolean).map(esc).join(' · ');
      const pessoa = v.dentro && v.motorista
        ? `<i class="bi bi-person-fill"></i> ${esc(v.motorista)} (desde ${esc(v.entrada)})`
        : (v.proprietario ? `<i class="bi bi-person"></i> ${esc(v.proprietario)}` : '<i>sem proprietário</i>');
      return `<button type="button" class="list-group-item list-group-item-action resultado d-flex justify-content-between align-items-center gap-2" data-i="${i}">
        <div><span class="placa ${esc(v.placa_classe)}">${esc(v.placa)}</span> <span class="ms-2">${detalhes}</span>
          <div class="small text-body-secondary">${pessoa}</div></div>
        <div>${badgeSituacao(v)}</div></button>`;
    }).join('');
    marcar();

    // Sem resultado: oferece o cadastro rápido
    semResultado.classList.toggle('d-none', lista.length > 0 || !dados.placa);
    if (!lista.length && dados.placa) {
      const podeCadastrar = !dados.placaExiste && dados.placa.length >= 4;
      const aviso = dados.placaExiste
        ? `A placa <span class="placa">${esc(dados.placaFormatada)}</span> existe mas está <strong>inativa</strong>. Reative-a em Veículos.`
        : `${dados.placaValida ? 'Placa' : 'Nada encontrado para'} <span class="placa">${esc(dados.placaFormatada)}</span>${dados.placaValida ? ' não cadastrada.' : '.'}`;
      semResultado.innerHTML = `<div class="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2 mb-0">
        <div class="fs-5">${aviso}</div>
        ${podeCadastrar ? `<button type="button" class="btn btn-primary btn-lg" id="btn-rapido">
          <i class="bi bi-lightning-charge-fill me-1"></i>Cadastro rápido <kbd>Enter</kbd></button>` : ''}</div>`;
      semResultado.querySelector('#btn-rapido')?.addEventListener('click', () => abrirRapido(dados.placa));
    }
    ultimaBusca = dados;
  }

  async function buscar() {
    const q = busca.value.trim();
    const n = ++consulta;
    if (!q) { limparResultados(); return; }
    try {
      const dados = await getJSON(`/api/busca?q=${encodeURIComponent(q)}`);
      if (n === consulta) renderResultados(dados);
    } catch (e) {
      console.error(e);
    }
  }

  function limparResultados() {
    lista = [];
    ativo = -1;
    ultimaBusca = null;
    resultados.innerHTML = '';
    semResultado.classList.add('d-none');
    semResultado.innerHTML = '';
  }

  function limparTudo() {
    busca.value = '';
    limparResultados();
    painel.innerHTML = '';
    painelRapido.classList.add('d-none');
    busca.focus();
  }

  busca.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(buscar, 150);
  });

  busca.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown' && lista.length) { ativo = Math.min(lista.length - 1, ativo + 1); marcar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && lista.length) { ativo = Math.max(0, ativo - 1); marcar(); e.preventDefault(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      // Garante que o resultado corresponde ao que está digitado
      if (!ultimaBusca || placaDe(busca.value) !== ultimaBusca.placa) await buscar();
      if (lista.length) selecionar(lista[Math.max(0, ativo)].id);
      else if (semResultado.querySelector('#btn-rapido')) abrirRapido(ultimaBusca.placa);
    }
  });

  const placaDe = (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, '');

  resultados.addEventListener('click', (e) => {
    const b = e.target.closest('.resultado');
    if (b) selecionar(lista[Number(b.dataset.i)].id);
  });

  // Esc limpa tudo e volta para a busca; F2 leva para a busca
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') limparTudo();
    if (e.key === 'F2') {
      e.preventDefault();
      busca.focus();
      busca.select();
    }
  });

  // Relógio oficial (hora do servidor, fuso de Manaus)
  const relogioHora = document.getElementById('relogio-hora');
  const relogioData = document.getElementById('relogio-data');
  const fmtHoraRelogio = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const fmtDataRelogio = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  function atualizarRelogio() {
    const agora = agoraServidor();
    relogioHora.textContent = fmtHoraRelogio.format(agora);
    relogioData.textContent = fmtDataRelogio.format(agora);
  }
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);

  // ---------- Card do veículo ----------

  async function selecionar(id) {
    painelRapido.classList.add('d-none');
    try {
      const v = await getJSON(`/api/veiculos/${id}`);
      limparResultados();
      busca.value = v.placa;
      renderCard(v);
    } catch (e) {
      painel.innerHTML = '<div class="alert alert-danger">Não foi possível carregar o veículo.</div>';
    }
  }

  function renderCard(v) {
    const bloqueado = v.status === 'BLOQUEADO';
    const dentro = Boolean(v.movimentacao);
    const cor = bloqueado ? 'danger' : 'success';
    const prop = v.proprietario;
    const vinculo = prop
      ? [...new Set([prop.tipo === 'VISITANTE' ? 'Visitante' : 'Colaborador', prop.cargo, prop.setor, prop.empresa].filter(Boolean))].map(esc).join(' · ')
      : '';
    const propHtml = prop
      ? `<a href="/pessoas/${prop.id}" class="valor-info text-decoration-none">${esc(prop.nome)}</a>${
        prop.status === 'BLOQUEADO' ? ' <span class="chip chip-bloq ms-1"><i class="bi bi-lock-fill" aria-hidden="true"></i>Bloqueado</span>' : ''}
         <div class="text-body-secondary">${vinculo}</div>`
      : '<span class="text-body-secondary">Sem proprietário cadastrado</span>';
    const situacao = dentro
      ? '<span class="chip chip-info"><i class="bi bi-p-circle-fill" aria-hidden="true"></i>NO PÁTIO</span>'
      : '<span class="chip chip-neutro"><i class="bi bi-sign-turn-right" aria-hidden="true"></i>FORA DO PÁTIO</span>';
    const detalheDentro = dentro
      ? `<div class="col-sm-6"><div class="rotulo-info">No pátio desde</div>
           <div class="valor-info font-monospace">${esc(v.movimentacao.entrada)}</div>
           <div class="text-body-secondary">há ${esc(v.movimentacao.permanencia)} · motorista: <strong>${esc(v.movimentacao.motorista)}</strong></div></div>`
      : '';

    painel.innerHTML = `
      <section class="card card-veiculo border-${cor}" aria-label="Veículo ${esc(v.placa)}">
        <div class="status-faixa bg-${cor} text-white">
          <span><i class="bi ${bloqueado ? 'bi-x-octagon-fill' : 'bi-check-circle-fill'} me-2" aria-hidden="true"></i>${
            bloqueado ? 'BLOQUEADO' : 'LIBERADO PARA ACESSO'}</span>
          <span class="selo text-${cor}">${bloqueado ? 'ACESSO NEGADO' : (dentro ? 'DENTRO DO PÁTIO' : 'PERMISSÃO ATIVA')}</span>
        </div>
        <div class="card-body p-4">
          ${bloqueado ? `<div class="alert alert-danger alerta-bloqueio" role="alert">
            <div class="titulo"><i class="bi bi-exclamation-octagon-fill me-2" aria-hidden="true"></i>ENTRADA NÃO PERMITIDA</div>
            <div class="mt-1">Motivo: <strong>${esc(v.motivo_bloqueio)}</strong></div>
            <div class="fs-6 mt-2">Não libere a entrada. Oriente o condutor e siga o procedimento de segurança do CBA.
              O bloqueio só pode ser retirado na ficha do veículo.</div></div>` : ''}
          <div class="bloco-info d-flex flex-wrap align-items-center gap-4 mb-3">
            <span class="placa placa-destaque ${esc(v.placa_classe)}">${esc(v.placa)}</span>
            <div>
              <div class="mb-1">${situacao}</div>
              <div class="fs-4 fw-bold">${[v.marca_modelo, v.cor].filter(Boolean).map(esc).join(' · ') || esc(v.tipo)}</div>
              <div class="text-body-secondary">Tipo: <strong class="text-body">${esc(v.tipo)}</strong>
                · <a href="/veiculos/${v.id}">ver ficha</a></div>
            </div>
          </div>
          <div class="bloco-info row g-3 mx-0 mb-3">
            <div class="col-sm-6 ps-0"><div class="rotulo-info">Proprietário</div>${propHtml}</div>
            ${detalheDentro}
          </div>
          ${v.observacao ? `<div class="alert alert-info mb-3"><i class="bi bi-chat-left-text me-2" aria-hidden="true"></i>${esc(v.observacao)}</div>` : ''}
          <div class="acao"></div>
        </div>
      </section>`;

    const area = painel.querySelector('.acao');
    if (dentro) {
      area.appendChild(document.getElementById('tpl-saida').content.cloneNode(true));
      area.querySelector('[name="mov_id"]').value = v.movimentacao.id;
    } else if (!bloqueado) {
      area.appendChild(document.getElementById('tpl-entrada').content.cloneNode(true));
      area.querySelector('[name="veiculo_id"]').value = v.id;
      prepararEntrada(area, prop);
    }
    iniciar(area);
    area.querySelectorAll('input[data-agora]').forEach((c) => { c.value = v.agora || agoraInput(); });

    if (bloqueado && !dentro) {
      busca.focus();
      busca.select();
    } else {
      const motoristaVazio = !dentro && !area.querySelector('.picker-id').value;
      (motoristaVazio ? area.querySelector('.picker-busca') : area.querySelector('.btn-acao'))?.focus();
    }
  }

  // ---------- Motorista (entrada e cadastro rápido) ----------

  function avaliarMotorista(form, pessoa) {
    const alerta = form.querySelector('.alerta-motorista');
    const botao = form.querySelector('.btn-acao');
    const bloco = form.querySelector('.motorista-bloco');
    const bloqueado = bloco.dataset.modo === 'existente' && pessoa && pessoa.status === 'BLOQUEADO';
    alerta.innerHTML = bloqueado
      ? `<div class="alert alert-danger alerta-bloqueio mb-0" role="alert"><i class="bi bi-exclamation-octagon-fill me-2" aria-hidden="true"></i>
         <strong>${esc(pessoa.nome)} está BLOQUEADO(A).</strong> Motivo: ${esc(pessoa.motivo_bloqueio)}
         <div class="fs-6 mt-1">Entrada não permitida com este motorista. Escolha outro motorista.</div></div>`
      : '';
    botao.disabled = Boolean(bloqueado);
  }

  function ligarValidacaoMotorista(form) {
    let pessoaAtual = form._pessoaInicial || null;
    form.addEventListener('pessoa:selecionada', (e) => {
      pessoaAtual = e.detail;
      avaliarMotorista(form, pessoaAtual);
      if (!form.querySelector('.btn-acao').disabled) form.querySelector('.btn-acao').focus();
    });
    form.addEventListener('pessoa:limpa', () => { pessoaAtual = null; avaliarMotorista(form, null); });
    form.addEventListener('motorista:modo', () => avaliarMotorista(form, pessoaAtual));
    form.addEventListener('submit', (e) => {
      const bloco = form.querySelector('.motorista-bloco');
      const id = form.querySelector('.picker-id');
      if (bloco.dataset.modo === 'existente' && !id.value) {
        e.preventDefault();
        const campo = form.querySelector('.picker-busca');
        campo.classList.add('is-invalid');
        form.querySelector('.alerta-motorista').innerHTML =
          '<div class="alert alert-warning mb-0">Selecione o motorista na lista ou escolha "Novo visitante".</div>';
        campo.focus();
      }
    });
    avaliarMotorista(form, pessoaAtual);
  }

  function prepararEntrada(area, prop) {
    const form = area.querySelector('form');
    const picker = form.querySelector('.pessoa-picker');
    iniciar(form);
    if (prop && prop.status !== 'INATIVO') {
      picker.definirPessoa(prop);
      form._pessoaInicial = prop;
    }
    ligarValidacaoMotorista(form);
  }

  // ---------- Cadastro rápido ----------

  function abrirRapido(placa) {
    painel.innerHTML = '';
    limparResultados();
    formRapido.reset();
    formRapido.querySelector('.alerta-motorista').innerHTML = '';
    painelRapido.querySelector('.alert-danger')?.remove();
    formRapido.querySelector('[name="placa"]').value = placa || '';
    formRapido.querySelector('[name="entrada_em"]').value = agoraInput();
    delete formRapido.querySelector('[name="entrada_em"]').dataset.editado;
    formRapido.querySelector('.pessoa-picker').definirPessoa(null);
    formRapido.querySelector('.modo-radio:checked')?.dispatchEvent(new Event('change'));
    painelRapido.classList.remove('d-none');
    painelRapido.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formRapido.querySelector('[name="tipo"]').focus();
  }

  document.getElementById('cancelar-rapido').addEventListener('click', limparTudo);
  ligarValidacaoMotorista(formRapido);

  // ---------- Inicialização ----------

  if (!painelRapido.classList.contains('d-none')) {
    // Voltou do servidor com erro no cadastro rápido
    painelRapido.scrollIntoView({ block: 'start' });
  } else if (busca.dataset.veiculoInicial) {
    selecionar(busca.dataset.veiculoInicial);
  }
})();
