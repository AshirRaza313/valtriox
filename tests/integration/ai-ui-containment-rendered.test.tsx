// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const localeState = vi.hoisted(() => ({ value: 'en' as 'en' | 'ur' }));

const EN_DICT: Record<string, string> = {
  aiAssistant: 'AI Assistant',
  aiUnavailableMessage: 'This feature is not yet available. Coming in a future release.',
  insightsTitle: 'Insights',
  insightsLoading: 'Loading insights...',
  suggestionApplied: 'Suggestion applied',
  comingSoonLabel: 'Coming Soon',
  predictionsSubtitle: 'Forecasts (coming soon)',
  productDescriptionsTitle: 'Product Descriptions',
  emailSampleButton: 'Use sample subject',
  templateSuggestError: 'Write some email content first to get template suggestions',
};

const UR_DICT: Record<string, string> = {
  ...EN_DICT,
  aiUnavailableMessage: 'Yeh feature abhi available nahi. Aane wale release mein aayega.',
  insightsLoading: 'Insights load ho rahi hain...',
  suggestionApplied: 'Suggestion apply ho gayi',
  comingSoonLabel: 'Jald Aa Raha Hai',
  predictionsSubtitle: 'Forecasts (jald aa raha hai)',
  emailSampleButton: 'Sample subject use karein',
  templateSuggestError: 'Pehle kuch email content likhein template suggestions ke liye',
};

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => (key: string) => {
    const dict = localeState.value === 'en' ? EN_DICT : UR_DICT;
    return dict[key] ?? key;
  },
}));

vi.mock('@/store/brandflow-store', () => ({
  useValtrioxStore: () => ({
    appTheme: 'light',
    organization: { id: 'test-org' },
    setActiveSection: vi.fn(),
  }),
}));

// FIX 1: positive data triggers generateContextualInsights claims
vi.mock('@/lib/fetch-with-auth', () => ({
  fetchWithAuth: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      totalRevenue: 50000,
      conversionRate: 2,
      customerCount: 10,
      newCustomers: 3,
      lowStockProducts: 5,
    }),
  }),
}));

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: vi.fn(),
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => {
      const { children, initial, animate, transition, whileHover, whileTap, exit, variants, ...rest } = props;
      return React.createElement('div', rest, children);
    },
  },
}));

vi.mock('@/lib/db', () => ({
  db: new Proxy({}, { get: () => new Proxy({}, { get: () => vi.fn() }) }),
  isDbUnavailable: () => false,
  isSchemaError: () => false,
  withRetry: (fn: () => unknown) => fn(),
  ensureDb: () => Promise.resolve(true),
  dbErrorResponse: () => new Response('{}', { status: 503 }),
}));

import * as EmailMarketingModule from '@/components/brandflow/marketing/EmailMarketingPage';
import * as AIInsightsModule from '@/components/brandflow/dashboard/widgets/AIInsightsWidget';
import * as QuickActionsModule from '@/components/brandflow/dashboard/QuickActions';

const EmailMarketingPage: React.ComponentType = (EmailMarketingModule as any).default ?? (EmailMarketingModule as any).EmailMarketingPage;
const AIInsightsWidget: React.ComponentType = (AIInsightsModule as any).default ?? (AIInsightsModule as any).AIInsightsWidget;
const QuickActions: React.ComponentType = (QuickActionsModule as any).default ?? (QuickActionsModule as any).QuickActions;


// Helper: activate Compose tab so button is rendered
function renderEmailCompose() {
  const result = render(React.createElement(EmailMarketingPage));
  const tabs = result.container.querySelectorAll('[role="tab"], [role="tab"] button, button[role="tab"]');
  const candidates = Array.from(result.container.querySelectorAll('button')).filter((b) => /compose/i.test(b.textContent || ''));
  const composeTrigger = candidates[0] || Array.from(tabs).find((t) => /compose/i.test(t.textContent || ''));
  if (composeTrigger) {
    fireEvent.click(composeTrigger);
  }
  return result;
}

beforeEach(() => {
  localeState.value = 'en';
  toastErrorMock.mockClear();
  toastSuccessMock.mockClear();
});

describe('EmailMarketingPage - rendered AI containment', () => {
  it('does not contain "AI Suggest Subject" text', () => {
    const { container } = render(React.createElement(EmailMarketingPage));
    expect(container.textContent).not.toMatch(/AI Suggest Subject/i);
  });

  it('does not contain "AI generated" text', () => {
    const { container } = render(React.createElement(EmailMarketingPage));
    expect(container.textContent).not.toMatch(/AI generated/i);
  });

  it('renders "Use sample subject" button label via t()', () => {
    const { container } = renderEmailCompose();
    expect(container.textContent).toMatch(/Use sample subject/i);
  });

  it('error message for empty body does not say "AI"', () => {
    const { container } = renderEmailCompose();
    const buttons = Array.from(container.querySelectorAll('button'));
    const suggestBtn = buttons.find((b) => /use sample subject|ai suggest subject/i.test(b.textContent || ''));
    if (!suggestBtn) {
      throw new Error('Neither "Use sample subject" nor "AI Suggest Subject" button found in DOM');
    }
    fireEvent.click(suggestBtn);
    const errorArg = String(toastErrorMock.mock.calls[0]?.[0] ?? '');
    expect(errorArg).not.toMatch(/AI suggest/i);
    expect(errorArg).toMatch(/template suggest/i);
  });
});

describe('AIInsightsWidget - rendered AI containment', () => {
  // FIX 2: waitFor for async state update
  it('does not contain "15-30%" unsupported revenue claim', async () => {
    const { container } = render(React.createElement(AIInsightsWidget));
    await waitFor(() => {
      expect(container.textContent).not.toMatch(/Loading insights/i);
    }, { timeout: 3000 });
    expect(container.textContent).not.toMatch(/15-30%/);
  });

  it('does not contain "below average" unsupported benchmark claim', async () => {
    const { container } = render(React.createElement(AIInsightsWidget));
    await waitFor(() => {
      expect(container.textContent).not.toMatch(/Loading insights/i);
    }, { timeout: 3000 });
    expect(container.textContent).not.toMatch(/below average/i);
  });

  it('does not contain "AI Powered" label', () => {
    const { container } = render(React.createElement(AIInsightsWidget));
    expect(container.textContent).not.toMatch(/AI Powered/i);
  });

  it('renders the honest unavailable message', async () => {
    const { container } = render(React.createElement(AIInsightsWidget));
    await waitFor(() => {
      expect(container.textContent).not.toMatch(/Loading insights/i);
    }, { timeout: 3000 });
    expect(container.textContent).toMatch(/This feature is not yet available/i);
  });
});

describe('QuickActions - rendered AI containment', () => {
  // FIX 3: regression guard, not RED proof
  it('[REGRESSION] renders "AI Assistant (Coming Soon)" composite label in EN', () => {
    localeState.value = 'en';
    const { container } = render(React.createElement(QuickActions));
    expect(container.textContent).toMatch(/AI Assistant \(Coming Soon\)/);
  });

  it('renders UR "Coming Soon" translation when locale is ur', () => {
    localeState.value = 'ur';
    const { container } = render(React.createElement(QuickActions));
    expect(container.textContent).toMatch(/Jald Aa Raha Hai/);
  });
});