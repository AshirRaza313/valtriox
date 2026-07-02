"use client";

import { useRouter } from "next/navigation";
import { PrivacyPolicyPage } from "@/components/brandflow/legal/PrivacyPolicyPage";
import { TermsOfServicePage } from "@/components/brandflow/legal/TermsOfServicePage";
import { CookiePolicyPage } from "@/components/brandflow/legal/CookiePolicyPage";
import { RefundPolicyPage } from "@/components/brandflow/legal/RefundPolicyPage";

export function PrivacyPageClient() {
  const router = useRouter();
  return <PrivacyPolicyPage onBack={() => router.back()} />;
}

export function TermsPageClient() {
  const router = useRouter();
  return <TermsOfServicePage onBack={() => router.back()} />;
}

export function CookiesPageClient() {
  const router = useRouter();
  return <CookiePolicyPage onBack={() => router.back()} />;
}

export function RefundPageClient() {
  const router = useRouter();
  return <RefundPolicyPage onBack={() => router.back()} />;
}
