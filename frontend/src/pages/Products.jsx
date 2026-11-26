import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/Modal.jsx';
import { formatCurrency } from '../utils/formatters.js';

const CATEGORIES = ['Lenços', 'Pratos Decorativos', 'Xícaras e Pires', 'Acessórios', 'Outros'];

const EMPTY_FORM = {
  sku: '',
  name: '',
  category: 'Lenços',
  artist: 'Autoral TKL',
  print_theme: '',
  material: '',
  dimensions: '',
  edition_batch: '',
  cost_price: '',
  sale_price: '',
  stock_quantity: '0',
  min_stock: '3',
  status: 'ativo',
  notes: ''
};

export function Products({ onToast, onDataChanged, initialStockFilter = '', refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [artistFilter, setArtistFilter] = useState('');
  const [stockFilter, setStockFilter] = useState(initialStockFilter); // '' | 'low' | 'critical'

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialStockFilter) {
      setStockFilter(initialStockFilter);
    }
  }, [initialStockFilter]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts({
        search,
        category: categoryFilter,
        artist: artistFilter,
        lowStock: stockFilter === 'low' ? 'true' : '',
        criticalStock: stockFilter === 'critical' ? 'true' : ''
      });
      setItems(res.items || []);
      setArtists(res.meta?.artists || []);
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, categoryFilter, artistFilter, stockFilter, refreshKey]);

  const liveMargin = useMemo(() => {
    const cost = Number(form.cost_price) || 0;
    const sale = Number(form.sale_price) || 0;
    if (sale <= 0) return 0;
    return (((sale - cost) / sale) * 100).toFixed(1);
  }, [form.cost_price, form.sale_price]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      sku: product.sku,
      name: product.name,
      category: product.category,
      artist: product.artist,
      print_theme: product.print_theme || '',
      material: product.material || '',
      dimensions: product.dimensions || '',
      edition_batch: product.edition_batch || '',
      cost_price: String(product.cost_price),
      sale_price: String(product.sale_price),
      stock_quantity: String(product.stock_quantity),
      min_stock: String(product.min_stock),
      status: product.status,
      notes: product.notes || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        stock_quantity: Number(form.stock_quantity) || 0,
        min_stock: Number(form.min_stock) || 0
      };

      if (editing) {
        await api.updateProduct(editing.id, payload);
        onToast('Produto atualizado com sucesso!');
      } else {
        await api.createProduct(payload);
        onToast('Peça autoral cadastrada com sucesso!');
      }
      setModalOpen(false);
      await loadProducts();
      onDataChanged();
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Deseja remover ou inativar "${product.name}"?`)) return;
    try {
      const res = await api.deleteProduct(product.id);
      onToast(
        res.inactivated
          ? 'Produto possui histórico e foi marcado como inativo.'
          : 'Produto excluído com sucesso.'
      );
      await loadProducts();
      onDataChanged();
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1B19]">Produtos Autorais</h1>
          <p className="text-sm text-[#6E695F]">
            Catálogo de pequenas tiragens, artistas parceiros, custos e preços de venda.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0F5C48] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#0B4738]"
        >
          <Plus className="h-4 w-4" />
          Nova Peça
        </button>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 rounded-2xl border border-[#E7E1D6] bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6E695F]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar SKU, nome, estampa..."
            className="w-full rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] py-2 pr-3 pl-9 text-sm focus:border-[#0F5C48] focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={artistFilter}
          onChange={(e) => setArtistFilter(e.target.value)}
          className="rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
        >
          <option value="">Todos os artistas</option>
          {artists.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium focus:border-[#0F5C48] focus:outline-none ${
            stockFilter === 'critical'
              ? 'border-[#B8293D] bg-[#B8293D]/8 text-[#B8293D]'
              : 'border-[#DFD8CA] bg-[#FAF8F5] text-[#1C1B19]'
          }`}
        >
          <option value="">Todos os níveis de estoque</option>
          <option value="critical">Estoque Crítico / Esgotado</option>
          <option value="low">Últimas Unidades (≤ Mínimo)</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-[#E7E1D6] bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#EFEAE0] bg-[#FAF8F5] text-xs font-semibold uppercase tracking-wider text-[#6E695F]">
              <tr>
                <th className="px-4 py-3.5">Peça / SKU</th>
                <th className="px-4 py-3.5">Categoria &amp; Artista</th>
                <th className="px-4 py-3.5">Medidas / Tiragem</th>
                <th className="px-4 py-3.5 text-right">Custo</th>
                <th className="px-4 py-3.5 text-right">Venda</th>
                <th className="px-4 py-3.5 text-right">Margem</th>
                <th className="px-4 py-3.5 text-center">Estoque / Mínimo</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEAE0]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#6E695F]">
                    Carregando catálogo...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#6E695F]">
                    Nenhuma peça encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-[#FAF8F5]/70 ${
                      p.status === 'inativo'
                        ? 'opacity-55'
                        : p.is_critical_stock
                          ? 'bg-[#B8293D]/[0.04]'
                          : ''
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-[#1C1B19]">{p.name}</p>
                      <p className="text-xs text-[#6E695F]">
                        {p.sku}
                        {p.print_theme ? ` • ${p.print_theme}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block rounded-full bg-[#F3EFE6] px-2.5 py-0.5 text-xs font-medium text-[#1C1B19]">
                        {p.category}
                      </span>
                      <p className="mt-1 text-xs text-[#6E695F]">{p.artist}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#4C4840]">
                      <p className="font-medium">{p.dimensions || '—'}</p>
                      <p className="text-[#6E695F]">{p.edition_batch || p.material || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-[#6E695F]">
                      {formatCurrency(p.cost_price)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-[#1C1B19]">
                      {formatCurrency(p.sale_price)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-[#0F5C48] font-medium">
                      {p.profit_margin}%
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {p.status === 'inativo' ? (
                        <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                          Inativo
                        </span>
                      ) : p.stock_status === 'esgotado' ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B8293D] px-2.5 py-0.5 text-xs font-semibold text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                            Esgotado (0)
                          </span>
                          <span className="mt-0.5 text-[11px] text-[#B8293D] font-medium tabular-nums">
                            Mín: {p.min_stock} un.
                          </span>
                        </div>
                      ) : p.stock_status === 'critico' ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B8293D] bg-[#B8293D]/10 px-2.5 py-0.5 text-xs font-bold text-[#B8293D] tabular-nums">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#B8293D] animate-pulse" />
                            Crítico ({p.stock_quantity})
                          </span>
                          <span className="mt-0.5 text-[11px] text-[#B8293D] font-medium tabular-nums">
                            Mín: {p.min_stock} un.
                          </span>
                        </div>
                      ) : p.stock_status === 'atencao' ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="rounded-full bg-[#C89B3C]/20 px-2.5 py-0.5 text-xs font-semibold text-[#7A5912] tabular-nums">
                            No limite ({p.stock_quantity})
                          </span>
                          <span className="mt-0.5 text-[11px] text-[#6E695F] tabular-nums">
                            Mín: {p.min_stock} un.
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center">
                          <span className="rounded-full bg-[#0F5C48]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0F5C48] tabular-nums">
                            {p.stock_quantity} un.
                          </span>
                          <span className="mt-0.5 text-[11px] text-[#6E695F] tabular-nums">
                            Mín: {p.min_stock} un.
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded-lg p-1.5 text-[#6E695F] hover:bg-[#F3EFE6] hover:text-[#1C1B19]"
                          title="Editar peça"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="rounded-lg p-1.5 text-[#6E695F] hover:bg-[#B8293D]/10 hover:text-[#B8293D]"
                          title="Excluir / Inativar"
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

      {/* Modal Cadastro / Edição */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Peça Autoral' : 'Cadastrar Nova Peça'}
        subtitle="Informe especificações da tiragem, custo de produção e preço de venda."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">SKU *</label>
              <input
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                placeholder="Ex: TKL-LEN-PIR-70"
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Nome da Peça *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Lenço Pirarucu Vibrante"
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Categoria *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Artista / Coleção</label>
              <input
                value={form.artist}
                onChange={(e) => setForm({ ...form, artist: e.target.value })}
                placeholder="Ex: Turenko Beça, Lucio Dias"
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Estampa / Tema</label>
              <input
                value={form.print_theme}
                onChange={(e) => setForm({ ...form, print_theme: e.target.value })}
                placeholder="Ex: Pirarucu, Teatro Amazonas"
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Material</label>
              <input
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                placeholder="Ex: Poliéster com elastano"
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Dimensões / Capacidade</label>
              <input
                value={form.dimensions}
                onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                placeholder="Ex: 70×70 cm, 80 ml"
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Lote / Tiragem</label>
              <input
                value={form.edition_batch}
                onChange={(e) => setForm({ ...form, edition_batch: e.target.value })}
                placeholder="Ex: Tiragem 01/2026 (20 un.)"
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 rounded-xl bg-[#FAF8F5] p-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Custo Unit. (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] bg-white px-3 py-2 text-sm tabular-nums focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Preço Venda (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] bg-white px-3 py-2 text-sm tabular-nums focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Estoque Atual</label>
              <input
                type="number"
                min="0"
                required
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] bg-white px-3 py-2 text-sm tabular-nums focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Estoque Mínimo</label>
              <input
                type="number"
                min="0"
                required
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] bg-white px-3 py-2 text-sm tabular-nums focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-4 flex items-center justify-between text-xs text-[#6E695F]">
              <span>Margem estimada sobre venda:</span>
              <span className="font-bold text-[#0F5C48] tabular-nums">{liveMargin}%</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">Observações</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalhes adicionais sobre a peça ou tiragem..."
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
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
              {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Peça'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
