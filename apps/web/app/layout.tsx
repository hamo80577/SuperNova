import type { ReactNode } from "react";
import type { Metadata } from "next";

import { APP_NAME } from "@supernova/shared";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppLoadingProvider } from "@/components/ui/app-loading-provider";

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('supernova-ui-theme');if(['ORANGE','TEAL','BLUE','EMERALD','VIOLET','SLATE'].indexOf(t)>-1){document.documentElement.dataset.theme=t;}}catch(e){}"
          }}
        />
        <AppLoadingProvider>
          <AuthProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </AuthProvider>
        </AppLoadingProvider>
      </body>
    </html>
  );
}
