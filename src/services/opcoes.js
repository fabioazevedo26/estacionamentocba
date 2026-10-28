const db = require('../db');

const OUTRO = '__outro__';

function listar(categoria) {
  return db.prepare('SELECT valor FROM opcoes WHERE categoria = ? ORDER BY valor COLLATE NOCASE')
    .pluck().all(categoria);
}

// Resolve o valor de um select com "Outro (digitar)". O valor digitado é
// salvo em opcoes para aparecer nas próximas vezes.
function resolver(categoria, selecionado, digitado) {
  let valor = selecionado === OUTRO ? digitado : selecionado;
  valor = String(valor || '').trim().replace(/\s+/g, ' ');
  if (!valor) return null;
  const existente = db.prepare('SELECT valor FROM opcoes WHERE categoria = ? AND valor = ? COLLATE NOCASE')
    .pluck().get(categoria, valor);
  if (existente) return existente;
  db.prepare('INSERT INTO opcoes (categoria, valor) VALUES (?, ?)').run(categoria, valor);
  return valor;
}

module.exports = { OUTRO, listar, resolver };
