const express = require('express');
const pedestres = require('../services/pedestres');
const excel = require('../services/excel');
const datas = require('../utils/datas');
const { paginar } = require('../utils/paginacao');
const { ErroNegocio } = require('../utils/erros');
const { acao, idParam } = require('./util');

const router = express.Router();

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function renderTela(req, res, extra = {}) {
  res.render('pedestres/index', {
    titulo: 'Pedestres',
    lista: pedestres.dentro(),
    ultimas: pedestres.ultimasDoDia(10),
    form: null,
    erroForm: null,
    ...extra,
  });
}

router.get('/', (req, res) => renderTela(req, res));

router.post('/entrada', (req, res) => {
  try {
    const r = pedestres.registrarEntrada(req.body, req.session.usuario.usuario);
    req.flash('sucesso', `Entrada a pé registrada: ${r.pessoa.nome} às ${datas.fmtHora(r.entrada)}.`);
    res.redirect('/pedestres');
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    // Mostra o formulário de novo com o que foi digitado
    res.status(422);
    renderTela(req, res, { form: req.body, erroForm: e.message });
  }
});

router.post('/:id/saida', acao((req, res) => {
  const a = pedestres.registrarSaida(idParam(req), req.body.saida_em, req.session.usuario.usuario);
  req.flash('sucesso', `Saída a pé registrada: ${a.pessoa_nome} às ${datas.fmtHora(a.saida_em)}.`);
  res.redirect('/pedestres');
}, '/pedestres'));

function lerFiltros(query) {
  return {
    q: query.q || '',
    de: ISO.test(query.de || '') ? query.de : '',
    ate: ISO.test(query.ate || '') ? query.ate : '',
    situacao: query.situacao || '',
    tipo: query.tipo || '',
    pessoa_id: query.pessoa_id || '',
  };
}

router.get('/historico', (req, res) => {
  const f = lerFiltros(req.query);
  const pag = paginar(req.query, pedestres.contar(f));
  res.render('pedestres/historico', {
    titulo: 'Histórico de pedestres',
    f,
    pag,
    lista: pedestres.listar(f, pag),
    exportarUrl: `/pedestres/historico/exportar?${new URLSearchParams(f)}`,
  });
});

router.get('/historico/exportar', async (req, res) => {
  const f = lerFiltros(req.query);
  // Sem período informado, exporta o dia de hoje
  if (!f.de && !f.ate) f.de = f.ate = datas.hoje();
  const de = f.de || f.ate;
  const ate = f.ate || f.de;
  const buffer = await excel.gerarRelatorioPedestres({ de, ate, linhas: pedestres.listar({ ...f, de, ate }) });
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="pedestres_${de}_a_${ate}.xlsx"`,
  });
  res.send(Buffer.from(buffer));
});

router.get('/:id/corrigir', acao((req, res) => {
  const reg = pedestres.obter(idParam(req));
  res.render('pedestres/corrigir', { titulo: 'Corrigir horário', reg, valores: null, erro: null });
}, '/pedestres/historico'));

router.post('/:id/corrigir', (req, res) => {
  const id = idParam(req);
  try {
    pedestres.corrigirHorario(id, req.body, req.session.usuario.usuario);
    req.flash('sucesso', 'Horário corrigido. A alteração foi registrada na auditoria.');
    res.redirect('/pedestres/historico');
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    res.status(422).render('pedestres/corrigir', {
      titulo: 'Corrigir horário', reg: pedestres.obter(id), valores: req.body, erro: e.message,
    });
  }
});

module.exports = router;
