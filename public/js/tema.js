/* Aplica o tema (claro ou noturno) antes de a página aparecer, sem piscar */
(function () {
  'use strict';
  let tema = 'light';
  try { tema = localStorage.getItem('cba-tema') === 'dark' ? 'dark' : 'light'; } catch { /* sem armazenamento */ }
  document.documentElement.setAttribute('data-bs-theme', tema);
})();
