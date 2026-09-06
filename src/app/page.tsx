import { getMenuPhoto, getSettings } from "@/lib/redis";
import OrderPage from "@/components/OrderPage";

// This page fetches live data from Redis — opt out of static generation
// so Next.js renders it on-demand at runtime, not during `next build`.
export const dynamic = "force-dynamic";

interface MenuStatus {
  photoUrl: string | null;
  isOpen: boolean;
  reason: string | null;
}

async function fetchMenuStatus(): Promise<MenuStatus> {
  const date = new Date().toISOString().split("T")[0];

  const [filename, settings] = await Promise.all([
    getMenuPhoto(date),
    getSettings(),
  ]);

  const photoUrl = filename ? `/uploads/${filename}` : null;

  const now = new Date();
  const isoWeekday = now.getDay() === 0 ? 7 : now.getDay();
  const isActiveDay = settings.activeDays.includes(isoWeekday);

  if (!isActiveDay) {
    return { photoUrl, isOpen: false, reason: "not_active_day" };
  }

  if (settings.cutoffEnabled) {
    const cutoffMinutes = settings.cutoffHour * 60 + settings.cutoffMinute;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= cutoffMinutes) {
      return { photoUrl, isOpen: false, reason: "order_closed" };
    }
  }

  return { photoUrl, isOpen: true, reason: null };
}

export default async function Home() {
  const initialMenu = await fetchMenuStatus();
  return <OrderPage initialMenu={initialMenu} />;
}
