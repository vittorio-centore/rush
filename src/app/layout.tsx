import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rush",
  description: "Rush is a campus recruiting platform for club discovery and application tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
