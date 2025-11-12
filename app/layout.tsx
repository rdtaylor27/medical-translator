import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Translator App",
  description: "Speech-to-text translation app powered by Soniox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
