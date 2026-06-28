import { NextResponse } from "next/server";
import { db, ensurePlatformSettingsColumns, withRetry} from "@/lib/db";

const DEFAULT_SETTINGS = {
  companyName: "Valtriox",
  tagline: "COMMEND YOUR BRAND UNIVERSE",
  companyEmail: "ashir@valtriox.com",
  companyPhone: null,
  companyWebsite: null,
  companyAddress: null,
  supportHours: "Mon-Fri: 9AM-6PM PKT",
  whatsappNumber: null,
  instagramUrl: null,
  facebookUrl: null,
  twitterUrl: null,
  linkedinUrl: null,
  discordUrl: null,
  redditUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
  socialLinksVisible: true,
  showInstagram: false,
  showFacebook: false,
  showTwitter: false,
  showLinkedin: false,
  showDiscord: false,
  showReddit: false,
  showYoutube: false,
  showTiktok: false,
  showWhatsApp: false,
  logoUrl: null,
  faviconUrl: null,
  primaryBrandColor: "#D4A73A",
  secondaryBrandColor: "#D4A73A",
  calendlyEnabled: false,
  calendlyUrl: null,
  calendlyWidgetHeight: 630,
};

// GET /api/public/settings - Public platform settings (NO AUTH required)
// Used by landing page, contact page, footer, etc.
export async function GET() {
  try {
    // Self-repair: ensure all columns exist before querying.
    // This fixes social icons not showing when DB columns are missing.
    await ensurePlatformSettingsColumns();

    const settings = await withRetry(async () => {
      return await db.platformSettings.findFirst({
      orderBy: { createdAt: "desc" },
    })
    }, 2, 500);

    if (!settings) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    const result: PublicSettingsResult = {
      companyName: settings.companyName || DEFAULT_SETTINGS.companyName,
      tagline: settings.tagline || DEFAULT_SETTINGS.tagline,
      companyEmail: settings.companyEmail || DEFAULT_SETTINGS.companyEmail,
      companyPhone: settings.companyPhone || null,
      companyWebsite: settings.companyWebsite || null,
      companyAddress: settings.companyAddress || null,
      supportHours: settings.supportHours || DEFAULT_SETTINGS.supportHours,
      whatsappNumber: settings.whatsappNumber || null,
      instagramUrl: settings.instagramUrl || null,
      facebookUrl: settings.facebookUrl || null,
      twitterUrl: settings.twitterUrl || null,
      linkedinUrl: settings.linkedinUrl || null,
      discordUrl: settings.discordUrl || null,
      redditUrl: settings.redditUrl || null,
      youtubeUrl: settings.youtubeUrl || null,
      tiktokUrl: settings.tiktokUrl || null,
      socialLinksVisible: settings.socialLinksVisible !== "false",
      showInstagram: Boolean(settings.showInstagram),
      showFacebook: Boolean(settings.showFacebook),
      showTwitter: Boolean(settings.showTwitter),
      showLinkedin: Boolean(settings.showLinkedin),
      showDiscord: Boolean(settings.showDiscord),
      showReddit: Boolean(settings.showReddit),
      showYoutube: Boolean(settings.showYoutube),
      showTiktok: Boolean(settings.showTiktok),
      showWhatsApp: Boolean(settings.showWhatsApp),
      logoUrl: settings.logoUrl || null,
      faviconUrl: settings.faviconUrl || null,
      primaryBrandColor: settings.primaryBrandColor || DEFAULT_SETTINGS.primaryBrandColor,
      secondaryBrandColor: settings.secondaryBrandColor || DEFAULT_SETTINGS.secondaryBrandColor,
      calendlyEnabled: DEFAULT_SETTINGS.calendlyEnabled,
      calendlyUrl: DEFAULT_SETTINGS.calendlyUrl,
      calendlyWidgetHeight: DEFAULT_SETTINGS.calendlyWidgetHeight,
    };

    // Fetch Calendly settings separately (from SystemSetting)
    try {
      const calendlySetting = await withRetry(async () => {
        return await db.systemSetting.findFirst({
        where: { key: "calendly_settings" },
      })
      }, 2, 500);
      if (calendlySetting?.value) {
        const parsed = JSON.parse(calendlySetting.value as string);
        result.calendlyEnabled = Boolean(parsed.enabled);
        result.calendlyUrl = parsed.calendlyUrl || null;
        result.calendlyWidgetHeight = parsed.widgetHeight || 630;
      }
    } catch {
 // Calendly settings are optional
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Public Settings] Error:", error?.message || error);
    // Always return defaults - landing page should never break
    return NextResponse.json({ ...DEFAULT_SETTINGS, fallback: true });
  }
}

// Helper type
interface PublicSettingsResult {
 companyName: string;
 tagline: string;
 companyEmail: string;
 companyPhone: string | null;
 companyWebsite: string | null;
 companyAddress: string | null;
 supportHours: string;
 whatsappNumber: string | null;
 instagramUrl: string | null;
 facebookUrl: string | null;
 twitterUrl: string | null;
 linkedinUrl: string | null;
 discordUrl: string | null;
 redditUrl: string | null;
 youtubeUrl: string | null;
 tiktokUrl: string | null;
 socialLinksVisible: boolean;
 showInstagram: boolean;
 showFacebook: boolean;
 showTwitter: boolean;
 showLinkedin: boolean;
 showDiscord: boolean;
 showReddit: boolean;
 showYoutube: boolean;
 showTiktok: boolean;
 showWhatsApp: boolean;
 logoUrl: string | null;
 faviconUrl: string | null;
 primaryBrandColor: string;
 secondaryBrandColor: string;
 calendlyEnabled: boolean;
 calendlyUrl: string | null;
 calendlyWidgetHeight: number;
  [key: string]: unknown;
}
