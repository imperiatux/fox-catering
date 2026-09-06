import { NextResponse } from "next/server";
import { getMenuPhoto, getSettings, localDateString } from "@/lib/redis";

/**
 * GET /api/menu
 * Returns the menu status for today:
 *   { photoUrl: string | null, isOpen: boolean, reason: string | null }
 *
 * isOpen = true when:
 *   - today is an active weekday  AND
 *   - a menu photo has been uploaded for today  AND
 *   - cutoffEnabled is false  OR  current time < cutoff time
 */
export async function GET() {
  const date = localDateString();

  const [filename, settings] = await Promise.all([
    getMenuPhoto(date),
    getSettings(),
  ]);

  const photoUrl = filename ? `/uploads/${filename}` : null;

  // No photo uploaded yet — ordering is not possible.
  if (!filename) {
    return NextResponse.json({ photoUrl: null, isOpen: false, reason: "no_photo" });
  }

  // ISO weekday: getDay() returns 0 (Sun) … 6 (Sat); convert to 1 (Mon) … 7 (Sun)
  const now = new Date();
  const isoWeekday = now.getDay() === 0 ? 7 : now.getDay();
  const isActiveDay = settings.activeDays.includes(isoWeekday);

  if (!isActiveDay) {
    return NextResponse.json({ photoUrl, isOpen: false, reason: "not_active_day" });
  }

  if (settings.cutoffEnabled) {
    const cutoffMinutes = settings.cutoffHour * 60 + settings.cutoffMinute;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= cutoffMinutes) {
      return NextResponse.json({ photoUrl, isOpen: false, reason: "order_closed" });
    }
  }

  return NextResponse.json({ photoUrl, isOpen: true, reason: null });
}
