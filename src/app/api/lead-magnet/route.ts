import { NextResponse } from "next/server";
import { db, ensurePlatformSettingsColumns, withRetry} from "@/lib/db";
import { generateLeadMagnetPDF } from "@/lib/lead-magnet-generator";

// Simple in-memory cache: generated PDFs are valid for 10 minutes
let cachedPdf: { buffer: Buffer; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * GET /api/lead-magnet - Generates and serves the lead magnet PDF dynamically.
 * Uses PlatformSettings from DB for logo, contact info, social links.
 * NO AUTH required - public endpoint for lead downloads.
 * 
 * Cache: PDF is cached in memory for 10 minutes to avoid regenerating on every request.
 */
export async function GET() {
  try {
    // Check cache first
    if (cachedPdf && Date.now() - cachedPdf.timestamp < CACHE_TTL) {
      return new NextResponse(cachedPdf.buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="valtriox-introduction.pdf"`,
          "Cache-Control": "public, max-age=600",
        },
      });
    }

    // Ensure DB columns exist
    await ensurePlatformSettingsColumns();

    // Fetch settings from DB
    const settings = await withRetry(async () => {
      return await db.platformSettings.findFirst({
      orderBy: { createdAt: "desc" },
    })
    }, 2, 500);

    const companyName = settings?.companyName || "Valtriox";

    // Generate PDF with current settings
    const pdfBuffer = await generateLeadMagnetPDF({
      companyName,
      tagline: settings?.tagline || "Command Your Brand Universe",
      logoUrl: settings?.logoUrl || null,
      companyEmail: settings?.companyEmail || "ashir@valtriox.com",
      companyPhone: settings?.companyPhone || null,
      companyWebsite: settings?.companyWebsite || null,
      companyAddress: settings?.companyAddress || null,
      whatsappNumber: settings?.whatsappNumber || null,
      instagramUrl: settings?.instagramUrl || null,
      facebookUrl: settings?.facebookUrl || null,
      twitterUrl: settings?.twitterUrl || null,
      linkedinUrl: settings?.linkedinUrl || null,
      discordUrl: settings?.discordUrl || null,
      redditUrl: settings?.redditUrl || null,
      youtubeUrl: settings?.youtubeUrl || null,
      tiktokUrl: settings?.tiktokUrl || null,
      supportHours: settings?.supportHours || "Mon-Fri: 9AM-6PM PKT",
      primaryBrandColor: settings?.primaryBrandColor || "#D3A638",
    });

    // Cache the result
    cachedPdf = { buffer: pdfBuffer, timestamp: Date.now() };

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${(companyName || "").toLowerCase().replace(/\s+/g, '-')}-introduction.pdf"`,
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (error: any) {
    console.error("[Lead Magnet] PDF generation error:", error?.message || error);

    // If dynamic generation fails, fall back to static file
    try {
      const fs = await import("fs");
      const path = await import("path");
      const staticPath = path.join(process.cwd(), "public", "downloads", "valtriox-introduction.pdf");
      if (fs.existsSync(staticPath)) {
        const buffer = fs.readFileSync(staticPath);
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="valtriox-introduction.pdf"`,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    } catch {}

    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lead-magnet - Force regenerate PDF (clears cache).
 * Requires admin auth - used by admin panel "Regenerate PDF" button.
 */
export async function POST() {
  try {
    // Clear cache
    cachedPdf = null;

    // Ensure DB columns exist
    await ensurePlatformSettingsColumns();

    // Fetch settings
    const settings = await withRetry(async () => {
      return await db.platformSettings.findFirst({
      orderBy: { createdAt: "desc" },
    })
    }, 2, 500);

    const companyName = settings?.companyName || "Valtriox";

    // Generate fresh PDF
    const pdfBuffer = await generateLeadMagnetPDF({
      companyName,
      tagline: settings?.tagline || "Command Your Brand Universe",
      logoUrl: settings?.logoUrl || null,
      companyEmail: settings?.companyEmail || "ashir@valtriox.com",
      companyPhone: settings?.companyPhone || null,
      companyWebsite: settings?.companyWebsite || null,
      companyAddress: settings?.companyAddress || null,
      whatsappNumber: settings?.whatsappNumber || null,
      instagramUrl: settings?.instagramUrl || null,
      facebookUrl: settings?.facebookUrl || null,
      twitterUrl: settings?.twitterUrl || null,
      linkedinUrl: settings?.linkedinUrl || null,
      discordUrl: settings?.discordUrl || null,
      redditUrl: settings?.redditUrl || null,
      youtubeUrl: settings?.youtubeUrl || null,
      tiktokUrl: settings?.tiktokUrl || null,
      supportHours: settings?.supportHours || "Mon-Fri: 9AM-6PM PKT",
      primaryBrandColor: settings?.primaryBrandColor || "#D3A638",
    });

    // Update cache
    cachedPdf = { buffer: pdfBuffer, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      message: "PDF regenerated successfully",
      size: pdfBuffer.length,
      pages: 9,
    });
  } catch (error: any) {
    console.error("[Lead Magnet] Regenerate error:", error?.message || error);
    return NextResponse.json(
      { error: `Failed to regenerate PDF: ${error?.message || String(error)}` },
      { status: 500 }
    );
  }
}
