const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const usuarios = require('../services/usuarios');
const auditoria = require('../services/auditoria');
const { exigirLogin } = require('../middleware/auth');
const { ErroNegocio } = require('../utils/erros');

const router = express.Router();

// Até 10 tentativas com falha a cada 15 minutos por endereço IP
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('login', {
      titulo: 'Entrar',
      erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.',
      usuarioDigitado: req.body?.usuario || '',
    });
  },
});

router.get('/login', (req, res) => {
  if (req.session.usuario) return res.redirect('/');
  res.render('login', { titulo: 'Entrar', erro: null, usuarioDigitado: '' });
});

router.post('/login', limiteLogin, async (req, res, next) => {
  const u = await usuarios.autenticar(req.body.usuario, req.body.senha);
  if (!u) {
    res.status(401);
    return res.render('login', {
      titulo: 'Entrar', erro: 'Usuário ou senha incorretos.', usuarioDigitado: req.body.usuario || '',
    });
  }
  const voltarPara = req.session.voltarPara || '/';
  // Nova sessão a cada login (evita fixação de sessão)
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.usuario = u;
    auditoria.registrar({
      usuario: u.usuario, acao: 'LOGIN', entidade: 'USUARIO', entidadeId: u.id, extra: { ip: req.ip },
    });
    res.redirect(voltarPara.startsWith('/') && !voltarPara.startsWith('//') ? voltarPara : '/');
  });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('estacionamento.sid');
    res.redirect('/login');
  });
});

// Troca de senha pela interface só quando PERMITIR_TROCA_SENHA=true
function trocaSenhaPermitida(req, res, next) {
  if (config.permitirTrocaSenha) return next();
  req.flash('aviso', 'A troca de senha pela interface está desativada. Procure o administrador do sistema.');
  return res.redirect('/');
}

router.get('/conta/senha', exigirLogin, trocaSenhaPermitida, (req, res) => {
  res.render('senha', { titulo: 'Trocar senha' });
});

router.post('/conta/senha', exigirLogin, trocaSenhaPermitida, async (req, res) => {
  try {
    await usuarios.trocarSenha(req.session.usuario.id, req.body.atual, req.body.nova, req.body.confirmacao);
    auditoria.registrar({
      usuario: req.session.usuario.usuario, acao: 'EDITAR', entidade: 'USUARIO',
      entidadeId: req.session.usuario.id, extra: { campo: 'senha' },
    });
    req.flash('sucesso', 'Senha alterada com sucesso.');
    res.redirect('/');
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    req.flash('erro', e.message);
    res.redirect('/conta/senha');
  }
});

module.exports = router;
