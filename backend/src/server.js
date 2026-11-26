import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../data/tkl_store.db');

const { app } = createApp({ dbPath, seed: true });

app.listen(port, () => {
  console.log(`TKL Store AM API rodando em http://localhost:${port}`);
});
