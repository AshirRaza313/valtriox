import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claim Your Beta Access | Valtriox",
  description: "Claim your exclusive beta access to Valtriox - Pakistan's premier brand management portal.",
  robots: { index: false, follow: false },
};

export default function BetaClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
