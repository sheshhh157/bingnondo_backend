const nodemailer = require('nodemailer');

// ─── Transporter ──────────────────────────────────────────────────────────────
// Configured via .env — see .env.example for setup instructions.
// Works with Gmail App Passwords, Brevo, Resend, Mailgun, or any SMTP.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── OTP Email ────────────────────────────────────────────────────────────────

/**
 * Send a 6-digit OTP to the given email.
 * @param {string} to         Recipient email address
 * @param {string} otpCode    The 6-digit OTP
 * @param {'email_verification'|'password_reset'} purpose
 */
async function sendOtpEmail(to, otpCode, purpose) {
  const subjects = {
    email_verification: 'Verify your Bingnondo account',
    password_reset: 'Reset your Bingnondo password',
  };

  const intros = {
    email_verification:
      'Thanks for signing up! Use the code below to verify your email address.',
    password_reset:
      'We received a request to reset your password. Use the code below.',
  };

  const subject = subjects[purpose] || 'Your Bingnondo OTP';
  const intro = intros[purpose] || 'Your one-time code:';

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #b91c1c;">Bingnondo Cafe 🧧</h2>
      <p>${intro}</p>
      <div style="
        background: #fef2f2;
        border: 2px solid #b91c1c;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        margin: 24px 0;
      ">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #b91c1c;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This code expires in <strong>10 minutes</strong>.
        If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        Bingnondo Cafe — Do not reply to this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

module.exports = { sendOtpEmail };
