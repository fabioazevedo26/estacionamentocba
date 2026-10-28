// Erro de regra de negócio: a mensagem é exibida ao usuário.
class ErroNegocio extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroNegocio';
  }
}

module.exports = { ErroNegocio };
