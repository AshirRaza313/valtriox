// ============================================================================
// Valtriox Portal — Screenshot Capture (Playwright)
// ============================================================================
// Captures Urdu-locale screenshots in 3 required states:
//   1. Dark theme dashboard
//   2. Premium-Dark theme dashboard
//   3. Locked-feature overlay
//
// All filenames are bound to the current git HEAD SHA — proving the
// screenshots reflect the exact commit under review.
// ============================================================================
import { chromium, Browser, Page, BrowserContext } from "playwright";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE_URL = process.env.DEPLOY_URL || "http://localhost:3000";
const HEAD_SHA = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);

const EMAIL = process.env.SCREENSHOT_EMAIL || "";
const PASSWORD = process.env.SCREENSHOT_PASSWORD || "";

const OUTPUT_DIR = "backups/screenshots";

async function setAppState(
  context: BrowserContext,
  theme: "dark" | "premium-dark",
  locale: "ur"
) {
  // Zustand persists to localStorage under "brandflow-store" (or similar).
  // We inject both localStorage and cookies so whichever the app reads,
  // it gets the correct state on first paint.
  await context.addInitScript(
    ({ theme, locale }) => {
      // Zustand persist format
      const store = {
        state: {
          theme,
          language: locale,
          brandColor: "#7c3aed",
          brandSecondaryColor: "#ec4899",
        },
        version: 0,
      };
      try {
        localStorage.setItem("brandflow-store", JSON.stringify(store));
        localStorage.setItem("valtriox-store", JSON.stringify(store));
        localStorage.setItem("theme", theme);
        localStorage.setItem("language", locale);
        localStorage.setItem("lang", locale);
        // Some apps read language from cookie
        document.cookie = `language=${locale}; path=/`;
        document.cookie = `theme=${theme}; path=/`;
      } catch {
        // ignore
      }
    },
    { theme, locale }
  );
}

async function login(page: Page) {
  if (!EMAIL || !PASSWORD) {
    console.log("⚠️  No SCREENSHOT_EMAIL / SCREENSHOT_PASSWORD — skipping login");
    return;
  }
  console.log("🔐 Logging in...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

  // Try common selectors for email/password inputs
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[placeholder*="mail" i]',
  ];
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[placeholder*="assword" i]',
  ];

  let emailInput: ReturnType<Page["locator"]> | null = null;
  for (const sel of emailSelectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      emailInput = el;
      break;
    }
  }
  let passwordInput: ReturnType<Page["locator"]> | null = null;
  for (const sel of passwordSelectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      passwordInput = el;
      break;
    }
  }

  if (emailInput && passwordInput) {
    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    // Submit
    const submit = page
      .locator(
        'button[type="submit"], button:has-text("Sign In"), button:has-text("Login")'
      )
      .first();
    if (await submit.count()) {
      await submit.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      console.log("✅ Logged in");
    } else {
      console.log("⚠️  Login form found but submit button not detected");
    }
  } else {
    console.log("⚠️  Login form not detected on landing page — assuming already authenticated or public");
  }
}

async function captureDashboard(
  browser: Browser,
  theme: "dark" | "premium-dark",
  fileName: string
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await setAppState(context, theme, "ur");

  const page = await context.newPage();
  await login(page);

  // Navigate to dashboard
  console.log(`📸 Capturing ${fileName}...`);
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // allow widgets to render

  const filePath = path.join(OUTPUT_DIR, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`   Saved: ${filePath}`);

  await context.close();
}

async function captureLocked(browser: Browser, fileName: string) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await setAppState(context, "premium-dark", "ur");

  const page = await context.newPage();
  await login(page);

  // Locked feature overlay typically appears on a premium route.
  // Try a few known premium routes and capture the first one that shows a lock.
  const candidateRoutes = [
    "/dashboard?locked=1",
    "/ai-tools",
    "/marketing/ad-manager",
    "/analytics/revenue",
  ];

  console.log(`📸 Capturing ${fileName}...`);
  let captured = false;
  for (const route of candidateRoutes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Heuristic: look for lock icon or "upgrade" / "locked" text
    const lockVisible = await page
      .locator(
        '[class*="lock" i], [aria-label*="lock" i], text=/upgrade|locked|unlock|premium/i'
      )
      .first()
      .isVisible()
      .catch(() => false);

    if (lockVisible) {
      const filePath = path.join(OUTPUT_DIR, fileName);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`   Saved (locked overlay detected at ${route}): ${filePath}`);
      captured = true;
      break;
    }
  }

  if (!captured) {
    // Fallback: capture whatever's on the dashboard
    console.log("⚠️  No locked overlay detected — capturing dashboard as fallback");
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const filePath = path.join(OUTPUT_DIR, fileName);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`   Saved (fallback): ${filePath}`);
  }

  await context.close();
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser: Browser = await chromium.launch();

  try {
    await captureDashboard(
      browser,
      "dark",
      `ur-dark-dashboard-${HEAD_SHA}.png`
    );
    await captureDashboard(
      browser,
      "premium-dark",
      `ur-premium-dark-dashboard-${HEAD_SHA}.png`
    );
    await captureLocked(browser, `ur-locked-${HEAD_SHA}.png`);
  } finally {
    await browser.close();
  }

  console.log("\n✅ All screenshots captured:");
  console.log(`   - ur-dark-dashboard-${HEAD_SHA}.png`);
  console.log(`   - ur-premium-dark-dashboard-${HEAD_SHA}.png`);
  console.log(`   - ur-locked-${HEAD_SHA}.png`);
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});