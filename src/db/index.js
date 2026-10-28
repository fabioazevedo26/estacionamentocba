const fs = require('node:fs');
const Database = require('better-sqlite3');
const config = require('../config');

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.backupDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

module.exports = db;

// Função SQL para buscas sem diferenciar acentos e maiúsculas: sem_acento('José') = 'jose'
const semAcento = (t) => (t == null ? null : String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
db.function('sem_acento', { deterministic: true }, semAcento);
db.semAcento = semAcento;
