// api/_email.js — Alpha Quantum ERP v18 — IONOS SMTP
export async function sendEmail({ to, subject, html, text }) {
  const pass = process.env.SMTP_PASS;
  if (!pass) { console.warn('[Email] SMTP_PASS not set'); return { ok: false }; }
  try {
    const nodemailer = await import('nodemailer').catch(() => null);
    if (!nodemailer) return { ok: false, error: 'nodemailer not found' };
    const t = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ionos.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER || 'erp@alpha-01.info', pass },
      tls: { rejectUnauthorized: false },
    });
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || 'Alpha Quantum ERP <erp@alpha-01.info>',
      replyTo: process.env.SMTP_REPLY_TO || 'reply@alpha-01.info',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject, html: html || text || '', text: text || '',
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) { console.error('[Email]', e.message); return { ok: false, error: e.message }; }
}

export function expenseApprovedTemplate(name, ref, amount, status) {
  const color = status === 'approved' ? '#10b981' : '#f43f5e';
  return {
    subject: `Expense ${ref} ${status === 'approved' ? 'Approved ✓' : 'Rejected ✗'} — Alpha Quantum ERP`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0e1420;color:#eef2ff;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 28px">
        <h2 style="margin:0;color:#fff">Alpha Quantum ERP</h2>
      </div>
      <div style="padding:28px">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your expense <strong>${ref}</strong> has been <span style="color:${color}">${status}</span>.</p>
        <p style="font-family:monospace;font-size:1.2rem;color:${color}">SAR ${parseFloat(amount||0).toLocaleString('en-SA')}</p>
        <p style="color:#4b5675;font-size:12px">Login at <a href="https://erp.alpha-01.info" style="color:#3b82f6">erp.alpha-01.info</a></p>
      </div>
    </div>`,
  };
}

export function welcomeUserTemplate(fullName, username, password) {
  return {
    subject: 'Your Alpha Quantum ERP Account',
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0e1420;color:#eef2ff;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 28px">
        <h2 style="margin:0;color:#fff">Welcome to Alpha Quantum ERP</h2>
      </div>
      <div style="padding:28px">
        <p>Hello <strong>${fullName}</strong>, your account is ready.</p>
        <p>Username: <strong>${username}</strong></p>
        <p>Password: <strong>${password}</strong></p>
        <p><a href="https://erp.alpha-01.info" style="color:#3b82f6">Login at erp.alpha-01.info</a></p>
        <p style="color:#f59e0b;font-size:12px">⚠️ Please change your password after first login.</p>
      </div>
    </div>`,
  };
}
