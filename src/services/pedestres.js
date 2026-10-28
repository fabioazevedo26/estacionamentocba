// Controle de pedestres: entradas e saídas a pé (tabela acessos_pedestres)
const db = require('../db');
const auditoria = require('./auditoria');
const pessoas = require('./pessoas');
const { lerDataHora, nivelAlerta } = require('./movimentacoes');
const datas = require('../utils/datas');
const { ErroNegocio } = require('../utils/erros');

const SELECT = `
  SELECT a.*, p.nome AS pessoa_nome, p.tipo AS pessoa_tipo, p.cargo, p.setor, p.empresa,
         p.status AS pessoa_status, p.motivo_bloqueio AS pessoa_motivo
  FROM acessos_pedestres a
  JOIN pessoas p ON p.id = a.pessoa_id`;

function buscar(id) {
  return db.prepare(`${SELECT} WHERE a.id = ?`).get(id);
}

function obter(id) {
  const a = buscar(id);
  if (!a) throw new ErroNegocio('Registro de pedestre não encontrado.');
  return a;
}

const emAberto = (pessoaId) => db.prepare(`${SELECT} WHERE a.pessoa_id = ? AND a.saida_em IS NULL`).get(pessoaId);

// Impede que dois acessos a pé da mesma pessoa se sobreponham no tempo
function verificarSobreposicao(pessoaId, entrada, saida, ignorarId = 0) {
  const conflito = db.prepare(`
    SELECT entrada_em, saida_em FROM acessos_pedestres
    WHERE pessoa_id = ? AND id <> ? AND entrada_em < ? AND (saida_em IS NULL OR saida_em > ?)
    ORDER BY entrada_em DESC LIMIT 1`).get(pessoaId, ignorarId, saida || '9999-12-31 23:59:59', entrada);
  if (conflito) {
    throw new ErroNegocio('O horário informado se sobrepõe a outro acesso a pé desta pessoa '
      + `(entrada ${datas.fmtDataHora(conflito.entrada_em)}`
      + `${conflito.saida_em ? `, saída ${datas.fmtDataHora(conflito.saida_em)}` : ', ainda sem saída'}).`);
  }
}

// Pessoa existente (pessoa_id) ou novo visitante (pessoa_modo = 'novo')
function resolverPessoa(body, usuario) {
  if (body.pessoa_modo === 'novo') {
    return pessoas.criar({
      nome: body.visitante_nome,
      tipo: 'VISITANTE',
      cargo: 'Visitante',
      empresa: body.visitante_empresa,
      telefone: body.visitante_telefone,
    }, usuario);
  }
  const id = parseInt(body.pessoa_id, 10);
  if (!id) throw new ErroNegocio('Selecione a pessoa ou cadastre um novo visitante.');
  return pessoas.obter(id).id;
}

function registrarEntrada(body, usuario) {
  return db.transaction(() => {
    const pessoa = pessoas.obter(resolverPessoa(body, usuario));
    if (pessoa.status === 'BLOQUEADO') {
      throw new ErroNegocio(`ENTRADA NÃO PERMITIDA: ${pessoa.nome} está BLOQUEADO(A). Motivo: ${pessoa.motivo_bloqueio}`);
    }
    if (pessoa.status === 'INATIVO') {
      throw new ErroNegocio(`${pessoa.nome} está inativo(a). Reative o cadastro antes de registrar a entrada.`);
    }
    const aberto = emAberto(pessoa.id);
    if (aberto) {
      throw new ErroNegocio(`${pessoa.nome} já está no CBA (entrada a pé em ${datas.fmtDataHora(aberto.entrada_em)}). `
        + 'Registre a saída antes de uma nova entrada.');
    }
    const entrada = lerDataHora(body.entrada_em, 'entrada');
    verificarSobreposicao(pessoa.id, entrada, null);
    const obs = String(body.observacao || '').trim().slice(0, 500) || null;
    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO acessos_pedestres (pessoa_id, entrada_em, observacao, criado_em) VALUES (?, ?, ?, ?)`)
      .run(pessoa.id, entrada, obs, datas.agora());
    auditoria.registrar({
      usuario, acao: 'REGISTRAR_ENTRADA', entidade: 'PEDESTRE', entidadeId: id,
      depois: { pessoa: pessoa.nome, entrada_em: entrada, observacao: obs },
    });
    return { id: Number(id), pessoa, entrada };
  })();
}

function registrarSaida(id, saidaEm, usuario) {
  return db.transaction(() => {
    const a = obter(id);
    if (a.saida_em) {
      throw new ErroNegocio(`A saída de ${a.pessoa_nome} já foi registrada em ${datas.fmtDataHora(a.saida_em)}.`);
    }
    const saida = lerDataHora(saidaEm, 'saída');
    if (saida <= a.entrada_em) {
      throw new ErroNegocio(`A saída precisa ser posterior à entrada (${datas.fmtDataHora(a.entrada_em)}).`);
    }
    db.prepare('UPDATE acessos_pedestres SET saida_em = ? WHERE id = ?').run(saida, a.id);
    auditoria.registrar({
      usuario, acao: 'REGISTRAR_SAIDA', entidade: 'PEDESTRE', entidadeId: a.id,
      antes: { saida_em: null }, depois: { pessoa: a.pessoa_nome, saida_em: saida },
    });
    return { ...a, saida_em: saida };
  })();
}

// Pedestres dentro do CBA agora, com o mesmo critério de alerta do estacionamento
function dentro() {
  const agora = datas.agora();
  return db.prepare(`${SELECT} WHERE a.saida_em IS NULL ORDER BY a.entrada_em`).all().map((a) => ({
    ...a,
    minutos: datas.minutosEntre(a.entrada_em),
    alerta: nivelAlerta(a, agora),
  }));
}

const contarDentro = () => db.prepare('SELECT COUNT(*) FROM acessos_pedestres WHERE saida_em IS NULL').pluck().get();

function ultimasDoDia(limite = 10) {
  const inicio = `${datas.hoje()} 00:00:00`;
  return db.prepare(`${SELECT}
    WHERE a.entrada_em >= ? OR a.saida_em >= ?
    ORDER BY COALESCE(a.saida_em, a.entrada_em) DESC, a.id DESC LIMIT ?`).all(inicio, inicio, limite);
}

function filtrosSql(f) {
  const where = [];
  const params = [];
  if (f.q) {
    const q = `%${db.semAcento(f.q.trim())}%`;
    where.push('(sem_acento(p.nome) LIKE ? OR sem_acento(p.empresa) LIKE ?)');
    params.push(q, q);
  }
  if (f.de) { where.push('a.entrada_em >= ?'); params.push(`${f.de} 00:00:00`); }
  if (f.ate) { where.push('a.entrada_em <= ?'); params.push(`${f.ate} 23:59:59`); }
  if (f.situacao === 'abertas') where.push('a.saida_em IS NULL');
  if (f.situacao === 'fechadas') where.push('a.saida_em IS NOT NULL');
  if (f.tipo === 'COLABORADOR' || f.tipo === 'VISITANTE') { where.push('p.tipo = ?'); params.push(f.tipo); }
  if (f.pessoa_id) { where.push('a.pessoa_id = ?'); params.push(Number(f.pessoa_id)); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function contar(f) {
  const { sql, params } = filtrosSql(f);
  return db.prepare(`SELECT COUNT(*) FROM acessos_pedestres a JOIN pessoas p ON p.id = a.pessoa_id ${sql}`)
    .pluck().get(...params);
}

// Sem paginação (limite/offset ausentes) é usado na exportação para Excel
function listar(f, { limite, offset } = {}) {
  const { sql, params } = filtrosSql(f);
  const pagina = limite ? 'LIMIT ? OFFSET ?' : '';
  const ordem = limite ? 'a.entrada_em DESC, a.id DESC' : 'a.entrada_em, a.id';
  return db.prepare(`${SELECT} ${sql} ORDER BY ${ordem} ${pagina}`)
    .all(...params, ...(limite ? [limite, offset] : []));
}

const contarDaPessoa = (pessoaId) => db.prepare('SELECT COUNT(*) FROM acessos_pedestres WHERE pessoa_id = ?')
  .pluck().get(pessoaId);

function corrigirHorario(id, { entrada_em: entradaIn, saida_em: saidaIn, observacao }, usuario) {
  return db.transaction(() => {
    const a = obter(id);
    const motivo = String(observacao || '').trim();
    if (motivo.length < 5) throw new ErroNegocio('Descreva o motivo da correção (mínimo de 5 caracteres).');

    const entrada = lerDataHora(entradaIn, 'entrada', { obrigatorio: true });
    let saida = null;
    if (saidaIn) saida = lerDataHora(saidaIn, 'saída');
    else if (a.saida_em) throw new ErroNegocio('Informe a data e hora de saída (ela não pode ser apagada).');

    if (saida && saida <= entrada) throw new ErroNegocio('A saída precisa ser posterior à entrada.');
    if (entrada === a.entrada_em && saida === a.saida_em) throw new ErroNegocio('Nenhum horário foi alterado.');
    verificarSobreposicao(a.pessoa_id, entrada, saida, a.id);

    const nota = `[Correção em ${datas.fmtDataHora(datas.agora())} por ${usuario}: ${motivo}]`;
    const obs = [a.observacao, nota].filter(Boolean).join(' ').slice(0, 2000);
    db.prepare('UPDATE acessos_pedestres SET entrada_em = ?, saida_em = ?, observacao = ? WHERE id = ?')
      .run(entrada, saida, obs, a.id);
    auditoria.registrar({
      usuario, acao: 'CORRIGIR_HORARIO', entidade: 'PEDESTRE', entidadeId: a.id,
      antes: { entrada_em: a.entrada_em, saida_em: a.saida_em },
      depois: { entrada_em: entrada, saida_em: saida },
      extra: { pessoa: a.pessoa_nome, motivo },
    });
  })();
}

module.exports = {
  buscar, obter, emAberto, registrarEntrada, registrarSaida, dentro, contarDentro, ultimasDoDia,
  contar, listar, contarDaPessoa, corrigirHorario,
};
