import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { api } from '../services/api.js';
import { formatCurrency, formatMonthLabel, getPeriodRange } from '../utils/formatters.js';

const CHART_COLORS = ['#0F5C48', '#C89B3C', '#B8293D', '#2D4F8A', '#6E695F', '#8F4D2A'];

export function Reports({ onToast }) {
  const [preset, setPreset] = useState('last_3_months');
  const [range, setRange] = useState(() => getPeriodRange('last_3_months'));
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.getReportSummary(range),
      api.getCashFlowMonthly(6),
      api.getSalesBreakdown(range)
    ])
      .then(([sumRes, monthRes, breakRes]) => {
        if (!active) return;
        setSummary(sumRes);
        setMonthly(
          (monthRes.series || []).map((item) => ({
            ...item,
            label: formatMonthLabel(item.month)
          }))
        );
        setBreakdown(breakRes);
      })
      .catch((err) => onToast(err.message, 'error'))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range]);

  const handlePresetChange = (nextPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== 'custom') {
      setRange(getPeriodRange(nextPreset));
    }
  };

  if (loading || !summary || !breakdown) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[#E7E1D6]" />
        <div className="h-72 animate-pulse rounded-2xl bg-white border border-[#E7E1D6]" />
      </div>
    );
  }

  const { financial, inventory } = summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1B19]">
            Relatórios Gerenciais
          </h1>
          <p className="text-sm text-[#6E695F]">
            Desempenho por categoria, artista, canal de venda e exportação para planilhas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 no-print">
          <a
            href={api.getExportUrl('products')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-white px-3 py-2 text-xs font-semibold text-[#1C1B19] hover:bg-[#F3EFE6]"
          >
            <Download className="h-3.5 w-3.5 text-[#0F5C48]" />
            CSV Produtos
          </a>
          <a
            href={api.getExportUrl('stock', range)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-white px-3 py-2 text-xs font-semibold text-[#1C1B19] hover:bg-[#F3EFE6]"
          >
            <Download className="h-3.5 w-3.5 text-[#0F5C48]" />
            CSV Estoque
          </a>
          <a
            href={api.getExportUrl('cashflow', range)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-white px-3 py-2 text-xs font-semibold text-[#1C1B19] hover:bg-[#F3EFE6]"
          >
            <Download className="h-3.5 w-3.5 text-[#0F5C48]" />
            CSV Caixa
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#141413] px-3.5 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E7E1D6] bg-white p-3.5 shadow-xs no-print">
        {[
          { id: 'this_month', label: 'Este mês' },
          { id: 'last_3_months', label: 'Últimos 3 meses' },
          { id: 'last_6_months', label: 'Últimos 6 meses' },
          { id: 'all', label: 'Todo o período' },
          { id: 'custom', label: 'Personalizado' }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handlePresetChange(item.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              preset === item.id
                ? 'bg-[#0F5C48] text-white'
                : 'bg-[#FAF8F5] text-[#4C4840] hover:bg-[#EFEAE0]'
            }`}
          >
            {item.label}
          </button>
        ))}

        {preset === 'custom' && (
          <div className="ml-auto flex items-center gap-2">
            <input
              type="date"
              value={range.startDate}
              onChange={(e) => setRange({ ...range, startDate: e.target.value })}
              className="rounded-xl border border-[#DFD8CA] px-2.5 py-1.5 text-xs"
            />
            <span className="text-xs text-[#6E695F]">até</span>
            <input
              type="date"
              value={range.endDate}
              onChange={(e) => setRange({ ...range, endDate: e.target.value })}
              className="rounded-xl border border-[#DFD8CA] px-2.5 py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {/* KPIs do período */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Receita Confirmada</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#0F5C48]">
            {formatCurrency(financial.entradas)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Despesa Confirmada</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#B8293D]">
            {formatCurrency(financial.saidas)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Lucro Líquido</p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${
              financial.lucroLiquido >= 0 ? 'text-[#0F5C48]' : 'text-[#B8293D]'
            }`}
          >
            {formatCurrency(financial.lucroLiquido)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Margem Líquida</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#1C1B19]">
            {financial.margemLiquida}%
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <p className="text-xs font-semibold uppercase text-[#6E695F]">Estoque Atual (Custo)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#8F6B1E]">
            {formatCurrency(inventory.stockValueCost)}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs print-break-inside-avoid">
          <h2 className="font-display text-xl font-bold text-[#1C1B19]">
            Evolução Mensal (Entradas, Saídas e Lucro)
          </h2>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEAE0" />
                <XAxis
                  dataKey="label"
                  padding={{ left: 16, right: 16 }}
                  tick={{ fill: '#6E695F', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#6E695F', fontSize: 12 }} />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="entradas" name="Entradas" fill="#0F5C48" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#B8293D" radius={[6, 6, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="lucro"
                  name="Lucro Líquido"
                  stroke="#C89B3C"
                  strokeWidth={2.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs print-break-inside-avoid">
          <h2 className="font-display text-xl font-bold text-[#1C1B19]">
            Receita de Vendas por Categoria
          </h2>
          <div className="mt-4 h-72 w-full">
            {breakdown.byCategory.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#6E695F]">
                Sem vendas registradas no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown.byCategory} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFEAE0" />
                  <XAxis type="number" tick={{ fill: '#6E695F', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={120}
                    tick={{ fill: '#1C1B19', fontSize: 12 }}
                  />
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                  <Bar dataKey="revenue" name="Receita" fill="#0F5C48" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs print-break-inside-avoid">
          <h2 className="font-display text-xl font-bold text-[#1C1B19]">
            Desempenho por Artista / Coleção
          </h2>
          <div className="mt-4 h-72 w-full">
            {breakdown.byArtist.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#6E695F]">
                Sem vendas por artista no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown.byArtist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFEAE0" />
                  <XAxis dataKey="artist" tick={{ fill: '#1C1B19', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6E695F', fontSize: 12 }} />
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                  <Bar dataKey="revenue" name="Receita" fill="#C89B3C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs print-break-inside-avoid">
          <h2 className="font-display text-xl font-bold text-[#1C1B19]">
            Distribuição de Despesas
          </h2>
          <div className="mt-4 h-72 w-full">
            {breakdown.expensesByCategory.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#6E695F]">
                Sem despesas confirmadas no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={breakdown.expensesByCategory}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="46%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {breakdown.expensesByCategory.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: '11px', width: '100%' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Ranking Top Produtos + Canais */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-[#E7E1D6] bg-white shadow-xs lg:col-span-2 print-break-inside-avoid">
          <div className="border-b border-[#EFEAE0] px-5 py-4">
            <h2 className="font-display text-xl font-bold text-[#1C1B19]">
              Ranking de Peças Mais Vendidas
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F5] text-xs font-semibold uppercase text-[#6E695F]">
                <tr>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Artista</th>
                  <th className="px-4 py-3 text-center">Qtd Vendida</th>
                  <th className="px-4 py-3 text-right">Receita</th>
                  <th className="px-4 py-3 text-right">Lucro Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {breakdown.topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#6E695F]">
                      Nenhuma venda registrada no período selecionado.
                    </td>
                  </tr>
                ) : (
                  breakdown.topProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1C1B19]">{p.name}</p>
                        <p className="text-xs text-[#6E695F]">
                          {p.category} {p.dimensions ? `• ${p.dimensions}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#4C4840]">{p.artist}</td>
                      <td className="px-4 py-3 text-center font-bold tabular-nums">
                        {p.units_sold}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#0F5C48]">
                        {formatCurrency(p.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#1C1B19]">
                        {formatCurrency(p.estimated_profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs print-break-inside-avoid">
          <h2 className="font-display text-xl font-bold text-[#1C1B19]">Vendas por Canal</h2>
          <div className="mt-4 space-y-3">
            {breakdown.salesByChannel.length === 0 ? (
              <p className="text-sm text-[#6E695F]">Sem vendas registradas no período.</p>
            ) : (
              breakdown.salesByChannel.map((ch) => (
                <div
                  key={ch.channel}
                  className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[#1C1B19]">{ch.channel}</p>
                    <p className="text-xs text-[#6E695F]">{ch.units} peças vendidas</p>
                  </div>
                  <p className="font-bold tabular-nums text-[#0F5C48]">
                    {formatCurrency(ch.revenue)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
