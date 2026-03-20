import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kairos — AI Prediction Market Arbitrage",
  description:
    "Five LLMs deliberate on prediction market price gaps. Every decision logged on-chain forever.",
  openGraph: {
    title: "Kairos — AI Prediction Market Arbitrage",
    description:
      "Five LLMs deliberate on prediction market price gaps. Every decision logged on-chain forever.",
    type: "website",
    url: "https://kairos.sh",
    siteName: "Kairos",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kairos — AI Prediction Market Arbitrage",
    description:
      "Five LLMs deliberate on prediction market price gaps. Every decision logged on-chain forever.",
  },
  metadataBase: new URL("https://kairos.sh"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
