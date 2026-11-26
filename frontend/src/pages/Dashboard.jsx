import { useEffect, useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { api } from '../services/api.js';
import { StatCard } from '../components/StatCard.jsx';
import { formatCurrency, formatDate, formatMonthLabel, REASON_LABELS } from '../utils/formatters.js';

export function Dashboard({ onNavigate, onViewCritical, refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [recentCash, setRecentCash] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.getReportSummary(),
      api.getCashFlowMonthly(6),
      api.getStockMovements(),
      api.getCashFlow()
    ])
      .then(([sumRes, monthRes, moveRes, cashRes]) => {
        if (!active) return;
        setSummary(sumRes);
        setMonthly(
          (monthRes.series || []).map((item) => ({
            ...item,
            label: formatMonthLabel(item.month)
          }))
        );
        setRecentMovements((moveRes.items || []).slice(0, 5));
        setRecentCash((cashRes.items || []).slice(0, 5));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[#E7E1D6]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-[#E7E1D6]" />
          ))}
        </div>
      </div>
    );
  }

  const { financial, inventory } = summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1B19]">
            Visão Geral — TKL Store AM
          </h1>
          <p className="text-sm text-[#6E695F]">
            Acompanhe o caixa, as tiragens autorais e as peças em estoque em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('stock')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F5C48] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#0B4738]"
          >
            <Plus className="h-4 w-4" />
            Registrar Venda / Tiragem
          </button>
          <button
            type="button"
            onClick={() => onNavigate('cashflow')}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D8D0C1] bg-white px-4 py-2.5 text-sm font-semibold text-[#1C1B19] hover:bg-[#F3EFE6]"
          >
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Saldo em Caixa"
          value={formatCurrency(financial.saldoAtual)}
          subtitle={
            financial.pendenteEntradas > 0
              ? `+ ${formatCurrency(financial.pendenteEntradas)} a receber`
              : 'Lançamentos confirmados'
          }
          icon={Wallet}
          tone={financial.saldoAtual >= 0 ? 'emerald' : 'urucum'}
          onClick={() => onNavigate('cashflow')}
        />
        <StatCard
          title="Receitas Totais"
          value={formatCurrency(financial.entradas)}
          subtitle={`Margem líquida: ${financial.margemLiquida}%`}
          icon={TrendingUp}
          tone="emerald"
          onClick={() => onNavigate('reports')}
        />
        <StatCard
          title="Despesas Totais"
          value={formatCurrency(financial.saidas)}
          subtitle={
            financial.pendenteSaidas > 0
              ? `${formatCurrency(financial.pendenteSaidas)} pendentes`
              : 'Produção, artistas e operação'
          }
          icon={TrendingDown}
          tone="urucum"
          onClick={() => onNavigate('cashflow')}
        />
        <StatCard
          title="Estoque (Preço de Venda)"
          value={formatCurrency(inventory.stockValueSale)}
          subtitle={`${inventory.totalUnits} peças em ${inventory.totalSkus} SKUs (Custo: ${formatCurrency(
            inventory.stockValueCost
          )})`}
          icon={Package}
          tone="gold"
          onClick={() => onNavigate('products')}
        />
      </div>

      {/* Gráfico + Alerta Últimas Unidades */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-[#1C1B19]">
                Fluxo de Caixa Mensal
              </h2>
              <p className="text-xs text-[#6E695F]">Entradas vs. Saídas confirmadas nos últimos meses</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-[#0F5C48] hover:underline"
            >
              Ver relatórios completos
            </button>
          </div>
          <div className="h-72 w-full">
            {monthly.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#6E695F]">
                Sem movimentações financeiras no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFEAE0" />
                  <XAxis dataKey="label" tick={{ fill: '#6E695F', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6E695F', fontSize: 12 }} />
                  <Tooltip
                    formatter={(val) => formatCurrency(val)}
                    contentStyle={{
                      borderRadius: '12px',
                      borderColor: '#E7E1D6',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#0F5C48" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#B8293D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Painel Últimas Unidades */}
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[#B8293D]/10 p-2 text-[#B8293D]">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-[#1C1B19]">Últimas Unidades</h2>
                <p className="text-xs text-[#6E695F]">Peças abaixo ou no estoque mínimo</p>
              </div>
            </div>
            <span className="rounded-full bg-[#B8293D]/10 px-2.5 py-0.5 text-xs font-bold text-[#B8293D] tabular-nums">
              {inventory.lowStockCount}
            </span>
          </div>

          {inventory.lowStockProducts.length === 0 ? (
            <p className="rounded-xl bg-[#FAF8F5] p-4 text-sm text-[#6E695F]">
              Todas as peças autorais estão com estoque confortável.
            </p>
          ) : (
            <div className="space-y-2.5">
              {inventory.lowStockProducts.map((item) => {
                const isCritical =
                  item.stock_status === 'esgotado' || item.stock_status === 'critico';
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${
                      isCritical
                        ? 'border-[#B8293D]/40 bg-[#B8293D]/5'
                        : 'border-[#EFEAE0] bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-sm font-semibold text-[#1C1B19]">{item.name}</p>
                      <p className="text-xs text-[#6E695F]">
                        {item.dimensions || item.category} • {item.artist}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                          item.stock_quantity === 0
                            ? 'bg-[#B8293D] text-white'
                            : isCritical
                              ? 'border border-[#B8293D] bg-[#B8293D]/10 text-[#B8293D]'
                              : 'bg-[#C89B3C]/20 text-[#7A5912]'
                        }`}
                      >
                        {isCritical && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.stock_quantity === 0 ? 'bg-white' : 'bg-[#B8293D]'
                            } animate-pulse`}
                          />
                        )}
                        {item.stock_quantity === 0 ? 'Esgotado' : `${item.stock_quantity} un.`}
                      </span>
                      <p
                        className={`mt-0.5 text-[11px] font-medium tabular-nums ${
                          isCritical ? 'text-[#B8293D]' : 'text-[#6E695F]'
                        }`}
                      >
                        Mín: {item.min_stock}
                      </p>
                    </div>
                  </div>
                );
              })}
              {inventory.criticalStockCount > 0 && onViewCritical ? (
                <button
                  type="button"
                  onClick={onViewCritical}
                  className="mt-2 w-full rounded-xl bg-[#B8293D] py-2 text-xs font-semibold text-white hover:bg-[#991F30]"
                >
                  Ver peças em estoque crítico ({inventory.criticalStockCount})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('stock')}
                  className="mt-2 w-full rounded-xl border border-[#0F5C48]/30 bg-[#0F5C48]/5 py-2 text-xs font-semibold text-[#0F5C48] hover:bg-[#0F5C48]/10"
                >
                  Registrar nova tiragem no estoque
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Listas recentes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#1C1B19]">
              Últimas Movimentações de Estoque
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-semibold text-[#0F5C48] hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="divide-y divide-[#EFEAE0]">
            {recentMovements.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="min-w-0 pr-3">
                  <p className="truncate font-medium text-[#1C1B19]">{m.product_name}</p>
                  <p className="text-xs text-[#6E695F]">
                    {formatDate(m.movement_date)} • {REASON_LABELS[m.reason] || m.reason}
                    {m.channel ? ` • ${m.channel}` : ''}
                    {m.moved_by ? ` • por ${m.moved_by}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                      m.type === 'entrada'
                        ? 'text-[#0F5C48]'
                        : m.type === 'saida'
                          ? 'text-[#B8293D]'
                          : 'text-[#8F6B1E]'
                    }`}
                  >
                    {m.type === 'entrada' ? '+' : m.type === 'saida' ? '-' : ''}
                    {m.quantity} un.
                  </span>
                  <p className="text-xs text-[#6E695F] tabular-nums">
                    Saldo: {m.new_stock}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#1C1B19]">
              Últimos Lançamentos no Caixa
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('cashflow')}
              className="text-xs font-semibold text-[#0F5C48] hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="divide-y divide-[#EFEAE0]">
            {recentCash.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div
                    className={`rounded-lg p-1.5 ${
                      c.type === 'entrada'
                        ? 'bg-[#0F5C48]/10 text-[#0F5C48]'
                        : 'bg-[#B8293D]/10 text-[#B8293D]'
                    }`}
                  >
                    {c.type === 'entrada' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#1C1B19]">{c.description}</p>
                    <p className="text-xs text-[#6E695F]">
                      {formatDate(c.transaction_date)} • {c.category} • {c.payment_method}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`font-semibold tabular-nums ${
                      c.type === 'entrada' ? 'text-[#0F5C48]' : 'text-[#B8293D]'
                    }`}
                  >
                    {c.type === 'entrada' ? '+' : '-'} {formatCurrency(c.amount)}
                  </p>
                  {c.status === 'pendente' && (
                    <span className="text-[11px] font-semibold text-[#8F6B1E]">Pendente</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
