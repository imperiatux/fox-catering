import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import { getOrders, getMenuPhoto, getSettings } from "@/lib/redis";

/**
 * GET /api/admin/status
 * Returns a quick status snapshot for the admin dashboard:
 *   { orderCount, menuPhotoUploaded, cutoffEnabled, cutoffTime, isOpen }
 */
export async function GET(request: NextRequest) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new Date().toISOString().split("T")[0];

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

  return NextResponse.json({
    orderCount: orders.length,
    menuPhotoUploaded: menuPhoto !== null,
    cutoffEnabled: settings.cutoffEnabled,
    cutoffTime: `${String(settings.cutoffHour).padStart(2, "0")}:${String(settings.cutoffMinute).padStart(2, "0")}`,
    isOpen,
  });
}
