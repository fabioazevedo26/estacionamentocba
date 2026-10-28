const express = require('express');
const movimentacoes = require('../services/movimentacoes');
const veiculos = require('../services/veiculos');
const placaUtil = require('../utils/placa');
const datas = require('../utils/datas');
const { ErroNegocio } = require('../utils/erros');
const { acao } = require('./util');

const router = express.Router();

function renderPortaria(req, res, extra = {}) {
  res.render('portaria', {
    titulo: 'Portaria',
    ultimas: movimentacoes.ultimasDoDia(10),
    tiposVeiculo: veiculos.TIPOS,
    veiculoInicial: parseInt(req.query.veiculo, 10) || null,
    rapido: null,
    erroRapido: null,
    ...extra,
  });
}

router.get('/', (req, res) => renderPortaria(req, res));

router.post('/portaria/entrada', acao((req, res) => {
  const r = movimentacoes.entradaPortaria(req.body, req.session.usuario.usuario);
  req.flash('sucesso', `Entrada registrada: ${placaUtil.formatar(r.veiculo.placa)} — ${r.motorista.nome} `
    + `às ${datas.fmtHora(r.entrada)}.`);
  res.redirect('/');
}, (req) => `/?veiculo=${parseInt(req.body.veiculo_id, 10) || ''}`));

router.post('/portaria/saida', acao((req, res) => {
  const m = movimentacoes.registrarSaida(parseInt(req.body.mov_id, 10), req.body.saida_em, req.session.usuario.usuario);
  req.flash('sucesso', `Saída registrada: ${placaUtil.formatar(m.placa)} — ${m.motorista_nome} `
    + `às ${datas.fmtHora(m.saida_em)}.`);
  res.redirect('/');
}, '/'));

router.post('/portaria/cadastro-rapido', (req, res) => {
  try {
    const r = movimentacoes.cadastroRapido(req.body, req.session.usuario.usuario);
    req.flash('sucesso', `Veículo ${placaUtil.formatar(r.veiculo.placa)} cadastrado e entrada registrada `
      + `(${r.motorista.nome}, ${datas.fmtHora(r.entrada)}).`);
    res.redirect('/');
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    // Mostra o formulário de novo com o que foi digitado
    res.status(422);
    renderPortaria(req, res, { rapido: req.body, erroRapido: e.message });
  }
});

module.exports = router;
