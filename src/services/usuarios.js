const bcrypt = require('bcrypt');
const db = require('../db');
const { agora } = require('../utils/datas');
const { ErroNegocio } = require('../utils/erros');

const CUSTO = 12;
// Usado quando o usuário não existe, para o tempo de resposta ser o mesmo
const HASH_FALSO = bcrypt.hashSync('usuario-inexistente', CUSTO);

async function criarAdminInicial(usuario, senha) {
  const total = db.prepare('SELECT COUNT(*) FROM usuarios').pluck().get();
  if (total > 0) return false;
  if (!senha) {
    console.warn('[usuários] Nenhum usuário cadastrado e ADMIN_PASSWORD vazio: defina-o no .env e reinicie.');
    return false;
  }
  const hash = await bcrypt.hash(senha, CUSTO);
  db.prepare('INSERT INTO usuarios (usuario, senha_hash, criado_em) VALUES (?, ?, ?)').run(usuario, hash, agora());
  console.log(`[usuários] Usuário inicial "${usuario}" criado.`);
  return true;
}

async function autenticar(usuario, senha) {
  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(String(usuario || '').trim());
  const ok = await bcrypt.compare(String(senha || ''), u?.senha_hash || HASH_FALSO);
  return u && ok ? { id: u.id, usuario: u.usuario } : null;
}

async function trocarSenha(id, atual, nova, confirmacao) {
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!u || !(await bcrypt.compare(String(atual || ''), u.senha_hash))) {
    throw new ErroNegocio('Senha atual incorreta.');
  }
  if (String(nova || '').length < 8) throw new ErroNegocio('A nova senha deve ter pelo menos 8 caracteres.');
  if (nova !== confirmacao) throw new ErroNegocio('A confirmação não confere com a nova senha.');
  const hash = await bcrypt.hash(nova, CUSTO);
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, id);
}

module.exports = { criarAdminInicial, autenticar, trocarSenha };
