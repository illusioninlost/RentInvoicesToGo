const express = require('express');
const cors = require('cors');
const db = require('./db');
const invoiceRoutes = require('./routes/invoices');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/invoices', requireAuth, invoiceRoutes);

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
