const { ErroNegocio } = require('../utils/erros');

// Executa a ação; um ErroNegocio vira mensagem de erro e redireciona de volta
function acao(fn, voltar) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (!(e instanceof ErroNegocio)) throw e;
      req.flash('erro', e.message);
      const destino = typeof voltar === 'function' ? voltar(req) : voltar;
      res.redirect(destino || req.get('referer') || '/');
    }
  };
}

const idParam = (req) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) throw new ErroNegocio('Identificador inválido.');
  return id;
};

module.exports = { acao, idParam };
