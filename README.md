# Alpha Quantum ERP v18

Enterprise multi-tenant ERP — NeonDB + Vercel + IONOS

**Live:** https://erp.alpha-01.info | **Contact:** erp@alpha-01.info

---

## 🚀 Quick Start (Termux — One Script)

```bash
# 1. Extract ZIP
unzip alpha-quantum-erp-v18-PRODUCTION.zip
cd alpha-erp

# 2. Run ONE script — handles everything
chmod +x scripts/deploy-all.sh
bash scripts/deploy-all.sh
```

The script will ask for:
- **NeonDB URL** → from [console.neon.tech](https://console.neon.tech)
- **GitHub Token** → from [github.com/settings/tokens](https://github.com/settings/tokens) (check `repo`)
- **IONOS email password** → for erp@alpha-01.info

---

## 🗄️ NeonDB Schema

Before or after deploying, run `neondb-schema.sql`:

1. Go to **https://console.neon.tech**
2. Open your project → **SQL Editor**
3. Paste contents of `neondb-schema.sql` → click **Run**

This creates all 21 tables + indexes + seeds the creator account.

---

## 🌐 IONOS DNS

Set these records at **my.ionos.com → Domains & SSL → Manage DNS**:

| Type  | Host  | Value                   | Priority |
|-------|-------|-------------------------|----------|
| CNAME | `erp` | `cname.vercel-dns.com`  | —        |
| A     | `@`   | `76.76.21.21`           | —        |
| MX    | `@`   | `mx00.ionos.com`        | 10       |
| MX    | `@`   | `mx01.ionos.com`        | 20       |
| TXT   | `@`   | `v=spf1 include:ionos.com ~all` | — |

---

## 🔑 First Login

URL: **https://erp.alpha-01.info**  
Username: `maynulshaon`  
Password: `Creator@2025!`  
⚠️ Change password after first login!

---

## 📦 Modules

Dashboard · Expenses · Invoices · Wallet · Approvals · Budget · Assets · Investments · Liabilities · Workers · Salary · Timesheet · Customers · Leads · Projects · Tasks · Reports · Users · Permissions · Settings · Creator Panel

---

## 🐛 v18 Bug Fixes

1. Login broken — `VITE_CREATOR_USERNAME` not available server-side
2. Expenses won't submit — field name mismatch (form vs API)
3. Invoices won't submit — `client_name` vs `customer_name`
4. File upload 404 — `/uploads/imgbb` route didn't exist
5. Body parser missing on Vercel serverless
6. Dashboard 500 for creator — NULL cube_id SQL query
7. Approve broken for creator — NULL cube_id check
8. Categories returned numeric IDs — broke form validation
9. Mobile layout — full CSS rewrite, 44px touch targets, no iOS zoom

