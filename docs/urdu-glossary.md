# Roman Urdu Glossary — Valtriox Portal

This document lists terms that are intentionally kept in English in the Urdu
localization, along with the rationale. Any term not listed here must be
translated to Roman Urdu.

## Purpose

Roman Urdu (Pakistani Urdu in Latin script) commonly uses English loanwords
for technical, brand, and internationally recognized terms. Forcing literal
translations of these degrades user experience and creates confusion.

This glossary formalizes that decision so reviewers can distinguish between:

- **Intentional loanwords** — kept in English by design
- **Untranslated strings** — a regression that must be fixed

## How to Use

Run `node scripts/find-identical-i18n.js` to list all keys whose EN and UR
values are identical. Every key in that list must appear in one of the
categories below. If a key is missing from this glossary, it is a regression.

## Category 1 — International Brand / Format Names

| Key | Value | Reason |
|-----|-------|--------|
| `whatsapp` | WhatsApp | Brand name |
| `email` | Email | Universal format |
| `sms` | SMS | Universal acronym |
| `userPlaceholder` | user@portal.com | Email format example |
| `versionNumber` | v3.0 | Version identifier |
| `version` | Version | Technical term |
| `rupees` | Rs. | Currency symbol |

## Category 2 — Plan / Tier Names

| Key | Value | Reason |
|-----|-------|--------|
| `premium` | Premium | Product tier name |
| `enterprise` | Enterprise | Product tier name |
| `starter` | Starter | Product tier name |
| `growth` | Growth | Product tier name |
| `plan` | Plan | Product term |
| `subscription` | Subscription | Product term |
| `billing` | Billing | Product term |
| `beta` | Beta | Release channel name |

## Category 3 — Technical / Domain Terms

| Key | Value | Reason |
|-----|-------|--------|
| `dashboard` | Dashboard | Widely used in Pakistani Roman Urdu |
| `coupons` | Coupons | Widely used in e-commerce |
| `marketingGroup` | Marketing | Internationally recognized |
| `seoManager` | SEO Manager | Technical domain term |
| `slaEngine` | SLA Engine | Technical acronym |
| `slaRules` | SLA Rules | Technical acronym |
| `apiSetup` | API Setup | Technical acronym |
| `admin` | Admin | Role name, universally understood |
| `manager` | Manager | Role name |
| `columnModule` | Module | Technical term |
| `timelineView` | Timeline | UI convention |
| `tableView` | Table | UI convention |
| `lightTheme` | Light Theme | Theme name |
| `darkTheme` | Dark Theme | Theme name |
| `premiumDark` | Premium Dark | Theme name |
| `dashboardWidgets` | Dashboard Widgets | Compound with loanword |
| `marketingCalendarTitle` | Marketing Calendar | Compound with loanword |
| `seoMetricsTitle` | SEO Metrics | Technical acronym |
| `socialAnalyticsTitle` | Social Media | Internationally recognized |
| `operationsHub` | Operations Hub | Product term |
| `poweredBy` | Powered by {platformName} | Brand convention |

## Category 4 — UI Convention Terms

| Key | Value | Reason |
|-----|-------|--------|
| `signIn` | Sign In | Standard auth UI |
| `signUp` | Sign Up | Standard auth UI |
| `signOut` | Sign Out | Standard auth UI |
| `login` | Login | Standard auth UI |
| `register` | Register | Standard auth UI |
| `password` | Password | Standard auth UI |
| `pinLogin` | PIN Login | Auth method name |
| `notifications` | Notifications | Standard UI convention |
| `profile` | Profile | Standard UI convention |
| `emailAddress` | Email Address | Format label |
| `phoneNumber` | Phone Number | Format label |
| `subtotal` | Subtotal | Financial term |
| `tax` | Tax | Financial term |
| `file` | File | Technical term |
| `files` | Files | Technical term |
| `link` | Link | Technical term |
| `tag` | Tag | Metadata term |
| `tags` | Tags | Metadata term |
| `page` | Page | UI convention |
| `english` | English | Language name |
| `romanUrdu` | Roman Urdu | Language name |

## Category 5 — Properly Translated (NOT in glossary)

These keys are translated to Roman Urdu and must NOT appear in the
identical-EN/UR list. If any of these appear, it is a regression.

| Key | Roman Urdu Value |
|-----|------------------|
| `cancel` | Radd Karein |
| `on` | Chalu |
| `off` | Band |
| `groups` | Majma |
| `items` | cheezein |
| `slaActive` | chalu |
| `slaDisabled` | band |

## Verification Workflow

1. Run `node scripts/find-identical-i18n.js`
2. The output list must contain ONLY keys from Categories 1-4
3. Any key from Category 5 appearing in the output = regression
4. Any key NOT in this glossary appearing in the output = regression

## Ownership

- **Owner:** Ashir Raza
- **Last updated:** 2026-09-12
- **Review cadence:** every localization PR
- **Related files:** `src/lib/i18n.ts`, `scripts/find-identical-i18n.js`