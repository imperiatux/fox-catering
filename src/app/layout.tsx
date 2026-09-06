import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fox Catering",
  description: "Comandă prânzul tău",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Fox paw icon */}
                <span className="text-brand-500 text-xl" aria-hidden="true">🦊</span>
                <span className="font-bold text-gray-900 text-sm tracking-tight">
                  Fox Catering
                </span>
              </div>
              <LanguageSwitcher locale={locale} />
            </div>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
