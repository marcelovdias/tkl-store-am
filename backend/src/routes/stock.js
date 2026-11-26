import { Router } from 'express';
import { runInTransaction } from '../db/database.js';
import { stockMovementSchema } from '../validators/schemas.js';
import { broadcastEvent } from '../services/realtime.js';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createStockRouter(db) {
  const router = Router();

  router.get('/movements', (req, res) => {
    const {
      product_id = '',
      type = '',
      reason = '',
      channel = '',
      startDate = '',
      endDate = '',
      search = ''
    } = req.query;

    const conditions = [];
    const params = [];

    if (product_id) {
      conditions.push('sm.product_id = ?');
      params.push(Number(product_id));
    }
    if (type) {
      conditions.push('sm.type = ?');
      params.push(type);
    }
    if (reason) {
      conditions.push('sm.reason = ?');
      params.push(reason);
    }
    if (channel) {
      conditions.push('sm.channel = ?');
      params.push(channel);
    }
    if (startDate) {
      conditions.push('sm.movement_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('sm.movement_date <= ?');
      params.push(endDate);
    }
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR sm.notes LIKE ? OR sm.channel LIKE ? OR sm.moved_by LIKE ?)');
      params.push(term, term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = db
      .prepare(
        `SELECT
          sm.*,
          p.sku AS product_sku,
          p.name AS product_name,
          p.category AS product_category,
          p.artist AS product_artist,
          p.dimensions AS product_dimensions
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        ${whereClause}
        ORDER BY sm.movement_date DESC, sm.id DESC`
      )
      .all(...params);

    res.json({ items });
  });

  router.post('/movements', (req, res, next) => {
    try {
      const data = stockMovementSchema.parse(req.body);
      const movementDate = data.movement_date || todayIso();

      const result = runInTransaction(db, () => {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(data.product_id);
        if (!product) {
          const err = new Error('Produto não encontrado.');
          err.status = 404;
          throw err;
        }

        const previousStock = product.stock_quantity;
        let newStock = previousStock;
        let recordedQty = data.quantity;

        if (data.type === 'entrada') {
          if (data.quantity <= 0) {
            const err = new Error('Quantidade de entrada deve ser maior que zero.');
            err.status = 400;
            throw err;
          }
          newStock = previousStock + data.quantity;
        } else if (data.type === 'saida') {
          if (data.quantity <= 0) {
            const err = new Error('Quantidade de saída deve ser maior que zero.');
            err.status = 400;
            throw err;
          }
          if (previousStock - data.quantity < 0) {
            const err = new Error(
              `Estoque insuficiente para "${product.name}". Disponível: ${previousStock} un.`
            );
            err.status = 400;
            throw err;
          }
          newStock = previousStock - data.quantity;
        } else {
          // ajuste: quantity representa o novo saldo absoluto em inventário
          newStock = data.quantity;
          recordedQty = Math.abs(newStock - previousStock);
        }

        let unitPrice = data.unit_price;
        if (unitPrice === undefined) {
          if (data.reason === 'venda' || data.reason === 'devolucao') {
            unitPrice = product.sale_price;
          } else {
            unitPrice = product.cost_price;
          }
        }

        const totalValue = Number((recordedQty * unitPrice).toFixed(2));

        db.prepare(
          "UPDATE products SET stock_quantity = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
        ).run(newStock, product.id);

        const moveInfo = db
          .prepare(
            `INSERT INTO stock_movements (
              product_id, type, reason, quantity, previous_stock, new_stock,
              unit_price, total_value, channel, moved_by, notes, movement_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            product.id,
            data.type,
            data.reason,
            recordedQty,
            previousStock,
            newStock,
            unitPrice,
            totalValue,
            data.channel,
            data.moved_by,
            data.notes,
            movementDate
          );

        const movementId = Number(moveInfo.lastInsertRowid);
        let cashFlowEntry = null;

        const canSyncCash =
          data.syncCashFlow &&
          totalValue > 0 &&
          ((data.type === 'saida' && data.reason === 'venda') ||
            (data.type === 'entrada' && data.reason === 'producao_tiragem'));

        if (canSyncCash) {
          const isSale = data.type === 'saida' && data.reason === 'venda';
          const cashType = isSale ? 'entrada' : 'saida';
          const cashCategory =
            isSale && data.channel === 'Feira/Evento'
              ? 'Eventos/Feiras'
              : isSale
                ? 'Venda de Produtos'
                : 'Produção/Tiragem';
          const description = `${isSale ? 'Venda' : 'Produção'}: ${recordedQty}x ${product.name}`;

          const cashInfo = db
            .prepare(
              `INSERT INTO cash_flow (
                type, category, description, amount, payment_method,
                status, transaction_date, stock_movement_id, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              cashType,
              cashCategory,
              description,
              totalValue,
              data.payment_method,
              data.cash_status,
              movementDate,
              movementId,
              data.notes || `Gerado automaticamente via movimentação #${movementId}`
            );

          cashFlowEntry = db
            .prepare('SELECT * FROM cash_flow WHERE id = ?')
            .get(Number(cashInfo.lastInsertRowid));
        }

        const movement = db
          .prepare(
            `SELECT sm.*, p.sku AS product_sku, p.name AS product_name, p.category AS product_category
             FROM stock_movements sm
             JOIN products p ON p.id = sm.product_id
             WHERE sm.id = ?`
          )
          .get(movementId);

        const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
        return { movement, product: updatedProduct, cashFlowEntry };
      });

      broadcastEvent('data_updated', {
        entity: 'stock',
        productId: result.product.id,
        newStock: result.product.stock_quantity,
        critical: result.product.stock_quantity < result.product.min_stock
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
