const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const config = require('./config');
const db = require('./db');
const SqliteStore = require('./db/sessionStore');
const csrf = require('./middleware/csrf');
const flash = require('./middleware/flash');
const locals = require('./middleware/locals');
const { exigirLogin } = require('./middleware/auth');
const { ErroNegocio } = require('./utils/erros');

function criarApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.disable('x-powered-by');

  // Sistema acessado por HTTP na rede local: sem HSTS nem upgrade para HTTPS
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    strictTransportSecurity: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
  }));

  app.use(express.static(path.join(config.raiz, 'public'), { maxAge: config.producao ? '7d' : 0 }));

  app.get('/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  let segredo = config.sessionSecret;
  if (!segredo) {
    segredo = crypto.randomBytes(32).toString('hex');
    console.warn('[sessão] SESSION_SECRET não definido: usando um valor temporário (logins caem ao reiniciar).');
  }
  app.use(session({
    name: 'estacionamento.sid',
    store: new SqliteStore(db),
    secret: segredo,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 12 * 60 * 60 * 1000 },
  }));

  app.use(flash);
  app.use(locals);
  app.use(csrf);

  app.use(require('./routes/auth'));
  app.use(exigirLogin);
  app.use('/api', require('./routes/api'));
  app.use('/', require('./routes/portaria'));
  app.use('/patio', require('./routes/patio'));
  app.use('/pessoas', require('./routes/pessoas'));
  app.use('/veiculos', require('./routes/veiculos'));
  app.use('/movimentacoes', require('./routes/movimentacoes'));
  app.use('/relatorios', require('./routes/relatorios'));
  app.use('/auditoria', require('./routes/auditoria'));
  app.use('/backup', require('./routes/backup'));

  app.use((req, res) => {
    res.status(404).render('erro', { titulo: 'Página não encontrada', mensagem: 'A página solicitada não existe.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ErroNegocio) {
      return res.status(400).render('erro', { titulo: 'Não foi possível concluir', mensagem: err.message });
    }
    console.error(err);
    if (res.headersSent) return;
    res.status(err.status || 500);
    if (req.path.startsWith('/api/')) return res.json({ erro: 'Erro interno no servidor.' });
    res.render('erro', {
      titulo: 'Erro',
      mensagem: 'Ocorreu um erro inesperado. Tente novamente; se continuar, avise o responsável pelo sistema.',
    });
  });

  return app;
}

module.exports = criarApp;
