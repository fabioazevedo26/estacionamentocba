const ExcelJS = require('exceljs');
const placaUtil = require('../utils/placa');
const datas = require('../utils/datas');
const { TIPOS_ROTULO } = require('./veiculos');

const COR_CABECALHO = 'FF1F4E79';
const TIPO_PESSOA = { COLABORADOR: 'Colaborador', VISITANTE: 'Visitante' };

// O Excel não tem fuso: gravamos a data/hora "de parede" como se fosse UTC,
// para que a célula mostre exatamente o horário de Manaus registrado.
function paraExcel(valor) {
  if (!valor) return null;
  const [d, h = '00:00:00'] = valor.split(' ');
  const [a, m, dia] = d.split('-').map(Number);
  const [hh, mm, ss] = h.split(':').map(Number);
  return new Date(Date.UTC(a, m - 1, dia, hh, mm, ss || 0));
}

const soData = (valor) => paraExcel(valor.slice(0, 10));
const duracao = (minutos) => (minutos == null ? null : minutos / 1440);

function estilizarCabecalho(linha) {
  linha.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  linha.alignment = { vertical: 'middle' };
  linha.height = 20;
  linha.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_CABECALHO } };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
  });
}

function ajustarLarguras(planilha, minimo = 8, maximo = 50) {
  planilha.columns.forEach((col) => {
    let maior = minimo;
    col.eachCell({ includeEmpty: false }, (c) => {
      let tam;
      if (c.value instanceof Date) tam = (c.numFmt || '').length + 1;
      else tam = String(c.value ?? '').length;
      maior = Math.max(maior, tam + 2);
    });
    col.width = Math.min(maximo, maior);
  });
}

async function gerarRelatorio({ de, ate, linhas, totais, porDia, porTipo }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EstacionamentoCBA';
  wb.created = new Date();

  // ---- Aba 1: movimentações ----
  const ws = wb.addWorksheet('Movimentações', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Data', key: 'data', style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Entrada', key: 'entrada', style: { numFmt: 'hh:mm' } },
    { header: 'Saída', key: 'saida', style: { numFmt: 'hh:mm' } },
    { header: 'Permanência (hh:mm)', key: 'permanencia', style: { numFmt: '[hh]:mm' } },
    { header: 'Motorista', key: 'motorista' },
    { header: 'Tipo de pessoa', key: 'tipo_pessoa' },
    { header: 'Cargo', key: 'cargo' },
    { header: 'Setor', key: 'setor' },
    { header: 'Empresa', key: 'empresa' },
    { header: 'Placa', key: 'placa' },
    { header: 'Tipo de veículo', key: 'tipo_veiculo' },
    { header: 'Marca/Modelo', key: 'marca_modelo' },
    { header: 'Cor', key: 'cor' },
    { header: 'Proprietário', key: 'proprietario' },
    { header: 'Observação', key: 'observacao' },
  ];
  estilizarCabecalho(ws.getRow(1));

  for (const l of linhas) {
    const row = ws.addRow({
      data: soData(l.entrada_em),
      entrada: paraExcel(l.entrada_em),
      saida: paraExcel(l.saida_em),
      permanencia: duracao(l.minutos),
      motorista: l.motorista_nome,
      tipo_pessoa: TIPO_PESSOA[l.motorista_tipo] || l.motorista_tipo,
      cargo: l.cargo,
      setor: l.setor,
      empresa: l.empresa,
      placa: placaUtil.formatar(l.placa),
      tipo_veiculo: TIPOS_ROTULO[l.veiculo_tipo] || l.veiculo_tipo,
      marca_modelo: l.marca_modelo,
      cor: l.cor,
      proprietario: l.proprietario_nome,
      observacao: l.observacao,
    });
    // Saída em outro dia: mostra também a data para não confundir
    if (l.saida_em && l.saida_em.slice(0, 10) !== l.entrada_em.slice(0, 10)) {
      row.getCell('saida').numFmt = 'dd/mm/yyyy hh:mm';
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  ajustarLarguras(ws);

  // ---- Aba 2: resumo ----
  const rs = wb.addWorksheet('Resumo');
  rs.addRow([`Relatório de estacionamento — ${datas.fmtData(de)} a ${datas.fmtData(ate)}`]).font = { bold: true, size: 14 };
  rs.addRow([]);
  rs.addRow(['Total de entradas', totais.entradas]);
  rs.addRow(['Veículos distintos', totais.veiculos]);
  rs.addRow(['Sem saída registrada', totais.sem_saida || 0]);
  const media = rs.addRow(['Permanência média (hh:mm)', duracao(totais.media_minutos)]);
  media.getCell(2).numFmt = '[hh]:mm';
  for (let i = 3; i <= 6; i++) rs.getCell(`A${i}`).font = { bold: true };
  rs.addRow([]);

  rs.addRow(['Totais por dia']).font = { bold: true, size: 12 };
  estilizarCabecalho(rs.addRow(['Data', 'Entradas', 'Veículos distintos', 'Permanência média (hh:mm)']));
  for (const d of porDia) {
    const row = rs.addRow([soData(d.dia), d.entradas, d.veiculos, duracao(d.media_minutos)]);
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(4).numFmt = '[hh]:mm';
  }
  rs.addRow([]);

  rs.addRow(['Totais por tipo de veículo']).font = { bold: true, size: 12 };
  estilizarCabecalho(rs.addRow(['Tipo de veículo', 'Entradas', 'Veículos distintos']));
  for (const t of porTipo) rs.addRow([TIPOS_ROTULO[t.tipo] || t.tipo, t.entradas, t.veiculos]);

  rs.getColumn(1).width = 30;
  rs.getColumn(2).width = 14;
  rs.getColumn(3).width = 20;
  rs.getColumn(4).width = 28;

  return wb.xlsx.writeBuffer();
}

// Relatório de pedestres (acessos a pé), com aba "Resumo" por dia
async function gerarRelatorioPedestres({ de, ate, linhas }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EstacionamentoCBA';
  wb.created = new Date();

  const ws = wb.addWorksheet('Pedestres', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Data', key: 'data', style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Entrada', key: 'entrada', style: { numFmt: 'hh:mm' } },
    { header: 'Saída', key: 'saida', style: { numFmt: 'hh:mm' } },
    { header: 'Permanência (hh:mm)', key: 'permanencia', style: { numFmt: '[hh]:mm' } },
    { header: 'Pessoa', key: 'pessoa' },
    { header: 'Tipo de pessoa', key: 'tipo_pessoa' },
    { header: 'Cargo', key: 'cargo' },
    { header: 'Setor', key: 'setor' },
    { header: 'Empresa', key: 'empresa' },
    { header: 'Observação', key: 'observacao' },
  ];
  estilizarCabecalho(ws.getRow(1));

  const porDia = new Map();
  for (const l of linhas) {
    const minutos = l.saida_em ? datas.minutosEntre(l.entrada_em, l.saida_em) : null;
    const row = ws.addRow({
      data: soData(l.entrada_em),
      entrada: paraExcel(l.entrada_em),
      saida: paraExcel(l.saida_em),
      permanencia: duracao(minutos),
      pessoa: l.pessoa_nome,
      tipo_pessoa: TIPO_PESSOA[l.pessoa_tipo] || l.pessoa_tipo,
      cargo: l.cargo,
      setor: l.setor,
      empresa: l.empresa,
      observacao: l.observacao,
    });
    if (l.saida_em && l.saida_em.slice(0, 10) !== l.entrada_em.slice(0, 10)) {
      row.getCell('saida').numFmt = 'dd/mm/yyyy hh:mm';
    }
    const dia = l.entrada_em.slice(0, 10);
    const d = porDia.get(dia) || { entradas: 0, pessoas: new Set(), semSaida: 0 };
    d.entradas++;
    d.pessoas.add(l.pessoa_id);
    if (!l.saida_em) d.semSaida++;
    porDia.set(dia, d);
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  ajustarLarguras(ws);

  const rs = wb.addWorksheet('Resumo');
  rs.addRow([`Pedestres — ${datas.fmtData(de)} a ${datas.fmtData(ate)}`]).font = { bold: true, size: 14 };
  rs.addRow([]);
  rs.addRow(['Total de entradas a pé', linhas.length]).getCell(1).font = { bold: true };
  rs.addRow(['Pessoas distintas', new Set(linhas.map((l) => l.pessoa_id)).size]).getCell(1).font = { bold: true };
  rs.addRow(['Sem saída registrada', linhas.filter((l) => !l.saida_em).length]).getCell(1).font = { bold: true };
  rs.addRow([]);
  rs.addRow(['Totais por dia']).font = { bold: true, size: 12 };
  estilizarCabecalho(rs.addRow(['Data', 'Entradas', 'Pessoas distintas', 'Sem saída']));
  for (const [dia, d] of porDia) {
    const row = rs.addRow([soData(dia), d.entradas, d.pessoas.size, d.semSaida]);
    row.getCell(1).numFmt = 'dd/mm/yyyy';
  }
  rs.getColumn(1).width = 30;
  rs.getColumn(2).width = 14;
  rs.getColumn(3).width = 20;
  rs.getColumn(4).width = 14;

  return wb.xlsx.writeBuffer();
}

module.exports = { gerarRelatorio, gerarRelatorioPedestres };
