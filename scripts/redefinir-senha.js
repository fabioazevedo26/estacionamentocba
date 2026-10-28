// Redefine a senha de um usuário pela linha de comando (para senha esquecida).
// Uso: node scripts/redefinir-senha.js <usuario> <nova-senha>
// No Docker: docker compose exec estacionamento node scripts/redefinir-senha.js Portaria2 'NovaSenha'
require('../src/config');
const bcrypt = require('bcrypt');
const db = require('../src/db');
const migrar = require('../src/db/migrate');
const { agora } = require('../src/utils/datas');

const [usuario, senha] = process.argv.slice(2);
if (!usuario || !senha) {
  console.error('Uso: node scripts/redefinir-senha.js <usuario> <nova-senha>');
  process.exit(1);
}
if (senha.length < 8) {
  console.error('A senha deve ter pelo menos 8 caracteres.');
  process.exit(1);
}

migrar(db);
const hash = bcrypt.hashSync(senha, 12);
const existe = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario);
if (existe) {
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, existe.id);
  console.log(`Senha do usuário "${usuario}" redefinida.`);
} else {
  db.prepare('INSERT INTO usuarios (usuario, senha_hash, criado_em) VALUES (?, ?, ?)').run(usuario, hash, agora());
  console.log(`Usuário "${usuario}" criado.`);
}
// Encerra as sessões abertas para valer a nova senha
db.prepare('DELETE FROM sessoes').run();
