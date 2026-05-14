import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pocket — Roommate Expense Splitter",
  description: "Split expenses with your roommates, settle up fairly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F7F8FA]">
        {children}
        <Toaster position="bottom-center" toastOptions={{ duration: 3000, style: { borderRadius: "12px", fontFamily: "var(--font-inter)" } }} />
      </body>
    </html>
  );
}
