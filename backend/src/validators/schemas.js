import { z } from 'zod';

export const productSchema = z.object({
  sku: z.string().trim().min(2, 'SKU deve ter pelo menos 2 caracteres').max(40),
  name: z.string().trim().min(2, 'Nome do produto é obrigatório').max(120),
  category: z.string().trim().min(2, 'Categoria é obrigatória').max(60),
  artist: z.string().trim().max(80).default('Autoral TKL'),
  print_theme: z.string().trim().max(80).default(''),
  material: z.string().trim().max(100).default(''),
  dimensions: z.string().trim().max(60).default(''),
  edition_batch: z.string().trim().max(80).default(''),
  cost_price: z.coerce.number().min(0, 'Custo não pode ser negativo').default(0),
  sale_price: z.coerce.number().min(0, 'Preço de venda não pode ser negativo').default(0),
  stock_quantity: z.coerce.number().int().min(0, 'Estoque inicial não pode ser negativo').default(0),
  min_stock: z.coerce.number().int().min(0, 'Estoque mínimo não pode ser negativo').default(3),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  notes: z.string().trim().max(500).default('')
});

export const productUpdateSchema = productSchema.partial();

export const stockMovementSchema = z.object({
  product_id: z.coerce.number().int().positive('Produto inválido'),
  type: z.enum(['entrada', 'saida', 'ajuste']),
  reason: z.enum([
    'producao_tiragem',
    'venda',
    'devolucao',
    'avaria_quebra',
    'brinde_parceria',
    'ajuste_inventario'
  ]),
  quantity: z.coerce.number().int().min(0, 'Quantidade inválida'),
  unit_price: z.coerce.number().min(0, 'Valor unitário não pode ser negativo').optional(),
  channel: z.string().trim().max(60).default(''),
  moved_by: z.string().trim().min(2, 'Informe quem realizou a movimentação').max(80),
  notes: z.string().trim().max(500).default(''),
  movement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional(),
  syncCashFlow: z.boolean().default(true),
  payment_method: z.string().trim().max(40).default('Pix'),
  cash_status: z.enum(['confirmado', 'pendente']).default('confirmado')
});

export const cashFlowSchema = z.object({
  type: z.enum(['entrada', 'saida']),
  category: z.string().trim().min(2, 'Categoria é obrigatória').max(60),
  description: z.string().trim().min(2, 'Descrição é obrigatória').max(200),
  amount: z.coerce.number().positive('Valor deve ser maior que zero'),
  payment_method: z.string().trim().min(2).max(40).default('Pix'),
  status: z.enum(['confirmado', 'pendente']).default('confirmado'),
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional(),
  notes: z.string().trim().max(500).default('')
});

export const cashFlowUpdateSchema = cashFlowSchema.partial();

export const integrationSettingsSchema = z.object({
  store_name: z.string().trim().min(2).max(100),
  store_url: z.string().trim().max(250).default(''),
  outbound_webhook_url: z.string().trim().max(250).default(''),
  price_tolerance_percent: z.coerce.number().min(0).max(100).default(5),
  auto_push_stock: z.boolean().default(true),
  reject_price_mismatch: z.boolean().default(true),
  enabled: z.boolean().default(true)
});

export const storefrontOrderWebhookSchema = z.object({
  external_order_id: z.string().trim().min(2, 'ID do pedido externo é obrigatório').max(80),
  idempotency_key: z.string().trim().max(120).optional(),
  customer_name: z.string().trim().max(120).default('Cliente Loja Virtual'),
  payment_method: z.string().trim().min(2).max(40).default('Pix'),
  channel: z.string().trim().max(60).default('Loja Virtual'),
  discount: z.coerce.number().min(0).default(0),
  order_total: z.coerce.number().min(0).optional(),
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1, 'SKU do item é obrigatório').max(40),
        quantity: z.coerce.number().int().positive('Quantidade do item deve ser maior que zero'),
        unit_price: z.coerce.number().min(0, 'Preço unitário inválido')
      })
    )
    .min(1, 'Pedido deve conter ao menos 1 item')
});
