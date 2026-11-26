import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/Modal.jsx';
import { formatCurrency, formatDate, todayIso } from '../utils/formatters.js';

const CATEGORIES_BY_TYPE = {
  entrada: ['Venda de Produtos', 'Eventos/Feiras', 'Encomenda', 'Outros'],
  saida: [
    'Produção/Tiragem',
    'Repasse Artistas',
    'Embalagens/Suportes',
    'Fretes/Entregas',
    'Marketing',
    'Taxas',
    'Operacional'
  ]
};

const PAYMENT_METHODS = ['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Transferência'];

export function CashFlow({ onToast, onDataChanged }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    totalEntradas: 0,
    totalSaidas: 0,
    saldo: 0,
    pendenteEntradas: 0,
    pendenteSaidas: 0
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'entrada',
    category: 'Venda de Produtos',
    description: '',
    amount: '',
    payment_method: 'Pix',
    status: 'confirmado',
    transaction_date: todayIso(),
    notes: ''
  });

  const loadCashFlow = async () => {
    setLoading(true);
    try {
      const res = await api.getCashFlow({
        search,
        type: typeFilter,
        status: statusFilter,
        startDate,
        endDate
      });
      setItems(res.items || []);
      setSummary(res.summary || {});
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashFlow();
  }, [search, typeFilter, statusFilter, startDate, endDate]);

  const openCreate = (defaultType = 'entrada') => {
    setEditing(null);
    setForm({
      type: defaultType,
      category: CATEGORIES_BY_TYPE[defaultType][0],
      description: '',
      amount: '',
      payment_method: 'Pix',
      status: 'confirmado',
      transaction_date: todayIso(),
      notes: ''
    });
    setModalOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: String(entry.amount),
      payment_method: entry.payment_method,
      status: entry.status,
      transaction_date: entry.transaction_date,
      notes: entry.notes || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) {
        await api.updateCashFlow(editing.id, payload);
        onToast('Lançamento atualizado!');
      } else {
        await api.createCashFlow(payload);
        onToast('Lançamento registrado no fluxo de caixa!');
      }
      setModalOpen(false);
      await loadCashFlow();
      onDataChanged();
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (entry) => {
    const nextStatus = entry.status === 'confirmado' ? 'pendente' : 'confirmado';
    try {
      await api.updateCashFlow(entry.id, { status: nextStatus });
      onToast(`Status alterado para ${nextStatus}.`);
      await loadCashFlow();
      onDataChanged();
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Excluir lançamento "${entry.description}"?`)) return;
    try {
      await api.deleteCashFlow(entry.id);
      onToast('Lançamento excluído.');
      await loadCashFlow();
      onDataChanged();
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1B19]">Fluxo de Caixa</h1>
          <p className="text-sm text-[#6E695F]">
            Entradas de vendas, encomendas e saídas com produção, repasse a artistas e operação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openCreate('entrada')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F5C48] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#0B4738]"
          >
            <Plus className="h-4 w-4" />
            Nova Entrada
          </button>
          <button
            type="button"
            onClick={() => openCreate('saida')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#B8293D] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#991F30]"
          >
            <Plus className="h-4 w-4" />
            Nova Saída
          </button>
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Entradas Confirmadas</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#0F5C48]">
            {formatCurrency(summary.totalEntradas)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Saídas Confirmadas</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#B8293D]">
            {formatCurrency(summary.totalSaidas)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Saldo do Período</p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${
              summary.saldo >= 0 ? 'text-[#0F5C48]' : 'text-[#B8293D]'
            }`}
          >
            {formatCurrency(summary.saldo)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Pendentes (A Receber / Pagar)</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-[#8F6B1E]">
            +{formatCurrency(summary.pendenteEntradas)} / -{formatCurrency(summary.pendenteSaidas)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 rounded-2xl border border-[#E7E1D6] bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6E695F]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descrição, categoria..."
            className="w-full rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] py-2 pr-3 pl-9 text-sm focus:border-[#0F5C48] focus:outline-none"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
        >
          <option value="">Entradas e Saídas</option>
          <option value="entrada">Somente Entradas</option>
          <option value="saida">Somente Saídas</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="confirmado">Confirmado</option>
          <option value="pendente">Pendente</option>
        </select>

        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-1/2 rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-2 py-2 text-xs focus:border-[#0F5C48] focus:outline-none"
            title="Data inicial"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-1/2 rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-2 py-2 text-xs focus:border-[#0F5C48] focus:outline-none"
            title="Data final"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-[#E7E1D6] bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#EFEAE0] bg-[#FAF8F5] text-xs font-semibold uppercase tracking-wider text-[#6E695F]">
              <tr>
                <th className="px-4 py-3.5">Data</th>
                <th className="px-4 py-3.5">Descrição</th>
                <th className="px-4 py-3.5">Categoria</th>
                <th className="px-4 py-3.5">Pagamento</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Valor</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEAE0]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#6E695F]">
                    Carregando lançamentos...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#6E695F]">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF8F5]/70">
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-[#4C4840]">
                      {formatDate(c.transaction_date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {c.type === 'entrada' ? (
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-[#0F5C48]" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 shrink-0 text-[#B8293D]" />
                        )}
                        <div>
                          <p className="font-semibold text-[#1C1B19]">{c.description}</p>
                          {c.notes && <p className="text-xs text-[#6E695F]">{c.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-[#F3EFE6] px-2.5 py-0.5 text-xs font-medium text-[#1C1B19]">
                        {c.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#4C4840]">{c.payment_method}</td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleStatus(c)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.status === 'confirmado'
                            ? 'bg-[#0F5C48]/10 text-[#0F5C48]'
                            : 'bg-[#C89B3C]/20 text-[#7A5912]'
                        }`}
                        title="Clique para alternar status"
                      >
                        {c.status === 'confirmado' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        {c.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                      </button>
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-bold tabular-nums ${
                        c.type === 'entrada' ? 'text-[#0F5C48]' : 'text-[#B8293D]'
                      }`}
                    >
                      {c.type === 'entrada' ? '+' : '-'} {formatCurrency(c.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="rounded-lg p-1.5 text-[#6E695F] hover:bg-[#F3EFE6] hover:text-[#1C1B19]"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="rounded-lg p-1.5 text-[#6E695F] hover:bg-[#B8293D]/10 hover:text-[#B8293D]"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lançamento */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
        subtitle="Registre receitas ou despesas da TKL Store AM."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Tipo *</label>
              <select
                value={form.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setForm({
                    ...form,
                    type: nextType,
                    category: CATEGORIES_BY_TYPE[nextType][0]
                  });
                }}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                <option value="entrada">Entrada (Receita)</option>
                <option value="saida">Saída (Despesa)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Categoria *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                {(CATEGORIES_BY_TYPE[form.type] || []).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Descrição *</label>
            <input
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Repasse Lucio Dias, Embalagens kraft, Venda Direct..."
              className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm tabular-nums focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Pagamento</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                <option value="confirmado">Confirmado</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Data *</label>
              <input
                type="date"
                required
                value={form.transaction_date}
                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Observações</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Informações complementares..."
              className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-[#DFD8CA] px-4 py-2 text-sm font-semibold text-[#4C4840] hover:bg-[#FAF8F5]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#0F5C48] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0B4738] disabled:opacity-60"
            >
              {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Confirmar Lançamento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
