import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import 'leaflet/dist/leaflet.css';
import PulseSummaryGlobalPrompt from "@/components/PulseSummaryGlobalPrompt";
import ModerationNoticePrompt from "@/components/ModerationNoticePrompt";
import AuthSessionGuard from "@/components/AuthSessionGuard";
import PlayziOnboarding from "@/components/PlayziOnboarding";
import WebPushManager from "@/components/WebPushManager";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Playzi - Spontaneous Local Sports",
  description: "Find and join spontaneous sports activities locally.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
        <AuthSessionGuard />
        <WebPushManager />
        <PlayziOnboarding />
        <PulseSummaryGlobalPrompt />
        <ModerationNoticePrompt />
      </body>
    </html>
  );
}
