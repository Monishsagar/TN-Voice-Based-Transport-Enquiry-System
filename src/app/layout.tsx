import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LanguageProvider } from "@/components/providers/language-provider";

export const metadata: Metadata = {
  title: "TN Transport Enquiry | தமிழ்நாடு போக்குவரத்து விசாரணை",
  description:
    "Voice and text-based transport enquiry for all of Tamil Nadu — buses, trains, cabs, and autos. Search routes, fares, and travel times across cities, towns, and villages in English, Tamil, or Tanglish.",
  keywords: [
    "Tamil Nadu transport",
    "bus route enquiry",
    "train enquiry Tamil Nadu",
    "TNSTC routes",
    "voice transport search",
  ],
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
