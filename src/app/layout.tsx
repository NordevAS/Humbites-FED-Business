import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css"; // ← Only CSS import needed!

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const almaraiR = localFont({
  src: "./fonts/Almarai-Regular.ttf",
  variable: "--Hum-F-A-R",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Humbites",
  description: "Created by the amazing devs at Nordev :3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${almaraiR.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
