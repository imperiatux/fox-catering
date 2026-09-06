"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

const LOCALES = [
  { code: "ro", flag: "🇷🇴", label: "Română" },
  { code: "en", flag: "🇬🇧", label: "English" },
] as const;

type Locale = (typeof LOCALES)[number]["code"];

export default function LanguageSwitcher({ locale }: { locale: string }) {
  // Initialise from the server-resolved locale so SSR and CSR always agree
  const [currentLocale, setCurrentLocale] = useState<Locale>(
    locale as Locale,
  );
  const router = useRouter();

  function switchLocale(next: Locale) {
    Cookies.set("NEXT_LOCALE", next, { expires: 365, path: "/" });
    setCurrentLocale(next);
    router.refresh();
  }

  return (
    <div className="flex gap-1" role="navigation" aria-label="Language">
      {LOCALES.map(({ code, flag, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          title={label}
          aria-label={label}
          aria-current={currentLocale === code ? "true" : undefined}
          className={`px-2 py-1 rounded-md text-xl leading-none transition-all ${
            currentLocale === code
              ? "opacity-100 ring-2 ring-brand-400 rounded-md"
              : "opacity-40 hover:opacity-80 hover:bg-gray-100"
          }`}
        >
          {flag}
        </button>
      ))}
    </div>
  );
}
