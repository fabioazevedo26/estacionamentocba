const { ErroNegocio } = require('./erros');

const PADRAO_ANTIGO = /^[A-Z]{3}\d{4}$/;
const PADRAO_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

// Maiúsculas, sem hífen, espaços ou outros símbolos
const normalizar = (placa) => String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const valida = (placa) => PADRAO_ANTIGO.test(placa) || PADRAO_MERCOSUL.test(placa);

// ABC1234 -> ABC-1234; Mercosul e fora do padrão ficam como estão
const formatar = (placa) => (PADRAO_ANTIGO.test(placa || '') ? `${placa.slice(0, 3)}-${placa.slice(3)}` : (placa || ''));

// Classe CSS do visual da placa: Mercosul (faixa azul), antiga (cinza) ou especial
function classe(placa) {
  if (PADRAO_MERCOSUL.test(placa || '')) return 'placa-mercosul';
  if (PADRAO_ANTIGO.test(placa || '')) return 'placa-antiga';
  return 'placa-especial';
}

// Normaliza e valida; lança erro com mensagem amigável
function validar(placa, foraPadrao) {
  const p = normalizar(placa);
  if (!p) throw new ErroNegocio('Informe a placa.');
  if (p.length > 10) throw new ErroNegocio('Placa muito longa (máximo de 10 caracteres).');
  if (!foraPadrao && !valida(p)) {
    throw new ErroNegocio(`Placa "${p}" inválida. Use o padrão ABC1234 ou Mercosul ABC1D23, `
      + 'ou marque "placa fora do padrão".');
  }
  return p;
}

module.exports = { normalizar, valida, formatar, classe, validar };
