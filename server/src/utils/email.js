const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host:             process.env.SMTP_HOST  || 'smtp.gmail.com',
    port:             parseInt(process.env.SMTP_PORT || '587', 10),
    secure:           process.env.SMTP_SECURE === 'true',
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function testSmtp() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { ok: false, error: 'SMTP_USER or SMTP_PASS env var not set' };
  }
  try {
    const t = createTransport();
    await t.verify();
    return { ok: true, user: process.env.SMTP_USER };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function sendVerificationEmail(toUser, verificationUrl) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP_USER/SMTP_PASS not set — skipping email');
    return false;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await createTransport().sendMail({
      from:    `"n8n Pipeline Dashboard" <${from}>`,
      to:      toUser.email,
      subject: 'Verify your account — n8n Pipeline Dashboard',
      html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:2rem;margin:0">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:2.5rem;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <div style="text-align:center;margin-bottom:1.5rem">
    <div style="font-size:2rem">⚡</div>
    <h1 style="font-size:1.375rem;font-weight:700;color:#0f172a;margin:.5rem 0 0">Verify your email</h1>
  </div>
  <p style="color:#475569;font-size:.9375rem;line-height:1.6;margin:0 0 1.5rem">
    Hi <strong>${toUser.name}</strong>,<br><br>
    Welcome to n8n Pipeline Dashboard! Click the button below to verify your email address and activate your account.
  </p>
  <div style="text-align:center;margin:1.75rem 0">
    <a href="${verificationUrl}"
       style="display:inline-block;background:linear-gradient(135deg,#0d9488,#3b82f6);color:#fff;text-decoration:none;padding:.875rem 2.25rem;border-radius:8px;font-weight:600;font-size:.9375rem">
      Verify Email Address
    </a>
  </div>
  <p style="color:#94a3b8;font-size:.8125rem;line-height:1.6;margin:0">
    This link expires in <strong>24 hours</strong>. If you didn't create this account, ignore this email.
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:1.5rem 0">
  <p style="color:#cbd5e1;font-size:.75rem;margin:0;word-break:break-all">Or copy: ${verificationUrl}</p>
</div>
</body></html>`,
    });
    console.log(`[Email] Verification sent → ${toUser.email}`);
    return true;
  } catch (err) {
    console.error(`[Email] Send failed: ${err.message}`);
    return false;
  }
}

module.exports = { sendVerificationEmail, testSmtp };
