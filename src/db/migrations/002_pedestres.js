// Controle de pedestres: entradas e saídas a pé. Tabela nova, sem alterar as existentes.
exports.up = (db) => {
  db.exec(`
    CREATE TABLE acessos_pedestres (
      id          INTEGER PRIMARY KEY,
      pessoa_id   INTEGER NOT NULL REFERENCES pessoas(id),
      entrada_em  TEXT NOT NULL,
      saida_em    TEXT,
      observacao  TEXT,
      criado_em   TEXT NOT NULL,
      CHECK (saida_em IS NULL OR saida_em > entrada_em)
    );
    CREATE INDEX idx_ped_entrada ON acessos_pedestres(entrada_em);
    CREATE INDEX idx_ped_saida ON acessos_pedestres(saida_em);
    CREATE INDEX idx_ped_pessoa ON acessos_pedestres(pessoa_id);
    -- Uma pessoa só pode ter um acesso a pé em aberto
    CREATE UNIQUE INDEX idx_ped_aberto ON acessos_pedestres(pessoa_id) WHERE saida_em IS NULL;
  `);
};
