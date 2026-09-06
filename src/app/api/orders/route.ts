import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { addOrder, getOrders, getSettings } from "@/lib/redis";
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

  const date = new Date().toISOString().split("T")[0];
  const all = await getOrders(date);
  const mine = all.filter((o) => o.nickname === nickname);

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

  const VALID_MENU_TYPES: MenuType[] = ["veg", "non-veg", "custom"];
  const menuType = body.menuType as MenuType;
  if (!VALID_MENU_TYPES.includes(menuType)) {
    return NextResponse.json({ error: "Invalid menuType" }, { status: 400 });
  }

  const soup = typeof body.soup === "string" ? body.soup.trim() : "";
  const main = typeof body.main === "string" ? body.main.trim() : "";

  const note = typeof body.note === "string" ? body.note.trim() : undefined;

  const qty = Number(body.qty);
  if (!Number.isInteger(qty) || qty < 1) {
    return NextResponse.json({ error: "qty must be a positive integer" }, { status: 400 });
  }

  // --- Settings / cutoff check ---
  const settings = await getSettings();

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

  // --- Persist ---
  const date = now.toISOString().split("T")[0];
  const order: Order = {
    id: uuidv4(),
    nickname,
    menuType,
    soup,
    main,
    ...(note ? { note } : {}),
    qty,
    createdAt: now.toISOString(),
  };

  await addOrder(date, order);

  return NextResponse.json(order, { status: 201 });
}
