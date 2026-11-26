import crypto from 'node:crypto';
import { Router } from 'express';
import { ZodError } from 'zod';
import { runInTransaction } from '../db/database.js';
import {
  integrationSettingsSchema,
  storefrontOrderWebhookSchema
} from '../validators/schemas.js';
import { broadcastEvent } from '../services/realtime.js';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getSettings(db) {
  const row = db.prepare('SELECT * FROM integration_settings WHERE id = 1').get();
  return {
    ...row,
    auto_push_stock: Boolean(row.auto_push_stock),
    reject_price_mismatch: Boolean(row.reject_price_mismatch),
    enabled: Boolean(row.enabled)
  };
}

function logIntegrationEvent(
  db,
  { direction = 'inbound', event_type, external_order_id = '', idempotency_key = null, status, error_code = '', message, payload = {} }
) {
  const info = db
    .prepare(
      `INSERT INTO integration_logs (
        direction, event_type, external_order_id, idempotency_key,
        status, error_code, message, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      direction,
      event_type,
      external_order_id,
      idempotency_key,
      status,
      error_code,
      message,
      JSON.stringify(payload)
    );
  return db.prepare('SELECT * FROM integration_logs WHERE id = ?').get(Number(info.lastInsertRowid));
}

function processStorefrontOrder(db, rawBody) {
  const settings = getSettings(db);
  if (!settings.enabled) {
    const err = new Error('Integração com a loja virtual está desativada no momento.');
    err.status = 503;
    err.code = 'INTEGRATION_DISABLED';
    throw err;
  }

  let data;
  try {
    data = storefrontOrderWebhookSchema.parse(rawBody);
  } catch (err) {
    const msg =
      err instanceof ZodError ? err.errors.map((e) => e.message).join('; ') : err.message;
    const log = logIntegrationEvent(db, {
      event_type: 'order.created',
      external_order_id: rawBody?.external_order_id || '',
      status: 'rejeitado',
      error_code: 'INVALID_PAYLOAD',
      message: msg,
      payload: rawBody
    });
    broadcastEvent('integration_event', { log });
    const httpErr = new Error(msg);
    httpErr.status = 400;
    httpErr.code = 'INVALID_PAYLOAD';
    httpErr.log = log;
    throw httpErr;
  }

  const idempotencyKey = data.idempotency_key || `order:${data.external_order_id}`;

  // Proteção 1: Idempotência (evita baixa duplicada se o webhook reenviar o mesmo pedido)
  const existingSync = db
    .prepare(
      "SELECT * FROM integration_logs WHERE idempotency_key = ? AND status = 'sincronizado'"
    )
    .get(idempotencyKey);

  if (existingSync) {
    const dupLog = logIntegrationEvent(db, {
      event_type: 'order.created',
      external_order_id: data.external_order_id,
      idempotency_key: null,
      status: 'duplicado',
      error_code: 'DUPLICATE_ORDER',
      message: `Pedido "${data.external_order_id}" já sincronizado anteriormente. Estoque e caixa preservados.`,
      payload: data
    });
    broadcastEvent('integration_event', { log: dupLog });
    return {
      httpStatus: 200,
      status: 'duplicado',
      duplicate: true,
      message: dupLog.message,
      log: dupLog
    };
  }

  try {
    const txResult = runInTransaction(db, () => {
      // Agrega quantidades por SKU caso um mesmo SKU apareça em mais de uma linha do pedido
      const requestedBySku = new Map();
      for (const item of data.items) {
        const key = item.sku.toUpperCase();
        requestedBySku.set(key, (requestedBySku.get(key) || 0) + item.quantity);
      }

      const resolvedItems = [];
      let calculatedSubtotal = 0;

      for (const item of data.items) {
        const skuUpper = item.sku.toUpperCase();
        const product = db
          .prepare('SELECT * FROM products WHERE UPPER(sku) = ?')
          .get(skuUpper);

        // Proteção 2: Produto inexistente ou inativo
        if (!product) {
          const err = new Error(`Produto inexistente no catálogo: SKU "${item.sku}".`);
          err.status = 422;
          err.code = 'SKU_NOT_FOUND';
          throw err;
        }
        if (product.status !== 'ativo') {
          const err = new Error(`Produto "${product.name}" (${product.sku}) está inativo.`);
          err.status = 422;
          err.code = 'PRODUCT_INACTIVE';
          throw err;
        }

        // Proteção 3: Validação de preço unitário
        if (item.unit_price <= 0) {
          const err = new Error(
            `Valor unitário inválido (R$ ${item.unit_price}) para o item "${product.sku}".`
          );
          err.status = 422;
          err.code = 'INVALID_PRICE';
          throw err;
        }

        if (settings.reject_price_mismatch && product.sale_price > 0) {
          const diffPct =
            (Math.abs(item.unit_price - product.sale_price) / product.sale_price) * 100;
          if (diffPct > settings.price_tolerance_percent) {
            const err = new Error(
              `Divergência de preço em "${product.sku}": loja enviou R$ ${item.unit_price.toFixed(
                2
              )}, catálogo exige R$ ${product.sale_price.toFixed(2)} (tolerância ${
                settings.price_tolerance_percent
              }%).`
            );
            err.status = 422;
            err.code = 'PRICE_MISMATCH';
            throw err;
          }
        }

        // Proteção 4: Estoque insuficiente (evita overselling)
        const totalForSku = requestedBySku.get(skuUpper);
        if (product.stock_quantity < totalForSku) {
          const err = new Error(
            `Estoque insuficiente para "${product.name}" (${product.sku}): solicitado ${totalForSku} un., disponível ${product.stock_quantity} un.`
          );
          err.status = 409;
          err.code = 'INSUFFICIENT_STOCK';
          throw err;
        }

        calculatedSubtotal += item.quantity * item.unit_price;
        resolvedItems.push({ product, item });
      }

      const expectedTotal = Number(Math.max(0, calculatedSubtotal - data.discount).toFixed(2));
      if (
        data.order_total !== undefined &&
        Math.abs(expectedTotal - data.order_total) > 0.05
      ) {
        const err = new Error(
          `Divergência no total do pedido "${data.external_order_id}": soma dos itens R$ ${expectedTotal.toFixed(
            2
          )} vs. total enviado R$ ${data.order_total.toFixed(2)}.`
        );
        err.status = 422;
        err.code = 'TOTAL_MISMATCH';
        throw err;
      }

      const txDate = todayIso();
      const createdMovements = [];
      const createdCashEntries = [];

      for (const { product, item } of resolvedItems) {
        const freshProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
        const prevStock = freshProduct.stock_quantity;
        const nextStock = prevStock - item.quantity;
        const lineTotal = Number((item.quantity * item.unit_price).toFixed(2));

        db.prepare(
          "UPDATE products SET stock_quantity = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
        ).run(nextStock, product.id);

        const moveInfo = db
          .prepare(
            `INSERT INTO stock_movements (
              product_id, type, reason, quantity, previous_stock, new_stock,
              unit_price, total_value, channel, moved_by, notes, movement_date
            ) VALUES (?, 'saida', 'venda', ?, ?, ?, ?, ?, ?, 'Loja Virtual (Webhook)', ?, ?)`
          )
          .run(
            product.id,
            item.quantity,
            prevStock,
            nextStock,
            item.unit_price,
            lineTotal,
            data.channel,
            `Pedido ${data.external_order_id} • ${data.customer_name}`,
            txDate
          );

        const movementId = Number(moveInfo.lastInsertRowid);
        createdMovements.push(movementId);

        const cashInfo = db
          .prepare(
            `INSERT INTO cash_flow (
              type, category, description, amount, payment_method,
              status, transaction_date, stock_movement_id, notes
            ) VALUES ('entrada', 'Venda de Produtos', ?, ?, ?, 'confirmado', ?, ?, ?)`
          )
          .run(
            `Loja Virtual (${data.external_order_id}): ${item.quantity}x ${product.name}`,
            lineTotal,
            data.payment_method,
            txDate,
            movementId,
            `Cliente: ${data.customer_name}`
          );
        createdCashEntries.push(Number(cashInfo.lastInsertRowid));
      }

      const syncLog = logIntegrationEvent(db, {
        event_type: 'order.created',
        external_order_id: data.external_order_id,
        idempotency_key: idempotencyKey,
        status: 'sincronizado',
        message: `Pedido "${data.external_order_id}" sincronizado (${resolvedItems.length} item(ns), R$ ${expectedTotal.toFixed(
          2
        )}).`,
        payload: data
      });

      return { syncLog, createdMovements, createdCashEntries, expectedTotal };
    });

    broadcastEvent('data_updated', {
      entity: 'integration',
      external_order_id: data.external_order_id
    });
    broadcastEvent('integration_event', { log: txResult.syncLog });

    return {
      httpStatus: 201,
      status: 'sincronizado',
      duplicate: false,
      message: txResult.syncLog.message,
      log: txResult.syncLog
    };
  } catch (err) {
    const log = logIntegrationEvent(db, {
      event_type: 'order.created',
      external_order_id: data.external_order_id,
      idempotency_key: null,
      status: 'rejeitado',
      error_code: err.code || 'SYNC_REJECTED',
      message: err.message,
      payload: data
    });
    broadcastEvent('integration_event', { log });
    err.log = log;
    throw err;
  }
}

export function createIntegrationsRouter(db) {
  const router = Router();

  router.get('/settings', (_req, res) => {
    const settings = getSettings(db);
    const counts = db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'sincronizado' THEN 1 ELSE 0 END) AS sincronizados,
          SUM(CASE WHEN status = 'rejeitado' THEN 1 ELSE 0 END) AS rejeitados,
          SUM(CASE WHEN status = 'duplicado' THEN 1 ELSE 0 END) AS duplicados
        FROM integration_logs`
      )
      .get();

    res.json({
      settings,
      stats: {
        sincronizados: counts.sincronizados || 0,
        rejeitados: counts.rejeitados || 0,
        duplicados: counts.duplicados || 0
      }
    });
  });

  router.put('/settings', (req, res, next) => {
    try {
      const data = integrationSettingsSchema.parse(req.body);
      db.prepare(
        `UPDATE integration_settings SET
          store_name = ?, store_url = ?, outbound_webhook_url = ?,
          price_tolerance_percent = ?, auto_push_stock = ?,
          reject_price_mismatch = ?, enabled = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = 1`
      ).run(
        data.store_name,
        data.store_url,
        data.outbound_webhook_url,
        data.price_tolerance_percent,
        data.auto_push_stock ? 1 : 0,
        data.reject_price_mismatch ? 1 : 0,
        data.enabled ? 1 : 0
      );

      res.json({ settings: getSettings(db) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/regenerate-key', (_req, res) => {
    const nextKey = `tkl_live_${crypto.randomBytes(16).toString('hex')}`;
    db.prepare(
      "UPDATE integration_settings SET api_key = ?, updated_at = datetime('now', 'localtime') WHERE id = 1"
    ).run(nextKey);
    res.json({ settings: getSettings(db) });
  });

  router.get('/logs', (req, res) => {
    const { status = '' } = req.query;
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];
    const items = db
      .prepare(`SELECT * FROM integration_logs ${where} ORDER BY id DESC LIMIT 60`)
      .all(...params);
    res.json({ items });
  });

  router.get('/backup', (_req, res) => {
    const snapshot = {
      exported_at: new Date().toISOString(),
      store: 'TKL Store AM',
      products: db.prepare('SELECT * FROM products ORDER BY id ASC').all(),
      stock_movements: db.prepare('SELECT * FROM stock_movements ORDER BY id ASC').all(),
      cash_flow: db.prepare('SELECT * FROM cash_flow ORDER BY id ASC').all(),
      integration_logs: db.prepare('SELECT * FROM integration_logs ORDER BY id ASC').all()
    };
    const filename = `tkl-backup-${todayIso()}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(snapshot, null, 2));
  });

  // Endpoint autenticado para a Loja Virtual consultar catálogo e estoque autoritativo
  router.get('/catalog', (req, res) => {
    const settings = getSettings(db);
    const providedKey = req.header('X-API-Key');
    if (!providedKey || providedKey !== settings.api_key) {
      return res.status(401).json({ error: 'Chave X-API-Key inválida ou ausente.' });
    }
    const items = db
      .prepare(
        `SELECT sku, name, category, artist, dimensions, sale_price, stock_quantity, min_stock, status
         FROM products WHERE status = 'ativo' ORDER BY name ASC`
      )
      .all();
    res.json({ updated_at: new Date().toISOString(), items });
  });

  // Webhook em tempo real protegido para pedidos da Loja Virtual
  router.post('/webhook/order', (req, res) => {
    const settings = getSettings(db);
    const providedKey = req.header('X-API-Key');
    if (!providedKey || providedKey !== settings.api_key) {
      return res.status(401).json({
        error: 'Chave X-API-Key inválida ou ausente.',
        code: 'UNAUTHORIZED'
      });
    }

    try {
      const outcome = processStorefrontOrder(db, req.body);
      res.status(outcome.httpStatus).json(outcome);
    } catch (err) {
      res.status(err.status || 422).json({
        status: 'rejeitado',
        error: err.message,
        code: err.code || 'SYNC_REJECTED',
        log: err.log || null
      });
    }
  });

  // Simulador interno para validação rápida no painel
  router.post('/simulate', (req, res) => {
    try {
      const outcome = processStorefrontOrder(db, req.body);
      res.status(outcome.httpStatus).json(outcome);
    } catch (err) {
      res.status(err.status || 422).json({
        status: 'rejeitado',
        error: err.message,
        code: err.code || 'SYNC_REJECTED',
        log: err.log || null
      });
    }
  });

  return router;
}
