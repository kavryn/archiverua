import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthErrorModal from "@/components/AuthErrorModal";
import { NavigationGuardProvider } from "@/context/NavigationGuardContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Вікіархіватор",
  description: "Допоможе опублікувати справи з українських архівів на Вікісховищі та Вікіджерелах",
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
        <NavigationGuardProvider>
          {children}
        </NavigationGuardProvider>
        <AuthErrorModal />
      </body>
    </html>
  );
}
