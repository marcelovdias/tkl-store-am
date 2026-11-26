import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let baseUrl;
let db;

before(async () => {
  const created = createApp({ dbPath: ':memory:', seed: true });
  db = created.db;
  await new Promise((resolve) => {
    server = created.app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (db) {
    db.close();
  }
});

async function api(path, options = {}) {
  const { headers: customHeaders, ...rest } = options;
  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(customHeaders || {}) }
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, data: json };
}

describe('TKL Store AM API', () => {
  let createdProductId;

  it('deve carregar o catálogo inicial da TKL Store AM (10 produtos)', async () => {
    const res = await api('/api/products');
    assert.equal(res.status, 200);
    assert.equal(res.data.items.length, 10);
    assert.ok(res.data.items.some((p) => p.sku === 'TKL-LEN-PIR-70'));
  });

  it('deve cadastrar novo produto e bloquear SKU duplicado com 409', async () => {
    const payload = {
      sku: 'TKL-LEN-TEST-70',
      name: 'Lenço Anavilhanas Teste',
      category: 'Lenços',
      artist: 'Autoral TKL',
      print_theme: 'Anavilhanas',
      material: 'Poliéster com elastano',
      dimensions: '70×70 cm',
      edition_batch: 'Tiragem Teste',
      cost_price: 35,
      sale_price: 89,
      stock_quantity: 5,
      min_stock: 2
    };

    const res1 = await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
    assert.equal(res1.status, 201);
    assert.equal(res1.data.sku, 'TKL-LEN-TEST-70');
    createdProductId = res1.data.id;

    const resDup = await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
    assert.equal(resDup.status, 409);
  });

  it('deve atualizar um produto existente', async () => {
    const res = await api(`/api/products/${createdProductId}`, {
      method: 'PUT',
      body: JSON.stringify({ sale_price: 95 })
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.sale_price, 95);
  });

  it('deve registrar entrada de estoque e saída por venda sincronizada ao fluxo de caixa', async () => {
    const entryRes = await api('/api/stock/movements', {
      method: 'POST',
      body: JSON.stringify({
        product_id: createdProductId,
        type: 'entrada',
        reason: 'producao_tiragem',
        quantity: 3,
        unit_price: 35,
        channel: 'Ateliê',
        moved_by: 'Maria Artesã',
        syncCashFlow: true,
        payment_method: 'Pix'
      })
    });
    assert.equal(entryRes.status, 201);
    assert.equal(entryRes.data.product.stock_quantity, 8);
    assert.equal(entryRes.data.movement.moved_by, 'Maria Artesã');
    assert.equal(entryRes.data.cashFlowEntry.type, 'saida');
    assert.equal(entryRes.data.cashFlowEntry.amount, 105);

    const saleRes = await api('/api/stock/movements', {
      method: 'POST',
      body: JSON.stringify({
        product_id: createdProductId,
        type: 'saida',
        reason: 'venda',
        quantity: 2,
        unit_price: 95,
        channel: 'Instagram Direct',
        moved_by: 'João Vendas',
        syncCashFlow: true,
        payment_method: 'Pix'
      })
    });
    assert.equal(saleRes.status, 201);
    assert.equal(saleRes.data.product.stock_quantity, 6);
    assert.equal(saleRes.data.movement.moved_by, 'João Vendas');
    assert.equal(saleRes.data.cashFlowEntry.type, 'entrada');
    assert.equal(saleRes.data.cashFlowEntry.amount, 190);
    assert.equal(saleRes.data.cashFlowEntry.stock_movement_id, saleRes.data.movement.id);
  });

  it('deve bloquear saída maior que o estoque disponível (400)', async () => {
    const res = await api('/api/stock/movements', {
      method: 'POST',
      body: JSON.stringify({
        product_id: createdProductId,
        type: 'saida',
        reason: 'venda',
        quantity: 50,
        moved_by: 'João Vendas',
        syncCashFlow: false
      })
    });
    assert.equal(res.status, 400);

    const prod = await api(`/api/products/${createdProductId}`);
    assert.equal(prod.data.product.stock_quantity, 6);
  });

  it('deve criar, atualizar e excluir lançamentos no fluxo de caixa', async () => {
    const createRes = await api('/api/cashflow', {
      method: 'POST',
      body: JSON.stringify({
        type: 'saida',
        category: 'Embalagens/Suportes',
        description: 'Sacolas personalizadas TKL',
        amount: 120,
        payment_method: 'Pix',
        status: 'pendente'
      })
    });
    assert.equal(createRes.status, 201);
    const id = createRes.data.id;

    const updateRes = await api(`/api/cashflow/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'confirmado' })
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.status, 'confirmado');

    const delRes = await api(`/api/cashflow/${id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
  });

  it('deve retornar relatórios gerenciais e exportar CSV UTF-8 com BOM', async () => {
    const summary = await api('/api/reports/summary');
    assert.equal(summary.status, 200);
    assert.ok(typeof summary.data.financial.entradas === 'number');
    assert.ok(typeof summary.data.inventory.stockValueSale === 'number');

    const monthly = await api('/api/reports/cashflow-monthly?months=6');
    assert.equal(monthly.status, 200);
    assert.ok(Array.isArray(monthly.data.series));

    const breakdown = await api('/api/reports/sales-breakdown');
    assert.equal(breakdown.status, 200);
    assert.ok(Array.isArray(breakdown.data.byCategory));
    assert.ok(Array.isArray(breakdown.data.byArtist));

    const csvRawRes = await fetch(`${baseUrl}/api/reports/export?type=products`);
    assert.equal(csvRawRes.status, 200);
    assert.ok(csvRawRes.headers.get('content-type').includes('text/csv'));
    const csvBuf = Buffer.from(await csvRawRes.arrayBuffer());
    assert.equal(csvBuf[0], 0xef);
    assert.equal(csvBuf[1], 0xbb);
    assert.equal(csvBuf[2], 0xbf);
    assert.ok(csvBuf.toString('utf8').includes('SKU;Nome;Categoria'));

    const stockCsvRes = await fetch(`${baseUrl}/api/reports/export?type=stock`);
    assert.equal(stockCsvRes.status, 200);
    const stockCsvText = await stockCsvRes.text();
    assert.ok(stockCsvText.includes('Responsável'));
  });

  it('deve proteger integração com loja virtual contra chave inválida, SKU inexistente, estoque insuficiente, divergência de valor e duplicidade', async () => {
    const setRes = await api('/api/integrations/settings');
    assert.equal(setRes.status, 200);
    const apiKey = setRes.data.settings.api_key;
    assert.ok(apiKey.startsWith('tkl_live_'));

    // 1. Chave inválida -> 401
    const unauth = await api('/api/integrations/webhook/order', {
      method: 'POST',
      headers: { 'X-API-Key': 'chave-errada' },
      body: JSON.stringify({
        external_order_id: 'LV-UNAUTH',
        items: [{ sku: 'TKL-LEN-PIR-70', quantity: 1, unit_price: 89 }]
      })
    });
    assert.equal(unauth.status, 401);

    // 2. Produto inexistente -> 422 SKU_NOT_FOUND
    const missingSku = await api('/api/integrations/webhook/order', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: JSON.stringify({
        external_order_id: 'LV-ERR-SKU',
        items: [{ sku: 'NAO-EXISTE', quantity: 1, unit_price: 89 }]
      })
    });
    assert.equal(missingSku.status, 422);
    assert.equal(missingSku.data.code, 'SKU_NOT_FOUND');

    // 3. Estoque insuficiente -> 409 INSUFFICIENT_STOCK
    const overStock = await api('/api/integrations/webhook/order', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: JSON.stringify({
        external_order_id: 'LV-ERR-EST',
        items: [{ sku: 'TKL-LEN-PIR-70', quantity: 999, unit_price: 89 }]
      })
    });
    assert.equal(overStock.status, 409);
    assert.equal(overStock.data.code, 'INSUFFICIENT_STOCK');

    // 4. Divergência de valor -> 422 PRICE_MISMATCH
    const priceMismatch = await api('/api/integrations/webhook/order', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: JSON.stringify({
        external_order_id: 'LV-ERR-VAL',
        items: [{ sku: 'TKL-LEN-PIR-70', quantity: 1, unit_price: 10 }]
      })
    });
    assert.equal(priceMismatch.status, 422);
    assert.equal(priceMismatch.data.code, 'PRICE_MISMATCH');

    // 5. Pedido válido -> 201 sincronizado + idempotência -> 200 duplicado
    const validOrder = {
      external_order_id: 'LV-OK-1001',
      customer_name: 'Ana Paula',
      items: [{ sku: 'TKL-LEN-PIR-70', quantity: 1, unit_price: 89 }]
    };
    const okRes = await api('/api/integrations/webhook/order', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: JSON.stringify(validOrder)
    });
    assert.equal(okRes.status, 201);
    assert.equal(okRes.data.status, 'sincronizado');

    const dupRes = await api('/api/integrations/webhook/order', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: JSON.stringify(validOrder)
    });
    assert.equal(dupRes.status, 200);
    assert.equal(dupRes.data.duplicate, true);

    // 6. Backup JSON completo
    const backupRes = await api('/api/integrations/backup');
    assert.equal(backupRes.status, 200);
    assert.ok(Array.isArray(backupRes.data.products));
    assert.ok(Array.isArray(backupRes.data.integration_logs));
  });
});
