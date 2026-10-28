// Datas são gravadas como texto "AAAA-MM-DD HH:MM:SS" no fuso local do
// processo (TZ=America/Manaus), o que mantém a ordenação e as comparações
// em SQL simples e corretas.

const p2 = (n) => String(n).padStart(2, '0');

function paraBanco(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} `
    + `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

const agora = () => paraBanco(new Date());
const hoje = () => agora().slice(0, 10);

// "AAAA-MM-DD" -> Date local (meia-noite)
function dataLocal(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function isoData(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function somarDias(iso, dias) {
  const d = dataLocal(iso);
  d.setDate(d.getDate() + dias);
  return isoData(d);
}

// Valor de <input type="datetime-local"> ("AAAA-MM-DDTHH:MM") -> formato do banco.
// Retorna null se inválido.
function deInputDataHora(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(valor || '').trim());
  if (!m) return null;
  const [, a, mes, d, h, mi, s = '00'] = m;
  const dt = new Date(+a, +mes - 1, +d, +h, +mi, +s);
  if (dt.getFullYear() !== +a || dt.getMonth() !== +mes - 1 || dt.getDate() !== +d) return null;
  return `${a}-${mes}-${d} ${h}:${mi}:${s}`;
}

// Formato do banco -> valor para <input type="datetime-local">
const paraInputDataHora = (v) => (v ? v.slice(0, 16).replace(' ', 'T') : '');

function fmtData(v) {
  if (!v) return '';
  const [a, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

const fmtHora = (v) => (v ? v.slice(11, 16) : '');
const fmtDataHora = (v) => (v ? `${fmtData(v)} ${fmtHora(v)}` : '');

// Minutos entre dois valores do banco (fim padrão: agora)
function minutosEntre(inicio, fim) {
  const a = new Date(inicio.replace(' ', 'T'));
  const b = fim ? new Date(fim.replace(' ', 'T')) : new Date();
  return Math.max(0, Math.round((b - a) / 60000));
}

// 135 -> "02:15"; 1500 -> "25:00"
function fmtDuracao(minutos) {
  if (minutos == null || Number.isNaN(minutos)) return '';
  const m = Math.round(minutos);
  return `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
}

// Descrição amigável: "2 h 15 min", "1 d 3 h"
function fmtPermanencia(minutos) {
  const m = Math.round(minutos);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${p2(m % 60)} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

module.exports = {
  agora, hoje, paraBanco, dataLocal, isoData, somarDias, deInputDataHora, paraInputDataHora,
  fmtData, fmtHora, fmtDataHora, minutosEntre, fmtDuracao, fmtPermanencia,
};
