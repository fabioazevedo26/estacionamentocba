const fs = require('node:fs');
const path = require('node:path');
const cron = require('node-cron');
const db = require('../db');
const config = require('../config');
const datas = require('../utils/datas');

const PREFIXO = 'estacionamento_';

// Cópia consistente do banco (API de backup online do SQLite), sem parar o sistema
async function criarBackup(sufixo = '') {
  fs.mkdirSync(config.backupDir, { recursive: true });
  const carimbo = datas.agora().replace(' ', '_').replace(/:/g, '-');
  const destino = path.join(config.backupDir, `${PREFIXO}${carimbo}${sufixo}.db`);
  await db.backup(destino);
  return destino;
}

// Remove backups com mais de BACKUP_RETENCAO_DIAS dias
function limparAntigos() {
  const limite = Date.now() - config.backupRetencaoDias * 24 * 60 * 60 * 1000;
  let removidos = 0;
  for (const nome of fs.readdirSync(config.backupDir)) {
    if (!nome.startsWith(PREFIXO) || !nome.endsWith('.db')) continue;
    const arquivo = path.join(config.backupDir, nome);
    if (fs.statSync(arquivo).mtimeMs < limite) {
      fs.unlinkSync(arquivo);
      removidos++;
    }
  }
  return removidos;
}

function listar() {
  if (!fs.existsSync(config.backupDir)) return [];
  return fs.readdirSync(config.backupDir)
    .filter((n) => n.startsWith(PREFIXO) && n.endsWith('.db'))
    .map((nome) => {
      const st = fs.statSync(path.join(config.backupDir, nome));
      return { nome, tamanho: st.size, data: datas.paraBanco(st.mtime) };
    })
    .sort((a, b) => b.nome.localeCompare(a.nome));
}

// Backup diário às 23:30 (fuso configurado em TZ)
function agendar() {
  return cron.schedule('30 23 * * *', async () => {
    try {
      const arquivo = await criarBackup();
      const removidos = limparAntigos();
      console.log(`[backup] criado ${path.basename(arquivo)}; ${removidos} antigo(s) removido(s).`);
    } catch (e) {
      console.error('[backup] falha no backup diário:', e);
    }
  }, { timezone: config.tz });
}

module.exports = { criarBackup, limparAntigos, listar, agendar };
