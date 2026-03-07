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

There are no tests or linting configured at the root level. The client has ESLint via `client/eslint.config.js` but no lint script is wired up.

## Architecture

This is a full-stack invoice management app with a separate Express backend and Vite React frontend communicating via proxied `/api` requests.

### Backend (`server/`)

- **`db.js`** — Opens/creates `server/invoices.db` using Node's built-in `node:sqlite` module (requires `--experimental-sqlite` flag). Runs `CREATE TABLE IF NOT EXISTS` on startup. The DB file is created automatically on first run.
- **`routes/invoices.js`** — All invoice CRUD. Uses positional `?` params (not named `@param`) throughout to avoid `node:sqlite`'s requirement of prefixing named param keys with `@` in JS objects.
- **`index.js`** — Mounts invoice routes at `/api/invoices`. The `/api/reports` route lives directly in `index.js` (not in the routes file) and builds a dynamic WHERE clause from query params: `startDate`, `endDate`, `client`, `status`.

**Why `node:sqlite` instead of `better-sqlite3`:** `better-sqlite3` requires native compilation (node-gyp + Python). Node 24 has no prebuilt binaries for it. `node:sqlite` is built into Node 22+ and needs no compilation.

### Frontend (`client/src/`)

- **`App.jsx`** — Sets up `BrowserRouter`, the sticky `Navbar` with active-link styling, and all four routes.
- **`index.css`** — All styling lives here as a single flat CSS file using CSS custom properties (`--primary`, `--bg`, `--border`, etc.). No CSS modules or styled-components. Print styles at the bottom hide nav/buttons for PDF export.
- **`pages/InvoiceForm.jsx`** — Shared for both create (`/invoices/new`) and edit (`/invoices/:id/edit`). Detects mode via `useParams`. Line item totals (`amount = qty × unit_price`) and invoice totals (subtotal → tax → total) are computed inline on every render — no separate calculation function except `calcTotals()`. Auto-generates `INV-001` style numbers on create by counting existing invoices.
- **`pages/InvoiceDetail.jsx`** — Read-only view. The Print button calls `window.print()`; CSS print media query handles hiding UI chrome.
- **`pages/Reports.jsx`** — Filters are applied only on form submit (not live). Results are `null` (not shown) until first search, then show the results table + summary bar.

### Data flow

All pages fetch directly from `/api/*` using the browser's `fetch`. Vite proxies `/api` to `http://localhost:3001` in dev. The `items` column is stored as a JSON string in SQLite and parsed back to an array in every API response via the `parseItems()` helper in `routes/invoices.js`.

### Invoice data model

The `invoices` table stores computed totals (`subtotal`, `tax_amount`, `total`) alongside raw `items` JSON and `tax_rate`. Totals are calculated on the frontend before saving — there is no server-side recalculation.
