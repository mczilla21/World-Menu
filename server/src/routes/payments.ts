import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';

function getSetting(key: string): string {
  return (getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as any)?.value || '';
}

function getOrderTotal(tableNumber: string): number {
  const db = getDb();
  const orders = db.prepare(
    "SELECT id FROM orders WHERE table_number = ? AND closed = 0 AND is_archived = 0"
  ).all(tableNumber) as any[];
  if (orders.length === 0) return 0;
  const ph = orders.map(() => '?').join(',');
  const result = db.prepare(
    `SELECT SUM(item_price * quantity) as total FROM order_items WHERE order_id IN (${ph})`
  ).get(...orders.map((o: any) => o.id)) as any;
  return result?.total || 0;
}

export function registerPaymentRoutes(app: FastifyInstance) {
  // Get active payment provider
  app.get('/api/payments/provider', () => {
    const stripe = getSetting('stripe_secret_key');
    const square = getSetting('square_access_token');
    const helcim = getSetting('helcim_api_token');
    return {
      stripe: !!stripe,
      square: !!square,
      helcim: !!helcim,
      active: helcim ? 'helcim' : square ? 'square' : stripe ? 'stripe' : 'none',
    };
  });

  // ============================================
  // STRIPE
  // ============================================
  app.post<{ Body: { table_number: string; amount?: number } }>('/api/payments/stripe/create', async (req, reply) => {
    const stripeKey = getSetting('stripe_secret_key');
    if (!stripeKey) return reply.status(400).send({ error: 'Stripe not configured' });

    let amount = req.body.amount || Math.round(getOrderTotal(req.body.table_number) * 100);
    if (amount <= 0) return reply.status(400).send({ error: 'Amount must be > 0' });

    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey);
      const intent = await stripe.paymentIntents.create({
        amount, currency: 'usd',
        metadata: { table_number: req.body.table_number },
      });
      return { clientSecret: intent.client_secret, amount };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ============================================
  // SQUARE
  // ============================================
  app.post<{ Body: { table_number: string; amount?: number; source_id?: string } }>('/api/payments/square/create', async (req, reply) => {
    const accessToken = getSetting('square_access_token');
    const locationId = getSetting('square_location_id');
    if (!accessToken || !locationId) return reply.status(400).send({ error: 'Square not configured' });

    let amountCents = req.body.amount || Math.round(getOrderTotal(req.body.table_number) * 100);
    if (amountCents <= 0) return reply.status(400).send({ error: 'Amount must be > 0' });

    try {
      const { randomUUID } = await import('crypto');
      const response = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'POST',
        headers: {
          'Square-Version': '2024-01-18',
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idempotency_key: randomUUID(),
          source_id: req.body.source_id || 'EXTERNAL',
          amount_money: { amount: amountCents, currency: 'USD' },
          location_id: locationId,
          note: `Table ${req.body.table_number}`,
        }),
      });

      const data = await response.json();
      if (data.errors) {
        return reply.status(400).send({ error: data.errors[0]?.detail || 'Square error' });
      }
      return { ok: true, payment: data.payment };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ============================================
  // HELCIM
  // ============================================
  // Step 1: Initialize checkout (server-side) — returns a checkoutToken
  app.post<{ Body: { table_number: string; amount?: number } }>('/api/payments/helcim/init', async (req, reply) => {
    const apiToken = getSetting('helcim_api_token');
    if (!apiToken) return reply.status(400).send({ error: 'Helcim not configured' });

    let amountCents = req.body.amount || Math.round(getOrderTotal(req.body.table_number) * 100);
    if (amountCents <= 0) return reply.status(400).send({ error: 'Amount must be > 0' });

    const amount = (amountCents / 100).toFixed(2);

    try {
      const response = await fetch('https://api.helcim.com/v2/helcim-pay/initialize', {
        method: 'POST',
        headers: {
          'api-token': apiToken,
          'Content-Type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          paymentType: 'purchase',
          amount: parseFloat(amount),
          currency: 'USD',
        }),
      });

      const data = await response.json();
      if (data.checkoutToken) {
        return { ok: true, checkoutToken: data.checkoutToken, secretToken: data.secretToken, amount };
      }
      return reply.status(400).send({ error: data.message || 'Helcim init failed' });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Direct card charge — requires "Payment API" permission on the Helcim API token
  app.post<{ Body: { table_number: string; amount: number; card_number: string; expiry: string; cvv: string; cardholder_name?: string } }>(
    '/api/payments/helcim/charge',
    async (req, reply) => {
      const apiToken = getSetting('helcim_api_token');
      if (!apiToken) return reply.status(400).send({ error: 'Helcim not configured' });

      const { amount, card_number, expiry, cvv, cardholder_name } = req.body;
      if (!card_number || !expiry || !cvv || !amount) {
        return reply.status(400).send({ error: 'Missing card details' });
      }

      const cleaned = expiry.replace(/[^0-9]/g, '');
      const cardExpiry = cleaned.slice(0, 2) + (cleaned.length === 4 ? cleaned.slice(2, 4) : cleaned.slice(2));

      try {
        const { randomUUID } = await import('crypto');
        const response = await fetch('https://api.helcim.com/v2/payment/purchase', {
          method: 'POST',
          headers: {
            'api-token': apiToken,
            'idempotency-key': randomUUID(),
            'Content-Type': 'application/json',
            'accept': 'application/json',
          },
          body: JSON.stringify({
            amount: amount / 100,
            currency: 'USD',
            ipAddress: req.ip || '127.0.0.1',
            ecommerce: true,
            cardData: {
              cardNumber: card_number.replace(/\s/g, ''),
              cardExpiry,
              cardCVV: cvv,
              cardHolderName: cardholder_name || 'Customer',
            },
          }),
        });

        const data = await response.json() as any;
        console.log('[Helcim charge]', response.status, JSON.stringify(data));
        if (data.status === 'APPROVED' || data.transactionId) {
          return { ok: true, transactionId: data.transactionId, status: data.status, approvalCode: data.approvalCode };
        }
        const errMsg = data.errors?.cardNumber || data.errors?.message || data.errors?.[0]?.message || data.message || JSON.stringify(data);
        return reply.status(400).send({ error: errMsg });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  // ============================================
  // UNIFIED - uses whichever is configured (priority: helcim > square > stripe)
  // ============================================
  app.post<{ Body: { table_number: string; amount?: number } }>('/api/payments/create-intent', async (req, reply) => {
    const helcim = getSetting('helcim_api_token');
    const square = getSetting('square_access_token');
    const stripe = getSetting('stripe_secret_key');

    if (helcim) {
      return app.inject({ method: 'POST', url: '/api/payments/helcim/init', payload: req.body }).then(r => {
        reply.status(r.statusCode).send(r.json());
      });
    } else if (square) {
      return app.inject({ method: 'POST', url: '/api/payments/square/create', payload: req.body }).then(r => {
        reply.status(r.statusCode).send(r.json());
      });
    } else if (stripe) {
      return app.inject({ method: 'POST', url: '/api/payments/stripe/create', payload: req.body }).then(r => {
        reply.status(r.statusCode).send(r.json());
      });
    } else {
      return reply.status(400).send({ error: 'No payment provider configured. Add Helcim, Stripe, or Square keys in Admin → Settings.' });
    }
  });
}
