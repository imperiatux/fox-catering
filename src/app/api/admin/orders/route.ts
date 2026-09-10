import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import { getOrders, localDateString } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = localDateString();
  const orders = await getOrders(date);

  // Tips are now stored per-order; compute the per-nickname map and total from orders.
  const tips: Record<string, number> = {};
  for (const o of orders) {
    if (o.tip) tips[o.nickname] = (tips[o.nickname] ?? 0) + o.tip;
  }
  const tipsTotal = Object.values(tips).reduce((s, v) => s + v, 0);

  return NextResponse.json({ orders, tips, tipsTotal });
}
