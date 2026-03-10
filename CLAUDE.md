# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js lives at `C:\Program Files\nodejs\` and is not on the default bash PATH. Prefix all `node`/`npm` commands with:
```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

**Start both servers (dev):**
```bash
npm run dev
```

**Stop servers:**
```bash
taskkill //F //IM node.exe
```

**Start servers individually:**
```bash
npm run server   # Express on :3001 (uses --experimental-sqlite flag)
npm run client   # Vite on :5173
```

**Build client for production:**
```bash
npm --prefix client run build
```

**Install all dependencies (after cloning):**
```bash
npm install && npm --prefix client install
```

**Reset database:** Delete `server/invoices.db` — it is recreated automatically on next server start.

There are no tests or linting configured at the root level. The client has ESLint via `client/eslint.config.js` but no lint script is wired up.

## Architecture

This is a full-stack **rental invoice** management app (branded **RentInvoicesToGo**) with a separate Express backend and Vite React frontend communicating via proxied `/api` requests.

### Backend (`server/`)

- **`db.js`** — Opens/creates `server/invoices.db` using Node's built-in `node:sqlite` module (requires `--experimental-sqlite` flag). Runs `CREATE TABLE IF NOT EXISTS` on startup. The DB file is created automatically on first run. Includes migration blocks (wrapped in `try/catch`) to add columns to existing databases.
- **`routes/invoices.js`** — All invoice CRUD. Uses positional `?` params (not named `@param`) throughout to avoid `node:sqlite`'s requirement of prefixing named param keys with `@` in JS objects.
- **`routes/clients.js`** — Client (tenant) CRUD. Scoped per `user_id`.
- **`index.js`** — Mounts routes at `/api/invoices`, `/api/clients`, `/api/auth`. The `/api/reports` route and `/api/invoices/:id/email` route live directly in `index.js`. Reports builds a dynamic WHERE clause from query params: `startDate`, `endDate`, `client`, `status`. Email uses `nodemailer` with SMTP config from environment variables.

**Why `node:sqlite` instead of `better-sqlite3`:** `better-sqlite3` requires native compilation (node-gyp + Python). Node 24 has no prebuilt binaries for it. `node:sqlite` is built into Node 22+ and needs no compilation.

### Email (`nodemailer`)

Email sending requires these environment variables set before starting the server:
```bash
export EMAIL_HOST=smtp.gmail.com
export EMAIL_PORT=587
export EMAIL_USER=you@gmail.com
export EMAIL_PASS=your-app-password
export EMAIL_FROM=you@gmail.com
```
For Gmail, use an App Password (not the regular account password).

### Frontend (`client/src/`)

- **`App.jsx`** — Sets up `BrowserRouter`, the sticky `Navbar` (branded RentInvoicesToGo) with active-link styling, and all routes.
- **`index.css`** — All styling lives here as a single flat CSS file using CSS custom properties (`--primary`, `--bg`, `--border`, etc.). No CSS modules or styled-components. Print styles at the bottom hide nav/buttons for PDF export.
- **`pages/InvoiceForm.jsx`** — Shared for both create (`/invoices/new`) and edit (`/invoices/:id/edit`). Fetches clients for a tenant dropdown (auto-fills name, email, address). Auto-generates `RENT-001` style numbers on create. Line item totals and invoice totals computed via `calcTotals()`.
- **`pages/InvoiceDetail.jsx`** — Read-only invoice view. Has Print/PDF button, Email to Tenant button (calls `/api/invoices/:id/email`), and shows success/error banners. Displays house SVG logo next to brand name.
- **`pages/Reports.jsx`** — Filters applied only on form submit (not live). CSV export includes property address, tenant info, and rental dates.
- **`components/ClientModal.jsx`** — Modal for adding a new client/tenant (name, phone, email, address). Opened from the "+ Add Client" button on the invoice list.
- **`components/ConfirmModal.jsx`** — Generic confirmation modal used for delete and mark-as-paid actions.

### Data flow

All pages fetch directly from `/api/*` using the browser's `fetch`. Vite proxies `/api` to `http://localhost:3001` in dev. The `items` column is stored as a JSON string in SQLite and parsed back to an array in every API response via the `parseItems()` helper in `routes/invoices.js`.

### Database tables

- **`invoices`** — Stores computed totals (`subtotal`, `tax_amount`, `total`) alongside raw `items` JSON, `tax_rate`, `property_address`, `client_name`, `client_email`, `client_address`. Totals are calculated on the frontend before saving — no server-side recalculation.
- **`clients`** — Tenant records (`name`, `address`, `phone`, `email`) scoped per `user_id`.
- **`users`** — Auth accounts (`name`, `email`, `password_hash`).
- **`sessions`** — Auth session tokens.
- **`password_resets`** — Password reset tokens with expiry.
