// Mensagens de uma única exibição (sucesso, erro, aviso, info) guardadas na sessão
function flash(req, res, next) {
  req.flash = (tipo, mensagem) => {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ tipo, mensagem });
  };
  res.locals.flash = req.session.flash || [];
  delete req.session.flash;
  next();
}

module.exports = flash;
