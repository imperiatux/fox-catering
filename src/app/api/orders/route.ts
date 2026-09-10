import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { addOrder, getOrders, getSettings, getMenuPhoto, localDateString } from "@/lib/redis";
import type { Order, MenuType } from "@/types";

/**
 * GET /api/orders?nickname=...
 * Returns today's orders that belong to the given nickname.
 * Never returns other users' orders.
 */
export async function GET(request: NextRequest) {
  const nickname = request.nextUrl.searchParams.get("nickname")?.trim();
  if (!nickname) {
    return NextResponse.json({ error: "nickname is required" }, { status: 400 });
  }

  const date = localDateString();
  const all = await getOrders(date);
  // Strip admin-only fields before returning to the public client
  const mine = all
    .filter((o) => o.nickname === nickname)
    .map(({ ip: _ip, country: _country, ...rest }) => rest);

  return NextResponse.json(mine);
}

/**
 * POST /api/orders
 * Body: { nickname, menuType, soup, main, note?, qty }
 * Checks:
 *   1. Body validation
 *   2. Today is an active weekday
 *   3. Cutoff has not passed (if cutoffEnabled)
 */
export async function POST(request: NextRequest) {
  let body: {
    nickname?: unknown;
    menuType?: unknown;
    soup?: unknown;
    main?: unknown;
    note?: unknown;
    qty?: unknown;
    tip?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // --- Validate required fields ---
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (!nickname) {
    return NextResponse.json({ error: "nickname is required" }, { status: 400 });
  }

  const VALID_MENU_TYPES: MenuType[] = ["veg", "non-veg", "soup-only", "main-only", "custom"];
  const menuType = body.menuType as MenuType;
  if (!VALID_MENU_TYPES.includes(menuType)) {
    return NextResponse.json({ error: "Invalid menuType" }, { status: 400 });
  }

  const VALID_COURSE_VALUES = ["non-veg", "veg", "none"];
  const soup = typeof body.soup === "string" ? body.soup.trim() : "";
  const main = typeof body.main === "string" ? body.main.trim() : "";
  if (!VALID_COURSE_VALUES.includes(soup)) {
    return NextResponse.json({ error: "Invalid soup value" }, { status: 400 });
  }
  if (!VALID_COURSE_VALUES.includes(main)) {
    return NextResponse.json({ error: "Invalid main value" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim() : undefined;

  const qty = Number(body.qty);
  if (!Number.isInteger(qty) || qty < 1) {
    return NextResponse.json({ error: "qty must be a positive integer" }, { status: 400 });
  }

  const tip = body.tip !== undefined ? Number(body.tip) : qty; // default 1 RON per item
  if (!isFinite(tip) || tip < 0) {
    return NextResponse.json({ error: "tip must be a non-negative number" }, { status: 400 });
  }

  // --- Settings / cutoff / photo check ---
  const [settings, menuPhoto] = await Promise.all([
    getSettings(),
    getMenuPhoto(localDateString()),
  ]);

  if (!menuPhoto) {
    return NextResponse.json({ error: "no_photo" }, { status: 403 });
  }

  const now = new Date();
  const isoWeekday = now.getDay() === 0 ? 7 : now.getDay();
  if (!settings.activeDays.includes(isoWeekday)) {
    return NextResponse.json({ error: "not_active_day" }, { status: 403 });
  }

  if (settings.cutoffEnabled) {
    const cutoffMinutes = settings.cutoffHour * 60 + settings.cutoffMinute;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= cutoffMinutes) {
      return NextResponse.json({ error: "order_closed" }, { status: 403 });
    }
  }

  // --- Capture IP and resolve country ---
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    undefined;

  let country: string | undefined;
  if (ip && ip !== "127.0.0.1" && ip !== "::1") {
    try {
      const geo = await fetch(`http://ip-api.com/json/${ip}?fields=country`, {
        signal: AbortSignal.timeout(2000),
      });
      if (geo.ok) {
        const data = await geo.json() as { country?: string };
        country = data.country ?? undefined;
      }
    } catch {
      // geo lookup is best-effort — never block the order
    }
  }

  // --- Persist ---
  const date = localDateString();
  const order: Order = {
    id: uuidv4(),
    nickname,
    menuType,
    soup,
    main,
    ...(note ? { note } : {}),
    qty,
    tip,
    ...(ip      ? { ip }      : {}),
    ...(country ? { country } : {}),
    createdAt: now.toISOString(),
  };

  await addOrder(date, order);

  // Return order without IP/country to the client (admin-only fields)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ip: _ip, country: _country, ...publicOrder } = order;
  return NextResponse.json(publicOrder, { status: 201 });
}
