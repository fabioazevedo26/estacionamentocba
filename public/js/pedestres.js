/* Pedestres: alerta e bloqueio do botão quando a pessoa escolhida está bloqueada */
(function () {
  'use strict';
  const { esc } = window.CBA;
  const form = document.getElementById('form-pedestre');
  if (!form) return;
  const alerta = form.querySelector('.alerta-motorista');
  const botao = form.querySelector('.btn-acao');
  const bloco = form.querySelector('.motorista-bloco');
  let pessoa = null;

  function avaliar() {
    const bloqueada = bloco.dataset.modo === 'existente' && pessoa && pessoa.status === 'BLOQUEADO';
    alerta.innerHTML = bloqueada
      ? `<div class="alert alert-danger alerta-bloqueio mb-0" role="alert"><i class="bi bi-exclamation-octagon-fill me-2" aria-hidden="true"></i>
         <strong>${esc(pessoa.nome)} está BLOQUEADO(A).</strong> Motivo: ${esc(pessoa.motivo_bloqueio)}
         <div class="fs-6 mt-1">Entrada não permitida.</div></div>`
      : '';
    botao.disabled = Boolean(bloqueada);
  }

  form.addEventListener('pessoa:selecionada', (e) => {
    pessoa = e.detail;
    avaliar();
    if (!botao.disabled) botao.focus();
  });
  form.addEventListener('pessoa:limpa', () => { pessoa = null; avaliar(); });
  form.addEventListener('motorista:modo', avaliar);
  form.addEventListener('submit', (e) => {
    if (bloco.dataset.modo === 'existente' && !form.querySelector('.picker-id').value) {
      e.preventDefault();
      const campo = form.querySelector('.picker-busca');
      campo.classList.add('is-invalid');
      alerta.innerHTML = '<div class="alert alert-warning mb-0">Selecione a pessoa na lista ou escolha "Novo visitante".</div>';
      campo.focus();
    }
  });

  // Foco inicial no nome da pessoa (ou do visitante)
  const inicial = bloco.dataset.modo === 'novo' ? form.querySelector('[name="visitante_nome"]') : form.querySelector('.picker-busca');
  if (!form.closest('.card').querySelector('.alert-danger')) inicial?.focus();
})();
