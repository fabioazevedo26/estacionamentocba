const db = require('../db');
const auditoria = require('./auditoria');
const pessoas = require('./pessoas');
const { alterarStatus } = require('./status');
const placaUtil = require('../utils/placa');
const { agora } = require('../utils/datas');
const { ErroNegocio } = require('../utils/erros');

const TIPOS = ['CARRO', 'MOTO', 'CAMINHAO', 'CARRETA', 'VAN', 'ONIBUS'];
const TIPOS_ROTULO = {
  CARRO: 'Carro', MOTO: 'Moto', CAMINHAO: 'Caminhão', CARRETA: 'Carreta', VAN: 'Van', ONIBUS: 'Ônibus',
};
const STATUS = ['ATIVO', 'BLOQUEADO', 'INATIVO'];
const CAMPOS = ['placa', 'placa_fora_padrao', 'tipo', 'marca_modelo', 'cor', 'proprietario_id', 'observacao'];

const texto = (v, max = 200) => {
  const t = String(v ?? '').trim().replace(/\s+/g, ' ');
  return t ? t.slice(0, max) : null;
};

const marcado = (v) => v === 'on' || v === '1' || v === 'true' || v === true;

function idOuNulo(v) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizar(body) {
  const foraPadrao = marcado(body.placa_fora_padrao);
  const dados = {
    placa: placaUtil.validar(body.placa, foraPadrao),
    placa_fora_padrao: foraPadrao ? 1 : 0,
    tipo: body.tipo,
    marca_modelo: texto(body.marca_modelo, 80),
    cor: texto(body.cor, 30),
    proprietario_id: idOuNulo(body.proprietario_id),
    observacao: texto(body.observacao, 500),
  };
  if (!TIPOS.includes(dados.tipo)) throw new ErroNegocio('Selecione o tipo de veículo.');
  if (dados.proprietario_id && !pessoas.buscar(dados.proprietario_id)) {
    throw new ErroNegocio('Proprietário não encontrado.');
  }
  return dados;
}

const SELECT = `
  SELECT v.*, pr.nome AS proprietario_nome, pr.status AS proprietario_status,
         pr.motivo_bloqueio AS proprietario_motivo, pr.tipo AS proprietario_tipo,
         pr.cargo AS proprietario_cargo, pr.setor AS proprietario_setor, pr.empresa AS proprietario_empresa
  FROM veiculos v LEFT JOIN pessoas pr ON pr.id = v.proprietario_id`;

function buscar(id) {
  return db.prepare(`${SELECT} WHERE v.id = ?`).get(id);
}

function obter(id) {
  const v = buscar(id);
  if (!v) throw new ErroNegocio('Veículo não encontrado.');
  return v;
}

function buscarPorPlaca(placa) {
  return db.prepare(`${SELECT} WHERE v.placa = ?`).get(placaUtil.normalizar(placa));
}

function garantirPlacaLivre(placa, idAtual = null) {
  const existente = db.prepare('SELECT id FROM veiculos WHERE placa = ?').get(placa);
  if (existente && existente.id !== idAtual) {
    throw new ErroNegocio(`Já existe um veículo cadastrado com a placa ${placaUtil.formatar(placa)}.`);
  }
}

function filtrosSql(f) {
  const where = [];
  const params = [];
  if (f.q) {
    const placa = placaUtil.normalizar(f.q);
    const nome = `%${db.semAcento(f.q.trim())}%`;
    where.push(`(${placa ? 'v.placa LIKE ? OR ' : ''}sem_acento(v.marca_modelo) LIKE ? OR sem_acento(pr.nome) LIKE ?)`);
    if (placa) params.push(`%${placa}%`);
    params.push(nome, nome);
  }
  if (TIPOS.includes(f.tipo)) { where.push('v.tipo = ?'); params.push(f.tipo); }
  if (STATUS.includes(f.status)) { where.push('v.status = ?'); params.push(f.status); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function contar(f) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`SELECT COUNT(*) FROM veiculos v LEFT JOIN pessoas pr ON pr.id = v.proprietario_id ${sql}`)
    .pluck().get(...params);
}

function listar(f, { limite, offset }) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`
    SELECT v.*, pr.nome AS proprietario_nome,
           EXISTS (SELECT 1 FROM movimentacoes m WHERE m.veiculo_id = v.id AND m.saida_em IS NULL) AS dentro
    FROM veiculos v LEFT JOIN pessoas pr ON pr.id = v.proprietario_id ${sql}
    ORDER BY v.placa LIMIT ? OFFSET ?`).all(...params, limite, offset);
}

function doProprietario(pessoaId) {
  return db.prepare(`
    SELECT v.*, EXISTS (SELECT 1 FROM movimentacoes m WHERE m.veiculo_id = v.id AND m.saida_em IS NULL) AS dentro
    FROM veiculos v WHERE proprietario_id = ? ORDER BY placa`).all(pessoaId);
}

// Busca da portaria: placa (ou parte), nome do proprietário ou do motorista
// que está com o veículo no estacionamento. Inativos não aparecem.
function buscaPortaria(q, limite = 10) {
  const placa = placaUtil.normalizar(q);
  const nome = db.semAcento(String(q || '').trim());
  if (!placa && !nome) return [];
  return db.prepare(`
    SELECT v.id, v.placa, v.placa_fora_padrao, v.tipo, v.marca_modelo, v.cor, v.status,
           pr.nome AS proprietario_nome, m.id AS mov_id, m.entrada_em, mo.nome AS motorista_nome
    FROM veiculos v
    LEFT JOIN pessoas pr ON pr.id = v.proprietario_id
    LEFT JOIN movimentacoes m ON m.veiculo_id = v.id AND m.saida_em IS NULL
    LEFT JOIN pessoas mo ON mo.id = m.motorista_id
    WHERE v.status <> 'INATIVO' AND (
      (? <> '' AND v.placa LIKE ?)
      OR (length(?) >= 2 AND pr.status <> 'INATIVO' AND sem_acento(pr.nome) LIKE ?)
      OR (length(?) >= 2 AND sem_acento(mo.nome) LIKE ?))
    ORDER BY (v.placa = ?) DESC, (v.placa LIKE ?) DESC, v.placa
    LIMIT ?`).all(placa, `%${placa}%`, nome, `%${nome}%`, nome, `%${nome}%`, placa, `${placa}%`, limite);
}

function criar(body, usuario) {
  return db.transaction(() => {
    const dados = normalizar(body);
    garantirPlacaLivre(dados.placa);
    const t = agora();
    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO veiculos (placa, placa_fora_padrao, tipo, marca_modelo, cor, proprietario_id, observacao,
                            status, criado_em, atualizado_em)
      VALUES (@placa, @placa_fora_padrao, @tipo, @marca_modelo, @cor, @proprietario_id, @observacao, 'ATIVO', @t, @t)`)
      .run({ ...dados, t });
    auditoria.registrar({ usuario, acao: 'CRIAR', entidade: 'VEICULO', entidadeId: id, depois: dados });
    return Number(id);
  })();
}

function editar(id, body, usuario) {
  return db.transaction(() => {
    const atual = obter(id);
    const dados = normalizar(body);
    garantirPlacaLivre(dados.placa, id);
    db.prepare(`
      UPDATE veiculos SET placa = @placa, placa_fora_padrao = @placa_fora_padrao, tipo = @tipo,
        marca_modelo = @marca_modelo, cor = @cor, proprietario_id = @proprietario_id,
        observacao = @observacao, atualizado_em = @t WHERE id = @id`).run({ ...dados, t: agora(), id });
    const antes = Object.fromEntries(CAMPOS.map((c) => [c, atual[c]]));
    auditoria.registrar({ usuario, acao: 'EDITAR', entidade: 'VEICULO', entidadeId: id, antes, depois: dados });
  })();
}

// Define, troca ou remove (pessoaId nulo) o proprietário
function definirProprietario(id, pessoaId, usuario) {
  return db.transaction(() => {
    const atual = obter(id);
    const novo = idOuNulo(pessoaId);
    if (novo && !pessoas.buscar(novo)) throw new ErroNegocio('Pessoa não encontrada.');
    db.prepare('UPDATE veiculos SET proprietario_id = ?, atualizado_em = ? WHERE id = ?').run(novo, agora(), id);
    auditoria.registrar({
      usuario, acao: 'EDITAR', entidade: 'VEICULO', entidadeId: id,
      antes: { proprietario_id: atual.proprietario_id }, depois: { proprietario_id: novo },
    });
    return atual;
  })();
}

const contarMovimentacoes = (id) => db.prepare('SELECT COUNT(*) FROM movimentacoes WHERE veiculo_id = ?').pluck().get(id);

function excluir(id, usuario) {
  return db.transaction(() => {
    const atual = obter(id);
    const qtd = contarMovimentacoes(id);
    if (qtd > 0) {
      throw new ErroNegocio(`O veículo ${placaUtil.formatar(atual.placa)} não pode ser excluído porque possui ${qtd} `
        + 'movimentação(ões) registrada(s), que precisam continuar nos relatórios. Use "Inativar": ele some das '
        + 'buscas da portaria, mas o histórico é mantido.');
    }
    db.prepare('DELETE FROM veiculos WHERE id = ?').run(id);
    auditoria.registrar({ usuario, acao: 'EXCLUIR', entidade: 'VEICULO', entidadeId: id, antes: atual });
    return atual;
  })();
}

const mudarStatus = (id, operacao, motivo, usuario) => alterarStatus('VEICULO', id, operacao, motivo, usuario);

module.exports = {
  TIPOS, TIPOS_ROTULO, STATUS, normalizar, buscar, obter, buscarPorPlaca, garantirPlacaLivre, contar, listar,
  doProprietario, buscaPortaria, criar, editar, definirProprietario, contarMovimentacoes, excluir, mudarStatus,
};
