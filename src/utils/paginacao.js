const POR_PAGINA = 25;

// Calcula limite/offset e as informações usadas pela partial de paginação.
function paginar(query, total, porPagina = POR_PAGINA) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(paginas, Math.max(1, parseInt(query.pagina, 10) || 1));
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (k !== 'pagina' && v !== undefined && v !== '') params.append(k, v);
  }
  const base = params.toString();
  return {
    pagina,
    paginas,
    total,
    limite: porPagina,
    offset: (pagina - 1) * porPagina,
    url: (n) => `?${base ? `${base}&` : ''}pagina=${n}`,
  };
}

module.exports = { paginar, POR_PAGINA };
