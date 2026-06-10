/**
 * Professional email templates and WhatsApp utilities for Valtriox.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  WHATSAPP INVITATION LINK
// ═══════════════════════════════════════════════════════════════════════════

export function generateWhatsAppInviteLink(inviteePhone: string, data: {
  inviterName: string;
  inviteeName: string;
  role: string;
  department?: string;
  token: string;
  joinUrl: string;
  platformName: string;
}): string {
  const roleLabel = data.role.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  const deptText = data.department ? ` in the ${data.department} department` : '';

  const message = encodeURIComponent(
    `Assalam o Alaikum ${data.inviteeName},\n\n` +
    `On behalf of ${data.platformName}, I would like to formally invite you to join our platform team as ${roleLabel}${deptText}.\n\n` +
    `Your invitation token is: ${data.token}\n\n` +
    `To accept the invitation, please visit:\n${data.joinUrl}\n\n` +
    `Please note that this invitation is valid for 7 days. Should you require any assistance, feel free to reach out.\n\n` +
    `Best regards,\n${data.inviterName}\n${data.platformName}`
  );

  const cleanPhone = inviteePhone.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${message}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PLAIN TEXT INVITATION (for manual sharing via WhatsApp, SMS, etc.)
// ═══════════════════════════════════════════════════════════════════════════

export function generateInvitationPlainText(data: {
  inviteeName: string;
  role: string;
  department?: string;
  token: string;
  joinUrl: string;
  expiresAt: string;
  inviterName: string;
  platformName: string;
  supportEmail: string;
}): string {
  const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const deptText = data.department ? ` in the ${data.department} department` : '';

  return [
    `Dear ${data.inviteeName},`,
    ``,
    `On behalf of ${data.platformName}, I am pleased to extend a formal invitation for you to join our platform team${deptText}. We believe your skills and experience will be a tremendous asset to our organization.`,
    ``,
    `Your Invitation Details:`,
    `  Position: ${data.role}`,
    `${data.department ? `  Department: ${data.department}` : ''}`,
    `  Invitation Token: ${data.token}`,
    `  Valid Until: ${expiryDate}`,
    ``,
    `To accept your invitation, please visit:`,
    `${data.joinUrl}`,
    ``,
    `Steps to join:`,
    `  1. Click the link above or copy it to your browser`,
    `  2. Enter your email address`,
    `  3. Enter your invitation token: ${data.token}`,
    `  4. Create your account password`,
    `  5. You're in!`,
    ``,
    `This invitation expires on ${expiryDate}. If you have any questions, feel free to reach out to ${data.supportEmail}.`,
    ``,
    `Warm regards,`,
    `${data.inviterName}`,
    `${data.platformName} Team`,
    `https://valtriox.pk`,
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
//  EMAIL INVITATION TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════

export interface InvitationTemplateData {
  inviteeName: string;
  inviteeEmail: string;
  role: string;
  department?: string;
  token: string;
  joinUrl: string;
  expiresAt: string;
  inviterName: string;
  platformName: string;
  platformWebsite: string;
  supportEmail: string;
}

export function getValtrioxInvitationHtml(data: InvitationTemplateData): string {
  const roleLabel = data.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Inner card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header with amber accent -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">
                      ${data.platformName}
                    </div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">
                      Team Invitation
                    </div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);border-radius:10px;text-align:center;line-height:40px;font-size:18px;">
                      V
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">
                Dear ${data.inviteeName},
              </p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                You have been invited to join the <strong style="color:#C9A227;">${data.platformName}</strong> platform team. We believe your expertise and dedication will be a valuable addition to our organization.
              </p>
            </td>
          </tr>

          <!-- Invitation details card -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                <!-- Row: Role -->
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Position</td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;color:#ffffff;font-weight:600;">${roleLabel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Row: Department -->
                ${data.department ? `
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Department</td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;color:#ffffff;font-weight:600;">${data.department}</td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ''}
                <!-- Row: Token -->
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Invitation Token</td>
                      </tr>
                      <tr>
                        <td style="font-size:20px;color:#C9A227;font-weight:700;letter-spacing:4px;font-family:monospace;">${data.token}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Row: Expires -->
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Valid Until</td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;color:#ffffff;font-weight:600;">${expiryDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:28px 32px 0;" align="center">
              <a href="${data.joinUrl}" target="_blank" style="
                display:inline-block;
                background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);
                color:#0a0a0f;
                text-decoration:none;
                font-size:15px;
                font-weight:700;
                padding:14px 40px;
                border-radius:10px;
                letter-spacing:0.3px;
              ">
                Accept Invitation
              </a>
            </td>
          </tr>

          <!-- Alternative instruction -->
          <tr>
            <td style="padding:16px 32px 0;text-align:center;">
              <p style="margin:0;font-size:13px;color:#6b6b7b;line-height:1.5;">
                If the button above does not work, copy and paste this URL into your browser:<br>
                <a href="${data.joinUrl}" style="color:#C9A227;word-break:break-all;font-size:12px;">${data.joinUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Next Steps -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:12px;">To accept your invitation:</p>
              <ol style="margin:0;padding-left:20px;color:#9ca3af;font-size:14px;line-height:1.8;">
                <li>Visit the acceptance link above</li>
                <li>Verify your email address</li>
                <li>Create your account credentials</li>
                <li>Enter your invitation token: <strong style="color:#C9A227;font-family:monospace;">${data.token}</strong></li>
              </ol>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.12);border-radius:8px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  <strong style="color:#C9A227;">Please note:</strong> This invitation will expire on ${expiryDate}. If you have any questions or require assistance, do not hesitate to contact us at <a href="mailto:${data.supportEmail}" style="color:#C9A227;">${data.supportEmail}</a>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                Warm regards,<br>
                <strong style="color:#C9A227;">${data.inviterName}</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">${data.platformName} Team</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:#4b4b5b;line-height:1.5;">
                    &copy; ${new Date().getFullYear()} ${data.platformName}. All rights reserved.<br>
                    <a href="${data.platformWebsite}" style="color:#C9A227;text-decoration:none;">${data.platformWebsite}</a>
                  </td>
                  <td align="right" style="font-size:11px;color:#4b4b5b;">
                    Confidential
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Inner card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SHARED HELPERS FOR NEW TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

interface SocialLinks {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  whatsappNumber?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
}

function buildSocialIconsHtml(links: SocialLinks): string {
  const icons: string[] = [];

  const iconStyle = "display:inline-block;width:36px;height:36px;border-radius:8px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:36px;margin:0 4px;text-decoration:none;";
  const imgStyle = "width:16px;height:16px;vertical-align:middle;filter:brightness(0) invert(1) opacity(0.7);";
  const iconBase = "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@latest/icons/";

  if (links.instagramUrl) {
    icons.push(`<a href="${links.instagramUrl}" target="_blank" rel="noopener noreferrer" style="${iconStyle}" title="Instagram"><img src="${iconBase}instagram.svg" alt="Instagram" style="${imgStyle}" /></a>`);
  }
  if (links.facebookUrl) {
    icons.push(`<a href="${links.facebookUrl}" target="_blank" rel="noopener noreferrer" style="${iconStyle}" title="Facebook"><img src="${iconBase}facebook.svg" alt="Facebook" style="${imgStyle}" /></a>`);
  }
  if (links.twitterUrl) {
    icons.push(`<a href="${links.twitterUrl}" target="_blank" rel="noopener noreferrer" style="${iconStyle}" title="X (Twitter)"><img src="${iconBase}x.svg" alt="X" style="${imgStyle}" /></a>`);
  }
  if (links.linkedinUrl) {
    icons.push(`<a href="${links.linkedinUrl}" target="_blank" rel="noopener noreferrer" style="${iconStyle}" title="LinkedIn"><img src="${iconBase}linkedin.svg" alt="LinkedIn" style="${imgStyle}" /></a>`);
  }
  if (links.whatsappNumber) {
    const clean = links.whatsappNumber.replace(/[^0-9]/g, '');
    icons.push(`<a href="https://wa.me/${clean}" target="_blank" rel="noopener noreferrer" style="${iconStyle}" title="WhatsApp"><img src="${iconBase}whatsapp.svg" alt="WhatsApp" style="${imgStyle}" /></a>`);
  }
  if (links.youtubeUrl) {
    icons.push(`<a href="${links.youtubeUrl}" target="_blank" rel="noopener noreferrer" style="${iconStyle}" title="YouTube"><img src="${iconBase}youtube.svg" alt="YouTube" style="${imgStyle}" /></a>`);
  }
  if (links.tiktokUrl) {
    icons.push(`<a href="${links.tiktokUrl}" target="_blank" rel="noopener noreferrer" style="${iconStyle}" title="TikTok"><img src="${iconBase}tiktok.svg" alt="TikTok" style="${imgStyle}" /></a>`);
  }

  return icons.join("\n");
}

function buildProfessionalFooter(year: number, companyName: string, website: string, address?: string | null): string {
  const addressLine = address ? `<br>${address}` : '';
  return `
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:#4b4b5b;line-height:1.5;">
                    &copy; ${year} ${companyName}. All rights reserved.${addressLine}<br>
                    <a href="${website}" style="color:#C9A227;text-decoration:none;">${website}</a>
                  </td>
                  <td align="right" style="font-size:11px;color:#4b4b5b;">
                    <a href="#" style="color:#4b4b5b;text-decoration:none;">Unsubscribe</a> &nbsp;|&nbsp; <a href="#" style="color:#4b4b5b;text-decoration:none;">Preferences</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST-CONSULTATION FOLLOW-UP EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export interface PostConsultationEmailData {
  clientName: string;
  consultationDate: string;
  discussedTopics: string[];
  recommendedPlan: string;
  recommendedPlanPrice: string;
  setupFee?: string;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
  socialLinks: SocialLinks;
}

export function getPostConsultationEmailHtml(data: PostConsultationEmailData): string {
  const currentYear = new Date().getFullYear();
  const socialHtml = buildSocialIconsHtml(data.socialLinks);
  const footerHtml = buildProfessionalFooter(currentYear, data.platformName, data.platformWebsite, data.companyAddress);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consultation Follow-Up - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">${data.platformName}</div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">Post-Consultation Follow-Up</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);border-radius:10px;text-align:center;line-height:40px;font-size:18px;">&#9734;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Dear ${data.clientName},</p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                Thank you for taking the time to meet with us on <strong style="color:#C9A227;">${data.consultationDate}</strong>. We truly enjoyed learning about your business goals and exploring how we can help you achieve them. Below is a summary of our discussion and the recommended next steps.
              </p>
            </td>
          </tr>

          <!-- Topics Discussed -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Topics Discussed:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${data.discussedTopics.map((topic, i) => `
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;">
                          <div style="width:24px;height:24px;border-radius:6px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#C9A227;">${i + 1}</div>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">${topic}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- Recommended Next Steps -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Recommended Next Steps:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${[
                  { n: "1", t: "Review this summary and choose the plan that best fits your needs" },
                  { n: "2", t: "Complete account setup with our onboarding team" },
                  { n: "3", t: "Schedule a kick-off meeting to begin your project" },
                  { n: "4", t: "Start seeing results within the first two weeks" },
                ].map((step) => `
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;">
                          <div style="width:24px;height:24px;border-radius:6px;background:rgba(5,150,105,0.1);border:1px solid rgba(5,150,105,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#059669;">${step.n}</div>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">${step.t}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- Plan Recommendation -->
          <tr>
            <td style="padding:28px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 24px;">
                    <p style="margin:0;font-size:13px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Recommended Plan</p>
                    <p style="margin:0;font-size:18px;color:#ffffff;font-weight:700;margin-bottom:4px;">${data.recommendedPlan}</p>
                    <p style="margin:0;font-size:15px;color:#C9A227;font-weight:600;margin-bottom:12px;">${data.recommendedPlanPrice}</p>
                    ${data.setupFee ? `<p style="margin:0;font-size:13px;color:#9ca3af;">One-time account setup fee: <strong style="color:#ffffff;">${data.setupFee}</strong></p>` : ''}
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding-top:20px;">
                          <a href="${data.platformWebsite}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);color:#0a0a0f;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;">Choose Your Plan</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Social Icons -->
          ${socialHtml ? `
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Connect With Us</p>
              <div style="display:inline-block;">${socialHtml}</div>
            </td>
          </tr>` : ""}

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                We look forward to partnering with you,<br>
                <strong style="color:#C9A227;">${data.platformName} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">${data.companyEmail} | ${data.companyPhone || data.platformWebsite}</span>
              </p>
            </td>
          </tr>

          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ACCOUNT SETUP CONFIRMATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export interface AccountSetupEmailData {
  clientName: string;
  clientEmail: string;
  loginUrl: string;
  selectedPlan: string;
  planFeatures: string[];
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
  socialLinks: SocialLinks;
}

export function getAccountSetupEmailHtml(data: AccountSetupEmailData): string {
  const currentYear = new Date().getFullYear();
  const socialHtml = buildSocialIconsHtml(data.socialLinks);
  const footerHtml = buildProfessionalFooter(currentYear, data.platformName, data.platformWebsite, data.companyAddress);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${data.platformName} - Account Setup Complete</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">${data.platformName}</div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">Account Setup Confirmation</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(5,150,105,0.15);border:1px solid rgba(5,150,105,0.3);border-radius:10px;text-align:center;line-height:40px;font-size:20px;color:#059669;">&#10003;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Welcome to ${data.platformName}, ${data.clientName}!</p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                Your account has been successfully created. We are excited to have you on board and look forward to helping you achieve your business goals. Below are your account details and getting started information.
              </p>
            </td>
          </tr>

          <!-- Account Details -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Login URL</td></tr>
                      <tr><td style="font-size:14px;color:#C9A227;font-weight:600;"><a href="${data.loginUrl}" style="color:#C9A227;text-decoration:none;">${data.loginUrl}</a></td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Email</td></tr>
                      <tr><td style="font-size:14px;color:#ffffff;font-weight:600;">${data.clientEmail}</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Password</td></tr>
                      <tr><td style="font-size:14px;color:#ffffff;font-weight:600;">Set during your first login</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Plan Features -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Your Plan: ${data.selectedPlan}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 20px;">
                    <p style="margin:0;font-size:13px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:12px;">Plan Features</p>
                    ${data.planFeatures.map((feature) => `
                    <p style="margin:0 0 8px 0;font-size:14px;color:#e5e7eb;line-height:1.5;">&#10003; ${feature}</p>
                    `).join("")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Getting Started Checklist -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Getting Started Checklist:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${[
                  { n: "1", t: "Log in to your account using the link above" },
                  { n: "2", t: "Complete your profile and company information" },
                  { n: "3", t: "Explore your dashboard and available features" },
                  { n: "4", t: "Set up your team members and assign roles" },
                  { n: "5", t: "Schedule your onboarding call with our team" },
                ].map((step) => `
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;">
                          <div style="width:24px;height:24px;border-radius:50%;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:11px;font-weight:700;color:#C9A227;">${step.n}</div>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">${step.t}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 32px 0;" align="center">
              <a href="${data.loginUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);color:#0a0a0f;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;">Access Your Dashboard</a>
            </td>
          </tr>

          <!-- Social Icons -->
          ${socialHtml ? `
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Connect With Us</p>
              <div style="display:inline-block;">${socialHtml}</div>
            </td>
          </tr>` : ""}

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                Welcome aboard!<br>
                <strong style="color:#C9A227;">${data.platformName} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">Need help? Reply to this email or contact ${data.companyEmail}</span>
              </p>
            </td>
          </tr>

          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUBSCRIPTION ACTIVATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export interface SubscriptionActivationEmailData {
  clientName: string;
  planName: string;
  planPrice: string;
  billingCycle: string;
  planFeatures: string[];
  planLimits: string[];
  activationDate: string;
  nextBillingDate: string;
  paymentMethod: string;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
  socialLinks: SocialLinks;
  dashboardUrl: string;
}

export function getSubscriptionActivationEmailHtml(data: SubscriptionActivationEmailData): string {
  const currentYear = new Date().getFullYear();
  const socialHtml = buildSocialIconsHtml(data.socialLinks);
  const footerHtml = buildProfessionalFooter(currentYear, data.platformName, data.platformWebsite, data.companyAddress);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Activated - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">${data.platformName}</div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">Subscription Activated</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(5,150,105,0.15);border:1px solid rgba(5,150,105,0.3);border-radius:10px;text-align:center;line-height:40px;font-size:20px;color:#059669;">&#10003;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Great News, ${data.clientName}!</p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                Your <strong style="color:#C9A227;">${data.planName}</strong> subscription has been successfully activated. Your payment has been confirmed and you now have full access to all plan features. Here are your subscription details:
              </p>
            </td>
          </tr>

          <!-- Subscription Details -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Plan</td>
                  </tr><tr>
                    <td style="font-size:16px;color:#ffffff;font-weight:700;">${data.planName}</td>
                  </tr></table>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Price</td>
                  </tr><tr>
                    <td style="font-size:16px;color:#C9A227;font-weight:700;">${data.planPrice}</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Billing Cycle</td>
                  </tr><tr>
                    <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.billingCycle}</td>
                  </tr></table>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Payment</td>
                  </tr><tr>
                    <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.paymentMethod}</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Activation Date</td>
                  </tr><tr>
                    <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.activationDate}</td>
                  </tr></table>
                </td>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Next Billing</td>
                  </tr><tr>
                    <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.nextBillingDate}</td>
                  </tr></table>
                </td>
              </tr>
              </table>
            </td>
          </tr>

          <!-- Plan Features -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Your Plan Includes:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px;">
                    ${data.planFeatures.map((f) => `<p style="margin:0 0 8px 0;font-size:14px;color:#e5e7eb;">&#10003; ${f}</p>`).join("")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What's Next -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">What is Next:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${[
                  { n: "1", t: "Log in to your dashboard and explore all features" },
                  { n: "2", t: "Complete your profile and team setup" },
                  { n: "3", t: "Start your first project or campaign" },
                  { n: "4", t: "Track your results in real-time analytics" },
                ].map((step) => `
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;">
                          <div style="width:24px;height:24px;border-radius:6px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#C9A227;">${step.n}</div>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">${step.t}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 32px 0;" align="center">
              <a href="${data.dashboardUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);color:#0a0a0f;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;">Go to Dashboard</a>
            </td>
          </tr>

          <!-- Social Icons -->
          ${socialHtml ? `
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Follow Us</p>
              <div style="display:inline-block;">${socialHtml}</div>
            </td>
          </tr>` : ""}

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                Thank you for choosing ${data.platformName}!<br>
                <strong style="color:#C9A227;">${data.platformName} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">${data.companyEmail} | ${data.companyPhone || data.platformWebsite}</span>
              </p>
            </td>
          </tr>

          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROPOSAL DELIVERY EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export interface ProposalDeliveryEmailData {
  clientName: string;
  proposalType: string;
  proposalCost: string;
  currencySymbol: string;
  validUntil: string;
  proposalViewUrl: string;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
  socialLinks: SocialLinks;
}

export function getProposalDeliveryEmailHtml(data: ProposalDeliveryEmailData): string {
  const currentYear = new Date().getFullYear();
  const socialHtml = buildSocialIconsHtml(data.socialLinks);
  const footerHtml = buildProfessionalFooter(currentYear, data.platformName, data.platformWebsite, data.companyAddress);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Proposal is Ready - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">${data.platformName}</div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">Proposal Delivery</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);border-radius:10px;text-align:center;line-height:40px;font-size:18px;color:#C9A227;">&#128196;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Dear ${data.clientName},</p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                Thank you for your interest in working with ${data.platformName}. We have carefully prepared a comprehensive proposal for <strong style="color:#C9A227;">${data.proposalType}</strong> services tailored to your business needs. Please review the proposal details below and let us know if you have any questions.
              </p>
            </td>
          </tr>

          <!-- Proposal Summary -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Proposal Type</td>
                    </tr><tr>
                      <td style="font-size:16px;color:#ffffff;font-weight:700;">${data.proposalType}</td>
                    </tr></table>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Investment</td>
                    </tr><tr>
                      <td style="font-size:16px;color:#C9A227;font-weight:700;">${data.currencySymbol} ${data.proposalCost}</td>
                    </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Valid Until</td>
                  </tr><tr>
                    <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.validUntil}</td>
                  </tr></table>
                </td>
              </tr>
              </table>
            </td>
          </tr>

          <!-- Next Steps -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Next Steps:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${[
                  { n: "1", t: "Review the proposal and share with your team" },
                  { n: "2", t: "Contact us with any questions or for modifications" },
                  { n: "3", t: "Sign and return the acceptance to begin" },
                  { n: "4", t: "50% advance payment upon acceptance" },
                ].map((step) => `
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;">
                          <div style="width:24px;height:24px;border-radius:6px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#C9A227;">${step.n}</div>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">${step.t}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- Payment Info -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.12);border-radius:8px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  <strong style="color:#C9A227;">Payment:</strong> 50% advance upon acceptance, 25% at 50% completion, 25% upon final delivery. Payments can be made via bank transfer or online payment. Please contact us for payment details.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 32px 0;" align="center">
              <a href="${data.proposalViewUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);color:#0a0a0f;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;">View Proposal</a>
            </td>
          </tr>

          <!-- Social Icons -->
          ${socialHtml ? `
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Connect With Us</p>
              <div style="display:inline-block;">${socialHtml}</div>
            </td>
          </tr>` : ""}

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                We look forward to working with you,<br>
                <strong style="color:#C9A227;">${data.platformName} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">${data.companyEmail} | ${data.companyPhone || data.platformWebsite}</span>
              </p>
            </td>
          </tr>

          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PAYMENT CONFIRMATION & INVOICE EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export interface PaymentConfirmationEmailData {
  clientName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  currencySymbol: string;
  planName: string;
  billingPeriod: string;
  paymentDate: string;
  paymentMethod: string;
  invoiceDownloadUrl: string;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
  socialLinks: SocialLinks;
}

export function getPaymentConfirmationEmailHtml(data: PaymentConfirmationEmailData): string {
  const currentYear = new Date().getFullYear();
  const socialHtml = buildSocialIconsHtml(data.socialLinks);
  const footerHtml = buildProfessionalFooter(currentYear, data.platformName, data.platformWebsite, data.companyAddress);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmation - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">${data.platformName}</div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">Payment Confirmation</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(5,150,105,0.15);border:1px solid rgba(5,150,105,0.3);border-radius:10px;text-align:center;line-height:40px;font-size:20px;color:#059669;">&#10003;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Payment Received, ${data.clientName}!</p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                We have successfully received your payment. Thank you for your trust in ${data.platformName}. Below is your payment confirmation and invoice details for your records.
              </p>
            </td>
          </tr>

          <!-- Success Badge -->
          <tr>
            <td style="padding:24px 32px 0;" align="center">
              <div style="display:inline-block;background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.2);border-radius:12px;padding:20px 32px;">
                <p style="margin:0;font-size:28px;color:#059669;font-weight:700;">${data.currencySymbol}${data.invoiceAmount}</p>
                <p style="margin:4px 0 0 0;font-size:13px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;">Payment Confirmed</p>
              </div>
            </td>
          </tr>

          <!-- Invoice Details -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Invoice Details:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Invoice Number</td>
                    </tr><tr>
                      <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.invoiceNumber}</td>
                    </tr></table>
                  </td>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Amount</td>
                    </tr><tr>
                      <td style="font-size:14px;color:#C9A227;font-weight:700;">${data.currencySymbol} ${data.invoiceAmount}</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Plan</td>
                    </tr><tr>
                      <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.planName}</td>
                    </tr></table>
                  </td>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Payment Method</td>
                    </tr><tr>
                      <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.paymentMethod}</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Billing Period</td>
                    </tr><tr>
                      <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.billingPeriod}</td>
                    </tr></table>
                  </td>
                  <td style="padding:14px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Payment Date</td>
                    </tr><tr>
                      <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.paymentDate}</td>
                    </tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Download Invoice CTA -->
          <tr>
            <td style="padding:28px 32px 0;" align="center">
              <a href="${data.invoiceDownloadUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);color:#0a0a0f;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;">Download Invoice</a>
            </td>
          </tr>

          <!-- Support Note -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.12);border-radius:8px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  <strong style="color:#C9A227;">Need help?</strong> If you have any questions about this invoice or your subscription, please do not hesitate to contact us at <a href="mailto:${data.companyEmail}" style="color:#C9A227;">${data.companyEmail}</a> or call <strong style="color:#ffffff;">${data.companyPhone || "our support line"}</strong>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Social Icons -->
          ${socialHtml ? `
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Follow Us</p>
              <div style="display:inline-block;">${socialHtml}</div>
            </td>
          </tr>` : ""}

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                Thank you for your business!<br>
                <strong style="color:#C9A227;">${data.platformName} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">${data.companyEmail} | ${data.companyPhone || data.platformWebsite}</span>
              </p>
            </td>
          </tr>

          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
// ═══════════════════════════════════════════════════════════════════════════
//  LEAD CAPTURE EMAIL TEMPLATE (sent to the lead after form submission)
// ═══════════════════════════════════════════════════════════════════════════

export interface LeadCaptureEmailData {
  leadName: string;
  leadEmail: string;
  companyName: string;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
  whatsappNumber: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  discordUrl: string | null;
  redditUrl: string | null;
  downloadUrl: string; // URL to lead magnet PDF
}

export function getLeadCaptureEmailHtml(data: LeadCaptureEmailData): string {
  const currentYear = new Date().getFullYear();

  // Build social icons HTML
  const socialIcons: string[] = [];
  if (data.instagramUrl) {
    socialIcons.push(`<a href="${data.instagramUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:36px;height:36px;border-radius:8px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:36px;margin:0 4px;text-decoration:none;" title="Instagram">
      <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@latest/icons/instagram.svg" alt="Instagram" style="width:16px;height:16px;vertical-align:middle;filter:brightness(0) invert(1) opacity(0.7);" />
    </a>`);
  }
  if (data.linkedinUrl) {
    socialIcons.push(`<a href="${data.linkedinUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:36px;height:36px;border-radius:8px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:36px;margin:0 4px;text-decoration:none;" title="LinkedIn">
      <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@latest/icons/linkedin.svg" alt="LinkedIn" style="width:16px;height:16px;vertical-align:middle;filter:brightness(0) invert(1) opacity(0.7);" />
    </a>`);
  }
  if (data.discordUrl) {
    socialIcons.push(`<a href="${data.discordUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:36px;height:36px;border-radius:8px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:36px;margin:0 4px;text-decoration:none;" title="Discord">
      <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@latest/icons/discord.svg" alt="Discord" style="width:16px;height:16px;vertical-align:middle;filter:brightness(0) invert(1) opacity(0.7);" />
    </a>`);
  }
  if (data.redditUrl) {
    socialIcons.push(`<a href="${data.redditUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:36px;height:36px;border-radius:8px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:36px;margin:0 4px;text-decoration:none;" title="Reddit">
      <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@latest/icons/reddit.svg" alt="Reddit" style="width:16px;height:16px;vertical-align:middle;filter:brightness(0) invert(1) opacity(0.7);" />
    </a>`);
  }

  // Build contact details rows
  const contactRows: string[] = [];
  contactRows.push(`<tr>
    <td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Email</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#C9A227;font-weight:600;"><a href="mailto:${data.companyEmail}" style="color:#C9A227;text-decoration:none;">${data.companyEmail}</a></td>
        </tr>
      </table>
    </td>
  </tr>`);
  if (data.companyPhone) {
    contactRows.push(`<tr>
      <td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Phone</td>
          </tr>
          <tr>
            <td style="font-size:14px;color:#ffffff;font-weight:600;"><a href="tel:${data.companyPhone}" style="color:#ffffff;text-decoration:none;">${data.companyPhone}</a></td>
          </tr>
        </table>
      </td>
    </tr>`);
  }
  if (data.whatsappNumber) {
    const cleanWhatsApp = data.whatsappNumber.replace(/[^0-9]/g, '');
    contactRows.push(`<tr>
      <td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">WhatsApp</td>
          </tr>
          <tr>
            <td style="font-size:14px;color:#ffffff;font-weight:600;"><a href="https://wa.me/${cleanWhatsApp}" target="_blank" rel="noopener noreferrer" style="color:#ffffff;text-decoration:none;">${data.whatsappNumber}</a></td>
          </tr>
        </table>
      </td>
    </tr>`);
  }
  if (data.companyAddress) {
    contactRows.push(`<tr>
      <td style="padding:12px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Address</td>
          </tr>
          <tr>
            <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.companyAddress}</td>
          </tr>
        </table>
      </td>
    </tr>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Inner card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">
                      ${data.platformName}
                    </div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">
                      Thank You for Your Interest
                    </div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);border-radius:10px;text-align:center;line-height:40px;font-size:20px;">
                      &#10003;
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">
                Dear ${data.leadName},
              </p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                Thank you for your interest in <strong style="color:#C9A227;">${data.platformName}</strong>! We have successfully received your inquiry and our team is already reviewing it. We will reach out to you within <strong style="color:#ffffff;">24 hours</strong> with a personalized response.
              </p>
            </td>
          </tr>

          <!-- Your Free Guide Section -->
          <tr>
            <td style="padding:28px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 24px;">
                    <p style="margin:0;font-size:13px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">
                      &#128218; Your Free Guide
                    </p>
                    <p style="margin:0;font-size:15px;color:#ffffff;font-weight:600;margin-bottom:10px;">
                      Everything You Need to Know About ${data.platformName}
                    </p>
                    <p style="margin:0;font-size:14px;color:#9ca3af;line-height:1.6;margin-bottom:20px;">
                      We&apos;ve prepared a comprehensive guide about ${data.platformName} &mdash; what it does, how it helps brands like yours, and what to expect from our partnership. Download your copy below.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${data.downloadUrl}" target="_blank" style="
                            display:inline-block;
                            background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);
                            color:#0a0a0f;
                            text-decoration:none;
                            font-size:15px;
                            font-weight:700;
                            padding:14px 40px;
                            border-radius:10px;
                            letter-spacing:0.3px;
                          ">
                            &#11015; Download Free Guide
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What Happens Next -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">What Happens Next:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${[
                  { num: "1", text: "Our team reviews your inquiry within 24 hours" },
                  { num: "2", text: "We reach out to schedule a free consultation call" },
                  { num: "3", text: `During the call, we'll explain how ${data.platformName} can help your brand grow` },
                  { num: "4", text: "You'll get a personalized demo tailored to your needs" },
                ].map((step) => `
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;">
                          <div style="width:24px;height:24px;border-radius:6px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#C9A227;flex-shrink:0;">
                            ${step.num}
                          </div>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">
                          ${step.text}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- Contact Us -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Contact Us:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${contactRows.join("")}
              </table>
            </td>
          </tr>

          <!-- Social Icons -->
          ${socialIcons.length > 0 ? `
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Follow Us</p>
              <div style="display:inline-block;">
                ${socialIcons.join("\n                ")}
              </div>
            </td>
          </tr>` : ""}

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                Best regards,<br>
                <strong style="color:#C9A227;">${data.platformName} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">Helping brands grow, every day</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:#4b4b5b;line-height:1.5;">
                    &copy; ${currentYear} ${data.platformName}. All rights reserved.<br>
                    <a href="${data.platformWebsite}" style="color:#C9A227;text-decoration:none;">${data.platformWebsite}</a>
                  </td>
                  <td align="right" style="font-size:11px;color:#4b4b5b;">
                    <a href="#" style="color:#4b4b5b;text-decoration:none;">Unsubscribe</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Inner card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONSULTATION INQUIRY EMAIL (sent to new leads)
// ═══════════════════════════════════════════════════════════════════════════

export interface ConsultationInquiryEmailData {
  clientName: string;
  clientEmail: string;
  businessType?: string;
  currentChallenges?: string[];
  expectedOutcomes?: string[];
  consultationUrl: string;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
  socialLinks: SocialLinks;
}

export function getConsultationInquiryEmailHtml(data: ConsultationInquiryEmailData): string {
  const currentYear = new Date().getFullYear();
  const socialHtml = buildSocialIconsHtml(data.socialLinks);
  const footerHtml = buildProfessionalFooter(currentYear, data.platformName, data.platformWebsite, data.companyAddress);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Let's Grow Together - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">${data.platformName}</div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">Consultation Inquiry</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);border-radius:10px;text-align:center;line-height:40px;font-size:18px;">&#128172;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Hello ${data.clientName},</p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                Thank you for your interest in <strong style="color:#C9A227;">${data.platformName}</strong>! We are excited to learn more about your business and explore how we can help you achieve your goals. To prepare for a meaningful consultation, we would love to understand a few things about your needs.
              </p>
            </td>
          </tr>

          <!-- Questions Section -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Help Us Understand Your Needs:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${[
                  { n: "1", t: "What type of business do you run? (e.g., E-Commerce, Services, Manufacturing, Retail)" },
                  { n: "2", t: "What are the biggest challenges you face in your daily operations?" },
                  { n: "3", t: "What outcomes are you expecting from a platform like ours?" },
                  { n: "4", t: "What is your approximate monthly budget for business management tools?" },
                  { n: "5", t: "How many team members will need access to the platform?" },
                ].map((q) => `
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;">
                          <div style="width:24px;height:24px;border-radius:6px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#C9A227;">${q.n}</div>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">${q.t}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- Plan Comparison Summary -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Our Plans at a Glance:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 16px;background:rgba(201,162,39,0.06);border-bottom:1px solid rgba(201,162,39,0.12);font-size:11px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Plan</td>
                  <td style="padding:14px 16px;background:rgba(201,162,39,0.06);border-bottom:1px solid rgba(201,162,39,0.12);font-size:11px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Price</td>
                  <td style="padding:14px 16px;background:rgba(201,162,39,0.06);border-bottom:1px solid rgba(201,162,39,0.12);font-size:11px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Best For</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;color:#ffffff;font-weight:600;">Starter</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;color:#C9A227;font-weight:600;">Rs. 7,999/mo</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:#9ca3af;">Small teams (3 members)</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;color:#ffffff;font-weight:600;">Growth</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;color:#C9A227;font-weight:600;">Rs. 15,000/mo</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:#9ca3af;">Growing brands (8 members)</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;color:#ffffff;font-weight:600;">Professional</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;color:#C9A227;font-weight:600;">Rs. 25,000/mo</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:#9ca3af;">Established brands (15 members)</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-size:14px;color:#ffffff;font-weight:600;">Enterprise</td>
                  <td style="padding:12px 16px;font-size:14px;color:#C9A227;font-weight:600;">Custom</td>
                  <td style="padding:12px 16px;font-size:13px;color:#9ca3af;">Unlimited scale</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 32px 0;" align="center">
              <a href="${data.consultationUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);color:#0a0a0f;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;">Schedule Free Consultation</a>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.12);border-radius:8px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  <strong style="color:#C9A227;">Free consultation:</strong> Our consultation is completely free with no obligations. We will walk you through a live demo, discuss your specific needs, and recommend the best plan for your business.
                </p>
              </div>
            </td>
          </tr>

          <!-- Social Icons -->
          ${socialHtml ? `
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Connect With Us</p>
              <div style="display:inline-block;">${socialHtml}</div>
            </td>
          </tr>` : ""}

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                Looking forward to speaking with you,<br>
                <strong style="color:#C9A227;">${data.platformName} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">${data.companyEmail} | ${data.companyPhone || data.platformWebsite}</span>
              </p>
            </td>
          </tr>

          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SETUP FEE REQUEST EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export interface SetupFeeRequestEmailData {
  clientName: string;
  clientEmail: string;
  selectedPlan: string;
  planPrice: string;
  setupFee: string;
  setupFeeDetails?: string;
  bankName?: string;
  bankAccountTitle?: string;
  bankAccountNumber?: string;
  bankIban?: string;
  jazzcashNumber?: string;
  easypaisaNumber?: string;
  dueDate?: string;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
  socialLinks: SocialLinks;
}

export function getSetupFeeRequestEmailHtml(data: SetupFeeRequestEmailData): string {
  const currentYear = new Date().getFullYear();
  const socialHtml = buildSocialIconsHtml(data.socialLinks);
  const footerHtml = buildProfessionalFooter(currentYear, data.platformName, data.platformWebsite, data.companyAddress);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Setup Fee - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">${data.platformName}</div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">Account Setup Fee Request</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);border-radius:10px;text-align:center;line-height:40px;font-size:18px;">&#128179;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Dear ${data.clientName},</p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                Following our consultation, we are delighted to confirm your selection of the <strong style="color:#C9A227;">${data.selectedPlan}</strong> plan. To proceed with your account setup, we kindly request the one-time setup fee as outlined below.
              </p>
            </td>
          </tr>

          <!-- Selected Plan Details -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Your Selected Plan:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Selected Plan</td>
                    </tr><tr>
                      <td style="font-size:16px;color:#ffffff;font-weight:700;">${data.selectedPlan}</td>
                    </tr></table>
                  </td>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Monthly Price</td>
                    </tr><tr>
                      <td style="font-size:16px;color:#C9A227;font-weight:700;">${data.planPrice}</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">One-Time Setup Fee</td>
                    </tr><tr>
                      <td style="font-size:18px;color:#C9A227;font-weight:700;">${data.setupFee}</td>
                    </tr></table>
                  </td>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Due Date</td>
                    </tr><tr>
                      <td style="font-size:14px;color:#ffffff;font-weight:600;">${data.dueDate || "Within 7 business days"}</td>
                    </tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.setupFeeDetails ? `
          <!-- Setup Fee Details -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.12);border-radius:8px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  <strong style="color:#C9A227;">Setup fee covers:</strong> ${data.setupFeeDetails}
                </p>
              </div>
            </td>
          </tr>` : ""}

          <!-- Payment Methods -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Accepted Payment Methods:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">

                ${data.bankName ? `
                <tr>
                  <td style="padding:20px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <p style="margin:0 0 12px;font-size:13px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;">&#127974; Bank Transfer</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:4px 0;font-size:13px;color:#6b6b7b;">Bank Name:</td><td style="padding:4px 0;font-size:14px;color:#ffffff;font-weight:600;text-align:right;">${data.bankName}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#6b6b7b;">Account Title:</td><td style="padding:4px 0;font-size:14px;color:#ffffff;font-weight:600;text-align:right;">${data.bankAccountTitle}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#6b6b7b;">Account Number:</td><td style="padding:4px 0;font-size:14px;color:#C9A227;font-weight:600;text-align:right;font-family:monospace;">${data.bankAccountNumber}</td></tr>
                      ${data.bankIban ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b6b7b;">IBAN:</td><td style="padding:4px 0;font-size:14px;color:#C9A227;font-weight:600;text-align:right;font-family:monospace;">${data.bankIban}</td></tr>` : ''}
                    </table>
                  </td>
                </tr>` : ""}

                ${data.jazzcashNumber ? `
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td><p style="margin:0;font-size:13px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;">&#128241; JazzCash</p></td>
                        <td style="text-align:right;"><p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;font-family:monospace;">${data.jazzcashNumber}</p></td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ""}

                ${data.easypaisaNumber ? `
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td><p style="margin:0;font-size:13px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;">&#128241; EasyPaisa</p></td>
                        <td style="text-align:right;"><p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;font-family:monospace;">${data.easypaisaNumber}</p></td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ""}

              </table>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.12);border-radius:8px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  <strong style="color:#C9A227;">Important:</strong> Please send the payment receipt to <a href="mailto:${data.companyEmail}" style="color:#C9A227;">${data.companyEmail}</a> or share it via WhatsApp at <strong style="color:#ffffff;">${data.companyPhone || data.platformWebsite}</strong>. Your account will be activated within 24 hours of payment confirmation.
                </p>
              </div>
            </td>
          </tr>

          <!-- Social Icons -->
          ${socialHtml ? `
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Connect With Us</p>
              <div style="display:inline-block;">${socialHtml}</div>
            </td>
          </tr>` : ""}

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                Thank you for choosing ${data.platformName},<br>
                <strong style="color:#C9A227;">${data.platformName} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">${data.companyEmail} | ${data.companyPhone || data.platformWebsite}</span>
              </p>
            </td>
          </tr>

          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONSULTATION REMINDER EMAILS
// ═══════════════════════════════════════════════════════════════════════════

export interface ConsultationReminderEmailData {
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  company?: string | null;
  industry?: string | null;
  interest?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  timezone?: string | null;
  consultationType?: string | null;
  message?: string | null;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone?: string | null;
}

function _reminderHeader(title: string, pn: string, icon: string): string {
  return `
          <tr>
            <td style="background:linear-gradient(135deg,#1a1508 0%,#12121a 100%);padding:32px 32px 24px;border-bottom:1px solid rgba(201,162,39,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:24px;font-weight:700;color:#C9A227;letter-spacing:-0.5px;margin-bottom:4px;">${pn}</div>
                    <div style="font-size:12px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;">${title}</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;width:40px;height:40px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);border-radius:10px;text-align:center;line-height:40px;font-size:18px;">${icon}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function _reminderFooter(pn: string, ce: string, cp: string | null, pw: string): string {
  const y = new Date().getFullYear();
  return `
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                We look forward to connecting with you,<br>
                <strong style="color:#C9A227;">${pn} Team</strong><br>
                <span style="font-size:13px;color:#6b6b7b;">${ce}${cp ? ' | ' + cp : ''}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;color:#4b4b5b;line-height:1.5;">&copy; ${y} ${pn}. All rights reserved.<br><a href="${pw}" style="color:#C9A227;text-decoration:none;">${pw}</a></td>
                  <td align="right" style="font-size:11px;color:#4b4b5b;">Confidential</td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function _reminderDetailRows(d: ConsultationReminderEmailData): string {
  const r: string[] = [];
  if (d.scheduledDate) {
    const fmt = new Date(d.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    r.push(`<tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Date</td></tr><tr><td style="font-size:14px;color:#ffffff;font-weight:600;">${fmt}</td></tr></table></td></tr>`);
  }
  if (d.scheduledTime) {
    r.push(`<tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Time</td></tr><tr><td style="font-size:14px;color:#ffffff;font-weight:600;">${d.scheduledTime}</td></tr></table></td></tr>`);
  }
  if (d.consultationType) {
    const t = d.consultationType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    r.push(`<tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Type</td></tr><tr><td style="font-size:14px;color:#ffffff;font-weight:600;">${t}</td></tr></table></td></tr>`);
  }
  if (d.timezone) {
    r.push(`<tr><td style="padding:14px 20px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Timezone</td></tr><tr><td style="font-size:14px;color:#ffffff;font-weight:600;">${d.timezone}</td></tr></table></td></tr>`);
  }
  return r.join('\n');
}

export function generateConsultationReminderHtml(data: ConsultationReminderEmailData): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Consultation Reminder - ${data.platformName}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
${_reminderHeader('Consultation Reminder', data.platformName, '&#128197;')}
<tr><td style="padding:32px 32px 0;">
  <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Dear ${data.clientName},</p>
  <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">This is a friendly reminder that your upcoming consultation with <strong style="color:#C9A227;">${data.platformName}</strong> is coming up soon. We look forward to discussing ${data.interest || 'your business needs'}${data.company ? ` at ${data.company}` : ''}.</p>
</td></tr>
${data.scheduledDate ? `<tr><td style="padding:24px 32px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">${_reminderDetailRows(data)}</table></td></tr>` : ''}
<tr><td style="padding:20px 32px 0;"><div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.12);border-radius:8px;padding:14px 18px;">
  <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;"><strong style="color:#C9A227;">Tips:</strong> Please ensure you have a stable internet connection. If you need to reschedule, reply to this email or contact us at <a href="mailto:${data.companyEmail}" style="color:#C9A227;">${data.companyEmail}</a>.</p>
</div></td></tr>
${_reminderFooter(data.platformName, data.companyEmail, data.companyPhone ?? null, data.platformWebsite)}
</table></td></tr></table></body></html>`;
}

export function generateConsultationFollowUpHtml(data: ConsultationReminderEmailData): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Following Up - ${data.platformName}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
${_reminderHeader('Following Up', data.platformName, '&#128172;')}
<tr><td style="padding:32px 32px 0;">
  <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Hi ${data.clientName},</p>
  <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">We hope this message finds you well! We wanted to follow up${data.company ? ` on behalf of ${data.company}` : ''} to see if you had any questions or if there is anything we can help you with regarding ${data.interest || 'your business needs'}.</p>
</td></tr>
<tr><td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:12px;overflow:hidden;">
    <tr><td style="padding:20px 20px;">
      <p style="margin:0;font-size:13px;color:#C9A227;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:12px;">How Can We Help?</p>
      <p style="margin:0 0 8px 0;font-size:14px;color:#e5e7eb;line-height:1.5;"><strong style="color:#C9A227;">1.</strong> Schedule a free consultation to discuss your requirements</p>
      <p style="margin:0 0 8px 0;font-size:14px;color:#e5e7eb;line-height:1.5;"><strong style="color:#C9A227;">2.</strong> Get a personalized proposal tailored to your business</p>
      <p style="margin:0 0 0 0;font-size:14px;color:#e5e7eb;line-height:1.5;"><strong style="color:#C9A227;">3.</strong> Explore our plans and pricing options</p>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:28px 32px 0;" align="center">
  <a href="${data.platformWebsite}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);color:#0a0a0f;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;">Get Started</a>
</td></tr>
<tr><td style="padding:20px 32px 0;text-align:center;">
  <p style="margin:0;font-size:13px;color:#6b6b7b;line-height:1.5;">Or reply to this email to schedule a call directly.</p>
</td></tr>
${_reminderFooter(data.platformName, data.companyEmail, data.companyPhone ?? null, data.platformWebsite)}
</table></td></tr></table></body></html>`;
}

export function generateConsultationRescheduleHtml(data: ConsultationReminderEmailData): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Reschedule Your Consultation - ${data.platformName}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
${_reminderHeader('Reschedule Your Consultation', data.platformName, '&#128260;')}
<tr><td style="padding:32px 32px 0;">
  <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;margin-bottom:16px;">Dear ${data.clientName},</p>
  <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">We understand that schedules change. No worries at all! We would love to find a new time that works better for you for our consultation${data.company ? ` regarding ${data.company}` : ''}.</p>
</td></tr>
<tr><td style="padding:24px 32px 0;">
  <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">To reschedule, please:</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
    <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;"><div style="width:24px;height:24px;border-radius:6px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#C9A227;">1</div></td><td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">Reply to this email with your preferred date and time</td></tr></table></td></tr>
    <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;"><div style="width:24px;height:24px;border-radius:6px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#C9A227;">2</div></td><td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">Include your timezone for easy scheduling</td></tr></table></td></tr>
    <tr><td style="padding:14px 20px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;"><div style="width:24px;height:24px;border-radius:6px;background:rgba(201,162,39,0.1);border:1px solid rgba(201,162,39,0.2);text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#C9A227;">3</div></td><td style="padding-left:14px;font-size:14px;color:#e5e7eb;line-height:1.5;">Mention your preferred consultation method (video, phone, in-person)</td></tr></table></td></tr>
  </table>
</td></tr>
<tr><td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
    <tr><td style="padding:16px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Contact Us</td></tr>
        <tr><td style="font-size:14px;color:#ffffff;font-weight:600;"><a href="mailto:${data.companyEmail}" style="color:#C9A227;text-decoration:none;">${data.companyEmail}</a>${data.companyPhone ? ` &bull; ${data.companyPhone}` : ''}</td></tr>
        <tr><td style="font-size:14px;color:#C9A227;font-weight:600;"><a href="${data.platformWebsite}" style="color:#C9A227;text-decoration:none;">${data.platformWebsite}</a></td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
${_reminderFooter(data.platformName, data.companyEmail, data.companyPhone ?? null, data.platformWebsite)}
</table></td></tr></table></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BETA INVITE EMAIL TEMPLATE (Ultra-Premium)
// ═══════════════════════════════════════════════════════════════════════════

export interface BetaInviteEmailData {
  email: string;
  plan: string;
  trialDays: number;
  inviteUrl: string;
  platformName: string;
  platformWebsite: string;
  companyEmail: string;
  companyPhone: string | null;
  companyAddress: string | null;
}

export function getBetaInviteEmailHtml(data: BetaInviteEmailData): string {
  const currentYear = new Date().getFullYear();
  const planLabel = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
  const footerHtml = buildProfessionalFooter(currentYear, data.platformName, data.platformWebsite, data.companyAddress);

  const planFeatures: Record<string, string[]> = {
    enterprise: ['Unlimited Orders & Products', 'AI-Powered Analytics', 'Priority Support 24/7', 'Custom Branding & White-Label', 'Team Management (Unlimited)', 'WhatsApp Integration', 'Advanced SEO Tools', 'API Access'],
    professional: ['Up to 1,000 Orders/Month', 'Advanced Analytics Dashboard', 'Priority Email Support', 'Custom Branding', 'Team Management (Up to 15)', 'WhatsApp Integration', 'SEO Tools', 'Email Marketing'],
    growth: ['Up to 500 Orders/Month', 'Standard Analytics', 'Email Support', 'Basic Branding', 'Team Management (Up to 5)', 'Social Media Tools', 'Loyalty Program'],
    starter: ['Up to 100 Orders/Month', 'Basic Dashboard', 'Community Support', 'Standard Branding', 'Team Management (Up to 3)', 'Product Catalog'],
  };

  const features = planFeatures[data.plan] || planFeatures.enterprise;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exclusive Beta Access - ${data.platformName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Premium card with gold border -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#12121a;border:1px solid rgba(201,162,39,0.2);border-radius:20px;overflow:hidden;box-shadow:0 0 60px rgba(201,162,39,0.08);">

          <!-- Exclusive Header -->
          <tr>
            <td style="background:linear-gradient(135deg,rgba(201,162,39,0.15) 0%,#12121a 60%);padding:40px 36px 28px;border-bottom:1px solid rgba(201,162,39,0.2);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;color:#C9A227;text-transform:uppercase;letter-spacing:3px;font-weight:700;margin-bottom:8px;">Exclusive Beta Access</div>
                    <div style="font-size:28px;font-weight:800;color:#C9A227;letter-spacing:-0.5px;margin-bottom:6px;">
                      ${data.platformName}
                    </div>
                    <div style="font-size:13px;color:#8b8b9b;text-transform:uppercase;letter-spacing:2px;">
                      Premium Brand Management Portal
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);border-radius:14px;text-align:center;line-height:48px;font-size:22px;font-weight:800;color:#0a0a0f;">
                      V
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- VIP Badge -->
          <tr>
            <td style="padding:24px 36px 0;" align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(201,162,39,0.1) 0%,rgba(201,162,39,0.03) 100%);border:1px solid rgba(201,162,39,0.15);border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;text-align:center;">
                    <div style="font-size:16px;color:#C9A227;font-weight:700;margin-bottom:4px;">&#9733; VIP Beta Invitation &#9733;</div>
                    <div style="font-size:13px;color:#8b8b9b;">You've been selected for early access to our premium platform</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:17px;color:#ffffff;font-weight:600;margin-bottom:16px;">
                Dear Brand Owner,
              </p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.7;">
                Congratulations! You've been exclusively selected for <strong style="color:#C9A227;">beta access</strong> to <strong style="color:#ffffff;">${data.platformName}</strong> - Pakistan's premier brand management portal. This is a limited-time opportunity to experience our full-featured platform before public launch, completely free.
              </p>
            </td>
          </tr>

          <!-- Plan Details Card -->
          <tr>
            <td style="padding:24px 36px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(201,162,39,0.12);border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid rgba(201,162,39,0.08);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Your Plan</div>
                          <div style="font-size:22px;color:#C9A227;font-weight:800;">${planLabel}</div>
                        </td>
                        <td align="right">
                          <div style="font-size:11px;color:#6b6b7b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Trial Period</div>
                          <div style="font-size:22px;color:#ffffff;font-weight:800;">${data.trialDays} Days</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <div style="font-size:11px;color:#C9A227;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:14px;">What You Get</div>
                    ${features.map(f => `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="width:20px;vertical-align:top;">
                          <div style="width:18px;height:18px;border-radius:50%;background:rgba(201,162,39,0.15);border:1px solid rgba(201,162,39,0.3);text-align:center;line-height:18px;font-size:10px;color:#C9A227;">&#10003;</div>
                        </td>
                        <td style="padding-left:10px;font-size:14px;color:#e5e7eb;line-height:1.4;">${f}</td>
                      </tr>
                    </table>`).join("")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:32px 36px 0;" align="center">
              <a href="${data.inviteUrl}" target="_blank" style="
                display:inline-block;
                background:linear-gradient(135deg,#C9A227 0%,#a88620 100%);
                color:#0a0a0f;
                text-decoration:none;
                font-size:16px;
                font-weight:800;
                padding:16px 52px;
                border-radius:12px;
                letter-spacing:0.5px;
                text-transform:uppercase;
              ">
                Claim Your Beta Access
              </a>
            </td>
          </tr>

          <!-- Alternative URL -->
          <tr>
            <td style="padding:12px 36px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6b7b;line-height:1.5;">
                Or copy this link: <a href="${data.inviteUrl}" style="color:#C9A227;word-break:break-all;">${data.inviteUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Why Beta -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:14px;color:#9ca3af;font-weight:600;margin-bottom:14px;">Why Join Our Beta?</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
                ${[
                  { icon: '&#9733;', t: 'Free premium access during the entire beta period' },
                  { icon: '&#9889;', t: 'Shape the product with your feedback - your voice matters' },
                  { icon: '&#9829;', t: 'Lock in exclusive early-adopter pricing for life' },
                  { icon: '&#9742;', t: 'Direct access to our founding team for support' },
                ].map(item => `
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;width:24px;">
                          <div style="font-size:16px;color:#C9A227;text-align:center;line-height:1.3;">${item.icon}</div>
                        </td>
                        <td style="padding-left:12px;font-size:14px;color:#e5e7eb;line-height:1.5;">${item.t}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:20px 36px 0;">
              <div style="background:rgba(201,162,39,0.06);border:1px solid rgba(201,162,39,0.1);border-radius:10px;padding:14px 18px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                  <strong style="color:#C9A227;">Limited spots available.</strong> Beta access is by invitation only and may close without notice. Your ${data.trialDays}-day trial begins when you activate your account.
                </p>
              </div>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 36px 8px;">
              <p style="margin:0;font-size:15px;color:#ffffff;">
                We're building something extraordinary,<br>
                <strong style="color:#C9A227;">and we want you to be part of it.</strong><br><br>
                <span style="font-size:13px;color:#6b6b7b;">${data.platformName} Team</span><br>
                <span style="font-size:12px;color:#4b4b5b;">${data.companyEmail}${data.companyPhone ? ' | ' + data.companyPhone : ''}</span>
              </p>
            </td>
          </tr>

          ${footerHtml}

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BETA INVITE WHATSAPP MESSAGE (Ultra-Premium Formatted)
// ═══════════════════════════════════════════════════════════════════════════

export function generateBetaInviteWhatsAppMessage(data: {
  email: string;
  plan: string;
  trialDays: number;
  inviteUrl: string;
  platformName: string;
}): string {
  const planLabel = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✨ *${data.platformName}* ✨`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🌟 *EXCLUSIVE BETA ACCESS* 🌟`,
    ``,
    `Congratulations! You've been selected for VIP beta access to ${data.platformName} - Pakistan's premium brand management portal.`,
    ``,
    `📦 *Your Plan:* ${planLabel}`,
    `⏰ *Trial:* ${data.trialDays} Days (FREE)`,
    ``,
    `🎁 *What You Get:*`,
    `• Full access to all premium features`,
    `• AI-Powered analytics & insights`,
    `• Team management & collaboration`,
    `• WhatsApp integration`,
    `• Custom branding tools`,
    `• Priority support`,
    ``,
    `🔑 *Claim Your Access Now:*`,
    `${data.inviteUrl}`,
    ``,
    `⚠️ Limited spots - this invitation may expire soon!`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_Built with ❤️ by ${data.platformName}_`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

export function generateBetaInviteWhatsAppLink(phone: string, data: {
  email: string;
  plan: string;
  trialDays: number;
  inviteUrl: string;
  platformName: string;
}): string {
  const message = generateBetaInviteWhatsAppMessage(data);
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
