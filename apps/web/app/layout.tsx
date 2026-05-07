import type { ReactNode } from "react";
import type { Metadata } from "next";

import { APP_NAME } from "@supernova/shared";

import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} | Workforce Operations`,
  description:
    "Foundation workspace for SuperNova, a partner workforce operations system."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
