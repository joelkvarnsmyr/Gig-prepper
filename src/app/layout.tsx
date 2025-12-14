import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gig-Prepper | AI Sound Engineer",
  description: "Din AI-drivna ljudtekniker. Prata med appen som en kollega, ladda upp din rider, och få en färdig setup-fil redo för din mixerkonsol.",
  keywords: ["ljudteknik", "mixerbord", "yamaha", "midas", "allen heath", "live sound", "FOH", "rider", "konsol"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
