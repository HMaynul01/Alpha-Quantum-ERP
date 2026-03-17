// api/index.js — Alpha Quantum ERP v18 — Clean Build
import { getDb, nextSeq, auditLog } from './_db.js';
import { requireAuth, corsHeaders, hashPassword, signJWT, isCreator, isCubeAdmin, isSuperUser } from './_auth.js';
import { uploadFile, parseBase64Upload } from './_storage.js';
import { sendEmail, expenseApprovedTemplate, welcomeUserTemplate } from './_email.js';

function toDoc(row) { return row ? { ...row } : null; }
function toDocs(rows) { return (rows || []).map(toDoc); }

function getPerm(user, module) {
  if (['creator','cube_admin','superuser'].includes(user.role)) return 'full_control';
  return user.permissions?.[module] ?? 'none';
}
function canView(user, module) { return getPerm(user, module) !== 'none'; }
function canFullControl(user, mod) {
  return ['creator','cube_admin','superuser'].includes(user.role) || getPerm(user, mod) === 'full_control';
}

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ?? 'unknown';

  // Parse request body for Vercel serverless
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    if (!req.body || typeof req.body !== 'object') {
      await new Promise((resolve) => {
        let data = '';
        if (req.readable) {
          req.on('data', c => { data += c; });
          req.on('end', () => { try { req.body = data ? JSON.parse(data) : {}; } catch { req.body = {}; } resolve(); });
          req.on('error', () => { req.body = {}; resolve(); });
        } else { resolve(); }
      });
    }
  }
  if (!req.body) req.body = {};

  // CORS
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const route = (req.query?.r ?? req.query?.route ?? '').replace(/^\/+/, '');

  // ── PING (no DB needed) ──────────────────────────────────────────────────
  if (route === 'ping') {
    return res.status(200).json({ ok: true, version: '18', time: new Date().toISOString() });
  }

  // ── HEALTH (no DB needed) ────────────────────────────────────────────────
  if (route === 'health' && req.method === 'GET') {
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!dbUrl) {
      return res.status(200).json({
        status: 'degraded',
        version: '18',
        error: 'DATABASE_URL not configured',
        action: 'Go to vercel.com/dashboard → your project → Settings → Environment Variables → Add DATABASE_URL',
        time: new Date().toISOString(),
      });
    }
    try {
      const sql = await getDb();
      await sql`SELECT 1`;
      return res.status(200).json({ status: 'ok', db: 'neondb', version: '18', time: new Date().toISOString() });
    } catch (e) {
      return res.status(200).json({ status: 'db_error', error: e.message, version: '18' });
    }
  }

  // ── CUBE REQUEST (public, no auth) ───────────────────────────────────────
  if (route === 'cube/request' && req.method === 'POST') {
    let sql;
    try { sql = await getDb(); } catch (e) { return res.status(500).json({ error: e.message }); }
    try {
      const { company_name, admin_name, admin_email, admin_phone, plan, message } = req.body;
      if (!company_name || !admin_name || !admin_email)
        return res.status(400).json({ error: 'company_name, admin_name, admin_email required' });
      const existing = await sql`SELECT id, status FROM cube_requests WHERE LOWER(admin_email) = LOWER(${admin_email}) LIMIT 1`;
      if (existing.length) return res.status(409).json({ error: 'Request already exists', status: existing[0].status });
      const r = await sql`
        INSERT INTO cube_requests (company_name, admin_name, admin_email, admin_phone, plan, message)
        VALUES (${company_name}, ${admin_name}, ${admin_email.toLowerCase()}, ${admin_phone||''}, ${plan||'starter'}, ${message||''})
        RETURNING id`;
      return res.status(201).json({ ok: true, request_id: r[0].id });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── AUTH GUARD: all routes below need database + valid token ─────────────
  let sql;
  try { sql = await getDb(); }
  catch (e) {
    return res.status(500).json({
      error: 'Database not connected',
      detail: e.message,
      action: 'Set DATABASE_URL in Vercel: vercel.com/dashboard → alpha-quantum-erp → Settings → Environment Variables',
    });
  }

  // ── AUTH LOGIN ───────────────────────────────────────────────────────────
  if (route === 'auth/login' && req.method === 'POST') {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
      const rows = await sql`
        SELECT * FROM users
        WHERE LOWER(username) = LOWER(${String(username).trim()})
          AND password_hash = ${hashPassword(password)}
          AND is_active = TRUE LIMIT 1`;
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      const user = rows[0];
      await sql`UPDATE users SET last_login = NOW() WHERE id = ${user.id}`;
      const token = signJWT({
        sub: user.id, username: user.username,
        full_name: user.full_name, email: user.email,
        role: user.role, cube_id: user.cube_id || null,
        permissions: user.permissions || {},
      });
      const { password_hash, ...userData } = user;
      return res.status(200).json({ token, user: userData });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── AUTH ME ──────────────────────────────────────────────────────────────
  if (route === 'auth/me' && req.method === 'GET') {
    try {
      const p = requireAuth(req);
      const rows = await sql`SELECT * FROM users WHERE id = ${p.sub} LIMIT 1`;
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      const { password_hash, ...userData } = rows[0];
      return res.status(200).json({ user: userData });
    } catch (e) { return res.status(401).json({ error: e.message }); }
  }

  // ── ALL OTHER ROUTES REQUIRE AUTH TOKEN ──────────────────────────────────
  let authUser;
  try { authUser = requireAuth(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }
  const cubeId = authUser.cube_id || null;

  // ── CREATOR ROUTES ───────────────────────────────────────────────────────
  if (route === 'creator/cube-requests' && req.method === 'GET') {
    if (!isCreator(authUser)) return res.status(403).json({ error: 'Creator only' });
    try {
      const rows = await sql`SELECT * FROM cube_requests ORDER BY created_at DESC`;
      return res.status(200).json({ requests: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'creator/cube-requests/approve' && req.method === 'POST') {
    if (!isCreator(authUser)) return res.status(403).json({ error: 'Creator only' });
    try {
      const { request_id, admin_username, admin_password, cube_slug } = req.body;
      const req2 = await sql`SELECT * FROM cube_requests WHERE id = ${request_id} LIMIT 1`;
      if (!req2.length) return res.status(404).json({ error: 'Request not found' });
      const r = req2[0];
      const slug = cube_slug || r.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
      const newCube = await sql`
        INSERT INTO cubes (slug, company_name, plan, admin_email, admin_name)
        VALUES (${slug}, ${r.company_name}, ${r.plan || 'starter'}, ${r.admin_email}, ${r.admin_name})
        RETURNING id`;
      const newCubeId = newCube[0].id;
      const uname = (admin_username || r.admin_email.split('@')[0]).toLowerCase();
      const upass = admin_password || 'Admin@2025!';
      await sql`
        INSERT INTO users (username, email, password_hash, full_name, role, cube_id, is_active, permissions)
        VALUES (${uname}, ${r.admin_email}, ${hashPassword(upass)}, ${r.admin_name}, 'cube_admin', ${newCubeId}, TRUE, '{}')
        ON CONFLICT (username) DO NOTHING`;
      await sql`UPDATE cube_requests SET status='approved', cube_id=${newCubeId}, approved_at=NOW(), approved_by=${authUser.sub} WHERE id=${request_id}`;
      sendEmail({ to: r.admin_email, ...welcomeUserTemplate(r.admin_name, uname, upass) }).catch(() => {});
      return res.status(201).json({ ok: true, cube_id: newCubeId });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'creator/cube-requests/reject' && req.method === 'POST') {
    if (!isCreator(authUser)) return res.status(403).json({ error: 'Creator only' });
    try {
      const { request_id, reason } = req.body;
      await sql`UPDATE cube_requests SET status='rejected', rejection_reason=${reason||''}, rejected_at=NOW(), approved_by=${authUser.sub} WHERE id=${request_id}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'creator/cubes' && req.method === 'GET') {
    if (!isCreator(authUser)) return res.status(403).json({ error: 'Creator only' });
    try {
      const rows = await sql`SELECT * FROM cubes ORDER BY created_at DESC`;
      return res.status(200).json({ cubes: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'creator/stats' && req.method === 'GET') {
    if (!isCreator(authUser)) return res.status(403).json({ error: 'Creator only' });
    try {
      const [cubes, users, expenses, invoices] = await Promise.all([
        sql`SELECT COUNT(*)::int cnt FROM cubes`,
        sql`SELECT COUNT(*)::int cnt FROM users`,
        sql`SELECT COUNT(*)::int cnt FROM expenses`,
        sql`SELECT COUNT(*)::int cnt FROM invoices`,
      ]);
      return res.status(200).json({ cubes: cubes[0].cnt, users: users[0].cnt, expenses: expenses[0].cnt, invoices: invoices[0].cnt });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'creator/all-users' && req.method === 'GET') {
    if (!isCreator(authUser)) return res.status(403).json({ error: 'Creator only' });
    try {
      const rows = await sql`SELECT id, username, email, full_name, role, cube_id, is_active, created_at FROM users ORDER BY created_at DESC`;
      return res.status(200).json({ users: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'creator/reset-password' && req.method === 'POST') {
    if (!isCreator(authUser)) return res.status(403).json({ error: 'Creator only' });
    try {
      const { user_id, new_password } = req.body;
      await sql`UPDATE users SET password_hash=${hashPassword(new_password)}, updated_at=NOW() WHERE id=${user_id}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── CUBE SETTINGS ────────────────────────────────────────────────────────
  if (route === 'cube/me' && req.method === 'GET') {
    try {
      if (!cubeId) return res.status(200).json({ cube: null });
      const rows = await sql`SELECT * FROM cubes WHERE id = ${cubeId} LIMIT 1`;
      return res.status(200).json({ cube: rows[0] || null });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── USERS ────────────────────────────────────────────────────────────────
  if (route === 'users' && req.method === 'GET') {
    try {
      const rows = isCreator(authUser)
        ? await sql`SELECT id, username, email, full_name, role, cube_id, department, is_active, permissions, created_at FROM users ORDER BY created_at DESC`
        : await sql`SELECT id, username, email, full_name, role, cube_id, department, is_active, permissions, created_at FROM users WHERE cube_id = ${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ users: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'users' && req.method === 'POST') {
    if (!canFullControl(authUser, 'users')) return res.status(403).json({ error: 'Insufficient permissions' });
    try {
      const { username, email, full_name, role, department, phone, password, permissions } = req.body;
      if (!username || !email || !full_name || !password) return res.status(400).json({ error: 'username, email, full_name, password required' });
      const rows = await sql`
        INSERT INTO users (username, email, password_hash, full_name, role, cube_id, department, phone, is_active, permissions, created_by)
        VALUES (${username.toLowerCase()}, ${email.toLowerCase()}, ${hashPassword(password)}, ${full_name},
                ${role || 'staff'}, ${cubeId}, ${department || ''}, ${phone || ''}, TRUE,
                ${JSON.stringify(permissions || {})}, ${authUser.sub})
        RETURNING id, username, email, full_name, role, cube_id, department, is_active, permissions, created_at`;
      sendEmail({ to: email, ...welcomeUserTemplate(full_name, username, password) }).catch(() => {});
      return res.status(201).json({ user: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'users/delete' && req.method === 'POST') {
    if (!isCubeAdmin(authUser)) return res.status(403).json({ error: 'Admin only' });
    try {
      const { user_id } = req.body;
      await sql`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = ${user_id} AND cube_id = ${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'users/change-password' && req.method === 'POST') {
    try {
      const { current_password, new_password } = req.body;
      const rows = await sql`SELECT * FROM users WHERE id = ${authUser.sub} LIMIT 1`;
      if (!rows.length || rows[0].password_hash !== hashPassword(current_password))
        return res.status(400).json({ error: 'Current password is incorrect' });
      await sql`UPDATE users SET password_hash = ${hashPassword(new_password)}, updated_at = NOW() WHERE id = ${authUser.sub}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── PERMISSIONS ──────────────────────────────────────────────────────────
  if (route === 'permissions' && req.method === 'GET') {
    try {
      const rows = isCreator(authUser)
        ? await sql`SELECT id, username, email, full_name, role, permissions FROM users WHERE role NOT IN ('creator') ORDER BY full_name`
        : await sql`SELECT id, username, email, full_name, role, permissions FROM users WHERE cube_id = ${cubeId} AND role NOT IN ('creator','cube_admin') ORDER BY full_name`;
      return res.status(200).json({ users: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'permissions' && req.method === 'POST') {
    if (!isCubeAdmin(authUser)) return res.status(403).json({ error: 'Admin only' });
    try {
      const { user_id, module, level } = req.body;
      await sql`
        UPDATE users
        SET permissions = jsonb_set(COALESCE(permissions, '{}'), ${[module]}, ${JSON.stringify(level)}::jsonb),
            updated_at = NOW()
        WHERE id = ${user_id}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── FILE UPLOAD ──────────────────────────────────────────────────────────
  if ((route === 'uploads/file' || route === 'uploads/imgbb') && req.method === 'POST') {
    try {
      const { buffer, filename, mimetype } = parseBase64Upload(req.body);
      const result = await uploadFile(buffer, filename, mimetype, `cubes/${cubeId || 'global'}`);
      return res.status(200).json({ url: result.url, key: result.key });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── EXPENSES ─────────────────────────────────────────────────────────────
  if (route === 'expenses' && req.method === 'GET') {
    try {
      const perm = getPerm(authUser, 'expenses') !== 'none' ? getPerm(authUser, 'expenses') : getPerm(authUser, 'finance');
      const rows = (isSuperUser(authUser) || (perm !== 'submit_only' && perm !== 'none'))
        ? (isCreator(authUser)
            ? await sql`SELECT * FROM expenses ORDER BY created_at DESC LIMIT 500`
            : await sql`SELECT * FROM expenses WHERE cube_id = ${cubeId} ORDER BY created_at DESC LIMIT 500`)
        : await sql`SELECT * FROM expenses WHERE cube_id = ${cubeId} AND submitted_by = ${authUser.sub} ORDER BY created_at DESC LIMIT 500`;
      return res.status(200).json({ expenses: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'expenses' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `expense_${cubeId || 'global'}`);
      const ref = `EXP-${String(n).padStart(5, '0')}`;
      const b = req.body;
      const lineArr = b.line_items || b.items || [];
      let calcSub = 0, calcVat = 0, calcGrand = 0;
      lineArr.forEach(li => {
        const sub = (parseFloat(li.quantity) || 1) * (parseFloat(li.unit_price) || 0);
        const tax = sub * ((parseFloat(li.tax_percent) || 0) / 100);
        calcSub += sub; calcVat += tax; calcGrand += sub + tax;
      });
      const title = b.title || b.project_name || 'Expense';
      const cat = b.category || b.category_id || '';
      const desc = b.description || b.notes || '';
      const vendor = b.vendor || b.project_location || '';
      const receipt = b.receipt_url || (b.media_urls && b.media_urls[0]) || null;
      const sub = calcSub || parseFloat(b.amount || b.total_amount || 0);
      const vat = calcVat || parseFloat(b.vat_amount || 0);
      const grand = calcGrand || parseFloat(b.grand_total || b.total_amount || b.amount || sub || 0);
      const rows = await sql`
        INSERT INTO expenses (ref, cube_id, title, amount, total_amount, grand_total, vat_amount, vat_rate, category, vendor, description, receipt_url, expense_date, items, submitted_by, submitted_by_name, status)
        VALUES (${ref}, ${cubeId}, ${title}, ${sub}, ${sub}, ${grand}, ${vat}, ${parseFloat(b.vat_rate || 15)},
                ${cat}, ${vendor}, ${desc}, ${receipt}, ${b.expense_date || null}, ${JSON.stringify(lineArr)},
                ${authUser.sub}, ${authUser.full_name}, 'pending')
        RETURNING *`;
      await auditLog(sql, authUser, 'EXPENSE_CREATED', 'expense', rows[0].id, { ref }, ip);
      return res.status(201).json({ expense: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^expenses\/[a-f0-9-]{36}$/) && req.method === 'GET') {
    try {
      const id = route.split('/')[1];
      const rows = await sql`SELECT * FROM expenses WHERE id = ${id} LIMIT 1`;
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ expense: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^expenses\/[a-f0-9-]{36}$/) && req.method === 'DELETE') {
    try {
      const id = route.split('/')[1];
      await sql`DELETE FROM expenses WHERE id = ${id} AND cube_id = ${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'expenses/approve' && req.method === 'POST') {
    if (!isCubeAdmin(authUser)) return res.status(403).json({ error: 'Admin only' });
    try {
      const { expense_id, action, note } = req.body;
      if (!expense_id) return res.status(400).json({ error: 'expense_id required' });
      const status = action === 'approve' ? 'approved' : 'rejected';
      const affected = isCreator(authUser)
        ? await sql`UPDATE expenses SET status=${status}, approved_by=${authUser.sub}, approved_by_name=${authUser.full_name}, approval_note=${note||''}, approved_at=NOW(), updated_at=NOW() WHERE id=${expense_id} RETURNING id`
        : await sql`UPDATE expenses SET status=${status}, approved_by=${authUser.sub}, approved_by_name=${authUser.full_name}, approval_note=${note||''}, approved_at=NOW(), updated_at=NOW() WHERE id=${expense_id} AND cube_id=${cubeId} RETURNING id`;
      if (!affected.length) return res.status(404).json({ error: 'Expense not found or not in your cube' });
      await auditLog(sql, authUser, `EXPENSE_${status.toUpperCase()}`, 'expense', expense_id, {}, ip);
      try {
        const exp = await sql`SELECT * FROM expenses WHERE id = ${expense_id} LIMIT 1`;
        if (exp.length && exp[0].submitted_by) {
          const usr = await sql`SELECT email, full_name FROM users WHERE id = ${exp[0].submitted_by} LIMIT 1`;
          if (usr.length) sendEmail({ to: usr[0].email, ...expenseApprovedTemplate(usr[0].full_name, exp[0].ref, exp[0].grand_total || 0, status) }).catch(() => {});
        }
      } catch {}
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── INVOICES ─────────────────────────────────────────────────────────────
  if (route === 'invoices' && req.method === 'GET') {
    try {
      const rows = isCreator(authUser)
        ? await sql`SELECT * FROM invoices ORDER BY created_at DESC LIMIT 500`
        : await sql`SELECT * FROM invoices WHERE cube_id = ${cubeId} ORDER BY created_at DESC LIMIT 500`;
      return res.status(200).json({ invoices: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'invoices' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `invoice_${cubeId || 'global'}`);
      const ref = `INV-${String(n).padStart(5, '0')}`;
      const b = req.body;
      const customer = b.customer_name || b.client_name || '';
      const addr = b.customer_address || b.client_address || '';
      const lineArr = b.line_items || b.items || [];
      let calcSub = 0, calcVat = 0, calcGrand = 0;
      lineArr.forEach(li => {
        const sub = (parseFloat(li.quantity) || 1) * (parseFloat(li.unit_price) || 0);
        const tax = sub * ((parseFloat(li.tax_percent) || 15) / 100);
        calcSub += sub; calcVat += tax; calcGrand += sub + tax;
      });
      const sub = calcSub || parseFloat(b.subtotal || 0);
      const vat = calcVat || parseFloat(b.vat_amount || 0);
      const grand = calcGrand || parseFloat(b.grand_total || 0);
      const notes = [b.notes, b.payment_terms ? `Terms: ${b.payment_terms}` : '', b.po_number ? `PO: ${b.po_number}` : ''].filter(Boolean).join(' | ');
      const rows = await sql`
        INSERT INTO invoices (ref, cube_id, customer_name, customer_email, customer_address, items, subtotal, vat_rate, vat_amount, grand_total, total_amount, due_date, notes, created_by, created_by_name, status)
        VALUES (${ref}, ${cubeId}, ${customer}, ${b.customer_email||''}, ${addr}, ${JSON.stringify(lineArr)},
                ${sub}, ${parseFloat(b.vat_rate||15)}, ${vat}, ${grand}, ${grand},
                ${b.due_date||null}, ${notes||''}, ${authUser.sub}, ${authUser.full_name}, 'draft')
        RETURNING *`;
      return res.status(201).json({ invoice: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^invoices\/[a-f0-9-]{36}$/) && req.method === 'GET') {
    try {
      const id = route.split('/')[1];
      const rows = await sql`SELECT * FROM invoices WHERE id = ${id} LIMIT 1`;
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ invoice: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^invoices\/[a-f0-9-]{36}$/) && req.method === 'PATCH') {
    try {
      const id = route.split('/')[1];
      const { status, customer_name, notes } = req.body;
      if (status) await sql`UPDATE invoices SET status=${status}, updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      if (customer_name) await sql`UPDATE invoices SET customer_name=${customer_name}, updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      if (notes) await sql`UPDATE invoices SET notes=${notes}, updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'invoices/approve' && req.method === 'POST') {
    if (!isCubeAdmin(authUser)) return res.status(403).json({ error: 'Admin only' });
    try {
      const { invoice_id, action, note } = req.body;
      if (!invoice_id) return res.status(400).json({ error: 'invoice_id required' });
      const status = action === 'approve' ? 'approved' : 'rejected';
      const affected = isCreator(authUser)
        ? await sql`UPDATE invoices SET status=${status}, approved_by=${authUser.sub}, approved_by_name=${authUser.full_name}, approval_note=${note||''}, approved_at=NOW(), updated_at=NOW() WHERE id=${invoice_id} RETURNING id`
        : await sql`UPDATE invoices SET status=${status}, approved_by=${authUser.sub}, approved_by_name=${authUser.full_name}, approval_note=${note||''}, approved_at=NOW(), updated_at=NOW() WHERE id=${invoice_id} AND cube_id=${cubeId} RETURNING id`;
      if (!affected.length) return res.status(404).json({ error: 'Invoice not found' });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── APPROVALS ────────────────────────────────────────────────────────────
  if (route === 'approvals' && req.method === 'GET') {
    if (!isCubeAdmin(authUser)) return res.status(403).json({ error: 'Admin only' });
    try {
      const [exps, invs] = isCreator(authUser)
        ? await Promise.all([
            sql`SELECT * FROM expenses WHERE status='pending' ORDER BY created_at DESC`,
            sql`SELECT * FROM invoices WHERE status='pending' ORDER BY created_at DESC`,
          ])
        : await Promise.all([
            sql`SELECT * FROM expenses WHERE cube_id=${cubeId} AND status='pending' ORDER BY created_at DESC`,
            sql`SELECT * FROM invoices WHERE cube_id=${cubeId} AND status='pending' ORDER BY created_at DESC`,
          ]);
      return res.status(200).json({ expenses: toDocs(exps), invoices: toDocs(invs), total: exps.length + invs.length });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── ASSETS ───────────────────────────────────────────────────────────────
  if (route === 'assets' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM assets WHERE cube_id = ${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ assets: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'assets' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `asset_${cubeId}`);
      const ref = `AST-${String(n).padStart(5, '0')}`;
      const { name, category, purchase_price, current_value, purchase_date, location, serial_number, status, notes } = req.body;
      const rows = await sql`
        INSERT INTO assets (ref, cube_id, name, category, purchase_price, current_value, purchase_date, location, serial_number, status, notes, created_by)
        VALUES (${ref}, ${cubeId}, ${name}, ${category||''}, ${parseFloat(purchase_price||0)}, ${parseFloat(current_value||purchase_price||0)}, ${purchase_date||null}, ${location||''}, ${serial_number||''}, ${status||'active'}, ${notes||''}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ asset: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'assets/update' && req.method === 'PATCH') {
    try {
      const { id, name, category, current_value, location, status, notes } = req.body;
      await sql`UPDATE assets SET name=COALESCE(${name||null},name), category=COALESCE(${category||null},category), current_value=COALESCE(${current_value!=null?parseFloat(current_value):null},current_value), location=COALESCE(${location||null},location), status=COALESCE(${status||null},status), notes=COALESCE(${notes||null},notes), updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── WORKERS / EMPLOYEES ──────────────────────────────────────────────────
  if (route === 'workers' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM workers WHERE cube_id = ${cubeId} ORDER BY full_name ASC`;
      return res.status(200).json({ workers: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^workers\/[a-f0-9-]{36}$/) && req.method === 'GET') {
    try {
      const id = route.split('/')[1];
      const rows = await sql`SELECT * FROM workers WHERE id = ${id} AND cube_id = ${cubeId} LIMIT 1`;
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ worker: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'workers' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `worker_${cubeId}`);
      const ref = `EMP-${String(n).padStart(4, '0')}`;
      const b = req.body;
      const totalSal = parseFloat(b.basic_salary||b.salary||0) + parseFloat(b.housing_allowance||0) + parseFloat(b.transport_allowance||0) + parseFloat(b.other_allowance||0);
      const rows = await sql`
        INSERT INTO workers (ref, cube_id, full_name, arabic_name, gender, date_of_birth, nationality, marital_status, phone, phone2, email, address, emergency_contact_name, emergency_contact_phone, position, department, employment_type, hire_date, contract_type, contract_end, basic_salary, housing_allowance, transport_allowance, other_allowance, salary, currency, payment_cycle, national_id_number, passport_number, iqama_number, iqama_expiry, work_permit_number, bank_name, bank_iban, bank_account, status, photo_url, notes, created_by)
        VALUES (${ref}, ${cubeId}, ${b.full_name}, ${b.arabic_name||''}, ${b.gender||'male'}, ${b.date_of_birth||null}, ${b.nationality||''}, ${b.marital_status||'single'}, ${b.phone||''}, ${b.phone2||''}, ${b.email||''}, ${b.address||''}, ${b.emergency_contact_name||''}, ${b.emergency_contact_phone||''}, ${b.position||''}, ${b.department||''}, ${b.employment_type||'full_time'}, ${b.hire_date||null}, ${b.contract_type||'permanent'}, ${b.contract_end||null}, ${parseFloat(b.basic_salary||0)}, ${parseFloat(b.housing_allowance||0)}, ${parseFloat(b.transport_allowance||0)}, ${parseFloat(b.other_allowance||0)}, ${totalSal}, ${b.currency||'SAR'}, ${b.payment_cycle||'monthly'}, ${b.national_id_number||''}, ${b.passport_number||''}, ${b.iqama_number||''}, ${b.iqama_expiry||null}, ${b.work_permit_number||''}, ${b.bank_name||''}, ${b.bank_iban||''}, ${b.bank_account||''}, ${b.status||'active'}, ${b.photo_url||null}, ${b.notes||''}, ${authUser.sub})
        RETURNING *`;
      await auditLog(sql, authUser, 'WORKER_CREATED', 'worker', rows[0].id, { ref }, ip);
      return res.status(201).json({ worker: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^workers\/[a-f0-9-]{36}$/) && req.method === 'PATCH') {
    try {
      const id = route.split('/')[1];
      const b = req.body;
      const totalSal = (b.basic_salary != null || b.housing_allowance != null || b.transport_allowance != null || b.other_allowance != null)
        ? parseFloat(b.basic_salary||0) + parseFloat(b.housing_allowance||0) + parseFloat(b.transport_allowance||0) + parseFloat(b.other_allowance||0)
        : null;
      await sql`UPDATE workers SET
        full_name=COALESCE(${b.full_name||null},full_name),
        arabic_name=COALESCE(${b.arabic_name||null},arabic_name),
        gender=COALESCE(${b.gender||null},gender),
        date_of_birth=COALESCE(${b.date_of_birth||null},date_of_birth),
        nationality=COALESCE(${b.nationality||null},nationality),
        marital_status=COALESCE(${b.marital_status||null},marital_status),
        phone=COALESCE(${b.phone||null},phone),
        email=COALESCE(${b.email||null},email),
        position=COALESCE(${b.position||null},position),
        department=COALESCE(${b.department||null},department),
        employment_type=COALESCE(${b.employment_type||null},employment_type),
        hire_date=COALESCE(${b.hire_date||null},hire_date),
        basic_salary=COALESCE(${b.basic_salary!=null?parseFloat(b.basic_salary):null},basic_salary),
        housing_allowance=COALESCE(${b.housing_allowance!=null?parseFloat(b.housing_allowance):null},housing_allowance),
        transport_allowance=COALESCE(${b.transport_allowance!=null?parseFloat(b.transport_allowance):null},transport_allowance),
        other_allowance=COALESCE(${b.other_allowance!=null?parseFloat(b.other_allowance):null},other_allowance),
        salary=COALESCE(${totalSal},salary),
        national_id_number=COALESCE(${b.national_id_number||null},national_id_number),
        passport_number=COALESCE(${b.passport_number||null},passport_number),
        iqama_number=COALESCE(${b.iqama_number||null},iqama_number),
        iqama_expiry=COALESCE(${b.iqama_expiry||null},iqama_expiry),
        status=COALESCE(${b.status||null},status),
        photo_url=COALESCE(${b.photo_url||null},photo_url),
        id_photo_url=COALESCE(${b.id_photo_url||null},id_photo_url),
        passport_photo_url=COALESCE(${b.passport_photo_url||null},passport_photo_url),
        iqama_photo_url=COALESCE(${b.iqama_photo_url||null},iqama_photo_url),
        notes=COALESCE(${b.notes||null},notes),
        updated_at=NOW()
        WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'workers/update' && req.method === 'POST') {
    try {
      const { id, full_name, position, department, phone, status, salary, notes, photo_url, id_photo_url, passport_photo_url, iqama_photo_url } = req.body;
      await sql`UPDATE workers SET full_name=COALESCE(${full_name||null},full_name), position=COALESCE(${position||null},position), department=COALESCE(${department||null},department), phone=COALESCE(${phone||null},phone), status=COALESCE(${status||null},status), salary=COALESCE(${salary?parseFloat(salary):null},salary), notes=COALESCE(${notes||null},notes), photo_url=COALESCE(${photo_url||null},photo_url), id_photo_url=COALESCE(${id_photo_url||null},id_photo_url), passport_photo_url=COALESCE(${passport_photo_url||null},passport_photo_url), iqama_photo_url=COALESCE(${iqama_photo_url||null},iqama_photo_url), updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── EMPLOYEE DOCUMENTS ───────────────────────────────────────────────────
  if (route === 'employee-documents' && req.method === 'GET') {
    try {
      const wid = req.query?.worker_id;
      const rows = wid
        ? await sql`SELECT * FROM employee_documents WHERE worker_id=${wid} AND cube_id=${cubeId} ORDER BY created_at DESC`
        : await sql`SELECT * FROM employee_documents WHERE cube_id=${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ documents: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'employee-documents' && req.method === 'POST') {
    try {
      const { worker_id, document_type, document_number, expiry_date, file_url, file_url_back, notes } = req.body;
      if (!worker_id || !document_type) return res.status(400).json({ error: 'worker_id and document_type required' });
      const rows = await sql`
        INSERT INTO employee_documents (cube_id, worker_id, document_type, document_number, expiry_date, file_url, file_url_back, notes, created_by)
        VALUES (${cubeId}, ${worker_id}, ${document_type}, ${document_number||''}, ${expiry_date||null}, ${file_url||null}, ${file_url_back||null}, ${notes||''}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ document: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^employee-documents\/[a-f0-9-]{36}$/) && req.method === 'DELETE') {
    try {
      const id = route.split('/')[1];
      await sql`DELETE FROM employee_documents WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── SALARY ───────────────────────────────────────────────────────────────
  if (route === 'salary' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT s.*, w.full_name as worker_name FROM salary s LEFT JOIN workers w ON w.id=s.worker_id WHERE s.cube_id=${cubeId} ORDER BY s.created_at DESC LIMIT 200`;
      return res.status(200).json({ records: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'salary' && req.method === 'POST') {
    try {
      const { worker_id, amount, month, year, notes } = req.body;
      const rows = await sql`
        INSERT INTO salary (cube_id, worker_id, amount, month, year, notes, paid_by, paid_at)
        VALUES (${cubeId}, ${worker_id}, ${parseFloat(amount||0)}, ${month||new Date().getMonth()+1}, ${year||new Date().getFullYear()}, ${notes||''}, ${authUser.sub}, NOW())
        RETURNING *`;
      return res.status(201).json({ record: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── ATTENDANCE ───────────────────────────────────────────────────────────
  if (route === 'attendance' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM attendance WHERE cube_id=${cubeId} ORDER BY date DESC LIMIT 500`;
      return res.status(200).json({ records: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'attendance' && req.method === 'POST') {
    try {
      const { worker_id, date, check_in, check_out, hours, status, notes } = req.body;
      const rows = await sql`
        INSERT INTO attendance (cube_id, worker_id, date, check_in, check_out, hours, status, notes, created_by)
        VALUES (${cubeId}, ${worker_id}, ${date}, ${check_in||null}, ${check_out||null}, ${parseFloat(hours||0)}, ${status||'present'}, ${notes||''}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ record: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── BUDGETS ──────────────────────────────────────────────────────────────
  if (route === 'budgets' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM budgets WHERE cube_id=${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ budgets: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'budgets' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `budget_${cubeId}`);
      const ref = `BUD-${String(n).padStart(5, '0')}`;
      const { title, category, amount, spent, period, year, month, notes, project_id } = req.body;
      const rows = await sql`
        INSERT INTO budgets (ref, cube_id, title, category, amount, spent, period, year, month, notes, project_id, created_by)
        VALUES (${ref}, ${cubeId}, ${title||''}, ${category||''}, ${parseFloat(amount||0)}, ${parseFloat(spent||0)}, ${period||'monthly'}, ${year||new Date().getFullYear()}, ${month||new Date().getMonth()+1}, ${notes||''}, ${project_id||null}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ budget: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^budgets\/[a-f0-9-]{36}$/) && req.method === 'PATCH') {
    try {
      const id = route.split('/')[1];
      const { spent, amount, title, status, notes } = req.body;
      await sql`UPDATE budgets SET spent=COALESCE(${spent!=null?parseFloat(spent):null},spent), amount=COALESCE(${amount!=null?parseFloat(amount):null},amount), title=COALESCE(${title||null},title), status=COALESCE(${status||null},status), notes=COALESCE(${notes||null},notes), updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── INVESTMENTS ──────────────────────────────────────────────────────────
  if (route === 'investments' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM investments WHERE cube_id=${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ investments: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'investments' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `inv_${cubeId}`);
      const ref = `INV-${String(n).padStart(5, '0')}`;
      const { title, type, amount, current_value, return_rate, start_date, maturity_date, notes } = req.body;
      const rows = await sql`
        INSERT INTO investments (ref, cube_id, title, type, amount, current_value, return_rate, start_date, maturity_date, notes, created_by)
        VALUES (${ref}, ${cubeId}, ${title}, ${type||''}, ${parseFloat(amount||0)}, ${parseFloat(current_value||amount||0)}, ${parseFloat(return_rate||0)}, ${start_date||null}, ${maturity_date||null}, ${notes||''}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ investment: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── LIABILITIES ──────────────────────────────────────────────────────────
  if (route === 'liabilities' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM liabilities WHERE cube_id=${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ liabilities: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'liabilities' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `liab_${cubeId}`);
      const ref = `LIA-${String(n).padStart(5, '0')}`;
      const { title, type, amount, paid_amount, due_date, creditor, notes } = req.body;
      const rows = await sql`
        INSERT INTO liabilities (ref, cube_id, title, type, amount, paid_amount, due_date, creditor, notes, created_by)
        VALUES (${ref}, ${cubeId}, ${title}, ${type||''}, ${parseFloat(amount||0)}, ${parseFloat(paid_amount||0)}, ${due_date||null}, ${creditor||''}, ${notes||''}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ liability: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'liabilities/update' && req.method === 'PATCH') {
    try {
      const { id, paid_amount, status, notes } = req.body;
      await sql`UPDATE liabilities SET paid_amount=COALESCE(${paid_amount!=null?parseFloat(paid_amount):null},paid_amount), status=COALESCE(${status||null},status), notes=COALESCE(${notes||null},notes), updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── PROJECTS ─────────────────────────────────────────────────────────────
  if (route === 'projects' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM projects WHERE cube_id=${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ projects: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'projects' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `proj_${cubeId}`);
      const ref = `PRJ-${String(n).padStart(5, '0')}`;
      const { title, description, status, priority, budget, start_date, end_date } = req.body;
      const rows = await sql`
        INSERT INTO projects (ref, cube_id, title, description, status, priority, budget, start_date, end_date, created_by)
        VALUES (${ref}, ${cubeId}, ${title}, ${description||''}, ${status||'planning'}, ${priority||'medium'}, ${parseFloat(budget||0)}, ${start_date||null}, ${end_date||null}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ project: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^projects\/[a-f0-9-]{36}$/) && req.method === 'PATCH') {
    try {
      const id = route.split('/')[1];
      const { title, description, status, priority, budget } = req.body;
      await sql`UPDATE projects SET title=COALESCE(${title||null},title), description=COALESCE(${description||null},description), status=COALESCE(${status||null},status), priority=COALESCE(${priority||null},priority), budget=COALESCE(${budget!=null?parseFloat(budget):null},budget), updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── TASKS ────────────────────────────────────────────────────────────────
  if (route === 'tasks' && req.method === 'GET') {
    try {
      const pid = req.query?.project_id;
      const rows = pid
        ? await sql`SELECT * FROM tasks WHERE cube_id=${cubeId} AND project_id=${pid} ORDER BY created_at DESC`
        : await sql`SELECT * FROM tasks WHERE cube_id=${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ tasks: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'tasks' && req.method === 'POST') {
    try {
      const { project_id, title, description, status, priority, assigned_to, due_date } = req.body;
      const rows = await sql`
        INSERT INTO tasks (cube_id, project_id, title, description, status, priority, assigned_to, due_date, created_by)
        VALUES (${cubeId}, ${project_id||null}, ${title}, ${description||''}, ${status||'todo'}, ${priority||'medium'}, ${assigned_to||null}, ${due_date||null}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ task: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^tasks\/[a-f0-9-]{36}$/) && req.method === 'PATCH') {
    try {
      const id = route.split('/')[1];
      const { status, title, assigned_to } = req.body;
      await sql`UPDATE tasks SET status=COALESCE(${status||null},status), title=COALESCE(${title||null},title), assigned_to=COALESCE(${assigned_to||null},assigned_to), completed_at=${status==='done'?'NOW()':null}, updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── CUSTOMERS ────────────────────────────────────────────────────────────
  if (route === 'customers' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM customers WHERE cube_id=${cubeId} ORDER BY name ASC`;
      return res.status(200).json({ customers: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'customers' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `cust_${cubeId}`);
      const ref = `CUS-${String(n).padStart(5, '0')}`;
      const { name, email, phone, company, address, country, type, notes } = req.body;
      const rows = await sql`
        INSERT INTO customers (ref, cube_id, name, email, phone, company, address, country, type, notes, created_by)
        VALUES (${ref}, ${cubeId}, ${name}, ${email||''}, ${phone||''}, ${company||''}, ${address||''}, ${country||''}, ${type||'customer'}, ${notes||''}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ customer: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── LEADS ────────────────────────────────────────────────────────────────
  if (route === 'leads' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM leads WHERE cube_id=${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ leads: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'leads' && req.method === 'POST') {
    try {
      const n = await nextSeq(sql, `lead_${cubeId}`);
      const ref = `LED-${String(n).padStart(5, '0')}`;
      const { name, email, phone, company, source, status, value, notes } = req.body;
      const rows = await sql`
        INSERT INTO leads (ref, cube_id, name, email, phone, company, source, status, value, notes, created_by)
        VALUES (${ref}, ${cubeId}, ${name}, ${email||''}, ${phone||''}, ${company||''}, ${source||''}, ${status||'new'}, ${parseFloat(value||0)}, ${notes||''}, ${authUser.sub})
        RETURNING *`;
      return res.status(201).json({ lead: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route.match(/^leads\/[a-f0-9-]{36}$/) && req.method === 'PATCH') {
    try {
      const id = route.split('/')[1];
      const { status, notes, value } = req.body;
      await sql`UPDATE leads SET status=COALESCE(${status||null},status), notes=COALESCE(${notes||null},notes), value=COALESCE(${value!=null?parseFloat(value):null},value), updated_at=NOW() WHERE id=${id} AND cube_id=${cubeId}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── NOTIFICATIONS ────────────────────────────────────────────────────────
  if (route === 'notifications' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM notifications WHERE user_id=${authUser.sub} ORDER BY created_at DESC LIMIT 50`;
      const unread = rows.filter(n => !n.is_read).length;
      return res.status(200).json({ notifications: toDocs(rows), unread });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'notifications/read' && req.method === 'POST') {
    try {
      await sql`UPDATE notifications SET is_read=TRUE WHERE user_id=${authUser.sub}`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'notifications/templates' && req.method === 'GET') return res.status(200).json({ templates: [] });
  if (route === 'notifications/templates' && req.method === 'POST') return res.status(201).json({ ok: true });
  if (route === 'notifications/whatsapp' && req.method === 'POST') return res.status(200).json({ ok: true });

  // ── WALLET ───────────────────────────────────────────────────────────────
  if (route === 'wallet' && req.method === 'GET') {
    try {
      const [exps, invs] = isCreator(authUser)
        ? await Promise.all([
            sql`SELECT COALESCE(SUM(COALESCE(grand_total,total_amount,amount,0)),0) AS total FROM expenses WHERE status='approved'`,
            sql`SELECT COALESCE(SUM(COALESCE(grand_total,total_amount,0)),0) AS total FROM invoices WHERE status IN ('paid','approved')`,
          ])
        : await Promise.all([
            sql`SELECT COALESCE(SUM(COALESCE(grand_total,total_amount,amount,0)),0) AS total FROM expenses WHERE cube_id=${cubeId} AND status='approved'`,
            sql`SELECT COALESCE(SUM(COALESCE(grand_total,total_amount,0)),0) AS total FROM invoices WHERE cube_id=${cubeId} AND status IN ('paid','approved')`,
          ]);
      const totalExpenses = parseFloat(exps[0].total);
      const totalRevenue  = parseFloat(invs[0].total);
      return res.status(200).json({ wallet: { total_expenses: totalExpenses, total_revenue: totalRevenue, balance: totalRevenue - totalExpenses } });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  if (route === 'settings' && req.method === 'GET') {
    try {
      const rows = cubeId
        ? await sql`SELECT key, value FROM settings WHERE cube_id=${cubeId}`
        : await sql`SELECT key, value FROM settings WHERE cube_id IS NULL`;
      const map = {};
      rows.forEach(r => { map[r.key] = r.value; });
      return res.status(200).json({ settings: map });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'settings' && req.method === 'POST') {
    if (!isCubeAdmin(authUser)) return res.status(403).json({ error: 'Admin only' });
    try {
      const { key, value } = req.body;
      await sql`INSERT INTO settings (cube_id, key, value) VALUES (${cubeId||null}, ${key}, ${value})
        ON CONFLICT (cube_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`;
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── CATEGORIES ───────────────────────────────────────────────────────────
  if (route === 'categories' && req.method === 'GET') {
    const cats = ['Materials & Supplies','Labour & Wages','Equipment & Tools','Transport & Fuel','Utilities','Office & Admin','Maintenance & Repairs','Safety & PPE','Marketing','Professional Services','IT & Technology','Travel','Other'];
    return res.status(200).json({ categories: cats.map(name => ({ id: name, name })) });
  }

  // ── DEPARTMENTS ──────────────────────────────────────────────────────────
  if (route === 'departments' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM departments WHERE cube_id=${cubeId} ORDER BY name ASC`;
      return res.status(200).json({ departments: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'departments' && req.method === 'POST') {
    try {
      const { name, notes } = req.body;
      const rows = await sql`INSERT INTO departments (cube_id, name, notes) VALUES (${cubeId}, ${name}, ${notes||''}) RETURNING *`;
      return res.status(201).json({ department: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── FORMS ────────────────────────────────────────────────────────────────
  if (route === 'forms' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM forms WHERE cube_id=${cubeId} ORDER BY created_at DESC`;
      return res.status(200).json({ forms: toDocs(rows) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'forms' && req.method === 'POST') {
    try {
      const { title, fields } = req.body;
      const rows = await sql`INSERT INTO forms (cube_id, title, fields, created_by) VALUES (${cubeId}, ${title||'Untitled'}, ${JSON.stringify(fields||[])}, ${authUser.sub}) RETURNING *`;
      return res.status(201).json({ form: rows[0] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── REPORTS / DASHBOARD ──────────────────────────────────────────────────
  if (route === 'reports/dashboard' && req.method === 'GET') {
    try {
      const cr = isCreator(authUser);
      const [expStats, invStats, workerCount, assetStats, custCount, leadsData, projData] = cr
        ? await Promise.all([
            sql`SELECT COUNT(*)::int total, COALESCE(SUM(CASE WHEN status='approved' THEN COALESCE(grand_total,total_amount,amount,0) ELSE 0 END),0) approved_total, COUNT(CASE WHEN status='pending' THEN 1 END)::int pending_count, COUNT(CASE WHEN status='approved' THEN 1 END)::int approved_count, COUNT(CASE WHEN status='rejected' THEN 1 END)::int rejected_count FROM expenses`,
            sql`SELECT COUNT(*)::int total, COALESCE(SUM(CASE WHEN status IN ('paid','approved') THEN COALESCE(grand_total,total_amount,0) ELSE 0 END),0) approved_total, COUNT(CASE WHEN status='pending' THEN 1 END)::int pending_count, COUNT(CASE WHEN status IN ('paid','approved') THEN 1 END)::int approved_count FROM invoices`,
            sql`SELECT COUNT(*)::int cnt FROM workers`,
            sql`SELECT COUNT(*)::int cnt, COALESCE(SUM(COALESCE(current_value,purchase_price,0)),0) total_value FROM assets`,
            sql`SELECT COUNT(*)::int cnt FROM customers`,
            sql`SELECT status, value FROM leads`,
            sql`SELECT status FROM projects`,
          ])
        : await Promise.all([
            sql`SELECT COUNT(*)::int total, COALESCE(SUM(CASE WHEN status='approved' THEN COALESCE(grand_total,total_amount,amount,0) ELSE 0 END),0) approved_total, COUNT(CASE WHEN status='pending' THEN 1 END)::int pending_count, COUNT(CASE WHEN status='approved' THEN 1 END)::int approved_count, COUNT(CASE WHEN status='rejected' THEN 1 END)::int rejected_count FROM expenses WHERE cube_id=${cubeId}`,
            sql`SELECT COUNT(*)::int total, COALESCE(SUM(CASE WHEN status IN ('paid','approved') THEN COALESCE(grand_total,total_amount,0) ELSE 0 END),0) approved_total, COUNT(CASE WHEN status='pending' THEN 1 END)::int pending_count, COUNT(CASE WHEN status IN ('paid','approved') THEN 1 END)::int approved_count FROM invoices WHERE cube_id=${cubeId}`,
            sql`SELECT COUNT(*)::int cnt FROM workers WHERE cube_id=${cubeId}`,
            sql`SELECT COUNT(*)::int cnt, COALESCE(SUM(COALESCE(current_value,purchase_price,0)),0) total_value FROM assets WHERE cube_id=${cubeId}`,
            sql`SELECT COUNT(*)::int cnt FROM customers WHERE cube_id=${cubeId}`,
            sql`SELECT status, value FROM leads WHERE cube_id=${cubeId}`,
            sql`SELECT status FROM projects WHERE cube_id=${cubeId}`,
          ]);

      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yr = d.getFullYear(), mo = d.getMonth() + 1;
        const mData = cr
          ? await sql`SELECT COALESCE(SUM(COALESCE(grand_total,total_amount,amount,0)),0) total FROM expenses WHERE EXTRACT(YEAR FROM created_at)=${yr} AND EXTRACT(MONTH FROM created_at)=${mo}`
          : await sql`SELECT COALESCE(SUM(COALESCE(grand_total,total_amount,amount,0)),0) total FROM expenses WHERE cube_id=${cubeId} AND EXTRACT(YEAR FROM created_at)=${yr} AND EXTRACT(MONTH FROM created_at)=${mo}`;
        months.push({ month: d.toLocaleString('default', { month: 'short' }), total: parseFloat(mData[0].total) });
      }

      const exp = expStats[0], inv = invStats[0];
      return res.status(200).json({
        expenses: { total_count: exp.total, approved_total: parseFloat(exp.approved_total || 0), pending_count: exp.pending_count, approved_count: exp.approved_count, rejected_count: exp.rejected_count },
        invoices: { total_count: inv.total, approved_total: parseFloat(inv.approved_total || 0), pending_count: inv.pending_count, approved_count: inv.approved_count },
        pending_approvals: exp.pending_count + inv.pending_count,
        monthly_trend: months,
        wallet: { total_invoiced: parseFloat(inv.approved_total || 0), total_expenses: parseFloat(exp.approved_total || 0), balance: parseFloat(inv.approved_total || 0) - parseFloat(exp.approved_total || 0) },
        assets: { total: assetStats[0].cnt, total_value: parseFloat(assetStats[0].total_value) },
        workers: { total: workerCount[0].cnt },
        crm: { customers: custCount[0].cnt, leads: leadsData.length, leads_won: leadsData.filter(l => l.status === 'won').length },
        projects: { total: projData.length, active: projData.filter(p => p.status === 'active').length, tasks_total: 0, tasks_done: 0 },
      });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'reports/wallet' && req.method === 'GET') {
    try {
      const users = await sql`SELECT id, full_name FROM users WHERE cube_id=${cubeId}`;
      const wallets = await Promise.all(users.map(async u => {
        const [te, ti] = await Promise.all([
          sql`SELECT COALESCE(SUM(COALESCE(grand_total,total_amount,amount,0)),0) t FROM expenses WHERE cube_id=${cubeId} AND submitted_by=${u.id} AND status='approved'`,
          sql`SELECT COALESCE(SUM(COALESCE(grand_total,total_amount,0)),0) t FROM invoices WHERE cube_id=${cubeId} AND created_by=${u.id} AND status IN ('paid','approved')`,
        ]);
        return { user_id: u.id, full_name: u.full_name, total_expenses: parseFloat(te[0].t), total_invoiced: parseFloat(ti[0].t), balance: parseFloat(ti[0].t) - parseFloat(te[0].t) };
      }));
      return res.status(200).json({ wallets });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'reports/workers' && req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM workers WHERE cube_id=${cubeId} ORDER BY full_name ASC`;
      return res.status(200).json({ workers: toDocs(rows), total: rows.length, active: rows.filter(w => w.status === 'active').length });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (route === 'reports/projects' && req.method === 'GET') {
    try {
      const [projs, tt, td] = await Promise.all([
        sql`SELECT status FROM projects WHERE cube_id=${cubeId}`,
        sql`SELECT COUNT(*)::int cnt FROM tasks WHERE cube_id=${cubeId}`,
        sql`SELECT COUNT(*)::int cnt FROM tasks WHERE cube_id=${cubeId} AND status='done'`,
      ]);
      return res.status(200).json({ total: projs.length, active: projs.filter(p => p.status === 'active').length, tasks_total: tt[0].cnt, tasks_done: td[0].cnt });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── 404 ──────────────────────────────────────────────────────────────────
  return res.status(404).json({ error: `Route not found: ${route}` });
}
