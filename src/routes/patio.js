const express = require('express');
const movimentacoes = require('../services/movimentacoes');
const placaUtil = require('../utils/placa');
const datas = require('../utils/datas');
const { acao, idParam } = require('./util');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('patio', { titulo: 'Estacionamento', lista: movimentacoes.patio() });
});

router.post('/:id/saida', acao((req, res) => {
  const m = movimentacoes.registrarSaida(idParam(req), req.body.saida_em, req.session.usuario.usuario);
  req.flash('sucesso', `Saída registrada: ${placaUtil.formatar(m.placa)} às ${datas.fmtHora(m.saida_em)}.`);
  res.redirect('/patio');
}, '/patio'));

module.exports = router;
