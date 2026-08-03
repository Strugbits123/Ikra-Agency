import type { Metadata } from "next";
import { zalando } from "./fonts";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ikra — rebranding agency",
  description:
    "ikra is a rebranding agency for the most discerning ambitions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${zalando.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
