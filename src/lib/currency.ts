// ============================================================================
// Currency System - Country-to-Currency Mapping
// Valtriox uses PKR as default (Pakistani portal), but supports multi-currency
// ============================================================================

export interface CurrencyInfo {
  code: string;
  symbol: string;
  flag: string;
  name: string;
}

// Country code → Currency mapping (ISO 3166-1 alpha-2)
export const COUNTRY_CURRENCY: Record<string, CurrencyInfo> = {
  // South Asia
  PK: { code: "PKR", symbol: "Rs.", flag: "\u{1F1F5}\u{1F1F0}", name: "Pakistani Rupee" },
  IN: { code: "INR", symbol: "\u20B9", flag: "\u{1F1EE}\u{1F1F3}", name: "Indian Rupee" },
  BD: { code: "BDT", symbol: "\u09F3", flag: "\u{1F1E7}\u{1F1E9}", name: "Bangladeshi Taka" },
  NP: { code: "NPR", symbol: "Rs.", flag: "\u{1F1F3}\u{1F1F5}", name: "Nepalese Rupee" },
  LK: { code: "LKR", symbol: "Rs.", flag: "\u{1F1F1}\u{1F1F0}", name: "Sri Lankan Rupee" },
  AF: { code: "AFN", symbol: "\u060B", flag: "\u{1F1E6}\u{1F1EB}", name: "Afghan Afghani" },

  // Middle East
  AE: { code: "AED", symbol: "AED", flag: "\u{1F1E6}\u{1F1EA}", name: "UAE Dirham" },
  SA: { code: "SAR", symbol: "SAR", flag: "\u{1F1F8}\u{1F1E6}", name: "Saudi Riyal" },
  QA: { code: "QAR", symbol: "QR", flag: "\u{1F1F6}\u{1F1E6}", name: "Qatari Riyal" },
  KW: { code: "KWD", symbol: "KD", flag: "\u{1F1F0}\u{1F1FC}", name: "Kuwaiti Dinar" },
  BH: { code: "BHD", symbol: "BD", flag: "\u{1F1E7}\u{1F1ED}", name: "Bahraini Dinar" },
  OM: { code: "OMR", symbol: "OMR", flag: "\u{1F1F4}\u{1F1F2}", name: "Omani Rial" },
  IQ: { code: "IQD", symbol: "ID", flag: "\u{1F1EE}\u{1F1F6}", name: "Iraqi Dinar" },
  JO: { code: "JOD", symbol: "JD", flag: "\u{1F1EF}\u{1F1F4}", name: "Jordanian Dinar" },
  LB: { code: "LBP", symbol: "L.L.", flag: "\u{1F1F1}\u{1F1E7}", name: "Lebanese Pound" },
  EG: { code: "EGP", symbol: "E\u00A3", flag: "\u{1F1EA}\u{1F1EC}", name: "Egyptian Pound" },
  TR: { code: "TRY", symbol: "\u20BA", flag: "\u{1F1F9}\u{1F1F7}", name: "Turkish Lira" },
  IR: { code: "IRR", symbol: "IRR", flag: "\u{1F1EE}\u{1F1F7}", name: "Iranian Rial" },
  PS: { code: "ILS", symbol: "\u20AA", flag: "\u{1F1F5}\u{1F1F8}", name: "Israeli Shekel" },
  YE: { code: "YER", symbol: "YER", flag: "\u{1F1FE}\u{1F1EA}", name: "Yemeni Rial" },

  // East Asia
  CN: { code: "CNY", symbol: "\u00A5", flag: "\u{1F1E8}\u{1F1F3}", name: "Chinese Yuan" },
  JP: { code: "JPY", symbol: "\u00A5", flag: "\u{1F1EF}\u{1F1F5}", name: "Japanese Yen" },
  KR: { code: "KRW", symbol: "\u20A9", flag: "\u{1F1F0}\u{1F1F7}", name: "Korean Won" },
  TW: { code: "TWD", symbol: "NT$", flag: "\u{1F1F9}\u{1F1FC}", name: "Taiwan Dollar" },
  HK: { code: "HKD", symbol: "HK$", flag: "\u{1F1ED}\u{1F1F0}", name: "Hong Kong Dollar" },
  SG: { code: "SGD", symbol: "S$", flag: "\u{1F1F8}\u{1F1EC}", name: "Singapore Dollar" },
  MY: { code: "MYR", symbol: "RM", flag: "\u{1F1F2}\u{1F1FE}", name: "Malaysian Ringgit" },
  TH: { code: "THB", symbol: "\u0E3F", flag: "\u{1F1F9}\u{1F1ED}", name: "Thai Baht" },
  PH: { code: "PHP", symbol: "\u20B1", flag: "\u{1F1F5}\u{1F1ED}", name: "Philippine Peso" },
  ID: { code: "IDR", symbol: "Rp", flag: "\u{1F1EE}\u{1F1E9}", name: "Indonesian Rupiah" },
  VN: { code: "VND", symbol: "\u20AB", flag: "\u{1F1FB}\u{1F1F3}", name: "Vietnamese Dong" },

  // Europe
  GB: { code: "GBP", symbol: "\u00A3", flag: "\u{1F1EC}\u{1F1E7}", name: "British Pound" },
  DE: { code: "EUR", symbol: "\u20AC", flag: "\u{1F1E9}\u{1F1EA}", name: "Euro" },
  FR: { code: "EUR", symbol: "\u20AC", flag: "\u{1F1EB}\u{1F1F7}", name: "Euro" },
  IT: { code: "EUR", symbol: "\u20AC", flag: "\u{1F1EE}\u{1F1F9}", name: "Euro" },
  ES: { code: "EUR", symbol: "\u20AC", flag: "\u{1F1EA}\u{1F1F8}", name: "Euro" },
  NL: { code: "EUR", symbol: "\u20AC", flag: "\u{1F1F3}\u{1F1F1}", name: "Euro" },
  SE: { code: "SEK", symbol: "kr", flag: "\u{1F1F8}\u{1F1EA}", name: "Swedish Krona" },
  NO: { code: "NOK", symbol: "kr", flag: "\u{1F1F3}\u{1F1F4}", name: "Norwegian Krone" },
  DK: { code: "DKK", symbol: "kr", flag: "\u{1F1E9}\u{1F1F0}", name: "Danish Krone" },
  CH: { code: "CHF", symbol: "CHF", flag: "\u{1F1E8}\u{1F1ED}", name: "Swiss Franc" },
  PL: { code: "PLN", symbol: "z\u0142", flag: "\u{1F1F5}\u{1F1F1}", name: "Polish Zloty" },
  RU: { code: "RUB", symbol: "\u20BD", flag: "\u{1F1F7}\u{1F1FA}", name: "Russian Ruble" },
  UA: { code: "UAH", symbol: "\u20B4", flag: "\u{1F1FA}\u{1F1E6}", name: "Ukrainian Hryvnia" },
  IE: { code: "EUR", symbol: "\u20AC", flag: "\u{1F1EE}\u{1F1EA}", name: "Euro" },
  PT: { code: "EUR", symbol: "\u20AC", flag: "\u{1F1F5}\u{1F1F9}", name: "Euro" },

  // Americas
  US: { code: "USD", symbol: "$", flag: "\u{1F1FA}\u{1F1F8}", name: "US Dollar" },
  CA: { code: "CAD", symbol: "C$", flag: "\u{1F1E8}\u{1F1E6}", name: "Canadian Dollar" },
  MX: { code: "MXN", symbol: "MX$", flag: "\u{1F1F2}\u{1F1FD}", name: "Mexican Peso" },
  BR: { code: "BRL", symbol: "R$", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazilian Real" },
  AR: { code: "ARS", symbol: "AR$", flag: "\u{1F1E6}\u{1F1F7}", name: "Argentine Peso" },
  CO: { code: "COP", symbol: "COL$", flag: "\u{1F1E8}\u{1F1F4}", name: "Colombian Peso" },
  CL: { code: "CLP", symbol: "CL$", flag: "\u{1F1E8}\u{1F1F1}", name: "Chilean Peso" },
  PE: { code: "PEN", symbol: "S/.", flag: "\u{1F1F5}\u{1F1EA}", name: "Peruvian Sol" },
  AU: { code: "AUD", symbol: "A$", flag: "\u{1F1E6}\u{1F1FA}", name: "Australian Dollar" },
  NZ: { code: "NZD", symbol: "NZ$", flag: "\u{1F1F3}\u{1F1FF}", name: "New Zealand Dollar" },

  // Africa
  ZA: { code: "ZAR", symbol: "R", flag: "\u{1F1FF}\u{1F1E6}", name: "South African Rand" },
  NG: { code: "NGN", symbol: "\u20A6", flag: "\u{1F1F3}\u{1F1EC}", name: "Nigerian Naira" },
  KE: { code: "KES", symbol: "KSh", flag: "\u{1F1F0}\u{1F1EA}", name: "Kenyan Shilling" },
  MA: { code: "MAD", symbol: "MAD", flag: "\u{1F1F2}\u{1F1E6}", name: "Moroccan Dirham" },
};

/**
 * Get currency info for a country code
 * Defaults to PKR (Pakistani Rupee) if country not found
 */
export function getCurrencyForCountry(countryCode: string): CurrencyInfo {
  return COUNTRY_CURRENCY[countryCode] || COUNTRY_CURRENCY["PK"];
}

/**
 * Format amount with currency symbol
 * @param amount - The numeric amount
 * @param countryCode - ISO country code (defaults to PK)
 * @returns Formatted string like "Rs. 4,999" or "$100"
 */
export function formatCurrency(amount: number, countryCode: string = "PK"): string {
  const currency = getCurrencyForCountry(countryCode);
  return `${currency.symbol} ${amount.toLocaleString()}`;
}

/**
 * Get a small inline currency display element (for JSX)
 * Returns the flag emoji + symbol
 */
export function currencyDisplay(countryCode: string = "PK"): { flag: string; symbol: string; code: string } {
  const currency = getCurrencyForCountry(countryCode);
  return { flag: currency.flag, symbol: currency.symbol, code: currency.code };
}

/**
 * Get currency info from a currency code (e.g., "USD", "AED", "PKR").
 * Scans the COUNTRY_CURRENCY map to find the first match.
 * Falls back to PKR if not found.
 */
export function getCurrencyInfoFromCode(currencyCode: string): CurrencyInfo {
  if (!currencyCode) return COUNTRY_CURRENCY["PK"];
  for (const entry of Object.values(COUNTRY_CURRENCY)) {
    if (entry.code === currencyCode) return entry;
  }
  return COUNTRY_CURRENCY["PK"];
}

/**
 * Resolve the best currency info for an organization.
 * Priority: organization.currency (stored in DB) > country-based detection > PKR default
 */
export function resolveOrgCurrency(
  orgCurrency: string | undefined,
  orgCountry: string | undefined
): CurrencyInfo {
  if (orgCurrency && orgCurrency !== "PKR") {
    const info = getCurrencyInfoFromCode(orgCurrency);
    if (info.code !== "PKR" || orgCurrency === "PKR") return info;
  }
  if (orgCurrency === "PKR") return COUNTRY_CURRENCY["PK"];
  return getCurrencyForCountry(orgCountry || "PK");
}

/**
 * Convert PKR amount to another currency using approximate exchange rates.
 * These are hardcoded rates for display purposes — actual billing uses gateway rates.
 * Rates are approximate as of 2026 and should be updated periodically.
 */
const EXCHANGE_RATES_TO_PKR: Record<string, number> = {
  USD: 278,     // 1 USD ≈ 278 PKR
  GBP: 351,     // 1 GBP ≈ 351 PKR
  EUR: 302,     // 1 EUR ≈ 302 PKR
  AED: 75.7,    // 1 AED ≈ 75.7 PKR
  SAR: 74.1,    // 1 SAR ≈ 74.1 PKR
  CAD: 201,     // 1 CAD ≈ 201 PKR
  AUD: 183,     // 1 AUD ≈ 183 PKR
  INR: 3.3,     // 1 INR ≈ 3.3 PKR
  BDT: 2.3,     // 1 BDT ≈ 2.3 PKR
  SGD: 208,     // 1 SGD ≈ 208 PKR
  MYR: 62.5,    // 1 MYR ≈ 62.5 PKR
  THB: 7.9,     // 1 THB ≈ 7.9 PKR
  QAR: 76.4,    // 1 QAR ≈ 76.4 PKR
  KWD: 906,     // 1 KWD ≈ 906 PKR
  BHD: 738,     // 1 BHD ≈ 738 PKR
  OMR: 722,     // 1 OMR ≈ 722 PKR
};

/**
 * Convert a PKR amount to a target currency.
 * Returns the converted amount rounded to nearest integer.
 */
export function convertPKRToCurrency(amountPKR: number, targetCurrency: string): number {
  if (targetCurrency === "PKR") return amountPKR;
  const rate = EXCHANGE_RATES_TO_PKR[targetCurrency];
  if (!rate) return amountPKR; // fallback to PKR if rate unknown
  return Math.round(amountPKR / rate);
}

/**
 * Get the exchange rate for a currency (how many PKR per 1 unit of target).
 * Returns undefined if rate is not available.
 */
export function getExchangeRate(currencyCode: string): number | undefined {
  return EXCHANGE_RATES_TO_PKR[currencyCode];
}

/**
 * Get all supported currencies with exchange rate availability.
 */
export function getSupportedCurrencies(): Array<{ code: string; symbol: string; flag: string; name: string; hasRate: boolean }> {
  const currencies: Array<{ code: string; symbol: string; flag: string; name: string; hasRate: boolean }> = [];
  const seen = new Set<string>();
  
  for (const info of Object.values(COUNTRY_CURRENCY)) {
    if (!seen.has(info.code)) {
      seen.add(info.code);
      currencies.push({
        code: info.code,
        symbol: info.symbol,
        flag: info.flag,
        name: info.name,
        hasRate: info.code === "PKR" || info.code in EXCHANGE_RATES_TO_PKR,
      });
    }
  }
  
  return currencies.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Format an amount in a specific currency with proper symbol and thousands separator.
 */
export function formatAmountInCurrency(amountPKR: number, currencyCode: string): string {
  if (currencyCode === "PKR") {
    return `Rs. ${amountPKR.toLocaleString()}`;
  }
  const converted = convertPKRToCurrency(amountPKR, currencyCode);
  const info = getCurrencyInfoFromCode(currencyCode);
  return `${info.symbol} ${converted.toLocaleString()}`;
}
