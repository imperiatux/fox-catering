import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getOrders, getMenuPhoto, getSettings, localDateString } from "@/lib/redis";

async function getStatus() {
  const date = localDateString();

  const [orders, menuPhoto, settings] = await Promise.all([
    getOrders(date),
    getMenuPhoto(date),
    getSettings(),
  ]);

  const now = new Date();
  const isoWeekday = now.getDay() === 0 ? 7 : now.getDay();
  const isActiveDay = settings.activeDays.includes(isoWeekday);

  let isOpen = isActiveDay;
  if (isOpen && settings.cutoffEnabled) {
    const cutoffMinutes = settings.cutoffHour * 60 + settings.cutoffMinute;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= cutoffMinutes) {
      isOpen = false;
    }
  }

  return {
    orderCount: orders.length,
    menuPhotoUploaded: menuPhoto !== null,
    cutoffEnabled: settings.cutoffEnabled,
    cutoffTime: `${String(settings.cutoffHour).padStart(2, "0")}:${String(settings.cutoffMinute).padStart(2, "0")}`,
    isOpen,
  };
}

const NAV_CARDS = [
  { key: "menu_upload", href: "/admin/menu", icon: "📷" },
  { key: "orders", href: "/admin/orders", icon: "📋" },
  { key: "settings", href: "/admin/settings", icon: "⚙" },
] as const;

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin");
  const status = await getStatus();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("dashboard")}</h1>
        <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString()}</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Order count */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("order_count")}</p>
          <p className="mt-2 text-4xl font-bold text-gray-900">{status.orderCount}</p>
        </div>

        {/* Menu uploaded */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("menu_uploaded")}</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                status.menuPhotoUploaded ? "bg-green-500" : "bg-gray-300"
              }`}
            />
            <p className={`text-base font-semibold ${status.menuPhotoUploaded ? "text-green-700" : "text-gray-400"}`}>
              {status.menuPhotoUploaded ? t("open") : t("no_photo")}
            </p>
          </div>
        </div>

        {/* Cutoff / open status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("cutoff_status")}</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                status.isOpen ? "bg-green-500" : "bg-red-400"
              }`}
            />
            <p className={`text-base font-semibold ${status.isOpen ? "text-green-700" : "text-red-600"}`}>
              {status.isOpen ? t("open") : t("closed_status")}
            </p>
          </div>
          {status.cutoffEnabled && (
            <p className="mt-1 text-xs text-gray-400">{status.cutoffTime}</p>
          )}
        </div>
      </div>

      {/* Navigation cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Quick links</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {NAV_CARDS.map(({ key, href, icon }) => (
            <Link
              key={key}
              href={href}
              className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">{icon}</span>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                    {t(key)}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-500 font-medium">→</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
