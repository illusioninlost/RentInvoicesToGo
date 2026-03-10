require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const emailConfig = require('./email.config');
const db = require('./db');
const invoiceRoutes = require('./routes/invoices');
const clientRoutes = require('./routes/clients');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/invoices', requireAuth, invoiceRoutes);
app.use('/api/clients', requireAuth, clientRoutes);

// Reports endpoint with filter query params
app.get('/api/reports', requireAuth, (req, res) => {
  const { startDate, endDate, client, status } = req.query;
  const conditions = ['user_id = ?'];
  const params = [req.userId];

  if (startDate) { conditions.push('date_created >= ?'); params.push(startDate); }
  if (endDate)   { conditions.push('date_created <= ?'); params.push(endDate); }
  if (client)    { conditions.push('LOWER(client_name) LIKE ?'); params.push(`%${client.toLowerCase()}%`); }
  if (status)    { conditions.push('status = ?'); params.push(status); }

  const where = 'WHERE ' + conditions.join(' AND ');
  const invoices = db.prepare(`SELECT * FROM invoices ${where} ORDER BY date_created DESC`).all(...params);
  res.json(invoices.map(inv => ({ ...inv, items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items })));
});

// Email invoice to tenant
app.post('/api/invoices/:id/email', requireAuth, async (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (!inv.client_email) return res.status(400).json({ error: 'This invoice has no tenant email address.' });

  const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
  const fmt = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e5ea;">${it.description || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e5ea;text-align:right;">${it.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e5ea;text-align:right;">${fmt(it.unit_price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e5ea;text-align:right;">${fmt(it.amount)}</td>
    </tr>`).join('');

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;color:#1a1d23;">
      <div style="background:#2563eb;padding:24px 32px;border-radius:8px 8px 0 0;">
        <span style="color:#fff;font-size:20px;font-weight:700;">RentInvoicesToGo</span>
      </div>
      <div style="background:#fff;border:1px solid #e2e5ea;border-top:none;padding:32px;border-radius:0 0 8px 8px;">
        <h2 style="margin:0 0 4px;">Invoice ${inv.invoice_number}</h2>
        <p style="margin:0 0 24px;color:#6b7280;">Due: <strong>${inv.due_date}</strong></p>
        <p>Hi ${inv.client_name},</p>
        <p>Please find your rental invoice details below.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;">
          <thead>
            <tr style="background:#f7f8fa;">
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e5ea;">Description</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e2e5ea;">Qty</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e2e5ea;">Unit Price</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e2e5ea;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="text-align:right;font-size:14px;">
          <div style="margin-bottom:6px;color:#6b7280;">Subtotal: <strong style="color:#1a1d23;">${fmt(inv.subtotal)}</strong></div>
          ${inv.tax_rate > 0 ? `<div style="margin-bottom:6px;color:#6b7280;">Tax (${inv.tax_rate}%): <strong style="color:#1a1d23;">${fmt(inv.tax_amount)}</strong></div>` : ''}
          <div style="font-size:18px;font-weight:700;border-top:2px solid #e2e5ea;padding-top:10px;margin-top:6px;">Total Due: ${fmt(inv.total)}</div>
        </div>
        ${inv.notes ? `<p style="margin-top:24px;color:#6b7280;font-size:13px;border-top:1px solid #e2e5ea;padding-top:16px;">${inv.notes}</p>` : ''}
      </div>
    </div>`;

  try {
    if (!emailConfig.user || !emailConfig.pass) {
      return res.status(500).json({ error: 'Email not configured. Fill in server/email.config.js with your SMTP credentials.' });
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    await transporter.sendMail({
      from: emailConfig.from || emailConfig.user,
      to: inv.client_email,
      subject: `Rental Invoice ${inv.invoice_number} — ${fmt(inv.total)} Due ${inv.due_date}`,
      html,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
