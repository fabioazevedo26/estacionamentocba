const CARGOS = ['Servidor', 'Terceirizado', 'Bolsista', 'Estagiário', 'Pesquisador',
  'Prestador de serviço', 'Fornecedor', 'Visitante'];
const SETORES = ['Administração', 'TI', 'Laboratório', 'Manutenção', 'Segurança', 'Limpeza', 'Diretoria'];

exports.up = (db) => {
  db.exec(`
    CREATE TABLE usuarios (
      id          INTEGER PRIMARY KEY,
      usuario     TEXT NOT NULL UNIQUE COLLATE NOCASE,
      senha_hash  TEXT NOT NULL,
      criado_em   TEXT NOT NULL
    );

    CREATE TABLE sessoes (
      sid     TEXT PRIMARY KEY,
      sess    TEXT NOT NULL,
      expira  INTEGER NOT NULL
    );
    CREATE INDEX idx_sessoes_expira ON sessoes(expira);

    CREATE TABLE pessoas (
      id               INTEGER PRIMARY KEY,
      nome             TEXT NOT NULL,
      tipo             TEXT NOT NULL CHECK (tipo IN ('COLABORADOR', 'VISITANTE')),
      cargo            TEXT,
      setor            TEXT,
      empresa          TEXT,
      telefone         TEXT,
      observacao       TEXT,
      status           TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'BLOQUEADO', 'INATIVO')),
      motivo_bloqueio  TEXT,
      criado_em        TEXT NOT NULL,
      atualizado_em    TEXT NOT NULL
    );
    CREATE INDEX idx_pessoas_nome ON pessoas(nome COLLATE NOCASE);

    CREATE TABLE opcoes (
      id         INTEGER PRIMARY KEY,
      categoria  TEXT NOT NULL CHECK (categoria IN ('CARGO', 'SETOR')),
      valor      TEXT NOT NULL,
      UNIQUE (categoria, valor COLLATE NOCASE)
    );

    CREATE TABLE veiculos (
      id                 INTEGER PRIMARY KEY,
      placa              TEXT NOT NULL UNIQUE,
      placa_fora_padrao  INTEGER NOT NULL DEFAULT 0,
      tipo               TEXT NOT NULL CHECK (tipo IN ('CARRO', 'MOTO', 'CAMINHAO', 'CARRETA', 'VAN', 'ONIBUS')),
      marca_modelo       TEXT,
      cor                TEXT,
      proprietario_id    INTEGER REFERENCES pessoas(id) ON DELETE SET NULL,
      status             TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'BLOQUEADO', 'INATIVO')),
      motivo_bloqueio    TEXT,
      observacao         TEXT,
      criado_em          TEXT NOT NULL,
      atualizado_em      TEXT NOT NULL
    );
    CREATE INDEX idx_veiculos_proprietario ON veiculos(proprietario_id);

    CREATE TABLE movimentacoes (
      id            INTEGER PRIMARY KEY,
      veiculo_id    INTEGER NOT NULL REFERENCES veiculos(id),
      motorista_id  INTEGER NOT NULL REFERENCES pessoas(id),
      entrada_em    TEXT NOT NULL,
      saida_em      TEXT,
      observacao    TEXT,
      criado_em     TEXT NOT NULL,
      CHECK (saida_em IS NULL OR saida_em > entrada_em)
    );
    CREATE INDEX idx_mov_entrada ON movimentacoes(entrada_em);
    CREATE INDEX idx_mov_saida ON movimentacoes(saida_em);
    CREATE INDEX idx_mov_veiculo ON movimentacoes(veiculo_id);
    CREATE INDEX idx_mov_motorista ON movimentacoes(motorista_id);
    -- Garante no banco que um veículo tenha no máximo uma movimentação em aberto
    CREATE UNIQUE INDEX idx_mov_aberta ON movimentacoes(veiculo_id) WHERE saida_em IS NULL;

    CREATE TABLE auditoria (
      id           INTEGER PRIMARY KEY,
      data_hora    TEXT NOT NULL,
      usuario      TEXT,
      acao         TEXT NOT NULL CHECK (acao IN ('CRIAR', 'EDITAR', 'BLOQUEAR', 'DESBLOQUEAR', 'INATIVAR',
                     'EXCLUIR', 'REGISTRAR_ENTRADA', 'REGISTRAR_SAIDA', 'CORRIGIR_HORARIO', 'LOGIN')),
      entidade     TEXT,
      entidade_id  INTEGER,
      detalhes     TEXT
    );
    CREATE INDEX idx_auditoria_data ON auditoria(data_hora);
    CREATE INDEX idx_auditoria_acao ON auditoria(acao);
  `);

  const inserir = db.prepare('INSERT INTO opcoes (categoria, valor) VALUES (?, ?)');
  for (const c of CARGOS) inserir.run('CARGO', c);
  for (const s of SETORES) inserir.run('SETOR', s);
};
