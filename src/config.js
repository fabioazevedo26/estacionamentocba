const path = require('node:path');
require('dotenv').config({ quiet: true });

// O fuso precisa ser definido antes de qualquer uso de Date.
process.env.TZ = process.env.TZ || 'America/Manaus';

const raiz = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(raiz, 'data');

function lerHora(valor) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(valor || '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return '18:00';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

module.exports = {
  raiz,
  dataDir,
  dbPath: path.join(dataDir, 'estacionamento.db'),
  backupDir: path.join(dataDir, 'backups'),
  port: Number(process.env.PORT) || 3001,
  tz: process.env.TZ,
  sessionSecret: process.env.SESSION_SECRET || '',
  adminUser: process.env.ADMIN_USER || 'Portaria2',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  horaFimDia: lerHora(process.env.HORA_FIM_DIA),
  backupRetencaoDias: Math.max(1, Number(process.env.BACKUP_RETENCAO_DIAS) || 30),
  producao: process.env.NODE_ENV === 'production',
};
