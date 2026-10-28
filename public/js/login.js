/* Login: botão para mostrar/ocultar a senha */
(function () {
  'use strict';
  const botao = document.getElementById('mostrar-senha');
  const campo = document.getElementById('senha');
  botao.addEventListener('click', () => {
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    botao.setAttribute('aria-pressed', String(mostrar));
    botao.title = mostrar ? 'Ocultar senha' : 'Mostrar senha';
    botao.querySelector('i').className = `bi ${mostrar ? 'bi-eye-slash' : 'bi-eye'} fs-5`;
    botao.querySelector('.visually-hidden').textContent = botao.title;
    campo.focus();
  });
})();
