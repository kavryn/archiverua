import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthErrorModal from "@/components/AuthErrorModal";
import { NavigationGuardProvider } from "@/context/NavigationGuardContext";
import { SessionProvider } from "next-auth/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Вікіархіватор";
const description = "Допоможе опублікувати справи з українських архівів на Вікісховищі та Вікіджерелах";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: "https://wikiarchiver.toolforge.org",
    siteName: title,
    locale: "uk_UA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <NavigationGuardProvider>
            {children}
            <AuthErrorModal />
          </NavigationGuardProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
