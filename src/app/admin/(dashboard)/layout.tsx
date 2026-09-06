"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

const NAV_ITEMS = [
  { key: "dashboard", href: "/admin", icon: "▦" },
  { key: "menu_upload", href: "/admin/menu", icon: "📷" },
  { key: "orders", href: "/admin/orders", icon: "📋" },
  { key: "settings", href: "/admin/settings", icon: "⚙" },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const navLinks = NAV_ITEMS.map(({ key, href, icon }) => {
    const isActive =
      href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
    return (
      <Link
        key={key}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-500 text-white"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <span className="text-base" aria-hidden="true">{icon}</span>
        {t(key)}
      </Link>
    );
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🦊</span>
            <span className="font-bold text-gray-900 text-sm">Fox Catering</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Admin</p>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navLinks}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors text-left"
          >
            <span aria-hidden="true">↩</span>
            {t("logout")}
          </button>
        </div>
      </aside>

      {/* Mobile: top bar + slide-out menu */}
      <div className="md:hidden fixed top-12 inset-x-0 z-30 bg-white border-b border-gray-200 flex items-center px-4 py-3 gap-3">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          className="p-1.5 rounded-lg hover:bg-gray-100"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">🦊</span>
          <span className="font-bold text-sm text-gray-900">Fox Admin</span>
        </div>
      </div>

      {/* Mobile slide-out drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="md:hidden fixed top-0 left-0 h-full w-56 bg-white z-50 flex flex-col shadow-xl">
            <div className="px-4 py-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">🦊</span>
                <span className="font-bold text-sm">Fox Admin</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-3 flex-1">
              {navLinks}
            </nav>
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors text-left"
              >
                <span aria-hidden="true">↩</span>
                {t("logout")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="md:pt-0 pt-28">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
