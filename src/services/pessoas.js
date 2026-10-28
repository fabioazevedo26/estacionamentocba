const db = require('../db');
const auditoria = require('./auditoria');
const opcoes = require('./opcoes');
const { alterarStatus } = require('./status');
const { agora } = require('../utils/datas');
const { ErroNegocio } = require('../utils/erros');

const TIPOS = ['COLABORADOR', 'VISITANTE'];
const STATUS = ['ATIVO', 'BLOQUEADO', 'INATIVO'];
const CAMPOS = ['nome', 'tipo', 'cargo', 'setor', 'empresa', 'telefone', 'observacao'];

const texto = (v, max = 200) => {
  const t = String(v ?? '').trim().replace(/\s+/g, ' ');
  return t ? t.slice(0, max) : null;
};

// Valida e normaliza os dados vindos de um formulário
function normalizar(body) {
  const dados = {
    nome: texto(body.nome, 120),
    tipo: body.tipo,
    cargo: opcoes.resolver('CARGO', body.cargo, body.cargo_outro),
    setor: opcoes.resolver('SETOR', body.setor, body.setor_outro),
    empresa: texto(body.empresa, 120),
    telefone: texto(body.telefone, 30),
    observacao: texto(body.observacao, 500),
  };
  if (!dados.nome) throw new ErroNegocio('Informe o nome.');
  if (!TIPOS.includes(dados.tipo)) throw new ErroNegocio('Selecione o tipo (colaborador ou visitante).');
  return dados;
}

function buscar(id) {
  return db.prepare('SELECT * FROM pessoas WHERE id = ?').get(id);
}

function obter(id) {
  const p = buscar(id);
  if (!p) throw new ErroNegocio('Pessoa não encontrada.');
  return p;
}

function filtrosSql(f) {
  const where = [];
  const params = [];
  if (f.q) {
    where.push('(sem_acento(nome) LIKE ? OR sem_acento(empresa) LIKE ?)');
    const q = `%${db.semAcento(f.q.trim())}%`;
    params.push(q, q);
  }
  if (TIPOS.includes(f.tipo)) { where.push('tipo = ?'); params.push(f.tipo); }
  if (STATUS.includes(f.status)) { where.push('status = ?'); params.push(f.status); }
  if (f.cargo) { where.push('cargo = ?'); params.push(f.cargo); }
  if (f.setor) { where.push('setor = ?'); params.push(f.setor); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function contar(f) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`SELECT COUNT(*) FROM pessoas ${sql}`).pluck().get(...params);
}

function listar(f, { limite, offset }) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM veiculos v WHERE v.proprietario_id = p.id) AS qtd_veiculos
    FROM pessoas p ${sql}
    ORDER BY nome COLLATE NOCASE LIMIT ? OFFSET ?`).all(...params, limite, offset);
}

// Busca rápida (autocomplete): não traz inativos
function buscaRapida(q, limite = 10) {
  const termo = db.semAcento(String(q || '').trim());
  if (!termo) return [];
  return db.prepare(`
    SELECT id, nome, tipo, cargo, setor, empresa, status, motivo_bloqueio FROM pessoas
    WHERE status <> 'INATIVO' AND (sem_acento(nome) LIKE ? OR sem_acento(empresa) LIKE ?)
    ORDER BY (sem_acento(nome) LIKE ?) DESC, nome COLLATE NOCASE LIMIT ?`)
    .all(`%${termo}%`, `%${termo}%`, `${termo}%`, limite);
}

function criar(body, usuario) {
  return db.transaction(() => {
    const dados = normalizar(body);
    const t = agora();
    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO pessoas (nome, tipo, cargo, setor, empresa, telefone, observacao, status, criado_em, atualizado_em)
      VALUES (@nome, @tipo, @cargo, @setor, @empresa, @telefone, @observacao, 'ATIVO', @t, @t)`).run({ ...dados, t });
    auditoria.registrar({ usuario, acao: 'CRIAR', entidade: 'PESSOA', entidadeId: id, depois: dados });
    return Number(id);
  })();
}

function editar(id, body, usuario) {
  return db.transaction(() => {
    const atual = obter(id);
    const dados = normalizar(body);
    db.prepare(`
      UPDATE pessoas SET nome = @nome, tipo = @tipo, cargo = @cargo, setor = @setor, empresa = @empresa,
        telefone = @telefone, observacao = @observacao, atualizado_em = @t WHERE id = @id`)
      .run({ ...dados, t: agora(), id });
    const antes = Object.fromEntries(CAMPOS.map((c) => [c, atual[c]]));
    auditoria.registrar({ usuario, acao: 'EDITAR', entidade: 'PESSOA', entidadeId: id, antes, depois: dados });
  })();
}

// Movimentações como motorista + acessos a pé
const contarMovimentacoes = (id) => db.prepare(`
  SELECT (SELECT COUNT(*) FROM movimentacoes WHERE motorista_id = ?)
       + (SELECT COUNT(*) FROM acessos_pedestres WHERE pessoa_id = ?)`).pluck().get(id, id);

function excluir(id, usuario) {
  return db.transaction(() => {
    const atual = obter(id);
    const qtd = contarMovimentacoes(id);
    if (qtd > 0) {
      throw new ErroNegocio(`"${atual.nome}" não pode ser excluída porque possui ${qtd} movimentação(ões) registrada(s), `
        + 'que precisam continuar nos relatórios. Use "Inativar": a pessoa some das buscas da portaria, mas o histórico é mantido.');
    }
    // Os veículos dela ficam sem proprietário (ON DELETE SET NULL)
    db.prepare('DELETE FROM pessoas WHERE id = ?').run(id);
    auditoria.registrar({ usuario, acao: 'EXCLUIR', entidade: 'PESSOA', entidadeId: id, antes: atual });
    return atual;
  })();
}

const mudarStatus = (id, operacao, motivo, usuario) => alterarStatus('PESSOA', id, operacao, motivo, usuario);

module.exports = {
  TIPOS, STATUS, normalizar, buscar, obter, contar, listar, buscaRapida, criar, editar,
  contarMovimentacoes, excluir, mudarStatus,
};
