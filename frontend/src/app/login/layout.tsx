import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in or create a free FlashRead account to speed read research papers, PDFs, and academic text with RSVP and typography optimization.",
  openGraph: {
    title: "Sign In | FlashRead",
    description:
      "Sign in or create a free FlashRead account to speed read research papers and PDFs.",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
