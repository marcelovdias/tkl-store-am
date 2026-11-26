import { useEffect, useState } from 'react';
import { Layout } from './components/Layout.jsx';
import { Toast } from './components/Toast.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Products } from './pages/Products.jsx';
import { StockMovements } from './pages/StockMovements.jsx';
import { CashFlow } from './pages/CashFlow.jsx';
import { Reports } from './pages/Reports.jsx';
import { Integrations } from './pages/Integrations.jsx';
import { api } from './services/api.js';

export function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [criticalStockCount, setCriticalStockCount] = useState(0);
  const [productInitialFilter, setProductInitialFilter] = useState('');
  const [sseConnected, setSseConnected] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    api
      .getReportSummary()
      .then((res) => {
        setLowStockCount(res.inventory?.lowStockCount || 0);
        setCriticalStockCount(res.inventory?.criticalStockCount || 0);
      })
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('connected', () => setSseConnected(true));
    es.addEventListener('data_updated', () => {
      triggerRefresh();
    });
    es.addEventListener('integration_event', (evt) => {
      triggerRefresh();
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed.log?.status === 'sincronizado') {
          showToast(`Loja Virtual: ${parsed.log.message}`);
        }
      } catch {
        // ignora parse inválido
      }
    });
    es.onerror = () => {
      setSseConnected(false);
    };
    return () => es.close();
  }, []);

  const handleViewCritical = () => {
    setProductInitialFilter('critical');
    setActivePage('products');
  };

  const handleNavigate = (page) => {
    if (page !== 'products') {
      setProductInitialFilter('');
    }
    setActivePage(page);
  };

  return (
    <Layout
      activePage={activePage}
      onNavigate={handleNavigate}
      lowStockCount={lowStockCount}
      criticalStockCount={criticalStockCount}
      sseConnected={sseConnected}
      onViewCritical={handleViewCritical}
    >
      {activePage === 'dashboard' && (
        <Dashboard
          onNavigate={handleNavigate}
          onViewCritical={handleViewCritical}
          refreshKey={refreshKey}
        />
      )}
      {activePage === 'products' && (
        <Products
          onToast={showToast}
          onDataChanged={triggerRefresh}
          initialStockFilter={productInitialFilter}
          refreshKey={refreshKey}
        />
      )}
      {activePage === 'stock' && (
        <StockMovements
          onToast={showToast}
          onDataChanged={triggerRefresh}
          refreshKey={refreshKey}
        />
      )}
      {activePage === 'cashflow' && (
        <CashFlow onToast={showToast} onDataChanged={triggerRefresh} refreshKey={refreshKey} />
      )}
      {activePage === 'reports' && <Reports onToast={showToast} refreshKey={refreshKey} />}
      {activePage === 'integrations' && (
        <Integrations onToast={showToast} onDataChanged={triggerRefresh} refreshKey={refreshKey} />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Layout>
  );
}

export default App;
