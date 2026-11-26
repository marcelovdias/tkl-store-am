const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro HTTP ${res.status}`);
  }
  return data;
}

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      qs.set(k, String(v));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const api = {
  getProducts: (params) => request(`/products${toQuery(params)}`),
  createProduct: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  getStockMovements: (params) => request(`/stock/movements${toQuery(params)}`),
  createStockMovement: (body) =>
    request('/stock/movements', { method: 'POST', body: JSON.stringify(body) }),

  getCashFlow: (params) => request(`/cashflow${toQuery(params)}`),
  createCashFlow: (body) => request('/cashflow', { method: 'POST', body: JSON.stringify(body) }),
  updateCashFlow: (id, body) => request(`/cashflow/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCashFlow: (id) => request(`/cashflow/${id}`, { method: 'DELETE' }),

  getReportSummary: (params) => request(`/reports/summary${toQuery(params)}`),
  getCashFlowMonthly: (months = 6) => request(`/reports/cashflow-monthly?months=${months}`),
  getSalesBreakdown: (params) => request(`/reports/sales-breakdown${toQuery(params)}`),
  getExportUrl: (type, params = {}) => `${API_BASE}/reports/export${toQuery({ type, ...params })}`,

  getIntegrationSettings: () => request('/integrations/settings'),
  updateIntegrationSettings: (body) =>
    request('/integrations/settings', { method: 'PUT', body: JSON.stringify(body) }),
  regenerateApiKey: () => request('/integrations/regenerate-key', { method: 'POST' }),
  getIntegrationLogs: (params) => request(`/integrations/logs${toQuery(params)}`),
  simulateIntegration: (body) =>
    request('/integrations/simulate', { method: 'POST', body: JSON.stringify(body) }),
  getBackupUrl: () => `${API_BASE}/integrations/backup`
};
