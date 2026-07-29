import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FBR Digital Invoicing",
  description: "Create, validate and submit FBR digital invoices via PRAL.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: some browser extensions (e.g. ColorZilla adds
    // cz-shortcut-listen) mutate <body>/<html> before React hydrates, which would
    // otherwise trigger a hydration mismatch warning. This is harmless.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
