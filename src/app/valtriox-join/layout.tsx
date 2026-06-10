import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join Valtriox Team - Accept Your Invitation",
  description: "Accept your invitation to join the Valtriox platform team. Enter your invitation token to get started.",
  robots: { index: false, follow: false },
};

export default function ValtrioxJoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
