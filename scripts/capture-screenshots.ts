import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';

const BASE_URL = process.env.DEPLOY_URL || 'http://localhost:3000';
const HEAD_SHA = execSync('git rev-parse HEAD').toString().trim();

async function run() {
  const browser: Browser = await chromium.launch();
  const themes = ['light', 'dark', 'premium-dark'];
  const locales = ['en', 'ur'];
  
  fs.mkdirSync('backups/screenshots', { recursive: true });

  for (const theme of themes) {
    for (const locale of locales) {
      const page: Page = await browser.newPage();
      await page.goto(`${BASE_URL}?theme=${theme}&lang=${locale}`);
      
      // Wait for network idle to ensure data is loaded
      await page.waitForLoadState('networkidle');
      
      const file = `backups/screenshots/${locale}-${theme}-dashboard-${HEAD_SHA}.png`;
      await page.screenshot({ path: file, fullPage: true });
      await page.close();
    }
  }

  await browser.close();
}

run().catch(console.error);