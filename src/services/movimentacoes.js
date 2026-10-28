const db = require('../db');
const config = require('../config');
const auditoria = require('./auditoria');
const pessoas = require('./pessoas');
const veiculos = require('./veiculos');
const placaUtil = require('../utils/placa');
const datas = require('../utils/datas');
const { ErroNegocio } = require('../utils/erros');

const TOLERANCIA_FUTURO_MIN = 5;

const SELECT = `
  SELECT m.*, v.placa, v.placa_fora_padrao, v.tipo AS veiculo_tipo, v.marca_modelo, v.cor,
         v.status AS veiculo_status, v.motivo_bloqueio AS veiculo_motivo,
         mo.nome AS motorista_nome, mo.tipo AS motorista_tipo, mo.cargo, mo.setor, mo.empresa,
         mo.status AS motorista_status, pr.nome AS proprietario_nome
  FROM movimentacoes m
  JOIN veiculos v ON v.id = m.veiculo_id
  JOIN pessoas mo ON mo.id = m.motorista_id
  LEFT JOIN pessoas pr ON pr.id = v.proprietario_id`;

function buscar(id) {
  return db.prepare(`${SELECT} WHERE m.id = ?`).get(id);
}

function obter(id) {
  const m = buscar(id);
  if (!m) throw new ErroNegocio('Movimentação não encontrada.');
  return m;
}

const emAberto = (veiculoId) => db.prepare(`${SELECT} WHERE m.veiculo_id = ? AND m.saida_em IS NULL`).get(veiculoId);

// Converte o valor do formulário; vazio = agora
function lerDataHora(valor, rotulo, { obrigatorio = false } = {}) {
  if (!valor) {
    if (obrigatorio) throw new ErroNegocio(`Informe a data e hora de ${rotulo}.`);
    return datas.agora();
  }
  const dh = datas.deInputDataHora(valor);
  if (!dh) throw new ErroNegocio(`Data e hora de ${rotulo} inválida.`);
  if (datas.minutosEntre(datas.agora(), dh) > TOLERANCIA_FUTURO_MIN) {
    throw new ErroNegocio(`A data e hora de ${rotulo} não pode estar no futuro.`);
  }
  return dh;
}

// Impede que duas movimentações do mesmo veículo se sobreponham no tempo
function verificarSobreposicao(veiculoId, entrada, saida, ignorarId = 0) {
  const conflito = db.prepare(`
    SELECT entrada_em, saida_em FROM movimentacoes
    WHERE veiculo_id = ? AND id <> ? AND entrada_em < ? AND (saida_em IS NULL OR saida_em > ?)
    ORDER BY entrada_em DESC LIMIT 1`).get(veiculoId, ignorarId, saida || '9999-12-31 23:59:59', entrada);
  if (conflito) {
    throw new ErroNegocio('O horário informado se sobrepõe a outra movimentação deste veículo '
      + `(entrada ${datas.fmtDataHora(conflito.entrada_em)}`
      + `${conflito.saida_em ? `, saída ${datas.fmtDataHora(conflito.saida_em)}` : ', ainda sem saída'}).`);
  }
}

function verificarLiberacao(veiculo, motorista) {
  const placa = placaUtil.formatar(veiculo.placa);
  if (veiculo.status === 'BLOQUEADO') {
    throw new ErroNegocio(`ENTRADA NÃO PERMITIDA: o veículo ${placa} está BLOQUEADO. Motivo: ${veiculo.motivo_bloqueio}`);
  }
  if (veiculo.status === 'INATIVO') {
    throw new ErroNegocio(`O veículo ${placa} está inativo. Reative-o no cadastro de veículos antes de registrar a entrada.`);
  }
  if (motorista.status === 'BLOQUEADO') {
    throw new ErroNegocio(`ENTRADA NÃO PERMITIDA: ${motorista.nome} está BLOQUEADO(A). Motivo: ${motorista.motivo_bloqueio}`);
  }
  if (motorista.status === 'INATIVO') {
    throw new ErroNegocio(`${motorista.nome} está inativo(a). Reative o cadastro antes de registrar a entrada.`);
  }
}

function registrarEntrada({ veiculoId, motoristaId, entradaEm, observacao }, usuario) {
  return db.transaction(() => {
    const veiculo = veiculos.obter(veiculoId);
    if (!motoristaId) throw new ErroNegocio('Informe o motorista.');
    const motorista = pessoas.obter(motoristaId);
    verificarLiberacao(veiculo, motorista);

    const aberta = emAberto(veiculo.id);
    if (aberta) {
      throw new ErroNegocio(`O veículo ${placaUtil.formatar(veiculo.placa)} já está no pátio desde `
        + `${datas.fmtDataHora(aberta.entrada_em)}. Registre a saída antes de uma nova entrada.`);
    }

    const entrada = lerDataHora(entradaEm, 'entrada');
    verificarSobreposicao(veiculo.id, entrada, null);
    const obs = String(observacao || '').trim().slice(0, 500) || null;
    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO movimentacoes (veiculo_id, motorista_id, entrada_em, observacao, criado_em)
      VALUES (?, ?, ?, ?, ?)`).run(veiculo.id, motorista.id, entrada, obs, datas.agora());
    auditoria.registrar({
      usuario, acao: 'REGISTRAR_ENTRADA', entidade: 'MOVIMENTACAO', entidadeId: id,
      depois: { placa: veiculo.placa, motorista: motorista.nome, entrada_em: entrada, observacao: obs },
    });
    return { id: Number(id), veiculo, motorista, entrada };
  })();
}

function registrarSaida(movId, saidaEm, usuario) {
  return db.transaction(() => {
    const mov = obter(movId);
    if (mov.saida_em) {
      throw new ErroNegocio(`A saída do veículo ${placaUtil.formatar(mov.placa)} já foi registrada em `
        + `${datas.fmtDataHora(mov.saida_em)}.`);
    }
    const saida = lerDataHora(saidaEm, 'saída');
    if (saida <= mov.entrada_em) {
      throw new ErroNegocio(`A saída precisa ser posterior à entrada (${datas.fmtDataHora(mov.entrada_em)}).`);
    }
    db.prepare('UPDATE movimentacoes SET saida_em = ? WHERE id = ?').run(saida, mov.id);
    auditoria.registrar({
      usuario, acao: 'REGISTRAR_SAIDA', entidade: 'MOVIMENTACAO', entidadeId: mov.id,
      antes: { saida_em: null }, depois: { placa: mov.placa, motorista: mov.motorista_nome, saida_em: saida },
    });
    return { ...mov, saida_em: saida };
  })();
}

// Motorista vindo dos formulários da portaria: pessoa existente ou novo visitante
function resolverMotorista(body, usuario) {
  if (body.motorista_modo === 'novo') {
    return pessoas.criar({
      nome: body.visitante_nome,
      tipo: 'VISITANTE',
      cargo: 'Visitante',
      empresa: body.visitante_empresa,
      telefone: body.visitante_telefone,
    }, usuario);
  }
  const id = parseInt(body.motorista_id, 10);
  if (!id) throw new ErroNegocio('Selecione o motorista ou cadastre um novo visitante.');
  return pessoas.obter(id).id;
}

// Entrada pela tela da portaria (o motorista pode ser um novo visitante)
function entradaPortaria(body, usuario) {
  return db.transaction(() => {
    const veiculo = veiculos.obter(parseInt(body.veiculo_id, 10));
    // Verifica o veículo antes de criar um visitante que não chegaria a entrar
    verificarLiberacao(veiculo, { status: 'ATIVO' });
    const motoristaId = resolverMotorista(body, usuario);
    return registrarEntrada({
      veiculoId: veiculo.id, motoristaId, entradaEm: body.entrada_em, observacao: body.observacao,
    }, usuario);
  })();
}

// Cadastro rápido da portaria: veículo + motorista (existente ou novo
// visitante) e registro da entrada, tudo numa única transação.
function cadastroRapido(body, usuario) {
  return db.transaction(() => {
    const motoristaId = resolverMotorista(body, usuario);

    const veiculoId = veiculos.criar({
      placa: body.placa,
      placa_fora_padrao: body.placa_fora_padrao,
      tipo: body.tipo,
      marca_modelo: body.marca_modelo,
      cor: body.cor,
      proprietario_id: body.motorista_proprietario ? motoristaId : null,
    }, usuario);

    return registrarEntrada({ veiculoId, motoristaId, entradaEm: body.entrada_em, observacao: body.observacao }, usuario);
  })();
}

// Nível de alerta de um veículo no pátio:
// 'vermelho' = entrou em dia anterior e não saiu; 'amarelo' = passou de HORA_FIM_DIA
function nivelAlerta(mov, agora = datas.agora()) {
  if (mov.entrada_em.slice(0, 10) < agora.slice(0, 10)) return 'vermelho';
  if (agora.slice(11, 16) >= config.horaFimDia) return 'amarelo';
  return null;
}

function patio() {
  const agora = datas.agora();
  return db.prepare(`${SELECT} WHERE m.saida_em IS NULL ORDER BY m.entrada_em`).all().map((m) => ({
    ...m,
    minutos: datas.minutosEntre(m.entrada_em),
    alerta: nivelAlerta(m, agora),
  }));
}

const contarPatio = () => db.prepare('SELECT COUNT(*) FROM movimentacoes WHERE saida_em IS NULL').pluck().get();

// Últimos eventos (entradas ou saídas) do dia
function ultimasDoDia(limite = 10) {
  const inicio = `${datas.hoje()} 00:00:00`;
  return db.prepare(`${SELECT}
    WHERE m.entrada_em >= ? OR m.saida_em >= ?
    ORDER BY COALESCE(m.saida_em, m.entrada_em) DESC, m.id DESC LIMIT ?`).all(inicio, inicio, limite);
}

function filtrosSql(f) {
  const where = [];
  const params = [];
  if (f.q) {
    const placa = placaUtil.normalizar(f.q);
    const nome = `%${db.semAcento(f.q.trim())}%`;
    where.push(`(${placa ? 'v.placa LIKE ? OR ' : ''}sem_acento(mo.nome) LIKE ?)`);
    if (placa) params.push(`%${placa}%`);
    params.push(nome);
  }
  if (f.de) { where.push('m.entrada_em >= ?'); params.push(`${f.de} 00:00:00`); }
  if (f.ate) { where.push('m.entrada_em <= ?'); params.push(`${f.ate} 23:59:59`); }
  if (f.situacao === 'abertas') where.push('m.saida_em IS NULL');
  if (f.situacao === 'fechadas') where.push('m.saida_em IS NOT NULL');
  if (f.veiculo_id) { where.push('m.veiculo_id = ?'); params.push(Number(f.veiculo_id)); }
  if (f.motorista_id) { where.push('m.motorista_id = ?'); params.push(Number(f.motorista_id)); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function contar(f) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`SELECT COUNT(*) FROM movimentacoes m JOIN veiculos v ON v.id = m.veiculo_id
                     JOIN pessoas mo ON mo.id = m.motorista_id ${sql}`).pluck().get(...params);
}

function listar(f, { limite, offset }) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`${SELECT} ${sql} ORDER BY m.entrada_em DESC, m.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limite, offset);
}

function corrigirHorario(id, { entrada_em: entradaIn, saida_em: saidaIn, observacao }, usuario) {
  return db.transaction(() => {
    const mov = obter(id);
    const motivo = String(observacao || '').trim();
    if (motivo.length < 5) throw new ErroNegocio('Descreva o motivo da correção (mínimo de 5 caracteres).');

    const entrada = lerDataHora(entradaIn, 'entrada', { obrigatorio: true });
    let saida = null;
    if (saidaIn) saida = lerDataHora(saidaIn, 'saída');
    else if (mov.saida_em) throw new ErroNegocio('Informe a data e hora de saída (ela não pode ser apagada).');

    if (saida && saida <= entrada) throw new ErroNegocio('A saída precisa ser posterior à entrada.');
    if (entrada === mov.entrada_em && saida === mov.saida_em) throw new ErroNegocio('Nenhum horário foi alterado.');
    verificarSobreposicao(mov.veiculo_id, entrada, saida, mov.id);

    const nota = `[Correção em ${datas.fmtDataHora(datas.agora())} por ${usuario}: ${motivo}]`;
    const obs = [mov.observacao, nota].filter(Boolean).join(' ').slice(0, 2000);
    db.prepare('UPDATE movimentacoes SET entrada_em = ?, saida_em = ?, observacao = ? WHERE id = ?')
      .run(entrada, saida, obs, mov.id);
    auditoria.registrar({
      usuario, acao: 'CORRIGIR_HORARIO', entidade: 'MOVIMENTACAO', entidadeId: mov.id,
      antes: { entrada_em: mov.entrada_em, saida_em: mov.saida_em },
      depois: { entrada_em: entrada, saida_em: saida },
      extra: { placa: mov.placa, motivo },
    });
  })();
}

module.exports = {
  buscar, obter, emAberto, registrarEntrada, registrarSaida, entradaPortaria, cadastroRapido, nivelAlerta, patio,
  contarPatio, ultimasDoDia, contar, listar, corrigirHorario,
};
