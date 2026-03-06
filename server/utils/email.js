const APP_URL = process.env.CLIENT_URL || 'https://duel-meet.vercel.app';

async function brevoSend({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'DuelMeet', email: process.env.BREVO_SENDER_EMAIL || 'noreply@duelmeet.app' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo error ${res.status}: ${text}`);
  }
}

const baseWrapper = (inner) => `
  <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:40px 28px;
    background:#0c0e1e;color:#e8e8f0;border-radius:14px;border:1px solid rgba(124,111,255,0.25)">
    <div style="text-align:center;margin-bottom:28px">
      <span style="font-size:2rem">🃏</span>
      <h2 style="color:#7c6fff;margin:8px 0 4px;font-size:1.4rem">TCG Duel Meet</h2>
    </div>
    ${inner}
    <p style="margin-top:32px;color:#555;font-size:11px;text-align:center">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>`;

async function sendVerificationEmail(email, token) {
  const url = `${APP_URL}/auth/verify-email?token=${token}`;
  await brevoSend({
    to: email,
    subject: 'Verify your DuelMeet account',
    html: baseWrapper(`
      <h3 style="margin:0 0 12px;color:#e8e8f0">Verify your email address</h3>
      <p style="color:#aaa;line-height:1.6">
        Thanks for joining TCG Duel Meet! Click the button below to confirm your email and
        start finding games in your area.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${url}"
          style="display:inline-block;padding:14px 32px;background:#7c6fff;color:#fff;
          border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;
          letter-spacing:0.02em">
          Verify Email
        </a>
      </div>
      <p style="color:#555;font-size:12px;text-align:center">
        This link expires in <strong style="color:#aaa">24 hours</strong>.
      </p>`),
  });
}

async function sendPasswordResetEmail(email, token) {
  const url = `${APP_URL}/auth/reset-password?token=${token}`;
  await brevoSend({
    to: email,
    subject: 'Reset your DuelMeet password',
    html: baseWrapper(`
      <h3 style="margin:0 0 12px;color:#e8e8f0">Reset your password</h3>
      <p style="color:#aaa;line-height:1.6">
        We received a request to reset the password for your TCG Duel Meet account.
        Click the button below to choose a new password.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${url}"
          style="display:inline-block;padding:14px 32px;background:#7c6fff;color:#fff;
          border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;
          letter-spacing:0.02em">
          Reset Password
        </a>
      </div>
      <p style="color:#555;font-size:12px;text-align:center">
        This link expires in <strong style="color:#aaa">1 hour</strong>.
      </p>`),
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
