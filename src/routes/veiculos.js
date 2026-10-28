const express = require('express');
const veiculos = require('../services/veiculos');
const pessoas = require('../services/pessoas');
const movimentacoes = require('../services/movimentacoes');
const placaUtil = require('../utils/placa');
const { paginar } = require('../utils/paginacao');
const { ErroNegocio } = require('../utils/erros');
const { acao, idParam } = require('./util');

const router = express.Router();

router.get('/', (req, res) => {
  const f = { q: req.query.q || '', tipo: req.query.tipo || '', status: req.query.status || '' };
  const pag = paginar(req.query, veiculos.contar(f));
  res.render('veiculos/lista', { titulo: 'Veículos', f, pag, lista: veiculos.listar(f, pag), tipos: veiculos.TIPOS });
});

function renderForm(res, veiculo, erro = null) {
  // Nome do proprietário para o campo de busca de pessoa
  if (veiculo.proprietario_id && !veiculo.proprietario_nome) {
    veiculo.proprietario_nome = pessoas.buscar(veiculo.proprietario_id)?.nome || '';
  }
  res.render('veiculos/form', {
    titulo: veiculo.id ? 'Editar veículo' : 'Novo veículo', veiculo, erro, tipos: veiculos.TIPOS,
  });
}

router.get('/novo', (req, res) => {
  renderForm(res, {
    tipo: 'CARRO',
    placa: placaUtil.normalizar(req.query.placa),
    proprietario_id: parseInt(req.query.proprietario_id, 10) || null,
  });
});

router.post('/', (req, res) => {
  try {
    const id = veiculos.criar(req.body, req.session.usuario.usuario);
    req.flash('sucesso', 'Veículo cadastrado com sucesso.');
    res.redirect(`/veiculos/${id}`);
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    res.status(422);
    renderForm(res, { ...req.body, placa_fora_padrao: req.body.placa_fora_padrao ? 1 : 0 }, e.message);
  }
});

router.get('/:id', acao((req, res) => {
  const veiculo = veiculos.obter(idParam(req));
  const filtro = { veiculo_id: veiculo.id };
  res.render('veiculos/ficha', {
    titulo: placaUtil.formatar(veiculo.placa),
    veiculo,
    aberta: movimentacoes.emAberto(veiculo.id),
    historico: movimentacoes.listar(filtro, { limite: 50, offset: 0 }),
    totalMov: movimentacoes.contar(filtro),
  });
}, '/veiculos'));

router.get('/:id/editar', acao((req, res) => {
  renderForm(res, veiculos.obter(idParam(req)));
}, '/veiculos'));

router.post('/:id', (req, res) => {
  const id = idParam(req);
  try {
    veiculos.editar(id, req.body, req.session.usuario.usuario);
    req.flash('sucesso', 'Veículo atualizado.');
    res.redirect(`/veiculos/${id}`);
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    res.status(422);
    renderForm(res, { ...req.body, id, placa_fora_padrao: req.body.placa_fora_padrao ? 1 : 0 }, e.message);
  }
});

router.post('/:id/proprietario', acao((req, res) => {
  const id = idParam(req);
  veiculos.definirProprietario(id, req.body.proprietario_id, req.session.usuario.usuario);
  req.flash('sucesso', req.body.proprietario_id ? 'Proprietário definido.' : 'Proprietário removido.');
  res.redirect(`/veiculos/${id}`);
}));

const MENSAGENS_STATUS = {
  bloquear: 'Veículo bloqueado. A entrada dele será impedida na portaria.',
  desbloquear: 'Veículo desbloqueado.',
  inativar: 'Veículo inativado. Ele não aparece mais nas buscas da portaria, mas continua nos relatórios.',
  reativar: 'Veículo reativado.',
};

router.post('/:id/status', acao((req, res) => {
  const id = idParam(req);
  veiculos.mudarStatus(id, req.body.operacao, req.body.motivo, req.session.usuario.usuario);
  req.flash('sucesso', MENSAGENS_STATUS[req.body.operacao]);
  res.redirect(`/veiculos/${id}`);
}));

router.post('/:id/excluir', acao((req, res) => {
  const v = veiculos.excluir(idParam(req), req.session.usuario.usuario);
  req.flash('sucesso', `Veículo ${placaUtil.formatar(v.placa)} excluído.`);
  res.redirect('/veiculos');
}));

module.exports = router;
