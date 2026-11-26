const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

export function formatCurrency(value) {
  return brlFormatter.format(Number(value) || 0);
}

export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const parts = String(isoDate).slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatMonthLabel(yyyyMm) {
  if (!yyyyMm) return '';
  const [y, m] = yyyyMm.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = Number(m) - 1;
  return `${months[idx] || m}/${y.slice(2)}`;
}

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getPeriodRange(preset) {
  const now = new Date();
  const end = todayIso();
  const start = new Date(now);

  if (preset === 'this_month') {
    start.setDate(1);
  } else if (preset === 'last_3_months') {
    start.setDate(1);
    start.setMonth(start.getMonth() - 2);
  } else if (preset === 'last_6_months') {
    start.setDate(1);
    start.setMonth(start.getMonth() - 5);
  } else {
    return { startDate: '', endDate: '' };
  }

  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return { startDate: `${y}-${m}-${day}`, endDate: end };
}

export const REASON_LABELS = {
  producao_tiragem: 'Produção / Tiragem',
  venda: 'Venda',
  devolucao: 'Devolução',
  avaria_quebra: 'Avaria / Quebra',
  brinde_parceria: 'Brinde / Parceria',
  ajuste_inventario: 'Ajuste de Inventário'
};
