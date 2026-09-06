import { NextRequest, NextResponse } from "next/server";
import { getOrders, deleteOrder, updateOrder } from "@/lib/redis";
import type { MenuType } from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/orders/[id]
 * Body: { nickname }
 * Validates the order belongs to the given nickname before deleting.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: { nickname?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (!nickname) {
    return NextResponse.json({ error: "nickname is required" }, { status: 400 });
  }

  const date = new Date().toISOString().split("T")[0];
  const orders = await getOrders(date);
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.nickname !== nickname) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteOrder(date, id);
  return new NextResponse(null, { status: 204 });
}

/**
 * PATCH /api/orders/[id]
 * Body: { nickname, menuType?, soup?, main?, note?, qty? }
 * Validates ownership, then applies the partial update.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

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

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (!nickname) {
    return NextResponse.json({ error: "nickname is required" }, { status: 400 });
  }

  const date = new Date().toISOString().split("T")[0];
  const orders = await getOrders(date);
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.nickname !== nickname) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build patch — only include fields that were actually provided
  const VALID_MENU_TYPES: MenuType[] = ["veg", "non-veg", "custom"];
  const patch: Parameters<typeof updateOrder>[2] = {};

  if (body.menuType !== undefined) {
    if (!VALID_MENU_TYPES.includes(body.menuType as MenuType)) {
      return NextResponse.json({ error: "Invalid menuType" }, { status: 400 });
    }
    patch.menuType = body.menuType as MenuType;
  }
  if (body.soup !== undefined) {
    const soup = typeof body.soup === "string" ? body.soup.trim() : "";
    if (!soup) return NextResponse.json({ error: "soup cannot be empty" }, { status: 400 });
    patch.soup = soup;
  }
  if (body.main !== undefined) {
    const main = typeof body.main === "string" ? body.main.trim() : "";
    if (!main) return NextResponse.json({ error: "main cannot be empty" }, { status: 400 });
    patch.main = main;
  }
  if (body.note !== undefined) {
    patch.note = typeof body.note === "string" ? body.note.trim() || undefined : undefined;
  }
  if (body.qty !== undefined) {
    const qty = Number(body.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      return NextResponse.json({ error: "qty must be a positive integer" }, { status: 400 });
    }
    patch.qty = qty;
  }

  const updated = await updateOrder(date, id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
