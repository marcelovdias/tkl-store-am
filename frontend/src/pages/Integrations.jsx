import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Copy,
  KeyRound,
  Download,
  AlertOctagon,
  CheckCircle2,
  Ban,
  Play
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatDate } from '../utils/formatters.js';

export function Integrations({ onToast, onDataChanged, refreshKey }) {
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState({ sincronizados: 0, rejeitados: 0, duplicados: 0 });
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState('');
  const [lastOrderId, setLastOrderId] = useState('');

  const loadAll = async () => {
    try {
      const [setRes, logRes, prodRes] = await Promise.all([
        api.getIntegrationSettings(),
        api.getIntegrationLogs(),
        api.getProducts({ status: 'ativo' })
      ]);
      setSettings(setRes.settings);
      setStats(setRes.stats || {});
      setLogs(logRes.items || []);
      setProducts(prodRes.items || []);
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [refreshKey]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateIntegrationSettings({
        store_name: settings.store_name,
        store_url: settings.store_url,
        outbound_webhook_url: settings.outbound_webhook_url,
        price_tolerance_percent: Number(settings.price_tolerance_percent) || 0,
        auto_push_stock: settings.auto_push_stock,
        reject_price_mismatch: settings.reject_price_mismatch,
        enabled: settings.enabled
      });
      setSettings(res.settings);
      onToast('Configurações de integração salvas!');
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm('Gerar uma nova chave X-API-Key invalidará a chave anterior. Continuar?')) {
      return;
    }
    try {
      const res = await api.regenerateApiKey();
      setSettings(res.settings);
      onToast('Nova chave de API gerada!');
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  const copyText = (text, label) => {
    navigator.clipboard?.writeText(text);
    onToast(`${label} copiado para a área de transferência!`);
  };

  const runSimulation = async (scenario) => {
    const sampleProduct = products.find((p) => p.stock_quantity >= 1) || products[0];
    if (!sampleProduct && scenario !== 'missing_sku') {
      onToast('Cadastre ao menos um produto ativo para simular.', 'error');
      return;
    }

    setSimulating(scenario);
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    let payload;

    if (scenario === 'valid') {
      const orderId = `LV-${randomCode}`;
      setLastOrderId(orderId);
      payload = {
        external_order_id: orderId,
        customer_name: 'Cliente Simulação Loja Virtual',
        payment_method: 'Pix',
        channel: 'Loja Virtual',
        items: [{ sku: sampleProduct.sku, quantity: 1, unit_price: sampleProduct.sale_price }]
      };
    } else if (scenario === 'duplicate') {
      const orderId = lastOrderId || `LV-DUP-${randomCode}`;
      payload = {
        external_order_id: orderId,
        customer_name: 'Cliente Reenvio Webhook',
        payment_method: 'Pix',
        channel: 'Loja Virtual',
        items: [{ sku: sampleProduct.sku, quantity: 1, unit_price: sampleProduct.sale_price }]
      };
    } else if (scenario === 'missing_sku') {
      payload = {
        external_order_id: `LV-ERR-SKU-${randomCode}`,
        customer_name: 'Teste Produto Inexistente',
        payment_method: 'Pix',
        items: [{ sku: 'SKU-INEXISTENTE-999', quantity: 1, unit_price: 89 }]
      };
    } else if (scenario === 'insufficient_stock') {
      payload = {
        external_order_id: `LV-ERR-EST-${randomCode}`,
        customer_name: 'Teste Estoque Insuficiente',
        payment_method: 'Cartão de Crédito',
        items: [
          {
            sku: sampleProduct.sku,
            quantity: sampleProduct.stock_quantity + 25,
            unit_price: sampleProduct.sale_price
          }
        ]
      };
    } else if (scenario === 'price_mismatch') {
      payload = {
        external_order_id: `LV-ERR-VAL-${randomCode}`,
        customer_name: 'Teste Divergência de Valor',
        payment_method: 'Pix',
        items: [{ sku: sampleProduct.sku, quantity: 1, unit_price: 1.0 }]
      };
    }

    try {
      const res = await api.simulateIntegration(payload);
      onToast(res.message || 'Simulação processada!');
    } catch (err) {
      onToast(`Proteção ativada: ${err.message}`, 'error');
    } finally {
      setSimulating('');
      await loadAll();
      onDataChanged();
    }
  };

  if (loading || !settings) {
    return <div className="h-48 animate-pulse rounded-2xl bg-white border border-[#E7E1D6]" />;
  }

  const webhookEndpoint = `${window.location.origin}/api/integrations/webhook/order`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1B19]">
            Integração Loja Virtual (Tempo Real)
          </h1>
          <p className="text-sm text-[#6E695F]">
            Sincronização segura com proteção contra perda de dados, furo de estoque, divergência de valores e SKUs inexistentes.
          </p>
        </div>

        <a
          href={api.getBackupUrl()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#141413] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-black"
        >
          <Download className="h-4 w-4 text-[#C89B3C]" />
          Baixar Backup Completo (JSON)
        </a>
      </div>

      {/* Resumo de Proteções */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#6E695F]">
            <CheckCircle2 className="h-4 w-4 text-[#0F5C48]" />
            Pedidos Sincronizados
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#0F5C48]">
            {stats.sincronizados}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#6E695F]">
            <Ban className="h-4 w-4 text-[#B8293D]" />
            Erros Bloqueados
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#B8293D]">
            {stats.rejeitados}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#6E695F]">
            <RefreshCw className="h-4 w-4 text-[#8F6B1E]" />
            Duplicidades Evitadas
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#8F6B1E]">
            {stats.duplicados}
          </p>
        </div>
        <div className="rounded-2xl border border-[#0F5C48]/25 bg-[#0F5C48]/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#0F5C48]">
            <ShieldCheck className="h-4 w-4" />
            Blindagem Transacional
          </div>
          <p className="mt-2 text-xs font-medium text-[#1C1B19]">
            Rollback automático em falhas, idempotência por pedido e trava de estoque.
          </p>
        </div>
      </div>

      {/* Configuração + Simulador */}
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSaveSettings}
          className="space-y-4 rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs lg:col-span-2"
        >
          <div className="flex items-center justify-between border-b border-[#EFEAE0] pb-3">
            <h2 className="font-display text-xl font-bold text-[#1C1B19]">
              Credenciais e Regras de Proteção
            </h2>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#1C1B19]">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="h-4 w-4 accent-[#0F5C48]"
              />
              Integração Ativa
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">
                Nome da Loja Virtual
              </label>
              <input
                required
                value={settings.store_name}
                onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">
                URL da Loja Virtual
              </label>
              <input
                value={settings.store_url}
                onChange={(e) => setSettings({ ...settings, store_url: e.target.value })}
                placeholder="https://sualoja.com.br"
                className="w-full rounded-xl border border-[#DFD8CA] px-3 py-2 text-sm focus:border-[#0F5C48] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">
                Endpoint Webhook (Receber Pedidos)
              </label>
              <div className="flex gap-1.5">
                <input
                  readOnly
                  value={webhookEndpoint}
                  className="w-full rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-3 py-2 text-xs font-mono text-[#4C4840]"
                />
                <button
                  type="button"
                  onClick={() => copyText(webhookEndpoint, 'Endpoint')}
                  className="rounded-xl border border-[#DFD8CA] px-3 text-[#4C4840] hover:bg-[#F3EFE6]"
                  title="Copiar URL"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">
                Chave de Autenticação (Header X-API-Key)
              </label>
              <div className="flex gap-1.5">
                <input
                  readOnly
                  value={settings.api_key}
                  className="w-full rounded-xl border border-[#DFD8CA] bg-[#FAF8F5] px-3 py-2 text-xs font-mono text-[#4C4840]"
                />
                <button
                  type="button"
                  onClick={() => copyText(settings.api_key, 'X-API-Key')}
                  className="rounded-xl border border-[#DFD8CA] px-3 text-[#4C4840] hover:bg-[#F3EFE6]"
                  title="Copiar chave"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  className="rounded-xl border border-[#DFD8CA] px-3 text-[#B8293D] hover:bg-[#B8293D]/10"
                  title="Gerar nova chave"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-xl bg-[#FAF8F5] p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4C4840]">
                Tolerância de Divergência de Preço (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={settings.price_tolerance_percent}
                onChange={(e) =>
                  setSettings({ ...settings, price_tolerance_percent: e.target.value })
                }
                className="w-full rounded-xl border border-[#DFD8CA] bg-white px-3 py-2 text-sm tabular-nums"
              />
              <p className="mt-1 text-[11px] text-[#6E695F]">
                Diferenças acima desse percentual bloqueiam o pedido automaticamente.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-2.5 text-xs font-medium text-[#1C1B19]">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.reject_price_mismatch}
                  onChange={(e) =>
                    setSettings({ ...settings, reject_price_mismatch: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#0F5C48]"
                />
                Bloquear pedidos com divergência de valor
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.auto_push_stock}
                  onChange={(e) => setSettings({ ...settings, auto_push_stock: e.target.checked })}
                  className="h-4 w-4 accent-[#0F5C48]"
                />
                Expor catálogo em tempo real (/api/integrations/catalog)
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#0F5C48] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0B4738] disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>

        {/* Simulador de Proteções */}
        <div className="rounded-2xl border border-[#E7E1D6] bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-[#EFEAE0] pb-3">
            <AlertOctagon className="h-5 w-5 text-[#C89B3C]" />
            <div>
              <h2 className="font-display text-xl font-bold text-[#1C1B19]">
                Simulador de Proteções
              </h2>
              <p className="text-xs text-[#6E695F]">Teste cenários reais antes de conectar a loja</p>
            </div>
          </div>

          <button
            type="button"
            disabled={!!simulating}
            onClick={() => runSimulation('valid')}
            className="flex w-full items-center justify-between rounded-xl bg-[#0F5C48] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#0B4738] disabled:opacity-60"
          >
            <span>1. Simular Pedido Válido (Tempo Real)</span>
            <Play className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={!!simulating}
            onClick={() => runSimulation('missing_sku')}
            className="flex w-full items-center justify-between rounded-xl border border-[#B8293D]/30 bg-[#B8293D]/5 px-3.5 py-2.5 text-xs font-semibold text-[#B8293D] hover:bg-[#B8293D]/10 disabled:opacity-60"
          >
            <span>2. Testar Produto Inexistente (SKU)</span>
            <Play className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={!!simulating}
            onClick={() => runSimulation('insufficient_stock')}
            className="flex w-full items-center justify-between rounded-xl border border-[#B8293D]/30 bg-[#B8293D]/5 px-3.5 py-2.5 text-xs font-semibold text-[#B8293D] hover:bg-[#B8293D]/10 disabled:opacity-60"
          >
            <span>3. Testar Erro de Estoque (Oversell)</span>
            <Play className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={!!simulating}
            onClick={() => runSimulation('price_mismatch')}
            className="flex w-full items-center justify-between rounded-xl border border-[#B8293D]/30 bg-[#B8293D]/5 px-3.5 py-2.5 text-xs font-semibold text-[#B8293D] hover:bg-[#B8293D]/10 disabled:opacity-60"
          >
            <span>4. Testar Erro de Valor / Preço</span>
            <Play className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={!!simulating}
            onClick={() => runSimulation('duplicate')}
            className="flex w-full items-center justify-between rounded-xl border border-[#C89B3C]/40 bg-[#C89B3C]/10 px-3.5 py-2.5 text-xs font-semibold text-[#7A5912] hover:bg-[#C89B3C]/20 disabled:opacity-60"
          >
            <span>5. Testar Pedido Duplicado (Idempotência)</span>
            <Play className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Auditoria */}
      <div className="overflow-hidden rounded-2xl border border-[#E7E1D6] bg-white shadow-xs">
        <div className="border-b border-[#EFEAE0] px-5 py-4">
          <h2 className="font-display text-xl font-bold text-[#1C1B19]">
            Auditoria de Sincronização em Tempo Real
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF8F5] text-xs font-semibold uppercase text-[#6E695F]">
              <tr>
                <th className="px-4 py-3">Data / Hora</th>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Detalhes da Validação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEAE0]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#6E695F]">
                    Nenhum evento de sincronização registrado ainda. Use o simulador acima para testar!
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F5]/70">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[#4C4840]">
                      {formatDate(log.created_at)} {String(log.created_at).slice(11, 16)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1C1B19]">
                      {log.external_order_id || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          log.status === 'sincronizado'
                            ? 'bg-[#0F5C48]/10 text-[#0F5C48]'
                            : log.status === 'duplicado'
                              ? 'bg-[#C89B3C]/20 text-[#7A5912]'
                              : 'bg-[#B8293D]/10 text-[#B8293D]'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6E695F]">
                      {log.error_code || 'OK'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#1C1B19]">{log.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
