/* Comportamentos comuns a todas as telas */
(function () {
  'use strict';

  const body = document.body;
  // Diferença entre o relógio do servidor e o do navegador
  const deslocamento = Number(body.dataset.servidorMs || Date.now()) - Date.now();
  const fuso = body.dataset.tz || undefined;

  function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Data/hora atual do servidor no formato do <input type="datetime-local">
  function agoraInput() {
    const partes = new Intl.DateTimeFormat('sv-SE', {
      timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(Date.now() + deslocamento));
    return partes.replace(' ', 'T');
  }

  // Campos [data-agora] vazios recebem a hora atual; se o usuário não mexer,
  // a hora é atualizada de novo no momento do envio.
  function iniciarCamposAgora(raiz) {
    raiz.querySelectorAll('input[data-agora]').forEach((campo) => {
      if (campo.dataset.agoraIniciado) return;
      campo.dataset.agoraIniciado = '1';
      if (!campo.value) campo.value = agoraInput();
      else campo.dataset.editado = '1';
      campo.addEventListener('input', () => { campo.dataset.editado = '1'; });
    });
  }

  async function getJSON(url) {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (r.status === 401) {
      window.location.href = '/login';
      throw new Error('sessão expirada');
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ---------- Busca de pessoa (autocomplete) ----------
  const ROTULO_TIPO = { COLABORADOR: 'Colaborador', VISITANTE: 'Visitante' };

  function iniciarPicker(el) {
    if (el.dataset.iniciado) return;
    el.dataset.iniciado = '1';
    const busca = el.querySelector('.picker-busca');
    const oculto = el.querySelector('.picker-id');
    const lista = el.querySelector('.picker-resultados');
    const limpar = el.querySelector('.picker-limpar');
    let itens = [];
    let ativo = -1;
    let timer;

    const fechar = () => { lista.innerHTML = ''; itens = []; ativo = -1; };

    function marcar() {
      lista.querySelectorAll('.list-group-item').forEach((b, i) => b.classList.toggle('active', i === ativo));
    }

    function render() {
      if (!itens.length) {
        lista.innerHTML = '<div class="list-group-item text-body-secondary">Nenhuma pessoa encontrada.</div>';
        return;
      }
      lista.innerHTML = itens.map((p, i) => {
        const info = [ROTULO_TIPO[p.tipo], p.cargo, p.setor, p.empresa].filter(Boolean).map(esc).join(' · ');
        const status = p.status === 'BLOQUEADO' ? '<span class="badge text-bg-danger ms-2">BLOQUEADO</span>' : '';
        return `<button type="button" class="list-group-item list-group-item-action" data-i="${i}">
          <div class="fw-semibold">${esc(p.nome)}${status}</div><small class="text-body-secondary">${info}</small></button>`;
      }).join('');
      ativo = 0;
      marcar();
    }

    async function buscar() {
      const q = busca.value.trim();
      if (q.length < 2) { fechar(); return; }
      try {
        itens = await getJSON(`/api/pessoas?q=${encodeURIComponent(q)}`);
        if (busca.value.trim() === q) render();
      } catch { fechar(); }
    }

    function selecionar(p) {
      oculto.value = p.id;
      busca.value = p.nome;
      fechar();
      el.dispatchEvent(new CustomEvent('pessoa:selecionada', { bubbles: true, detail: p }));
    }

    function zerar() {
      oculto.value = '';
      el.dispatchEvent(new CustomEvent('pessoa:limpa', { bubbles: true }));
    }

    busca.addEventListener('input', () => {
      if (oculto.value) zerar();
      clearTimeout(timer);
      timer = setTimeout(buscar, 200);
    });
    busca.addEventListener('keydown', (e) => {
      const aberto = itens.length > 0;
      if (e.key === 'ArrowDown' && aberto) { ativo = Math.min(itens.length - 1, ativo + 1); marcar(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && aberto) { ativo = Math.max(0, ativo - 1); marcar(); e.preventDefault(); }
      else if (e.key === 'Enter' && aberto) { selecionar(itens[ativo] || itens[0]); e.preventDefault(); }
      else if (e.key === 'Enter' && !oculto.value && busca.value.trim()) { e.preventDefault(); buscar(); }
      else if (e.key === 'Escape' && aberto) { fechar(); e.preventDefault(); e.stopPropagation(); }
    });
    busca.addEventListener('blur', () => setTimeout(fechar, 200));
    lista.addEventListener('mousedown', (e) => e.preventDefault());
    lista.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) selecionar(itens[Number(b.dataset.i)]);
    });
    limpar.addEventListener('click', () => { busca.value = ''; zerar(); fechar(); busca.focus(); });

    // Permite que outros scripts definam a pessoa
    el.definirPessoa = (p) => {
      oculto.value = p ? p.id : '';
      busca.value = p ? p.nome : '';
    };

    // Campo obrigatório: impede envio sem pessoa escolhida
    if (oculto.hasAttribute('data-obrigatorio')) {
      el.closest('form')?.addEventListener('submit', (e) => {
        if (!oculto.value) {
          e.preventDefault();
          e.stopImmediatePropagation();
          busca.classList.add('is-invalid');
          busca.focus();
        }
      });
      busca.addEventListener('input', () => busca.classList.remove('is-invalid'));
    }
  }

  // ---------- Motorista: pessoa cadastrada x novo visitante ----------
  function iniciarBlocoMotorista(bloco) {
    if (bloco.dataset.iniciado) return;
    bloco.dataset.iniciado = '1';
    const aplicar = () => {
      const modo = bloco.querySelector('.modo-radio:checked')?.value || 'existente';
      bloco.dataset.modo = modo;
      bloco.querySelector('.modo-existente')?.classList.toggle('d-none', modo !== 'existente');
      bloco.querySelector('.modo-novo')?.classList.toggle('d-none', modo !== 'novo');
      bloco.querySelectorAll('.modo-novo [data-requerido]').forEach((i) => { i.required = modo === 'novo'; });
      bloco.dispatchEvent(new CustomEvent('motorista:modo', { bubbles: true, detail: modo }));
    };
    bloco.querySelectorAll('.modo-radio').forEach((r) => r.addEventListener('change', () => {
      aplicar();
      const alvo = bloco.dataset.modo === 'novo'
        ? bloco.querySelector('.modo-novo input')
        : bloco.querySelector('.picker-busca');
      alvo?.focus();
    }));
    aplicar();
  }

  // ---------- Select com "Outro (digitar)" ----------
  function iniciarSelectOutro(sel) {
    const campo = document.getElementById(sel.dataset.outro);
    if (!campo) return;
    const aplicar = () => {
      const outro = sel.value === '__outro__';
      campo.classList.toggle('d-none', !outro);
      campo.required = outro;
      if (outro && document.activeElement === sel) campo.focus();
    };
    sel.addEventListener('change', aplicar);
    aplicar();
  }

  function iniciar(raiz) {
    raiz.querySelectorAll('.pessoa-picker').forEach(iniciarPicker);
    raiz.querySelectorAll('.motorista-bloco').forEach(iniciarBlocoMotorista);
    raiz.querySelectorAll('select[data-outro]').forEach(iniciarSelectOutro);
    iniciarCamposAgora(raiz);
  }

  // ---------- Eventos globais ----------

  // Confirmação antes de enviar, e proteção contra clique duplo
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
      e.preventDefault();
      return;
    }
    form.querySelectorAll('input[data-agora]').forEach((c) => {
      if (!c.dataset.editado) c.value = agoraInput();
    });
    if (form.method.toLowerCase() === 'post') {
      setTimeout(() => form.querySelectorAll('button[type="submit"], button:not([type])').forEach((b) => {
        if (!e.defaultPrevented) b.disabled = true;
      }), 0);
    }
  });

  // "Usar agora": volta o campo de data/hora para o horário atual
  document.addEventListener('click', (e) => {
    const botao = e.target.closest('.usar-agora');
    if (!botao) return;
    const campo = botao.closest('.col-sm-5, .col-sm-6, form')?.querySelector('input[data-agora]');
    if (!campo) return;
    campo.value = agoraInput();
    delete campo.dataset.editado;
    campo.focus();
  });

  // Placa sempre em maiúsculas enquanto digita
  document.addEventListener('input', (e) => {
    if (e.target.classList?.contains('input-placa')) {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.toUpperCase();
      e.target.setSelectionRange(pos, pos);
    }
  });

  // Atualização automática (ex.: Pátio agora), sem atrapalhar quem está digitando
  const intervalo = Number(body.dataset.autoRefresh || 0);
  if (intervalo > 0) {
    setInterval(() => {
      const foco = document.activeElement;
      const ocupado = foco && foco !== body && ['INPUT', 'SELECT', 'TEXTAREA'].includes(foco.tagName);
      if (!ocupado && !document.querySelector('.dropdown-menu.show')) window.location.reload();
    }, intervalo * 1000);
  }

  // Modo noturno (preferência guardada neste computador)
  function rotularTema() {
    const escuro = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    document.querySelectorAll('[data-alternar-tema]').forEach((b) => {
      b.setAttribute('aria-pressed', String(escuro));
      const rotulo = b.querySelector('.rotulo-tema');
      if (rotulo) rotulo.textContent = escuro ? 'Modo claro' : 'Modo noturno';
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-alternar-tema]')) return;
    const novo = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', novo);
    try { localStorage.setItem('cba-tema', novo); } catch { /* sem armazenamento */ }
    rotularTema();
  });
  rotularTema();

  // Mensagens de sucesso somem sozinhas
  document.querySelectorAll('.flash-msg.alert-success').forEach((a) => {
    setTimeout(() => window.bootstrap?.Alert.getOrCreateInstance(a).close(), 8000);
  });

  iniciar(document);

  // Data/hora atual do servidor (para relógios na tela)
  const agoraServidor = () => new Date(Date.now() + deslocamento);

  window.CBA = { esc, agoraInput, agoraServidor, fuso, getJSON, iniciar };
})();
