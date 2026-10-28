const path = require('node:path');
const express = require('express');
const backup = require('../services/backup');
const config = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('backup', {
    titulo: 'Backup', backups: backup.listar(), retencao: config.backupRetencaoDias, pasta: config.backupDir,
  });
});

// Gera um backup na hora e envia o arquivo para download
router.post('/agora', async (req, res) => {
  const arquivo = await backup.criarBackup('_manual');
  res.download(arquivo, path.basename(arquivo));
});

// Baixa um backup já existente (somente nomes gerados pelo sistema)
router.get('/arquivo/:nome', (req, res) => {
  const { nome } = req.params;
  if (!/^estacionamento_[\w-]+\.db$/.test(nome) || !backup.listar().some((b) => b.nome === nome)) {
    req.flash('erro', 'Arquivo de backup não encontrado.');
    return res.redirect('/backup');
  }
  res.download(path.join(config.backupDir, nome), nome);
});

module.exports = router;
