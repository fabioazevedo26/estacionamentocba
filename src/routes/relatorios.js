const express = require('express');
const relatorios = require('../services/relatorios');
const excel = require('../services/excel');
const opcoes = require('../services/opcoes');
const pessoas = require('../services/pessoas');
const veiculos = require('../services/veiculos');

const router = express.Router();

const LIMITE_TELA = 500;

const CAMPOS = ['periodo', 'mes', 'de', 'ate', 'motorista_id', 'placa', 'tipo_pessoa', 'tipo_veiculo',
  'cargo', 'setor', 'empresa', 'sem_saida'];

function lerFiltros(query) {
  const f = Object.fromEntries(CAMPOS.map((c) => [c, typeof query[c] === 'string' ? query[c] : '']));
  if (!f.periodo) f.periodo = 'hoje';
  return f;
}

router.get('/', (req, res) => {
  const f = lerFiltros(req.query);
  const resultado = relatorios.gerar(f, { limite: LIMITE_TELA });
  const motorista = parseInt(f.motorista_id, 10) ? pessoas.buscar(parseInt(f.motorista_id, 10)) : null;
  res.render('relatorios/index', {
    titulo: 'Relatórios',
    f,
    r: resultado,
    limiteTela: LIMITE_TELA,
    motoristaNome: motorista?.nome || '',
    periodos: relatorios.PERIODOS,
    cargos: opcoes.listar('CARGO'),
    setores: opcoes.listar('SETOR'),
    tiposVeiculo: veiculos.TIPOS,
    exportarUrl: `/relatorios/exportar?${new URLSearchParams(f)}`,
  });
});

router.get('/exportar', async (req, res) => {
  const resultado = relatorios.gerar(lerFiltros(req.query));
  const buffer = await excel.gerarRelatorio(resultado);
  const nome = `estacionamento_${resultado.de}_a_${resultado.ate}.xlsx`;
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${nome}"`,
  });
  res.send(Buffer.from(buffer));
});

module.exports = router;
