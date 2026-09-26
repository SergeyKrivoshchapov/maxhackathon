import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MaxProvider } from "@/components/providers/MaxProvider";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'ЖКХ',
  description: 'Обращения в ЖКХ через MAX',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" />
        <MaxProvider>{children}</MaxProvider>
      </body>
    </html>
  );
}
