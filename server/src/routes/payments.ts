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

  // Helcim.js payment page — serves an HTML form that POSTs to Helcim
  app.get<{ Querystring: { amount: string; table: string } }>('/api/payments/helcim/pay', (req, reply) => {
    const jsToken = getSetting('helcim_js_token');
    if (!jsToken) return reply.status(400).send('Helcim.js not configured');

    const isSandbox = getSetting('sandbox_mode') === '1';
    const helcimUrl = isSandbox
      ? 'https://mypostest.helcim.com/helcim.js/version2'
      : 'https://secure.myhelcim.com/helcim.js/version2';

    const amount = req.query.amount || '0.00';
    const table = req.query.table || '';
    const currency = (getDb().prepare("SELECT value FROM settings WHERE key = 'currency_symbol'").get() as any)?.value || '$';

    reply.type('text/html').send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Card Payment</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#1e293b;border-radius:20px;padding:32px;width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
  h2{text-align:center;margin-bottom:8px;font-size:20px}
  .amount{text-align:center;font-size:32px;font-weight:900;color:#22c55e;margin-bottom:24px}
  label{display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;font-weight:600}
  input{width:100%;background:#334155;border:2px solid #475569;border-radius:12px;padding:14px 16px;color:#f8fafc;font-size:18px;outline:none;margin-bottom:16px}
  input::placeholder{color:#64748b}
  input:focus{border-color:#3b82f6}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .row input{text-align:center}
  button{width:100%;background:#3b82f6;color:#fff;border:none;border-radius:16px;padding:18px;font-size:18px;font-weight:700;cursor:pointer;margin-top:8px}
  button:hover{background:#2563eb}
  button:disabled{opacity:0.5;cursor:not-allowed}
  .cancel{background:#334155;margin-top:8px;font-size:14px}
  .cancel:hover{background:#475569}
  .error{background:#ef444420;color:#ef4444;padding:12px;border-radius:10px;text-align:center;font-size:14px;margin-bottom:16px;display:none}
  .spinner{display:none;text-align:center;padding:20px}
  .spinner div{width:40px;height:40px;border:4px solid #3b82f630;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px}
  @keyframes spin{to{transform:rotate(360deg)}}
</style></head><body>
<div class="card">
  <h2>Card Payment</h2>
  <div class="amount">${currency}${amount}</div>
  <div class="error" id="error"></div>
  <div id="form-area">
    <form id="payForm" method="POST" action="${helcimUrl}">
      <input type="hidden" name="token" value="${jsToken}">
      <input type="hidden" name="amount" value="${amount}">
      <input type="hidden" name="language" value="en">
      ${isSandbox ? '<input type="hidden" name="test" value="1">' : ''}
      <label>Card Number</label>
      <input name="cardNumber" placeholder="4242 4242 4242 4242" inputmode="numeric" maxlength="19" required autofocus
        oninput="let v=this.value.replace(/\\D/g,'').slice(0,16);this.value=v.replace(/(\\d{4})/g,'$1 ').trim()">
      <div class="row">
        <div><label>Expiry</label><input name="cardExpiryMonth" placeholder="MM" maxlength="2" inputmode="numeric" required
          oninput="this.value=this.value.replace(/\\D/g,'').slice(0,2)"></div>
        <div><label>Year</label><input name="cardExpiryYear" placeholder="YY" maxlength="2" inputmode="numeric" required
          oninput="this.value=this.value.replace(/\\D/g,'').slice(0,2)"></div>
      </div>
      <label>CVV</label>
      <input name="cardCVV" placeholder="123" maxlength="4" inputmode="numeric" required
        oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)">
      <input type="hidden" name="cardHolderName" value="Customer">
      <input type="hidden" name="cardHolderAddress" value="">
      <input type="hidden" name="cardHolderPostalCode" value="">
      <button type="submit">Pay ${currency}${amount}</button>
    </form>
    <button class="cancel" onclick="window.close()">Cancel</button>
  </div>
  <div class="spinner" id="spinner"><div></div><p>Processing payment...</p></div>
</div>
<script>
document.getElementById('payForm').addEventListener('submit', function() {
  document.getElementById('form-area').style.display = 'none';
  document.getElementById('spinner').style.display = 'block';
});
// Listen for Helcim response (they redirect back or post message)
window.addEventListener('message', function(e) {
  try {
    var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (d.response == 1) {
      window.opener && window.opener.postMessage(JSON.stringify({eventName:'helcim-pay-success',transactionId:d.transactionId}), '*');
      document.querySelector('.card').innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:60px;margin-bottom:16px">✅</div><h2 style="color:#22c55e;margin-bottom:8px">Approved!</h2><p style="color:#94a3b8">You can close this window</p></div>';
      setTimeout(function(){window.close()}, 2000);
    }
  } catch(ex){}
});
</script>
</body></html>`);
  });

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
