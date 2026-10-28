const config = require('./config');
const db = require('./db');
const migrar = require('./db/migrate');
const usuarios = require('./services/usuarios');
const backup = require('./services/backup');

async function iniciar() {
  migrar(db);
  await usuarios.criarAdminInicial(config.adminUser, config.adminPassword);
  backup.agendar();

  // Carregado só depois das migrações, pois os serviços acessam as tabelas
  const criarApp = require('./app');

  const servidor = criarApp().listen(config.port, () => {
    console.log(`EstacionamentoCBA rodando em http://0.0.0.0:${config.port} (fuso ${config.tz})`);
  });

  const encerrar = () => {
    servidor.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

iniciar().catch((e) => {
  console.error('Falha ao iniciar:', e);
  process.exit(1);
});
