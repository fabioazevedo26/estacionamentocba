// Operações de status compartilhadas por pessoas e veículos:
// bloquear, desbloquear, inativar e reativar (sempre auditadas).
const db = require('../db');
const auditoria = require('./auditoria');
const { agora } = require('../utils/datas');
const { ErroNegocio } = require('../utils/erros');

const TABELAS = { PESSOA: 'pessoas', VEICULO: 'veiculos' };

function alterarStatus(entidade, id, operacao, motivo, usuario) {
  const tabela = TABELAS[entidade];
  return db.transaction(() => {
    const antes = db.prepare(`SELECT status, motivo_bloqueio FROM ${tabela} WHERE id = ?`).get(id);
    if (!antes) throw new ErroNegocio('Registro não encontrado.');

    let novo;
    let acao;
    switch (operacao) {
      case 'bloquear':
        motivo = String(motivo || '').trim();
        if (!motivo) throw new ErroNegocio('Informe o motivo do bloqueio.');
        novo = { status: 'BLOQUEADO', motivo_bloqueio: motivo };
        acao = 'BLOQUEAR';
        break;
      case 'desbloquear':
        if (antes.status !== 'BLOQUEADO') throw new ErroNegocio('O registro não está bloqueado.');
        novo = { status: 'ATIVO', motivo_bloqueio: null };
        acao = 'DESBLOQUEAR';
        break;
      case 'inativar':
        novo = { status: 'INATIVO', motivo_bloqueio: null };
        acao = 'INATIVAR';
        break;
      case 'reativar':
        if (antes.status !== 'INATIVO') throw new ErroNegocio('O registro não está inativo.');
        novo = { status: 'ATIVO', motivo_bloqueio: null };
        acao = 'EDITAR';
        break;
      default:
        throw new ErroNegocio('Operação inválida.');
    }

    db.prepare(`UPDATE ${tabela} SET status = ?, motivo_bloqueio = ?, atualizado_em = ? WHERE id = ?`)
      .run(novo.status, novo.motivo_bloqueio, agora(), id);
    auditoria.registrar({ usuario, acao, entidade, entidadeId: id, antes, depois: novo });
  })();
}

module.exports = { alterarStatus };
