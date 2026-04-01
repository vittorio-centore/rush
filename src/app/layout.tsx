import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  // Load the optical size variable axis along with weight
  axes: ["opsz"],
  weight: "variable",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Rush",
  description: "Rush is a campus recruiting platform for club discovery and application tracking.",
  icons: {
    icon: "/rush-mark.svg",
    shortcut: "/rush-mark.svg",
    apple: "/rush-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${fraunces.variable} ${inter.variable}`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
