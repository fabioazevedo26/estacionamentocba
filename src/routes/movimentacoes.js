const express = require('express');
const movimentacoes = require('../services/movimentacoes');
const { paginar } = require('../utils/paginacao');
const { ErroNegocio } = require('../utils/erros');
const { acao, idParam } = require('./util');

const router = express.Router();

router.get('/', (req, res) => {
  const f = {
    q: req.query.q || '', de: req.query.de || '', ate: req.query.ate || '', situacao: req.query.situacao || '',
    veiculo_id: req.query.veiculo_id || '', motorista_id: req.query.motorista_id || '',
  };
  const pag = paginar(req.query, movimentacoes.contar(f));
  res.render('movimentacoes/lista', { titulo: 'Movimentações', f, pag, lista: movimentacoes.listar(f, pag) });
});

router.get('/:id/corrigir', acao((req, res) => {
  const mov = movimentacoes.obter(idParam(req));
  res.render('movimentacoes/corrigir', { titulo: 'Corrigir horário', mov, valores: null, erro: null });
}, '/movimentacoes'));

router.post('/:id/corrigir', (req, res) => {
  const id = idParam(req);
  try {
    movimentacoes.corrigirHorario(id, req.body, req.session.usuario.usuario);
    req.flash('sucesso', 'Horário corrigido. A alteração foi registrada na auditoria.');
    res.redirect('/movimentacoes');
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    res.status(422).render('movimentacoes/corrigir', {
      titulo: 'Corrigir horário', mov: movimentacoes.obter(id), valores: req.body, erro: e.message,
    });
  }
});

module.exports = router;
