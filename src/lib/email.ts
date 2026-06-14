import { Resend } from 'resend';
import nodemailer from 'nodemailer';

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
// Email Options Interface
// ============================================================================
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ============================================================================
// Resend Sender — Uses official SDK with domain verification check
// ============================================================================
async function sendViaResend({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;

  // When RESEND_DOMAIN_VERIFIED=true, use custom domain sender (noreply@valtriox.com)
  // Otherwise fall back to onboarding@resend.dev for testing
  const domainVerified = process.env.RESEND_DOMAIN_VERIFIED === 'true';
  const fromAddress = domainVerified
    ? (process.env.RESEND_FROM || 'Valtriox <onboarding@resend.dev>')
    : 'Valtriox <onboarding@resend.dev>';

  try {
    const data = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    if (data.error) {
      console.error(`[Email/Resend] API error for ${to}:`, data.error);
      return false;
    }

    console.log(`[Email/Resend] Email sent successfully: ${data.id} → ${to} (from: ${fromAddress})`);
    return true;
  } catch (error: any) {
    console.error(`[Email/Resend] Error sending email to ${to}:`, error?.message);
    if (error?.statusCode === 403) {
      console.error(`[Email/Resend] 403 Forbidden — domain not verified in Resend dashboard.`);
    }
    return false;
  }
}

// ============================================================================
// SMTP Fallback (Zoho / Gmail / any SMTP server)
// ============================================================================
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
  console.warn('[Email] No email provider configured. Set RESEND_API_KEY or SMTP_* env vars.');
  return false;
}

// ============================================================================
// Utility — Check if any email provider is configured
// ============================================================================
export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}