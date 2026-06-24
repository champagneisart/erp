import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Champagne is Art Studio",
  description: "Intern CRM en productiesysteem",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={geist.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
