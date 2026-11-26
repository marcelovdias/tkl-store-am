import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Wallet,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Menu,
  X,
  Instagram
} from 'lucide-react';
import { TklLogo } from './TklLogo.jsx';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'products', label: 'Produtos Autorais', icon: Package },
  { id: 'stock', label: 'Movimentação', icon: ArrowLeftRight },
  { id: 'cashflow', label: 'Fluxo de Caixa', icon: Wallet },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'integrations', label: 'Loja Virtual / Sync', icon: RefreshCw }
];

export function Layout({
  activePage,
  onNavigate,
  lowStockCount = 0,
  criticalStockCount = 0,
  sseConnected = false,
  onViewCritical,
  children
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#141413] text-[#FAF8F5]">
      <div>
        <div className="flex items-center gap-3.5 border-b border-white/10 px-5 py-5">
          <TklLogo size={46} />
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tracking-wide text-white truncate">
              TKL Store AM
            </p>
            <p className="text-[11px] uppercase tracking-widest text-[#C89B3C]">
              Manaus • Arte &amp; Cultura
            </p>
          </div>
        </div>

        <nav className="mt-5 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            const badgeCount =
              item.id === 'products'
                ? criticalStockCount > 0
                  ? criticalStockCount
                  : lowStockCount
                : 0;
            const badgeCritical = item.id === 'products' && criticalStockCount > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#0F5C48] text-white shadow-sm'
                    : 'text-[#D6D1C7] hover:bg-white/8 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </span>
                {badgeCount > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums ${
                      badgeCritical ? 'bg-[#B8293D] animate-pulse' : 'bg-[#C89B3C] text-[#141413]'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 border-t border-white/10 p-4 text-xs text-[#A8A296]">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-[11px] font-medium text-[#E5E0D5]">
            {sseConnected ? 'Tempo real ativo (SSE)' : 'Reconectando sync...'}
          </span>
        </div>
        <p className="font-medium text-[#D6D1C7]">Produções em pequenas tiragens</p>
        <a
          href="https://www.instagram.com/tklstoream"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[#C89B3C] hover:underline"
        >
          <Instagram className="h-3.5 w-3.5" />
          @tklstoream
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] lg:flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E7E1D6] bg-[#141413] px-4 py-3 text-white lg:hidden no-print">
        <div className="flex items-center gap-3">
          <TklLogo size={36} />
          <div>
            <p className="font-display text-base font-bold leading-tight">TKL Store AM</p>
            <p className="text-[10px] uppercase tracking-widest text-[#C89B3C]">
              Gestão Financeira &amp; Estoque
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-[#FAF8F5] hover:bg-white/10"
          aria-label="Alternar menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-68 max-w-[80vw]">{sidebarContent}</div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          {criticalStockCount > 0 && (
            <div className="no-print flex flex-col gap-2 rounded-2xl border border-[#B8293D]/35 bg-[#B8293D]/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5 text-sm text-[#7F1927]">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B8293D] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#B8293D]" />
                </span>
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#B8293D]" />
                <span>
                  <strong>Alerta de Estoque Crítico:</strong> {criticalStockCount}{' '}
                  {criticalStockCount === 1
                    ? 'peça está abaixo do estoque mínimo ou esgotada.'
                    : 'peças estão abaixo do estoque mínimo ou esgotadas.'}
                </span>
              </div>
              <button
                type="button"
                onClick={onViewCritical}
                className="shrink-0 rounded-xl bg-[#B8293D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#991F30]"
              >
                Ver peças críticas
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
