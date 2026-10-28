// Variáveis e funções auxiliares disponíveis em todas as views
const config = require('../config');
const datas = require('../utils/datas');
const placaUtil = require('../utils/placa');
const movimentacoes = require('../services/movimentacoes');
const { TIPOS_ROTULO } = require('../services/veiculos');

const ROTULOS = {
  COLABORADOR: 'Colaborador', VISITANTE: 'Visitante',
  ATIVO: 'Ativo', BLOQUEADO: 'Bloqueado', INATIVO: 'Inativo',
  ...TIPOS_ROTULO,
};

const COR_STATUS = { ATIVO: 'success', BLOQUEADO: 'danger', INATIVO: 'secondary' };
const CHIP_STATUS = {
  ATIVO: ['chip-ok', 'bi-check-circle-fill'],
  BLOQUEADO: ['chip-bloq', 'bi-lock-fill'],
  INATIVO: ['chip-neutro', 'bi-archive'],
};

const helpers = {
  ...datas,
  placa: placaUtil.formatar,
  rotulo: (v) => ROTULOS[v] || v || '',
  corStatus: (s) => COR_STATUS[s] || 'secondary',
  placaClasse: placaUtil.classe,
  // Status com ícone + texto (nunca só cor). Retorna HTML: usar com <%- %>
  statusChip: (s) => {
    const [cls, icone] = CHIP_STATUS[s] || CHIP_STATUS.INATIVO;
    return `<span class="chip ${cls}"><i class="bi ${icone}" aria-hidden="true"></i>${ROTULOS[s] || s}</span>`;
  },
  horaFimDia: config.horaFimDia,
  tz: config.tz,
};

function locals(req, res, next) {
  Object.assign(res.locals, helpers);
  res.locals.usuario = req.session.usuario || null;
  res.locals.caminho = req.path;
  res.locals.titulo = '';
  res.locals.patioCount = req.session.usuario ? movimentacoes.contarPatio() : 0;
  next();
}

module.exports = locals;
