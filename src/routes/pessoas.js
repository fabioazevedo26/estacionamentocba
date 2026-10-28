const express = require('express');
const pessoas = require('../services/pessoas');
const veiculos = require('../services/veiculos');
const movimentacoes = require('../services/movimentacoes');
const opcoes = require('../services/opcoes');
const placaUtil = require('../utils/placa');
const { paginar } = require('../utils/paginacao');
const { ErroNegocio } = require('../utils/erros');
const { acao, idParam } = require('./util');

const router = express.Router();

const listasOpcoes = () => ({ cargos: opcoes.listar('CARGO'), setores: opcoes.listar('SETOR') });

router.get('/', (req, res) => {
  const f = {
    q: req.query.q || '', tipo: req.query.tipo || '', status: req.query.status || '',
    cargo: req.query.cargo || '', setor: req.query.setor || '',
  };
  const pag = paginar(req.query, pessoas.contar(f));
  res.render('pessoas/lista', { titulo: 'Pessoas', f, pag, lista: pessoas.listar(f, pag), ...listasOpcoes() });
});

function renderForm(res, pessoa, erro = null) {
  res.render('pessoas/form', {
    titulo: pessoa.id ? 'Editar pessoa' : 'Nova pessoa', pessoa, erro, ...listasOpcoes(),
  });
}

router.get('/nova', (req, res) => {
  renderForm(res, { tipo: req.query.tipo === 'VISITANTE' ? 'VISITANTE' : 'COLABORADOR' });
});

router.post('/', (req, res) => {
  try {
    const id = pessoas.criar(req.body, req.session.usuario.usuario);
    req.flash('sucesso', 'Pessoa cadastrada com sucesso.');
    res.redirect(`/pessoas/${id}`);
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    res.status(422);
    renderForm(res, { ...req.body }, e.message);
  }
});

router.get('/:id', acao((req, res) => {
  const pessoa = pessoas.obter(idParam(req));
  const filtro = { motorista_id: pessoa.id };
  const pag = { limite: 50, offset: 0 };
  res.render('pessoas/ficha', {
    titulo: pessoa.nome,
    pessoa,
    veiculos: veiculos.doProprietario(pessoa.id),
    historico: movimentacoes.listar(filtro, pag),
    totalMov: movimentacoes.contar(filtro),
  });
}, '/pessoas'));

router.get('/:id/editar', acao((req, res) => {
  renderForm(res, pessoas.obter(idParam(req)));
}, '/pessoas'));

router.post('/:id', (req, res) => {
  const id = idParam(req);
  try {
    pessoas.editar(id, req.body, req.session.usuario.usuario);
    req.flash('sucesso', 'Cadastro atualizado.');
    res.redirect(`/pessoas/${id}`);
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    res.status(422);
    renderForm(res, { ...req.body, id }, e.message);
  }
});

const MENSAGENS_STATUS = {
  bloquear: 'Pessoa bloqueada. A entrada dela será impedida na portaria.',
  desbloquear: 'Pessoa desbloqueada.',
  inativar: 'Pessoa inativada. Ela não aparece mais nas buscas da portaria, mas continua nos relatórios.',
  reativar: 'Pessoa reativada.',
};

router.post('/:id/status', acao((req, res) => {
  const id = idParam(req);
  pessoas.mudarStatus(id, req.body.operacao, req.body.motivo, req.session.usuario.usuario);
  req.flash('sucesso', MENSAGENS_STATUS[req.body.operacao]);
  res.redirect(`/pessoas/${id}`);
}));

router.post('/:id/excluir', acao((req, res) => {
  const p = pessoas.excluir(idParam(req), req.session.usuario.usuario);
  req.flash('sucesso', `"${p.nome}" foi excluída.`);
  res.redirect('/pessoas');
}));

// Vincula um veículo já cadastrado (pela placa) a esta pessoa
router.post('/:id/vincular-veiculo', acao((req, res) => {
  const id = idParam(req);
  const pessoa = pessoas.obter(id);
  const v = veiculos.buscarPorPlaca(req.body.placa);
  if (!v) {
    throw new ErroNegocio(`Nenhum veículo cadastrado com a placa ${placaUtil.normalizar(req.body.placa) || '(vazia)'}. `
      + 'Use "Adicionar novo veículo".');
  }
  if (v.proprietario_id === id) throw new ErroNegocio('Este veículo já pertence a esta pessoa.');
  veiculos.definirProprietario(v.id, id, req.session.usuario.usuario);
  req.flash('sucesso', `Veículo ${placaUtil.formatar(v.placa)} vinculado a ${pessoa.nome}`
    + `${v.proprietario_nome ? ` (antes pertencia a ${v.proprietario_nome})` : ''}.`);
  res.redirect(`/pessoas/${id}`);
}));

module.exports = router;
