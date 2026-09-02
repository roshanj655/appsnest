# ERP SaaS — User Guide

Multi-tenant inventory ERP for Indian retail (GST, HSN, walk-in sales, thermal POS). One **tenant** is one company. That company can run several **business units** (for example Disposable, Puja Samagri, General Store) in the same login.

- App: http://localhost:3000
- API: http://localhost:5000 (`/api` is proxied from the app)

---

## 1. Run locally

From the repo root:

```bash
npm run dev:backend
npm run dev:frontend
```

Backend uses `tsx` (not `ts-node`). It does **not** watch files. Restart `npm run dev:backend` after backend code changes.

Create `backend/.env` (gitignored). Typical keys:

| Key | Purpose |
| --- | --- |
| `MASTER_DATABASE_URI` | Master MongoDB (users, businesses, audit) |
| `JWT_SECRET` | Access tokens |
| `PORT` | API port (default `5000`) |
| `SUPER_ADMIN_EMAIL` | Seeded platform admin |
| `SUPER_ADMIN_PASSWORD` | Seeded platform admin |
| `SUPER_ADMIN_NAME` | Optional display name |

Each tenant stores its own MongoDB connection string on the Business record.

---

## 2. Who can log in

| Role | Scope |
| --- | --- |
| **superadmin** | Platform only. Creates tenants. Cannot open tenant POS, products, or reports. |
| **admin** | Full access inside one tenant. |
| **manager** | Most operations; no deletes / some settings. |
| **staff** | Day-to-day sales, purchases, POS, read catalog. |

Only a **superadmin** can register a new tenant (**Register Business**).

---

## 3. First-time setup (tenant)

1. Super admin logs in → **Businesses** → **Register Business** (owner user + tenant database).
2. Log out. Log in as the tenant admin.
3. **Settings**: business name, phone, GSTIN, invoice prefixes, thermal width (58 mm default).
4. **Business Units**: Disposable (`DISP`), Puja Samagri (`PUJA`), General Store (`STORE`) are created automatically if the list is empty. Add more if needed.
5. **Products**: Parent SKU is unique for the tenant. Add **variants** when size/color/pack sizes need their own barcode, cost, selling price, and stock. Parent stock is the sum of variants. POS and sales lookup match parent **or** variant barcode/SKU.
6. Optional: categories, customers, suppliers.

Header selector **All units / Disposable / Puja / Store** filters lists, dashboard, and most reports. Records with no unit appear only under **All units**. SKU uniqueness stays tenant-wide.

---

## 4. POS (counter)

Open **Operations → POS** (or **Open POS** on the dashboard).

### Flow

1. Click in **Barcode / SKU**. Keep it focused. Scanner should send Enter after the code.
2. Each scan adds 1 qty (or +1 if the item is already in the cart). Inactive or out-of-stock items are rejected.
3. Walk-in is the default customer. Choose a customer if needed.
4. Payment: Cash / UPI / Card / Bank.
5. **Amount received**:
   - **Equal to selling total**: bill total = selling total. Extra cash becomes **change**.
   - **Less than selling total**: bill total **is the received amount**. Difference is **concession**. List/selling price is kept on the line; the sale total and POS slip use received.
   - **More than selling total**: bill total stays the selling total; extra is change.
6. **Complete & print POS** or **F12**. Stock is reduced. A POS slip opens the print dialog (not a file download).
7. **Reprint last POS** or **Reprint POS** on today’s tickets prints the same slip with **REPRINT**.

Products must have a matching **barcode** or **SKU** on the product or a variant. Lookup is `GET /api/products/lookup?code=...` (respects the header unit filter). If a product has variants, scan a **variant** barcode.

POS sales are stored with `source: pos`.

---

## 5. Sales register (back office)

**Operations → Sales** is the invoice register, not the counter.

- **New Sale**: pick customer (or leave walk-in), unit, lines. If the product has variants, pick the variant (or scan its barcode). **Close** on a line removes a mistaken item.
- Walk-in: leave customer empty.
- **Invoice (A4)**: tax invoice PDF (`Rs` amounts; Helvetica cannot print `₹`).
- **Reprint POS**: same thermal POS slip as the counter.
- Email / attachments: from the row actions.

---

## 6. Purchases, stock, expenses

| Screen | Use |
| --- | --- |
| Purchases | Supplier invoice number, paid / due, stock in |
| Stock adjustments | Opening, found, damage, loss, etc. |
| Stock history | Movements from sales, purchases, adjustments |
| Stock value / Low stock | Inventory reports |
| Misc expenses | Rent, salary, personal draw — included in profit |

---

## 7. Reports

**Reports** hub shows current-unit dashboard cards (header filter applies).

**Split by business unit** always shows all units plus **Unassigned** and combined totals. The header unit filter does **not** apply to that table (`GET /api/reports/by-unit`).

Other reports (sales, purchases, inventory, low stock, profit) follow the header unit.

Profit = sales − purchases − misc expenses (for the selected unit, or all).

---

## 8. Invoices and printers

| Output | How |
| --- | --- |
| A4 tax invoice | Sales → Invoice (A4) |
| POS / thermal slip | POS complete, Reprint POS, `format=pos` or `thermal` |
| Width | Settings → Thermal Printer Width (mm), default 58 |

Restart the backend after changing invoice/POS code.

---

## 9. API notes (for implementers)

Base path: `/api`. Send `Authorization: Bearer <access>` and, when a unit is selected, `X-Business-Unit-Id`. Use `all` or omit for combined.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` | Access ~1 day, refresh ~30 days |
| POST | `/api/auth/register` | Super admin only |
| GET | `/api/products/lookup` | Exact barcode or SKU |
| GET/POST | `/api/sales` | JSON or FormData; POS sends JSON with `source: "pos"` |
| GET | `/api/sales/:id/invoice` | A4 default; `?format=pos&print=1&reprint=1` |
| GET/POST | `/api/business-units` | Tenant divisions |
| GET | `/api/reports/dashboard` | Unit-scoped |
| GET | `/api/reports/by-unit` | Combined split; ignore unit header |

Empty `customerId` is walk-in (not stored as `""`).

---

## 10. What this is not (yet)

Full warehouse transfers/expiry, first-class returns, forgot password, loyalty, and custom DB-driven roles are not complete. Roles are still `admin` / `manager` / `staff` plus allow/deny permission lists.

---

## 11. Troubleshooting

| Symptom | Check |
| --- | --- |
| POS “barcode not found” | Product barcode/SKU, active status, header unit vs product unit |
| Invoice A4 does nothing | Restart backend; look for a red error on Sales |
| `Schema hasn't been registered for model "Customer"` | Restart backend (tenant models register on connect) |
| Backend change not visible | Restart `npm run dev:backend` (`tsx` does not watch) |
| Super admin cannot open POS | Expected — no tenant `businessId` |
| Walk-in sale fails | Customer must be empty, not `""` as ObjectId (fixed in create sale) |
