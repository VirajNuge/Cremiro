import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clip",
  description: "Created with Next.js, Tailwind CSS, and Framer Motion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
