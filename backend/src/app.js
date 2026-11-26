import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { initDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { createProductsRouter } from './routes/products.js';
import { createStockRouter } from './routes/stock.js';
import { createCashFlowRouter } from './routes/cashflow.js';
import { createReportsRouter } from './routes/reports.js';
import { createIntegrationsRouter } from './routes/integrations.js';
import { registerSseClient } from './services/realtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ dbPath, seed = true } = {}) {
  const resolvedDbPath = dbPath || path.resolve(__dirname, '../data/tkl_store.db');
  const db = initDatabase(resolvedDbPath);

  if (seed) {
    seedDatabase(db);
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', store: 'TKL Store AM' });
  });

  app.get('/api/events', registerSseClient);

  app.use('/api/products', createProductsRouter(db));
  app.use('/api/stock', createStockRouter(db));
  app.use('/api/cashflow', createCashFlowRouter(db));
  app.use('/api/reports', createReportsRouter(db));
  app.use('/api/integrations', createIntegrationsRouter(db));

  // Servir esboço da vitrine pública (Fase 1 pré-integração)
  const vitrineDir = path.resolve(__dirname, '../../vitrine');
  if (fs.existsSync(path.join(vitrineDir, 'index.html'))) {
    app.use('/vitrine', express.static(vitrineDir));
  }

  // Servir portfólio estático para análise do cliente
  const portfolioDir = path.resolve(__dirname, '../../portfolio');
  if (fs.existsSync(path.join(portfolioDir, 'index.html'))) {
    app.use('/portfolio', express.static(portfolioDir));
  }

  // Servir build de produção do front-end caso exista
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: err.errors.map((e) => e.message).join('; ')
      });
    }
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Erro interno do servidor.' });
  });

  return { app, db };
}
