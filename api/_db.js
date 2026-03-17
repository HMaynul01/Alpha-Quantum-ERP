// api/_db.js — Alpha Quantum ERP v18 — NeonDB PostgreSQL
import { neon } from '@neondatabase/serverless';
import { hashPassword } from './_auth.js';

let _sql = null;
let _migrated = false;

export function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL not set. Add it in Vercel: Dashboard → Settings → Environment Variables');
  _sql = neon(url);
  return _sql;
}

export async function getDb() {
  const sql = getSql();
  if (!_migrated) {
    _migrated = true;
    await migrate(sql).catch(e => { _migrated = false; throw e; });
  }
  return sql;
}

async function migrate(sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

  await sql`CREATE TABLE IF NOT EXISTS cubes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    features JSONB NOT NULL DEFAULT '{}',
    admin_email TEXT, admin_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    settings JSONB NOT NULL DEFAULT '{"theme":"dark","language":"en","currency":"SAR","timezone":"Asia/Riyadh"}',
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    cube_id UUID, department TEXT DEFAULT '',
    phone TEXT DEFAULT '', whatsapp_number TEXT DEFAULT '',
    avatar_url TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE,
    permissions JSONB NOT NULL DEFAULT '{}',
    last_login TIMESTAMPTZ, created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS cube_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL, admin_name TEXT NOT NULL,
    admin_email TEXT NOT NULL, admin_phone TEXT DEFAULT '',
    plan TEXT DEFAULT 'starter', message TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    cube_id UUID, approved_at TIMESTAMPTZ, approved_by UUID,
    rejection_reason TEXT, rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID, title TEXT,
    amount NUMERIC(18,2) DEFAULT 0,
    total_amount NUMERIC(18,2) DEFAULT 0,
    grand_total NUMERIC(18,2) DEFAULT 0,
    vat_amount NUMERIC(18,2) DEFAULT 0,
    vat_rate NUMERIC(5,2) DEFAULT 15,
    category TEXT, vendor TEXT, description TEXT,
    receipt_url TEXT, status TEXT NOT NULL DEFAULT 'pending',
    submitted_by UUID, submitted_by_name TEXT,
    approved_by UUID, approved_by_name TEXT,
    approval_note TEXT, approved_at TIMESTAMPTZ,
    expense_date DATE, items JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID,
    customer_name TEXT, customer_email TEXT, customer_address TEXT,
    items JSONB DEFAULT '[]',
    subtotal NUMERIC(18,2) DEFAULT 0,
    vat_rate NUMERIC(5,2) DEFAULT 15,
    vat_amount NUMERIC(18,2) DEFAULT 0,
    grand_total NUMERIC(18,2) DEFAULT 0,
    total_amount NUMERIC(18,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    due_date DATE, notes TEXT,
    created_by UUID, created_by_name TEXT,
    approved_by UUID, approved_by_name TEXT,
    approval_note TEXT, approved_at TIMESTAMPTZ, paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID,
    full_name TEXT NOT NULL, arabic_name TEXT DEFAULT '',
    gender TEXT DEFAULT 'male', date_of_birth DATE,
    nationality TEXT DEFAULT '', marital_status TEXT DEFAULT 'single',
    phone TEXT DEFAULT '', phone2 TEXT DEFAULT '',
    email TEXT DEFAULT '', address TEXT DEFAULT '',
    emergency_contact_name TEXT DEFAULT '',
    emergency_contact_phone TEXT DEFAULT '',
    position TEXT DEFAULT '', department TEXT DEFAULT '',
    employment_type TEXT DEFAULT 'full_time',
    hire_date DATE, contract_type TEXT DEFAULT 'permanent',
    contract_end DATE,
    basic_salary NUMERIC(18,2) DEFAULT 0,
    housing_allowance NUMERIC(18,2) DEFAULT 0,
    transport_allowance NUMERIC(18,2) DEFAULT 0,
    other_allowance NUMERIC(18,2) DEFAULT 0,
    salary NUMERIC(18,2) DEFAULT 0,
    currency TEXT DEFAULT 'SAR', payment_cycle TEXT DEFAULT 'monthly',
    national_id_number TEXT DEFAULT '',
    passport_number TEXT DEFAULT '',
    iqama_number TEXT DEFAULT '', iqama_expiry DATE,
    work_permit_number TEXT DEFAULT '',
    bank_name TEXT DEFAULT '', bank_iban TEXT DEFAULT '',
    bank_account TEXT DEFAULT '', status TEXT DEFAULT 'active',
    photo_url TEXT, id_photo_url TEXT,
    passport_photo_url TEXT, iqama_photo_url TEXT,
    notes TEXT DEFAULT '', created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cube_id UUID, worker_id UUID NOT NULL,
    document_type TEXT NOT NULL,
    document_number TEXT DEFAULT '', expiry_date DATE,
    file_url TEXT, file_url_back TEXT,
    notes TEXT DEFAULT '', created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cube_id UUID, name TEXT NOT NULL,
    manager_id UUID, notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS salary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cube_id UUID, worker_id UUID,
    amount NUMERIC(18,2) DEFAULT 0,
    month INTEGER, year INTEGER,
    notes TEXT, paid_by UUID, paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cube_id UUID, worker_id UUID,
    date DATE, check_in TIME, check_out TIME,
    hours NUMERIC(5,2), status TEXT DEFAULT 'present',
    notes TEXT, created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID, name TEXT NOT NULL,
    category TEXT, purchase_price NUMERIC(18,2) DEFAULT 0,
    current_value NUMERIC(18,2) DEFAULT 0,
    purchase_date DATE, location TEXT, serial_number TEXT,
    status TEXT DEFAULT 'active', notes TEXT, image_url TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID, title TEXT NOT NULL,
    category TEXT, amount NUMERIC(18,2) DEFAULT 0,
    spent NUMERIC(18,2) DEFAULT 0,
    period TEXT, year INTEGER, month INTEGER,
    status TEXT DEFAULT 'active', notes TEXT,
    project_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID, title TEXT NOT NULL,
    type TEXT, amount NUMERIC(18,2) DEFAULT 0,
    current_value NUMERIC(18,2) DEFAULT 0,
    return_rate NUMERIC(8,4) DEFAULT 0,
    start_date DATE, maturity_date DATE,
    status TEXT DEFAULT 'active', notes TEXT, created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS liabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID, title TEXT NOT NULL,
    type TEXT, amount NUMERIC(18,2) DEFAULT 0,
    paid_amount NUMERIC(18,2) DEFAULT 0,
    due_date DATE, creditor TEXT,
    status TEXT DEFAULT 'active', notes TEXT, created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID, title TEXT NOT NULL,
    description TEXT, status TEXT DEFAULT 'planning',
    priority TEXT DEFAULT 'medium',
    budget NUMERIC(18,2) DEFAULT 0,
    start_date DATE, end_date DATE,
    manager_id UUID, created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cube_id UUID, project_id UUID, title TEXT NOT NULL,
    description TEXT, status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    assigned_to UUID, due_date DATE, completed_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID, name TEXT NOT NULL,
    email TEXT, phone TEXT, company TEXT,
    address TEXT, country TEXT,
    type TEXT DEFAULT 'customer', status TEXT DEFAULT 'active',
    notes TEXT, total_revenue NUMERIC(18,2) DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref TEXT, cube_id UUID, name TEXT NOT NULL,
    email TEXT, phone TEXT, company TEXT, source TEXT,
    status TEXT DEFAULT 'new', value NUMERIC(18,2) DEFAULT 0,
    notes TEXT, assigned_to UUID, created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, cube_id UUID, title TEXT, body TEXT,
    entity_type TEXT, entity_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cube_id UUID, user_id TEXT, user_name TEXT,
    action TEXT, entity_type TEXT, entity_id TEXT,
    details JSONB DEFAULT '{}', ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cube_id UUID, key TEXT NOT NULL, value JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (cube_id, key)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cube_id UUID, title TEXT NOT NULL,
    fields JSONB DEFAULT '[]', created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS counters (
    id TEXT PRIMARY KEY, seq INTEGER NOT NULL DEFAULT 0
  )`;

  await seedCreator(sql);
}

async function seedCreator(sql) {
  const existing = await sql`SELECT id FROM users WHERE role = 'creator' LIMIT 1`;
  if (existing.length > 0) return;
  const username = (process.env.CREATOR_USERNAME || 'maynulshaon').toLowerCase();
  const password = process.env.CREATOR_PASSWORD || 'Creator@2025!';
  const email    = (process.env.CREATOR_EMAIL || 'erp@alpha-01.info').toLowerCase();
  const fullName = process.env.CREATOR_FULL_NAME || 'System Creator';
  await sql`
    INSERT INTO users (username, email, password_hash, full_name, role, is_active, permissions)
    VALUES (${username}, ${email}, ${hashPassword(password)}, ${fullName}, 'creator', TRUE, '{}')
    ON CONFLICT (username) DO NOTHING`;
  console.log('Creator seeded:', username);
}

export async function nextSeq(sql, name) {
  const r = await sql`
    INSERT INTO counters (id, seq) VALUES (${name}, 1)
    ON CONFLICT (id) DO UPDATE SET seq = counters.seq + 1 RETURNING seq`;
  return r[0].seq;
}

export async function auditLog(sql, user, action, entityType, entityId, details, ip) {
  try {
    await sql`
      INSERT INTO audit_log (cube_id, user_id, user_name, action, entity_type, entity_id, details, ip_address)
      VALUES (${user.cube_id || null}, ${String(user.sub)}, ${user.full_name},
              ${action}, ${entityType}, ${String(entityId)}, ${details || {}}, ${ip})`;
  } catch {}
}
