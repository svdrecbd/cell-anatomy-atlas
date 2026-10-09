import "./globals.css";
import "./institutional.css";
import "./email-signup.css";
import type { Metadata } from "next";
import { PUBLIC_SITE_ORIGIN, SEARCH_PAGES } from "../lib/search-metadata";
import { Navbar } from "../components/navbar";
import { CompareProvider } from "../lib/compare-context";
import { CompareDrawer } from "../components/compare-drawer";
import { InstitutionalFooter } from "../components/institutional-footer";
import { BetaSignupPrompt } from "../components/beta-signup-prompt";
import { StructuredData } from "../components/structured-data";
import { createSiteStructuredData } from "../lib/structured-data";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  title: SEARCH_PAGES["/"].title,
  description: SEARCH_PAGES["/"].description,
  verification: {
    google: "eMHiPguPkoTDf5I4WqAB-R4SZK-8V4_BIlV4FHarj2A",
    other: { "msvalidate.01": "3BDAA3C770AEDE825F71A33CCB4003CC" }
  },
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
  },
};

import React from "react";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <CompareProvider>
          <StructuredData identifier="cell-anatomy-site-metadata" value={createSiteStructuredData()} />
          <Navbar />
          {children}
          <CompareDrawer />
          <InstitutionalFooter currentYear={currentYear} />
          <BetaSignupPrompt />
        </CompareProvider>
      </body>
    </html>
  );
}
