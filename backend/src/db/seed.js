import { runInTransaction } from './database.js';

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatIsoDate(d);
}

function monthDay(monthsBack, day) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsBack);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return formatIsoDate(d);
}

/**
 * Popula o banco com o catálogo real observado na TKL Store AM (@tklstoream)
 * e um histórico demonstrativo de 3 meses caso a tabela de produtos esteja vazia.
 */
export function seedDatabase(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM products').get();
  if (count > 0) return;

  runInTransaction(db, () => {
    const insertProduct = db.prepare(`
      INSERT INTO products (
        sku, name, category, artist, print_theme, material,
        dimensions, edition_batch, cost_price, sale_price,
        stock_quantity, min_stock, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialProducts = [
      [
        'TKL-LEN-PIR-70',
        'Lenço Pirarucu Vibrante',
        'Lenços',
        'Autoral TKL',
        'Pirarucu',
        'Poliéster com elastano',
        '70×70 cm',
        'Tiragem 01/2026 (25 un.)',
        34.0,
        89.0,
        8,
        4,
        'ativo',
        'Estampa amazônica vibrante; pode ser usado como lenço ou saída de praia.'
      ],
      [
        'TKL-LEN-PIR-90',
        'Lenço Pirarucu Vibrante Grande',
        'Lenços',
        'Autoral TKL',
        'Pirarucu',
        'Poliéster com elastano',
        '90×90 cm',
        'Tiragem 01/2026 (20 un.)',
        42.0,
        109.0,
        2,
        3,
        'ativo',
        'Últimas unidades da primeira tiragem.'
      ],
      [
        'TKL-LEN-PRS-70',
        'Lenço Pirarucu Sóbrio Preto',
        'Lenços',
        'Autoral TKL',
        'Pirarucu',
        'Poliéster com elastano',
        '70×70 cm',
        'Tiragem 01/2026 (15 un.)',
        34.0,
        89.0,
        5,
        3,
        'ativo',
        'Versão mais sóbria em preto com grafismo de escamas.'
      ],
      [
        'TKL-LEN-BUS-90',
        'Lenço Busto Amazônida',
        'Lenços',
        'Turenko Beça',
        'Busto Amazônida',
        'Poliéster com elastano',
        '90×90 cm',
        'Tiragem Assinada 01/2026 (15 un.)',
        45.0,
        109.0,
        3,
        3,
        'ativo',
        'Obra de Turenko Beça — estilo gravura em preto e branco.'
      ],
      [
        'TKL-LEN-TEA-90',
        'Lenço Geométrico Teatro Amazonas',
        'Lenços',
        'Lucio Dias',
        'Teatro Amazonas',
        'Poliéster com elastano',
        '90×90 cm',
        'Tiragem 02/2026 (20 un.)',
        44.0,
        109.0,
        9,
        3,
        'ativo',
        'Fundo marfim com bordas geométricas inspiradas no Teatro Amazonas.'
      ],
      [
        'TKL-LEN-BOR-70',
        'Lenço Borboleta Amazônica',
        'Lenços',
        'Autoral TKL',
        'Borboleta',
        'Poliéster com elastano',
        '70×70 cm',
        'Tiragem 02/2026 (20 un.)',
        34.0,
        89.0,
        6,
        3,
        'ativo',
        'Motivo borboleta em cores amazônicas.'
      ],
      [
        'TKL-PRA-TEA-26',
        'Prato Decorativo Teatro Amazonas',
        'Pratos Decorativos',
        'Lucio Dias',
        'Teatro Amazonas',
        'Cerâmica branca esmaltada',
        'Ø 26 cm',
        'Tiragem 01/2026 (12 un.)',
        58.0,
        149.0,
        4,
        3,
        'ativo',
        'Valor estimado para testes; acompanha suporte ou gancho dourado opcional.'
      ],
      [
        'TKL-PRA-BOR-26',
        'Prato Decorativo Borboleta Estilizada',
        'Pratos Decorativos',
        'Autoral TKL',
        'Borboleta',
        'Cerâmica branca esmaltada',
        'Ø 26 cm',
        'Tiragem 01/2026 (12 un.)',
        55.0,
        139.0,
        2,
        3,
        'ativo',
        'Valor estimado para testes; peça decorativa simétrica.'
      ],
      [
        'TKL-PRA-PEI-26',
        'Prato Decorativo Dois Peixes Amazônicos',
        'Pratos Decorativos',
        'Turenko Beça',
        'Peixes Amazônicos',
        'Cerâmica branca esmaltada',
        'Ø 26 cm',
        'Tiragem 01/2026 (10 un.)',
        58.0,
        149.0,
        5,
        2,
        'ativo',
        'Valor estimado para testes; arte regional em louça branca.'
      ],
      [
        'TKL-XIC-BOR-80',
        'Conjunto Xícara e Pires 80 ml',
        'Xícaras e Pires',
        'Lucio Dias',
        'Borboleta / Teatro Amazonas',
        'Cerâmica esmaltada',
        '80 ml',
        'Tiragem 01/2026 (30 un.)',
        12.5,
        30.0,
        14,
        5,
        'ativo',
        'Conjunto pequeno de café expresso em cerâmica esmaltada.'
      ]
    ];

    const productIds = {};
    for (const row of initialProducts) {
      const info = insertProduct.run(...row);
      productIds[row[0]] = Number(info.lastInsertRowid);
    }

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (
        product_id, type, reason, quantity, previous_stock, new_stock,
        unit_price, total_value, channel, moved_by, notes, movement_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCash = db.prepare(`
      INSERT INTO cash_flow (
        type, category, description, amount, payment_method,
        status, transaction_date, stock_movement_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const movementsSeed = [
      {
        sku: 'TKL-LEN-PIR-70',
        type: 'entrada',
        reason: 'producao_tiragem',
        qty: 12,
        prev: 0,
        next: 12,
        unit: 34.0,
        channel: 'Ateliê',
        date: monthDay(2, 5),
        notes: 'Recebimento lote inicial Pirarucu 70x70',
        cash: { type: 'saida', category: 'Produção/Tiragem', method: 'Transferência', status: 'confirmado' }
      },
      {
        sku: 'TKL-LEN-TEA-90',
        type: 'entrada',
        reason: 'producao_tiragem',
        qty: 12,
        prev: 0,
        next: 12,
        unit: 44.0,
        channel: 'Ateliê',
        date: monthDay(2, 6),
        notes: 'Recebimento lote Teatro Amazonas 90x90',
        cash: { type: 'saida', category: 'Produção/Tiragem', method: 'Transferência', status: 'confirmado' }
      },
      {
        sku: 'TKL-PRA-TEA-26',
        type: 'entrada',
        reason: 'producao_tiragem',
        qty: 8,
        prev: 0,
        next: 8,
        unit: 58.0,
        channel: 'Ateliê',
        date: monthDay(2, 8),
        notes: 'Lote inicial pratos Teatro Amazonas',
        cash: { type: 'saida', category: 'Produção/Tiragem', method: 'Pix', status: 'confirmado' }
      },
      {
        sku: 'TKL-XIC-BOR-80',
        type: 'entrada',
        reason: 'producao_tiragem',
        qty: 20,
        prev: 0,
        next: 20,
        unit: 12.5,
        channel: 'Ateliê',
        date: monthDay(2, 10),
        notes: 'Lote inicial xícaras 80 ml',
        cash: { type: 'saida', category: 'Produção/Tiragem', method: 'Pix', status: 'confirmado' }
      },
      {
        sku: 'TKL-LEN-PIR-70',
        type: 'saida',
        reason: 'venda',
        qty: 4,
        prev: 12,
        next: 8,
        unit: 89.0,
        channel: 'Instagram Direct',
        date: monthDay(2, 18),
        notes: 'Pedidos via Direct (@tklstoream)',
        cash: { type: 'entrada', category: 'Venda de Produtos', method: 'Pix', status: 'confirmado' }
      },
      {
        sku: 'TKL-PRA-TEA-26',
        type: 'saida',
        reason: 'venda',
        qty: 3,
        prev: 8,
        next: 5,
        unit: 149.0,
        channel: 'Feira/Evento',
        date: monthDay(1, 9),
        notes: 'Exposição Ideal Clube Manaus',
        cash: { type: 'entrada', category: 'Eventos/Feiras', method: 'Cartão de Crédito', status: 'confirmado' }
      },
      {
        sku: 'TKL-LEN-BUS-90',
        type: 'saida',
        reason: 'venda',
        qty: 3,
        prev: 6,
        next: 3,
        unit: 109.0,
        channel: 'Instagram Direct',
        date: monthDay(1, 14),
        notes: 'Venda coleção Turenko Beça',
        cash: { type: 'entrada', category: 'Venda de Produtos', method: 'Pix', status: 'confirmado' }
      },
      {
        sku: 'TKL-XIC-BOR-80',
        type: 'saida',
        reason: 'venda',
        qty: 6,
        prev: 20,
        next: 14,
        unit: 30.0,
        channel: 'Linktree/WhatsApp',
        date: monthDay(1, 21),
        notes: 'Kit café para presente corporativo',
        cash: { type: 'entrada', category: 'Venda de Produtos', method: 'Pix', status: 'confirmado' }
      },
      {
        sku: 'TKL-PRA-TEA-26',
        type: 'saida',
        reason: 'avaria_quebra',
        qty: 1,
        prev: 5,
        next: 4,
        unit: 58.0,
        channel: 'Ateliê',
        date: monthDay(1, 24),
        notes: 'Trinca no manuseio do estoque',
        cash: null
      },
      {
        sku: 'TKL-LEN-TEA-90',
        type: 'saida',
        reason: 'venda',
        qty: 3,
        prev: 12,
        next: 9,
        unit: 109.0,
        channel: 'Instagram Direct',
        date: daysAgo(6),
        notes: 'Vendas da semana via Direct',
        cash: { type: 'entrada', category: 'Venda de Produtos', method: 'Pix', status: 'confirmado' }
      },
      {
        sku: 'TKL-LEN-PIR-90',
        type: 'saida',
        reason: 'venda',
        qty: 2,
        prev: 4,
        next: 2,
        unit: 109.0,
        channel: 'Feira/Evento',
        date: daysAgo(3),
        notes: 'Últimas unidades da tiragem Pirarucu 90×90',
        cash: { type: 'entrada', category: 'Eventos/Feiras', method: 'Cartão de Débito', status: 'confirmado' }
      },
      {
        sku: 'TKL-PRA-BOR-26',
        type: 'saida',
        reason: 'brinde_parceria',
        qty: 1,
        prev: 3,
        next: 2,
        unit: 55.0,
        channel: 'Ateliê',
        date: daysAgo(2),
        notes: 'Peça enviada para ensaio fotográfico',
        cash: null
      }
    ];

    for (const m of movementsSeed) {
      const productId = productIds[m.sku];
      const total = Number((m.qty * m.unit).toFixed(2));
      const movedBy =
        m.channel === 'Ateliê'
          ? 'Ateliê TKL'
          : m.channel === 'Feira/Evento'
            ? 'Gestão TKL'
            : 'Vendas Direct';
      const info = insertMovement.run(
        productId,
        m.type,
        m.reason,
        m.qty,
        m.prev,
        m.next,
        m.unit,
        total,
        m.channel,
        movedBy,
        m.notes,
        m.date
      );
      const movementId = Number(info.lastInsertRowid);

      if (m.cash) {
        const prefix = m.type === 'entrada' ? 'Produção' : 'Venda';
        insertCash.run(
          m.cash.type,
          m.cash.category,
          `${prefix}: ${m.qty}x ${m.sku}`,
          total,
          m.cash.method,
          m.cash.status,
          m.date,
          movementId,
          m.notes
        );
      }
    }

    const extraCashEntries = [
      ['saida', 'Embalagens/Suportes', 'Suportes metálicos dourados e caixas kraft TKL', 280.0, 'Pix', 'confirmado', monthDay(2, 12), 'Compra para exposição de pratos'],
      ['saida', 'Repasse Artistas', 'Direitos autorais lote 01 — Turenko Beça e Lucio Dias', 420.0, 'Transferência', 'confirmado', monthDay(1, 15), 'Acerto mensal de peças vendidas'],
      ['saida', 'Marketing', 'Impulsionamento Reels @tklstoream', 150.0, 'Cartão de Crédito', 'confirmado', monthDay(1, 19), 'Campanha lançamento lenços'],
      ['saida', 'Fretes/Entregas', 'Motoboy e envios Correios Manaus/BR', 115.0, 'Pix', 'confirmado', daysAgo(5), 'Entregas da quinzena'],
      ['entrada', 'Encomenda', 'Sinal encomenda corporativa 10x Xícaras', 150.0, 'Pix', 'pendente', daysAgo(1), 'Aguardando confirmação de pagamento do cliente']
    ];

    for (const entry of extraCashEntries) {
      insertCash.run(entry[0], entry[1], entry[2], entry[3], entry[4], entry[5], entry[6], null, entry[7]);
    }
  });
}
