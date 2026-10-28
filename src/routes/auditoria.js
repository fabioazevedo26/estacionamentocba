const express = require('express');
const auditoria = require('../services/auditoria');
const { paginar } = require('../utils/paginacao');

const router = express.Router();

router.get('/', (req, res) => {
  const f = { de: req.query.de || '', ate: req.query.ate || '', acao: req.query.acao || '' };
  const pag = paginar(req.query, auditoria.contar(f), 50);
  const lista = auditoria.listar(f, pag).map((a) => {
    let detalhes = null;
    try { detalhes = JSON.parse(a.detalhes); } catch { /* texto livre */ }
    return { ...a, detalhes };
  });
  res.render('auditoria/lista', { titulo: 'Auditoria', f, pag, lista, acoes: auditoria.ACOES });
});

module.exports = router;
