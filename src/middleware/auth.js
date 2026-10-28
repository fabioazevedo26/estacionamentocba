// Exige usuário logado; requisições de API recebem 401 em vez de redirecionamento
function exigirLogin(req, res, next) {
  if (req.session.usuario) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  req.session.voltarPara = req.method === 'GET' ? req.originalUrl : '/';
  return res.redirect('/login');
}

module.exports = { exigirLogin };
