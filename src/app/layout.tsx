import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./operations.css";
import "./controls.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Support Center · Selah El Telmeez",
  description: "Technical support ticketing and WhatsApp inbox",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {process.env.NEXT_PUBLIC_APP_ENV==="preview"&&<div className="border-b bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">Preview · synthetic test data</div>}
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
