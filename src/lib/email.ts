import nodemailer from 'nodemailer';

/**
 * Send an email using Resend (if RESEND_API_KEY is set) or SMTP fallback.
 *
 * Resend: Just set RESEND_API_KEY in env vars. Free tier = 100 emails/day.
 * SMTP: Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 *
 * If neither is configured, logs a warning and returns false (never throws).
 */
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Try sending via Resend API.
 * Returns true if sent, false if Resend not configured or error occurred.
 */
async function sendViaResend({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  // IMPORTANT: Resend requires domain verification to send from custom domains.
  // Until RESEND_DOMAIN_VERIFIED=true is set, always use onboarding@resend.dev.
  // This ensures emails work during testing without a purchased/verified domain.
  const domainVerified = process.env.RESEND_DOMAIN_VERIFIED === 'true';
  const fromAddress = domainVerified
    ? (process.env.RESEND_FROM || 'Valtriox <onboarding@resend.dev>')
    : 'Valtriox <onboarding@resend.dev>';

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    // Log detailed result for debugging
    if (result.error) {
      console.error(`[Email/Resend] API returned error for ${to}:`, result.error);
      return false;
    }

    console.log(`[Email/Resend] Sent to ${to} (from: ${fromAddress})`);
    return true;
  } catch (error: any) {
    console.error(`[Email/Resend] Failed to send to ${to}:`, error?.message);
    if (error?.statusCode === 403) {
      console.error(`[Email/Resend] 403 Forbidden — likely the sender domain is not verified in Resend. Use onboarding@resend.dev for testing.`);
    }
    return false;
  }
}

/**
 * Try sending via nodemailer SMTP.
 * Returns true if sent, false if SMTP not configured or error occurred.
 */
async function sendViaSmtp({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'Valtriox <onboarding@resend.dev>';

  if (!host || !user || !pass) {
    console.warn('[Email/SMTP] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Valtriox" <${from}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    console.log(`[Email/SMTP] Sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error(`[Email/SMTP] Failed to send to ${to}:`, error?.message);
    return false;
  }
}

/**
 * Send email - tries Resend first, then SMTP. Returns true if either succeeded.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Try Resend first (simpler setup, modern API)
  const resendResult = await sendViaResend(options);
  if (resendResult) return true;

  // Fallback to SMTP
  const smtpResult = await sendViaSmtp(options);
  if (smtpResult) return true;

  // Neither worked
  console.warn('[Email] No email provider configured. Set RESEND_API_KEY or SMTP_* env vars.');
  return false;
}

/**
 * Check if any email provider is configured.
 */
export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}
