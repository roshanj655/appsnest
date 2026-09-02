# ERP SaaS

Database-per-tenant inventory ERP (React + Express + MongoDB) for Indian retail: catalog, parties, purchases, POS, GST invoices, and unit-wise reports.

## Documentation

**[User guide](docs/USER_GUIDE.md)** — run locally, roles, business units, POS (including amount received), sales invoices, reports, API notes, troubleshooting.

## Quick start

```bash
npm run dev:backend
npm run dev:frontend
```

- UI: http://localhost:3000  
- API: http://localhost:5000  

Configure `backend/.env` (`MASTER_DATABASE_URI`, JWT, `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`). Do not commit that file.

Backend `dev` uses `tsx` and does not auto-reload. Restart it after API changes.
