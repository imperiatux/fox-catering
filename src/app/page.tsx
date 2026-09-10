import { getMenuPhoto, getSettings, localDateString } from "@/lib/redis";
import OrderPage from "@/components/OrderPage";

// This page fetches live data from Redis — opt out of static generation
// so Next.js renders it on-demand at runtime, not during `next build`.
export const dynamic = "force-dynamic";

interface MenuStatus {
  photoUrl: string | null;
  isOpen: boolean;
  reason: string | null;
  prices: {
    priceNonVeg: number; priceVeg: number;
    priceSoupNonVeg: number; priceSoupVeg: number;
    priceMainNonVeg: number; priceMainVeg: number;
    priceCustom: number;
  };
}

async function fetchMenuStatus(): Promise<MenuStatus> {
  const date = localDateString();

  const [filename, settings] = await Promise.all([
    getMenuPhoto(date),
    getSettings(),
  ]);

  const photoUrl = filename ? `/uploads/${filename}` : null;

  const prices = {
    priceNonVeg:     settings.priceNonVeg,
    priceVeg:        settings.priceVeg,
    priceSoupNonVeg: settings.priceSoupNonVeg,
    priceSoupVeg:    settings.priceSoupVeg,
    priceMainNonVeg: settings.priceMainNonVeg,
    priceMainVeg:    settings.priceMainVeg,
    priceCustom:     settings.priceCustom,
  };

  // No photo uploaded yet — ordering is not possible.
  if (!filename) {
    return { photoUrl: null, isOpen: false, reason: "no_photo", prices };
  }

  const now = new Date();
  const isoWeekday = now.getDay() === 0 ? 7 : now.getDay();
  const isActiveDay = settings.activeDays.includes(isoWeekday);

  if (!isActiveDay) {
    return { photoUrl, isOpen: false, reason: "not_active_day", prices };
  }

  if (settings.cutoffEnabled) {
    const cutoffMinutes = settings.cutoffHour * 60 + settings.cutoffMinute;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= cutoffMinutes) {
      return { photoUrl, isOpen: false, reason: "order_closed", prices };
    }
  }

  return { photoUrl, isOpen: true, reason: null, prices };
}

export default async function Home() {
  const initialMenu = await fetchMenuStatus();
  return <OrderPage initialMenu={initialMenu} />;
}
