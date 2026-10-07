import { Fraunces, Outfit } from "next/font/google";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "RKG Portal · Atlanta",
  description: "Book in-home wellness in Atlanta and dispatch the first provider who accepts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <p>Atlanta market. A 30% deposit starts the search. The other 70% is billed when the session starts.</p>
        </footer>
      </body>
    </html>
  );
}
