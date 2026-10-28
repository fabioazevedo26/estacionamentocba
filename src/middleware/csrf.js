// Proteção CSRF por token sincronizado guardado na sessão.
// Formulários enviam o campo "_csrf"; chamadas fetch enviam o cabeçalho "x-csrf-token".
const crypto = require('node:crypto');

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

function iguais(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function csrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (SEGUROS.has(req.method)) return next();

  const enviado = req.body?._csrf || req.get('x-csrf-token');
  if (iguais(enviado, req.session.csrfToken)) return next();

  res.status(403);
  return res.render('erro', {
    titulo: 'Formulário expirado',
    mensagem: 'O formulário expirou ou é inválido. Volte, recarregue a página e tente novamente.',
  });
}

module.exports = csrf;
