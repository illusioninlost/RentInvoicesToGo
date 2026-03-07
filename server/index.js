const express = require('express');
const cors = require('cors');
const db = require('./db');
const invoiceRoutes = require('./routes/invoices');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/invoices', invoiceRoutes);

// Reports endpoint with filter query params
app.get('/api/reports', (req, res) => {
  const { startDate, endDate, client, status } = req.query;
  const conditions = [];
  const params = [];

  if (startDate) { conditions.push('date_created >= ?'); params.push(startDate); }
  if (endDate)   { conditions.push('date_created <= ?'); params.push(endDate); }
  if (client)    { conditions.push('LOWER(client_name) LIKE ?'); params.push(`%${client.toLowerCase()}%`); }
  if (status)    { conditions.push('status = ?'); params.push(status); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const invoices = db.prepare(`SELECT * FROM invoices ${where} ORDER BY date_created DESC`).all(...params);
  res.json(invoices.map(inv => ({ ...inv, items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items })));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
