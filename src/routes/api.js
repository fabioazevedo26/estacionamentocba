// Endpoints JSON usados pela busca em tempo real das telas
const express = require('express');
const veiculos = require('../services/veiculos');
const pessoas = require('../services/pessoas');
const movimentacoes = require('../services/movimentacoes');
const placaUtil = require('../utils/placa');
const datas = require('../utils/datas');

const router = express.Router();

router.get('/busca', (req, res) => {
  const q = String(req.query.q || '').slice(0, 60);
  const placa = placaUtil.normalizar(q);
  const resultados = veiculos.buscaPortaria(q).map((v) => ({
    id: v.id,
    placa: placaUtil.formatar(v.placa),
    placa_classe: placaUtil.classe(v.placa),
    tipo: veiculos.TIPOS_ROTULO[v.tipo],
    marca_modelo: v.marca_modelo,
    cor: v.cor,
    status: v.status,
    proprietario: v.proprietario_nome,
    dentro: Boolean(v.mov_id),
    motorista: v.motorista_nome,
    entrada: v.entrada_em ? datas.fmtDataHora(v.entrada_em) : null,
  }));
  // Indica se o texto digitado pode ser uma placa nova (para oferecer o cadastro rápido)
  const placaExiste = placa ? Boolean(veiculos.buscarPorPlaca(placa)) : false;
  res.json({
    resultados,
    placa,
    placaFormatada: placaUtil.formatar(placa),
    placaValida: placaUtil.valida(placa),
    placaExiste,
  });
});

router.get('/veiculos/:id', (req, res) => {
  const v = veiculos.buscar(parseInt(req.params.id, 10));
  if (!v || v.status === 'INATIVO') return res.status(404).json({ erro: 'Veículo não encontrado.' });
  const aberta = movimentacoes.emAberto(v.id);
  res.json({
    id: v.id,
    placa: placaUtil.formatar(v.placa),
    placa_classe: placaUtil.classe(v.placa),
    tipo: veiculos.TIPOS_ROTULO[v.tipo],
    marca_modelo: v.marca_modelo,
    cor: v.cor,
    status: v.status,
    motivo_bloqueio: v.motivo_bloqueio,
    observacao: v.observacao,
    proprietario: v.proprietario_id ? {
      id: v.proprietario_id,
      nome: v.proprietario_nome,
      tipo: v.proprietario_tipo,
      cargo: v.proprietario_cargo,
      setor: v.proprietario_setor,
      empresa: v.proprietario_empresa,
      status: v.proprietario_status,
      motivo_bloqueio: v.proprietario_motivo,
    } : null,
    movimentacao: aberta ? {
      id: aberta.id,
      entrada: datas.fmtDataHora(aberta.entrada_em),
      permanencia: datas.fmtPermanencia(datas.minutosEntre(aberta.entrada_em)),
      motorista: aberta.motorista_nome,
      motorista_status: aberta.motorista_status,
    } : null,
    agora: datas.paraInputDataHora(datas.agora()),
  });
});

router.get('/pessoas', (req, res) => {
  res.json(pessoas.buscaRapida(String(req.query.q || '').slice(0, 60)));
});

module.exports = router;
