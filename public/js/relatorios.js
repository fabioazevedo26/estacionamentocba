/* Relatórios: mostra só os campos de data do período escolhido */
(function () {
  'use strict';
  const periodo = document.getElementById('periodo');
  const aplicar = () => {
    document.querySelectorAll('.campo-periodo').forEach((c) => {
      const visivel = c.dataset.periodo === periodo.value;
      c.classList.toggle('d-none', !visivel);
      c.querySelectorAll('input').forEach((i) => { i.disabled = !visivel; });
    });
  };
  periodo.addEventListener('change', aplicar);
  aplicar();
})();
