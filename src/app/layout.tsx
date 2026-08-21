import type { Metadata } from "next";
import { Geist_Mono, Inter, Poppins } from "next/font/google";
import "./globals.css";

/** Headings and the wordmark. Geometric and friendly, like the category
 *  labels and offer banners on a cashback storefront. */
const poppins = Poppins({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

/** Everything else. Holds up at 10–13px, where most of this product lives. */
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

/** IDs, timestamps, field values and amounts. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClaimDesk",
  description: "Cashback claim triage for fast, evidence-led resolution",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Editor previews and browser extensions add classes to body before
          React hydrates. The className here is static, so suppressing the
          attribute warning cannot hide a real mismatch. */}
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
