import { Router } from 'express';
import { productSchema, productUpdateSchema } from '../validators/schemas.js';
import { broadcastEvent } from '../services/realtime.js';

function getStockStatus(row) {
  if (row.stock_quantity === 0) return 'esgotado';
  if (row.stock_quantity < row.min_stock) return 'critico';
  if (row.stock_quantity === row.min_stock) return 'atencao';
  return 'normal';
}

function enrichProduct(row) {
  const margin =
    row.sale_price > 0
      ? Number((((row.sale_price - row.cost_price) / row.sale_price) * 100).toFixed(1))
      : 0;
  const stockStatus = getStockStatus(row);
  return {
    ...row,
    profit_margin: margin,
    stock_value_cost: Number((row.stock_quantity * row.cost_price).toFixed(2)),
    stock_value_sale: Number((row.stock_quantity * row.sale_price).toFixed(2)),
    stock_status: stockStatus,
    is_critical_stock: row.status === 'ativo' && row.stock_quantity < row.min_stock,
    is_low_stock: row.status === 'ativo' && row.stock_quantity <= row.min_stock
  };
}

export function createProductsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const {
      search = '',
      category = '',
      artist = '',
      status = '',
      lowStock = '',
      criticalStock = ''
    } = req.query;
    const conditions = [];
    const params = [];

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(name LIKE ? OR sku LIKE ? OR artist LIKE ? OR print_theme LIKE ?)');
      params.push(term, term, term, term);
    }
    if (category.trim()) {
      conditions.push('category = ?');
      params.push(category.trim());
    }
    if (artist.trim()) {
      conditions.push('artist = ?');
      params.push(artist.trim());
    }
    if (status.trim()) {
      conditions.push('status = ?');
      params.push(status.trim());
    }
    if (criticalStock === 'true') {
      conditions.push("status = 'ativo' AND stock_quantity < min_stock");
    } else if (lowStock === 'true') {
      conditions.push("status = 'ativo' AND stock_quantity <= min_stock");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM products ${whereClause} ORDER BY status ASC, name ASC`)
      .all(...params);

    const categories = db
      .prepare('SELECT DISTINCT category FROM products ORDER BY category ASC')
      .all()
      .map((r) => r.category);

    const artists = db
      .prepare('SELECT DISTINCT artist FROM products ORDER BY artist ASC')
      .all()
      .map((r) => r.artist);

    res.json({
      items: rows.map(enrichProduct),
      meta: { categories, artists }
    });
  });

  router.get('/:id', (req, res) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const movements = db
      .prepare(
        'SELECT * FROM stock_movements WHERE product_id = ? ORDER BY movement_date DESC, id DESC LIMIT 20'
      )
      .all(product.id);

    res.json({ product: enrichProduct(product), movements });
  });

  router.post('/', (req, res, next) => {
    try {
      const data = productSchema.parse(req.body);
      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(data.sku);
      if (existing) {
        return res.status(409).json({ error: `Já existe um produto cadastrado com o SKU "${data.sku}".` });
      }

      const info = db
        .prepare(
          `INSERT INTO products (
            sku, name, category, artist, print_theme, material,
            dimensions, edition_batch, cost_price, sale_price,
            stock_quantity, min_stock, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.sku,
          data.name,
          data.category,
          data.artist,
          data.print_theme,
          data.material,
          data.dimensions,
          data.edition_batch,
          data.cost_price,
          data.sale_price,
          data.stock_quantity,
          data.min_stock,
          data.status,
          data.notes
        );

      const created = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(info.lastInsertRowid));
      broadcastEvent('data_updated', { entity: 'products', action: 'create', productId: created.id });
      res.status(201).json(enrichProduct(created));
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!current) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
      }

      const data = productUpdateSchema.parse(req.body);
      if (data.sku && data.sku !== current.sku) {
        const duplicate = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(data.sku, id);
        if (duplicate) {
          return res.status(409).json({ error: `Já existe outro produto com o SKU "${data.sku}".` });
        }
      }

      const merged = { ...current, ...data };
      db.prepare(
        `UPDATE products SET
          sku = ?, name = ?, category = ?, artist = ?, print_theme = ?,
          material = ?, dimensions = ?, edition_batch = ?,
          cost_price = ?, sale_price = ?, stock_quantity = ?, min_stock = ?,
          status = ?, notes = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?`
      ).run(
        merged.sku,
        merged.name,
        merged.category,
        merged.artist,
        merged.print_theme,
        merged.material,
        merged.dimensions,
        merged.edition_batch,
        merged.cost_price,
        merged.sale_price,
        merged.stock_quantity,
        merged.min_stock,
        merged.status,
        merged.notes,
        id
      );

      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      broadcastEvent('data_updated', { entity: 'products', action: 'update', productId: id });
      res.json(enrichProduct(updated));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const { count } = db
      .prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ?')
      .get(id);

    if (count > 0) {
      db.prepare("UPDATE products SET status = 'inativo', updated_at = datetime('now', 'localtime') WHERE id = ?").run(id);
      broadcastEvent('data_updated', { entity: 'products', action: 'inactivate', productId: id });
      return res.json({
        deleted: false,
        inactivated: true,
        message: 'Produto possui movimentações históricas e foi marcado como inativo.'
      });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    broadcastEvent('data_updated', { entity: 'products', action: 'delete', productId: id });
    res.json({ deleted: true, inactivated: false });
  });

  return router;
}
