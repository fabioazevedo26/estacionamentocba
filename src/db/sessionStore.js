// Store do express-session gravado na tabela "sessoes" do próprio SQLite.
const session = require('express-session');

const UM_DIA = 24 * 60 * 60 * 1000;

class SqliteStore extends session.Store {
  constructor(db) {
    super();
    this.stmts = {
      get: db.prepare('SELECT sess FROM sessoes WHERE sid = ? AND expira > ?'),
      set: db.prepare(`INSERT INTO sessoes (sid, sess, expira) VALUES (?, ?, ?)
                       ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expira = excluded.expira`),
      destroy: db.prepare('DELETE FROM sessoes WHERE sid = ?'),
      touch: db.prepare('UPDATE sessoes SET expira = ? WHERE sid = ?'),
      limpar: db.prepare('DELETE FROM sessoes WHERE expira <= ?'),
    };
    // Remove sessões expiradas a cada hora
    this.timer = setInterval(() => this.stmts.limpar.run(Date.now()), 60 * 60 * 1000);
    this.timer.unref();
  }

  expiracao(sess) {
    const exp = sess?.cookie?.expires;
    return exp ? new Date(exp).getTime() : Date.now() + UM_DIA;
  }

  get(sid, cb) {
    try {
      const linha = this.stmts.get.get(sid, Date.now());
      cb(null, linha ? JSON.parse(linha.sess) : null);
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb) {
    try {
      this.stmts.set.run(sid, JSON.stringify(sess), this.expiracao(sess));
      cb?.(null);
    } catch (e) { cb?.(e); }
  }

  destroy(sid, cb) {
    try {
      this.stmts.destroy.run(sid);
      cb?.(null);
    } catch (e) { cb?.(e); }
  }

  touch(sid, sess, cb) {
    try {
      this.stmts.touch.run(this.expiracao(sess), sid);
      cb?.(null);
    } catch (e) { cb?.(e); }
  }
}

module.exports = SqliteStore;
