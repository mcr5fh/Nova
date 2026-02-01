import type { Metadata } from "next";
import { Providers } from "@/components";
import "./globals.css";

export const metadata: Metadata = {
  title: "Program Nova Dashboard",
  description: "Real-time monitoring dashboard for Program Nova",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
