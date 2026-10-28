// Dados de exemplo para testes. Executado SOMENTE manualmente: npm run seed
// Não roda se já houver pessoas cadastradas (a não ser com --forcar).
require('../src/config');
const db = require('../src/db');
const migrar = require('../src/db/migrate');
const datas = require('../src/utils/datas');

migrar(db);

const pessoas = require('../src/services/pessoas');
const veiculos = require('../src/services/veiculos');
const movimentacoes = require('../src/services/movimentacoes');

const forcar = process.argv.includes('--forcar');
const existentes = db.prepare('SELECT COUNT(*) FROM pessoas').pluck().get();
if (existentes > 0 && !forcar) {
  console.log(`Já existem ${existentes} pessoas cadastradas; seed ignorado. Use "npm run seed -- --forcar" para inserir mesmo assim.`);
  process.exit(0);
}

const USUARIO = 'seed';

const P = [
  { nome: 'Maria da Silva Souza', tipo: 'COLABORADOR', cargo: 'Servidor', setor: 'Administração' },
  { nome: 'João Pereira Lima', tipo: 'COLABORADOR', cargo: 'Pesquisador', setor: 'Laboratório' },
  { nome: 'Ana Beatriz Costa', tipo: 'COLABORADOR', cargo: 'Bolsista', setor: 'Laboratório' },
  { nome: 'Carlos Eduardo Ramos', tipo: 'COLABORADOR', cargo: 'Terceirizado', setor: 'Limpeza', empresa: 'Limpa Bem Ltda' },
  { nome: 'Fernanda Alves', tipo: 'COLABORADOR', cargo: 'Estagiário', setor: 'TI' },
  { nome: 'José Ribamar Nogueira', tipo: 'COLABORADOR', cargo: 'Servidor', setor: 'Manutenção' },
  { nome: 'Roberto Fornecedor', tipo: 'VISITANTE', cargo: 'Fornecedor', empresa: 'Distribuidora Amazonas' },
  { nome: 'Patrícia Gomes', tipo: 'VISITANTE', cargo: 'Visitante', empresa: 'Universidade Federal' },
  { nome: 'Marcos Transportes', tipo: 'VISITANTE', cargo: 'Prestador de serviço', empresa: 'Rodo Norte Transportes' },
];

const V = [
  { placa: 'ABC1234', tipo: 'CARRO', marca_modelo: 'Fiat Strada', cor: 'Branca', dono: 0 },
  { placa: 'QWE1R23', tipo: 'CARRO', marca_modelo: 'VW Gol', cor: 'Prata', dono: 1 },
  { placa: 'JKL4567', tipo: 'MOTO', marca_modelo: 'Honda CG 160', cor: 'Vermelha', dono: 2 },
  { placa: 'MNO7P89', tipo: 'CARRO', marca_modelo: 'Toyota Corolla', cor: 'Preta', dono: 1 },
  { placa: 'RST2U34', tipo: 'VAN', marca_modelo: 'Renault Master', cor: 'Branca', dono: 3 },
  { placa: 'XYZ9876', tipo: 'CAMINHAO', marca_modelo: 'Mercedes Accelo', cor: 'Azul', dono: 6 },
  { placa: 'CARRETA01', placa_fora_padrao: 'on', tipo: 'CARRETA', marca_modelo: 'Randon', cor: 'Cinza', dono: 8 },
  { placa: 'HJK5L67', tipo: 'CARRO', marca_modelo: 'Hyundai HB20', cor: 'Cinza', dono: 4 },
  { placa: 'BCD2E45', tipo: 'CARRO', marca_modelo: 'Chevrolet Onix', cor: 'Branca', dono: 7 },
];

db.transaction(() => {
  const idsPessoas = P.map((p) => pessoas.criar(p, USUARIO));
  const idsVeiculos = V.map((v) => veiculos.criar({ ...v, proprietario_id: idsPessoas[v.dono] }, USUARIO));

  // Movimentações dos últimos 10 dias (todas encerradas)
  const hoje = datas.hoje();
  for (let d = 10; d >= 1; d--) {
    const dia = datas.somarDias(hoje, -d);
    if (datas.dataLocal(dia).getDay() === 0) continue; // domingo
    V.forEach((v, i) => {
      if ((i + d) % 3 === 0) return;
      const he = 7 + ((i * 7 + d) % 4);
      const hs = 12 + ((i * 5 + d) % 6);
      const p2 = (n) => String(n).padStart(2, '0');
      db.prepare(`INSERT INTO movimentacoes (veiculo_id, motorista_id, entrada_em, saida_em, criado_em)
                  VALUES (?, ?, ?, ?, ?)`).run(idsVeiculos[i], idsPessoas[v.dono],
        `${dia} ${p2(he)}:${p2((i * 13) % 60)}:00`, `${dia} ${p2(hs)}:${p2((i * 17) % 60)}:00`, datas.agora());
    });
  }

  // Alguns veículos no pátio agora (um deles esquecido desde ontem)
  db.prepare(`INSERT INTO movimentacoes (veiculo_id, motorista_id, entrada_em, criado_em) VALUES (?, ?, ?, ?)`)
    .run(idsVeiculos[5], idsPessoas[6], `${datas.somarDias(hoje, -1)} 15:20:00`, datas.agora());
  const umaHoraAtras = datas.paraBanco(new Date(Date.now() - 60 * 60 * 1000));
  movimentacoes.registrarEntrada({ veiculoId: idsVeiculos[0], motoristaId: idsPessoas[0], entradaEm: umaHoraAtras.replace(' ', 'T') }, USUARIO);
  movimentacoes.registrarEntrada({ veiculoId: idsVeiculos[3], motoristaId: idsPessoas[2], entradaEm: '' }, USUARIO);

  // Exemplos de bloqueio
  pessoas.mudarStatus(idsPessoas[5], 'bloquear', 'Crachá vencido — procurar a Segurança', USUARIO);
  veiculos.mudarStatus(idsVeiculos[8], 'bloquear', 'Veículo envolvido em ocorrência — aguardar liberação da Diretoria', USUARIO);
})();

console.log(`Seed concluído: ${P.length} pessoas, ${V.length} veículos e movimentações de exemplo.`);
