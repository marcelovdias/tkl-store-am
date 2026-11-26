import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/Modal.jsx';
import { formatCurrency, formatDate, REASON_LABELS, todayIso } from '../utils/formatters.js';

const REASONS_BY_TYPE = {
  entrada: [
    { value: 'producao_tiragem', label: 'Produção / Nova Tiragem' },
    { value: 'devolucao', label: 'Devolução de Cliente' }
  ],
  saida: [
    { value: 'venda', label: 'Venda' },
    { value: 'brinde_parceria', label: 'Brinde / Parceria' },
    { value: 'avaria_quebra', label: 'Avaria / Quebra' }
  ],
  ajuste: [{ value: 'ajuste_inventario', label: 'Ajuste de Inventário' }]
};

const CHANNELS = ['Instagram Direct', 'Linktree/WhatsApp', 'Feira/Evento', 'Ateliê', 'Outro'];
const PAYMENT_METHODS = ['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Transferência'];

export function StockMovements({ onToast, onDataChanged, refreshKey = 0 }) {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    type: 'saida',
    reason: 'venda',
    quantity: '1',
    unit_price: '',
    channel: 'Instagram Direct',
    moved_by: localStorage.getItem('tkl_last_operator') || 'Equipe TKL',
    movement_date: todayIso(),
    notes: '',
    syncCashFlow: true,
    payment_method: 'Pix',
    cash_status: 'confirmado'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [moveRes, prodRes] = await Promise.all([
        api.getStockMovements({
          search,
          type: typeFilter,
          product_id: productFilter
        }),
        api.getProducts({ status: 'ativo' })
      ]);
      setMovements(moveRes.items || []);
      setProducts(prodRes.items || []);
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, typeFilter, productFilter, refreshKey]);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form.product_id)),
    [products, form.product_id]
  );

  const openModal = () => {
    const first = products[0];
    setForm({
      product_id: first ? String(first.id) : '',
      type: 'saida',
      reason: 'venda',
      quantity: '1',
      unit_price: first ? String(first.sale_price) : '0',
      channel: 'Instagram Direct',
      moved_by: localStorage.getItem('tkl_last_operator') || 'Equipe TKL',
      movement_date: todayIso(),
      notes: '',
      syncCashFlow: true,
      payment_method: 'Pix',
      cash_status: 'confirmado'
    });
    setModalOpen(true);
  };

  const handleTypeOrReasonChange = (nextType, nextReason) => {
    const product = products.find((p) => String(p.id) === String(form.product_id));
    let autoPrice = form.unit_price;
    if (product) {
      autoPrice =
        nextReason === 'venda' || nextReason === 'devolucao'
          ? String(product.sale_price)
          : String(product.cost_price);
    }
    const autoSync = nextReason === 'venda' || nextReason === 'producao_tiragem';
    setForm((prev) => ({
      ...prev,
      type: nextType,
      reason: nextReason,
      unit_price: autoPrice,
      syncCashFlow: autoSync
    }));
  };

  const handleProductChange = (prodId) => {
    const product = products.find((p) => String(p.id) === String(prodId));
    let autoPrice = '';
    if (product) {
      autoPrice =
        form.reason === 'venda' || form.reason === 'devolucao'
          ? String(product.sale_price)
          : String(product.cost_price);
    }
    setForm((prev) => ({ ...prev, product_id: prodId, unit_price: autoPrice }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.moved_by?.trim()) {
        localStorage.setItem('tkl_last_operator', form.moved_by.trim());
      }
      const res = await api.createStockMovement({
        ...form,
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        unit_price: Number(form.unit_price) || 0
      });
      onToast(
        res.cashFlowEntry
          ? 'Movimentação registrada e lançada no Fluxo de Caixa!'
          : 'Movimentação de estoque registrada!'
      );
      setModalOpen(false);
      await loadData();
      onDataChanged();
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    return movements.reduce(
      (acc, m) => {
        if (m.type === 'entrada') acc.entradas += m.quantity;
        else if (m.type === 'saida') acc.saidas += m.quantity;
        else acc.ajustes += 1;
        return acc;
      },
      { entradas: 0, saidas: 0, ajustes: 0 }
    );
  }, [movements]);

  const canOfferCashSync =
    (form.type === 'saida' && form.reason === 'venda') ||
    (form.type === 'entrada' && form.reason === 'producao_tiragem');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1B19]">
            Movimentação de Estoque
          </h1>
          <p className="text-sm text-[#6E695F]">
            Controle de entradas de tiragem, vendas por canal, avarias e ajustes.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          disabled={products.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0F5C48] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#0B4738] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Nova Movimentação
        </button>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <div className="rounded-xl bg-[#0F5C48]/10 p-2.5 text-[#0F5C48]">
            <ArrowDownToLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[#6E695F]">Entradas (peças)</p>
            <p className="text-xl font-bold tabular-nums text-[#1C1B19]">{totals.entradas} un.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <div className="rounded-xl bg-[#B8293D]/10 p-2.5 text-[#B8293D]">
            <ArrowUpFromLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[#6E695F]">Saídas (peças)</p>
            <p className="text-xl font-bold tabular-nums text-[#1C1B19]">{totals.saidas} un.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <div className="rounded-xl bg-[#C89B3C]/15 p-2.5 text-[#8F6B1E]">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[#6E695F]">Ajustes de Inventário</p>
            <p className="text-xl font-bold tabular-nums text-[#1C1B19]">{totals.ajustes}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 rounded-2xl border border-[#E7E1D6] bg-white p-4 shadow-xs sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6E695F]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar peça, responsável, canal ou observação..."
            className="w-full rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] py-2 pr-3 pl-9 text-sm focus:border-[#0F5C48] focus:outline-none"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
          <option value="ajuste">Ajustes</option>
        </select>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
        >
          <option value="">Todas as peças</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-[#E7E1D6] bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#EFEAE0] bg-[#FAF8F5] text-xs font-semibold uppercase tracking-wider text-[#6E695F]">
              <tr>
                <th className="px-4 py-3.5">Data</th>
                <th className="px-4 py-3.5">Peça</th>
                <th className="px-4 py-3.5">Tipo / Motivo</th>
                <th className="px-4 py-3.5">Canal</th>
                <th className="px-4 py-3.5">Responsável</th>
                <th className="px-4 py-3.5 text-center">Qtd</th>
                <th className="px-4 py-3.5 text-center">Saldo</th>
                <th className="px-4 py-3.5 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEAE0]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#6E695F]">
                    Carregando movimentações...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#6E695F]">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-[#FAF8F5]/70">
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-[#4C4840]">
                      {formatDate(m.movement_date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-[#1C1B19]">{m.product_name}</p>
                      <p className="text-xs text-[#6E695F]">
                        {m.product_sku} {m.notes ? `• ${m.notes}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          m.type === 'entrada'
                            ? 'bg-[#0F5C48]/10 text-[#0F5C48]'
                            : m.type === 'saida'
                              ? 'bg-[#B8293D]/10 text-[#B8293D]'
                              : 'bg-[#C89B3C]/20 text-[#7A5912]'
                        }`}
                      >
                        {m.type === 'entrada' ? 'Entrada' : m.type === 'saida' ? 'Saída' : 'Ajuste'}
                      </span>
                      <p className="mt-1 text-xs text-[#6E695F]">
                        {REASON_LABELS[m.reason] || m.reason}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#4C4840]">{m.channel || '—'}</td>
                    <td className="px-4 py-3.5 text-xs font-medium text-[#1C1B19]">
                      {m.moved_by || 'Equipe TKL'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold tabular-nums text-[#1C1B19]">
                      {m.quantity}
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs tabular-nums text-[#6E695F]">
                      {m.previous_stock} → <strong className="text-[#1C1B19]">{m.new_stock}</strong>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-[#1C1B19]">
                      {m.total_value > 0 ? formatCurrency(m.total_value) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Movimentação */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Registrar Movimentação de Estoque"
        subtitle="Atualize o saldo da peça e, se desejar, integre automaticamente ao Fluxo de Caixa."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Peça Autoral *</label>
            <select
              required
              value={form.product_id}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (Disponível: {p.stock_quantity} un.)
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Tipo *</label>
              <select
                value={form.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  const nextReason = REASONS_BY_TYPE[nextType][0].value;
                  handleTypeOrReasonChange(nextType, nextReason);
                }}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
                <option value="ajuste">Ajuste de Inventário</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Motivo *</label>
              <select
                value={form.reason}
                onChange={(e) => handleTypeOrReasonChange(form.type, e.target.value)}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                {(REASONS_BY_TYPE[form.type] || []).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">
                {form.type === 'ajuste' ? 'Novo Saldo Total *' : 'Quantidade *'}
              </label>
              <input
                type="number"
                min={form.type === 'ajuste' ? '0' : '1'}
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm tabular-nums focus:border-[#0F5C48] focus:outline-none"
              />
              {selectedProduct && form.type === 'saida' && (
                <p className="mt-1 text-[11px] text-[#6E695F]">
                  Estoque atual: {selectedProduct.stock_quantity} un.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Valor Unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm tabular-nums focus:border-[#0F5C48] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Canal</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Data *</label>
              <input
                type="date"
                required
                value={form.movement_date}
                onChange={(e) => setForm({ ...form, movement_date: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
          </div>

          {canOfferCashSync && (
            <div className="space-y-3 rounded-xl border border-[#0F5C48]/25 bg-[#0F5C48]/5 p-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-[#0F5C48]">
                <input
                  type="checkbox"
                  checked={form.syncCashFlow}
                  onChange={(e) => setForm({ ...form, syncCashFlow: e.target.checked })}
                  className="h-4 w-4 accent-[#0F5C48]"
                />
                Lançar automaticamente no Fluxo de Caixa (
                {formatCurrency((Number(form.quantity) || 0) * (Number(form.unit_price) || 0))})
              </label>

              {form.syncCashFlow && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4C4840]">
                      Forma de Pagamento
                    </label>
                    <select
                      value={form.payment_method}
                      onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      className="w-full rounded-xl border border-[#DFD8CA] bg-white px-3 py-1.5 text-sm"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4C4840]">
                      Status Financeiro
                    </label>
                    <select
                      value={form.cash_status}
                      onChange={(e) => setForm({ ...form, cash_status: e.target.value })}
                      className="w-full rounded-xl border border-[#DFD8CA] bg-white px-3 py-1.5 text-sm"
                    >
                      <option value="confirmado">Confirmado</option>
                      <option value="pendente">Pendente</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4C4840]">
              Responsável (Quem movimentou) *
            </label>
            <input
              required
              value={form.moved_by}
              onChange={(e) => setForm({ ...form, moved_by: e.target.value })}
              placeholder="Ex: Maria, João, Ateliê TKL..."
              className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Observações</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex: Pedido via @tklstoream Direct, embalagem presente..."
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
              {saving ? 'Registrando...' : 'Confirmar Movimentação'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
