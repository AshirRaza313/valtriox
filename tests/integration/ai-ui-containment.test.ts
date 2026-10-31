/**
 * AI UI Truthful Containment Test Suite
 *
 * Proves the false-claim defects existed (RED) and are removed (GREEN).
 * Static source inspection - no component rendering.
 *
 * RED expectation (current main bebd61f):  13 failed / 1 passed
 * GREEN expectation (after commits 2-4):   14 passed / 0 failed
 *
 * Test 13 (guardrail) passes in BOTH states - prevents future regression,
 * does NOT prove the fix.
 *
 * Naming discipline: This suite enforces "truthful UI containment".
 * It does NOT prove "AI feature implemented" (AI MVP is separate + blocked).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(process.cwd());
const readSrc = (relPath: string): string =>
  readFileSync(resolve(REPO_ROOT, relPath), 'utf-8');

describe('AIAssistantPage.tsx - truthful unavailable state', () => {
  let content: string;
  beforeAll(() => {
    content = readSrc('src/components/brandflow/tools/AIAssistantPage.tsx');
  });

  it('does not contain fake typing setTimeout with assistant role', () => {
    // RECON: AIAssistantPage.tsx L44-48 - setTimeout(() => { role: "assistant" ... }, 1500)
    expect(content).not.toMatch(/setTimeout[\s\S]{0,500}role:\s*["']assistant["']/);
  });

  it('does not contain "Powered by AI"', () => {
    // RECON: AIAssistantPage.tsx L59 - "Powered by AI to help you make smarter decisions"
    expect(content).not.toContain('Powered by AI');
  });

  it('does not contain "AI is thinking"', () => {
    // RECON: AIAssistantPage.tsx L104 - "AI is thinking..."
    expect(content).not.toContain('AI is thinking');
  });

  it('Generate Description button is disabled', () => {
    // RECON: AIAssistantPage.tsx L137 - button has onClick toast, no disabled attribute
    const idx = content.indexOf('Generate Description');
    expect(idx).toBeGreaterThan(-1);
    const snippet = content.slice(Math.max(0, idx - 400), idx);
    expect(snippet).toContain('disabled');
  });

  it('renders honest unavailable message via t("aiUnavailableMessage")', () => {
    // RECON: no t("aiUnavailableMessage") present in current file
    expect(content).toContain('t("aiUnavailableMessage")');
  });
});

describe('AIInsightsWidget.tsx - no fabricated data or AI labels', () => {
  let content: string;
  beforeAll(() => {
    content = readSrc('src/components/brandflow/dashboard/widgets/AIInsightsWidget.tsx');
  });

  it('does not contain FALLBACK_INSIGHTS fabricated data', () => {
    // RECON: AIInsightsWidget.tsx L22-46 - FALLBACK_INSIGHTS with fabricated stats
    expect(content).not.toContain('FALLBACK_INSIGHTS');
  });

  it('does not contain "AI Powered" label', () => {
    // RECON: AIInsightsWidget.tsx L164 - <p>AI Powered</p>
    expect(content).not.toContain('AI Powered');
  });

  it('uses t("insightsTitle") for header', () => {
    // RECON: AIInsightsWidget.tsx L162 - currently t("aiInsights") which returns raw key (missing)
    expect(content).toContain('t("insightsTitle")');
  });
});

describe('PredictiveAnalyticsWidget.tsx - no false forecast promises', () => {
  let content: string;
  beforeAll(() => {
    content = readSrc('src/components/brandflow/dashboard/widgets/PredictiveAnalyticsWidget.tsx');
  });

  it('does not contain "AI-powered forecasts"', () => {
    // RECON: PredictiveAnalyticsWidget.tsx L28 - "AI-powered forecasts"
    expect(content).not.toContain('AI-powered forecasts');
  });

  it('renders honest unavailable message', () => {
    // RECON: no t("aiUnavailableMessage") present; false promises at L33, L35
    expect(content).toContain('t("aiUnavailableMessage")');
  });
});

describe('EmailMarketingPage.tsx - no fake AI toast', () => {
  let content: string;
  beforeAll(() => {
    content = readSrc('src/components/brandflow/marketing/EmailMarketingPage.tsx');
  });

  it('does not contain "AI generated a subject line"', () => {
    // RECON: EmailMarketingPage.tsx L108 - toast.success("AI generated a subject line!")
    // This is a random pick from hardcoded array, not AI
    expect(content).not.toContain('AI generated a subject line');
  });
});

describe('UserGuidePage.tsx - honest AI Tools description', () => {
  let content: string;
  beforeAll(() => {
    content = readSrc('src/components/brandflow/guide/UserGuidePage.tsx');
  });

  it('AI Tools section does not claim "provides AI-powered features"', () => {
    // RECON: UserGuidePage.tsx L145 - "The AI Tools section ... provides AI-powered features"
    expect(content).not.toContain('provides AI-powered features');
  });
});

describe('Cross-surface guardrail', () => {
  it('no AI surface contains "AI feature implemented"', () => {
    // Guardrail: prevents future regression. Passes in both
    // RED and GREEN states. NOT a proof test.
    const surfaces = [
      'src/components/brandflow/tools/AIAssistantPage.tsx',
      'src/components/brandflow/dashboard/widgets/AIInsightsWidget.tsx',
      'src/components/brandflow/dashboard/widgets/PredictiveAnalyticsWidget.tsx',
      'src/components/brandflow/marketing/EmailMarketingPage.tsx',
      'src/components/brandflow/guide/UserGuidePage.tsx',
      'src/components/brandflow/dashboard/QuickActions.tsx',
    ];
    for (const relPath of surfaces) {
      const surfaceContent = readSrc(relPath);
      expect(surfaceContent).not.toContain('AI feature implemented');
    }
  });
});

describe('i18n.ts - new keys present in EN + UR blocks', () => {
  let content: string;
  beforeAll(() => {
    content = readSrc('src/lib/i18n.ts');
  });

  it('all 7 new keys appear twice (EN + UR)', () => {
    // RECON: Q8 audit confirmed aiGenerating/aiInsights are MISSING.
    // This test ensures all new keys added to both en (L12-506) and ur (L507+) blocks.
    const NEW_KEYS = [
      'aiUnavailableMessage',
      'insightsLoading',
      'insightsTitle',
      'suggestionApplied',
      'comingSoonLabel',
      'predictionsSubtitle',
      'productDescriptionsTitle',
    ];
    for (const key of NEW_KEYS) {
      const matches = content.match(new RegExp(key + '\\s*:', 'g'));
      expect(matches, 'Key "' + key + '" missing from i18n.ts').not.toBeNull();
      expect(matches!.length, 'Key "' + key + '" should appear twice (EN + UR)').toBe(2);
    }
  });
});