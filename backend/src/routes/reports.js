import { Router } from 'express';

function buildDateFilter(column, startDate, endDate) {
  const conditions = [];
  const params = [];
  if (startDate) {
    conditions.push(`${column} >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`${column} <= ?`);
    params.push(endDate);
  }
  return { conditions, params };
}

function escapeCsv(val) {
  const str = String(val ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function createReportsRouter(db) {
  const router = Router();

  router.get('/summary', (req, res) => {
    const { startDate = '', endDate = '' } = req.query;
    const { conditions, params } = buildDateFilter('transaction_date', startDate, endDate);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const periodStats = db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN type = 'entrada' AND status = 'confirmado' THEN amount ELSE 0 END), 0) AS entradas,
          COALESCE(SUM(CASE WHEN type = 'saida' AND status = 'confirmado' THEN amount ELSE 0 END), 0) AS saidas,
          COALESCE(SUM(CASE WHEN type = 'entrada' AND status = 'pendente' THEN amount ELSE 0 END), 0) AS pendenteEntradas,
          COALESCE(SUM(CASE WHEN type = 'saida' AND status = 'pendente' THEN amount ELSE 0 END), 0) AS pendenteSaidas
        FROM cash_flow ${whereClause}`
      )
      .get(...params);

    const allTimeCash = db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE -amount END), 0) AS saldoAtual
        FROM cash_flow WHERE status = 'confirmado'`
      )
      .get();

    const inventoryStats = db
      .prepare(
        `SELECT
          COUNT(*) AS totalSkus,
          COALESCE(SUM(stock_quantity), 0) AS totalUnits,
          COALESCE(SUM(stock_quantity * cost_price), 0) AS stockValueCost,
          COALESCE(SUM(stock_quantity * sale_price), 0) AS stockValueSale
        FROM products WHERE status = 'ativo'`
      )
      .get();

    const lowStockProducts = db
      .prepare(
        `SELECT id, sku, name, category, artist, dimensions, stock_quantity, min_stock, sale_price,
          CASE
            WHEN stock_quantity = 0 THEN 'esgotado'
            WHEN stock_quantity < min_stock THEN 'critico'
            ELSE 'atencao'
          END AS stock_status
         FROM products
         WHERE status = 'ativo' AND stock_quantity <= min_stock
         ORDER BY stock_quantity ASC, name ASC`
      )
      .all();

    const criticalStockCount = lowStockProducts.filter(
      (p) => p.stock_status === 'esgotado' || p.stock_status === 'critico'
    ).length;
    const outOfStockCount = lowStockProducts.filter((p) => p.stock_status === 'esgotado').length;

    const entradas = Number(periodStats.entradas.toFixed(2));
    const saidas = Number(periodStats.saidas.toFixed(2));
    const lucroLiquido = Number((entradas - saidas).toFixed(2));
    const margemLiquida = entradas > 0 ? Number(((lucroLiquido / entradas) * 100).toFixed(1)) : 0;

    res.json({
      financial: {
        entradas,
        saidas,
        lucroLiquido,
        margemLiquida,
        pendenteEntradas: Number(periodStats.pendenteEntradas.toFixed(2)),
        pendenteSaidas: Number(periodStats.pendenteSaidas.toFixed(2)),
        saldoAtual: Number(allTimeCash.saldoAtual.toFixed(2))
      },
      inventory: {
        totalSkus: inventoryStats.totalSkus,
        totalUnits: inventoryStats.totalUnits,
        stockValueCost: Number(inventoryStats.stockValueCost.toFixed(2)),
        stockValueSale: Number(inventoryStats.stockValueSale.toFixed(2)),
        lowStockCount: lowStockProducts.length,
        criticalStockCount,
        outOfStockCount,
        lowStockProducts
      }
    });
  });

  router.get('/cashflow-monthly', (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
    const rows = db
      .prepare(
        `SELECT
          strftime('%Y-%m', transaction_date) AS month,
          COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) AS entradas,
          COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0) AS saidas
        FROM cash_flow
        WHERE status = 'confirmado'
          AND transaction_date >= date('now', 'localtime', 'start of month', ?)
        GROUP BY strftime('%Y-%m', transaction_date)
        ORDER BY month ASC`
      )
      .all(`-${months - 1} months`);

    const series = rows.map((r) => ({
      month: r.month,
      entradas: Number(r.entradas.toFixed(2)),
      saidas: Number(r.saidas.toFixed(2)),
      lucro: Number((r.entradas - r.saidas).toFixed(2))
    }));

    res.json({ series });
  });

  router.get('/sales-breakdown', (req, res) => {
    const { startDate = '', endDate = '' } = req.query;
    const moveFilter = buildDateFilter('sm.movement_date', startDate, endDate);
    const moveWhere = moveFilter.conditions.length
      ? `AND ${moveFilter.conditions.join(' AND ')}`
      : '';

    const byCategory = db
      .prepare(
        `SELECT
          p.category,
          COALESCE(SUM(sm.quantity), 0) AS units,
          COALESCE(SUM(sm.total_value), 0) AS revenue
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.type = 'saida' AND sm.reason = 'venda' ${moveWhere}
        GROUP BY p.category
        ORDER BY revenue DESC`
      )
      .all(...moveFilter.params);

    const byArtist = db
      .prepare(
        `SELECT
          p.artist,
          COALESCE(SUM(sm.quantity), 0) AS units,
          COALESCE(SUM(sm.total_value), 0) AS revenue
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.type = 'saida' AND sm.reason = 'venda' ${moveWhere}
        GROUP BY p.artist
        ORDER BY revenue DESC`
      )
      .all(...moveFilter.params);

    const topProducts = db
      .prepare(
        `SELECT
          p.id,
          p.sku,
          p.name,
          p.category,
          p.artist,
          p.dimensions,
          p.stock_quantity,
          COALESCE(SUM(sm.quantity), 0) AS units_sold,
          COALESCE(SUM(sm.total_value), 0) AS revenue,
          COALESCE(SUM(sm.quantity * p.cost_price), 0) AS estimated_cost
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.type = 'saida' AND sm.reason = 'venda' ${moveWhere}
        GROUP BY p.id
        ORDER BY revenue DESC, units_sold DESC
        LIMIT 10`
      )
      .all(...moveFilter.params)
      .map((p) => ({
        ...p,
        revenue: Number(p.revenue.toFixed(2)),
        estimated_profit: Number((p.revenue - p.estimated_cost).toFixed(2))
      }));

    const salesByChannel = db
      .prepare(
        `SELECT
          CASE WHEN sm.channel = '' THEN 'Não informado' ELSE sm.channel END AS channel,
          COALESCE(SUM(sm.quantity), 0) AS units,
          COALESCE(SUM(sm.total_value), 0) AS revenue
        FROM stock_movements sm
        WHERE sm.type = 'saida' AND sm.reason = 'venda' ${moveWhere}
        GROUP BY channel
        ORDER BY revenue DESC`
      )
      .all(...moveFilter.params);

    const cashFilter = buildDateFilter('transaction_date', startDate, endDate);
    const cashWhere = cashFilter.conditions.length
      ? `AND ${cashFilter.conditions.join(' AND ')}`
      : '';

    const expensesByCategory = db
      .prepare(
        `SELECT category, COALESCE(SUM(amount), 0) AS total
         FROM cash_flow
         WHERE type = 'saida' AND status = 'confirmado' ${cashWhere}
         GROUP BY category
         ORDER BY total DESC`
      )
      .all(...cashFilter.params);

    res.json({
      byCategory,
      byArtist,
      topProducts,
      salesByChannel,
      expensesByCategory
    });
  });

  router.get('/export', (req, res) => {
    const { type = 'products', startDate = '', endDate = '' } = req.query;
    let headers = [];
    let rows = [];

    if (type === 'products') {
      headers = [
        'SKU',
        'Nome',
        'Categoria',
        'Artista',
        'Estampa',
        'Material',
        'Dimensões',
        'Tiragem',
        'Custo (R$)',
        'Venda (R$)',
        'Estoque Atual',
        'Estoque Mínimo',
        'Status'
      ];
      const data = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
      rows = data.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.artist,
        p.print_theme,
        p.material,
        p.dimensions,
        p.edition_batch,
        p.cost_price.toFixed(2),
        p.sale_price.toFixed(2),
        p.stock_quantity,
        p.min_stock,
        p.status
      ]);
    } else if (type === 'stock') {
      const f = buildDateFilter('sm.movement_date', startDate, endDate);
      const where = f.conditions.length ? `WHERE ${f.conditions.join(' AND ')}` : '';
      headers = [
        'Data',
        'SKU',
        'Produto',
        'Tipo',
        'Motivo',
        'Canal',
        'Responsável',
        'Quantidade',
        'Saldo Anterior',
        'Novo Saldo',
        'Valor Unitário (R$)',
        'Valor Total (R$)',
        'Observações'
      ];
      const data = db
        .prepare(
          `SELECT sm.*, p.sku, p.name FROM stock_movements sm
           JOIN products p ON p.id = sm.product_id ${where}
           ORDER BY sm.movement_date DESC, sm.id DESC`
        )
        .all(...f.params);
      rows = data.map((m) => [
        m.movement_date,
        m.sku,
        m.name,
        m.type,
        m.reason,
        m.channel,
        m.moved_by,
        m.quantity,
        m.previous_stock,
        m.new_stock,
        m.unit_price.toFixed(2),
        m.total_value.toFixed(2),
        m.notes
      ]);
    } else {
      const f = buildDateFilter('transaction_date', startDate, endDate);
      const where = f.conditions.length ? `WHERE ${f.conditions.join(' AND ')}` : '';
      headers = [
        'Data',
        'Tipo',
        'Categoria',
        'Descrição',
        'Valor (R$)',
        'Forma de Pagamento',
        'Status',
        'Observações'
      ];
      const data = db
        .prepare(`SELECT * FROM cash_flow ${where} ORDER BY transaction_date DESC, id DESC`)
        .all(...f.params);
      rows = data.map((c) => [
        c.transaction_date,
        c.type,
        c.category,
        c.description,
        c.amount.toFixed(2),
        c.payment_method,
        c.status,
        c.notes
      ]);
    }

    const csvLines = [
      headers.map(escapeCsv).join(';'),
      ...rows.map((r) => r.map(escapeCsv).join(';'))
    ];
    const csvContent = `\uFEFF${csvLines.join('\r\n')}`;
    const filename = `tkl-${type}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  });

  return router;
}
