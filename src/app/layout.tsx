import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import 'leaflet/dist/leaflet.css';
import PulseSummaryGlobalPrompt from "@/components/PulseSummaryGlobalPrompt";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Playzi - Spontaneous Local Sports",
  description: "Find and join spontaneous sports activities locally.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <PulseSummaryGlobalPrompt />
      </body>
    </html>
  );
}
