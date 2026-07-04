// ============================================================================
// Report Export Utility - Client-branded exports with Valtriox credit
// Enterprise plan reports have NO Valtriox branding
// ============================================================================

export interface ReportExportOptions {
  clientName: string;
  clientLogo?: string;
  reportTitle: string;
  dateRange: string;
  plan: string; // starter | professional | enterprise
  platformName?: string;
}

/**
 * Generate HTML header and footer for report exports
 * - Starter/Professional plans: Client branding + small Valtriox credit at bottom
 * - Enterprise plans: Full client branding, NO Valtriox credit
 *
 * Phase 14: Updated to Valtriox Brand 2026 palette:
 *   Charcoal #161B26 / Modern Gold #D4A73A / White #FAFAFA
 */
export function generateReportBranding(options: ReportExportOptions) {
  const isEnterprise = options.plan === "enterprise";
  const showBrandflow = !isEnterprise;
  const brandName = options.platformName || "Valtriox";

  const header = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:24px 32px;border-bottom:2px solid #D4A73A;background:#FAFAFA;">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:#161B26;margin:0;">${options.clientName}</h1>
        <p style="font-size:13px;color:#64748B;margin:4px 0 0 0;">${options.reportTitle}</p>
        <p style="font-size:11px;color:#94A3B8;margin:2px 0 0 0;">${options.dateRange}</p>
      </div>
      ${options.clientLogo ? `<img src="${options.clientLogo}" style="height:48px;width:auto;border-radius:8px;" alt="${options.clientName}" />` : `<div style="width:48px;height:48px;background:linear-gradient(135deg,#D4A73A,#161B26);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#FAFAFA;font-weight:700;font-size:18px;">${options.clientName.charAt(0).toUpperCase()}</div>`}
    </div>
  `;

  const footer = showBrandflow
    ? `
    <div style="padding:16px 32px;text-align:center;border-top:1px solid #E8DCC8;background:#FAFAFA;">
      <p style="font-size:10px;color:#94A3B8;margin:0;">
        Powered by <strong style="color:#D4A73A;">${brandName}</strong> - COMMAND YOUR BRAND UNIVERSE
      </p>
    </div>
  `
    : `
    <div style="padding:16px 32px;text-align:center;border-top:1px solid #E8DCC8;background:#FAFAFA;">
      <p style="font-size:10px;color:#E5E7EB;margin:0;"> </p>
    </div>
  `;

  return { header, footer, showBrandflow };
}

/**
 * Generate a full HTML page for print/export with branding
 *
 * Phase 14: Updated color scheme to Valtriox Brand 2026
 *   Charcoal #161B26 / Modern Gold #D4A73A / White #FAFAFA
 */
export function generatePrintableReport(
  contentHtml: string,
  options: ReportExportOptions
): string {
  const { header, footer } = generateReportBranding(options);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${options.reportTitle} - ${options.clientName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #161B26; line-height: 1.6; background: #FAFAFA; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #E8DCC8; }
        th { background: #161B26; color: #FAFAFA; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        td { font-size: 13px; color: #334155; }
        tr:hover td { background: #FDF8E8; }
        .section-title { font-size: 16px; font-weight: 700; color: #161B26; margin: 24px 0 12px 32px; }
        .content { padding: 24px 32px; }
        .stat-card { display: inline-block; padding: 16px 24px; margin: 8px; background: #FAFAFA; border: 1px solid #E8DCC8; border-left: 3px solid #D4A73A; border-radius: 8px; }
        .stat-value { font-size: 24px; font-weight: 700; color: #161B26; }
        .stat-label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      ${header}
      <div class="content">
        ${contentHtml}
      </div>
      ${footer}
    </body>
    </html>
  `;
}

/**
 * Open a print dialog with branded report content
 */
export function printReport(contentHtml: string, options: ReportExportOptions) {
  const html = generatePrintableReport(contentHtml, options);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
