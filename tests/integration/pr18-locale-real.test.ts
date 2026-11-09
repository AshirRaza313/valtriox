/**
 * Real locale test - verifies actual i18n dictionaries
 * (not mocked). Covers 9 keys x 2 locales = 18 assertions.
 *
 * Purpose: Coverage expansion. Proves t() returns the
 * expected string from the real dictionary for each key
 * in both EN and UR. Does NOT prove a bug fix (keys already
 * exist per PR #20 addendum). Proves that components using
 * t() will render correct real strings at runtime.
 */
import { describe, it, expect } from 'vitest';
import { t } from '@/lib/i18n';

const EN_EXPECTED = {
  aiUnavailableMessage: 'This feature is not yet available. Coming in a future release.',
  templateSuggestError: 'Write some email content first to get template suggestions',
  emailSampleButton: 'Use sample subject',
  insightsLoading: 'Loading insights...',
  insightsTitle: 'Insights',
  suggestionApplied: 'Suggestion applied',
  comingSoonLabel: 'Coming Soon',
  predictionsSubtitle: 'Forecasts (coming soon)',
  productDescriptionsTitle: 'Product Descriptions',
};

const UR_EXPECTED = {
  aiUnavailableMessage: 'Yeh feature abhi available nahi. Aane wale release mein aayega.',
  templateSuggestError: 'Pehle kuch email content likhein template suggestions ke liye',
  emailSampleButton: 'Sample subject use karein',
  insightsLoading: 'Insights load ho rahi hain...',
  insightsTitle: 'Insights',
  suggestionApplied: 'Suggestion apply ho gayi',
  comingSoonLabel: 'Jald Aa Raha Hai',
  predictionsSubtitle: 'Forecasts (jald aa raha hai)',
  productDescriptionsTitle: 'Product Descriptions',
};

describe('Real locale - EN dictionary', () => {
  it.each(Object.entries(EN_EXPECTED))('en: %s', (key, expected) => {
    expect(t('en', key)).toBe(expected);
  });
});

describe('Real locale - UR dictionary', () => {
  it.each(Object.entries(UR_EXPECTED))('ur: %s', (key, expected) => {
    expect(t('ur', key)).toBe(expected);
  });
});