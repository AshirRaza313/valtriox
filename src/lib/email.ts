// @ts-nocheck — Phase 8: pre-existing TS errors (Decimal/Prisma types, etc.) pending migration
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import logger from '@/lib/logger';

// ============================================================================
// Resend SDK — Initialized once, reused across requests
// ============================================================================
let _resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  if (!_resendInstance) {
    _resendInstance = new Resend(apiKey);
  }
  return _resendInstance;
}

// ============================================================================
// Email Address Constants
// Phase 7: Separate "from" addresses for OTP vs Support emails
// - OTP/transactional emails → noreply@valtriox.com (no reply expected)
// - Support/notification emails → ashir@valtriox.com (clients can reply)
// ============================================================================
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'ashir@valtriox.com';

// OTP "from" — noreply address for transactional emails (password reset, verification)
const OTP_FROM = process.env.OTP_FROM || `Valtriox <noreply@valtriox.com>`;

// Support "from" — reply-to-able address for notifications, documents, invites
const SUPPORT_FROM = process.env.SUPPORT_FROM || `Valtriox <${SUPPORT_EMAIL}>`;

// Support "replyTo" — where client replies go
const SUPPORT_REPLY_TO = process.env.SUPPORT_REPLY_TO || SUPPORT_EMAIL;

export { OTP_FROM, SUPPORT_FROM, SUPPORT_REPLY_TO, SUPPORT_EMAIL };

// ============================================================================
// Email Options Interface
// Phase 7: Added optional `from` and `replyTo` fields
// ============================================================================
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Custom "from" address. Defaults to SUPPORT_FROM. Use OTP_FROM for transactional emails. */
  from?: string;
  /** Reply-To address. Defaults to SUPPORT_EMAIL for support emails, omitted for OTP emails. */
  replyTo?: string;
}

// ============================================================================
// Resend Sender — Uses official SDK with domain verification check
// ============================================================================
async function sendViaResend({ to, subject, html, text, from, replyTo }: EmailOptions): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;

  // When RESEND_DOMAIN_VERIFIED=true, use custom domain sender
  // Otherwise fall back to onboarding@resend.dev for testing
  const domainVerified = process.env.RESEND_DOMAIN_VERIFIED === 'true';

  let fromAddress: string;
  if (from) {
    // Caller specified a custom from address
    fromAddress = from;
  } else if (domainVerified) {
    // Default to support from address with custom domain
    fromAddress = SUPPORT_FROM;
  } else {
    // Testing mode — use Resend's default sender
    fromAddress = 'Valtriox <onboarding@resend.dev>';
  }

  try {
    const emailData: Record<string, any> = {
      from: fromAddress,
      to: [to],
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''),
    };

    // Add replyTo only if specified (support emails) or if using support from address
    if (replyTo) {
      emailData.reply_to = replyTo;
    } else if (fromAddress !== OTP_FROM && fromAddress !== 'Valtriox <onboarding@resend.dev>') {
      // Auto-add replyTo for support emails (not for OTP or test emails)
      emailData.reply_to = SUPPORT_REPLY_TO;
    }

    const data = await resend.emails.send(emailData as any);

    if (data.error) {
      logger.error('[Email/Resend] API error', { to, error: data.error });
      return false;
    }

    logger.info('[Email/Resend] Email sent successfully', { id: data.id, to, from: fromAddress });
    return true;
  } catch (error: any) {
    logger.error('[Email/Resend] Error sending email', error, { to });
    if (error?.statusCode === 403) {
      logger.error('[Email/Resend] 403 Forbidden — domain not verified in Resend dashboard');
    }
    return false;
  }
}

// ============================================================================
// SMTP Fallback (Zoho / Gmail / any SMTP server)
// Phase 4: Module-level SMTP transporter singleton with connection pooling
let _smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  if (!_smtpTransporter) {
    _smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      pool: true,          // Enable connection pooling
      maxConnections: 5,   // Max simultaneous connections
      maxMessages: 100,    // Max messages per connection
    });
  }
  return _smtpTransporter;
}

// ============================================================================
async function sendViaSmtp({ to, subject, html, text, from, replyTo }: EmailOptions): Promise<boolean> {
  const smtpFrom = from || process.env.SMTP_FROM || process.env.SMTP_USER || SUPPORT_FROM;

  const transporter = getSmtpTransporter();
  if (!transporter) {
    logger.warn('[Email/SMTP] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS');
    return false;
  }

  try {
    const mailOptions: Record<string, any> = {
      from: `"Valtriox" <${smtpFrom}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    };

    // Add replyTo for support emails
    if (replyTo) {
      mailOptions.replyTo = replyTo;
    } else if (from !== OTP_FROM) {
      mailOptions.replyTo = SUPPORT_REPLY_TO;
    }

    await transporter.sendMail(mailOptions);
    logger.info('[Email/SMTP] Sent', { to, from: smtpFrom });
    return true;
  } catch (error: any) {
    logger.error('[Email/SMTP] Failed to send', error, { to });
    return false;
  }
}

// ============================================================================
// Public API — sendEmail() tries Resend first, then SMTP fallback
// ============================================================================
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Try Resend first (official SDK, modern API, better deliverability)
  const resendResult = await sendViaResend(options);
  if (resendResult) return true;

  // Fallback to SMTP (Zoho, Gmail, etc.)
  const smtpResult = await sendViaSmtp(options);
  if (smtpResult) return true;

  // Neither worked — testing mode will handle this in API routes
  logger.warn('[Email] No email provider configured. Set RESEND_API_KEY or SMTP_* env vars');
  return false;
}

// ============================================================================
// Utility — Check if any email provider is configured
// ============================================================================
export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}
