import { Router } from 'express';
import { cashFlowSchema, cashFlowUpdateSchema } from '../validators/schemas.js';
import { broadcastEvent } from '../services/realtime.js';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createCashFlowRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const {
      type = '',
      category = '',
      payment_method = '',
      status = '',
      startDate = '',
      endDate = '',
      search = ''
    } = req.query;

    const conditions = [];
    const params = [];

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (payment_method) {
      conditions.push('payment_method = ?');
      params.push(payment_method);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (startDate) {
      conditions.push('transaction_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('transaction_date <= ?');
      params.push(endDate);
    }
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(description LIKE ? OR category LIKE ? OR notes LIKE ?)');
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = db
      .prepare(`SELECT * FROM cash_flow ${whereClause} ORDER BY transaction_date DESC, id DESC`)
      .all(...params);

    const summary = items.reduce(
      (acc, item) => {
        if (item.status === 'confirmado') {
          if (item.type === 'entrada') acc.totalEntradas += item.amount;
          else acc.totalSaidas += item.amount;
        } else {
          if (item.type === 'entrada') acc.pendenteEntradas += item.amount;
          else acc.pendenteSaidas += item.amount;
        }
        return acc;
      },
      { totalEntradas: 0, totalSaidas: 0, saldo: 0, pendenteEntradas: 0, pendenteSaidas: 0 }
    );
    summary.totalEntradas = Number(summary.totalEntradas.toFixed(2));
    summary.totalSaidas = Number(summary.totalSaidas.toFixed(2));
    summary.saldo = Number((summary.totalEntradas - summary.totalSaidas).toFixed(2));
    summary.pendenteEntradas = Number(summary.pendenteEntradas.toFixed(2));
    summary.pendenteSaidas = Number(summary.pendenteSaidas.toFixed(2));

    res.json({ items, summary });
  });

  router.post('/', (req, res, next) => {
    try {
      const data = cashFlowSchema.parse(req.body);
      const txDate = data.transaction_date || todayIso();

      const info = db
        .prepare(
          `INSERT INTO cash_flow (
            type, category, description, amount, payment_method,
            status, transaction_date, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.type,
          data.category,
          data.description,
          data.amount,
          data.payment_method,
          data.status,
          txDate,
          data.notes
        );

      const created = db.prepare('SELECT * FROM cash_flow WHERE id = ?').get(Number(info.lastInsertRowid));
      broadcastEvent('data_updated', { entity: 'cashflow', action: 'create', id: created.id });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const current = db.prepare('SELECT * FROM cash_flow WHERE id = ?').get(id);
      if (!current) {
        return res.status(404).json({ error: 'Lançamento não encontrado.' });
      }

      const data = cashFlowUpdateSchema.parse(req.body);
      const merged = { ...current, ...data };

      db.prepare(
        `UPDATE cash_flow SET
          type = ?, category = ?, description = ?, amount = ?,
          payment_method = ?, status = ?, transaction_date = ?, notes = ?
        WHERE id = ?`
      ).run(
        merged.type,
        merged.category,
        merged.description,
        merged.amount,
        merged.payment_method,
        merged.status,
        merged.transaction_date,
        merged.notes,
        id
      );

      const updated = db.prepare('SELECT * FROM cash_flow WHERE id = ?').get(id);
      broadcastEvent('data_updated', { entity: 'cashflow', action: 'update', id });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT id FROM cash_flow WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }
    db.prepare('DELETE FROM cash_flow WHERE id = ?').run(id);
    broadcastEvent('data_updated', { entity: 'cashflow', action: 'delete', id });
    res.json({ deleted: true });
  });

  return router;
}
