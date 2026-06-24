// Uses Resend HTTP API (port 443) — works on Render free tier which blocks SMTP ports.
// Set RESEND_API_KEY (or SMTP_PASS when SMTP_USER=resend) in environment variables.

function getApiKey() {
  // Support both RESEND_API_KEY and the SMTP_PASS pattern (SMTP_USER=resend)
  return process.env.RESEND_API_KEY ||
    (process.env.SMTP_USER === 'resend' ? process.env.SMTP_PASS : null);
}

async function testSmtp() {
  const key = getApiKey();
  if (!key) return { ok: false, error: 'RESEND_API_KEY not set (or SMTP_USER=resend + SMTP_PASS=re_...)' };
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { ok: true, service: 'Resend HTTP API' };
    const data = await res.json();
    return { ok: false, error: data.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function sendVerificationEmail(toUser, verificationUrl) {
  const key  = getApiKey();
  const from = process.env.SMTP_FROM || 'onboarding@resend.dev';

  if (!key) {
    console.warn('[Email] No API key found — set RESEND_API_KEY or SMTP_USER=resend + SMTP_PASS=re_...');
    return false;
  }

  const html = `
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
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from,
        to:      [toUser.email],
        subject: 'Verify your account — n8n Pipeline Dashboard',
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[Email] Resend API error ${res.status}: ${data.message ?? JSON.stringify(data)}`);
      return false;
    }
    console.log(`[Email] Verification sent → ${toUser.email} (id: ${data.id})`);
    return true;
  } catch (err) {
    console.error(`[Email] Send failed: ${err.message}`);
    return false;
  }
}

module.exports = { sendVerificationEmail, testSmtp };
