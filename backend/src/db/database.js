import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Inicializa o banco de dados SQLite nativo (node:sqlite),
 * cria as tabelas e índices necessários, aplica migrações idempotentes e configura PRAGMAs.
 */
export function initDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT 'Autoral TKL',
      print_theme TEXT NOT NULL DEFAULT '',
      material TEXT NOT NULL DEFAULT '',
      dimensions TEXT NOT NULL DEFAULT '',
      edition_batch TEXT NOT NULL DEFAULT '',
      cost_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('entrada', 'saida', 'ajuste')),
      reason TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      unit_price REAL NOT NULL DEFAULT 0,
      total_value REAL NOT NULL DEFAULT 0,
      channel TEXT NOT NULL DEFAULT '',
      moved_by TEXT NOT NULL DEFAULT 'Equipe TKL',
      notes TEXT NOT NULL DEFAULT '',
      movement_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS cash_flow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      payment_method TEXT NOT NULL DEFAULT 'Pix',
      status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'pendente')),
      transaction_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      stock_movement_id INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (stock_movement_id) REFERENCES stock_movements(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS integration_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      store_name TEXT NOT NULL DEFAULT 'Loja Virtual TKL Store AM',
      store_url TEXT NOT NULL DEFAULT '',
      outbound_webhook_url TEXT NOT NULL DEFAULT '',
      api_key TEXT NOT NULL,
      price_tolerance_percent REAL NOT NULL DEFAULT 5,
      auto_push_stock INTEGER NOT NULL DEFAULT 1,
      reject_price_mismatch INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS integration_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      event_type TEXT NOT NULL,
      external_order_id TEXT NOT NULL DEFAULT '',
      idempotency_key TEXT UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('sincronizado', 'rejeitado', 'duplicado', 'erro')),
      error_code TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_artist ON products(artist);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date);
    CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON cash_flow(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_cash_flow_type ON cash_flow(type);
    CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON integration_logs(status);
  `);

  // Migração idempotente para bancos existentes sem a coluna moved_by
  const stockCols = db.prepare('PRAGMA table_info(stock_movements)').all();
  if (!stockCols.some((c) => c.name === 'moved_by')) {
    db.exec("ALTER TABLE stock_movements ADD COLUMN moved_by TEXT NOT NULL DEFAULT 'Equipe TKL';");
  }

  // Garante existência da linha de configuração da integração (id = 1)
  const settingsRow = db.prepare('SELECT id FROM integration_settings WHERE id = 1').get();
  if (!settingsRow) {
    const initialKey = `tkl_live_${crypto.randomBytes(16).toString('hex')}`;
    db.prepare('INSERT INTO integration_settings (id, api_key) VALUES (1, ?)').run(initialKey);
  }

  return db;
}

/**
 * Executa uma função dentro de uma transação SQLite explícita.
 */
export function runInTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
