const db = require('../db');
const datas = require('../utils/datas');
const placaUtil = require('../utils/placa');
const pessoas = require('./pessoas');
const veiculos = require('./veiculos');

const PERIODOS = {
  hoje: 'Hoje',
  semana: 'Esta semana',
  mes: 'Este mês',
  mes_especifico: 'Mês específico',
  intervalo: 'Intervalo personalizado',
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Converte o filtro de período em datas (AAAA-MM-DD) inclusivas
function resolverPeriodo(f) {
  const hoje = datas.hoje();
  const periodo = PERIODOS[f.periodo] ? f.periodo : 'hoje';
  let de = hoje;
  let ate = hoje;
  if (periodo === 'semana') {
    const diaSemana = (datas.dataLocal(hoje).getDay() + 6) % 7; // segunda = 0
    de = datas.somarDias(hoje, -diaSemana);
    ate = datas.somarDias(de, 6);
  } else if (periodo === 'mes' || periodo === 'mes_especifico') {
    const mes = periodo === 'mes_especifico' && /^\d{4}-\d{2}$/.test(f.mes || '') ? f.mes : hoje.slice(0, 7);
    de = `${mes}-01`;
    const d = datas.dataLocal(de);
    ate = datas.isoData(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  } else if (periodo === 'intervalo') {
    de = ISO.test(f.de || '') ? f.de : hoje;
    ate = ISO.test(f.ate || '') ? f.ate : de;
    if (ate < de) [de, ate] = [ate, de];
  }
  return { periodo, de, ate };
}

function filtrosSql(f) {
  const { de, ate } = resolverPeriodo(f);
  const where = ['m.entrada_em >= ?', 'm.entrada_em <= ?'];
  const params = [`${de} 00:00:00`, `${ate} 23:59:59`];
  const motorista = parseInt(f.motorista_id, 10);
  if (motorista) { where.push('m.motorista_id = ?'); params.push(motorista); }
  const placa = placaUtil.normalizar(f.placa);
  if (placa) { where.push('v.placa LIKE ?'); params.push(`%${placa}%`); }
  if (pessoas.TIPOS.includes(f.tipo_pessoa)) { where.push('mo.tipo = ?'); params.push(f.tipo_pessoa); }
  if (veiculos.TIPOS.includes(f.tipo_veiculo)) { where.push('v.tipo = ?'); params.push(f.tipo_veiculo); }
  if (f.cargo) { where.push('mo.cargo = ?'); params.push(f.cargo); }
  if (f.setor) { where.push('mo.setor = ?'); params.push(f.setor); }
  if (f.empresa?.trim()) { where.push('sem_acento(mo.empresa) LIKE ?'); params.push(`%${db.semAcento(f.empresa.trim())}%`); }
  if (f.sem_saida) where.push('m.saida_em IS NULL');
  return { sql: `WHERE ${where.join(' AND ')}`, params, de, ate };
}

const FROM = `
  FROM movimentacoes m
  JOIN veiculos v ON v.id = m.veiculo_id
  JOIN pessoas mo ON mo.id = m.motorista_id
  LEFT JOIN pessoas pr ON pr.id = v.proprietario_id`;

const MINUTOS = "CAST(ROUND((julianday(m.saida_em) - julianday(m.entrada_em)) * 1440) AS INTEGER)";

function gerar(f, { limite } = {}) {
  const { sql, params, de, ate } = filtrosSql(f);

  const linhas = db.prepare(`
    SELECT m.id, m.entrada_em, m.saida_em, m.observacao, ${MINUTOS} AS minutos,
           mo.nome AS motorista_nome, mo.tipo AS motorista_tipo, mo.cargo, mo.setor, mo.empresa,
           v.placa, v.placa_fora_padrao, v.tipo AS veiculo_tipo, v.marca_modelo, v.cor,
           pr.nome AS proprietario_nome
    ${FROM} ${sql}
    ORDER BY m.entrada_em, m.id
    ${limite ? 'LIMIT ?' : ''}`).all(...params, ...(limite ? [limite] : []));

  const totais = db.prepare(`
    SELECT COUNT(*) AS entradas, COUNT(DISTINCT m.veiculo_id) AS veiculos,
           SUM(m.saida_em IS NULL) AS sem_saida, AVG(${MINUTOS}) AS media_minutos
    ${FROM} ${sql}`).get(...params);

  const porDia = db.prepare(`
    SELECT substr(m.entrada_em, 1, 10) AS dia, COUNT(*) AS entradas, COUNT(DISTINCT m.veiculo_id) AS veiculos,
           AVG(${MINUTOS}) AS media_minutos
    ${FROM} ${sql} GROUP BY dia ORDER BY dia`).all(...params);

  const porTipo = db.prepare(`
    SELECT v.tipo AS tipo, COUNT(*) AS entradas, COUNT(DISTINCT m.veiculo_id) AS veiculos
    ${FROM} ${sql} GROUP BY v.tipo ORDER BY entradas DESC`).all(...params);

  return { de, ate, linhas, totais, porDia, porTipo };
}

module.exports = { PERIODOS, resolverPeriodo, gerar };
