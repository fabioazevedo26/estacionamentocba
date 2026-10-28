const db = require('../db');
const { agora } = require('../utils/datas');

const ACOES = ['CRIAR', 'EDITAR', 'BLOQUEAR', 'DESBLOQUEAR', 'INATIVAR', 'EXCLUIR',
  'REGISTRAR_ENTRADA', 'REGISTRAR_SAIDA', 'CORRIGIR_HORARIO', 'LOGIN'];

let inserir;

// detalhes: { antes, depois, ... } — gravado como JSON
function registrar({ usuario, acao, entidade = null, entidadeId = null, antes = null, depois = null, extra }) {
  const detalhes = { antes, depois, ...extra };
  inserir ??= db.prepare(`INSERT INTO auditoria (data_hora, usuario, acao, entidade, entidade_id, detalhes)
                          VALUES (?, ?, ?, ?, ?, ?)`);
  inserir.run(agora(), usuario || null, acao, entidade, entidadeId, JSON.stringify(detalhes));
}

function filtrosSql(f) {
  const where = [];
  const params = [];
  if (f.de) { where.push('data_hora >= ?'); params.push(`${f.de} 00:00:00`); }
  if (f.ate) { where.push('data_hora <= ?'); params.push(`${f.ate} 23:59:59`); }
  if (f.acao && ACOES.includes(f.acao)) { where.push('acao = ?'); params.push(f.acao); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function contar(f) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`SELECT COUNT(*) FROM auditoria ${sql}`).pluck().get(...params);
}

function listar(f, { limite, offset }) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`SELECT * FROM auditoria ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limite, offset);
}

module.exports = { ACOES, registrar, contar, listar };
