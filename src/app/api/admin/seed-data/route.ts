import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, createAllTables, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════════════════
//  Professional Email Templates - HTML with inline styles
// ═══════════════════════════════════════════════════════════════════════════

const BRAND_COLOR = "#D4A73A";
const BRAND_DARK = "#A8851F";
const BRAND_LIGHT = "#FFF9E6";
const TEXT_PRIMARY = "#1a1a2e";
const TEXT_SECONDARY = "#4a4a6a";
const TEXT_MUTED = "#6b7280";
const BG_BODY = "#f8fafc";

function brandedEmailWrapper(innerHtml: string, brandName: string, previewText: string) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${previewText}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:${BG_BODY}; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <!-- Preview Text -->
  <div style="display:none; font-size:1px; color:${BG_BODY}; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
    ${previewText}
  </div>
  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG_BODY};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <!-- Inner container - 600px max -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; width:100%;">
          <!-- ══ Branded Header Bar ══ -->
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND_COLOR}, ${BRAND_DARK}); padding:28px 32px; border-radius:12px 12px 0 0; text-align:center;">
              <h1 style="margin:0; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:-0.3px;">${brandName}</h1>
            </td>
          </tr>
          <!-- ══ Body ══ -->
          <tr>
            <td style="background:#ffffff; padding:36px 32px; border-left:1px solid #e5e7eb; border-right:1px solid #e5e7eb;">
              ${innerHtml}
            </td>
          </tr>
          <!-- ══ Social Footer ══ -->
          <tr>
            <td style="background:#ffffff; padding:0 32px 28px; border-left:1px solid #e5e7eb; border-right:1px solid #e5e7eb; border-radius:0 0 12px 12px; border-bottom:1px solid #e5e7eb;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-top:20px; border-top:1px solid #f3f4f6;">
                    <p style="margin:0 0 8px; font-size:12px; color:${TEXT_MUTED}; text-align:center;">
                      &copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.
                    </p>
                    <p style="margin:0; font-size:11px; color:${TEXT_MUTED}; text-align:center;">
                      {{brandEmail}} &nbsp;|&nbsp; {{brandPhone}} &nbsp;|&nbsp; <a href="{{brandWebsite}}" style="color:${BRAND_COLOR}; text-decoration:none;">Website</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="background:${BRAND_COLOR}; border-radius:8px; text-align:center;">
        <a href="${url}" style="display:inline-block; padding:14px 36px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; letter-spacing:-0.2px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

// ─── Template Definitions ──────────────────────────────────────────────────

const SEED_TEMPLATES = [
  {
    type: "lead_welcome",
    name: "Lead Welcome Email",
    subject: "Welcome to {{brandName}}, {{leadName}}! - Your Free Guide is Inside",
    variables: ["leadName", "leadEmail", "companyName", "industry", "consultationType", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Hi <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Welcome to <strong>{{brandName}}</strong> - the all-in-one brand management platform built in Pakistan, for Pakistani brands! We're thrilled you've taken the first step toward transforming <strong>{{companyName}}</strong>'s operations. You're now joining <strong>500+ brands</strong> who trust us to power their growth.
      </p>
      <!-- Download Lead Magnet -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; background:${BRAND_LIGHT}; border-radius:10px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 8px; font-size:14px; font-weight:700; color:${BRAND_DARK};">&#128218; Download Your Free Comprehensive Guide</p>
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              We've prepared a detailed guide about {{brandName}} - covering all 8 powerful modules, real case studies from Pakistani brands, pricing breakdowns, and a step-by-step onboarding walkthrough. It's everything you need to make an informed decision.
            </p>
          </td>
        </tr>
      </table>
      <!-- Key Services Highlight -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
        <tr>
          <td style="padding:0;">
            <p style="margin:0 0 10px; font-size:14px; font-weight:700; color:${TEXT_PRIMARY};">Here's what {{brandName}} can do for you:</p>
            <ul style="margin:0; padding-left:18px; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.9;">
              <li><strong>Order Management</strong> - Real-time tracking, SLA monitoring, priority scoring</li>
              <li><strong>AI-Powered Insights</strong> - Daily briefings, sales forecasts, demand prediction</li>
              <li><strong>Team Collaboration</strong> - 8+ roles, task boards, attendance tracking, payroll</li>
              <li><strong>Marketing Hub</strong> - AI content writer, campaign management, WhatsApp integration</li>
              <li><strong>Analytics Dashboard</strong> - Revenue tracking, expense reports, performance leaderboards</li>
            </ul>
          </td>
        </tr>
      </table>
      <!-- What Happens Next Card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; background:#f9fafb; border-radius:10px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 6px; font-size:14px; font-weight:700; color:${BRAND_DARK};">What Happens Next?</p>
            <ul style="margin:6px 0 0; padding-left:18px; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.9;">
              <li>Our team will contact you within <strong>24 hours</strong> for a free consultation</li>
              <li>We'll prepare a personalized strategy for {{companyName}} in the {{industry}} space</li>
              <li>You'll receive a live demo showing exactly how {{brandName}} fits your workflow</li>
            </ul>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px; font-size:14px; color:${TEXT_SECONDARY}; line-height:1.7;">
        With <strong>99.9% uptime</strong> and <strong>24/7 customer support</strong>, you can count on us every step of the way. Ready to see the platform in action?
      </p>
      ${ctaButton("Schedule Your Free Consultation", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        Warm regards,<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">Built in Pakistan. Trusted by 500+ brands. 24/7 Support.</span>
      </p>
    `, "{{brandName}}", "Welcome! Your free guide + next steps inside"),
  },
  {
    type: "lead_follow_up",
    name: "Follow-Up Email",
    subject: "Following up - How {{brandName}} can save you 15+ hours/week",
    variables: ["leadName", "leadEmail", "companyName", "industry", "consultationType", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Hi <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        I wanted to follow up on your recent inquiry about <strong>{{brandName}}</strong>. We noticed we haven't had a chance to connect yet, and I'd love to show you how brands like <strong>{{companyName}}</strong> in the {{industry}} space are saving <strong>15+ hours per week</strong> and increasing revenue by up to <strong>30%</strong> using our platform.
      </p>
      <!-- Key Benefits -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="padding:16px 20px; background:#f9fafb;">
            <p style="margin:0 0 10px; font-size:14px; font-weight:700; color:${BRAND_DARK};">Why brands like yours are switching to {{brandName}}:</p>
            <ul style="margin:0; padding-left:18px; font-size:13px; color:${TEXT_SECONDARY}; line-height:2;">
              <li><strong>Save 15+ hours/week</strong> with automated order management &amp; AI-powered insights</li>
              <li><strong>Increase revenue by 30%</strong> with smart demand prediction &amp; marketing automation</li>
              <li><strong>Start strong</strong> - Starter plan at Rs. 7,999/month with 3 members &amp; 100 orders</li>
              <li><strong>Scale up</strong> - Growth plan at Rs. 15,000/month with 8 members &amp; 500 orders</li>
              <li><strong>Go pro</strong> - Professional plan at Rs. 25,000/month with unlimited orders &amp; 15 members</li>
              <li><strong>99.9% uptime</strong> with 24/7 Pakistani customer support</li>
            </ul>
          </td>
        </tr>
      </table>
      <!-- Case Study Hint -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; background:${BRAND_LIGHT}; border-radius:8px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0 0 4px; font-size:13px; font-weight:700; color:${BRAND_DARK};">&#128640; Real Results</p>
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              Brands just like yours in the {{industry}} space have grown <strong>3x</strong> with our platform - from manual spreadsheets to fully automated operations in under 60 seconds of setup.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px; font-size:14px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Whether you're ready to start or just exploring options, we'd love to have a quick <strong>30-minute consultation</strong> - no pressure, no commitments. Download our <strong>free comprehensive guide</strong> to learn everything about {{brandName}} before the call.
      </p>
      ${ctaButton("Schedule Your Free 30-Min Consultation", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        Looking forward to connecting,<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">Email: {{brandEmail}} | Phone: {{brandPhone}}</span>
      </p>
    `, "{{brandName}} follow-up", "Save 15+ hours/week - see how brands like yours grew 3x"),
  },
  {
    type: "consultation_reminder",
    name: "Consultation Reminder",
    subject: "Your {{brandName}} Consultation - {{preferredDate}} at {{preferredTime}}",
    variables: ["leadName", "leadEmail", "leadPhone", "companyName", "consultationType", "preferredDate", "preferredTime", "timezone", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Hi <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        This is a friendly reminder about your upcoming <strong>{{consultationType}}</strong> consultation with <strong>{{brandName}}</strong>. We're genuinely looking forward to our conversation about how we can help <strong>{{companyName}}</strong> grow!
      </p>
      <!-- Calendar-style date/time display -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td width="80" style="background:${BRAND_COLOR}; padding:16px; text-align:center; vertical-align:middle;">
            <p style="margin:0; font-size:24px; font-weight:700; color:#ffffff; line-height:1;">&#128197;</p>
          </td>
          <td style="padding:16px 20px; background:#f9fafb;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 4px;">
                  <p style="margin:0; font-size:13px; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Date</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0;">
                  <p style="margin:0; font-size:15px; font-weight:700; color:${TEXT_PRIMARY};">{{preferredDate}}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 0 0;">
                  <p style="margin:0; font-size:14px; color:${TEXT_SECONDARY};"><strong>Time:</strong> {{preferredTime}} ({{timezone}})</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- What to Expect -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px; background:${BRAND_LIGHT}; border-radius:8px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 6px; font-size:14px; font-weight:700; color:${BRAND_DARK};">What to expect in our call:</p>
            <ul style="margin:6px 0 0; padding-left:16px; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.8;">
              <li>We'll walk you through a <strong>live demo</strong> of all 8 {{brandName}} modules</li>
              <li>We'll discuss your <strong>specific needs</strong> and current operational challenges</li>
              <li>We'll show you exactly <strong>how {{brandName}} can transform your operations</strong></li>
              <li>We'll recommend the <strong>best plan</strong> - Starter (Rs. 7,999/mo), Growth (Rs. 15,000/mo), Professional (Rs. 25,000/mo), or Enterprise (Rs. 75,000+/mo)</li>
            </ul>
          </td>
        </tr>
      </table>
      <!-- Tips -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:${TEXT_PRIMARY};">To prepare for our call:</p>
            <ul style="margin:6px 0 0; padding-left:16px; font-size:12px; color:${TEXT_SECONDARY}; line-height:1.7;">
              <li>Have your current challenges and pain points ready to discuss</li>
              <li>Think about which modules matter most: Orders, Inventory, Marketing, Analytics, etc.</li>
              <li>Download our <strong>free comprehensive guide</strong> for a head start</li>
              <li>Find a quiet space for the consultation - it'll be worth it!</li>
            </ul>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px; font-size:14px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Need to reschedule? No problem - just reply to this email or call us at <strong>{{brandPhone}}</strong> and we'll find a time that works better for you.
      </p>
      ${ctaButton("Reschedule if Needed", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        See you soon,<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">24/7 Support: {{brandEmail}} | {{brandPhone}}</span>
      </p>
    `, "Consultation Reminder", "Your consultation is coming up - here's how to prepare"),
  },
  {
    type: "proposal_sent",
    name: "Proposal Sent Notification",
    subject: "Your Custom {{brandName}} Proposal for {{companyName}} is Ready",
    variables: ["leadName", "leadEmail", "companyName", "consultationType", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Hi <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Great news! Based on our consultation, the <strong>{{brandName}}</strong> team has crafted a custom proposal specifically for <strong>{{companyName}}</strong>. Our proposal is tailored to your unique needs in the {{consultationType}} space, covering every detail from modules to pricing to implementation.
      </p>
      <!-- What's Inside -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="padding:20px 24px; background:#f9fafb;">
            <p style="margin:0 0 14px; font-size:14px; font-weight:700; color:${BRAND_DARK};">What's inside your proposal:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:6px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <span style="color:${BRAND_COLOR}; font-weight:700; margin-right:8px;">&#10003;</span> Recommended modules (Order Management, AI Insights, Team Collaboration, Marketing Hub &amp; more)
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <span style="color:${BRAND_COLOR}; font-weight:700; margin-right:8px;">&#10003;</span> Transparent pricing - Starter (Rs. 7,999/mo), Growth (Rs. 15,000/mo), Professional (Rs. 25,000/mo), or Enterprise (Rs. 75,000+/mo)
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <span style="color:${BRAND_COLOR}; font-weight:700; margin-right:8px;">&#10003;</span> Implementation timeline - setup in 60 seconds, full onboarding in 1-2 weeks
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <span style="color:${BRAND_COLOR}; font-weight:700; margin-right:8px;">&#10003;</span> Expected ROI projections based on your industry
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <span style="color:${BRAND_COLOR}; font-weight:700; margin-right:8px;">&#10003;</span> Dedicated support plan with 24/7 assistance
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Implementation Timeline -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; background:${BRAND_LIGHT}; border-radius:8px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:${BRAND_DARK};">&#9889; Quick Start Promise</p>
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              Setup takes just <strong>60 seconds</strong>. Full onboarding with your team is completed in <strong>1-2 weeks</strong>. You'll have a dedicated account manager from day one. Join <strong>500+ brands</strong> already growing with {{brandName}}.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px; font-size:14px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Please take some time to review the proposal carefully. Download our <strong>free comprehensive guide</strong> for additional context. We're happy to walk you through any section or make adjustments - just reply to this email.
      </p>
      ${ctaButton("Review Your Proposal", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        We're excited about the opportunity to partner with {{companyName}},<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">Contact: {{brandEmail}} | {{brandPhone}} | <a href="{{brandWebsite}}" style="color:${BRAND_COLOR}; text-decoration:none;">{{brandWebsite}}</a></span>
      </p>
    `, "Your custom proposal is ready", "Review your tailored {{brandName}} proposal"),
  },
  {
    type: "thank_you",
    name: "Thank You Email",
    subject: "Welcome to the {{brandName}} Family, {{leadName}}! &#127881;",
    variables: ["leadName", "leadEmail", "companyName", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Dear <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        <strong>Welcome to the {{brandName}} family!</strong> &#127881; We're honored that <strong>{{companyName}}</strong> has chosen us as your growth partner. You're now part of a community of <strong>500+ Pakistani brands</strong> who are transforming their operations with our platform.
      </p>
      <!-- Quick Start Guide -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; background:${BRAND_LIGHT}; border-radius:10px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:18px 22px;">
            <p style="margin:0 0 10px; font-size:14px; font-weight:700; color:${BRAND_DARK};">&#128640; Your Quick Start Guide:</p>
            <ol style="margin:0; padding-left:18px; font-size:13px; color:${TEXT_SECONDARY}; line-height:2;">
              <li><strong>Login</strong> to your account - setup takes just 60 seconds</li>
              <li><strong>Invite your team</strong> - add members with 8+ role-based permissions</li>
              <li><strong>Set up your first order</strong> - track it in real-time with SLA monitoring</li>
              <li><strong>Explore AI Insights</strong> - get daily briefings and sales forecasts</li>
              <li><strong>Enable Marketing Hub</strong> - schedule campaigns and manage WhatsApp integration</li>
            </ol>
          </td>
        </tr>
      </table>
      <!-- Support Channels -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="padding:16px 20px; background:#f9fafb;">
            <p style="margin:0 0 10px; font-size:14px; font-weight:700; color:${BRAND_DARK};">Need help? We're here 24/7:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:4px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <strong>Email:</strong> {{brandEmail}}
                </td>
              </tr>
              <tr>
                <td style="padding:4px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <strong>Phone:</strong> {{brandPhone}}
                </td>
              </tr>
              <tr>
                <td style="padding:4px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <strong>WhatsApp:</strong> Message us anytime for instant support
                </td>
              </tr>
              <tr>
                <td style="padding:4px 0; font-size:13px; color:${TEXT_SECONDARY};">
                  <strong>Website:</strong> <a href="{{brandWebsite}}" style="color:${BRAND_COLOR}; text-decoration:none;">{{brandWebsite}}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Share Guide CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              &#128218; <strong>Share the love:</strong> Forward our free comprehensive guide about {{brandName}} to your team members so everyone can get up to speed quickly!
            </p>
          </td>
        </tr>
      </table>
      ${ctaButton("Access Your Account", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        Welcome aboard - let's build something amazing together,<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">99.9% Uptime | 24/7 Support | 500+ Brands Trust Us</span>
      </p>
    `, "Welcome to {{brandName}}!", "Welcome aboard - your quick start guide inside"),
  },
  {
    type: "lead_nurture",
    name: "Lead Nurture Email",
    subject: "{{leadName}}, see how Pakistani brands are growing 3x with {{brandName}}",
    variables: ["leadName", "leadEmail", "companyName", "companySize", "industry", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Hi <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        It's been a little while since we last connected. We've been busy helping companies like <strong>{{companyName}}</strong> in the {{industry}} space achieve remarkable results - and I wanted to share an update that might be the perfect timing for you.
      </p>
      <!-- Success Story -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="background:${BRAND_COLOR}; padding:12px 20px;">
            <p style="margin:0; font-size:12px; font-weight:700; color:#ffffff; text-transform:uppercase; letter-spacing:0.8px;">&#127942; Real Success Story - {{industry}} Industry</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px; background:#f9fafb;">
            <p style="margin:0 0 12px; font-size:14px; font-weight:700; color:${TEXT_PRIMARY};">How one E-Commerce brand grew their order volume 3x in 3 months</p>
            <p style="margin:0 0 14px; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.7;">
              After switching to {{brandName}}, one of our clients in the E-Commerce industry saw a <strong>3x increase in order volume</strong> within just 3 months. They automated their entire order pipeline with SLA monitoring, leveraged <strong>AI-Powered Insights</strong> for demand prediction, and used the <strong>Marketing Hub</strong> to run targeted WhatsApp campaigns. Their team went from chaos to clarity.
            </p>
            <!-- Success Metrics -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="25%" style="padding:8px 0; text-align:center;">
                  <p style="margin:0; font-size:22px; font-weight:700; color:${BRAND_COLOR};">3x</p>
                  <p style="margin:2px 0 0; font-size:11px; color:${TEXT_MUTED};">Order Growth</p>
                </td>
                <td width="25%" style="padding:8px 0; text-align:center;">
                  <p style="margin:0; font-size:22px; font-weight:700; color:${BRAND_COLOR};">15hr</p>
                  <p style="margin:2px 0 0; font-size:11px; color:${TEXT_MUTED};">Saved/Week</p>
                </td>
                <td width="25%" style="padding:8px 0; text-align:center;">
                  <p style="margin:0; font-size:22px; font-weight:700; color:${BRAND_COLOR};">30%</p>
                  <p style="margin:2px 0 0; font-size:11px; color:${TEXT_MUTED};">More Revenue</p>
                </td>
                <td width="25%" style="padding:8px 0; text-align:center;">
                  <p style="margin:0; font-size:22px; font-weight:700; color:${BRAND_COLOR};">3mo</p>
                  <p style="margin:2px 0 0; font-size:11px; color:${TEXT_MUTED};">Timeline</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Feature Spotlight -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; background:${BRAND_LIGHT}; border-radius:8px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0 0 4px; font-size:13px; font-weight:700; color:${BRAND_DARK};">&#128161; Feature Spotlight: AI-Powered Insights</p>
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              Our latest AI engine doesn't just report data - it <strong>predicts demand before it happens</strong>. Get daily briefings, sales forecasts, smart recommendations, and automated alerts so you're always one step ahead. Available on all plans from Starter to Enterprise.
            </p>
          </td>
        </tr>
      </table>
      <!-- Social Proof -->
      <p style="margin:16px 0 8px; font-size:14px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Join <strong>500+ Pakistani brands</strong> who are already running smarter operations with {{brandName}}. With pricing starting at <strong>Rs. 7,999/month</strong> (Starter plan) and scaling to <strong>Rs. 15,000/month</strong> (Growth), <strong>Rs. 25,000/month</strong> (Professional), or <strong>Rs. 75,000+/month</strong> (Enterprise), there's a perfect fit for every stage. All plans include a 14-day free trial.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              &#128276; <strong>Limited time:</strong> Sign up this month and get priority onboarding with a dedicated account manager - usually reserved for Enterprise plans only.
            </p>
          </td>
        </tr>
      </table>
      ${ctaButton("Schedule Your Free 30-Min Consultation", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        No pressure at all - we're here whenever you're ready,<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">Built in Pakistan | 500+ Brands | 99.9% Uptime | {{brandEmail}}</span>
      </p>
    `, "See how brands grew 3x with {{brandName}}", "Real results: 3x growth in 3 months - schedule your free consultation"),
  },
  {
    type: "consultation_inquiry",
    name: "Consultation Inquiry Email",
    subject: "Let's Explore How {{brandName}} Can Help {{leadName}}",
    variables: ["leadName", "leadEmail", "companyName", "industry", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Hi <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Thank you for your interest in <strong>{{brandName}}</strong>! We are excited to learn more about <strong>{{companyName}}</strong> in the {{industry}} space and explore how we can help you achieve your business goals.
      </p>
      <!-- Questions -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="padding:16px 20px; background:#f9fafb;">
            <p style="margin:0 0 10px; font-size:14px; font-weight:700; color:${BRAND_DARK};">To prepare for your free consultation, please consider:</p>
            <ul style="margin:0; padding-left:18px; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.9;">
              <li>What type of business do you run?</li>
              <li>What are the biggest challenges you face daily?</li>
              <li>What outcomes are you expecting?</li>
              <li>What is your approximate monthly budget?</li>
            </ul>
          </td>
        </tr>
      </table>
      <!-- Plan Summary -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="padding:16px 20px; background:${BRAND_LIGHT}; border-left:4px solid ${BRAND_COLOR};">
            <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:${BRAND_DARK};">&#128176; Plans start at Rs. 7,999/month</p>
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">Starter, Growth, Professional, and Enterprise plans available. All include 14-day free trial and 24/7 support.</p>
          </td>
        </tr>
      </table>
      ${ctaButton("Schedule Free Consultation", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        We look forward to speaking with you,<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">{{brandEmail}} | {{brandPhone}}</span>
      </p>
    `, "{{brandName}} consultation inquiry", "Let's explore how we can help your business grow"),
  },
  {
    type: "setup_fee_request",
    name: "Setup Fee Request Email",
    subject: "Account Setup Fee - Your {{brandName}} Plan is Ready",
    variables: ["leadName", "leadEmail", "companyName", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Dear <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Following our consultation, we are delighted to proceed with setting up your account on <strong>{{brandName}}</strong>. To activate your account, please complete the one-time setup fee payment.
      </p>
      <!-- Payment Details -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="padding:20px 24px; background:#f9fafb;">
            <p style="margin:0 0 14px; font-size:14px; font-weight:700; color:${BRAND_DARK};">Payment Details:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:6px 0; font-size:13px; color:${TEXT_SECONDARY};"><strong>One-Time Setup Fee:</strong></td>
                <td style="padding:6px 0; font-size:14px; color:${BRAND_COLOR}; font-weight:700; text-align:right;">As discussed in consultation</td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-size:13px; color:${TEXT_SECONDARY};"><strong>Payment Methods:</strong></td>
                <td style="padding:6px 0; font-size:14px; color:${TEXT_PRIMARY}; text-align:right;">Bank Transfer, JazzCash, EasyPaisa</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; background:${BRAND_LIGHT}; border-radius:8px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              <strong style="color:${BRAND_DARK};">Next steps:</strong> Send payment receipt to <strong>{{brandEmail}}</strong> or WhatsApp at <strong>{{brandPhone}}</strong>. Your account will be activated within 24 hours.
            </p>
          </td>
        </tr>
      </table>
      ${ctaButton("Contact Us for Payment Details", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        Thank you for choosing {{brandName}},<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">{{brandEmail}} | {{brandPhone}}</span>
      </p>
    `, "{{brandName}} setup fee request", "Complete your setup fee to activate your account"),
  },
  {
    type: "payment_confirmation",
    name: "Payment Confirmation & Welcome Email",
    subject: "Payment Received - Welcome to {{brandName}}, {{leadName}}!",
    variables: ["leadName", "leadEmail", "companyName", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Great news, <strong>{{leadName}}</strong>!
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        We have successfully received your payment. Welcome to <strong>{{brandName}}</strong>! Your account is now active and you can start exploring all the features included in your plan.
      </p>
      <!-- Getting Started -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="padding:20px 24px; background:#f9fafb;">
            <p style="margin:0 0 14px; font-size:14px; font-weight:700; color:${BRAND_DARK};">Getting Started Checklist:</p>
            <ol style="margin:0; padding-left:18px; font-size:13px; color:${TEXT_SECONDARY}; line-height:2;">
              <li>Log in to your account using the credentials we will send separately</li>
              <li>Complete your profile and company information</li>
              <li>Explore your dashboard and available modules</li>
              <li>Set up your team members and assign roles</li>
              <li>Schedule your onboarding call with our team</li>
            </ol>
          </td>
        </tr>
      </table>
      <!-- Receipt -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; background:${BRAND_LIGHT}; border-radius:8px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              <strong style="color:${BRAND_DARK};">Receipt:</strong> A detailed payment receipt will be sent to <strong>{{leadEmail}}</strong>. Please keep it for your records.
            </p>
          </td>
        </tr>
      </table>
      ${ctaButton("Access Your Account", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        Welcome aboard,<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">Need help? {{brandEmail}} | {{brandPhone}}</span>
      </p>
    `, "Welcome to {{brandName}}!", "Payment received - your account is now active"),
  },
  {
    type: "proposal_delivery",
    name: "Proposal Delivery Email",
    subject: "Your Custom {{brandName}} Proposal for {{companyName}} is Ready",
    variables: ["leadName", "leadEmail", "companyName", "consultationType", "brandName", "brandEmail", "brandPhone", "brandWebsite"],
    buildHtml: () => brandedEmailWrapper(`
      <p style="margin:0 0 20px; font-size:16px; color:${TEXT_PRIMARY}; line-height:1.6;">
        Hi <strong>{{leadName}}</strong>,
      </p>
      <p style="margin:0 0 16px; font-size:15px; color:${TEXT_SECONDARY}; line-height:1.7;">
        Great news! The <strong>{{brandName}}</strong> team has crafted a custom proposal specifically for <strong>{{companyName}}</strong>. Our proposal is tailored to your unique needs and covers modules, pricing, implementation timeline, and expected ROI.
      </p>
      <!-- Proposal Highlights -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
        <tr>
          <td style="padding:20px 24px; background:#f9fafb;">
            <p style="margin:0 0 14px; font-size:14px; font-weight:700; color:${BRAND_DARK};">What's inside your proposal:</p>
            <ul style="margin:0; padding-left:18px; font-size:13px; color:${TEXT_SECONDARY}; line-height:2;">
              <li><strong>Recommended modules</strong> based on your business needs</li>
              <li><strong>Transparent pricing</strong> - Starter to Enterprise plans</li>
              <li><strong>Implementation timeline</strong> - 60-second setup, 1-2 week onboarding</li>
              <li><strong>Expected ROI projections</strong> based on your industry</li>
              <li><strong>Dedicated support plan</strong> with 24/7 assistance</li>
            </ul>
          </td>
        </tr>
      </table>
      <!-- Quick Start -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0; background:${BRAND_LIGHT}; border-radius:8px; border-left:4px solid ${BRAND_COLOR};">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0; font-size:13px; color:${TEXT_SECONDARY}; line-height:1.6;">
              <strong style="color:${BRAND_DARK};">Quick Start:</strong> Setup takes just <strong>60 seconds</strong>. Join <strong>500+ brands</strong> already growing with {{brandName}}.
            </p>
          </td>
        </tr>
      </table>
      ${ctaButton("Review Your Proposal", "{{brandWebsite}}")}
      <p style="margin:24px 0 0; font-size:13px; color:${TEXT_MUTED}; line-height:1.6;">
        We look forward to partnering with you,<br/>
        <strong style="color:${TEXT_PRIMARY};">The {{brandName}} Team</strong><br/>
        <span style="font-size:11px; color:${TEXT_MUTED};">{{brandEmail}} | {{brandPhone}} | <a href="{{brandWebsite}}" style="color:${BRAND_COLOR}; text-decoration:none;">{{brandWebsite}}</a></span>
      </p>
    `, "Your custom proposal is ready", "Review your tailored {{brandName}} proposal"),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  Automation Definitions
// ═══════════════════════════════════════════════════════════════════════════

const SEED_AUTOMATIONS = [
  {
    name: "Welcome Email",
    description: "Sends a welcome email immediately when a new lead is created",
    trigger: "lead_created",
    templateType: "lead_welcome",
    delayMinutes: 0,
    enabled: true,
  },
  {
    name: "Follow-Up Reminder",
    description: "Sends a follow-up email 1 day after a lead is created",
    trigger: "lead_created",
    templateType: "lead_follow_up",
    delayMinutes: 1440,
    enabled: true,
  },
  {
    name: "Consultation Reminder",
    description: "Sends a consultation reminder when a consultation is scheduled",
    trigger: "consultation_scheduled",
    templateType: "consultation_reminder",
    delayMinutes: 0,
    enabled: true,
  },
  {
    name: "Proposal Notification",
    description: "Notifies the lead when a proposal has been sent",
    trigger: "proposal_sent",
    templateType: "proposal_sent",
    delayMinutes: 0,
    enabled: true,
  },
  {
    name: "Nurture Sequence",
    description: "Sends a long-term nurture email 3 days after lead creation",
    trigger: "lead_created",
    templateType: "lead_nurture",
    delayMinutes: 4320,
    enabled: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/admin/seed-data
// ═══════════════════════════════════════════════════════════════════════════

export const POST = withAuth(async (req: NextRequest) => {
  try {
    await ensureDb();
    await createAllTables();

    const body = await req.json();
    const { seedTemplates = false, seedAutomations = false } = body;

    if (!seedTemplates && !seedAutomations) {
      return NextResponse.json({ error: "Specify seedTemplates and/or seedAutomations" }, { status: 400 });
    }

    const results: { templatesCreated: number; automationsCreated: number; templatesSkipped: number; automationsSkipped: number } = {
      templatesCreated: 0,
      automationsCreated: 0,
      templatesSkipped: 0,
      automationsSkipped: 0,
    };

    // ── Seed Templates ──
    if (seedTemplates) {
      for (const tmplDef of SEED_TEMPLATES) {
        // Check if template type already exists
        const existing = await withRetry(async () => {
          return await db.emailTemplate.findUnique({ where: { type: tmplDef.type } })
        }, 2, 500);
        if (existing) {
          results.templatesSkipped++;
          logger.info(`[Seed Data] Template "${tmplDef.type}" already exists, skipping`);
          continue;
        }

        await withRetry(async () => {
          return await db.emailTemplate.create({
          data: {
            type: tmplDef.type,
            name: tmplDef.name,
            subject: tmplDef.subject,
            htmlContent: tmplDef.buildHtml(),
            textContent: "",
            variables: JSON.stringify(tmplDef.variables),
            isActive: true,
          },
        })
        }, 2, 500);
        results.templatesCreated++;
        logger.info(`[Seed Data] Created template: ${tmplDef.type}`);
      }
    }

    // ── Seed Automations ──
    if (seedAutomations) {
      for (const autoDef of SEED_AUTOMATIONS) {
        // Check if automation with this name already exists
        const existing = await withRetry(async () => {
          return await db.automation.findFirst({ where: { name: autoDef.name } })
        }, 2, 500);
        if (existing) {
          results.automationsSkipped++;
          logger.info(`[Seed Data] Automation "${autoDef.name}" already exists, skipping`);
          continue;
        }

        // Look up the template by type
        const template = await withRetry(async () => {
          return await db.emailTemplate.findUnique({ where: { type: autoDef.templateType } })
        }, 2, 500);
        if (!template) {
          logger.warn(`[Seed Data] Template "${autoDef.templateType}" not found - cannot create automation "${autoDef.name}". Run seedTemplates first.`);
          continue;
        }

        await withRetry(async () => {
          return await db.automation.create({
          data: {
            name: autoDef.name,
            description: autoDef.description,
            trigger: autoDef.trigger,
            triggerConfig: "{}",
            templateId: template.id,
            action: "send_email",
            actionConfig: "{}",
            delayMinutes: autoDef.delayMinutes,
            enabled: autoDef.enabled,
          },
        })
        }, 2, 500);
        results.automationsCreated++;
        logger.info(`[Seed Data] Created automation: ${autoDef.name} (→ template: ${autoDef.templateType})`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Seed completed successfully",
      ...results,
    });
  } catch (error: any) {
    logger.error("[Seed Data] POST error", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to seed data", details: error?.message }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
