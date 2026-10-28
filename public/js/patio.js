/* Estacionamento: filtro por texto e por situação, sem recarregar a página */
(function () {
  'use strict';
  const campo = document.getElementById('filtro-patio');
  if (!campo) return;
  const linhas = [...document.querySelectorAll('tbody tr[data-alerta]')];
  const vazio = document.getElementById('patio-vazio');
  const botoes = [...document.querySelectorAll('[data-filtro]')];
  let situacao = 'todos';

  function aplicar() {
    const termo = campo.value.trim().toLowerCase();
    const termoPlaca = termo.replace(/[^a-z0-9]/g, '');
    let visiveis = 0;
    for (const l of linhas) {
      const texto = l.dataset.busca;
      const okTexto = !termo || texto.includes(termo) || (termoPlaca && texto.includes(termoPlaca));
      const okSituacao = situacao === 'todos' || l.dataset.alerta === situacao;
      l.classList.toggle('d-none', !(okTexto && okSituacao));
      if (okTexto && okSituacao) visiveis++;
    }
    vazio.classList.toggle('d-none', visiveis > 0);
  }

  campo.addEventListener('input', aplicar);
  botoes.forEach((b) => b.addEventListener('click', () => {
    situacao = b.dataset.filtro;
    botoes.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    aplicar();
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); campo.focus(); }
  });
})();
