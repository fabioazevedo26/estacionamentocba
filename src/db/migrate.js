// Executa, em ordem, as migrações de src/db/migrations ainda não aplicadas.
const fs = require('node:fs');
const path = require('node:path');
const { agora } = require('../utils/datas');

function migrar(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS migracoes (
    nome TEXT PRIMARY KEY,
    executada_em TEXT NOT NULL
  )`);

  const pasta = path.join(__dirname, 'migrations');
  const arquivos = fs.readdirSync(pasta).filter((f) => /^\d+_.+\.js$/.test(f)).sort();
  const feitas = new Set(db.prepare('SELECT nome FROM migracoes').pluck().all());

  for (const arquivo of arquivos) {
    if (feitas.has(arquivo)) continue;
    const migracao = require(path.join(pasta, arquivo));
    db.transaction(() => {
      migracao.up(db);
      db.prepare('INSERT INTO migracoes (nome, executada_em) VALUES (?, ?)').run(arquivo, agora());
    })();
    console.log(`[migração] aplicada: ${arquivo}`);
  }
}

module.exports = migrar;
